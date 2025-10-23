# Guida al Deployment

## Checklist Deployment

Questo stack funziona su CPU con supporto GPU opzionale per Ollama. Prima di spostarlo su una nuova macchina, segui i passaggi sotto per evitare sorprese.

### 1. **Installa Docker + Compose plugin**
   - https://docs.docker.com/engine/install/ubuntu/
   - Abilita il servizio Docker e aggiungi il tuo utente al gruppo `docker`.

### 2. **Autenticati ai registri richiesti (se necessario)**
   - Le immagini referenziate in questo stack sono pubbliche di default.
   - Se le mirrouri o ospiti build private, fai login con credenziali che possano pull dal tuo registry.
   - Aggiorna `.env` o il file Compose per puntare ai nomi immagine custom quando richiesto.

### 3. **Clona il repo e copia l'ambiente**
   - `git clone <repo> && cd youworker-fullstack`
   - Crea un `.env` (vedi `apps/api/config.py` o `packages/common/settings.py` per i default). Adatta gli URL se i servizi girano su un altro host.
   - Aggiungi qualsiasi documento di esempio sotto `examples/ingestion/` sull'host; lo stack monta questa directory a `/data/examples` dentro il container API per test di ingestion.

### 4. **Build immagini**
   - `docker compose -f ops/compose/docker-compose.yml build`
   - Se build altrove e sposti immagini, precarica i modelli Ollama sull'host target:
     `docker compose run --rm ollama ollama pull gpt-oss:20b embeddinggemma:300m`.

### 5. **Avvia lo stack**
   - `docker compose -f ops/compose/docker-compose.yml up -d`
   - Il primo avvio scaricherà i modelli Ollama e può richiedere diversi minuti.

### 6. **Test ingestion documenti**
   - Metti file in `examples/ingestion/` (host).
   - Dentro lo stack, referenziali come `/data/examples/<filename>` quando chiami l'API ingestion.

### 7. **Backup e persistenza**
   - Dati Qdrant → volume named `qdrant_data`.
   - Modelli Ollama → volume named `ollama_data`. Fai snapshot di questi prima degli upgrade.

### 8. **Health check runtime**
   - Documentazione API: https://95.110.228.79:8001/docs
   - Sanity check SSE stream: `curl -N https://95.110.228.79:8001/v1/chat` con un payload di esempio.

## Opzionale: Supporto GPU per Ollama

Se vuoi accelerare Ollama con GPU:

### 1. **Installa driver NVIDIA**
   - Ubuntu: `sudo ubuntu-drivers autoinstall && sudo reboot`
   - Conferma con `nvidia-smi`.

### 2. **Installa NVIDIA Container Toolkit**
   - Segui https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
   - Imposta il runtime default di Docker o avvia il daemon con `nvidia-container-runtime`.
   - Test: `docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi`.

### 3. **Verifica visibilità GPU nel container Ollama**
   - `docker compose exec ollama nvidia-smi` per confermare che Ollama vede la GPU.

**Nota**: Document parsing (Docling), OCR (Tesseract), e trascrizione (Whisper) girano tutti su CPU solo per massima compatibilità e affidabilità.

Mantieni questa checklist con il tuo deployment runbook così ogni host viene provisioning identicamente.

## Configurazione HTTPS in Produzione

Per deployment in produzione, è necessario configurare HTTPS correttamente:

### 1. Certificati SSL

Il container Nginx genera automaticamente certificati self-signed al primo avvio. Per produzione:

```bash
# Crea directory per certificati
mkdir -p data/nginx/ssl

# Copia i tuoi certificati
cp your-cert.pem data/nginx/ssl/cert.pem
cp your-key.pem data/nginx/ssl/key.pem

# Imposta permessi corretti
chmod 644 data/nginx/ssl/cert.pem
chmod 600 data/nginx/ssl/key.pem
```

### 2. Configurazione Nginx

La configurazione nginx è già impostata per l'IP pubblico 95.110.228.79. Per un dominio custom, modifica `ops/compose/nginx.conf`:

```nginx
server {
    listen 8000 ssl;
    server_name tuo-dominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Altre configurazioni SSL...
}
```

### 3. Variabili Ambiente

Assicurati che `.env` contenga:

