'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  /**
   * The message to display
   */
  message: string;
  /**
   * The type of toast (determines border color)
   */
  type?: ToastType;
  /**
   * Duration in milliseconds before auto-dismiss
   * Set to 0 or null to disable auto-dismiss
   */
  duration?: number | null;
  /**
   * Whether the toast is visible
   */
  open: boolean;
  /**
   * Callback when toast should be closed
   */
  onClose: () => void;
}

export const Toast = ({
  message,
  type = 'info',
  duration = 3000,
  open,
  onClose,
}: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);

      // Auto-dismiss if duration is set
      if (duration && duration > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onClose, 200); // Wait for fade out animation
        }, duration);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [open, duration, onClose]);

  if (!open && !isVisible) return null;

  const borderColorClass = {
    success: 'border-l-[hsl(120,89%,40%)]',
    error: 'border-l-[var(--error-color)]',
    info: 'border-l-[var(--accent-color)]',
  }[type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        // Position
        'fixed',
        'bottom-[30px]',
        'left-1/2',
        'transform -translate-x-1/2',
        'z-[10000]',

        // Dimensions
        'min-w-[300px]',
        'max-w-[500px]',

        // Visual
        'bg-[var(--bg-control)]',
        'border border-[var(--border-control)]',
        'border-l-4',
        borderColorClass,
        'rounded-[var(--radius-standard)]',
        'shadow-[0_5px_20px_rgba(0,0,0,0.3)]',

        // Spacing
        'px-[20px] py-[15px]',

        // Layout
        'flex items-center justify-between gap-[15px]',

        // Animation
        isVisible
          ? 'animate-[slideUp_200ms_ease,fadeIn_200ms_ease]'
          : 'animate-[fadeOut_200ms_ease]'
      )}
    >
      <p className="text-[var(--font-medium)] text-[var(--text-color)] flex-1">
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 200);
        }}
        className={cn(
          'w-[24px] h-[24px]',
          'flex items-center justify-center',
          'bg-transparent',
          'border-none',
          'rounded-[var(--radius-small)]',
          'cursor-pointer',
          'text-[var(--text-muted)]',
          'hover:bg-[var(--bg-lighter-button)]',
          'hover:text-[var(--text-color)]',
          'transition-all duration-[var(--duration-quick)]'
        )}
        aria-label="Close"
      >
        <X className="w-[16px] h-[16px]" />
      </button>
    </div>
  );
};

/**
 * Hook for managing toast state
 */
export const useToast = () => {
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: ToastType;
    duration?: number | null;
  }>({
    open: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number | null = 3000
  ) => {
    setToast({ open: true, message, type, duration });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
};
