# YouWorker Backend Architecture

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - Under Active Development
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

This document describes the target architecture for YouWorker v1.0. Implementation is in progress. See [BACKEND_REFACTORING_GUIDE.md](../BACKEND_REFACTORING_GUIDE.md) for current status.

---

## Table of Contents

1. [Overview](#overview)
2. [Architectural Principles](#architectural-principles)
3. [System Architecture](#system-architecture)
4. [Layer Architecture](#layer-architecture)
5. [Design Patterns](#design-patterns)
6. [Data Flow](#data-flow)
7. [Component Diagram](#component-diagram)
8. [Technology Stack](#technology-stack)
9. [Security Architecture](#security-architecture)
10. [Performance Architecture](#performance-architecture)

---

## Overview

YouWorker is a production-grade AI agent backend built with FastAPI, featuring a clean layered architecture that separates concerns and maximizes maintainability, testability, and scalability.

### Key Characteristics

- **Async-First**: 100% async/await throughout the entire stack
- **Domain-Driven Design**: Clear domain boundaries with focused services
- **Repository Pattern**: Clean data access abstraction
- **Service Layer**: Business logic separated from HTTP concerns
- **Type-Safe**: Strict type checking with mypy
- **Test-Driven**: 80%+ test coverage with comprehensive test suite

### Architecture Goals

1. **Maintainability**: Easy to understand, modify, and extend
2. **Testability**: Every layer can be tested in isolation
3. **Scalability**: Horizontal scaling with stateless design
4. **Performance**: Optimized queries, efficient resource usage
5. **Security**: Defense in depth with multiple security layers

---

## Architectural Principles

### 1. Separation of Concerns

Each layer has a single, well-defined responsibility:

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  HTTP/WebSocket endpoints
│         (FastAPI Routes)            │  Request/Response handling
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Service Layer               │  Business logic
│      (Business Services)            │  Orchestration
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Repository Layer            │  Data access abstraction
│         (Repositories)              │  Query building
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Data Layer                  │  ORM models
│      (SQLAlchemy Models)            │  Database schema
└─────────────────────────────────────┘
```

### 2. Dependency Injection

All dependencies are injected through FastAPI's DI system:

```python
# Routes depend on services
@router.post("/groups")
async def create_group(
    request: CreateGroupRequest,
    service: GroupService = Depends(get_group_service)
):
    return await service.create_group(...)

# Services depend on repositories
class GroupService:
    def __init__(
        self,
        group_repo: GroupRepository = Depends(get_group_repository),
        user_repo: UserRepository = Depends(get_user_repository)
    ):
        self.group_repo = group_repo
        self.user_repo = user_repo

# Repositories depend on database session
class GroupRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
```

### 3. Unit of Work Pattern

Transaction boundaries are explicit and managed through Unit of Work:

```python
async with UnitOfWork(get_async_session) as uow:
    # All operations in one transaction
    group = await uow.groups.create(name="Engineering")
    await uow.groups.add_member(group.id, user_id, role="admin")
    # Automatic commit on success, rollback on exception
```

### 4. Domain-Driven Design

Code is organized around business domains:

- **Chat Domain**: Sessions, messages, conversations
- **Group Domain**: Groups, memberships, permissions
- **Document Domain**: Documents, ingestion, vector storage
- **Tool Domain**: MCP servers, tools, tool execution
- **User Domain**: Users, authentication, authorization

### 5. Type Safety

All code is fully type-annotated and checked with mypy:

```python
# ✅ Strict typing throughout
async def create_group(
    self,
    name: str,
    description: str | None,
    creator_user_id: int
) -> GroupResponse:
    """Type-safe method signature."""
    pass
```

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        Clients                           │
│          (Web, Mobile, CLI, WebSocket)                   │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer           │
│                    (nginx, traefik, etc.)                │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                    FastAPI Application                   │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐  │
│  │ Middleware │      │   Routes   │      │  Services  │  │
│  └────────────┘      └────────────┘      └────────────┘  │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐  │
│  │Repositories│      │    Auth    │      │   Agent    │  │
│  └────────────┘      └────────────┘      └────────────┘  │
└──────────────────────────────────────────────────────────┘
             ↓                 ↓                 ↓
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  PostgreSQL  │  │    Ollama    │  │    Qdrant    │
    │   Database   │  │   (LLM AI)   │  │   (Vector)   │
    └──────────────┘  └──────────────┘  └──────────────┘
                              ↓
┌──────────────────────────────────────────────────────────┐
│                      MCP Tool Servers                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ DateTime │  │ Semantic │  │   Web    │  │  Ingest  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Component Communication

- **Synchronous**: HTTP REST endpoints for request/response
- **Asynchronous**: WebSocket for real-time bi-directional communication
- **Event-Driven**: Agent loop with tool execution callbacks
- **Database**: Connection pooling with async SQLAlchemy

---

## Layer Architecture

### 1. Presentation Layer (Routes)

**Location**: `apps/api/routes/`

**Responsibility**: Handle HTTP concerns only

```python
# apps/api/routes/groups.py
@router.post("", status_code=201, response_model=GroupResponse)
async def create_new_group(
    request: CreateGroupRequest,
    service: GroupService = Depends(get_group_service)
):
    """
    Create a new group.

    Routes are thin - they only:
    1. Validate input (Pydantic)
    2. Call service layer
    3. Return response
    """
    return await service.create_group(
        name=request.name,
        description=request.description,
        creator_user_id=current_user.id
    )
```

**What Routes Should NOT Do**:
- ❌ Database access
- ❌ Business logic
- ❌ Complex validation
- ❌ External service calls

**What Routes Should Do**:
- ✅ Parse request
- ✅ Call service
- ✅ Format response
- ✅ Handle HTTP-specific concerns

### 2. Service Layer

**Location**: `apps/api/services/`

**Responsibility**: Implement business logic

```python
# apps/api/services/group_service.py
class GroupService(BaseService):
    """
    Business logic for group management.

    Services orchestrate operations across multiple repositories
    and implement business rules.
    """

    def __init__(
        self,
        group_repo: GroupRepository,
        user_repo: UserRepository,
        audit_repo: AuditRepository,
        settings: Settings
    ):
        self.group_repo = group_repo
        self.user_repo = user_repo
        self.audit_repo = audit_repo
        self.settings = settings

    async def create_group(
        self,
        name: str,
        description: str | None,
        creator_user_id: int
    ) -> GroupResponse:
        """
        Create a new group with business logic:
        1. Validate business rules
        2. Create group
        3. Add creator as admin
        4. Audit log
        5. Return response
        """
        # Validate
        if await self.group_repo.exists_by_name(name):
            raise ValidationError(
                f"Group '{name}' already exists",
                code="GROUP_NAME_EXISTS"
            )

        # Execute within Unit of Work
        async with UnitOfWork(self.session) as uow:
            # Create group
            group = await uow.groups.create(
                name=name,
                description=description
            )

            # Add creator as admin
            await uow.groups.add_member(
                group_id=group.id,
                user_id=creator_user_id,
                role="admin"
            )

            # Audit log
            await uow.audit.log_action(
                user_id=creator_user_id,
                action="group.create",
                resource_type="group",
                resource_id=str(group.id)
            )

            # Commit happens automatically

        return self._to_response(group)
```

**Service Responsibilities**:
- ✅ Business logic
- ✅ Transaction management
- ✅ Cross-repository coordination
- ✅ Business validation
- ✅ Audit logging

### 3. Repository Layer

**Location**: `packages/db/repositories/`

**Responsibility**: Data access abstraction

```python
# packages/db/repositories/group_repository.py
class GroupRepository(BaseRepository[Group]):
    """
    Repository for group data access.

    Repositories abstract database operations and provide
    a clean API for data access.
    """

    def __init__(self, session: AsyncSession):
        super().__init__(session, Group)

    async def get_by_name(self, name: str) -> Group | None:
        """Get group by name."""
        result = await self.session.execute(
            select(Group)
            .where(Group.name == name)
            .options(selectinload(Group.members))
        )
        return result.scalar_one_or_none()

    async def exists_by_name(self, name: str) -> bool:
        """Check if group exists by name."""
        result = await self.session.execute(
            select(exists().where(Group.name == name))
        )
        return result.scalar()

    async def get_user_groups(
        self,
        user_id: int,
        limit: int = 100
    ) -> list[Group]:
        """Get all groups for a user with eager loading."""
        result = await self.session.execute(
            select(Group)
            .join(UserGroupMembership)
            .where(UserGroupMembership.user_id == user_id)
            .options(selectinload(Group.members))
            .limit(limit)
        )
        return list(result.scalars().all())
```

**Repository Responsibilities**:
- ✅ Query building
- ✅ Eager loading
- ✅ CRUD operations
- ✅ Query optimization

**Repository Should NOT**:
- ❌ Business logic
- ❌ Transaction management
- ❌ Cross-repository operations

### 4. Model Layer

**Location**: `packages/db/models/`

**Responsibility**: Database schema definition

```python
# packages/db/models/group.py
class Group(AsyncAttrs, Base):
    """
    Group model for multi-tenancy.

    Models define the database schema and relationships.
    They are pure data structures.
    """
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Relationships
    members: Mapped[list["UserGroupMembership"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )
```

---

## Design Patterns

### 1. Repository Pattern

Abstracts data access logic:

```python
# Interface (implicit in Python)
class BaseRepository(Generic[T]):
    async def get_by_id(self, id: int) -> T | None: ...
    async def create(self, **kwargs) -> T: ...
    async def update(self, id: int, **kwargs) -> T | None: ...
    async def delete(self, id: int) -> bool: ...

# Implementation
class UserRepository(BaseRepository[User]):
    # Domain-specific methods
    async def get_by_username(self, username: str) -> User | None: ...
    async def get_by_api_key(self, api_key_hash: str) -> User | None: ...
```

### 2. Unit of Work Pattern

Manages transaction boundaries:

```python
class UnitOfWork:
    """
    Coordinates multiple repositories in a single transaction.
    """
    async def __aenter__(self):
        self.users = UserRepository(self.session)
        self.groups = GroupRepository(self.session)
        self.audit = AuditRepository(self.session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            await self.commit()
        else:
            await self.rollback()
```

### 3. Dependency Injection

Explicit dependencies via FastAPI:

```python
# Define dependencies
def get_group_repository(
    session: AsyncSession = Depends(get_db_session)
) -> GroupRepository:
    return GroupRepository(session)

def get_group_service(
    group_repo: GroupRepository = Depends(get_group_repository),
    settings: Settings = Depends(get_settings)
) -> GroupService:
    return GroupService(group_repo, settings)

# Use in routes
@router.post("/groups")
async def create_group(
    service: GroupService = Depends(get_group_service)
):
    return await service.create_group(...)
```

### 4. Strategy Pattern

Used in agent loop for different LLM strategies:

```python
class AgentLoop:
    def __init__(
        self,
        llm_client: OllamaClient,
        registry: MCPRegistry,
        strategy: AgentStrategy = ReActStrategy()
    ):
        self.llm_client = llm_client
        self.registry = registry
        self.strategy = strategy
```

### 5. Factory Pattern

Used for creating complex objects:

```python
class ServiceFactory:
    """Factory for creating service instances with dependencies."""

    @staticmethod
    def create_chat_service(
        session: AsyncSession,
        agent_loop: AgentLoop,
        settings: Settings
    ) -> ChatService:
        chat_repo = ChatRepository(session)
        user_repo = UserRepository(session)
        return ChatService(chat_repo, user_repo, agent_loop, settings)
```

---

## Data Flow

### Request Flow (Success Path)

```
1. HTTP Request arrives
   ↓
2. Middleware chain processes request
   - CORS validation
   - CSRF validation
   - Rate limiting
   - Correlation ID
   - Security headers
   ↓
3. Route handler receives request
   - Pydantic validates input
   - FastAPI injects dependencies
   ↓
4. Service layer executes business logic
   - Validates business rules
   - Coordinates repositories
   - Manages transactions
   ↓
5. Repository layer accesses database
   - Builds optimized queries
   - Executes with eager loading
   - Returns domain models
   ↓
6. Service transforms to response model
   ↓
7. Route returns HTTP response
   ↓
8. Middleware adds response headers
   ↓
9. Response sent to client
```

### Error Flow

```
1. Exception occurs in any layer
   ↓
2. Custom exception is raised
   (ValidationError, ResourceNotFoundError, etc.)
   ↓
3. Global exception handler catches it
   ↓
4. Exception mapped to HTTP status code
   - ValidationError → 400
   - ResourceNotFoundError → 404
   - AuthenticationError → 401
   - AuthorizationError → 403
   - DatabaseError → 500
   ↓
5. Structured error response created
   {
     "error": {
       "message": "...",
       "code": "...",
       "details": {...}
     }
   }
   ↓
6. Error logged with context
   ↓
7. Transaction rolled back (if in UoW)
   ↓
8. Error response sent to client
```

### Agent Execution Flow

```
1. User sends message
   ↓
2. Chat service prepares conversation
   ↓
3. Agent loop starts execution
   ↓
4. LLM generates response with potential tool calls
   ↓
5. If tool call detected:
   - Validate tool exists
   - Execute tool via MCP
   - Record tool execution
   - Add result to conversation
   - Loop back to step 4
   ↓
6. If no tool calls (final answer):
   - Stream response to client
   - Persist messages
   - Return completion
```

---

## Component Diagram

### Core Components

```
┌────────────────────────────────────────────┐
│                  FastAPI App               │
├────────────────────────────────────────────┤
│                                            │
│   ┌──────────────┐      ┌──────────────┐   │
│   │   Routes     │──────│   Services   │   │
│   │              │      │              │   │
│   │ - Auth       │      │ - ChatSvc    │   │
│   │ - Chat       │      │ - GroupSvc   │   │
│   │ - Groups     │      │ - IngestSvc  │   │
│   │ - Analytics  │      │ - AccountSvc │   │
│   └──────────────┘      └──────────────┘   │
│          │                      │          │
│          │                      ↓          │
│          │              ┌──────────────┐   │
│          │              │ Repositories │   │
│          │              │              │   │
│          │              │ - UserRepo   │   │
│          │              │ - GroupRepo  │   │
│          │              │ - ChatRepo   │   │
│          │              │ - DocRepo    │   │
│          │              └──────────────┘   │
│          │                      │          │
│          │                      ↓          │
│          │              ┌──────────────┐   │
│          └──────────────│   Database   │   │
│                         │   Models     │   │
│                         └──────────────┘   │
│                                            │
│   ┌──────────────┐      ┌──────────────┐   │
│   │  Middleware  │      │  Agent Loop  │   │
│   │              │      │              │   │
│   │ - CORS       │      │ - LLM Client │   │
│   │ - CSRF       │      │ - MCP        │   │
│   │ - RateLimit  │      │ - Tools      │   │
│   │ - Auth       │      └──────────────┘   │
│   └──────────────┘                         │
│                                            │
└────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework
- **FastAPI 0.120+**: Modern async web framework
- **Python 3.11+**: Type hints, async/await
- **Uvicorn**: ASGI server

### Database
- **PostgreSQL 14+**: Primary database
- **SQLAlchemy 2.0**: Async ORM
- **Asyncpg**: Async PostgreSQL driver
- **Alembic**: Database migrations (optional)

### AI/ML Stack
- **Ollama**: LLM inference
- **Qdrant**: Vector database
- **Whisper**: Audio transcription
- **Tesseract**: OCR processing

### Security
- **Cryptography**: Fernet encryption
- **PyJWT**: JWT tokens
- **Slowapi**: Rate limiting
- **Authentik**: SSO integration (optional)

### Development Tools
- **Mypy**: Static type checking
- **Pytest**: Testing framework
- **Black**: Code formatting
- **Ruff**: Linting

---

## Security Architecture

### Defense in Depth

```
Layer 1: Network
└─ IP Whitelist (production)
   └─ HTTPS/TLS

Layer 2: Application
└─ CORS validation
   └─ CSRF protection
      └─ Rate limiting

Layer 3: Authentication
└─ JWT tokens (HttpOnly cookies)
   └─ API key validation
      └─ Authentik SSO

Layer 4: Authorization
└─ Role-based access control
   └─ Resource ownership checks
      └─ Group membership validation

Layer 5: Data
└─ Fernet encryption (messages)
   └─ Password hashing (API keys)
      └─ Audit logging
```

### Security Features

1. **Encryption at Rest**: Chat messages encrypted with Fernet
2. **Secure Sessions**: HttpOnly, SameSite cookies
3. **CSRF Protection**: Double-submit cookie pattern
4. **Rate Limiting**: Per-user and per-endpoint
5. **Audit Logging**: All sensitive operations tracked
6. **Input Validation**: Pydantic models + sanitization
7. **Security Headers**: CSP, X-Frame-Options, etc.

---

## Performance Architecture

### Database Optimization

1. **Connection Pooling**
   - Pool size: 10
   - Max overflow: 20
   - Pre-ping enabled

2. **Query Optimization**
   - Eager loading for relationships
   - N+1 query prevention
   - Indexed columns for frequent queries

3. **Transaction Management**
   - Unit of Work pattern
   - Explicit transaction boundaries
   - Automatic rollback on errors

### Async Design

All I/O operations are async:
- Database queries
- LLM requests
- Tool executions
- File operations
- HTTP requests

### Monitoring

1. **Health Checks**
   - `/health` - Basic health
   - `/health/detailed` - Component status

2. **Connection Pool Monitoring**
   - Active connections tracked
   - Alerts on high usage
   - Metrics collection

3. **Slow Query Logging**
   - Threshold: 1 second
   - Full query logging
   - Execution plan capture

---

## Summary

YouWorker's architecture is built on solid engineering principles:

✅ **Clean Architecture**: Clear separation of concerns
✅ **Domain-Driven**: Organized around business domains
✅ **Type-Safe**: Full type coverage with mypy
✅ **Testable**: Every layer independently testable
✅ **Scalable**: Stateless design, horizontal scaling
✅ **Secure**: Multiple security layers
✅ **Performant**: Optimized queries, async throughout
✅ **Maintainable**: Well-documented, consistent patterns

This architecture supports:
- Easy feature additions
- Safe refactoring
- Confident deployment
- Clear debugging
- Team collaboration
