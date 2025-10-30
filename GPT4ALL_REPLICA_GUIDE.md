# GPT4All Replica Implementation Guide
## Next.js 16 with iOS 26 Liquid Glass Design System

> **Comprehensive guide for building a modern, privacy-focused AI chat interface inspired by GPT4All 3.0, styled with Apple's iOS 26 Liquid Glass design language, and connected to the YouWorker backend.**

---

## Table of Contents

1. [Design Philosophy & Principles](#design-philosophy--principles)
2. [Architecture Overview](#architecture-overview)
3. [iOS 26 Liquid Glass Design System](#ios-26-liquid-glass-design-system)
4. [Project Structure](#project-structure)
5. [Core Components](#core-components)
6. [Backend Integration](#backend-integration)
7. [Implementation Guide](#implementation-guide)
8. [Responsive & Accessibility](#responsive--accessibility)
9. [Performance Optimization](#performance-optimization)
10. [Testing Strategy](#testing-strategy)

---

## Design Philosophy & Principles

### GPT4All 3.0 Design Language

GPT4All 3.0 represents a paradigm shift from dialog-heavy interfaces to **view-based architecture**, prioritizing:

#### Core Principles
1. **Simplicity First**: Interface for "anyone with a computer" - no technical expertise required
2. **View-Based Flow**: Replace modal dialogs with full-page views for better context retention
3. **Privacy-Centric**: Visual emphasis on local-first, secure interactions
4. **Uncluttered Experience**: Minimalist approach to AI interaction
5. **Modern Aesthetics**: Dark-themed, glass-morphic elements with depth

#### Key Interface Goals
- **Intuitive Navigation**: Clear hierarchy with minimal cognitive load
- **Accessible to All**: Non-technical users can engage with LLMs confidently
- **Document Integration**: Seamless LocalDocs functionality
- **Model Management**: Easy switching between AI models
- **Cross-Platform Consistency**: Unified experience across devices

---

## Architecture Overview

### Technology Stack

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 16 App                    │
│  ┌───────────────────────────────────────────────┐  │
│  │          React Server Components             │  │
│  │  ┌─────────────────────────────────────────┐ │  │
│  │  │      iOS 26 Liquid Glass Layer         │ │  │
│  │  │  ┌──────────────────────────────────┐  │ │  │
│  │  │  │  GPT4All-Inspired UI Components  │  │ │  │
│  │  │  └──────────────────────────────────┘  │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        │ HTTP/WebSocket
                        ↓
┌─────────────────────────────────────────────────────┐
│              YouWorker Backend (FastAPI)            │
│  ┌─────────────────────────────────────────────┐   │
│  │  Authentication (Authentik SSO + JWT)       │   │
│  │  Chat Service (Streaming + WebSocket)       │   │
│  │  Document Service (Ingestion + Search)      │   │
│  │  Analytics Service (Metrics + Insights)     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Next.js 16 Features Utilized

- **App Router**: File-based routing with layouts and nested routes
- **Server Components**: Default server rendering for optimal performance
- **Server Actions**: Type-safe form submissions and mutations
- **Streaming SSR**: Progressive rendering with Suspense boundaries
- **Middleware**: Authentication guards and request interception
- **Route Handlers**: API proxy layer for backend communication
- **Parallel Routes**: Side-by-side views (chat + documents)
- **Intercepting Routes**: Modal overlays without route changes

---

## iOS 26 Liquid Glass Design System

### Brand Identity Integration

**YouWorker Brand Colors:**
- **Primary Red**: `#E32D21` - Main brand color for accents, CTAs, and highlights
- **Deep Slate**: `#454055` - Primary dark background, replacing pure black
- **Color Philosophy**: Warm red energy meets professional deep slate sophistication

### Visual Language

Apple's Liquid Glass represents the evolution of glassmorphism, featuring:

- **Dynamic Light Refraction**: Surfaces that appear to bend light
- **Depth Through Layering**: Multi-layer shadow and blur effects
- **Interactive Feedback**: Elements respond to hover/touch with subtle animations
- **Translucency Balance**: Strategic opacity for readability and aesthetics
- **Contextual Backgrounds**: Content behind glass elements informs the visual
- **Brand Color Integration**: Strategic use of #E32D21 red for emphasis and personality

### Core CSS Implementation

#### Base Glass Component

```css
/* Global CSS Variables - YouWorker Brand */
:root {
  /* Brand Colors */
  --brand-red: #E32D21;
  --brand-red-light: #F04438;
  --brand-red-dark: #C41E14;
  --brand-red-hover: #FF4136;

  --deep-slate: #454055;
  --deep-slate-light: #5A5566;
  --deep-slate-dark: #2D2938;
  --deep-slate-darker: #1F1B29;

  /* Glass Effects */
  --glass-blur-light: 8px;
  --glass-blur-heavy: 24px;
  --glass-tint-white: rgba(255, 255, 255, 0.05);
  --glass-tint-slate: rgba(69, 64, 85, 0.3);
  --glass-tint-red: rgba(227, 45, 33, 0.1);
  --glass-border: rgba(255, 255, 255, 0.18);
  --glass-border-red: rgba(227, 45, 33, 0.3);

  /* Shadows with brand colors */
  --glass-shadow-sm: 0 4px 16px rgba(69, 64, 85, 0.4);
  --glass-shadow-md: 0 8px 32px rgba(69, 64, 85, 0.5);
  --glass-shadow-lg: 0 12px 48px rgba(69, 64, 85, 0.6);
  --glass-shadow-red: 0 8px 24px rgba(227, 45, 33, 0.3);

  --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark theme (YouWorker Style) */
[data-theme="dark"] {
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-tint-white: rgba(255, 255, 255, 0.03);
  --glass-shadow-sm: 0 4px 16px rgba(45, 41, 56, 0.5);
  --glass-shadow-lg: 0 8px 32px rgba(45, 41, 56, 0.7);
}

/* Three-Layer Glass System - YouWorker Style */
.liquid-glass {
  position: relative;
  border-radius: 20px;
  isolation: isolate;
  transition: all 0.3s var(--transition-smooth);
  box-shadow: var(--glass-shadow-lg);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  border: 1px solid var(--glass-border);
  background: linear-gradient(
    135deg,
    var(--glass-tint-slate) 0%,
    rgba(69, 64, 85, 0.2) 100%
  );
}

/* Layer 1: Inner Shadow with brand accent */
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 20px;
  box-shadow:
    inset 0 0 20px -5px rgba(255, 255, 255, 0.6),
    inset 0 1px 0 rgba(227, 45, 33, 0.1);
  background: var(--glass-tint-white);
  pointer-events: none;
}

/* Layer 2: Backdrop Blur (Glass Effect) */
.liquid-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: 20px;
  backdrop-filter: blur(var(--glass-blur-light));
  -webkit-backdrop-filter: blur(var(--glass-blur-light));
  background: linear-gradient(
    135deg,
    rgba(69, 64, 85, 0.4) 0%,
    rgba(45, 41, 56, 0.6) 100%
  );
  isolation: isolate;
}

/* Interactive States with brand color */
.liquid-glass:hover {
  box-shadow:
    var(--glass-shadow-lg),
    0 0 20px rgba(227, 45, 33, 0.1);
  border-color: rgba(227, 45, 33, 0.3);
  transform: translateY(-2px);
}

.liquid-glass:active {
  transform: translateY(0);
  box-shadow: var(--glass-shadow-sm);
}
```

#### Specialized Glass Variants

```css
/* Heavy Blur (Sidebars, Modals) - Deep Slate Background */
.liquid-glass--heavy {
  backdrop-filter: blur(var(--glass-blur-heavy));
  -webkit-backdrop-filter: blur(var(--glass-blur-heavy));
  background: linear-gradient(
    135deg,
    rgba(69, 64, 85, 0.6) 0%,
    rgba(45, 41, 56, 0.8) 100%
  );
}

/* Card Variant (Chat Messages, Document Cards) */
.liquid-glass--card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: linear-gradient(
    135deg,
    rgba(69, 64, 85, 0.3) 0%,
    rgba(90, 85, 102, 0.2) 100%
  );
}

/* Input Variant (Text Fields) */
.liquid-glass--input {
  border-radius: 12px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: rgba(69, 64, 85, 0.4);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s var(--transition-smooth);
}

.liquid-glass--input:focus {
  background: rgba(69, 64, 85, 0.5);
  border-color: var(--brand-red);
  box-shadow:
    0 0 0 3px rgba(227, 45, 33, 0.15),
    0 4px 12px rgba(227, 45, 33, 0.2);
}

/* Button Variant - Brand Red Primary */
.liquid-glass--button {
  border-radius: 12px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  background: linear-gradient(
    135deg,
    rgba(227, 45, 33, 0.4),
    rgba(196, 30, 20, 0.3)
  );
  border: 1px solid var(--glass-border-red);
  cursor: pointer;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.liquid-glass--button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.5s;
}

.liquid-glass--button:hover {
  background: linear-gradient(
    135deg,
    rgba(227, 45, 33, 0.5),
    rgba(240, 68, 56, 0.4)
  );
  box-shadow: var(--glass-shadow-red);
  border-color: var(--brand-red-light);
}

.liquid-glass--button:hover::before {
  left: 100%;
}
```

### Tailwind CSS Integration

```javascript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // YouWorker Brand Colors
        brand: {
          red: '#E32D21',
          'red-light': '#F04438',
          'red-dark': '#C41E14',
          'red-hover': '#FF4136',
        },
        slate: {
          deep: '#454055',
          'deep-light': '#5A5566',
          'deep-dark': '#2D2938',
          'deep-darker': '#1F1B29',
        },
      },
      backdropBlur: {
        'glass-sm': '8px',
        'glass-md': '16px',
        'glass-lg': '24px',
        'glass-xl': '32px',
      },
      boxShadow: {
        'glass-sm': '0 4px 16px rgba(69, 64, 85, 0.4)',
        'glass-md': '0 8px 32px rgba(69, 64, 85, 0.5)',
        'glass-lg': '0 12px 48px rgba(69, 64, 85, 0.6)',
        'glass-red': '0 8px 24px rgba(227, 45, 33, 0.3)',
        'glass-red-lg': '0 12px 32px rgba(227, 45, 33, 0.4)',
        'glass-inner': 'inset 0 0 20px -5px rgba(255, 255, 255, 0.6)',
      },
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.18)',
        'glass-dark': 'rgba(255, 255, 255, 0.12)',
        'glass-red': 'rgba(227, 45, 33, 0.3)',
      },
      backgroundColor: {
        'glass-white': 'rgba(255, 255, 255, 0.05)',
        'glass-slate': 'rgba(69, 64, 85, 0.3)',
        'glass-red': 'rgba(227, 45, 33, 0.1)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #E32D21 0%, #C41E14 100%)',
        'gradient-slate': 'linear-gradient(135deg, #454055 0%, #2D2938 100%)',
        'gradient-glass-slate': 'linear-gradient(135deg, rgba(69, 64, 85, 0.6) 0%, rgba(45, 41, 56, 0.8) 100%)',
      },
      animation: {
        'glass-shimmer': 'shimmer 2s linear infinite',
        'glass-float': 'float 3s ease-in-out infinite',
        'pulse-red': 'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-red': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 0 0 rgba(227, 45, 33, 0.7)',
          },
          '50%': {
            opacity: '.8',
            boxShadow: '0 0 0 8px rgba(227, 45, 33, 0)',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
```

---

## Project Structure

### Recommended Directory Layout

```
youworker-fullstack/
├── apps/
│   └── frontend-v2/                    # New Next.js 16 frontend
│       ├── src/
│       │   ├── app/                    # App Router
│       │   │   ├── (auth)/             # Auth group
│       │   │   │   ├── login/
│       │   │   │   └── layout.tsx
│       │   │   ├── (main)/             # Main app group
│       │   │   │   ├── chat/
│       │   │   │   │   ├── [sessionId]/
│       │   │   │   │   │   └── page.tsx
│       │   │   │   │   ├── layout.tsx
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── documents/
│       │   │   │   │   ├── @modal/
│       │   │   │   │   │   └── (..)upload/
│       │   │   │   │   ├── upload/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── models/
│       │   │   │   │   └── page.tsx
│       │   │   │   ├── settings/
│       │   │   │   │   └── page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── api/                # Route handlers
│       │   │   │   ├── auth/
│       │   │   │   ├── chat/
│       │   │   │   ├── documents/
│       │   │   │   └── proxy/
│       │   │   ├── layout.tsx          # Root layout
│       │   │   └── page.tsx            # Landing page
│       │   ├── components/
│       │   │   ├── ui/                 # Base UI components
│       │   │   │   ├── glass/
│       │   │   │   │   ├── GlassCard.tsx
│       │   │   │   │   ├── GlassButton.tsx
│       │   │   │   │   ├── GlassInput.tsx
│       │   │   │   │   └── GlassSurface.tsx
│       │   │   │   ├── button.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   └── ...
│       │   │   ├── chat/               # Chat feature components
│       │   │   │   ├── ChatView.tsx
│       │   │   │   ├── MessageList.tsx
│       │   │   │   ├── MessageItem.tsx
│       │   │   │   ├── ChatInput.tsx
│       │   │   │   └── StreamingMessage.tsx
│       │   │   ├── documents/          # Document components
│       │   │   │   ├── DocumentGrid.tsx
│       │   │   │   ├── DocumentCard.tsx
│       │   │   │   ├── UploadZone.tsx
│       │   │   │   └── LocalDocsPanel.tsx
│       │   │   ├── layout/             # Layout components
│       │   │   │   ├── AppShell.tsx
│       │   │   │   ├── Sidebar.tsx
│       │   │   │   ├── TopBar.tsx
│       │   │   │   └── MobileNav.tsx
│       │   │   └── models/             # Model management
│       │   │       ├── ModelSelector.tsx
│       │   │       └── ModelCard.tsx
│       │   ├── lib/
│       │   │   ├── api/                # API client
│       │   │   │   ├── client.ts
│       │   │   │   ├── auth.ts
│       │   │   │   ├── chat.ts
│       │   │   │   ├── documents.ts
│       │   │   │   └── websocket.ts
│       │   │   ├── hooks/              # Custom hooks
│       │   │   │   ├── useChat.ts
│       │   │   │   ├── useWebSocket.ts
│       │   │   │   ├── useDocuments.ts
│       │   │   │   └── useStreamingMessage.ts
│       │   │   ├── store/              # State management
│       │   │   │   ├── chat-store.ts
│       │   │   │   ├── document-store.ts
│       │   │   │   └── settings-store.ts
│       │   │   ├── utils/
│       │   │   │   ├── format.ts
│       │   │   │   ├── validation.ts
│       │   │   │   └── encryption.ts
│       │   │   └── types/              # TypeScript types
│       │   │       ├── api.ts
│       │   │       ├── chat.ts
│       │   │       └── document.ts
│       │   └── styles/
│       │       ├── globals.css
│       │       └── liquid-glass.css
│       ├── public/
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
└── docs/
    ├── BACKEND_ARCHITECTURE.md         # Backend reference
    └── GPT4ALL_REPLICA_GUIDE.md        # This guide
```

---

## Core Components

### 1. Glass UI Components

#### GlassCard Component

```typescript
// src/components/ui/glass/GlassCard.tsx
'use client'

import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'heavy' | 'light' | 'card'
  interactive?: boolean
  glow?: boolean
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', interactive = false, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'relative rounded-2xl border backdrop-blur-glass-md',
          'transition-all duration-300 ease-out',

          // Variant styles - YouWorker Brand
          {
            'bg-glass-slate border-glass shadow-glass-md': variant === 'default',
            'bg-gradient-glass-slate border-glass-dark backdrop-blur-glass-lg shadow-glass-lg': variant === 'heavy',
            'bg-slate-deep/20 border-glass/50 shadow-glass-sm': variant === 'light',
            'bg-slate-deep/30 border-glass-dark/80 backdrop-blur-glass-md shadow-glass-md rounded-2xl': variant === 'card',
          },

          // Interactive styles with brand red accent
          interactive && [
            'cursor-pointer select-none',
            'hover:shadow-glass-lg hover:border-brand-red/30 hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-glass-sm',
          ],

          // Glow effect with brand colors
          glow && 'after:absolute after:inset-0 after:-z-10 after:rounded-2xl after:blur-2xl after:opacity-0 after:transition-opacity hover:after:opacity-100 after:bg-gradient-to-br after:from-brand-red/20 after:to-slate-deep-dark/40',

          className
        )}
        {...props}
      >
        {/* Inner shadow layer */}
        <div className="absolute inset-0 rounded-2xl shadow-glass-inner pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'

export { GlassCard }
```

#### GlassButton Component

```typescript
// src/components/ui/glass/GlassButton.tsx
'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center gap-2',
          'rounded-xl font-medium backdrop-blur-glass-md',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Size variants
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },

          // Variant styles - YouWorker Brand
          {
            // Primary: Brand red gradient glass
            'bg-gradient-to-br from-brand-red/40 to-brand-red-dark/30 border border-glass-red text-white shadow-glass-red hover:from-brand-red/50 hover:to-brand-red-light/40 hover:shadow-glass-red-lg hover:border-brand-red-light/60':
              variant === 'primary',

            // Secondary: Deep slate glass
            'bg-slate-deep/40 border border-glass text-white/90 shadow-glass-sm hover:bg-slate-deep/50 hover:shadow-glass-md hover:border-glass-red/50':
              variant === 'secondary',

            // Ghost: Minimal glass with red hover
            'bg-transparent border border-transparent text-white/70 hover:bg-slate-deep/20 hover:text-white hover:border-brand-red/20':
              variant === 'ghost',
          },

          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    )
  }
)

GlassButton.displayName = 'GlassButton'

export { GlassButton }
```

#### GlassInput Component

```typescript
// src/components/ui/glass/GlassInput.tsx
'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          className={cn(
            // Base styles
            'w-full rounded-xl px-4 py-2.5',
            'bg-glass-white/6 backdrop-blur-glass-md',
            'border-1.5 border-glass',
            'text-white placeholder:text-white/40',
            'transition-all duration-200 ease-out',

            // Focus styles - Brand red
            'focus:outline-none focus:bg-slate-deep/50 focus:border-brand-red/50',
            'focus:ring-3 focus:ring-brand-red/15',

            // Icon padding
            icon && 'pl-10',

            // Error state - Enhanced red
            error && 'border-brand-red-dark/70 focus:border-brand-red focus:ring-brand-red/20',

            className
          )}
          {...props}
        />
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'

export { GlassInput }
```

### 2. Layout Components

#### AppShell Component

```typescript
// src/components/layout/AppShell.tsx
'use client'

import { ReactNode, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { useMediaQuery } from '@/lib/hooks/useMediaQuery'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-deep-darker via-slate-deep-dark to-slate-deep">
      {/* Animated background elements - Brand colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red/8 rounded-full blur-3xl animate-glass-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-deep-light/10 rounded-full blur-3xl animate-glass-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-brand-red-dark/6 rounded-full blur-3xl animate-glass-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 flex h-full">
        {/* Sidebar */}
        {!isMobile && (
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <TopBar
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            showMenuButton={!isMobile}
          />

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {/* Mobile navigation */}
        {isMobile && <MobileNav />}
      </div>
    </div>
  )
}
```

#### Sidebar Component

```typescript
// src/components/layout/Sidebar.tsx
'use client'

import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass/GlassCard'
import { GlassButton } from '@/components/ui/glass/GlassButton'
import { MessageSquare, FileText, Settings, Plus, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useChatSessions } from '@/lib/hooks/useChatSessions'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { sessions, createSession } = useChatSessions()

  const navItems = [
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/documents', icon: FileText, label: 'Documents' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <aside
      className={cn(
        'relative h-full transition-all duration-300 ease-out',
        open ? 'w-80' : 'w-16'
      )}
    >
      {/* Glass sidebar container */}
      <GlassCard
        variant="heavy"
        className="h-full rounded-none border-r border-glass-dark flex flex-col"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-glass-dark/50">
          {open && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center font-bold text-white text-sm">
                Y
              </div>
              <span className="font-semibold text-white">YouWorker AI</span>
            </div>
          )}

          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-glass-white/5 transition-colors"
          >
            <ChevronLeft
              className={cn(
                'w-5 h-5 text-white/70 transition-transform',
                !open && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* New chat button */}
          <GlassButton
            variant="primary"
            className="w-full justify-start"
            onClick={createSession}
            icon={<Plus className="w-4 h-4" />}
          >
            {open && 'New Chat'}
          </GlassButton>

          <div className="h-4" />

          {/* Main navigation */}
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <GlassButton
                variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  pathname.startsWith(href) && 'bg-glass-white/10'
                )}
                icon={<Icon className="w-4 h-4" />}
              >
                {open && label}
              </GlassButton>
            </Link>
          ))}

          {/* Session list */}
          {open && sessions.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <p className="text-xs font-medium text-white/50 px-2">Recent Chats</p>
              </div>

              {sessions.map((session) => (
                <Link key={session.id} href={`/chat/${session.id}`}>
                  <GlassButton
                    variant="ghost"
                    className="w-full justify-start truncate"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    {session.title || 'New conversation'}
                  </GlassButton>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        {open && (
          <div className="p-4 border-t border-glass-dark/50">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-deep/30 hover:bg-slate-deep/40 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white text-xs">
                UN
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">User Name</p>
                <p className="text-xs text-white/50">user@email.com</p>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </aside>
  )
}
```

### 3. Chat Components

#### ChatView Component

```typescript
// src/components/chat/ChatView.tsx
'use client'

import { useChat } from '@/lib/hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { GlassCard } from '@/components/ui/glass/GlassCard'
import { ModelSelector } from '@/components/models/ModelSelector'
import { Loader2 } from 'lucide-react'

interface ChatViewProps {
  sessionId?: string
}

export function ChatView({ sessionId }: ChatViewProps) {
  const {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    isConnected,
    selectedModel,
    setSelectedModel,
  } = useChat(sessionId)

  return (
    <div className="h-full flex flex-col">
      {/* Header with model selector */}
      <div className="p-4 border-b border-glass-dark/30">
        <GlassCard variant="light" className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full transition-all',
                isConnected
                  ? 'bg-brand-red shadow-[0_0_8px_rgba(227,45,33,0.6)] animate-pulse-red'
                  : 'bg-slate-deep-light'
              )} />
              <span className="text-sm text-white/70">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <ModelSelector
              value={selectedModel}
              onChange={setSelectedModel}
            />
          </div>
        </GlassCard>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {/* Chat input */}
      <div className="p-4 border-t border-glass-dark/30">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={sendMessage}
          disabled={!isConnected || isLoading}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
```

#### MessageList Component

```typescript
// src/components/chat/MessageList.tsx
'use client'

import { useEffect, useRef } from 'react'
import { MessageItem } from './MessageItem'
import { StreamingMessage } from './StreamingMessage'
import { Loader2 } from 'lucide-react'
import type { Message } from '@/lib/types/chat'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 py-6 space-y-6"
    >
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-red/20 to-slate-deep/40 flex items-center justify-center backdrop-blur-glass-md border border-glass-red shadow-glass-red">
              <MessageSquare className="w-8 h-8 text-brand-red-light" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Start a conversation
              </h3>
              <p className="text-white/50">
                Ask me anything or upload documents to get started
              </p>
            </div>
          </div>
        </div>
      )}

      {messages.map((message, index) => {
        const isStreaming = message.role === 'assistant' && index === messages.length - 1 && isLoading

        return isStreaming ? (
          <StreamingMessage key={message.id} message={message} />
        ) : (
          <MessageItem key={message.id} message={message} />
        )
      })}

      {isLoading && messages.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
```

#### ChatInput Component

```typescript
// src/components/chat/ChatInput.tsx
'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { GlassCard } from '@/components/ui/glass/GlassCard'
import { GlassButton } from '@/components/ui/glass/GlassButton'
import { Send, Paperclip, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (message: string) => void
  disabled?: boolean
  loading?: boolean
}

export function ChatInput({ value, onChange, onSubmit, disabled, loading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = () => {
    if (value.trim() && !disabled && !loading) {
      onSubmit(value)
      onChange('')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = () => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  return (
    <GlassCard
      variant="card"
      className={cn(
        'transition-all duration-200',
        isFocused && 'ring-2 ring-blue-500/50'
      )}
    >
      <div className="flex items-end gap-3 p-3">
        {/* Attachment button */}
        <GlassButton
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={disabled}
        >
          <Paperclip className="w-5 h-5" />
        </GlassButton>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              handleInput()
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full bg-transparent text-white placeholder:text-white/40',
              'resize-none outline-none',
              'max-h-32 overflow-y-auto',
              'scrollbar-thin scrollbar-thumb-glass scrollbar-track-transparent'
            )}
          />
        </div>

        {/* Voice input button */}
        <GlassButton
          variant="ghost"
          size="sm"
          className="shrink-0"
          disabled={disabled}
        >
          <Mic className="w-5 h-5" />
        </GlassButton>

        {/* Send button */}
        <GlassButton
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          loading={loading}
        >
          <Send className="w-5 h-5" />
        </GlassButton>
      </div>
    </GlassCard>
  )
}
```

### 4. Document Components

#### DocumentGrid Component

```typescript
// src/components/documents/DocumentGrid.tsx
'use client'

import { useDocuments } from '@/lib/hooks/useDocuments'
import { DocumentCard } from './DocumentCard'
import { UploadZone } from './UploadZone'
import { GlassButton } from '@/components/ui/glass/GlassButton'
import { Upload, Search, Filter } from 'lucide-react'
import { GlassInput } from '@/components/ui/glass/GlassInput'
import { useState } from 'react'

export function DocumentGrid() {
  const { documents, isLoading, deleteDocument, searchDocuments } = useDocuments()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Documents</h1>
          <p className="text-white/50">
            Manage your knowledge base • {documents.length} documents
          </p>
        </div>

        <GlassButton
          variant="primary"
          onClick={() => setShowUpload(true)}
          icon={<Upload className="w-4 h-4" />}
        >
          Upload Document
        </GlassButton>
      </div>

      {/* Search and filters */}
      <div className="flex gap-3">
        <div className="flex-1">
          <GlassInput
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <GlassButton
          variant="secondary"
          icon={<Filter className="w-4 h-4" />}
        >
          Filters
        </GlassButton>
      </div>

      {/* Document grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl bg-glass-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-red/20 to-slate-deep/40 flex items-center justify-center backdrop-blur-glass-md border border-glass-red shadow-glass-red">
                <FileText className="w-8 h-8 text-brand-red-light" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No documents found
                </h3>
                <p className="text-white/50 mb-4">
                  Upload documents to enhance your AI conversations
                </p>
                <GlassButton
                  variant="primary"
                  onClick={() => setShowUpload(true)}
                >
                  Upload Your First Document
                </GlassButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={() => deleteDocument(document.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadZone onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}
```

---

## Backend Integration

### API Client Setup

```typescript
// src/lib/api/client.ts
import { cookies } from 'next/headers'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean
  csrfToken?: string
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { authenticated = true, csrfToken, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Add CSRF token for state-changing operations
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken
  }

  // Add authentication cookie (handled automatically by browser)
  // For server-side requests, you might need to forward cookies
  if (authenticated && typeof window === 'undefined') {
    const cookieStore = cookies()
    const authCookie = cookieStore.get('auth_token')
    if (authCookie) {
      headers['Cookie'] = `auth_token=${authCookie.value}`
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Important for cookie-based auth
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(
      error.detail || 'Request failed',
      response.status,
      error.code
    )
  }

  // Handle empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null as T
  }

  return response.json()
}
```

### Authentication Integration

```typescript
// src/lib/api/auth.ts
import { apiRequest } from './client'

export interface LoginResponse {
  access_token: string
  token_type: string
  user: {
    id: string
    email: string
    name: string
  }
}

export interface CSRFTokenResponse {
  csrf_token: string
}

export async function getCsrfToken(): Promise<string> {
  const response = await apiRequest<CSRFTokenResponse>('/v1/auth/csrf-token', {
    authenticated: false,
  })
  return response.csrf_token
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  // First, get CSRF token
  const csrfToken = await getCsrfToken()

  // Then perform login
  return apiRequest<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    authenticated: false,
    csrfToken,
  })
}

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest('/v1/auth/logout', {
    method: 'POST',
    csrfToken,
  })
}

export async function checkAuth(): Promise<boolean> {
  try {
    await apiRequest('/v1/auth/me')
    return true
  } catch {
    return false
  }
}
```

### Chat Service Integration

```typescript
// src/lib/api/chat.ts
import { apiRequest } from './client'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface Session {
  id: string
  title?: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatRequest {
  message: string
  session_id?: string
  model?: string
  context_documents?: string[]
}

export async function getSessions(): Promise<Session[]> {
  return apiRequest<Session[]>('/v1/sessions')
}

export async function getSession(sessionId: string): Promise<Session> {
  return apiRequest<Session>(`/v1/sessions/${sessionId}`)
}

export async function createSession(title?: string): Promise<Session> {
  const csrfToken = await getCsrfToken()

  return apiRequest<Session>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
    csrfToken,
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest(`/v1/sessions/${sessionId}`, {
    method: 'DELETE',
    csrfToken,
  })
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  return apiRequest<Message[]>(`/v1/sessions/${sessionId}/messages`)
}

// For streaming responses, use Server-Sent Events
export async function* streamChat(
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const csrfToken = await getCsrfToken()

  const response = await fetch(`${API_BASE_URL}/v1/unified-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(request),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Stream failed')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No reader available')
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              yield parsed.content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

### WebSocket Integration

```typescript
// src/lib/api/websocket.ts
import { getCsrfToken } from './auth'

export type MessageHandler = (data: any) => void
export type ErrorHandler = (error: Error) => void
export type CloseHandler = () => void

export interface WebSocketMessage {
  type: 'text' | 'audio' | 'tool_call' | 'status' | 'error'
  content?: string
  data?: any
  timestamp: string
}

export class ChatWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageHandlers: Set<MessageHandler> = new Set()
  private errorHandlers: Set<ErrorHandler> = new Set()
  private closeHandlers: Set<CloseHandler> = new Set()

  constructor(
    private sessionId: string,
    private wsUrl: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'
  ) {}

  async connect(): Promise<void> {
    // Get auth token from cookies
    const csrfToken = await getCsrfToken()
    const url = `${this.wsUrl}/chat/${this.sessionId}?csrf_token=${csrfToken}`

    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.messageHandlers.forEach(handler => handler(message))
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (event) => {
      const error = new Error('WebSocket error')
      this.errorHandlers.forEach(handler => handler(error))
    }

    this.ws.onclose = () => {
      console.log('WebSocket closed')
      this.stopHeartbeat()
      this.closeHandlers.forEach(handler => handler())
      this.attemptReconnect()
    }
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'text',
        content: message,
        timestamp: new Date().toISOString(),
      }))
    } else {
      throw new Error('WebSocket not connected')
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler)
    return () => this.errorHandlers.delete(handler)
  }

  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler)
    return () => this.closeHandlers.delete(handler)
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

      setTimeout(() => {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
        this.connect()
      }, delay)
    }
  }
}
```

### Custom Hooks

```typescript
// src/lib/hooks/useChat.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatWebSocket } from '@/lib/api/websocket'
import { getMessages, createSession, type Message } from '@/lib/api/chat'

export function useChat(sessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState(sessionId)
  const [ws, setWs] = useState<ChatWebSocket | null>(null)
  const [selectedModel, setSelectedModel] = useState('gpt-oss:20b')

  // Initialize WebSocket connection
  useEffect(() => {
    if (!currentSessionId) return

    const websocket = new ChatWebSocket(currentSessionId)

    websocket.onMessage((message) => {
      if (message.type === 'text' && message.content) {
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: message.content!,
            timestamp: message.timestamp,
          }
        ])
      }
      setIsLoading(false)
    })

    websocket.onError((error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    })

    websocket.onClose(() => {
      setIsConnected(false)
    })

    websocket.connect().then(() => {
      setIsConnected(true)
    })

    setWs(websocket)

    return () => {
      websocket.disconnect()
    }
  }, [currentSessionId])

  // Load existing messages
  useEffect(() => {
    if (!currentSessionId) return

    getMessages(currentSessionId).then(setMessages)
  }, [currentSessionId])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    // Create session if needed
    let sid = currentSessionId
    if (!sid) {
      const session = await createSession()
      sid = session.id
      setCurrentSessionId(sid)
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Send via WebSocket
    try {
      ws?.send(content)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
    }
  }, [currentSessionId, ws])

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    isConnected,
    sessionId: currentSessionId,
    selectedModel,
    setSelectedModel,
  }
}
```

---

## Implementation Guide

### Step 1: Project Setup

```bash
# Create new Next.js 16 app
npx create-next-app@latest frontend-v2 --typescript --tailwind --app

cd frontend-v2

# Install dependencies
npm install zustand @tanstack/react-query lucide-react clsx tailwind-merge
npm install -D @types/node

# Install development dependencies
npm install -D eslint prettier eslint-config-prettier
```

### Step 2: Configure Environment

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Step 3: Setup Tailwind Configuration

Copy the Tailwind configuration from the [iOS 26 Liquid Glass Design System](#ios-26-liquid-glass-design-system) section above.

### Step 4: Create Base Styles

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* YouWorker Brand Colors */
    --brand-red: #E32D21;
    --brand-red-light: #F04438;
    --brand-red-dark: #C41E14;
    --deep-slate: #454055;
    --deep-slate-light: #5A5566;
    --deep-slate-dark: #2D2938;
    --deep-slate-darker: #1F1B29;

    /* Color scheme */
    --background: 262 20% 16%;  /* deep-slate */
    --foreground: 210 40% 98%;

    /* Glass effects */
    --glass-blur-light: 8px;
    --glass-blur-heavy: 24px;
    --glass-tint-white: rgba(255, 255, 255, 0.05);
    --glass-tint-slate: rgba(69, 64, 85, 0.3);
    --glass-tint-red: rgba(227, 45, 33, 0.1);
    --glass-border: rgba(255, 255, 255, 0.18);
    --glass-border-red: rgba(227, 45, 33, 0.3);

    /* Shadows with brand colors */
    --glass-shadow-sm: 0 4px 16px rgba(69, 64, 85, 0.4);
    --glass-shadow-md: 0 8px 32px rgba(69, 64, 85, 0.5);
    --glass-shadow-lg: 0 12px 48px rgba(69, 64, 85, 0.6);
    --glass-shadow-red: 0 8px 24px rgba(227, 45, 33, 0.3);

    /* Transitions */
    --transition-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  }

  [data-theme="dark"] {
    --glass-border: rgba(255, 255, 255, 0.12);
    --glass-tint-white: rgba(255, 255, 255, 0.03);
    --background: 262 20% 16%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Custom scrollbar */
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thumb-glass {
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
```

### Step 5: Create Root Layout

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YouWorker AI - Private AI Assistant',
  description: 'Privacy-focused AI assistant with local document processing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

### Step 6: Create Main App Layout

```typescript
// src/app/(main)/layout.tsx
import { AppShell } from '@/components/layout/AppShell'
import { QueryProvider } from '@/components/providers/QueryProvider'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AppShell>
        {children}
      </AppShell>
    </QueryProvider>
  )
}
```

### Step 7: Create Chat Page

```typescript
// src/app/(main)/chat/page.tsx
import { ChatView } from '@/components/chat/ChatView'

export default function ChatPage() {
  return <ChatView />
}

// src/app/(main)/chat/[sessionId]/page.tsx
import { ChatView } from '@/components/chat/ChatView'

export default function SessionPage({
  params,
}: {
  params: { sessionId: string }
}) {
  return <ChatView sessionId={params.sessionId} />
}
```

### Step 8: Create Documents Page

```typescript
// src/app/(main)/documents/page.tsx
import { DocumentGrid } from '@/components/documents/DocumentGrid'

export default function DocumentsPage() {
  return <DocumentGrid />
}
```

### Step 9: Authentication Middleware

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicPage = request.nextUrl.pathname === '/'

  // Redirect to login if not authenticated
  if (!authToken && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to chat if authenticated and trying to access login
  if (authToken && isAuthPage) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

## Responsive & Accessibility

### Mobile-First Design

```typescript
// src/lib/hooks/useMediaQuery.ts
'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)

    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}
```

### Accessibility Features

1. **Keyboard Navigation**: All interactive elements are keyboard-accessible
2. **ARIA Labels**: Proper labels for screen readers
3. **Focus Management**: Clear focus indicators with glass effect
4. **Color Contrast**: WCAG AA compliant contrast ratios
5. **Semantic HTML**: Proper heading hierarchy and landmarks

```typescript
// Example: Accessible Glass Button
<button
  className="liquid-glass--button"
  aria-label="Send message"
  aria-disabled={disabled}
  role="button"
  tabIndex={0}
>
  Send
</button>
```

---

## Performance Optimization

### 1. Code Splitting & Lazy Loading

```typescript
// src/components/chat/ChatView.tsx
import dynamic from 'next/dynamic'

// Lazy load heavy components
const DocumentPanel = dynamic(() => import('./DocumentPanel'), {
  loading: () => <Skeleton />,
})
```

### 2. Image Optimization

```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="YouWorker AI"
  width={32}
  height={32}
  quality={90}
  priority
/>
```

### 3. Memoization

```typescript
import { memo, useMemo } from 'react'

export const MessageItem = memo(({ message }: { message: Message }) => {
  const formattedTime = useMemo(
    () => formatTimestamp(message.timestamp),
    [message.timestamp]
  )

  return <div>{/* ... */}</div>
})
```

### 4. Virtual Scrolling

For long message lists:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function MessageList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
  })

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <MessageItem message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 5. Debouncing & Throttling

```typescript
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

export function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const debouncedSearch = useMemo(
    () => debounce(onSearch, 300),
    [onSearch]
  )

  return (
    <GlassInput
      placeholder="Search..."
      onChange={(e) => debouncedSearch(e.target.value)}
    />
  )
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/components/ui/glass/GlassButton.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlassButton } from './GlassButton'

describe('GlassButton', () => {
  it('renders correctly', () => {
    render(<GlassButton>Click me</GlassButton>)
    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    render(<GlassButton onClick={handleClick}>Click me</GlassButton>)

    await userEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state', () => {
    render(<GlassButton loading>Click me</GlassButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### Integration Tests

```typescript
// src/components/chat/ChatView.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatView } from './ChatView'
import { mockWebSocket } from '@/test/mocks'

describe('ChatView', () => {
  it('sends messages via WebSocket', async () => {
    const { sendMessage } = mockWebSocket()

    render(<ChatView sessionId="test-session" />)

    const input = screen.getByPlaceholderText('Type a message...')
    await userEvent.type(input, 'Hello AI')

    const sendButton = screen.getByLabelText('Send message')
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Hello AI')
    })
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test('complete chat flow', async ({ page }) => {
  await page.goto('/chat')

  // Type and send message
  await page.fill('textarea[placeholder="Type a message..."]', 'Hello')
  await page.click('button[aria-label="Send message"]')

  // Wait for response
  await expect(page.locator('[data-role="assistant"]')).toBeVisible({
    timeout: 10000,
  })

  // Verify message appears
  const messages = page.locator('[data-message-item]')
  await expect(messages).toHaveCount(2) // user + assistant
})
```

---

## Additional Considerations

### Dark/Light Mode Toggle

```typescript
// src/components/theme-toggle.tsx
'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { GlassButton } from './ui/glass/GlassButton'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <GlassButton
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      icon={theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </GlassButton>
  )
}
```

### Error Boundaries

```typescript
// src/components/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'
import { GlassCard } from './ui/glass/GlassCard'
import { GlassButton } from './ui/glass/GlassButton'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-full flex items-center justify-center p-6">
          <GlassCard variant="heavy" className="max-w-md p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
            <p className="text-white/70">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <GlassButton
              variant="primary"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </GlassButton>
          </GlassCard>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Loading States

```typescript
// src/components/ui/loading-states.tsx
import { GlassCard } from './glass/GlassCard'

export function MessageSkeleton() {
  return (
    <GlassCard variant="card" className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-glass-white/10 animate-pulse" />
        <div className="h-4 w-24 bg-glass-white/10 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-glass-white/10 rounded animate-pulse" />
        <div className="h-4 bg-glass-white/10 rounded animate-pulse w-5/6" />
      </div>
    </GlassCard>
  )
}

export function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-glass rounded-full animate-spin border-t-brand-red shadow-glass-red" />
      </div>
    </div>
  )
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run full test suite (`npm run test`)
- [ ] Build production bundle (`npm run build`)
- [ ] Check bundle size and optimize if needed
- [ ] Verify environment variables are set
- [ ] Test authentication flow
- [ ] Test WebSocket connections
- [ ] Verify API endpoints are accessible
- [ ] Check CORS configuration
- [ ] Review security headers
- [ ] Test on multiple devices and browsers

### Environment Variables

```bash
# Production .env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NODE_ENV=production
```

### Build Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Enable compression
  compress: true,

  // Image optimization
  images: {
    domains: ['yourdomain.com'],
    formats: ['image/avif', 'image/webp'],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

---

## Conclusion

This guide provides a comprehensive foundation for building a GPT4All-inspired application with iOS 26 liquid glass styling, connected to the YouWorker backend. The architecture prioritizes:

1. **User Experience**: Intuitive, view-based interface with minimal cognitive load
2. **Visual Excellence**: Modern liquid glass aesthetics with smooth animations
3. **Performance**: Optimized rendering, code splitting, and efficient state management
4. **Security**: Proper authentication, CSRF protection, and secure WebSocket communication
5. **Accessibility**: WCAG compliant with keyboard navigation and screen reader support
6. **Maintainability**: Clean component structure, TypeScript types, and comprehensive testing

### Next Steps

1. Set up the project structure following the guide
2. Implement glass UI components first (foundation)
3. Build layout components (AppShell, Sidebar)
4. Integrate authentication and API client
5. Implement chat functionality with WebSocket
6. Add document management features
7. Test thoroughly across devices
8. Deploy to production

For questions or clarification on the backend architecture, refer to `BACKEND_ARCHITECTURE.md` in the project root.

---

**Built with ❤️ for privacy-focused AI interactions**
