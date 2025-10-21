"""
Qdrant vector store client with semantic search capabilities.
"""
import logging
import uuid
from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, AsyncQdrantClient
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
                logger.info(f"Creating collection: {collection_name}")
                await self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_dim,
                        distance=Distance.COSINE,
                    ),
                )
            else:
                logger.debug(f"Collection {collection_name} already exists")

        except Exception as e:
            logger.error(f"Failed to ensure collection {collection_name}: {e}")
            raise

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
            logger.info(f"Upserted {len(points)} chunks to {collection_name}")
            return len(points)

        except Exception as e:
            logger.error(f"Failed to upsert chunks: {e}")
            raise

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        collection_name: str | None = None,
        tags: list[str] | None = None,
    ) -> list[SearchResult]:
        """
        Semantic search for similar documents.

        Args:
            query_embedding: Query vector
            top_k: Number of results to return
            collection_name: Collection to search
            tags: Optional tags to filter by

        Returns:
            List of SearchResult objects
        """
        collection_name = collection_name or self.default_collection

        # Build filter if tags provided
        query_filter = None
        if tags:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="tags",
                        match=MatchValue(value=tag),
                    )
                    for tag in tags
                ]
            )

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

            logger.info(f"Found {len(results)} results for query")
            return results

        except Exception as e:
            logger.error(f"Search failed: {e}")
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
            logger.error(f"Failed to list collections: {e}")
            raise

    async def close(self):
        """Close the client connection."""
        await self.client.close()
