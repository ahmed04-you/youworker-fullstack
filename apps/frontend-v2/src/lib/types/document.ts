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
  metadata?: Record<string, any>
}

export interface DocumentUploadRequest {
  file: File
  metadata?: Record<string, any>
}

export interface DocumentSearchRequest {
  query: string
  limit?: number
  filters?: Record<string, any>
}

export interface DocumentSearchResult {
  document_id: string
  chunk_id: string
  content: string
  score: number
  metadata?: Record<string, any>
}
