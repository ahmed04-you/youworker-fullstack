"use client"

import { SSEClient } from "@/lib/transport/sse-client"
import type {
  DocumentItem,
  IngestResponse,
  IngestionRun,
  Session,
  ToolEventPayload,
  UnifiedChatRequestPayload,
  UnifiedChatResponsePayload,
  UnifiedChatStreamCallbacks,
  HealthResponse,
} from "@/lib/types"

const DEFAULT_API_URL = "http://localhost:8001"
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_API_KEY || "dev-root-key"

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  if (envUrl) {
    return envUrl.replace(/\/+$/, "")
  }

  if (typeof window !== "undefined") {
    const port = process.env.NEXT_PUBLIC_API_PORT
    if (port) {
      const url = new URL(window.location.origin)
      url.port = port
      return url.origin
    }
    return window.location.origin
  }

  return DEFAULT_API_URL
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  const base = getApiBaseUrl()
  if (path.startsWith("/")) {
    return `${base}${path}`
  }
  return `${base}/${path}`
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init ?? {})
  if (!headers.has("X-API-Key")) {
    headers.set("X-API-Key", DEFAULT_API_KEY)
  }
  return headers
}

async function parseError(response: Response): Promise<Error> {
  let detail: string | undefined
  try {
    const data = await response.clone().json()
    detail =
      data?.detail ||
      data?.message ||
      data?.error ||
      (typeof data === "string" ? data : JSON.stringify(data))
  } catch {
    detail = await response.text()
  }
  detail = detail?.trim()
  return new Error(detail || `Request failed with status ${response.status}`)
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = resolveUrl(path)
  const headers = buildHeaders(init?.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  })
  if (!response.ok) {
    throw await parseError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>
  }
  const text = await response.text()
  return text as unknown as T
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health")
}

export async function postUnifiedChat(
  payload: UnifiedChatRequestPayload,
  callbacks: UnifiedChatStreamCallbacks = {},
  client?: SSEClient | null,
): Promise<void> {
  const controller = new AbortController()
  if (client) {
    client.attach(controller)
  }

  const body = {
    ...payload,
    messages: payload.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  }

  try {
    const response = await fetch(resolveUrl("/v1/unified-chat"), {
      method: "POST",
      headers: buildHeaders({
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: "include",
    })

    if (!response.ok) {
      throw await parseError(response)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Streaming non supportato dal browser.")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let separatorIndex: number
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        const parsed = parseSseEvent(rawEvent)
        if (!parsed) continue

        const { event, data } = parsed

        if (event === "token" && data && typeof callbacks.onToken === "function") {
          callbacks.onToken(data)
        } else if (event === "tool" && data && typeof callbacks.onTool === "function") {
          callbacks.onTool(data as ToolEventPayload)
        } else if (event === "log" && data && typeof callbacks.onLog === "function") {
          callbacks.onLog(data)
        } else if ((event === "heartbeat" || event === "ping") && typeof callbacks.onHeartbeat === "function") {
          callbacks.onHeartbeat()
        } else if (event === "done" && data && typeof callbacks.onDone === "function") {
          callbacks.onDone(data as UnifiedChatResponsePayload)
        }
      }
    }
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      return
    }
    if (callbacks.onError) {
      callbacks.onError(error as Error)
    }
    throw error
  } finally {
    if (client) {
      client.close()
    }
  }
}

function parseSseEvent(raw: string): { event: string; data: any } | null {
  if (!raw.trim()) return null
  const lines = raw.split(/\r?\n/)
  let event = "message"
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith(":")) continue
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  const dataString = dataLines.join("\n")
  if (!dataString) {
    return { event, data: null }
  }

  try {
    return { event, data: JSON.parse(dataString) }
  } catch {
    return { event, data: dataString }
  }
}

export async function postIngest(payload: {
  path_or_url: string
  from_web?: boolean
  recursive?: boolean
  tags?: string[]
  use_examples_dir?: boolean
}): Promise<IngestResponse> {
  return apiFetch<IngestResponse>("/v1/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function postIngestUpload(files: File[], tags?: string[]): Promise<IngestResponse> {
  const formData = new FormData()
  files.forEach((file) => formData.append("files", file))
  if (tags && tags.length > 0) {
    tags.forEach((tag) => formData.append("tags", tag))
  }

  const response = await fetch(resolveUrl("/v1/ingest/upload"), {
    method: "POST",
    headers: buildHeaders({
      // Allow browser to set multipart boundaries automatically
      "X-API-Key": DEFAULT_API_KEY,
    }),
    body: formData,
    credentials: "include",
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  return response.json() as Promise<IngestResponse>
}

export async function getSessions(limit = 50): Promise<Session[]> {
  const data = await apiFetch<{ sessions: Session[] }>(`/v1/sessions?limit=${limit}`)
  return data.sessions
}

export async function deleteSession(sessionId: number): Promise<void> {
  await apiFetch(`/v1/sessions/${sessionId}`, { method: "DELETE" })
}

export async function getDocuments(collection?: string, limit = 100, offset = 0) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (collection) {
    params.set("collection", collection)
  }
  const data = await apiFetch<{ documents: DocumentItem[]; total: number }>(`/v1/documents?${params.toString()}`)
  return data
}

export async function deleteDocument(documentId: number): Promise<void> {
  await apiFetch(`/v1/documents/${documentId}`, { method: "DELETE" })
}

export async function getIngestionRuns(limit = 50, offset = 0) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  const data = await apiFetch<{ runs: IngestionRun[]; total: number }>(`/v1/ingestion-runs?${params.toString()}`)
  return data
}

export async function deleteIngestionRun(runId: number): Promise<void> {
  await apiFetch(`/v1/ingestion-runs/${runId}`, { method: "DELETE" })
}
