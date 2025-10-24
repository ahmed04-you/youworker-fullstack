"use client"

import { useCallback, useEffect, useState } from "react"
import useSWR from "swr"
import { getHealth } from "./api"
import type { ChatMessage } from "./types"
import { generateId } from "@/lib/utils"

/**
 * Thread stored in localStorage
 */
export interface Thread {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

/**
 * SWR hook for health check with gentle revalidation
 */
export function useHealthSWR() {
  return useSWR("health", getHealth, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })
}

/**
 * localStorage-based thread management
 * Provides CRUD operations and active thread state
 */
export function useLocalThreads() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // Load threads from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("youworker_threads")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setThreads(parsed)
      } catch (error) {
        console.error("[youworker] Impossibile analizzare le conversazioni da localStorage:", error)
      }
    }

    const storedActiveId = localStorage.getItem("youworker_active_thread")
    if (storedActiveId) {
      setActiveThreadId(storedActiveId)
    }
  }, [])

  // Save threads to localStorage whenever they change
  useEffect(() => {
    const threadsWithMessages = threads.filter((thread) => thread.messages.length > 0)
    if (threadsWithMessages.length > 0) {
      localStorage.setItem("youworker_threads", JSON.stringify(threadsWithMessages))
    } else {
      localStorage.removeItem("youworker_threads")
    }
  }, [threads])

  // Save active thread ID to localStorage
  useEffect(() => {
    if (activeThreadId) {
      localStorage.setItem("youworker_active_thread", activeThreadId)
    } else {
      localStorage.removeItem("youworker_active_thread")
    }
  }, [activeThreadId])

  const createThread = useCallback((title = "Nuova chat"): Thread => {
    const newThread: Thread = {
      id: generateId(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setThreads((prev) => [newThread, ...prev])
    setActiveThreadId(newThread.id)
    return newThread
  }, [])

  const updateThread = useCallback((id: string, updates: Partial<Thread>) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id
          ? {
              ...thread,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : thread,
      ),
    )
  }, [])

  const deleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => prev.filter((thread) => thread.id !== id))
      if (activeThreadId === id) {
        setActiveThreadId(null)
      }
    },
    [activeThreadId],
  )

  const getThread = useCallback(
    (id: string): Thread | undefined => {
      return threads.find((thread) => thread.id === id)
    },
    [threads],
  )

  const activeThread = activeThreadId ? getThread(activeThreadId) : undefined

  return {
    threads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    createThread,
    updateThread,
    deleteThread,
    getThread,
  }
}
