# Frontend Architecture Documentation

## Overview

The YouWorker.AI frontend is a Next.js 14+ application built with React, TypeScript, and TailwindCSS. It follows a feature-based architecture pattern with clear separation of concerns, type safety, and optimized performance.

## Table of Contents

- [Architecture Principles](#architecture-principles)
- [Directory Structure](#directory-structure)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [Key Patterns](#key-patterns)
- [Testing Strategy](#testing-strategy)

## Architecture Principles

1. **Feature-Based Organization**: Code organized by feature/domain rather than technical layer
2. **Type Safety**: Strict TypeScript configuration with comprehensive type definitions
3. **Performance**: React.memo, lazy loading, code splitting, and optimistic updates
4. **Accessibility**: WCAG AA compliance with ARIA labels, keyboard navigation, and proper contrast
5. **Mobile-First**: Responsive design with mobile-specific components and gestures
6. **Error Resilience**: Error boundaries, comprehensive error handling, and user feedback

## Directory Structure

```
apps/frontend/src/
├── app/                        # Next.js App Router pages
│   ├── analytics/             # Analytics dashboard page
│   ├── chat/                  # Chat interface page (default route)
│   ├── documents/             # Document management page
│   ├── sessions/              # Chat sessions page
│   ├── settings/              # User settings page
│   ├── layout.tsx             # Root layout with providers
│   ├── page.tsx               # Home page (redirects to /chat)
│   └── globals.css            # Global styles and CSS variables
│
├── features/                   # Feature-based modules
│   ├── chat/                  # Chat feature
│   │   ├── components/        # Chat-specific components
│   │   │   ├── ChatComposer.tsx
│   │   │   ├── ChatHeader.tsx
│   │   │   ├── ConversationPane.tsx
│   │   │   ├── InsightsPanel.tsx
│   │   │   ├── MessageList.tsx
│   │   │   └── SessionSidebar.tsx
│   │   ├── hooks/             # Chat-specific hooks
│   │   │   ├── useChatController.ts
│   │   │   ├── useMessageStream.ts
│   │   │   └── useAutoScroll.ts
│   │   ├── api/               # Chat API calls
│   │   │   └── session-service.ts
│   │   ├── store/             # Chat state management
│   │   │   └── useChatStore.ts
│   │   └── types.ts           # Chat type definitions
│   │
│   ├── documents/             # Document management feature
│   │   ├── components/        # Document-specific components
│   │   │   ├── DocumentCard.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   └── UploadDialog.tsx
│   │   ├── hooks/             # Document-specific hooks
│   │   │   ├── useDocumentUpload.ts
│   │   │   ├── useDocumentSelection.ts
│   │   │   └── useFileValidation.ts
│   │   ├── api/               # Document API calls
│   │   │   └── document-service.ts
│   │   └── store/             # Document state
│   │       └── useDocumentStore.ts
│   │
│   └── analytics/             # Analytics feature
│       ├── components/        # Analytics components
│       │   ├── AnalyticsDashboard.tsx
│       │   ├── MetricCard.tsx
│       │   └── ExportButton.tsx
│       └── hooks/             # Analytics hooks
│           └── useAnalyticsData.ts
│
├── components/                # Shared components
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   └── ...
│   ├── providers/             # React context providers
│   │   └── theme-provider.tsx
│   ├── dialogs/               # Shared dialog components
│   │   ├── HelpModal.tsx
│   │   ├── WelcomeDialog.tsx
│   │   └── OnboardingManager.tsx
│   └── loading/               # Loading states
│       └── LoadingSkeleton.tsx
│
├── hooks/                     # Shared custom hooks
│   ├── useKeyboardShortcut.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useHapticFeedback.ts
│   ├── useOnboarding.ts
│   └── useOptimisticUpdate.ts
│
├── lib/                       # Utilities and helpers
│   ├── api/                   # API client and configuration
│   │   ├── client.ts          # Base API client
│   │   └── types.ts           # API type definitions
│   ├── utils/                 # Utility functions
│   │   ├── cn.ts              # Class name utility
│   │   ├── toast-helpers.ts   # Standardized toast notifications
│   │   └── shortcut-utils.ts  # Keyboard shortcut utilities
│   ├── schemas/               # Zod schemas for validation
│   ├── export/                # Data export utilities
│   └── types.ts               # Shared type definitions
│
├── stores/                    # Global state stores
│   ├── useSettingsStore.ts    # User settings (theme, shortcuts, etc.)
│   └── useAuthStore.ts        # Authentication state
│
└── test/                      # Test utilities and configuration
    ├── test-utils.tsx         # Custom render with providers
    └── setup.ts               # Vitest setup
```

## Component Hierarchy

### Main Application Structure

```
RootLayout
├── Providers (Theme, Query)
├── ErrorBoundary
└── Page Routes
    ├── ChatPage (/chat)
    │   ├── SessionSidebar
    │   ├── ConversationPane
    │   │   ├── ChatHeader
    │   │   ├── MessageList
    │   │   └── ChatComposer
    │   ├── InsightsPanel (desktop)
    │   └── MobileInsightsDrawer (mobile)
    │
    ├── DocumentsPage (/documents)
    │   ├── DocumentList
    │   └── UploadDialog
    │
    ├── AnalyticsPage (/analytics)
    │   └── AnalyticsDashboard
    │       ├── MetricCard
    │       └── ExportButton
    │
    └── SettingsPage (/settings)
        └── Settings sections
```

### Key Component Relationships

```
ChatPage
│
├── SessionSidebar (Left)
│   ├── SessionList
│   ├── NewSessionButton
│   └── KnowledgeHubLink
│
├── ConversationPane (Center)
│   ├── ChatHeader
│   │   ├── ModelSelector
│   │   └── ToolToggle
│   ├── MessageList
│   │   └── Message[]
│   │       ├── UserMessage
│   │       ├── AssistantMessage
│   │       └── ToolMessage
│   └── ChatComposer (Sticky bottom)
│       ├── Textarea
│       ├── ToolsToggle
│       ├── AudioToggle
│       ├── VoiceRecorder
│       └── SendButton
│
└── InsightsPanel (Right, desktop only)
    ├── ToolTimeline
    ├── ReasoningTrace
    ├── VoiceCapture
    └── SystemHealth
```

## Data Flow

### Request-Response Flow

```
User Interaction
    ↓
Component (UI State)
    ↓
Event Handler
    ↓
Custom Hook (Business Logic)
    ↓
API Client (Network Layer)
    ↓
Backend API
    ↓
Response Processing
    ↓
State Update (Zustand/React Query)
    ↓
Component Re-render
    ↓
User Feedback (UI Update/Toast)
```

### Chat Message Flow

```
1. User types message in ChatComposer
2. ChatComposer calls onSendText prop
3. ConversationPane's useChatController hook:
   - Creates optimistic message
   - Updates UI immediately
   - Calls API via session-service
4. Backend streams response (SSE)
5. useMessageStream hook:
   - Receives chunks
   - Updates message incrementally
   - Handles tool calls
6. On completion:
   - Finalizes message
   - Updates session metadata
   - Triggers auto-scroll
7. On error:
   - Rolls back optimistic update
   - Shows error toast
   - Allows retry
```

### Document Upload Flow

```
1. User selects file in UploadDialog
2. useDocumentUpload hook:
   - Validates file (size, type, duplicates)
   - Creates optimistic document entry
   - Shows progress toast
3. API call to document-service:
   - Uploads with FormData
   - Tracks upload progress
4. On success:
   - Updates document list
   - Shows success toast
   - Refreshes document store
5. On error:
   - Rolls back optimistic update
   - Shows error toast with details
   - Allows retry
```

## State Management

### State Management Strategy

The application uses a hybrid approach:

1. **Server State**: React Query (TanStack Query)
   - API responses
   - Caching and invalidation
   - Automatic refetching
   - Optimistic updates

2. **Global Client State**: Zustand
   - User settings (theme, shortcuts)
   - Chat sessions
   - Document store
   - Authentication state

3. **Local Component State**: React useState/useReducer
   - Form inputs
   - UI toggles
   - Temporary state

### Store Examples

#### Chat Store (Zustand)
```typescript
// Manages chat sessions and active session
useChatStore
├── sessions: ChatSession[]
├── activeSessionId: number | null
├── addSession()
├── deleteSession()
├── renameSession()
└── setActiveSession()
```

#### Settings Store (Zustand + localStorage)
```typescript
// Persists user preferences
useSettingsStore
├── theme: 'light' | 'dark'
├── shortcuts: Record<string, string>
├── hapticEnabled: boolean
├── updateTheme()
└── updateShortcuts()
```

## API Integration

### API Client Architecture

```typescript
// Base client configuration
lib/api/client.ts
├── axios instance
├── Base URL from env
├── Default headers
├── Request interceptors
├── Response interceptors
└── Error handling

// Feature-specific services
features/*/api/*-service.ts
├── Type-safe request functions
├── Response transformation
├── Error mapping
└── Request/response types
```

### API Patterns

1. **Standard CRUD Operations**
   ```typescript
   // GET /api/sessions
   export async function getSessions(): Promise<ChatSession[]>

   // POST /api/sessions
   export async function createSession(data: CreateSessionDto): Promise<ChatSession>

   // PUT /api/sessions/:id
   export async function updateSession(id: number, data: UpdateSessionDto): Promise<ChatSession>

   // DELETE /api/sessions/:id
   export async function deleteSession(id: number): Promise<void>
   ```

2. **Streaming Responses** (Server-Sent Events)
   ```typescript
   // Chat streaming
   sendMessage() → EventSource → onChunk() → UI update
   ```

3. **File Uploads** (Multipart FormData)
   ```typescript
   // Document upload with progress
   uploadDocument(file, onProgress) → FormData → Progress events
   ```

## Key Patterns

### 1. Optimistic Updates

**Purpose**: Immediate UI feedback before server confirmation

**Pattern**:
```typescript
// 1. Create optimistic entry
const optimisticItem = { id: -Date.now(), ...data, _optimistic: true };
addItem(optimisticItem);

// 2. Make API call
try {
  const result = await apiCall(data);
  // 3. Replace optimistic with real data
  replaceItem(optimisticItem.id, result);
} catch (error) {
  // 4. Rollback on error
  removeItem(optimisticItem.id);
  showError(error);
}
```

**Used in**: Chat messages, document uploads, session creation/deletion

### 2. Custom Hooks for Business Logic

**Purpose**: Separate business logic from presentation

**Pattern**:
```typescript
// Hook encapsulates complex logic
export function useFeature() {
  const [state, setState] = useState();

  const doSomething = useCallback(() => {
    // Complex logic here
  }, [dependencies]);

  return { state, doSomething };
}

// Component stays simple
function Component() {
  const { state, doSomething } = useFeature();
  return <div onClick={doSomething}>{state}</div>;
}
```

**Used in**: Chat controller, document upload, analytics data fetching

### 3. Error Boundaries

**Purpose**: Graceful error handling and fallback UI

**Pattern**:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentThatMightError />
</ErrorBoundary>
```

**Used in**: Root layout, conversation pane, document list

### 4. Loading States

**Purpose**: Clear feedback during async operations

**Pattern**:
```typescript
// Skeleton loading
{isLoading ? <Skeleton /> : <Content />}

// Button loading state
<Button disabled={isLoading}>
  {isLoading ? <Spinner /> : 'Submit'}
</Button>
```

**Used in**: All async operations, page loads, mutations

### 5. Mobile-Specific Components

**Purpose**: Optimized UX for mobile devices

**Pattern**:
```typescript
// Desktop version
<Component className="hidden xl:flex" />

// Mobile version with drawer/sheet
<MobileDrawer className="xl:hidden">
  <Component />
</MobileDrawer>
```

**Used in**: Insights panel, session sidebar, document actions

### 6. Memoization for Performance

**Purpose**: Prevent unnecessary re-renders

**Pattern**:
```typescript
// Memoize expensive components
export const ExpensiveComponent = memo(function ExpensiveComponent(props) {
  // Component logic
});

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(dep);
}, [dep]);

// Memoize computed values
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);
```

**Used in**: Chat composer, message list, document cards

## Testing Strategy

### Testing Pyramid

```
       /\        E2E Tests (Playwright)
      /  \       - User flows
     /    \      - Cross-page interactions
    /------\
   /        \    Integration Tests (Vitest + RTL)
  /          \   - Component interactions
 /            \  - Hook behavior
