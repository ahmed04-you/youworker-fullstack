'use client'

import { useState, useEffect } from 'react'
import {
  getDocuments,
  uploadDocument,
  deleteDocument as deleteDocumentApi,
  searchDocuments as searchDocumentsApi,
} from '@/src/lib/api/documents'
import type { Document, DocumentSearchRequest, DocumentSearchResult } from '@/src/lib/types'

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
      setError(err as Error)
      console.error('Failed to load documents:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const upload = async (file: File, metadata?: Record<string, any>): Promise<Document> => {
    try {
      const document = await uploadDocument(file, metadata)
      setDocuments(prev => [document, ...prev])
      return document
    } catch (err) {
      setError(err as Error)
      console.error('Failed to upload document:', err)
      throw err
    }
  }

  const deleteDocument = async (documentId: string): Promise<void> => {
    try {
      await deleteDocumentApi(documentId)
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    } catch (err) {
      setError(err as Error)
      console.error('Failed to delete document:', err)
      throw err
    }
  }

  const searchDocuments = async (request: DocumentSearchRequest): Promise<DocumentSearchResult[]> => {
    try {
      return await searchDocumentsApi(request)
    } catch (err) {
      setError(err as Error)
      console.error('Failed to search documents:', err)
      throw err
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
