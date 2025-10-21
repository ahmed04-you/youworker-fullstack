"""
Integration tests for Agent Loop + MCP Registry + MCP Servers.

These tests verify that the agent can correctly:
1. Discover tools from MCP servers
2. Call tools through the registry
3. Handle tool results
4. Complete multi-turn conversations with tools
"""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, Mock, patch

from packages.agent import AgentLoop, MCPRegistry
from packages.llm import ChatMessage, ToolCall
from packages.mcp import MCPClient, MCPTool


@pytest.fixture
def mock_mcp_servers():
    """Simulate multiple MCP servers with different tools."""
    web_tools = [
        MCPTool(
            name="web.search",
            description="Search the web for information",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "top_k": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            server_id="web",
            server_url="ws://localhost:7001/mcp",
        ),
        MCPTool(
            name="web.fetch",
            description="Fetch content from a URL",
            input_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to fetch"},
                },
                "required": ["url"],
            },
            server_id="web",
            server_url="ws://localhost:7001/mcp",
        ),
    ]

    semantic_tools = [
        MCPTool(
            name="semantic.query",
            description="Semantic search over documents",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "top_k": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
            server_id="semantic",
            server_url="ws://localhost:7002/mcp",
        ),
    ]

    return {"web": web_tools, "semantic": semantic_tools}


@pytest.fixture
def mock_registry(mock_mcp_servers):
    """Create a registry with mocked MCP clients."""
    registry = MCPRegistry(server_configs=[])

    # Mock clients
    web_client = Mock(spec=MCPClient)
    web_client.server_id = "web"
    web_client.is_healthy = True
    web_client.list_tools = AsyncMock(return_value=mock_mcp_servers["web"])
    web_client.call_tool = AsyncMock()

    semantic_client = Mock(spec=MCPClient)
    semantic_client.server_id = "semantic"
    semantic_client.is_healthy = True
    semantic_client.list_tools = AsyncMock(return_value=mock_mcp_servers["semantic"])
    semantic_client.call_tool = AsyncMock()

    registry.clients = {
        "web": web_client,
        "semantic": semantic_client,
    }

    # Populate tools
    registry.tools = {
        "web.search": mock_mcp_servers["web"][0],
        "web.fetch": mock_mcp_servers["web"][1],
        "semantic.query": mock_mcp_servers["semantic"][0],
    }
    registry._rebuild_exposure_map()

    return registry


@pytest.fixture
def mock_ollama_client():
    """Create a mock Ollama client."""
    client = AsyncMock()
    return client


@pytest.fixture
def agent_loop(mock_ollama_client, mock_registry):
    """Create agent loop with mocked dependencies."""
    return AgentLoop(
        ollama_client=mock_ollama_client,
        registry=mock_registry,
        model="gpt-oss:20b",
    )


@pytest.mark.asyncio
async def test_agent_discovers_and_calls_web_search(agent_loop, mock_registry):
    """Test that agent can discover and call web.search tool."""
    from packages.llm.ollama import StreamChunk

    # Mock Ollama response with tool call
    async def mock_stream(*args, **kwargs):
        # Verify tools are passed to LLM
        assert kwargs.get("tools") is not None
        tools = kwargs["tools"]
        tool_names = [t["function"]["name"] for t in tools]
        assert "web_search" in tool_names  # Exposed name
        assert "web_fetch" in tool_names
        assert "semantic_query" in tool_names

        # Simulate LLM deciding to call web_search
        yield StreamChunk(
            content="Let me search for that",
            tool_calls=[
                ToolCall(
                    id="call_1",
                    name="web_search",  # LLM uses exposed name
                    arguments={"query": "Python tutorials", "top_k": 3},
                )
            ],
            done=True,
        )

    agent_loop.ollama_client.chat_stream = mock_stream

    # Mock tool execution result
    mock_registry.clients["web"].call_tool.return_value = {
        "results": [
            {"title": "Learn Python", "url": "https://python.org", "snippet": "..."}
        ]
    }

    messages = [ChatMessage(role="user", content="Find Python tutorials")]

    # Execute one turn
    result = None
    async for event in agent_loop.run_turn_stepper(messages):
        if event["type"] == "complete":
            result = event["result"]

    # Verify agent emitted tool call
    assert result.requires_followup is True
    assert result.tool_calls is not None
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "web_search"
    assert result.tool_calls[0].arguments["query"] == "Python tutorials"

    # Execute the tool call
    tool_result = await agent_loop.execute_tool_call(result.tool_calls[0])

    # Verify registry was called with correct qualified name
    mock_registry.clients["web"].call_tool.assert_awaited_once_with(
        "web.search",  # Qualified name passed to server
        {"query": "Python tutorials", "top_k": 3},
    )

    # Verify tool result is valid JSON
    result_data = json.loads(tool_result)
    assert "results" in result_data


