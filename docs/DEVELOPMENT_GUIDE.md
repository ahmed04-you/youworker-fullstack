# YouWorker Development Guide

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - Under Active Development
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

This guide describes the target development workflow for YouWorker v1.0. Some features are still being implemented. See [BACKEND_REFACTORING_GUIDE.md](../BACKEND_REFACTORING_GUIDE.md) for current status.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Code Style & Standards](#code-style--standards)
5. [Working with Services](#working-with-services)
6. [Working with Repositories](#working-with-repositories)
7. [Database Operations](#database-operations)
8. [Testing](#testing)
9. [Debugging](#debugging)
10. [Common Tasks](#common-tasks)

---

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- Ollama (for LLM)
- Qdrant (for vector storage)
- Poetry or pip for dependency management

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd youworker-fullstack

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install -r requirements-dev.txt

# Set up pre-commit hooks
pre-commit install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
vim .env
```

### Environment Configuration

Required environment variables:

```bash
# Database
DATABASE__URL=postgresql+asyncpg://postgres:postgres@localhost:5432/youworker

# Security
SECURITY__ROOT_API_KEY=your-secure-api-key-here
SECURITY__JWT_SECRET=your-jwt-secret-here
SECURITY__CHAT_MESSAGE_ENCRYPTION_SECRET=your-fernet-key-here

# LLM
LLM__OLLAMA_BASE_URL=http://localhost:11434
LLM__CHAT_MODEL=gpt-oss:20b
LLM__EMBED_MODEL=embeddinggemma:300m

# Vector Store
LLM__QDRANT_URL=http://localhost:6333
LLM__QDRANT_COLLECTION=documents

# API
API__HOST=0.0.0.0
API__PORT=8001
API__LOG_LEVEL=DEBUG

# Application
APP_ENV=development
```

### Generate Fernet Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Database Setup

```bash
# Create database
createdb youworker

# Auto-create tables on first run (SQLAlchemy creates schema)
# Or use Alembic for migrations
alembic upgrade head
```

### Running the Application

```bash
# Development mode with auto-reload
uvicorn apps.api.main:app --reload --port 8001

# Production mode
uvicorn apps.api.main:app --workers 4 --port 8001
```

### Verify Installation

```bash
# Health check
curl http://localhost:8001/health

# Detailed health check
curl http://localhost:8001/health/detailed

# OpenAPI docs
open http://localhost:8001/docs
```

---

## Project Structure

```
youworker-fullstack/
├── apps/
│   └── api/                          # Main API application
│       ├── routes/                   # HTTP endpoints
│       │   ├── auth.py              # Authentication endpoints
│       │   ├── chat/                # Chat endpoints
│       │   ├── groups.py            # Group management
│       │   ├── analytics/           # Analytics endpoints
│       │   └── ingestion.py         # Document ingestion
│       ├── services/                 # Business logic layer
│       │   ├── base.py              # Base service class
│       │   ├── chat_service.py      # Chat business logic
│       │   ├── group_service.py     # Group management logic
│       │   ├── ingestion_service.py # Ingestion logic
│       │   └── account_service.py   # Account operations
│       ├── middleware/               # Custom middleware
│       │   ├── cors_validation.py
│       │   ├── csrf.py
│       │   ├── ip_whitelist.py
│       │   └── rate_limit.py
│       ├── dependencies.py           # Dependency injection
│       ├── config.py                 # App configuration
│       └── main.py                   # Application entry point
│
├── packages/                         # Shared packages
│   ├── db/                          # Database layer
│   │   ├── models/                  # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── group.py
│   │   │   ├── chat.py
│   │   │   ├── document.py
│   │   │   └── tool.py
│   │   ├── repositories/            # Repository pattern
│   │   │   ├── base.py             # Base repository
│   │   │   ├── user_repository.py
│   │   │   ├── group_repository.py
│   │   │   ├── chat_repository.py
│   │   │   ├── document_repository.py
│   │   │   └── tool_repository.py
│   │   ├── uow.py                   # Unit of Work
│   │   └── session.py               # Database session
│   │
│   ├── common/                      # Common utilities
│   │   ├── config/                  # Configuration modules
│   │   │   ├── database.py
│   │   │   ├── security.py
│   │   │   ├── llm.py
│   │   │   └── api.py
│   │   ├── exceptions.py            # Custom exceptions
│   │   ├── logger.py                # Logging configuration
│   │   └── settings.py              # Settings management
│   │
│   ├── agent/                       # Agent framework
│   │   ├── loop.py                  # Agent execution loop
│   │   └── registry.py              # MCP tool registry
│   │
│   ├── llm/                         # LLM integration
│   │   ├── client.py                # Ollama client
│   │   └── messages.py              # Message models
│   │
│   ├── vectorstore/                 # Vector database
│   │   └── qdrant.py                # Qdrant client
│   │
│   └── ingestion/                   # Document processing
│       ├── pipeline.py              # Ingestion orchestration
│       └── parsers/                 # Document parsers
│
├── tests/                           # Test suite
│   ├── unit/                        # Unit tests
│   │   ├── services/
│   │   ├── repositories/
│   │   └── models/
│   ├── integration/                 # Integration tests
│   │   ├── test_api.py
│   │   └── test_database.py
│   ├── e2e/                         # End-to-end tests
│   └── conftest.py                  # Test configuration
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT_GUIDE.md
│   ├── API_REFERENCE.md
│   └── DATABASE_SCHEMA.md
│
├── ops/                             # Operations
│   ├── docker/                      # Docker configurations
│   ├── compose/                     # Docker Compose
│   └── alembic/                     # Database migrations
│
├── .env.example                     # Environment template
├── pyproject.toml                   # Project configuration
├── mypy.ini                         # Type checking config
└── pytest.ini                       # Test configuration
```

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/group-invitations
```

### 2. Write Tests First (TDD)

```python
# tests/unit/services/test_group_service.py
import pytest
from apps.api.services.group_service import GroupService

@pytest.mark.asyncio
async def test_create_group_adds_creator_as_admin(
    group_service: GroupService,
    test_user: User
):
    """Test that group creator becomes admin automatically."""
    # Arrange
    name = "Engineering Team"
    description = "Product engineering"

    # Act
    result = await group_service.create_group(
        name=name,
        description=description,
        creator_user_id=test_user.id
    )

    # Assert
    assert result.name == name
    assert result.description == description
    assert len(result.members) == 1
    assert result.members[0].user_id == test_user.id
    assert result.members[0].role == "admin"
```

### 3. Implement Feature

Follow the layered architecture:

#### Step 1: Define Models (if needed)

```python
# packages/db/models/invitation.py
class GroupInvitation(AsyncAttrs, Base):
    __tablename__ = "group_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invitee_email: Mapped[str] = mapped_column(String(255))
    token: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(32))  # pending, accepted, expired
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

#### Step 2: Create Repository

```python
# packages/db/repositories/invitation_repository.py
class InvitationRepository(BaseRepository[GroupInvitation]):
    """Repository for group invitations."""

    async def get_by_token(self, token: str) -> GroupInvitation | None:
        """Get invitation by token."""
        result = await self.session.execute(
            select(GroupInvitation)
            .where(GroupInvitation.token == token)
            .options(selectinload(GroupInvitation.group))
        )
        return result.scalar_one_or_none()

    async def get_pending_for_email(
        self,
        email: str,
        group_id: int
    ) -> GroupInvitation | None:
        """Get pending invitation for email and group."""
        result = await self.session.execute(
            select(GroupInvitation)
            .where(
                GroupInvitation.invitee_email == email,
                GroupInvitation.group_id == group_id,
                GroupInvitation.status == "pending"
            )
        )
        return result.scalar_one_or_none()
```

#### Step 3: Implement Service

```python
# apps/api/services/group_service.py
class GroupService(BaseService):
    def __init__(
        self,
        group_repo: GroupRepository,
        invitation_repo: InvitationRepository,
        email_service: EmailService,
        settings: Settings
    ):
        self.group_repo = group_repo
        self.invitation_repo = invitation_repo
        self.email_service = email_service
        self.settings = settings

    async def invite_member(
        self,
        group_id: int,
        inviter_id: int,
        invitee_email: str
    ) -> InvitationResponse:
        """
        Invite a member to a group.

        Business logic:
        1. Verify inviter is admin
        2. Check for existing invitation
        3. Generate secure token
        4. Create invitation
        5. Send email
        6. Audit log
        """
        # Verify permission
        is_admin = await self.group_repo.is_admin(group_id, inviter_id)
        if not is_admin:
            raise AuthorizationError(
                "Only admins can invite members",
                code="NOT_GROUP_ADMIN"
            )

        # Check for duplicate
        existing = await self.invitation_repo.get_pending_for_email(
            invitee_email,
            group_id
        )
        if existing:
            raise ValidationError(
                f"Invitation already pending for {invitee_email}",
                code="INVITATION_EXISTS"
            )

        # Create invitation within UoW
        async with UnitOfWork(self.session) as uow:
            invitation = await uow.invitations.create(
                group_id=group_id,
                inviter_id=inviter_id,
                invitee_email=invitee_email,
                token=secrets.token_urlsafe(32),
                status="pending",
                expires_at=datetime.now(timezone.utc) + timedelta(days=7)
            )

            # Audit log
            await uow.audit.log_action(
                user_id=inviter_id,
                action="group.invite",
                resource_type="group",
                resource_id=str(group_id),
                changes={"invitee_email": invitee_email}
            )

        # Send email (outside transaction)
        await self.email_service.send_invitation(
            to_email=invitee_email,
            invitation_token=invitation.token,
            group_name=invitation.group.name
        )

        return self._to_invitation_response(invitation)
```

#### Step 4: Create Route

```python
# apps/api/routes/groups.py
@router.post("/{group_id}/invitations", response_model=InvitationResponse)
async def invite_group_member(
    group_id: int,
    request: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    service: GroupService = Depends(get_group_service)
):
    """
    Invite a member to the group.

    Requires admin role in the group.
    """
    return await service.invite_member(
        group_id=group_id,
        inviter_id=current_user.id,
        invitee_email=request.email
    )
```

### 4. Run Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/unit/services/test_group_service.py

# Run with coverage
pytest --cov=apps --cov=packages --cov-report=html

# Run type checking
mypy apps/ packages/

# Run linting
ruff check apps/ packages/
```

### 5. Format Code

```bash
# Auto-format
black apps/ packages/ tests/

# Check formatting
black --check apps/ packages/ tests/
```

### 6. Commit Changes

```bash
git add .
git commit -m "feat: Add group member invitation feature

- Add GroupInvitation model
- Implement InvitationRepository
- Add invite_member to GroupService
- Create invitation endpoint
- Add comprehensive tests

Closes #123"
```

### 7. Push and Create PR

```bash
git push origin feature/group-invitations

# Create PR via GitHub CLI
gh pr create --title "Add group member invitation" --body "..."
```

---

## Code Style & Standards

### Type Annotations

All code must have complete type annotations:

```python
# ✅ Good
async def create_group(
    self,
    name: str,
    description: str | None,
    creator_user_id: int
) -> GroupResponse:
    """Create a group."""
    pass

# ❌ Bad
async def create_group(self, name, description, creator_user_id):
    """Create a group."""
    pass
```

### Docstrings

Use Google-style docstrings:

```python
async def invite_member(
    self,
    group_id: int,
    inviter_id: int,
    invitee_email: str
) -> InvitationResponse:
    """
    Invite a member to a group.

    Args:
        group_id: ID of the group
        inviter_id: ID of the user sending the invitation
        invitee_email: Email address of the invitee

    Returns:
        InvitationResponse containing invitation details

    Raises:
        AuthorizationError: If inviter is not an admin
        ValidationError: If invitation already exists
        DatabaseError: If database operation fails

    Example:
        >>> response = await service.invite_member(
        ...     group_id=1,
        ...     inviter_id=42,
        ...     invitee_email="user@example.com"
        ... )
    """
    pass
```

### Error Handling

Always use custom exceptions:

```python
# ✅ Good
if not group:
    raise ResourceNotFoundError(
        f"Group not found: {group_id}",
        code="GROUP_NOT_FOUND",
        details={"group_id": group_id}
    )

# ❌ Bad
if not group:
    raise HTTPException(status_code=404, detail="Group not found")
```

### Logging

Use structured logging:

```python
# ✅ Good
logger.info(
    "Group invitation sent",
    extra={
        "group_id": group_id,
        "inviter_id": inviter_id,
        "invitee_email": invitee_email,
        "invitation_id": invitation.id
    }
)

# ❌ Bad
logger.info(f"Invitation sent to {invitee_email}")
```

### Database Queries

Always use eager loading to prevent N+1 queries:

```python
# ✅ Good
result = await session.execute(
    select(Group)
    .options(selectinload(Group.members).selectinload(UserGroupMembership.user))
    .where(Group.id == group_id)
)

# ❌ Bad
result = await session.execute(
    select(Group).where(Group.id == group_id)
)
# Later accessing group.members triggers additional queries
```

---

## Working with Services

### Creating a New Service

```python
# apps/api/services/my_service.py
from apps.api.services.base import BaseService
from packages.db.repositories.my_repository import MyRepository
from packages.common import Settings

class MyService(BaseService):
    """
    Business logic for my domain.

    This service orchestrates operations for [describe domain].
    """

    def __init__(
        self,
        my_repo: MyRepository,
        settings: Settings
    ):
        self.my_repo = my_repo
        self.settings = settings
        self._logger = logging.getLogger(__name__)

    async def my_operation(
        self,
        param1: str,
        param2: int
    ) -> MyResponse:
        """
        Perform my operation.

        Args:
            param1: Description
            param2: Description

        Returns:
            MyResponse with result

        Raises:
            ValidationError: If validation fails
        """
        # 1. Validate
        if not param1:
            raise ValidationError("param1 is required")

        # 2. Execute business logic
        async with UnitOfWork(self.session) as uow:
            result = await uow.my_repo.do_something(param1, param2)

            # Audit log if needed
            await uow.audit.log_action(
                action="my.operation",
                resource_id=str(result.id)
            )

        # 3. Log success
        self._logger.info(
            "Operation completed",
            extra={"result_id": result.id}
        )

        # 4. Return response
        return self._to_response(result)
```

### Registering Service Dependency

```python
# apps/api/dependencies.py
from apps.api.services.my_service import MyService

def get_my_service(
    my_repo: MyRepository = Depends(get_my_repository),
    settings: Settings = Depends(get_settings)
) -> MyService:
    """Get my service instance."""
    return MyService(my_repo, settings)
```

---

## Working with Repositories

### Creating a New Repository

```python
# packages/db/repositories/my_repository.py
from packages.db.repositories.base import BaseRepository
from packages.db.models.my_model import MyModel

class MyRepository(BaseRepository[MyModel]):
    """
    Repository for MyModel data access.

    Provides data access methods for [describe purpose].
    """

    def __init__(self, session: AsyncSession):
        super().__init__(session, MyModel)

    async def get_by_name(self, name: str) -> MyModel | None:
        """Get entity by name."""
        result = await self.session.execute(
            select(MyModel)
            .where(MyModel.name == name)
            .options(selectinload(MyModel.related_items))
        )
        return result.scalar_one_or_none()

    async def search(
        self,
        query: str,
        limit: int = 50
    ) -> list[MyModel]:
        """Search entities by query."""
        result = await self.session.execute(
            select(MyModel)
            .where(MyModel.name.ilike(f"%{query}%"))
            .limit(limit)
            .order_by(MyModel.created_at.desc())
        )
        return list(result.scalars().all())
```

### Using Unit of Work

```python
# In service
async with UnitOfWork(get_async_session) as uow:
    # Access multiple repositories in one transaction
    user = await uow.users.get_by_id(user_id)
    group = await uow.groups.create(name="Team")
    await uow.groups.add_member(group.id, user.id, role="admin")

    # All committed together on success
    # All rolled back on exception
```

---

## Database Operations

### Creating Migrations

```bash
# Auto-generate migration
alembic revision --autogenerate -m "Add group invitations table"

# Edit migration file
vim ops/alembic/versions/xxx_add_group_invitations.py

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Database Console

```bash
# Connect to database
psql -U postgres -d youworker

# Useful queries
SELECT * FROM groups;
SELECT * FROM users WHERE username = 'admin';
```

---

## Testing

### Test Structure

```python
# tests/unit/services/test_group_service.py
import pytest
from apps.api.services.group_service import GroupService

class TestGroupService:
    """Test suite for GroupService."""

    @pytest.mark.asyncio
    async def test_create_group_success(
        self,
        group_service: GroupService,
        test_user: User
    ):
        """Test successful group creation."""
        # Arrange
        name = "Engineering"
        description = "Engineering team"

        # Act
        result = await group_service.create_group(
            name=name,
            description=description,
            creator_user_id=test_user.id
        )

        # Assert
        assert result.name == name
        assert result.description == description

    @pytest.mark.asyncio
    async def test_create_group_duplicate_name(
        self,
        group_service: GroupService,
        test_user: User
    ):
        """Test duplicate group name raises error."""
        # Arrange
        name = "Engineering"
        await group_service.create_group(
            name=name,
            description="First",
            creator_user_id=test_user.id
        )

        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await group_service.create_group(
                name=name,
                description="Second",
                creator_user_id=test_user.id
            )

        assert exc_info.value.code == "GROUP_NAME_EXISTS"
```

### Running Tests

```bash
# All tests
pytest

# Specific file
pytest tests/unit/services/test_group_service.py

# Specific test
pytest tests/unit/services/test_group_service.py::TestGroupService::test_create_group_success

# With coverage
pytest --cov --cov-report=html

# Parallel execution
pytest -n auto
```

---

## Debugging

### Logging

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Or in .env
API__LOG_LEVEL=DEBUG
```

### Interactive Debugging

```python
# Add breakpoint
import pdb; pdb.set_trace()

# Or use ipdb
import ipdb; ipdb.set_trace()
```

### Database Query Logging

```python
# In .env
DATABASE__ECHO=true

# This will log all SQL queries
```

---

## Common Tasks

### Add New Endpoint

1. Create route handler in `apps/api/routes/`
2. Use existing service or create new one
3. Add tests
4. Update API documentation

### Add New Model

1. Create model in `packages/db/models/`
2. Create repository in `packages/db/repositories/`
3. Add migration if using Alembic
4. Create tests

### Add New Configuration

1. Add to appropriate config in `packages/common/config/`
2. Update `.env.example`
3. Document in README

### Add Middleware

1. Create middleware in `apps/api/middleware/`
2. Register in `apps/api/main.py`
3. Add tests

---

## Best Practices

1. **Always use type hints**
2. **Write tests first (TDD)**
3. **Follow layered architecture**
4. **Use dependency injection**
5. **Handle errors with custom exceptions**
6. **Log with structured context**
7. **Use eager loading for relationships**
8. **Keep services focused and small**
9. **Document all public APIs**
10. **Run tests and type checking before committing**

Happy coding! 🚀
