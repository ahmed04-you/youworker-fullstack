'use client'

import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { MessageSquare, FileText, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/src/lib/utils'

export function MobileNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/documents', icon: FileText, label: 'Documents' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <GlassCard variant="heavy" className="rounded-none border-t border-[var(--color-glass-dark)]">
        <div className="flex items-center justify-around py-2 px-4">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
                  isActive
                    ? 'text-[#E32D21]'
                    : 'text-white/60 hover:text-white hover:bg-[var(--color-glass-white)]/5'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </GlassCard>
    </nav>
  )
}
