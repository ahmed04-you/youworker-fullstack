"""
Base utilities for MCP server implementations.

Provides common JSON-RPC protocol handling, tool registration, and error responses
that can be shared across all MCP servers.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable
from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class MCPToolDefinition:
    """MCP tool definition for server-side registration."""
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable


@dataclass
class MCPServerInfo:
    """MCP server metadata."""
    name: str
    version: str = "1.0.0"
    protocol_version: str = "2024-10-01"


class MCPProtocolHandler:
    """
    Base handler for MCP JSON-RPC protocol.

    Provides common functionality for MCP servers including:
    - Tool registration and management
    - JSON-RPC request/response handling
    - Standard error responses
    - Initialize method handling
    """

    def __init__(self, server_info: MCPServerInfo):
        self.server_info = server_info
        self.logger = logging.getLogger(f"mcp.{server_info.name}")
        self._tools: dict[str, MCPToolDefinition] = {}

    def register_tool(
        self,
        name: str,
        description: str,
        input_schema: dict[str, Any],
        handler: Callable
    ) -> None:
        """Register a tool with its handler."""
        tool = MCPToolDefinition(
            name=name,
            description=description,
            input_schema=input_schema,
            handler=handler
        )
        self._tools[name] = tool
        self.logger.info(f"Registered tool: {name}")

    def get_tools_schema(self) -> list[dict[str, Any]]:
        """Return tool definitions in MCP schema format."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.input_schema,
            }
            for tool in self._tools.values()
        ]

    def get_initialize_response(self) -> dict[str, Any]:
        """Return standard initialize response."""
        return {
            "protocolVersion": self.server_info.protocol_version,
            "serverInfo": {
                "name": self.server_info.name,
                "version": self.server_info.version,
            },
            "capabilities": {
                "tools": {
                    "list": True,
                    "call": True,
                }
            },
        }

    def get_tools_list_response(self) -> dict[str, Any]:
        """Return tools/list response."""
        return {
            "tools": self.get_tools_schema()
        }

    async def handle_tool_call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """
        Handle a tools/call request.

        Args:
            name: Tool name
            arguments: Tool arguments

        Returns:
            Tool result in MCP format

        Raises:
            ValueError: If tool not found
        """
        if name not in self._tools:
            raise ValueError(f"Unknown tool: {name}")

        tool = self._tools[name]
        self.logger.info(f"Executing tool: {name}")

        try:
            result = await tool.handler(**arguments)
            return {
                "content": [
                    {
                        "type": "json",
                        "json": result
                    }
                ]
            }
        except Exception as e:
            self.logger.error(f"Tool execution failed: {name}", exc_info=True)
            raise

    def create_jsonrpc_response(
        self,
        request_id: Any,
        result: dict[str, Any] | None = None,
        error: dict[str, Any] | None = None
    ) -> str:
        """
        Create a JSON-RPC 2.0 response.

        Args:
            request_id: Request ID from the original request
            result: Result object (for success)
            error: Error object (for errors)

        Returns:
            JSON-RPC response as string
        """
        response = {
            "jsonrpc": "2.0",
            "id": request_id,
        }

        if error is not None:
            response["error"] = error
        else:
            response["result"] = result or {}

        return json.dumps(response)

    def create_error_response(
        self,
        request_id: Any,
        code: int,
        message: str,
        data: dict[str, Any] | None = None
    ) -> str:
        """
        Create a JSON-RPC error response.

        Args:
            request_id: Request ID
            code: Error code (JSON-RPC standard codes)
            message: Error message
            data: Additional error data

        Returns:
            JSON-RPC error response as string
        """
        error = {
            "code": code,
            "message": message,
        }
        if data:
            error["data"] = data

        return self.create_jsonrpc_response(request_id, error=error)

    async def handle_websocket_request(self, raw_message: str) -> str:
        """
        Handle a WebSocket message and return response.

        Args:
            raw_message: Raw JSON-RPC message from WebSocket

        Returns:
            JSON-RPC response as string
        """
        # Parse JSON
        try:
            request = json.loads(raw_message)
        except json.JSONDecodeError as e:
            return self.create_error_response(
                None,
                -32700,  # Parse error
                "Parse error",
                {"details": str(e), "raw": str(raw_message)[:200]}
            )

        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {}) or {}

        try:
            # Route to appropriate handler
            if method == "initialize":
                result = self.get_initialize_response()
            elif method == "tools/list":
                result = self.get_tools_list_response()
            elif method == "tools/call":
                name = params.get("name")
                arguments = params.get("arguments", {})
                result = await self.handle_tool_call(name, arguments)
            elif method == "ping":
                result = {"ok": True}
            else:
                return self.create_error_response(
                    request_id,
                    -32601,  # Method not found
                    "Method not found",
                    {"method": method}
                )

            return self.create_jsonrpc_response(request_id, result=result)

        except ValueError as e:
            # Business logic errors (e.g., unknown tool)
            return self.create_error_response(
                request_id,
                -32602,  # Invalid params
                str(e)
            )
        except Exception as e:
            # Unexpected errors
            self.logger.error(f"Error handling request: {e}", exc_info=True)
            return self.create_error_response(
                request_id,
                -32000,  # Server error
                str(e),
                {"type": type(e).__name__}
            )


async def mcp_websocket_handler(
    websocket: WebSocket,
    handler: MCPProtocolHandler
) -> None:
    """
    Generic WebSocket handler for MCP protocol.

    Args:
        websocket: FastAPI WebSocket instance
        handler: MCPProtocolHandler instance

    Usage:
        @app.websocket("/mcp")
        async def mcp_endpoint(ws: WebSocket):
            await mcp_websocket_handler(ws, my_handler)
    """
    await websocket.accept()
    handler.logger.info("MCP WebSocket connected")

    try:
        while True:
            raw_message = await websocket.receive_text()
            response = await handler.handle_websocket_request(raw_message)
            await websocket.send_text(response)

    except Exception as e:
        handler.logger.info(f"MCP WebSocket disconnected: {e}")
        # WebSocket disconnection is normal, no need to raise
