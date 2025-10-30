export const APP_CONFIG = {
  name: 'YouWorker AI',
  version: '1.0.0',
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    timeout: 30000,
  },
  chat: {
    maxMessageLength: 4000,
    messageHistoryLength: 50,
    typingIndicatorDelay: 500,
    reconnectAttempts: 10,
    reconnectDelay: 1000,
  },
  websocket: {
    heartbeatInterval: 30000,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
  },
  ui: {
    toastDuration: 3000,
    animationDuration: 200,
    debounceDelay: 300,
  },
} as const

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  chat: '/chat',
  chatSession: (id: string) => `/chat/${id}`,
  documents: '/documents',
  settings: '/settings',
} as const

export const LOCAL_STORAGE_KEYS = {
  auth: 'auth-storage',
  settings: 'settings-storage',
  theme: 'theme',
  language: 'language',
  user: 'user',
} as const

export const API_RETRY_CONFIG = {
  idempotent: { attempts: 3, delay: 1000, backoff: 'exponential' as const },
  mutation: { attempts: 1, delay: 1000, backoff: 'exponential' as const },
  none: undefined,
} as const
