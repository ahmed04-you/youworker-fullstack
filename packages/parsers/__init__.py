"""
Document parsers - Vision-based extraction with Qwen3-VL.

All parsing now routes through vision model for maximum information extraction.
"""

from .doc_to_image import DocumentToImageConverter
from .media_transcriber import (
    parse_audio_to_markdown,
    parse_video_to_markdown,
    transcribe_simple,
)
from .vision_parser import VisionParser
from .models import DocChunk, IngestionItem, IngestionReport
from .chunker import chunk_text

__all__ = [
    "DocumentToImageConverter",
    "VisionParser",
    "parse_audio_to_markdown",
    "parse_video_to_markdown",
    "transcribe_simple",
    "DocChunk",
    "IngestionItem",
    "IngestionReport",
    "chunk_text",
]
