'use client'

import { ReactNode, useState } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import { useMediaQuery } from '@/src/lib/hooks/useMediaQuery'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-[#1F1B29] via-[#2D2938] to-[#454055]">
      {/* Animated background elements - Brand colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E32D21]/8 rounded-full blur-3xl animate-glass-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5A5566]/10 rounded-full blur-3xl animate-glass-float [animation-delay:1s]" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-[#C41E14]/6 rounded-full blur-3xl animate-glass-float [animation-delay:2s]" />
      </div>

      <div className="relative z-10 flex h-full">
        {/* Sidebar */}
        {!isMobile && (
          <Sidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <TopBar
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            showMenuButton={!isMobile}
          />

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {/* Mobile navigation */}
        {isMobile && <MobileNav />}
      </div>
    </div>
  )
}
