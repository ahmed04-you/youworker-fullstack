"""
Metadata building, pruning, and artifact summarisation for the ingestion pipeline.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, MutableMapping, Sequence

from packages.common import get_logger
from packages.parsers.models import DocChunk


logger = get_logger(__name__)


def build_chunk_metadata(
    chunk: DocChunk,
    path_hash: str,
    original_format: str | None,
    output_format: str,
    user_id: int | None = None,
    pages: Sequence[dict[str, Any]] | None = None,
    tags: list[str] | None = None,
    *,
    base_metadata: MutableMapping[str, Any] | None = None,
    extra_metadata: MutableMapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Build complete metadata for a chunk while preserving parser-provided attributes.
    """
    metadata: dict[str, Any] = dict(base_metadata or {})
    metadata.setdefault("uri", chunk.uri)
    metadata["path_hash"] = path_hash
    metadata["chunk_id"] = chunk.chunk_id
    if original_format and not metadata.get("original_format"):
        metadata["original_format"] = original_format
    metadata["output_format"] = output_format
    if pages:
        metadata["pages"] = list(pages)
    if user_id is not None:
        metadata["user_id"] = user_id
    if tags:
        metadata["tags"] = tags
    if extra_metadata:
        for key, value in extra_metadata.items():
            metadata[key] = value
    return metadata


def prune_metadata(
    metadata: dict[str, Any],
    max_bytes: int = 6000,
) -> dict[str, Any]:
    """
    Prune metadata to fit within size limits for the vector store payload.
    """
    if not metadata:
        return {}

    def approx_size(value: Any) -> int:
        if isinstance(value, str):
            return len(value.encode("utf-8"))
        if isinstance(value, (int, float)):
            return 20
        if isinstance(value, list):
            return sum(approx_size(item) for item in value[:10]) + 50
        if isinstance(value, dict):
            return sum(approx_size(k) + approx_size(v) for k, v in list(value.items())[:20]) + 100
        return 50

    working = dict(metadata)
    current_size = approx_size(working)

    if current_size <= max_bytes:
        return working

    for key in ("pages", "tables", "images", "charts", "artifacts_sample"):
        if key in working and isinstance(working[key], list) and len(working[key]) > 3:
            working[key] = working[key][:3]
            current_size = approx_size(working)
            if current_size <= max_bytes:
                return working

    essential_keys = {"uri", "path_hash", "chunk_id", "source", "mime", "user_id"}
    removable = sorted(
        (k for k in working if k not in essential_keys),
        key=lambda k: approx_size(working[k]),
    )

    for key in removable:
        working.pop(key, None)
        current_size = approx_size(working)
        if current_size <= max_bytes:
            return working

    return {k: working[k] for k in essential_keys if k in working}


