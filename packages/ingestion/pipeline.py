"""
Ingestion pipeline coordinator.

Coordinates enumeration, parsing, chunking, embedding, and upserting.
Relies on sub-modules for specific concerns.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from html.parser import HTMLParser
import hashlib
import json
import mimetypes
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Sequence
from urllib.parse import urljoin, urlparse

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
    table_extract,
)
from packages.parsers.models import DocChunk, IngestionItem, IngestionReport
from packages.vectorstore import ensure_collections, get_client
from packages.vectorstore.schema import DocumentSource

from .chunker import chunk_text_tokens
from .embedder_integration import embed_chunks, prepare_points, upsert_embedded_chunks
from .metadata_builder import build_chunk_metadata, collect_artifacts, prune_metadata

logger = get_logger(__name__)

_CUSTOM_MIME_TYPES: tuple[tuple[str, str], ...] = (
    ("text/markdown", ".md"),
    ("text/markdown", ".markdown"),
    ("text/markdown", ".mdx"),
    ("text/plain", ".rst"),
    ("text/plain", ".tex"),
    ("text/yaml", ".yml"),
    ("text/yaml", ".yaml"),
    ("application/json", ".jsonl"),
    ("application/json", ".ndjson"),
    ("text/tab-separated-values", ".tsv"),
    ("text/tab-separated-values", ".tab"),
    ("audio/mp4", ".m4a"),
    ("audio/mp4", ".m4b"),
    ("audio/aac", ".aac"),
    ("audio/ogg", ".oga"),
    ("audio/webm", ".weba"),
    ("audio/flac", ".flac"),
    ("video/mp4", ".m4v"),
    ("video/webm", ".webm"),
    ("video/x-msvideo", ".avi"),
)

for mime, extension in _CUSTOM_MIME_TYPES:
    mimetypes.add_type(mime, extension, strict=False)

EMBEDDED_ASSET_EXTENSIONS: set[str] = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".svg",
    ".pdf",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".csv",
}
MAX_EMBEDDED_ASSETS = 25
MAX_EMBEDDED_ASSET_BYTES = 8 * 1024 * 1024


@dataclass(slots=True)
class PipelineConfig:
    """Mutable configuration for the ingestion pipeline."""

    chunk_size: int
    chunk_overlap: int
    recursive: bool = True
    max_concurrency: int = 4


@dataclass(slots=True)
class ProcessedItemResult:
    """Result details for a processed ingestion item."""

    chunk_count: int
    artifact_summary: dict[str, Any]


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

        results: list[tuple[int, IngestionItem, ProcessedItemResult | None, Exception | None]] = []
        for task in asyncio.as_completed(tasks):
            results.append(await task)

        results.sort(key=lambda entry: entry[0])

        aggregate_artifacts: dict[str, int] = {"tables": 0, "images": 0, "charts": 0}

        for _, item, stats, error in results:
            if error is not None:
                errors.append({"path": str(item.path), "error": str(error)})
                continue

            if stats is None:
                continue

            total_chunks += stats.chunk_count
            artifact_counts = stats.artifact_summary.get("counts", {})
            for key, value in artifact_counts.items():
                aggregate_artifacts[key] = aggregate_artifacts.get(key, 0) + int(value or 0)

            file_reports.append(
                {
                    "path": str(item.path),
                    "uri": item.uri,
                    "mime": item.mime,
                    "chunks": stats.chunk_count,
                    "size_bytes": item.bytes_size,
                    "artifacts": artifact_counts,
                }
            )

        report = IngestionReport(
            total_files=len(items),
            total_chunks=total_chunks,
            files=file_reports,
            errors=errors,
            artifact_totals=aggregate_artifacts if any(aggregate_artifacts.values()) else None,
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
    ) -> tuple[int, IngestionItem, ProcessedItemResult | None, Exception | None]:
        async with semaphore:
            try:
                stats = await self._process_item(
                    item, tags=tags, from_web=from_web, collection_name=collection_name, user_id=user_id
                )
                return (index, item, stats, None)
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
                return (index, item, None, exc)

    async def _process_item(
        self,
        item: IngestionItem,
        *,
        tags: Sequence[str],
        from_web: bool,
        collection_name: str | None = None,
        user_id: int | None = None,
    ) -> ProcessedItemResult:
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
            docling_chunks = list(
                docling_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
            raw_chunks.extend(docling_chunks)

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

            table_chunks = list(
                table_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
            raw_chunks.extend(self._dedupe_table_chunks(raw_chunks, table_chunks))

        artifact_summary = collect_artifacts(raw_chunks)

        if not raw_chunks:
            return ProcessedItemResult(chunk_count=0, artifact_summary=artifact_summary)

        path_hash = self._path_hash(item)
        prepared_chunks: list[DocChunk] = []

        for raw_index, raw_chunk in enumerate(raw_chunks, start=1):
            raw_text = raw_chunk.text or ""
            segments = chunk_text_tokens(
                raw_text,
                self._config.chunk_size,
                self._config.chunk_overlap,
            )
            if not segments:
                trimmed = raw_text.strip()
                if not trimmed:
                    continue
                segments = [trimmed]

            tag_values = None
            base_metadata = dict(raw_chunk.metadata or {})
            if "tags" in base_metadata:
                tag_values = base_metadata.pop("tags")
            total_parts = len(segments)
            for part_index, text in enumerate(segments, start=1):
                segment_text = text.strip()
                if not segment_text:
                    continue

                chunk_tags = set(tags)
                if isinstance(tag_values, (list, tuple, set)):
                    chunk_tags.update(tag for tag in tag_values if isinstance(tag, str))
                combined_tags = sorted(chunk_tags) if chunk_tags else None

                metadata = dict(base_metadata)
                metadata["source_type"] = metadata.get("source_type") or source
                metadata["raw_chunk_index"] = raw_index
                metadata["raw_chunk_part"] = part_index
                metadata["raw_chunk_parts"] = total_parts
                if combined_tags:
                    metadata["__chunk_tags"] = combined_tags

                prepared_chunks.append(
                    DocChunk(
                        id=str(uuid4()),
                        chunk_id=len(prepared_chunks) + 1,
                        text=segment_text,
                        uri=raw_chunk.uri or item.uri,
                        mime=raw_chunk.mime or item.mime,
                        source=source,
                        metadata=metadata,
                    )
                )

        if not prepared_chunks:
            return ProcessedItemResult(chunk_count=0, artifact_summary=artifact_summary)

        vectors = await embed_chunks(prepared_chunks, self._get_embedder())

        attach_summary = True
        artifacts_sample = artifact_summary.get("artifacts") or {}
        pages_metadata = artifact_summary.get("pages") or []

        for chunk in prepared_chunks:
            chunk_tags = set(tags)
            tag_values = chunk.metadata.pop("__chunk_tags", None)
            if isinstance(tag_values, (list, tuple, set)):
                chunk_tags.update(tag for tag in tag_values if isinstance(tag, str))
            combined_tags = sorted(chunk_tags) if chunk_tags else None

            extra_metadata: dict[str, Any] | None = None
            pages_payload: Sequence[dict[str, Any]] | None = None
            if attach_summary:
                extra_metadata = {
                    "artifact_summary": artifact_summary.get("counts", {}),
                    "artifacts_sample": artifacts_sample,
                }
                pages_payload = pages_metadata
                attach_summary = False

            chunk.metadata = build_chunk_metadata(
                chunk=chunk,
                path_hash=path_hash,
                original_format=item.mime,
                output_format="markdown",
                user_id=user_id,
                pages=pages_payload,
                tags=list(combined_tags) if combined_tags else None,
                base_metadata=chunk.metadata,
                extra_metadata=extra_metadata,
            )
            chunk.metadata = prune_metadata(chunk.metadata)

        points = await prepare_points(
            prepared_chunks,
            vectors,
            self._settings,
            collection_name=collection_name,
        )

        await upsert_embedded_chunks(points, self._settings)

        return ProcessedItemResult(
            chunk_count=len(prepared_chunks),
            artifact_summary=artifact_summary,
        )

    async def _download_embedded_assets(
        self,
        client: httpx.AsyncClient,
        *,
        html_content: str,
        base_url: str,
        tmp_dir: Path,
    ) -> list[IngestionItem]:
        asset_urls = self._parse_embedded_asset_urls(html_content)
        if not asset_urls:
            return []

        base_parsed = urlparse(base_url)
        downloaded: list[IngestionItem] = []

        for index, raw_url in enumerate(asset_urls, start=1):
            if len(downloaded) >= MAX_EMBEDDED_ASSETS:
                break

            candidate = (raw_url or "").strip()
            if not candidate or candidate.startswith(("data:", "javascript:", "#")):
                continue

            absolute = urljoin(base_url, candidate)
            parsed = urlparse(absolute)
            if parsed.scheme not in {"http", "https"}:
                continue
            if parsed.netloc and parsed.netloc != base_parsed.netloc:
                continue
            if not self._is_supported_asset_path(parsed.path):
                continue

            try:
                response = await client.get(absolute)
                response.raise_for_status()
            except Exception as exc:  # pragma: no cover - network failure
                logger.debug(
                    "ingestion-asset-download-error",
                    extra={"asset_url": absolute, "error": str(exc)},
                )
                continue

            content = response.content
            if not content:
                continue
            if len(content) > MAX_EMBEDDED_ASSET_BYTES:
                logger.debug(
                    "ingestion-asset-too-large",
                    extra={"asset_url": absolute, "size": len(content)},
                )
                continue

            mime = response.headers.get("content-type")
            if mime:
                mime = mime.split(";")[0].strip()

            suffix = Path(parsed.path).suffix
            if not suffix and mime:
                suffix = mimetypes.guess_extension(mime) or ""
            suffix = suffix or ""

            filename = self._unique_asset_filename(tmp_dir, index, suffix)
            asset_path = tmp_dir / filename
            try:
                asset_path.write_bytes(content)
            except Exception as exc:  # pragma: no cover - filesystem failure
                logger.debug(
                    "ingestion-asset-write-error",
                    extra={"path": str(asset_path), "error": str(exc)},
                )
                continue

            inferred_mime = mime or mimetypes.guess_type(asset_path.name)[0]
            downloaded.append(
                IngestionItem(
                    path=asset_path,
                    uri=absolute,
                    mime=inferred_mime,
                    bytes_size=len(content),
                )
            )

        return downloaded

    @staticmethod
    def _parse_embedded_asset_urls(html_content: str) -> list[str]:
        parser = _AssetHTMLParser()
        try:
            parser.feed(html_content)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("ingestion-asset-parse-error", extra={"error": str(exc)})
        seen: set[str] = set()
        results: list[str] = []
        for url in parser.urls:
            cleaned = (url or "").strip()
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            results.append(cleaned)
        return results

    @staticmethod
    def _is_supported_asset_path(path: str) -> bool:
        suffix = Path(path).suffix.lower()
        return suffix in EMBEDDED_ASSET_EXTENSIONS

    @staticmethod
    def _unique_asset_filename(tmp_dir: Path, index: int, suffix: str) -> str:
        suffix = suffix if suffix.startswith(".") or not suffix else f".{suffix}"
        suffix = suffix if suffix else ""
        stem = f"asset-{index}"
        candidate = f"{stem}{suffix}"
        counter = 1
        while (tmp_dir / candidate).exists():
            counter += 1
            candidate = f"{stem}-{counter}{suffix}"
        return candidate

    def _dedupe_table_chunks(
        self,
        existing_chunks: Sequence[DocChunk],
        candidate_chunks: Sequence[DocChunk],
    ) -> list[DocChunk]:
        if not candidate_chunks:
            return []

        seen_keys: set[str] = set()
        for chunk in existing_chunks:
            key = self._table_chunk_key(chunk)
            if key:
                seen_keys.add(key)

        deduped: list[DocChunk] = []
        for chunk in candidate_chunks:
            key = self._table_chunk_key(chunk)
            if not key or key in seen_keys:
                continue
            seen_keys.add(key)
            metadata = dict(chunk.metadata or {})
            metadata.setdefault("content_type", "table")
            chunk.metadata = metadata
            deduped.append(chunk)

        return deduped

    @staticmethod
    def _table_chunk_key(chunk: DocChunk) -> str | None:
        metadata = chunk.metadata or {}
        payload = metadata.get("table_data") or metadata.get("table") or chunk.text
        if not payload:
            return None
        try:
            encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        except TypeError:
            encoded = repr(payload)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

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
            final_url = str(response.url) if response.url else url
            html_content = response.text or ""

            page_path = tmp_dir / "page-0.html"
            page_path.write_text(html_content, encoding="utf-8")

            items: list[IngestionItem] = [
                IngestionItem(
                    path=page_path,
                    uri=final_url,
                    mime="text/html",
                    bytes_size=page_path.stat().st_size,
                )
            ]

            asset_items = await self._download_embedded_assets(
                client,
                html_content=html_content,
                base_url=final_url,
                tmp_dir=tmp_dir,
            )
            items.extend(asset_items)

        return items

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


class _AssetHTMLParser(HTMLParser):
    """Lightweight HTML parser to collect embedded asset URLs."""

    def __init__(self) -> None:
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = dict(attrs)

        def _push(value: str | None) -> None:
            if value:
                self.urls.append(value)

        tag = tag.lower()
        if tag == "img":
            _push(attr_map.get("src"))
            _push(attr_map.get("data-src"))
            _push(attr_map.get("data-original"))
        elif tag in {"source", "track"}:
            _push(attr_map.get("src"))
        elif tag == "object":
            _push(attr_map.get("data"))
        elif tag in {"embed", "video"}:
            _push(attr_map.get("src"))
            _push(attr_map.get("poster"))
        elif tag == "a":
            _push(attr_map.get("href"))
        elif tag == "link":
            _push(attr_map.get("href"))
