'use client';

import { forwardRef } from 'react';
import { RotateCcw, Copy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ConversationTrayProps {
  onReset?: () => void;
  onCopyConversation?: () => void;
  isVisible?: boolean;
  className?: string;
}

export const ConversationTray = forwardRef<HTMLDivElement, ConversationTrayProps>(
  ({ onReset, onCopyConversation, isVisible = false, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Position (floating above text input)
          'absolute bottom-[calc(100%+10px)] right-[30px]',
          'z-[400]',

          // Layout
          'flex gap-[10px]',

          // Opacity transition
          'transition-opacity duration-[var(--duration-medium)]', // 300ms
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',

          className
        )}
        role="toolbar"
        aria-label="Conversation controls"
      >
        {/* Reset Button */}
        <TrayButton
          onClick={onReset}
          icon={<RotateCcw className="w-[20px] h-[20px]" />}
          label="Reset conversation"
          aria-label="Reset conversation"
        />

        {/* Copy Conversation Button */}
        <TrayButton
          onClick={onCopyConversation}
          icon={<Copy className="w-[20px] h-[20px]" />}
          label="Copy conversation to clipboard"
          aria-label="Copy conversation to clipboard"
        />
      </div>
    );
  }
);

ConversationTray.displayName = 'ConversationTray';

interface TrayButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  'aria-label': string;
  disabled?: boolean;
}

const TrayButton = forwardRef<HTMLButtonElement, TrayButtonProps>(
  ({ onClick, icon, label, 'aria-label': ariaLabel, disabled = false }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        title={label}
        aria-label={ariaLabel}
        className={cn(
          // Size
          'w-[40px] h-[40px]',

          // Layout
          'flex items-center justify-center',

          // Background and border
          'bg-[var(--bg-control)] border border-[var(--border-control)]',
          'rounded-full',

          // Icon color
          'text-[var(--text-muted)]',

          // Transitions
          'transition-all duration-[var(--duration-standard)]', // 200ms

          // States
          'hover:bg-[var(--bg-lighter-button)] hover:border-[var(--accent-color)] hover:text-[var(--text-color)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Focus
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
          'focus-visible:outline-offset-2',

          // Active
          'active:scale-95'
        )}
        role="button"
      >
        {icon}
      </button>
    );
  }
);

TrayButton.displayName = 'TrayButton';
