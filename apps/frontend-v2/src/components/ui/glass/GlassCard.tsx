'use client'

import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/src/lib/utils'

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'heavy' | 'light' | 'card'
  interactive?: boolean
  glow?: boolean
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', interactive = false, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base styles
          'relative rounded-2xl border transition-all duration-300 ease-out',
          'backdrop-blur-[16px]',

          // Variant styles - YouWorker Brand
          {
            'bg-[var(--color-glass-slate)] border-[var(--color-glass)] shadow-[var(--shadow-glass-md)]': variant === 'default',
            'bg-gradient-glass-slate border-[var(--color-glass-dark)] backdrop-blur-[24px] shadow-[var(--shadow-glass-lg)]': variant === 'heavy',
            'bg-[#454055]/20 border-[var(--color-glass)]/50 shadow-[var(--shadow-glass-sm)]': variant === 'light',
            'bg-[#454055]/30 border-[var(--color-glass-dark)]/80 backdrop-blur-[16px] shadow-[var(--shadow-glass-md)] rounded-2xl': variant === 'card',
          },

          // Interactive styles with brand red accent
          interactive && [
            'cursor-pointer select-none',
            'hover:shadow-[var(--shadow-glass-lg)] hover:border-[#E32D21]/30 hover:-translate-y-0.5',
            'active:translate-y-0 active:shadow-[var(--shadow-glass-sm)]',
          ],

          // Glow effect with brand colors
          glow && 'after:absolute after:inset-0 after:-z-10 after:rounded-2xl after:blur-2xl after:opacity-0 after:transition-opacity hover:after:opacity-100 after:bg-gradient-to-br after:from-[#E32D21]/20 after:to-[#2D2938]/40',

          className
        )}
        {...props}
      >
        {/* Inner shadow layer */}
        <div className="absolute inset-0 rounded-2xl shadow-[var(--shadow-glass-inner)] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'

export { GlassCard }
