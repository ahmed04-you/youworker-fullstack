# YouWorker Backend Architecture Documentation

## Overview

The YouWorker backend is a **FastAPI-based production-ready AI agent** with the following characteristics:

- **Framework**: FastAPI (async Python)
- **Authentication**: Authentik SSO with HttpOnly JWT cookies
- **Real-time Communication**: WebSocket support for streaming responses
- **AI Agent**: Integrated MCP (Model Context Protocol) tools with Claude/Ollama
- **Database**: PostgreSQL with encrypted message storage
- **Vector Store**: Qdrant for semantic search
- **LLM**: Ollama (self-hosted) or external LLM services
- **Voice**: Speech-to-Text (STT) and Text-to-Speech (TTS) capabilities

## API Architecture

### Application Structure

```
/apps/api/
├── main.py                  # FastAPI app, middleware, exception handlers
├── config.py                # Configuration (delegates to CommonSettings)
├── auth/
│   └── security.py          # JWT, API key, user authentication
├── routes/
│   ├── auth.py              # Authentication endpoints
│   ├── health.py            # Health check endpoints
│   ├── websocket.py         # WebSocket chat endpoint
│   ├── crud.py              # Session, document, tool run CRUD
│   ├── ingestion.py         # Document ingestion
│   ├── account.py           # Account management
│   ├── chat/                # Chat endpoints (HTTP/streaming)
│   │   ├── unified.py       # Unified text/audio chat
│   │   ├── streaming.py     # Streaming chat with SSE
│   │   ├── voice.py         # Voice turn-based endpoint
│   │   ├── models.py        # Request/response schemas
│   │   ├── helpers.py       # Tool event recording
│   │   ├── persistence.py   # Database persistence
│   │   └── __init__.py
│   └── analytics/           # Analytics endpoints
│       ├── overview.py      # Dashboard metrics
│       ├── tokens.py        # Token usage timeline
│       ├── tools.py         # Tool performance metrics
│       ├── ingestion.py     # Ingestion stats
│       ├── sessions.py      # Session activity
│       └── __init__.py
├── middleware/
│   ├── csrf.py              # CSRF protection (double-submit)
│   ├── ip_whitelist.py      # IP whitelisting for production
│   ├── cors_validation.py   # CORS origin validation
│   └── __init__.py
├── utils/
│   ├── error_handling.py    # Error decorators and handlers
│   └── response_formatting.py # SSE formatting utilities
├── websocket_manager.py     # WebSocket connection management
├── csrf.py                  # CSRF token validation
└── audio_pipeline.py        # STT/TTS processing
```

---

## Authentication & Security

### Authentication Flow

The system uses **Authentik SSO** as the primary authentication method:

1. **Authentik SSO Authentication** (`/v1/auth/auto-login`)
   - User authenticates via Authentik
   - Authentik injects headers: `X-Authentik-Api-Key`, `X-Authentik-Username`
   - Backend validates the API key and creates JWT token
   - JWT stored in HttpOnly cookie (`youworker_token`)

2. **JWT Cookie Authentication**
   - Subsequent requests authenticate via JWT cookie
   - Cookie: `youworker_token` (HttpOnly, secure, samesite=lax)
   - Token expiration: 30 minutes
   - Algorithm: HS256

3. **API Key Authentication**
   - Alternative: Direct API key in headers for programmatic access
   - Header: `X-Authentik-Api-Key`
   - Fallback to `ROOT_API_KEY` environment variable
   - Secure comparison with `secrets.compare_digest()`

### Security Mechanisms

#### CSRF Protection
- **Middleware**: `CSRFMiddleware` (double-submit validation)
- **Exempt paths**: `/v1/auth/csrf-token`, `/v1/auth/auto-login`
- Token validation: Signed stateless tokens
- Header: `X-CSRF-Token`
- Cookie: `youworker_csrf` (not HttpOnly, allows JS access)

#### Input Sanitization
- Function: `sanitize_input()` in `auth/security.py`
- Removes control characters
- Strips dangerous HTML tags (script, style, iframe, etc.)
- Removes JavaScript event handlers
- Blocks `javascript:` and `data:` URIs
- Maximum length enforcement (default 4000 chars)

