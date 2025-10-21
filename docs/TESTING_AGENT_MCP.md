# Testing Agent + MCP Integration

This guide explains how to test that the agent correctly accesses MCP clients and makes tool calls.

## Test Levels

### 1. Unit Tests (Mock-based)
**Location**: `tests/unit/`

Test individual components in isolation:

```bash
# Run unit tests
pytest tests/unit/test_agent_loop.py -v
pytest tests/unit/test_registry_name_mapping.py -v
pytest tests/unit/test_mcp_ws_dispatcher.py -v
```

**What they test**:
- Agent enforces single-tool stepper
- Registry correctly maps tool names
- Client handles out-of-order WebSocket responses

---

### 2. Integration Tests (Mock MCP servers)
**Location**: `tests/integration/test_agent_mcp_integration.py`

Test the full agent → registry → client flow with mocked servers:

```bash
# Run integration tests
pytest tests/integration/test_agent_mcp_integration.py -v
```

**What they test**:
- Agent discovers tools from registry
- Agent calls tools with correct arguments
- Registry routes calls to correct server
- Exposed names map to qualified names
- Error handling for invalid tool calls
- Multi-turn conversations with tools
- Unhealthy servers excluded from tool list

**Example test**:
```python
@pytest.mark.asyncio
async def test_agent_discovers_and_calls_web_search(agent_loop, mock_registry):
    """Test that agent can discover and call web.search tool."""
    # Mock Ollama to return a tool call
    # Execute agent turn
    # Verify tool was called with correct arguments
```

---

### 3. Manual End-to-End Tests (Real servers)
**Location**: `scripts/test_mcp_agent.py`

Test with **real MCP servers running**:

```bash
# Terminal 1: Start MCP servers
make run-mcp-web

# Terminal 2
make run-mcp-semantic

# Terminal 3
make run-mcp-datetime

# Terminal 4: Run test script
python scripts/test_mcp_agent.py
```

**What it tests**:
1. Basic client connection and tool discovery
2. Tool execution with real servers
3. Registry discovers tools from multiple servers
4. Registry routes tool calls to correct server
5. Agent integration (simulated tool calls)
6. Error handling for invalid inputs

**Expected output**:
```
==================================================
TEST SUMMARY
==================================================
✓ PASS: basic_connection
✓ PASS: tool_execution
✓ PASS: registry_discovery
✓ PASS: registry_routing
✓ PASS: agent_integration
✓ PASS: error_handling

Total: 6/6 tests passed

🎉 All tests passed!
```

---

### 4. API-Level Tests (Full stack)

Test via the HTTP API endpoint:

#### Option A: Using curl

```bash
# Terminal 1: Start all services
make run-api

# Terminal 2: Send chat request
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Search the web for Python tutorials"}
    ],
    "enable_tools": true,
    "stream": true
  }'
```

**Expected response** (SSE stream):
```
event: token
data: {"text": "Let me search for that..."}

event: tool
data: {"tool": "web_search", "status": "start", "args": {"query": "Python tutorials"}}

event: tool
data: {"tool": "web_search", "status": "end", "latency_ms": 1234}

event: token
data: {"text": "I found several Python tutorials..."}

event: done
data: {"metadata": {"iterations": 2, "tool_calls": 1, "status": "success"}}
```

#### Option B: Using Python script

```python
import httpx
import asyncio

async def test_chat_with_tools():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8001/v1/chat",
            json={
                "messages": [
                    {"role": "user", "content": "What time is it in Tokyo?"}
                ],
                "enable_tools": True,
                "stream": False,  # Non-streaming for simplicity
            },
        )

        result = response.json()
        print(f"Response: {result['content']}")

asyncio.run(test_chat_with_tools())
```

#### Option C: Using the frontend

1. Start all services: `make run-all`
2. Open browser: `http://localhost:8000`
3. Enable tools in UI
4. Send message: "Search for MCP protocol documentation"
5. Watch tool events panel (right side) for tool execution

**What to verify**:
- Tool events appear in right panel
- Tool status changes: running → success
- Latency is displayed
- Final answer incorporates tool results

---

## Debugging Tool Calls

### Enable Debug Logging

```bash
# Set log level in .env
LOG_LEVEL=DEBUG

# Or export before running
export LOG_LEVEL=DEBUG
make run-api
```

**Look for these log messages**:

```
INFO - Connecting to MCP server web at ws://localhost:7001/mcp
INFO - Discovered 2 tools from web
INFO - Registry now has 6 tools from 3 servers (exposed: 6)
INFO - Starting agent turn with 3 messages, tools_enabled=True
INFO - Agent emitted 1 tool call(s)
INFO - Calling tool web_search on server web
INFO - Tool completed, continuing to iteration 2
INFO - Agent completed after 3 iterations
```

### Common Issues & Solutions

#### Issue: "Tool not found: web_search"

**Cause**: Tool name mapping issue or server not connected

**Debug**:
```python
# Check registry state
print(f"Tools: {list(registry.tools.keys())}")
print(f"Exposed: {registry._qualified_to_exposed}")
print(f"Clients: {list(registry.clients.keys())}")
```

