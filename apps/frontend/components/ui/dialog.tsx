'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Dialog Root - Controls the open/closed state
 */
export const Dialog = DialogPrimitive.Root;

/**
 * Dialog Trigger - Button that opens the dialog
 */
export const DialogTrigger = DialogPrimitive.Trigger;

/**
 * Dialog Portal - Renders dialog content in a portal
 */
export const DialogPortal = DialogPrimitive.Portal;

/**
 * Dialog Close - Button that closes the dialog
 */
export const DialogClose = DialogPrimitive.Close;

/**
 * Dialog Overlay - Dark backdrop behind the dialog
 */
export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Position
      'fixed inset-0',
      'z-[9999]',

      // Visual
      'bg-black/50',

      // Animation
      'data-[state=open]:animate-[fadeIn_200ms_ease]',
      'data-[state=closed]:animate-[fadeOut_200ms_ease]',

      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

/**
 * Dialog Content - The main dialog container
 */
export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Position
        'fixed',
        'left-1/2 top-1/2',
        'transform -translate-x-1/2 -translate-y-1/2',
        'z-[9999]',

        // Dimensions
        'min-w-[300px]',
        'max-w-[600px]',
        'max-h-[80vh]',
        'overflow-y-auto',

        // Visual
        'bg-[var(--bg-control)]',
        'border border-[var(--border-dialog)]',
        'rounded-[var(--radius-standard)]',
        'shadow-[0_10px_40px_rgba(0,0,0,0.3)]',

        // Spacing
        'p-[30px]',

        // Animation
        'data-[state=open]:animate-[fadeIn_200ms_ease]',
        'data-[state=closed]:animate-[fadeOut_200ms_ease]',

        // Focus
        'focus:outline-none',

        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

/**
 * Dialog Header - Contains title and optional close button
 */
export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-[10px] mb-[20px]', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

/**
 * Dialog Title - The dialog's title
 */
export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-[var(--font-larger)]',
      'font-bold',
      'text-[var(--text-color)]',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

/**
 * Dialog Description - The dialog's description/message
 */
export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      'text-[var(--font-medium)]',
      'text-[var(--text-color)]',
      'leading-[1.5]',
      'mb-[30px]',
      className
    )}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

/**
 * Dialog Footer - Contains action buttons
 */
export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex gap-[10px] justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/**
 * Confirmation Dialog - Preset dialog for confirmations
 */
export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmationDialog = ({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{message}</DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <button
              onClick={onCancel}
              className={cn(
                'px-[18px] py-[10px]',
                'bg-[var(--bg-lighter-button)]',
                'text-[var(--text-color)]',
                'rounded-[var(--radius-standard)]',
                'font-bold',
                'cursor-pointer',
                'transition-[background] duration-[var(--duration-standard)]',
                'hover:bg-[var(--bg-button-hover)]'
              )}
            >
              <X className="inline w-[16px] h-[16px] mr-[5px]" />
              {cancelText}
            </button>
          </DialogClose>
          <DialogClose asChild>
            <button
              onClick={onConfirm}
              className={cn(
                'px-[18px] py-[10px]',
                'bg-[hsl(120,89%,40%)]',
                'text-[var(--text-opposite)]',
                'rounded-[var(--radius-standard)]',
                'font-bold',
                'cursor-pointer',
                'transition-[background] duration-[var(--duration-standard)]',
                'hover:bg-[hsl(120,89%,35%)]'
              )}
            >
              {confirmText}
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
