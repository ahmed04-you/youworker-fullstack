# Guida per Sviluppatori - YouWorker.AI

## Introduzione

Questa guida è destinata agli sviluppatori che vogliono contribuire al progetto YouWorker.AI o estenderne le funzionalità. Copre l'architettura del sistema, l'ambiente di sviluppo e le best practices.

## Prerequisiti

### Software Richiesto
- **Python 3.11+**: Per il backend
- **Node.js 20+**: Per il frontend
- **Docker e Docker Compose**: Per l'infrastruttura
- **Git**: Per il controllo versione
- **GPU NVIDIA** (opzionale): Per accelerazione modelli

### Conoscenze Consigliate
- Python e framework FastAPI
- React/Next.js e TypeScript
- Concetti di AI/ML e embedding
- Docker e containerizzazione
- WebSocket e comunicazione real-time

## Setup Ambiente Sviluppo

### Clonazione Repository
```bash
git clone <repository-url>
cd youworker-fullstack
```

### Configurazione Ambiente
```bash
# Copia file configurazione
cp .env.example .env

# Modifica .env con le tue preferenze
nano .env
```

### Setup Backend
```bash
# Crea ambiente virtuale
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Installa dipendenze
pip install -r requirements.txt

# Scarica modelli TTS (per modalità voce)
./scripts/download-piper-models.sh
```

### Setup Frontend
```bash
cd apps/frontend

# Installa dipendenze
npm install

# Torna alla root
cd ../..
```

### Avvio Sviluppo Locale
```bash
# Avvia tutti i servizi con Docker Compose
make compose-up

> I container Docker utilizzano immagini con tag stabili ed eseguono i processi come utenti non-root per ridurre i privilegi predefiniti.

# Oppure avvia selettivamente:
# Backend
uvicorn apps.api.main:app --reload --port 8001

# Frontend (in altro terminale)
cd apps/frontend && npm run dev
```

## Architettura del Progetto

### Struttura Directory
```
youworker-fullstack/
├── apps/
│   ├── api/                    # Backend FastAPI
│   ├── frontend/               # Applicazione Next.js
│   └── mcp_servers/            # Servizi MCP
├── packages/
│   ├── agent/                  # Sistema agent
│   ├── llm/                    # Client Ollama
│   ├── mcp/                    # Client MCP
│   ├── ingestion/              # Pipeline documenti
│   ├── vectorstore/            # Wrapper Qdrant
│   ├── db/                     # Modelli database
│   └── common/                 # Utility e settings condivisi tra API e pipeline
├── ops/
│   ├── docker/                 # Dockerfile
│   └── compose/                # Configurazioni Docker
├── docs/                       # Documentazione
├── tests/                      # Suite test
└── data/                       # Dati persistenti
```

### Componenti Backend

Le impostazioni comuni (modelli, origine frontend, percorsi ingest, ecc.) sono definite una sola volta in `packages/common/settings.py` e riutilizzate dall'API tramite `apps/api/config.py`. Il loop agente (`packages/agent/loop.py`) seleziona ora il modello LLM per singola richiesta senza modificare stato globale, rendendo sicura la gestione concorrente delle sessioni.

#### API Routes ([`apps/api/routes/`](apps/api/routes/))
- `chat.py`: Endpoint chat e voce
- `ingestion.py`: Gestione documenti
- `crud.py`: Operazioni database
- `health.py`: Health check
- `analytics.py`: Metriche e statistiche

#### Sistema Agent ([`packages/agent/`](packages/agent/))
- `loop.py`: Loop di esecuzione agent
- `registry.py`: Registry strumenti MCP

#### LLM Integration ([`packages/llm/`](packages/llm/))
- `ollama.py`: Client Ollama con streaming

#### MCP Client ([`packages/mcp/`](packages/mcp/))
- `client.py`: Client WebSocket per MCP

### Componenti Frontend

#### Struttura App ([`apps/frontend/`](apps/frontend/))
- `app/`: Pagine Next.js
- `components/`: Componenti React
- `lib/`: Utility e configurazione
- `hooks/`: Custom hooks React

#### Componenti Principali
- Chat interface con streaming
- Voice recorder e player
- Document ingestion UI
- Analytics dashboard
- Streaming SSE con un unico flush iniziale e heartbeat periodici per mantenere attive le connessioni lente

## Sviluppo Funzionalità

### Aggiungere Nuovi Endpoint API

1. Crea nuovo file in [`apps/api/routes/`](apps/api/routes/)
2. Definisci route con FastAPI:
```python
from fastapi import APIRouter, Depends
from apps.api.auth.security import get_current_active_user

router = APIRouter(prefix="/v1")

@router.post("/nuovo-endpoint")
async def nuovo_endpoint(
    request: RequestModel,
    current_user=Depends(get_current_active_user)
):
    # Logica endpoint
    return {"result": "success"}
```

3. Includi router in [`apps/api/main.py`](apps/api/main.py):
```python
from apps.api.routes import nuovo_file
app.include_router(nuovo_file.router)
```

### Estendere Sistema Agent

#### Nuovo Strumento MCP
1. Crea nuovo server MCP in [`apps/mcp_servers/`](apps/mcp_servers/)
2. Implementa metodi richiesti:
```python
async def list_tools():
    return [
        {
            "name": "nuovo_tool",
            "description": "Descrizione strumento",
            "inputSchema": {...}
        }
    ]

async def call_tool(name, arguments):
    if name == "nuovo_tool":
        # Implementazione logica
        return {"result": "success"}
```

3. Aggiungi configurazione Docker in [`ops/docker/`](ops/docker/)