```bash
# Per frontend (già configurato per IP pubblico)
NEXT_PUBLIC_API_BASE_URL=https://95.110.228.79
FRONTEND_ORIGIN=https://95.110.228.79:8000,http://95.110.228.79:8000

# Per API
ROOT_API_KEY=chiave-forte-produzione
```

## Monitoring e Logging

### 1. Log Container

```bash
# View tutti i log
docker compose logs -f

# View log servizio specifico
docker compose logs -f api
docker compose logs -f frontend
```

### 2. Health Check

```bash
# Check salute tutti i servizi
curl https://95.110.228.79:8001/health

# Check servizi individuali
curl https://95.110.228.79:7001/health  # MCP Web
curl https://95.110.228.79:7002/health  # MCP Semantic
curl https://95.110.228.79:7003/health  # MCP Datetime
curl https://95.110.228.79:7004/health  # MCP Ingest
curl https://95.110.228.79:7005/health  # MCP Units
```

### 3. Metrics

Considera di implementare Prometheus/Grafana per monitoring:

```yaml
# Aggiungi a docker-compose.yml
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Troubleshooting Comune

### 1. Modelli Ollama Non Scaricati

```bash
# Check modelli disponibili
docker compose exec ollama ollama list

# Forza download
docker compose exec ollama ollama pull gpt-oss:20b
docker compose exec ollama ollama pull embeddinggemma:300m
```

### 2. Problemi GPU

```bash
# Check visibilità GPU
docker compose exec ollama nvidia-smi

# Senza GPU, imposta variabile
export ENABLE_GPU_TORCH=0
docker compose up -d --build
```

### 3. Problemi Connessione MCP

```bash
# Check health server MCP
curl https://95.110.228.79:7001/health
curl https://95.110.228.79:7002/health

# Check log MCP
docker compose logs mcp_web
docker compose logs mcp_semantic
```

### 4. Problemi Database

```bash
# Check connessione PostgreSQL
docker compose exec postgres psql -U postgres -d youworker -c "SELECT 1;"

# Reset database (ATTENZIONE: perde dati)
docker compose down -v
docker compose up -d
```

## Backup e Recovery

### 1. Backup Dati

```bash
# Backup Qdrant
docker compose exec qdrant tar -czf /tmp/qdrant-backup.tar.gz /qdrant/storage
docker cp $(docker compose ps -q qdrant):/tmp/qdrant-backup.tar.gz ./backups/

# Backup Ollama
docker compose exec ollama tar -czf /tmp/ollama-backup.tar.gz /root/.ollama
docker cp $(docker compose ps -q ollama):/tmp/ollama-backup.tar.gz ./backups/

# Backup PostgreSQL
docker compose exec postgres pg_dump -U postgres youworker > ./backups/postgres-backup.sql
```

### 2. Recovery Dati

```bash
# Recovery Qdrant
docker cp ./backups/qdrant-backup.tar.gz $(docker compose ps -q qdrant):/tmp/
docker compose exec qdrant tar -xzf /tmp/qdrant-backup.tar.gz -C /

# Recovery Ollama
docker cp ./backups/ollama-backup.tar.gz $(docker compose ps -q ollama):/tmp/
docker compose exec ollama tar -xzf /tmp/ollama-backup.tar.gz -C /

# Recovery PostgreSQL
docker compose exec -T postgres psql -U postgres youworker < ./backups/postgres-backup.sql
```

## Performance Tuning

### 1. Ollama

```bash
# Aumenta contesto modello
OLLAMA_MAX_LOADED_MODELS=3

# Imposta numero thread
OLLAMA_NUM_PARALLEL=2
```

### 2. Qdrant

```bash
# Aumenta memoria per vettori
QDRANT__SERVICE__MAX_RESULT_SIZE_MB=512

# Optimizza per performance
QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4
```

### 3. PostgreSQL

```bash
# Optimizza per workload
POSTGRES_SHARED_PRELOAD_LIBRARIES=pg_stat_statements
POSTGRES_MAX_CONNECTIONS=200
```

Questa guida copre gli aspetti principali del deployment. Per problemi specifici, consulta i log dei singoli servizi o la documentazione ufficiale dei componenti utilizzati.