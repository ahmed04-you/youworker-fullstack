# Architettura di YouWorker

Questo documento descrive l'architettura tecnica di YouWorker, un agente AI on-premise sviluppato da YouCo.

---

## Panoramica

YouWorker è un sistema distribuito basato su microservizi, progettato per funzionare completamente on-premise. L'architettura segue i principi di:

- **Separazione delle responsabilità**: Ogni servizio ha uno scopo specifico
- **Scalabilità orizzontale**: I servizi possono essere replicati
- **Resilienza**: Gestione errori e retry automatici
- **Osservabilità**: Logging, metriche e tracing completi
- **Sicurezza**: Defense-in-depth con multipli livelli di protezione

---

## Diagramma di Alto Livello

```
┌──────────────────────────────────────────────────────────────────┐
│                         AUTHENTIK                                 │
│            (Identity Provider & API Key Management)               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Header forwarding
                             │ X-Authentik-Api-Key
┌────────────────────────────▼─────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                        │
│  - Terminazione SSL/TLS                                           │
│  - Load balancing                                                 │
│  - Header injection                                               │
│  - Rate limiting (primo livello)                                  │
└────────┬────────────────────────────────────┬─────────────────────┘
         │                                    │
         │ /                                  │ /v1/*
         │ /_next/*                           │ /health
         │ /api/*                             │ /chat/*
         │                                    │
┌────────▼────────┐                  ┌────────▼────────────────────┐
│   FRONTEND      │                  │      BACKEND API            │
│   (Next.js 16)  │                  │      (FastAPI)              │
│                 │                  │                             │
│ - React 19      │◄────────────────►│ - REST API                  │
│ - SSR/SSG       │  HTTP/WebSocket  │ - WebSocket streaming       │
│ - TypeScript    │                  │ - Async/await               │
│ - Tailwind      │                  │ - Python 3.11+              │
│                 │                  │                             │
│ Port: 3000      │                  │ Port: 8001                  │
└─────────────────┘                  └──────────┬──────────────────┘
                                                │
                         ┌──────────────────────┼────────────────┐
                         │                      │                │
                         │                      │                │
                ┌────────▼─────┐      ┌────────▼──────┐  ┌──────▼──────┐
                │ MCP SERVERS  │      │    OLLAMA     │  │  PostgreSQL │
                │  (5 servizi) │      │               │  │             │
                │              │      │ - LLM Runtime │  │ - Users     │
                │ Web (7001)   │      │ - GPU accel.  │  │ - Sessions  │
                │ Semantic     │      │ - Models      │  │ - Messages  │
                │  (7002)      │      │               │  │ - Documents │
                │ DateTime     │      │ Port: 11434   │  │             │
                │  (7003)      │      └───────────────┘  │ Port: 5432  │
                │ Ingest       │                         └─────────────┘
                │  (7004)      │                │
                │ Units        │      ┌─────────▼──────┐
                │  (7005)      │      │     QDRANT     │
                │              │      │                │
                └──────────────┘      │ - Embeddings   │
                                      │ - Collections  │
                                      │ - HNSW index   │
                                      │                │
                                      │ Port: 6333     │
                                      └────────────────┘
```

---

## Componenti Principali

### 1. AUTHENTIK (Esterno)

**Responsabilità:**
- Autenticazione utenti (login/logout)
- Gestione identità (LDAP, OAuth, SAML)
- Generazione e validazione API key
- Single Sign-On (SSO)
- Gestione gruppi e permessi

**Integrazione con YouWorker:**
- Header forwarding: `X-Authentik-Api-Key`
- Proxy outpost davanti a NGINX
- Validazione API key nel backend
- Mapping utenti automatico

**Configurazione:**
Vedi [AUTHENTIK.md](AUTHENTIK.md) per dettagli.

---

### 2. NGINX (Reverse Proxy)

