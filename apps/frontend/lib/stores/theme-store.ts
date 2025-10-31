import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'classic-dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * YouWorker Theme Store
 * Manages theme state across the application with localStorage persistence
 * Three themes: light (default), dark, classic-dark (blue-based)
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme: Theme) => {
        set({ theme });
        // Apply theme to document immediately
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
      },
    }),
    {
      name: 'youworker-theme',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
