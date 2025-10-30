"""
Helper functions for Qdrant vector store operations.
"""

import logging
from typing import TYPE_CHECKING

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

if TYPE_CHECKING:
    from packages.common import Settings

logger = logging.getLogger(__name__)


def get_client(settings: "Settings") -> QdrantClient:
    """
    Get a Qdrant client instance.

    Args:
        settings: Application settings

    Returns:
        QdrantClient instance
    """
    return QdrantClient(url=settings.qdrant_url)


def ensure_collections(
    client: QdrantClient, settings: "Settings", *, collection_name: str | None = None
) -> None:
    """
    Ensure required collections exist in Qdrant.

    Args:
        client: Qdrant client
        settings: Application settings
    """
    collection_name = collection_name or settings.qdrant_collection
    embedding_dim = settings.embedding_dim

    try:
        collections = client.get_collections()
        existing_names = {c.name for c in collections.collections}

        if collection_name not in existing_names:
            logger.info(
                "Creating Qdrant collection",
                extra={"collection_name": collection_name, "embedding_dim": embedding_dim}
            )
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=embedding_dim,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(
                "Created Qdrant collection",
                extra={"collection_name": collection_name}
            )
        else:
            logger.debug(
                "Collection already exists",
                extra={"collection_name": collection_name, "status": "already_exists"}
            )

    except Exception as e:
        logger.error(
            "Failed to ensure collection",
            extra={
                "collection_name": collection_name,
                "error": str(e),
                "error_type": type(e).__name__
            }
        )
        raise


def upsert_points(
    points: list[PointStruct],
    client: QdrantClient,
    settings: "Settings",
    *,
    collection_name: str | None = None,
) -> None:
    """
    Upsert points to Qdrant collection.

    Args:
        points: List of points to upsert
        client: Qdrant client
        settings: Application settings
    """
    if not points:
        return

    collection_name = collection_name or settings.qdrant_collection

    try:
        client.upsert(
            collection_name=collection_name,
            points=points,
        )
        logger.info(
            "Upserted points to Qdrant collection",
            extra={"point_count": len(points), "collection_name": collection_name}
        )

    except Exception as e:
        logger.error(
            "Failed to upsert points",
            extra={"error": str(e), "error_type": type(e).__name__}
        )
        raise