**Responsabilità:**
- Terminazione SSL/TLS
- Routing richieste tra frontend e backend
- Compressione gzip
- Caching statico
- Rate limiting di primo livello
- Header di sicurezza

**Configurazione:**
File: `ops/docker/nginx/nginx.conf`

**Routing:**
```
/                   → Frontend (Next.js)
/_next/*            → Frontend (assets statici)
/api/*              → Frontend (API routes)
/v1/*               → Backend API (REST)
/chat/*             → Backend API (WebSocket)
/health             → Backend API (health checks)
```

**SSL/TLS:**
- Certificati in `ops/docker/nginx/certs/`
- TLS 1.2+ obbligatorio
- Cipher suite sicure (Mozilla Modern)
- HSTS abilitato

**Performance:**
- Worker processes: Auto (numero CPU)
- Keepalive: 65s
- Client body size: 100MB (upload documenti)
- Proxy buffering: Abilitato

---

### 3. Frontend (Next.js)

**Architettura:**
```
apps/frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Layout radice
│   │   ├── page.tsx           # Homepage
│   │   ├── chat/              # Interfaccia chat
│   │   ├── documents/         # Gestione documenti
│   │   ├── analytics/         # Dashboard analytics
│   │   ├── sessions/          # Storico conversazioni
│   │   └── settings/          # Impostazioni utente
│   │
│   ├── features/              # Moduli feature
│   │   ├── chat/
│   │   │   ├── components/   # Componenti UI
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── stores/       # Zustand stores
│   │   │   └── types/        # TypeScript types
│   │   ├── documents/
│   │   ├── analytics/
│   │   └── onboarding/
│   │
│   ├── components/            # Componenti condivisi
│   │   ├── ui/               # Radix UI wrappers
│   │   ├── dialogs/          # Modal dialogs
│   │   ├── layouts/          # Layout components
│   │   └── providers/        # Context providers
│   │
│   ├── hooks/                 # Hooks globali
│   ├── lib/                   # Utilities
│   ├── services/              # API clients
│   └── styles/                # Stili globali
```

**Pattern Architetturali:**

1. **Feature-based organization**: Ogni feature è un modulo autonomo
2. **Compound components**: Componenti composibili (es. `Dialog.Root`, `Dialog.Content`)
3. **Render props & hooks**: Logica riutilizzabile
4. **Server components**: SSR per SEO e performance
5. **Optimistic updates**: UI reattiva con TanStack Query

**State Management:**

- **Zustand**: State globale leggero
  - Chat store: Stato conversazioni
  - UI store: Sidebar, modali, tema
  - User store: Dati utente

- **TanStack Query**: Server state
  - Caching automatico
  - Invalidazione intelligente
  - Optimistic updates
  - Retry e stale-while-revalidate

- **React Context**: Providers specializzati
  - Theme provider (dark/light)
  - Auth provider (sessione utente)
  - Toast provider (notifiche)

**Comunicazione con Backend:**

