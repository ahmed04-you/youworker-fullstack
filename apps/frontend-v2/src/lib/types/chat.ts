export interface MessageMetadata {
  model?: string
  tokens?: number
  latency?: number
  contextDocuments?: string[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: MessageMetadata
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

export interface ChatModel {
  id: string
  name: string
  description?: string
  context_length?: number
  parameters?: string
}
