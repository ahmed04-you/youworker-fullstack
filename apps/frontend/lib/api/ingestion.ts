import { apiDelete, apiGet, apiPost, API_BASE_URL, ApiClientError } from './client';
import type { IngestResponse, IngestionRunListResponse } from '../types';

function withCsrf(csrfToken?: string): HeadersInit | undefined {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined;
}

export interface IngestPathRequest {
  path_or_url: string;
  from_web?: boolean;
  recursive?: boolean;
  tags?: string[];
}

export async function ingestPath(
  request: IngestPathRequest,
  csrfToken?: string
): Promise<IngestResponse> {
  return apiPost<IngestResponse>(
    '/v1/ingest',
    {
      path_or_url: request.path_or_url,
      from_web: request.from_web ?? false,
      recursive: request.recursive ?? false,
      tags: request.tags ?? null,
    },
    {
      headers: withCsrf(csrfToken),
    }
  );
}

export async function uploadDocuments(
  files: File[] | FileList,
  options: {
    tags?: string[];
    csrfToken?: string;
  } = {}
): Promise<IngestResponse> {
  const { tags, csrfToken } = options;

  const formData = new FormData();
  const iterable = files instanceof FileList ? Array.from(files) : files;
  iterable.forEach((file) => formData.append('files', file));
  (tags ?? []).forEach((tag) => formData.append('tags', tag));

  const response = await fetch(`${API_BASE_URL}/v1/ingest/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: withCsrf(csrfToken),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new ApiClientError(text || `HTTP ${response.status}`, response.status, {
      message: text || response.statusText || 'Failed to upload documents',
    });
  }

  return response.json();
}

export async function listIngestionRuns(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<IngestionRunListResponse> {
  const { limit = 50, offset = 0 } = params;
  const query = new URLSearchParams();
  if (limit !== undefined) {
    query.append('limit', String(limit));
  }
  if (offset) {
    query.append('offset', String(offset));
  }

  return apiGet<IngestionRunListResponse>(
    `/v1/ingestion-runs${query.toString() ? `?${query.toString()}` : ''}`
  );
}

export async function deleteIngestionRun(runId: number, csrfToken?: string): Promise<void> {
  await apiDelete<void>(`/v1/ingestion-runs/${runId}`, {
    headers: withCsrf(csrfToken),
  });
}