/--------------\
|              | Unit Tests (Vitest)
|              | - Utilities
|              | - Helpers
|              | - Pure functions
----------------
```

### Test Organization

```
Component tests (*.test.tsx)
├── Rendering tests
├── User interaction tests
├── State management tests
├── Error handling tests
└── Accessibility tests

Hook tests (*.test.ts)
├── Return value tests
├── Callback tests
├── Side effect tests
└── Edge case tests

E2E tests (*.spec.ts)
├── Critical user flows
├── Cross-feature interactions
└── Mobile responsive tests
```

### Test Utilities

```typescript
// Custom render with providers
test-utils.tsx
├── QueryClientProvider
├── ThemeProvider
└── Custom matchers

// Test data factories
test-factories.ts
├── mockChatSession()
├── mockDocument()
└── mockMessage()
```

## Performance Optimizations

### Code Splitting

1. **Route-based**: Automatic with Next.js App Router
2. **Component-based**: `React.lazy()` for heavy components
3. **Library-based**: Dynamic imports for large dependencies

### Rendering Optimizations

1. **React.memo**: Prevent re-renders of expensive components
2. **useMemo**: Cache expensive computations
3. **useCallback**: Stable function references
4. **Virtualization**: Large lists (when needed)

### Network Optimizations

1. **React Query caching**: Reduce redundant requests
2. **Optimistic updates**: Instant UI feedback
3. **Request deduplication**: Prevent duplicate requests
4. **Streaming**: SSE for real-time chat responses

### Asset Optimizations

1. **Image optimization**: Next.js Image component
2. **Font optimization**: next/font with preloading
3. **CSS optimization**: Tailwind purging unused styles

## Accessibility Features

1. **Keyboard Navigation**: Full keyboard support with shortcuts
2. **Screen Readers**: Comprehensive ARIA labels and landmarks
3. **Color Contrast**: WCAG AA compliant (4.5:1 for text, 3:1 for UI)
4. **Focus Management**: Visible focus indicators and logical tab order
5. **Motion**: Respects `prefers-reduced-motion`
6. **Touch Targets**: Minimum 44x44px on mobile
7. **Error Handling**: Clear error messages and recovery paths

## Mobile Considerations

1. **Responsive Layout**: Breakpoint-based (md, lg, xl)
2. **Touch Gestures**: Swipe for drawers, pull-to-refresh
3. **Haptic Feedback**: Vibration for key actions
4. **Sticky Composer**: Always accessible at bottom
5. **Sheet/Drawer UI**: Native-feeling mobile sheets
6. **Touch-friendly**: Large tap targets, proper spacing

## Security Considerations

1. **API Key Storage**: Secure storage, rotation support
2. **XSS Prevention**: React auto-escaping, DOMPurify for HTML
3. **CSRF Protection**: Token-based authentication
4. **Input Validation**: Zod schemas for all forms
5. **Error Messages**: Safe error messages (no sensitive data)

## Future Improvements

1. **Progressive Web App**: Offline support, app install
2. **Web Workers**: Heavy computations off main thread
3. **Service Worker**: Advanced caching strategies
4. **Real-time Collaboration**: WebSocket for multi-user
5. **Advanced Analytics**: User behavior tracking
6. **A11y Testing**: Automated accessibility testing in CI/CD

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [shadcn/ui Components](https://ui.shadcn.com)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
