# YouWorker Frontend

Modern LLM chat application interface based on GPT4All v3.10 design, built with Next.js 16 and React 19.

## 🚀 Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🎨 Features

### ✅ Currently Implemented

- **Three Beautiful Themes:**
  - Light (default) - Clean, professional gray-based design
  - Dark - Modern dark mode with muted colors
  - Classic Dark - Unique blue-based nostalgic theme
- **Instant Theme Switching:** Click the theme switcher in the top-right corner
- **Complete Design System:** All CSS variables, colors, typography, spacing
- **Button Components:** All 6 variants (default, mini, destructive, text, tool, welcome)
- **Animations:** Slide-up, fade-in, and rotate animations ready to use
- **Typography:** Roboto and Roboto Mono fonts from Google
- **Accessibility:** Focus-visible styles, ARIA support, keyboard navigation foundation

### 🚧 Coming Soon

- Layout components (three-panel structure)
- Chat interface with message bubbles
- Settings view
- LocalDocs collection management
- Additional UI components (inputs, checkboxes, selects, dialogs)
- Mock data for development
- Full responsive design
- Complete accessibility implementation

## 📁 Project Structure

```
apps/frontend/
├── app/                           # Next.js App Router
│   ├── globals.css                # Complete theme system with 3 themes
│   ├── layout.tsx                 # Root layout with theme provider
│   └── page.tsx                   # Demo home page
├── components/
│   ├── providers/
│   │   └── theme-provider.tsx     # Theme context provider
│   ├── ui/
│   │   ├── button.tsx             # Button component (all variants)
│   │   └── theme-switcher.tsx     # Theme selection buttons
│   └── [layout|chat|settings|localdocs|home]/  # Feature components (empty)
├── lib/
│   ├── hooks/
│   │   └── use-theme.ts           # Theme hook
│   ├── stores/
│   │   └── theme-store.ts         # Zustand theme store
│   └── utils/
│       └── cn.ts                  # className utility
└── public/                        # Static assets
```

## 🎨 Theme System

The application supports three complete themes, switchable instantly:

### Using Themes in Components

All components use CSS variables for theming:

```tsx
// Colors
<div className="text-[var(--text-color)]">Text</div>
<div className="bg-[var(--bg-view)]">Background</div>

// Typography
<h1 style={{ fontSize: 'var(--font-banner)' }}>Large Title</h1>
<p style={{ fontSize: 'var(--font-medium)' }}>Body text</p>

// Spacing
<div className="p-[var(--spacing-md)]">Content</div>

// Animations
<div className="slide-up">Animated element</div>
```

### Available CSS Variables

**Colors:**
- Text: `--text-color`, `--text-muted`, `--text-opposite`
- Backgrounds: `--bg-view`, `--bg-conversation`, `--bg-control`, `--bg-button`
- Accents: `--accent-color`, `--error-color`
- Borders: `--border-divider`, `--border-control`

**Typography:**
- Families: `--font-primary`, `--font-monospace`
- Sizes: `--font-smallest` to `--font-banner-large`

**Spacing:**
- `--spacing-xs` (10px), `--spacing-sm` (20px), `--spacing-md` (30px), `--spacing-lg` (50px)

**Animations:**
- Durations: `--duration-quick` to `--duration-cyclic`
- Easing: `--easing-primary`, `--easing-linear`

## 🧩 Component Usage

### Button Component

```tsx
import { Button } from "@/components/ui/button";

// Default button
<Button>Click Me</Button>

// Variants
<Button variant="mini">Small Button</Button>
<Button variant="destructive">Delete</Button>
<Button variant="text">Link Button</Button>
<Button variant="tool"><Icon /></Button>
<Button variant="welcome">
  <Icon size={64} />
  <div>Large Card Button</div>
</Button>

// Disabled
<Button disabled>Can't Click</Button>
```

### Theme Switching

```tsx
'use client';

import { useTheme } from "@/lib/hooks/use-theme";

export function MyComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme('dark')}>
      Switch to Dark
    </button>
  );
}
```

## 🛠 Technology Stack

- **Framework:** Next.js 16 (App Router)
- **React:** 19.2.0
- **TypeScript:** 5 (strict mode)
- **Styling:** Tailwind CSS v4 + CSS Variables
- **State Management:** Zustand v5
- **Animations:** Framer Motion v12
- **UI Primitives:** Radix UI
- **Icons:** Lucide React
- **Fonts:** Roboto & Roboto Mono (Google Fonts)

## 📖 Documentation

- **[Implementation Status](./IMPLEMENTATION_STATUS.md)** - Detailed progress tracking, what's completed, and what remains
- **[Design Guide](../../YOUWORKER_DESIGN_GUIDE.md)** - Complete design specifications (3700+ lines)

## 🎯 Development Guidelines

### 1. Always Use CSS Variables

```tsx
// ✅ Good
<div className="bg-[var(--bg-control)]" />

// ❌ Bad
<div className="bg-gray-100" />
```

### 2. Follow the Component Pattern

```tsx
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ComponentProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'other';
}

export const Component = forwardRef<HTMLElement, ComponentProps>(
  ({ variant = 'default', className, children, ...props }, ref) => {
    return (
      <element
        ref={ref}
        className={cn(
          'base-styles',
          variant === 'default' && 'default-styles',
          className
        )}
        role="..."
        aria-label="..."
        {...props}
      >
        {children}
      </element>
    );
  }
);
```

### 3. Test All Three Themes

Every component must work correctly in all three themes. Use the theme switcher to verify.

### 4. Reference the Design Guide

For exact dimensions, colors, and behaviors, always reference the [Design Guide](../../YOUWORKER_DESIGN_GUIDE.md).

### 5. Maintain Accessibility

- Add ARIA roles and labels
- Support keyboard navigation
- Ensure focus-visible styles work
- Test with screen readers

## 🚀 Next Steps

### Immediate Priorities

1. **Complete UI Components (Phase 6)**
   - TextField, TextArea, Checkbox, ComboBox
   - Dialog, Toast, BusyIndicator
   - Menu, FileIcon

2. **Build Layout (Phase 7)**
   - MainLayout (three-panel structure)
   - Header, ChatDrawer, CollectionsDrawer

3. **Chat Interface (Phase 8)**
   - ChatView, ChatItemView
   - TextInputArea, ConversationTray

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed roadmap.

## 📊 Progress

- **Overall:** ~20% complete
- **Foundation:** 100% ✅
- **Theme System:** 100% ✅
- **Infrastructure:** 100% ✅
- **UI Components:** 10% (Button only)
- **Layout:** 0%
- **Features:** 0%

## 🤝 Contributing

When adding new components:

1. Read the relevant section in the [Design Guide](../../YOUWORKER_DESIGN_GUIDE.md)
2. Follow the component pattern from [button.tsx](./components/ui/button.tsx)
3. Use CSS variables for all theming
4. Test in all three themes
5. Include proper TypeScript types
6. Add ARIA attributes for accessibility

## 🎉 Try It Now!

```bash
npm run dev
```

Then visit [http://localhost:3000](http://localhost:3000) and click the theme switcher in the top-right corner to see all three themes in action!

---

**Built with ❤️ using Next.js 16, React 19, and Tailwind CSS v4**

Based on GPT4All v3.10 design by Nomic AI, adapted for YouWorker.
