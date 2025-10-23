"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react"
import { generateId, readFromStorage, saveToStorage } from "@/lib/utils"
import type {
  ChatMessage,
  Thread,
  ToolEventPayload,
  ToolRun,
  ToolRunUpdate,
} from "@/lib/types"

const THREADS_STORAGE_KEY = "youworker.threads.v1"
const MAX_TOOL_EVENTS = 50

interface ChatContextValue {
  messages: ChatMessage[]
  setMessages: (value: SetStateAction<ChatMessage[]>) => void
  streamingText: string
  setStreamingText: (value: SetStateAction<string>) => void
  isStreaming: boolean
  setIsStreaming: (value: boolean) => void
  audioPlaying: boolean
  setAudioPlaying: (value: boolean) => void
  metadata: Record<string, unknown>
  setMetadata: (value: SetStateAction<Record<string, unknown>>) => void
  toolEvents: ToolRun[]
  addToolEvent: (event: { event: string; data: ToolEventPayload }) => void
  clearToolEvents: () => void
  sessionId: string | null
  ensureSession: () => string
  suggestedPrompt: string
  setSuggestedPrompt: (value: string) => void
  clearChat: () => void
  threads: Thread[]
  activeThreadId: string | null
  setActiveThreadId: (id: string) => void
  createThread: () => Thread
  deleteThread: (id: string) => void
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessagesState] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingTextState] = useState("")
  const [isStreaming, setIsStreamingState] = useState(false)
  const [audioPlaying, setAudioPlayingState] = useState(false)
  const [metadata, setMetadataState] = useState<Record<string, unknown>>({})
  const [toolEvents, setToolEventsState] = useState<ToolRun[]>([])
  const [sessionId, setSessionIdState] = useState<string | null>(null)
  const [suggestedPrompt, setSuggestedPromptState] = useState("")
  const [threads, setThreadsState] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const applyActiveThread = useCallback((thread: Thread) => {
    setActiveThreadIdState(thread.id)
    setSessionIdState(thread.sessionId)
    setMessagesState(thread.messages)
    setToolEventsState(thread.toolEvents ?? [])
    setMetadataState(thread.metadata ?? {})
    setStreamingTextState("")
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedThreads = readFromStorage<Thread[]>(THREADS_STORAGE_KEY, [])
    if (storedThreads.length > 0) {
      setThreadsState(storedThreads)
      applyActiveThread(storedThreads[0])
    } else {
      const initialThread = createThreadObject()
      setThreadsState([initialThread])
      applyActiveThread(initialThread)
    }
    setHydrated(true)
  }, [applyActiveThread])

  useEffect(() => {
    if (!hydrated) return
    saveToStorage(THREADS_STORAGE_KEY, threads)
  }, [threads, hydrated])

  const updateThread = useCallback((threadId: string, updater: (thread: Thread) => Thread) => {
    setThreadsState((prev) => prev.map((thread) => (thread.id === threadId ? updater(thread) : thread)))
  }, [])

  const setMessages = useCallback(
    (value: SetStateAction<ChatMessage[]>) => {
      setMessagesState((prev) => {
        const next = typeof value === "function" ? (value as (prev: ChatMessage[]) => ChatMessage[])(prev) : value
        if (activeThreadId) {
          updateThread(activeThreadId, (thread) => ({
            ...thread,
            messages: next,
            title: deriveThreadTitle(next, thread.title),
            updatedAt: new Date().toISOString(),
          }))
        }
        return next
      })
    },
    [activeThreadId, updateThread],
  )

  const setMetadata = useCallback(
    (value: SetStateAction<Record<string, unknown>>) => {
      setMetadataState((prev) => {
        const next = typeof value === "function" ? (value as (prev: Record<string, unknown>) => Record<string, unknown>)(prev) : value
        if (activeThreadId) {
          updateThread(activeThreadId, (thread) => ({
            ...thread,
            metadata: next,
          }))
        }
        return next
      })
    },
    [activeThreadId, updateThread],
  )

  const setToolEvents = useCallback(
    (value: SetStateAction<ToolRun[]>) => {
      setToolEventsState((prev) => {
        const computed = typeof value === "function" ? (value as (prev: ToolRun[]) => ToolRun[])(prev) : value
        const next = computed.slice(-MAX_TOOL_EVENTS)
        if (activeThreadId) {
          updateThread(activeThreadId, (thread) => ({
            ...thread,
            toolEvents: next,
            updatedAt: new Date().toISOString(),
          }))
        }
        return next
      })
    },
    [activeThreadId, updateThread],
  )

  const setStreamingText = useCallback(
    (value: SetStateAction<string>) => {
      setStreamingTextState((prev) => (typeof value === "function" ? (value as (prev: string) => string)(prev) : value))
    },
    [],
  )

  const setIsStreaming = useCallback((value: boolean) => setIsStreamingState(value), [])
  const setAudioPlaying = useCallback((value: boolean) => setAudioPlayingState(value), [])
  const setSuggestedPrompt = useCallback((value: string) => setSuggestedPromptState(value), [])

  const ensureSession = useCallback((): string => {
    if (sessionId) {
      return sessionId
    }
    if (activeThreadId) {
      const thread = threads.find((t) => t.id === activeThreadId)
      if (thread) {
        const existing = thread.sessionId || generateId()
        if (existing !== thread.sessionId) {
          updateThread(thread.id, (current) => ({
            ...current,
            sessionId: existing,
          }))
        }
        setSessionIdState(existing)
        return existing
      }
    }
    const newThread = createThreadObject()
    setThreadsState((prev) => [newThread, ...prev])
    applyActiveThread(newThread)
    return newThread.sessionId
  }, [sessionId, activeThreadId, threads, updateThread, applyActiveThread])

  const addToolEvent = useCallback(
    (event: { event: string; data: ToolEventPayload }) => {
      if (!event?.data) return
      setToolEvents((prev) => integrateToolEvent(prev, event.data))
    },
    [setToolEvents],
  )

  const clearToolEvents = useCallback(() => {
    setToolEvents([])
  }, [setToolEvents])

  const clearChat = useCallback(() => {
    setMessages([])
    setStreamingTextState("")
    setToolEvents([])
    setMetadata({})
    setAudioPlaying(false)
  }, [setMessages, setToolEvents, setMetadata])

  const setActiveThreadId = useCallback(
    (id: string) => {
      const thread = threads.find((t) => t.id === id)
      if (thread) {
        applyActiveThread(thread)
      }
    },
    [threads, applyActiveThread],
  )

  const createThread = useCallback((): Thread => {
    const thread = createThreadObject()
    setThreadsState((prev) => [thread, ...prev])
    applyActiveThread(thread)
    return thread
  }, [applyActiveThread])

  const deleteThread = useCallback(
    (id: string) => {
      setThreadsState((prev) => {
        const filtered = prev.filter((thread) => thread.id !== id)
        if (filtered.length === prev.length) {
          return prev
        }
        if (filtered.length === 0) {
          const nextThread = createThreadObject()
          applyActiveThread(nextThread)
          return [nextThread]
        }
        if (activeThreadId === id) {
          applyActiveThread(filtered[0])
        }
        return filtered
      })
    },
    [activeThreadId, applyActiveThread],
  )

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      setMessages,
      streamingText,
      setStreamingText,
      isStreaming,
      setIsStreaming,
      audioPlaying,
      setAudioPlaying,
      metadata,
      setMetadata,
      toolEvents,
      addToolEvent,
      clearToolEvents,
      sessionId,
      ensureSession,
      suggestedPrompt,
      setSuggestedPrompt,
      clearChat,
      threads,
      activeThreadId,
      setActiveThreadId,
      createThread,
      deleteThread,
    }),
    [
      messages,
      setMessages,
      streamingText,
      setStreamingText,
      isStreaming,
      setIsStreaming,
      audioPlaying,
      setAudioPlaying,
      metadata,
      setMetadata,
      toolEvents,
      addToolEvent,
      clearToolEvents,
      sessionId,
      ensureSession,
      suggestedPrompt,
      setSuggestedPrompt,
      clearChat,
      threads,
      activeThreadId,
      setActiveThreadId,
      createThread,
      deleteThread,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) {
    throw new Error("useChatContext must be used within a ChatProvider")
  }
  return ctx
}

