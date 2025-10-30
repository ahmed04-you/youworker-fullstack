'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { Menu, Bell, Search } from 'lucide-react'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'

interface TopBarProps {
  onMenuClick: () => void
  showMenuButton?: boolean
}

export function TopBar({ onMenuClick, showMenuButton = true }: TopBarProps) {
  return (
    <header className="h-16 border-b border-[var(--color-glass-dark)]/30">
      <GlassCard variant="light" className="h-full rounded-none flex items-center justify-between px-4">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg hover:bg-[var(--color-glass-white)]/5 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5 text-white/70" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-white">YouWorker AI</h1>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Search className="w-4 h-4" />}
          />

          <GlassButton
            variant="ghost"
            size="sm"
            icon={<Bell className="w-4 h-4" />}
          />
        </div>
      </GlassCard>
    </header>
  )
}