```typescript
// HTTP (REST)
import { apiClient } from '@/services/api'
const sessions = await apiClient.get('/v1/chat/sessions')

// WebSocket (Streaming chat)
const ws = new WebSocket(`wss://${host}/chat/${sessionId}`)
ws.send(JSON.stringify({
  type: 'message',
  content: 'Ciao!',
  model: 'gpt-oss:20b',
  enable_tools: true
}))

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.event === 'token') {
    // Streaming di token
  } else if (data.event === 'tool') {
    // Esecuzione tool
  } else if (data.event === 'done') {
    // Completamento
  }
}
```

**Accessibilità (WCAG AA):**
- Navigazione tastiera completa
- Screen reader support
- Contrasto colori conforme
- Focus management
- ARIA labels e roles

---

### 4. Backend API (FastAPI)

**Architettura:**
```
apps/api/
├── main.py                    # Entry point ASGI
├── routers/                   # Endpoint gruppi
│   ├── auth.py               # /v1/auth/*
│   ├── chat.py               # /v1/chat/* e /chat/{id}
│   ├── documents.py          # /v1/documents/*
│   ├── ingestion.py          # /v1/ingestion/*
│   ├── analytics.py          # /v1/analytics/*
│   └── account.py            # /v1/account/*
├── middleware/                # Middleware personalizzati
│   ├── auth.py               # JWT/API key validation
│   ├── cors.py               # CORS configuration
│   ├── csrf.py               # CSRF protection
│   ├── rate_limit.py         # Rate limiting
│   └── logging.py            # Request/response logging
├── services/                  # Business logic
│   ├── auth_service.py       # Autenticazione
│   ├── chat_service.py       # Gestione chat
│   ├── agent_service.py      # Loop agente AI
│   └── ingestion_service.py  # Pipeline ingestion
└── utils/                     # Utilità
```

**Pattern Architetturali:**

1. **Dependency Injection**: FastAPI dependencies per DB, auth, rate limiting
2. **Async/await**: Operazioni I/O non bloccanti
3. **Repository pattern**: Separazione logica DB (in `packages/db`)
4. **Service layer**: Business logic separata dai router
5. **DTO/Pydantic models**: Validazione input/output

**Autenticazione:**

```python
from fastapi import Depends, HTTPException
from middleware.auth import get_current_user

@router.get("/protected")
async def protected_route(user: User = Depends(get_current_user)):
    return {"user": user.username}
