import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Whether the textarea has an error state
   * When true, displays a 2px red border
   */
  error?: boolean;
  /**
   * Label for the textarea (optional)
   */
  label?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
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
        <textarea
          ref={ref}
          className={cn(
            // Base styles
            'w-full',
            'min-h-[60px]',
            'max-h-[200px]',
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
            'leading-[1.5]',

            // Placeholder
            'placeholder:text-[var(--text-muted)]',

            // Focus
            'focus:outline-none',
            'focus:border-[var(--accent-color)]',

            // Disabled
            'disabled:opacity-50',
            'disabled:cursor-not-allowed',
            'disabled:bg-[var(--bg-lighter-button)]',

            // Resize and overflow
            'resize-none',
            'overflow-y-auto',

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

TextArea.displayName = 'TextArea';
