import { APP_CONFIG, API_RETRY_CONFIG } from '@/src/lib/constants/app'
import { errorTracker } from '@/src/lib/utils/errorTracking'

const API_BASE_URL = APP_CONFIG.api.baseUrl

// Simulated Authentik API key for development
// In production, Authentik will inject this header automatically
const DEV_AUTHENTIK_API_KEY = process.env.NEXT_PUBLIC_API_KEY || ''

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RetryConfig {
  attempts: number
  delay: number
  backoff: 'exponential' | 'linear'
}

interface RequestOptions extends RequestInit {
  authenticated?: boolean
  csrfToken?: string
  retry?: RetryConfig
  timeout?: number
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = APP_CONFIG.api.timeout
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408, 'TIMEOUT')
    }
    throw error
  }
}

async function retryFetch<T>(
  fn: () => Promise<T>,
  retryConfig?: RetryConfig
): Promise<T> {
  if (!retryConfig) return fn()

  let lastError: Error

  for (let attempt = 0; attempt <= retryConfig.attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error
      }

      if (attempt < retryConfig.attempts) {
        const delay = retryConfig.backoff === 'exponential'
          ? retryConfig.delay * Math.pow(2, attempt)
          : retryConfig.delay * (attempt + 1)

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError!
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    csrfToken,
    retry,
    timeout = APP_CONFIG.api.timeout,
    ...fetchOptions
  } = options

  return retryFetch(async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    }

    // Add CSRF token for state-changing operations
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || 'GET')) {
      headers['X-CSRF-Token'] = csrfToken
    }

    // Simulate Authentik headers for development/testing
    // In production, Authentik proxy will inject these headers automatically
    if (DEV_AUTHENTIK_API_KEY) {
      headers['X-Authentik-Api-Key'] = DEV_AUTHENTIK_API_KEY
      // Optional: simulate username header (defaults to 'root' in backend if not provided)
      // headers['X-Authentik-Username'] = 'dev-user'
    }

    const response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      { ...fetchOptions, headers, credentials: 'include' },
      timeout
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: response.statusText || 'Unknown error',
      }))

      const apiError = new ApiError(
        error.detail || 'Request failed',
        response.status,
        error.code
      )

      // Track errors in production
      errorTracker.captureError(apiError, {
        component: 'apiRequest',
        action: fetchOptions.method || 'GET',
        metadata: { endpoint, status: response.status }
      })

      throw apiError
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null as T
    }

    return response.json()
  }, retry)
}

export { API_RETRY_CONFIG }
