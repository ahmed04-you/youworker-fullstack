# YouWorker.AI

YouWorker.AI is an AI-powered knowledge worker that blends document ingestion, multimodal chat, analytics, and automation on top of a FastAPI backend and a Next.js frontend.

## Features
- **Document workspace** – upload, deduplicate, and manage knowledge sources with optimistic updates and ingestion history.
- **Realtime analytics** – dashboards for usage, tool performance, and ingestion metrics with export to CSV / JSON.
- **Guided chat experience** – multi-model chat with streaming responses, voice capture, tool orchestration, and sample prompts.
- **Onboarding & help** – welcome tour, keyboard shortcut hints, searchable help center, and contextual tooltips across the UI.
- **Accessibility-first UI** – ARIA-labelled components, large touch targets, haptic feedback, color-safe palettes, and keyboard-friendly flows.

## Screenshots
Add screenshots to `apps/frontend/public/screenshots/` to publish alongside the README:

| View | Path suggestion |
| ---- | --------------- |
| Dashboard overview | `apps/frontend/public/screenshots/dashboard.png` |
| Settings hub | `apps/frontend/public/screenshots/settings.png` |
| Analytics deep dive | `apps/frontend/public/screenshots/analytics.png` |

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + K` | Open command palette |
| `?` | Toggle help modal |
| `⌘/Ctrl + N` | Create new session |
| `⌘/Ctrl + Shift + D` | Toggle documents drawer |
| `Esc` | Close active modal or drawer |

## Accessibility Highlights
- Semantic ARIA labels on chat messages, buttons, and navigation landmarks.
- Mobile targets meet the 44×44px WCAG touch area guidance.
- Tooltips, focus rings, and keyboard shortcuts are exposed in the help center.
- Haptic feedback helper (`useHapticFeedback`) respects `prefers-reduced-motion`.
- **Pending:** full color-contrast audit to verify WCAG AA compliance.

## Quick Start

1. Copy `.env.example` to `.env` and populate with your secrets.
2. Run `make build` to build Docker images.
3. Run `make compose-up` to start all services.
4. Access the frontend at `https://localhost:8000`.
5. API docs available at `https://localhost:8001/docs`.

## Development Workflow

- Backend: `make dev-api`
- Frontend: `make dev-frontend` (uses `apps/frontend`)
- Unit tests (Vitest): `cd apps/frontend && npm test`
- Playwright E2E tests: `cd apps/frontend && npm run test:e2e`
- Type checking: `cd apps/frontend && npm run type-check`

## Troubleshooting
- **API key issues:** regenerate keys from Settings → API Keys; the frontend surfaces detailed toast errors.
- **CORS or auth failures:** confirm your `.env` matches backend origins and restart with `make compose-up`.
- **Websocket/stream stalls:** restart the API container; the chat controller handles rollback and surfaces toast notifications.
- **Document upload errors:** check file size/type via the upload toast details; supported formats are validated client-side.

## Architecture

- **API**: FastAPI backend for chat, ingestion, analytics, and websocket streaming.
- **Frontend**: Next.js app with feature-based modules (chat, documents, analytics, settings).
- **MCP Servers**: Pluggable tools for web search, semantic lookup, ingestion, and unit conversion.
- **Storage**: PostgreSQL (metadata) + Qdrant (vectors).
- **LLM Runtime**: Ollama with GPU acceleration.
- **Observability**: Grafana + Prometheus dashboards.

## Testing & Quality
- Optimistic chat/document flows covered by Vitest unit tests (`apps/frontend/src/**/*.test.*`).
- Playwright suites live under `apps/frontend/tests/e2e`.
- Shared toast utilities (`src/lib/toast-helpers.ts`) standardize user feedback across async operations.
- Performance-sensitive chat components (composer, header, sidebars) are memoised to reduce re-renders.

## Contributing
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for coding standards, component patterns, and the PR checklist.

## License

MIT License. See [LICENSE](LICENSE) for details.
