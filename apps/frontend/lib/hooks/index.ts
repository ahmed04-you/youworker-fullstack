/**
 * Centralized export for all custom hooks.
 */

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

// Export new custom hooks
export { useChat } from "./useChat";
export type { UseChatOptions, ChatState, UseChatReturn, ToolEvent } from "./useChat";

export { useSSE } from "./useSSE";
export type { SSEEvent, UseSSEOptions, UseSSEReturn } from "./useSSE";

export { useToolEvents, useToolMetrics } from "./useToolEvents";
export type {
  ToolEvent as ToolEventType,
  ToolEventGroup,
  UseToolEventsReturn,
  ToolMetrics,
} from "./useToolEvents";

export { useVoiceRecorder, audioBlobToPCM16Base64 } from "./useVoiceRecorder";
export type {
  VoiceRecorderOptions,
  VoiceRecorderState,
  VoiceRecorderControls,
} from "./useVoiceRecorder";

export {
  useAnalytics,
  useOverviewMetrics,
  useTokensTimeline,
  useToolPerformance,
  useToolTimeline,
  useIngestionStats,
  useSessionActivity,
} from "./useAnalytics";
