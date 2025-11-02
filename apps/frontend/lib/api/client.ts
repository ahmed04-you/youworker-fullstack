/**
 * Base API client for making requests to the backend
 */

// Use internal URL for server-side requests (SSR in Docker), public URL for client-side (browser)
const API_BASE_URL = typeof window === 'undefined'
  ? (process.env.NEXT_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001')
  : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001');

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public apiError?: ApiError
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Base fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions: RequestInit = {
    credentials: 'include', // Important: include cookies for JWT
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let apiError: ApiError | undefined;

      try {
        const errorData = await response.json();
        apiError = errorData.error || { message: errorData.message || errorData.detail || 'Unknown error' };
      } catch (parseError) {
        const errorText = await response.text().catch(() => response.statusText);
        apiError = { message: errorText || response.statusText || `HTTP ${response.status}` };
      }

      const resolvedError: ApiError = apiError ?? {
        message: `HTTP ${response.status}`,
      };

      console.error(`API Error [${response.status}]:`, resolvedError);

      throw new ApiClientError(
        resolvedError.message || `HTTP ${response.status}`,
        response.status,
        resolvedError
      );
    }

    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text() as T;
  } catch (error) {
    // Network error or fetch failed
    if (error instanceof ApiClientError) {
      throw error;
    }

    console.error('Network error:', error);
    throw new ApiClientError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      { message: 'Failed to connect to the server' }
    );
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  endpoint: string,
  data?: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: unknown,
  options?: RequestInit
): Promise<T> {
  return apiFetch<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(endpoint, { ...options, method: 'DELETE' });
}

export { API_BASE_URL };
