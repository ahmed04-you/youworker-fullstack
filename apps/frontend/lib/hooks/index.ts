"use client"

import useSWR from "swr"
import { useChatContext } from "@/lib/contexts/chat-context"
import type { HealthResponse } from "@/lib/types"
import { apiFetch, getApiBaseUrl } from "@/lib/api"

export function useLocalThreads() {
  const { threads, activeThreadId, setActiveThreadId, createThread, deleteThread } = useChatContext()
  return { threads, activeThreadId, setActiveThreadId, createThread, deleteThread }
}

export function useHealthSWR() {
  const url = `${getApiBaseUrl()}/health`
  return useSWR<HealthResponse>(
    url,
    (endpoint: string) => apiFetch<HealthResponse>(endpoint),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
    },
  )
}
