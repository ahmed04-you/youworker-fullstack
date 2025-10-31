import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Whether the input has an error state
   * When true, displays a 2px red border
   */
  error?: boolean;
  /**
   * Label for the input (optional)
   */
  label?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ error = false, label, className, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={props.id}
            className={cn(
              'block mb-[5px]',
              'text-[var(--font-medium)] font-bold',
              'text-[var(--text-settings-title)]'
            )}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          className={cn(
            // Base styles
            'w-full',
            'min-h-[40px]',
            'px-[15px] py-[10px]',

            // Visual
            'bg-[var(--bg-control)]',
            'border',
            error ? 'border-2 border-[var(--error-color)]' : 'border-[var(--border-control)]',
            'rounded-[var(--radius-standard)]',

            // Typography
            'font-[family-name:var(--font-primary)]',
            'text-[var(--font-large)]',
            'text-[var(--text-color)]',

            // Placeholder
            'placeholder:text-[var(--text-muted)]',

            // Focus
            'focus:outline-none',
            'focus:border-[var(--accent-color)]',

            // Disabled
            'disabled:opacity-50',
            'disabled:cursor-not-allowed',
            'disabled:bg-[var(--bg-lighter-button)]',

            // Transition
            'transition-[border-color] duration-[var(--duration-standard)]',

            className
          )}
          disabled={disabled}
          aria-invalid={error}
          aria-label={label || props['aria-label']}
          {...props}
        />
      </div>
    );
  }
);

TextField.displayName = 'TextField';
