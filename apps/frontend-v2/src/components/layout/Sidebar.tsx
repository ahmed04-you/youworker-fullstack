'use client'

import { cn } from '@/src/lib/utils'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { MessageSquare, FileText, Settings, Plus, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useChatSessions } from '@/src/lib/hooks/useChatSessions'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { sessions, createSession } = useChatSessions()

  const navItems = [
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/documents', icon: FileText, label: 'Documents' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const handleNewChat = async () => {
    const session = await createSession()
    // Navigate to new session would be handled by the parent
  }

  return (
    <aside
      className={cn(
        'relative h-full transition-all duration-300 ease-out',
        open ? 'w-80' : 'w-16'
      )}
    >
      {/* Glass sidebar container */}
      <GlassCard
        variant="heavy"
        className="h-full rounded-none border-r border-[var(--color-glass-dark)] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[var(--color-glass-dark)]/50">
          {open && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center font-bold text-white text-sm">
                Y
              </div>
              <span className="font-semibold text-white">YouWorker AI</span>
            </div>
          )}

          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-[var(--color-glass-white)]/5 transition-colors"
          >
            <ChevronLeft
              className={cn(
                'w-5 h-5 text-white/70 transition-transform',
                !open && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* New chat button */}
          <GlassButton
            variant="primary"
            className="w-full justify-start"
            onClick={handleNewChat}
            icon={<Plus className="w-4 h-4" />}
          >
            {open && 'New Chat'}
          </GlassButton>

          <div className="h-4" />

          {/* Main navigation */}
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <GlassButton
                variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  pathname.startsWith(href) && 'bg-[var(--color-glass-white)]/10'
                )}
                icon={<Icon className="w-4 h-4" />}
              >
                {open && label}
              </GlassButton>
            </Link>
          ))}

          {/* Session list */}
          {open && sessions.length > 0 && (
            <>
              <div className="pt-4 pb-2">
                <p className="text-xs font-medium text-white/50 px-2">Recent Chats</p>
              </div>

              {sessions.slice(0, 10).map((session) => (
                <Link key={session.id} href={`/chat/${session.id}`}>
                  <GlassButton
                    variant="ghost"
                    className="w-full justify-start truncate"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    {session.title || 'New conversation'}
                  </GlassButton>
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        {open && (
          <div className="p-4 border-t border-[var(--color-glass-dark)]/50">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-[#454055]/30 hover:bg-[#454055]/40 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white text-xs">
                UN
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">User Name</p>
                <p className="text-xs text-white/50">user@email.com</p>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </aside>
  )
}