**Solution**: Verify server ID matches and registry refresh completed

---

#### Issue: "MCP server web is unhealthy"

**Cause**: Server not running or connection failed

**Debug**:
```bash
# Check server is running
curl http://localhost:7001/health

# Check WebSocket connection
python -c "
import asyncio
from packages.mcp import MCPClient

async def test():
    client = MCPClient('http://localhost:7001', 'web')
    tools = await client.list_tools()
    print(f'Found {len(tools)} tools')
    await client.close()

asyncio.run(test())
"
```

**Solution**: Start MCP server or check URL configuration

---

#### Issue: Tool called but returns error

**Cause**: Invalid arguments or server-side validation

**Debug**:
```python
# Check tool schema
tool = registry.tools.get("web.search")
print(f"Schema: {tool.input_schema}")

# Test tool directly
result = await registry.call_tool("web_search", {
    "query": "test",
    "top_k": 5
})
print(f"Result: {result}")
```

**Solution**: Match argument types to schema (string, integer, etc.)

---

## Verifying Correct Behavior

### ✅ Tool Discovery Checklist

- [ ] Registry connects to all configured servers
- [ ] Tools are discovered from each server
- [ ] Tool names are qualified with server ID (e.g., `web.search`)
- [ ] Exposed names are sanitized (dots → underscores: `web_search`)
- [ ] Collision handling works (duplicate names get `_2`, `_3` suffixes)
- [ ] Unhealthy servers' tools are excluded

### ✅ Tool Calling Checklist

- [ ] Agent receives tool schemas in correct format
- [ ] Agent can call tools using exposed names
- [ ] Registry translates exposed → qualified names
- [ ] Client strips server prefix before sending to server
- [ ] Server receives correct tool name and arguments
- [ ] Tool result is returned as JSON
- [ ] Agent receives tool result in next turn

### ✅ Error Handling Checklist

- [ ] Invalid tool name raises `ValueError`
- [ ] Tool execution errors return `{"error": "message"}`
- [ ] Connection failures trigger retry with backoff
- [ ] Unhealthy servers don't break the system
- [ ] Agent can continue after tool errors

---

## Test Data

### Sample Tool Calls

**Web search**:
```json
{
  "name": "web_search",
  "arguments": {
    "query": "FastAPI MCP servers",
    "top_k": 5,
    "site": "github.com"
  }
}
```

**Web fetch**:
```json
{
  "name": "web_fetch",
  "arguments": {
    "url": "https://fastapi.tiangolo.com",
    "max_links": 10
  }
}
```

**Semantic query**:
```json
{
  "name": "semantic_query",
  "arguments": {
    "query": "machine learning tutorials",
    "top_k": 5,
    "tags": ["python", "ml"]
  }
}
```

**Datetime now**:
```json
{
  "name": "datetime_now",
  "arguments": {
    "tz": "America/New_York"
  }
}
```

---

## Performance Testing

### Measure Tool Call Latency

```python
import time
from packages.agent import MCPRegistry

async def benchmark_tool_call():
    registry = MCPRegistry([{"server_id": "web", "url": "http://localhost:7001"}])
    await registry.connect_all()

    # Warmup
    await registry.call_tool("web_search", {"query": "warmup", "top_k": 1})

    # Benchmark
    iterations = 10
    start = time.perf_counter()

    for _ in range(iterations):
        await registry.call_tool("web_search", {"query": "test", "top_k": 3})

    duration = time.perf_counter() - start
    avg_latency = (duration / iterations) * 1000

    print(f"Average latency: {avg_latency:.2f}ms per call")

    await registry.close_all()
```

**Expected performance**:
- Local WebSocket call: 10-50ms
- Web search (network): 500-2000ms
- Semantic query (local): 50-200ms

---

## Continuous Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test Agent MCP Integration

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio

      - name: Run unit tests
        run: pytest tests/unit/ -v

      - name: Run integration tests
        run: pytest tests/integration/ -v

      - name: Start MCP servers
        run: |
          python -m apps.mcp_servers.web.server &
          python -m apps.mcp_servers.semantic.server &
          python -m apps.mcp_servers.datetime.server &
          sleep 5

      - name: Run end-to-end tests
        run: python scripts/test_mcp_agent.py
```

---

## Quick Reference

| Test Type | Command | Duration | Prerequisites |
|-----------|---------|----------|---------------|
| Unit | `pytest tests/unit/ -v` | ~5s | None |
| Integration | `pytest tests/integration/ -v` | ~10s | None |
| E2E | `python scripts/test_mcp_agent.py` | ~30s | MCP servers running |
| API | `curl http://localhost:8001/v1/chat` | ~5s | API + MCP servers running |
| Frontend | Open `http://localhost:8000` | Manual | All services running |

---

## Next Steps

After verifying agent-MCP integration:

1. **Add custom MCP servers**: Create new tools for your use case
2. **Monitor in production**: Track tool call latency and error rates
3. **Optimize caching**: Cache frequent tool results
4. **Add rate limiting**: Prevent abuse of expensive tools
5. **Implement observability**: Add tracing for tool execution flow
