# Architecture Documentation

## System Overview

The YouWorker AI Agent Backend is a production-ready system that implements an AI agent with dynamic tool discovery and strict execution semantics. The architecture is designed for:

1. **Reliability**: All tool calls are validated, retried, and health-checked
2. **Extensibility**: Tools are discovered dynamically via MCP (Model Context Protocol)
3. **Correctness**: Single-tool stepper pattern ensures predictable execution
4. **Observability**: Thinking traces, comprehensive logging, health checks

## Core Components

### 1. Agent Loop (`packages/agent/loop.py`)

The agent loop implements the **strict single-tool stepper** pattern:

```python
async def run_turn_stepper(messages, enable_tools) -> AgentTurnResult:
    # 1. Stream chat completion from Ollama
    # 2. Accumulate thinking (silent), content, tool_calls
    # 3. If tool_calls present:
    #    - Keep ONLY first tool call (enforce single-tool rule)
    #    - Return requires_followup=True
    # 4. If no tool_calls:
    #    - Return final content
    #    - Return requires_followup=False
```

**Key invariant**: The agent emits at most ONE tool call per turn, then stops and waits for the tool result before continuing.

#### Enforcement Mechanisms

1. **Runtime filtering**: If model emits >1 tool call, only the first is kept
2. **Corrective prompting**: A system message is injected on the next turn
3. **Agent prompt**: System prompt explicitly instructs single-tool behavior

### 2. MCP Registry (`packages/agent/registry.py`)

Manages multiple MCP servers and their tools:

```python
class MCPRegistry:
    def __init__(self, server_configs):
        self.clients: dict[str, MCPClient] = {}
        self.tools: dict[str, MCPTool] = {}  # qualified_name -> tool

    async def connect_all():
        # Connect to all servers and discover tools

    async def refresh_tools():
        # Re-discover tools from all servers

    def to_llm_tools() -> list[dict]:
        # Convert to LLM tool schema

    async def call_tool(tool_name, arguments):
        # Route and execute tool call
```

**Tool namespacing**: Each tool is prefixed with its server ID:
- `web.search` → Web MCP server
- `vector.query` → Semantic MCP server
- `time.now` → Datetime MCP server

### 3. Ollama Client (`packages/llm/ollama.py`)

Handles streaming chat completions with thinking and tool calling:

```python
async def chat_stream(messages, model, tools, think="low"):
    # Stream chat with:
    # - message.thinking (captured, not streamed to user)
    # - message.content (streamed to user)
    # - message.tool_calls (accumulated across chunks)
```

**Thinking traces**: Ollama's `think` parameter enables reasoning, but `message.thinking` is never streamed to clients—only logged internally.

### 4. MCP Client (`packages/mcp/client.py`)

Generic client using JSON-RPC 2.0 over WebSocket (`/mcp`):

```python
class MCPClient:
    async def list_tools() -> list[MCPTool]:
        # JSON-RPC: method="tools/list"

    async def call_tool(tool_name, arguments):
        # JSON-RPC: method="tools/call"

    async def health_check():
        # Convenience HTTP GET /health (optional)
```

**Retry logic**: Uses `tenacity` for automatic retries with exponential backoff.

### 5. Vector Store (`packages/vectorstore/qdrant.py`)

Qdrant wrapper for semantic search:

```python
class QdrantStore:
    async def ensure_collection(collection_name)
    async def upsert_chunks(chunks, collection_name)
    async def search(query_embedding, top_k, tags)
    async def list_collections()
```

### 6. Ingestion Pipeline (`packages/ingestion/pipeline.py`)

Document processing with Docling:

```python
class IngestionPipeline:
    async def ingest_path(path, tags, collection_name):
        # 1. Parse with Docling
        # 2. Chunk text
        # 3. Generate embeddings via Ollama
        # 4. Upsert to Qdrant
```

**Chunking strategy**: Fixed-size chunks with overlap, boundary-aware splitting.

## MCP Server Protocol

Each MCP server exposes a WebSocket endpoint at `/mcp` that speaks JSON-RPC 2.0.

### Required Methods

1. `initialize` → returns `protocolVersion`, `serverInfo`, `capabilities`
2. `tools/list` → returns `{ "tools": [...] }`
3. `tools/call` → params `{ "name", "arguments" }` → returns tool result content
4. Optional `ping`

Additionally, servers should expose `GET /health` for simple liveness checks.

### Tool Schema Format

```json
{
  "name": "search",
  "description": "Search the web",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Search query"}
    },
    "required": ["query"]
  }
}
```

### Tool Call Format

```json
{
  "name": "search",
  "arguments": {"query": "AI agents"}
}
```

### Tool Response Format

```json
{
  "content": [
    {"type": "json", "json": {"...": "structured result"}}
  ]
}
```

## Data Flow

### Chat Request (with tool calling)

