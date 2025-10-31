import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware for Authentik SSO integration.
 *
 * Since we use Authentik SSO exclusively, there's no login page to redirect to.
 * Authentication happens automatically via the AuthInit component which calls
 * /v1/auth/auto-login on app startup.
 *
 * This middleware is kept minimal - it only handles i18n and other routing logic.
 * The backend validates authentication via JWT cookie (youworker_token) or
 * Authentik headers (X-Authentik-Api-Key).
 */
export function middleware(request: NextRequest) {
  // All routes are accessible - authentication is handled by:
  // 1. Frontend: AuthInit component calls auto-login on mount
  // 2. Backend: Validates JWT cookie or Authentik headers per-request
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
