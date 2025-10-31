'use client';

import { useTheme } from '@/lib/hooks/use-theme';
import { Button } from './button';

/**
 * Theme Switcher Component
 * Allows users to switch between Light, Dark, and Classic Dark themes
 */
export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  const themeLabels = {
    light: 'Light',
    dark: 'Dark',
    'classic-dark': 'Classic Dark',
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {themes.map((t) => (
        <Button
          key={t}
          variant={theme === t ? 'default' : 'mini'}
          onClick={() => setTheme(t)}
          className={theme === t ? '' : 'opacity-60'}
        >
          {themeLabels[t]}
        </Button>
      ))}
    </div>
  );
}
