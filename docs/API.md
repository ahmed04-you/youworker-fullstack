# API Documentation

Complete reference for YouWorker.AI REST and WebSocket APIs.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
- [WebSocket API](#websocket-api)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

### Base URLs

- **REST API**: `http://localhost:8001` (or configured `API_PORT`)
- **WebSocket**: `ws://localhost:8001` (or configured `API_PORT`)
- **API Documentation**: http://localhost:8001/docs (OpenAPI/Swagger)
- **Alternative Docs**: http://localhost:8001/redoc (ReDoc)

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **WebSocket**: JSON messages

## Authentication

### API Key Authentication

Include the API key in the request header:

```http
X-API-Key: your-api-key-here
```

Or as a query parameter:

```http
GET /endpoint?api_key=your-api-key-here
```

### JWT Authentication

Include the JWT token in the Authorization header:

```http
Authorization: Bearer your-jwt-token-here
```

### Root API Key

The root API key is configured via the `ROOT_API_KEY` environment variable and provides full access to all endpoints.

## REST API Endpoints

### Health Check

#### `GET /health`

Check API health and service status.

**Response**:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2025-01-26T15:00:00Z",
  "services": {
    "ollama": "connected",
    "postgres": "connected",
    "qdrant": "connected",
    "mcp_servers": 5
  }
}
```

---

### Chat Endpoints

#### `POST /v1/chat/stream`

Stream chat responses with server-sent events (SSE).

**Request Body**:
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "session_id": "optional-session-id",
  "enable_tools": true,
  "model": "gpt-oss:20b",
  "assistant_language": "it"
}
```

**Response** (SSE stream):
```
data: {"event":"token","data":{"text":"Hello"}}

data: {"event":"token","data":{"text":" there"}}

data: {"event":"done","data":{"final_text":"Hello there!","metadata":{}}}
```

#### `POST /v1/chat/voice`

Send voice input and receive text/audio response.

**Request Body**:
```json
{
  "audio_b64": "base64-encoded-audio-data",
  "sample_rate": 16000,
  "session_id": "optional-session-id",
  "enable_tools": true,
  "expect_audio": true
}
```

**Response**:
```json
{
  "content": "Assistant response text",
  "transcript": "Transcribed user speech",
  "audio_b64": "base64-encoded-response-audio",
  "audio_sample_rate": 22050,
  "stt_confidence": 0.95,
  "stt_language": "it",
  "tool_events": [],
  "assistant_language": "it"
}
```

#### `POST /v1/chat/unified`

Unified endpoint supporting both text and voice input.

**Request Body**:
```json
{
  "text_input": "Hello",
  "audio_b64": null,
  "messages": [],
  "session_id": "optional-session-id",
  "enable_tools": true,
  "expect_audio": false,
  "model": "gpt-oss:20b",
  "assistant_language": "it"
}
```

**Response**: Same as `/v1/chat/voice`

---

### Document Ingestion

#### `POST /v1/ingestion/upload`

Upload and process a document for semantic search.

**Request** (multipart/form-data):
- `file`: The file to upload (PDF, TXT, MP3, etc.)
- `collection_name`: (optional) Target collection name

**Response**:
```json
{
  "status": "success",
  "document_id": "doc_123",
  "filename": "document.pdf",
  "pages": 10,
  "chunks": 45,
  "processing_time_ms": 5230
}
```

#### `POST /v1/ingestion/url`

Ingest content from a URL.

**Request Body**:
```json
{
  "url": "https://example.com/article",
  "collection_name": "documents"
}
```

**Response**: Same as `/v1/ingestion/upload`

#### `POST /v1/ingestion/text`

Ingest raw text content.

**Request Body**:
```json
{
  "text": "Your text content here",
  "metadata": {
    "source": "manual",
    "title": "My Document"
  },
  "collection_name": "documents"
}
```

**Response**:
```json
{
  "status": "success",
  "document_id": "doc_456",
  "chunks": 3
}
```

---

### CRUD Operations

#### `GET /v1/sessions`

List all chat sessions for the authenticated user.

**Query Parameters**:
- `limit`: (optional) Number of sessions to return (default: 20)
- `offset`: (optional) Pagination offset (default: 0)

