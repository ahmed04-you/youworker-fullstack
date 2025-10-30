"""
Ingestion pipeline coordinator.

Coordinates enumeration, parsing, chunking, embedding, and upserting.
Relies on sub-modules for specific concerns.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import mimetypes
import os
import shutil
import tempfile
from pathlib import Path
from typing import Sequence

from qdrant_client import QdrantClient

import httpx
from uuid import uuid4

from packages.common import Settings, get_logger, get_settings
from packages.llm import Embedder
from packages.parsers import (
    docling_extract,
    media_transcribe,
    ocr_extract,
    should_run_ocr,
)
from packages.parsers.models import DocChunk, IngestionItem, IngestionReport
from packages.vectorstore import ensure_collections, get_client
from packages.vectorstore.schema import DocumentSource

from .chunker import chunk_text_tokens
from .embedder_integration import embed_chunks, prepare_points, upsert_embedded_chunks
from .metadata_builder import build_chunk_metadata, prune_metadata

logger = get_logger(__name__)


@dataclass(slots=True)
class PipelineConfig:
    """Mutable configuration for the ingestion pipeline."""

    chunk_size: int
    chunk_overlap: int
    recursive: bool = True
    max_concurrency: int = 4


class IngestionPipeline:
    """Coordinate parsing, embeddings, and Qdrant upserts."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        config: PipelineConfig | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._config = config or PipelineConfig(
            chunk_size=self._settings.ingest_chunk_size,
            chunk_overlap=self._settings.ingest_chunk_overlap,
            max_concurrency=self._settings.ingest_max_concurrency,
        )
        self._temp_dirs: list[Path] = []
        self._active_ingestions = 0

        # Ensure collections on init
        client = self._get_qdrant_client()
        ensure_collections(client, self._settings)

    def _get_qdrant_client(self) -> QdrantClient:
        return get_client(self._settings)

    def _get_embedder(self) -> Embedder:
        from .embedder_integration import get_embedder

        return get_embedder(self._settings)

    async def ingest_path(
        self,
        path_or_url: str,
        *,
        recursive: bool | None = None,
        from_web: bool = False,
        tags: Sequence[str] | None = None,
        collection_name: str | None = None,
        user_id: int | None = None,
    ) -> IngestionReport:
        """High-level ingestion API for local paths or web resources."""
        self._active_ingestions += 1
        client = self._get_qdrant_client()
        ensure_collections(client, self._settings, collection_name=collection_name)

        recursive = self._config.recursive if recursive is None else recursive
        tags = list(tags or [])

        try:
            if from_web:
                items = await self._fetch_web_resources(path_or_url)
            else:
                items = self._enumerate_local(Path(path_or_url), recursive=recursive)
        except Exception as exc:
            logger.error(
                "ingestion-enumeration-error",
                extra={
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                    "path_or_url": path_or_url,
                    "from_web": from_web,
                    "user_id": user_id
                }
            )
            return IngestionReport(
                total_files=0,
                total_chunks=0,
                files=[],
                errors=[{"target": path_or_url, "error": str(exc)}],
            )

        file_reports: list[dict] = []
        errors: list[dict] = []
        total_chunks = 0

        if not items:
            return IngestionReport(total_files=0, total_chunks=0, files=[], errors=[])

        concurrency = self._effective_concurrency()
        semaphore = asyncio.Semaphore(concurrency)
        tasks = [
            asyncio.create_task(
                self._process_item_task(
                    idx,
                    item,
                    tags=tags,
                    from_web=from_web,
                    collection_name=collection_name,
                    user_id=user_id,
                    semaphore=semaphore,
                )
            )
            for idx, item in enumerate(items)
        ]

        results: list[tuple[int, IngestionItem, int, Exception | None]] = []
        for task in asyncio.as_completed(tasks):
            results.append(await task)

        results.sort(key=lambda entry: entry[0])

        for _, item, chunk_count, error in results:
            if error is not None:
                errors.append({"path": str(item.path), "error": str(error)})
                continue

            total_chunks += chunk_count
            file_reports.append(
                {
                    "path": str(item.path),
                    "uri": item.uri,
                    "mime": item.mime,
                    "chunks": chunk_count,
                    "size_bytes": item.bytes_size,
                }
            )

        report = IngestionReport(
            total_files=len(items),
            total_chunks=total_chunks,
            files=file_reports,
            errors=errors,
        )
        self._cleanup_temp_dirs()
        self._active_ingestions = max(0, self._active_ingestions - 1)
        return report

    async def _process_item_task(
        self,
        index: int,
        item: IngestionItem,
        *,
        tags: Sequence[str],
        from_web: bool,
        collection_name: str | None = None,
        user_id: int | None = None,
        semaphore: asyncio.Semaphore,
    ) -> tuple[int, IngestionItem, int, Exception | None]:
        async with semaphore:
            try:
                chunk_count = await self._process_item(
                    item, tags=tags, from_web=from_web, collection_name=collection_name, user_id=user_id
                )
                return (index, item, chunk_count, None)
            except Exception as exc:
                logger.error(
                    "ingestion-item-error",
                    extra={
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                        "item_path": str(item.path),
                        "item_uri": item.uri,
                        "user_id": user_id
                    }
                )
                return (index, item, 0, exc)

    async def _process_item(
        self,
        item: IngestionItem,
        *,
        tags: Sequence[str],
        from_web: bool,
        collection_name: str | None = None,
        user_id: int | None = None,
    ) -> int:
        source = self._determine_source(item.mime, from_web=from_web)
        raw_chunks: list[DocChunk] = []

        if source in {"audio", "video"}:
            raw_chunks.extend(
                media_transcribe(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
        elif source == "image":
            raw_chunks.extend(
                ocr_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
        else:
            # Docling for documents
            docling_chunks = list(
                docling_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
            raw_chunks.extend(docling_chunks)

            # OCR fallback if needed
            if should_run_ocr(item.mime, docling_chunks):
                ocr_chunks = list(
                    ocr_extract(
                        item.path,
                        uri=item.uri,
                        mime=item.mime,
                        source=source,
                    )
                )
                raw_chunks.extend(ocr_chunks)

            # Table fallback only if no Docling chunks
            if not docling_chunks:
                from packages.parsers.table_extractor import extract as table_extract

                table_chunks = list(
                    table_extract(
                        item.path,
                        uri=item.uri,
                        mime=item.mime,
                        source=source,
                    )
                )
                raw_chunks.extend(table_chunks)

        if not raw_chunks:
            return 0

        path_hash = self._path_hash(item)

        # Prepare chunks using chunker

        full_text = "\n\n".join(chunk.text for chunk in raw_chunks if chunk.text.strip())
        text_chunks = chunk_text_tokens(
            full_text, self._config.chunk_size, self._config.chunk_overlap
        )

        prepared_chunks = []
        for idx, text in enumerate(text_chunks, 1):
            metadata = {
                "from_raw_chunks": len(raw_chunks),
                "source_type": source,
            }
            prepared_chunks.append(
                DocChunk(
                    id=str(uuid4()),
                    chunk_id=idx,
                    text=text,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                    metadata=metadata,
                )
            )

        if not prepared_chunks:
            return 0

        # Embed and upsert

        vectors = await embed_chunks(prepared_chunks, self._get_embedder())

        # Build and prune metadata
        for chunk in prepared_chunks:
            chunk_tags = set(tags)
            tag_values = chunk.metadata.pop("tags", None)
            if isinstance(tag_values, (list, tuple, set)):
                chunk_tags.update(tag for tag in tag_values if isinstance(tag, str))
            combined_tags = sorted(chunk_tags)
            chunk.metadata = build_chunk_metadata(
                chunk=chunk,
                path_hash=path_hash,
                original_format=item.mime,
                output_format="markdown",
                user_id=user_id,
                tags=list(combined_tags) if combined_tags else None,
            )
            chunk.metadata = prune_metadata(chunk.metadata)

        points = await prepare_points(
            prepared_chunks,
            vectors,
            self._settings,
            collection_name=collection_name,
        )

        await upsert_embedded_chunks(points, self._settings)

        return len(prepared_chunks)

    def _enumerate_local(self, path: Path, *, recursive: bool) -> list[IngestionItem]:
        if not path.exists():
            raise FileNotFoundError(path)

        items: list[IngestionItem] = []
        if path.is_file():
            items.append(self._make_item(path, uri=path.as_uri()))
            return items

        if not recursive:
            for child in path.iterdir():
                if child.is_file():
                    items.append(self._make_item(child, uri=child.as_uri()))
            return items

        for root, _, files in os.walk(path):
            for filename in files:
                file_path = Path(root) / filename
                try:
                    items.append(self._make_item(file_path, uri=file_path.as_uri()))
                except OSError as exc:
                    logger.warning(
                        "ingestion-enumerate-error",
                        extra={
                            "error": str(exc),
                            "error_type": type(exc).__name__,
                            "file_path": str(file_path)
                        }
                    )
        return items

    @staticmethod
    def _make_item(path: Path, *, uri: str | None) -> IngestionItem:
        mime, _ = mimetypes.guess_type(path.name)
        bytes_size = path.stat().st_size
        return IngestionItem(path=path, uri=uri, mime=mime, bytes_size=bytes_size)

    async def _fetch_web_resources(self, url: str) -> list[IngestionItem]:
        tmp_dir = Path(tempfile.mkdtemp(prefix="ingest-web-"))
        self._temp_dirs.append(tmp_dir)

        user_agent = (
            getattr(self._settings, "ingest_user_agent", None)
            or "YouWorkerIngest/1.0 (+https://youworker.example)"
        )

        async with httpx.AsyncClient(
            follow_redirects=True, timeout=30.0, headers={"User-Agent": user_agent}
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

        html_content = response.text
        if not html_content:
            return []

        target = tmp_dir / "page-0.html"
        target.write_text(html_content, encoding="utf-8")
        final_url = str(response.url) if response.url else url
        return [
            IngestionItem(
                path=target,
                uri=final_url,
                mime="text/html",
                bytes_size=target.stat().st_size,
            )
        ]

    @staticmethod
    def _determine_source(mime: str | None, *, from_web: bool) -> DocumentSource:
        mime = (mime or "").lower()
        if mime.startswith("audio/"):
            return "audio"
        if mime.startswith("video/"):
            return "video"
        if mime.startswith("image/"):
            return "image"
        if from_web:
            return "web"
        return "file"

    @staticmethod
    def _path_hash(item: IngestionItem) -> str:
        import hashlib

        basis = item.uri or str(item.path)
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()

    def _cleanup_temp_dirs(self) -> None:
        for directory in self._temp_dirs:
            try:
                shutil.rmtree(directory, ignore_errors=True)
            except Exception as exc:
                logger.warning(
                    "ingestion-temp-cleanup-error",
                    extra={
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                        "directory": str(directory)
                    }
                )
        self._temp_dirs.clear()

    def _effective_concurrency(self) -> int:
        configured = max(1, int(self._config.max_concurrency or 1))
        cpu_limit = os.cpu_count() or 1
        # Tune based on settings or dynamic (e.g., based on GPU
        if self._settings.ingest_accelerator == "gpu":
            configured = min(configured, 2)  # Limit for GPU memory
        return max(1, min(configured, cpu_limit, 18))
