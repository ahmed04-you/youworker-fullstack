# YouWorker Backend Documentation

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - Architecture Under Active Development
**Framework:** FastAPI 0.120+ (Python 3.11+)
**Database:** PostgreSQL 14+ with SQLAlchemy 2.0
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

**This documentation describes the target architecture for YouWorker v1.0.** The development process is currently underway. While many improvements have been implemented, some features described in this documentation are still in development.

For tracking implementation progress, see [BACKEND_REFACTORING_GUIDE.md](../BACKEND_REFACTORING_GUIDE.md) in the project root.

---

## 📚 Documentation Index

Welcome to the comprehensive documentation for YouWorker's backend system. This guide describes the ideal architecture being implemented through ongoing refactoring efforts.

### Core Documentation

1. **[Architecture Guide](ARCHITECTURE.md)** - System architecture and design patterns
   - Layered architecture overview
   - Design patterns (Repository, Unit of Work, DI)
   - Component diagrams
   - Data flow
   - Security architecture
   - Performance design

2. **[Development Guide](DEVELOPMENT_GUIDE.md)** - Developer onboarding and workflows
   - Getting started
   - Project structure
   - Development workflow (TDD)
   - Code style standards
   - Working with services and repositories
   - Common tasks

3. **[API Reference](API_REFERENCE.md)** - Complete API documentation
   - Authentication endpoints
   - Groups API
   - Chat API (HTTP, SSE, WebSocket)
   - Document ingestion
   - Analytics
   - Error responses

4. **[Database Schema](DATABASE_SCHEMA.md)** - Database design and operations
   - Schema overview with ERD
   - Table definitions
   - Relationships and constraints
   - Encryption (Fernet)
   - Migrations with Alembic
   - Query patterns and optimization

5. **[Testing Guide](TESTING_GUIDE.md)** - Testing strategies and practices
   - Test pyramid (60% unit, 30% integration, 10% e2e)
   - Running tests
   - Writing unit tests
   - Integration testing
   - Test fixtures and factories
   - CI/CD integration

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Ollama (LLM inference)
- Qdrant (vector database)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd youworker-fullstack

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Generate encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Create database
createdb youworker

# Run application
uvicorn apps.api.main:app --reload --port 8001
```

### Verify Installation

```bash
# Health check
curl http://localhost:8001/health

# OpenAPI documentation
open http://localhost:8001/docs
```

---

## 🏗️ Architecture Overview

YouWorker follows a clean, layered architecture:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│         (FastAPI Routes)            │  ← HTTP/WebSocket endpoints
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Service Layer               │
│      (Business Services)            │  ← Business logic & orchestration
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Repository Layer            │
│         (Repositories)              │  ← Data access abstraction
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Data Layer                  │
│      (SQLAlchemy Models)            │  ← Database schema
└─────────────────────────────────────┘
```

### Key Principles

1. **Separation of Concerns** - Each layer has a single responsibility
2. **Dependency Injection** - All dependencies injected via FastAPI
3. **Type Safety** - Full type hints with mypy strict mode
4. **Test-Driven** - 80%+ test coverage
5. **Async-First** - 100% async/await throughout

---

## 📂 Project Structure

```
youworker-fullstack/
├── apps/
│   └── api/                      # Main API application
│       ├── routes/               # HTTP endpoints
│       ├── services/             # Business logic
│       ├── middleware/           # Custom middleware
│       ├── dependencies.py       # Dependency injection
│       └── main.py              # Application entry point
│
├── packages/                     # Shared packages
│   ├── db/                      # Database layer
│   │   ├── models/              # SQLAlchemy models
│   │   ├── repositories/        # Repository pattern
│   │   └── uow.py              # Unit of Work
│   │
│   ├── common/                  # Common utilities
│   │   ├── config/             # Configuration modules
│   │   ├── exceptions.py       # Custom exceptions
│   │   └── logger.py           # Logging setup
│   │
│   ├── agent/                   # Agent framework
│   ├── llm/                     # LLM integration
│   ├── vectorstore/             # Vector database
│   └── ingestion/               # Document processing
│
├── tests/                       # Test suite
│   ├── unit/                    # Unit tests (60%)
│   ├── integration/             # Integration tests (30%)
│   └── e2e/                     # End-to-end tests (10%)
│
└── docs/                        # Documentation (YOU ARE HERE!)
    ├── ARCHITECTURE.md
    ├── DEVELOPMENT_GUIDE.md
    ├── API_REFERENCE.md
    ├── DATABASE_SCHEMA.md
    └── TESTING_GUIDE.md
```

