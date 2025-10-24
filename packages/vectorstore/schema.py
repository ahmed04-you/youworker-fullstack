"""
Schema definitions for vector store documents.
"""

from typing import Literal


# Document source types
DocumentSource = Literal["file", "web", "audio", "video", "image"]


# Collection schema constants
DEFAULT_COLLECTION = "documents"
EMBEDDING_DIM = 768  # embeddinggemma:300m dimension
