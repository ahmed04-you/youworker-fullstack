# YouWorker

**Soluzione AI On-Premise di YouCo**

YouWorker è un agente AI avanzato, completamente locale e abilitato al Model Context Protocol (MCP), progettato per l'implementazione on-premise. Questa soluzione proprietaria di YouCo offre capacità di elaborazione intelligente mantenendo tutti i dati e le operazioni all'interno dell'infrastruttura aziendale.

---

## Caratteristiche Principali

### 🏢 Completamente On-Premise
- **Esecuzione locale al 100%**: Tutti i modelli AI, database e servizi sono ospitati localmente
- **Nessuna dipendenza da cloud**: Tranne le ricerche web opzionali, tutto rimane nella vostra infrastruttura
- **Controllo completo dei dati**: I vostri dati non lasciano mai i vostri server

### 🔐 Integrazione AUTHENTIK
- **Autenticazione centralizzata**: AUTHENTIK gestisce tutta l'autenticazione utente
- **Gestione API key**: Le chiavi API vengono create e gestite tramite AUTHENTIK
- **Single Sign-On (SSO)**: Integrazione perfetta con l'identità aziendale esistente
- **Controllo accessi**: Gestione avanzata di utenti, gruppi e permessi

### 🤖 Capacità AI Avanzate
- **Chat intelligente**: Conversazioni con LLM (Large Language Models) locali
- **Ricerca semantica**: Indicizzazione vettoriale con Qdrant per recupero intelligente di documenti
- **RAG (Retrieval-Augmented Generation)**: Risposte AI basate sulla vostra documentazione
- **Supporto multimodale**: Input vocale (STT) e output vocale (TTS)
- **Streaming in tempo reale**: WebSocket per risposte AI fluide

### 🛠️ Architettura Basata su MCP
- **5 server MCP specializzati**: Web, Semantica, DateTime, Ingestion, Conversioni
- **15+ strumenti**: Ricerca web, estrazione dati, elaborazione documenti, calcoli
- **Estensibile**: Architettura modulare per aggiungere nuovi strumenti facilmente
- **Protocollo standard**: Implementazione completa del Model Context Protocol

### 📄 Gestione Documenti
- **Ingestion avanzata**: Supporto per PDF, Word, Excel, PowerPoint, HTML, testo
- **OCR integrato**: Estrazione testo da immagini con Tesseract
- **Chunking intelligente**: Suddivisione ottimizzata per ricerca semantica
- **Metadati e tag**: Organizzazione e ricerca avanzata dei documenti

### 📊 Analytics e Monitoraggio
- **Usage analytics**: Tracciamento utilizzo strumenti, sessioni, token persistito in PostgreSQL
- **Logging strutturato**: Log centralizzati per debugging e audit

### 🔒 Sicurezza Enterprise
- **Crittografia messaggi**: Tutti i messaggi chat sono crittografati con Fernet (AES-128)
- **JWT HttpOnly cookies**: Protezione contro XSS
- **CSRF protection**: Token anti-forgery per tutte le operazioni critiche
- **IP whitelisting**: Restrizione accesso per IP in produzione
- **Rate limiting**: Protezione contro abuso delle API
- **Sanitizzazione input**: Prevenzione XSS e injection

---

## Stack Tecnologico

### Backend
- **FastAPI**: Framework web asincrono ad alte prestazioni
- **Python 3.11+**: Linguaggio principale per backend e servizi
- **PostgreSQL 15**: Database relazionale per dati strutturati
- **SQLAlchemy 2.0**: ORM con supporto async
- **Alembic**: Gestione migrazioni database

### AI & Machine Learning
- **Ollama**: Runtime LLM locale con accelerazione GPU
- **Qdrant**: Database vettoriale per embeddings
- **Docling**: Estrazione avanzata di contenuto da documenti
- **Faster-Whisper**: Speech-to-text (modello OpenAI Whisper)
- **Piper TTS**: Text-to-speech di alta qualità

### Frontend
- **Next.js 16**: Framework React con rendering lato server
- **React 19**: Libreria UI con ultime funzionalità
- **TypeScript 5**: Type safety completa
- **Tailwind CSS**: Styling utility-first
- **Radix UI**: Componenti accessibili (WCAG AA)
- **Zustand**: State management leggero
- **TanStack Query**: Data fetching e caching

### Infrastruttura
- **Docker & Docker Compose**: Containerizzazione e orchestrazione

---

