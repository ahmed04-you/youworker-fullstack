import { apiRequest } from './client'
import { getCsrfToken } from './auth'
import type { Message, Session, ChatRequest } from '@/src/lib/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function getSessions(): Promise<Session[]> {
  return apiRequest<Session[]>('/v1/sessions')
}

export async function getSession(sessionId: string): Promise<Session> {
  return apiRequest<Session>(`/v1/sessions/${sessionId}`)
}

export async function createSession(title?: string): Promise<Session> {
  const csrfToken = await getCsrfToken()

  return apiRequest<Session>('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({ title }),
    csrfToken,
  })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest(`/v1/sessions/${sessionId}`, {
    method: 'DELETE',
    csrfToken,
  })
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  return apiRequest<Message[]>(`/v1/sessions/${sessionId}/messages`)
}

// For streaming responses, use Server-Sent Events
export async function* streamChat(
  request: ChatRequest
): AsyncGenerator<string, void, unknown> {
  const csrfToken = await getCsrfToken()

  const response = await fetch(`${API_BASE_URL}/v1/unified-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(request),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Stream failed')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No reader available')
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              yield parsed.content
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
