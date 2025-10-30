'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/src/lib/utils'

export interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  icon?: React.ReactNode
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
            {icon}
          </div>
        )}

        <input
          ref={ref}
          className={cn(
            // Base styles
            'w-full rounded-xl px-4 py-2.5',
            'bg-[var(--color-glass-white)]/60 backdrop-blur-[16px]',
            'border border-[var(--color-glass)]',
            'text-white placeholder:text-white/40',
            'transition-all duration-200 ease-out',

            // Focus styles - Brand red
            'focus:outline-none focus:bg-[#454055]/50 focus:border-[#E32D21]/50',
            'focus:ring-[3px] focus:ring-[#E32D21]/15',

            // Icon padding
            icon && 'pl-10',

            // Error state - Enhanced red
            error && 'border-[#C41E14]/70 focus:border-[#E32D21] focus:ring-[#E32D21]/20',

            className
          )}
          {...props}
        />
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'

export { GlassInput }
