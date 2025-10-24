/**
 * Color palette and semantic color tokens.
 *
 * Based on the Tailwind configuration with HSL color space for
 * better dark mode support.
 */

export const colors = {
  gray: {
    50: 'hsl(0, 0%, 98%)',
    100: 'hsl(0, 0%, 96%)',
    200: 'hsl(0, 0%, 90%)',
    300: 'hsl(0, 0%, 83%)',
    400: 'hsl(0, 0%, 64%)',
    500: 'hsl(0, 0%, 45%)',
    600: 'hsl(0, 0%, 32%)',
    700: 'hsl(0, 0%, 25%)',
    800: 'hsl(0, 0%, 15%)',
    900: 'hsl(0, 0%, 9%)',
    950: 'hsl(0, 0%, 4%)',
  },
} as const;

/**
 * Semantic colors that map to CSS variables.
 * These adapt automatically to light/dark mode.
 */
export const semanticColors = {
  background: {
    default: 'hsl(var(--background))',
    surface: 'hsl(var(--card))',
    muted: 'hsl(var(--muted))',
    accent: 'hsl(var(--accent))',
  },
  text: {
    primary: 'hsl(var(--foreground))',
    secondary: 'hsl(var(--muted-foreground))',
    accent: 'hsl(var(--accent-foreground))',
    card: 'hsl(var(--card-foreground))',
  },
  border: {
    default: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
  },
  interactive: {
    primary: 'hsl(var(--primary))',
    primaryHover: 'hsl(var(--primary) / 0.9)',
    primaryForeground: 'hsl(var(--primary-foreground))',
    secondary: 'hsl(var(--secondary))',
    secondaryHover: 'hsl(var(--secondary) / 0.8)',
    secondaryForeground: 'hsl(var(--secondary-foreground))',
    destructive: 'hsl(var(--destructive))',
    destructiveForeground: 'hsl(var(--destructive-foreground))',
  },
  state: {
    ring: 'hsl(var(--ring))',
    focus: 'hsl(var(--ring))',
  },
} as const;

/**
 * Status colors for feedback.
 */
export const statusColors = {
  success: {
    light: 'hsl(142, 76%, 36%)',
    DEFAULT: 'hsl(142, 71%, 45%)',
    dark: 'hsl(142, 71%, 35%)',
  },
  warning: {
    light: 'hsl(45, 93%, 47%)',
    DEFAULT: 'hsl(45, 93%, 47%)',
    dark: 'hsl(45, 93%, 37%)',
  },
  error: {
    light: 'hsl(var(--destructive) / 0.8)',
    DEFAULT: 'hsl(var(--destructive))',
    dark: 'hsl(var(--destructive) / 1.2)',
  },
  info: {
    light: 'hsl(214, 88%, 51%)',
    DEFAULT: 'hsl(214, 88%, 41%)',
    dark: 'hsl(214, 88%, 31%)',
  },
} as const;
