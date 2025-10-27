/**
 * LoadingButton - Button component with integrated loading state
 */
"use client";

import { Button, ButtonProps } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
}

/**
 * LoadingButton shows a spinner and optional loading text when loading
 *
 * @param isLoading - Whether the button is in loading state
 * @param loadingText - Optional text to show while loading
 * @param children - Button content
 * @param ...props - All standard Button props
 *
 * @example
 * <LoadingButton
 *   isLoading={isSaving}
 *   loadingText="Saving..."
 *   onClick={handleSave}
 * >
 *   Save
 * </LoadingButton>
 */
export function LoadingButton({
  isLoading = false,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {isLoading && loadingText ? loadingText : children}
    </Button>
  );
}
