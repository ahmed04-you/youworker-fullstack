'use client'

import { useState, useEffect } from 'react'
import {
  getDocuments,
  uploadDocument,
  deleteDocument as deleteDocumentApi,
  searchDocuments as searchDocumentsApi,
} from '@/src/lib/api/documents'
import type { Document, DocumentSearchRequest, DocumentSearchResult } from '@/src/lib/types'
import { errorTracker } from '@/src/lib/utils'

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load documents on mount
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setIsLoading(true)
      const data = await getDocuments()
      setDocuments(data)
      setError(null)
    } catch (err) {
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useDocuments',
        action: 'loadDocuments'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const upload = async (file: File, metadata?: Record<string, unknown>): Promise<Document> => {
    try {
      const document = await uploadDocument(file, metadata)
      setDocuments(prev => [document, ...prev])
      return document
    } catch (err) {
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useDocuments',
        action: 'uploadDocument',
        metadata: { fileName: file.name, fileSize: file.size }
      })
      throw error
    }
  }

  const deleteDocument = async (documentId: string): Promise<void> => {
    try {
      await deleteDocumentApi(documentId)
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    } catch (err) {
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useDocuments',
        action: 'deleteDocument',
        metadata: { documentId }
      })
      throw error
    }
  }

  const searchDocuments = async (request: DocumentSearchRequest): Promise<DocumentSearchResult[]> => {
    try {
      return await searchDocumentsApi(request)
    } catch (err) {
      const error = err as Error
      setError(error)
      errorTracker.captureError(error, {
        component: 'useDocuments',
        action: 'searchDocuments',
        metadata: { query: request.query }
      })
      throw error
    }
  }

  return {
    documents,
    isLoading,
    error,
    uploadDocument: upload,
    deleteDocument,
    searchDocuments,
    refreshDocuments: loadDocuments,
  }
}
