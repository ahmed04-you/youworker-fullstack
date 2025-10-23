export type ChatRole = "user" | "assistant" | "system" | "tool"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface ToolEventPayload {
  tool?: string
  status?: string
  ts?: string
  args?: unknown
  result_preview?: string | null
  latency_ms?: number | null
  run_id?: string | number | null
  tool_call_id?: string | null
  [key: string]: unknown
}

export type ToolRunStatus = "running" | "success" | "error" | "cached"

export interface ToolRunUpdate {
  id: string
  status: string
  timestamp: string
  payload: ToolEventPayload
}

export interface ToolRun {
  id: string
  tool: string
  status: ToolRunStatus
  startedAt?: string
  completedAt?: string
  latencyMs?: number | null
  resultPreview?: string | null
  updates: ToolRunUpdate[]
}

export interface Thread {
  id: string
  sessionId: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
  metadata: Record<string, unknown>
  toolEvents: ToolRun[]
}

export interface UnifiedChatRequestPayload {
  messages: Array<Pick<ChatMessage, "role" | "content">>
  text_input?: string | null
  audio_b64?: string | null
  expect_audio?: boolean
  enable_tools?: boolean
  session_id?: string | null
  stream?: boolean
  model?: string | null
  sample_rate?: number
}

export interface UnifiedChatResponsePayload {
  content: string
  transcript?: string | null
  metadata: Record<string, unknown>
  audio_b64?: string | null
  audio_sample_rate?: number | null
  stt_confidence?: number | null
  stt_language?: string | null
  tool_events?: ToolEventPayload[]
  logs?: Array<{ level: string; msg: string }>
}

export interface UnifiedChatStreamCallbacks {
  onToken?: (data: { text: string }) => void
  onTool?: (data: ToolEventPayload) => void
  onLog?: (data: { level: string; msg: string }) => void
  onHeartbeat?: () => void
  onDone?: (data: UnifiedChatResponsePayload) => void
  onError?: (error: Error) => void
}

export interface IngestedFile {
  path?: string
  uri?: string
  mime?: string
  size_bytes?: number
  chunks?: number
  error?: string | null
  [key: string]: unknown
}

export interface IngestResponse {
  success: boolean
  files_processed: number
  chunks_written: number
  totals: {
    files: number
    chunks: number
    total_bytes: number
  }
  files: IngestedFile[]
  errors: string[]
}

export interface Session {
  id: number
  external_id: string | null
  title: string | null
  model: string | null
  enable_tools: boolean
  created_at: string
  updated_at: string
}

export interface DocumentItem {
  id: number
  uri: string | null
  path: string | null
  mime: string | null
  bytes_size: number | null
  source: string | null
  tags: string[] | null
  collection: string | null
  path_hash: string | null
  created_at: string
  last_ingested_at: string | null
}

export interface IngestionRun {
  id: number
  target: string
  from_web: boolean
  recursive: boolean
  tags: string[] | null
  collection: string | null
  totals_files: number
  totals_chunks: number
  errors: string[] | null
  started_at: string
  finished_at: string | null
  status: string
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy"
  components: {
    mcp_servers: {
      healthy: string[]
      unhealthy: string[]
      total: number
    }
    voice: {
      mode: string
      stt_available: boolean
      tts_available: boolean
    }
    database: string
    agent: string
  }
}