#### Message Encryption
- **Type**: Fernet (symmetric encryption)
- **Mandatory**: Chat messages must be encrypted
- **Key**: Derived from `CHAT_MESSAGE_ENCRYPTION_SECRET`
- Fallback: Uses `JWT_SECRET` or `ROOT_API_KEY`
- Stored in: PostgreSQL `EncryptedContent` column type

#### IP Whitelisting
- **Middleware**: `IPWhitelistMiddleware`
- **Enabled**: Production only (`app_env == "production"`)
- Configurable via `IP_WHITELIST` environment variable

#### Rate Limiting
- **Global limit**: 100 requests/minute
- **Per-user limiting**: Authenticated users get user-based limits
- Falls back to IP-based limits for unauthenticated requests
- Limiter: `slowapi` library

#### CORS Protection
- Strict origin validation with `parse_and_validate_cors_origins()`
- Configurable via `FRONTEND_ORIGIN` environment variable
- Credentials: Allowed
- Methods: All (*, POST/PUT/DELETE protected by CSRF)

### Security Headers
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`
- `X-Frame-Options: SAMEORIGIN`
- `Cache-Control: no-store` (for sensitive responses)

---

## API Endpoints

### Authentication Endpoints (`/v1/auth`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auto-login` | POST | Authentik Headers | Authenticate via Authentik SSO, issue JWT |
| `/logout` | POST | JWT Cookie | Clear authentication cookie |
| `/me` | GET | JWT Cookie | Get current user info |
| `/csrf-token` | GET | None | Issue CSRF token for double-submit |

**Example: Auto-Login**
```json
POST /v1/auth/auto-login
Headers: X-Authentik-Api-Key: <key>, X-Authentik-Username: john_doe

Response 200:
{
  "message": "Login successful",
  "username": "john_doe",
  "expires_in": 1800
}

Sets: youworker_token cookie (HttpOnly)
```

### Chat Endpoints

#### 1. HTTP Chat (`/v1/chat`)
- **Streaming chat with Server-Sent Events (SSE)**
- **POST** `/v1/chat`
- **Auth**: JWT Cookie (required)
- **Rate Limit**: 100/minute per user

**Request Schema** (`ChatRequest`):
```json
{
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "session_id": "string (optional)",
  "enable_tools": true,
  "model": "gpt-oss:20b (optional)",
  "stream": true
}
```

**Streaming Response** (Server-Sent Events):
```
event: token
data: {"text": "Hello"}

event: tool
data: {"tool": "web_search", "status": "start", "args": {...}}

event: log
data: {"level": "info", "msg": "..."}

event: done
data: {
  "final_text": "Complete response",
  "metadata": {...}
}
```

#### 2. Unified Chat (`/v1/unified-chat`)
- **Supports text AND audio input**
- **POST** `/v1/unified-chat`
- **Auth**: JWT Cookie (required)
- **Streaming**: Yes (configurable)

**Request Schema** (`UnifiedChatRequest`):
```json
{
  "text_input": "Optional text",
  "audio_b64": "Base64 PCM16 audio (optional)",
  "sample_rate": 16000,
  "messages": [...],
  "session_id": "string (optional)",
  "enable_tools": true,
  "model": "gpt-oss:20b (optional)",
  "expect_audio": false,
  "stream": true
}
```

**Response Schema** (`UnifiedChatResponse`):
```json
{
  "content": "Text response",
  "transcript": "Transcribed user audio (if provided)",
  "metadata": {"status": "success", ...},
  "audio_b64": "Base64 encoded audio (if expect_audio=true)",
  "audio_sample_rate": 16000,
  "stt_confidence": 0.95,
  "stt_language": "en",
  "tool_events": [...],
  "logs": [...]
}
```

#### 3. Voice Turn (`/v1/voice-turn`)
- **Turn-based voice interaction**
- **POST** `/v1/voice-turn`
- **Auth**: JWT Cookie (required)
- **Returns**: Transcribed audio + AI response + optional TTS

