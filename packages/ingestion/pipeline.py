from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import mimetypes
import os
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct

from packages.common import Settings, get_logger, get_settings
from packages.llm import Embedder
from packages.vectorstore import ensure_collections, get_client, upsert_points
from packages.vectorstore.schema import DocumentSource
from packages.web import PlaywrightClient, PlaywrightConfig

from packages.parsers import (
    chunk_token_ranges,
    docling_extract,
    media_release_resources,
    media_transcribe,
    ocr_extract,
    should_run_ocr,
    table_extract,
    tokenize_text,
)
from packages.parsers.models import DocChunk, IngestionItem, IngestionReport

logger = get_logger(__name__)


def _format_seconds_to_timestamp(value: float | None) -> str:
    if value is None or value < 0:
        value = 0.0
    total_seconds = int(round(value))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _safe_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass(slots=True)
class PipelineConfig:
    """Mutable configuration for the ingestion pipeline."""

    recursive: bool = True
    chunk_size: int = 500
    chunk_overlap: int = 50
    max_concurrency: int = 4


class IngestionPipeline:
    """Coordinate parsing, embeddings, and Qdrant upserts."""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        embedder: Embedder | None = None,
        qdrant_client: QdrantClient | None = None,
        config: PipelineConfig | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._embedder = embedder or Embedder(settings=self._settings)
        self._client = qdrant_client or get_client(self._settings)
        self._config = config or PipelineConfig()
        ingest_concurrency = getattr(self._settings, "ingest_max_concurrency", None)
        if isinstance(ingest_concurrency, int) and ingest_concurrency > 0:
            self._config.max_concurrency = ingest_concurrency
        self._temp_dirs: list[Path] = []

        ensure_collections(self._client, self._settings)
        self._active_ingestions = 0

    async def ingest_path(
        self,
        path_or_url: str,
        *,
        recursive: bool | None = None,
        from_web: bool = False,
        tags: Sequence[str] | None = None,
    ) -> IngestionReport:
        """High-level ingestion API for local paths or web resources."""
        # Re-ensure collections in case Qdrant restarted after pipeline init.
        self._active_ingestions += 1
        ensure_collections(self._client, self._settings)

        recursive = self._config.recursive if recursive is None else recursive
        tags = list(tags or [])

        try:
            try:
                if from_web:
                    items = await self._fetch_web_resources(path_or_url)
                else:
                    items = self._enumerate_local(Path(path_or_url), recursive=recursive)
            except Exception as exc:
                logger.error("ingestion-enumeration-error", target=path_or_url, error=str(exc))
                return IngestionReport(
                    total_files=0,
                    total_chunks=0,
                    files=[],
                    errors=[{"target": path_or_url, "error": str(exc)}],
                )

            file_reports: list[dict] = []
            errors: list[dict] = []
            total_chunks = 0
            points_batch: list[PointStruct] = []

            if not items:
                return IngestionReport(total_files=0, total_chunks=0, files=[], errors=[])

            concurrency = self._effective_concurrency()
            semaphore = asyncio.Semaphore(concurrency)
            tasks = [
                asyncio.create_task(
                    self._process_item_task(idx, item, tags=tags, from_web=from_web, semaphore=semaphore)
                )
                for idx, item in enumerate(items)
            ]

            results: list[tuple[int, IngestionItem, list[PointStruct], int, Exception | None]] = []
            for task in asyncio.as_completed(tasks):
                results.append(await task)

            results.sort(key=lambda entry: entry[0])

            for _, item, points, chunk_count, error in results:
                if error is not None:
                    errors.append({"path": str(item.path), "error": str(error)})
                    continue

                if points:
                    points_batch.extend(points)
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

            if points_batch:
                upsert_points(points_batch, client=self._client, settings=self._settings)

            report = IngestionReport(
                total_files=len(items),
                total_chunks=total_chunks,
                files=file_reports,
                errors=errors,
            )
            return report
        finally:
            self._cleanup_temp_dirs()
            self._active_ingestions = max(0, self._active_ingestions - 1)
            if self._active_ingestions == 0:
                media_release_resources()

    async def _process_item_task(
        self,
        index: int,
        item: IngestionItem,
        *,
        tags: Sequence[str],
        from_web: bool,
        semaphore: asyncio.Semaphore,
    ) -> tuple[int, IngestionItem, list[PointStruct], int, Exception | None]:
        async with semaphore:
            try:
                points, chunk_count = await self._process_item(item, tags=tags, from_web=from_web)
                return (index, item, points, chunk_count, None)
            except Exception as exc:
                logger.error("ingestion-item-error", path=str(item.path), error=str(exc))
                return (index, item, [], 0, exc)

    async def _process_item(
        self,
        item: IngestionItem,
        *,
        tags: Sequence[str],
        from_web: bool,
    ) -> tuple[list[PointStruct], int]:
        source = self._determine_source(item.mime, from_web=from_web)
        chunks: list[DocChunk] = []

        if source in {"audio", "video"}:
            chunks.extend(
                media_transcribe(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
        elif source == "image":
            chunks.extend(
                ocr_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
        else:
            # Docling handles text, tables, and images with structure preservation
            docling_chunks = list(
                docling_extract(
                    item.path,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                )
            )
            chunks.extend(docling_chunks)

            # Only run OCR if Docling didn't extract sufficient content
            # This happens with scanned PDFs or image-based documents
            if should_run_ocr(item.mime, docling_chunks):
                ocr_chunks = list(
                    ocr_extract(
                        item.path,
                        uri=item.uri,
                        mime=item.mime,
                        source=source,
                    )
                )
                chunks.extend(ocr_chunks)

            # Fallback table extraction only if Docling failed completely
            # Modern Docling extracts tables with better accuracy
            if not docling_chunks:
                chunks.extend(
                    table_extract(
                        item.path,
                        uri=item.uri,
                        mime=item.mime,
                        source=source,
                    )
                )

        path_hash = self._path_hash(item)
        prepared_chunks = self._prepare_chunks(
            chunks,
            item=item,
            source=source,
            path_hash=path_hash,
        )
        if not prepared_chunks:
            return ([], 0)

        vectors = await self._embedder.embed_texts([chunk.text for chunk in prepared_chunks])
        now_iso = datetime.now(timezone.utc).isoformat()
        payload_points: list[PointStruct] = []

        for chunk, vector in zip(prepared_chunks, vectors, strict=True):
            chunk.embedding = vector
            metadata = dict(chunk.metadata)
            chunk_tags = set(tags)
            tag_values = metadata.pop("tags", None)
            if isinstance(tag_values, (list, tuple, set)):
                chunk_tags.update(tag for tag in tag_values if isinstance(tag, str))
            combined_tags = sorted(chunk_tags)
            payload = {
                "id": chunk.id,
                "chunk_id": chunk.chunk_id,
                "source": chunk.source,
                "uri": chunk.uri,
                "mime": chunk.mime,
                "path_hash": path_hash,
                "created_at": now_iso,
                "text": chunk.text,
                "metadata": metadata,
            }
            if combined_tags:
                payload["tags"] = combined_tags
            payload_points.append(PointStruct(id=chunk.id, vector=vector, payload=payload))

        return (payload_points, len(prepared_chunks))

    def _prepare_chunks(
        self,
        raw_chunks: Sequence[DocChunk],
        *,
        item: IngestionItem,
        source: DocumentSource,
        path_hash: str,
    ) -> list[DocChunk]:
        if not raw_chunks:
            return []

        if source in {"audio", "video"}:
            return self._prepare_media_chunks(
                raw_chunks,
                item=item,
                source=source,
                path_hash=path_hash,
            )

        return self._prepare_text_chunks(
            raw_chunks,
            item=item,
            source=source,
            path_hash=path_hash,
        )

    def _prepare_media_chunks(
        self,
        raw_chunks: Sequence[DocChunk],
        *,
        item: IngestionItem,
        source: DocumentSource,
        path_hash: str,
    ) -> list[DocChunk]:
        chunk_counter = 0
        prepared: list[DocChunk] = []

        for raw_chunk in raw_chunks:
            text = (raw_chunk.text or "").strip()
            if not text:
                continue

            chunk_tokens = tokenize_text(text)
            if not chunk_tokens:
                continue

            total_tokens = len(chunk_tokens)
            raw_metadata = dict(raw_chunk.metadata)
            paragraph_start = _safe_float(raw_metadata.get("start"))
            paragraph_end = _safe_float(raw_metadata.get("end"))

            ranges = chunk_token_ranges(
                chunk_tokens,
                size=self._config.chunk_size,
                overlap=self._config.chunk_overlap,
            )

            for segment_idx, (token_start, token_end) in enumerate(ranges, start=1):
                segment_tokens = chunk_tokens[token_start:token_end]
                segment_text = "".join(segment_tokens).strip()
                if not segment_text:
                    continue

                chunk_counter += 1
                token_range = [token_start, min(token_end, total_tokens)]
                paragraph_info: dict[str, object] = {}
                if paragraph_start is not None:
                    paragraph_info["start"] = round(paragraph_start, 3)
                if paragraph_end is not None:
                    paragraph_info["end"] = round(paragraph_end, 3)

                segment_start: float | None = None
                segment_end: float | None = None
                if (
                    paragraph_start is not None
                    and paragraph_end is not None
                    and total_tokens > 0
                    and paragraph_end >= paragraph_start
                ):
                    duration = paragraph_end - paragraph_start
                    range_start_ratio = token_start / total_tokens
                    range_end_ratio = min(token_end, total_tokens) / total_tokens
                    segment_start = paragraph_start + duration * range_start_ratio
                    segment_end = paragraph_start + duration * range_end_ratio
                else:
                    segment_start = paragraph_start
                    segment_end = paragraph_end

                timeline_info: dict[str, object] = {}
                if segment_start is not None:
                    timeline_info["start"] = round(segment_start, 3)
                    timeline_info["start_timestamp"] = _format_seconds_to_timestamp(segment_start)
                if segment_end is not None:
                    timeline_info["end"] = round(segment_end, 3)
                    timeline_info["end_timestamp"] = _format_seconds_to_timestamp(segment_end)

                if paragraph_info:
                    timestamp_range: dict[str, str] = {}
                    if paragraph_start is not None:
                        timestamp_range["start"] = _format_seconds_to_timestamp(paragraph_start)
                    if paragraph_end is not None:
                        timestamp_range["end"] = _format_seconds_to_timestamp(paragraph_end)
                    if timestamp_range:
                        paragraph_info["timestamp_range"] = timestamp_range
                segment_details: dict[str, object] = {
                    "type": "transcript",
                    "segment_index": segment_idx,
                    "token_range": token_range,
                    "total_tokens": total_tokens,
                }
                if timeline_info:
                    segment_details["timeline"] = timeline_info
                if paragraph_info:
                    segment_details["paragraph"] = paragraph_info

                detail_keys = ("language", "speaker", "speaker_label", "confidence")
                details: dict[str, object] = {}
                for key in detail_keys:
                    value = raw_metadata.get(key)
                    if value not in (None, "", [], {}):
                        details[key] = value
                if details:
                    segment_details["details"] = details

                pages_metadata = [
                    {
                        "page_number": None,
                        "segments": [segment_details],
                    }
                ]

                metadata = self._make_chunk_metadata(
                    uri=raw_chunk.uri or item.uri,
                    path_hash=path_hash,
                    chunk_id=chunk_counter,
                    original_format=raw_chunk.mime or item.mime,
                    output_format="markdown",
                    pages=pages_metadata,
                )

                prepared.append(
                    DocChunk(
                        id=uuid4().hex,
                        chunk_id=chunk_counter,
                        text=segment_text,
                        uri=raw_chunk.uri or item.uri,
                        mime=raw_chunk.mime or item.mime,
                        source=raw_chunk.source or source,
                        metadata=metadata,
                    )
                )

        return prepared

    def _prepare_text_chunks(
        self,
        raw_chunks: Sequence[DocChunk],
        *,
        item: IngestionItem,
        source: DocumentSource,
        path_hash: str,
    ) -> list[DocChunk]:
        # Flatten raw chunks into a single token stream so chunking keeps context while
        # preserving provenance for downstream metadata.
        tokens: list[str] = []
        token_sources: list[int | None] = []
        summarized_chunks: list[dict] = []

        for raw_chunk in raw_chunks:
            text = (raw_chunk.text or "").strip()
            if not text:
                continue
            chunk_tokens = tokenize_text(text)
            if not chunk_tokens:
                continue

            if tokens:
                tokens.append("\n\n")
                token_sources.append(None)

            chunk_start = len(tokens)
            tokens.extend(chunk_tokens)
            chunk_end = len(tokens)

            summary_index = len(summarized_chunks)
            summarized_chunks.append(
                self._summarize_chunk_metadata(
                    raw_chunk,
                    global_token_start=chunk_start,
                    global_token_end=chunk_end,
                )
            )
            token_sources.extend([summary_index] * len(chunk_tokens))

        if not tokens:
            return []

        chunk_counter = 0
        prepared: list[DocChunk] = []
        ranges = chunk_token_ranges(tokens, size=self._config.chunk_size, overlap=self._config.chunk_overlap)

        for token_start, token_end in ranges:
            segment_tokens = tokens[token_start:token_end]
            segment_text = "".join(segment_tokens).strip()
            if not segment_text:
                continue
            chunk_counter += 1

            contributor_indexes = {
                token_sources[idx]
                for idx in range(token_start, token_end)
                if idx < len(token_sources) and token_sources[idx] is not None
            }
            span_summaries = self._collect_span_summaries(
                summarized_chunks,
                contributor_indexes,
                token_start=token_start,
                token_end=token_end,
            )
            metadata, artifacts = self._build_text_chunk_metadata(
                uri=item.uri,
                path_hash=path_hash,
                chunk_id=chunk_counter,
                original_format=item.mime,
                span_summaries=span_summaries,
                segment_text=segment_text,
            )

            if metadata.get("output_format") == "json":
                json_payload: dict[str, object] = {
                    "pages": metadata.get("pages", []),
                }
                for key in ("tables", "charts", "images"):
                    values = artifacts.get(key)
                    if values:
                        json_payload[key] = values
                segment_text = json.dumps(json_payload, ensure_ascii=False)
            else:
                segment_text = self._render_chunk_markdown(
                    segment_text,
                    artifacts=artifacts,
                )

            prepared.append(
                DocChunk(
                    id=uuid4().hex,
                    chunk_id=chunk_counter,
                    text=segment_text,
                    uri=item.uri,
                    mime=item.mime,
                    source=source,
                    metadata=metadata,
                )
            )

        return prepared

    @staticmethod
    def _summarize_chunk_metadata(
        chunk: DocChunk,
        *,
        global_token_start: int,
        global_token_end: int,
    ) -> dict:
        metadata_copy = copy.deepcopy(chunk.metadata or {})
        summary: dict[str, object] = {
            "source_chunk_id": chunk.chunk_id,
            "metadata": metadata_copy,
            "source_uri": chunk.uri,
            "source_mime": chunk.mime,
            "source": chunk.source,
            "global_token_start": global_token_start,
            "global_token_end": global_token_end,
        }
        return summary

    def _collect_span_summaries(
        self,
        summaries: Sequence[dict],
        contributor_indexes: set[int | None],
        *,
        token_start: int,
        token_end: int,
    ) -> list[dict]:
        collected: list[dict] = []

        for index in sorted(idx for idx in contributor_indexes if idx is not None):
            summary = summaries[index]
            global_start = summary.get("global_token_start")
            global_end = summary.get("global_token_end")
            if not isinstance(global_start, int) or not isinstance(global_end, int):
                continue
            overlap_start = max(token_start, global_start)
            overlap_end = min(token_end, global_end)
            if overlap_start >= overlap_end:
                continue
            summary_copy = copy.deepcopy(summary)
            summary_copy["absolute_token_range"] = [overlap_start, overlap_end]
            summary_copy["relative_token_range"] = [
                overlap_start - global_start,
                overlap_end - global_start,
            ]
            collected.append(summary_copy)

        return collected

    def _build_text_chunk_metadata(
        self,
        *,
        uri: str | None,
        path_hash: str,
        chunk_id: int,
        original_format: str | None,
        span_summaries: Sequence[dict],
        segment_text: str,
    ) -> tuple[dict, dict[str, list]]:
        pages, artifacts = self._build_pages_metadata(span_summaries, segment_text=segment_text)
        output_format = self._select_output_format(segment_text, artifacts)
        metadata = self._make_chunk_metadata(
            uri=uri,
            path_hash=path_hash,
            chunk_id=chunk_id,
            original_format=original_format,
            output_format=output_format,
            pages=pages,
        )
        return metadata, artifacts

    @staticmethod
    def _make_chunk_metadata(
        *,
        uri: str | None,
        path_hash: str,
        chunk_id: int,
        original_format: str | None,
        output_format: str,
        pages: Sequence[dict] | None,
    ) -> dict:
        metadata = {
            "uri": uri,
            "path_hash": path_hash,
            "chunk_id": chunk_id,
            "original_format": original_format,
            "output_format": output_format,
            "pages": list(pages or []),
        }
        return metadata

    def _build_pages_metadata(
        self,
        span_summaries: Sequence[dict],
        *,
        segment_text: str,
    ) -> tuple[list[dict], dict[str, list]]:
        if not span_summaries:
            return [], {"tables": [], "images": [], "charts": []}

        pages: dict[int | None, dict] = {}
        tables: list[dict] = []
        images: list[dict] = []
        charts: list[dict] = []

        for summary in span_summaries:
            span_metadata = copy.deepcopy(summary.get("metadata") or {})
            page_number = self._safe_int(span_metadata.get("page"))
            page_entry = pages.setdefault(
                page_number,
                {
                    "page_number": page_number,
                    "segments": [],
                },
            )
            segment_entry = self._format_page_segment(summary, span_metadata, segment_text=segment_text)

            table_info = self._extract_table_artifact(span_metadata, summary, page_number)
            if table_info:
                tables.append(table_info)
                segment_entry["table"] = table_info["data"]
                if table_info.get("caption"):
                    segment_entry.setdefault("labels", []).append(table_info["caption"])

            image_info = self._extract_image_artifact(span_metadata, summary, page_number)
            if image_info:
                images.append(image_info)
                segment_entry["image"] = {
                    key: image_info.get(key)
                    for key in ("image_ref", "caption", "detailed_caption", "hash")
                }

            chart_info = self._extract_chart_artifact(span_metadata, summary, page_number)
            if chart_info:
                charts.append(chart_info)
                segment_entry["chart"] = chart_info["data"]
                if chart_info.get("caption"):
                    segment_entry.setdefault("labels", []).append(chart_info["caption"])

            page_entry["segments"].append(segment_entry)

        pages_list = sorted(
            pages.values(),
            key=lambda entry: (entry["page_number"] is None, entry["page_number"]),
        )
        artifacts = {
            "tables": self._dedupe_tables(tables),
            "images": self._dedupe_images(images),
            "charts": self._dedupe_charts(charts),
        }
        return pages_list, artifacts

    @staticmethod
    def _safe_int(value: object) -> int | None:
        try:
            if value is None:
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    def _format_page_segment(
        self,
        summary: dict,
        metadata: dict,
        *,
        segment_text: str,
    ) -> dict:
        segment_entry: dict[str, object] = {
            "source_chunk": summary.get("source_chunk_id"),
            "token_range": summary.get("relative_token_range"),
            "absolute_token_range": summary.get("absolute_token_range"),
        }

        content_type = metadata.get("content_type")
        segment_entry["type"] = str(content_type) if content_type else "text"

        text_value = metadata.get("text")
        if isinstance(text_value, str) and text_value.strip():
            segment_entry["text"] = text_value.strip()
        elif segment_entry["type"] == "text" and segment_text.strip():
            segment_entry["text"] = segment_text.strip()

        heading = metadata.get("heading")
        if isinstance(heading, str) and heading.strip():
            segment_entry["heading"] = heading.strip()

        details = self._sanitize_span_details(metadata)
        if details:
            segment_entry["details"] = details

        return segment_entry

    @staticmethod
    def _extract_table_artifact(metadata: dict, summary: dict, page_number: int | None) -> dict | None:
        table_data = metadata.get("table_data")
        if table_data is None:
            return None
        info = {
            "data": table_data,
            "caption": metadata.get("table_caption") or metadata.get("caption"),
            "page": page_number,
            "source_chunk": summary.get("source_chunk_id"),
        }
        return info

    @staticmethod
    def _extract_image_artifact(metadata: dict, summary: dict, page_number: int | None) -> dict | None:
        if metadata.get("content_type") != "image" and not metadata.get("image_ref"):
            return None
        caption = metadata.get("caption") or metadata.get("label")
        detailed_caption = metadata.get("detailed_caption") or caption
        info = {
            "image_ref": metadata.get("image_ref"),
            "caption": caption,
            "detailed_caption": detailed_caption,
            "hash": metadata.get("image_hash"),
            "page": page_number,
            "source_chunk": summary.get("source_chunk_id"),
            "ocr_text": metadata.get("ocr_text"),
            "dimensions": metadata.get("image_dimensions"),
            "alt_text": metadata.get("alt_text"),
        }
        return info

    @staticmethod
    def _extract_chart_artifact(metadata: dict, summary: dict, page_number: int | None) -> dict | None:
        chart_data = metadata.get("chart_data") or metadata.get("chart")
        if chart_data is None:
            return None
        info = {
            "data": chart_data,
            "caption": metadata.get("chart_caption") or metadata.get("caption"),
            "type": metadata.get("chart_type"),
            "page": page_number,
            "source_chunk": summary.get("source_chunk_id"),
        }
        transcription = metadata.get("chart_transcription") or metadata.get("transcription")
        if transcription:
            info["transcription"] = transcription
        return info

    @staticmethod
    def _sanitize_span_details(metadata: dict) -> dict:
        drop_keys = {
            "page",
            "content_type",
            "table_data",
            "table_caption",
            "chart_data",
            "chart_caption",
            "chart_type",
            "chart_transcription",
            "chart",
            "caption",
            "label",
            "detailed_caption",
            "image_ref",
            "image_hash",
            "image_dimensions",
            "ocr_text",
            "alt_text",
        }
        details: dict[str, object] = {}
        for key, value in metadata.items():
            if key in drop_keys:
                continue
            if value in (None, "", [], {}):
                continue
            details[key] = value
        return details

    @staticmethod
    def _dedupe_tables(tables: Sequence[object]) -> list:
        unique: list[object] = []
        seen: set[str] = set()
        for table in tables:
            try:
                key = json.dumps(table, sort_keys=True, default=str)
            except TypeError:
                key = str(table)
            if key in seen:
                continue
            seen.add(key)
            unique.append(table)
        return unique

    @staticmethod
    def _dedupe_images(images: Sequence[dict]) -> list[dict]:
        unique: list[dict] = []
        seen: set[str] = set()
        for image in images:
            metadata = image.get("metadata") if isinstance(image, dict) else None
            if isinstance(metadata, dict):
                key = metadata.get("image_hash") or metadata.get("image_ref") or json.dumps(
                    metadata, sort_keys=True, default=str
                )
            else:
                key = json.dumps(image, sort_keys=True, default=str)
            if key in seen:
                continue
            seen.add(key)
            unique.append(image)
        return unique

    @staticmethod
    def _dedupe_charts(charts: Sequence[dict]) -> list[dict]:
        unique: list[dict] = []
        seen: set[str] = set()
        for chart in charts:
            try:
                key = json.dumps(chart, sort_keys=True, default=str)
            except TypeError:
                key = str(chart)
            if key in seen:
                continue
            seen.add(key)
            unique.append(chart)
        return unique

    def _select_output_format(self, segment_text: str, artifacts: dict[str, list]) -> str:
        if (segment_text or "").strip():
            return "markdown"
        if artifacts.get("tables") or artifacts.get("charts"):
            return "json"
        return "markdown"

    def _render_chunk_markdown(
        self,
        text: str,
        *,
        artifacts: dict[str, list] | None = None,
    ) -> str:
        markdown_parts: list[str] = []
        base_text = (text or "").strip()
        if base_text:
            markdown_parts.append(base_text)

        artifacts = artifacts or {}

        tables = artifacts.get("tables")
        if tables:
            markdown_parts.append(self._render_tables_markdown(tables))

        images = artifacts.get("images")
        if images:
            markdown_parts.append(self._render_images_markdown(images))

        charts = artifacts.get("charts")
        if charts:
            markdown_parts.append(self._render_charts_markdown(charts))

        if not markdown_parts:
            return text
        return "\n\n".join(part.strip() for part in markdown_parts if part).strip()

    def _render_tables_markdown(self, tables: Sequence[object]) -> str:
        blocks: list[str] = []
        total = len(tables)
        for idx, table in enumerate(tables, start=1):
            caption: str | None = None
            data = table
            if isinstance(table, dict):
                caption = table.get("caption")
                data = table.get("data") or table.get("table") or table.get("table_data") or table

            table_md = self._table_to_markdown(data)
            if not table_md:
                continue
            if caption:
                caption_text = self._escape_markdown_text(str(caption))
                label = f"**Table {idx}: {caption_text}**"
            else:
                label = f"**Table {idx}:**" if total > 1 else "**Table:**"
            blocks.append(f"{label}\n\n{table_md}")
        if not blocks:
            return ""
        return "### Embedded Tables\n\n" + "\n\n".join(blocks)

    def _render_images_markdown(self, images: Sequence[dict]) -> str:
        blocks: list[str] = []
        for idx, image in enumerate(images, start=1):
            if not isinstance(image, dict):
                continue
            caption_value = image.get("caption") or image.get("detailed_caption") or f"Embedded image {idx}"
            caption = self._escape_markdown_text(str(caption_value))
            image_ref = image.get("image_ref")
            if image_ref in (None, "", "None"):
                placeholder_hash = image.get("hash") or f"image-{idx}"
                image_ref = f"#embedded-image-{placeholder_hash}"
            else:
                image_ref = str(image_ref)
            image_line = f"![{caption}]({image_ref})"

            details: list[str] = []
            detailed_caption = image.get("detailed_caption")
            if detailed_caption and detailed_caption != image.get("caption"):
                details.append(f"Detailed caption: {detailed_caption}")
            dims = image.get("dimensions")
            if isinstance(dims, dict):
                width = dims.get("width")
                height = dims.get("height")
                if width and height:
                    details.append(f"Dimensions: {width}×{height} px")
            if image.get("ocr_text"):
                details.append(f"OCR: {image['ocr_text']}")
            if image.get("hash"):
                details.append(f"Image hash: `{image['hash']}`")

            detail_text = "\n".join(f"> {self._escape_markdown_text(line)}" for line in details if line)
            block_parts = [image_line]
            if detail_text:
                block_parts.append(detail_text)
            blocks.append("\n\n".join(block_parts))

        if not blocks:
            return ""
        heading = "### Embedded Images"
        return heading + "\n\n" + "\n\n\n".join(blocks)

    def _render_charts_markdown(self, charts: Sequence[dict]) -> str:
        blocks: list[str] = []
        for idx, chart in enumerate(charts, start=1):
            if not isinstance(chart, dict):
                continue
            caption_value = chart.get("caption") or f"Embedded chart {idx}"
            caption = self._escape_markdown_text(str(caption_value))
            block_lines = [f"**Chart {idx}: {caption}**"]
            chart_type = chart.get("type")
            if chart_type:
                block_lines.append(f"> Type: {self._escape_markdown_text(str(chart_type))}")
            transcription = chart.get("transcription")
            if transcription:
                block_lines.append(f"> Transcription: {self._escape_markdown_text(str(transcription))}")
            data = chart.get("data")
            if data is not None:
                try:
                    data_json = json.dumps(data, ensure_ascii=False, indent=2)
                except TypeError:
                    data_json = str(data)
                block_lines.append("```json\n" + data_json + "\n```")
            blocks.append("\n\n".join(block_lines))
        if not blocks:
            return ""
        return "### Embedded Charts\n\n" + "\n\n".join(blocks)

    def _table_to_markdown(self, table: object) -> str:
        grid = None
        if isinstance(table, dict):
            if "grid" in table and isinstance(table["grid"], list):
                grid = table["grid"]
            elif "rows" in table and isinstance(table["rows"], list):
                grid = table["rows"]
            elif "table" in table and isinstance(table["table"], dict):
                inner = table["table"]
                grid = inner.get("rows") or inner.get("grid")
        elif isinstance(table, list):
            grid = table

        if not grid:
            return ""

        rows: list[list[str]] = []
        for row in grid:
            row_values: list[str] = []
            if isinstance(row, (list, tuple)):
                for cell in row:
                    row_values.append(self._stringify_table_cell(cell))
            elif isinstance(row, dict):
                row_values.append(self._stringify_table_cell(row))
            else:
                row_values.append(self._stringify_table_cell(row))
            if any(value.strip() for value in row_values):
                rows.append(row_values)

        if not rows:
            return ""

        header = rows[0]
        body = rows[1:] if len(rows) > 1 else []
        column_count = len(header)
        if column_count == 0:
            return ""

        def pad(row_values: list[str]) -> list[str]:
            if len(row_values) < column_count:
                return row_values + [""] * (column_count - len(row_values))
            if len(row_values) > column_count:
                return row_values[:column_count]
            return row_values

        header = pad(header)
        body = [pad(row) for row in body]

        md_lines = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join("---" for _ in range(column_count)) + " |",
        ]
        for row in body:
            md_lines.append("| " + " | ".join(row) + " |")
        return "\n".join(md_lines)

    def _stringify_table_cell(self, cell: object) -> str:
        if cell is None:
            return ""
        if isinstance(cell, str):
            return cell.strip()
        if isinstance(cell, (int, float)):
            return str(cell)
        if isinstance(cell, dict):
            for key in ("text", "content", "value", "raw"):
                value = cell.get(key)
                if value is not None and value != "":
                    return str(value).strip()
            try:
                return json.dumps(cell, ensure_ascii=False)
            except TypeError:
                return str(cell)
        if isinstance(cell, (list, tuple)):
            return " ".join(self._stringify_table_cell(item) for item in cell).strip()
        return str(cell).strip()

    @staticmethod
    def _escape_markdown_text(value: str) -> str:
        escaped = (
            value.replace("\\", "\\\\")
            .replace("|", "\\|")
            .replace("[", "\\[")
            .replace("]", "\\]")
        )
        return escaped.replace("\r", " ").replace("\n", " ").strip()

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
                    logger.warning("ingestion-enumerate-error", path=str(file_path), error=str(exc))
        return items

    def _make_item(self, path: Path, *, uri: str | None) -> IngestionItem:
        mime, _ = mimetypes.guess_type(path.name)
        bytes_size = path.stat().st_size
        return IngestionItem(path=path, uri=uri, mime=mime, bytes_size=bytes_size)

    async def _fetch_web_resources(self, url: str) -> list[IngestionItem]:
        async with PlaywrightClient(PlaywrightConfig(), settings=self._settings) as client:
            pages = await client.crawl(url, depth=self._settings.crawl_max_depth)

        tmp_dir = Path(tempfile.mkdtemp(prefix="ingest-web-"))
        self._temp_dirs.append(tmp_dir)

        items: list[IngestionItem] = []
        for idx, page in enumerate(pages[: self._settings.crawl_max_pages]):
            html_content = page.get("html") or ""
            if not html_content:
                continue
            target = tmp_dir / f"page-{idx}.html"
            target.write_text(html_content, encoding="utf-8")
            page_url = page.get("url") or url
            items.append(
                IngestionItem(
                    path=target,
                    uri=page_url,
                    mime="text/html",
                    bytes_size=target.stat().st_size,
                )
            )
        return items

    def _determine_source(self, mime: str | None, *, from_web: bool) -> DocumentSource:
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

    def _path_hash(self, item: IngestionItem) -> str:
        basis = item.uri or str(item.path)
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()

    def _cleanup_temp_dirs(self) -> None:
        for directory in self._temp_dirs:
            try:
                shutil.rmtree(directory, ignore_errors=True)
            except Exception as exc:  # pragma: no cover
                logger.warning("ingestion-temp-cleanup-error", path=str(directory), error=str(exc))
        self._temp_dirs.clear()

    def _effective_concurrency(self) -> int:
        configured = max(1, int(self._config.max_concurrency or 1))
        cpu_limit = os.cpu_count() or 1
        return max(1, min(configured, cpu_limit, 18))
