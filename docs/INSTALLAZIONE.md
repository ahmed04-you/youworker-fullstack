# Guida all'Installazione di YouWorker

Guida completa all'installazione e configurazione di YouWorker on-premise.

---

## Indice

1. [Requisiti di Sistema](#requisiti-di-sistema)
2. [Installazione Docker](#installazione-docker)
3. [Configurazione Ambiente](#configurazione-ambiente)
4. [Download Modelli AI](#download-modelli-ai)
5. [Avvio Servizi](#avvio-servizi)
6. [Verifica Installazione](#verifica-installazione)
7. [Configurazione Post-Installazione](#configurazione-post-installazione)
8. [Produzione vs Sviluppo](#produzione-vs-sviluppo)
9. [Troubleshooting](#troubleshooting)

---

## Requisiti di Sistema

### Requisiti Minimi (Test/Sviluppo)

```
CPU: 4 core (Intel/AMD x86_64)
RAM: 8 GB
GPU: Nessuna (inferenza CPU lenta)
Disco: 50 GB liberi
OS: Ubuntu 22.04+ / Debian 11+ / CentOS 8+
Docker: 24.0+
Docker Compose: 2.20+
```

### Requisiti Consigliati (Produzione)

```
CPU: 8+ core (Intel Xeon / AMD EPYC)
RAM: 32 GB
GPU: NVIDIA RTX 4090 (24GB VRAM) o superiore
Disco: 500 GB SSD NVMe
OS: Ubuntu 22.04 LTS
Docker: 24.0+
Docker Compose: 2.20+
NVIDIA Container Runtime
```

### Requisiti Enterprise (Alto Carico)

```
CPU: 16+ core
RAM: 64+ GB
GPU: Multipli NVIDIA A100 (40GB/80GB VRAM)
Disco: 1+ TB NVMe RAID 10
Network: 10 Gbps
Load Balancer: HAProxy / NGINX
```

### Porte di Rete

```
8000    - NGINX (HTTPS pubblico)
8001    - API Backend (interno)
3000    - Frontend (interno)
5432    - PostgreSQL (interno)
6333    - Qdrant (interno)
11434   - Ollama (interno)
7001-05 - Server MCP (interno)
3001    - Grafana (opzionale)
9090    - Prometheus (opzionale)
```

---

## Installazione Docker

### Ubuntu/Debian

```bash
# Rimuovi versioni vecchie
sudo apt remove docker docker-engine docker.io containerd runc

# Installa dipendenze
sudo apt update
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Aggiungi repo Docker
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installa Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verifica installazione
docker --version
docker compose version

# Aggiungi utente a gruppo docker (opzionale)
sudo usermod -aG docker $USER
newgrp docker  # O logout/login
```

### NVIDIA Container Runtime (per GPU)

```bash
# Installa driver NVIDIA
sudo ubuntu-drivers autoinstall
sudo reboot

# Verifica driver
nvidia-smi

# Installa NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | \
    sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
    sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt update
sudo apt install -y nvidia-container-toolkit

# Configura Docker runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Test GPU in container
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi
```

---

## Configurazione Ambiente

### Clone Repository

```bash
# Clone del repository
git clone https://github.com/youco/youworker-fullstack.git
cd youworker-fullstack
```

### File `.env`

```bash
# Copia template
cp .env.example .env

# Genera chiavi segrete
echo "ROOT_API_KEY=$(openssl rand -hex 32)" >> .env.secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.secrets
echo "CSRF_SECRET=$(openssl rand -hex 32)" >> .env.secrets
echo "CHAT_MESSAGE_ENCRYPTION_SECRET=$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')" >> .env.secrets

# Modifica .env con editor
nano .env
```

### Configurazione `.env` Essenziale

```bash
# ===========================
# AMBIENTE
# ===========================
APP_ENV=production
DEBUG=false

# ===========================
# SICUREZZA (OBBLIGATORIO)
# ===========================
ROOT_API_KEY=<generato-con-openssl>
JWT_SECRET=<generato-con-openssl>
CSRF_SECRET=<generato-con-openssl>
CHAT_MESSAGE_ENCRYPTION_SECRET=<generato-fernet>

# ===========================
# DATABASE
# ===========================
POSTGRES_USER=youworker
POSTGRES_PASSWORD=<password-sicura>
POSTGRES_DB=youworker
DATABASE_URL=postgresql+asyncpg://youworker:<password>@postgres:5432/youworker

# ===========================
# QDRANT
# ===========================
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=documents
EMBEDDING_DIM=768

# ===========================
# OLLAMA
# ===========================
OLLAMA_BASE_URL=http://ollama:11434
CHAT_MODEL=gpt-oss:20b
EMBED_MODEL=embeddinggemma:300m

# ===========================
# MCP SERVERS
# ===========================
MCP_SERVER_URLS=http://mcp_web:7001,http://mcp_semantic:7002,http://mcp_datetime:7003,http://mcp_ingest:7004,http://mcp_units:7005
MCP_REFRESH_INTERVAL=300

# ===========================
# NETWORK
# ===========================
FRONTEND_ORIGIN=https://youworker.tuazienda.it
NEXT_PUBLIC_API_BASE_URL=https://youworker.tuazienda.it:8000

# IP whitelisting (produzione)
WHITELISTED_IPS=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

# ===========================
# AUTHENTIK (opzionale)
# ===========================
AUTHENTIK_ENABLED=true
AUTHENTIK_HEADER_NAME=X-Authentik-Api-Key
AUTHENTIK_JWKS_URL=https://auth.tuazienda.it/application/o/youworker/.well-known/jwks.json
AUTHENTIK_ISSUER=https://auth.tuazienda.it/application/o/youworker/
```

---

## Certificati SSL

### Opzione 1: Certificati Self-Signed (Sviluppo)

```bash
make ssl-setup

# Oppure manualmente:
mkdir -p ops/docker/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ops/docker/nginx/certs/key.pem \
  -out ops/docker/nginx/certs/cert.pem \
  -subj "/C=IT/ST=Milano/L=Milano/O=YouCo/CN=youworker.tuazienda.it"
```

### Opzione 2: Let's Encrypt (Produzione)

```bash
# Installa certbot
sudo apt install certbot

# Genera certificati
sudo certbot certonly --standalone \
  -d youworker.tuazienda.it \
  --email admin@tuazienda.it \
  --agree-tos

# Copia certificati
sudo cp /etc/letsencrypt/live/youworker.tuazienda.it/fullchain.pem \
     ops/docker/nginx/certs/cert.pem
sudo cp /etc/letsencrypt/live/youworker.tuazienda.it/privkey.pem \
     ops/docker/nginx/certs/key.pem

# Rinnovo automatico
sudo crontab -e
# Aggiungi:
0 0 * * * certbot renew --quiet && cp /etc/letsencrypt/live/youworker.tuazienda.it/*.pem /path/to/youworker/ops/docker/nginx/certs/ && docker restart nginx
```

### Opzione 3: Certificati Aziendali

```bash
# Copia i tuoi certificati in:
ops/docker/nginx/certs/cert.pem  # Certificato pubblico
ops/docker/nginx/certs/key.pem   # Chiave privata

# Se hai certificato intermedio:
cat your-cert.crt intermediate.crt > ops/docker/nginx/certs/cert.pem
cp your-key.key ops/docker/nginx/certs/key.pem
```

---

## Download Modelli AI

```bash
# Avvia solo Ollama
docker compose -f ops/compose/docker-compose.yml up -d ollama

# Attendi che Ollama sia pronto
sleep 10

# Scarica modelli (richiede tempo e spazio)
docker exec -it ollama ollama pull gpt-oss:20b          # ~11GB
docker exec -it ollama ollama pull embeddinggemma:300m  # ~150MB

# Verifica modelli scaricati
docker exec -it ollama ollama list

# Output atteso:
# NAME                    ID              SIZE      MODIFIED
# gpt-oss:20b            abc123...       11 GB     2 minutes ago
# embeddinggemma:300m    def456...       150 MB    1 minute ago
```

### Modelli Alternativi

```bash
# Modelli più piccoli (per test)
ollama pull llama2:7b              # Chat ~4GB
ollama pull nomic-embed-text       # Embeddings ~275MB

# Modelli più grandi (per produzione)
ollama pull llama3:70b             # Chat ~39GB (richiede 48GB+ VRAM)
ollama pull mxbai-embed-large      # Embeddings ~670MB
```

---

## Avvio Servizi

### Build Immagini

```bash
# Build di tutte le immagini Docker
make build

# Oppure manualmente:
docker compose -f ops/compose/docker-compose.yml build
```

### Avvio Completo

```bash
# Avvia tutti i servizi
make compose-up

# Oppure:
docker compose -f ops/compose/docker-compose.yml up -d

# Visualizza log
docker compose -f ops/compose/docker-compose.yml logs -f

# Verifica stato
docker ps
```

Dovresti vedere **13 container** in esecuzione:
```
CONTAINER ID   IMAGE                    STATUS         PORTS
abc123...      youworker-frontend       Up 2 minutes   3000/tcp
def456...      youworker-api            Up 2 minutes   8001/tcp
ghi789...      youworker-mcp-web        Up 2 minutes   7001/tcp
jkl012...      youworker-mcp-semantic   Up 2 minutes   7002/tcp
mno345...      youworker-mcp-datetime   Up 2 minutes   7003/tcp
pqr678...      youworker-mcp-ingest     Up 2 minutes   7004/tcp
stu901...      youworker-mcp-units      Up 2 minutes   7005/tcp
vwx234...      postgres:15              Up 2 minutes   5432/tcp
yza567...      qdrant/qdrant:latest     Up 2 minutes   6333/tcp
bcd890...      ollama/ollama:latest     Up 2 minutes   11434/tcp
efg123...      nginx:alpine             Up 2 minutes   0.0.0.0:8000->443/tcp
hij456...      grafana/grafana:latest   Up 2 minutes   0.0.0.0:3001->3000/tcp
klm789...      prom/prometheus:latest   Up 2 minutes   9090/tcp
```

### Inizializzazione Database

```bash
# Esegui migrazioni
make db-migrate

# Oppure:
docker exec -it youworker-api alembic upgrade head

# Verifica tabelle create
docker exec -it postgres psql -U youworker -d youworker -c "\dt"

# Output atteso:
#  Schema |       Name        | Type  |   Owner
# --------+-------------------+-------+-----------
#  public | users             | table | youworker
#  public | chat_sessions     | table | youworker
#  public | chat_messages     | table | youworker
#  public | documents         | table | youworker
#  ...
```

### Creazione Utente Root

```bash
# Genera API key
ROOT_KEY=$(openssl rand -hex 32)

# Crea utente root
docker exec -it youworker-api python -c "
from packages.db.crud import create_root_user
import asyncio

async def main():
    await create_root_user(
        username='admin',
        api_key='$ROOT_KEY'
    )

asyncio.run(main())
"

# Salva API key in modo sicuro
echo "ROOT API KEY: $ROOT_KEY" >> ~/.youworker-admin-key
chmod 600 ~/.youworker-admin-key

echo "✓ Utente root creato: admin"
echo "✓ API key salvata in: ~/.youworker-admin-key"
```

---

## Verifica Installazione

### 1. Health Checks

```bash
# Verifica salute generale
curl -k https://localhost:8000/health

# Output atteso:
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "qdrant": "healthy",
    "ollama": "healthy",
    "mcp_servers": "5/5 healthy"
  }
}
```

### 2. Test API

```bash
# Test autenticazione
curl -k -X POST https://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "<ROOT_KEY>"}'

# Output atteso:
# Set-Cookie: youworker_token=...
```

### 3. Test Frontend

Apri browser e naviga a:
```
https://localhost:8000
```

Dovresti vedere la pagina di login di YouWorker.

### 4. Test Chat

```bash
# Crea nuova sessione
curl -k https://localhost:8000/v1/chat/new \
  -H "X-API-Key: <ROOT_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Chat"}'

# Output atteso:
{
  "id": 1,
  "external_id": "abc123...",
  "title": "Test Chat",
  "model": "gpt-oss:20b",
  "enable_tools": true
}
```

### 5. Test MCP Tools

```bash
# Lista tool disponibili
curl -k https://localhost:8000/v1/tools \
  -H "X-API-Key: <ROOT_KEY>"

# Output atteso:
{
  "tools": [
    {"name": "web.search", "server": "mcp_web", ...},
    {"name": "semantic.query", "server": "mcp_semantic", ...},
    ...
  ]
}
```

---

## Configurazione Post-Installazione

### 1. Configurare Backup Automatici

```bash
# Crea directory backup
mkdir -p /backup/youworker

# Aggiungi cron job
crontab -e

# Aggiungi (backup giornaliero alle 2 AM):
0 2 * * * cd /path/to/youworker && make backup BACKUP_DIR=/backup/youworker
```

### 2. Configurare Monitoring

```bash
# Accedi a Grafana
http://localhost:3001
# Username: admin
# Password: admin (cambiala al primo accesso)

# Aggiungi datasource Prometheus
# URL: http://prometheus:9090

# Importa dashboard pre-configurati
# Dashboard → Import → ops/grafana/dashboards/*.json
```

### 3. Configurare Log Rotation

```bash
# File: /etc/logrotate.d/youworker
/path/to/youworker/data/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        docker compose -f /path/to/youworker/ops/compose/docker-compose.yml restart api frontend
    endscript
}
```

### 4. Configurare Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 8000/tcp  # HTTPS YouWorker
sudo ufw enable

# iptables
sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Produzione vs Sviluppo

### Configurazione Sviluppo

```bash
# .env
APP_ENV=development
DEBUG=true
WHITELISTED_IPS=  # Disabilitato
AUTHENTIK_ENABLED=false

# Certificati self-signed OK
# Nessun backup automatico
# Log verbosi
```

**Avvio:**
```bash
docker compose -f ops/compose/docker-compose.yml up
# (senza -d per vedere log in console)
```

### Configurazione Produzione

```bash
# .env
APP_ENV=production
DEBUG=false
WHITELISTED_IPS=<IP-aziendali>
AUTHENTIK_ENABLED=true

# Certificati validi OBBLIGATORI
# Backup automatici
# Log strutturati
```

**Checklist Produzione:**

- [ ] Certificati SSL validi installati
- [ ] Password database cambiata
- [ ] ROOT_API_KEY unica generata
- [ ] CHAT_MESSAGE_ENCRYPTION_SECRET generato
- [ ] IP whitelisting configurato
- [ ] AUTHENTIK configurato e testato
- [ ] Backup automatici schedulati
- [ ] Monitoring Grafana configurato
- [ ] Firewall configurato
- [ ] Log rotation configurato
- [ ] Disaster recovery testato
- [ ] DNS configurato per dominio
- [ ] Health checks verificati
- [ ] Load testing eseguito

---

## Troubleshooting

### Problema: Container non parte

```bash
# Verifica log
docker compose -f ops/compose/docker-compose.yml logs <service>

# Riavvia servizio specifico
docker compose -f ops/compose/docker-compose.yml restart <service>

# Ricrea container
docker compose -f ops/compose/docker-compose.yml up -d --force-recreate <service>
```

### Problema: GPU non rilevata

```bash
# Verifica driver NVIDIA
nvidia-smi

# Verifica runtime Docker
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Se fallisce, reinstalla nvidia-container-toolkit
```

### Problema: Out of Memory

```bash
# Verifica utilizzo memoria
docker stats

# Aumenta memoria Docker (Docker Desktop)
# Settings → Resources → Memory → 8GB+

# Usa modelli più piccoli
CHAT_MODEL=llama2:7b  # Invece di gpt-oss:20b
```

### Problema: Database connection failed

```bash
# Verifica PostgreSQL è in running
docker ps | grep postgres

# Controlla password in .env
# DATABASE_URL deve coincidere con POSTGRES_PASSWORD

# Reset database (ATTENZIONE: cancella dati)
docker compose -f ops/compose/docker-compose.yml down -v
docker compose -f ops/compose/docker-compose.yml up -d postgres
make db-migrate
```

### Problema: Ollama timeout

```bash
# Aumenta timeout in .env
OLLAMA_TIMEOUT=600  # 10 minuti

# Verifica modelli scaricati
docker exec ollama ollama list

# Scarica modelli mancanti
docker exec ollama ollama pull <model>
```

---

## Aggiornamento

```bash
# Backup prima di aggiornare
make backup

# Pull nuove immagini
git pull
docker compose -f ops/compose/docker-compose.yml pull

# Rebuild immagini custom
make build

# Stop servizi
make compose-down

# Migrazione database (se necessario)
make db-migrate

# Riavvia servizi
make compose-up

# Verifica
curl -k https://localhost:8000/health
```

---

## Disinstallazione

```bash
# Backup dati (opzionale)
make backup

# Stop e rimozione container
make compose-down

# Rimozione volumi (ATTENZIONE: cancella tutti i dati)
docker compose -f ops/compose/docker-compose.yml down -v

# Rimozione immagini
docker images | grep youworker | awk '{print $3}' | xargs docker rmi

# Rimozione directory
cd ..
rm -rf youworker-fullstack
```

---

## Contatti e Supporto

**YouCo S.r.l.**
- Email: support@youco.it
- Telefono: +39 02 1234 5678
- Documentazione: https://docs.youco.it/youworker

---

**Installazione completata con successo!** 🎉
