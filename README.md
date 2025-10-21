# YouWorker AI Agent Full-Stack

Production-ready full-stack AI agent system with:
- **Next.js 15 Frontend** - Modern React UI with SSE streaming chat
- **Ollama-powered reasoning** (gpt-oss:20b) with thinking traces
- **Dynamic MCP tool discovery** - no hard-coded tools
- **Strict single-tool stepper** - agent emits ONE tool call at a time
- **Three baseline capabilities**: web search/fetch, semantic search, datetime utilities
- **Fully Dockerized** with GPU/CPU support

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 15)                       │
│  SSE Streaming Chat │ Tool Events │ Document Upload          │
│           http://localhost:8000                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    API (FastAPI)                             │
│  POST /v1/chat     │  POST /v1/ingest     │  GET /health     │
│  SSE Streaming     │  Document ingestion                      │
│           http://localhost:8001                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    Agent Loop          │
              │  - Single-tool stepper │
              │  - Thinking (silent)   │
              │  - Tool orchestration  │
              └────────┬───────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ▼           ▼           ▼
      ┌────────┐  ┌─────────┐  ┌────────┐
      │  MCP   │  │  MCP    │  │  MCP   │
      │  Web   │  │ Semantic│  │Datetime│
      │        │  │         │  │        │
      │ search │  │ vector  │  │  now   │
      │ fetch  │  │ query   │  │ format │
      └────────┘  └───┬─────┘  └────────┘
                      │
                      ▼
              ┌──────────────┐      ┌───────────┐
              │   Qdrant     │      │   Ollama  │
              │ Vector Store │      │gpt-oss 20b│
              └──────────────┘      └───────────┘
```

## Key Features

### 1. Single-Tool Stepper Pattern (CRITICAL)

The agent **MUST** emit at most ONE tool call per assistant message:

```
User: "Search for AI agents and tell me the time"

Turn 1:
  Agent → [thinking] → Call web.search("AI agents")
  [STOP - wait for tool result]

Turn 2 (after tool result):
  Agent → [thinking] → Call datetime.now()
  [STOP - wait for tool result]

Turn 3 (after tool result):
  Agent → Final answer with both results
```

**Enforcement:**
- If model emits >1 tool call, only the first is used
- A corrective system message is added on the next turn
- Agent loop automatically handles tool execution and continuation

### 2. Silent Thinking Traces

- Ollama's `think: "low"` parameter enables reasoning traces
- `message.thinking` is captured but NEVER streamed to clients
- Only final `message.content` is streamed
- Thinking is logged for debugging in development

### 3. Dynamic MCP Tool Discovery

**No hard-coded tools** - all tools discovered at runtime:

1. Registry connects to MCP servers on startup
2. Calls `tools/list` on each server
3. Builds tool registry with namespacing (e.g., `web.search`, `datetime.now`)
4. Converts to LLM schema format
5. Subscribes to `tools/list_changed` for dynamic updates

### 4. Baseline MCP Capabilities

#### Web MCP Server (port 7001)
- `web.search(query, top_k?, site?)` - DuckDuckGo search
- `web.fetch(url, max_links?)` - Playwright-based content extraction

#### Semantic MCP Server (port 7002)
- `vector.query(query, top_k?, tags?, collection?)` - Semantic search
- `vector.collections()` - List available collections

#### Datetime MCP Server (port 7003)
- `time.now(tz?)` - Current time in timezone
- `time.format(iso, fmt, tz?)` - Format timestamp
- `time.add(iso, delta, tz?)` - Add/subtract time delta

## Quick Start

### Prerequisites

- Docker & Docker Compose
- (Optional) NVIDIA GPU with Docker runtime for GPU acceleration

### 1. Start All Services

```bash
# Start everything
make compose-up

# View logs
make compose-logs

# Check status
make status
```

Services will start in this order:
1. **Ollama** (pulls gpt-oss:20b and embeddinggemma:300m models)
2. **Qdrant** (vector database)
3. **MCP Servers** (web, semantic, datetime)
4. **API** (main FastAPI backend)
5. **Frontend** (Next.js web UI)

Access points:
- **Frontend UI**: http://localhost:8000
- **API**: http://localhost:8001

### 2. Test the Chat Endpoint

```bash
# Simple chat without tools
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false,
    "enable_tools": false
  }'

