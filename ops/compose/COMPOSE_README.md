# Docker Compose Configuration

The Docker Compose configuration is split into modular files for better organization and flexibility.

## File Structure

```
ops/compose/
├── docker compose.core.yml      # Core application (API, Frontend, Database, Nginx)
├── docker compose.infra.yml     # Infrastructure (Ollama, Qdrant, Prometheus, Grafana)
├── docker compose.mcp.yml       # MCP servers (Web, Semantic, Datetime, Ingest, Units)
├── docker compose.yml           # Legacy monolithic file (deprecated)
└── COMPOSE_README.md            # This file
```

## Quick Start

### Run Everything
```bash
docker compose \
  -f docker compose.core.yml \
  -f docker compose.infra.yml \
  -f docker compose.mcp.yml \
  up -d
```

### Run Core Only (Minimum viable stack)
```bash
docker compose -f docker compose.core.yml up -d
```

### Run Core + Infrastructure
```bash
docker compose \
  -f docker compose.core.yml \
  -f docker compose.infra.yml \
  up -d
```

### Run Core + MCP Servers (No monitoring)
```bash
docker compose \
  -f docker compose.core.yml \
  -f docker compose.mcp.yml \
  up -d
```

## Service Groups

### Core Services (`docker compose.core.yml`)
**Required for basic functionality**

- **postgres**: PostgreSQL 15 database
- **api**: FastAPI backend
- **frontend**: Next.js frontend
- **nginx**: Reverse proxy

**Ports:**
- 8000: Main application (HTTPS available on 8443)
- 3000: Direct frontend access
- 8001: Direct API access
- 5432: PostgreSQL

### Infrastructure Services (`docker compose.infra.yml`)
**Required for AI features and monitoring**

- **ollama**: Local LLM server
- **qdrant**: Vector database
- **prometheus**: Metrics collection
- **grafana**: Monitoring dashboards

**Ports:**
- 11434: Ollama API
- 6333: Qdrant HTTP
- 6334: Qdrant gRPC
- 9090: Prometheus
- 3001: Grafana

### MCP Services (`docker compose.mcp.yml`)
**Required for AI tool calling**

- **mcp_web**: Web search, fetch, crawl
- **mcp_semantic**: Semantic search
- **mcp_datetime**: Date/time operations
- **mcp_ingest**: Document ingestion
- **mcp_units**: Unit conversions

**Ports:**
- 7001-7005: MCP servers

## Environment Variables

Create a `.env` file in the repository root:

```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=youworker

# API
ROOT_API_KEY=your_api_key
JWT_SECRET=your_jwt_secret
FRONTEND_ORIGIN=http://localhost:8000

# LLM
OLLAMA_BASE_URL=http://ollama:11434
CHAT_MODEL=gpt-oss:20b
EMBED_MODEL=embeddinggemma:300m

# Ports (optional, defaults shown)
NGINX_PORT=8000
API_PORT=8001
FRONTEND_PORT=3000
POSTGRES_PORT=5432
OLLAMA_PORT=11434
QDRANT_HTTP_PORT=6333
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001

# Grafana
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

## Common Commands

### Start services
```bash
# All services
docker compose -f docker compose.core.yml -f docker compose.infra.yml -f docker compose.mcp.yml up -d

# Core only
docker compose -f docker compose.core.yml up -d

# With logs
docker compose -f docker compose.core.yml up
```

### Stop services
```bash
# All services
docker compose -f docker compose.core.yml down

# With volume cleanup
docker compose -f docker compose.core.yml down -v
```

### View logs
```bash
# All services
docker compose -f docker compose.core.yml logs -f

# Specific service
docker compose -f docker compose.core.yml logs -f api

# Follow new logs
docker compose -f docker compose.core.yml logs -f --tail=100
```

### Rebuild services
```bash
# Rebuild all
docker compose -f docker compose.core.yml build

# Rebuild specific service
docker compose -f docker compose.core.yml build api

# Rebuild and restart
docker compose -f docker compose.core.yml up -d --build
```

### Health checks
```bash
# Check all containers
docker ps

# API health
curl http://localhost:8001/health

# Ollama health
curl http://localhost:11434/api/tags
```

## Development Workflow

### 1. Local Development (Minimum)
Run only core services to reduce resource usage:

```bash
docker compose -f docker compose.core.yml up postgres
# Then run API and Frontend locally
cd apps/api && uvicorn main:app --reload
cd apps/frontend && npm run dev
```

### 2. Full Development
Run everything for integration testing:

```bash
docker compose \
  -f docker compose.core.yml \
  -f docker compose.infra.yml \
  -f docker compose.mcp.yml \
  up -d
```

### 3. Production
Use the monolithic file or combine all:

```bash
docker compose -f docker compose.yml up -d
```

## Troubleshooting

### Service won't start
```bash
# Check logs
docker compose -f docker compose.core.yml logs service_name

# Restart service
docker compose -f docker compose.core.yml restart service_name

# Rebuild service
docker compose -f docker compose.core.yml up -d --build service_name
```

### Database connection errors
```bash
# Check Postgres is running
docker ps | grep postgres

# Check connection
docker exec -it youworker-postgres psql -U postgres -d youworker

# Reset database
docker compose -f docker compose.core.yml down -v
docker compose -f docker compose.core.yml up -d postgres
```

### Ollama model not found
```bash
# Pull model manually
docker exec -it youworker-ollama ollama pull gpt-oss:20b
docker exec -it youworker-ollama ollama pull embeddinggemma:300m
```

### Port conflicts
```bash
# Check what's using a port
sudo lsof -i :8000

# Change ports in .env
NGINX_PORT=9000
API_PORT=9001
```

## Migration from Monolithic File

If you're using the old `docker compose.yml`:

1. **Backup your data**:
   ```bash
   docker compose exec postgres pg_dump -U postgres youworker > backup.sql
   ```

2. **Stop old stack**:
   ```bash
   docker compose down
   ```

3. **Start new stack**:
   ```bash
   docker compose -f docker compose.core.yml -f docker compose.infra.yml -f docker compose.mcp.yml up -d
   ```

The volumes should be automatically reused.