---

## 🔑 Key Features

### Multi-Tenancy
- Group-based isolation
- Role-based access control (member, admin)
- Document sharing within groups

### Security
- JWT authentication with HttpOnly cookies
- CSRF protection
- Fernet encryption for chat messages
- Rate limiting (100 req/min default)
- Comprehensive audit logging
- IP whitelisting (production)

### AI Agent
- Ollama integration for LLM inference
- Tool calling via MCP (Model Context Protocol)
- ReAct pattern for agentic loops
- Streaming responses (SSE & WebSocket)
- Multi-modal support (text, audio, images)

### Document Processing
- PDF, text, CSV, JSON, images, audio
- OCR with PaddleOCR by default (automatic Tesseract fallback)
- Audio transcription with Whisper
- Vector embeddings with Qdrant
- Semantic search

### Analytics
- Token usage tracking
- Tool execution metrics
- Session analytics
- Dashboard aggregations

---

## 🔧 Technology Stack

### Core
- **FastAPI 0.120+** - Modern async web framework
- **Python 3.11+** - Type hints, async/await
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation

### Database
- **PostgreSQL 14+** - Primary database
- **SQLAlchemy 2.0** - Async ORM
- **Asyncpg** - Async PostgreSQL driver
- **Alembic** - Schema migrations

### AI/ML
- **Ollama** - LLM inference
- **Qdrant** - Vector database
- **Whisper** - Audio transcription
- **Tesseract** - OCR

### Security
- **Cryptography** - Fernet encryption
- **PyJWT** - JWT tokens
- **Slowapi** - Rate limiting

### Development
- **Pytest** - Testing framework
- **Mypy** - Static type checking
- **Black** - Code formatting
- **Ruff** - Fast linting

---

## 📖 Common Tasks

### Create a New Endpoint

1. **Define route** in `apps/api/routes/`
2. **Create service** (if needed) in `apps/api/services/`
3. **Create repository** (if needed) in `packages/db/repositories/`
4. **Write tests** in `tests/unit/services/`
5. **Update API docs** (auto-generated from OpenAPI)

Example:
```python
# apps/api/routes/my_endpoint.py
@router.post("/items", response_model=ItemResponse)
async def create_item(
    request: CreateItemRequest,
    service: MyService = Depends(get_my_service)
):
    """Create a new item."""
    return await service.create_item(request.name, request.description)
```

### Add a New Database Model

1. **Create model** in `packages/db/models/`
2. **Create repository** in `packages/db/repositories/`
3. **Generate migration** (if using Alembic)
4. **Write tests**

Example:
```python
# packages/db/models/item.py
class Item(AsyncAttrs, Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)
```

### Run Tests

```bash
# All tests
pytest

# Specific test file
pytest tests/unit/services/test_my_service.py

# With coverage
pytest --cov --cov-report=html

# Type checking
mypy apps/ packages/

# Linting
ruff check apps/ packages/
```

---

## 🧪 Testing

YouWorker follows the test pyramid:

```
         ╱╲
        ╱  ╲     E2E (10%)
       ╱────╲
      ╱      ╲   Integration (30%)
     ╱────────╲
    ╱          ╲
   ╱────────────╲ Unit Tests (60%)
```

- **Unit Tests**: Services and repositories in isolation
- **Integration Tests**: Services + database interactions
- **E2E Tests**: Full API flows via HTTP client

**Coverage Target**: 80%+

See [Testing Guide](TESTING_GUIDE.md) for details.

---

## 🔒 Security

### Authentication
- JWT tokens in HttpOnly cookies
- API key authentication for service accounts
- Authentik SSO integration (optional)

### Authorization
- Role-based access control (RBAC)
- Group-based permissions
- Resource ownership checks

