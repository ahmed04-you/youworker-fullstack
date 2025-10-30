# YouWorker Testing Guide

**Version:** 1.0.0-pre-release
**Status:** 🚧 Pre-Release - Testing Infrastructure Under Development
**Test Framework:** pytest + pytest-asyncio
**Coverage Goal:** 80%+
**Last Updated:** 2025-10-30

---

## ⚠️ Pre-Release Notice

This guide describes the target testing strategy for YouWorker v1.0. The testing infrastructure is being built alongside the development efforts. Coverage is being improved incrementally.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Test Fixtures](#test-fixtures)
8. [Mocking & Fakes](#mocking--fakes)
9. [Testing Best Practices](#testing-best-practices)
10. [Continuous Integration](#continuous-integration)

---

## Testing Philosophy

### Test Pyramid

```
         ╱╲
        ╱  ╲     E2E Tests (10%)
       ╱────╲    - Full user flows
      ╱      ╲   - WebSocket communication
     ╱────────╲  - API integration
    ╱          ╲
   ╱────────────╲ Integration Tests (30%)
  ╱              ╲ - Service + Repository
 ╱────────────────╲ - Database interaction
╱                  ╲ - External services
╱────────────────────╲ Unit Tests (60%)
- Services           - Fast, isolated
- Repositories       - No dependencies
- Models             - Pure logic
```

### Testing Principles

1. **Fast**: Unit tests run in milliseconds
2. **Isolated**: Tests don't depend on each other
3. **Repeatable**: Same results every time
4. **Self-Validating**: Clear pass/fail
5. **Timely**: Written alongside code (TDD)

### Coverage Goals

- **Overall**: 80%+ coverage
- **Services**: 90%+ coverage (business logic critical)
- **Repositories**: 85%+ coverage (data access critical)
- **Routes**: 75%+ coverage (thin layer)
- **Models**: 100% coverage (easy to test)

---

## Test Structure

### Directory Layout

```
tests/
├── conftest.py                  # Shared fixtures
├── unit/                        # Unit tests (60% of tests)
│   ├── services/
│   │   ├── test_chat_service.py
│   │   ├── test_group_service.py
│   │   ├── test_ingestion_service.py
│   │   └── test_account_service.py
│   ├── repositories/
│   │   ├── test_user_repository.py
│   │   ├── test_group_repository.py
│   │   └── test_chat_repository.py
│   ├── models/
│   │   └── test_encryption.py
│   └── utils/
│       └── test_validation.py
│
├── integration/                 # Integration tests (30%)
│   ├── test_chat_flow.py
│   ├── test_group_management.py
│   ├── test_ingestion_pipeline.py
│   └── test_database.py
│
├── e2e/                        # End-to-end tests (10%)
│   ├── test_user_journey.py
│   └── test_websocket_chat.py
│
├── fixtures/                   # Test data
│   ├── sample_documents/
│   └── mock_responses/
│
└── helpers/                    # Test utilities
    ├── factories.py            # Object factories
    └── assertions.py           # Custom assertions
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/unit/services/test_group_service.py

# Run specific test
pytest tests/unit/services/test_group_service.py::TestGroupService::test_create_group

# Run with coverage
pytest --cov=apps --cov=packages --cov-report=html

# Run in parallel (faster)
pytest -n auto

# Run only failed tests
pytest --lf

# Run with verbose output
pytest -v

# Run with print statements
pytest -s
```

### Watch Mode

```bash
# Install pytest-watch
pip install pytest-watch

# Run tests on file changes
ptw
```

### Markers

```bash
# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run only slow tests
pytest -m slow

# Skip slow tests
pytest -m "not slow"
```

### Coverage Reports

```bash
# Generate HTML coverage report
pytest --cov --cov-report=html
open htmlcov/index.html

# Generate terminal report
pytest --cov --cov-report=term-missing

# Fail if coverage below threshold
pytest --cov --cov-fail-under=80
```

---

## Unit Testing

### Service Layer Tests

Test business logic in isolation.

```python
# tests/unit/services/test_group_service.py
import pytest
from unittest.mock import AsyncMock, Mock
from apps.api.services.group_service import GroupService
from packages.db.repositories.group_repository import GroupRepository
from packages.common.exceptions import ValidationError, AuthorizationError

class TestGroupService:
    """Test suite for GroupService."""

    @pytest.fixture
    def mock_group_repo(self):
        """Mock group repository."""
        repo = AsyncMock(spec=GroupRepository)
        return repo

    @pytest.fixture
    def mock_user_repo(self):
        """Mock user repository."""
        repo = AsyncMock(spec=UserRepository)
        return repo

    @pytest.fixture
    def group_service(self, mock_group_repo, mock_user_repo, mock_settings):
        """Create group service with mocked dependencies."""
        return GroupService(
            group_repo=mock_group_repo,
            user_repo=mock_user_repo,
            settings=mock_settings
        )

    @pytest.mark.asyncio
    async def test_create_group_success(self, group_service, mock_group_repo):
        """Test successful group creation."""
        # Arrange
        name = "Engineering"
        description = "Engineering team"
        creator_id = 1

        mock_group = Mock()
        mock_group.id = 1
        mock_group.name = name
        mock_group.description = description

        mock_group_repo.exists_by_name.return_value = False
        mock_group_repo.create.return_value = mock_group

        # Act
        result = await group_service.create_group(
            name=name,
            description=description,
            creator_user_id=creator_id
        )

        # Assert
        assert result.name == name
        assert result.description == description
        mock_group_repo.exists_by_name.assert_called_once_with(name)
        mock_group_repo.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_group_duplicate_name(self, group_service, mock_group_repo):
        """Test that duplicate group name raises ValidationError."""
        # Arrange
        name = "Engineering"
        mock_group_repo.exists_by_name.return_value = True

        # Act & Assert
        with pytest.raises(ValidationError) as exc_info:
            await group_service.create_group(
                name=name,
                description="Test",
                creator_user_id=1
            )

        assert exc_info.value.code == "GROUP_NAME_EXISTS"
        assert name in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_add_member_requires_admin(self, group_service, mock_group_repo):
        """Test that adding member requires admin role."""
        # Arrange
        group_id = 1
        user_id = 2
        requester_id = 3

        mock_group_repo.is_admin.return_value = False

        # Act & Assert
        with pytest.raises(AuthorizationError) as exc_info:
            await group_service.add_member(
                group_id=group_id,
                user_id=user_id,
                requester_id=requester_id,
                role="member"
            )

        assert exc_info.value.code == "NOT_GROUP_ADMIN"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("role", ["member", "admin"])
    async def test_add_member_valid_roles(
        self,
        group_service,
        mock_group_repo,
        role
    ):
        """Test that both member and admin roles are valid."""
        # Arrange
        mock_group_repo.is_admin.return_value = True
        mock_group_repo.add_member.return_value = Mock()

        # Act
        await group_service.add_member(
            group_id=1,
            user_id=2,
            requester_id=1,
            role=role
        )

        # Assert
        mock_group_repo.add_member.assert_called_once()
```

### Repository Layer Tests

Test data access with real database.

```python
# tests/unit/repositories/test_group_repository.py
import pytest
from packages.db.repositories.group_repository import GroupRepository
from packages.db.models.group import Group
from tests.helpers.factories import GroupFactory, UserFactory

@pytest.mark.asyncio
class TestGroupRepository:
    """Test suite for GroupRepository."""

    async def test_create_group(self, db_session):
        """Test group creation."""
        # Arrange
        repo = GroupRepository(db_session)
        name = "Engineering"
        description = "Engineering team"

        # Act
        group = await repo.create(
            name=name,
            description=description
        )
        await db_session.commit()

        # Assert
        assert group.id is not None
        assert group.name == name
        assert group.description == description
        assert group.created_at is not None

    async def test_get_by_name(self, db_session):
        """Test retrieving group by name."""
        # Arrange
        repo = GroupRepository(db_session)
        created_group = await GroupFactory.create(
            session=db_session,
            name="Engineering"
        )

        # Act
        found_group = await repo.get_by_name("Engineering")

        # Assert
        assert found_group is not None
        assert found_group.id == created_group.id
        assert found_group.name == "Engineering"

    async def test_get_by_name_not_found(self, db_session):
        """Test that nonexistent group returns None."""
        # Arrange
        repo = GroupRepository(db_session)

        # Act
        result = await repo.get_by_name("Nonexistent")

        # Assert
        assert result is None

    async def test_exists_by_name(self, db_session):
        """Test checking group existence."""
        # Arrange
        repo = GroupRepository(db_session)
        await GroupFactory.create(session=db_session, name="Engineering")

        # Act
        exists = await repo.exists_by_name("Engineering")
        not_exists = await repo.exists_by_name("Marketing")

        # Assert
        assert exists is True
        assert not_exists is False

    async def test_get_user_groups_with_eager_loading(self, db_session):
        """Test retrieving user groups with members eager loaded."""
        # Arrange
        repo = GroupRepository(db_session)
        user = await UserFactory.create(session=db_session)
        group1 = await GroupFactory.create(
            session=db_session,
            name="Engineering"
        )
        group2 = await GroupFactory.create(
            session=db_session,
            name="Marketing"
        )

        # Add user to groups
        await repo.add_member(group1.id, user.id, role="admin")
        await repo.add_member(group2.id, user.id, role="member")
        await db_session.commit()

        # Act
        groups = await repo.get_user_groups(user.id)

        # Assert
        assert len(groups) == 2
        assert all(hasattr(g, 'members') for g in groups)  # Eager loaded
        # No additional queries should be triggered
        assert any(g.name == "Engineering" for g in groups)
        assert any(g.name == "Marketing" for g in groups)
```

### Model Tests

Test model behavior and encryption.

```python
# tests/unit/models/test_encryption.py
import pytest
from packages.db.models.chat import ChatMessage, _get_message_fernet
from packages.common.exceptions import ConfigurationError

class TestMessageEncryption:
    """Test chat message encryption."""

    def test_encrypt_decrypt_message(self, db_session):
        """Test that messages are encrypted and decrypted correctly."""
        # Arrange
        plaintext = "This is a secret message"
        message = ChatMessage(
            session_id=1,
            role="user",
            content=plaintext
        )

        # Flush to trigger encryption
        db_session.add(message)
        db_session.flush()

        # Assert content is encrypted in database
        assert message.content != plaintext.encode('utf-8')
        assert isinstance(message.content, bytes)

        # Refresh from database to trigger decryption
        db_session.expire(message)
        db_session.refresh(message)

        # Assert content is decrypted correctly
        assert message.content == plaintext

    def test_encryption_key_required(self, monkeypatch):
        """Test that encryption fails without key."""
        # Arrange
        monkeypatch.setattr(
            "packages.db.models.chat._get_message_fernet",
            lambda: None
        )

        # Act & Assert
        with pytest.raises(ConfigurationError) as exc_info:
            message = ChatMessage(
                session_id=1,
                role="user",
                content="test"
            )

        assert "CHAT_MESSAGE_ENCRYPTION_SECRET" in str(exc_info.value)
```

---

## Integration Testing

### Service + Repository Integration

Test services with real database.

```python
# tests/integration/test_group_management.py
import pytest
from apps.api.services.group_service import GroupService
from packages.db.repositories.group_repository import GroupRepository
from packages.common.exceptions import ValidationError
from tests.helpers.factories import UserFactory

@pytest.mark.integration
@pytest.mark.asyncio
class TestGroupManagementIntegration:
    """Integration tests for group management."""

    @pytest.fixture
    async def group_service(self, db_session, mock_settings):
        """Create group service with real repository."""
        group_repo = GroupRepository(db_session)
        user_repo = UserRepository(db_session)
        audit_repo = AuditRepository(db_session)

        return GroupService(
            group_repo=group_repo,
            user_repo=user_repo,
            audit_repo=audit_repo,
            settings=mock_settings
        )

    async def test_create_and_retrieve_group(self, group_service, db_session):
        """Test creating and retrieving a group."""
        # Arrange
        user = await UserFactory.create(session=db_session)
        await db_session.commit()

        # Act - Create group
        created = await group_service.create_group(
            name="Engineering",
            description="Engineering team",
            creator_user_id=user.id
        )

        # Act - Retrieve group
        retrieved = await group_service.get_group(created.id, user.id)

        # Assert
        assert retrieved.id == created.id
        assert retrieved.name == "Engineering"
        assert len(retrieved.members) == 1
        assert retrieved.members[0].user_id == user.id
        assert retrieved.members[0].role == "admin"

    async def test_full_membership_workflow(self, group_service, db_session):
        """Test complete membership workflow."""
        # Arrange
        admin = await UserFactory.create(session=db_session, username="admin")
        member = await UserFactory.create(session=db_session, username="member")
        await db_session.commit()

        # Act - Create group
        group = await group_service.create_group(
            name="Team",
            description="Test team",
            creator_user_id=admin.id
        )

        # Act - Add member
        await group_service.add_member(
            group_id=group.id,
            user_id=member.id,
            requester_id=admin.id,
            role="member"
        )

        # Act - Update member role
        await group_service.update_member_role(
            group_id=group.id,
            user_id=member.id,
            requester_id=admin.id,
            new_role="admin"
        )

        # Act - Remove member
        await group_service.remove_member(
            group_id=group.id,
            user_id=member.id,
            requester_id=admin.id
        )

        # Assert final state
        final_group = await group_service.get_group(group.id, admin.id)
        assert len(final_group.members) == 1  # Only creator remains
```

### Database Integration

Test complex queries.

```python
# tests/integration/test_database.py
import pytest
from sqlalchemy import select, func
from packages.db.models import Group, User, UserGroupMembership

@pytest.mark.integration
@pytest.mark.asyncio
class TestDatabaseIntegration:
    """Test complex database operations."""

    async def test_group_member_count_query(self, db_session):
        """Test group member count aggregation."""
        # Arrange
        user1 = User(username="user1@test.com")
        user2 = User(username="user2@test.com")
        group = Group(name="Engineering")

        db_session.add_all([user1, user2, group])
        await db_session.flush()

        membership1 = UserGroupMembership(
            user_id=user1.id,
            group_id=group.id,
            role="admin"
        )
        membership2 = UserGroupMembership(
            user_id=user2.id,
            group_id=group.id,
            role="member"
        )

        db_session.add_all([membership1, membership2])
        await db_session.commit()

        # Act
        result = await db_session.execute(
            select(
                Group.id,
                Group.name,
                func.count(UserGroupMembership.id).label('member_count')
            )
            .join(UserGroupMembership)
            .group_by(Group.id, Group.name)
        )

        row = result.first()

        # Assert
        assert row.name == "Engineering"
        assert row.member_count == 2

    async def test_cascade_delete(self, db_session):
        """Test cascade delete behavior."""
        # Arrange
        user = User(username="test@test.com")
        group = Group(name="Test Group")

        db_session.add_all([user, group])
        await db_session.flush()

        membership = UserGroupMembership(
            user_id=user.id,
            group_id=group.id
        )
        db_session.add(membership)
        await db_session.commit()

        # Act - Delete group
        await db_session.delete(group)
        await db_session.commit()

        # Assert - Membership should be deleted
        result = await db_session.execute(
            select(UserGroupMembership).where(
                UserGroupMembership.group_id == group.id
            )
        )
        assert result.scalar_one_or_none() is None
```

---

## End-to-End Testing

### API Integration Tests

Test complete HTTP flows.

```python
# tests/e2e/test_user_journey.py
import pytest
from httpx import AsyncClient
from apps.api.main import app

@pytest.mark.e2e
@pytest.mark.asyncio
class TestUserJourney:
    """End-to-end user journey tests."""

    async def test_complete_group_workflow(self):
        """Test complete group creation and management workflow."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Step 1: Auto-login
            login_response = await client.post(
                "/v1/auth/auto-login",
                json={"username": "test@example.com"}
            )
            assert login_response.status_code == 200

            # Step 2: Get CSRF token
            csrf_response = await client.get("/v1/auth/csrf-token")
            csrf_token = csrf_response.json()["csrf_token"]

            # Step 3: Create group
            group_response = await client.post(
                "/v1/groups",
                json={
                    "name": "Engineering",
                    "description": "Engineering team"
                },
                headers={"X-CSRF-Token": csrf_token}
            )
            assert group_response.status_code == 201
            group_data = group_response.json()
            group_id = group_data["id"]

            # Step 4: Get group details
            get_response = await client.get(f"/v1/groups/{group_id}")
            assert get_response.status_code == 200
            assert get_response.json()["name"] == "Engineering"

            # Step 5: Update group
            update_response = await client.patch(
                f"/v1/groups/{group_id}",
                json={"description": "Updated description"},
                headers={"X-CSRF-Token": csrf_token}
            )
            assert update_response.status_code == 200

            # Step 6: Delete group
            delete_response = await client.delete(
                f"/v1/groups/{group_id}",
                headers={"X-CSRF-Token": csrf_token}
            )
            assert delete_response.status_code == 204

            # Step 7: Verify deletion
            verify_response = await client.get(f"/v1/groups/{group_id}")
            assert verify_response.status_code == 404
```

### WebSocket Tests

Test real-time communication.

```python
# tests/e2e/test_websocket_chat.py
import pytest
from fastapi.testclient import TestClient
from apps.api.main import app

@pytest.mark.e2e
class TestWebSocketChat:
    """Test WebSocket chat functionality."""

    def test_websocket_message_exchange(self):
        """Test sending and receiving messages via WebSocket."""
        client = TestClient(app)

        with client.websocket_connect("/v1/ws/chat/test-session") as websocket:
            # Send message
            websocket.send_json({
                "type": "text",
                "content": "Hello, assistant!"
            })

            # Receive response tokens
            responses = []
            while True:
                data = websocket.receive_json()
                responses.append(data)

                if data["type"] == "done":
                    break

            # Assert
            assert any(r["type"] == "token" for r in responses)
            assert responses[-1]["type"] == "done"
            assert responses[-1]["metadata"]["status"] == "success"

    def test_websocket_authentication_required(self):
        """Test that WebSocket requires authentication."""
        client = TestClient(app)

        with pytest.raises(Exception):  # WebSocket connection rejected
            with client.websocket_connect("/v1/ws/chat/test") as ws:
                pass
```

---

## Test Fixtures

### Core Fixtures

```python
# tests/conftest.py
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from packages.db.models import Base
from packages.common import Settings

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def db_session():
    """Create isolated database session for each test."""
    # Use test database
    engine = create_async_engine(
        "postgresql+asyncpg://postgres:postgres@localhost:5432/youworker_test",
        echo=False
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session_maker = sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session
        await session.rollback()

    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()

@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    return Settings(
        database__url="postgresql+asyncpg://postgres:postgres@localhost:5432/test",
        security__root_api_key="test-key",
        security__jwt_secret="test-secret",
        security__chat_message_encryption_secret="test-encryption-key"
    )

@pytest.fixture
async def test_user(db_session):
    """Create test user."""
    from tests.helpers.factories import UserFactory
    user = await UserFactory.create(session=db_session)
    await db_session.commit()
    return user
```

### Factory Fixtures

```python
# tests/helpers/factories.py
from datetime import datetime, timezone
from packages.db.models import User, Group, ChatSession

class UserFactory:
    """Factory for creating test users."""

    @staticmethod
    async def create(
        session,
        username: str = None,
        is_root: bool = False
    ) -> User:
        """Create a test user."""
        if username is None:
            username = f"user-{datetime.now().timestamp()}@test.com"

        user = User(
            username=username,
            is_root=is_root,
            api_key_hash="test-hash",
            created_at=datetime.now(timezone.utc)
        )
        session.add(user)
        await session.flush()
        return user

class GroupFactory:
    """Factory for creating test groups."""

    @staticmethod
    async def create(
        session,
        name: str = None,
        description: str = "Test group"
    ) -> Group:
        """Create a test group."""
        if name is None:
            name = f"Group-{datetime.now().timestamp()}"

        group = Group(
            name=name,
            description=description,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(group)
        await session.flush()
        return group
```

---

## Mocking & Fakes

### Mocking External Services

```python
# tests/unit/services/test_chat_service.py
from unittest.mock import AsyncMock, Mock, patch

@pytest.mark.asyncio
async def test_chat_with_tool_execution(chat_service):
    """Test chat with tool execution."""
    # Mock agent loop
    mock_agent = AsyncMock()
    mock_agent.run_until_completion.return_value = AsyncIterator([
        {"event": "token", "data": {"text": "Hello"}},
        {"event": "tool", "data": {"tool": "search", "status": "start"}},
        {"event": "tool", "data": {"tool": "search", "status": "end"}},
        {"event": "done", "data": {"metadata": {"status": "success"}}}
    ])

    chat_service.agent_loop = mock_agent

    # Act
    result = await chat_service.send_message(
        user_id=1,
        text_input="Search for Python",
        enable_tools=True
    )

    # Assert
    assert result.content is not None
    assert len(result.tool_events) > 0
    mock_agent.run_until_completion.assert_called_once()
```

### Fake Database

```python
# For faster unit tests
class FakeRepository:
    """In-memory fake repository for testing."""

    def __init__(self):
        self.data = {}
        self.next_id = 1

    async def create(self, **kwargs):
        obj = Mock()
        obj.id = self.next_id
        for key, value in kwargs.items():
            setattr(obj, key, value)

        self.data[self.next_id] = obj
        self.next_id += 1
        return obj

    async def get_by_id(self, id: int):
        return self.data.get(id)
```

---

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern

```python
@pytest.mark.asyncio
async def test_example():
    # Arrange - Set up test data
    user = await UserFactory.create()
    service = GroupService(...)

    # Act - Execute the behavior
    result = await service.create_group(...)

    # Assert - Verify the outcome
    assert result.name == "Expected Name"
```

### 2. Test One Thing

```python
# ✅ Good: Tests one specific behavior
async def test_create_group_adds_creator_as_admin():
    ...

# ❌ Bad: Tests multiple things
async def test_create_group_and_add_members_and_delete():
    ...
```

### 3. Descriptive Test Names

```python
# ✅ Good
async def test_create_group_with_duplicate_name_raises_validation_error():
    ...

# ❌ Bad
async def test_group_creation():
    ...
```

### 4. Use Fixtures for Setup

```python
# ✅ Good
@pytest.fixture
async def group_with_members(db_session):
    group = await create_group()
    await add_members(group, count=5)
    return group

async def test_something(group_with_members):
    assert len(group_with_members.members) == 5

# ❌ Bad - Setup in each test
async def test_something():
    group = await create_group()
    await add_members(group, count=5)
    ...
```

### 5. Test Error Cases

```python
async def test_error_handling():
    # Test happy path
    result = await service.do_something_valid()
    assert result.success

    # Test error cases
    with pytest.raises(ValidationError):
        await service.do_something_invalid()

    with pytest.raises(AuthorizationError):
        await service.do_something_unauthorized()
```

### 6. Parametrize Similar Tests

```python
@pytest.mark.parametrize("role,expected", [
    ("admin", True),
    ("member", False),
])
async def test_permission_check(role, expected):
    result = await service.can_edit(role=role)
    assert result == expected
```

---

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: youworker_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run tests
        run: pytest --cov --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml

      - name: Type check
        run: mypy apps/ packages/

      - name: Lint
        run: ruff check apps/ packages/
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: pytest
        name: pytest
        entry: pytest
        language: system
        pass_filenames: false
        always_run: true

      - id: mypy
        name: mypy
        entry: mypy
        language: system
        types: [python]

      - id: ruff
        name: ruff
        entry: ruff check
        language: system
        types: [python]
```

---

## Test Metrics

### Coverage Thresholds

```ini
# pytest.ini
[tool:pytest]
addopts =
    --cov=apps
    --cov=packages
    --cov-fail-under=80
    --cov-report=html
    --cov-report=term-missing
```

### Performance Benchmarks

```python
# tests/performance/test_benchmarks.py
import pytest
import time

@pytest.mark.benchmark
def test_query_performance(db_session, benchmark):
    """Benchmark database query performance."""

    def query():
        return db_session.execute(
            select(ChatSession).limit(100)
        )

    result = benchmark(query)
    assert benchmark.stats['mean'] < 0.1  # < 100ms
```

---

## Summary

Testing checklist:

✅ **Unit Tests**: All services and repositories covered
✅ **Integration Tests**: Key workflows tested end-to-end
✅ **E2E Tests**: Critical user journeys verified
✅ **80%+ Coverage**: Comprehensive code coverage
✅ **Fast Execution**: Unit tests run in milliseconds
✅ **Isolated Tests**: No dependencies between tests
✅ **CI Integration**: Automated testing on every commit
✅ **Type Checking**: mypy passes with strict mode
✅ **Linting**: Code follows style guidelines

Happy testing! 🧪
