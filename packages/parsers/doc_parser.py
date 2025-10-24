from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(slots=True)
class ParsedDocument:
    """Structured representation of parsed content."""

    document_id: str
    text_chunks: Iterable[str]
    tables: list[dict] | None = None
    metadata: dict | None = None


class DocumentParser:
    """Placeholder orchestrator for parsing documents via Docling and OCR."""

    async def parse(self, source: str) -> ParsedDocument:
        """Parse the provided source and return structured content."""
        raise NotImplementedError("Document parsing has not been implemented yet.")