#### Modifica Comportamento Agent
Modifica [`packages/agent/loop.py`](packages/agent/loop.py) per:
- Aggiungere nuovi tipi di eventi
- Modificare logica di ragionamento
- Estendere gestione strumenti

### Sviluppo Frontend

#### Nuovi Componenti
1. Crea componente in [`apps/frontend/components/`](apps/frontend/components/):
```tsx
import React from 'react';

interface NuovoComponenteProps {
  prop1: string;
  prop2: number;
}

export function NuovoComponente({ prop1, prop2 }: NuovoComponenteProps) {
  return (
    <div>
      {/* JSX componente */}
    </div>
  );
}
```

2. Usa componenti shadcn/ui quando possibile:
```bash
npx shadcn-ui@latest add button
```

#### Nuove Pagine
1. Crea file in [`apps/frontend/app/`](apps/frontend/app/):
```tsx
import { NuovoComponente } from '@/components/nuovo-componente';

export default function NuovaPagina() {
  return (
    <div className="container">
      <NuovoComponente prop1="valore" prop2={42} />
    </div>
  );
}
```

### Gestione Database

#### Nuovi Modelli
1. Definisci modello in [`packages/db/models.py`](packages/db/models.py):
```python
from sqlalchemy import Column, Integer, String
from packages.db.base import Base

class NuovoModel(Base):
    __tablename__ = "nuovi_modelli"
    
    id = Column(Integer, primary_key=True)
    campo = Column(String)
```

2. Crea migrazione:
```bash
alembic revision --autogenerate -m "Add nuovo model"
alembic upgrade head
```

#### Operazioni CRUD
Aggiungi funzioni in [`packages/db/crud.py`](packages/db/crud.py):
```python
async def create_nuovo_model(db: AsyncSession, data: NuovoModelCreate):
    db_model = NuovoModel(**data.dict())
    db.add(db_model)
    await db.commit()
    await db.refresh(db_model)
    return db_model
```

## Testing

### Esecuzione Test
```bash
# Tutti i test
pytest

# Con coverage
pytest --cov=apps --cov=packages --cov-report=html

# Suite specifica
pytest tests/unit/
pytest tests/integration/
pytest tests/e2e/
```

### Scrittura Test

#### Unit Test
```python
import pytest
from packages.agent.loop import AgentLoop

@pytest.mark.asyncio
async def test_agent_loop():
    # Setup
    agent = AgentLoop(mock_client, mock_registry)
    
    # Test
    result = await agent.run_turn(messages)
    
    # Assert
    assert result.requires_followup == expected
```

#### Integration Test
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_chat_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/v1/chat", json={
            "messages": [{"role": "user", "content": "test"}]
        })
    assert response.status_code == 200
```

## Debugging e Troubleshooting

### Logging
Il sistema usa logging strutturato con correlation ID:
```python
import logging

logger = logging.getLogger(__name__)
logger.info("Messaggio informativo")
logger.error("Messaggio di errore", exc_info=True)
```

### Debug Backend
1. Usa breakpoint Python:
```python
import pdb; pdb.set_trace()
```

2. Controlla log container:
```bash
docker-compose logs -f api
```

### Debug Frontend
1. Usa browser dev tools
2. Console.log per debugging:
```tsx
console.log("Debug info", data);
```

3. React DevTools per stato componenti

### Problemi Comuni

**Modelli Ollama non trovati:**
```bash
# Verifica modelli disponibili
docker exec -it ollama ollama list

# Pull manuale modello
docker exec -it ollama ollama pull gpt-oss:20b
```

**Connessioni MCP fallite:**
- Controlla log server MCP
- Verifica configurazione WebSocket
- Controlla health endpoint

**Frontend non si connette:**
- Verifica variabili ambiente
- Controlla CORS configuration
- Verifica API endpoint

## Deployment

### Docker Compose
```bash
# Avvio produzione
docker-compose -f ops/compose/docker-compose.yml up -d

# Scale servizi
docker-compose -f ops/compose/docker-compose.yml up -d --scale api=3
```

### Environment Variables
Configura variabili ambiente per produzione:
- `DATABASE_URL`: PostgreSQL connection
- `OLLAMA_BASE_URL`: Ollama service URL
- `QDRANT_URL`: Vector store URL
- `ROOT_API_KEY`: Authentication key

### Monitoring
- Prometheus metrics: `http://localhost:8001/metrics`
- Grafana dashboard: `http://localhost:3001`
- Health checks: `http://localhost:8001/health`

## Best Practices

### Code Style
- Python: Segui PEP 8, usa Black e Ruff
- TypeScript: Segui ESLint configuration
- Usa type hints ovunque

### Git Workflow
1. Feature branch per nuove funzionalità
2. Pull request con description dettagliata
3. Code review obbligatoria
4. CI/CD per test automatici

### Performance
- Usa async/await per I/O operations
- Implementa caching dove appropriato
- Monitora metriche di performance
- Ottimizza query database

### Sicurezza
- Valida sempre input utente
- Usa prepared statements per SQL
- Implementa rate limiting
- Segui principle of least privilege

## Risorse Utili

### Documentazione
- [FastAPI docs](https://fastapi.tiangolo.com/)
- [Next.js docs](https://nextjs.org/docs)
- [Ollama docs](https://github.com/ollama/ollama)
- [MCP specification](https://modelcontextprotocol.io/)

### Community
- Issues GitHub per bug report
- Discussions per domande
- Wiki per documentazione aggiuntiva

### Tools
- Docker Desktop per container management
- Postman per API testing
- pgAdmin per database management
- Grafana per monitoring
