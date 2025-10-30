"""
Unit tests for metadata user_id inclusion (P0-3).

Tests that user_id is correctly included in metadata for
proper access control in vector search.
"""
from __future__ import annotations

import pytest
from unittest.mock import Mock, patch, AsyncMock

from packages.ingestion.metadata_builder import (
    build_chunk_metadata,
    prune_metadata,
)
from packages.parsers.models import DocChunk


class TestMetadataUserID:
    """Test user_id inclusion in metadata."""

    @pytest.fixture
    def sample_chunk(self):
        """Create a sample DocChunk for testing."""
        return DocChunk(
            uri="file:///test/document.pdf",
            chunk_id="chunk-001",
            content="Sample content for testing",
            start_byte=0,
            end_byte=100,
        )

    def test_build_chunk_metadata_with_user_id(self, sample_chunk):
        """Test that metadata includes user_id when provided."""
        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=42,
        )

        assert "user_id" in metadata
        assert metadata["user_id"] == 42

    def test_build_chunk_metadata_without_user_id(self, sample_chunk):
        """Test that metadata excludes user_id when not provided."""
        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=None,
        )

        assert "user_id" not in metadata

    def test_build_chunk_metadata_with_zero_user_id(self, sample_chunk):
        """Test that user_id of 0 is valid and included."""
        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=0,
        )

        assert "user_id" in metadata
        assert metadata["user_id"] == 0

    def test_metadata_structure(self, sample_chunk):
        """Test complete metadata structure."""
        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=123,
            pages=[{"page_num": 1, "content": "Page 1"}],
            tags=["important", "test"],
        )

        # Check all expected fields
        assert metadata["uri"] == "file:///test/document.pdf"
        assert metadata["path_hash"] == "abc123"
        assert metadata["chunk_id"] == "chunk-001"
        assert metadata["original_format"] == "application/pdf"
        assert metadata["output_format"] == "markdown"
        assert metadata["user_id"] == 123
        assert metadata["pages"] == [{"page_num": 1, "content": "Page 1"}]
        assert metadata["tags"] == ["important", "test"]

    def test_prune_metadata_preserves_user_id(self, sample_chunk):
        """Test that pruning keeps user_id as essential field."""
        # Create large metadata that needs pruning
        large_metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=456,
            pages=[{"content": "x" * 10000} for _ in range(100)],
            tags=["tag" + str(i) for i in range(1000)],
        )

        # Add extra large non-essential fields
        large_metadata["extra_large_field"] = "y" * 50000

        # Prune to small size
        pruned = prune_metadata(large_metadata, max_bytes=500)

        # user_id should be preserved as essential field
        assert "user_id" in pruned
        assert pruned["user_id"] == 456

        # Essential fields should also be preserved
        assert "uri" in pruned
        assert "path_hash" in pruned
        assert "chunk_id" in pruned

    def test_prune_metadata_removes_non_essential_first(self):
        """Test that pruning removes non-essential fields first."""
        metadata = {
            "uri": "file:///test.pdf",
            "path_hash": "hash123",
            "chunk_id": "chunk-001",
            "user_id": 789,
            "source": "test",
            "non_essential": "x" * 10000,
            "pages": [{"content": "y" * 5000}],
        }

        pruned = prune_metadata(metadata, max_bytes=200)

        # Essential fields should remain
        assert "user_id" in pruned
        assert "uri" in pruned
        assert "path_hash" in pruned
        assert "chunk_id" in pruned

        # Non-essential should be removed
        assert "non_essential" not in pruned

    @pytest.mark.asyncio
    async def test_ingestion_pipeline_passes_user_id(self):
        """Test that ingestion pipeline passes user_id through."""
        from packages.ingestion.pipeline import IngestionPipeline

        # Mock dependencies
        mock_embedder = AsyncMock()
        mock_embedder.embed_text = AsyncMock(return_value=[0.1] * 768)

        mock_vector_store = AsyncMock()
        mock_vector_store.upsert = AsyncMock()

        with patch("packages.ingestion.pipeline.Parser") as MockParser:
            mock_parser_instance = Mock()
            mock_parser_instance.parse_file = Mock(return_value=[
                DocChunk(
                    uri="file:///test.pdf",
                    chunk_id="chunk-001",
                    content="Test content",
                    start_byte=0,
                    end_byte=100,
                )
            ])
            MockParser.return_value = mock_parser_instance

            pipeline = IngestionPipeline(
                embedder=mock_embedder,
                vector_store=mock_vector_store,
            )

            # Ingest with user_id
            test_user_id = 999
            await pipeline.ingest_path(
                path="/test/document.pdf",
                user_id=test_user_id,
            )

            # Verify upsert was called with user_id in metadata
            assert mock_vector_store.upsert.called
            call_args = mock_vector_store.upsert.call_args

            # Check that points include user_id
            points = call_args[0][0] if call_args[0] else call_args.kwargs.get("points", [])
            assert len(points) > 0

            # Each point should have user_id in metadata
            for point in points:
                assert "payload" in point or "metadata" in point
                metadata = point.get("payload", point.get("metadata", {}))
                assert "user_id" in metadata
                assert metadata["user_id"] == test_user_id

    def test_different_user_ids_produce_different_metadata(self, sample_chunk):
        """Test that different user IDs produce distinct metadata."""
        metadata_user_1 = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=1,
        )

        metadata_user_2 = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=2,
        )

        assert metadata_user_1["user_id"] == 1
        assert metadata_user_2["user_id"] == 2
        assert metadata_user_1["user_id"] != metadata_user_2["user_id"]

    def test_metadata_user_id_type(self, sample_chunk):
        """Test that user_id is stored as integer."""
        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=123,
        )

        assert isinstance(metadata["user_id"], int)

    def test_metadata_with_large_user_id(self, sample_chunk):
        """Test handling of large user ID values."""
        large_user_id = 2**31 - 1  # Max 32-bit integer

        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=large_user_id,
        )

        assert metadata["user_id"] == large_user_id

    def test_metadata_user_id_survives_serialization(self, sample_chunk):
        """Test that user_id remains after JSON serialization."""
        import json

        metadata = build_chunk_metadata(
            chunk=sample_chunk,
            path_hash="abc123",
            original_format="application/pdf",
            output_format="markdown",
            user_id=555,
        )

        # Serialize and deserialize
        json_str = json.dumps(metadata)
        deserialized = json.loads(json_str)

        assert deserialized["user_id"] == 555
        assert isinstance(deserialized["user_id"], int)

    def test_essential_keys_include_user_id(self):
        """Test that user_id is in essential keys list for pruning."""
        # This tests the implementation detail of prune_metadata
        metadata = {
            "uri": "file:///test.pdf",
            "path_hash": "hash123",
            "chunk_id": "chunk-001",
            "user_id": 321,
            "huge_field": "x" * 100000,
        }

        # Prune aggressively
        pruned = prune_metadata(metadata, max_bytes=100)

        # user_id should survive even aggressive pruning
        assert "user_id" in pruned
        assert pruned["user_id"] == 321

    @pytest.mark.asyncio
    async def test_vector_search_filters_by_user_id(self):
        """Test that vector search can filter by user_id."""
        from packages.vectorstore.qdrant import QdrantVectorStore

        mock_client = AsyncMock()
        mock_client.search = AsyncMock(return_value=[])

        store = QdrantVectorStore(
            client=mock_client,
            collection_name="test_collection",
        )

        test_user_id = 777

        # Perform search with user_id filter
        await store.search(
            query_vector=[0.1] * 768,
            filter={"user_id": test_user_id},
            limit=10,
        )

        # Verify search was called with user_id filter
        assert mock_client.search.called
        call_kwargs = mock_client.search.call_args.kwargs

        # Check filter includes user_id
        search_filter = call_kwargs.get("query_filter") or call_kwargs.get("filter")
        assert search_filter is not None
        # The exact structure depends on Qdrant filter format,
        # but user_id should be present
        assert "user_id" in str(search_filter)
