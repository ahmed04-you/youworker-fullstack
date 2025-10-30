'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { GlassButton } from './ui/glass/GlassButton'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <GlassButton
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      icon={theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </GlassButton>
  )
}
