# YouWorker Full-Stack

Modern conversational assistant that pairs a Next.js frontend with a FastAPI backend, dynamic MCP tools, and an optional voice mode. This repository contains everything required to run the product locally or in Docker.

## Highlights

- **Two interaction modes**  
  - *Text*: classic chat UI with Server-Sent Events (SSE) token streaming.  
  - *Voice*: push-to-talk capture, server-side transcription (faster-whisper), agent reasoning, and optional Piper TTS playback in a single round trip.
- **Agent orchestration**  
  - Ollama-powered reasoning (`gpt-oss:20b` by default).  
  - Strict single-tool stepper guarantees one tool call per turn.  
  - Real-time tool discovery via Model Context Protocol (MCP).
- **Knowledge ingestion**  
  - Docling-based pipeline for uploading local files or URLs.  
  - Embeddings stored in Qdrant for semantic retrieval.
- **Production-ready defaults**  
  - FastAPI with typed schemas, async SQLAlchemy, Qdrant, and Ollama.  
  - Next.js 15 / React 18 client with Tailwind UI and toast notifications.  
  - Docker Compose stack with optional GPU acceleration.

## Architecture Overview

```
┌──────────────────────────────────────────┐
│ Frontend (Next.js 15)                    │
│ - Text mode (SSE)                        │
│ - Voice mode (AudioWorklet + fetch)      │
│ http://localhost:8000                    │
└──────────────────────────────┬───────────┘
                               │
┌───────────────────────────────▼──────────┐
│ API (FastAPI)                            │
│ - /v1/chat (SSE)                         │
│ - /v1/voice-turn (voice pipeline)        │
│ - /v1/ingest (document upload)           │
│ http://localhost:8001                    │
└───────────────────────────────┬──────────┘
                               │
┌───────────────────────────────▼──────────┐
│ Agent Loop                               │
│ - Ollama client                          │
│ - Single-tool stepper                    │
│ - MCP registry                           │
└───────────────┬───────────────┬──────────┘
                │               │
       ┌────────┘       ┌───────▼───────┐
       │                │  MCP Servers  │
       │                │  (web, vector,│
       │                │   datetime…)  │
       │                └───────┬───────┘
       │                        │
┌──────▼──────┐        ┌────────▼────────┐
│ Qdrant      │        │ Ollama          │
│ Vector DB   │        │ Model hosting   │
└─────────────┘        └─────────────────┘
```

## Getting Started

### Prerequisites

- Docker & Docker Compose *(recommended for quickest start)*  
- Alternatively, Python 3.11+, Node.js 20, and `npm` for bare-metal development  
- Optional GPU with NVIDIA drivers if you want accelerated Ollama / Whisper

### Run with Docker

```bash
# Build and start every service
make compose-up

# Follow logs
make compose-logs

# Stop everything
make compose-down
```

Services will start in this order:

1. **Ollama** – serves chat & embedding models.  
2. **Qdrant** – semantic vector database.  
3. **MCP servers** – web search, semantic query, datetime utilities.  
4. **API** – FastAPI backend (http://localhost:8001).  
5. **Frontend** – Next.js application (http://localhost:8000).

The default root API key is `dev-root-key`. Configure your browser client with `NEXT_PUBLIC_API_KEY` if you expose the app elsewhere.

### Local Development (without Docker)

1. **Backend**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn apps.api.main:app --reload --port 8001
   ```
   Ensure PostgreSQL, Qdrant, Ollama, and the MCP servers are reachable or adjust `apps/api/config.py`.

2. **Frontend**
   ```bash
   cd apps/frontend
   npm install
   npm run dev
   ```
   The frontend proxies API calls to `http://localhost:8001` by default.

### Essential Environment Variables

| Variable | Description | Default |
|---------|-------------|---------|
| `ROOT_API_KEY` | Required by protected API endpoints | `dev-root-key` |
| `OLLAMA_BASE_URL` | Ollama host | `http://localhost:11434` |
| `QDRANT_URL` | Qdrant host | `http://localhost:6333` |
| `DATABASE_URL` | Async SQLAlchemy URL | `postgresql+asyncpg://postgres:postgres@localhost:5432/youworker` |
| `STT_MODEL` | Whisper model to load lazily | `large-v3` |
| `TTS_VOICE` | Piper voice ID | `it_IT-paola-medium` |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend API base URL | auto-detected |
| `NEXT_PUBLIC_API_KEY` | Browser token (must match `ROOT_API_KEY`) | – |

## Voice Mode Pipeline

1. User presses and holds the microphone button.  
2. `VoiceRecorder` captures PCM16 audio via an AudioWorklet at 16 kHz.  
3. Releasing the button base64-encodes the audio and POSTs it to `/v1/voice-turn`.  
4. The API:
   - Runs lazy-loaded faster-whisper transcription.
   - Executes the agent loop (tool calls, reasoning).  
   - Optionally synthesizes a WAV clip with Piper TTS (or a sine fallback).  
5. Response returns transcript, assistant text, metadata, and optional audio clip.  
6. Frontend plays the WAV clip with a regular `Audio` element and updates the transcript.

If Whisper or Piper are unavailable, the API surfaces a clear 503 error; clients may retry or fall back to text mode.

## Testing

```bash
pytest
```

Key suites:

- `tests/unit/test_voice_turn_success.py` – end-to-end voice-turn success path (stubs heavy dependencies).  
- `tests/integration/test_chat_endpoints.py` – smoke tests for text SSE chat, voice endpoint failures, and CORS.

## Project Structure

```
apps/
  api/              FastAPI service (chat, voice, ingest)
  frontend/         Next.js client
  mcp_servers/      Auxiliary MCP servers (web, semantic, datetime, ingestion)
packages/
  agent/            Single-tool stepper + registry
  llm/              Ollama client wrapper
  mcp/              Generic MCP client over WebSocket
  ingestion/        Docling ingest pipeline
docs/               Architecture & mode reference
ops/                Dockerfiles and docker-compose stack
tests/              Pytest suites (integration + unit)
```

## Voice Mode Requirements

- Piper voice models should be downloaded into `/app/models/tts` when running under Docker (`ops/compose/docker-compose.yml` mounts `data/models`).  
- Faster-whisper loads lazily on first use; ensure the chosen model is available or override `STT_MODEL`/`STT_DEVICE`.

## Contributing

1. Fork and clone the repository.  
2. Create a virtual environment and install dependencies.  
3. Run the test suite (`pytest`) before submitting a PR.  
4. Follow the single-tool stepper rule when adding new agent capabilities.

Enjoy building with YouWorker! If you hit issues, open an issue with logs and reproduction steps.
