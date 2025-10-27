# Deployment Runbook

## Overview

This runbook provides step-by-step instructions for deploying YouWorker.AI to production on-premise infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Backup & Recovery](#backup--recovery)
8. [Monitoring](#monitoring)
9. [Maintenance](#maintenance)

---

## Prerequisites

### Hardware Requirements

**Minimum:**
- CPU: 8 cores
- RAM: 32 GB
- GPU: NVIDIA GPU with 8GB+ VRAM (for LLM inference)
- Disk: 500 GB SSD

**Recommended:**
- CPU: 16+ cores
- RAM: 64 GB
- GPU: NVIDIA GPU with 24GB+ VRAM (RTX 4090, A6000, etc.)
- Disk: 1 TB NVMe SSD

### Software Requirements

```bash
# Check versions
docker --version          # >= 24.0.0
docker-compose --version  # >= 2.20.0
nvidia-smi               # NVIDIA driver >= 525.x
python3 --version        # >= 3.11
node --version           # >= 20.x
```

### Network Requirements

- **Public IP:** 95.110.228.79 (example - replace with your server IP)
- **Client IP:** 93.41.222.40 (example - replace with your client IP)
- **Open Ports:**
  - 8000 (HTTPS frontend)
  - 8001 (API, internal only)
  - 5432 (PostgreSQL, internal only)
  - 6333/6334 (Qdrant, internal only)
  - 11434 (Ollama, internal only)

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/youworker/youworker-fullstack.git
cd youworker-fullstack
```

### 2. Install Docker & NVIDIA Container Toolkit

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Verify GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

### 3. Verify GPU Detection

```bash
# Check if Docker can see GPU
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

---

## Configuration

### 1. Generate Secrets

```bash
# Generate ROOT_API_KEY
export ROOT_API_KEY=$(openssl rand -hex 32)
echo "ROOT_API_KEY: $ROOT_API_KEY"

# Generate JWT_SECRET
export JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET: $JWT_SECRET"

# Generate POSTGRES_PASSWORD
export POSTGRES_PASSWORD=$(openssl rand -hex 32)
echo "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"

# IMPORTANT: Save these secrets securely!
# Store in a password manager (1Password, Bitwarden, etc.)
```

### 2. Create .env File

```bash
# Copy example
cp .env.example .env

# Edit configuration
nano .env
```

**Required Changes:**

```bash
# Replace with your values
APP_ENV=production
WHITELISTED_IPS=93.41.222.40,127.0.0.1  # YOUR CLIENT IPS
FRONTEND_ORIGIN=https://95.110.228.79    # YOUR SERVER IP/DOMAIN

# Use generated secrets
ROOT_API_KEY=<generated-from-step-1>
JWT_SECRET=<generated-from-step-1>
POSTGRES_PASSWORD=<generated-from-step-1>

# Update DATABASE_URL with same password
DATABASE_URL=postgresql+asyncpg://youworker:<POSTGRES_PASSWORD>@postgres:5432/youworker

# Frontend URL
NEXT_PUBLIC_API_BASE_URL=https://95.110.228.79  # YOUR SERVER IP/DOMAIN

# Authentik integration (optional but recommended)
AUTHENTIK_ENABLED=true
AUTHENTIK_HEADER_NAME=x-authentik-api-key
AUTHENTIK_FORWARD_USER_HEADER=x-authentik-username
```

### 3. Generate SSL Certificates

**Option A: Self-Signed (Development/Testing)**
```bash
make ssl-setup
# or
./scripts/generate-ssl-cert.sh 95.110.228.79 95.110.228.79
```

**Option B: Let's Encrypt (Production with Domain)**
```bash
# Install certbot
sudo apt-get install -y certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem data/nginx/ssl/server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem data/nginx/ssl/server.key
sudo chmod 644 data/nginx/ssl/server.crt
sudo chmod 600 data/nginx/ssl/server.key
```

### 4. Configure Firewall

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 93.41.222.40 to any port 8000  # YOUR CLIENT IP
sudo ufw allow from 127.0.0.1 to any port 8000
sudo ufw allow ssh  # IMPORTANT: Don't lock yourself out!
sudo ufw enable

# Verify rules
sudo ufw status verbose
```

---

## Deployment

### 1. Build & Start Services

```bash
# Build all images (takes ~10-15 minutes on first run)
make build

# Start all services
make compose-up

# Monitor startup logs
docker-compose -f ops/compose/docker-compose.yml logs -f
```

**Expected Startup Time:**
- Services start: ~30 seconds
- Ollama model pull (20B model): ~5-10 minutes
- Total: ~10-15 minutes

### 2. Download AI Models

```bash
# Check if models are downloaded
docker exec youworker-ollama ollama list

# If not, pull models manually
docker exec youworker-ollama ollama pull gpt-oss:20b
docker exec youworker-ollama ollama pull embeddinggemma:300m
```

### 3. Initialize Database

```bash
# Database auto-initializes on first run
# Verify it's working:
docker exec -it youworker-postgres psql -U youworker -d youworker -c "\dt"

# Expected tables:
# - users
# - chat_sessions
# - chat_messages
# - tools
# - mcp_servers
# - documents (and more)
```

---

## Verification

### 1. Health Checks

```bash
# Check all services are healthy
docker-compose -f ops/compose/docker-compose.yml ps

# All services should show "healthy" or "running"
# API health endpoint
curl https://95.110.228.79/health

# Expected: {"status": "healthy"}
```

### 2. Test Authentication

```bash
# From whitelisted IP (93.41.222.40):
curl -X POST https://95.110.228.79/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"api_key\": \"YOUR_ROOT_API_KEY\"}" \
  -c cookies.txt

# Expected: {"message": "Login successful", "username": "root", ...}

# Test authenticated request
curl -X GET https://95.110.228.79/v1/auth/me \
  -b cookies.txt

# Expected: {"username": "root", "is_root": true, ...}
```

### 3. Test IP Whitelisting

```bash
# From NON-whitelisted IP (should fail):
curl https://95.110.228.79/health

# Expected: 403 Forbidden
```

### 4. Access Frontend

Open browser and navigate to:
```
https://95.110.228.79
```

- You should see a login dialog
- Enter your `ROOT_API_KEY`
- Verify you can access the chat interface

### 5. Test Chat Functionality

```bash
# Via WebSocket (more complex, see integration tests)
# Or via HTTP chat endpoint:
curl -X POST https://95.110.228.79/v1/chat/completions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to Docker daemon"
```bash
# Start Docker
sudo systemctl start docker

# Enable on boot
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### 2. "GPU not detected"
```bash
# Check NVIDIA driver
nvidia-smi

# Reinstall NVIDIA Container Toolkit
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

#### 3. "Ollama models not loading"
```bash
# Check Ollama logs
docker logs youworker-ollama

# Manually pull model
docker exec youworker-ollama ollama pull gpt-oss:20b

# Check disk space
df -h
```

#### 4. "403 Forbidden on all requests"
```bash
# Check IP whitelist configuration
grep WHITELISTED_IPS .env

# Verify your client IP
curl https://api.ipify.org

# Temporarily disable IP whitelist for testing
# Set APP_ENV=development in .env
# Restart: make compose-down && make compose-up
```

#### 5. "Database connection failed"
```bash
# Check PostgreSQL is running
docker exec youworker-postgres pg_isready

# Check credentials in .env
grep POSTGRES_PASSWORD .env
grep DATABASE_URL .env

# Verify they match

# Reset database
docker-compose -f ops/compose/docker-compose.yml down -v
make compose-up
```

#### 6. "Frontend shows connection error"
```bash
# Check NEXT_PUBLIC_API_BASE_URL in .env
grep NEXT_PUBLIC_API_BASE_URL .env

# Should match your server IP/domain
# Rebuild frontend
docker-compose -f ops/compose/docker-compose.yml build frontend
docker-compose -f ops/compose/docker-compose.yml up -d frontend
```

### Logs

```bash
# View all logs
docker-compose -f ops/compose/docker-compose.yml logs -f

# View specific service
docker logs youworker-api -f
docker logs youworker-frontend -f
docker logs youworker-ollama -f

# Filter by error level
docker logs youworker-api 2>&1 | grep ERROR
```

---

## Backup & Recovery

### Automated Backups

```bash
# Set up daily backups (runs at 2 AM)
make setup-backup

# This creates a cron job:
# 0 2 * * * /path/to/ops/scripts/backup-database.sh
```

### Manual Backup

```bash
# Run backup script
./ops/scripts/backup-database.sh

# Backups stored in:
# /opt/youworker/backups/YYYY-MM-DD_HH-MM-SS/
```

### Restore from Backup

```bash
# Stop services
make compose-down

# Restore PostgreSQL
gunzip -c /opt/youworker/backups/2025-10-27_02-00-00/postgres_backup.sql.gz | \
  docker exec -i youworker-postgres psql -U youworker -d youworker

# Restore Qdrant
docker exec youworker-qdrant qdrant-cli snapshot restore \
  /qdrant/storage/snapshots/backup_2025-10-27.snapshot

# Restart services
make compose-up
```

---

## Monitoring

### Grafana Dashboards

Access Grafana at: `http://95.110.228.79:3001`

**Default Credentials:**
- Username: `admin`
- Password: `admin` (change immediately!)

**Pre-configured Dashboards:**
- API Performance
- Database Metrics
- GPU Utilization
- Request Rate & Errors

### Prometheus Metrics

Access Prometheus at: `http://95.110.228.79:9090`

**Useful Queries:**
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Response time (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Log Monitoring

```bash
# Real-time error monitoring
tail -f /var/log/youworker/*.log | grep ERROR

# Count errors in last hour
docker logs youworker-api --since 1h 2>&1 | grep ERROR | wc -l
```

---

## Maintenance

### Weekly Tasks

```bash
# Check disk space
df -h

# Check for Docker image updates
docker images | grep youworker

# Review logs for errors
docker logs youworker-api --since 7d 2>&1 | grep ERROR

# Verify backups
ls -lh /opt/youworker/backups/
```

### Monthly Tasks

```bash
# Update dependencies
cd youworker-fullstack
git pull
pip list --outdated
npm outdated

# Security scan
docker scan youworker/api:latest

# Rotate secrets (quarterly)
./scripts/rotate-secrets.sh

# Test backup restoration
# (in non-production environment)
```

### Update Procedure

```bash
# 1. Backup current state
./ops/scripts/backup-database.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild images
make build

# 4. Restart services
make compose-down
make compose-up

# 5. Verify health
curl https://95.110.228.79/health
```

---

## Emergency Procedures

### Service Down

```bash
# Restart all services
make compose-down && make compose-up

# Restart specific service
docker restart youworker-api
```

### Out of Disk Space

```bash
# Clean Docker resources
docker system prune -af --volumes

# Free up log space
sudo truncate -s 0 /var/log/youworker/*.log

# Check largest directories
du -sh /* | sort -h
```

### Security Breach

```bash
# 1. Block all access
sudo ufw deny from any to any port 8000

# 2. Rotate all secrets
./scripts/rotate-secrets.sh

# 3. Review logs
docker logs youworker-api --since 24h > security-audit.log

# 4. Restore from known-good backup
# (see Backup & Recovery section)

# 5. Re-enable access (after patching)
sudo ufw allow from 93.41.222.40 to any port 8000
```

---

## Support

**Documentation:**
- [Security Guide](./SECURITY.md)
- [API Documentation](https://95.110.228.79/docs)
- [Architecture Overview](./ARCHITECTURE.md)

**Get Help:**
- GitHub Issues: https://github.com/youworker/youworker-fullstack/issues
- Email: support@youworker.ai

---

**Last Updated:** 2025-10-27
**Version:** 1.0.0