```
1. Client → POST /v1/chat
   {messages: [...], enable_tools: true}

2. API → Agent Loop
   - Start turn_stepper with messages

3. Agent → Ollama
   - Stream chat with tools registry
   - Accumulate thinking/content/tool_calls

4. Ollama → Agent
   - Streams chunks with thinking/content/tool_calls

5. Agent detects tool call
   - Keep only first tool call
   - Execute via Registry

6. Registry → MCP Server
   - Route to appropriate server
   - JSON-RPC tools/call over WebSocket

7. MCP Server → Registry
   - Return tool result

8. Registry → Agent
   - Tool result as string

9. Agent → Ollama (new turn)
   - Append tool result to messages
   - Continue streaming

10. Agent detects no more tool calls
    - Stream final content to client

11. API → Client
    - SSE stream of content chunks
```

### Ingestion Request

```
1. Client → POST /v1/ingest
   {path_or_url: "...", tags: [...]}

2. API → Ingestion Pipeline
   - Parse documents with Docling

3. Pipeline → Ollama
   - Generate embeddings per chunk

4. Pipeline → Qdrant
   - Upsert chunks with metadata

5. API → Client
   - Return stats (files, chunks, errors)
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                  Docker Host                    │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Docker Compose Network                   │  │
│  │                                           │  │
│  │  ┌────────┐  ┌────────┐  ┌──────────┐     │  │
│  │  │ Ollama │  │ Qdrant │  │   API    │     │  │
│  │  │        │  │        │  │          │     │  │
│  │  │ :11434 │  │ :6333  │  │  :8001   │     │  │
│  │  └────────┘  └────────┘  └──────────┘     │  │
│  │                                           │  │
│  │  ┌────────┐  ┌─────────┐  ┌──────────┐    │  │
│  │  │  MCP   │  │   MCP   │  │   MCP    │    │  │
│  │  │  Web   │  │Semantic │  │ Datetime │    │  │
│  │  │ :7001  │  │  :7002  │  │  :7003   │    │  │
│  │  └────────┘  └─────────┘  └──────────┘    │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Volumes:                                       │
│  - ollama_data (models)                         │
│  - qdrant_data (vectors)                        │
└─────────────────────────────────────────────────┘
```

## Scaling Considerations

### Horizontal Scaling

1. **API Service**: Stateless, can scale horizontally
   - Use load balancer (nginx, Traefik)
   - Shared Ollama/Qdrant/MCP backends

2. **MCP Servers**: Stateless, can scale independently
   - Each server type can scale separately
   - Use service mesh for routing

3. **Ollama**: GPU-intensive, vertical scaling
   - Multiple GPU instances with load balancing
   - Consider hosted alternatives (Groq, Together)

4. **Qdrant**: Horizontal scaling via clustering
   - Qdrant supports distributed mode
   - Shard by collection or tenant

### Performance Optimizations

1. **Caching**:
   - Cache tool discovery results (refresh periodically)
   - Cache embeddings for common queries
   - Cache LLM responses (with caution)

2. **Batching**:
   - Batch embedding generation
   - Batch vector upserts

3. **Model Selection**:
   - Use smaller models for simple queries
   - Route by complexity (gpt-oss:20b for complex, smaller for simple)

4. **Connection Pooling**:
   - HTTP connection pools for all services
   - Database connection pools for Qdrant

## Security Considerations

1. **Authentication**: Add API key or OAuth to all endpoints
2. **Rate Limiting**: Prevent abuse of LLM/embedding endpoints
3. **Input Validation**: Validate all tool arguments against schemas
4. **Thinking Traces**: Never expose in production (contains reasoning)
5. **MCP Server Trust**: Only connect to trusted MCP servers
6. **Secrets Management**: Use vault for API keys, not environment variables

## Observability

### Logging

```python
logger.info(f"Agent turn: {len(messages)} messages")
logger.debug(f"Thinking: {thinking[:200]}...")
logger.warning(f"Multiple tool calls: {len(tool_calls)}")
logger.error(f"Tool execution failed: {e}")
```

### Metrics (to implement)

- Request rate (requests/sec)
- Tool call rate by tool
- LLM latency (p50, p95, p99)
- Tool execution latency
- Error rates by component
- Think token count

### Health Checks

All services expose `/health`:
- Ollama: Check model availability
- Qdrant: Check storage health
- MCP servers: Check dependencies (browser, etc.)
- API: Check all dependencies

## Testing Strategy

### Unit Tests

- Agent loop single-tool enforcement
- Tool registry discovery and routing
- Ollama client streaming and parsing
- Vector store search and upsert
- Ingestion chunking and embedding

### Integration Tests

- MCP client ↔ MCP server communication
- Agent ↔ Registry ↔ MCP end-to-end
- API ↔ Agent ↔ Tools full flow

### E2E Tests

- Full chat with tool calling
- Multi-turn conversations
- Document ingestion and retrieval
- Error handling and retries

## Future Enhancements

1. **Session Management**: Persistent conversation history
2. **Multi-modal**: Image, audio, video support via Docling
3. **Streaming Tools**: Support streaming tool responses
4. **Parallel Tools**: Allow multiple independent tool calls
5. **Tool Composition**: Chain tools automatically
6. **Fine-tuning**: Fine-tune model for better tool selection
7. **Evaluation**: Build test suite for agent quality metrics
