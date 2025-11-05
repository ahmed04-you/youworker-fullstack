"""
MCP tool registry with dynamic discovery and management.
"""

import asyncio
import logging
from typing import Any

from packages.mcp import MCPClient, MCPTool

logger = logging.getLogger(__name__)


class MCPRegistry:
    """
    Registry that manages multiple MCP servers and their tools.

    Handles:
    - Multi-server connection and tool discovery
    - Tool routing to appropriate server
    - Health monitoring
    - LLM schema generation
    """

    def __init__(self, server_configs: list[dict[str, str]]):
        """
        Initialize the registry.

        Args:
            server_configs: List of {"server_id": str, "url": str} dicts
        """
        self.server_configs = server_configs
        self.clients: dict[str, MCPClient] = {}
        self.tools: dict[str, MCPTool] = {}  # qualified_name -> MCPTool
        self._lock = asyncio.Lock()
        # Exposed name mapping (sanitized for LLM tool schema)
        self._exposed_to_qualified: dict[str, str] = {}
        self._qualified_to_exposed: dict[str, str] = {}
        # Periodic refresh task
        self._refresh_task: asyncio.Task | None = None
        self._refresh_interval: int | None = None
        # Optional callback after refresh to persist server/tool state
        self._on_refreshed = None

    def set_refreshed_callback(self, callback):
        """Set a callback invoked after tools are refreshed.

        Callback signature: async or sync function accepting (tools: dict[str, MCPTool], clients: dict[str, MCPClient])
        """
        self._on_refreshed = callback

    async def connect_all(self) -> None:
        """Connect to all MCP servers and discover tools."""
        logger.info(
            "Connecting to MCP servers",
            extra={"server_count": len(self.server_configs)}
        )

        # Create clients
        for config in self.server_configs:
            server_id = config["server_id"]
            url = config["url"]

            client = MCPClient(server_url=url, server_id=server_id)
            self.clients[server_id] = client

        # Discover tools from all servers
        await self.refresh_tools()

    async def refresh_tools(self) -> None:
        """Refresh tool list from all servers."""
        async with self._lock:
            new_tools = {}

            # Discover tools from each server
            tasks = []
            for server_id, client in self.clients.items():
                tasks.append(self._discover_from_server(client, new_tools))

            await asyncio.gather(*tasks, return_exceptions=True)

            self.tools = new_tools
            # Rebuild exposure map
            self._rebuild_exposure_map()
            logger.info(
                "Registry tools refreshed",
                extra={
                    "tool_count": len(self.tools),
                    "server_count": len(self.clients),
                    "exposed_count": len(self._exposed_to_qualified)
                }
            )
            # Invoke callback
            if self._on_refreshed:
                try:
                    maybe = self._on_refreshed(self.tools, self.clients)
                    if asyncio.iscoroutine(maybe):
                        await maybe
                except Exception as e:
                    logger.error(
                        "on_refreshed callback failed",
                        extra={"error": str(e), "error_type": type(e).__name__}
                    )

    async def _discover_from_server(
        self, client: MCPClient, tools_dict: dict[str, MCPTool]
    ) -> None:
        """Discover tools from a single server."""
        try:
            tools = await client.list_tools()
            for tool in tools:
                qualified_name = f"{client.server_id}.{tool.name}"
                tools_dict[qualified_name] = tool
        except Exception as e:
            logger.error(
                "Failed to discover tools from server",
                extra={
                    "server_id": client.server_id,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )

    def to_llm_tools(self, exclude_servers: list[str] | None = None) -> list[dict[str, Any]]:
        """
        Convert registry tools to LLM tool schema format.

        Args:
            exclude_servers: Optional list of server IDs to exclude (e.g., ["web"] to disable web tools)

        Returns:
            List of tool schemas in OpenAI/Ollama format
        """
        exclude_set = set(exclude_servers or [])
        schemas: list[dict[str, Any]] = []
        for qualified_name, tool in self.tools.items():
            if not self._is_tool_available(tool):
                continue
            # Filter by server_id if specified
            if exclude_set and tool.server_id in exclude_set:
                continue
            exposed = self._qualified_to_exposed.get(qualified_name, qualified_name.replace(".", "_"))
            schemas.append(
                {
                    "type": "function",
                    "function": {
                        "name": exposed,
                        "description": tool.description,
                        "parameters": tool.input_schema,
                    },
                }
            )
        return schemas

    def _is_tool_available(self, tool: MCPTool) -> bool:
        """Check if tool's server is healthy."""
        client = self.clients.get(tool.server_id)
        return client is not None and client.is_healthy

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """
        Route and execute a tool call.

        Args:
            tool_name: Qualified tool name (e.g., "web.web_search")
            arguments: Tool arguments

        Returns:
            Tool execution result
        """
        tool = self.tools.get(tool_name)
        if not tool:
            # Try exposed name mapping (sanitized names from LLM)
            qualified = self._exposed_to_qualified.get(tool_name)
            if qualified:
                tool = self.tools.get(qualified)
            if not tool:
                raise ValueError(f"Tool not found: {tool_name}")

        client = self.clients.get(tool.server_id)
        if not client:
            raise RuntimeError(f"MCP server {tool.server_id} not connected")

        if not client.is_healthy:
            raise RuntimeError(f"MCP server {tool.server_id} is unhealthy")

        logger.info(
            "Calling tool on MCP server",
            extra={"tool_name": tool_name, "server_id": tool.server_id}
        )

        try:
            # Always call with the qualified name to preserve server namespace
            result = await client.call_tool(tool.name, arguments)
            return result
        except (ConnectionError, TimeoutError, OSError) as e:
            logger.error(
                "Network error in tool execution",
                extra={"tool_name": tool_name, "error": str(e), "error_type": type(e).__name__}
            )
            raise ConnectionError(f"Tool {tool_name} unavailable due to network issue: {e}")
        except ValueError as e:
            logger.error(
                "Invalid arguments for tool",
                extra={"tool_name": tool_name, "error": str(e), "error_type": type(e).__name__}
            )
            raise ValueError(f"Invalid arguments for tool {tool_name}: {e}")
        except Exception as e:
            logger.error(
                "Unexpected error in tool execution",
                extra={"tool_name": tool_name, "error": str(e), "error_type": type(e).__name__}
            )
            raise RuntimeError(f"Tool {tool_name} execution failed: {e}")

    async def close_all(self) -> None:
        """Close all MCP client connections."""
        # Stop periodic refresh first
        await self.stop_periodic_refresh()
        for client in self.clients.values():
            await client.close()

    def get_tool(self, tool_name: str) -> MCPTool | None:
        """Get a tool by qualified name."""
        return self.tools.get(tool_name)

    def list_healthy_servers(self) -> list[str]:
        """Get list of healthy server IDs."""
        return [server_id for server_id, client in self.clients.items() if client.is_healthy]

    def _rebuild_exposure_map(self) -> None:
        exposed_to_qualified: dict[str, str] = {}
        qualified_to_exposed: dict[str, str] = {}

        for qualified_name, tool in self.tools.items():
            base = self._sanitize(tool.name)
            candidate = base
            if candidate in exposed_to_qualified and exposed_to_qualified[candidate] != qualified_name:
                base = self._sanitize(f"{tool.server_id}_{tool.name}")
                candidate = base

            i = 2
            while candidate in exposed_to_qualified and exposed_to_qualified[candidate] != qualified_name:
                candidate = f"{base}_{i}"
                i += 1

            exposed_to_qualified[candidate] = qualified_name
            qualified_to_exposed[qualified_name] = candidate

        self._exposed_to_qualified = exposed_to_qualified
        self._qualified_to_exposed = qualified_to_exposed

    @staticmethod
    def _sanitize(value: str) -> str:
        return value.replace(".", "_").replace("-", "_").replace("/", "_")

    async def start_periodic_refresh(self, interval_seconds: int = 90) -> None:
        if interval_seconds <= 0:
            await self.stop_periodic_refresh()
            return

        if self._refresh_task and not self._refresh_task.done():
            if self._refresh_interval == interval_seconds:
                return
            await self.stop_periodic_refresh()

        self._refresh_interval = interval_seconds

        async def _loop() -> None:
            while True:
                try:
                    await asyncio.sleep(interval_seconds)
                    await self.refresh_tools()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning(
                        "Periodic refresh failed",
                        extra={"error": str(e), "error_type": type(e).__name__}
                    )

        self._refresh_task = asyncio.create_task(_loop())

    async def stop_periodic_refresh(self) -> None:
        if self._refresh_task and not self._refresh_task.done():
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except Exception:
                pass
            self._refresh_task = None
        self._refresh_interval = None
