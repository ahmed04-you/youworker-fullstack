import { create } from 'zustand'
import type { Session } from '@/src/lib/types'

interface ChatState {
  sessions: Session[]
  currentSessionId: string | null
  isLoading: boolean
  error: Error | null
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  removeSession: (sessionId: string) => void
  updateSession: (sessionId: string, updates: Partial<Session>) => void
  setCurrentSession: (sessionId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: Error | null) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions]
  })),
  removeSession: (sessionId) => set((state) => ({
    sessions: state.sessions.filter(s => s.id !== sessionId),
    currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId
  })),
  updateSession: (sessionId, updates) => set((state) => ({
    sessions: state.sessions.map(s =>
      s.id === sessionId ? { ...s, ...updates } : s
    )
  })),
  setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error })
}))
