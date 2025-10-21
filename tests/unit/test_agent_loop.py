"""
Unit tests for agent loop with single-tool stepper.
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch

from packages.llm import ChatMessage, ToolCall
from packages.agent import AgentLoop, MCPRegistry


@pytest.fixture
def mock_ollama_client():
    """Mock Ollama client."""
    client = AsyncMock()
    return client


@pytest.fixture
def mock_registry():
    """Mock MCP registry."""
    registry = Mock(spec=MCPRegistry)
    registry.to_llm_tools = Mock(return_value=[
        {
            "type": "function",
            "function": {
                "name": "test.search",
                "description": "Test search",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ])
    registry.call_tool = AsyncMock(return_value='{"result": "test"}')
    return registry


@pytest.fixture
def agent_loop(mock_ollama_client, mock_registry):
    """Create agent loop instance."""
    return AgentLoop(
        ollama_client=mock_ollama_client,
        registry=mock_registry,
        model="gpt-oss:20b",
    )


@pytest.mark.asyncio
async def test_agent_enforces_single_tool_rule(agent_loop, mock_ollama_client):
    """Test that agent enforces single-tool stepper rule."""
    from packages.llm.ollama import StreamChunk

    # Mock streaming response with multiple tool calls
    async def mock_stream(*args, **kwargs):
        # Return chunk with 2 tool calls (violation)
        yield StreamChunk(
            content="Let me call multiple tools",
            tool_calls=[
                ToolCall(id="call_1", name="test.search", arguments={"q": "test"}),
                ToolCall(id="call_2", name="test.fetch", arguments={"url": "http://example.com"}),
            ],
            done=True,
        )

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Test query")]

    result = await agent_loop.run_turn_stepper(messages)

    # Should enforce single-tool rule
    assert result.requires_followup is True
    assert result.tool_calls is not None
    assert len(result.tool_calls) == 1  # Only first tool kept
    assert result.tool_calls[0].id == "call_1"


@pytest.mark.asyncio
async def test_agent_handles_no_tool_calls(agent_loop, mock_ollama_client):
    """Test agent with no tool calls (direct answer)."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        yield StreamChunk(content="Here is ", done=False)
        yield StreamChunk(content="the answer", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Test query")]

    result = await agent_loop.run_turn_stepper(messages)

    # Should return final content without tool calls
    assert result.requires_followup is False
    assert result.tool_calls is None
    assert "Here is the answer" in result.content


@pytest.mark.asyncio
async def test_agent_executes_tool_call(agent_loop):
    """Test tool execution."""
    tool_call = ToolCall(
        id="call_1",
        name="test.search",
        arguments={"query": "test"},
    )

    result = await agent_loop.execute_tool_call(tool_call)

    # Should return tool result
    assert "result" in result or "test" in result
