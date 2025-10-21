"""
MCP (Model Context Protocol) client for dynamic tool discovery and invocation.
"""
import logging
from dataclasses import dataclass
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


@dataclass
class MCPTool:
    """Represents a tool from an MCP server."""

    name: str
    description: str
    input_schema: dict[str, Any]
    server_id: str
    server_url: str
    tags: list[str] | None = None

    def to_llm_schema(self) -> dict[str, Any]:
        """Convert to OpenAI/Ollama tool schema format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema,
            },
        }


class MCPClient:
    """
    Client for communicating with MCP servers.

    Handles:
    - Tool discovery via tools/list
    - Tool invocation via tools/call
    - Health checks and retries
    """

    def __init__(self, server_url: str, server_id: str, timeout: float = 30.0):
        """
        Initialize MCP client.

        Args:
            server_url: Base URL of the MCP server
            server_id: Unique identifier for this server
            timeout: Request timeout in seconds
        """
        self.server_url = server_url.rstrip("/")
        self.server_id = server_id
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
        self._healthy = True

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    @property
    def is_healthy(self) -> bool:
        """Check if the server is healthy."""
        return self._healthy

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def list_tools(self) -> list[MCPTool]:
        """
        Discover tools from the MCP server via tools/list.

        Returns:
            List of MCPTool objects
        """
        try:
            response = await self.client.post(
                f"{self.server_url}/tools/list",
                json={},
            )
            response.raise_for_status()

            data = response.json()
            tools_data = data.get("tools", [])

            tools = []
            for tool_data in tools_data:
                # Apply server namespace prefix
                name = f"{self.server_id}.{tool_data['name']}"

                tool = MCPTool(
                    name=name,
                    description=tool_data.get("description", ""),
                    input_schema=tool_data.get("inputSchema", {}),
                    server_id=self.server_id,
                    server_url=self.server_url,
                    tags=tool_data.get("tags"),
                )
                tools.append(tool)

            self._healthy = True
            logger.info(f"Discovered {len(tools)} tools from {self.server_id}")
            return tools

        except Exception as e:
            logger.error(f"Failed to list tools from {self.server_id}: {e}")
            self._healthy = False
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    async def call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """
        Invoke a tool on the MCP server.

        Args:
            tool_name: Name of the tool (without server prefix)
            arguments: Tool input arguments

        Returns:
            Tool execution result
        """
        # Strip server prefix if present
        if tool_name.startswith(f"{self.server_id}."):
            tool_name = tool_name[len(self.server_id) + 1 :]

        try:
            response = await self.client.post(
                f"{self.server_url}/tools/call",
                json={"name": tool_name, "arguments": arguments},
            )
            response.raise_for_status()

            data = response.json()

            # Extract result content
            content = data.get("content", [])
            if not content:
                return {"result": "Tool executed successfully with no output"}

            # Combine text content
            result_text = ""
            for item in content:
                if item.get("type") == "text":
                    result_text += item.get("text", "")

            self._healthy = True
            return {"result": result_text or data}

        except Exception as e:
            logger.error(f"Failed to call tool {tool_name} on {self.server_id}: {e}")
            self._healthy = False
            raise

    async def health_check(self) -> bool:
        """
        Check if the MCP server is healthy.

        Returns:
            True if healthy, False otherwise
        """
        try:
            response = await self.client.get(f"{self.server_url}/health")
            response.raise_for_status()
            self._healthy = True
            return True
        except Exception:
            self._healthy = False
            return False
