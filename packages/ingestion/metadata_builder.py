"""
Metadata building and pruning for the vision-based ingestion pipeline.
"""

from __future__ import annotations

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

    essential_keys = {"uri", "path_hash", "chunk_id", "source", "mime", "user_id", "filename", "chunk_index", "total_chunks"}
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
