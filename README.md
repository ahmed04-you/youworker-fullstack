# YouWorker.AI v0.1.0-alpha

**AI conversational assistant with voice/text interaction, semantic search, and extensible tool integration.**

> **Note**: This project is in active development (alpha). The first stable release is not yet available.

Full-stack application combining modern web technologies with local AI models for a powerful, privacy-focused conversational experience. Built with Next.js, FastAPI, and Model Context Protocol (MCP).

## Features

- **Text & Voice Interaction**: Real-time streaming with SSE, push-to-talk voice input
- **AI Agent**: Local Ollama models, dynamic MCP tool discovery, streaming responses
- **Knowledge Management**: Document ingestion (PDF, text, web), semantic search via Qdrant
- **Extensible Tools**: Web search, semantic queries, datetime operations, unit conversions, custom MCP tools
- **Modern UI**: Next.js 15 + Tailwind CSS, responsive design


## Quick Start

**Prerequisites**: Docker, Docker Compose (NVIDIA GPU optional for acceleration)

```bash
# Clone and configure
git clone <repo-url>
cd youworker-fullstack
cp .env.example .env

# Download TTS models (for voice mode)
./scripts/download-piper-models.sh

# Start all services
make compose-up
```

**Access**:
- Frontend: http://localhost:8000
- API: http://localhost:8001/docs
- Grafana: http://localhost:3001 (admin/admin)

**First startup takes 5-10 minutes** while Ollama downloads required models.

## Local Development

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn apps.api.main:app --reload --port 8001

# Frontend
cd apps/frontend && npm install && npm run dev

# Tests
pytest --cov=apps --cov=packages
```


## Project Structure

```
apps/          # FastAPI backend, Next.js frontend, MCP servers
packages/      # Agent orchestration, LLM client, ingestion, vectorstore, DB
ops/           # Docker configs, compose files, scripts
tests/         # Unit, integration, e2e tests
```

## Security

- API key authentication on all endpoints
- Rate limiting on sensitive endpoints
- Pydantic validation, CORS whitelist
- Parameterized SQL queries, path traversal protection
- Environment-based secret management

---

**Built with Ollama, Piper TTS, Faster Whisper, MCP, Qdrant, Next.js, FastAPI**