# Chat with tool calling
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What time is it in UTC?"}],
    "stream": false,
    "enable_tools": true
  }'

# Streaming chat
curl -X POST http://localhost:8001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Tell me about AI"}],
    "stream": true
  }'
```

### 3. Ingest Documents

```bash
curl -X POST http://localhost:8001/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "path_or_url": "/path/to/documents",
    "tags": ["documentation", "project"],
    "recursive": true
  }'
```

### 4. Stop Services

```bash
make compose-down
```

## Project Structure

```
.
├── apps/
│   ├── frontend/              # Next.js 15 frontend
│   │   ├── app/              # App router pages
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities & hooks
│   │   └── package.json
│   ├── api/                   # FastAPI backend
│   │   ├── main.py           # Chat & ingest endpoints
│   │   └── config.py         # Configuration
│   └── mcp_servers/          # MCP servers
│       ├── web/              # Web search/fetch
│       ├── semantic/         # Vector search
│       └── datetime/         # Time utilities
│
├── ops/
│   ├── compose/              # Deployment docker-compose files
│   └── docker/               # Service-specific Dockerfiles
│       ├── Dockerfile.api
│       ├── Dockerfile.frontend
│       ├── Dockerfile.mcp_web
│       ├── Dockerfile.mcp_semantic
│       └── Dockerfile.mcp_datetime
│
├── packages/                  # Shared backend packages
│   ├── llm/                  # Ollama client
│   │   └── ollama.py        # Streaming, thinking, tools
│   ├── mcp/                  # MCP client
│   │   └── client.py        # Tool discovery & invocation
│   ├── agent/                # Agent logic
│   │   ├── registry.py      # Tool registry
│   │   └── loop.py         # Single-tool stepper
│   ├── vectorstore/          # Qdrant wrapper
│   │   └── qdrant.py
│   └── ingestion/            # Document ingestion
│       └── pipeline.py      # Docling + embeddings
│
├── tests/
│   ├── unit/                 # Unit tests
│   └── e2e/                  # End-to-end tests
│
├── Makefile                  # Convenience targets
├── requirements/             # Service-specific dependency sets
├── requirements.txt          # Python dependencies (API + build tooling)
└── README.md                 # This file
```

## API Reference

### POST /v1/chat

Streaming chat with tool calling.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Your query"}
  ],
  "session_id": "optional-session-id",
  "stream": true,
  "enable_tools": true,
  "model": "gpt-oss:20b"
}
```

**Response (streaming):**
```
data: Hello
data: , how can I
data:  help you?
data: [DONE]
```

**Response (non-streaming):**
```json
{
  "content": "Hello, how can I help you?"
}
```

### POST /v1/ingest

Ingest documents for semantic search.

**Request:**
```json
{
  "path_or_url": "/path/to/docs",
  "from_web": false,
  "recursive": true,
  "tags": ["documentation"]
}
```

**Response:**
```json
{
  "files_processed": 10,
  "chunks_written": 150,
  "errors": null
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "mcp_servers": ["web", "semantic", "datetime"]
}
```

## Development

### Local Development (without Docker)

**Backend Development:**
```bash
# Install backend dependencies
make install

# Set up environment
make setup-env

# Start infrastructure services via Docker
docker compose -f ops/compose/docker-compose.yml up ollama qdrant mcp_web mcp_semantic mcp_datetime -d

# Run API locally (hot reload)
make dev-api

# Run MCP servers locally (optional)
make dev-mcp-web
make dev-mcp-semantic
make dev-mcp-datetime
```

**Frontend Development:**
```bash
# Install frontend dependencies
make install-frontend

# Start backend services first (or use Docker)
make compose-up

# Run frontend in development mode (hot reload)
make dev-frontend

# Frontend will be available at http://localhost:8000
```

### Running Tests

```bash
# Unit tests
pytest tests/unit/ -v

# E2E tests (requires services running)
make compose-up
pytest tests/e2e/ -v

# All tests with coverage
make test
```

