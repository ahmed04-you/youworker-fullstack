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
    Extract tables from PDFs and Excel files.

    PDF: Uses pdfplumber as fallback.
    Excel: Uses pandas to read sheets as CSV.
    """
    if path.suffix.lower() in {".pdf"}:
        yield from _extract_pdf_tables(path, uri=uri, mime=mime, source=source)
    elif path.suffix.lower() in {".xls", ".xlsx"}:
        yield from _extract_excel_tables(path, uri=uri, mime=mime, source=source)


def _extract_pdf_tables(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract tables from PDF using pdfplumber."""
    try:
        with pdfplumber.open(path) as pdf:
            table_counter = 0
            for page_idx, page in enumerate(pdf.pages, start=1):
                try:
                    tables = page.extract_tables()
                except Exception as exc:  # pragma: no cover
                    logger.warning(
                        "pdfplumber-table-error",
                        extra={"path": str(path), "page": page_idx, "error": str(exc)},
                    )
                    continue
                for table in tables or []:
                    rows = _normalize_rows(table)
                    if not rows:
                        continue
                    csv_text = _rows_to_csv(rows)
                    markdown_text = _rows_to_markdown(rows)
                    metadata = {
                        "page": page_idx,
                        "table_idx": table_counter,
                        "content_type": "table",
                        "rows": len(rows),
                        "columns": len(rows[0]) if rows and rows[0] else 0,
                        "table": {"rows": rows},
                        "table_markdown": markdown_text,
                        "table_csv": csv_text,
                    }
                    table_counter += 1
                    yield DocChunk(
                        id=str(uuid4()),
                        chunk_id=table_counter,
                        text=markdown_text or csv_text,
                        uri=uri,
                        mime=mime,
                        source=source,
                        metadata=metadata,
                    )
    except Exception as exc:  # pragma: no cover
        logger.warning("pdfplumber-open-error", extra={"path": str(path), "error": str(exc)})


def _extract_excel_tables(
    path: Path,
    *,
    uri: str | None,
    mime: str | None,
    source: DocumentSource,
) -> Iterator[DocChunk]:
    """Extract tables from Excel using pandas."""
    import pandas as pd
    import io

    try:
        workbook = pd.read_excel(path, sheet_name=None, dtype=str)
    except Exception as exc:
        logger.warning("excel-extract-error", extra={"path": str(path), "error": str(exc)})
        return

    if not workbook:
        return

    table_counter = 0
    for sheet_name, frame in workbook.items():
        if frame is None:
            continue
        frame = frame.fillna("")
        if frame.empty:
            continue

        buffer = io.StringIO()
        frame.to_csv(buffer, index=False)
        csv_text = buffer.getvalue().strip()
        if not csv_text:
            continue

        headers = [str(col) for col in frame.columns.tolist()]
        body_rows = frame.astype(str).values.tolist()
        markdown_rows = [headers] + body_rows if headers else body_rows
        markdown_text = _rows_to_markdown(markdown_rows)

        table_counter += 1
        metadata = {
            "sheet_name": str(sheet_name),
            "rows": int(frame.shape[0]),
            "columns": int(frame.shape[1]),
            "content_type": "table",
            "table": {"headers": headers, "rows": body_rows},
            "table_markdown": markdown_text,
            "table_csv": csv_text,
        }

        yield DocChunk(
            id=str(uuid4()),
            chunk_id=table_counter,
            text=markdown_text or csv_text,
            uri=uri,
            mime=mime,
            source=source,
            metadata=metadata,
        )


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


def _rows_to_markdown(rows: Sequence[Sequence[str]]) -> str:
    if not rows:
        return ""

    width = len(rows[0]) if rows[0] else 0
    if width == 0:
        return ""

    def _format(row: Sequence[str]) -> str:
        cells = list(row)[:width]
        if len(cells) < width:
            cells.extend([""] * (width - len(cells)))
        normalized = [cell.replace("\n", " ").strip() if isinstance(cell, str) else str(cell) for cell in cells]
        return "| " + " | ".join(normalized) + " |"

    header_line = _format(rows[0])
    separator = "| " + " | ".join("---" for _ in range(width)) + " |"
    body_rows = rows[1:]
    lines = [header_line, separator]
    if body_rows:
        for row in body_rows:
            lines.append(_format(row))
    else:
        lines.append("| " + " | ".join("" for _ in range(width)) + " |")

    return "\n".join(lines)
