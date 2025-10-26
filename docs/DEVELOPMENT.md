# Development Guide

Guide for developers contributing to or extending YouWorker.AI.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- **Python 3.11+** with pip/poetry
- **Node.js 18+** with npm
- **Docker & Docker Compose** for services
- **Git** for version control
- **VS Code** (recommended) with extensions

### Initial Setup

```bash
# Clone repository
git clone <repository-url>
cd youworker-fullstack

# Setup Python environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Setup frontend
cd apps/frontend
npm install
cd ../..

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Start infrastructure services
docker compose -f ops/compose/docker-compose.yml up -d postgres qdrant ollama
```

## Development Environment

### VS Code Extensions

Recommended extensions:

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "charliermarsh.ruff",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.makefile-tools"
  ]
}
```

### VS Code Settings

```json
{
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

## Project Structure

```
youworker-fullstack/
├── apps/                   # Applications
│   ├── api/               # FastAPI backend
│   ├── frontend/          # Next.js frontend
│   └── mcp_servers/       # MCP tool servers
├── packages/              # Shared packages
│   ├── agent/            # Agent orchestration
│   ├── llm/              # LLM clients
│   ├── vectorstore/      # Vector database
│   ├── ingestion/        # Document processing
│   ├── parsers/          # File parsers
│   └── db/               # Database models
├── ops/                   # Operations
│   ├── docker/           # Dockerfiles
│   ├── compose/          # Docker Compose
│   ├── alembic/          # Database migrations
│   └── scripts/          # Utility scripts
├── tests/                 # Tests
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                  # Documentation
└── examples/              # Example code
```

### Module Organization

**apps/**: Runnable applications with entry points  
**packages/**: Reusable library code  
**ops/**: Infrastructure and deployment  
**tests/**: All test code

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Edit code following [coding standards](#coding-standards).

### 3. Run Tests

```bash
# All tests
make test

# Specific tests
pytest tests/unit/test_my_feature.py -v

# With coverage
pytest --cov=packages --cov=apps
```

### 4. Format Code

```bash
# Format Python
make format

# Lint Python
make lint

# Format frontend
cd apps/frontend
npm run lint
npm run format
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

Use [conventional commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

Create pull request on GitHub.

## Coding Standards

### Python

#### Style Guide

Follow [PEP 8](https://pep8.org/) with these specifics:

```python
# Line length: 100 characters
# Use Black formatter
# Use type hints
# Docstrings for all public functions

from typing import Optional

def process_data(
    input_text: str,
    max_length: Optional[int] = None,
) -> dict[str, Any]:
    """
    Process input text and return structured data.
    
    Args:
        input_text: Text to process
        max_length: Maximum output length
        
    Returns:
        Dictionary with processed data
        
    Raises:
        ValueError: If input is empty
    """
    if not input_text:
        raise ValueError("Input cannot be empty")
    
    # Processing logic
    return {"result": processed}
```

#### Import Organization

```python
# 1. Standard library
import asyncio
import logging
from datetime import datetime
from typing import Any, Optional

# 2. Third-party packages
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# 3. Local imports (absolute)
from packages.agent import AgentLoop
from packages.llm import OllamaClient

# 4. Local imports (relative)
from .helpers import process_text
from .models import ChatRequest
```

#### Async Best Practices

```python
# Use async/await consistently
async def fetch_data() -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()

# Use asyncio.gather for concurrent operations
results = await asyncio.gather(
    fetch_data(),
    process_data(),
    return_exceptions=True
)

# Use context managers
async with get_async_session() as db:
    await db.execute(query)
```

### TypeScript/JavaScript

#### Style Guide

```typescript
// Use TypeScript strict mode
// Use ESLint + Prettier
// Use explicit types

interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
}

// Use const/let, never var
const data = await fetchUser(1);

// Use arrow functions for callbacks
users.map((user) => user.name);

// Use optional chaining
const userName = user?.name ?? 'Unknown';
```

#### React Best Practices

```typescript
// Use functional components
function Component({ data }: Props) {
  const [state, setState] = useState(initial);
  
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [dependencies]);
  
  const handler = useCallback(() => {
    // Memoized handler
  }, [dependencies]);
  
  return <div>{state}</div>;
}

// Memo for expensive components
export default memo(Component);
```

## Testing

### Unit Tests

Test individual functions in isolation:

```python
# tests/unit/test_agent_loop.py
import pytest
from packages.agent import AgentLoop

@pytest.mark.asyncio
async def test_agent_processes_message():
    """Test that agent processes user messages."""
    agent = AgentLoop(...)
    
    result = await agent.process("Hello")
    
    assert result is not None
    assert len(result) > 0
```

### Integration Tests

Test component interactions:

```python
# tests/integration/test_chat_endpoints.py
import pytest
from fastapi.testclient import TestClient

def test_chat_endpoint_returns_response(client: TestClient):
    """Test chat endpoint with real components."""
    response = client.post(
        "/v1/chat/unified",
        json={"text_input": "Hello"},
        headers={"X-API-Key": "test-key"}
    )
    
    assert response.status_code == 200
    assert "content" in response.json()
```

### E2E Tests

Test complete user workflows:

```python
# tests/e2e/test_chat_flow.py
import pytest
from playwright.async_api import async_playwright

@pytest.mark.asyncio
async def test_complete_chat_flow():
    """Test complete chat interaction."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        await page.goto("http://localhost:8000")
        await page.fill("#message-input", "Hello")
        await page.click("#send-button")
        
        # Wait for response
        await page.wait_for_selector(".assistant-message")
        
        await browser.close()
```

### Running Tests

```bash
# All tests
pytest

# Specific test file
pytest tests/unit/test_agent_loop.py

# Specific test
pytest tests/unit/test_agent_loop.py::test_agent_processes_message

# With coverage
pytest --cov=packages --cov=apps --cov-report=html

# Watch mode
pytest-watch

# Parallel execution
pytest -n auto
```

## Debugging

### Python Debugging

#### Using pdb

```python
import pdb

def problematic_function():
    data = get_data()
    pdb.set_trace()  # Debugger will stop here
    result = process(data)
    return result
```

#### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "apps.api.main:app",
        "--reload",
        "--port",
        "8001"
      ],
      "jinja": true
    }
  ]
}
```

#### Logging

```python
import logging

logger = logging.getLogger(__name__)

def my_function():
    logger.debug("Debug info")
    logger.info("Info message")
    logger.warning("Warning")
    logger.error("Error occurred", exc_info=True)
```

### Frontend Debugging

#### Browser DevTools

```typescript
// Console logging
console.log('Debug:', data)
console.error('Error:', error)
console.table(users)

// Debugger statement
function handler() {
  debugger; // Execution pauses here
  processData()
}
```

#### React Developer Tools

Install React DevTools extension:
- Inspect component tree
- View props and state
- Track component updates
- Profile performance

## Common Tasks

### Adding a New API Endpoint

1. **Create route module**:

```python
# apps/api/routes/my_route.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter(prefix="/v1/my-feature", tags=["my-feature"])

class MyRequest(BaseModel):
    input: str

@router.post("/process")
async def process_endpoint(request: MyRequest):
    """Process input and return result."""
    result = await process_logic(request.input)
    return {"result": result}
```

2. **Register in main.py**:

```python
# apps/api/main.py
from apps.api.routes import my_route

app.include_router(my_route.router)
```

3. **Add tests**:

```python
# tests/integration/test_my_route.py
def test_my_endpoint(client):
    response = client.post("/v1/my-feature/process", json={"input": "test"})
    assert response.status_code == 200
```

### Adding a Database Model

1. **Define model**:

```python
# packages/db/models.py
from sqlalchemy import Column, Integer, String
from .session import Base

class MyModel(Base):
    __tablename__ = "my_table"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
```

2. **Create migration**:

```bash
# Generate migration
alembic -c ops/alembic/alembic.ini revision --autogenerate -m "Add my_table"

# Review migration file in ops/alembic/versions/

# Apply migration
alembic -c ops/alembic/alembic.ini upgrade head
```

3. **Add CRUD operations**:

```python
# packages/db/crud.py
async def create_my_model(session, name: str) -> MyModel:
    model = MyModel(name=name)
    session.add(model)
    await session.commit()
    return model
```

### Adding a Frontend Component

1. **Create component**:

```typescript
// components/my-component.tsx
interface MyComponentProps {
  data: string;
  onAction: () => void;
}

export function MyComponent({ data, onAction }: MyComponentProps) {
  return (
    <div className="p-4">
      <p>{data}</p>
      <Button onClick={onAction}>Action</Button>
    </div>
  )
}
```

2. **Add tests**:

```typescript
// __tests__/components/my-component.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MyComponent } from '@/components/my-component'

describe('MyComponent', () => {
  it('renders and handles click', () => {
    const handleAction = jest.fn()
    render(<MyComponent data="test" onAction={handleAction} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleAction).toHaveBeenCalled()
  })
})
```

### Adding an MCP Server

See [MCP Servers Documentation](MCP_SERVERS.md#creating-custom-servers)

## Best Practices

### Error Handling

```python
# Use specific exceptions
from fastapi import HTTPException

async def get_user(user_id: int):
    user = await db.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Log errors
try:
    result = await process()
except Exception as e:
    logger.error(f"Processing failed: {e}", exc_info=True)
    raise
```

### Input Validation

```python
from pydantic import BaseModel, Field, validator

class ChatRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    temperature: float = Field(default=0.7, ge=0, le=2)
    
    @validator('text')
    def validate_text(cls, v):
        if not v.strip():
            raise ValueError("Text cannot be empty")
        return v.strip()
```

### Security

```python
# Sanitize inputs
from packages.common.validation import sanitize_input

user_input = sanitize_input(raw_input)

# Use parameterized queries
query = select(User).where(User.id == user_id)

# Don't log sensitive data
logger.info(f"User {user.id} logged in")  # Good
logger.info(f"User password: {password}")  # Bad!
```

### Performance

```python
# Use async/await
async def fetch_many():
    results = await asyncio.gather(
        fetch_a(),
        fetch_b(),
        fetch_c()
    )
    return results

# Batch operations
await db.execute_many(inserts)

# Cache expensive computations
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_computation(input: str) -> str:
    # ...
    return result
```

## Related Documentation

- [Contributing Guide](CONTRIBUTING.md)
- [Testing Guide](TESTING.md)
- [Architecture](ARCHITECTURE.md)
- [API Documentation](API.md)