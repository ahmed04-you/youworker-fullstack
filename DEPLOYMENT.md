# Deployment Guide

## Quick Start (Local)

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 2. Download TTS models (for voice features)
./scripts/download-piper-models.sh

# 3. Start all services
make compose-up

# 4. Access the application
# Frontend: http://localhost:8000
# API: http://localhost:8001/docs
# Grafana: http://localhost:3001 (admin/admin)
```

**First startup takes 5-10 minutes** while Ollama downloads required models.

## Remote Deployment

### Prerequisites
- Docker & Docker Compose installed
- NVIDIA GPU (optional, for acceleration)
- Ports 8000, 8001 available

### Steps

1. **Clone repository on server**:
```bash
git clone <repo-url>
cd youworker-fullstack
```

2. **Configure environment**:
```bash
cp .env.example .env
```

Edit `.env` and update:
- `FRONTEND_ORIGIN`: Add your server IP/domain
- `NGINX_CERT_DOMAIN`: Your domain or IP
- `ROOT_API_KEY`: Generate secure key
- `POSTGRES_PASSWORD`: Generate secure password
- `JWT_SECRET`: Generate secure key

3. **Generate SSL certificates**:
```bash
./scripts/generate-ssl-cert.sh your-domain.com your-server-ip
```

4. **Start services**:
```bash
make compose-up
```

5. **Verify deployment**:
```bash
curl -k https://your-server:8000
curl -k https://your-server:8001/health
```

## Configuration

### Key Environment Variables

**Ollama (LLM)**:
- `OLLAMA_BASE_URL`: Ollama server URL
- `CHAT_MODEL`: Chat model name (default: gpt-oss:20b)
- `EMBED_MODEL`: Embedding model (default: embeddinggemma:300m)
- `OLLAMA_AUTO_PULL`: Auto-download models (1=yes, 0=no)

**Database**:
- `DATABASE_URL`: PostgreSQL connection string
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`

**Vector Store**:
- `QDRANT_URL`: Qdrant server URL
- `QDRANT_COLLECTION`: Collection name

**API**:
- `ROOT_API_KEY`: Admin API key
- `JWT_SECRET`: JWT signing secret
- `FRONTEND_ORIGIN`: Allowed CORS origins (comma-separated)

**MCP Servers**:
- `MCP_SERVER_URLS`: Comma-separated MCP server URLs
- `MCP_REFRESH_INTERVAL`: Tool refresh interval (seconds)

## Architecture

```
nginx (8000) → frontend (3000)
             → api (8001) → ollama (11434)
                          → qdrant (6333)
                          → postgres (5432)
                          → mcp_servers (7001-7005)
```

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **API Health**: http://localhost:8001/health

## Backup

```bash
# Manual backup
make backup

# Automated backups (daily at 2 AM)
make setup-backup
```

## Troubleshooting

**Services not starting**:
```bash
make compose-logs
docker compose -f ops/compose/docker-compose.yml ps
```

**Models not downloading**:
- Check `OLLAMA_AUTO_PULL=1` in `.env`
- Manually pull: `docker compose exec ollama ollama pull gpt-oss:20b`

**Database issues**:
```bash
# Reset database
make compose-down
make reset-data
make compose-up
```

## Security Checklist

- [ ] Change default `ROOT_API_KEY`
- [ ] Change default `POSTGRES_PASSWORD`
- [ ] Generate unique `JWT_SECRET`
- [ ] Configure `FRONTEND_ORIGIN` whitelist
- [ ] Use HTTPS in production
- [ ] Regularly update Docker images
- [ ] Enable firewall (ports 8000, 8001 only)
- [ ] Setup automated backups

## Performance Tuning

**With GPU**:
- Automatically detected by `make compose-up`
- Uses `ops/compose/docker-compose.gpu.yml` overlay
- Set `ENABLE_GPU_TORCH=1` in `.env`

**Without GPU**:
- CPU-only mode (slower)
- Consider smaller models
- Adjust `STT_COMPUTE_TYPE=int8` for faster STT

## Updates

```bash
git pull
make compose-down
make build
make compose-up