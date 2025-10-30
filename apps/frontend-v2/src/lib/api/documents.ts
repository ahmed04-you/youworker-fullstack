import { apiRequest } from './client'
import { getCsrfToken } from './auth'
import type { Document, DocumentSearchRequest, DocumentSearchResult } from '@/lib/types'

export async function getDocuments(): Promise<Document[]> {
  return apiRequest<Document[]>('/v1/documents')
}

export async function getDocument(documentId: string): Promise<Document> {
  return apiRequest<Document>(`/v1/documents/${documentId}`)
}

export async function uploadDocument(file: File, metadata?: Record<string, any>): Promise<Document> {
  const csrfToken = await getCsrfToken()

  const formData = new FormData()
  formData.append('file', file)
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata))
  }

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const response = await fetch(`${API_BASE_URL}/v1/documents/upload`, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    body: formData,
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }

  return response.json()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest(`/v1/documents/${documentId}`, {
    method: 'DELETE',
    csrfToken,
  })
}

export async function searchDocuments(request: DocumentSearchRequest): Promise<DocumentSearchResult[]> {
  return apiRequest<DocumentSearchResult[]>('/v1/documents/search', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
