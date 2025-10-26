from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, MutableMapping, Sequence

from packages.vectorstore.schema import DocumentSource


@dataclass(slots=True)
class DocChunk:
    """Logical chunk of document text destined for embedding."""

    id: str
    chunk_id: int
    text: str
    uri: str | None
    mime: str | None
    source: DocumentSource
    metadata: MutableMapping[str, Any] = field(default_factory=dict)
    embedding: Sequence[float] | None = None


@dataclass(slots=True)
class IngestionItem:
    """Represents a file or fetched resource queued for ingestion."""

    path: Path
    uri: str | None
    mime: str | None
    bytes_size: int


@dataclass(slots=True)
class IngestionReport:
    """Summary of an ingestion run."""

    total_files: int
    total_chunks: int
    files: list[dict[str, Any]]
    errors: list[dict[str, Any]]
