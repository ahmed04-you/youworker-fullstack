# Setup Guide

Complete guide for installing and configuring YouWorker.AI for local development or production deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Environment Configuration](#environment-configuration)
- [GPU Setup](#gpu-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Docker** (20.10+) and **Docker Compose** (2.0+)
- **Git** for cloning the repository
- **GNU Make** (optional, for convenience commands)

### Optional (For Local Development)

- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **NVIDIA GPU** with drivers (for acceleration)

### System Requirements

#### Minimum Configuration
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB available
- **Network**: Broadband internet for initial setup

#### Recommended Configuration
- **CPU**: 8+ cores
- **RAM**: 16+ GB
- **Storage**: 100+ GB SSD
- **GPU**: NVIDIA GPU with 8+ GB VRAM
- **Network**: Gigabit ethernet

## Quick Start

Get YouWorker.AI running in 5 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd youworker-fullstack

# 2. Copy environment template
cp .env.example .env

# 3. Download TTS models (optional, for voice features)
./scripts/download-piper-models.sh

# 4. Start all services
make compose-up

# 5. Access the application
# Frontend: http://localhost:8000
# API Docs: http://localhost:8001/docs
# Grafana: http://localhost:3001 (admin/admin)
```

**Note**: First startup takes 5-10 minutes while Ollama downloads required models (~10GB).

## Detailed Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd youworker-fullstack
```

### Step 2: Environment Configuration

Create your environment file:

```bash
cp .env.example .env
```

Edit `.env` with your preferred settings (see [Environment Configuration](#environment-configuration) below).

### Step 3: SSL Certificates (Optional)

For HTTPS support, generate SSL certificates:

```bash
# For localhost development
./scripts/generate-ssl-cert.sh localhost 127.0.0.1

# For production with domain
./scripts/generate-ssl-cert.sh yourdomain.com your-server-ip
```

Certificates will be created in `data/nginx/ssl/`.

### Step 4: Download TTS Models (Optional)

For voice features, download Piper TTS models:

```bash
./scripts/download-piper-models.sh
```

This downloads Italian voice models (~100MB). Edit the script for other languages.

### Step 5: Start Services

#### Using Make (Recommended)

```bash
# Start all services with GPU auto-detection
make compose-up

# View logs
make compose-logs

# Stop services
make compose-down

# Restart services
make compose-restart
```

#### Using Docker Compose Directly

```bash
# Start services
docker compose -f ops/compose/docker-compose.yml up -d

# View logs
docker compose -f ops/compose/docker-compose.yml logs -f

# Stop services
docker compose -f ops/compose/docker-compose.yml down
```

### Step 6: Verify Installation

Check that all services are running:

```bash
make status
# or
docker compose -f ops/compose/docker-compose.yml ps
```

You should see all services with status "Up":
- nginx
- frontend
- api
- ollama
- postgres
- qdrant
- mcp_web, mcp_semantic, mcp_datetime, mcp_ingest, mcp_units

### Step 7: Access the Application

- **Frontend**: http://localhost:8000 (or https://localhost:8000 if SSL configured)
- **API Documentation**: http://localhost:8001/docs
- **API Health Check**: http://localhost:8001/health
- **Grafana Dashboard**: http://localhost:3001 (login: admin/admin)
- **Prometheus Metrics**: http://localhost:9090

## Environment Configuration

### Core Settings

```bash
# Application Environment
APP_ENV=production              # production, development, or test
LOG_LEVEL=INFO                  # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

### API Configuration

```bash
# API Server
API_HOST=0.0.0.0
API_PORT=8001

# Authentication
ROOT_API_KEY=<generate-secure-random-key>
JWT_SECRET=<generate-secure-random-key>

# CORS Origins (comma-separated)
FRONTEND_ORIGIN=http://localhost:8000,http://127.0.0.1:8000
```

**Security Note**: Generate secure random keys:
```bash
# Generate API key
openssl rand -hex 32

# Generate JWT secret
openssl rand -hex 32
```

### Database Configuration

```bash
# PostgreSQL
POSTGRES_USER=youworker
POSTGRES_PASSWORD=<generate-secure-password>
POSTGRES_DB=youworker
DATABASE_URL=postgresql+asyncpg://youworker:<password>@postgres:5432/youworker
```

### LLM Configuration

```bash
# Ollama Settings
OLLAMA_BASE_URL=http://ollama:11434
CHAT_MODEL=gpt-oss:20b           # Main chat model
EMBED_MODEL=embeddinggemma:300m   # Embedding model
OLLAMA_AUTO_PULL=1               # Auto-download models (1=yes, 0=no)
```

**Available Models**:
- `gpt-oss:20b` - 20B parameter chat model (recommended, ~12GB)
- `mistral:7b` - 7B parameter model (faster, ~4GB)
- `llama3:8b` - 8B parameter model (balanced, ~5GB)

### Vector Store Configuration

```bash
# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=documents
EMBEDDING_DIM=768
```

### MCP Servers Configuration

```bash
# MCP Server URLs (comma-separated)
MCP_SERVER_URLS=http://mcp_web:7001,http://mcp_semantic:7002,http://mcp_datetime:7003,http://mcp_ingest:7004,http://mcp_units:7005

# Tool refresh interval (seconds)
MCP_REFRESH_INTERVAL=300
```

### Speech Configuration

#### Speech-to-Text (Whisper)

```bash
# Whisper Settings
STT_MODEL=small                  # tiny, base, small, medium, large-v3
STT_DEVICE=cuda                  # cuda or cpu
STT_COMPUTE_TYPE=float16         # float16, int8, int8_float16
STT_BEAM_SIZE=1                  # 1-5 (higher = more accurate, slower)
STT_LANGUAGE=it                  # Language code (en, it, es, etc.)
```

**Model Sizes**:
| Model | Size | VRAM | Speed | Quality |
|-------|------|------|-------|---------|
| tiny | 75MB | 1GB | Fastest | Basic |
| base | 142MB | 1GB | Fast | Good |
| small | 466MB | 2GB | Medium | Better |
| medium | 1.5GB | 5GB | Slow | Excellent |
| large-v3 | 3GB | 10GB | Slowest | Best |

#### Text-to-Speech (Piper)

```bash
# Piper TTS Settings
TTS_PROVIDER=piper
TTS_VOICE=it_IT-riccardo-x_low    # Voice model
TTS_MODEL_DIR=/app/models/tts     # Model directory
```

**Available Voices**: See [Piper Voices](https://github.com/rhasspy/piper/blob/master/VOICES.md)

### Ingestion Configuration

```bash
# Document Processing
INGEST_UPLOAD_ROOT=/data/uploads
INGEST_EXAMPLES_DIR=/data/examples
INGEST_ACCELERATOR=auto          # auto, cpu, cuda
INGEST_GPU_DEVICE=cuda
MAX_AGENT_ITERATIONS=50
```

### Frontend Configuration

```bash
# Frontend API Settings
NEXT_PUBLIC_API_KEY=<same-as-ROOT_API_KEY>
NEXT_PUBLIC_API_BASE_URL=        # Leave empty for relative URLs
NEXT_PUBLIC_API_PORT=8000
NEXT_INTERNAL_API_BASE_URL=http://api:8001  # For SSR
```

### GPU Configuration

```bash
# GPU Settings
ENABLE_GPU_TORCH=1               # Enable PyTorch GPU (1=yes, 0=no)
```

## GPU Setup

### NVIDIA GPU Requirements

1. **NVIDIA GPU** with compute capability 7.0+ (Pascal architecture or newer)
2. **NVIDIA Driver** 525.60.13+ (for CUDA 12.0)
3. **NVIDIA Container Toolkit** installed

### Installing NVIDIA Container Toolkit

#### Ubuntu/Debian

```bash
# Add NVIDIA package repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
    sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install nvidia-container-toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Restart Docker
sudo systemctl restart docker
```

#### Fedora/RHEL

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.repo | \
    sudo tee /etc/yum.repos.d/nvidia-docker.repo

sudo yum install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Verify GPU Support

```bash
# Check NVIDIA driver
nvidia-smi

# Test GPU in Docker
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### GPU Services

The following services use GPU acceleration when available:
- **ollama**: LLM inference
- **api**: Speech transcription (Whisper) and synthesis (Piper)
- **mcp_ingest**: Document parsing (Docling), OCR, audio transcription

### CPU Fallback

If no GPU is detected, services automatically fall back to CPU mode. Performance will be slower:
- LLM inference: 5-10x slower
- Speech transcription: 3-5x slower
- Document parsing: 2-3x slower

## Data Management

### Data Directories

All persistent data is stored in `./data/`:

```
data/
├── postgres/        # PostgreSQL database
├── qdrant/          # Vector store data
├── ollama/          # Downloaded models
├── uploads/         # Uploaded documents
├── models/          # TTS models
├── nginx/ssl/       # SSL certificates
├── grafana/         # Grafana dashboards
├── prometheus/      # Prometheus metrics
└── backups/         # Database backups
```

### Backup Data

Create a backup:

```bash
# Manual backup
make backup

# Automated backups (daily at 2 AM)
make setup-backup
```

Backups are stored in `data/backups/` with timestamps.

### Restore Data

Restore from a backup:

```bash
make restore BACKUP_FILE=data/backups/postgres_backup_20250126_140500.sql
```

### Reset All Data

**Warning**: This deletes all data!

```bash
make reset-data
```

## Local Development Setup

For development without Docker:

### Backend Development

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
make db-migrate

# Start API server
make dev-api
```

API will be available at http://localhost:8001

### Frontend Development

```bash
# Install dependencies
cd apps/frontend
npm install

# Start development server
npm run dev
```

Frontend will be available at http://localhost:3000

### MCP Server Development

Start individual MCP servers:

```bash
# Web scraping server
make dev-mcp-web

# Semantic search server
make dev-mcp-semantic

# DateTime operations server
make dev-mcp-datetime

# Document ingestion server
make dev-mcp-ingest

# Unit conversion server
make dev-mcp-units
```

## Testing

### Run All Tests

```bash
make test
```

### Run Specific Tests

```bash
# Unit tests only
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v

# E2E tests
pytest tests/e2e/ -v

# With coverage
pytest --cov=packages --cov=apps --cov-report=html
```

## Troubleshooting

### Services Not Starting

**Check Docker resources**:
```bash
docker stats
```

Ensure adequate CPU, memory, and disk space.

**Check service logs**:
```bash
make compose-logs
# or
docker compose -f ops/compose/docker-compose.yml logs <service-name>
```

### Models Not Downloading

**Issue**: Ollama models not pulling automatically.

**Solution**:
```bash
# Pull models manually
docker compose exec ollama ollama pull gpt-oss:20b
docker compose exec ollama ollama pull embeddinggemma:300m

# Check available models
docker compose exec ollama ollama list
```

### Database Connection Errors

**Issue**: Cannot connect to PostgreSQL.

**Solution**:
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres

# Verify connection
docker compose exec postgres psql -U youworker -d youworker -c '\dt'
```

### Qdrant Connection Errors

**Issue**: Vector store not reachable.

**Solution**:
```bash
# Check Qdrant is running
docker compose ps qdrant

# Test connectivity
curl http://localhost:6333/

# Restart Qdrant
docker compose restart qdrant
```

### Port Conflicts

**Issue**: Port already in use.

**Solution**:
```bash
# Find process using port
sudo lsof -i :8000

# Kill the process or change port in .env
# For example, change NEXT_PUBLIC_API_PORT=8000 to 8080
```

### SSL Certificate Issues

**Issue**: SSL certificate not trusted.

**Solution** (for local development):
- Import certificate to system/browser trust store
- Or use HTTP instead (remove SSL configuration)

### Out of Memory Errors

**Issue**: Ollama or other services crashing.

**Solution**:
1. Use smaller models (e.g., `mistral:7b` instead of `gpt-oss:20b`)
2. Reduce `STT_MODEL` size
3. Allocate more memory to Docker
4. Enable swap for Docker containers

### Frontend Not Loading

**Issue**: Blank page or 404 errors.

**Solution**:
```bash
# Rebuild frontend
docker compose build frontend
docker compose restart frontend

# Check nginx configuration
docker compose exec nginx nginx -t

# View nginx logs
docker compose logs nginx
```

### GPU Not Detected

**Issue**: Services running on CPU despite GPU available.

**Solution**:
```bash
# Verify GPU support
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Check nvidia-container-toolkit
sudo systemctl status docker
docker info | grep -i runtime

# Reinstall if necessary
sudo apt-get install --reinstall nvidia-container-toolkit
sudo systemctl restart docker
```

## Next Steps

- [Architecture Documentation](ARCHITECTURE.md) - Understand the system design
- [API Documentation](API.md) - Learn the API endpoints
- [Development Guide](DEVELOPMENT.md) - Start contributing
- [Deployment Guide](DEPLOYMENT.md) - Deploy to production

## Getting Help

- Check the [troubleshooting section](#troubleshooting) above
- Review service logs: `make compose-logs`
- Open an issue on GitHub
- Consult the [API documentation](API.md)