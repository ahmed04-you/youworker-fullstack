# Contributing to YouWorker.AI Frontend

Thanks for helping improve the YouWorker.AI experience. This guide captures the expectations for adding features, fixing bugs, and keeping quality high across the Next.js frontend.

## Getting Started
- Use Node 20+ and npm (see `apps/frontend/package.json` for versions).
- Install dependencies: `cd apps/frontend && npm install`.
- Copy environment files (`.env.example → .env`) and start the stack with `make compose-up`.
- Run `npm run dev` from `apps/frontend` to work on the frontend in isolation.

## Project Structure
- Feature modules live in `apps/frontend/src/features/<feature>` with `api/`, `components/`, `hooks/`, and `types.ts`.
- Cross-cutting utilities:
  - UI primitives: `apps/frontend/src/components/ui/`
  - Reusable components (CommandPalette, HelpModal, etc.): `apps/frontend/src/components/`
  - Hooks: `apps/frontend/src/hooks/`
  - Library helpers (API client, toast utilities, shortcuts): `apps/frontend/src/lib/`
- Route files under `src/app` should remain composition-only; move stateful logic into feature layers.

## Coding Standards
- TypeScript runs in strict mode. Avoid `any`; prefer explicit interfaces for API data.
- Follow the existing ESLint config: `npm run lint` (or `make lint-frontend`) before submitting.
- Honour React best practices:
  - Prefer functional components.
  - Memoise heavy components with `React.memo` when props are stable.
  - Co-locate derived selectors alongside Zustand stores.
- Keep UI accessible: provide ARIA labels, keyboard interactions, 44×44px touch targets on mobile, and use `Tooltip` for icon buttons.
- Prefer toast helpers from `@/lib/toast-helpers` for async feedback—do not call `sonner` directly.

## Testing
- Unit tests (Vitest): `npm test`
- Coverage run: `npm run test:coverage`
- UI component tests live adjacent to the code (`*.test.ts(x)`).
- Playwright E2E tests: `npm run test:e2e` (requires the app running locally).
- Add regression coverage for new hooks, utilities, or async flows. Prefer mocking API calls rather than hitting the network.

## Commit & PR Process
- Use descriptive commit messages; squash locally if you need to tidy history.
- Update documentation (`README.md`, in-app docs, changelogs) when behaviour shifts.
- Keep PRs focused—split unrelated refactors into follow-up branches.
- Cross-check design polish (spacing, theme variants) in both light and dark modes.
- When touching shared hooks/components, add or update stories/tests as needed.

## PR Checklist
- [ ] Lint (`npm run lint`) and type-check (`npm run type-check`) pass.
- [ ] Unit tests (`npm test`) pass locally; relevant Playwright suites updated or skipped with rationale.
- [ ] Toast notifications use `@/lib/toast-helpers`.
- [ ] New components respect accessibility guidelines and mobile touch targets.
- [ ] Documentation updated (README, changelog, or inline JSDoc as appropriate).
- [ ] Screenshots refreshed if the UI meaningfully changes.

Welcome aboard! Open a draft PR early if you want feedback or need architectural guidance.
