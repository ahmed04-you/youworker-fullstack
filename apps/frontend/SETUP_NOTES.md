# Frontend Setup Notes

## Issues Resolved

### 1. Permission Errors with .next Directory
**Problem:** The `.next` directory was created with root ownership when the frontend was previously running in Docker, causing permission errors when trying to run it directly.

**Solution:** Used Docker to fix permissions and then removed the directory:
```bash
docker run --rm -v "$(pwd)/.next:/data" alpine sh -c "chmod -R 777 /data"
rm -rf .next
```

### 2. Multiple Lockfiles Warning
**Problem:** Next.js detected lockfiles in both the root directory and apps/frontend directory, causing confusion about the workspace root.

**Status:** Warning still appears but doesn't prevent the dev server from running. Can be safely ignored or fixed by removing the root lockfile if not needed.

### 3. Next.js Configuration
**Changes Made:** Updated `next.config.ts` to specify Turbopack root and use a different dist directory:
```typescript
experimental: {
  turbo: {
    root: process.cwd(),
  },
},
distDir: '.next-dev',
```

## Running the Frontend

### Start Command
```bash
cd apps/frontend
npm run dev
```

The server will be available at:
- Local: http://localhost:3000
- Network: http://192.168.1.179:3000

### Environment Variables
Configured in `.env.local`:
- `NEXT_PUBLIC_API_KEY` - API key for backend authentication
- `NEXT_PUBLIC_API_BASE_URL` - http://localhost:8001
- `NEXT_INTERNAL_API_BASE_URL` - http://localhost:8001

Both client and server-side requests now point to localhost since frontend runs directly.

## Backend Services

Backend services must be running via Docker Compose:
```bash
cd ops/compose
docker-compose up -d
```

This starts:
- API backend (port 8001)
- PostgreSQL (port 5432)
- Qdrant (port 6333)
- Ollama (port 11434)
- All MCP servers (ports 7001-7005)

## CORS Configuration

Backend API allows requests from:
- http://localhost:3000
- http://127.0.0.1:3000

Configured in main `.env` file:
```env
FRONTEND_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
```

## Common Issues

### Port 3000 in use
```bash
lsof -ti:3000 | xargs kill -9
```

### Permission errors after Docker
If you see permission errors again:
```bash
docker run --rm -v "$(pwd)/.next-dev:/data" alpine sh -c "chmod -R 777 /data"
rm -rf .next-dev
```

### Can't connect to API
Check backend is running:
```bash
docker ps
curl http://localhost:8001/health
```

## Next Steps

The frontend is now successfully running directly on the host machine with:
- ✅ Hot reload working
- ✅ Full markdown/HTML rendering with 10fps throttling
- ✅ Floating chat avatars
- ✅ Proper scrolling behavior
- ✅ Stunning glassmorphism effects on chat composer
- ✅ Direct connection to backend services

Ready for development!