**Request Schema** (`VoiceTurnRequest`):
```json
{
  "audio_b64": "Base64 PCM16 audio",
  "sample_rate": 16000,
  "messages": [...],
  "session_id": "string (optional)",
  "enable_tools": true,
  "model": "gpt-oss:20b (optional)",
  "expect_audio": false
}
```

**Response Schema** (`VoiceTurnResponse`):
```json
{
  "transcript": "User's transcribed speech",
  "assistant_text": "AI's response",
  "metadata": {...},
  "audio_b64": "Optional TTS response",
  "audio_sample_rate": 16000,
  "stt_confidence": 0.95,
  "stt_language": "en",
  "tool_events": [...],
  "logs": [...]
}
```

#### 4. WebSocket Chat (`/chat/{session_id}`)
- **Real-time WebSocket communication**
- **Protocol**: WebSocket (ws:// or wss://)
- **Auth**: API key in header or query param
- **Connection**: Automatic heartbeat/keep-alive

**Authentication Methods**:
```
Header: X-Api-Key: <api_key>
OR
Query param: ?api_key=<api_key>
OR
Header: Authorization: <api_key> (backward compat)
```

**Message Types**:

| Type | Direction | Schema |
|------|-----------|--------|
| `text` | Client→Server | `{"type": "text", "content": "...", "metadata": {...}}` |
| `audio` | Client→Server | `{"type": "audio", "audio_data": "base64", "sample_rate": 16000, "metadata": {...}}` |
| `ping` | Client→Server | `{"type": "ping"}` |
| `stop` | Client→Server | `{"type": "stop"}` |
| `text` | Server→Client | `{"type": "text", "content": "...", "metadata": {"is_streaming": true}}` |
| `audio` | Server→Client | `{"type": "audio", "audio_data": "base64", "sample_rate": 16000}` |
| `tool` | Server→Client | `{"type": "tool", "content": "name", "metadata": {"status": "start", "args": {...}}}` |
| `status` | Server→Client | `{"type": "status", "content": "Thinking...", "metadata": {"stage": "thinking"}}` |
| `transcript` | Server→Client | `{"type": "transcript", "content": "...", "metadata": {"confidence": 0.95, ...}}` |
| `error` | Server→Client | `{"type": "error", "content": "Error message"}` |
| `pong` | Server→Client | `{"type": "pong"}` |
| `system` | Server→Client | `{"type": "system", "content": "Connected to chat session"}` |

**Reconnection Strategy** (see websocket.py for details):
- Exponential backoff with jitter
- Initial delay: 1000ms, max delay: 30000ms
- Max retries: 10
- Heartbeat interval: 30 seconds

---

### Session Management (`/v1/sessions`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | GET | List user's chat sessions (limit: 50) |
| `/sessions/{id}` | GET | Get session with all messages and tool runs |
| `/sessions/{id}` | DELETE | Delete session and all messages |
| `/sessions/{id}` | PATCH | Update session title |

**Response: List Sessions**
```json
{
  "sessions": [
    {
      "id": 123,
      "external_id": "session-uuid",
      "title": "Session title",
      "model": "gpt-oss:20b",
      "enable_tools": true,
      "created_at": "2024-10-30T10:00:00Z",
      "updated_at": "2024-10-30T10:05:00Z"
    }
  ]
}
```

**Response: Get Session Details**
```json
{
  "session": {
    "id": 123,
    "external_id": "session-uuid",
    "title": "...",
    "model": "...",
    "enable_tools": true,
    "created_at": "...",
    "updated_at": "...",
    "messages": [
      {
        "id": 1,
        "role": "user",
        "content": "...",
        "tool_call_name": null,
        "tool_call_id": null,
        "created_at": "..."
      }
    ],
    "tool_events": [
      {
        "tool": "web_search",
        "status": "end",
        "ts": "...",
        "latency_ms": 1234
      }
    ]
  }
}
```

---

### Document Management (`/v1/documents`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/documents` | GET | List ingested documents (pagination) |
| `/documents/{id}` | DELETE | Delete document metadata |

**Query Parameters** (GET /documents):
- `collection`: Filter by collection name
- `limit`: Page size (default: 100, max: 1000)
- `offset`: Pagination offset

**Response**:
```json
{
  "documents": [
    {
      "id": 456,
      "uri": "file:///path/to/doc.pdf",
      "path": "/path/to/doc.pdf",
      "mime": "application/pdf",
      "bytes_size": 102400,
      "source": "upload",
      "tags": {"category": "research"},
      "collection": "default",
      "path_hash": "sha256hash",
      "created_at": "2024-10-30T10:00:00Z",
      "last_ingested_at": "2024-10-30T10:05:00Z"
    }
  ],
  "total": 150
}
```

---

### Document Ingestion (`/v1/ingest`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingest` | POST | Ingest documents from file path or URL |

**Rate Limit**: 10/minute per user

**Request Schema** (`IngestRequest`):
```json
{
  "path_or_url": "/path/to/docs or https://example.com",
  "from_web": false,
  "recursive": true,
  "tags": ["category1", "category2"]
}
```

**Response Schema** (`IngestResponse`):
```json
{
  "files_processed": 5,
  "chunks_written": 128,
  "files": [
    {
      "path": "/path/to/file.pdf",
      "chunks": 25,
      "status": "success"
    }
  ],
  "errors": ["file.docx: Permission denied"]
}
```

---

### Ingestion History (`/v1/ingestion-runs`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ingestion-runs` | GET | List ingestion run history |
| `/ingestion-runs/{id}` | DELETE | Delete ingestion run record |

**Response**:
```json
{
  "runs": [
    {
      "id": 789,
      "target": "/data/documents",
      "from_web": false,
      "recursive": true,
      "tags": ["docs"],
      "collection": "default",
      "totals_files": 15,
      "totals_chunks": 342,
      "errors": [],
      "started_at": "2024-10-30T10:00:00Z",
      "finished_at": "2024-10-30T10:15:00Z",
      "status": "success"
    }
  ],
  "total": 42
}
```

---

### Tool Runs (`/v1/tool-runs`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tool-runs` | GET | List tool execution logs |

**Query Parameters**:
- `limit`: Page size (default: 100, max: 1000)
- `offset`: Pagination offset

**Response**:
```json
{
  "runs": [
    {
      "id": 999,
      "tool_name": "web_search",
      "status": "end",
      "start_ts": "2024-10-30T10:00:00Z",
      "end_ts": "2024-10-30T10:00:01.234Z",
      "latency_ms": 1234,
      "args": {"query": "machine learning"},
      "error_message": null,
      "result_preview": "Found 1.2M results..."
    }
  ],
  "total": 5678
}
```

---

### Account Management (`/v1/account`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api-key/rotate` | POST | Generate new API key |
| `/history` | DELETE | Clear all chat history |
| `/export` | GET | Download user data snapshot (JSON) |
| (root) | DELETE | Delete user account and all data |

**Response: Rotate API Key**
```json
{
  "api_key": "new_key_value"
}
```

**Response: Clear History**
```json
{
  "sessions_deleted": 42,
  "messages_deleted": 1234
}
```

**Export Endpoint**: Returns streaming JSON file with timestamp:
```
Content-Disposition: attachment; filename="youworker-export-20241030T100000Z.json"
Content-Type: application/json
```

---

### Analytics Endpoints (`/v1/analytics`)

#### 1. Overview Metrics (`/analytics/overview`)
**GET** with `days` query parameter (default: 30, max: 365)
```json
{
  "total_sessions": 42,
  "total_messages": 1234,
  "total_tokens": 567890,
  "total_tool_runs": 123,
  "total_documents": 42,
  "total_chunks": 5678
}
```

#### 2. Tokens Timeline (`/analytics/tokens`)
Token usage timeline with aggregation

#### 3. Tool Performance (`/analytics/tools`)
Tool execution metrics and performance stats

#### 4. Tool Timeline (`/analytics/tools/timeline`)
Historical tool execution data

#### 5. Ingestion Stats (`/analytics/ingestion`)
Document ingestion metrics

#### 6. Session Activity (`/analytics/sessions`)
Session usage patterns

---

### Health Checks (`/health`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check with component status |
| `/health/detailed` | GET | Comprehensive health check with latencies |

**Response: Basic Health Check**
```json
{
  "status": "healthy|degraded|unhealthy",
  "components": {
    "mcp_servers": {
      "healthy": ["server1", "server2"],
      "unhealthy": ["server3"],
      "total": 3
    },
    "voice": {
      "mode": "turn_based",
      "stt_available": true,
      "tts_available": true
    },
    "database": "connected",
    "agent": "ready|not_initialized",
    "ollama": {
      "base_url": "...",
      "auto_pull": true,
      "ready": true,
      "models": {
        "chat": {"name": "gpt-oss:20b", "available": true},
        "embed": {"name": "nomic-embed-text", "available": true}
      },
      "missing": []
    }
  }
}
```

---

## WebSocket Connection Lifecycle

### 1. Connection Establishment
```javascript
// Client connects with API key
const ws = new WebSocket(
  `ws://host/chat/session-id?api_key=my_api_key`
);