def collect_artifacts(
    chunks: Sequence[DocChunk],
    *,
    max_samples: int = 5,
) -> dict[str, Any]:
    """
    Aggregate artifact metadata (tables, images, charts) from parsed chunks.
    """
    tables: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    pages: dict[int, dict[str, Any]] = {}
    seen_tables: set[str] = set()
    seen_images: set[str] = set()
    seen_charts: set[str] = set()

    for chunk in chunks:
        metadata = dict(chunk.metadata or {})
        page = metadata.get("page")
        page_number = int(page) if isinstance(page, int) else None
        if page_number is not None:
            pages.setdefault(page_number, {"page": page_number, "tables": 0, "images": 0, "charts": 0})

        content_type = str(metadata.get("content_type") or "").lower()
        label = str(metadata.get("label") or "")
        caption = str(metadata.get("caption") or "")
        text_preview = (chunk.text or "").strip()
        text_preview = text_preview[:500]

        if _is_table_chunk(metadata):
            table_key = _stable_hash(
                {
                    "table": metadata.get("table_data") or metadata.get("table"),
                    "text": chunk.text,
                    "page": page_number,
                }
            )
            if table_key not in seen_tables:
                seen_tables.add(table_key)
                if len(tables) < max_samples:
                    tables.append(
                        {
                            "page": page_number,
                            "preview": text_preview,
                            "rows": _coerce_int(metadata.get("rows")),
                            "columns": _coerce_int(metadata.get("columns")),
                            "label": label or metadata.get("element_type"),
                        }
                    )
                if page_number is not None:
                    pages[page_number]["tables"] += 1
            continue

        is_chart = _is_chart_chunk(content_type, label, caption, text_preview)

        if content_type == "image" or metadata.get("image_ref_info"):
            image_key = metadata.get("image_hash") or _stable_hash(
                {
                    "uri": (metadata.get("image_ref_info") or {}).get("uri"),
                    "text": chunk.text,
                    "page": page_number,
                }
            )
            if image_key not in seen_images:
                seen_images.add(image_key)
                if len(images) < max_samples:
                    images.append(
                        {
                            "page": page_number,
                            "caption": caption or label,
                            "hash": metadata.get("image_hash"),
                            "ocr": metadata.get("ocr_text"),
                        }
                    )
                if page_number is not None:
                    pages[page_number]["images"] += 1

            if is_chart:
                chart_key = image_key
                if chart_key not in seen_charts:
                    seen_charts.add(chart_key)
                    if len(charts) < max_samples:
                        charts.append(
                            {
                                "page": page_number,
                                "caption": caption or label,
                                "hash": metadata.get("image_hash"),
                            }
                        )
                    if page_number is not None:
                        pages[page_number]["charts"] += 1
            continue

        if is_chart:
            chart_key = _stable_hash({"label": label, "caption": caption, "page": page_number})
            if chart_key not in seen_charts:
                seen_charts.add(chart_key)
                if len(charts) < max_samples:
                    charts.append(
                        {
                            "page": page_number,
                            "caption": caption or label,
                            "preview": text_preview,
                        }
                    )
                if page_number is not None:
                    pages[page_number]["charts"] += 1

    pages_list = sorted(pages.values(), key=lambda entry: entry["page"])
    counts = {
        "tables": len(seen_tables),
        "images": len(seen_images),
        "charts": len(seen_charts),
    }

    return {
        "pages": pages_list,
        "artifacts": {
            "tables": tables,
            "images": images,
            "charts": charts,
        },
        "counts": counts,
    }


def render_chunk_text(
    text: str,
    artifacts: dict[str, list[Any]] | None,
    output_format: str = "markdown",
) -> str:
    """
    Render chunk text with embedded artifact references when requested.
    """
    artifacts = artifacts or {}
    if output_format == "json":
        payload = {
            "text": text,
            "artifacts": artifacts,
        }
        return json.dumps(payload, ensure_ascii=False)

    if not artifacts:
        return text

    rendered = [text]
    footnotes: list[str] = []

    def _append(items: list[Any], title: str) -> None:
        if not items:
            return
        footnotes.append(f"**{title}**")
        for idx, item in enumerate(items, start=1):
            parts = []
            if item.get("caption"):
                parts.append(item["caption"])
            if item.get("preview"):
                parts.append(item["preview"])
            if item.get("page") is not None:
                parts.append(f"(page {item['page']})")
            summary = " - ".join(part for part in parts if part)
            if not summary:
                summary = "Available"
            footnotes.append(f"- {idx}. {summary}")

    _append(artifacts.get("tables", []), "Tables")
    _append(artifacts.get("images", []), "Images")
    _append(artifacts.get("charts", []), "Charts")

    if footnotes:
        rendered.append("\n".join(footnotes))

    return "\n\n".join(rendered)


def _stable_hash(payload: Any) -> str:
    try:
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    except TypeError:
        encoded = repr(payload)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _coerce_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_table_chunk(metadata: dict[str, Any]) -> bool:
    if (metadata.get("content_type") or "").lower() == "table":
        return True
    return "table" in metadata


def _is_chart_chunk(content_type: str, label: str, caption: str, text_preview: str) -> bool:
    if content_type == "chart":
        return True
    haystacks = [label, caption, text_preview]
    chart_tokens = ("chart", "graph", "plot", "diagram")
    for haystack in haystacks:
        if haystack and any(token in haystack.lower() for token in chart_tokens):
            return True
    return False
