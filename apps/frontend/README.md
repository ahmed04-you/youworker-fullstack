# Frontend YouWorker

Interfaccia web per YouWorker, costruita con Next.js 16, React 19 e TypeScript.

---

## Tecnologie

### Core
- **Next.js 16**: Framework React con App Router
- **React 19**: Libreria UI con ultime funzionalità
- **TypeScript 5**: Type safety completa
- **Tailwind CSS 3.4**: Utility-first CSS framework

### State Management
- **Zustand 5**: State management leggero
- **TanStack Query 5**: Server state e caching
- **React Context**: Providers specializzati

### UI Components
- **Radix UI**: Componenti accessibili headless
- **Lucide React**: Libreria icone
- **Framer Motion**: Animazioni
- **Recharts**: Grafici e visualizzazioni
- **React Hook Form**: Gestione form
- **Zod**: Schema validation

### Testing
- **Vitest**: Unit testing
- **Playwright**: End-to-end testing
- **Testing Library**: Component testing

---

## Struttura Directory

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Layout radice
│   ├── page.tsx                 # Homepage
│   ├── chat/                    # Pagine chat
│   ├── documents/               # Pagine documenti
│   ├── analytics/               # Pagine analytics
│   ├── sessions/                # Storico sessioni
│   ├── settings/                # Impostazioni
│   └── globals.css              # Stili globali
│
├── features/                    # Feature modules
│   ├── chat/
│   │   ├── components/         # Componenti chat
│   │   ├── hooks/              # Custom hooks
│   │   ├── stores/             # Zustand stores
│   │   └── types/              # TypeScript types
│   ├── documents/
│   ├── analytics/
│   └── onboarding/
│
├── components/                  # Componenti condivisi
│   ├── ui/                     # Radix UI wrappers
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── dialogs/                # Modal dialogs
│   ├── layouts/                # Layout components
│   └── providers/              # Context providers
│
├── hooks/                       # Hooks globali
│   ├── useAuth.ts
│   ├── useTheme.ts
│   └── useKeyboard.ts
│
├── lib/                         # Utilities
│   ├── api.ts                  # API client
│   ├── utils.ts                # Helper functions
│   └── constants.ts            # Costanti
│
├── services/                    # API services
│   ├── chat.service.ts
│   ├── documents.service.ts
│   └── analytics.service.ts
│
├── types/                       # TypeScript types globali
│   ├── api.ts
│   └── models.ts
│
└── styles/                      # Stili aggiuntivi
```

---

## Setup Sviluppo

### Installazione

```bash
# Installa dipendenze
npm install

# Copia .env.local
cp .env.example .env.local

# Modifica .env.local con configurazione
nano .env.local
```

### Configurazione .env.local

```bash
# API Backend
NEXT_PUBLIC_API_BASE_URL=https://youworker.tuazienda.it:8000

# Ambiente
NODE_ENV=development

# Feature flags (opzionale)
NEXT_PUBLIC_ENABLE_VOICE=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### Avvio Dev Server

```bash
# Sviluppo
npm run dev

# Build produzione
npm run build

# Start produzione
npm start

# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

---

## Architettura Frontend

### App Router (Next.js 16)

YouWorker usa Next.js App Router con:

- **Server Components** (default): SSR per SEO e performance
- **Client Components** (`'use client'`): Per interattività
- **Route Handlers**: API routes per backend proxy
- **Layouts**: Layout condivisi tra pagine
- **Loading States**: `loading.tsx` per suspense
- **Error Boundaries**: `error.tsx` per gestione errori

### Feature-Based Organization

Ogni feature è un modulo autonomo:

```
features/<feature>/
├── components/          # UI components
├── hooks/              # Custom hooks (data fetching, logic)
├── stores/             # Zustand stores (client state)
├── types/              # TypeScript types
└── utils/              # Feature-specific utilities
```

**Vantaggi:**
- Codice organizzato per dominio
- Facile rimozione/aggiunta feature
- Riutilizzo componenti interni
- Testing isolato

### State Management

#### 1. Server State (TanStack Query)

Per dati dal backend:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get('/v1/documents/'),
    staleTime: 5 * 60 * 1000,  // 5 minuti
    refetchOnWindowFocus: true
  });
}
```

**Configurazione:**
```typescript
// app/providers/query-provider.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1
      }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

#### 2. Client State (Zustand)

Per stato UI e cache locale:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'light',
      toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen
      })),
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'ui-storage'  // LocalStorage key
    }
  )
);
```

**Uso:**
```typescript
function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside className={sidebarOpen ? 'open' : 'closed'}>
      <button onClick={toggleSidebar}>Toggle</button>
    </aside>
  );
}
```

#### 3. Context API

Per provider globali:

```typescript
// components/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types/models';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (apiKey: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Carica utente da cookie
    fetchCurrentUser();
  }, []);

  const login = async (apiKey: string) => {
    const response = await api.post('/v1/auth/login', { api_key: apiKey });
    setUser(response.data);
  };

  const logout = async () => {
    await api.post('/v1/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

### API Communication

#### REST API (Axios)

```typescript
// lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,  // Invia cookie
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor per errori
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### WebSocket (Chat Streaming)