// Server validates, sends welcome
// {"type": "system", "content": "Connected to chat session", ...}
```

### 2. Message Flow
```javascript
// Client sends text
ws.send(JSON.stringify({
  type: "text",
  content: "Hello, AI!",
  metadata: {}
}));

// Server responds with streaming updates
// Multiple messages:
// {"type": "status", "content": "Thinking...", ...}
// {"type": "text", "content": "Hello ", "metadata": {"is_streaming": true}}
// {"type": "text", "content": "there!", "metadata": {"is_streaming": true}}
// {"type": "text", "content": "How can I help?", "metadata": {"is_final": true}}
// {"type": "status", "content": "Response complete", ...}
```

### 3. Heartbeat (Keep-Alive)
```javascript
// Client sends heartbeat every 30 seconds
ws.send(JSON.stringify({"type": "ping"}));

// Server responds with pong
// {"type": "pong"}
```

### 4. Audio Handling
```javascript
// Client sends audio
ws.send(JSON.stringify({
  type: "audio",
  audio_data: "base64_pcm16_data",
  sample_rate: 16000
}));

// Server processes:
// 1. {"type": "status", "content": "Transcribing audio...", ...}
// 2. {"type": "transcript", "content": "What you said", ...}
// 3. Then responds like text message
// 4. If TTS enabled: {"type": "audio", "audio_data": "...", ...}
```

### 5. Disconnection
```javascript
// Normal close
ws.close(1000, "Client disconnect");

