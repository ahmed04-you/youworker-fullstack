'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /**
   * Label text for the checkbox
   */
  label?: string;
}

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ label, className, id, ...props }, ref) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substring(7)}`;

  return (
    <div className="flex items-center gap-[10px] cursor-pointer">
      <CheckboxPrimitive.Root
        ref={ref}
        id={checkboxId}
        className={cn(
          // Dimensions
          'w-[20px] h-[20px]',

          // Visual
          'bg-[var(--bg-control)]',
          'border-2 border-[var(--border-control)]',
          'rounded-[var(--radius-small)]',

          // Position for checkmark
          'relative',
          'flex items-center justify-center',

          // Interaction
          'cursor-pointer',

          // Transition
          'transition-all duration-[var(--duration-standard)] ease-in-out',

          // Checked state
          'data-[state=checked]:bg-[var(--accent-color)]',
          'data-[state=checked]:border-[var(--accent-color)]',

          // Focus (Accessibility)
          'focus-visible:outline focus-visible:outline-2',
          'focus-visible:outline-[var(--accent-color)]',
          'focus-visible:outline-offset-2',

          // Disabled
          'disabled:opacity-50',
          'disabled:cursor-not-allowed',

          className
        )}
        aria-label={label}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn(
            'absolute top-1/2 left-1/2',
            'transform -translate-x-1/2 -translate-y-1/2',
            'text-[var(--text-opposite)]'
          )}
        >
          <Check className="w-[14px] h-[14px]" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>

      {label && (
        <label
          htmlFor={checkboxId}
          className={cn(
            'text-[var(--font-medium)]',
            'text-[var(--text-color)]',
            'select-none',
            'cursor-pointer'
          )}
        >
          {label}
        </label>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';
