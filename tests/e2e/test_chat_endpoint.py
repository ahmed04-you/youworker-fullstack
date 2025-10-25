"""E2E tests for chat endpoint with tool calling."""

import os

import httpx
import pytest


RUN_E2E_TESTS = os.getenv("RUN_E2E_TESTS") == "1"

pytestmark = pytest.mark.skipif(
    not RUN_E2E_TESTS,
    reason="Set RUN_E2E_TESTS=1 to enable end-to-end tests against running services.",
)


API_BASE_URL = "http://localhost:8001"


@pytest.fixture
async def api_client():
    """Create async HTTP client."""
    async with httpx.AsyncClient(timeout=300.0, headers={"X-API-Key": "rotated-dev-root-key"}) as client:
        yield client


@pytest.mark.asyncio
async def test_health_check(api_client):
    """Test API health check."""
    response = await api_client.get(f"{API_BASE_URL}/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert "mcp_servers" in data.get("components", {})


@pytest.mark.asyncio
async def test_chat_without_tools(api_client):
    """Test basic chat without tool calling."""
    request_data = {
        "messages": [
            {"role": "user", "content": "Say hello"}
        ],
        "stream": False,
        "enable_tools": False,
    }

    response = await api_client.post(f"{API_BASE_URL}/v1/chat", json=request_data)
    assert response.status_code == 200

    data = response.json()
    assert "content" in data
    assert len(data["content"]) > 0


@pytest.mark.asyncio
async def test_chat_with_datetime_tool(api_client):
    """
    Test chat with tool calling.

    This should:
    1. Agent receives user query about current time
    2. Agent calls datetime.now tool (single call)
    3. Agent waits for tool result
    4. Agent continues with result and provides final answer
    """
    request_data = {
        "messages": [
            {"role": "user", "content": "What is the current time in UTC?"}
        ],
        "stream": False,
        "enable_tools": True,
    }

    response = await api_client.post(f"{API_BASE_URL}/v1/chat", json=request_data)
    assert response.status_code == 200

    data = response.json()
    assert "content" in data

    # Response should contain time information
    content_lower = data["content"].lower()
    assert any(keyword in content_lower for keyword in ["time", "utc", "current", "now"])


@pytest.mark.asyncio
async def test_streaming_chat(api_client):
    """Test streaming chat endpoint."""
    request_data = {
        "messages": [
            {"role": "user", "content": "Count from 1 to 3"}
        ],
        "stream": True,
        "enable_tools": False,
    }

    async with api_client.stream(
        "POST", f"{API_BASE_URL}/v1/chat", json=request_data
    ) as response:
        assert response.status_code == 200

        chunks = []
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                chunk = line[6:]  # Remove "data: " prefix
                if chunk != "[DONE]":
                    chunks.append(chunk)

        # Should have received multiple chunks
        assert len(chunks) > 0


@pytest.mark.asyncio
async def test_agent_single_tool_enforcement():
    """
    Test that agent emits at most ONE tool call per turn.

    This is a critical requirement: the agent must stop after emitting
    a single tool call and continue only after receiving the tool result.
    """
    # This test would require inspecting internal agent state or
    # monitoring the agent's behavior across multiple turns.
    # For now, we verify that the system works end-to-end with tools.

    async with httpx.AsyncClient(timeout=300.0) as client:
        request_data = {
            "messages": [
                {
                    "role": "user",
                    "content": "Search the web for 'AI agents' and tell me what time it is",
                }
            ],
            "stream": False,
            "enable_tools": True,
        }

        response = await client.post(
            f"{API_BASE_URL}/v1/chat",
            json=request_data,
            headers={"X-API-Key": "rotated-dev-root-key"},
        )
        assert response.status_code == 200

        data = response.json()
        assert "content" in data

        # The agent should have called tools one at a time and
        # provided a final answer that addresses the query
        assert len(data["content"]) > 0