// Server cleans up connection and broadcasts disconnect
// Logs: "WebSocket disconnected: connection_id"
```

---

## Data Models

### Database Schema

#### User
```python
class User:
    id: int (PK)
    username: str (UNIQUE, indexed)
    is_root: bool (indexed)
    api_key_hash: str | None
    created_at: datetime
    sessions: list[ChatSession]  # Cascade delete
```

#### ChatSession
```python
class ChatSession:
    id: int (PK)
    external_id: str | None (indexed)
    user_id: int (FK → User, CASCADE)
    title: str | None
    model: str | None (e.g., "gpt-oss:20b")
    enable_tools: bool
    created_at: datetime (indexed)
    updated_at: datetime
    messages: list[ChatMessage]  # Cascade delete
    # Index: (user_id, created_at DESC)
```

#### ChatMessage
```python
class ChatMessage:
    id: int (PK)
    session_id: int (FK → ChatSession, CASCADE)
    role: str (indexed) # "user", "assistant", "system", "tool"
    content: str | None # EncryptedContent type (Fernet encrypted)
    tool_call_name: str | None
    tool_call_id: str | None
    created_at: datetime (indexed)
    tokens_in: int | None
    tokens_out: int | None
    # Indexes: (session_id, created_at DESC), (session_id, tokens_in, tokens_out)