## Architettura di Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTIK                                 │
│              (Autenticazione & API Keys)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                     ┌──────┴──────┐
                     │             │
              ┌──────▼──────┐ ┌────▼────────────┐
              │   Frontend   │ │   Backend API   │
              │  (Next.js)   │◄┤   (FastAPI)     │
              │  Porta 3000  │ │   Porta 8001    │
              └──────────────┘ └────────┬────────┘
                                        │
        ┌───────────────────────────────┴─────────────┐
        │                                               │
┌───────▼────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────▼─────┐
│ Server MCP (5) │  │   Ollama     │  │   Qdrant     │  │  PostgreSQL  │
│  Porte 7001-05 │  │  Porta 11434 │  │  Porta 6333  │  │  Porta 5432  │
└────────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Server MCP

1. **Web MCP Server** (7001): Ricerca web, fetch pagine, crawling
2. **Semantic MCP Server** (7002): Ricerca semantica, RAG, similarità
3. **DateTime MCP Server** (7003): Gestione date, orari, timezone
4. **Ingest MCP Server** (7004): Ingestion documenti da URL o filesystem
5. **Units MCP Server** (7005): Conversioni unità di misura

---

## Installazione Rapida

### Prerequisiti

- **Docker & Docker Compose**: v24.0 o superiore
- **GPU NVIDIA** (consigliata): Per accelerazione LLM con CUDA
- **8GB RAM minimo**: 16GB+ consigliati per modelli AI grandi
- **50GB spazio disco**: Per modelli, database, documenti
- **Linux**: Ubuntu 22.04+ o simile (testato)

### Passo 1: Clone del Repository

```bash
git clone https://github.com/youco/youworker-fullstack.git
cd youworker-fullstack
```

### Passo 2: Configurazione Ambiente

```bash
# Copia il template delle variabili d'ambiente
cp .env.example .env

# Genera le chiavi segrete (OBBLIGATORIO)
openssl rand -hex 32  # ROOT_API_KEY
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # CSRF_SECRET
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # CHAT_MESSAGE_ENCRYPTION_SECRET

# Modifica .env con le chiavi generate
nano .env
```

**Variabili critiche da configurare:**

```bash
# Sicurezza (OBBLIGATORIO)
ROOT_API_KEY=<chiave-generata-1>
JWT_SECRET=<chiave-generata-2>
CSRF_SECRET=<chiave-generata-3>
CHAT_MESSAGE_ENCRYPTION_SECRET=<chiave-fernet>

# AUTHENTIK
AUTHENTIK_ENABLED=true
AUTHENTIK_HEADER_NAME=X-Authentik-Api-Key
AUTHENTIK_URL=https://auth.tuazienda.it

# Network
FRONTEND_ORIGIN=https://youworker.tuazienda.it
NEXT_PUBLIC_API_BASE_URL=https://youworker.tuazienda.it:8000
WHITELISTED_IPS=10.0.0.0/8,192.168.0.0/16

# Modelli AI (personalizzabili)
CHAT_MODEL=gpt-oss:20b
EMBED_MODEL=embeddinggemma:300m
```

### Passo 3: Avvio dei Servizi

```bash
# Build delle immagini Docker
make build

# Avvio di tutti i servizi
make compose-up

# Verifica che tutti i container siano avviati
docker ps

# Visualizza i log
make compose-logs
```

### Passo 4: Download Modelli AI

```bash
# Scarica i modelli LLM necessari (può richiedere tempo)
make pull-models

# Oppure manualmente:
docker exec -it ollama ollama pull gpt-oss:20b
docker exec -it ollama ollama pull embeddinggemma:300m
```

### Passo 5: Inizializzazione Database

```bash
# Esegui le migrazioni del database
make db-migrate

# Verifica connessione
docker exec -it postgres psql -U youworker -d youworker -c "\dt"
```

### Passo 6: Verifica Installazione

Apri il browser e naviga a:

- **Frontend**: `http://localhost:3000`
- **API Health**: `http://localhost:8001/health`

---

## Configurazione AUTHENTIK

YouWorker si integra con AUTHENTIK per autenticazione e gestione API key. Vedi [docs/AUTHENTIK.md](docs/AUTHENTIK.md) per la guida completa.

### Configurazione Base

1. **Crea un'applicazione in AUTHENTIK** per YouWorker
2. **Configura l'outpost proxy** per forwarding degli header
3. **Imposta l'header custom**: `X-Authentik-Api-Key`
4. **Configura le policy** di accesso per gruppi/utenti
5. **Genera API key** per ogni utente autorizzato

### Flusso di Autenticazione

