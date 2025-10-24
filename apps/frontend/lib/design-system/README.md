# YouWorker.AI Design System

A comprehensive design system for consistent UI components and styling across the application.

## Overview

This design system provides:
- **Color tokens** - Semantic color palette
- **Typography** - Font scales and text styles
- **Spacing** - Consistent spacing scale
- **Breakpoints** - Responsive design breakpoints
- **Component patterns** - Reusable UI patterns

## Structure

```
lib/design-system/
├── README.md           # This file
├── colors.ts           # Color palette and semantic tokens
├── typography.ts       # Font scales and text styles
├── spacing.ts          # Spacing scale
├── breakpoints.ts      # Responsive breakpoints
├── shadows.ts          # Shadow tokens
└── index.ts            # Centralized exports
```

## Usage

### Colors

```tsx
import { colors, semanticColors } from '@/lib/design-system';

// Base colors
<div style={{ backgroundColor: colors.gray[100] }}>Content</div>

// Semantic colors
<div style={{ color: semanticColors.text.primary }}>Text</div>
<div style={{ backgroundColor: semanticColors.background.surface }}>Surface</div>
```

### Typography

```tsx
import { typography } from '@/lib/design-system';

<h1 className={typography.heading.h1}>Heading</h1>
<p className={typography.body.base}>Body text</p>
```

### Spacing

```tsx
import { spacing } from '@/lib/design-system';

<div style={{ padding: spacing.md, margin: spacing.lg }}>Content</div>
```

### Breakpoints

```tsx
import { breakpoints } from '@/lib/design-system';

const mediaQuery = `@media (min-width: ${breakpoints.md})`;
```

## Design Tokens

### Color Palette

Based on the existing Tailwind config, extends the default palette with:
- **Primary**: Brand colors
- **Secondary**: Accent colors
- **Gray**: Neutral colors (50-950)
- **Semantic**: Success, warning, error, info

### Typography Scale

- **Display**: 4xl, 3xl, 2xl, xl
- **Heading**: h1-h6
- **Body**: sm, base, lg
- **Caption**: xs, sm

### Spacing Scale

- `xs`: 0.25rem (4px)
- `sm`: 0.5rem (8px)
- `md`: 1rem (16px)
- `lg`: 1.5rem (24px)
- `xl`: 2rem (32px)
- `2xl`: 3rem (48px)
- `3xl`: 4rem (64px)

### Responsive Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## Component Patterns

### Button

```tsx
// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary
</button>

// Secondary button
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
  Secondary
</button>
```

### Card

```tsx
<div className="bg-card text-card-foreground rounded-lg border shadow-sm">
  <div className="p-6">
    <h3 className="text-lg font-semibold">Card Title</h3>
    <p className="text-muted-foreground">Card content</p>
  </div>
</div>
```

### Input

```tsx
<input
  type="text"
  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
  placeholder="Enter text..."
/>
```

## Best Practices

### 1. Use Semantic Tokens

❌ **Don't** use raw colors:
```tsx
<div className="text-gray-700">Text</div>
```

✅ **Do** use semantic tokens:
```tsx
<div className="text-foreground">Text</div>
```

### 2. Consistent Spacing

❌ **Don't** use arbitrary values:
```tsx
<div className="p-[13px]">Content</div>
```

✅ **Do** use the spacing scale:
```tsx
<div className="p-3">Content</div>  {/* p-3 = 0.75rem = 12px */}
```

### 3. Responsive Design

❌ **Don't** create custom breakpoints:
```tsx
@media (min-width: 850px) { ... }
```

✅ **Do** use defined breakpoints:
```tsx
<div className="md:flex lg:grid">Content</div>
```

### 4. Typography Hierarchy

❌ **Don't** mix font sizes inconsistently:
```tsx
<h1 className="text-2xl">Title</h1>
<h2 className="text-3xl">Subtitle</h2>
```

✅ **Do** follow the typography scale:
```tsx
<h1 className="text-4xl font-bold">Title</h1>
<h2 className="text-2xl font-semibold">Subtitle</h2>
```

## Extending the Design System

### Adding a New Color

1. Add to `colors.ts`:
```ts
export const colors = {
  ...
  brand: {
    50: '#f0f9ff',
    ...
    900: '#0c4a6e',
  },
};
```

2. Update Tailwind config if needed:
```js
theme: {
  extend: {
    colors: {
      brand: colors.brand,
    },
  },
}
```

### Adding a New Component Pattern

1. Create the pattern:
```tsx
// lib/design-system/patterns/button.tsx
export const buttonVariants = {
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
};
```

2. Document usage in this README

## Accessibility

All component patterns follow WCAG 2.1 AA guidelines:
- Minimum contrast ratio of 4.5:1 for normal text
- Minimum contrast ratio of 3:1 for large text
- Focus indicators on interactive elements
- Semantic HTML elements

## Dark Mode Support

The design system fully supports dark mode through CSS variables:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

Components automatically adapt to the theme.
