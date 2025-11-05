from __future__ import annotations

from typing import Sequence
import re


_TOKEN_PATTERN = re.compile(r"\w+|[^\w\s]|\s+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_PATTERN.findall(text)


def tokenize_text(text: str) -> list[str]:
    """Public helper so callers can share the same tokenizer."""
    return _tokenize(text)


def _chunk_token_ranges(tokens: Sequence[str], *, size: int, overlap: int) -> list[tuple[int, int]]:
    if size <= 0:
        raise ValueError("size must be positive")
    if overlap < 0:
        raise ValueError("overlap cannot be negative")
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")

    ranges: list[tuple[int, int]] = []
    start = 0
    total = len(tokens)

    while start < total:
        end = min(total, start + size)
        ranges.append((start, end))
        if end == total:
            break
        start = max(0, end - overlap)
    return ranges


def chunk_token_ranges(
    tokens: Sequence[str], *, size: int = 500, overlap: int = 50
) -> list[tuple[int, int]]:
    """Return sliding-window token ranges that match chunk_text behaviour."""
    return _chunk_token_ranges(tokens, size=size, overlap=overlap)


def chunk_text(text: str, *, size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping token chunks suitable for embedding.

    For markdown content, use chunk_markdown_with_headers() instead to preserve heading context.
    """
    normalized = text.strip()
    if not normalized:
        return []

    tokens = _tokenize(normalized)
    if not tokens:
        return []

    chunks: list[str] = []
    for start, end in _chunk_token_ranges(tokens, size=size, overlap=overlap):
        segment_tokens = tokens[start:end]
        segment = "".join(segment_tokens).strip()
        if segment:
            chunks.append(segment)

    return chunks


def chunk_markdown_with_headers(
    markdown: str, *, size: int = 1024, overlap: int = 128
) -> list[str]:
    """
    Split markdown into chunks while preserving table headers across chunk boundaries.

    When a table spans multiple chunks, each continuation chunk will include the
    table header row and separator to maintain context.

    Args:
        markdown: Markdown text to chunk
        size: Target chunk size in tokens
        overlap: Token overlap between chunks

    Returns:
        List of markdown chunks with table headers preserved
    """
    normalized = markdown.strip()
    if not normalized:
        return []

    # Detect table headers
    table_headers = _find_table_headers(normalized)

    if not table_headers:
        # No tables found, use simple chunking
        return chunk_text(normalized, size=size, overlap=overlap)

    # Perform chunking with table header awareness
    tokens = _tokenize(normalized)
    if not tokens:
        return []

    chunks: list[str] = []

    for start, end in _chunk_token_ranges(tokens, size=size, overlap=overlap):
        segment_tokens = tokens[start:end]
        segment = "".join(segment_tokens).strip()

        if not segment:
            continue

        # Check if this chunk contains part of a table (but not the header)
        # If so, prepend the appropriate table header
        chunk_with_header = _prepend_table_header_if_needed(
            segment, table_headers, start > 0
        )

        chunks.append(chunk_with_header)

    return chunks


def _find_table_headers(markdown: str) -> list[dict]:
    """
    Find all table headers in markdown.

    Returns:
        List of dicts with 'header_line', 'separator_line', and 'start_pos'
    """
    lines = markdown.split("\n")
    table_headers = []
    table_separator_pattern = re.compile(r"^\s*\|?[\s\-:|]+\|[\s\-:|]+\|?\s*$")

    for i, line in enumerate(lines):
        if table_separator_pattern.match(line) and i > 0:
            # Previous line is the table header
            header_line = lines[i - 1]
            separator_line = line

            # Find approximate character position
            start_pos = sum(len(lines[j]) + 1 for j in range(i - 1))  # +1 for newline

            table_headers.append({
                "header_line": header_line,
                "separator_line": separator_line,
                "start_pos": start_pos
            })

    return table_headers


def _prepend_table_header_if_needed(
    chunk: str, table_headers: list[dict], is_continuation: bool
) -> str:
    """
    Prepend table header to chunk if it's a table continuation without the header.

    Args:
        chunk: The chunk text
        table_headers: List of table header info
        is_continuation: True if this is not the first chunk

    Returns:
        Chunk with table header prepended if needed
    """
    if not is_continuation or not table_headers:
        return chunk

    # Check if chunk contains table rows (lines with |) but not the header
    lines = chunk.split("\n")
    has_table_rows = any("|" in line for line in lines[:5])  # Check first few lines

    if not has_table_rows:
        return chunk

    # Check if chunk already has the table header
    if len(lines) >= 2:
        table_separator_pattern = re.compile(r"^\s*\|?[\s\-:|]+\|[\s\-:|]+\|?\s*$")
        if table_separator_pattern.match(lines[1]):
            # Already has header
            return chunk

    # Find which table this chunk belongs to based on proximity
    # Use the last table header found before this content
    for table_header in reversed(table_headers):
        # Prepend the table header
        header_text = f"{table_header['header_line']}\n{table_header['separator_line']}\n\n"
        return header_text + chunk

    return chunk
