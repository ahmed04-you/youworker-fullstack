'use client';

import { forwardRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SuggestedFollowUpProps {
  suggestions: string[];
  onSuggestionClick?: (suggestion: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const SuggestedFollowUp = forwardRef<HTMLDivElement, SuggestedFollowUpProps>(
  ({ suggestions, onSuggestionClick, isLoading = false, className }, ref) => {
    if (!suggestions || suggestions.length === 0) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-[10px] mt-[15px] ml-[42px]', className)}
        role="list"
        aria-label="Suggested follow-up questions"
      >
        {suggestions.map((suggestion, index) => (
          <SuggestionButton
            key={index}
            suggestion={suggestion}
            onClick={() => onSuggestionClick?.(suggestion)}
            isLoading={isLoading}
          />
        ))}
      </div>
    );
  }
);

SuggestedFollowUp.displayName = 'SuggestedFollowUp';

interface SuggestionButtonProps {
  suggestion: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const SuggestionButton = forwardRef<HTMLButtonElement, SuggestionButtonProps>(
  ({ suggestion, onClick, isLoading = false }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          // Base layout
          'relative flex items-center',
          'w-full text-left',
          'py-[10px] pl-[20px] pr-[40px]',

          // Background and border
          'bg-[var(--bg-control)] border border-[var(--border-control)]',
          'rounded-[var(--radius-standard)]', // 10px

          // Typography
          'font-[family-name:var(--font-primary)] text-[length:var(--font-large)]', // 12pt / ~16px
          'text-[var(--text-color)]',

          // Transitions
          'transition-all duration-[var(--duration-standard)]', // 200ms

          // States
          'hover:bg-[var(--bg-lighter-button)] hover:border-[var(--accent-color)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',

          // Focus
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-color)]',
          'focus-visible:outline-offset-2'
        )}
        role="listitem"
        aria-label={`Suggested question: ${suggestion}`}
      >
        {/* Suggestion text */}
        <span className="flex-1">{suggestion}</span>

        {/* Arrow icon */}
        <ArrowRight
          className={cn(
            'absolute right-[10px] top-1/2 -translate-y-1/2',
            'w-[20px] h-[20px]',
            'text-[var(--text-muted)]',
            'transition-colors duration-[var(--duration-standard)]',
            'group-hover:text-[var(--accent-color)]'
          )}
          aria-hidden="true"
        />
      </button>
    );
  }
);

SuggestionButton.displayName = 'SuggestionButton';

/**
 * Loading state for suggested follow-ups (used while generating suggestions)
 */
export const SuggestedFollowUpLoading = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-[10px] mt-[15px] ml-[42px]', className)}
        role="status"
        aria-label="Loading suggested questions"
      >
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className={cn(
              'relative flex items-center',
              'w-full h-[44px]',
              'py-[10px] pl-[20px] pr-[40px]',
              'bg-[var(--bg-control)] border border-[var(--border-control)]',
              'rounded-[var(--radius-standard)]'
            )}
          >
            {/* Animated loading bars */}
            <div className="flex gap-[5px] items-center w-full">
              <div
                className={cn(
                  'h-[16px] bg-[var(--text-muted)] rounded-[3px]',
                  'animate-pulse-opacity-1'
                )}
                style={{ width: `${60 + index * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }
);

SuggestedFollowUpLoading.displayName = 'SuggestedFollowUpLoading';
