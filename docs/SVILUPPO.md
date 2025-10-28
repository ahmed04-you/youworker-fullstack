# Guida allo Sviluppo di YouWorker

Guida per sviluppatori che contribuiscono al progetto YouWorker.

---

## Indice

1. [Setup Ambiente di Sviluppo](#setup-ambiente-di-sviluppo)
2. [Struttura del Progetto](#struttura-del-progetto)
3. [Sviluppo Backend](#sviluppo-backend)
4. [Sviluppo Frontend](#sviluppo-frontend)
5. [Sviluppo MCP Server](#sviluppo-mcp-server)
6. [Testing](#testing)
7. [Debugging](#debugging)
8. [Best Practices](#best-practices)
9. [Code Style](#code-style)
10. [Workflow Git](#workflow-git)

---

## Setup Ambiente di Sviluppo

### Prerequisiti

```bash
# Python 3.11+
python3 --version

# Node.js 20+
node --version
npm --version

# Poetry (Python package manager)
curl -sSL https://install.python-poetry.org | python3 -

# Git
git --version
```

### Clone e Setup

```bash
# Clone repository
git clone https://github.com/youco/youworker-fullstack.git
cd youworker-fullstack

# Setup Python environment
poetry install

# Setup Node environment
cd apps/frontend
npm install
cd ../..

# Copia .env per sviluppo
cp .env.example .env
# Modifica .env con configurazione sviluppo
```

### Configurazione IDE

#### VS Code (Consigliato)

Installa estensioni:
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "ms-python.black-formatter",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
  ]
}
```

Settings (`.vscode/settings.json`):
```json
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### PyCharm

1. Apri progetto
2. File → Settings → Project → Python Interpreter
3. Seleziona Poetry environment
4. Abilita Black formatter
5. Abilita ESLint per frontend

---

## Struttura del Progetto

```
youworker-fullstack/
├── apps/                       # Applicazioni
│   ├── api/                   # Backend FastAPI
│   │   ├── main.py           # Entry point ASGI
│   │   ├── routers/          # API endpoints
│   │   ├── middleware/       # Custom middleware
│   │   ├── services/         # Business logic
│   │   └── utils/            # Utilità
│   │
│   ├── frontend/              # Frontend Next.js
│   │   ├── src/
│   │   │   ├── app/          # Next.js App Router
│   │   │   ├── features/     # Feature modules
│   │   │   ├── components/   # UI components
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── lib/          # Utilities
│   │   │   └── services/     # API clients
│   │   ├── public/           # Static assets
│   │   └── tests/            # Tests
│   │
│   └── mcp_servers/           # Server MCP
│       ├── web/              # Web tools
│       ├── semantic/         # Semantic search
│       ├── datetime/         # Date/time utilities
│       ├── ingest/           # Document ingestion
│       └── units/            # Unit conversion
│
├── packages/                  # Pacchetti Python condivisi
│   ├── common/               # Settings, config
│   ├── db/                   # Database models & CRUD
│   ├── vectorstore/          # Qdrant client
│   ├── llm/                  # Ollama client
│   ├── mcp/                  # MCP protocol
│   ├── agent/                # Agent loop
│   ├── parsers/              # Document parsers
│   └── ingestion/            # Ingestion pipeline
│
├── ops/                       # Operations
│   ├── compose/              # Docker Compose
│   ├── docker/               # Dockerfiles
│   ├── alembic/              # DB migrations
│   └── scripts/              # Utility scripts
│
├── tests/                     # Test Python
├── docs/                      # Documentazione
├── pyproject.toml            # Python config
├── Makefile                  # Common commands
└── .env.example              # Environment template
```

---

## Sviluppo Backend

### Avvio in Locale

```bash
# Attiva environment Poetry
poetry shell

# Avvia database e servizi dipendenti
docker compose -f ops/compose/docker-compose.yml up -d postgres qdrant ollama

# Avvia API in modalità reload
cd apps/api
uvicorn main:app --reload --port 8001

# Oppure con il Makefile
make dev-api
```

### Creazione Nuovo Endpoint

1. **Definisci modelli Pydantic** (`apps/api/models/`):

```python
# apps/api/models/example.py
from pydantic import BaseModel, Field

class ExampleRequest(BaseModel):
    name: str = Field(..., description="Nome esempio")
    value: int = Field(gt=0, description="Valore positivo")

class ExampleResponse(BaseModel):
    id: int
    name: str
    value: int
    created_at: datetime
```

2. **Crea router** (`apps/api/routers/`):

```python
# apps/api/routers/example.py
from fastapi import APIRouter, Depends, HTTPException
from packages.db.crud import examples as crud_examples
from models.example import ExampleRequest, ExampleResponse
from middleware.auth import get_current_user

router = APIRouter(prefix="/v1/examples", tags=["examples"])

@router.get("/", response_model=list[ExampleResponse])
async def list_examples(
    skip: int = 0,
    limit: int = 100,
    user = Depends(get_current_user)
):
    """Lista tutti gli esempi."""
    return await crud_examples.get_multi(skip=skip, limit=limit)

@router.post("/", response_model=ExampleResponse, status_code=201)
async def create_example(
    data: ExampleRequest,
    user = Depends(get_current_user)
):
    """Crea nuovo esempio."""
    return await crud_examples.create(data=data, user_id=user.id)

@router.get("/{example_id}", response_model=ExampleResponse)
async def get_example(
    example_id: int,
    user = Depends(get_current_user)
):
    """Recupera esempio per ID."""
    example = await crud_examples.get(id=example_id)
    if not example:
        raise HTTPException(status_code=404, detail="Example not found")
    return example
```

3. **Registra router in main.py**:

```python
# apps/api/main.py
from routers import example

app.include_router(example.router)
```

4. **Implementa CRUD** (`packages/db/crud/`):

```python
# packages/db/crud/examples.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from packages.db.models import Example

async def get(db: AsyncSession, *, id: int) -> Example | None:
    result = await db.execute(select(Example).where(Example.id == id))
    return result.scalars().first()

async def get_multi(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> list[Example]:
    result = await db.execute(
        select(Example).offset(skip).limit(limit)
    )
    return result.scalars().all()

async def create(db: AsyncSession, *, data: ExampleRequest, user_id: int) -> Example:
    example = Example(
        name=data.name,
        value=data.value,
        user_id=user_id
    )
    db.add(example)
    await db.commit()
    await db.refresh(example)
    return example
```

### Database Migrations

```bash
# Crea nuova migration
cd ops/alembic
alembic revision --autogenerate -m "Add example table"

# Applica migration
alembic upgrade head

# Rollback
alembic downgrade -1

# Storia migrations
alembic history
```

### Aggiungere Dipendenze

```bash
# Python (backend/MCP)
poetry add <package>
poetry add --group dev <dev-package>

# Aggiorna lock file
poetry lock

# Installa
poetry install
```

---

## Sviluppo Frontend

### Avvio in Locale

```bash
cd apps/frontend

# Installa dipendenze
npm install

# Avvia dev server
npm run dev

# Oppure con Makefile
make dev-frontend
```

Dev server: `http://localhost:3000`

### Creazione Nuovo Feature Module

Esempio: Creare feature "Tasks"

1. **Struttura directory**:

```bash
mkdir -p src/features/tasks/{components,hooks,stores,types}
```

2. **Definisci tipi TypeScript**:

```typescript
// src/features/tasks/types/index.ts
export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
}
```

3. **Crea Zustand store**:

```typescript
// src/features/tasks/stores/useTasksStore.ts
import { create } from 'zustand';
import { Task } from '../types';

interface TasksStore {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  removeTask: (id: number) => void;
}

export const useTasksStore = create<TasksStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({
    tasks: [...state.tasks, task]
  })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(t =>
      t.id === id ? { ...t, ...updates } : t
    )
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id)
  }))
}));
```

4. **Crea custom hook con TanStack Query**:

```typescript
// src/features/tasks/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Task, CreateTaskInput } from '../types';
import { useTasksStore } from '../stores/useTasksStore';

export function useTasks() {
  const queryClient = useQueryClient();
  const setTasks = useTasksStore(state => state.setTasks);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get<Task[]>('/v1/tasks');
      setTasks(response.data);
      return response.data;
    }
  });

  const createTask = useMutation({
    mutationFn: (data: CreateTaskInput) =>
      api.post<Task>('/v1/tasks', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      useTasksStore.getState().addTask(data);
    }
  });

  const toggleTask = useMutation({
    mutationFn: (id: number) =>
      api.patch<Task>(`/v1/tasks/${id}/toggle`),
    onMutate: async (id) => {
      // Optimistic update
      useTasksStore.getState().updateTask(id, {
        completed: !tasks?.find(t => t.id === id)?.completed
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  return {
    tasks,
    isLoading,
    createTask: createTask.mutate,
    toggleTask: toggleTask.mutate
  };
}
```

5. **Crea componente UI**:

```typescript
// src/features/tasks/components/TaskList.tsx
'use client';

import { useTasks } from '../hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function TaskList() {
  const { tasks, isLoading, toggleTask } = useTasks();

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-2">
      {tasks?.map(task => (
        <div key={task.id} className="flex items-center gap-2">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => toggleTask(task.id)}
          />
          <span className={task.completed ? 'line-through' : ''}>
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}
```

6. **Usa in pagina**:

```typescript
// src/app/tasks/page.tsx
import { TaskList } from '@/features/tasks/components/TaskList';

export default function TasksPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Le Mie Attività</h1>
      <TaskList />
    </div>
  );
}
```

### Aggiungere Dipendenze

```bash
cd apps/frontend

# Produzione
npm install <package>

# Sviluppo
npm install --save-dev <package>

# Aggiorna pacchetti
npm update
```

---

## Sviluppo MCP Server

### Struttura MCP Server

```
apps/mcp_servers/<name>/
├── <name>/
│   ├── __init__.py
│   ├── server.py          # Entrypoint WebSocket
│   ├── tools/             # Tool implementations
│   │   ├── __init__.py
│   │   ├── tool1.py
│   │   └── tool2.py
│   └── utils/             # Utilities
├── pyproject.toml
└── tests/
```

### Creare Nuovo Tool

1. **Implementa tool**:

```python
# apps/mcp_servers/example/example/tools/my_tool.py
from typing import Any
from pydantic import BaseModel, Field

class MyToolInput(BaseModel):
    """Input schema per my_tool."""
    param1: str = Field(..., description="Primo parametro")
    param2: int = Field(default=10, description="Secondo parametro opzionale")

async def my_tool(arguments: dict[str, Any]) -> dict[str, Any]:
    """
    Descrizione del tool che l'LLM vede.

    Args:
        arguments: Dictionary con parametri validati

    Returns:
        Dictionary con risultati tool

    Raises:
        ValueError: Se parametri non validi
    """
    # Valida input
    input_data = MyToolInput(**arguments)

    # Logica tool
    result = f"Elaborato: {input_data.param1} con {input_data.param2}"

    # Ritorna risultato in formato MCP
    return {
        "content": [
            {
                "type": "text",
                "text": result
            }
        ]
    }

# Metadata per discovery
MY_TOOL_SCHEMA = {
    "name": "my_tool",
    "description": "Breve descrizione del tool",
    "inputSchema": MyToolInput.model_json_schema()
}
```

2. **Registra tool nel server**:

```python
# apps/mcp_servers/example/example/server.py
from tools.my_tool import my_tool, MY_TOOL_SCHEMA

TOOLS = {
    "my_tool": {
        "handler": my_tool,
        "schema": MY_TOOL_SCHEMA
    }
}
```

3. **Testa tool**:

```python
# apps/mcp_servers/example/tests/test_my_tool.py
import pytest
from example.tools.my_tool import my_tool

@pytest.mark.asyncio
async def test_my_tool_success():
    result = await my_tool({
        "param1": "test",
        "param2": 20
    })

    assert "content" in result
    assert len(result["content"]) > 0
    assert "Elaborato: test con 20" in result["content"][0]["text"]

@pytest.mark.asyncio
async def test_my_tool_validation_error():
    with pytest.raises(ValueError):
        await my_tool({"param2": 20})  # Manca param1 required
```

### Avvio MCP Server Locale

```bash
# Attiva environment
poetry shell

# Avvia server MCP
cd apps/mcp_servers/example
python -m example.server

# Oppure con Makefile
make dev-mcp-example
```

---

## Testing

### Backend Tests (pytest)

```bash
# Tutti i test
pytest

# Test specifico
pytest tests/test_api/test_chat.py

# Con coverage
pytest --cov=apps/api --cov=packages

# Verbose
pytest -v

# Stop al primo fallimento
pytest -x
```

**Esempio test**:

```python
# tests/test_api/test_chat.py
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_create_chat_session(auth_headers):
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/v1/chat/new",
            headers=auth_headers,
            json={"title": "Test Session"}
        )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Session"
    assert "external_id" in data
```

### Frontend Tests (Vitest)

```bash
cd apps/frontend

# Unit tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage

# UI mode
npm test -- --ui
```

**Esempio test**:

```typescript
// src/features/tasks/hooks/useTasks.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from './useTasks';

describe('useTasks', () => {
  it('fetches tasks successfully', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: any) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tasks).toBeDefined();
    expect(Array.isArray(result.current.tasks)).toBe(true);
  });
});
```

### E2E Tests (Playwright)

```bash
cd apps/frontend

# Installa Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# UI mode
npm run test:e2e -- --ui

# Debug mode
npm run test:e2e -- --debug
```

**Esempio test**:

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test('should create new chat session', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Login
    await page.fill('[name="apiKey"]', process.env.TEST_API_KEY!);
    await page.click('button[type="submit"]');

    // Crea nuova chat
    await page.click('text=Nuova Chat');
    await page.fill('[placeholder="Scrivi un messaggio"]', 'Ciao!');
    await page.click('button[aria-label="Invia"]');

    // Verifica risposta
    await expect(page.locator('.message-assistant')).toBeVisible({
      timeout: 30000
    });
  });
});
```

---

## Debugging

### Backend Debugging (VS Code)

`.vscode/launch.json`:

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
        "main:app",
        "--reload",
        "--port",
        "8001"
      ],
      "jinja": true,
      "justMyCode": false,
      "cwd": "${workspaceFolder}/apps/api"
    }
  ]
}
```

### Frontend Debugging (VS Code)

```json
{
  "name": "Next.js: debug",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceFolder}/apps/frontend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "console": "integratedTerminal",
  "serverReadyAction": {
    "pattern": "started server on .+, url: (https?://.+)",
    "uriFormat": "%s",
    "action": "debugWithChrome"
  }
}
```

### Log Debugging

```python
# Backend
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Debug info: {variable}")
logger.info("Info message")
logger.warning("Warning!")
logger.error("Error!", exc_info=True)
```

```typescript
// Frontend
console.log('Debug:', variable);
console.error('Error:', error);
```

---

## Best Practices

### Backend

1. **Async/await everywhere**: Usa async per I/O
2. **Type hints**: Sempre type hints Python
3. **Pydantic validation**: Valida input con Pydantic
4. **Error handling**: Gestisci errori con HTTPException
5. **Dependency injection**: Usa Depends() di FastAPI
6. **Documentation**: Docstring Google style
7. **Security**: Sanitizza input, valida permessi

### Frontend

1. **TypeScript strict**: Nessun `any`, tutto tipato
2. **Component composition**: Componenti piccoli e riutilizzabili
3. **Custom hooks**: Estrai logica in hooks
4. **Accessibility**: ARIA labels, keyboard navigation
5. **Error boundaries**: Gestisci errori React
6. **Loading states**: Sempre feedback visivo
7. **Optimistic updates**: UX reattiva

### MCP Server

1. **Tool description**: Descrizione chiara per LLM
2. **Input validation**: Pydantic schemas
3. **Error messages**: Messaggi utili per debugging
4. **Idempotency**: Tool idempotenti quando possibile
5. **Timeout handling**: Gestisci timeout lunghi
6. **Rate limiting**: Proteggi API esterne

---

## Code Style

### Python (Black + Flake8)

```bash
# Format
black .

# Lint
flake8 apps/ packages/ tests/

# Type check
mypy apps/ packages/
```

**pyproject.toml**:
```toml
[tool.black]
line-length = 88
target-version = ['py311']

[tool.flake8]
max-line-length = 88
extend-ignore = E203, W503
```

### TypeScript (Prettier + ESLint)

```bash
cd apps/frontend

# Format
npm run format

# Lint
npm run lint

# Type check
npm run type-check
```

**.prettierrc**:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

## Workflow Git

### Branch Strategy

```
main                    # Produzione (protetto)
├── develop             # Sviluppo (default)
│   ├── feature/xxx    # Nuove feature
│   ├── fix/xxx        # Bug fix
│   └── refactor/xxx   # Refactoring
└── hotfix/xxx         # Fix urgenti produzione
```

### Commit Convention

```
feat: Aggiungi nuovo endpoint chat
fix: Correggi memory leak WebSocket
refactor: Riorganizza struttura MCP server
docs: Aggiorna guida installazione
test: Aggiungi test per ingestion
chore: Aggiorna dipendenze
```

### Pull Request Process

1. **Crea branch**:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

2. **Sviluppa e testa**:
```bash
# Commit frequenti
git add .
git commit -m "feat: implement X"

# Test
make test
```

3. **Push e PR**:
```bash
git push origin feature/my-feature
# Apri PR su GitHub/GitLab
```

4. **Code review**:
- Almeno 1 approval richiesto
- CI deve passare
- Coverage >80%

5. **Merge**:
- Squash commits
- Delete branch dopo merge

---

## Risorse Utili

### Documentazione Tecnica

- **FastAPI**: https://fastapi.tiangolo.com/
- **Next.js**: https://nextjs.org/docs
- **TanStack Query**: https://tanstack.com/query/latest
- **Zustand**: https://docs.pmnd.rs/zustand
- **Radix UI**: https://www.radix-ui.com/
- **MCP**: https://modelcontextprotocol.io/

### Strumenti

- **VS Code**: Editor consigliato
- **Postman**: Test API REST
- **Insomnia**: Alternative a Postman
- **WebSocket King**: Test WebSocket
- **React DevTools**: Debug React
- **Redux DevTools**: Inspect Zustand stores

---

## Supporto Sviluppatori

**Canali interni YouCo:**
- Slack: #youworker-dev
- Wiki: https://wiki.youco.it/youworker
- GitLab: https://gitlab.youco.it/youworker

**Contatti:**
- Lead Dev: dev-lead@youco.it
- Team: dev-team@youco.it

---

**Happy coding!** 🚀