```
┌────────┐          ┌─────────────┐          ┌─────────────┐
│ Client │          │  AUTHENTIK  │          │  YouWorker  │
└────┬───┘          └──────┬──────┘          └──────┬──────┘
     │                     │                        │
     │  1. Login Request   │                        │
     ├────────────────────►│                        │
     │                     │                        │
     │  2. Authentication  │                        │
     │◄────────────────────┤                        │
     │  (Cookie + API Key) │                        │
     │                     │                        │
     │  3. Request + Header│                        │
     │  X-Authentik-Api-Key│                        │
     ├────────────────────────────────────────────► │
     │                     │                        │
     │                     │  4. Validate API Key   │
     │                     │  (Header forwarding)   │
     │                     │                        │
     │                     │  5. Create JWT Session │
     │◄────────────────────────────────────────────┤
     │  (HttpOnly Cookie)  │                        │
```

---

## Uso

### Avvio e Stop

```bash
# Avvia tutti i servizi
make compose-up

# Stop tutti i servizi
make compose-down

# Restart di un servizio specifico
docker compose -f ops/compose/docker-compose.yml restart api

# Visualizza log in tempo reale
docker compose -f ops/compose/docker-compose.yml logs -f api frontend
```

### Accesso all'Interfaccia

1. **Autenticazione**: Accedi tramite AUTHENTIK
2. **Nuova chat**: Clicca su "Nuova Conversazione"
3. **Upload documenti**: Sezione "Documenti" → "Carica"
4. **Ricerca semantica**: Usa `@docs` nella chat per interrogare i documenti
5. **Strumenti**: Gli strumenti MCP sono invocati automaticamente dall'AI

### Comandi Utili

```bash
# Backup database
make backup

# Ripristino da backup
make restore BACKUP_FILE=backup-2025-01-15.sql.gz

# Pulizia volumi (ATTENZIONE: cancella tutti i dati)
make clean-volumes

# Aggiornamento dipendenze
cd apps/api && poetry update
cd apps/frontend && npm update

# Logs specifici
docker logs -f youworker-api
docker logs -f youworker-mcp-web
docker logs -f youworker-frontend
```

---

## Sviluppo

Vedi [docs/SVILUPPO.md](docs/SVILUPPO.md) per la guida completa allo sviluppo.

### Setup Ambiente di Sviluppo

```bash
# Backend (Python)
cd apps/api
poetry install
poetry shell
uvicorn main:app --reload --port 8001

# Frontend (Node.js)
cd apps/frontend
npm install
npm run dev

# MCP Server
cd apps/mcp_servers/web
poetry install
python -m web.server
```

### Testing

```bash
# Test Python
make test
pytest tests/ -v

# Test Frontend
cd apps/frontend
npm test              # Vitest (unit)
npm run test:e2e      # Playwright (E2E)
npm run test:coverage # Coverage report

# Linting
make lint
make format
```

### Struttura del Progetto

```
youworker-fullstack/
├── apps/                      # Applicazioni
│   ├── frontend/             # Next.js frontend
│   ├── api/                  # FastAPI backend
│   └── mcp_servers/          # Server MCP
│       ├── web/              # Strumenti web
│       ├── semantic/         # Ricerca semantica
│       ├── datetime/         # Utilità date
│       ├── ingest/           # Ingestion documenti
│       └── units/            # Conversioni
├── packages/                  # Pacchetti Python condivisi
│   ├── common/               # Impostazioni e utilità
│   ├── db/                   # Modelli database
│   ├── vectorstore/          # Client Qdrant
│   ├── llm/                  # Client Ollama
│   ├── mcp/                  # Client MCP
│   ├── agent/                # Loop agente AI
│   ├── parsers/              # Parser documenti
│   └── ingestion/            # Pipeline ingestion
├── ops/                       # Operazioni e deployment
│   ├── compose/              # Docker Compose
│   ├── docker/               # Dockerfile
│   ├── alembic/              # Migrazioni DB
│   ├── scripts/              # Script utilità
│   └── cron/                 # Task schedulati
├── docs/                      # Documentazione
├── tests/                     # Test Python
└── data/                      # Dati persistenti (gitignored)
```

---

## Monitoraggio e Troubleshooting

### Health Checks

```bash
# Salute generale
curl http://localhost:8001/health

# Stato server MCP
curl http://localhost:8001/health/mcp

# Stato Ollama e modelli
curl http://localhost:8001/health/ollama

# Stato Qdrant
curl http://localhost:8001/health/qdrant

# Stato PostgreSQL
curl http://localhost:8001/health/postgres
```

