'use client'

import { useEffect, useState } from 'react'
import { autoLogin } from '@/src/lib/api/auth'

/**
 * AuthInit component - Initializes Authentik SSO authentication on app startup.
 *
 * This component automatically authenticates the user via Authentik SSO when the
 * application loads. In production, Authentik will inject the required headers.
 * In development, the headers are simulated using NEXT_PUBLIC_API_KEY.
 *
 * The authentication happens silently in the background. If authentication fails,
 * the error is logged but the app continues to load (as other endpoints may not
 * require authentication).
 */
export function AuthInit() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (initialized) return

    const initAuth = async () => {
      try {
        await autoLogin()
        console.log('✓ Authentik SSO authentication successful')
      } catch (error) {
        // Log but don't block - some endpoints may not require auth
        console.error('Authentik SSO authentication failed:', error)
        console.info('Application will continue - some features may require authentication')
      } finally {
        setInitialized(true)
      }
    }

    initAuth()
  }, [initialized])

  // This component doesn't render anything - it just handles auth in the background
  return null
}
