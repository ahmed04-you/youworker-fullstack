# Frontend Direct Run Guide

The frontend now runs **directly on your host machine** (not containerized) for better development experience.

## Prerequisites

- Node.js v20+ installed on your host machine
- Backend services running via Docker Compose

## Quick Start

### 1. Start Backend Services

From the project root, start all backend services:

```bash
cd ops/compose
docker-compose up -d
```

This will start:
- PostgreSQL database
- Qdrant vector store
- Ollama LLM
- All MCP servers (web, semantic, datetime, ingest, units)
- API backend

### 2. Install Frontend Dependencies

```bash
cd apps/frontend
npm install
```

### 3. Configure Environment

The environment is already configured in `.env.local`:

```env
NEXT_PUBLIC_API_KEY=9ffe785f8534d5b6478a9261d66f3784b9498db3b74bc8e5172be157c2548391
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
NEXT_INTERNAL_API_BASE_URL=http://localhost:8001
```

All API requests (both client-side and server-side) go to `http://localhost:8001` which is the API exposed from Docker.

### 4. Start Frontend Dev Server

```bash
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000)

## Benefits of Direct Running

- **Hot reload** works without Docker overhead
- **Faster builds** and module resolution
- **Better debugging** with native source maps
- **Direct file access** for VSCode and other tools
- **Instant updates** when editing code

## Architecture

```
┌─────────────────────────────────────────┐
│  Host Machine (Your Computer)          │
│                                         │
│  ┌────────────────────────────────┐    │
│  │  Frontend (Next.js)            │    │
│  │  Port: 3000                    │    │
│  │  Direct process                │    │
│  └───────────┬────────────────────┘    │
│              │ HTTP to localhost:8001  │
│              ▼                          │
│  ┌──────────────────────────────────┐  │
│  │  Docker Compose Network          │  │
│  │                                  │  │
│  │  ┌─────────────────────┐        │  │
│  │  │  API Backend        │        │  │
│  │  │  Port: 8001:8001    │        │  │
│  │  └─────────────────────┘        │  │
│  │                                  │  │
│  │  ┌─────────┐  ┌────────┐        │  │
│  │  │Postgres │  │Qdrant  │  ...   │  │
│  │  └─────────┘  └────────┘        │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## CORS Configuration

The backend API is configured to allow requests from:
- `http://localhost:3000` (frontend dev server)
- `http://127.0.0.1:3000` (alternative localhost)

These origins are set in the main `.env` file:
```env
FRONTEND_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
```

## Troubleshooting

### Port 3000 already in use
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
PORT=3001 npm run dev
```

### API connection errors
```bash
# Check if backend services are running
docker ps

# Check API health
curl http://localhost:8001/health

# Restart backend services if needed
cd ops/compose
docker-compose restart api
```

### Environment variables not loading
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run dev
```

## Production Build

To create a production build:

```bash
npm run build
npm start
```

The production server will run on port 3000.

## Reverting to Containerized Frontend

If you need to run the frontend in Docker again:

1. Update `.env`:
   ```env
   FRONTEND_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000
   NEXT_INTERNAL_API_BASE_URL=http://api:8001
   ```

2. Update `apps/frontend/.env.local`:
   ```env
   NEXT_INTERNAL_API_BASE_URL=http://api:8001
   ```

3. Add the frontend service back to `ops/compose/docker-compose.yml`

4. Run: `docker-compose up -d frontend`
