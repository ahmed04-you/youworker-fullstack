"""
Qdrant vector store client with semantic search capabilities.
"""

# While ingestion relies on the synchronous helpers in packages.vectorstore.helpers,
# this async wrapper remains available for components that require direct client access.
import logging
import uuid
from dataclasses import dataclass
from typing import Any

from qdrant_client import AsyncQdrantClient

from packages.common.retry import async_retry
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A single search result from vector store."""

    id: str
    text: str
    score: float
    metadata: dict[str, Any]


class QdrantStore:
    """
    Qdrant vector store wrapper.

    Handles:
    - Collection management
    - Upserting embeddings with metadata
    - Semantic search with filters
    """

    def __init__(
        self,
        url: str = "http://localhost:6333",
        embedding_dim: int = 768,
        default_collection: str = "documents",
    ):
        """
        Initialize Qdrant store.

        Args:
            url: Qdrant server URL
            embedding_dim: Embedding vector dimension
            default_collection: Default collection name
        """
        self.url = url
        self.embedding_dim = embedding_dim
        self.default_collection = default_collection
        self.client = AsyncQdrantClient(url=url)

    @async_retry(max_attempts=3, min_wait=1.0, max_wait=5.0)
    async def ensure_collection(self, collection_name: str | None = None) -> None:
        """
        Create collection if it doesn't exist.

        Args:
            collection_name: Name of collection (defaults to default_collection)
        """
        collection_name = collection_name or self.default_collection

        try:
            collections = await self.client.get_collections()
            existing = [c.name for c in collections.collections]

            if collection_name not in existing:
                logger.info(
                    "Creating Qdrant collection",
                    extra={
                        "collection_name": collection_name,
                        "embedding_dim": self.embedding_dim,
                        "shard_number": 4,
                        "replication_factor": 2
                    }
                )
                await self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_dim,
                        distance=Distance.COSINE,
                    ),
                    shard_number=4,  # Enable sharding for large collections
                    replication_factor=2,  # For high availability
                )
            else:
                logger.debug(
                    "Qdrant collection already exists",
                    extra={"collection_name": collection_name}
                )

        except Exception as e:
            logger.error(
                "Failed to ensure Qdrant collection",
                extra={
                    "collection_name": collection_name,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            raise

    @async_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
    async def upsert_chunks(
        self,
        chunks: list[dict[str, Any]],
        collection_name: str | None = None,
    ) -> int:
        """
        Upsert document chunks with embeddings.

        Args:
            chunks: List of {id, text, embedding, metadata} dicts
            collection_name: Target collection

        Returns:
            Number of chunks upserted
        """
        collection_name = collection_name or self.default_collection

        await self.ensure_collection(collection_name)

        points = []
        for chunk in chunks:
            point_id = chunk.get("id", str(uuid.uuid4()))
            embedding = chunk["embedding"]
            text = chunk["text"]
            metadata = chunk.get("metadata", {})

            # Store text in payload
            payload = {"text": text, **metadata}

            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload,
                )
            )

        try:
            await self.client.upsert(
                collection_name=collection_name,
                points=points,
            )
            logger.info(
                "Upserted chunks to Qdrant collection",
                extra={
                    "collection_name": collection_name,
                    "chunk_count": len(points)
                }
            )
            return len(points)

        except Exception as e:
            logger.error(
                "Failed to upsert chunks to Qdrant",
                extra={
                    "collection_name": collection_name,
                    "chunk_count": len(points),
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            raise

    @async_retry(max_attempts=3, min_wait=1.0, max_wait=5.0)
    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        collection_name: str | None = None,
        tags: list[str] | None = None,
        user_id: int | None = None,
        user_group_ids: list[int] | None = None,
    ) -> list[SearchResult]:
        """
        Semantic search for similar documents with group-based access control.

        Args:
            query_embedding: Query vector
            top_k: Number of results to return
            collection_name: Collection to search
            tags: Optional tags to filter by
            user_id: User ID for access control filtering
            user_group_ids: List of group IDs the user belongs to

        Returns:
            List of SearchResult objects filtered by user's access rights
        """
        collection_name = collection_name or self.default_collection

        # Build filter conditions
        must_conditions = []

        # Add tag filters if provided
        if tags:
            for tag in tags:
                must_conditions.append(
                    FieldCondition(
                        key="tags",
                        match=MatchValue(value=tag),
                    )
                )

        # Add group-based access control if user_id provided
        if user_id is not None:
            # User can access:
            # 1. Documents they own (user_id matches), OR
            # 2. Documents in their groups that are NOT private
            access_conditions = [
                # Own documents
                FieldCondition(
                    key="user_id",
                    match=MatchValue(value=user_id),
                )
            ]

            # If user belongs to groups, add group access conditions
            if user_group_ids:
                # For each group, user can access non-private documents
                for group_id in user_group_ids:
                    access_conditions.append(
                        Filter(
                            must=[
                                FieldCondition(
                                    key="group_id",
                                    match=MatchValue(value=group_id),
                                ),
                                FieldCondition(
                                    key="is_private",
                                    match=MatchValue(value=False),
                                ),
                            ]
                        )
                    )

            # Wrap access conditions in a should (OR) clause
            must_conditions.append(Filter(should=access_conditions))

        # Build final filter
        query_filter = None
        if must_conditions:
            query_filter = Filter(must=must_conditions)

        try:
            search_result = await self.client.search(
                collection_name=collection_name,
                query_vector=query_embedding,
                limit=top_k,
                query_filter=query_filter,
            )

            results = []
            for hit in search_result:
                results.append(
                    SearchResult(
                        id=str(hit.id),
                        text=hit.payload.get("text", ""),
                        score=hit.score,
                        metadata={k: v for k, v in hit.payload.items() if k != "text"},
                    )
                )

            logger.info(
                "Qdrant search completed",
                extra={
                    "collection_name": collection_name,
                    "result_count": len(results),
                    "top_k": top_k,
                    "has_filter": query_filter is not None,
                    "user_id": user_id,
                    "group_count": len(user_group_ids) if user_group_ids else 0
                }
            )
            return results

        except Exception as e:
            logger.error(
                "Qdrant search failed",
                extra={
                    "collection_name": collection_name,
                    "top_k": top_k,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
            raise

    async def list_collections(self) -> list[dict[str, Any]]:
        """
        List all collections.

        Returns:
            List of collection info dicts
        """
        try:
            collections = await self.client.get_collections()
            return [
                {
                    "name": c.name,
                }
                for c in collections.collections
            ]
        except Exception as e:
            logger.error(
                "Failed to list Qdrant collections",
                extra={"error": str(e), "error_type": type(e).__name__}
            )
            raise

    async def close(self):
        """Close the client connection."""
        await self.client.close()
