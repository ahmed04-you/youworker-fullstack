"""
Embedding and vector store integration for ingestion pipeline.
"""

from datetime import datetime, timezone
from typing import List, Sequence

from qdrant_client.http.models import PointStruct

from packages.common import Settings, get_settings
from packages.llm import Embedder
from packages.parsers.models import DocChunk
from packages.vectorstore import upsert_points, get_client


def get_embedder(settings: Settings | None = None) -> Embedder:
    """
    Get the embedder instance for the pipeline.

    Args:
        settings: Optional settings override

    Returns:
        Embedder instance
    """
    settings = settings or get_settings()
    return Embedder(settings=settings)


async def embed_chunks(
    chunks: Sequence[DocChunk],
    embedder: Embedder,
) -> List[List[float]]:
    """
    Generate embeddings for a list of chunks.

    Args:
        chunks: List of DocChunk to embed
        embedder: Embedder instance

    Returns:
        List of embedding vectors
    """
    texts = [chunk.text for chunk in chunks]
    return await embedder.embed_texts(texts)


async def prepare_points(
    chunks: Sequence[DocChunk],
    vectors: List[List[float]],
    settings: Settings,
    collection_name: str | None = None,
) -> List[PointStruct]:
    """
    Prepare Qdrant PointStructs from embedded chunks.

    Args:
        chunks: Embedded DocChunk list
        vectors: Corresponding embedding vectors
        settings: Pipeline settings
        collection_name: Optional collection override

    Returns:
        List of PointStruct ready for upsert
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    points: List[PointStruct] = []

    for chunk, vector in zip(chunks, vectors, strict=True):
        chunk.embedding = vector
        metadata = dict(chunk.metadata)
        # Prune metadata if needed (call from metadata_builder if separated)
        payload = {
            "id": chunk.id,
            "chunk_id": chunk.chunk_id,
            "source": chunk.source,
            "uri": chunk.uri,
            "mime": chunk.mime,
            "path_hash": chunk.metadata["path_hash"],
            "created_at": now_iso,
            "text": chunk.text,
            "metadata": metadata,
        }
        points.append(PointStruct(id=chunk.id, vector=vector, payload=payload))

    return points


async def upsert_embedded_chunks(
    points: List[PointStruct],
    settings: Settings,
    collection_name: str | None = None,
) -> None:
    """
    Upsert points to Qdrant.

    Args:
        points: List of PointStruct
        settings: Settings for client
        collection_name: Optional collection
    """
    client = get_client(settings)
    upsert_points(
        points,
        client=client,
        settings=settings,
        collection_name=collection_name,
    )
