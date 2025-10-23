# Documentazione di Architettura

## Panoramica del Sistema

Il Backend YouWorker AI Agent è un sistema production-ready che implementa un agente AI con scoperta dinamica degli strumenti e semantica di esecuzione rigorosa. L'architettura è progettata per:

1. **Affidabilità**: Tutte le chiamate agli strumenti sono validate, ritentate e monitorate
2. **Estensibilità**: Gli strumenti sono scoperti dinamicamente tramite MCP (Model Context Protocol)
3. **Correttezza**: Il pattern single-tool stepper garantisce esecuzione prevedibile
4. **Osservabilità**: Tracciamento del pensiero, logging completo, health check

## Componenti Principali

### 1. Agent Loop (`packages/agent/loop.py`)

L'agent loop implementa il pattern **strict single-tool stepper**:

```python
async def run_turn_stepper(messages, enable_tools) -> AgentTurnResult:
    # 1. Stream chat completion da Ollama
    # 2. Accumula thinking (silenzioso), content, tool_calls
    # 3. Se tool_calls presenti:
    #    - MANTIENI SOLO la prima chiamata strumento (applica regola single-tool)
    #    - Return requires_followup=True
    # 4. Se nessun tool_calls:
    #    - Return contenuto finale
    #    - Return requires_followup=False
```

**Invarianti chiave**: L'agente emette al massimo UNA chiamata strumento per turno, poi si ferma e attende il risultato dello strumento prima di continuare.

#### Meccanismi di Applicazione

1. **Filtraggio runtime**: Se il modello emette >1 chiamata strumento, solo la prima viene mantenuta
2. **Prompt correttivo**: Un messaggio di sistema viene iniettato nel turno successivo
3. **Prompt agente**: Il prompt di sistema istruisce esplicitamente il comportamento single-tool

### 2. MCP Registry (`packages/agent/registry.py`)

Gestisce multiple server MCP e i loro strumenti:

```python
class MCPRegistry:
    def __init__(self, server_configs):
        self.clients: dict[str, MCPClient] = {}
        self.tools: dict[str, MCPTool] = {}  # qualified_name -> tool

    async def connect_all():
        # Connetti a tutti i server e scopri strumenti

    async def refresh_tools():
        # Riscopri strumenti da tutti i server

    def to_llm_tools() -> list[dict]:
        # Converti in schema LLM tool

    async def call_tool(tool_name, arguments):
        # Instrada ed esegui chiamata strumento
```

**Namespacing strumenti**: Ogni strumento è prefissato con il suo server ID:
- `web.search` → Server MCP Web
- `vector.query` → Server MCP Semantico
- `time.now` → Server MCP Datetime

### 3. Ollama Client (`packages/llm/ollama.py`)

Gestisce streaming chat completions con thinking e tool calling:

```python
async def chat_stream(messages, model, tools, think="low"):
    # Stream chat con:
    # - message.thinking (catturato, non streamed al client)
    # - message.content (streamed al client)
    # - message.tool_calls (accumulato attraverso i chunk)
```

**Tracce di pensiero**: Il parametro `think` di Ollama abilita il ragionamento, ma `message.thinking` non viene mai streamed ai client—solo loggato internamente.

### 4. MCP Client (`packages/mcp/client.py`)

Client generico che usa JSON-RPC 2.0 su WebSocket (`/mcp`):

```python
class MCPClient:
    async def list_tools() -> list[MCPTool]:
        # JSON-RPC: method="tools/list"

    async def call_tool(tool_name, arguments):
        # JSON-RPC: method="tools/call"

    async def health_check():
        # HTTP GET /health di convenienza (opzionale)
```

**Logica di retry**: Usa `tenacity` per retry automatici con backoff esponenziale.

### 5. Vector Store (`packages/vectorstore/qdrant.py`)

Wrapper Qdrant per ricerca semantica:

```python
class QdrantStore:
    async def ensure_collection(collection_name)
    async def upsert_chunks(chunks, collection_name)
    async def search(query_embedding, top_k, tags)
    async def list_collections()
```

### 6. Ingestion Pipeline (`packages/ingestion/pipeline.py`)

Elaborazione documenti con Docling:

```python
class IngestionPipeline:
    async def ingest_path(path, tags, collection_name):
        # 1. Parsing con Docling
        # 2. Chunking testo
        # 3. Generazione embeddings via Ollama
        # 4. Upsert su Qdrant
```

**Strategia di chunking**: Chunk a dimensione fissa con overlap, splitting consapevole dei confini.

## Protocollo Server MCP

Ogni server MCP espone un endpoint WebSocket a `/mcp` che parla JSON-RPC 2.0.

### Metodi Richiesti

1. `initialize` → return `protocolVersion`, `serverInfo`, `capabilities`
2. `tools/list` → return `{ "tools": [...] }`
3. `tools/call` → params `{ "name", "arguments" }` → return risultato strumento
4. Opzionale `ping`

Inoltre, i server dovrebbero esporre `GET /health` per semplici controlli di liveness.

### Formato Schema Strumento

```json
{
  "name": "search",
  "description": "Cerca sul web",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Query di ricerca"}
    },
    "required": ["query"]
  }
}
```

### Formato Chiamata Strumento

```json
{
  "name": "search",
  "arguments": {"query": "Agenti AI"}
}
```

### Formato Risposta Strumento

```json
{
  "content": [
    {"type": "json", "json": {"...": "risultato strutturato"}}
  ]
}
```

## Flusso Dati

### Richiesta Chat (con tool calling)

