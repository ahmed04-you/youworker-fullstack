/**
 * Authentication API service
 *
 * In production: Authentik passes the API key via the X-Authentik-Api-Key header
 * In development: We simulate this using environment variables
 */

import type { LoginResponse, User } from '../types';
import { apiGet, apiPost, ApiClientError } from './client';

const FALLBACK_API_KEY = 'rotated-dev-root-key';
const DEV_API_KEY = process.env.NEXT_PUBLIC_API_KEY || FALLBACK_API_KEY;
const DEV_USERNAME = process.env.NEXT_PUBLIC_AUTHENTIK_USERNAME || 'root';

// Debug: Log what the browser actually received
if (typeof window !== 'undefined') {
  console.log('[Browser] NEXT_PUBLIC_API_KEY:', process.env.NEXT_PUBLIC_API_KEY);
  console.log('[Browser] DEV_API_KEY length:', DEV_API_KEY?.length);
  console.log('[Browser] DEV_API_KEY first 10 chars:', DEV_API_KEY?.substring(0, 10));
}

interface LoginOptions {
  apiKey?: string;
  username?: string;
}

/**
 * Build a list of API key candidates to try for authentication
 * Priority order:
 * 1. Explicitly provided API key (for development/testing)
 * 2. Environment-configured API key (NEXT_PUBLIC_API_KEY)
 * 3. Fallback development key
 */
function buildCandidateList(options: LoginOptions = {}) {
  const candidates: Array<{ apiKey: string; username: string }> = [];
  const seen = new Set<string>();

  const pushCandidate = (apiKey?: string | null, username?: string | null) => {
    if (!apiKey) return;
    const normalizedUsername = username && username.trim().length > 0 ? username : DEV_USERNAME;
    const key = `${apiKey}::${normalizedUsername}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ apiKey, username: normalizedUsername });
  };

  // Try in order: provided key, environment key, fallback key
  pushCandidate(options.apiKey, options.username);
  pushCandidate(DEV_API_KEY, options.username);
  pushCandidate(FALLBACK_API_KEY, 'root');

  return candidates;
}

/**
 * Auto-login using Authentik SSO (simulated in development)
 *
 * In production, Authentik would inject the X-Authentik-Api-Key header.
 * In development, we simulate this by passing the API key explicitly.
 */
export async function autoLogin(options: LoginOptions = {}): Promise<LoginResponse> {
  const candidates = buildCandidateList(options);

  if (candidates.length === 0) {
    throw new ApiClientError(
      'No API key configured for Authentik auto-login',
      401,
      { message: 'Missing API key' }
    );
  }

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await attemptAutoLogin(candidate.apiKey, candidate.username);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiClientError) || error.statusCode !== 401) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new ApiClientError(
    'Authentik auto-login failed',
    401,
    { message: 'Invalid Authentik credentials' }
  );
}

/**
 * Attempt auto-login with a specific API key and username
 */
async function attemptAutoLogin(apiKey: string, username: string): Promise<LoginResponse> {
  const headers: HeadersInit = {};

  // Set the Authentik API key header (both variations for compatibility)
  if (apiKey) {
    headers['x-authentik-api-key'] = apiKey;
    headers['X-Authentik-Api-Key'] = apiKey;
  }
  headers['X-Authentik-Username'] = username || DEV_USERNAME;

  console.log(
    'Attempting auto-login. username=%s keyLength=%d',
    headers['X-Authentik-Username'],
    apiKey?.length || 0
  );
  console.log('[DEBUG] Headers being sent:', JSON.stringify(headers, null, 2));
  console.log('[DEBUG] API key first 20 chars:', apiKey?.substring(0, 20));

  return apiPost<LoginResponse>('/v1/auth/auto-login', undefined, {
    headers,
  });
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  return apiGet<User>('/v1/auth/me');
}

/**
 * Logout (clear authentication cookie)
 */
export async function logout(): Promise<void> {
  await apiPost<void>('/v1/auth/logout');
}

/**
 * Get CSRF token for state-changing requests
 */
export async function getCsrfToken(): Promise<{ csrf_token: string }> {
  return apiGet<{ csrf_token: string }>('/v1/auth/csrf-token');
}
