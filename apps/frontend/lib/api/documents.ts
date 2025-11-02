import { apiDelete, apiGet } from './client';
import type { DocumentListResponse } from '../types';

export async function listDocuments(params: {
  collection?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<DocumentListResponse> {
  const { collection, limit = 100, offset = 0 } = params;
  const search = new URLSearchParams();
  if (collection) {
    search.append('collection', collection);
  }
  if (limit !== undefined) {
    search.append('limit', String(limit));
  }
  if (offset) {
    search.append('offset', String(offset));
  }
  const query = search.toString();

  return apiGet<DocumentListResponse>(`/v1/documents${query ? `?${query}` : ''}`);
}

export async function deleteDocument(documentId: number, csrfToken?: string): Promise<void> {
  await apiDelete<void>(`/v1/documents/${documentId}`, {
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}
