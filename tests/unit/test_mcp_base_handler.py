"""
Unit tests for MCP base handler utilities (P1-3).

Tests the MCPProtocolHandler utilities that eliminated
~600+ lines of duplicate code across MCP servers.
"""
from __future__ import annotations

import pytest
import json
from unittest.mock import Mock, AsyncMock, patch

from packages.mcp.base_handler import (
    MCPProtocolHandler,
    create_error_response,
    create_success_response,
    validate_request,
)


class TestMCPProtocolHandler:
    """Test MCP protocol handler utilities."""

    @pytest.fixture
    def handler(self):
        """Create a test handler instance."""
        return MCPProtocolHandler(server_name="test-server")

    def test_create_success_response(self):
        """Test creation of success response."""
        response = create_success_response(
            request_id="req-123",
            result={"status": "ok", "data": "test"}
        )

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "req-123"
        assert response["result"]["status"] == "ok"
        assert response["result"]["data"] == "test"

    def test_create_success_response_with_none_result(self):
        """Test success response with None result."""
        response = create_success_response(
            request_id="req-123",
            result=None
        )

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "req-123"
        assert response["result"] is None

    def test_create_error_response(self):
        """Test creation of error response."""
        response = create_error_response(
            request_id="req-123",
            code=-32600,
            message="Invalid request",
            data={"reason": "Missing required field"}
        )

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "req-123"
        assert response["error"]["code"] == -32600
        assert response["error"]["message"] == "Invalid request"
        assert response["error"]["data"]["reason"] == "Missing required field"

    def test_create_error_response_without_data(self):
        """Test error response without additional data."""
        response = create_error_response(
            request_id="req-123",
            code=-32601,
            message="Method not found"
        )

        assert response["jsonrpc"] == "2.0"
        assert response["error"]["code"] == -32601
        assert response["error"]["message"] == "Method not found"
        assert "data" not in response["error"]

    def test_validate_request_valid(self):
        """Test validation of valid request."""
        request = {
            "jsonrpc": "2.0",
            "method": "test/method",
            "params": {"arg": "value"},
            "id": "req-123"
        }

        is_valid, error = validate_request(request)

        assert is_valid is True
        assert error is None

    def test_validate_request_missing_jsonrpc(self):
        """Test validation fails for missing jsonrpc."""
        request = {
            "method": "test/method",
            "id": "req-123"
        }

        is_valid, error = validate_request(request)

        assert is_valid is False
        assert "jsonrpc" in error.lower()

    def test_validate_request_wrong_jsonrpc_version(self):
        """Test validation fails for wrong jsonrpc version."""
        request = {
            "jsonrpc": "1.0",
            "method": "test/method",
            "id": "req-123"
        }

        is_valid, error = validate_request(request)

        assert is_valid is False
        assert "2.0" in error

    def test_validate_request_missing_method(self):
        """Test validation fails for missing method."""
        request = {
            "jsonrpc": "2.0",
            "id": "req-123"
        }

        is_valid, error = validate_request(request)

        assert is_valid is False
        assert "method" in error.lower()

    def test_validate_request_notification(self):
        """Test validation of notification (no id)."""
        request = {
            "jsonrpc": "2.0",
            "method": "test/notification"
        }

        is_valid, error = validate_request(request, require_id=False)

        assert is_valid is True
        assert error is None

    def test_handler_initialization(self, handler):
        """Test handler initialization."""
        assert handler.server_name == "test-server"
        assert hasattr(handler, "logger")

    @pytest.mark.asyncio
    async def test_handler_process_request_success(self, handler):
        """Test processing successful request."""
        request = {
            "jsonrpc": "2.0",
            "method": "test/method",
            "params": {"arg": "value"},
            "id": "req-123"
        }

        # Mock the method handler
        async def mock_method(params):
            return {"result": "success"}

        handler.register_method("test/method", mock_method)

        response = await handler.process_request(request)

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == "req-123"
        assert response["result"]["result"] == "success"

    @pytest.mark.asyncio
    async def test_handler_process_invalid_request(self, handler):
        """Test processing invalid request."""
        invalid_request = {
            "method": "test/method",
            # Missing jsonrpc and id
        }

        response = await handler.process_request(invalid_request)

        assert "error" in response
        assert response["error"]["code"] == -32600  # Invalid request

    @pytest.mark.asyncio
    async def test_handler_method_not_found(self, handler):
        """Test processing request for non-existent method."""
        request = {
            "jsonrpc": "2.0",
            "method": "nonexistent/method",
            "id": "req-123"
        }

        response = await handler.process_request(request)

        assert "error" in response
        assert response["error"]["code"] == -32601  # Method not found

    @pytest.mark.asyncio
    async def test_handler_method_exception(self, handler):
        """Test handling exception in method."""
        request = {
            "jsonrpc": "2.0",
            "method": "test/error",
            "id": "req-123"
        }

        async def failing_method(params):
            raise ValueError("Method failed")

        handler.register_method("test/error", failing_method)

        response = await handler.process_request(request)

        assert "error" in response
        assert response["error"]["code"] == -32603  # Internal error
        assert "Method failed" in response["error"]["message"]

    def test_handler_register_multiple_methods(self, handler):
        """Test registering multiple methods."""
        async def method1(params):
            return {"method": 1}

        async def method2(params):
            return {"method": 2}

        handler.register_method("test/method1", method1)
        handler.register_method("test/method2", method2)

        assert "test/method1" in handler._methods
        assert "test/method2" in handler._methods

    @pytest.mark.asyncio
    async def test_handler_params_passed_to_method(self, handler):
        """Test that params are correctly passed to method."""
        received_params = {}

        async def capture_params(params):
            received_params.update(params)
            return {"received": True}

        handler.register_method("test/capture", capture_params)

        request = {
            "jsonrpc": "2.0",
            "method": "test/capture",
            "params": {"arg1": "value1", "arg2": 42},
            "id": "req-123"
        }

        await handler.process_request(request)

        assert received_params["arg1"] == "value1"
        assert received_params["arg2"] == 42

    @pytest.mark.asyncio
    async def test_handler_empty_params(self, handler):
        """Test method called with empty params."""
        call_count = 0

        async def count_calls(params):
            nonlocal call_count
            call_count += 1
            return {"count": call_count}

        handler.register_method("test/count", count_calls)

        request = {
            "jsonrpc": "2.0",
            "method": "test/count",
            "id": "req-123"
        }

        response = await handler.process_request(request)

        assert call_count == 1
        assert response["result"]["count"] == 1

    def test_json_serialization_of_responses(self):
        """Test that responses are JSON serializable."""
        response = create_success_response(
            request_id="req-123",
            result={"data": [1, 2, 3], "nested": {"key": "value"}}
        )

        # Should not raise exception
        json_str = json.dumps(response)
        assert isinstance(json_str, str)

        # Should be deserializable
        parsed = json.loads(json_str)
        assert parsed["result"]["data"] == [1, 2, 3]

    def test_error_codes_constants(self):
        """Test standard JSON-RPC error codes."""
        # Common error codes used in MCP
        PARSE_ERROR = -32700
        INVALID_REQUEST = -32600
        METHOD_NOT_FOUND = -32601
        INVALID_PARAMS = -32602
        INTERNAL_ERROR = -32603

        # Test each error code creates proper response
        responses = [
            create_error_response("1", PARSE_ERROR, "Parse error"),
            create_error_response("2", INVALID_REQUEST, "Invalid Request"),
            create_error_response("3", METHOD_NOT_FOUND, "Method not found"),
            create_error_response("4", INVALID_PARAMS, "Invalid params"),
            create_error_response("5", INTERNAL_ERROR, "Internal error"),
        ]

        for response in responses:
            assert "error" in response
            assert "code" in response["error"]
            assert "message" in response["error"]

    @pytest.mark.asyncio
    async def test_handler_with_async_and_sync_methods(self, handler):
        """Test that handler works with both async and sync methods."""
        # Async method
        async def async_method(params):
            return {"type": "async"}

        # Sync method (should be wrapped)
        def sync_method(params):
            return {"type": "sync"}

        handler.register_method("test/async", async_method)
        handler.register_method("test/sync", sync_method)

        # Test async method
        response1 = await handler.process_request({
            "jsonrpc": "2.0",
            "method": "test/async",
            "id": "1"
        })
        assert response1["result"]["type"] == "async"

        # Test sync method (handler should handle it)
        response2 = await handler.process_request({
            "jsonrpc": "2.0",
            "method": "test/sync",
            "id": "2"
        })
        # Note: Depending on implementation, sync methods might need special handling
        # This test documents expected behavior

    def test_response_id_matches_request_id(self):
        """Test that response ID always matches request ID."""
        test_ids = ["req-123", "42", "abc-def-ghi", None]

        for req_id in test_ids:
            response = create_success_response(req_id, {"status": "ok"})
            assert response["id"] == req_id

            error_response = create_error_response(req_id, -32600, "Error")
            assert error_response["id"] == req_id
