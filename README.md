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

### 1. Communication Modes (NEW)

**Text Mode** and **Voice Mode** - mutually exclusive per session:

- **Text Mode**: Traditional typing with SSE streaming
- **Voice Mode**: Speech-to-text input with text-to-speech output
- **Clean Switching**: Automatic resource cleanup when changing modes
- **Cross-browser**: No Web Speech API dependencies, consistent behavior
- **Configurable**: Environment-based STT/TTS provider selection

Switch modes using the toggle in the interface. Each session uses only one mode to ensure clean transport management.

#### Modes & Transports

- Two mutually exclusive modes: Text Mode (typing + read) and Voice Mode (talk + listen)
- Text Mode streams tokens over SSE; Voice Mode streams audio over WebSocket (STT/TTS)
- Server-side STT (faster-whisper) for cross-browser reliability (no Web Speech API)
- Global mode store: `apps/frontend/lib/mode.ts` ensures all transports close cleanly on switch
- Voice Mode auto-submits STT "final" transcripts and starts TTS only after `done`
- Barge-in: opening the mic pauses TTS via `barge_in.control`

Environment knobs (frontend awareness):
- `NEXT_PUBLIC_STT_PROVIDER` (default: `faster-whisper`)
- `NEXT_PUBLIC_STT_COMPUTE_TYPE` (default: `auto`)
- `NEXT_PUBLIC_TTS_PROVIDER` (default: `piper`)
- `NEXT_PUBLIC_TTS_VOICE` (default: `it_IT-paola-medium`)
- `NEXT_PUBLIC_AUDIO_SAMPLE_RATE` (default: `24000`)

### 2. Single-Tool Stepper Pattern (CRITICAL)

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
- `web.fetch(url, max_links?)` - HTTP-based content extraction

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
- Microphone access (for Voice Mode)
- HTTPS context (for microphone permissions in production)

### Communication Modes

YouWorker.AI supports two distinct communication modes:

- **Text Mode**: Traditional text-based chat with SSE streaming
- **Voice Mode**: Speech-to-text input with text-to-speech output

Switch between modes using the toggle in the interface. Each session uses only one mode to ensure clean transport management.

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

### Communication Mode Configuration

Configure STT/TTS providers and settings:

```bash
# STT Configuration
STT_PROVIDER=faster-whisper          # Speech-to-text provider
STT_MODEL=large-v3                   # Whisper model size
STT_DEVICE=auto                      # Device: auto, cpu, cuda
STT_COMPUTE_TYPE=float16             # Compute precision
STT_VAD_ENABLED=true                 # Voice Activity Detection
STT_BEAM_SIZE=1                      # Decoding beam size

# TTS Configuration
TTS_PROVIDER=piper                   # Text-to-speech provider
TTS_VOICE=it_IT-paola-medium         # Voice model
TTS_MODEL_DIR=/app/models/tts        # Model directory

# Audio Processing
AUDIO_SAMPLE_RATE=24000              # Sample rate in Hz
AUDIO_FRAME_MS=20                    # Frame size in milliseconds
```

All configuration via environment variables (see [.env.example](.env.example)):

### Backend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OLLAMA_BASE_URL` | Ollama API URL | `http://localhost:11434` |
| `CHAT_MODEL` | Chat model name | `gpt-oss:20b` |
| `EMBED_MODEL` | Embedding model | `embeddinggemma:300m` |
| `QDRANT_URL` | Qdrant URL | `http://localhost:6333` |
| `MCP_SERVER_URLS` | Comma-separated MCP URLs | (see compose) |
| `MCP_REFRESH_INTERVAL` | Seconds between MCP tool refreshes (0 to disable) | `90` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `MAX_AGENT_ITERATIONS` | Max tool iterations | `10` |
| `ROOT_API_KEY` | Root API key required by protected endpoints | `dev-root-key` |

### Frontend Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Public API URL (browser) | auto-detected |
| `NEXT_PUBLIC_API_PORT` | API port | `8001` |
| `NEXT_INTERNAL_API_BASE_URL` | Internal API URL (SSR) | `http://api:8001` |
| `NEXT_PUBLIC_API_KEY` | API key sent as `X-API-Key` header | — |
| `NEXT_PUBLIC_STT_PROVIDER` | Speech-to-text provider | `faster-whisper` |
| `NEXT_PUBLIC_TTS_PROVIDER` | Text-to-speech provider | `piper` |
| `NEXT_PUBLIC_TTS_VOICE` | TTS voice model | `it_IT-paola-medium` |

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
docker compose -f ops/compose/docker-compose.yml logs mcp_audio  # Audio STT/TTS
```

### Agent not calling tools

1. Check `enable_tools: true` in request
2. Verify MCP servers are healthy: `curl http://localhost:8001/health`
3. Check agent logs: `docker compose -f ops/compose/docker-compose.yml logs api`

### Frontend not connecting to API

1. Check API is running: `curl http://localhost:8001/health`
2. Check frontend logs: `make frontend-logs`
3. Verify environment variables:
   - Set `NEXT_PUBLIC_API_KEY` to match backend `ROOT_API_KEY` (default `dev-root-key`).
   - If running Next.js dev on port 3000, set backend `FRONTEND_ORIGIN=http://localhost:3000` (comma‑separate if multiple origins).
   - Optionally set `NEXT_PUBLIC_API_BASE_URL` if auto-detect does not match your API host/protocol.
4. If running locally, ensure the API URL/port are correct (`http://localhost:8001` by default) and that the browser is not blocking mixed content (HTTPS page calling HTTP API).

## Extending the System

### MCP Protocol

MCP servers communicate via JSON-RPC 2.0 over WebSocket at `/mcp`.

- Handshake: `initialize` → returns `protocolVersion`, `serverInfo`, `capabilities`
- Discovery: `tools/list` → returns `{"tools": [...]}`
- Invocation: `tools/call` → `{"name", "arguments"}` → returns `{"content": [{"type": "json", "json": <result>}]}`
- Health: keep using `GET /health` for simple checks; a `ping` JSON-RPC method is also supported.

Deprecation: Legacy HTTP tool routes (`POST /tools/list`, `POST /tools/call`) are deprecated and will be removed in a future release. Use the WebSocket endpoint instead.

### Adding New MCP Servers

1. Create new server in `apps/mcp_servers/new_server/`
2. Implement a WebSocket endpoint at `/mcp` that handles JSON-RPC methods:
   - `initialize`
   - `tools/list`
   - `tools/call`
3. Add Dockerfile under `ops/docker/`
4. Add to `ops/compose/docker-compose.yml`
5. Update `MCP_SERVER_URLS` environment variable (http:// or ws:// are both accepted; the client normalizes to `ws(s)://.../mcp`)

### Audio MCP Server

The audio server (port 7006) provides STT/TTS capabilities:

- **STT**: Speech-to-text with faster-whisper and VAD
- **TTS**: Text-to-speech with Piper TTS
- **Streaming**: Real-time audio at 24kHz PCM16
- **Barge-in**: Voice interruption support

Configure via environment variables (see Configuration section above).

### Adding New Tools to Existing Servers

Add the tool to the server's tool schema, and handle it in the `tools/call` JSON-RPC method. The registry will discover it automatically on the next `tools/list` call.

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
