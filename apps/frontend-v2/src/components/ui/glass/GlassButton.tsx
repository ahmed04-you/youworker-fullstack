'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/src/lib/utils'
import { Loader2 } from 'lucide-react'

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center gap-2',
          'rounded-xl font-medium backdrop-blur-[16px]',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Size variants
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-base': size === 'md',
            'px-6 py-3 text-lg': size === 'lg',
          },

          // Variant styles - YouWorker Brand
          {
            // Primary: Brand red gradient glass
            'bg-gradient-to-br from-[#E32D21]/40 to-[#C41E14]/30 border border-[var(--color-glass-red-border)] text-white shadow-[var(--shadow-glass-red)] hover:from-[#E32D21]/50 hover:to-[#F04438]/40 hover:shadow-[var(--shadow-glass-red-lg)] hover:border-[#F04438]/60':
              variant === 'primary',

            // Secondary: Deep slate glass
            'bg-[#454055]/40 border border-[var(--color-glass)] text-white/90 shadow-[var(--shadow-glass-sm)] hover:bg-[#454055]/50 hover:shadow-[var(--shadow-glass-md)] hover:border-[#E32D21]/50':
              variant === 'secondary',

            // Ghost: Minimal glass with red hover
            'bg-transparent border border-transparent text-white/70 hover:bg-[#454055]/20 hover:text-white hover:border-[#E32D21]/20':
              variant === 'ghost',
          },

          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    )
  }
)

GlassButton.displayName = 'GlassButton'

export { GlassButton }
