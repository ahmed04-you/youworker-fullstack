# Frontend Documentation

Complete guide to the YouWorker.AI frontend built with Next.js 15, React, and TypeScript.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Key Components](#key-components)
- [State Management](#state-management)
- [API Integration](#api-integration)
- [WebSocket Communication](#websocket-communication)
- [Voice Features](#voice-features)
- [Styling](#styling)
- [Internationalization](#internationalization)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)

## Overview

The frontend is a modern Next.js 15 application using the App Router, providing a responsive and interactive user interface for text and voice chat with AI capabilities.

### Key Features

- **Real-time Chat**: WebSocket-based streaming responses
- **Voice Input/Output**: Speech-to-text and text-to-speech
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Dark Mode**: System preference detection with manual toggle
- **Internationalization**: Multi-language support (Italian, English)
- **Accessibility**: WCAG 2.1 AA compliant

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15+ | React framework with App Router |
| React | 19+ | UI library |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | 3+ | Utility-first CSS |
| shadcn/ui | Latest | Component library |
| Lucide React | Latest | Icon library |
| Sonner | Latest | Toast notifications |

## Project Structure

```
apps/frontend/
├── app/                    # Next.js App Router
│   ├── (shell)/           # Shell layout group
│   │   ├── layout.tsx     # Main app layout
│   │   ├── page.tsx       # Chat page (home)
│   │   └── settings/      # Settings pages
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── providers.tsx      # Context providers
├── components/            # React components
│   ├── chat/             # Chat-related components
│   │   ├── chat.tsx      # Main chat component
│   │   ├── message.tsx   # Message bubble
│   │   └── input.tsx     # Chat input
│   └── ui/               # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                  # Utility libraries
│   ├── api.ts           # API client
│   ├── websocket.ts     # WebSocket client
│   ├── voice-recorder.ts # Audio recording
│   ├── audio-utils.ts   # Audio utilities
│   ├── utils.ts         # Common utilities
│   ├── hooks.ts         # Custom React hooks
│   └── i18n.tsx         # Internationalization
├── public/              # Static assets
│   ├── audio-processor.js
│   └── youco-logo.png
└── __tests__/           # Test files
    ├── components/
    └── lib/
```

## Key Components

### Chat Component

**Location**: [`components/chat/chat.tsx`](../apps/frontend/components/chat/chat.tsx)

Main chat interface with real-time messaging:

```typescript
import { Chat } from '@/components/chat/chat'

function ChatPage() {
  return (
    <Chat 
      sessionId="unique-session-id"
      token="auth-token"
    />
  )
}
```

**Features**:
- Real-time message streaming
- Voice recording and playback
- Message actions (copy, edit, regenerate)
- Connection status indicators
- Tool execution visualization
- Auto-scroll to latest message

**Props**:
```typescript
interface ChatProps {
  sessionId: string;      // Unique session identifier
  token?: string;         // Authentication token
  className?: string;     // Additional CSS classes
}
```

### WebSocket Client

**Location**: [`lib/websocket.ts`](../apps/frontend/lib/websocket.ts)

Manages real-time WebSocket connections:

```typescript
import { ChatWebSocket } from '@/lib/websocket'

const ws = new ChatWebSocket('ws://localhost:8001')
ws.setToken('your-token')

ws.setCallbacks({
  onText: (content, metadata) => {
    console.log('Received:', content)
  },
  onConnect: () => console.log('Connected'),
  onError: (error) => console.error('Error:', error)
})

await ws.connect('session-id')
ws.sendTextMessage('Hello!')
```

**Features**:
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Heartbeat mechanism
- Type-safe message handling
- Comprehensive error recovery

### Voice Recorder Hook

**Location**: [`lib/voice-recorder.ts`](../apps/frontend/lib/voice-recorder.ts)

Custom hook for voice recording:

```typescript
import { useVoiceRecorder } from '@/lib/voice-recorder'

function VoiceButton() {
  const [state, controls] = useVoiceRecorder({
    sampleRate: 16000,
    onStop: async (blob) => {
      // Process recorded audio
    }
  })

  return (
    <button 
      onClick={state.isRecording ? controls.stopRecording : controls.startRecording}
    >
      {state.isRecording ? 'Stop' : 'Record'}
    </button>
  )
}
```

**Features**:
- Browser compatibility checks
- Permission handling
- Duration tracking
- Pause/resume support
- Audio format conversion

### API Client

**Location**: [`lib/api.ts`](../apps/frontend/lib/api.ts)

Type-safe API client with error handling:

```typescript
import { api } from '@/lib/api'

// Send chat message
const response = await api.chat.send({
  text_input: 'Hello',
  enable_tools: true
})

// Upload document
const result = await api.ingestion.upload(file)

// Get analytics
const stats = await api.analytics.overview()
```

## State Management

### Context Providers

#### ChatProvider

Manages chat-level state:

```typescript
import { ChatProvider, useChatContext } from '@/lib/hooks'

function App() {
  return (
    <ChatProvider defaultLanguage="it">
      <ChatInterface />
    </ChatProvider>
  )
}

function ChatInterface() {
  const { language, setLanguage } = useChatContext()
  // Use chat context
}
```

#### I18nProvider

Handles internationalization:

```typescript
import { I18nProvider, useI18n } from '@/lib/i18n'

function App() {
  return (
    <I18nProvider defaultLang="it">
      <Content />
    </I18nProvider>
  )
}

function Content() {
  const { t, lang, setLang } = useI18n()
  return <h1>{t('welcome')}</h1>
}
```

### Local State

Components use React hooks for local state:

```typescript
import { useState, useEffect, useCallback } from 'react'

function Component() {
  const [state, setState] = useState(initialValue)
  
  useEffect(() => {
    // Side effects
  }, [dependencies])
  
  const handler = useCallback(() => {
    // Event handler
  }, [dependencies])
}
```

## API Integration

### REST API Calls

```typescript
// Using fetch with error handling
async function fetchData() {
  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('API error:', error)
    throw error
  }
}
```

### Server-Side Rendering (SSR)

```typescript
// app/page.tsx
async function getData() {
  const res = await fetch('http://api:8001/endpoint', {
    headers: { 'X-API-Key': process.env.ROOT_API_KEY }
  })
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data.content}</div>
}
```

### Client-Side Fetching

```typescript
'use client'

import { useEffect, useState } from 'react'

function Component() {
  const [data, setData] = useState(null)
  
  useEffect(() => {
    fetch('/api/endpoint')
      .then(res => res.json())
      .then(setData)
  }, [])
  
  return <div>{data?.content}</div>
}
```

## WebSocket Communication

### Connection Management

```typescript
import { ChatWebSocket } from '@/lib/websocket'

// Initialize
const ws = new ChatWebSocket(
  window.location.origin.replace(/^http/, 'ws')
)

// Set authentication
ws.setToken(authToken)

// Configure callbacks
ws.setCallbacks({
  onConnect: () => {
    console.log('Connected')
    setConnected(true)
  },
  
  onDisconnect: (code, reason) => {
    console.log('Disconnected:', code, reason)
    setConnected(false)
  },
  
  onText: (content, metadata) => {
    if (metadata?.is_streaming) {
      // Append to streaming text
      setStreamingText(prev => prev + content)
    } else if (metadata?.is_final) {
      // Commit final message
      addMessage({
        type: 'assistant',
        content: streamingText + content
      })
      setStreamingText('')
    }
  },
  
  onError: (error, isRecoverable) => {
    if (isRecoverable) {
      console.warn('Recoverable error:', error)
    } else {
      console.error('Fatal error:', error)
    }
  }
})

// Connect
await ws.connect(sessionId)

// Send messages
ws.sendTextMessage('Hello!')
```

### Message Flow

```
User Input
    │
    ├─► Voice Recording → PCM16 Base64 → sendAudioMessage()
    │   or
    └─► Text Input → sendTextMessage()
         │
         ▼
    WebSocket Send
         │
         ▼
    Server Processing
         │
         ├─► onTranscript (if audio)
         ├─► onStatus (thinking, tools)
         ├─► onTool (tool execution)
         ├─► onText (streaming tokens)
         ├─► onAudio (TTS response)
         └─► onText (final message)
```

## Voice Features

### Recording Audio

```typescript
import { useVoiceRecorder, audioBlobToPCM16Base64 } from '@/lib/voice-recorder'

function VoiceInput() {
  const [state, controls] = useVoiceRecorder({
    sampleRate: 16000,
    maxDuration: 300000, // 5 minutes
    onStop: async (blob) => {
      // Convert to PCM16 base64
      const pcm16 = await audioBlobToPCM16Base64(blob, 16000)
      
      // Send to server
      ws.sendAudioMessage(pcm16, 16000)
    }
  })
  
  return (
    <button
      onClick={state.isRecording ? controls.stopRecording : controls.startRecording}
      disabled={!state.isSupported}
    >
      {state.isRecording ? 'Stop' : 'Record'}
      {state.isRecording && ` (${Math.floor(state.duration / 1000)}s)`}
    </button>
  )
}
```

### Playing Audio

```typescript
import { playBase64Wav } from '@/lib/audio-utils'

async function playResponse(audioB64: string) {
  try {
    const audio = await playBase64Wav(audioB64)
    
    audio.addEventListener('ended', () => {
      console.log('Playback finished')
    })
    
    audio.addEventListener('error', (e) => {
      console.error('Playback error:', e)
    })
  } catch (error) {
    console.error('Failed to play audio:', error)
  }
}
```

## Styling

### Tailwind CSS

Utility-first CSS framework:

```tsx
<div className="flex items-center gap-4 p-4 bg-background text-foreground">
  <Button variant="default" size="lg">
    Click me
  </Button>
</div>
```

### Theme Configuration

**File**: `tailwind.config.ts`

```typescript
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ...
      }
    }
  }
}
```

### CSS Variables

**File**: `app/globals.css`

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    /* ... */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    /* ... */
  }
}
```

## Internationalization

### Translation Files

```typescript
// lib/i18n.tsx
export const translations = {
  en: {
    welcome: 'Welcome',
    send: 'Send',
    record: 'Record',
    // ...
  },
  it: {
    welcome: 'Benvenuto',
    send: 'Invia',
    record: 'Registra',
    // ...
  }
}
```

### Usage

```typescript
import { useI18n } from '@/lib/i18n'

function Component() {
  const { t, lang, setLang } = useI18n()
  
  return (
    <div>
      <h1>{t('welcome')}</h1>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        <option value="en">English</option>
        <option value="it">Italiano</option>
      </select>
    </div>
  )
}
```

## Testing

### Unit Tests (Jest)

**File**: `__tests__/components/chat.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Chat } from '@/components/chat/chat'

describe('Chat Component', () => {
  it('renders chat input', () => {
    render(<Chat sessionId="test" />)
    expect(screen.getByPlaceholderText(/type/i)).toBeInTheDocument()
  })
  
  it('sends message on submit', async () => {
    const { container } = render(<Chat sessionId="test" />)
    const input = screen.getByRole('textbox')
    const button = screen.getByRole('button', { name: /send/i })
    
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(button)
    
    // Assert message sent
  })
})
```

### Integration Tests

```typescript
import { ChatWebSocket } from '@/lib/websocket'

describe('WebSocket Client', () => {
  it('connects and sends messages', async () => {
    const ws = new ChatWebSocket('ws://localhost:8001')
    
    await ws.connect('test-session')
    expect(ws.isConnected()).toBe(true)
    
    ws.sendTextMessage('Test')
    // Assert message sent
  })
})
```

## Build & Deployment

### Development

```bash
cd apps/frontend
npm install
npm run dev
```

Access at http://localhost:3000

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_KEY=your-api-key
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_API_PORT=8000
```

### Docker Build

```bash
docker build -f ops/docker/Dockerfile.frontend -t youworker-frontend .
docker run -p 3000:3000 youworker-frontend
```

### Static Export

```bash
# next.config.mjs
export default {
  output: 'export',
  // ...
}

npm run build
# Static files in out/
```

## Performance Optimization

### Code Splitting

```typescript
// Dynamic imports
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false // Client-side only
})
```

### Image Optimization

```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority
/>
```

### Memoization

```typescript
import { memo, useMemo, useCallback } from 'react'

const MemoizedComponent = memo(function Component({ data }) {
  const computed = useMemo(() => {
    return expensiveComputation(data)
  }, [data])
  
  const handler = useCallback(() => {
    // Handler logic
  }, [dependencies])
  
  return <div>{computed}</div>
})
```

## Accessibility

### ARIA Labels

```typescript
<button
  aria-label="Send message"
  aria-disabled={!canSend}
>
  <Send className="w-4 h-4" />
</button>
```

### Keyboard Navigation

```typescript
<input
  onKeyDown={(e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }}
/>
```

### Focus Management

```typescript
import { useRef, useEffect } from 'react'

function Component() {
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  return <input ref={inputRef} />
}
```

## Related Documentation

- [API Documentation](API.md)
- [Architecture](ARCHITECTURE.md)
- [Development Guide](DEVELOPMENT.md)
- [Setup Guide](SETUP.md)