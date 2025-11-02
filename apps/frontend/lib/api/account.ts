import { apiDelete, apiPost, API_BASE_URL } from './client';
import type { ApiKeyRotateResponse, HistoryPurgeSummary } from '../types';
import { ApiClientError } from './client';

function withCsrf(csrfToken?: string): HeadersInit | undefined {
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined;
}

export async function rotateApiKey(csrfToken?: string): Promise<ApiKeyRotateResponse> {
  return apiPost<ApiKeyRotateResponse>(
    '/v1/account/api-key/rotate',
    undefined,
    {
      headers: withCsrf(csrfToken),
    }
  );
}

export async function purgeHistory(csrfToken?: string): Promise<HistoryPurgeSummary> {
  return apiDelete<HistoryPurgeSummary>(
    '/v1/account/history',
    {
      headers: withCsrf(csrfToken),
    }
  );
}

export async function exportAccountSnapshot(): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/v1/account/export`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new ApiClientError(text || `HTTP ${response.status}`, response.status, {
      message: text || response.statusText || 'Failed to export account',
    });
  }

  return response.blob();
}

export async function deleteAccount(csrfToken?: string): Promise<void> {
  await apiDelete<void>(
    '/v1/account',
    {
      headers: withCsrf(csrfToken),
    }
  );
}
