'use client'

import { useState, useRef, useEffect } from 'react'
import { User as UserIcon, Settings, LogOut, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { User } from '@/src/lib/types'
import { cn } from '@/src/lib/utils'
import Link from 'next/link'

interface UserProfileMenuProps {
  user: User
  onLogout: () => void
}

export function UserProfileMenu({ user, onLogout }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const menuItems = [
    {
      icon: UserIcon,
      label: 'Profile',
      href: '/profile',
      onClick: () => setIsOpen(false)
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/settings',
      onClick: () => setIsOpen(false)
    },
    {
      icon: LogOut,
      label: 'Logout',
      onClick: () => {
        setIsOpen(false)
        onLogout()
      },
      danger: true
    }
  ]

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg bg-[#454055]/30 hover:bg-[#454055]/40 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center font-bold text-white text-xs shrink-0">
          {user.initials}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{user.name}</p>
          <p className="text-xs text-white/50 truncate">{user.email}</p>
        </div>

        {/* Chevron */}
        <ChevronRight
          className={cn(
            'w-4 h-4 text-white/50 transition-transform shrink-0',
            isOpen && 'rotate-90'
          )}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 animate-in slide-in-from-bottom-2 duration-200">
          <GlassCard variant="heavy" className="overflow-hidden">
            <div className="py-1">
              {menuItems.map((item, index) => (
                <div key={index}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={item.onClick}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 transition-colors',
                        'hover:bg-[var(--color-glass-white)]/10',
                        item.danger ? 'text-red-400' : 'text-white'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={item.onClick}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 transition-colors',
                        'hover:bg-[var(--color-glass-white)]/10',
                        item.danger ? 'text-red-400' : 'text-white'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
