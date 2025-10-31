/**
 * Authentication module for Authentik SSO integration.
 *
 * This application uses Authentik SSO exclusively. In production, Authentik
 * will inject the required authentication headers. In development, we simulate
 * these headers using the ROOT_API_KEY from the backend.
 */

import { apiRequest } from './client'
import type { LoginResponse, CSRFTokenResponse } from '@/src/lib/types'

export async function getCsrfToken(): Promise<string> {
  const response = await apiRequest<CSRFTokenResponse>('/v1/auth/csrf-token', {
    authenticated: false,
  })
  return response.csrf_token
}

/**
 * Authenticate using Authentik SSO.
 *
 * This calls the /v1/auth/auto-login endpoint which validates the Authentik
 * headers and sets an HttpOnly JWT cookie for subsequent requests.
 *
 * In production, Authentik will automatically inject X-Authentik-Api-Key header.
 * In development, the API client simulates this header.
 */
export async function autoLogin(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/v1/auth/auto-login', {
    method: 'POST',
    authenticated: false,
  })
}

/**
 * Logout and clear authentication cookie.
 */
export async function logout(): Promise<void> {
  const csrfToken = await getCsrfToken()

  await apiRequest('/v1/auth/logout', {
    method: 'POST',
    csrfToken,
  })
}

/**
 * Check if user is authenticated by calling /me endpoint.
 * Returns true if authenticated, false otherwise.
 */
export async function checkAuth(): Promise<boolean> {
  try {
    await apiRequest('/v1/auth/me')
    return true
  } catch {
    return false
  }
}

/**
 * Get current user information.
 * Throws error if not authenticated.
 */
export async function getCurrentUser(): Promise<{ username: string; is_root: boolean }> {
  return apiRequest('/v1/auth/me')
}
