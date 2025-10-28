# Frontend Refactor Prompt

You are tasked with refactoring the YouWorker frontend so the chat experience feels fast, consistent, and production‑ready across devices. Apply the following modifications:

1. **Stabilize architecture**
   - Adopt a single source of truth for chat state in `features/chat` (prefer Zustand with selectors and derived helpers). Remove the duplicate reducer hook once parity is reached.
   - Move session/analytics/documents data fetching to typed service modules and expose React Query hooks for caching, background refresh, and optimistic updates.
   - Replace page-level monoliths (e.g., `src/app/page.tsx`) with thin route components that compose new feature slices. Introduce an `AppShell` layout that owns sidebar/header/insight slots.

2. **Modularize chat**
   - Split conversation into `SessionSidebar`, `ConversationPane`, `Composer`, and `InsightsPanel` components that consume the new chat hooks. Ensure streaming handlers live inside hooks/actions—UI should only render.
   - Make `MessageList` a `forwardRef` that accepts memoized DTOs for smooth streaming. Ensure `updateMessage` and other mutators work with type-safe payloads (no string overloads).
   - Add mobile-friendly affordances: slide-over session list, pull-up insights drawer, persistent “scroll to latest” chip, and voice controls that degrade gracefully when audio is unavailable.

3. **Upgrade the UI kit and flows**
   - Replace free-form `Input` fields for model/language with select components, add inline rename sheets instead of `window.prompt`, and adopt reusable confirmation/toast patterns.
   - Normalize cards, tables, and analytics charts with shared primitives (pagination, sorting, skeleton placeholders, error states). Remove redundant backdrop blur usage and respect `prefers-reduced-motion`.
   - Improve accessibility: focus outlines, aria labels, keyboard ordering, and announce streaming status changes through screen-reader friendly components.

4. **Polish & validation**
   - Implement optimistic updates for session creation/rename/delete and show background refresh status in the UI.
   - Add Playwright coverage for the primary chat flow, session management, document uploads, and analytics filters. Back critical hooks with Vitest to prevent regressions.
   - Document the new feature-module structure and coding conventions in `/apps/frontend/README.md`, including migration guidance for future pages.

Deliver the refactor iteratively, maintaining passing tests at each step, and keep commits scoped per feature area.
