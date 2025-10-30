import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicPage = request.nextUrl.pathname === '/'

  // Redirect to login if not authenticated
  if (!authToken && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to chat if authenticated and trying to access login
  if (authToken && isAuthPage) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
