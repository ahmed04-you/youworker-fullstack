# YouWorker Fullstack - Comprehensive Refactoring Guide

**Version:** 1.0
**Date:** 2025-10-30
**Target Audience:** Claude Code AI Assistant
**Codebase:** YouWorker AI Agent Platform (On-Premise)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues (P0 - High Priority)](#critical-issues-p0---high-priority)
3. [High Priority Refactoring (P1)](#high-priority-refactoring-p1)
4. [Medium Priority Improvements (P2)](#medium-priority-improvements-p2)
5. [Low Priority Enhancements (P3)](#low-priority-enhancements-p3)
6. [Code Patterns & Anti-Patterns](#code-patterns--anti-patterns)
7. [Architectural Improvements](#architectural-improvements)
8. [Testing Strategy Enhancements](#testing-strategy-enhancements)
9. [Performance Optimization](#performance-optimization)
10. [Security Hardening](#security-hardening)
11. [Implementation Roadmap](#implementation-roadmap)
12. [Refactoring Checklist](#refactoring-checklist)

---

## Executive Summary

The YouWorker platform is a **well-architected, production-ready AI agent system** with strong security practices, modern technology choices, and clean separation of concerns. However, there are several opportunities for improvement in code quality, maintainability, scalability, and developer experience.

### Key Findings

**Strengths:**
- ✅ Strong security foundation (encryption, authentication, CSRF protection)
- ✅ Modern async/await patterns throughout
- ✅ Clean modular architecture (apps vs packages)
- ✅ Comprehensive type hints
- ✅ Good separation of concerns

**Areas for Improvement:**
- ⚠️ Inconsistent error handling patterns
- ⚠️ Limited observability (removed Prometheus/Grafana)
- ⚠️ Code duplication across MCP servers
- ⚠️ Lack of comprehensive testing (especially frontend)
- ⚠️ Missing API versioning strategy
- ⚠️ No distributed tracing
- ⚠️ Hardcoded configuration in multiple places

### Refactoring Impact Assessment

| Priority | Issues | Est. Effort | Business Impact |
|----------|--------|-------------|-----------------|
| **P0 (Critical)** | 8 | 2-3 weeks | High (stability, security) |
| **P1 (High)** | 5 | 4-6 weeks | High (maintainability, scale) |
| **P2 (Medium)** | 7 | 4-5 weeks | Medium (dev experience) |
| **P3 (Low)** | 5 | 5-7 weeks | Low (nice-to-have) |

---

## Critical Issues (P0 - High Priority)

### P0-1: Inconsistent DateTime Usage

**Location:** Multiple files across codebase
**Severity:** High (data consistency)

**Problem:**
Mixed usage of `datetime.utcnow()` (deprecated, naive) and `datetime.now(timezone.utc)` (recommended, aware).

**Files Affected:**
- `packages/db/crud.py` - Lines 234, 305, 462, 691
- `packages/db/models.py` - Line 106 (default parameter)
- `packages/agent/loop.py` - Line 385, 409

**Current Code:**
```python
# Bad - naive datetime (deprecated in Python 3.12+)
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
```

**Refactoring:**
```python
# Good - timezone-aware datetime
from datetime import datetime, timezone

created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    default=lambda: datetime.now(timezone.utc)
)
```

**Action Items:**
1. Search and replace all `datetime.utcnow()` with `datetime.now(timezone.utc)`
2. Add linting rule to prevent future usage
3. Modify initial migration (0001_init.py) to use timezone-aware defaults

**Rationale:**
- Python 3.12+ deprecates `datetime.utcnow()`
- Explicit timezone awareness prevents subtle bugs
- Consistent timestamps across distributed systems

---

### P0-2: Unsafe Logger Usage Pattern

**Location:** `packages/db/crud.py:35`
**Severity:** Medium-High

**Problem:**
Logger instantiated inside function breaks proper module-level logging configuration.

**Current Code:**
```python
async def ensure_root_user(session, *, username: str, api_key: str) -> User:
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Session type: {type(session)}")  # Debug logging left in production
```

**Issues:**
1. Logger created inside function (anti-pattern)
2. Debug/warning log left in production code
3. Late import of logging module

**Refactoring:**
```python
# At module level (top of crud.py)
import logging
logger = logging.getLogger(__name__)

async def ensure_root_user(session: AsyncSession, *, username: str, api_key: str) -> User:
    """Ensure root user exists with given credentials."""
    # Remove debug logging or convert to proper debug level
    logger.debug("Ensuring root user: username=%s", username)
    # ... rest of function
```

**Action Items:**
1. Move logger instantiation to module level in all files
2. Remove debug/warning logs or convert to `logger.debug()`
3. Add type hints to function parameters

---

### P0-3: Missing User ID in Metadata Builder

**Location:** `packages/ingestion/pipeline.py:306`
**Severity:** Medium-High (data integrity)

**Problem:**
Variable `user_id` used in metadata builder but not defined in scope.

**Current Code:**
```python
# Line 191: _process_item signature
async def _process_item(
    self,
    item: IngestionItem,
    *,
    tags: Sequence[str],
    from_web: bool,
    collection_name: str | None = None,
) -> int:
    # ...
    # Line 301: user_id referenced but not in scope!
    chunk.metadata = build_chunk_metadata(
        chunk=chunk,
        path_hash=path_hash,
        original_format=item.mime,
        output_format="markdown",
        user_id=user_id,  # ❌ NameError: user_id not defined
        tags=list(combined_tags) if combined_tags else None,
    )
```

**Refactoring:**
```python
# Fix 1: Add user_id parameter to _process_item
async def _process_item(
    self,
    item: IngestionItem,
    *,
    tags: Sequence[str],
    from_web: bool,
    collection_name: str | None = None,
    user_id: int | None = None,  # ✅ Add parameter
) -> int:
    # ... use user_id in metadata
    chunk.metadata = build_chunk_metadata(
        chunk=chunk,
        path_hash=path_hash,
        original_format=item.mime,
        output_format="markdown",
        user_id=user_id,
        tags=list(combined_tags) if combined_tags else None,
    )

# Fix 2: Update _process_item_task to pass user_id
async def _process_item_task(
    self,
    index: int,
    item: IngestionItem,
    *,
    tags: Sequence[str],
    from_web: bool,
    collection_name: str | None = None,
    user_id: int | None = None,  # ✅ Add parameter
    semaphore: asyncio.Semaphore,
) -> tuple[int, IngestionItem, int, Exception | None]:
    async with semaphore:
        try:
            chunk_count = await self._process_item(
                item,
                tags=tags,
                from_web=from_web,
                collection_name=collection_name,
                user_id=user_id,  # ✅ Pass through
            )
            return (index, item, chunk_count, None)
        except Exception as exc:
            logger.error(f"ingestion-item-error: {str(exc)}")
            return (index, item, 0, exc)

# Fix 3: Update ingest_path to pass user_id to tasks
async def ingest_path(
    self,
    path_or_url: str,
    *,
    recursive: bool | None = None,
    from_web: bool = False,
    tags: Sequence[str] | None = None,
    collection_name: str | None = None,
    user_id: int | None = None,
) -> IngestionReport:
    # ...
    tasks = [
        asyncio.create_task(
            self._process_item_task(
                idx,
                item,
                tags=tags,
                from_web=from_web,
                collection_name=collection_name,
                user_id=user_id,  # ✅ Pass user_id
                semaphore=semaphore,
            )
        )
        for idx, item in enumerate(items)
    ]
```

**Action Items:**
1. Add `user_id` parameter to `_process_item`, `_process_item_task`
2. Thread `user_id` through the call chain
3. Add unit tests to verify metadata includes correct user_id

---

### P0-4: Hardcoded Agent Iteration Limit

**Location:** `packages/agent/loop.py:330`, `apps/api/routes/websocket.py`
**Severity:** Medium

**Problem:**
Maximum agent iterations hardcoded to 10, not configurable per request or globally.

**Current Code:**
```python
async def run_until_completion(
    self,
    messages: list[ChatMessage],
    enable_tools: bool = True,
    max_iterations: int = 10,  # ❌ Hardcoded default
    language: str | None = None,
    model: str | None = None,
) -> AsyncIterator[Dict[str, Any]]:
```

**Refactoring:**
```python
# 1. Add to Settings (packages/common/settings.py)
class Settings(BaseSettings):
    # ... existing fields ...

    # Agent configuration
    agent_max_iterations: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum tool call iterations before stopping agent loop"
    )
    agent_max_iterations_override: bool = Field(
        default=True,
        description="Allow per-request override of max_iterations"
    )

# 2. Update AgentLoop constructor
class AgentLoop:
    def __init__(
        self,
        ollama_client: OllamaClient,
        registry: MCPRegistry,
        model: str = "gpt-oss:20b",
        default_language: str = DEFAULT_AGENT_LANGUAGE,
        max_iterations: int | None = None,  # ✅ Make configurable
        settings: Settings | None = None,
    ):
        self.ollama_client = ollama_client
        self.registry = registry
        self.model = model
        self.default_language = self._normalize_language(default_language)
        self._settings = settings or get_settings()
        self._max_iterations = max_iterations or self._settings.agent_max_iterations

    async def run_until_completion(
        self,
        messages: list[ChatMessage],
        enable_tools: bool = True,
        max_iterations: int | None = None,  # ✅ Optional override
        language: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        # Use override if provided and allowed, otherwise use instance default
        effective_max_iterations = (
            max_iterations
            if max_iterations is not None and self._settings.agent_max_iterations_override
            else self._max_iterations
        )

        iterations = 0
        while iterations < effective_max_iterations:
            # ... existing logic
```

**Action Items:**
1. Add `agent_max_iterations` to Settings
2. Update AgentLoop to use configurable value
3. Add validation to prevent abuse (e.g., max 50 iterations)
4. Document in .env.example

---

### P0-5: Vulnerable CORS Origin Parsing

**Location:** `apps/api/main.py:99-123`
**Severity:** High (security)

**Problem:**
CORS origin validation could be bypassed with malformed URLs.

**Current Code:**
```python
for origin in settings.frontend_origin.split(","):
    origin = origin.strip()
    if not origin:
        continue
    try:
        parsed = urlparse(origin)
        if not (
            parsed.scheme in {"http", "https"}
            and parsed.netloc
            and not parsed.path
            and not parsed.params
            and not parsed.query
            and not parsed.fragment
        ):
            logger.warning(f"Invalid CORS origin format (must be scheme://host): {origin}")
            continue
        allowed_origins.append(origin)
```

**Issues:**
1. Empty netloc check doesn't validate DNS format
2. No validation of scheme + netloc combination
3. Logs warning but doesn't fail fast

**Refactoring:**
```python
import re
from urllib.parse import urlparse

# Add to utilities or middleware module
VALID_HOSTNAME_REGEX = re.compile(
    r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
)

def validate_cors_origin(origin: str) -> bool:
    """Validate CORS origin with strict security checks."""
    if not origin or not isinstance(origin, str):
        return False

    try:
        parsed = urlparse(origin)

        # Scheme must be http or https
        if parsed.scheme not in {"http", "https"}:
            return False

        # Must have netloc (hostname)
        if not parsed.netloc:
            return False

        # Must not have path, params, query, or fragment
        if any([parsed.path, parsed.params, parsed.query, parsed.fragment]):
            return False

        # Validate hostname format (no underscores, valid DNS)
        hostname = parsed.netloc.split(':')[0]  # Remove port if present
        if not VALID_HOSTNAME_REGEX.match(hostname):
            # Check if it's localhost or IP
            if hostname not in {'localhost', '127.0.0.1', '[::1]'}:
                import ipaddress
                try:
                    ipaddress.ip_address(hostname)
                except ValueError:
                    return False

        # Validate port if present
        if ':' in parsed.netloc:
            try:
                port = int(parsed.netloc.split(':')[1])
                if not (1 <= port <= 65535):
                    return False
            except (ValueError, IndexError):
                return False

        return True
    except Exception:
        return False

# Update main.py
allowed_origins = []
for origin in settings.frontend_origin.split(","):
    origin = origin.strip()
    if not origin:
        continue

    if not validate_cors_origin(origin):
        logger.error(f"Invalid CORS origin: {origin}")
        continue

    allowed_origins.append(origin)

if not allowed_origins:
    raise ValueError(
        "No valid CORS origins provided; check FRONTEND_ORIGIN setting. "
        "Expected format: https://example.com or http://localhost:3000"
    )
```

**Action Items:**
1. Create `validate_cors_origin` utility function
2. Add comprehensive tests for CORS validation
3. Update main.py to use strict validation
4. Add security documentation for CORS configuration

---

### P0-6: Type Annotation Inconsistencies

**Location:** Multiple files
**Severity:** Medium

**Problem:**
Inconsistent use of type hints (Union vs |, Optional vs | None).

**Examples:**
```python
# Inconsistent - mixing styles
def func1(x: Optional[str]) -> Optional[int]:  # Old style
def func2(x: str | None) -> int | None:       # New style (Python 3.10+)
```

**Refactoring Standard:**
Since the project targets Python 3.11+, use modern union syntax consistently:

```python
# ✅ Preferred (Python 3.10+)
from __future__ import annotations

def process_item(
    item: IngestionItem,
    tags: Sequence[str] | None = None,
    user_id: int | None = None,
) -> dict[str, Any]:
    pass

# ❌ Avoid (unless compatibility required)
from typing import Optional, Dict, Any

def process_item(
    item: IngestionItem,
    tags: Optional[Sequence[str]] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    pass
```

**Action Items:**
1. Add `from __future__ import annotations` to all Python files
2. Convert `Optional[X]` → `X | None`
3. Convert `Union[X, Y]` → `X | Y`
4. Convert `Dict`, `List`, `Tuple` → `dict`, `list`, `tuple`
5. Add ruff rule to enforce modern type hints
6. Run automated conversion script

**Script:**
```bash
# Use pyupgrade for automated conversion
pip install pyupgrade
find . -name "*.py" -exec pyupgrade --py311-plus {} \;
```

---

### P0-7: Missing Database Connection Pooling Configuration

**Location:** `packages/db/session.py`
**Severity:** Medium-High (performance, stability)

**Problem:**
No explicit connection pooling configuration, using SQLAlchemy defaults.

**Current Code:**
```python
# Minimal connection pooling settings
engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
)
```

**Refactoring:**
```python
from sqlalchemy.pool import NullPool, QueuePool

# Add to settings.py
class Settings(BaseSettings):
    # ... existing fields ...

    # Database connection pooling
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=20, ge=0, le=100)
    db_pool_timeout: int = Field(default=30, ge=5, le=300)
    db_pool_recycle: int = Field(default=3600, ge=300, le=7200)
    db_pool_pre_ping: bool = Field(default=True)
    db_echo_pool: bool = Field(default=False)

# Update session.py
def get_engine(settings: Settings) -> AsyncEngine:
    """Create database engine with production-ready pooling."""

    # Determine pool class
    if settings.db_pool_size == 0:
        # Disable pooling (for serverless environments)
        poolclass = NullPool
        connect_args = {}
    else:
        poolclass = QueuePool
        connect_args = {
            "server_settings": {
                "application_name": "youworker",
                "jit": "off",  # Disable JIT for predictable query plans
            },
            "command_timeout": 60,
            "timeout": 10,
        }

    engine = create_async_engine(
        settings.database_url,
        echo=settings.db_echo,
        poolclass=poolclass,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=settings.db_pool_pre_ping,
        echo_pool=settings.db_echo_pool,
        connect_args=connect_args,
    )

    return engine
```

**Action Items:**
1. Add pooling configuration to Settings
2. Update `get_engine()` to configure pool
3. Add monitoring for pool exhaustion
4. Document pooling configuration in deployment guide

---

### P0-8: No Request ID Propagation to Child Services

**Location:** `apps/api/main.py:154`, MCP clients
**Severity:** Medium

**Problem:**
Correlation ID generated but not propagated to MCP servers or Ollama calls.

**Current Code:**
```python
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    correlation_id_var.set(correlation_id)
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response
```

**Refactoring:**
```python
# 1. Create context manager for correlation ID
from contextvars import ContextVar
from typing import Any

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")

def get_correlation_id() -> str:
    """Get current correlation ID or generate new one."""
    cid = correlation_id_var.get("")
    if not cid:
        cid = str(uuid.uuid4())
        correlation_id_var.set(cid)
    return cid

# 2. Update MCP client to include correlation ID
# In packages/mcp/client.py
class MCPClient:
    async def call_tool(
        self,
        tool_name: str,
        arguments: dict,
        correlation_id: str | None = None,
    ) -> Any:
        # Include correlation ID in MCP request
        request_id = correlation_id or str(uuid.uuid4())
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
                "metadata": {
                    "correlation_id": request_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            }
        }
        # ... rest of implementation

# 3. Update AgentLoop to propagate correlation ID
class AgentLoop:
    async def execute_tool_call(self, tool_call: ToolCall) -> str:
        correlation_id = get_correlation_id()
        logger.info(
            f"Executing tool: {tool_call.name}",
            extra={"correlation_id": correlation_id}
        )

        try:
            result = await self.registry.call_tool(
                tool_call.name,
                tool_call.arguments,
                correlation_id=correlation_id,  # ✅ Propagate
            )
            # ... rest

# 4. Update Ollama client to include correlation ID
class OllamaClient:
    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: str,
        tools: list[dict] | None = None,
        think: str | None = None,
        correlation_id: str | None = None,
    ) -> AsyncIterator[ChatCompletionChunk]:
        headers = {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlation_id or get_correlation_id(),  # ✅ Add header
        }
        # ... rest
```

**Action Items:**
1. Create `get_correlation_id()` utility function
2. Update MCP client to accept and propagate correlation ID
3. Update Ollama client to include correlation ID header
4. Update AgentLoop to pass correlation ID to all external calls
5. Add tests to verify correlation ID propagation

---

## High Priority Refactoring (P1)

### P1-1: Implement Service Layer Pattern

**Severity:** High (architecture)
**Effort:** Large (3-4 weeks)

**Problem:**
Business logic mixed into route handlers; CRUD operations called directly from routes.

**Current Pattern:**
```python
# apps/api/routes/chat.py (anti-pattern)
@router.post("/v1/chat/send")
async def send_message(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
    agent: AgentLoop = Depends(get_agent_loop),
):
    # ❌ Business logic in route handler
    session = await get_or_create_session(
        db, user_id=user.id, external_id=request.session_id, ...
    )
    await add_message(db, session_id=session.id, ...)
    # ... more business logic
```

**Refactoring:**
```python
# Create packages/services/chat_service.py
class ChatService:
    """Business logic for chat operations."""

    def __init__(
        self,
        db_session: AsyncSession,
        agent_loop: AgentLoop,
        settings: Settings,
    ):
        self.db = db_session
        self.agent = agent_loop
        self.settings = settings

    async def send_message(
        self,
        user_id: int,
        session_id: str | None,
        content: str,
        enable_tools: bool = True,
        language: str | None = None,
    ) -> ChatResponse:
        """Send a message and get agent response."""

        # Get or create session
        session = await get_or_create_session(
            self.db,
            user_id=user_id,
            external_id=session_id,
            model=self.settings.chat_model,
            enable_tools=enable_tools,
        )

        # Persist user message
        user_msg = await add_message(
            self.db,
            session_id=session.id,
            role="user",
            content=content,
        )

        # Build conversation history
        history = await self._build_conversation_history(session.id)

        # Run agent
        response_content = ""
        async for event in self.agent.run_until_completion(
            messages=history,
            enable_tools=enable_tools,
            language=language,
        ):
            if event["event"] == "token":
                response_content += event["data"]["text"]
            elif event["event"] == "done":
                break

        # Persist assistant message
        assistant_msg = await add_message(
            self.db,
            session_id=session.id,
            role="assistant",
            content=response_content,
        )

        await self.db.commit()

        return ChatResponse(
            session_id=session.external_id,
            message_id=assistant_msg.id,
            content=response_content,
        )

    async def _build_conversation_history(
        self,
        session_id: int
    ) -> list[ChatMessage]:
        """Build conversation history from database."""
        session_with_msgs = await get_session_with_messages(
            self.db, session_id=session_id, user_id=...
        )
        return [
            ChatMessage(role=msg.role, content=msg.content)
            for msg in session_with_msgs.messages
        ]

# Update route handler
@router.post("/v1/chat/send")
async def send_message(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    chat_service: ChatService = Depends(get_chat_service),
):
    """Send a chat message and receive agent response."""
    # ✅ Thin controller, business logic in service
    try:
        response = await chat_service.send_message(
            user_id=user.id,
            session_id=request.session_id,
            content=request.content,
            enable_tools=request.enable_tools,
            language=request.language,
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# Dependency injection
def get_chat_service(
    db: AsyncSession = Depends(get_async_session),
    agent: AgentLoop = Depends(get_agent_loop),
    settings: Settings = Depends(get_settings),
) -> ChatService:
    return ChatService(db, agent, settings)
```

**Benefits:**
1. Testable business logic (mock DB, agent easily)
2. Reusable across HTTP, WebSocket, CLI
3. Clear separation of concerns
4. Easier to add caching, rate limiting, etc.

**Action Items:**
1. Create `packages/services/` directory
2. Implement `ChatService`, `IngestionService`, `DocumentService`
3. Refactor route handlers to use services
4. Add service layer tests
5. Update dependency injection

---

### P1-2: Standardize Error Handling

**Severity:** High (maintainability)
**Effort:** Medium (2 weeks)

**Problem:**
Inconsistent error handling: some functions return None, others raise exceptions, some log, some don't.

**Current Examples:**
```python
# Example 1: Returns None
async def get_user_by_api_key(session: AsyncSession, api_key: str) -> User | None:
    if not api_key:
        return None  # ❌ Silent failure

# Example 2: Raises ValueError
async def regenerate_user_api_key(session: AsyncSession, user_id: int) -> str:
    user = await session.get(User, user_id)
    if not user:
        raise ValueError("User not found")  # ✅ But no custom exception

# Example 3: Returns error dict
async def execute_tool_call(self, tool_call: ToolCall) -> str:
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg)
        return json.dumps({"error": error_msg, ...})  # ❌ Mixed return types
```

**Refactoring:**

**Step 1: Create Custom Exception Hierarchy**

```python
# packages/common/exceptions.py
class YouWorkerException(Exception):
    """Base exception for YouWorker application."""

    def __init__(self, message: str, code: str | None = None, details: dict | None = None):
        self.message = message
        self.code = code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

# Business logic errors
class ResourceNotFoundError(YouWorkerException):
    """Resource not found."""
    pass

class ValidationError(YouWorkerException):
    """Invalid input data."""
    pass

class AuthenticationError(YouWorkerException):
    """Authentication failed."""
    pass

class AuthorizationError(YouWorkerException):
    """User not authorized for this operation."""
    pass

# Infrastructure errors
class DatabaseError(YouWorkerException):
    """Database operation failed."""
    pass

class ExternalServiceError(YouWorkerException):
    """External service (Ollama, Qdrant, MCP) failed."""
    pass

class ToolExecutionError(ExternalServiceError):
    """Tool execution failed."""

    def __init__(self, tool_name: str, message: str, details: dict | None = None):
        self.tool_name = tool_name
        super().__init__(
            message=f"Tool '{tool_name}' execution failed: {message}",
            code="TOOL_EXECUTION_ERROR",
            details={"tool_name": tool_name, **(details or {})}
        )
```

**Step 2: Standardize CRUD Error Handling**

```python
# packages/db/crud.py
from packages.common.exceptions import ResourceNotFoundError, DatabaseError

async def get_user_by_api_key(session: AsyncSession, api_key: str) -> User:
    """Get user by API key or raise ResourceNotFoundError."""
    if not api_key:
        raise ValidationError("API key is required")

    try:
        hashed = _hash_api_key(api_key)
        result = await session.execute(select(User).where(User.api_key_hash == hashed))
        user = result.scalar_one_or_none()

        if not user:
            raise ResourceNotFoundError(
                "User not found for provided API key",
                code="INVALID_API_KEY"
            )

        return user
    except ResourceNotFoundError:
        raise  # Re-raise business errors
    except Exception as e:
        logger.error(f"Database error in get_user_by_api_key: {e}", exc_info=True)
        raise DatabaseError(
            f"Failed to fetch user: {str(e)}",
            details={"operation": "get_user_by_api_key"}
        ) from e

async def regenerate_user_api_key(session: AsyncSession, user_id: int) -> str:
    """Generate new API key for user."""
    user = await session.get(User, user_id)
    if not user:
        raise ResourceNotFoundError(
            f"User not found: {user_id}",
            code="USER_NOT_FOUND",
            details={"user_id": user_id}
        )

    new_key = secrets.token_urlsafe(32)
    user.api_key_hash = _hash_api_key(new_key)
    await session.flush()
    return new_key
```

**Step 3: Global Exception Handler**

```python
# apps/api/main.py
from packages.common.exceptions import (
    YouWorkerException,
    ResourceNotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
)

@app.exception_handler(YouWorkerException)
async def youworker_exception_handler(request: Request, exc: YouWorkerException):
    """Handle application-specific exceptions."""

    # Map exception types to HTTP status codes
    status_code_map = {
        ResourceNotFoundError: 404,
        ValidationError: 400,
        AuthenticationError: 401,
        AuthorizationError: 403,
        DatabaseError: 500,
        ExternalServiceError: 502,
    }

    status_code = status_code_map.get(type(exc), 500)

    # Log server errors
    if status_code >= 500:
        logger.error(
            f"Server error: {exc.message}",
            extra={
                "exception_type": type(exc).__name__,
                "code": exc.code,
                "details": exc.details,
                "correlation_id": correlation_id_var.get(""),
            },
            exc_info=True,
        )

    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": exc.message,
                "code": exc.code,
                "details": exc.details,
            }
        },
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    correlation_id = correlation_id_var.get("")

    logger.error(
        f"Unhandled exception: {str(exc)}",
        extra={"correlation_id": correlation_id},
        exc_info=True,
    )

    # Don't expose internal errors in production
    message = (
        str(exc) if api_settings.app_env == "development"
        else "An internal error occurred"
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": message,
                "code": "INTERNAL_ERROR",
                "correlation_id": correlation_id,
            }
        },
    )
```

**Action Items:**
1. Create exception hierarchy in `packages/common/exceptions.py`
2. Update CRUD functions to raise custom exceptions
3. Update service layer to handle exceptions
4. Add global exception handlers to FastAPI app
5. Update frontend to handle standardized error format
6. Add exception handling tests

---

### P1-3: Extract MCP Server Base Class

**Severity:** High (code duplication)
**Effort:** Medium (1-2 weeks)

**Problem:**
Significant code duplication across 5 MCP servers (web, semantic, datetime, ingest, units).

**Current State:**
Each MCP server in `apps/mcp_servers/*/server.py` has ~80% duplicated code:
- WebSocket connection handling
- JSON-RPC request parsing
- Error handling
- Logging setup
- Health check (ping) handler

**Refactoring:**

**Step 1: Create Base MCP Server**

```python
# packages/mcp/base_server.py
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Callable

import websockets
from websockets.server import WebSocketServerProtocol

from packages.common import get_logger

class BaseMCPServer(ABC):
    """Base class for MCP protocol servers."""

    def __init__(
        self,
        server_id: str,
        name: str,
        version: str = "1.0.0",
        host: str = "0.0.0.0",
        port: int = 7000,
    ):
        self.server_id = server_id
        self.name = name
        self.version = version
        self.host = host
        self.port = port
        self.logger = get_logger(f"mcp.{server_id}")
        self._tools: dict[str, Callable] = {}
        self._initialized = False

    @abstractmethod
    async def initialize(self) -> dict[str, Any]:
        """
        Initialize server and return capabilities.

        Returns:
            dict with server metadata and capabilities
        """
        pass

    @abstractmethod
    def register_tools(self) -> None:
        """Register all tools provided by this server."""
        pass

    def register_tool(
        self,
        name: str,
        description: str,
        input_schema: dict,
        handler: Callable,
    ) -> None:
        """Register a tool with its handler."""
        self._tools[name] = {
            "name": name,
            "description": description,
            "inputSchema": input_schema,
            "handler": handler,
        }
        self.logger.info(f"Registered tool: {name}")

    async def handle_tools_list(self, params: dict) -> dict:
        """Handle tools/list request."""
        return {
            "tools": [
                {
                    "name": tool["name"],
                    "description": tool["description"],
                    "inputSchema": tool["inputSchema"],
                }
                for tool in self._tools.values()
            ]
        }

    async def handle_tools_call(self, params: dict) -> dict:
        """Handle tools/call request."""
        tool_name = params.get("name")
        arguments = params.get("arguments", {})

        if tool_name not in self._tools:
            raise ValueError(f"Unknown tool: {tool_name}")

        tool = self._tools[tool_name]
        handler = tool["handler"]

        self.logger.info(f"Executing tool: {tool_name}")

        try:
            result = await handler(**arguments)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, indent=2, ensure_ascii=False)
                    }
                ]
            }
        except Exception as e:
            self.logger.error(f"Tool execution failed: {tool_name}", exc_info=True)
            raise

    async def handle_ping(self, params: dict) -> dict:
        """Handle ping request (health check)."""
        return {"status": "ok", "server": self.server_id}

    async def handle_request(self, request_data: dict) -> dict:
        """Route JSON-RPC request to appropriate handler."""
        method = request_data.get("method")
        params = request_data.get("params", {})
        request_id = request_data.get("id")

        handlers = {
            "initialize": self.initialize,
            "tools/list": self.handle_tools_list,
            "tools/call": self.handle_tools_call,
            "ping": self.handle_ping,
        }

        if method not in handlers:
            raise ValueError(f"Unknown method: {method}")

        result = await handlers[method](params)

        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result,
        }

    async def handle_connection(self, websocket: WebSocketServerProtocol, path: str):
        """Handle WebSocket connection lifecycle."""
        client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        self.logger.info(f"Client connected: {client_id}")

        try:
            async for message in websocket:
                try:
                    request_data = json.loads(message)

                    # Handle request
                    response = await self.handle_request(request_data)

                    # Send response
                    await websocket.send(json.dumps(response))

                except json.JSONDecodeError as e:
                    error_response = {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32700,
                            "message": "Parse error",
                            "data": str(e)
                        },
                        "id": None,
                    }
                    await websocket.send(json.dumps(error_response))

                except Exception as e:
                    self.logger.error(f"Error handling request: {e}", exc_info=True)

                    error_response = {
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32603,
                            "message": "Internal error",
                            "data": str(e)
                        },
                        "id": request_data.get("id") if 'request_data' in locals() else None,
                    }
                    await websocket.send(json.dumps(error_response))

        except websockets.exceptions.ConnectionClosed:
            self.logger.info(f"Client disconnected: {client_id}")

        except Exception as e:
            self.logger.error(f"Connection error: {e}", exc_info=True)

    async def start(self):
        """Start the MCP server."""
        self.logger.info(f"Starting MCP server '{self.name}' on {self.host}:{self.port}")

        # Register tools
        self.register_tools()

        # Start WebSocket server
        async with websockets.serve(self.handle_connection, self.host, self.port):
            self.logger.info(f"MCP server '{self.name}' ready")
            await asyncio.Future()  # Run forever

    def run(self):
        """Run the server (blocking)."""
        asyncio.run(self.start())
```

**Step 2: Refactor Web MCP Server**

```python
# apps/mcp_servers/web/server.py (refactored)
from packages.mcp.base_server import BaseMCPServer
from .tools import search, fetch, head, extract_readable, crawl

class WebMCPServer(BaseMCPServer):
    """Web search and scraping MCP server."""

    def __init__(self, host: str = "0.0.0.0", port: int = 7001):
        super().__init__(
            server_id="web",
            name="Web Tools",
            version="1.0.0",
            host=host,
            port=port,
        )

    async def initialize(self) -> dict:
        """Initialize web server capabilities."""
        return {
            "protocolVersion": "1.0.0",
            "capabilities": {
                "tools": True,
            },
            "serverInfo": {
                "name": self.name,
                "version": self.version,
            }
        }

    def register_tools(self) -> None:
        """Register web-related tools."""

        # Search tool
        self.register_tool(
            name="search",
            description="Search the web using DuckDuckGo",
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "default": 10},
                },
                "required": ["query"],
            },
            handler=search,
        )

        # Fetch tool
        self.register_tool(
            name="fetch",
            description="Fetch content from a URL",
            input_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "format": "uri"},
                    "timeout": {"type": "integer", "default": 30},
                },
                "required": ["url"],
            },
            handler=fetch,
        )

        # ... register other tools (head, extract_readable, crawl)

if __name__ == "__main__":
    server = WebMCPServer()
    server.run()
```

**Benefits:**
1. Eliminates ~400 lines of duplicated code per server
2. Consistent error handling across all MCP servers
3. Easier to add new features (e.g., authentication, rate limiting)
4. Simpler to test (mock base class)
5. Reduced maintenance burden

**Action Items:**
1. Create `packages/mcp/base_server.py`
2. Refactor web MCP server to use base class
3. Refactor remaining 4 MCP servers
4. Add base server tests
5. Update documentation

---

### P1-4: Implement Retry Pattern with Exponential Backoff

**Severity:** High (reliability)
**Effort:** Small-Medium (1 week)

**Problem:**
No consistent retry logic for external service calls (Ollama, Qdrant, MCP servers).

**Current State:**
Some retry logic exists using `tenacity`, but it's inconsistent.

**Refactoring:**

```python
# packages/common/retry.py
from functools import wraps
import asyncio
import logging
from typing import Type, Callable, Any
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)

logger = logging.getLogger(__name__)

# Retryable exception types
RETRYABLE_EXCEPTIONS = (
    ConnectionError,
    TimeoutError,
    asyncio.TimeoutError,
    OSError,
)

def async_retry(
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 10.0,
    multiplier: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = RETRYABLE_EXCEPTIONS,
) -> Callable:
    """
    Decorator for async functions with exponential backoff retry.

    Args:
        max_attempts: Maximum retry attempts
        min_wait: Minimum wait time between retries (seconds)
        max_wait: Maximum wait time between retries (seconds)
        multiplier: Exponential backoff multiplier
        exceptions: Tuple of exception types to retry on
    """
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(
            multiplier=multiplier,
            min=min_wait,
            max=max_wait,
        ),
        retry=retry_if_exception_type(exceptions),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    )

# Usage example
from packages.common.retry import async_retry

class OllamaClient:
    @async_retry(max_attempts=3, min_wait=1.0, max_wait=10.0)
    async def chat_stream(
        self,
        messages: list[ChatMessage],
        model: str,
        tools: list[dict] | None = None,
        think: str | None = None,
    ) -> AsyncIterator[ChatCompletionChunk]:
        """Chat completion with automatic retry on connection errors."""
        # ... existing implementation

class MCPRegistry:
    @async_retry(max_attempts=2, min_wait=0.5, max_wait=5.0)
    async def call_tool(
        self,
        tool_name: str,
        arguments: dict,
    ) -> Any:
        """Call MCP tool with automatic retry."""
        # ... existing implementation
```

**Action Items:**
1. Create `packages/common/retry.py`
2. Add retry decorator to Ollama client methods
3. Add retry decorator to Qdrant operations
4. Add retry decorator to MCP tool calls
5. Add configuration for retry parameters
6. Add tests for retry behavior

---

### P1-5: Add Structured Logging

**Severity:** Medium-High (observability)
**Effort:** Medium (1-2 weeks)

**Problem:**
Logging uses basic string formatting; difficult to parse and analyze.

**Current State:**
```python
logger.info(f"Starting agent turn with {len(messages)} messages")
logger.error(f"Tool execution failed: {tool_name}")
```

**Refactoring:**

```python
# packages/common/logger.py
import logging
import json
from datetime import datetime, timezone
from typing import Any

class StructuredLogger(logging.Logger):
    """Logger that outputs structured JSON logs."""

    def _log_structured(
        self,
        level: int,
        msg: str,
        *args,
        extra: dict[str, Any] | None = None,
        **kwargs
    ):
        """Log with structured fields."""
        # Merge extra fields
        structured_extra = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": logging.getLevelName(level),
            "message": msg % args if args else msg,
            **(extra or {}),
        }

        # Call parent _log with structured extra
        super()._log(level, msg, args, extra=structured_extra, **kwargs)

    def info(self, msg, *args, extra=None, **kwargs):
        self._log_structured(logging.INFO, msg, *args, extra=extra, **kwargs)

    def warning(self, msg, *args, extra=None, **kwargs):
        self._log_structured(logging.WARNING, msg, *args, extra=extra, **kwargs)

    def error(self, msg, *args, extra=None, **kwargs):
        self._log_structured(logging.ERROR, msg, *args, extra=extra, **kwargs)

    def debug(self, msg, *args, extra=None, **kwargs):
        self._log_structured(logging.DEBUG, msg, *args, extra=extra, **kwargs)

class JSONFormatter(logging.Formatter):
    """Format log records as JSON."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add correlation ID if available
        if hasattr(record, "correlation_id"):
            log_data["correlation_id"] = record.correlation_id

        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs", "message",
                "msg", "pathname", "process", "processName", "relativeCreated",
                "thread", "threadName", "exc_info", "exc_text", "stack_info",
            }:
                log_data[key] = value

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)

def get_logger(name: str) -> StructuredLogger:
    """Get a structured logger instance."""
    logging.setLoggerClass(StructuredLogger)
    logger = logging.getLogger(name)
    return logger

# Usage
logger = get_logger(__name__)

logger.info(
    "Starting agent turn",
    extra={
        "message_count": len(messages),
        "tools_enabled": enable_tools,
        "model": model,
    }
)

logger.error(
    "Tool execution failed",
    extra={
        "tool_name": tool_name,
        "error_type": type(exc).__name__,
        "arguments": arguments,
    },
    exc_info=True,
)
```

**Action Items:**
1. Create structured logger in `packages/common/logger.py`
2. Update all log calls to use structured logging
3. Add JSON log formatter for production
4. Configure log aggregation (e.g., ELK, Loki)
5. Add logging best practices documentation

---

## Medium Priority Improvements (P2)

### P2-1: Add API Versioning Strategy

**Problem:** No API versioning beyond `/v1` prefix; breaking changes would affect all clients.

**Solution:**
```python
# Support multiple API versions side-by-side
app.include_router(v1_router, prefix="/v1")
app.include_router(v2_router, prefix="/v2")

# Or use header-based versioning
@app.middleware("http")
async def api_version_middleware(request: Request, call_next):
    api_version = request.headers.get("X-API-Version", "v1")
    request.state.api_version = api_version
    return await call_next(request)
```

---

### P2-2: Update Database Migration Strategy

**Problem:** Migration files accumulate during development; rollback testing needed.

**Solution (Pre-Release):**

Since this is a pre-release version, modify the initial migration file directly instead of creating new migrations:

```bash
# When adding new models or fields during pre-release:

# 1. Update models.py with changes
# 2. Delete postgres volume data
docker-compose down -v

# 3. Modify the initial migration file directly
# Edit: ops/alembic/versions/0001_init.py

# 4. Recreate database with updated schema
docker-compose up -d postgres
make db-migrate
```

**Post-Release Strategy:**

Once in production, follow standard migration practices:
```python
# Create new migration
alembic revision --autogenerate -m "add group support"

# Test migration
# tests/integration/test_migrations.py
import pytest
from alembic import command
from alembic.config import Config

def test_migration_upgrade_downgrade():
    """Test that migrations can be applied and rolled back."""
    alembic_cfg = Config("alembic.ini")

    # Upgrade to head
    command.upgrade(alembic_cfg, "head")

    # Downgrade one revision
    command.downgrade(alembic_cfg, "-1")

    # Re-upgrade
    command.upgrade(alembic_cfg, "head")
```

**Action Items:**
1. Document pre-release migration strategy in CONTRIBUTING.md
2. Add migration rollback tests for post-release
3. Create backup before running migrations in production
4. Test migrations on staging environment first

---

### P2-3: Extract Configuration Validation

**Problem:** Settings validation spread across multiple files.

**Solution:**
```python
# packages/common/validators.py
from pydantic import field_validator

class Settings(BaseSettings):
    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use asyncpg driver")
        return v

    @field_validator("ollama_base_url")
    @classmethod
    def validate_ollama_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("OLLAMA_BASE_URL must be HTTP/HTTPS URL")
        return v
```

---

### P2-4: Implement Health Check Framework

**Problem:** Health checks exist but are basic; no dependency health tracking.

**Solution:**
```python
# packages/common/health.py
from enum import Enum
from dataclasses import dataclass

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

@dataclass
class HealthCheck:
    name: str
    status: HealthStatus
    message: str
    latency_ms: int | None = None

async def check_postgres_health() -> HealthCheck:
    start = time.perf_counter()
    try:
        async with get_async_session() as db:
            await db.execute(text("SELECT 1"))
        latency = int((time.perf_counter() - start) * 1000)
        return HealthCheck("postgres", HealthStatus.HEALTHY, "OK", latency)
    except Exception as e:
        return HealthCheck("postgres", HealthStatus.UNHEALTHY, str(e))

# Aggregate health
@router.get("/health/detailed")
async def detailed_health():
    checks = await asyncio.gather(
        check_postgres_health(),
        check_qdrant_health(),
        check_ollama_health(),
        check_mcp_health(),
    )

    overall_status = (
        HealthStatus.UNHEALTHY if any(c.status == HealthStatus.UNHEALTHY for c in checks)
        else HealthStatus.DEGRADED if any(c.status == HealthStatus.DEGRADED for c in checks)
        else HealthStatus.HEALTHY
    )

    return {
        "status": overall_status,
        "checks": [asdict(c) for c in checks],
    }
```

---

### P2-5: Add Request Rate Limiting per User

**Problem:** Rate limiting by IP only; authenticated users not tracked individually.

**Solution:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_user_identifier(request: Request) -> str:
    """Get user identifier for rate limiting (user ID or IP)."""
    user = getattr(request.state, "user", None)
    if user:
        return f"user:{user.id}"
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_identifier, default_limits=["100/minute"])

@router.post("/v1/chat/send")
@limiter.limit("20/minute")  # Per-user limit
async def send_message(...):
    pass
```

---

### P2-6: Implement Frontend Component Library

**Problem:** UI components duplicated across pages; no design system.

**Solution:**
- Create comprehensive Storybook setup
- Extract reusable components (Button, Input, Card, Modal, etc.)
- Create theme system with CSS variables
- Add accessibility documentation

---

### P2-7: Add Database Query Performance Monitoring

**Problem:** No tracking of slow queries.

**Solution:**
```python
# Add SQLAlchemy event listener
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - conn.info["query_start_time"].pop()

    if total_time > 1.0:  # Log slow queries (>1s)
        logger.warning(
            "Slow query detected",
            extra={
                "query": statement,
                "duration_ms": int(total_time * 1000),
                "parameters": parameters,
            }
        )
```

---

## Low Priority Enhancements (P3)

### P3-1: Implement WebSocket Reconnection Strategy

**Problem:** No client-side reconnection logic documented.

**Solution:** Add WebSocket reconnection with exponential backoff in frontend docs.

---

### P3-2: Add CLI Tool for Administration

**Problem:** Administrative tasks require direct database access.

**Solution:**
```python
# scripts/admin_cli.py
import typer
app = typer.Typer()

@app.command()
def create_user(username: str, is_root: bool = False):
    """Create a new user."""
    # ... implementation

@app.command()
def reset_api_key(user_id: int):
    """Reset user's API key."""
    # ... implementation
```

---

### P3-3: Implement Group-Based Multi-tenancy

**Severity:** Medium (architecture)
**Effort:** Medium-Large (2-3 weeks)

**Problem:**
Currently, document access control is user-centric. There's no concept of groups where users can collaborate and share documents within their group while maintaining privacy boundaries.

**Requirements:**
- Users belong to one or more groups
- Users in Group A can access all documents uploaded by any user in Group A
- Documents can be marked as "private" to restrict access to the owner only
- Group-level permissions for tools and collections

**Solution:**

**Step 1: Add Group Models**

```python
# packages/db/models.py

class Group(AsyncAttrs, Base):
    """User group for multi-tenancy."""
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    members: Mapped[list["UserGroupMembership"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan"
    )


class UserGroupMembership(AsyncAttrs, Base):
    """Many-to-many relationship between users and groups."""
    __tablename__ = "user_group_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(
        String(32), default="member"
    )  # member, admin
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    user: Mapped[User] = relationship("User")
    group: Mapped[Group] = relationship(back_populates="members")

    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_user_group"),
        Index("idx_user_group_memberships_user", "user_id"),
        Index("idx_user_group_memberships_group", "group_id"),
    )


# Update Document model to support groups and privacy
class Document(AsyncAttrs, Base):
    __tablename__ = "documents"

    # ... existing fields ...

    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    is_private: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        index=True,
        comment="If True, only the owner can access this document"
    )

    # Relationships
    user: Mapped[User] = relationship("User")
    group: Mapped[Group | None] = relationship("Group")

    __table_args__ = (
        Index("idx_documents_group_created", "group_id", "created_at"),
        Index("idx_documents_group_private", "group_id", "is_private"),
        UniqueConstraint("user_id", "path_hash", name="uq_user_document_path"),
    )
```

**Step 2: Add Group CRUD Operations**

```python
# packages/db/crud.py

async def create_group(
    session: AsyncSession,
    *,
    name: str,
    description: str | None = None,
) -> Group:
    """Create a new group."""
    group = Group(name=name, description=description)
    session.add(group)
    await session.flush()
    return group


async def add_user_to_group(
    session: AsyncSession,
    *,
    user_id: int,
    group_id: int,
    role: str = "member",
) -> UserGroupMembership:
    """Add a user to a group."""
    # Check if membership already exists
    q = select(UserGroupMembership).where(
        UserGroupMembership.user_id == user_id,
        UserGroupMembership.group_id == group_id,
    )
    result = await session.execute(q)
    existing = result.scalar_one_or_none()

    if existing:
        return existing

    membership = UserGroupMembership(
        user_id=user_id,
        group_id=group_id,
        role=role,
    )
    session.add(membership)
    await session.flush()
    return membership


async def get_user_groups(
    session: AsyncSession,
    user_id: int,
) -> list[Group]:
    """Get all groups a user belongs to."""
    q = (
        select(Group)
        .join(UserGroupMembership)
        .where(UserGroupMembership.user_id == user_id)
        .order_by(Group.name)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_group_members(
    session: AsyncSession,
    group_id: int,
) -> list[User]:
    """Get all members of a group."""
    q = (
        select(User)
        .join(UserGroupMembership)
        .where(UserGroupMembership.group_id == group_id)
        .order_by(User.username)
    )
    result = await session.execute(q)
    return list(result.scalars().all())


async def can_user_access_document(
    session: AsyncSession,
    *,
    user_id: int,
    document_id: int,
) -> bool:
    """
    Check if a user can access a document.

    Rules:
    1. Document owner can always access
    2. If document is private, only owner can access
    3. If document belongs to a group, any group member can access
    4. Root users can access any document
    """
    # Get document with user and group info
    q = (
        select(Document)
        .options(selectinload(Document.user))
        .where(Document.id == document_id)
    )
    result = await session.execute(q)
    doc = result.scalar_one_or_none()

    if not doc:
        return False

    # Owner can always access
    if doc.user_id == user_id:
        return True

    # Check if user is root
    user = await session.get(User, user_id)
    if user and user.is_root:
        return True

    # Private documents only accessible by owner
    if doc.is_private:
        return False

    # Check group membership
    if doc.group_id:
        q = select(UserGroupMembership).where(
            UserGroupMembership.user_id == user_id,
            UserGroupMembership.group_id == doc.group_id,
        )
        result = await session.execute(q)
        membership = result.scalar_one_or_none()
        return membership is not None

    # Document has no group and is not private - check legacy access
    return False


async def get_accessible_documents(
    session: AsyncSession,
    user_id: int,
    group_id: int | None = None,
    include_private: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Document]:
    """
    Get documents accessible to a user.

    Returns:
    - User's own documents (including private)
    - Non-private documents from user's groups
    """
    # Get user's groups
    user_groups_q = select(UserGroupMembership.group_id).where(
        UserGroupMembership.user_id == user_id
    )
    user_groups_result = await session.execute(user_groups_q)
    user_group_ids = list(user_groups_result.scalars().all())

    # Build query
    conditions = []

    # User's own documents
    conditions.append(Document.user_id == user_id)

    # Group documents (non-private)
    if user_group_ids:
        if group_id:
            # Specific group
            conditions.append(
                and_(
                    Document.group_id == group_id,
                    Document.is_private == False,
                )
            )
        else:
            # All groups user belongs to
            conditions.append(
                and_(
                    Document.group_id.in_(user_group_ids),
                    Document.is_private == False,
                )
            )

    q = (
        select(Document)
        .where(or_(*conditions))
        .order_by(Document.last_ingested_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(q)
    return list(result.scalars().all())
```

**Step 3: Update Document Ingestion**

```python
# packages/ingestion/pipeline.py

async def ingest_path(
    self,
    path_or_url: str,
    *,
    recursive: bool | None = None,
    from_web: bool = False,
    tags: Sequence[str] | None = None,
    collection_name: str | None = None,
    user_id: int | None = None,
    group_id: int | None = None,  # ✅ Add group_id parameter
    is_private: bool = False,      # ✅ Add privacy flag
) -> IngestionReport:
    """High-level ingestion API for local paths or web resources."""
    # ... existing logic ...

    # When storing document metadata
    doc = await upsert_document(
        db,
        user_id=user_id,
        group_id=group_id,      # ✅ Pass group_id
        is_private=is_private,  # ✅ Pass privacy flag
        path_hash=path_hash,
        uri=item.uri,
        path=str(item.path),
        mime=item.mime,
        bytes_size=item.bytes_size,
        source=source,
        tags=tags,
        collection=collection_name,
    )
```

**Step 4: Update Qdrant Filtering**

```python
# packages/vectorstore/qdrant.py

async def search_documents(
    client: QdrantClient,
    query_vector: list[float],
    collection_name: str,
    user_id: int,
    group_ids: list[int] | None = None,
    exclude_private: bool = True,
    limit: int = 10,
) -> list[dict]:
    """
    Search documents with group-based access control.

    Returns documents that:
    1. Belong to the user, OR
    2. Belong to user's groups and are not private
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

    # Build filter conditions
    should_conditions = [
        # User's own documents
        FieldCondition(key="user_id", match=MatchValue(value=user_id)),
    ]

    # Add group documents (non-private)
    if group_ids:
        should_conditions.append(
            FieldCondition(
                key="group_id",
                match=MatchAny(any=group_ids),
            )
        )

    must_not_conditions = []
    if exclude_private:
        must_not_conditions.append(
            FieldCondition(key="is_private", match=MatchValue(value=True))
        )

    search_filter = Filter(
        should=should_conditions,
        must_not=must_not_conditions if must_not_conditions else None,
    )

    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        query_filter=search_filter,
        limit=limit,
    )

    return [
        {
            "id": hit.id,
            "score": hit.score,
            "payload": hit.payload,
        }
        for hit in results
    ]
```

**Step 5: Add API Endpoints**

```python
# apps/api/routes/groups.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/v1/groups", tags=["groups"])


class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    member_count: int


@router.post("/", response_model=GroupResponse)
async def create_group(
    data: GroupCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Create a new group."""
    group = await create_group(db, name=data.name, description=data.description)

    # Add creator as admin
    await add_user_to_group(db, user_id=user.id, group_id=group.id, role="admin")
    await db.commit()

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=1,
    )


@router.post("/{group_id}/members/{user_id}")
async def add_group_member(
    group_id: int,
    user_id: int,
    role: str = "member",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Add a user to a group (admin only)."""
    # Check if current user is group admin
    membership = await get_user_group_membership(db, user.id, group_id)
    if not membership or membership.role != "admin":
        raise HTTPException(403, "Only group admins can add members")

    await add_user_to_group(db, user_id=user_id, group_id=group_id, role=role)
    await db.commit()

    return {"message": "User added to group"}


@router.get("/me")
async def get_my_groups(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get all groups the current user belongs to."""
    groups = await get_user_groups(db, user.id)
    return [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
        }
        for g in groups
    ]
```

**Step 6: Update Document Upload UI**

```typescript
// Frontend component
interface DocumentUploadProps {
  onUpload: (file: File, options: UploadOptions) => Promise<void>;
}

interface UploadOptions {
  groupId?: number;
  isPrivate: boolean;
  tags?: string[];
}

function DocumentUploadForm({ onUpload }: DocumentUploadProps) {
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const { data: groups } = useUserGroups();

  return (
    <form onSubmit={handleSubmit}>
      <FileInput />

      <Select
        label="Group"
        value={selectedGroup}
        onChange={setSelectedGroup}
        options={groups}
      />

      <Checkbox
        label="Make this document private (only you can access)"
        checked={isPrivate}
        onChange={setIsPrivate}
      />

      <Button type="submit">Upload</Button>
    </form>
  );
}
```

**Benefits:**
1. **Collaboration**: Users in the same group can share and access documents
2. **Privacy**: Users can mark documents as private when needed
3. **Flexibility**: Users can belong to multiple groups
4. **Scalability**: Group-level permissions easier to manage than user-level
5. **Qdrant Efficiency**: Filtering by group_id more efficient than individual user checks

**Migration Plan:**
1. Create new tables (groups, user_group_memberships)
2. Add group_id and is_private columns to documents table
3. Create default group for existing users
4. Migrate existing documents to default group
5. Update all document access queries to use group filtering
6. Update Qdrant payload schema to include group_id and is_private
7. Re-index existing vectors with new metadata

**Action Items:**
1. Create database migration for group tables
2. Update Document model with group_id and is_private
3. Implement group CRUD operations
4. Update document access control logic
5. Update Qdrant filtering to use groups
6. Add group management API endpoints
7. Update frontend to support group selection
8. Add tests for group-based access control
9. Document group management workflows
10. Create migration script for existing data

---

### P3-4: Implement Audit Log

**Problem:** No audit trail for sensitive operations.

**Solution:**
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(128))
    resource_type: Mapped[str] = mapped_column(String(64))
    resource_id: Mapped[str] = mapped_column(String(128))
    changes: Mapped[dict] = mapped_column(JSONB)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

---

### P3-5: Implement Raw File Storage and Access

**Severity:** Medium (user experience)
**Effort:** Medium (1-2 weeks)

**Problem:**
Currently, only processed text chunks are stored in Qdrant. Users cannot download or view the original files (PDFs, images, documents) from the frontend. This limits use cases where users want to reference the source material.

**Requirements:**
- Store original uploaded files securely on disk or object storage
- Track file metadata in database
- Provide secure download API with access control
- Support file preview in frontend (PDFs, images)
- Apply group-based access control to file downloads
- Maintain association between files and their vector embeddings

**Solution:**

**Step 1: Add File Storage Model**

```python
# packages/db/models.py

class StoredFile(AsyncAttrs, Base):
    """Raw file storage with metadata."""
    __tablename__ = "stored_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    # File information
    original_filename: Mapped[str] = mapped_column(String(512))
    storage_path: Mapped[str] = mapped_column(
        String(1024),
        unique=True,
        comment="Path on disk or object storage URL"
    )
    mime_type: Mapped[str] = mapped_column(String(128))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    file_hash: Mapped[str] = mapped_column(
        String(64),
        index=True,
        comment="SHA-256 hash for deduplication"
    )

    # Privacy
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True
    )
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    access_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    document: Mapped[Document] = relationship("Document")
    user: Mapped[User] = relationship("User")
    group: Mapped[Group | None] = relationship("Group")

    __table_args__ = (
        Index("idx_stored_files_user_group", "user_id", "group_id"),
        Index("idx_stored_files_hash", "file_hash"),
        Index("idx_stored_files_document", "document_id"),
    )
```

**Step 2: File Storage Service**

```python
# packages/storage/file_storage.py

import hashlib
import shutil
from pathlib import Path
from typing import BinaryIO

from packages.common import get_settings, get_logger

logger = get_logger(__name__)


class FileStorageService:
    """Manage raw file storage on disk or object storage."""

    def __init__(self, base_path: Path | None = None):
        settings = get_settings()
        self.base_path = base_path or Path(settings.file_storage_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _compute_hash(self, file_path: Path) -> str:
        """Compute SHA-256 hash of file."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _get_storage_path(
        self,
        user_id: int,
        file_hash: str,
        original_filename: str,
    ) -> Path:
        """
        Generate storage path with structure:
        {base_path}/{user_id}/{hash[:2]}/{hash[2:4]}/{hash}_{filename}
        """
        hash_prefix = file_hash[:2]
        hash_subdir = file_hash[2:4]
        safe_filename = Path(original_filename).name  # Security: remove path components

        return (
            self.base_path
            / str(user_id)
            / hash_prefix
            / hash_subdir
            / f"{file_hash}_{safe_filename}"
        )

    async def store_file(
        self,
        source_path: Path,
        user_id: int,
        original_filename: str,
    ) -> tuple[Path, str, int]:
        """
        Store file and return (storage_path, file_hash, file_size).

        Uses content-addressed storage with hash-based deduplication.
        """
        # Compute hash
        file_hash = self._compute_hash(source_path)
        file_size = source_path.stat().st_size

        # Determine storage path
        storage_path = self._get_storage_path(user_id, file_hash, original_filename)

        # Check if file already exists (deduplication)
        if storage_path.exists():
            logger.info(f"File already exists (deduplicated): {file_hash}")
            return storage_path, file_hash, file_size

        # Create parent directories
        storage_path.parent.mkdir(parents=True, exist_ok=True)

        # Copy file
        shutil.copy2(source_path, storage_path)
        logger.info(f"Stored file: {storage_path}")

        return storage_path, file_hash, file_size

    async def get_file(self, storage_path: Path) -> Path:
        """Get file path (for streaming to client)."""
        if not storage_path.exists():
            raise FileNotFoundError(f"File not found: {storage_path}")
        return storage_path

    async def delete_file(self, storage_path: Path) -> bool:
        """Delete file from storage."""
        try:
            if storage_path.exists():
                storage_path.unlink()
                logger.info(f"Deleted file: {storage_path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting file {storage_path}: {e}", exc_info=True)
            return False
```

**Step 3: CRUD Operations**

```python
# packages/db/crud.py

async def store_file_metadata(
    session: AsyncSession,
    *,
    document_id: int,
    user_id: int,
    group_id: int | None,
    original_filename: str,
    storage_path: str,
    mime_type: str,
    file_size_bytes: int,
    file_hash: str,
    is_private: bool = False,
) -> StoredFile:
    """Store file metadata in database."""
    stored_file = StoredFile(
        document_id=document_id,
        user_id=user_id,
        group_id=group_id,
        original_filename=original_filename,
        storage_path=storage_path,
        mime_type=mime_type,
        file_size_bytes=file_size_bytes,
        file_hash=file_hash,
        is_private=is_private,
    )
    session.add(stored_file)
    await session.flush()
    return stored_file


async def get_stored_file(
    session: AsyncSession,
    file_id: int,
) -> StoredFile | None:
    """Get stored file by ID."""
    return await session.get(StoredFile, file_id)


async def can_user_access_file(
    session: AsyncSession,
    user_id: int,
    file_id: int,
) -> bool:
    """Check if user can access file (same rules as documents)."""
    stored_file = await session.get(StoredFile, file_id)
    if not stored_file:
        return False

    # Owner can always access
    if stored_file.user_id == user_id:
        return True

    # Check if user is root
    user = await session.get(User, user_id)
    if user and user.is_root:
        return True

    # Private files only accessible by owner
    if stored_file.is_private:
        return False

    # Check group membership
    if stored_file.group_id:
        q = select(UserGroupMembership).where(
            UserGroupMembership.user_id == user_id,
            UserGroupMembership.group_id == stored_file.group_id,
        )
        result = await session.execute(q)
        return result.scalar_one_or_none() is not None

    return False


async def increment_file_access(
    session: AsyncSession,
    file_id: int,
) -> None:
    """Increment access count and update last accessed timestamp."""
    stored_file = await session.get(StoredFile, file_id)
    if stored_file:
        stored_file.access_count += 1
        stored_file.last_accessed_at = datetime.now(timezone.utc)
        await session.flush()
```

**Step 4: API Endpoints**

```python
# apps/api/routes/files.py

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from packages.db import get_async_session, get_stored_file, can_user_access_file, increment_file_access
from packages.storage import FileStorageService

router = APIRouter(prefix="/v1/files", tags=["files"])


@router.get("/{file_id}/download")
async def download_file(
    file_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Download a stored file."""
    # Check access
    if not await can_user_access_file(db, user.id, file_id):
        raise HTTPException(403, "Access denied")

    # Get file metadata
    stored_file = await get_stored_file(db, file_id)
    if not stored_file:
        raise HTTPException(404, "File not found")

    # Get file from storage
    storage_service = FileStorageService()
    try:
        file_path = await storage_service.get_file(Path(stored_file.storage_path))
    except FileNotFoundError:
        raise HTTPException(404, "File not found in storage")

    # Increment access count
    await increment_file_access(db, file_id)
    await db.commit()

    # Return file
    return FileResponse(
        path=file_path,
        filename=stored_file.original_filename,
        media_type=stored_file.mime_type,
    )


@router.get("/{file_id}/metadata")
async def get_file_metadata(
    file_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get file metadata."""
    if not await can_user_access_file(db, user.id, file_id):
        raise HTTPException(403, "Access denied")

    stored_file = await get_stored_file(db, file_id)
    if not stored_file:
        raise HTTPException(404, "File not found")

    return {
        "id": stored_file.id,
        "filename": stored_file.original_filename,
        "mime_type": stored_file.mime_type,
        "size_bytes": stored_file.file_size_bytes,
        "created_at": stored_file.created_at,
        "access_count": stored_file.access_count,
        "is_private": stored_file.is_private,
    }
```

**Step 5: Update Ingestion Pipeline**

```python
# packages/ingestion/pipeline.py

async def _process_item(
    self,
    item: IngestionItem,
    *,
    tags: Sequence[str],
    from_web: bool,
    collection_name: str | None = None,
    user_id: int | None = None,
    group_id: int | None = None,
    is_private: bool = False,
    store_raw_file: bool = True,  # ✅ New parameter
) -> int:
    """Process ingestion item and optionally store raw file."""
    # ... existing processing logic ...

    # ✅ Store raw file if requested
    if store_raw_file and user_id:
        from packages.storage import FileStorageService
        from packages.db import store_file_metadata

        storage_service = FileStorageService()

        # Store file
        storage_path, file_hash, file_size = await storage_service.store_file(
            source_path=item.path,
            user_id=user_id,
            original_filename=item.path.name,
        )

        # Store metadata in DB
        async with get_async_session() as db:
            await store_file_metadata(
                db,
                document_id=doc.id,
                user_id=user_id,
                group_id=group_id,
                original_filename=item.path.name,
                storage_path=str(storage_path),
                mime_type=item.mime or "application/octet-stream",
                file_size_bytes=file_size,
                file_hash=file_hash,
                is_private=is_private,
            )
            await db.commit()

    return len(prepared_chunks)
```

**Step 6: Frontend Integration**

```typescript
// Frontend component for file preview/download
interface FilePreviewProps {
  fileId: number;
  filename: string;
  mimeType: string;
}

function FilePreview({ fileId, filename, mimeType }: FilePreviewProps) {
  const downloadUrl = `/v1/files/${fileId}/download`;

  const isPDF = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="file-preview">
      {isPDF && (
        <iframe
          src={downloadUrl}
          title={filename}
          className="w-full h-96"
        />
      )}

      {isImage && (
        <img
          src={downloadUrl}
          alt={filename}
          className="max-w-full"
        />
      )}

      <div className="flex gap-2 mt-4">
        <Button
          onClick={() => window.open(downloadUrl, "_blank")}
          variant="outline"
        >
          <Download className="w-4 h-4 mr-2" />
          Download {filename}
        </Button>
      </div>
    </div>
  );
}
```

**Benefits:**
1. **User Experience**: Users can download and view original files
2. **Deduplication**: Content-addressed storage prevents duplicate files
3. **Security**: Access control applied to file downloads
4. **Performance**: Efficient file serving with proper MIME types
5. **Analytics**: Track file access patterns

**Configuration:**

```python
# packages/common/settings.py

class Settings(BaseSettings):
    # ... existing fields ...

    # File storage
    file_storage_path: str = Field(
        default="/data/files",
        description="Base path for raw file storage"
    )
    file_storage_max_size_mb: int = Field(
        default=100,
        description="Maximum file size in MB"
    )
```

**Action Items:**
1. Add StoredFile model to database
2. Modify initial migration (0001_init.py) to include stored_files table
3. Implement FileStorageService
4. Add file CRUD operations
5. Create /v1/files API endpoints
6. Update ingestion pipeline to store raw files
7. Add frontend file preview components
8. Add file size limits and validation
9. Implement file cleanup for deleted documents
10. Add tests for file storage and access control

---

## Code Patterns & Anti-Patterns

### Anti-Pattern #1: God Objects

**Problem:** `StartupService` in `apps/api/services/startup.py` handles too many responsibilities.

**Solution:** Split into separate services (DatabaseInitializer, MCPRegistryInitializer, etc.).

---

### Anti-Pattern #2: Circular Imports

**Files:** `packages/common/__init__.py` imports from submodules that import from `common`.

**Solution:** Move shared types to `packages/common/types.py`.

---

### Anti-Pattern #3: Mutable Default Arguments

**Example:**
```python
# ❌ Bad
def process_items(items: list = []):
    items.append(...)
    return items

# ✅ Good
def process_items(items: list | None = None):
    if items is None:
        items = []
    items.append(...)
    return items
```

---

### Pattern #1: Dependency Injection

**Current:** Good use of FastAPI dependency injection throughout.

**Enhancement:** Extract all dependencies to `apps/api/dependencies.py` for clarity.

---

### Pattern #2: Repository Pattern

**Current:** CRUD operations in `packages/db/crud.py` approximate repository pattern.

**Enhancement:** Formalize with repository classes:
```python
class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: int) -> User:
        pass

    async def get_by_api_key(self, api_key: str) -> User:
        pass
```

---

## Architectural Improvements

### Arch-1: Implement Event-Driven Architecture

**Goal:** Decouple components via event bus.

**Solution:**
```python
# packages/events/bus.py
from typing import Callable
from collections import defaultdict

class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers[event_type].append(handler)

    async def publish(self, event_type: str, data: dict):
        for handler in self._handlers[event_type]:
            await handler(data)

# Usage
bus = EventBus()

# Subscribe to events
bus.subscribe("document.ingested", send_notification)
bus.subscribe("document.ingested", update_analytics)

# Publish events
await bus.publish("document.ingested", {"document_id": doc.id, "user_id": user.id})
```

---

### Arch-2: Add Message Queue (RabbitMQ/Redis Streams)

**Goal:** Offload long-running tasks (ingestion, embeddings) to background workers.

**Solution:** Implement Celery or ARQ for task queues.

---

### Arch-3: Implement CQRS Pattern

**Goal:** Separate read and write models for better scalability.

**Solution:**
- Write operations go to primary PostgreSQL
- Read operations can use read replicas or materialized views
- Eventual consistency acceptable for analytics

---

## Testing Strategy Enhancements

### Test-1: Add Mutation Testing

**Tool:** mutmut
**Goal:** Verify test quality by mutating code and ensuring tests fail.

---

### Test-2: Add Property-Based Testing

**Tool:** Hypothesis
**Goal:** Test edge cases automatically.

```python
from hypothesis import given, strategies as st

@given(st.text(), st.integers(min_value=1, max_value=10000))
def test_chunker_always_returns_list(text: str, chunk_size: int):
    result = chunk_text_tokens(text, chunk_size, overlap=0)
    assert isinstance(result, list)
```

---


## Performance Optimization

### Perf-1: Add Database Connection Pooling (Covered in P0-7)

### Perf-2: Optimize Qdrant Queries

**Solution:**
- Use payload indexing for filtered searches
- Batch vector operations
- Enable HNSW index tuning

---

### Perf-3: Add CDN for Static Assets

**Solution:** Serve frontend static files via CDN (CloudFlare, Fastly).

---

### Perf-4: Implement Database Read Replicas

**Solution:** Route read queries to PostgreSQL replicas.

---

## Security Hardening

### Sec-1: Add API Key Rotation Policy with SSO Support

**Problem:**
API keys should support rotation for security, but keys from Authentik SSO must remain stable and always map to the same user.

**Solution:**

```python
# packages/db/models.py

class User(Base):
    # ... existing fields ...

    api_key_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    api_key_rotation_required: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    api_key_source: Mapped[str] = mapped_column(
        String(32),
        default="internal",
        comment="Source of API key: 'internal' or 'authentik'"
    )
    authentik_user_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        unique=True,
        index=True,
        comment="External user ID from Authentik SSO"
    )

    __table_args__ = (
        Index("idx_users_api_key_source", "api_key_source"),
        Index("idx_users_authentik_id", "authentik_user_id"),
    )


# packages/db/crud.py

async def get_or_create_user_from_authentik(
    session: AsyncSession,
    *,
    authentik_user_id: str,
    username: str,
    api_key: str,
) -> User:
    """
    Get or create user from Authentik SSO.

    Authentik API keys are STABLE and always map to the same user.
    They should never expire or be rotated.
    """
    # First try to find by Authentik user ID
    q = select(User).where(User.authentik_user_id == authentik_user_id)
    result = await session.execute(q)
    user = result.scalar_one_or_none()

    if user:
        # Update API key hash if changed (Authentik key rotation)
        new_hash = _hash_api_key(api_key)
        if user.api_key_hash != new_hash:
            user.api_key_hash = new_hash
            await session.flush()
        return user

    # Create new user from Authentik
    user = User(
        username=username,
        authentik_user_id=authentik_user_id,
        api_key_hash=_hash_api_key(api_key),
        api_key_source="authentik",
        api_key_expires_at=None,  # Authentik keys never expire
        api_key_rotation_required=False,
        is_root=False,
    )
    session.add(user)
    await session.flush()
    return user


async def rotate_user_api_key(
    session: AsyncSession,
    user_id: int,
) -> str:
    """
    Rotate user's API key.

    Only works for internal keys; Authentik keys cannot be rotated here.
    """
    user = await session.get(User, user_id)
    if not user:
        raise ResourceNotFoundError(f"User not found: {user_id}")

    # Cannot rotate Authentik keys
    if user.api_key_source == "authentik":
        raise ValidationError(
            "Cannot rotate Authentik SSO keys. "
            "Please regenerate the key in Authentik."
        )

    # Generate new key
    new_key = secrets.token_urlsafe(32)
    user.api_key_hash = _hash_api_key(new_key)
    user.api_key_expires_at = datetime.now(timezone.utc) + timedelta(days=90)
    user.api_key_rotation_required = False
    await session.flush()

    return new_key


async def check_api_key_expiration(
    session: AsyncSession,
    user_id: int,
) -> dict[str, Any]:
    """Check if user's API key needs rotation."""
    user = await session.get(User, user_id)
    if not user:
        raise ResourceNotFoundError(f"User not found: {user_id}")

    # Authentik keys never expire
    if user.api_key_source == "authentik":
        return {
            "expired": False,
            "rotation_required": False,
            "days_until_expiry": None,
            "source": "authentik",
        }

    # Check internal key expiration
    now = datetime.now(timezone.utc)
    if user.api_key_expires_at:
        days_until_expiry = (user.api_key_expires_at - now).days
        expired = days_until_expiry <= 0
        rotation_required = expired or days_until_expiry <= 7  # Warn 7 days before
    else:
        days_until_expiry = None
        expired = False
        rotation_required = user.api_key_rotation_required

    return {
        "expired": expired,
        "rotation_required": rotation_required,
        "days_until_expiry": days_until_expiry,
        "source": "internal",
    }


# apps/api/middleware/auth.py

async def get_current_user_with_key_check(
    api_key: str = Depends(get_api_key),
    db: AsyncSession = Depends(get_async_session),
) -> User:
    """Get current user and check API key expiration."""
    user = await get_user_by_api_key(db, api_key)
    if not user:
        raise AuthenticationError("Invalid API key")

    # Check expiration (only for internal keys)
    key_status = await check_api_key_expiration(db, user.id)
    if key_status["expired"]:
        raise AuthenticationError(
            "API key has expired. Please regenerate your key."
        )

    # Warn about upcoming expiration (in response headers)
    if key_status["rotation_required"] and not key_status["expired"]:
        # Set warning header (to be added in response)
        # This is handled in middleware
        pass

    return user


# Add middleware to warn about key expiration
@app.middleware("http")
async def api_key_expiration_warning(request: Request, call_next):
    """Add warning header if API key is expiring soon."""
    response = await call_next(request)

    # Get user from request state (set by auth middleware)
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "api_key_expires_at"):
        if user.api_key_expires_at and user.api_key_source == "internal":
            now = datetime.now(timezone.utc)
            days_until_expiry = (user.api_key_expires_at - now).days
            if 0 < days_until_expiry <= 7:
                response.headers["X-API-Key-Expiry-Warning"] = (
                    f"API key expires in {days_until_expiry} days"
                )

    return response
```

**Benefits:**
1. **SSO Compatibility**: Authentik keys remain stable and never expire
2. **Security**: Internal keys can be rotated regularly
3. **User Experience**: Clear warnings before key expiration
4. **Auditability**: Track key source and expiration status

**Action Items:**
1. Add new fields to User model
2. Create migration for new fields
3. Implement `get_or_create_user_from_authentik()`
4. Update `rotate_user_api_key()` to check source
5. Add key expiration check middleware
6. Update API documentation
7. Add tests for SSO key handling

---

### Sec-2: Implement Content Security Policy (CSP)

**Solution:**
```python
@app.middleware("http")
async def add_csp_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' ws: wss:;"
    )
    return response
```

---

### Sec-3: Add Input Sanitization Library

**Solution:** Use bleach or markupsafe for HTML sanitization.

---

### Sec-4: Implement API Key Scopes

**Solution:**
```python
class APIKey(Base):
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String))  # e.g., ["chat:read", "chat:write"]
```

---

## Implementation Roadmap

### Phase 1: Critical Fixes (2-3 weeks)

**Priority:** P0 issues
**Goal:** Fix bugs, security vulnerabilities, and data consistency issues.

**Tasks:**
- [ ] P0-1: Fix datetime usage (1 day)
- [ ] P0-2: Fix logger instantiation (1 day)
- [ ] P0-3: Fix missing user_id parameter (2 days)
- [ ] P0-4: Make agent iterations configurable (1 day)
- [ ] P0-5: Harden CORS validation (2 days)
- [ ] P0-6: Standardize type hints (2 days)
- [ ] P0-7: Configure database pooling (2 days)
- [ ] P0-8: Propagate correlation IDs (3 days)

---

### Phase 2: Architecture Refactoring (4-6 weeks)

**Priority:** P1 issues
**Goal:** Improve maintainability, testability, and code quality.

**Tasks:**
- [ ] P1-1: Implement service layer (2 weeks)
- [ ] P1-2: Standardize error handling (2 weeks)
- [ ] P1-3: Extract MCP base class (1 week)
- [ ] P1-4: Add retry patterns (1 week)
- [ ] P1-5: Implement structured logging (1 week)

---

### Phase 3: Observability & Reliability (4-6 weeks)

**Priority:** P2 issues
**Goal:** Improve monitoring, debugging, and operational excellence.

**Tasks:**
- [ ] P2-1: API versioning (1 week)
- [ ] P2-2: Migration strategy update (3 days)
- [ ] P2-3: Configuration validation (3 days)
- [ ] P2-4: Health check framework (1 week)
- [ ] P2-5: Per-user rate limiting (3 days)
- [ ] P2-6: Component library (2 weeks)
- [ ] P2-7: Query performance monitoring (1 week)

---

### Phase 4: Enhancements (5-7 weeks)

**Priority:** P3 issues
**Goal:** Add nice-to-have features and optimizations.

**Tasks:**
- [ ] P3-1: WebSocket reconnection (1 week)
- [ ] P3-2: Admin CLI (1 week)
- [ ] P3-3: Group-based multi-tenancy (2-3 weeks)
- [ ] P3-4: Audit log (1 week)
- [ ] P3-5: Raw file storage and access (1-2 weeks)

---

## Refactoring Checklist

### Before Starting

- [ ] Create feature branch from main
- [ ] Set up development environment
- [ ] Run existing test suite to establish baseline
- [ ] Review related issues and PRs
- [ ] Document current behavior

### During Refactoring

- [ ] Write tests FIRST (TDD approach)
- [ ] Make small, incremental changes
- [ ] Run tests after each change
- [ ] Update documentation
- [ ] Add code comments for complex logic
- [ ] Use type hints consistently
- [ ] Follow project code style (black, ruff)

### After Refactoring

- [ ] All tests pass (unit, integration, e2e)
- [ ] Code coverage maintained or improved
- [ ] No new linting errors
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Performance benchmarks (if applicable)
- [ ] Security review (if security-related)
- [ ] Peer review requested
- [ ] CI/CD pipeline passes

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] No hardcoded values (use config)
- [ ] Error handling comprehensive
- [ ] Logging appropriate (level, content)
- [ ] No secrets in code
- [ ] Type hints present
- [ ] Tests comprehensive
- [ ] Documentation clear

---

## Appendix: Quick Reference

### File Naming Conventions

```
Python:
  - Modules: snake_case.py
  - Classes: PascalCase
  - Functions: snake_case
  - Constants: UPPER_SNAKE_CASE

TypeScript/React:
  - Components: PascalCase.tsx
  - Utilities: camelCase.ts
  - Hooks: useCamelCase.ts
  - Types: PascalCase.ts
```

### Import Order

```python
# 1. Standard library
import asyncio
from datetime import datetime

# 2. Third-party
from fastapi import FastAPI
from sqlalchemy import select

# 3. Local packages
from packages.db import User
from packages.agent import AgentLoop

# 4. Relative imports
from .models import ChatRequest
from .helpers import build_messages
```

### Commit Message Format

```
type(scope): short description

Longer description if needed.

Fixes #123
```

**Types:** feat, fix, refactor, test, docs, chore, perf, style

---

## Conclusion

This refactoring guide provides a comprehensive roadmap for improving the YouWorker platform's code quality, maintainability, and scalability. Priorities are based on impact (reliability, security, maintainability) and effort required.

**Recommended Approach:**
1. Start with **Phase 1 (P0 issues)** to fix critical bugs and security issues
2. Proceed to **Phase 2 (P1 issues)** to improve architecture and code quality
3. Implement **Phase 3 (P2 issues)** for observability and operational excellence
4. Consider **Phase 4 (P3 issues)** based on business priorities and available resources

**Key Principles:**
- ✅ Test-first approach (TDD)
- ✅ Small, incremental changes
- ✅ Continuous integration (run tests frequently)
- ✅ Documentation alongside code
- ✅ Peer review for all changes

**Success Metrics:**
- Reduced bug count
- Improved test coverage (>80%)
- Faster development velocity
- Better observability (logs, metrics, traces)
- Improved maintainability (code complexity metrics)

---

**Version History:**
- 1.0 (2025-10-30): Initial comprehensive refactoring guide