**Response**:
```json
{
  "sessions": [
    {
      "id": 1,
      "external_id": "session_abc",
      "created_at": "2025-01-26T10:00:00Z",
      "message_count": 15,
      "last_activity": "2025-01-26T14:30:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

#### `GET /v1/sessions/{session_id}/messages`

Get messages from a specific session.

**Response**:
```json
{
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Hello",
      "timestamp": "2025-01-26T10:01:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Hi! How can I help?",
      "timestamp": "2025-01-26T10:01:02Z"
    }
  ]
}
```

#### `DELETE /v1/sessions/{session_id}`

Delete a chat session and all its messages.

**Response**:
```json
{
  "status": "success",
  "deleted_messages": 15
}
```

---

### Analytics Endpoints

#### `GET /v1/analytics/overview`

Get overall usage statistics.

**Query Parameters**:
- `start_date`: (optional) Start date (ISO 8601)
- `end_date`: (optional) End date (ISO 8601)

**Response**:
```json
{
  "total_sessions": 142,
  "total_messages": 3421,
  "total_tokens": 458921,
  "total_tool_calls": 234,
  "active_users": 12,
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-26T23:59:59Z"
  }
}
```

#### `GET /v1/analytics/tokens`

Get token usage breakdown by model and time period.

**Response**:
```json
{
  "by_model": {
    "gpt-oss:20b": {
      "input_tokens": 123456,
      "output_tokens": 234567,
      "total_tokens": 358023
    }
  },
  "by_day": [
    {
      "date": "2025-01-26",
      "tokens": 15234
    }
  ]
}
```

#### `GET /v1/analytics/tools`

Get tool usage statistics.

**Response**:
```json
{
  "tools": [
    {
      "name": "web_search",
      "calls": 45,
      "success_rate": 0.95,
      "avg_latency_ms": 1234
    },
    {
      "name": "semantic_search",
      "calls": 189,
      "success_rate": 0.98,
      "avg_latency_ms": 456
    }
  ]
}
```

#### `GET /v1/analytics/sessions`

Get session statistics.

**Response**:
```json
{
  "total_sessions": 142,
  "avg_messages_per_session": 24.1,
  "avg_duration_minutes": 8.5,
  "by_date": [
    {
      "date": "2025-01-26",
      "sessions": 12,
      "messages": 289
    }
  ]
}
```

#### `GET /v1/analytics/ingestion`

Get document ingestion statistics.

**Response**:
```json
{
  "total_documents": 234,
  "total_chunks": 5678,
  "by_type": {
    "pdf": 145,
    "text": 67,
    "web": 22
  },
  "by_collection": {
    "documents": 234
  }
}
```

---

## WebSocket API

### Connection

#### `WebSocket /chat/{session_id}`

Establish WebSocket connection for real-time chat.

**URL Parameters**:
- `session_id`: Unique session identifier

**Query Parameters**:
- `token`: (optional) JWT authentication token
- `api_key`: (optional) API key for authentication

**Example**:
```javascript
const ws = new WebSocket(
  'ws://localhost:8001/chat/my-session?token=your-jwt-token'
);
```

### Message Types

#### Client → Server Messages

**Text Message**:
```json
{
  "type": "text",
  "content": "Hello, assistant!",
  "metadata": {},
  "timestamp": "2025-01-26T15:00:00Z"
}
```

**Audio Message**:
```json
{
  "type": "audio",
  "audio_data": "base64-encoded-pcm16-audio",
  "sample_rate": 16000,
  "metadata": {
    "expect_audio": true
  },
  "timestamp": "2025-01-26T15:00:00Z"
}
```

**Stop Streaming**:
```json
{
  "type": "stop",
  "timestamp": "2025-01-26T15:00:00Z"
}
```

**Heartbeat (Ping)**:
```json
{
  "type": "ping",
  "timestamp": "2025-01-26T15:00:00Z"
}
```

#### Server → Client Messages

**System Message**:
```json
{
  "type": "system",
  "content": "Connected to chat session",
  "timestamp": "2025-01-26T15:00:00Z"
}
```

**Text Response (Streaming)**:
```json
{
  "type": "text",
  "content": "Hello",
  "metadata": {
    "is_streaming": true
  },
  "timestamp": "2025-01-26T15:00:01Z"
}
```

**Text Response (Final)**:
```json
{
  "type": "text",
  "content": "Hello there! How can I help you today?",
  "metadata": {
    "is_final": true
  },
  "timestamp": "2025-01-26T15:00:03Z"
}
```

**Audio Response**:
```json
{
  "type": "audio",
  "audio_data": "base64-encoded-wav-audio",
  "sample_rate": 22050,
  "metadata": {
    "is_final": true
  },
  "timestamp": "2025-01-26T15:00:05Z"
}
```

**Transcript**:
```json
{
  "type": "transcript",
  "content": "Transcribed user speech",
  "metadata": {
    "confidence": 0.95,
    "language": "it"
  },
  "timestamp": "2025-01-26T15:00:02Z"
}
```

**Tool Execution**:
```json
{
  "type": "tool",
  "content": "web_search",
  "metadata": {
    "status": "start",
    "args": {"query": "Python tutorial"}
  },
  "timestamp": "2025-01-26T15:00:02.500Z"
}
```

**Status Update**:
```json
{
  "type": "status",
  "content": "Thinking...",
  "metadata": {
    "stage": "thinking"
  },
  "timestamp": "2025-01-26T15:00:02Z"
}
```

**Error**:
```json
{
  "type": "error",
  "content": "Error message",
  "timestamp": "2025-01-26T15:00:00Z"
}
```

**Heartbeat Response (Pong)**:
```json
{
  "type": "pong",
  "timestamp": "2025-01-26T15:00:00Z"
}
```

### Connection Lifecycle

1. **Connect**: Client establishes WebSocket connection
2. **Authenticate**: Server validates token/API key
3. **Welcome**: Server sends system message confirming connection
4. **Communication**: Bidirectional message exchange
5. **Heartbeat**: Periodic ping/pong to maintain connection
6. **Disconnect**: Clean connection termination

### Error Codes

| Code | Reason | Description |
|------|--------|-------------|
| 1000 | Normal Closure | Clean disconnect |
| 1008 | Policy Violation | Authentication failed |
| 1011 | Internal Error | Server error occurred |

---

## Data Models

### ChatMessage

```typescript
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}
```

### UnifiedChatRequest

```typescript
interface UnifiedChatRequest {
  text_input?: string;
  audio_b64?: string;
  sample_rate?: number;  // 8000-48000
  messages?: ChatMessage[];
  session_id?: string;
  assistant_language?: string;
  enable_tools?: boolean;
  model?: string;
  expect_audio?: boolean;
}
```

### UnifiedChatResponse

```typescript
interface UnifiedChatResponse {
  content?: string;
  transcript?: string;
  metadata: Record<string, any>;
  audio_b64?: string;
  audio_sample_rate?: number;
  stt_confidence?: number;
  stt_language?: string;
  tool_events?: ToolEvent[];
  assistant_language?: string;
}
```

### ToolEvent

```typescript
interface ToolEvent {
  tool: string;
  status: "start" | "end" | "error";
  args?: Record<string, any>;
  latency_ms?: number;
  result_preview?: string;
  error_message?: string;
}
```

---

## Error Handling

### HTTP Error Responses

All API errors follow this format:

```json
{
  "detail": "Error message",
  "status_code": 400,
  "timestamp": "2025-01-26T15:00:00Z"
}
```

### Common Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid input, missing parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Service not ready |

### Validation Errors

Pydantic validation errors include detailed field information:

```json
{
  "detail": [
    {
      "loc": ["body", "sample_rate"],
      "msg": "ensure this value is greater than or equal to 8000",
      "type": "value_error.number.not_ge"
    }
  ]
}
```

---

## Rate Limiting

### Default Limits

- **Global**: 100 requests per minute
- **Per IP**: Based on endpoint sensitivity
- **WebSocket**: 1000 messages per minute per connection

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706280060
```

