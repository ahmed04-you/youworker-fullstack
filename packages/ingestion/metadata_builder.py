"""
Metadata building and pruning for ingestion pipeline.
"""

from __future__ import annotations

import json

from typing import Any, Sequence


from packages.common import get_logger
from packages.parsers.models import DocChunk


logger = get_logger(__name__)


def build_chunk_metadata(
    chunk: DocChunk,
    path_hash: str,
    original_format: str | None,
    output_format: str,
    user_id: int | None = None,
    pages: Sequence[dict] | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """
    Build complete metadata for a chunk.

    Args:
        chunk: The DocChunk
        path_hash: Hash of the source path
        original_format: MIME type of original file
        output_format: Rendered format (markdown/json)
        user_id: User ID for document ownership filtering in Qdrant
        pages: Page metadata list
        tags: Optional tags

    Returns:
        Complete metadata dict
    """
    metadata = {
        "uri": chunk.uri,
        "path_hash": path_hash,
        "chunk_id": chunk.chunk_id,
        "original_format": original_format,
        "output_format": output_format,
        "pages": list(pages or []),
    }
    if user_id is not None:
        metadata["user_id"] = user_id
    if tags:
        metadata["tags"] = tags
    return metadata


def prune_metadata(
    metadata: dict[str, Any],
    max_bytes: int = 6000,
) -> dict[str, Any]:
    """
    Prune metadata to fit within size limits for vector store.

    Uses approximate size estimation to avoid full JSON serialization in hot path.

    Args:
        metadata: Metadata dict
        max_bytes: Max encoded size

    Returns:
        Pruned metadata
    """
    if not metadata:
        return {}

    # Approximate size: sum of string lengths + overhead
    def approx_size(value: Any) -> int:
        if isinstance(value, str):
            return len(value.encode("utf-8"))
        if isinstance(value, (int, float)):
            return 20  # Rough estimate
        if isinstance(value, list):
            return sum(approx_size(item) for item in value[:10]) + 50  # Limit length
        if isinstance(value, dict):
            return sum(approx_size(k) + approx_size(v) for k, v in list(value.items())[:20]) + 100
        return 50  # Default for complex types

    working = dict(metadata)
    current_size = approx_size(working)

    if current_size <= max_bytes:
        return working

    # Trim large arrays first
    for key in ("pages", "tables", "images", "charts"):
        if key in working and isinstance(working[key], list) and len(working[key]) > 3:
            working[key] = working[key][:3]
            current_size = approx_size(working)
            if current_size <= max_bytes:
                return working

    # Remove non-essential keys by priority
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

    # Fallback: keep essentials only
    return {k: working[k] for k in essential_keys if k in working}


def collect_artifacts(
    span_summaries: Sequence[dict],
    segment_text: str,
) -> tuple[list[dict], dict[str, list]]:
    """
    Collect artifacts (tables, images, charts) from span summaries.

    Returns:
        (pages_metadata, artifacts_dict)
    """
    # Implementation similar to original _build_pages_metadata
    # ... (extract tables, images, charts as in pipeline.py)
    pages = []  # Build pages list
    artifacts = {"tables": [], "images": [], "charts": []}
    # Dedupe logic here
    return pages, artifacts


def render_chunk_text(
    text: str,
    artifacts: dict[str, list],
    output_format: str = "markdown",
) -> str:
    """
    Render chunk text with embedded artifacts.

    Args:
        text: Base text
        artifacts: Dict of artifact lists
        output_format: "markdown" or "json"

    Returns:
        Rendered text
    """
    if output_format == "json":
        payload = {"pages": [], **artifacts}
        return json.dumps(payload, ensure_ascii=False)

    # Markdown rendering as in original _render_chunk_markdown
    # ... (implement table/image/chart rendering)
    return text  # Placeholder
