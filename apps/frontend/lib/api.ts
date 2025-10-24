"use client"

import type { DocumentItem, IngestResponse, IngestionRun, Session, HealthResponse } from "@/lib/types"

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
