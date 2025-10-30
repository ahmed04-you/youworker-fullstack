'use client'

import { useEffect } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Function to update theme
    const updateTheme = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('settings') || '{}')
        const theme = settings.theme || 'dark'
        document.documentElement.setAttribute('data-theme', theme)
      } catch (e) {
        console.error('Failed to update theme:', e)
      }
    }

    // Listen for storage changes (from other tabs/windows)
    window.addEventListener('storage', updateTheme)

    // Listen for custom theme change events (from same tab)
    window.addEventListener('theme-change', updateTheme)

    return () => {
      window.removeEventListener('storage', updateTheme)
      window.removeEventListener('theme-change', updateTheme)
    }
  }, [])

  return <>{children}</>
}
