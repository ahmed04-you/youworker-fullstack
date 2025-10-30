import { apiRequest } from './client'
import type { LoginResponse, CSRFTokenResponse } from '@/lib/types'

export async function getCsrfToken(): Promise<string> {
  const response = await apiRequest<CSRFTokenResponse>('/v1/auth/csrf-token', {
    authenticated: false,
  })
  return response.csrf_token
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  // First, get CSRF token
  const csrfToken = await getCsrfToken()

  // Then perform login
  return apiRequest<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    authenticated: false,
    csrfToken,
  })
}

export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest('/v1/auth/logout', {
    method: 'POST',
    csrfToken,
  })
}

export async function checkAuth(): Promise<boolean> {
  try {
    await apiRequest('/v1/auth/me')
    return true
  } catch {
    return false
  }
}
