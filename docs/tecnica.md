# Documentazione Tecnica - YouWorker.AI

## Panoramica dell'Architettura

YouWorker.AI è un'applicazione full-stack che combina tecnologie web moderne con modelli AI locali per offrire un'esperienza conversazionale potente e orientata alla privacy.

### Componenti Principali

#### Backend (FastAPI)
- **Framework**: FastAPI con supporto asincrono
- **Autenticazione**: Basata su JWT con chiavi API
- **Database**: PostgreSQL per dati persistenti e sessioni
- **Vector Store**: Qdrant per ricerca semantica
- **LLM Integration**: Ollama per modelli linguistici locali

#### Frontend (Next.js)
- **Framework**: Next.js 15 con React 19
- **Styling**: Tailwind CSS con componenti Radix UI
- **State Management**: Context API per stato conversazionale
- **Audio**: Web Audio API per registrazione e riproduzione

#### Sistema Agent
- **Agent Loop**: Sistema di ragionamento con pattern single-tool stepper
- **MCP Registry**: Gestione dinamica degli strumenti tramite Model Context Protocol
- **Tool Execution**: Esecuzione strumenti con monitoraggio stato

## Architettura Dettagliata

### Backend API

#### Endpoint Principali
- `/v1/chat`: Chat testuale con streaming SSE
- `/v1/voice-turn`: Interazione vocale turn-based
- `/v1/unified-chat`: Endpoint unificato per testo/audio
- `/v1/ingest`: Ingestione documenti
- `/v1/sessions`: Gestione sessioni chat

#### Autenticazione e Sicurezza
- Chiavi API per autenticazione client
- Rate limiting con SlowAPI
- Validazione input con Pydantic
- CORS configurato per origini specifiche

### Sistema Agent

#### Agent Loop ([`packages/agent/loop.py`](packages/agent/loop.py))
Implementa il pattern "single-tool stepper" per esecuzione prevedibile:
1. Emissione massimo UNA tool call per turno
2. Esecuzione strumento e attesa risultato
3. Continuazione solo con nuovo completion request

#### MCP Registry ([`packages/agent/registry.py`](packages/agent/registry.py))
Gestisce connessioni a server MCP:
- Discovery dinamica strumenti
- Health monitoring server
- Routing chiamate strumenti
- Refresh periodico strumenti

### Integrazioni Esterne

#### Ollama Client ([`packages/llm/ollama.py`](packages/llm/ollama.py))
Client per modelli linguistici locali con:
- Streaming con thinking traces
- Tool/function calling
- Auto-pull modelli mancanti
- Embeddings per ricerca semantica

#### MCP Client ([`packages/mcp/client.py`](packages/mcp/client.py))
Implementazione JSON-RPC 2.0 over WebSocket:
- Handshake iniziale `initialize`
- Metodi `tools/list` e `tools/call`
- Riconnessione automatica
- Heartbeat per mantenere connessioni

### Pipeline Audio

#### Trascrizione ([`apps/api/audio_pipeline.py`](apps/api/audio_pipeline.py))
- Faster Whisper per STT (Speech-to-Text)
- Configurazione modello e dispositivo
- Supporto multi-lingua con italiano predefinito

#### Sintesi Vocale
- Piper TTS per sintesi vocale italiana
- Output WAV base64 per trasmissione client
- Configurazione voce tramite variabili ambiente

### Gestione Documenti

#### Ingestion Pipeline ([`packages/ingestion/pipeline.py`](packages/ingestion/pipeline.py))
- Docling per parsing documenti
- Estrazione testo da PDF, immagini, tabelle
- Chunking strategico per embedding
- Upsert su Qdrant con metadati

#### Vector Store ([`packages/vectorstore/qdrant.py`](packages/vectorstore/qdrant.py))
- Wrapper Qdrant per ricerca semantica
- Gestione collezioni e access control
- Query per similarità con filtri

### Database Schema

#### Tabelle Principali
- `users`: Utenti del sistema
- `chat_sessions`: Sessioni conversazionali
- `messages`: Messaggi chat con metadati
- `tool_runs`: Log esecuzione strumenti
- `ingestion_runs`: Tracciamento ingestione documenti
- `documents`: Catalogo documenti ingeriti
- `mcp_servers`: Server MCP registrati
- `tools`: Strumenti disponibili

#### Access Control
- Sistema ACL per collezioni documenti
- Accesso predefinito collection per utenti root
- Isolamento dati per utente

## Configurazione e Deployment

### Variabili Ambiente Chiave
- `CHAT_MODEL`: Modello Ollama per chat (default: `gpt-oss:20b`)
- `EMBED_MODEL`: Modello embedding (default: `embeddinggemma:300m`)
- `OLLAMA_BASE_URL`: URL servizio Ollama
- `QDRANT_URL`: URL database vettoriale
- `DATABASE_URL`: Connessione PostgreSQL
- `ROOT_API_KEY`: Chiave autenticazione API

### Docker Compose Stack
1. **PostgreSQL**: Database persistente
2. **Qdrant**: Vector store per ricerca semantica
3. **Ollama**: Server modelli linguistici
4. **MCP Servers**: Provider strumenti (web, semantic, datetime, ingest, units)
5. **API Backend**: FastAPI
6. **Frontend**: Next.js

### Monitoring e Analytics
- Prometheus per metriche API
- Grafana per dashboard BI
- Analytics dashboard integrata in React
- Logging strutturato con correlation ID

## Sicurezza

### Autenticazione
- Chiavi API per client
- Token JWT per sessioni utente
- Rate limiting per endpoint sensibili

### Validazione e Sanitizzazione
- Pydantic per validazione input
- Sanitizzazione contenuto utente
- Prevenzione SQL injection con SQLAlchemy

### Isolamento Dati
- Access control per collezioni documenti
- Isolamento sessioni per utente
- Percorsi file validati

## Performance e Scalabilità

### Ottimizzazioni
- Streaming SSE per risposte real-time
- Pool connessioni database
- Caching modelli Ollama
- Lazy loading strumenti MCP

### Scalabilità
- Architettura microservizi
- Horizontal scaling con Docker Compose
- Load balancing con nginx
- Database connection pooling

## Sviluppo e Testing

### Ambiente Sviluppo
- Backend: Python 3.11+ con Poetry
- Frontend: Node.js 20+ con npm
- Hot reload per entrambi i componenti

### Suite Test
- Unit test con pytest
- Integration test per API endpoints
- E2E test per flussi completi
- Coverage reporting

### Code Quality
- Black per formatting Python
- Ruff per linting
- ESLint per frontend
- Type hints ovunque