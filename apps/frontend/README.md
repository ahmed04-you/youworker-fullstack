# Frontend Architecture Guide

## Overview

The frontend application is organised around feature modules under `src/features`. Cross-cutting primitives (UI components, hooks, API clients) continue to live under `src/components`, `src/hooks`, and `src/lib` respectively. Feature modules own their state, data fetching, view components, and expose selectors or hooks to the rest of the app.

Key technology choices:

- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) is used for feature-level state management with derived helpers.
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) handles server data with caching, background refresh, and optimistic updates.
- Shared layout primitives (like `AppShell`) compose feature slices into pages, keeping route components thin.

## Chat Feature Module

All chat functionality has been consolidated under `src/features/chat`. The module exports public primitives via `src/features/chat/index.ts`:

- `useChatStore` – Zustand store with selectors and derived helpers.
- `useChatController` – client-side controller that wires state, React Query hooks, and streaming orchestration.
- `AppShell`, `SessionSidebar`, `ChatHeader`, `ConversationPane`, `InsightsPanel`, `MobileSessionDrawer`, `MobileInsightsDrawer` – presentation components that can be composed by route-level shells.

### State

`src/features/chat/store/chat-store.ts` defines the single source of truth for chat sessions, messages, streaming status, voice state, and UI config. Actions are type-safe and work with partial updates. Selectors are co-located for consistent usage.

### Data Services

`src/features/chat/api/session-service.ts` provides typed fetchers and React Query hooks for session CRUD with optimistic updates. `src/features/chat/api/health-service.ts` handles system health polling. The controllers rely on these hooks to keep store state in sync.

### Presentation

- `AppShell` owns the sidebar/header/insights layout slots.
- `SessionSidebar` and `MobileSessionDrawer` now use dialogs for rename/delete and share behaviour.
- `ConversationPane` renders memoised DTOs through a `MessageList` `forwardRef` for smooth streaming plus a unified `ChatComposer` with dropdowns for model/language.
- `InsightsPanel` is the desktop view, while `MobileInsightsDrawer` exposes the same content via a bottom sheet on small screens.

### Streaming & Voice

`useChatController` owns the streaming lifecycle and voice recording. The composer degrades gracefully when audio APIs are unavailable, and motion-based affordances respect `prefers-reduced-motion`.

## Adding New Features

1. Create a new module under `src/features/<feature>` with:
   - `api/` for service functions and React Query hooks.
   - `components/` for feature-specific UI.
   - `hooks/` for controllers or specialised state.
   - `types.ts` for shared contracts.
2. Export module surface area via `src/features/<feature>/index.ts`.
3. Compose feature slices inside route-level components or shared shells (e.g., `AppShell`).
4. Use existing patterns for optimistic updates, dialogs, and responsive adaptations.

## Migration Notes

- Legacy chat hooks/components under `src/app/_components` and `src/hooks/useChatState.ts` have been removed. Consumers should switch to the module exports described above.
- API clients previously under `src/lib/queries` have moved into feature-specific service modules.
- When creating new pages, prefer composing feature slices, keeping route files declarative (no direct data fetching inside `page.tsx`).

## Testing & Coverage

Playwright suites should live under `apps/frontend/tests/e2e`. Vitest unit tests belong in `src/test` alongside feature modules. (See plan for upcoming additions covering chat flows, session management, and analytics filters.)
