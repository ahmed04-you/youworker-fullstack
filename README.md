# YouWorker.AI

YouWorker.AI is an advanced AI-powered worker platform that integrates multiple AI models, vector stores, and MCP servers for intelligent document ingestion, chat, and analytics.

## Quick Start

1. Copy `.env.example` to `.env` and populate with your secrets.
2. Run `make build` to build Docker images.
3. Run `make compose-up` to start all services.
4. Access the frontend at `https://localhost:8000`.
5. API docs at `https://localhost:8001/docs`.

## Architecture

- **API**: FastAPI backend for chat, ingestion, and analytics.
- **Frontend**: Next.js React application.
- **MCP Servers**: Modular tools for web, semantic search, datetime, ingestion, and units.
- **Storage**: PostgreSQL for metadata, Qdrant for vector embeddings.
- **LLM**: Ollama with GPU acceleration.
- **Monitoring**: Grafana + Prometheus.

## Development

- Run `make dev-api` for local API development.
- Run `make dev-frontend` for local frontend.
- Tests: `make test`.

## Deployment

See `ops/compose/docker-compose.yml` for Docker Compose setup.
For production, generate SSL certs with `make ssl-setup` and use `make start-ssl`.

## License

MIT License. See LICENSE for details.