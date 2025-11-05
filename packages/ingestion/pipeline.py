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
    DocumentToImageConverter,
    VisionParser,
)
from packages.parsers.media_transcriber import (
    parse_audio_to_markdown,
    parse_video_to_markdown,
)
from packages.parsers.models import DocChunk, IngestionItem, IngestionReport
from packages.llm.model_manager import get_model_manager
from packages.vectorstore import ensure_collections, get_client
from packages.vectorstore.schema import DocumentSource

from packages.parsers.chunker import chunk_text, chunk_markdown_with_headers
from .embedder_integration import embed_chunks, prepare_points, upsert_embedded_chunks
from .metadata_builder import build_chunk_metadata, prune_metadata

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
            chunk_size=2048,  # Vision-based pipeline uses 2048 token chunks
            chunk_overlap=256,
            max_concurrency=self._settings.ingest_max_concurrency,
        )
        self._temp_dirs: list[Path] = []
        self._active_ingestions = 0

        # Vision-based components
        self.doc_converter = DocumentToImageConverter()
        self.vision_parser = VisionParser()

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

        # Switch to ingestion mode (load vision models, unload chat model)
        model_manager = await get_model_manager()
        logger.info("Switching to ingestion mode for document processing")
        await model_manager.switch_to_ingestion_mode()

        try:
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
            aggregate_samples: dict[str, list[dict[str, Any]]] = {
                "tables": [],
                "images": [],
                "charts": [],
            }

            for _, item, stats, error in results:
                if error is not None:
                    errors.append({"path": str(item.path), "error": str(error)})
                    continue

                if stats is None:
                    continue

                total_chunks += stats.chunk_count
                artifact_counts = stats.artifact_summary.get("counts", {})
                artifact_samples = stats.artifact_summary.get("artifacts", {})
                for key, value in artifact_counts.items():
                    aggregate_artifacts[key] = aggregate_artifacts.get(key, 0) + int(value or 0)

                for key, entries in (artifact_samples or {}).items():
                    if not isinstance(entries, list):
                        continue
                    bucket = aggregate_samples.setdefault(key, [])
                    for entry in entries:
                        if len(bucket) >= 10:
                            break
                        bucket.append(entry)

                file_reports.append(
                    {
                        "path": str(item.path),
                        "uri": item.uri,
                        "mime": item.mime,
                        "chunks": stats.chunk_count,
                        "size_bytes": item.bytes_size,
                        "artifacts": artifact_counts,
                        "artifact_samples": artifact_samples,
                    }
                )

            artifact_samples_total = {k: v for k, v in aggregate_samples.items() if v}

            report = IngestionReport(
                total_files=len(items),
                total_chunks=total_chunks,
                files=file_reports,
                errors=errors,
                artifact_totals=aggregate_artifacts if any(aggregate_artifacts.values()) else None,
                artifact_samples=artifact_samples_total or None,
            )
            self._cleanup_temp_dirs()
            self._active_ingestions = max(0, self._active_ingestions - 1)
            return report
        finally:
            # Always switch back to chat mode
            logger.info("Switching back to chat mode after ingestion")
            await model_manager.switch_to_chat_mode()

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
        """Process a single item using the most appropriate method."""
        source = self._determine_source(item.mime, from_web=from_web)
        markdown_content = ""

        try:
            # Route to appropriate processor based on file type
            if source == "audio":
                logger.info(f"Processing audio file: {item.path}")
                markdown_content = await parse_audio_to_markdown(item.path)
            elif source == "video":
                logger.info(f"Processing video file: {item.path}")
                markdown_content = await parse_video_to_markdown(item.path)
            elif self._is_plain_text_file(item.mime, item.path):
                # Plain text files: read directly (fast, accurate, no OCR needed)
                logger.info(f"Processing plain text file: {item.path}")
                try:
                    # Try UTF-8 first, fallback to latin-1 for maximum compatibility
                    try:
                        with open(item.path, "r", encoding="utf-8") as f:
                            markdown_content = f.read()
                    except UnicodeDecodeError:
                        with open(item.path, "r", encoding="latin-1") as f:
                            markdown_content = f.read()

                    # For HTML/XML, we keep raw content (could be enhanced with HTML2Text later)
                    # For CSV/TSV, convert to markdown table
                    if item.path.suffix.lower() in {".csv", ".tsv", ".tab"}:
                        markdown_content = self._convert_tabular_to_markdown(
                            markdown_content, item.path.suffix.lower()
                        )

                except Exception as e:
                    logger.error(f"Error reading text file {item.path}: {e}")
                    return ProcessedItemResult(
                        chunk_count=0,
                        artifact_summary={"counts": {}, "artifacts": {}}
                    )
            else:
                # Binary documents: convert to images then analyze with vision
                logger.info(f"Processing document with vision: {item.path}")
                images_with_metadata = await self.doc_converter.convert(item.path)

                if not images_with_metadata:
                    logger.warning(f"No images extracted from {item.path}")
                    return ProcessedItemResult(
                        chunk_count=0,
                        artifact_summary={"counts": {}, "artifacts": {}}
                    )

                # Analyze all images with Qwen3-VL
                markdown_content = await self.vision_parser.analyze_images_batch(
                    images_with_metadata,
                    max_concurrent=2  # Limit concurrent vision analysis
                )
        except Exception as e:
            logger.error(
                f"Error processing {item.path} with vision pipeline: {e}",
                exc_info=True
            )
            return ProcessedItemResult(
                chunk_count=0,
                artifact_summary={"counts": {}, "artifacts": {}}
            )

        if not markdown_content or not markdown_content.strip():
            logger.warning(f"No content extracted from {item.path}")
            return ProcessedItemResult(
                chunk_count=0,
                artifact_summary={"counts": {}, "artifacts": {}}
            )

        # Simple artifact counting from markdown tags
        artifact_summary = self._extract_artifact_summary(markdown_content)

        # Chunk the markdown content with header context preservation
        path_hash = self._path_hash(item)
        text_segments = chunk_markdown_with_headers(
            markdown_content,
            size=1024,  # 1024 token chunks for RAG
            overlap=128,  # Overlap to preserve context at boundaries
        )

        if not text_segments:
            logger.warning(f"No chunks created from {item.path}")
            return ProcessedItemResult(chunk_count=0, artifact_summary=artifact_summary)

        # Create DocChunk objects from segments
        prepared_chunks: list[DocChunk] = []
        chunk_tags = set(tags)
        combined_tags = sorted(chunk_tags) if chunk_tags else None

        for chunk_index, segment_text in enumerate(text_segments, start=1):
            segment_text = segment_text.strip()
            if not segment_text:
                continue

            # Extract clean filename from path
            from pathlib import Path
            from urllib.parse import unquote
            filename = Path(unquote(str(item.path))).name if item.path else None

            metadata = {
                "chunk_index": chunk_index,
                "total_chunks": len(text_segments),
            }
            if filename:
                metadata["filename"] = filename
            if combined_tags:
                metadata["__chunk_tags"] = combined_tags

            prepared_chunks.append(
                DocChunk(
                    id=str(uuid4()),
                    chunk_id=chunk_index,
                    text=segment_text,
                    uri=item.uri,
                    mime=item.mime,
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
    def _convert_tabular_to_markdown(content: str, suffix: str) -> str:
        """Convert CSV/TSV content to markdown table format."""
        import csv
        import io

        try:
            delimiter = "\t" if suffix in {".tsv", ".tab"} else ","
            reader = csv.reader(io.StringIO(content), delimiter=delimiter)
            rows = list(reader)

            if not rows:
                return content

            # Build markdown table
            lines = []

            # Header row
            if rows:
                header = rows[0]
                lines.append("| " + " | ".join(str(cell) for cell in header) + " |")
                lines.append("| " + " | ".join("---" for _ in header) + " |")

            # Data rows (limit to first 1000 rows to avoid huge tables)
            for row in rows[1:1001]:
                # Pad row if needed to match header length
                padded_row = row + [""] * (len(rows[0]) - len(row))
                lines.append("| " + " | ".join(str(cell) for cell in padded_row) + " |")

            if len(rows) > 1001:
                lines.append(f"\n*[Table truncated: showing 1000 of {len(rows)-1} rows]*\n")

            return "\n".join(lines)

        except Exception as e:
            logger.warning(f"Failed to convert tabular data to markdown: {e}")
            return content  # Return original content on error

    @staticmethod
    def _is_plain_text_file(mime: str | None, file_path: Path) -> bool:
        """
        Determine if a file is plain text that can be read directly without OCR.

        Returns True for text files, code files, JSON, XML, YAML, CSV, etc.
        Returns False for binary documents (PDF, DOCX, etc.) that need vision parsing.
        """
        mime = (mime or "").lower()
        suffix = file_path.suffix.lower()

        # Text-based MIME types that can be read directly
        text_mimes = {
            "text/plain",
            "text/markdown",
            "text/x-markdown",
            "text/csv",
            "text/tab-separated-values",
            "text/yaml",
            "text/html",
            "text/xml",
            "text/css",
            "text/javascript",
            "application/json",
            "application/yaml",
            "application/x-yaml",
            "application/xml",
            "application/javascript",
            "application/x-javascript",
            "application/x-sh",
            "application/x-python-code",
        }

        # File extensions for text/code files
        text_extensions = {
            ".txt", ".md", ".markdown", ".mdx",
            ".py", ".js", ".jsx", ".ts", ".tsx",
            ".java", ".c", ".cpp", ".h", ".hpp", ".cs",
            ".rb", ".go", ".rs", ".php", ".swift", ".kt",
            ".json", ".jsonl", ".ndjson",
            ".xml", ".html", ".htm", ".xhtml",
            ".css", ".scss", ".sass", ".less",
            ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
            ".csv", ".tsv", ".tab",
            ".sql", ".sh", ".bash", ".zsh", ".fish",
            ".r", ".R", ".m", ".tex", ".rst", ".org",
            ".log", ".diff", ".patch",
        }

        return mime in text_mimes or suffix in text_extensions

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

    @staticmethod
    def _extract_artifact_summary(markdown_content: str) -> dict[str, Any]:
        """
        Extract artifact summary from markdown content with tags.

        Counts occurrences of: <table>, <chart>, <graph>, <image>, <code>
        """
        import re

        counts = {
            "tables": len(re.findall(r"<table>", markdown_content, re.IGNORECASE)),
            "charts": len(re.findall(r"<chart>", markdown_content, re.IGNORECASE)),
            "graphs": len(re.findall(r"<graph>", markdown_content, re.IGNORECASE)),
            "images": len(re.findall(r"<image>", markdown_content, re.IGNORECASE)),
            "code": len(re.findall(r"<code>", markdown_content, re.IGNORECASE)),
        }

        # Extract samples (first occurrence of each type)
        artifacts: dict[str, list[dict[str, Any]]] = {}

        for artifact_type, pattern in [
            ("tables", r"<table>(.*?)</table>"),
            ("charts", r"<chart>(.*?)</chart>"),
            ("graphs", r"<graph>(.*?)</graph>"),
            ("images", r"<image>(.*?)</image>"),
        ]:
            matches = re.findall(pattern, markdown_content, re.DOTALL | re.IGNORECASE)
            if matches:
                # Take first match as sample
                sample_text = matches[0].strip()[:200]  # First 200 chars
                artifacts[artifact_type] = [{
                    "preview": sample_text,
                    "count": len(matches)
                }]

        return {
            "counts": counts,
            "artifacts": artifacts,
            "pages": []  # Vision-based doesn't have traditional pages
        }


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
