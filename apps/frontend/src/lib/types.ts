export type Role = "user" | "assistant" | "system";

export interface SessionSummary {
  id: number;
  external_id: string | null;
  title: string | null;
  model: string | null;
  enable_tools: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionMessage {
  id: number;
  role: Role;
  content: string;
  tool_call_name?: string | null;
  tool_call_id?: string | null;
  created_at: string;
}

export interface SessionDetail {
  session: SessionSummary & {
    messages: SessionMessage[];
  };
}

export interface DocumentRecord {
  id: number;
  uri: string | null;
  path: string | null;
  mime: string | null;
  bytes_size: number | null;
  source: string | null;
  tags: { tags: string[] } | null;
  collection: string | null;
  path_hash: string | null;
  created_at: string;
  last_ingested_at: string | null;
}

export interface DocumentsResponse {
  documents: DocumentRecord[];
  total: number;
}

export interface IngestionRunRecord {
  id: number;
  target: string;
  from_web: boolean;
  recursive: boolean;
  tags: { tags: string[] } | null;
  collection: string | null;
  totals_files: number;
  totals_chunks: number;
  errors: { errors: string[] } | null;
  started_at: string;
  finished_at: string | null;
  status: string;
}

export interface IngestionRunsResponse {
  runs: IngestionRunRecord[];
  total: number;
}

export interface ToolRunRecord {
  id: number;
  tool_name: string;
  status: string;
  start_ts: string;
  end_ts: string | null;
  latency_ms: number | null;
  args: Record<string, unknown> | null;
  error_message: string | null;
  result_preview: string | null;
}

export interface ToolRunsResponse {
  runs: ToolRunRecord[];
  total: number;
}

export interface OverviewMetrics {
  period_days: number;
  sessions: {
    total: number;
    avg_per_day: number;
  };
  messages: {
    total: number;
    avg_per_session: number;
  };
  tokens: {
    total: number;
    avg_per_message: number;
  };
  tools: {
    total_runs: number;
    success_rate: number;
    avg_latency_ms: number;
  };
  documents: {
    total: number;
  };
  ingestion: {
    total_runs: number;
  };
}

export interface TokensTimelinePoint {
  period: string;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  message_count: number;
}

export interface TokensTimelineResponse {
  interval: string;
  data: TokensTimelinePoint[];
}

export interface ToolPerformanceEntry {
  tool_name: string;
  total_runs: number;
  successful_runs: number;
  success_rate: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
}

export interface ToolPerformanceResponse {
  data: ToolPerformanceEntry[];
}

export interface ToolTimelineEntry {
  period: string;
  tool_name: string;
  run_count: number;
  success_count: number;
  success_rate: number;
}

export interface ToolTimelineResponse {
  interval: string;
  data: ToolTimelineEntry[];
}

export interface SessionActivityEntry {
  period: string;
  session_count: number;
  tools_enabled_count: number;
  tools_enabled_rate: number;
}

export interface SessionActivityResponse {
  timeline: SessionActivityEntry[];
  by_model: {
    model: string | null;
    session_count: number;
  }[];
}

export interface IngestionTimelineEntry {
  period: string;
  run_count: number;
  total_files: number;
  total_chunks: number;
  success_count: number;
  success_rate: number;
}

export interface IngestionCollectionEntry {
  collection: string;
  document_count: number;
  total_bytes: number;
  total_mb: number;
}

export interface IngestionStatsResponse {
  timeline: IngestionTimelineEntry[];
  by_collection: IngestionCollectionEntry[];
}

export interface UnifiedChatStreamPayload {
  content?: string;
  transcript?: string | null;
  metadata?: Record<string, unknown>;
  audio_b64?: string | null;
  audio_sample_rate?: number | null;
  stt_confidence?: number | null;
  stt_language?: string | null;
  tool_events?: Record<string, unknown>[] | null;
  logs?: Record<string, string>[] | null;
  assistant_language?: string | null;
  final_text?: string;
}

export interface ChatToolEvent {
  tool: string;
  status: string;
  args?: Record<string, unknown>;
  latency_ms?: number;
  result_preview?: string;
  ts?: string;
}

export interface ChatLogEntry {
  level: string;
  msg: string;
  assistant_language?: string;
}
