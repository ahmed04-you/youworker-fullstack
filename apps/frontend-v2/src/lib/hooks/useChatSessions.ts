'use client'

import { useState, useEffect } from 'react'
import { getSessions, createSession, deleteSession } from '@/src/lib/api/chat'
import type { Session } from '@/src/lib/types'

export function useChatSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setIsLoading(true)
      const data = await getSessions()
      setSessions(data)
      setError(null)
    } catch (err) {
      setError(err as Error)
      console.error('Failed to load sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewSession = async (title?: string): Promise<Session> => {
    try {
      const session = await createSession(title)
      setSessions(prev => [session, ...prev])
      return session
    } catch (err) {
      setError(err as Error)
      console.error('Failed to create session:', err)
      throw err
    }
  }

  const removeSession = async (sessionId: string): Promise<void> => {
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      setError(err as Error)
      console.error('Failed to delete session:', err)
      throw err
    }
  }

  return {
    sessions,
    isLoading,
    error,
    createSession: createNewSession,
    deleteSession: removeSession,
    refreshSessions: loadSessions,
  }
}