function createThreadObject(): Thread {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    sessionId: generateId(),
    title: "Nuova conversazione",
    createdAt: now,
    updatedAt: now,
    messages: [],
    metadata: {},
    toolEvents: [],
  }
}

function deriveThreadTitle(messages: ChatMessage[], fallback?: string | null): string {
  const candidate = [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.content.trim().length > 0)
  if (candidate) {
    const text = candidate.content.trim().replace(/\s+/g, " ")
    return text.length > 60 ? `${text.slice(0, 60)}…` : text
  }
  return fallback ?? "Nuova conversazione"
}

function integrateToolEvent(existing: ToolRun[], payload: ToolEventPayload): ToolRun[] {
  const runId = String(payload.run_id ?? payload.tool_call_id ?? payload.tool ?? generateId())
  const timestamp = typeof payload.ts === "string" ? payload.ts : new Date().toISOString()
  const status = (payload.status || "update").toLowerCase()

  const current = existing.find((run) => run.id === runId)
  const baseRun: ToolRun = current
    ? {
        ...current,
        updates: [...current.updates],
      }
    : {
        id: runId,
        tool: payload.tool ?? "Tool",
        status: "running",
        startedAt: timestamp,
        updates: [],
        latencyMs: null,
        resultPreview: null,
      }

  const update: ToolRunUpdate = {
    id: generateId(),
    status,
    timestamp,
    payload,
  }
  baseRun.updates.push(update)

  if (status === "start") {
    baseRun.status = "running"
    baseRun.startedAt = timestamp
    baseRun.tool = payload.tool ?? baseRun.tool
  } else if (status === "end" || status === "ok") {
    baseRun.status = "success"
    baseRun.completedAt = timestamp
    if (typeof payload.latency_ms === "number") {
      baseRun.latencyMs = Math.round(payload.latency_ms)
    }
    if (typeof payload.result_preview === "string") {
      baseRun.resultPreview = payload.result_preview
    }
  } else if (status === "error") {
    baseRun.status = "error"
    baseRun.completedAt = timestamp
    if (typeof payload.result_preview === "string") {
      baseRun.resultPreview = payload.result_preview
    }
  } else if (status === "cached") {
    baseRun.status = "cached"
    baseRun.completedAt = timestamp
  }

  const others = existing.filter((run) => run.id !== baseRun.id)
  return [...others, baseRun]
}
