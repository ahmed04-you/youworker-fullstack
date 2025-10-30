"""
Unit tests for correlation ID propagation (P0-8).

Tests that correlation IDs are generated, stored in context,
and propagated to external services correctly.
"""
from __future__ import annotations

import pytest
from unittest.mock import Mock, patch, AsyncMock

from packages.common.correlation import (
    get_correlation_id,
    set_correlation_id,
    generate_correlation_id,
)


class TestCorrelationID:
    """Test correlation ID generation and propagation."""

    def test_generate_correlation_id_format(self):
        """Test that generated correlation IDs have correct format."""
        correlation_id = generate_correlation_id()

        # Should be a non-empty string
        assert isinstance(correlation_id, str)
        assert len(correlation_id) > 0

        # Should be unique on subsequent calls
        correlation_id_2 = generate_correlation_id()
        assert correlation_id != correlation_id_2

    def test_set_and_get_correlation_id(self):
        """Test setting and retrieving correlation ID from context."""
        test_id = "test-correlation-id-12345"

        set_correlation_id(test_id)
        retrieved_id = get_correlation_id()

        assert retrieved_id == test_id

    def test_get_correlation_id_without_set(self):
        """Test that get_correlation_id returns None when not set."""
        # Clear any existing context
        from packages.common.correlation import _correlation_id_var
        token = _correlation_id_var.set(None)

        try:
            correlation_id = get_correlation_id()
            assert correlation_id is None
        finally:
            _correlation_id_var.reset(token)

    def test_correlation_id_isolation(self):
        """Test that correlation IDs are isolated per context."""
        # Set correlation ID in current context
        test_id_1 = "context-1-id"
        set_correlation_id(test_id_1)

        # Simulate different context by creating new token
        from packages.common.correlation import _correlation_id_var

        # Save current token
        token = _correlation_id_var.set("context-2-id")

        try:
            # In new context, should see different ID
            assert get_correlation_id() == "context-2-id"
        finally:
            # Reset to original
            _correlation_id_var.reset(token)

        # Original context should still have original ID
        assert get_correlation_id() == test_id_1

    @pytest.mark.asyncio
    async def test_correlation_id_propagation_to_ollama(self):
        """Test correlation ID is added to Ollama HTTP headers."""
        from packages.llm.ollama import OllamaClient

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "model": "llama2",
            "created_at": "2024-01-01T00:00:00Z",
            "response": "test",
            "done": True,
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            # Set correlation ID
            test_correlation_id = "test-ollama-correlation-id"
            set_correlation_id(test_correlation_id)

            # Create client and make request
            client = OllamaClient(base_url="http://localhost:11434")
            await client.generate(
                model="llama2",
                prompt="test prompt",
            )

            # Verify correlation ID was included in headers
            call_args = mock_client_instance.post.call_args
            headers = call_args.kwargs.get("headers", {})
            assert "X-Correlation-ID" in headers
            assert headers["X-Correlation-ID"] == test_correlation_id

    def test_correlation_id_in_log_context(self):
        """Test that correlation ID appears in structured log context."""
        import logging
        from packages.common.logger import setup_logger

        # Setup logger with structured logging
        logger = setup_logger("test_correlation", level=logging.DEBUG)

        test_correlation_id = "log-test-correlation-id"
        set_correlation_id(test_correlation_id)

        # Create a log record and verify correlation ID is included
        with patch.object(logger, "info") as mock_log:
            logger.info("Test message", extra={"correlation_id": get_correlation_id()})

            mock_log.assert_called_once()
            call_args = mock_log.call_args
            extra = call_args.kwargs.get("extra", {})
            assert extra.get("correlation_id") == test_correlation_id

    def test_correlation_id_length(self):
        """Test that generated correlation IDs have reasonable length."""
        correlation_id = generate_correlation_id()

        # Should be long enough to be unique but not excessively long
        assert 10 <= len(correlation_id) <= 64

    def test_correlation_id_characters(self):
        """Test that correlation IDs contain safe characters."""
        import re

        correlation_id = generate_correlation_id()

        # Should only contain alphanumeric and hyphens (safe for headers)
        assert re.match(r"^[a-zA-Z0-9\-_]+$", correlation_id)

    def test_multiple_correlation_id_generations(self):
        """Test generating many correlation IDs produces unique values."""
        ids = {generate_correlation_id() for _ in range(100)}

        # All should be unique
        assert len(ids) == 100