### Data Protection
- **Encryption at rest**: Chat messages encrypted with Fernet (AES-128)
- **Encryption in transit**: HTTPS/TLS
- **API key hashing**: SHA-256
- **CSRF protection**: Double-submit cookie pattern

### Audit Trail
- All sensitive operations logged
- User actions tracked
- IP address and user agent captured
- Correlation IDs for request tracing

See [Architecture Guide - Security](ARCHITECTURE.md#security-architecture) for details.

---

## 📊 Performance

### Database Optimization
- Connection pooling (size: 10, max overflow: 20)
- Eager loading to prevent N+1 queries
- Indexed columns for frequent queries
- Query optimization with EXPLAIN ANALYZE

### Async Design
- 100% async/await throughout
- Non-blocking I/O for all operations
- Concurrent request handling

### Monitoring
- Health check endpoints
- Connection pool metrics
- Slow query logging (threshold: 1s)

See [Architecture Guide - Performance](ARCHITECTURE.md#performance-architecture) for details.

---

## 🚢 Deployment

### Environment Variables

Required configuration:

```bash
# Database
DATABASE__URL=postgresql+asyncpg://user:pass@host:5432/youworker

# Security
SECURITY__ROOT_API_KEY=your-secure-api-key
SECURITY__JWT_SECRET=your-jwt-secret
SECURITY__CHAT_MESSAGE_ENCRYPTION_SECRET=your-fernet-key

# LLM
LLM__OLLAMA_BASE_URL=http://ollama:11434
LLM__QDRANT_URL=http://qdrant:6333

# Application
APP_ENV=production
API__HOST=0.0.0.0
API__PORT=8001
```

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8001:8001"
    environment:
      - DATABASE__URL=postgresql+asyncpg://postgres:postgres@db:5432/youworker
    depends_on:
      - db
      - ollama
      - qdrant

  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: youworker

  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
```

### Production Checklist

- [ ] Set strong secrets for JWT and encryption
- [ ] Enable IP whitelisting
- [ ] Configure HTTPS/TLS
- [ ] Set up database backups
- [ ] Enable audit logging
- [ ] Configure monitoring
- [ ] Set up log aggregation
- [ ] Load test the application
- [ ] Review security headers
- [ ] Update rate limits as needed

---

## 🤝 Contributing

### Development Workflow

1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Run tests and type checking
5. Format code with Black
6. Commit with conventional commits
7. Create pull request

### Code Style

- **Type hints**: All code must be fully type-annotated
- **Docstrings**: Google-style for all public APIs
- **Testing**: 80%+ coverage required
- **Formatting**: Black with default settings
- **Linting**: Ruff with project configuration

See [Development Guide](DEVELOPMENT_GUIDE.md) for details.

---

## 📈 Roadmap

### Completed ✅
- Layered architecture (routes → services → repositories)
- Repository pattern implementation
- Unit of Work pattern
- Dependency injection
- Type safety with mypy
- Comprehensive test suite
- Security hardening
- Audit logging
- Multi-tenancy with groups

### In Progress 🚧
- Additional service layer completion
- Performance optimization
- Enhanced monitoring

### Planned 📋
- Horizontal scaling support
- Advanced analytics
- Real-time notifications
- Enhanced document processing

---

## 📞 Support

### Resources

- **Documentation**: http://localhost:8001/docs (Swagger UI)
- **API Reference**: http://localhost:8001/redoc
- **GitHub**: [repository URL]
- **Email**: support@youco.it

### Getting Help

1. Check the relevant documentation section
2. Review code examples in the guides
3. Search existing GitHub issues
4. Create a new issue with reproduction steps

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with:
- FastAPI by Sebastián Ramírez
- SQLAlchemy by Mike Bayer
- Ollama by Ollama Team
- Qdrant by Qdrant Team

---

**Happy coding! 🚀**

For detailed information, explore the specific documentation files:
- [Architecture Guide](ARCHITECTURE.md)
- [Development Guide](DEVELOPMENT_GUIDE.md)
- [API Reference](API_REFERENCE.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Testing Guide](TESTING_GUIDE.md)
