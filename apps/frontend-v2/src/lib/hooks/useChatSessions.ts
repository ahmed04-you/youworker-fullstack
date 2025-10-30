'use client'

import { useState, useEffect } from 'react'
import { getSessions, createSession, deleteSession } from '@/src/lib/api/chat'
import type { Session } from '@/src/lib/types'
import { errorTracker } from '@/src/lib/utils'

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
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useChatSessions',
        action: 'loadSessions'
      })
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
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useChatSessions',
        action: 'createSession'
      })
      throw error
    }
  }

  const removeSession = async (sessionId: string): Promise<void> => {
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useChatSessions',
        action: 'deleteSession',
        metadata: { sessionId }
      })
      throw error
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
