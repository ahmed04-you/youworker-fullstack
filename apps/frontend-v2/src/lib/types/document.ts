export interface Document {
  id: string
  title: string
  file_name: string
  file_type: string
  file_size: number
  created_at: string
  updated_at: string
  status: 'processing' | 'ready' | 'failed'
  chunk_count?: number
  metadata?: Record<string, unknown>
}

export interface DocumentUploadRequest {
  file: File
  metadata?: Record<string, unknown>
}

export interface DocumentSearchRequest {
  query: string
  limit?: number
  filters?: Record<string, unknown>
}

export interface DocumentSearchResult {
  document_id: string
  chunk_id: string
  content: string
  score: number
  metadata?: Record<string, unknown>
}