### Code Quality

```bash
# Format code
make format

# Lint code
make lint
```

## Configuration

All configuration via environment variables (see [.env.example](.env.example)):

### Backend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` |
| `CHAT_MODEL` | Chat model name | `gpt-oss:20b` |
| `EMBED_MODEL` | Embedding model | `embeddinggemma:300m` |
| `QDRANT_URL` | Qdrant URL | `http://localhost:6333` |
| `MCP_SERVER_URLS` | Comma-separated MCP URLs | (see compose) |
| `LOG_LEVEL` | Logging level | `INFO` |
| `MAX_AGENT_ITERATIONS` | Max tool iterations | `10` |

### Frontend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API URL (browser) | auto-detected |
| `NEXT_PUBLIC_API_PORT` | API port | `8001` |
| `NEXT_INTERNAL_API_BASE_URL` | Internal API URL (SSR) | `http://api:8001` |

## GPU Support

To enable GPU acceleration for Ollama:

1. Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
2. The `ops/compose/docker-compose.yml` already includes GPU configuration
3. Start services normally: `make compose-up`

For CPU-only systems, the default configuration works without changes.

## Troubleshooting

### Models not pulling

```bash
# Manually pull models
make pull-models

# Or via Ollama directly
docker compose -f ops/compose/docker-compose.yml exec ollama ollama pull gpt-oss:20b
docker compose -f ops/compose/docker-compose.yml exec ollama ollama pull embeddinggemma:300m
```

### MCP servers not healthy

Check logs:
```bash
docker compose -f ops/compose/docker-compose.yml logs mcp_web
docker compose -f ops/compose/docker-compose.yml logs mcp_semantic
docker compose -f ops/compose/docker-compose.yml logs mcp_datetime
```

### Agent not calling tools

1. Check `enable_tools: true` in request
2. Verify MCP servers are healthy: `curl http://localhost:8001/health`
3. Check agent logs: `docker compose -f ops/compose/docker-compose.yml logs api`

### Frontend not connecting to API

1. Check API is running: `curl http://localhost:8001/health`
2. Check frontend logs: `make frontend-logs`
3. Verify environment variables are set correctly
4. If running locally, ensure `NEXT_PUBLIC_API_BASE_URL` points to correct API URL

## Extending the System

### Adding New MCP Servers

1. Create new server in `apps/mcp_servers/new_server/`
2. Implement `/tools/list` and `/tools/call` endpoints
3. Add Dockerfile under `ops/docker/`
4. Add to `ops/compose/docker-compose.yml`
5. Update `MCP_SERVER_URLS` environment variable

### Adding New Tools to Existing Servers

Just implement the tool in the MCP server - the registry will discover it automatically on the next `tools/list` call.

## Production Deployment

### Using Nginx Reverse Proxy

For production deployments, use the included nginx reverse proxy to consolidate frontend and API behind a single domain:

```bash
# Start with production compose override
docker compose -f ops/compose/docker-compose.yml -f docker-compose.prod.yml up -d

# This will:
# - Start nginx on port 80 (and 443 if SSL configured)
# - Proxy / to frontend
# - Proxy /v1/* and /health to API
# - Not expose individual frontend/API ports externally
```

Access everything at: **http://localhost**

### SSL/HTTPS Setup

To enable HTTPS, add SSL certificates to the nginx configuration:

1. Place certificates in `nginx/certs/`
2. Update `nginx/nginx.conf` to listen on port 443
3. Add SSL certificate paths
4. Update docker compose.prod.yml to mount certificates

## Production Considerations

1. **Thinking Traces**: Disable or secure thinking logs in production
2. **Rate Limiting**: Add rate limiting to API endpoints
3. **Authentication**: Add auth middleware to API
4. **Model Selection**: Consider using smaller models for faster responses
5. **Monitoring**: Add metrics collection (Prometheus, Grafana)
6. **Secrets**: Use proper secrets management (not .env in production)
7. **Scaling**: Use Kubernetes for horizontal scaling

## License

MIT

## Contributing

Contributions welcome! Please:
1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass: `make test`