```

#### ToolRun
```python
class ToolRun:
    id: int (PK)
    tool_id: int | None (FK → Tool, SET NULL)
    user_id: int (FK → User, CASCADE)
    session_id: int | None (FK → ChatSession, SET NULL)
    message_id: int | None (FK → ChatMessage, CASCADE)
    tool_name: str (indexed) # e.g., "web_search"
    status: str (indexed) # "start", "end", "error"
    start_ts: datetime (indexed)
    end_ts: datetime | None
    latency_ms: int | None
    args: dict (JSONB)
    error_message: str | None
    result_preview: str | None
    # Indexes: (user_id, start_ts DESC), (tool_name, start_ts DESC), ...
```

#### Document
```python
class Document:
    id: int (PK)
    user_id: int (FK → User, CASCADE)
    uri: str | None # File URI or web URL
    path: str | None # Local file path
    mime: str | None # e.g., "application/pdf"
    bytes_size: int | None
    source: str | None # "upload", "web", etc.
    tags: dict (JSONB, max 5KB)
    collection: str | None (indexed) # "default", "research", etc.
    path_hash: str | None (indexed) # SHA256 hash
    created_at: datetime (indexed)
    last_ingested_at: datetime | None
```

#### IngestionRun
```python
class IngestionRun:
    id: int (PK)
    user_id: int (FK → User, CASCADE)
    target: str # Path or URL
    from_web: bool
    recursive: bool
    tags: dict (JSONB)
    collection: str | None
    totals_files: int
    totals_chunks: int
    errors: dict (JSONB) # {"file.ext": "error message"}
    started_at: datetime (indexed)
    finished_at: datetime | None
    status: str (indexed) # "success", "failed", "partial"
```

#### MCPServer
```python
class MCPServer:
    id: int (PK)
    server_id: str (UNIQUE, indexed) # e.g., "web", "code"
    url: str # Server URL or stdio config
    healthy: bool (indexed)
    last_seen: datetime
    tools: list[Tool]  # Cascade delete
```

#### Tool
```python
class Tool:
    id: int (PK)
    mcp_server_id: int (FK → MCPServer, CASCADE)
    name: str (indexed) # e.g., "web.search"
    description: str | None
    input_schema: dict (JSONB, max 10KB) # JSON Schema
    enabled: bool (indexed)
    last_discovered_at: datetime
    server: MCPServer
    # Unique constraint: (mcp_server_id, name)
```

---

## Middleware Stack

### Order of Application (in main.py):

1. **CORS Middleware** - Cross-Origin Resource Sharing
2. **IP Whitelist Middleware** - Production-only IP filtering
3. **CSRF Middleware** - CSRF token validation (double-submit)
4. **Correlation ID Middleware** - Request tracing (X-Correlation-ID header)
5. **API Version Middleware** - Version detection (X-API-Version header)
6. **Security Headers Middleware** - Standard security headers

### Special Handlers

- **Rate Limiting**: slowapi Limiter with custom key function
- **Exception Handlers**:
  - `YouWorkerException` → structured error response (with code)
  - Generic `Exception` → sanitized error (dev vs prod mode)

---

## Streaming and Real-Time Features

### Server-Sent Events (SSE) Format

For `/v1/chat` and `/v1/unified-chat`:

```
retry: 1000

event: token
data: {"text": "Sample"}

event: tool
data: {"tool": "web_search", "status": "start", "args": {...}}

event: log
data: {"level": "info", "msg": "Searching..."}

event: done
data: {"final_text": "...", "metadata": {...}}
```

**Special Headers**:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (disable buffering in proxies)

### Audio Streaming

Audio data is streamed as **base64-encoded PCM16** samples:
- Sample rate: 8kHz - 48kHz (typical: 16kHz)
- Format: Raw PCM16 (signed 16-bit little-endian)
- Max size: ~10MB base64
- Handled by `audio_pipeline.py` (Whisper for STT, Piper for TTS)

---

## Dependency Injection

### Fastapi Dependencies (`routes/deps.py`)

```python
get_agent_loop(request)              # AgentLoop singleton
get_agent_loop_optional(request)     # Nullable version
get_ollama_client(request)           # OllamaClient singleton
get_ollama_client_optional(request)  # Nullable version
get_registry(request)                # MCPRegistry singleton
get_registry_optional(request)       # Nullable version
get_vector_store(request)            # QdrantStore singleton
get_ingestion_pipeline(request)      # IngestionPipeline singleton
get_current_user_with_collection_access(current_user) # User + collection access
```

All services are stored in `app.state` and initialized during startup via `StartupService`.

---

## Configuration

### Environment Variables

Core settings from `packages.common.settings`:

```
# Server
API_HOST=0.0.0.0
API_PORT=8000
APP_ENV=production|development
LOG_LEVEL=INFO