### Log Analysis

```bash
# Errori API
docker logs youworker-api 2>&1 | grep ERROR

# Errori MCP
docker logs youworker-mcp-web 2>&1 | grep ERROR

# Errori Frontend
docker logs youworker-frontend 2>&1 | grep ERROR

# Log strutturati (JSON)
docker logs youworker-api --tail 100 | jq '.level, .message, .exc_info'
```

### Problemi Comuni

**Problema**: Ollama non risponde
```bash
# Verifica stato
docker logs ollama
curl http://localhost:11434/api/tags

# Restart
docker restart ollama
```

**Problema**: Errore connessione Qdrant
```bash
# Verifica collezioni
curl http://localhost:6333/collections

# Ricrea collezione
docker exec -it youworker-api python -m scripts.init_qdrant
```

**Problema**: Autenticazione fallita
```bash
# Verifica variabili ambiente
docker exec youworker-api env | grep AUTH

# Test API key
curl -H "X-API-Key: YOUR_KEY" http://localhost:8001/v1/auth/me
```

---

## Sicurezza

### Best Practices

1. **Cambia tutte le password di default** in `.env`
2. **Genera chiavi segrete uniche** per ogni installazione
3. **Abilita IP whitelisting** in produzione
4. **Usa certificati SSL validi** (non autofirmati)
5. **Configura firewall** per limitare accesso alle porte
6. **Abilita backup automatici** crittografati
7. **Monitora i log** per attività sospette
8. **Aggiorna regolarmente** dipendenze e immagini Docker
9. **Testa la disaster recovery** periodicamente
10. **Documenta le configurazioni** di sicurezza

### Compliance

YouWorker è progettato per conformità:

- **GDPR**: Tutti i dati rimangono on-premise
- **ISO 27001**: Crittografia, accesso controllato, audit log
- **WCAG AA**: Interfaccia accessibile
- **OWASP Top 10**: Mitigazione vulnerabilità comuni

---

## Performance e Scalabilità

### Ottimizzazioni

- **GPU acceleration**: Ollama utilizza CUDA per inferenza veloce
- **Connection pooling**: PostgreSQL e Qdrant
- **Response caching**: TanStack Query nel frontend
- **WebSocket streaming**: Riduce latenza percepita
- **Lazy loading**: Componenti frontend caricati on-demand
- **Index optimization**: Database indicizzato per query veloci

### Requisiti Hardware

**Minimo (test/sviluppo):**
- CPU: 4 core
- RAM: 8GB
- GPU: Nessuna (CPU inference lenta)
- Disco: 50GB

**Consigliato (produzione):**
- CPU: 8+ core
- RAM: 32GB
- GPU: NVIDIA RTX 4090 o superiore (24GB VRAM)
- Disco: 500GB SSD NVMe

**Enterprise (alto carico):**
- CPU: 16+ core
- RAM: 64GB+
- GPU: Multipli NVIDIA A100 (40GB/80GB)
- Disco: 1TB+ NVMe RAID

---

## Licenza e Supporto

### Proprietà

**YouWorker** è un prodotto proprietario di **YouCo S.r.l.**

Tutti i diritti riservati © 2025 YouCo S.r.l.

### Supporto

Per supporto tecnico, contatta:

- **Email**: support@youco.it
- **Telefono**: +39 02 1234 5678
- **Ticketing**: https://support.youco.it

### Versione

**Versione corrente**: 1.0.0
**Data rilascio**: Gennaio 2025
**Compatibilità**: AUTHENTIK 2023.10+

---

## Roadmap

### Prossime Funzionalità

- [ ] **Multi-tenancy**: Supporto per più organizzazioni
- [ ] **Mobile app**: Applicazione iOS/Android nativa
- [ ] **Advanced RAG**: Graph RAG e retrieval ibrido
- [ ] **Model fine-tuning**: Fine-tuning modelli su dati aziendali
- [ ] **Collaboration**: Chat condivise e annotazioni
- [ ] **API gateway**: Rate limiting avanzato e analytics
- [ ] **Backup cloud**: Backup opzionali su S3-compatible storage
- [ ] **Audit completo**: Log immutabili per compliance

---

## Contatti

**YouCo S.r.l.**
Via Roma 123, 20121 Milano, Italia
P.IVA: IT12345678901

**Web**: https://youco.it
**Email**: info@youco.it
**Sales**: sales@youco.it

---

**Costruito con ❤️ da YouCo per un AI sicuro e privato.**