```

Flusso:
1. **Request** con Cookie o Header `X-API-Key`
2. **Middleware** estrae token
3. **Validazione** JWT o API key
4. **Caricamento utente** da DB
5. **Iniezione** nei route handlers

**WebSocket Chat:**

```python
@router.websocket("/chat/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    try:
        # Autenticazione
        user = await authenticate_websocket(websocket)

        # Loop messaggi
        async for message in websocket.iter_text():
            data = json.loads(message)

            # Agent loop con streaming
            async for chunk in agent_service.stream_response(
                session_id=session_id,
                message=data['content'],
                user=user
            ):
                await websocket.send_json(chunk)

    except WebSocketDisconnect:
        logger.info("Client disconnected")
```

**Rate Limiting:**

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/v1/chat/new")
@limiter.limit("10/minute")  # Max 10 richieste/minuto
async def create_session(request: Request):
    ...
```

**Metriche Prometheus:**

```python
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app, endpoint="/metrics")
```

Metriche esposte:
- `http_request_duration_seconds`: Latenza richieste
- `http_requests_total`: Conteggio richieste
- `http_requests_in_progress`: Richieste concorrenti

---

### 5. Server MCP (Model Context Protocol)

**Architettura Comune:**

Tutti i server MCP condividono la stessa struttura:

```
apps/mcp_servers/<name>/
├── <name>/
│   ├── __init__.py
│   ├── server.py          # Entrypoint WebSocket
│   ├── tools/             # Implementazione tool
│   │   ├── __init__.py
│   │   ├── tool1.py
│   │   └── tool2.py
│   └── utils/             # Utilità specifiche
├── pyproject.toml
└── README.md
```

**Protocollo MCP (JSON-RPC 2.0):**

1. **Initialize** (handshake):
```json
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "1.0",
    "clientInfo": {"name": "youworker-api", "version": "1.0.0"}
  }
}

// Server → Client
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "1.0",
    "serverInfo": {"name": "mcp-web", "version": "1.0.0"},
    "capabilities": {"tools": {}}
  }
}
```

2. **Tools List** (discovery):
```json
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

// Server → Client
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "search",
        "description": "Search the web with DuckDuckGo",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {"type": "string", "description": "Search query"}
          },
          "required": ["query"]
        }
      }
    ]
  }
}
```

3. **Tool Call** (execution):
```json
// Client → Server
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {"query": "FastAPI tutorial"}
  }
}

// Server → Client (success)
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Top 5 results:\n1. ..."
      }
    ]
  }
}

// Server → Client (error)
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32000,
    "message": "Search failed",
    "data": {"details": "..."}
  }
}
```

**Server MCP Specifici:**

#### 5.1 Web MCP Server (7001)

**Tools:**
- `search(query, max_results)`: DuckDuckGo search
- `fetch(url, timeout)`: Scarica contenuto pagina
- `head(url)`: Metadata HTTP HEAD
- `extract_readable(url)`: Estrai articolo (readability)
- `crawl(start_url, max_pages, same_domain)`: Crawler multi-pagina

**Sicurezza:**
- Blocco URL interni (SSRF protection)
- Timeout configurabili
- User-Agent custom
- Rispetto robots.txt

#### 5.2 Semantic MCP Server (7002)

**Tools:**
- `query(text, collection, top_k, min_score)`: Ricerca semantica
- `answer(question, collection, top_k)`: RAG con citazioni
- `similar_to_text(text, collection, top_k)`: Trova simili
- `collections()`: Lista collezioni disponibili

**Integrazione:**
- Client Qdrant (`packages/vectorstore`)
- Embeddings via Ollama
- Re-ranking opzionale

#### 5.3 DateTime MCP Server (7003)

**Tools:**
- `now(timezone)`: Orario corrente
- `format(timestamp, format, timezone)`: Formattazione
- `add(start, years, months, days, hours, ...)`: Delta temporale
- `parse_natural(text, timezone)`: Parse linguaggio naturale

**Libreria:**
- Python `datetime` + `zoneinfo`
- `dateutil` per parsing flessibile

#### 5.4 Ingest MCP Server (7004)

**Tools:**
- `url(url, collection, tags, recursive)`: Ingest da URL
- `path(path, collection, tags, recursive, glob)`: Ingest filesystem
- `status(run_id)`: Stato ingestion

**Pipeline:**
1. Fetch/load documento
2. Parse (Docling, PyPDF, ecc.)
3. Chunk (intelligente, con overlap)
4. Embed (Ollama)
5. Store (Qdrant)
6. Metadata (PostgreSQL)

#### 5.5 Units MCP Server (7005)

**Tools:**
- `convert(value, from_unit, to_unit)`: Conversione unità

**Libreria:**
- `Pint` per conversioni
- Supporto per centinaia di unità

---

### 6. Ollama (LLM Runtime)

**Responsabilità:**
- Hosting modelli LLM localmente
- Inferenza con accelerazione GPU (CUDA)
- Gestione cache modelli
- API REST per completion ed embeddings

**Modelli Configurabili:**
```bash
# Chat model (esempio)
CHAT_MODEL=gpt-oss:20b         # 20 miliardi parametri
# Embedding model
EMBED_MODEL=embeddinggemma:300m # 300 milioni parametri
```

**API Usage:**

```python
# Chat completion
import httpx

response = await httpx.post(
    "http://ollama:11434/api/chat",
    json={
        "model": "gpt-oss:20b",
        "messages": [
            {"role": "user", "content": "Ciao!"}
        ],
        "stream": True
    },
    timeout=300
)

async for line in response.aiter_lines():
    chunk = json.loads(line)
    print(chunk['message']['content'])

# Embeddings
response = await httpx.post(
    "http://ollama:11434/api/embeddings",
    json={
        "model": "embeddinggemma:300m",
        "prompt": "Testo da embeddare"
    }
)
embeddings = response.json()['embedding']  # List[float]
```

**GPU Acceleration:**

Docker Compose configura:
```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Runtime: `nvidia-container-runtime`

---

### 7. Qdrant (Vector Database)

**Responsabilità:**
- Storage embeddings vettoriali
- Ricerca semantica HNSW
- Filtraggio per metadata
- Persistenza su disco

**Collection Schema:**

```python
{
  "name": "documents",
  "config": {
    "params": {
      "vectors": {
        "size": 768,  # Dimensione embedding
        "distance": "Cosine"
      }
    },
    "optimizer_config": {
      "memmap_threshold": 20000
    }
  }
}
```

**Payload (metadata):**
```python
{
  "id": "uuid",
  "uri": "https://example.com/doc.pdf",
  "path": "/uploads/doc.pdf",
  "collection": "documents",
  "tags": ["technical", "manual"],
  "chunk_index": 0,
  "total_chunks": 10,
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Query Example:**

```python
from qdrant_client import QdrantClient

client = QdrantClient(url="http://qdrant:6333")

results = client.search(
    collection_name="documents",
    query_vector=embedding,  # [768 float]
    limit=10,
    score_threshold=0.7,
    query_filter={
        "must": [
            {"key": "tags", "match": {"value": "technical"}}
        ]
    }
)

for result in results:
    print(f"Score: {result.score}, URI: {result.payload['uri']}")
```

**Performance:**
- HNSW index: O(log N) search
- In-memory + mmap hybrid
- Sharding per scaling orizzontale

---

### 8. PostgreSQL (Database Relazionale)

**Responsabilità:**
- Storage dati strutturati
- Transazioni ACID
- Relazioni tra entità
- Full-text search (opzionale)

**Schema Principale:**

```sql
-- Utenti
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(128) UNIQUE NOT NULL,
    is_root BOOLEAN DEFAULT FALSE,
    api_key_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessioni chat
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(256),
    model VARCHAR(128),
    enable_tools BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messaggi (crittografati)
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,  -- user, assistant, tool, system
    content BYTEA NOT NULL,     -- Fernet encrypted
    tool_call_name VARCHAR(256),
    tool_call_id VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tokens_in INTEGER,
    tokens_out INTEGER
);

-- Documenti
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    uri TEXT,
    path TEXT,
    mime VARCHAR(128),
    bytes_size BIGINT,
    source VARCHAR(32),
    tags JSONB,
    collection VARCHAR(128),
    path_hash VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_ingested_at TIMESTAMPTZ
);

-- Server MCP
CREATE TABLE mcp_servers (
    id SERIAL PRIMARY KEY,
    server_id VARCHAR(64) UNIQUE NOT NULL,
    url VARCHAR(512) NOT NULL,
    healthy BOOLEAN DEFAULT TRUE,
    last_seen TIMESTAMPTZ
);

-- Tools
CREATE TABLE tools (
    id SERIAL PRIMARY KEY,
    mcp_server_id INTEGER REFERENCES mcp_servers(id),
    name VARCHAR(256) UNIQUE NOT NULL,  -- qualified, e.g. 'web.search'
    description TEXT,
    input_schema JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    last_discovered_at TIMESTAMPTZ
);

-- Analytics: Esecuzioni tool
CREATE TABLE tool_runs (
    id SERIAL PRIMARY KEY,
    tool_id INTEGER REFERENCES tools(id),
    user_id INTEGER REFERENCES users(id),
    session_id INTEGER REFERENCES chat_sessions(id),
    tool_name VARCHAR(256),
    status VARCHAR(32),  -- 'success', 'error'
    start_ts TIMESTAMPTZ,
    end_ts TIMESTAMPTZ,
    latency_ms INTEGER,
    args JSONB,
    error_message TEXT,
    result_preview TEXT
);

-- Analytics: Ingestion
CREATE TABLE ingestion_runs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    target TEXT,
    from_web BOOLEAN,
    recursive BOOLEAN,
    tags JSONB,
    collection VARCHAR(128),
    totals_files INTEGER,
    totals_chunks INTEGER,
    errors JSONB,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    status VARCHAR(32)
);

-- Indici per performance
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_documents_path_hash ON documents(path_hash);
CREATE INDEX idx_tool_runs_tool ON tool_runs(tool_id);
CREATE INDEX idx_tool_runs_user ON tool_runs(user_id);
CREATE INDEX idx_tool_runs_start ON tool_runs(start_ts);
```

**Migrazioni:**
- Alembic per versioning schema
- Migrazioni in `ops/alembic/versions/`
- Auto-generazione da modelli SQLAlchemy

---

### 9. Grafana & Prometheus (Monitoring)

**Prometheus:**
- Scraping metriche da `/metrics` (API)
- Retention: 15 giorni
- Storage: Timeseries database

**Metriche chiave:**
```
# API
http_request_duration_seconds{method="GET", path="/v1/chat/sessions"}
http_requests_total{method="POST", path="/v1/chat/new", status="201"}

# Custom
youworker_active_chat_sessions
youworker_tool_execution_duration_seconds{tool="web.search"}
youworker_llm_tokens_total{model="gpt-oss:20b", type="prompt"}
```

**Grafana:**
- Dashboards pre-configurati
- Alerting su soglie
- Visualizzazioni real-time

---

## Flussi Dati Principali

### Flusso 1: Conversazione Chat

```
1. Utente invia messaggio (WebSocket)
   ↓
2. API riceve messaggio, autentica utente
   ↓
3. Salva messaggio utente in PostgreSQL (crittografato)
   ↓
4. Agent loop inizia
   ├─► 5a. Carica conversazione storica
   ├─► 5b. Carica lista tool disponibili (MCP registry)
   └─► 5c. Costruisce prompt per LLM
   ↓
6. Invia prompt a Ollama
   ↓
7. Ollama genera risposta (streaming)
   ↓
8. Se risposta include tool call:
   ├─► 9a. Identifica tool da MCP registry
   ├─► 9b. Chiama tool via JSON-RPC (es. web.search)
   ├─► 9c. Tool esegue operazione
   ├─► 9d. Ritorna risultato a Agent
   └─► 9e. Agent aggiunge risultato al contesto
   ↓
10. LLM genera risposta finale (con risultati tool)
    ↓
11. Streaming risposta al frontend (WebSocket)
    ↓
12. Salva messaggio assistente in PostgreSQL
    ↓
13. Aggiorna analytics (tool_runs, token usage)
```

### Flusso 2: Ingestion Documento

```
1. Utente carica file (HTTP POST /v1/ingestion/path)
   ↓
2. API valida file (tipo, dimensione, sicurezza)
   ↓
3. Salva file in filesystem (`data/uploads/`)
   ↓
4. Invia richiesta a Ingest MCP Server
   ↓
5. Ingest Server processa file:
   ├─► 6a. Identifica tipo MIME
   ├─► 6b. Seleziona parser appropriato (Docling, PyPDF, ...)
   ├─► 6c. Estrae testo e metadata
   ├─► 6d. Chunking intelligente (overlap, max_tokens)
   └─► 6e. Per ogni chunk:
        ├─► 7a. Genera embedding (Ollama)
        ├─► 7b. Store vettore in Qdrant
        └─► 7c. Store metadata in PostgreSQL
   ↓
8. Ritorna summary ingestion
   ↓
9. Salva ingestion_run in PostgreSQL
   ↓
10. Invia notifica a frontend (documento pronto)
```

### Flusso 3: Ricerca Semantica (RAG)

```
1. Utente chiede "Trova info su X nei miei documenti"
   ↓
2. Agent decide di usare tool `semantic.answer`
   ↓
3. Tool genera embedding della query (Ollama)
   ↓
4. Ricerca vettoriale in Qdrant:
   ├─► Query: embedding vettoriale
   ├─► Filtri: collection, tags, min_score
   └─► Top-K: 10 risultati più rilevanti
   ↓
5. Qdrant ritorna chunk rilevanti con score
   ↓
6. Tool costruisce contesto per LLM:
   - Documenti trovati
   - Citazioni (URI, chunk_index)
   ↓
7. LLM genera risposta basata su documenti
   ↓
8. Risposta include citazioni esplicite
   ↓
9. Frontend mostra documenti citati
```

---

## Sicurezza Multi-Livello

### Livello 1: Network

- **IP Whitelisting**: Solo IP autorizzati (produzione)
- **Firewall**: iptables rules per container
- **TLS/SSL**: Crittografia transport obbligatoria
- **Internal network**: Servizi isolati (Docker network)

### Livello 2: Autenticazione

- **AUTHENTIK**: Identity provider esterno
- **JWT**: Token sicuri con expiration
- **API Key**: Hashing con bcrypt
- **HttpOnly Cookies**: Non accessibili da JS

### Livello 3: Autorizzazione

- **RBAC**: Role-based access control
- **Scope API**: Permessi granulari per chiavi
- **Session validation**: Verifica ownership risorse

### Livello 4: Applicazione

- **Input sanitization**: XSS prevention
- **Path validation**: Nessun path traversal
- **Rate limiting**: Protezione DoS
- **CSRF tokens**: Double-submit cookie

### Livello 5: Data

- **Encryption at rest**: Fernet per messaggi
- **Encryption in transit**: TLS 1.2+
- **Database encryption**: Opzionale (LUKS)
- **Backup encryption**: GPG per backup

### Livello 6: Monitoring

- **Audit logs**: Tutte le azioni critiche
- **Intrusion detection**: Anomaly detection
- **Alert system**: Notifiche su eventi sospetti

---

## Performance e Scaling

### Ottimizzazioni Correnti

1. **Connection pooling**: PostgreSQL (max 20 conn)
2. **WebSocket keep-alive**: Riduce overhead
3. **Lazy loading**: Frontend carica componenti on-demand
4. **Response caching**: TanStack Query (5 min TTL)
5. **GPU acceleration**: CUDA per Ollama
6. **Index optimization**: PostgreSQL + Qdrant HNSW
7. **Async I/O**: FastAPI async/await completo

### Scaling Orizzontale

**Servizi scalabili:**
- Frontend: Replica N istanze dietro load balancer
- API: Replica N istanze con session affinity
- MCP Servers: Replica indipendente per tool tipo
- Ollama: Multi-GPU setup con load balancing

**Database:**
- PostgreSQL: Read replicas per analytics
- Qdrant: Sharding per collezioni grandi

**Limiti Attuali:**
- Single-node deployment
- Nessuna orchestrazione (Kubernetes)
- Storage locale (no object storage)

**Roadmap Scaling:**
- Kubernetes deployment
- S3-compatible object storage
- Redis per session store
- Message queue (RabbitMQ/Kafka)

---

## Disaster Recovery

### Backup Strategy

1. **PostgreSQL**: Dump giornaliero crittografato
2. **Qdrant**: Snapshot collezioni + metadata
3. **Ollama**: Solo configurazione (modelli ri-scaricabili)
4. **Uploads**: Sync incrementale su NAS

**Script:**
```bash
make backup  # Crea backup completo
make restore BACKUP_FILE=<file>  # Ripristina
```

### High Availability

**Single Point of Failure:**
- PostgreSQL: No replication (dev/small prod)
- Qdrant: No clustering
- Ollama: No failover

**Mitigazione:**
- Health checks ogni 30s
- Auto-restart container (Docker)
- Monitoring con alerting
- RTO: 5 minuti (restart)
- RPO: 24 ore (backup giornaliero)

---

## Conclusioni

YouWorker è un sistema complesso ma ben strutturato, progettato per:

1. **On-premise security**: Dati e AI locali
2. **Modularità**: Microservizi indipendenti
3. **Estensibilità**: MCP protocol per nuovi tool
4. **Osservabilità**: Logging, metriche, tracing
5. **Resilienza**: Retry, circuit breaker, health checks

L'architettura supporta:
- 100+ utenti concorrenti (single node)
- 10K+ documenti indicizzati
- 1M+ messaggi storici
- 10+ tool MCP personalizzati

Per scaling oltre questi limiti, si raccomanda:
- Kubernetes orchestration
- Database clustering
- Distributed storage
- Message queue
