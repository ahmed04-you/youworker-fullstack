# System Architecture

This document provides a comprehensive overview of YouWorker.AI's architecture, including system design, component interactions, data flow, and key design decisions.

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Component Overview](#component-overview)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Design Decisions](#design-decisions)
- [Scalability Considerations](#scalability-considerations)

## High-Level Architecture

YouWorker.AI follows a microservices-inspired architecture with containerized components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (Port 8000)                       │
│                    Reverse Proxy & SSL Termination              │
└────────────┬──────────────────────────────────┬─────────────────┘
             │                                  │
             ▼                                  ▼
    ┌─────────────────┐              ┌──────────────────┐
    │   Frontend      │              │   API Backend    │
    │   (Next.js)     │◄────────────►│   (FastAPI)      │
    │   Port 3000     │              │   Port 8001      │
    └─────────────────┘              └────────┬─────────┘
                                              │
                      ┌───────────────────────┼──────────────────────┐
                      │                       │                      │
                      ▼                       ▼                      ▼
            ┌──────────────────┐   ┌──────────────────┐  ┌─────────────────┐
            │     Ollama       │   │    PostgreSQL    │  │     Qdrant      │
            │   (LLM Engine)   │   │   (Sessions DB)  │  │  (Vector Store) │
            │   Port 11434     │   │   Port 5432      │  │   Port 6333     │
            └──────────────────┘   └──────────────────┘  └─────────────────┘
                      ▲
                      │
            ┌─────────┴──────────────────────────────────────┐
            │              MCP Servers (Ports 7001-7005)     │
            ├────────────┬─────────────┬──────────────┬──────┴────────┐
            │  mcp_web   │ mcp_semantic│ mcp_datetime │  mcp_ingest   │ mcp_units
            │  (7001)    │   (7002)    │   (7003)     │    (7004)     │  (7005)
            └────────────┴─────────────┴──────────────┴───────────────┴──────────┘
```

## Component Overview

### 1. Frontend (Next.js Application)

**Location**: [`apps/frontend/`](../apps/frontend/)

**Key Features**:
- Server-side rendering with Next.js App Router
- Real-time WebSocket communication for chat
- Voice recording and audio playback
- Responsive design with Tailwind CSS
- i18n support for multiple languages

**Main Components**:
- **Chat Interface** ([`components/chat/`](../apps/frontend/components/chat/)): WebSocket-based real-time chat
- **WebSocket Client** ([`lib/websocket.ts`](../apps/frontend/lib/websocket.ts)): Connection management with auto-reconnect
- **Voice Recorder** ([`lib/voice-recorder.ts`](../apps/frontend/lib/voice-recorder.ts)): Audio capture and processing
- **API Client** ([`lib/api.ts`](../apps/frontend/lib/api.ts)): HTTP client for REST endpoints

### 2. API Backend (FastAPI Application)

**Location**: [`apps/api/`](../apps/api/)

**Key Features**:
- Async/await throughout for high concurrency
- WebSocket support for real-time communication
- JWT and API key authentication
- Rate limiting via slowapi
- Prometheus metrics integration
- Structured logging with correlation IDs

**Main Modules**:

#### a. Main Application ([`main.py`](../apps/api/main.py))
- Application lifecycle management
- Middleware configuration (CORS, security, logging)
- Service initialization (Ollama, Qdrant, MCP Registry)
- Route registration

#### b. Routes ([`routes/`](../apps/api/routes/))
- **Chat Routes** ([`routes/chat/`](../apps/api/routes/chat/)): Text and voice chat endpoints
- **WebSocket** ([`routes/websocket.py`](../apps/api/routes/websocket.py)): Real-time chat communication
- **Analytics** ([`routes/analytics/`](../apps/api/routes/analytics/)): Usage metrics and statistics
- **Ingestion** ([`routes/ingestion.py`](../apps/api/routes/ingestion.py)): Document upload and processing
- **CRUD** ([`routes/crud.py`](../apps/api/routes/crud.py)): Database operations
- **Health** ([`routes/health.py`](../apps/api/routes/health.py)): Health check endpoint

#### c. Audio Pipeline ([`audio_pipeline.py`](../apps/api/audio_pipeline.py))
- Speech-to-text transcription (Faster Whisper)
- Text-to-speech synthesis (Piper TTS)
- Audio format conversion and resampling
- GPU acceleration support

#### d. WebSocket Manager ([`websocket_manager.py`](../apps/api/websocket_manager.py))
- Connection pooling and lifecycle management
- Heartbeat monitoring
- Message broadcasting
- Session management

### 3. Core Packages

**Location**: [`packages/`](../packages/)

#### a. Agent ([`packages/agent/`](../packages/agent/))
- **AgentLoop** ([`loop.py`](../packages/agent/loop.py)): Main agent execution loop
  - Iterative tool use pattern
  - Streaming token generation
  - Error handling and recovery
  
- **MCPRegistry** ([`registry.py`](../packages/agent/registry.py)): Dynamic tool discovery
  - Connects to MCP servers via WebSocket
  - Periodic tool refresh
  - Health monitoring

#### b. LLM ([`packages/llm/`](../packages/llm/))
- **OllamaClient** ([`ollama.py`](../packages/llm/ollama.py)): LLM API client
  - Streaming chat completions
  - Model management
  - Error handling
  
- **Embedder** ([`embedder.py`](../packages/llm/embedder.py)): Text embedding generation

#### c. Vector Store ([`packages/vectorstore/`](../packages/vectorstore/))
- **QdrantStore** ([`qdrant.py`](../packages/vectorstore/qdrant.py)): Vector database client
  - Document storage and retrieval
  - Semantic search
  - Collection management

#### d. Ingestion ([`packages/ingestion/`](../packages/ingestion/))
- **IngestionPipeline** ([`pipeline.py`](../packages/ingestion/pipeline.py)): Document processing
  - Multi-format support (PDF, text, audio, web)
  - Automatic chunking
  - Embedding generation
  - GPU-accelerated parsing

#### e. Parsers ([`packages/parsers/`](../packages/parsers/))
- **DoclingExtractor** ([`docling_extractor.py`](../packages/parsers/docling_extractor.py)): PDF parsing
- **MediaTranscriber** ([`media_transcriber.py`](../packages/parsers/media_transcriber.py)): Audio transcription
- **OCRExtractor** ([`ocr_extractor.py`](../packages/parsers/ocr_extractor.py)): Image text extraction
- **TableExtractor** ([`table_extractor.py`](../packages/parsers/table_extractor.py)): Structured data extraction

#### f. Database ([`packages/db/`](../packages/db/))
- **Models** ([`models.py`](../packages/db/models.py)): SQLAlchemy ORM models
- **CRUD** ([`crud.py`](../packages/db/crud.py)): Database operations
- **Session** ([`session.py`](../packages/db/session.py)): Async database session management

### 4. MCP Servers

**Location**: [`apps/mcp_servers/`](../apps/mcp_servers/)

Model Context Protocol servers providing extensible tool capabilities:

- **mcp_web** (Port 7001): Web scraping and search
- **mcp_semantic** (Port 7002): Semantic search over knowledge base
- **mcp_datetime** (Port 7003): Date and time operations
- **mcp_ingest** (Port 7004): Document ingestion (GPU-accelerated)
- **mcp_units** (Port 7005): Unit conversions

Each server implements the MCP protocol and exposes tools via WebSocket.

### 5. Infrastructure Services

#### a. Ollama (Port 11434)
- Local LLM inference engine
- Models: gpt-oss:20b (chat), embeddinggemma:300m (embeddings)
- GPU acceleration when available

#### b. PostgreSQL (Port 5432)
- Stores chat sessions and messages
- User management
- Analytics data (token usage, tool executions)
- Alembic migrations for schema management

#### c. Qdrant (Port 6333)
- Vector similarity search
- Document embeddings storage
- Collection-based organization

#### d. Nginx (Port 8000)
- Reverse proxy for frontend and API
- SSL/TLS termination
- WebSocket proxy support
- Static file serving

## Data Flow

### Chat Request Flow (WebSocket)

```
1. User sends message via WebSocket
   │
   ├─► Frontend: Message queued in chat component
   │
   ├─► WebSocket Client: Message sent to server
   │
   └─► Backend: WebSocket endpoint receives message
       │
       ├─► Authentication: Verify user token/API key
       │
       ├─► Session Management: Get/create chat session
       │
       ├─► Agent Loop: Process message with context
       │   │
       │   ├─► Ollama: Generate response (streaming)
       │   │
       │   ├─► Tool Execution: If needed
       │   │   │
       │   │   ├─► MCP Client: Call appropriate tool
       │   │   │
       │   │   └─► Tool Result: Return to agent
       │   │
       │   └─► Stream tokens back to client
       │
       ├─► Database: Persist messages and analytics
       │
       └─► Response: Stream to WebSocket client
           │
           └─► Frontend: Display streaming response
```

### Document Ingestion Flow

```
1. User uploads document
   │
   ├─► API: Upload endpoint receives file
   │
   ├─► Ingestion Pipeline: Process document
   │   │
   │   ├─► Parser Selection: Based on file type
   │   │   │
   │   │   ├─► PDF: Docling extractor (GPU)
   │   │   ├─► Audio: Media transcriber (GPU)
   │   │   ├─► Web: Beautiful Soup scraper
   │   │   └─► Text: Direct processing
   │   │
   │   ├─► Chunking: Split into semantic chunks
   │   │
   │   ├─► Embedding: Generate vectors via Ollama
   │   │
   │   └─► Storage: Save to Qdrant
   │
   ├─► Database: Record ingestion metadata
   │
   └─► Response: Success with document ID
```

### Semantic Search Flow

```
1. User query contains semantic search trigger
   │
   ├─► Agent: Detects need for knowledge retrieval
   │
   ├─► MCP Tool: semantic_search called
   │
   ├─► Embedding: Query vectorized via Ollama
   │
   ├─► Qdrant: Vector similarity search
   │
   ├─► Results: Top K relevant chunks returned
   │
   ├─► Context: Added to LLM prompt
   │
   └─► Response: Generated with retrieved knowledge
```

## Technology Stack

### Backend Stack
| Technology | Purpose | Version |
|-----------|---------|---------|
| Python | Core language | 3.11+ |
| FastAPI | Web framework | 0.120+ |
| Uvicorn | ASGI server | 0.38+ |
| Pydantic | Data validation | 2.9+ |
| SQLAlchemy | ORM | 2.0+ |
| Alembic | Migrations | 1.17+ |
| AsyncPG | PostgreSQL driver | 0.30+ |
| Qdrant Client | Vector DB client | 1.12+ |
| Faster Whisper | STT | 1.2+ |
| Piper TTS | TTS | 1.3+ |
| Docling | PDF parsing | 2.15+ |

### Frontend Stack
| Technology | Purpose | Version |
|-----------|---------|---------|
| Next.js | React framework | 15+ |
| React | UI library | 19+ |
| TypeScript | Type safety | 5+ |
| Tailwind CSS | Styling | 3+ |
| shadcn/ui | Components | Latest |

### Infrastructure
| Service | Purpose | Image |
|---------|---------|-------|
| Ollama | LLM engine | ollama/ollama:latest |
| PostgreSQL | Database | postgres:16-alpine |
| Qdrant | Vector DB | qdrant/qdrant:latest |
| Nginx | Reverse proxy | nginx:alpine |

## Design Decisions

### 1. WebSocket for Real-Time Chat

**Decision**: Use WebSocket instead of SSE for chat communication.

**Rationale**:
- Bidirectional communication needed (stop streaming, heartbeat)
- Lower latency for real-time updates
- Native browser support
- Better for voice/audio streaming

**Trade-offs**:
- More complex than HTTP polling
- Requires proper connection management
- Needs nginx WebSocket proxy configuration

### 2. Local LLM with Ollama

**Decision**: Use local Ollama for LLM inference instead of cloud APIs.

**Rationale**:
- Privacy: All data stays on-premise
- Cost: No per-token charges
- Latency: Local inference is faster for many use cases
- Offline capable: Works without internet

**Trade-offs**:
- Requires GPU for good performance
- Model quality may be lower than GPT-4
- Initial setup more complex

### 3. MCP for Tool Extensibility

**Decision**: Use Model Context Protocol for dynamic tool discovery.

**Rationale**:
- Standard protocol for LLM tool integration
- Dynamic tool discovery (no code changes needed)
- Modular: Tools can be added/removed independently
- Language agnostic: Tools can be in any language

**Trade-offs**:
- Additional complexity vs hardcoded tools
- Network overhead for tool calls
- Requires MCP server management

### 4. Monolithic Agent Loop

**Decision**: Single-tool stepper pattern instead of multi-tool parallel execution.

**Rationale**:
- Predictable behavior and easier debugging
- Simpler state management
- Better for streaming responses
- Reduces token usage

**Trade-offs**:
- Slower for tasks requiring multiple tools
- Cannot parallelize independent tool calls

### 5. Qdrant for Vector Search

**Decision**: Use Qdrant instead of alternatives (Pinecone, Weaviate, etc.)

**Rationale**:
- Self-hosted: Full control and privacy
- High performance: Rust-based engine
- Easy deployment: Single Docker container
- Good Python client library

**Trade-offs**:
- Requires infrastructure management
- No managed service option

### 6. FastAPI over Django/Flask

**Decision**: FastAPI for backend framework.

**Rationale**:
- Native async/await support
- Automatic OpenAPI documentation
- High performance (Starlette + Pydantic)
- Modern Python 3.11+ features
- WebSocket support built-in

**Trade-offs**:
- Smaller ecosystem than Django
- Less mature for traditional CRUD apps

## Scalability Considerations

### Current Architecture Limits

| Component | Limit | Bottleneck |
|-----------|-------|-----------|
| WebSocket | ~1000 concurrent | Memory per connection |
| Ollama | ~10 req/s | GPU memory |
| Qdrant | ~1M vectors | RAM |
| PostgreSQL | ~500 req/s | Disk I/O |

### Scaling Strategies

#### Horizontal Scaling
```
Load Balancer
├─► API Instance 1 ──┐
├─► API Instance 2 ──┼─► Shared PostgreSQL
└─► API Instance 3 ──┤   Shared Qdrant
                     └─► Shared Ollama (via network)
```

**Considerations**:
- Sticky sessions for WebSocket connections
- Shared Redis for session state
- Ollama network mode for GPU sharing
- PostgreSQL read replicas for analytics

#### Vertical Scaling
- **GPU**: Add more VRAM for larger models or batching
- **RAM**: Cache embeddings and parsed documents
- **CPU**: More cores for concurrent request handling
- **Storage**: NVMe for faster vector operations

#### Optimization Strategies

1. **Caching**
   - Redis for API responses
   - In-memory cache for embeddings
   - CDN for static assets

2. **Database Optimization**
   - Connection pooling (already implemented)
   - Query optimization and indexing
   - Partitioning for large tables
   - Read replicas for analytics

3. **Vector Store Optimization**
   - Index quantization for memory savings
   - HNSW parameter tuning
   - Sharding for large collections

4. **LLM Optimization**
   - Model quantization (already supported)
   - Batched inference
   - Prompt caching
   - Smaller models for simple tasks

## Security Architecture

### Authentication & Authorization

```
Request ──► API Key / JWT ──► User Lookup ──► Permission Check ──► Endpoint
            │                  │                │
            ├─► Root API Key   ├─► PostgreSQL   └─► Collection Access
            └─► JWT Token      └─► User Model       └─► Role-based
```

**Layers**:
1. **Network**: Nginx SSL/TLS termination
2. **API**: API key or JWT validation
3. **Resource**: Collection-level access control
4. **Rate Limiting**: Per-user and per-IP limits

### Data Protection

- **At Rest**: Optional PostgreSQL encryption
- **In Transit**: TLS for all external communication
- **Secrets**: Environment variables, never committed
- **Input Validation**: Pydantic models on all endpoints
- **SQL Injection**: Parameterized queries only
- **XSS**: Sanitized inputs, CSP headers

## Monitoring & Observability

### Metrics (Prometheus)
- Request latency and throughput
- Token usage per model
- Tool execution times
- Database connection pool stats
- Vector search performance

### Logging
- Structured JSON logs
- Correlation IDs for request tracing
- Log levels (DEBUG, INFO, WARNING, ERROR)
- Centralized via stdout (Docker)

### Health Checks
- `/health` endpoint for uptime monitoring
- Database connectivity
- Ollama model availability
- MCP server health
- Qdrant connectivity

## Future Architecture Evolution

### Planned Improvements

1. **Multi-Model Support**
   - Multiple LLM backends (OpenAI, Anthropic, local)
   - Model routing based on task complexity
   - Cost optimization

2. **Advanced Agent Patterns**
   - Multi-agent collaboration
   - Hierarchical task decomposition
   - Memory and context management

3. **Enhanced Ingestion**
   - Real-time document processing
   - Incremental updates
   - Web crawling and monitoring

4. **Analytics & Insights**
   - User behavior analytics
   - Query understanding
   - Performance dashboards

## Related Documentation

- [API Documentation](API.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Development Guide](DEVELOPMENT.md)
- [MCP Servers](MCP_SERVERS.md)