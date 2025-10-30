const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

interface RequestOptions extends RequestInit {
  authenticated?: boolean
  csrfToken?: string
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { authenticated = true, csrfToken, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Add CSRF token for state-changing operations
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method || 'GET')) {
    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Important for cookie-based auth
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(
      error.detail || 'Request failed',
      response.status,
      error.code
    )
  }

  // Handle empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null as T
  }

  return response.json()
}
