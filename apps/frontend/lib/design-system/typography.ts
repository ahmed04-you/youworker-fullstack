/**
 * Typography scales and text styles.
 */

export const fontFamilies = {
  sans: 'var(--font-geist-sans)',
  mono: 'var(--font-geist-mono)',
} as const;

export const fontSize = {
  xs: '0.75rem',      // 12px
  sm: '0.875rem',     // 14px
  base: '1rem',       // 16px
  lg: '1.125rem',     // 18px
  xl: '1.25rem',      // 20px
  '2xl': '1.5rem',    // 24px
  '3xl': '1.875rem',  // 30px
  '4xl': '2.25rem',   // 36px
  '5xl': '3rem',      // 48px
  '6xl': '3.75rem',   // 60px
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: '1.25',
  normal: '1.5',
  relaxed: '1.75',
} as const;

/**
 * Typography scale based on semantic meaning.
 */
export const typography = {
  // Display text (hero sections)
  display: {
    '4xl': {
      fontSize: fontSize['6xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.bold,
    },
    '3xl': {
      fontSize: fontSize['5xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.bold,
    },
    '2xl': {
      fontSize: fontSize['4xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.bold,
    },
    xl: {
      fontSize: fontSize['3xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.bold,
    },
  },

  // Headings
  heading: {
    h1: {
      fontSize: fontSize['4xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.bold,
    },
    h2: {
      fontSize: fontSize['3xl'],
      lineHeight: lineHeight.tight,
      fontWeight: fontWeight.semibold,
    },
    h3: {
      fontSize: fontSize['2xl'],
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.semibold,
    },
    h4: {
      fontSize: fontSize.xl,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.semibold,
    },
    h5: {
      fontSize: fontSize.lg,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.medium,
    },
    h6: {
      fontSize: fontSize.base,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.medium,
    },
  },

  // Body text
  body: {
    lg: {
      fontSize: fontSize.lg,
      lineHeight: lineHeight.relaxed,
      fontWeight: fontWeight.normal,
    },
    base: {
      fontSize: fontSize.base,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.normal,
    },
    sm: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.normal,
    },
  },

  // Caption text
  caption: {
    base: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.normal,
    },
    sm: {
      fontSize: fontSize.xs,
      lineHeight: lineHeight.normal,
      fontWeight: fontWeight.normal,
    },
  },

  // Code text
  code: {
    base: {
      fontSize: fontSize.sm,
      lineHeight: lineHeight.normal,
      fontFamily: fontFamilies.mono,
    },
    inline: {
      fontSize: '0.9em',
      fontFamily: fontFamilies.mono,
    },
  },
} as const;
