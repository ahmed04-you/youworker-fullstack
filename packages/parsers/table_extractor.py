from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence
from uuid import uuid4

import pdfplumber

from packages.common import get_logger
from packages.vectorstore.schema import DocumentSource

from .models import DocChunk

logger = get_logger(__name__)


def extract(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """
    Extract tables from PDFs using pdfplumber.

    This is a fallback extractor used only when Docling fails.
    Modern Docling extracts tables with better accuracy, so this is rarely needed.
    """
    yield from _extract_pdf_tables(path, uri=uri, mime=mime, source=source)


def _extract_pdf_tables(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract tables from PDF using pdfplumber."""
    if path.suffix.lower() != ".pdf":
        return
    try:
        with pdfplumber.open(path) as pdf:
            table_counter = 0
            for page_idx, page in enumerate(pdf.pages, start=1):
                try:
                    tables = page.extract_tables()
                except Exception as exc:  # pragma: no cover
                    logger.warning(
                        "pdfplumber-table-error", path=str(path), page=page_idx, error=str(exc)
                    )
                    continue
                for table in tables or []:
                    rows = _normalize_rows(table)
                    if not rows:
                        continue
                    csv_text = _rows_to_csv(rows)
                    metadata = {
                        "page": page_idx,
                        "table_idx": table_counter,
                        "table": {"rows": rows},
                    }
                    table_counter += 1
                    yield DocChunk(
                        id=str(uuid4()),
                        chunk_id=table_counter,
                        text=csv_text,
                        uri=uri,
                        mime=mime,
                        source=source,
                        metadata=metadata,
                    )
    except Exception as exc:  # pragma: no cover
        logger.warning("pdfplumber-open-error", path=str(path), error=str(exc))


def _normalize_rows(rows: Iterable[Iterable[Any]]) -> list[list[str]]:
    normalized: list[list[str]] = []
    for row in rows:
        normalized.append([_coerce_cell(cell) for cell in row])
    return normalized


def _coerce_cell(cell: Any) -> str:
    if cell is None:
        return ""
    if isinstance(cell, (int, float)):
        return str(cell)
    if isinstance(cell, str):
        return cell.strip()
    if isinstance(cell, dict):
        return cell.get("text", "") or cell.get("value", "")
    return str(cell)


def _rows_to_csv(rows: Sequence[Sequence[str]]) -> str:
    return "\n".join(",".join(cell.replace("\n", " ").strip() for cell in row) for row in rows)
