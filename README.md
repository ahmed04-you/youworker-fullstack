# YouWorker

**Soluzione AI On-Premise di YouCo**

YouWorker è un agente AI avanzato, completamente locale e abilitato al Model Context Protocol (MCP), progettato per l'implementazione on-premise. Questa soluzione proprietaria di YouCo offre capacità di elaborazione intelligente mantenendo tutti i dati e le operazioni all'interno dell'infrastruttura aziendale.

## 📚 Documentazione

**Documentazione completa disponibile in `/docs`:**

- **[Panoramica](docs/README.md)** - Guida introduttiva e indice della documentazione
- **[Architettura](docs/ARCHITECTURE.md)** - Architettura del sistema, design patterns e componenti
- **[Guida Sviluppo](docs/DEVELOPMENT_GUIDE.md)** - Setup ambiente, workflow e best practices
- **[API Reference](docs/API_REFERENCE.md)** - Documentazione completa degli endpoint API
- **[Schema Database](docs/DATABASE_SCHEMA.md)** - Schema del database, relazioni e query
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Strategie di testing e copertura

**Documentazione API interattiva:** `http://localhost:8001/docs` (Swagger UI)

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
- **Supporto multimodale**: Input vocale (STT) e output vocale (TTS) tramite Piper con voce italiana "paola-medium"
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
- **Piper TTS**: Sintesi vocale italiana di alta qualità (modello "paola-medium")

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
                     ┌──────▼──────┐
                     │ Backend API │
                     │  (FastAPI)  │
                     │ Porta 8001  │
                     └──────┬──────┘
                            │
        ┌───────────────────┴─────────────┐
        │                                  │
┌───────▼────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────▼─────┐
│ Server MCP (4) │  │   Ollama     │  │   Qdrant     │  │  PostgreSQL  │
│ Porte 7001/02/ │  │  Porta 11434 │  │  Porta 6333  │  │  Porta 5432  │
│        03/05   │  └──────────────┘  └──────────────┘  └──────────────┘
```

### Server MCP

1. **Web MCP Server** (7001): Ricerca web, fetch pagine, crawling
2. **Semantic MCP Server** (7002): Ricerca semantica, RAG, similarità
3. **DateTime MCP Server** (7003): Gestione date, orari, timezone
4. **Units MCP Server** (7005): Conversioni unità di misura

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

- **API Health**: `http://localhost:8001/health`
- **API Documentation**: `http://localhost:8001/docs`

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
docker compose -f ops/compose/docker-compose.yml logs -f api
```

### Accesso all'API

1. **Autenticazione**: Ottieni un token API tramite AUTHENTIK
2. **API Documentation**: Accedi a `http://localhost:8001/docs` per la documentazione interattiva
3. **Health Check**: Verifica lo stato dei servizi con `http://localhost:8001/health`
4. **Endpoints**: Consulta la documentazione OpenAPI per tutti gli endpoint disponibili

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

# Logs specifici
docker logs -f youworker-api
docker logs -f youworker-mcp-web
```

---

## Sviluppo

### 📖 Guide per Sviluppatori

**Consulta la documentazione completa:**
- **[Guida Sviluppo](docs/DEVELOPMENT_GUIDE.md)** - Setup, workflow, code style
- **[Architettura](docs/ARCHITECTURE.md)** - Design patterns e componenti
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Strategie di test e best practices

### Setup Ambiente di Sviluppo

```bash
# Clone e setup
git clone <repository-url>
cd youworker-fullstack

# Virtual environment
python -m venv venv
source venv/bin/activate

# Installa dipendenze
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Per sviluppo

# Setup pre-commit hooks
pre-commit install

# Configura ambiente
cp .env.example .env
# Genera chiavi di sicurezza (vedi sezione Configurazione)

# Crea database
createdb youworker

# Avvia backend
uvicorn apps.api.main:app --reload --port 8001
```

### Testing

```bash
# Esegui tutti i test
pytest

# Test con coverage
pytest --cov=apps --cov=packages --cov-report=html

# Test specifici
pytest tests/unit/services/test_group_service.py

# Type checking
mypy apps/ packages/