### Rate Limit Exceeded Response

```json
{
  "detail": "Rate limit exceeded. Try again in 42 seconds.",
  "status_code": 429
}
```

---

## Examples

### Complete Chat Flow (REST)

```python
import requests
import json

API_BASE = "http://localhost:8001"
API_KEY = "your-api-key"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Send chat message
response = requests.post(
    f"{API_BASE}/v1/chat/unified",
    headers=headers,
    json={
        "text_input": "What is the weather like?",
        "enable_tools": True,
        "session_id": "my-session"
    }
)

result = response.json()
print(f"Assistant: {result['content']}")
```

### WebSocket Chat (JavaScript)

```javascript
const ws = new WebSocket(
  'ws://localhost:8001/chat/my-session?api_key=your-api-key'
);

ws.onopen = () => {
  console.log('Connected');
  
  // Send text message
  ws.send(JSON.stringify({
    type: 'text',
    content: 'Hello!',
    timestamp: new Date().toISOString()
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'text') {
    console.log('Assistant:', message.content);
  } else if (message.type === 'tool') {
    console.log('Tool:', message.content, message.metadata);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code, event.reason);
};
```

### Voice Input (Python)

```python
import base64
import requests

# Read audio file
with open("audio.wav", "rb") as f:
    audio_data = f.read()

# Encode as base64
audio_b64 = base64.b64encode(audio_data).decode()

# Send to API
response = requests.post(
    f"{API_BASE}/v1/chat/voice",
    headers=headers,
    json={
        "audio_b64": audio_b64,
        "sample_rate": 16000,
        "expect_audio": True
    }
)

result = response.json()
print(f"Transcript: {result['transcript']}")
print(f"Response: {result['content']}")

# Save response audio
if result.get('audio_b64'):
    audio_bytes = base64.b64decode(result['audio_b64'])
    with open("response.wav", "wb") as f:
        f.write(audio_bytes)
```

### Document Upload (cURL)

```bash
curl -X POST "http://localhost:8001/v1/ingestion/upload" \
  -H "X-API-Key: your-api-key" \
  -F "file=@document.pdf" \
  -F "collection_name=documents"
```

### Streaming Chat (Python)

```python
import requests

response = requests.post(
    f"{API_BASE}/v1/chat/stream",
    headers=headers,
    json={
        "messages": [{"role": "user", "content": "Tell me a story"}],
        "enable_tools": True
    },
    stream=True
)

for line in response.iter_lines():
    if line:
        # Parse SSE format: "data: {...}"
        if line.startswith(b'data: '):
            data = json.loads(line[6:])
            if data['event'] == 'token':
                print(data['data']['text'], end='', flush=True)
            elif data['event'] == 'done':
                print('\n\nDone!')
```

---

## API Versioning

Current API version: **v1**

All endpoints are prefixed with `/v1/` to support future versioning.

---

## Related Documentation

- [Setup Guide](SETUP.md) - Installation and configuration
- [Architecture](ARCHITECTURE.md) - System design
- [Frontend Guide](FRONTEND.md) - Frontend integration
- [WebSocket Client](CHAT_ARCHITECTURE.md) - Real-time communication details