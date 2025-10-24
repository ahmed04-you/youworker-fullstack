from __future__ import annotations

from typing import List, Sequence, Tuple
import re


_TOKEN_PATTERN = re.compile(r"\w+|[^\w\s]|\s+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_PATTERN.findall(text)


def tokenize_text(text: str) -> list[str]:
    """Public helper so callers can share the same tokenizer."""
    return _tokenize(text)


def _chunk_token_ranges(tokens: Sequence[str], *, size: int, overlap: int) -> list[Tuple[int, int]]:
    if size <= 0:
        raise ValueError("size must be positive")
    if overlap < 0:
        raise ValueError("overlap cannot be negative")
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")

    ranges: list[Tuple[int, int]] = []
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
) -> list[Tuple[int, int]]:
    """Return sliding-window token ranges that match chunk_text behaviour."""
    return _chunk_token_ranges(tokens, size=size, overlap=overlap)


def chunk_text(text: str, *, size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping token chunks suitable for embedding."""
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
