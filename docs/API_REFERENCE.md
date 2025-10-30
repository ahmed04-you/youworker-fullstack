# YouWorker API Reference

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - API Under Active Development
**Base URL:** `http://localhost:8001`
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

This API reference describes the target API for YouWorker v1.0. While most endpoints are functional, some features are still being refined. Breaking changes may occur before final release.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Groups API](#groups-api)
3. [Chat API](#chat-api)
4. [Document Ingestion API](#document-ingestion-api)
5. [Analytics API](#analytics-api)
6. [Health & Status API](#health--status-api)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

### Overview

YouWorker supports two authentication methods:

1. **JWT Tokens**: Session-based authentication with HttpOnly cookies
2. **API Keys**: For programmatic access and service accounts

### Auto Login

Create or retrieve authenticated session.

```http
POST /v1/auth/auto-login
Content-Type: application/json

{
  "username": "user@example.com"
}
```

**Response (200 OK)**

```json
{
  "user": {
    "id": 1,
    "username": "user@example.com",
    "is_root": false,
    "created_at": "2025-10-30T10:00:00Z"
  },
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "csrf_token": "a7f3c9e1..."
}
```

**Cookies Set:**
- `youworker_token`: JWT token (HttpOnly, SameSite=Lax)
- `youworker_csrf`: CSRF token

### Get Current User

Retrieve authenticated user details.

```http
GET /v1/auth/me
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "id": 1,
  "username": "user@example.com",
  "is_root": false,
  "created_at": "2025-10-30T10:00:00Z"
}
```

### Logout

Invalidate current session.

```http
POST /v1/auth/logout
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "message": "Logged out successfully"
}
```

### Get CSRF Token

Retrieve CSRF token for state-changing operations.

```http
GET /v1/auth/csrf-token
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "csrf_token": "a7f3c9e1b2d4..."
}
```

**Required Headers for State-Changing Requests:**
- `X-CSRF-Token`: CSRF token from `/csrf-token` endpoint

---

## Groups API

### Create Group

Create a new group. Creator becomes admin automatically.

```http
POST /v1/groups
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "name": "Engineering Team",
  "description": "Product engineering workspace"
}
```

**Response (201 Created)**

```json
{
  "id": 1,
  "name": "Engineering Team",
  "description": "Product engineering workspace",
  "created_at": "2025-10-30T10:00:00Z",
  "updated_at": "2025-10-30T10:00:00Z",
  "member_count": 1,
  "members": [
    {
      "user_id": 1,
      "username": "user@example.com",
      "role": "admin",
      "joined_at": "2025-10-30T10:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input or duplicate group name
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: CSRF validation failed

### List Groups

Get all groups for authenticated user.

```http
GET /v1/groups
Cookie: youworker_token=...
```

**Query Parameters:**
- `limit` (optional): Maximum results (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response (200 OK)**

```json
{
  "groups": [
    {
      "id": 1,
      "name": "Engineering Team",
      "description": "Product engineering",
      "member_count": 5,
      "role": "admin",
      "created_at": "2025-10-30T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Get Group Details

Retrieve detailed group information.

```http
GET /v1/groups/{group_id}
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "id": 1,
  "name": "Engineering Team",
  "description": "Product engineering",
  "created_at": "2025-10-30T10:00:00Z",
  "updated_at": "2025-10-30T10:00:00Z",
  "member_count": 5,
  "members": [
    {
      "user_id": 1,
      "username": "admin@example.com",
      "role": "admin",
      "joined_at": "2025-10-30T10:00:00Z"
    },
    {
      "user_id": 2,
      "username": "dev@example.com",
      "role": "member",
      "joined_at": "2025-10-30T11:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Group doesn't exist or user not a member

### Update Group

Update group details. Requires admin role.

```http
PATCH /v1/groups/{group_id}
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "name": "Platform Engineering",
  "description": "Platform and infrastructure team"
}
```

**Response (200 OK)**

```json
{
  "id": 1,
  "name": "Platform Engineering",
  "description": "Platform and infrastructure team",
  "updated_at": "2025-10-30T12:00:00Z"
}
```

**Error Responses:**
- `403 Forbidden`: User is not an admin
- `400 Bad Request`: Duplicate group name

### Delete Group

Delete a group. Requires admin role.

```http
DELETE /v1/groups/{group_id}
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
```

**Response (204 No Content)**

### Add Group Member

Add a user to a group. Requires admin role.

```http
POST /v1/groups/{group_id}/members
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "user_id": 5,
  "role": "member"
}
```

**Roles:**
- `member`: Standard member
- `admin`: Can manage group and members

**Response (201 Created)**

```json
{
  "user_id": 5,
  "username": "newuser@example.com",
  "role": "member",
  "joined_at": "2025-10-30T13:00:00Z"
}
```

### Remove Group Member

Remove a user from a group. Requires admin role.

```http
DELETE /v1/groups/{group_id}/members/{user_id}
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
```

**Response (204 No Content)**

### Update Member Role

Change a member's role. Requires admin role.

```http
PATCH /v1/groups/{group_id}/members/{user_id}
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "role": "admin"
}
```

**Response (200 OK)**

```json
{
  "user_id": 5,
  "username": "user@example.com",
  "role": "admin",
  "joined_at": "2025-10-30T13:00:00Z"
}
```

---

## Chat API

### Send Chat Message (HTTP)

Send a message and receive agent response.

```http
POST /v1/chat
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "text_input": "What is the weather today?",
  "session_id": "session-123",
  "enable_tools": true,
  "model": "gpt-oss:20b"
}
```

**Request Body:**
- `text_input` (string, optional): Text message
- `audio_b64` (string, optional): Base64-encoded audio (PCM16)
- `session_id` (string, optional): Session identifier (creates new if not provided)
- `enable_tools` (boolean, optional): Enable tool usage (default: true)
- `model` (string, optional): LLM model to use

**Response (200 OK)**

```json
{
  "content": "Based on the weather data, it's currently 22°C and sunny.",
  "session_id": "session-123",
  "metadata": {
    "model": "gpt-oss:20b",
    "tokens_in": 150,
    "tokens_out": 45,
    "iterations": 2
  },
  "tool_events": [
    {
      "tool": "weather.get",
      "status": "success",
      "latency_ms": 234,
      "ts": "2025-10-30T14:00:00Z"
    }
  ]
}
```

### Chat with Streaming (SSE)

Stream agent response in real-time.

```http
POST /v1/chat/stream
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json
Accept: text/event-stream

{
  "text_input": "Explain quantum computing",
  "session_id": "session-456",
  "enable_tools": true
}
```

**Response (200 OK)**

```
Content-Type: text/event-stream

event: token
data: {"text": "Quantum "}

event: token
data: {"text": "computing "}

event: tool
data: {"tool": "semantic.search", "status": "start", "args": {...}}

event: tool
data: {"tool": "semantic.search", "status": "end", "latency_ms": 120}

event: token
data: {"text": "is a revolutionary..."}

event: done
data: {"metadata": {"iterations": 1, "tool_calls": 1, "status": "success"}}
```

**Event Types:**
- `token`: Content chunk
- `tool`: Tool execution event
- `log`: Log message
- `done`: Completion event

### WebSocket Chat

Real-time bi-directional communication.

```javascript
const ws = new WebSocket('ws://localhost:8001/v1/ws/chat/session-789');

// Send message
ws.send(JSON.stringify({
  type: "text",
  content: "Hello, assistant!"
}));

// Receive response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Message Types:**

**Client → Server:**
```json
{
  "type": "text",
  "content": "What's the status?"
}
```

```json
{
  "type": "audio",
  "content": "base64-encoded-audio-data",
  "format": "pcm16"
}
```

```json
{
  "type": "stop",
  "content": ""
}
```

**Server → Client:**
```json
{
  "type": "token",
  "content": "Partial response text"
}
```

```json
{
  "type": "tool",
  "tool": "weather.get",
  "status": "start|end",
  "latency_ms": 150
}
```

```json
{
  "type": "done",
  "metadata": {
    "iterations": 2,
    "tool_calls": 1
  }
}
```

### List Chat Sessions

Get user's chat sessions.

```http
GET /v1/chat/sessions
Cookie: youworker_token=...
```

**Query Parameters:**
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Response (200 OK)**

```json
{
  "sessions": [
    {
      "id": 1,
      "external_id": "session-123",
      "title": "Weather Discussion",
      "model": "gpt-oss:20b",
      "message_count": 10,
      "created_at": "2025-10-30T10:00:00Z",
      "updated_at": "2025-10-30T14:00:00Z"
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}
```

### Get Session History

Retrieve conversation history.

```http
GET /v1/chat/sessions/{session_id}
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "id": 1,
  "external_id": "session-123",
  "title": "Weather Discussion",
  "model": "gpt-oss:20b",
  "enable_tools": true,
  "created_at": "2025-10-30T10:00:00Z",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "What's the weather?",
      "created_at": "2025-10-30T10:00:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Let me check the weather for you.",
      "created_at": "2025-10-30T10:00:01Z",
      "tokens_in": 50,
      "tokens_out": 20
    }
  ]
}
```

### Delete Session

Delete a chat session and all messages.

```http
DELETE /v1/chat/sessions/{session_id}
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
```

**Response (204 No Content)**

---

## Document Ingestion API

### Upload Files

Upload and ingest documents.

```http
POST /v1/ingest/upload
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="files"; filename="document.pdf"
Content-Type: application/pdf

<binary data>
--boundary
Content-Disposition: form-data; name="tags"

["important", "project-x"]
--boundary--
```

**Supported File Types:**
- PDF: `application/pdf`
- Text: `text/plain`, `text/markdown`
- CSV: `text/csv`
- JSON: `application/json`
- Images: `image/png`, `image/jpeg`
- Audio: `audio/mpeg`, `audio/wav`

**Max File Size:** 100MB per file

**Response (200 OK)**

```json
{
  "success": true,
  "files_processed": 1,
  "chunks_written": 45,
  "totals": {
    "files": 1,
    "chunks": 45,
    "total_bytes": 2048576
  },
  "files": [
    {
      "path": "/uploads/run-abc123/document.pdf",
      "mime": "application/pdf",
      "size_bytes": 2048576,
      "chunks": 45
    }
  ],
  "errors": []
}
```

### Ingest from Path

Ingest documents from local path or URL.

```http
POST /v1/ingest/path
Cookie: youworker_token=...
X-CSRF-Token: a7f3c9e1...
Content-Type: application/json

{
  "path_or_url": "/data/documents/report.pdf",
  "from_web": false,
  "recursive": false,
  "tags": ["reports", "Q4-2024"]
}
```

**Request Body:**
- `path_or_url` (string): Local path or web URL
- `from_web` (boolean): Whether to fetch from web
- `recursive` (boolean): Process subdirectories
- `tags` (array, optional): Tags to apply

**Response (200 OK)**

```json
{
  "success": true,
  "files_processed": 3,
  "chunks_written": 150,
  "totals": {
    "files": 3,
    "chunks": 150,
    "total_bytes": 5242880
  },
  "files": [
    {
      "path": "/data/documents/report.pdf",
      "mime": "application/pdf",
      "size_bytes": 2048576,
      "chunks": 45
    }
  ],
  "errors": []
}
```

---

## Analytics API

### Dashboard Metrics

Get aggregated metrics for dashboard.

```http
GET /v1/analytics/dashboard
Cookie: youworker_token=...
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 datetime
- `end_date` (optional): ISO 8601 datetime
- `period` (optional): `day|week|month` (default: week)

**Response (200 OK)**

```json
{
  "period": "week",
  "start_date": "2025-10-23T00:00:00Z",
  "end_date": "2025-10-30T23:59:59Z",
  "metrics": {
    "total_sessions": 145,
    "total_messages": 1250,
    "total_tokens": 450000,
    "total_tool_calls": 320,
    "avg_session_length": 8.6,
    "avg_response_time_ms": 1200
  },
  "top_tools": [
    {
      "tool_name": "semantic.search",
      "count": 180,
      "avg_latency_ms": 150
    },
    {
      "tool_name": "web.search",
      "count": 85,
      "avg_latency_ms": 850
    }
  ],
  "daily_breakdown": [
    {
      "date": "2025-10-30",
      "sessions": 25,
      "messages": 180,
      "tokens": 65000
    }
  ]
}
```

### Session Analytics

Get detailed analytics for a session.

```http
GET /v1/analytics/sessions/{session_id}
Cookie: youworker_token=...
```

**Response (200 OK)**

```json
{
  "session_id": 1,
  "total_messages": 12,
  "total_tokens_in": 850,
  "total_tokens_out": 1200,
  "tool_calls": 3,
  "duration_seconds": 145,
  "tools_used": [
    {
      "tool_name": "semantic.search",
      "count": 2,
      "avg_latency_ms": 120
    }
  ]
}
```

### Token Usage

Get token usage statistics.

```http
GET /v1/analytics/tokens
Cookie: youworker_token=...
```

**Query Parameters:**
- `period`: `day|week|month|all`
- `model` (optional): Filter by model

**Response (200 OK)**

```json
{
  "period": "week",
  "total_tokens_in": 125000,
  "total_tokens_out": 85000,
  "by_model": [
    {
      "model": "gpt-oss:20b",
      "tokens_in": 125000,
      "tokens_out": 85000,
      "message_count": 450
    }
  ]
}
```

---

## Health & Status API

### Basic Health Check

Quick health check.

```http
GET /health
```

**Response (200 OK)**

```json
{
  "status": "healthy",
  "timestamp": "2025-10-30T15:00:00Z"
}
```

### Detailed Health Check

Comprehensive health check with component status.

```http
GET /health/detailed
```

**Response (200 OK)**

```json
{
  "status": "healthy",
  "components": [
    {
      "name": "database",
      "status": "healthy",
      "latency_ms": 8.5
    },
    {
      "name": "ollama",
      "status": "healthy",
      "latency_ms": 45.2
    },
    {
      "name": "qdrant",
      "status": "healthy",
      "latency_ms": 12.1
    }
  ],
  "timestamp": "2025-10-30T15:00:00Z"
}
```

**Component Statuses:**
- `healthy`: Component operational, latency within thresholds
- `degraded`: Component operational, slow response
- `unhealthy`: Component not responding or errors

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Group with name 'Engineering' already exists",
    "code": "GROUP_NAME_EXISTS",
    "details": {
      "name": "Engineering"
    }
  }
}
```

### Common Error Codes

**4xx Client Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | VALIDATION_ERROR | Invalid input data |
| 400 | GROUP_NAME_EXISTS | Duplicate group name |
| 400 | MEMBERSHIP_EXISTS | User already in group |
| 401 | NOT_AUTHENTICATED | Missing or invalid authentication |
| 401 | INVALID_API_KEY | Invalid API key |
| 403 | NOT_AUTHORIZED | Insufficient permissions |
| 403 | NOT_GROUP_ADMIN | Admin role required |
| 403 | CSRF_VALIDATION_FAILED | Invalid CSRF token |
| 404 | RESOURCE_NOT_FOUND | Resource doesn't exist |
| 404 | GROUP_NOT_FOUND | Group not found |
| 404 | USER_NOT_FOUND | User not found |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |

**5xx Server Errors:**

| Status | Code | Description |
|--------|------|-------------|
| 500 | DATABASE_ERROR | Database operation failed |
| 502 | EXTERNAL_SERVICE_ERROR | External service unavailable |
| 502 | LLM_ERROR | LLM service error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |

---

## Rate Limiting

### Global Limits

- **Default**: 100 requests per minute per user
- **Burst**: Up to 120 requests in short bursts

### Rate Limit Headers

Responses include rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1698765432
```

### Rate Limit Exceeded

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "error": {
    "message": "Rate limit exceeded. Try again in 30 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "retry_after": 30,
      "limit": 100,
      "period": "minute"
    }
  }
}
```

---

## API Versioning

Current API version: `v1`

All endpoints are prefixed with `/v1/`

Future versions will be accessible via `/v2/`, `/v3/`, etc.

---

## Interactive Documentation

**Swagger UI**: http://localhost:8001/docs
**ReDoc**: http://localhost:8001/redoc

---

## Client Libraries

### Python

```python
import httpx

class YouWorkerClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {"Cookie": f"youworker_token={token}"}

    async def send_message(self, text: str, session_id: str = None):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/chat",
                json={"text_input": text, "session_id": session_id},
                headers=self.headers
            )
            return response.json()

# Usage
client = YouWorkerClient("http://localhost:8001", "your-token")
response = await client.send_message("Hello!")
```

### JavaScript

```javascript
class YouWorkerClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async sendMessage(text, sessionId = null) {
    const response = await fetch(`${this.baseUrl}/v1/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text_input: text,
        session_id: sessionId
      })
    });
    return response.json();
  }
}

// Usage
const client = new YouWorkerClient('http://localhost:8001');
const response = await client.sendMessage('Hello!');
```

---

## Support

For API questions or issues:
- Documentation: http://localhost:8001/docs
- GitHub Issues: [repository]/issues
- Email: support@youco.it
