import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'text' | 'tool' | 'mini' | 'welcome';
  children: React.ReactNode;
}

/**
 * YouWorker Button Component
 * Based on GPT4All v3.10 MyButton specification
 * Supports all states: default, hover, active, disabled, focus
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles - applies to all variants
          'inline-flex items-center justify-center',
          'font-bold text-center cursor-pointer',
          'transition-all',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)] focus-visible:outline-offset-2',
          'active:translate-y-[1px]',
          'disabled:cursor-not-allowed disabled:opacity-50',

          // Default variant (MyButton)
          variant === 'default' && [
            'px-[18px] py-[10px] min-h-[40px]',
            'bg-[var(--bg-button)] text-[var(--text-opposite)]',
            'rounded-[var(--radius-standard)]',
            'text-[var(--font-large)]',
            'border-0',
            'hover:bg-[var(--bg-button-hover)]',
            'disabled:bg-[var(--text-muted)] disabled:text-[var(--text-opposite-muted)]',
            'transition-[background] duration-[var(--duration-standard)]',
          ],

          // Mini variant (MyMiniButton)
          variant === 'mini' && [
            'px-[10px] py-[5px] min-h-[30px]',
            'bg-[var(--bg-button)] text-[var(--text-opposite)]',
            'rounded-[var(--radius-standard)]',
            'text-[var(--font-medium)]',
            'border-0',
            'hover:bg-[var(--bg-button-hover)]',
            'disabled:bg-[var(--text-muted)] disabled:text-[var(--text-opposite-muted)]',
            'transition-[background] duration-[var(--duration-standard)]',
          ],

          // Destructive variant (MySettingsDestructiveButton)
          variant === 'destructive' && [
            'px-[18px] py-[10px] min-h-[40px]',
            'bg-transparent text-[var(--error-color)]',
            'rounded-[var(--radius-standard)]',
            'text-[var(--font-large)]',
            'border border-[var(--error-color)]',
            'hover:bg-[var(--error-color)] hover:text-[var(--text-opposite)]',
            'transition-[background,color] duration-[var(--duration-standard)]',
          ],

          // Text variant (MyTextButton)
          variant === 'text' && [
            'px-[10px] py-[5px]',
            'bg-transparent text-[var(--accent-color)]',
            'text-[var(--font-medium)]',
            'underline',
            'border-0',
            'hover:opacity-80 hover:no-underline',
            'transition-opacity duration-[var(--duration-quick)]',
          ],

          // Tool variant (MyToolButton)
          variant === 'tool' && [
            'w-[40px] h-[40px] p-0',
            'bg-transparent text-[var(--text-muted)]',
            'rounded-[var(--radius-small)]',
            'border-0',
            'hover:bg-[var(--bg-lighter-button)] hover:text-[var(--text-color)]',
            'transition-[background,color] duration-[var(--duration-standard)]',
          ],

          // Welcome variant (MyWelcomeButton - large card-style)
          variant === 'welcome' && [
            'min-w-[250px] max-w-[350px]',
            'p-[30px]',
            'bg-[var(--bg-control)] text-[var(--text-color)]',
            'rounded-[var(--radius-standard)]',
            'border border-[var(--border-control)]',
            'flex-col gap-[15px]',
            'text-[var(--font-larger)]',
            'hover:bg-[var(--bg-lighter-button)] hover:border-[var(--accent-color)]',
            'hover:-translate-y-[5px] hover:shadow-lg',
            'transition-all duration-[var(--duration-standard)]',
          ],

          className
        )}
        role="button"
        aria-label={typeof children === 'string' ? children : undefined}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
