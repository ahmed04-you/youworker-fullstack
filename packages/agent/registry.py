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

    async def connect_all(self) -> None:
        """Connect to all MCP servers and discover tools."""
        logger.info(f"Connecting to {len(self.server_configs)} MCP servers...")

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
            logger.info(f"Registry now has {len(self.tools)} tools from {len(self.clients)} servers")

    async def _discover_from_server(
        self, client: MCPClient, tools_dict: dict[str, MCPTool]
    ) -> None:
        """Discover tools from a single server."""
        try:
            tools = await client.list_tools()
            for tool in tools:
                tools_dict[tool.name] = tool
        except Exception as e:
            logger.error(f"Failed to discover tools from {client.server_id}: {e}")

    def to_llm_tools(self) -> list[dict[str, Any]]:
        """
        Convert registry tools to LLM tool schema format.

        Returns:
            List of tool schemas in OpenAI/Ollama format
        """
        return [tool.to_llm_schema() for tool in self.tools.values() if self._is_tool_available(tool)]

    def _is_tool_available(self, tool: MCPTool) -> bool:
        """Check if tool's server is healthy."""
        client = self.clients.get(tool.server_id)
        return client is not None and client.is_healthy

    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """
        Route and execute a tool call.

        Args:
            tool_name: Qualified tool name (e.g., "web.search")
            arguments: Tool arguments

        Returns:
            Tool execution result
        """
        tool = self.tools.get(tool_name)
        if not tool:
            raise ValueError(f"Tool not found: {tool_name}")

        client = self.clients.get(tool.server_id)
        if not client:
            raise RuntimeError(f"MCP server {tool.server_id} not connected")

        if not client.is_healthy:
            raise RuntimeError(f"MCP server {tool.server_id} is unhealthy")

        logger.info(f"Calling tool {tool_name} on server {tool.server_id}")

        try:
            result = await client.call_tool(tool_name, arguments)
            return result
        except Exception as e:
            logger.error(f"Tool execution failed: {tool_name} - {e}")
            raise

    async def close_all(self) -> None:
        """Close all MCP client connections."""
        for client in self.clients.values():
            await client.close()

    def get_tool(self, tool_name: str) -> MCPTool | None:
        """Get a tool by qualified name."""
        return self.tools.get(tool_name)

    def list_healthy_servers(self) -> list[str]:
        """Get list of healthy server IDs."""
        return [
            server_id
            for server_id, client in self.clients.items()
            if client.is_healthy
        ]