# Authentication
AUTHENTIK_HEADER_NAME=X-Authentik-Api-Key
AUTHENTIK_FORWARD_USER_HEADER=X-Authentik-Username
JWT_SECRET=<secret>
ROOT_API_KEY=<api_key>
CHAT_MESSAGE_ENCRYPTION_SECRET=<encryption_key>

# Frontend
FRONTEND_ORIGIN=https://youworker.example.com

# Security
CSRF_HEADER_NAME=X-CSRF-Token
CSRF_COOKIE_NAME=youworker_csrf
CSRF_TOKEN_TTL_SECONDS=3600
IP_WHITELIST=192.168.1.0/24,10.0.0.0/8

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db

# Vector Store
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=<optional>

# LLM (Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_AUTO_PULL=true
CHAT_MODEL=gpt-oss:20b
EMBED_MODEL=nomic-embed-text

# Document Ingestion
INGEST_UPLOAD_ROOT=/uploads

# Max iterations for agent loop
MAX_AGENT_ITERATIONS=10
```

---

## Error Handling

### Exception Hierarchy

```
YouWorkerException (base)
├── ResourceNotFoundError (404)
├── ValidationError (400)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── DatabaseError (500)
└── ExternalServiceError (502)
```

### Error Response Format

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {...}
  }
}
```

### Correlation ID Tracing

Every request gets a correlation ID:
- Header: `X-Correlation-ID` (client-provided or auto-generated)
- Response header: Echoed back in `X-Correlation-ID`
- Logs: Included in all log entries for tracing
- Format: UUID v4

---

## Frontend Integration Guide

### Basic Chat Flow

```javascript
// 1. Authenticate
const loginResponse = await fetch('/v1/auth/auto-login', {
  method: 'POST',
  headers: {'X-Authentik-Api-Key': apiKey}
});
// Sets youworker_token cookie automatically

// 2. Get CSRF token
const csrfResponse = await fetch('/v1/auth/csrf-token');
const {csrf_token} = await csrfResponse.json();
// Sets youworker_csrf cookie automatically

// 3. Send chat (HTTP)
const chatResponse = await fetch('/v1/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf_token
  },
  credentials: 'include',
  body: JSON.stringify({
    messages: [{role: "user", content: "Hello"}],
    stream: true,
    enable_tools: true
  })
});

// 4. Process SSE stream
const reader = chatResponse.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const {done, value} = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\n');
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // Handle event type
    }
    if (line.startsWith('data: ')) {
      // Handle event data
    }
  }
}
```

### WebSocket Chat Flow

```javascript
// 1. Connect (authentication in URL)
const ws = new WebSocket(
  `ws://host/chat/session-123?api_key=${apiKey}`
);

ws.onopen = () => console.log('Connected');

// 2. Send messages
ws.send(JSON.stringify({
  type: 'text',
  content: 'Hello!',
  metadata: {}
}));

// 3. Receive messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch(msg.type) {
    case 'text':
      console.log('Response:', msg.content);
      break;
    case 'tool':
      console.log('Tool:', msg.metadata);
      break;
    case 'status':
      console.log('Status:', msg.metadata.stage);
      break;
    case 'error':
      console.error('Error:', msg.content);
      break;
  }
};

// 4. Keep-alive
setInterval(() => {
  ws.send(JSON.stringify({type: 'ping'}));
}, 30000);
```

### Voice Interaction

```javascript
// Record audio as PCM16 at 16kHz
const audioBytes = await recordAudio();
const b64Audio = btoa(audioBytes);