@pytest.mark.asyncio
async def test_agent_full_conversation_with_tools(agent_loop, mock_registry):
    """Test complete conversation flow with multiple tool calls."""
    from packages.llm.ollama import StreamChunk

    call_count = 0

    async def mock_stream(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count == 1:
            # First turn: call search tool
            yield StreamChunk(
                content="",
                tool_calls=[
                    ToolCall(
                        id="call_1",
                        name="web_search",
                        arguments={"query": "FastAPI MCP servers"},
                    )
                ],
                done=True,
            )
        elif call_count == 2:
            # Second turn: call fetch tool
            yield StreamChunk(
                content="",
                tool_calls=[
                    ToolCall(
                        id="call_2",
                        name="web_fetch",
                        arguments={"url": "https://fastapi.tiangolo.com"},
                    )
                ],
                done=True,
            )
        else:
            # Final turn: provide answer
            yield StreamChunk(
                content="Based on the search and fetched content, here's what I found...",
                done=True,
            )

    agent_loop.ollama_client.chat_stream = mock_stream

    # Mock tool results
    async def mock_call_tool(tool_name, arguments):
        if "search" in tool_name:
            return {"results": [{"title": "FastAPI", "url": "https://fastapi.tiangolo.com"}]}
        elif "fetch" in tool_name:
            return {"title": "FastAPI", "text": "FastAPI is a modern web framework..."}
        return {}

    mock_registry.clients["web"].call_tool.side_effect = mock_call_tool

    messages = [ChatMessage(role="user", content="Tell me about FastAPI MCP servers")]

    # Run full conversation
    final_text = ""
    tool_calls_executed = 0
    async for event in agent_loop.run_until_completion(messages, max_iterations=5):
        if event.get("event") == "token":
            final_text += event.get("data", {}).get("text", "")
        elif event.get("event") == "tool":
            if event.get("data", {}).get("status") == "end":
                tool_calls_executed += 1

    # Verify: 2 tool calls executed, final answer generated
    assert tool_calls_executed == 2
    assert "found" in final_text.lower()
    assert mock_registry.clients["web"].call_tool.await_count == 2


@pytest.mark.asyncio
async def test_agent_handles_tool_error_gracefully(agent_loop, mock_registry):
    """Test that agent handles tool execution errors properly."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        yield StreamChunk(
            content="",
            tool_calls=[
                ToolCall(
                    id="call_1",
                    name="web_search",
                    arguments={"query": "test"},
                )
            ],
            done=True,
        )

    agent_loop.ollama_client.chat_stream = mock_stream

    # Mock tool execution raising an error
    mock_registry.clients["web"].call_tool.side_effect = Exception("Connection timeout")

    messages = [ChatMessage(role="user", content="Search for test")]

    # Execute turn
    result = None
    async for event in agent_loop.run_turn_stepper(messages):
        if event["type"] == "complete":
            result = event["result"]

    # Execute tool call (should handle error)
    tool_result = await agent_loop.execute_tool_call(result.tool_calls[0])

    # Verify error is returned as JSON
    result_data = json.loads(tool_result)
    assert "error" in result_data
    assert "Connection timeout" in result_data["error"]


@pytest.mark.asyncio
async def test_registry_routes_to_correct_server(mock_registry):
    """Test that registry routes tool calls to the correct MCP server."""
    # Call web tool
    await mock_registry.call_tool("web_search", {"query": "test"})
    mock_registry.clients["web"].call_tool.assert_awaited_once()
    mock_registry.clients["semantic"].call_tool.assert_not_awaited()

    # Reset mocks
    mock_registry.clients["web"].call_tool.reset_mock()
    mock_registry.clients["semantic"].call_tool.reset_mock()

    # Call semantic tool
    await mock_registry.call_tool("semantic_query", {"query": "test"})
    mock_registry.clients["semantic"].call_tool.assert_awaited_once()
    mock_registry.clients["web"].call_tool.assert_not_awaited()


@pytest.mark.asyncio
async def test_registry_tool_name_mapping(mock_registry):
    """Test that exposed names correctly map to qualified names."""
    # Get LLM tools
    llm_tools = mock_registry.to_llm_tools()
    tool_names = [t["function"]["name"] for t in llm_tools]

    # Verify sanitized names (dots replaced with underscores)
    assert "web_search" in tool_names
    assert "web_fetch" in tool_names
    assert "semantic_query" in tool_names

    # Verify calling with exposed name works
    await mock_registry.call_tool("web_search", {"query": "test"})

    # Verify the underlying client was called with qualified name
    mock_registry.clients["web"].call_tool.assert_awaited_with(
        "web.search", {"query": "test"}
    )


@pytest.mark.asyncio
async def test_unhealthy_server_tools_excluded(mock_registry):
    """Test that tools from unhealthy servers are excluded from LLM schema."""
    # Mark web server as unhealthy
    mock_registry.clients["web"].is_healthy = False

    # Get LLM tools
    llm_tools = mock_registry.to_llm_tools()
    tool_names = [t["function"]["name"] for t in llm_tools]

    # Verify web tools are excluded
    assert "web_search" not in tool_names
    assert "web_fetch" not in tool_names

    # Verify semantic tools are still present
    assert "semantic_query" in tool_names

    # Mark web server as healthy again
    mock_registry.clients["web"].is_healthy = True
    llm_tools = mock_registry.to_llm_tools()
    tool_names = [t["function"]["name"] for t in llm_tools]

    # Verify web tools are now included
    assert "web_search" in tool_names


@pytest.mark.asyncio
async def test_agent_enforces_single_tool_per_turn(agent_loop):
    """Test that agent enforces single-tool stepper even if LLM returns multiple."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        # LLM violates single-tool rule by returning 3 tool calls
        yield StreamChunk(
            content="",
            tool_calls=[
                ToolCall(id="call_1", name="web_search", arguments={"query": "a"}),
                ToolCall(id="call_2", name="web_fetch", arguments={"url": "http://x"}),
                ToolCall(id="call_3", name="semantic_query", arguments={"query": "b"}),
            ],
            done=True,
        )

    agent_loop.ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="test")]

    result = None
    async for event in agent_loop.run_turn_stepper(messages):
        if event["type"] == "complete":
            result = event["result"]

    # Verify only first tool call is kept
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].id == "call_1"
