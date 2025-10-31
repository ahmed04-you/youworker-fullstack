'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/stores/theme-store';

/**
 * ThemeProvider Component
 * Initializes and applies the stored theme on mount
 * Must be client component to access localStorage
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
}
