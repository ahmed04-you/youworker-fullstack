'use client';

import { useThemeStore, type Theme } from '@/lib/stores/theme-store';

/**
 * Custom hook for accessing and modifying the theme
 * Provides a clean API for theme management
 */
export function useTheme() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return {
    theme,
    setTheme,
    themes: ['light', 'dark', 'classic-dark'] as Theme[],
  };
}
