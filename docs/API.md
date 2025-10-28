# API Documentation YouWorker

Documentazione completa delle API REST e WebSocket di YouWorker.

---

## Indice

1. [Panoramica](#panoramica)
2. [Autenticazione](#autenticazione)
3. [Endpoint Autenticazione](#endpoint-autenticazione)
4. [Endpoint Chat](#endpoint-chat)
5. [Endpoint Documenti](#endpoint-documenti)
6. [Endpoint Ingestion](#endpoint-ingestion)
7. [Endpoint Analytics](#endpoint-analytics)
8. [Endpoint Account](#endpoint-account)
9. [Endpoint Tools](#endpoint-tools)
10. [WebSocket Chat](#websocket-chat)
11. [Health Checks](#health-checks)
12. [Codici di Errore](#codici-di-errore)

---

## Panoramica

**Base URL**: `https://youworker.tuazienda.it:8000`

**Protocolli**:
- REST: HTTPS (porta 8000)
- WebSocket: WSS (porta 8000)

**Formati**:
- Request: `application/json`
- Response: `application/json`
- WebSocket: JSON messages

**Versioning**: API versionate con prefisso `/v1/`

---

## Autenticazione

YouWorker supporta 3 metodi di autenticazione:

### 1. HttpOnly Cookie (Consigliato)

```bash
# Login
POST /v1/auth/login
Content-Type: application/json
{
  "api_key": "your-api-key"
}

# Response imposta cookie
Set-Cookie: youworker_token=<jwt>; HttpOnly; Secure; SameSite=Lax

# Richieste successive usano cookie automaticamente
GET /v1/chat/sessions
# Cookie inviato automaticamente dal browser
```

### 2. API Key Header

```bash
GET /v1/chat/sessions
X-API-Key: your-api-key
```

### 3. Bearer Token

```bash
GET /v1/chat/sessions
Authorization: Bearer your-api-key
```

---

## Endpoint Autenticazione

### `POST /v1/auth/login`

Effettua login con API key e riceve JWT cookie.

**Request:**
```json
{
  "api_key": "abc123..."
}
```

**Response:** `200 OK`
```json
{
  "username": "mario.rossi",
  "email": "mario.rossi@azienda.it",
  "is_root": false
}
```

**Cookies Set:**
```
youworker_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=1800
```

---

### `POST /v1/auth/logout`

Effettua logout e invalida cookie.

**Request:** (nessun body)

**Response:** `200 OK`
```json
{
  "message": "Logout successful"
}
```

**Cookies Cleared:**
```
youworker_token=; Max-Age=0
```

---

### `GET /v1/auth/me`

Ottiene informazioni utente corrente.

**Response:** `200 OK`
```json
{
  "id": 1,
  "username": "mario.rossi",
  "email": "mario.rossi@azienda.it",
  "is_root": false,
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### `POST /v1/auth/refresh`

Rinnova JWT token.

**Response:** `200 OK`
```json
{
  "message": "Token refreshed"
}
```

**Cookies Set:** Nuovo token

---

### `GET /v1/auth/csrf-token`

Ottiene token CSRF per form.

**Response:** `200 OK`
```json
{
  "csrf_token": "abc123..."
}
```

---

## Endpoint Chat

### `GET /v1/chat/sessions`

Lista sessioni chat dell'utente.

**Query Parameters:**
- `skip` (int, default=0): Offset pagination
- `limit` (int, default=100): Numero risultati
- `sort` (string, default="created_at:desc"): Ordinamento

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "id": 1,
      "external_id": "abc123...",
      "title": "Conversazione di prova",
      "model": "gpt-oss:20b",
      "enable_tools": true,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T11:30:00Z",
      "message_count": 10
    }
  ],
  "total": 1
}
```

---

### `POST /v1/chat/new`

Crea nuova sessione chat.

**Request:**
```json
{
  "title": "Nuova conversazione",
  "model": "gpt-oss:20b",
  "enable_tools": true
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "external_id": "def456...",
  "title": "Nuova conversazione",
  "model": "gpt-oss:20b",
  "enable_tools": true,
  "created_at": "2025-01-15T12:00:00Z",
  "updated_at": "2025-01-15T12:00:00Z"
}
```

---

### `GET /v1/chat/{session_id}`

Ottiene dettagli sessione.

**Path Parameters:**
- `session_id` (string): External ID sessione

**Response:** `200 OK`
```json
{
  "id": 1,
  "external_id": "abc123...",
  "title": "Conversazione di prova",
  "model": "gpt-oss:20b",
  "enable_tools": true,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T11:30:00Z",
  "message_count": 10
}
```

---

### `PATCH /v1/chat/{session_id}`

Aggiorna sessione (titolo, modello, ecc.).

**Request:**
```json
{
  "title": "Titolo aggiornato",
  "enable_tools": false
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "external_id": "abc123...",
  "title": "Titolo aggiornato",
  "model": "gpt-oss:20b",
  "enable_tools": false,
  "updated_at": "2025-01-15T12:30:00Z"
}
```

---

### `DELETE /v1/chat/{session_id}`

Elimina sessione e tutti i messaggi.

**Response:** `204 No Content`

---

### `GET /v1/chat/{session_id}/messages`

Ottiene storico messaggi sessione.

**Query Parameters:**
- `skip` (int): Offset
- `limit` (int): Limite
- `include_system` (bool, default=false): Includi messaggi sistema

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Ciao!",
      "created_at": "2025-01-15T10:00:00Z",
      "tokens_in": 2
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Ciao! Come posso aiutarti?",
      "created_at": "2025-01-15T10:00:05Z",
      "tokens_out": 8
    },
    {
      "id": 3,
      "role": "tool",
      "tool_call_name": "web.search",
      "content": "{\"results\": [...]}",
      "created_at": "2025-01-15T10:01:00Z"
    }
  ],
  "total": 3
}
```

---

## Endpoint Documenti

### `GET /v1/documents/`

Lista documenti con filtri.

**Query Parameters:**
- `skip` (int): Offset
- `limit` (int): Limite
- `collection` (string): Filtra per collection
- `tags` (string): Filtra per tag (comma-separated)
- `source` (string): Filtra per source (web/local/api)
- `mime` (string): Filtra per tipo MIME
- `search` (string): Ricerca full-text su URI/path

**Response:** `200 OK`
```json
{
  "documents": [
    {
      "id": 1,
      "uri": "https://example.com/doc.pdf",
      "path": "/uploads/doc.pdf",
      "mime": "application/pdf",
      "bytes_size": 1048576,
      "source": "web",
      "tags": ["technical", "manual"],
      "collection": "documents",
      "created_at": "2025-01-15T10:00:00Z",
      "last_ingested_at": "2025-01-15T10:00:00Z",
      "chunk_count": 10
    }
  ],
  "total": 1
}
```

---

### `POST /v1/documents/`

Crea/upload documento (multipart form).

**Request:** `multipart/form-data`
```
file: <binary>
collection: "documents"
tags: ["tag1", "tag2"]
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "uri": null,
  "path": "/uploads/uuid-filename.pdf",
  "mime": "application/pdf",
  "bytes_size": 2097152,
  "source": "api",
  "tags": ["tag1", "tag2"],
  "collection": "documents",
  "created_at": "2025-01-15T12:00:00Z"
}
```

---

### `GET /v1/documents/{document_id}`

Ottiene dettagli documento.

**Response:** `200 OK`
```json
{
  "id": 1,
  "uri": "https://example.com/doc.pdf",
  "path": "/uploads/doc.pdf",
  "mime": "application/pdf",
  "bytes_size": 1048576,
  "source": "web",
  "tags": ["technical", "manual"],
  "collection": "documents",
  "created_at": "2025-01-15T10:00:00Z",
  "last_ingested_at": "2025-01-15T10:00:00Z",
  "chunk_count": 10,
  "chunks": [
    {
      "index": 0,
      "text_preview": "Capitolo 1: Introduzione...",
      "score": null
    }
  ]
}
```

---

### `PATCH /v1/documents/{document_id}`

Aggiorna metadata documento.

**Request:**
```json
{
  "tags": ["updated", "tags"],
  "collection": "archived"
}
```

**Response:** `200 OK` (documento aggiornato)

---

### `DELETE /v1/documents/{document_id}`

Elimina documento e chunk da Qdrant.

**Response:** `204 No Content`

---

### `POST /v1/documents/bulk-delete`

Elimina multipli documenti.

**Request:**
```json
{
  "document_ids": [1, 2, 3]
}
```

**Response:** `200 OK`
```json
{
  "deleted_count": 3
}
```

---

## Endpoint Ingestion

### `POST /v1/ingestion/url`

Ingest documento da URL.

**Request:**
```json
{
  "url": "https://example.com/document.pdf",
  "collection": "documents",
  "tags": ["external", "pdf"],
  "recursive": false
}
```

**Response:** `202 Accepted`
```json
{
  "run_id": "abc123...",
  "status": "queued",
  "target": "https://example.com/document.pdf"
}
```

---

### `POST /v1/ingestion/path`

Ingest file/directory locale.

**Request:**
```json
{
  "path": "/mnt/shared/docs/",
  "collection": "documents",
  "tags": ["internal"],
  "recursive": true,
  "glob": "**/*.pdf"
}
```

**Response:** `202 Accepted`
```json
{
  "run_id": "def456...",
  "status": "queued",
  "target": "/mnt/shared/docs/"
}
```

---

### `POST /v1/ingestion/batch`

Batch ingestion multipli target.

**Request:**
```json
{
  "targets": [
    {"url": "https://example.com/doc1.pdf"},
    {"url": "https://example.com/doc2.pdf"},
    {"path": "/local/file.txt"}
  ],
  "collection": "documents",
  "tags": ["batch"]
}
```

**Response:** `202 Accepted`
```json
{
  "run_ids": ["abc...", "def...", "ghi..."],
  "queued_count": 3
}
```

---

### `GET /v1/ingestion/status/{run_id}`

Ottiene stato ingestion run.

**Response:** `200 OK`
```json
{
  "run_id": "abc123...",
  "status": "completed",
  "target": "https://example.com/document.pdf",
  "from_web": true,
  "collection": "documents",
  "tags": ["external"],
  "totals": {
    "files": 1,
    "chunks": 10,
    "errors": 0
  },
  "started_at": "2025-01-15T10:00:00Z",
  "finished_at": "2025-01-15T10:01:30Z",
  "duration_seconds": 90
}
```

**Status values:**
- `queued`: In coda
- `processing`: In elaborazione
- `completed`: Completato con successo
- `failed`: Fallito
- `partial`: Completato con errori

---

### `GET /v1/ingestion/history`

Storico ingestion runs.

**Query Parameters:**
- `skip`, `limit`: Pagination
- `status`: Filtra per status
- `from_web`: Filtra source (true/false)

**Response:** `200 OK`
```json
{
  "runs": [
    {
      "run_id": "abc123...",
      "status": "completed",
      "target": "https://example.com/document.pdf",
      "totals": {"files": 1, "chunks": 10},
      "started_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `GET /v1/ingestion/collections`

Lista collezioni Qdrant disponibili.

**Response:** `200 OK`
```json
{
  "collections": [
    {
      "name": "documents",
      "vectors_count": 1000,
      "points_count": 1000,
      "disk_size_bytes": 10485760
    }
  ]
}
```

---

## Endpoint Analytics

### `GET /v1/analytics/overview`

Overview utilizzo generale.

**Query Parameters:**
- `start_date` (ISO 8601): Data inizio
- `end_date` (ISO 8601): Data fine

**Response:** `200 OK`
```json
{
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-15T23:59:59Z"
  },
  "sessions": {
    "total": 50,
    "active": 10
  },
  "messages": {
    "total": 500,
    "user": 250,
    "assistant": 250
  },
  "tools": {
    "total_calls": 100,
    "success_rate": 0.95
  },
  "tokens": {
    "total": 100000,
    "prompt": 40000,
    "completion": 60000
  }
}
```

---

### `GET /v1/analytics/sessions`

Statistiche sessioni chat.

**Response:** `200 OK`
```json
{
  "by_day": [
    {
      "date": "2025-01-15",
      "count": 10,
      "avg_messages": 8.5
    }
  ],
  "by_model": {
    "gpt-oss:20b": 45,
    "llama2:7b": 5
  },
  "avg_duration_minutes": 15.3
}
```

---

### `GET /v1/analytics/tools`

Statistiche utilizzo tool.

**Response:** `200 OK`
```json
{
  "by_tool": [
    {
      "tool_name": "web.search",
      "call_count": 50,
      "success_count": 48,
      "avg_latency_ms": 350
    },
    {
      "tool_name": "semantic.query",
      "call_count": 30,
      "success_count": 30,
      "avg_latency_ms": 120
    }
  ],
  "total_calls": 100,
  "success_rate": 0.95
}
```

---

### `GET /v1/analytics/tokens`

Statistiche token usage.

**Response:** `200 OK`
```json
{
  "by_day": [
    {
      "date": "2025-01-15",
      "prompt_tokens": 5000,
      "completion_tokens": 8000,
      "total_tokens": 13000
    }
  ],
  "by_model": {
    "gpt-oss:20b": {
      "total_tokens": 100000,
      "cost_estimate_usd": 0
    }
  },
  "total_tokens": 100000
}
```

---

### `GET /v1/analytics/ingestion`

Metriche ingestion documenti.

**Response:** `200 OK`
```json
{
  "by_day": [
    {
      "date": "2025-01-15",
      "runs": 5,
      "files": 50,
      "chunks": 500
    }
  ],
  "by_source": {
    "web": 30,
    "local": 15,
    "api": 5
  },
  "total_documents": 50,
  "total_chunks": 500
}
```

---

## Endpoint Account

### `GET /v1/account/usage`

Utilizzo account utente corrente.

**Response:** `200 OK`
```json
{
  "user": {
    "username": "mario.rossi",
    "created_at": "2025-01-01T00:00:00Z"
  },
  "usage": {
    "sessions": 50,
    "messages": 500,
    "documents": 20,
    "tokens": 100000
  },
  "limits": {
    "sessions_per_day": 100,
    "documents_max": 1000,
    "tokens_per_day": 1000000
  }
}
```

---

### `GET /v1/account/api-keys`

Lista API keys dell'utente.

**Response:** `200 OK`
```json
{
  "keys": [
    {
      "id": 1,
      "name": "Production Key",
      "prefix": "yw_abc123",
      "created_at": "2025-01-01T00:00:00Z",
      "last_used_at": "2025-01-15T10:00:00Z",
      "expires_at": null
    }
  ]
}
```

---

### `POST /v1/account/api-keys`

Genera nuova API key.

**Request:**
```json
{
  "name": "New API Key",
  "expires_days": 365
}
```

**Response:** `201 Created`
```json
{
  "id": 2,
  "name": "New API Key",
  "api_key": "yw_def456...",  // Mostrato solo una volta!
  "prefix": "yw_def456",
  "created_at": "2025-01-15T12:00:00Z",
  "expires_at": "2026-01-15T12:00:00Z"
}
```

---

### `DELETE /v1/account/api-keys/{key_id}`

Revoca API key.

**Response:** `204 No Content`

---

## Endpoint Tools

### `GET /v1/tools`

Lista tool MCP disponibili.

**Response:** `200 OK`
```json
{
  "tools": [
    {
      "name": "web.search",
      "server": "mcp_web",
      "description": "Search the web with DuckDuckGo",
      "enabled": true,
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          }
        },
        "required": ["query"]
      }
    }
  ],
  "total": 15,
  "servers_healthy": 5
}
```

---

### `GET /v1/tools/{tool_name}`

Dettagli tool specifico.

**Response:** `200 OK`
```json
{
  "name": "web.search",
  "server": "mcp_web",
  "description": "Search the web with DuckDuckGo",
  "enabled": true,
  "input_schema": {...},
  "usage_stats": {
    "total_calls": 100,
    "success_rate": 0.95,
    "avg_latency_ms": 350
  }
}
```

---

## WebSocket Chat

### Connessione

```
WSS wss://youworker.tuazienda.it:8000/chat/{session_id}
```

**Headers (per autenticazione):**
```
Cookie: youworker_token=<jwt>
```

**Oppure query parameter:**
```
wss://...?token=<api-key>
```

### Protocollo

#### Client → Server: Messaggio Utente

```json
{
  "type": "message",
  "content": "Cerca informazioni su FastAPI",
  "model": "gpt-oss:20b",
  "enable_tools": true,
  "language": "it",
  "expect_audio": false
}
```

#### Server → Client: Eventi

**1. Token Streaming**
```json
{
  "event": "token",
  "data": {
    "text": "FastAPI "
  }
}
```

**2. Tool Execution Start**
```json
{
  "event": "tool",
  "data": {
    "tool": "web.search",
    "status": "start",
    "args": {
      "query": "FastAPI tutorial"
    }
  }
}
```

**3. Tool Execution End**
```json
{
  "event": "tool",
  "data": {
    "tool": "web.search",
    "status": "end",
    "result_preview": "Found 10 results",
    "latency_ms": 350
  }
}
```

**4. Completion**
```json
{
  "event": "done",
  "data": {
    "final_text": "FastAPI è un framework...",
    "metadata": {
      "iterations": 3,
      "tool_calls": 2,
      "total_tokens": 500
    }
  }
}
```

**5. Error**
```json
{
  "event": "error",
  "data": {
    "message": "Tool execution failed",
    "code": "TOOL_ERROR",
    "details": {...}
  }
}
```

### Esempio Completo

```javascript
const ws = new WebSocket('wss://youworker.tuazienda.it:8000/chat/abc123');

ws.onopen = () => {
  console.log('Connected');

  // Invia messaggio
  ws.send(JSON.stringify({
    type: 'message',
    content: 'Ciao!',
    model: 'gpt-oss:20b',
    enable_tools: true
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.event) {
    case 'token':
      // Append token a UI
      appendText(data.data.text);
      break;

    case 'tool':
      if (data.data.status === 'start') {
        showToolExecution(data.data.tool);
      } else {
        hideToolExecution(data.data.tool);
      }
      break;

    case 'done':
      console.log('Response complete:', data.data.metadata);
      break;

    case 'error':
      console.error('Error:', data.data.message);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

---

## Health Checks

### `GET /health`

Salute generale sistema.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-15T12:00:00Z",
  "services": {
    "database": "healthy",
    "qdrant": "healthy",
    "ollama": "healthy",
    "mcp_servers": "5/5 healthy"
  }
}
```

---

### `GET /health/mcp`

Stato server MCP.

**Response:** `200 OK`
```json
{
  "healthy_count": 5,
  "total_count": 5,
  "servers": [
    {
      "id": "mcp_web",
      "url": "http://mcp_web:7001",
      "healthy": true,
      "last_seen": "2025-01-15T11:59:50Z",
      "tools_count": 5
    }
  ]
}
```

---

### `GET /health/ollama`

Stato Ollama e modelli.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "url": "http://ollama:11434",
  "models": [
    {
      "name": "gpt-oss:20b",
      "size": 11811160064,
      "modified_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

### `GET /health/qdrant`

Stato Qdrant e collezioni.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "url": "http://qdrant:6333",
  "collections": [
    {
      "name": "documents",
      "vectors_count": 1000,
      "points_count": 1000
    }
  ]
}
```

---

### `GET /health/postgres`

Test connessione PostgreSQL.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "database": "youworker",
  "tables_count": 12,
  "version": "PostgreSQL 15.3"
}
```

---

## Codici di Errore

### Codici HTTP

- `200 OK`: Successo
- `201 Created`: Risorsa creata
- `204 No Content`: Successo senza body
- `400 Bad Request`: Input non valido
- `401 Unauthorized`: Autenticazione mancante/non valida
- `403 Forbidden`: Permessi insufficienti
- `404 Not Found`: Risorsa non trovata
- `409 Conflict`: Conflitto (es. duplicato)
- `422 Unprocessable Entity`: Validazione fallita
- `429 Too Many Requests`: Rate limit superato
- `500 Internal Server Error`: Errore server
- `502 Bad Gateway`: Servizio downstream non disponibile
- `503 Service Unavailable`: Servizio temporaneamente non disponibile

### Formato Errori

Tutti gli errori ritornano:

```json
{
  "detail": "Messaggio errore leggibile",
  "code": "ERROR_CODE",
  "field": "campo_non_valido",  // Se applicabile
  "timestamp": "2025-01-15T12:00:00Z"
}
```

### Codici Errore Comuni

- `INVALID_API_KEY`: API key non valida
- `SESSION_NOT_FOUND`: Sessione chat non trovata
- `DOCUMENT_NOT_FOUND`: Documento non trovato
- `TOOL_NOT_FOUND`: Tool MCP non trovato
- `TOOL_ERROR`: Errore esecuzione tool
- `RATE_LIMIT_EXCEEDED`: Rate limit superato
- `INSUFFICIENT_PERMISSIONS`: Permessi insufficienti
- `VALIDATION_ERROR`: Errore validazione input
- `OLLAMA_UNAVAILABLE`: Ollama non disponibile
- `QDRANT_UNAVAILABLE`: Qdrant non disponibile
- `DATABASE_ERROR`: Errore database

---

## Rate Limiting

**Limiti di default:**

```
Endpoint                 Limite
-----------------        -------
/v1/auth/login          5/minuto
/v1/chat/new            10/minuto
/v1/ingestion/*         5/minuto
Tutti gli altri         60/minuto
```

**Header response:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642248000
```

**Errore 429:**

```json
{
  "detail": "Rate limit exceeded. Try again in 30 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 30
}
```

---

## Esempi cURL

### Login e Chat

```bash
# Login
curl -X POST https://youworker.tuazienda.it:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-api-key"}' \
  -c cookies.txt

# Nuova sessione
curl -X POST https://youworker.tuazienda.it:8000/v1/chat/new \
  -H "Content-Type: application/json" \
  -d '{"title": "Test"}' \
  -b cookies.txt

# Oppure con API key header
curl -X POST https://youworker.tuazienda.it:8000/v1/chat/new \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"title": "Test"}'
```

### Upload Documento

```bash
curl -X POST https://youworker.tuazienda.it:8000/v1/documents/ \
  -H "X-API-Key: your-api-key" \
  -F "file=@/path/to/document.pdf" \
  -F "collection=documents" \
  -F "tags=test,pdf"
```

### Ingestion da URL

```bash
curl -X POST https://youworker.tuazienda.it:8000/v1/ingestion/url \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://example.com/doc.pdf",
    "collection": "documents",
    "tags": ["external"]
  }'
```

---

## Contatti

**Supporto API:**
- Email: api-support@youco.it
- Documentazione interattiva: https://youworker.tuazienda.it:8000/docs
- Redoc: https://youworker.tuazienda.it:8000/redoc

---

**Versione API:** v1.0.0
**Ultima modifica:** Gennaio 2025
