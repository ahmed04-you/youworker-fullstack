export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface Session {
  id: string
  title?: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatRequest {
  message: string
  session_id?: string
  model?: string
  context_documents?: string[]
}

export interface Model {
  id: string
  name: string
  description?: string
  context_length?: number
  parameters?: string
}