// Send voice turn
const response = await fetch('/v1/voice-turn', {
  method: 'POST',
  headers: {'X-CSRF-Token': csrfToken},
  credentials: 'include',
  body: JSON.stringify({
    audio_b64: b64Audio,
    sample_rate: 16000,
    expect_audio: true,
    enable_tools: true
  })
});

const result = await response.json();
console.log('Transcript:', result.transcript);
console.log('Response:', result.assistant_text);

// Play audio response if available
if (result.audio_b64) {
  const wav = base64ToWav(result.audio_b64);
  const audio = new Audio(URL.createObjectURL(wav));
  audio.play();
}
```

---

## Performance Considerations

### Rate Limiting
- **Global**: 100 req/min per user (or IP)
- **Ingestion**: 10 req/min per user
- Configurable via `slowapi`

### Message Encryption
- **Performance**: Minimal impact (Fernet is fast)
- **Storage**: +25-30% overhead for encrypted data
- **Required**: Mandatory for compliance

### WebSocket Heartbeat
- **Interval**: 30 seconds
- **Timeout**: 60 seconds of inactivity = stale connection
- **Automatic cleanup**: Background heartbeat monitor

### Streaming
- **Response buffering**: Disabled in proxies (X-Accel-Buffering: no)
- **Heartbeat**: Sent every 15 seconds during long operations
- **Message chunking**: Tokens streamed individually

### Database Indexes
- Strategic indexes on (user_id, created_at)
- Separate indexes for analytics queries
- Encrypted message content is indexed by session/date

---

## Security Best Practices

### For Frontend Implementation

1. **CSRF Protection**
   - Always fetch CSRF token before mutating operations
   - Include in X-CSRF-Token header
   - Cookie is automatically managed by server

2. **XSS Prevention**
   - Server sanitizes all inputs
   - Escape all user content in UI
   - Use innerHTML carefully

3. **Session Management**
   - JWT token stored in HttpOnly cookie (not accessible to JS)
   - 30-minute expiration
   - Automatic refresh recommended before expiry

4. **API Key Handling**
   - For WebSocket: Use header (`X-Api-Key`) in production, not query param
   - Never log or expose API keys
   - Rotate regularly via `/v1/account/api-key/rotate`

5. **Audio Data**
   - PCM16 audio is user-generated, no additional sanitization needed
   - TTS output is server-generated, safe to play

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | No JWT token or expired | Call `/v1/auth/auto-login` to get token |
| 403 CSRF mismatch | Missing/invalid CSRF token | Fetch token from `/v1/auth/csrf-token` |
| 503 Ollama unavailable | LLM service down | Check OLLAMA_BASE_URL and restart Ollama |
| WebSocket closes after ~30s | No heartbeat sent | Client must send "ping" message every 30s |
| Ingestion fails | Path traversal or permission | Use absolute paths, ensure user has read access |
| Encryption error | Missing CHAT_MESSAGE_ENCRYPTION_SECRET | Generate key and set env var |

### Health Check Usage

```bash
# Quick health check
curl http://localhost:8000/health

# Detailed diagnostics
curl http://localhost:8000/health/detailed

# Check database connection
curl http://localhost:8000/health/detailed | jq '.components.database'
```

---

## Summary

The YouWorker backend is a **production-ready, secure, and scalable AI agent platform** featuring:

✓ Multi-modal interaction (text, audio, streaming)
✓ Authentik SSO integration with JWT tokens
✓ CSRF protection and input sanitization
✓ End-to-end message encryption
✓ WebSocket real-time communication with auto-reconnection
✓ MCP tool integration for extended capabilities
✓ Comprehensive analytics and usage tracking
✓ Document ingestion with vector search
✓ Rate limiting and IP whitelisting
✓ Structured error handling and correlation IDs
✓ Async/await throughout for high concurrency

Frontend developers should use the **HTTP streaming endpoints** for simplicity or **WebSocket** for real-time bidirectional communication. All endpoints are fully documented with examples above.
