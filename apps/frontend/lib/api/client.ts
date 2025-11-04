/**
 * Base API client for making requests to the backend
 */

const FALLBACK_INTERNAL_URL = 'http://api:8001';
const FALLBACK_PUBLIC_URL = 'http://localhost:8001';

const LOCAL_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /\.local$/i,
];

function parseHostname(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname?: string | null): boolean {
  if (!hostname) {
    return false;
  }
  return LOCAL_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

function resolveBrowserBaseUrl(envBase?: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const origin = window.location.origin;
  const envHost = parseHostname(envBase);
  const originHost = parseHostname(origin);

  if (!envBase) {
    return origin;
  }

  if (envHost && originHost && isLocalHostname(envHost) && !isLocalHostname(originHost)) {
    return origin;
  }

  return envBase;
}

function resolveServerBaseUrl(envInternal?: string, envPublic?: string): string {
  const candidate = envInternal || envPublic;
  const nodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;

  if (candidate) {
    const candidateHost = parseHostname(candidate);
    if (candidateHost && !isLocalHostname(candidateHost)) {
      return candidate;
    }

    if (candidateHost && isLocalHostname(candidateHost) && nodeEnv === 'production') {
      return FALLBACK_INTERNAL_URL;
    }

    if (!candidateHost) {
      return candidate;
    }
  }

  if (envInternal && isLocalHostname(parseHostname(envInternal))) {
    return FALLBACK_INTERNAL_URL;
  }

  return candidate || FALLBACK_INTERNAL_URL;
}

// Use internal URL for server-side requests (SSR in Docker), public URL for client-side (browser)
const API_BASE_URL = (() => {
  const envInternal = process.env.NEXT_INTERNAL_API_BASE_URL;
  const envPublic = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (typeof window === 'undefined') {
    return resolveServerBaseUrl(envInternal, envPublic);
  }

  return resolveBrowserBaseUrl(envPublic) || FALLBACK_PUBLIC_URL;
})();

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
