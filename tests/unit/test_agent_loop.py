"""
Unit tests for agent loop with single-tool stepper.
"""
import pytest
from unittest.mock import Mock, AsyncMock

from packages.llm import ChatMessage, ToolCall
from packages.agent import AgentLoop, MCPRegistry, ToolCallViolationError


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
        default_language="it",
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

    # Expect the raise for multiple tool calls
    with pytest.raises(ToolCallViolationError):
        async for event in agent_loop.run_turn_stepper(messages, language="it"):
            pass


@pytest.mark.asyncio
async def test_agent_handles_no_tool_calls(agent_loop, mock_ollama_client):
    """Test agent with no tool calls (direct answer)."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        yield StreamChunk(content="Here is ", done=False)
        yield StreamChunk(content="the answer", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Test query")]

    # Consume streaming generator and capture final result
    result = None
    async for event in agent_loop.run_turn_stepper(messages, language="it"):
        if event["type"] == "complete":
            result = event["result"]

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


@pytest.mark.asyncio
async def test_agent_run_until_completion_without_tools(agent_loop, mock_ollama_client):
    """Test full agent loop without tool calls."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        yield StreamChunk(content="Simple ", done=False)
        yield StreamChunk(content="answer", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="What is 2+2?")]
    events = []

    async for event in agent_loop.run_until_completion(messages, enable_tools=False, language="it"):
        events.append(event)

    # Should have token events and done event
    token_events = [e for e in events if e.get("event") == "token"]
    done_events = [e for e in events if e.get("event") == "done"]

    assert len(token_events) >= 1
    assert len(done_events) == 1
    assert done_events[0]["data"]["metadata"]["status"] == "success"
    assert "Simple answer" in done_events[0]["data"]["final_text"]


@pytest.mark.asyncio
async def test_agent_max_iterations_limit(agent_loop, mock_ollama_client, mock_registry):
    """Test that agent stops after max iterations."""
    from packages.llm.ollama import StreamChunk

    # Always return a tool call to create infinite loop
    async def mock_stream(*args, **kwargs):
        yield StreamChunk(
            content="Calling tool",
            tool_calls=[ToolCall(id="call_1", name="test.search", arguments={})],
            done=True,
        )

    mock_ollama_client.chat_stream = mock_stream
    mock_registry.call_tool = AsyncMock(return_value='{"continue": true}')

    messages = [ChatMessage(role="user", content="Loop forever")]
    events = []

    async for event in agent_loop.run_until_completion(messages, enable_tools=True, max_iterations=3):
        events.append(event)

    done_events = [e for e in events if e.get("event") == "done"]
    assert len(done_events) == 1
    assert done_events[0]["data"]["metadata"]["status"] == "max_iterations"
    assert done_events[0]["data"]["metadata"]["iterations"] == 3


@pytest.mark.asyncio
async def test_agent_tool_error_handling(agent_loop, mock_registry):
    """Test that tool errors are handled gracefully."""
    mock_registry.call_tool = AsyncMock(side_effect=Exception("Tool failed"))

    tool_call = ToolCall(id="call_1", name="test.search", arguments={"query": "fail"})
    result = await agent_loop.execute_tool_call(tool_call)

    # Should return error message as JSON
    assert "error" in result
    assert "Tool execution failed" in result or "Tool failed" in result


@pytest.mark.asyncio
async def test_agent_system_prompt_injection(agent_loop, mock_ollama_client):
    """Test that system prompt is automatically added."""
    from packages.llm.ollama import StreamChunk
    from packages.agent.loop import resolve_system_prompt

    captured_messages = []

    async def mock_stream(*args, **kwargs):
        captured_messages.append(kwargs.get("messages", []))
        yield StreamChunk(content="Response", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Test")]
    async for _ in agent_loop.run_turn_stepper(messages, language="it"):
        pass

    # System prompt should be first message
    assert len(captured_messages) > 0
    assert captured_messages[0][0].role == "system"
    assert captured_messages[0][0].content == resolve_system_prompt("it")


@pytest.mark.asyncio
async def test_agent_respects_requested_language(agent_loop, mock_ollama_client):
    """Agent should switch system prompt when a different language is requested."""
    from packages.llm.ollama import StreamChunk
    from packages.agent.loop import resolve_system_prompt

    captured_messages = []

    async def mock_stream(*args, **kwargs):
        captured_messages.append(kwargs.get("messages", []))
        yield StreamChunk(content="Response", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Hi there")]
    async for _ in agent_loop.run_turn_stepper(messages, language="en"):
        pass

    assert len(captured_messages) > 0
    assert captured_messages[0][0].content == resolve_system_prompt("en")


@pytest.mark.asyncio
async def test_agent_streaming_chunks(agent_loop, mock_ollama_client):
    """Test that content is streamed in real-time."""
    from packages.llm.ollama import StreamChunk

    async def mock_stream(*args, **kwargs):
        yield StreamChunk(content="Chunk ", done=False)
        yield StreamChunk(content="by ", done=False)
        yield StreamChunk(content="chunk", done=True)

    mock_ollama_client.chat_stream = mock_stream

    messages = [ChatMessage(role="user", content="Stream me")]
    chunks = []

    async for event in agent_loop.run_turn_stepper(messages):
        if event["type"] == "chunk":
            chunks.append(event["content"])

    assert chunks == ["Chunk ", "by ", "chunk"]
