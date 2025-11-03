/**
 * Shared TypeScript types for API requests and responses
 */

// ============================================================================
// Authentication Types
// ============================================================================

export interface User {
  id?: number;
  username: string;
  email?: string;
  created_at?: string;
  is_active?: boolean;
  is_root?: boolean;
  authenticated?: boolean;
}

export interface LoginResponse {
  message: string;
  username: string;
  expires_in?: number;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  tool_call_name?: string | null;
  tool_call_id?: string | null;
  tempId?: string;
}

export interface ChatSession {
  id: number;
  external_id?: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  model?: string | null;
  enable_tools?: boolean;
  message_count?: number;
  messages?: Message[];
}

export interface ChatRequest {
  messages: Message[];
  session_id?: string;
  enable_tools?: boolean;
  model?: string;
  stream?: boolean;
}

export interface SimpleChatRequest {
  message: string;
  session_id?: string;
  messages?: Message[];
  model?: string;
  enable_tools?: boolean;
  expect_audio?: boolean;
  max_iterations?: number;
}

export interface SimpleChatResponse {
  content: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  tool_events?: ToolEvent[];
  logs?: LogEvent[];
}

export interface UnifiedChatRequest {
  text_input?: string;
  audio_b64?: string;
  sample_rate?: number;
  messages?: Message[];
  session_id?: string;
  enable_tools?: boolean;
  model?: string;
  expect_audio?: boolean;
  stream?: boolean;
}

export interface UnifiedChatResponse {
  content?: string;
  transcript?: string;
  metadata?: Record<string, unknown>;
  audio_b64?: string;
  audio_sample_rate?: number;
  stt_confidence?: number;
  stt_language?: string;
  tool_events?: ToolEvent[];
  logs?: LogEvent[];
}

export interface ToolEvent {
  tool: string;
  status: string;
  run_id?: number;
  latency_ms?: number;
  args?: Record<string, unknown>;
  result_preview?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface LogEvent {
  level: string;
  msg: string;
  timestamp?: string;
}

// ============================================================================
// Session Management Types
// ============================================================================

export interface SessionListResponse {
  sessions: ChatSession[];
  total?: number;
}

export interface SessionDetailResponse {
  session: ChatSession;
  messages: Message[];
  tool_events?: ToolEvent[];
}

export interface UpdateSessionRequest {
  title?: string;
}

// ============================================================================
// Document & Ingestion Types
// ============================================================================

export interface DocumentRecord {
  id: number;
  uri?: string | null;
  path?: string | null;
  mime?: string | null;
  bytes_size?: number | null;
  source?: string | null;
  tags?: string[] | null;
  collection?: string | null;
  path_hash?: string | null;
  created_at: string;
  last_ingested_at?: string | null;
}

export interface DocumentListResponse {
  documents: DocumentRecord[];
  total: number;
}

export interface IngestionRun {
  id: number;
  target?: string | null;
  from_web?: boolean;
  recursive?: boolean;
  tags?: string[] | null;
  collection?: string | null;
  totals_files?: number | null;
  totals_chunks?: number | null;
  errors?: string[] | null;
  started_at: string;
  finished_at?: string | null;
  status: string;
}

export interface IngestionRunListResponse {
  runs: IngestionRun[];
  total: number;
}

export interface ToolRun {
  id: number;
  tool_name: string;
  status: string;
  start_ts: string;
  end_ts?: string | null;
  latency_ms?: number | null;
  args?: Record<string, unknown> | null;
  error_message?: string | null;
  result_preview?: unknown;
}

export interface ToolRunListResponse {
  runs: ToolRun[];
  total: number;
}

export interface IngestedFile {
  path?: string;
  collection?: string;
  chunks?: number;
  bytes_size?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface IngestResponse {
  success: boolean;
  files_processed: number;
  chunks_written: number;
  totals: {
    files: number;
    chunks: number;
    total_bytes: number;
  };
  files: IngestedFile[];
  errors?: string[] | null;
}

// ============================================================================
// SSE Event Types
// ============================================================================

export interface SSELogEvent {
  level: 'info' | 'error' | 'warning' | 'debug';
  msg: string;
}

export interface SSETokenEvent {
  text?: string;
}

export interface SSEToolEvent extends ToolEvent {}

export interface SSEDoneEvent {
  content?: string;
  transcript?: string;
  metadata?: Record<string, unknown>;
  audio_b64?: string;
  audio_sample_rate?: number;
  stt_confidence?: number;
  stt_language?: string;
  tool_events?: ToolEvent[];
  logs?: LogEvent[];
}

export interface SSETranscriptEvent {
  text?: string;
  language?: string | null;
  confidence?: number | null;
  word?: string;
  partial?: boolean;
  is_final?: boolean;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  server?: string;
}

export interface ToolsResponse {
  tools: MCPTool[];
}

// ============================================================================
// Account Types
// ============================================================================

export interface ApiKeyRotateResponse {
  api_key: string;
  message?: string;
}

export interface ExportDataResponse {
  user: User;
  sessions: ChatSession[];
  created_at: string;
}

export interface HistoryPurgeSummary {
  sessions_deleted: number;
  messages_deleted: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

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

export interface TokenTimelineEntry {
  period: string;
  tokens_in: number;
  tokens_out: number;
  total_tokens: number;
  message_count: number;
}

export interface TokenTimelineResponse {
  interval: 'hour' | 'day' | 'week';
  data: TokenTimelineEntry[];
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
  interval: 'hour' | 'day' | 'week';
  data: ToolTimelineEntry[];
}

export interface IngestionTimelineEntry {
  period: string;
  run_count: number;
  total_files: number;
  total_chunks: number;
  success_count: number;
  success_rate: number;
}

export interface CollectionStatsEntry {
  collection: string;
  document_count: number;
  total_bytes: number;
  total_mb: number;
}

export interface IngestionStatsResponse {
  timeline: IngestionTimelineEntry[];
  by_collection: CollectionStatsEntry[];
}

export interface SessionActivityEntry {
  period: string;
  session_count: number;
  tools_enabled_count: number;
  tools_enabled_rate: number;
}

export interface SessionModelStatsEntry {
  model: string;
  session_count: number;
}

export interface SessionActivityResponse {
  timeline: SessionActivityEntry[];
  by_model: SessionModelStatsEntry[];
}

// ============================================================================
// Group Types
// ============================================================================

export interface Group {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export interface GroupMember {
  user_id: number;
  username: string;
  role: string;
  joined_at: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}
