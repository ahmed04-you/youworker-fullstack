import pytest
from unittest.mock import AsyncMock

from packages.agent.registry import MCPRegistry
from packages.mcp.client import MCPTool


@pytest.mark.asyncio
async def test_registry_sanitized_names_and_call_mapping(monkeypatch):
    # Prepare registry with two tools that would collide when sanitized
    reg = MCPRegistry(server_configs=[])

    # Fake clients map
    class FakeClient:
        def __init__(self):
            self.call_tool = AsyncMock(return_value={"ok": True})
            self.server_id = "web"
            self.is_healthy = True

    client = FakeClient()
    reg.clients["web"] = client  # type: ignore

    # Two tools: web.search and web/search -> both sanitize to web_search
    t1 = MCPTool(
        name="web.search",
        description="d1",
        input_schema={"type": "object", "properties": {}},
        server_id="web",
        server_url="ws://x/mcp",
    )
    t2 = MCPTool(
        name="web/search",
        description="d2",
        input_schema={"type": "object", "properties": {}},
        server_id="web",
        server_url="ws://x/mcp",
    )

    reg.tools = {t1.name: t1, t2.name: t2}
    reg._rebuild_exposure_map()

    tools = reg.to_llm_tools()
    names = [tool["function"]["name"] for tool in tools]
    # Both names should be unique and sanitized
    assert "web_search" in names
    assert any(n.startswith("web_search_") for n in names)

    # Map exposed name back to qualified name on call
    # Choose the base mapping 'web_search' which should point to t1
    args = {"x": 1}
    result = await reg.call_tool("web_search", args)
    assert result == {"ok": True}
    # Ensure underlying client was called with qualified 'web.search'
    client.call_tool.assert_awaited()
    called_with = client.call_tool.call_args[0][0]
    assert called_with == "web.search"