```
1. Client → POST /v1/chat
   {messages: [...], enable_tools: true}

2. API → Agent Loop
   - Avvia turn_stepper con messages

3. Agent → Ollama
   - Stream chat con tools registry
   - Accumula thinking/content/tool_calls

4. Ollama → Agent
   - Streama chunk con thinking/content/tool_calls

5. Agent rileva tool call
   - Mantiene solo prima tool call
   - Esegue via Registry

6. Registry → MCP Server
   - Instrada al server appropriato
   - JSON-RPC tools/call su WebSocket

7. MCP Server → Registry
   - Return risultato strumento

8. Registry → Agent
   - Risultato strumento come stringa

9. Agent → Ollama (nuovo turno)
   - Append risultato strumento ai messages
   - Continua streaming

10. Agent rileva nessun altro tool call
    - Stream contenuto finale al client

11. API → Client
    - SSE stream di chunk contenuto
```

### Richiesta Ingestion

```
1. Client → POST /v1/ingest
   {path_or_url: "...", tags: [...]}

2. API → Ingestion Pipeline
   - Parsing documenti con Docling

3. Pipeline → Ollama
   - Genera embeddings per chunk

4. Pipeline → Qdrant
   - Upsert chunk con metadata

5. API → Client
   - Return stats (file, chunk, errori)
```

## Architettura Deployment

```
┌─────────────────────────────────────────────────┐
│                  Host Docker                    │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Rete Docker Compose                      │  │
│  │                                           │  │
│  │  ┌────────┐  ┌────────┐  ┌──────────┐     │  │
│  │  │ Ollama │  │ Qdrant │  │   API    │     │  │
│  │  │        │  │        │  │          │     │  │
│  │  │ :11434 │  │ :6333  │  │  :8001   │     │  │
│  │  └────────┘  └────────┘  └──────────┘     │  │
│  │                                           │  │
│  │  ┌────────┐  ┌─────────┐  ┌──────────┐    │  │
│  │  │  MCP   │  │   MCP   │  │   MCP    │    │  │
│  │  │  Web   │  │Semantic │  │ Datetime │    │  │
│  │  │ :7001  │  │  :7002  │  │  :7003   │    │  │
│  │  └────────┘  └─────────┘  └──────────┘    │  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Volumi:                                       │
│  - ollama_data (modelli)                        │
│  - qdrant_data (vettori)                       │
└─────────────────────────────────────────────────┘
```

## Considerazioni di Scalabilità

### Scalabilità Orizzontale

1. **Servizio API**: Stateless, può scalare orizzontalmente
   - Usa load balancer (nginx, Traefik)
   - Backend Ollama/Qdrant/MCP condivisi

2. **Server MCP**: Stateless, possono scalare indipendentemente
   - Ogni tipo di server può scalare separatamente
   - Usa service mesh per routing

3. **Ollama**: GPU-intensive, scalabilità verticale
   - Multiple istanze GPU con load balancing
   - Considera alternative hosted (Groq, Together)

4. **Qdrant**: Scalabilità orizzontale via clustering
   - Qdrant supporta modalità distribuita
   - Shard per collection o tenant

### Ottimizzazioni Performance

1. **Caching**:
   - Cache risultati scopertura strumenti (refresh periodico)
   - Cache embeddings per query comuni
   - Cache risposte LLM (con cautela)

2. **Batching**:
   - Batch generazione embeddings
   - Batch vector upserts

3. **Selezione Modello**:
   - Usa modelli più piccoli per query semplici
   - Routing per complessità (gpt-oss:20b per complesso, più piccoli per semplice)

4. **Connection Pooling**:
   - Pool connessioni HTTP per tutti i servizi
   - Pool connessioni database per Qdrant

## Considerazioni di Sicurezza

1. **Autenticazione**: Aggiungi API key o OAuth a tutti gli endpoint
2. **Rate Limiting**: Previene abuso degli endpoint LLM/embedding
3. **Validazione Input**: Valida tutti gli argomenti strumenti contro schemi
4. **Tracce Pensiero**: Mai esporre in produzione (contiene ragionamento)
5. **Trust Server MCP**: Connetti solo a server MCP fidati
6. **Gestione Segreti**: Usa vault per API key, non variabili ambiente

## Osservabilità

### Logging

```python
logger.info(f"Turn agente: {len(messages)} messages")
logger.debug(f"Pensiero: {thinking[:200]}...")
logger.warning(f"Multiple tool calls: {len(tool_calls)}")
logger.error(f"Esecuzione strumento fallita: {e}")
```

### Metriche (da implementare)

- Request rate (requests/sec)
- Tool call rate per tool
- LLM latency (p50, p95, p99)
- Tool execution latency
- Error rates per componente
- Think token count

### Health Check

Tutti i servizi espongono `/health`:
- Ollama: Check disponibilità modelli
- Qdrant: Check salute storage
- Server MCP: Check dipendenze (browser, ecc.)
- API: Check tutte le dipendenze

## Strategia di Testing

### Unit Test

- Applicazione single-tool enforcement agent loop
- Scoperta e routing tool registry
- Streaming e parsing client Ollama
- Ricerca e upsert vector store
- Chunking e embedding ingestion

### Integration Test

- Comunicazione client MCP ↔ server MCP
- Agent ↔ Registry ↔ MCP end-to-end
- API ↔ Agent ↔ Tools full flow

### E2E Test

- Chat completa con tool calling
- Conversazioni multi-turn
- Ingestion documenti e retrieval
- Error handling e retry

## Miglioramenti Futuri

1. **Gestione Sessioni**: Storia conversazioni persistente
2. **Multi-modale**: Supporto immagini, audio, video via Docling
3. **Streaming Tools**: Supporto risposte strumenti streaming
4. **Parallel Tools**: Permetti multiple chiamate strumenti indipendenti
5. **Tool Composition**: Catena strumenti automaticamente
6. **Fine-tuning**: Fine-tune modello per migliore selezione strumenti
7. **Evaluation**: Build suite test per metriche qualità agente