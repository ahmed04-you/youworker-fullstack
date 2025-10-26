"""
Token-based chunking utilities for ingestion pipeline.
"""

from typing import List, Tuple

from packages.parsers.chunker import (
    chunk_token_ranges,
    tokenize_text,
)  # Assuming existing chunker in parsers


def chunk_text_tokens(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> List[str]:
    """
    Chunk text into overlapping segments based on token count.

    Args:
        text: Input text to chunk
        chunk_size: Tokens per chunk
        chunk_overlap: Overlap between chunks

    Returns:
        List of chunked text segments
    """
    tokens = tokenize_text(text)
    if not tokens:
        return []

    ranges = chunk_token_ranges(tokens, size=chunk_size, overlap=chunk_overlap)
    chunks = []
    for start, end in ranges:
        segment_tokens = tokens[start:end]
        segment_text = "".join(segment_tokens).strip()
        if segment_text:
            chunks.append(segment_text)
    return chunks


def get_chunk_token_ranges(
    tokens: List[str],
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> List[Tuple[int, int]]:
    """
    Get token ranges for chunking without creating text.

    Returns:
        List of (start, end) token indices for each chunk
    """
    return list(chunk_token_ranges(tokens, size=chunk_size, overlap=chunk_overlap))
