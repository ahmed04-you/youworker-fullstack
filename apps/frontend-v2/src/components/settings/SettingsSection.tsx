'use client'

import { ReactNode } from 'react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'

interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
  icon?: ReactNode
}

export function SettingsSection({ title, description, children, icon }: SettingsSectionProps) {
  return (
    <GlassCard variant="card" className="p-6">
      <div className="flex items-start gap-3 mb-4">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-brand flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
          {description && (
            <p className="text-sm text-white/60">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </GlassCard>
  )
}

interface SettingItemProps {
  label: string
  description?: string
  children: ReactNode
}

export function SettingItem({ label, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--color-glass-dark)] last:border-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-white block mb-1">
          {label}
        </label>
        {description && (
          <p className="text-xs text-white/50">{description}</p>
        )}
      </div>
      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}