# Linting e formatting
ruff check apps/ packages/
black apps/ packages/ tests/
```

### Architettura del Codice

YouWorker utilizza un'architettura a strati pulita:

```
┌─────────────────────────────────────┐
│    Presentation Layer (Routes)     │  ← HTTP/WebSocket endpoints
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│    Service Layer (Services)         │  ← Business logic
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│  Repository Layer (Repositories)    │  ← Data access
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│    Data Layer (SQLAlchemy Models)   │  ← Database schema
└─────────────────────────────────────┘
```

**Principi chiave:**
- ✅ Separation of Concerns (ogni layer ha una responsabilità)
- ✅ Dependency Injection (via FastAPI)
- ✅ Repository Pattern (astrazione accesso dati)
- ✅ Unit of Work Pattern (gestione transazioni)
- ✅ Type Safety (mypy strict mode)
- ✅ Test Coverage 80%+

### Struttura del Progetto

```
youworker-fullstack/
├── apps/                      # Applicazioni
│   └── api/                  # FastAPI backend
│       ├── routes/           # HTTP endpoints
│       │   ├── auth.py      # Autenticazione
│       │   ├── chat/        # Chat endpoints
│       │   ├── groups.py    # Gestione gruppi
│       │   ├── analytics/   # Analytics
│       │   └── ingestion.py # Ingestion documenti
│       ├── services/         # Business logic layer
│       │   ├── base.py
│       │   ├── chat_service.py
│       │   ├── group_service.py
│       │   ├── ingestion_service.py
│       │   └── account_service.py
│       ├── middleware/       # Custom middleware
│       ├── dependencies.py   # Dependency injection
│       └── main.py          # Entry point
│
├── packages/                  # Pacchetti condivisi
│   ├── db/                   # Database layer
│   │   ├── models/          # SQLAlchemy models (per dominio)
│   │   │   ├── user.py
│   │   │   ├── group.py
│   │   │   ├── chat.py
│   │   │   ├── document.py
│   │   │   └── tool.py
│   │   ├── repositories/    # Repository pattern
│   │   │   ├── base.py
│   │   │   ├── user_repository.py
│   │   │   ├── group_repository.py
│   │   │   ├── chat_repository.py
│   │   │   └── document_repository.py
│   │   ├── uow.py          # Unit of Work pattern
│   │   └── session.py      # Database session
│   │
│   ├── common/              # Utilities comuni
│   │   ├── config/         # Configurazione (per dominio)
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   ├── llm.py
│   │   │   └── api.py
│   │   ├── exceptions.py   # Custom exceptions
│   │   ├── logger.py       # Logging setup
│   │   └── settings.py     # Settings management
│   │
│   ├── agent/               # Agent framework
│   │   ├── loop.py         # Agent execution loop
│   │   └── registry.py     # MCP tool registry
│   │
│   ├── llm/                 # LLM integration
│   │   ├── client.py       # Ollama client
│   │   └── messages.py     # Message models
│   │
│   ├── vectorstore/         # Vector database
│   │   └── qdrant.py       # Qdrant client
│   │
│   └── ingestion/           # Document processing
│       ├── pipeline.py     # Orchestration
│       └── parsers/        # Parsers (PDF, OCR, audio)
│
├── tests/                    # Test suite
│   ├── unit/                # Unit tests (60%)
│   │   ├── services/
│   │   ├── repositories/
│   │   └── models/
│   ├── integration/         # Integration tests (30%)
│   └── e2e/                # End-to-end tests (10%)
│
├── docs/                    # Documentazione
│   ├── README.md           # Indice documentazione
│   ├── ARCHITECTURE.md     # Architettura
│   ├── DEVELOPMENT_GUIDE.md
│   ├── API_REFERENCE.md
│   ├── DATABASE_SCHEMA.md
│   └── TESTING_GUIDE.md
│
├── ops/                     # Operations
│   ├── docker/             # Dockerfile
│   ├── compose/            # Docker Compose
│   ├── alembic/            # DB migrations
│   └── scripts/            # Utility scripts
│
└── data/                    # Dati persistenti (gitignored)
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

### Restart Contenitori

```bash
# Riavvia API
docker compose -f ops/compose/docker-compose.yml restart api

# Riavvia Frontend
docker compose -f ops/compose/docker-compose.yml restart frontend
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

**Versione corrente**: 1.0.0-pre-release 🚧
**Status**: Pre-Release - Sviluppo in corso
**Data rilascio prevista**: Q1 2025
**Compatibilità**: AUTHENTIK 2023.10+

**Obiettivi v1.0 (in sviluppo):**
- 🚧 Architettura a strati pulita (Repository + Service + UoW patterns)
- 🚧 Dependency Injection completa
- 🚧 Type Safety con mypy strict mode
- 🚧 Test Coverage 80%+
- 🚧 Configurazione modulare per dominio
- 🚧 Audit logging completo
- ✅ Multi-tenancy con gruppi

**Note**: La v1.0 è in fase di sviluppo attivo. Vedi [BACKEND_REFACTORING_GUIDE.md](BACKEND_REFACTORING_GUIDE.md) per lo stato di avanzamento.

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