```typescript
// features/chat/hooks/useChat.ts
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/useChatStore';

export function useChat(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { addMessage, updateLastMessage } = useChatStore();

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL!
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');

    wsRef.current = new WebSocket(`${baseUrl}/chat/${sessionId}`);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.event) {
        case 'token':
          updateLastMessage(data.data.text);
          break;

        case 'tool':
          // Mostra esecuzione tool
          break;

        case 'done':
          // Finalizza messaggio
          break;

        case 'error':
          console.error('Chat error:', data.data);
          break;
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      wsRef.current?.close();
    };
  }, [sessionId]);

  const sendMessage = (content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content,
        enable_tools: true
      }));

      // Aggiungi messaggio utente a UI immediatamente
      addMessage({
        role: 'user',
        content,
        created_at: new Date().toISOString()
      });
    }
  };

  return { sendMessage };
}
```

---

## Componenti UI

### Radix UI Integration

YouWorker usa Radix UI per componenti accessibili:

```typescript
// components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

**Uso:**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default" size="lg">
  Clicca qui
</Button>

<Button variant="destructive">
  Elimina
</Button>
```

### Tailwind CSS

**Configurazione:**
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
export default config;
```

---

## Testing

### Unit Tests (Vitest)

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm run test:coverage
```

**Esempio:**
```typescript
// features/chat/hooks/useChat.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useChat', () => {
  const wrapper = ({ children }: any) => (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );

  it('should connect to WebSocket', async () => {
    const { result } = renderHook(() => useChat('session-123'), { wrapper });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should send message', async () => {
    const { result } = renderHook(() => useChat('session-123'), { wrapper });

    await waitFor(() => result.current.isConnected);

    result.current.sendMessage('Hello!');

    // Assert message sent
  });
});
```

### E2E Tests (Playwright)

```bash
# Install browsers
npx playwright install

# Run tests
npm run test:e2e

# UI mode
npm run test:e2e -- --ui
```

**Esempio:**
```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Chat functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000');
    await page.fill('[name="apiKey"]', process.env.TEST_API_KEY!);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/chat');
  });

  test('should create new chat and send message', async ({ page }) => {
    // Nuova chat
    await page.click('[aria-label="Nuova chat"]');

    // Invia messaggio
    await page.fill('[placeholder="Scrivi un messaggio"]', 'Ciao!');
    await page.click('[aria-label="Invia messaggio"]');

    // Verifica risposta
    await expect(page.locator('.message-assistant')).toBeVisible({
      timeout: 30000
    });
  });
});
```

---

## Accessibilità (WCAG AA)

YouWorker è progettato per essere accessibile:

### Keyboard Navigation

```typescript
// hooks/useKeyboard.ts
import { useEffect } from 'react';

export function useKeyboard(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = `${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`;
      const handler = shortcuts[key];
      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Uso
function ChatPage() {
  useKeyboard({
    'Ctrl+n': () => createNewChat(),
    'Ctrl+k': () => openCommandPalette(),
    'Escape': () => closeModal()
  });
}
```

### ARIA Labels

```tsx
<button aria-label="Invia messaggio" aria-disabled={isLoading}>
  <SendIcon aria-hidden="true" />
</button>

<input
  type="text"
  aria-label="Cerca documenti"
  aria-describedby="search-help"
/>
<span id="search-help">Inserisci almeno 3 caratteri</span>
```

### Focus Management

```typescript
import { useRef, useEffect } from 'react';

function Modal({ isOpen }: { isOpen: boolean }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <dialog open={isOpen}>
      <button ref={closeButtonRef}>Chiudi</button>
    </dialog>
  );
}
```

---

## Performance

### Code Splitting

```typescript
// Dynamic imports per componenti pesanti
import dynamic from 'next/dynamic';

const AnalyticsDashboard = dynamic(
  () => import('@/features/analytics/components/AnalyticsDashboard'),
  { loading: () => <Spinner />, ssr: false }
);
```

### Image Optimization

```tsx
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="YouWorker Logo"
  width={200}
  height={50}
  priority  // Per above-the-fold images
/>
```

### Caching

```typescript
// TanStack Query cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min
      cacheTime: 10 * 60 * 1000,  // 10 min
      refetchOnWindowFocus: true
    }
  }
});
```

---

## Build & Deploy

### Build Produzione

```bash
# Build
npm run build

# Output in: .next/

# Test build locale
npm start
```

### Docker Build

```bash
# Build immagine
docker build -t youworker-frontend -f ops/docker/frontend/Dockerfile .

# Run container
docker run -p 3000:3000 youworker-frontend
```

### Environment Variables

```bash
# Build time (NEXT_PUBLIC_*)
NEXT_PUBLIC_API_BASE_URL=https://youworker.tuazienda.it:8000

# Runtime (server-side)
API_SECRET_KEY=<secret>
```

---

## Troubleshooting

### Hot Reload non funziona

```bash
# Aumenta limite file watchers (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Errori TypeScript

```bash
# Rigenera types
npm run type-check

# Pulisci cache
rm -rf .next
rm -rf node_modules/.cache
```

### Build Failures

```bash
# Pulisci e reinstalla
rm -rf node_modules .next
npm install
npm run build
```

---

## Risorse

**Documentazione:**
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- Tailwind: https://tailwindcss.com/docs
- Radix UI: https://www.radix-ui.com/
- TanStack Query: https://tanstack.com/query/latest

**Strumenti:**
- React DevTools: Chrome/Firefox extension
- TanStack Query DevTools: Integrato nel progetto

---

## Supporto

**YouCo Frontend Team:**
- Email: frontend@youco.it
- Slack: #youworker-frontend

---

**Made with ❤️ by YouCo**
