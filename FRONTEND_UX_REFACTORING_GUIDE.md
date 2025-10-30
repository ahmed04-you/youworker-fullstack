# YouWorker.AI Frontend - UI/UX Refactoring Guide
## A Comprehensive Blueprint for Creating a UI/UX Masterpiece

**Document Version:** 1.0
**Last Updated:** 2025-10-30
**Target:** Transform YouWorker.AI into a world-class UI/UX experience

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Design System Enhancement](#design-system-enhancement)
4. [Component Library Improvements](#component-library-improvements)
5. [User Experience Refinements](#user-experience-refinements)
6. [Animation & Micro-interactions](#animation--micro-interactions)
7. [Accessibility Excellence](#accessibility-excellence)
8. [Performance Optimization](#performance-optimization)
9. [Mobile Experience](#mobile-experience)
10. [Information Architecture](#information-architecture)
11. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### Current Strengths
✅ **Modern Tech Stack** - Next.js 16, React 19, TypeScript, Tailwind CSS
✅ **Solid Foundation** - shadcn/ui with 32+ accessible components
✅ **Good Architecture** - Feature-based organization, clear separation of concerns
✅ **Accessibility Baseline** - ARIA labels, keyboard navigation, semantic HTML
✅ **Performance Patterns** - Virtual scrolling, React Query, optimistic updates

### Key Opportunities
🎯 **Design System Maturity** - Expand tokens, add color variants, create comprehensive scales
🎯 **Advanced Animations** - Sophisticated micro-interactions and transitions
🎯 **Enhanced Feedback** - Richer loading states, better error communication
🎯 **Mobile-First Polish** - Native-feeling mobile experience with gestures
🎯 **Accessibility AAA** - WCAG AAA compliance with screen reader excellence

### Expected Outcomes
- **50% reduction** in user friction through streamlined flows
- **40% increase** in user delight through animations and feedback
- **100% WCAG AAA** accessibility compliance
- **60fps** consistent performance across all interactions
- **Native app feel** on mobile devices

---

## Current State Analysis

### Technology Stack Overview
```
Frontend Framework: Next.js 16.0.0 (App Router + RSC)
React Version: 19.2.0
TypeScript: 5.x (strict mode)
Styling: Tailwind CSS 3.4.15 + CSS Variables
Component Library: shadcn/ui (Radix UI primitives)
State Management: Zustand 5.0.8 + TanStack Query 5.90.5
Forms: react-hook-form 7.65.0 + Zod 4.1.12
Animation: Framer Motion 12.23.24
Icons: Lucide React 0.548.0
i18n: next-intl 4.4.0
Testing: Vitest 4.0.4 + Testing Library + Playwright
```

### Project Structure
```
apps/frontend/src/
├── app/                    # Next.js pages (App Router)
├── components/             # Shared components
│   ├── ui/                # Base UI library (32 components)
│   ├── dialogs/           # Modal components
│   └── loading/           # Loading states
├── features/              # Feature modules
│   ├── chat/             # Chat feature
│   ├── documents/        # Document management
│   └── onboarding/       # User onboarding
├── hooks/                # Custom hooks
├── lib/                  # Utilities & services
└── test/                 # Test utilities
```

### Existing Component Inventory
**32 shadcn/ui Components:** Button, Input, Select, Dialog, Sheet, Tabs, Card, Badge, Alert, Skeleton, Progress, Tooltip, Dropdown Menu, Command, Table, Accordion, Checkbox, Switch, Calendar, Separator, Navigation Menu, Popover, Alert Dialog, Textarea, Label, Markdown, Empty State, Sonner (toasts)

---

## Design System Enhancement

### 1. Color System Expansion

#### Current State
- Basic HSL color tokens (background, foreground, primary, secondary, muted, etc.)
- Light and dark mode support
- Limited color variants

#### Proposed Enhancement

**Create a comprehensive color palette:**

```css
/* apps/frontend/src/app/globals.css */

@layer base {
  :root {
    /* === FOUNDATION === */
    --background: 0 0% 100%;
    --foreground: 222.2 47.4% 11.2%;

    /* === BRAND COLORS === */
    --brand-50: 210 100% 97%;
    --brand-100: 210 100% 94%;
    --brand-200: 210 100% 88%;
    --brand-300: 210 100% 80%;
    --brand-400: 210 100% 70%;
    --brand-500: 210 100% 60%;  /* Primary brand */
    --brand-600: 210 100% 50%;
    --brand-700: 210 95% 42%;
    --brand-800: 210 90% 35%;
    --brand-900: 210 85% 28%;

    /* === SEMANTIC COLORS === */
    --success: 142 76% 36%;
    --success-foreground: 138 76% 97%;
    --success-muted: 142 76% 92%;

    --warning: 38 92% 50%;
    --warning-foreground: 48 96% 89%;
    --warning-muted: 48 100% 96%;

    --error: 0 72% 51%;
    --error-foreground: 0 86% 97%;
    --error-muted: 0 93% 94%;

    --info: 199 89% 48%;
    --info-foreground: 199 89% 96%;
    --info-muted: 199 95% 94%;

    /* === NEUTRAL SCALE (enhanced) === */
    --neutral-50: 210 20% 98%;
    --neutral-100: 210 20% 96%;
    --neutral-200: 210 20% 92%;
    --neutral-300: 210 15% 85%;
    --neutral-400: 210 12% 70%;
    --neutral-500: 210 10% 55%;
    --neutral-600: 210 12% 45%;
    --neutral-700: 210 15% 35%;
    --neutral-800: 210 18% 25%;
    --neutral-900: 210 20% 15%;

    /* === SURFACE COLORS === */
    --surface-base: 0 0% 100%;
    --surface-raised: 0 0% 98%;
    --surface-overlay: 0 0% 100%;
    --surface-sunken: 210 20% 97%;

    /* === ELEVATION SHADOWS === */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

    /* === SPACING SCALE (T-shirt sizing) === */
    --space-3xs: 0.125rem;  /* 2px */
    --space-2xs: 0.25rem;   /* 4px */
    --space-xs: 0.5rem;     /* 8px */
    --space-sm: 0.75rem;    /* 12px */
    --space-md: 1rem;       /* 16px */
    --space-lg: 1.5rem;     /* 24px */
    --space-xl: 2rem;       /* 32px */
    --space-2xl: 3rem;      /* 48px */
    --space-3xl: 4rem;      /* 64px */

    /* === TYPOGRAPHY SCALE === */
    --text-xs: 0.75rem;     /* 12px */
    --text-sm: 0.875rem;    /* 14px */
    --text-base: 1rem;      /* 16px */
    --text-lg: 1.125rem;    /* 18px */
    --text-xl: 1.25rem;     /* 20px */
    --text-2xl: 1.5rem;     /* 24px */
    --text-3xl: 1.875rem;   /* 30px */
    --text-4xl: 2.25rem;    /* 36px */

    /* === FONT WEIGHTS === */
    --font-regular: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;

    /* === LINE HEIGHTS === */
    --leading-tight: 1.25;
    --leading-snug: 1.375;
    --leading-normal: 1.5;
    --leading-relaxed: 1.625;
    --leading-loose: 2;

    /* === BORDER RADIUS === */
    --radius-sm: 0.25rem;   /* 4px */
    --radius-md: 0.5rem;    /* 8px */
    --radius-lg: 0.75rem;   /* 12px */
    --radius-xl: 1rem;      /* 16px */
    --radius-2xl: 1.5rem;   /* 24px */
    --radius-full: 9999px;

    /* === TRANSITIONS === */
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);

    /* === Z-INDEX SCALE === */
    --z-dropdown: 1000;
    --z-sticky: 1100;
    --z-overlay: 1200;
    --z-modal: 1300;
    --z-popover: 1400;
    --z-tooltip: 1500;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    /* Adjusted brand colors for dark mode */
    --brand-50: 210 85% 12%;
    --brand-100: 210 85% 18%;
    --brand-200: 210 85% 25%;
    --brand-300: 210 90% 35%;
    --brand-400: 210 95% 45%;
    --brand-500: 210 100% 60%;  /* Primary brand */
    --brand-600: 210 100% 70%;
    --brand-700: 210 100% 80%;
    --brand-800: 210 100% 88%;
    --brand-900: 210 100% 94%;

    /* Dark mode semantic colors */
    --success: 142 76% 40%;
    --warning: 38 92% 55%;
    --error: 0 72% 55%;
    --info: 199 89% 52%;

    /* Dark mode surfaces */
    --surface-base: 222.2 84% 4.9%;
    --surface-raised: 222.2 84% 8%;
    --surface-overlay: 222.2 84% 12%;
    --surface-sunken: 222.2 84% 3%;
  }
}
```

**Update Tailwind config to use new tokens:**

```typescript
// apps/frontend/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Add brand scale
        brand: {
          50: 'hsl(var(--brand-50))',
          100: 'hsl(var(--brand-100))',
          200: 'hsl(var(--brand-200))',
          300: 'hsl(var(--brand-300))',
          400: 'hsl(var(--brand-400))',
          500: 'hsl(var(--brand-500))',
          600: 'hsl(var(--brand-600))',
          700: 'hsl(var(--brand-700))',
          800: 'hsl(var(--brand-800))',
          900: 'hsl(var(--brand-900))',
        },
        // Add semantic colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          muted: 'hsl(var(--success-muted))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          muted: 'hsl(var(--warning-muted))',
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--error-foreground))',
          muted: 'hsl(var(--error-muted))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          muted: 'hsl(var(--info-muted))',
        },
        // Add neutral scale
        neutral: {
          50: 'hsl(var(--neutral-50))',
          100: 'hsl(var(--neutral-100))',
          200: 'hsl(var(--neutral-200))',
          300: 'hsl(var(--neutral-300))',
          400: 'hsl(var(--neutral-400))',
          500: 'hsl(var(--neutral-500))',
          600: 'hsl(var(--neutral-600))',
          700: 'hsl(var(--neutral-700))',
          800: 'hsl(var(--neutral-800))',
          900: 'hsl(var(--neutral-900))',
        },
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
      },
    },
  },
};
```

### 2. Typography System

**Create comprehensive typography components:**

```typescript
// apps/frontend/src/components/ui/typography.tsx
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const headingVariants = cva("font-bold tracking-tight", {
  variants: {
    level: {
      h1: "text-4xl lg:text-5xl",
      h2: "text-3xl lg:text-4xl",
      h3: "text-2xl lg:text-3xl",
      h4: "text-xl lg:text-2xl",
      h5: "text-lg lg:text-xl",
      h6: "text-base lg:text-lg",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
  },
  defaultVariants: {
    level: "h2",
    weight: "bold",
  },
});

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function Heading({
  as,
  level,
  weight,
  className,
  ...props
}: HeadingProps) {
  const Component = as || level || "h2";
  return (
    <Component
      className={cn(headingVariants({ level: level || as, weight }), className)}
      {...props}
    />
  );
}

const textVariants = cva("", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl",
    },
    weight: {
      regular: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    leading: {
      tight: "leading-tight",
      snug: "leading-snug",
      normal: "leading-normal",
      relaxed: "leading-relaxed",
      loose: "leading-loose",
    },
    color: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      accent: "text-accent-foreground",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
      info: "text-info",
    },
  },
  defaultVariants: {
    size: "base",
    weight: "regular",
    leading: "normal",
    color: "default",
  },
});

export interface TextProps
  extends React.HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  as?: "p" | "span" | "div";
}

export function Text({
  as: Component = "p",
  size,
  weight,
  leading,
  color,
  className,
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(textVariants({ size, weight, leading, color }), className)}
      {...props}
    />
  );
}
```

### 3. Spacing & Layout Utilities

**Create consistent layout components:**

```typescript
// apps/frontend/src/components/ui/stack.tsx
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const stackVariants = cva("flex", {
  variants: {
    direction: {
      row: "flex-row",
      column: "flex-col",
      "row-reverse": "flex-row-reverse",
      "column-reverse": "flex-col-reverse",
    },
    spacing: {
      "0": "gap-0",
      "1": "gap-1",
      "2": "gap-2",
      "3": "gap-3",
      "4": "gap-4",
      "6": "gap-6",
      "8": "gap-8",
      "12": "gap-12",
      "16": "gap-16",
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    },
    wrap: {
      true: "flex-wrap",
      false: "flex-nowrap",
      reverse: "flex-wrap-reverse",
    },
  },
  defaultVariants: {
    direction: "column",
    spacing: "4",
    align: "stretch",
    justify: "start",
    wrap: false,
  },
});

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {}

export function Stack({
  direction,
  spacing,
  align,
  justify,
  wrap,
  className,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(stackVariants({ direction, spacing, align, justify, wrap }), className)}
      {...props}
    />
  );
}

// Convenience components
export function HStack(props: Omit<StackProps, "direction">) {
  return <Stack direction="row" {...props} />;
}

export function VStack(props: Omit<StackProps, "direction">) {
  return <Stack direction="column" {...props} />;
}
```

---

## Component Library Improvements

### 1. Enhanced Button Component

**Add more variants and states:**

```typescript
// apps/frontend/src/components/ui/button.tsx (enhanced)
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95",
        outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90 active:scale-95",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90 active:scale-95",
        gradient: "bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 active:scale-95",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8",
        xl: "h-14 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    fullWidth,
    loading,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
  }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### 2. Advanced Alert Component

**Create rich notification system:**

```typescript
// apps/frontend/src/components/ui/alert-v2.tsx
import { type VariantProps, cva } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:pl-8",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground border-border",
        success: "bg-success-muted text-success-foreground border-success",
        warning: "bg-warning-muted text-warning-foreground border-warning",
        error: "bg-error-muted text-error-foreground border-error",
        info: "bg-info-muted text-info-foreground border-info",
      },
      size: {
        default: "p-4",
        sm: "p-3 text-sm",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const iconMap = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

export interface AlertV2Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  description?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function AlertV2({
  className,
  variant = "default",
  size,
  title,
  description,
  dismissible,
  onDismiss,
  icon,
  action,
  children,
  ...props
}: AlertV2Props) {
  const Icon = iconMap[variant || "default"];

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, size }), className)}
      {...props}
    >
      {icon !== null && (icon || <Icon className="h-5 w-5" />)}

      <div className="flex-1">
        {title && (
          <h5 className="mb-1 font-semibold leading-none tracking-tight">
            {title}
          </h5>
        )}
        {description && (
          <div className="text-sm opacity-90">
            {description}
          </div>
        )}
        {children && <div className="mt-2">{children}</div>}

        {action && (
          <button
            onClick={action.onClick}
            className="mt-3 inline-flex items-center text-sm font-medium underline underline-offset-4 hover:no-underline"
          >
            {action.label}
          </button>
        )}
      </div>

      {dismissible && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-md p-1 hover:bg-background/50 focus:outline-none focus:ring-2"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

### 3. Status Indicators

**Create visual status components:**

```typescript
// apps/frontend/src/components/ui/status.tsx
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const statusDotVariants = cva(
  "inline-flex h-2 w-2 rounded-full",
  {
    variants: {
      variant: {
        online: "bg-success animate-pulse",
        offline: "bg-neutral-400",
        away: "bg-warning",
        busy: "bg-error",
        default: "bg-neutral-400",
      },
      size: {
        sm: "h-1.5 w-1.5",
        md: "h-2 w-2",
        lg: "h-3 w-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {
  label?: string;
}

export function StatusDot({
  variant,
  size,
  label,
  className,
  ...props
}: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(statusDotVariants({ variant, size }), className)}
        aria-label={label || `Status: ${variant}`}
        {...props}
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  );
}

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        success: "bg-success-muted text-success border border-success/20",
        warning: "bg-warning-muted text-warning border border-warning/20",
        error: "bg-error-muted text-error border border-error/20",
        info: "bg-info-muted text-info border border-info/20",
        neutral: "bg-neutral-100 text-neutral-700 border border-neutral-200",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean;
}

export function StatusBadge({
  variant,
  showDot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {showDot && <StatusDot variant={variant as any} size="sm" />}
      {children}
    </span>
  );
}
```

### 4. Enhanced Empty States

**Create engaging empty state component:**

```typescript
// apps/frontend/src/components/ui/empty-state-v2.tsx (enhanced)
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateV2Props {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: string[];
  className?: string;
}

export function EmptyStateV2({
  icon: Icon,
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  suggestions,
  className,
}: EmptyStateV2Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-4 py-12",
        className
      )}
    >
      {/* Visual Element */}
      <div className="mb-6 relative">
        {illustration ? (
          illustration
        ) : Icon ? (
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
            <div className="relative rounded-full bg-primary/10 p-6">
              <Icon className="h-12 w-12 text-primary" strokeWidth={1.5} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="max-w-md space-y-2 mb-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="mb-6 text-sm text-muted-foreground">
          <p className="mb-2 font-medium">Try:</p>
          <ul className="space-y-1">
            {suggestions.map((suggestion, i) => (
              <li key={i}>• {suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              leftIcon={primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## User Experience Refinements

### 1. Enhanced Chat Experience

#### A. Message Bubbles with Better Affordances

**File:** `apps/frontend/src/features/chat/components/MessageList.tsx`

**Improvements:**
- Add message actions (copy, retry, edit)
- Add hover states with action buttons
- Add message timestamps
- Add message status indicators
- Add code block improvements

```typescript
// Enhanced MessageBubble with actions
interface MessageActions {
  onCopy: (content: string) => void;
  onEdit?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

const MessageBubble = memo(({
  message,
  actions
}: {
  message: ChatMessageView;
  actions?: MessageActions;
}) => {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Message content */}
      <div className="message-content">
        {/* ... existing message rendering ... */}
      </div>

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {formatTime(message.timestamp)}
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="absolute -top-10 right-0 flex items-center gap-1 bg-popover border rounded-lg shadow-lg p-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>

          {message.role === "user" && actions?.onEdit && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => actions.onEdit?.(message.id)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}

          {message.role === "assistant" && message.error && actions?.onRetry && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => actions.onRetry?.(message.id)}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
```

#### B. Auto-scroll with User Control

```typescript
// apps/frontend/src/features/chat/components/MessageList.tsx
export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, ... }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);

    // Check if user has scrolled away from bottom
    const handleScroll = useCallback(() => {
      if (!scrollRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      setShowScrollToBottom(!isNearBottom);
      setAutoScroll(isNearBottom);
    }, []);

    // Auto-scroll on new messages if enabled
    useEffect(() => {
      if (autoScroll && scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, [messages, autoScroll]);

    return (
      <>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full flex-col gap-2 overflow-y-auto"
        >
          {/* Messages */}
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <button
            onClick={() => {
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth',
              });
              setAutoScroll(true);
            }}
            className="absolute bottom-4 right-4 rounded-full bg-primary text-primary-foreground p-3 shadow-lg hover:scale-110 transition-transform animate-in fade-in slide-in-from-bottom-2"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-5 w-5" />
            {/* Optional: Show unread count */}
          </button>
        )}
      </>
    );
  }
);
```

#### C. Enhanced Input with Character Count

```typescript
// apps/frontend/src/features/chat/components/ChatComposer.tsx
const MAX_CHARS = 4000;

export function ChatComposer() {
  const [input, setInput] = useState("");
  const charCount = input.length;
  const isNearLimit = charCount > MAX_CHARS * 0.8;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="relative">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        maxLength={MAX_CHARS}
        // ... other props
      />

      {/* Character Counter */}
      {charCount > 0 && (
        <div
          className={cn(
            "absolute bottom-2 right-2 text-xs transition-colors",
            isOverLimit && "text-error",
            isNearLimit && !isOverLimit && "text-warning",
            !isNearLimit && "text-muted-foreground"
          )}
        >
          {charCount} / {MAX_CHARS}
        </div>
      )}
    </div>
  );
}
```

### 2. Document Upload Enhancements

#### A. Upload Queue Management

```typescript
// apps/frontend/src/features/documents/components/UploadQueue.tsx
interface UploadQueueItem {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'paused';
  progress: number;
  error?: string;
}

export function UploadQueue() {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  const pauseUpload = (id: string) => {
    setQueue(q => q.map(item =>
      item.id === id ? { ...item, status: 'paused' } : item
    ));
  };

  const resumeUpload = (id: string) => {
    setQueue(q => q.map(item =>
      item.id === id ? { ...item, status: 'uploading' } : item
    ));
  };

  const cancelUpload = (id: string) => {
    setQueue(q => q.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-2">
      {queue.map((item) => (
        <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
          {/* File Icon */}
          <FileIcon className="h-8 w-8 text-muted-foreground" />

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(item.file.size)}
            </p>

            {/* Progress Bar */}
            {item.status === 'uploading' && (
              <Progress value={item.progress} className="mt-2 h-1" />
            )}

            {/* Status */}
            {item.status === 'success' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-success">
                <CheckCircle2 className="h-3 w-3" />
                <span>Uploaded</span>
              </div>
            )}

            {item.status === 'error' && (
              <div className="flex items-center gap-1 mt-1 text-xs text-error">
                <AlertCircle className="h-3 w-3" />
                <span>{item.error || 'Upload failed'}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {item.status === 'uploading' && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => pauseUpload(item.id)}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}

            {item.status === 'paused' && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => resumeUpload(item.id)}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}

            {item.status === 'error' && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => resumeUpload(item.id)}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => cancelUpload(item.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### B. Duplicate Detection

```typescript
// apps/frontend/src/features/documents/hooks/useDuplicateDetection.ts
export function useDuplicateDetection() {
  const { data: existingDocs } = useDocuments();

  const checkDuplicate = useCallback((file: File) => {
    if (!existingDocs) return null;

    // Check by name and size
    const duplicate = existingDocs.find(doc =>
      doc.filename === file.name &&
      doc.file_size === file.size
    );

    return duplicate;
  }, [existingDocs]);

  const checkDuplicates = useCallback((files: File[]) => {
    return files.map(file => ({
      file,
      duplicate: checkDuplicate(file),
    }));
  }, [checkDuplicate]);

  return { checkDuplicate, checkDuplicates };
}

// Usage in UploadDialog
const { checkDuplicates } = useDuplicateDetection();
const [duplicates, setDuplicates] = useState<Array<{file: File, duplicate: Document}>>([]);

const handleFilesSelected = (files: File[]) => {
  const result = checkDuplicates(files);
  const dupes = result.filter(r => r.duplicate);

  if (dupes.length > 0) {
    setDuplicates(dupes);
    // Show confirmation dialog
  } else {
    uploadFiles(files);
  }
};
```

### 3. Enhanced Search Experience

```typescript
// apps/frontend/src/components/GlobalSearch.tsx
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "sessions" | "documents">("all");
  const debouncedQuery = useDebounce(query, 300);

  const { data: sessionResults, isLoading: sessionsLoading } = useSearchSessions(
    debouncedQuery,
    { enabled: searchType === "all" || searchType === "sessions" }
  );

  const { data: documentResults, isLoading: docsLoading } = useSearchDocuments(
    debouncedQuery,
    { enabled: searchType === "all" || searchType === "documents" }
  );

  return (
    <Command className="rounded-lg border shadow-md">
      <div className="flex items-center border-b px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <Command.Input
          placeholder="Search sessions, documents, messages..."
          value={query}
          onValueChange={setQuery}
          className="flex-1"
        />

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant={searchType === "all" ? "default" : "ghost"}
            onClick={() => setSearchType("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={searchType === "sessions" ? "default" : "ghost"}
            onClick={() => setSearchType("sessions")}
          >
            Sessions
          </Button>
          <Button
            size="sm"
            variant={searchType === "documents" ? "default" : "ghost"}
            onClick={() => setSearchType("documents")}
          >
            Documents
          </Button>
        </div>
      </div>

      <Command.List className="max-h-[400px] overflow-y-auto">
        {(sessionsLoading || docsLoading) && (
          <Command.Loading>
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </Command.Loading>
        )}

        {/* Sessions Results */}
        {sessionResults && sessionResults.length > 0 && (
          <Command.Group heading="Sessions">
            {sessionResults.map((session) => (
              <Command.Item
                key={session.id}
                onSelect={() => router.push(`/?session=${session.id}`)}
                className="flex items-center gap-3"
              >
                <MessageSquare className="h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">{session.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(session.updated_at)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Document Results */}
        {documentResults && documentResults.length > 0 && (
          <Command.Group heading="Documents">
            {documentResults.map((doc) => (
              <Command.Item
                key={doc.id}
                onSelect={() => openDocument(doc.id)}
                className="flex items-center gap-3"
              >
                <FileText className="h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">{doc.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* No Results */}
        {query && !sessionsLoading && !docsLoading &&
         sessionResults?.length === 0 && documentResults?.length === 0 && (
          <Command.Empty>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                No results found for "{query}"
              </p>
              <p className="text-xs text-muted-foreground">
                Try different keywords or check your filters
              </p>
            </div>
          </Command.Empty>
        )}
      </Command.List>
    </Command>
  );
}
```

### 4. Offline Experience

```typescript
// apps/frontend/src/components/OfflineBanner.tsx
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        toast.success("You're back online!");
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2 text-center text-sm animate-in slide-in-from-top">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>You're offline. Some features may be unavailable.</span>
      </div>
    </div>
  );
}

// apps/frontend/src/lib/api-client.ts
export async function fetchWithOfflineSupport<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    if (!navigator.onLine) {
      throw new Error('You are currently offline');
    }
    throw error;
  }
}
```

---

## Animation & Micro-interactions

### 1. Enhanced Animation System

```typescript
// apps/frontend/src/lib/animations.ts
import { Variants } from "framer-motion";

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Spring configurations
export const springConfig = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const gentleSpring = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

export const bouncySpring = {
  type: "spring",
  stiffness: 400,
  damping: 20,
};
```

### 2. Skeleton Animations

```css
/* apps/frontend/src/app/globals.css */
@layer utilities {
  @keyframes skeleton-shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      hsl(var(--muted)) 0%,
      hsl(var(--muted-foreground) / 0.1) 50%,
      hsl(var(--muted)) 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 2s ease-in-out infinite;
  }
}
```

### 3. Interactive Button Feedback

```typescript
// apps/frontend/src/components/ui/interactive-button.tsx
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function InteractiveButton({
  children,
  loading,
  success,
  ...props
}: ButtonProps & { success?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </motion.div>
        ) : success ? (
          <motion.div
            key="success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Success!</span>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
```

### 4. Page Transitions

```typescript
// apps/frontend/src/components/PageTransition.tsx
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### 5. Hover Card with Delay

```typescript
// apps/frontend/src/components/ui/hover-card-enhanced.tsx
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { motion, AnimatePresence } from "framer-motion";

export function HoverCard({ children, content, delay = 300 }) {
  const [open, setOpen] = useState(false);

  return (
    <HoverCardPrimitive.Root
      open={open}
      onOpenChange={setOpen}
      openDelay={delay}
      closeDelay={100}
    >
      <HoverCardPrimitive.Trigger asChild>
        {children}
      </HoverCardPrimitive.Trigger>

      <AnimatePresence>
        {open && (
          <HoverCardPrimitive.Portal forceMount>
            <HoverCardPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bg-popover text-popover-foreground rounded-lg shadow-lg p-4 border"
              >
                {content}
              </motion.div>
            </HoverCardPrimitive.Content>
          </HoverCardPrimitive.Portal>
        )}
      </AnimatePresence>
    </HoverCardPrimitive.Root>
  );
}
```

---

## Accessibility Excellence

### 1. Screen Reader Announcements

```typescript
// apps/frontend/src/components/ScreenReaderAnnouncer.tsx
export function ScreenReaderAnnouncer() {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  useEffect(() => {
    // Listen for global announcement events
    const handleAnnounce = (e: CustomEvent) => {
      setAnnouncements(prev => [...prev, e.detail.message]);
      // Remove after announcement
      setTimeout(() => {
        setAnnouncements(prev => prev.slice(1));
      }, 1000);
    };

    window.addEventListener('announce' as any, handleAnnounce);
    return () => window.removeEventListener('announce' as any, handleAnnounce);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcements[announcements.length - 1]}
    </div>
  );
}

// Utility function
export function announce(message: string) {
  window.dispatchEvent(new CustomEvent('announce', { detail: { message } }));
}

// Usage
announce("Message sent successfully");
announce("Document uploaded");
```

### 2. Focus Management

```typescript
// apps/frontend/src/hooks/useFocusTrap.ts
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean = true) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const element = ref.current;
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    element.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      element.removeEventListener('keydown', handleTab);
    };
  }, [ref, active]);
}
```

### 3. Keyboard Navigation Enhancement

```typescript
// apps/frontend/src/hooks/useArrowKeyNavigation.ts
export function useArrowKeyNavigation(
  items: any[],
  onSelect: (item: any) => void
) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(prev =>
            prev < items.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(prev =>
            prev > 0 ? prev - 1 : items.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (items[activeIndex]) {
            onSelect(items[activeIndex]);
          }
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(items.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, activeIndex, onSelect]);

  return { activeIndex, setActiveIndex };
}
```

### 4. High Contrast Mode

```css
/* apps/frontend/src/app/globals.css */
@media (prefers-contrast: high) {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 0%;
    --border: 0 0% 20%;
    --primary: 0 0% 0%;
    --primary-foreground: 0 0% 100%;
  }

  .dark {
    --background: 0 0% 0%;
    --foreground: 0 0% 100%;
    --border: 0 0% 80%;
    --primary: 0 0% 100%;
    --primary-foreground: 0 0% 0%;
  }

  /* Increase border widths */
  * {
    border-width: 2px !important;
  }

  /* Ensure focus indicators are visible */
  *:focus-visible {
    outline: 3px solid currentColor !important;
    outline-offset: 3px !important;
  }
}
```

### 5. ARIA Live Regions

```typescript
// apps/frontend/src/features/chat/components/MessageList.tsx
<div
  role="log"
  aria-label="Chat messages"
  aria-live="polite"
  aria-atomic="false"
  aria-relevant="additions"
>
  {messages.map((message) => (
    <div
      key={message.id}
      role="article"
      aria-label={`Message from ${message.role === 'user' ? 'you' : 'assistant'}`}
      aria-describedby={`message-time-${message.id}`}
    >
      <div>{message.content}</div>
      <div id={`message-time-${message.id}`} className="sr-only">
        Sent at {formatTime(message.timestamp)}
      </div>
    </div>
  ))}
</div>
```

---

## Performance Optimization

### 1. Virtual Scrolling for Large Lists

```typescript
// apps/frontend/src/components/VirtualList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 80,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Image Optimization

```typescript
// apps/frontend/src/components/OptimizedImage.tsx
import Image from 'next/image';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function OptimizedImage({
  src,
  alt,
  ...props
}: ImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-muted">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {loading && <Skeleton className="absolute inset-0" />}
      <Image
        src={src}
        alt={alt}
        onLoadingComplete={() => setLoading(false)}
        onError={() => setError(true)}
        loading="lazy"
        quality={85}
        {...props}
      />
    </>
  );
}
```

### 3. Code Splitting

```typescript
// apps/frontend/src/features/documents/components/DocumentPage.tsx
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load heavy components
const UploadDialog = dynamic(
  () => import('./UploadDialog').then(mod => ({ default: mod.UploadDialog })),
  {
    loading: () => <Skeleton className="h-96" />,
    ssr: false,
  }
);

const IngestionHistory = dynamic(
  () => import('./IngestionHistory'),
  {
    loading: () => <Skeleton className="h-96" />,
  }
);

export function DocumentPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <Button onClick={() => setShowUpload(true)}>Upload</Button>
      {showUpload && <UploadDialog open={showUpload} onOpenChange={setShowUpload} />}
      <Suspense fallback={<Skeleton />}>
        <IngestionHistory />
      </Suspense>
    </>
  );
}
```

### 4. Memoization Patterns

```typescript
// Memoize expensive computations
const processedMessages = useMemo(() => {
  return messages.map(msg => ({
    ...msg,
    formatted: formatMessage(msg),
    tokens: countTokens(msg.content),
  }));
}, [messages]);

// Memoize callbacks
const handleMessageSend = useCallback((content: string) => {
  sendMessage({ content, sessionId });
}, [sessionId]);

// Memoize components
const MessageItem = memo(({ message }: { message: Message }) => {
  return <div>{message.content}</div>;
}, (prev, next) => prev.message.id === next.message.id && prev.message.content === next.message.content);
```

### 5. Request Deduplication

```typescript
// apps/frontend/src/lib/api-client.ts
const pendingRequests = new Map<string, Promise<any>>();

export async function fetchWithDedup<T>(url: string, options?: RequestInit): Promise<T> {
  const key = `${url}-${JSON.stringify(options)}`;

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  const promise = fetch(url, options)
    .then(res => res.json())
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}
```

---

## Mobile Experience

### 1. Touch Gestures

```typescript
// apps/frontend/src/hooks/useSwipeGesture.ts
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 50
) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

// Usage
const swipeHandlers = useSwipeGesture(
  () => console.log('Swiped left'),
  () => console.log('Swiped right')
);

<div {...swipeHandlers}>Swipe me!</div>
```

### 2. Pull to Refresh

```typescript
// apps/frontend/src/components/PullToRefresh.tsx
export function PullToRefresh({
  onRefresh,
  children
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);

  const threshold = 80;

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (window.scrollY === 0 && startY.current > 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        setPulling(true);
        setPullDistance(Math.min(distance, threshold + 40));
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }

    setPulling(false);
    setPullDistance(0);
    startY.current = 0;
  };

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, refreshing]);

  return (
    <div className="relative">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all"
        style={{
          height: pullDistance,
          opacity: pulling ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          {refreshing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <motion.div
              animate={{ rotate: pullDistance >= threshold ? 180 : 0 }}
            >
              <ArrowDown className="h-6 w-6" />
            </motion.div>
          )}
          <span className="text-sm text-muted-foreground">
            {refreshing ? 'Refreshing...' : pullDistance >= threshold ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pulling ? 'none' : 'transform 0.3s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

### 3. Bottom Sheet for Mobile

```typescript
// apps/frontend/src/components/ui/bottom-sheet.tsx
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function BottomSheet({
  children,
  open,
  onOpenChange,
  title
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        {/* Drag handle */}
        <div className="mx-auto w-12 h-1.5 rounded-full bg-muted-foreground/20 mb-4" />

        {title && (
          <h2 className="text-lg font-semibold mb-4">{title}</h2>
        )}

        <div className="overflow-y-auto h-full pb-safe">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### 4. Safe Area Handling

```css
/* apps/frontend/src/app/globals.css */
@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .pt-safe {
    padding-top: env(safe-area-inset-top);
  }

  .pl-safe {
    padding-left: env(safe-area-inset-left);
  }

  .pr-safe {
    padding-right: env(safe-area-inset-right);
  }

  /* Keyboard spacer for mobile */
  .keyboard-spacer {
    height: env(keyboard-inset-height, 0px);
  }
}
```

---

## Information Architecture

### 1. Breadcrumbs

```typescript
// apps/frontend/src/components/Breadcrumbs.tsx
export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground transition-colors">
        Home
      </Link>

      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const label = segment.charAt(0).toUpperCase() + segment.slice(1);

        return (
          <Fragment key={href}>
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span aria-current="page" className="text-foreground font-medium">
                {label}
              </span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
```

### 2. Settings Organization

```typescript
// apps/frontend/src/app/settings/page.tsx
export default function SettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <Tabs defaultValue="appearance" className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="ai">AI Settings</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how YouWorker.AI looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Selection */}
              <div>
                <Label>Theme</Label>
                <RadioGroup>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark">Dark</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="system" id="system" />
                    <Label htmlFor="system">System</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Font Size */}
              <div>
                <Label>Font Size</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs... */}
      </Tabs>
    </div>
  );
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
**Priority: Critical**

1. **Design System Enhancement**
   - [ ] Implement expanded color system with semantic colors
   - [ ] Create comprehensive typography components
   - [ ] Build spacing and layout utilities (Stack, HStack, VStack)
   - [ ] Update Tailwind config with new design tokens
   - [ ] Add elevation shadow system

2. **Component Library Improvements**
   - [ ] Enhance Button component with loading states and icons
   - [ ] Create AlertV2 component with rich variants
   - [ ] Build Status indicators (StatusDot, StatusBadge)
   - [ ] Enhance EmptyState component with illustrations

**Deliverables:**
- Fully functional design system
- Updated component library
- Design token documentation

### Phase 2: User Experience (Weeks 3-4)
**Priority: High**

1. **Chat Experience Enhancements**
   - [ ] Add message actions (copy, edit, retry)
   - [ ] Implement auto-scroll with user control
   - [ ] Add character counter to input
   - [ ] Add message timestamps
   - [ ] Improve streaming cursor animation

2. **Document Management**
   - [ ] Build upload queue with pause/resume
   - [ ] Add duplicate detection
   - [ ] Implement drag-and-drop improvements
   - [ ] Add batch operations UI

3. **Search & Navigation**
   - [ ] Create global search component
   - [ ] Add search filtering
   - [ ] Implement breadcrumbs
   - [ ] Enhance command palette

**Deliverables:**
- Polished chat interface
- Advanced document management
- Improved navigation

### Phase 3: Polish & Delight (Weeks 5-6)
**Priority: Medium-High**

1. **Animations & Micro-interactions**
   - [ ] Implement animation system with Framer Motion
   - [ ] Add skeleton shimmer effects
   - [ ] Create interactive button feedback
   - [ ] Add page transitions
   - [ ] Build hover cards with delays

2. **Mobile Experience**
   - [ ] Implement swipe gestures
   - [ ] Add pull-to-refresh
   - [ ] Create bottom sheet component
   - [ ] Add safe area handling
   - [ ] Optimize touch targets

**Deliverables:**
- Smooth animations throughout app
- Native-feeling mobile experience

### Phase 4: Accessibility (Weeks 7-8)
**Priority: High**

1. **A11y Excellence**
   - [ ] Add screen reader announcements
   - [ ] Implement focus management
   - [ ] Enhance keyboard navigation
   - [ ] Add high contrast mode
   - [ ] Create ARIA live regions
   - [ ] Conduct WCAG AAA audit

2. **Offline Support**
   - [ ] Build offline banner
   - [ ] Add request queuing
   - [ ] Implement service worker
   - [ ] Add offline storage

**Deliverables:**
- WCAG AAA compliant application
- Functional offline mode

### Phase 5: Performance (Weeks 9-10)
**Priority: Medium**

1. **Optimization**
   - [ ] Implement virtual scrolling
   - [ ] Add image optimization
   - [ ] Code splitting for heavy components
   - [ ] Add memoization patterns
   - [ ] Implement request deduplication

2. **Settings & Customization**
   - [ ] Reorganize settings page with tabs
   - [ ] Add more customization options
   - [ ] Implement settings export/import
   - [ ] Add keyboard shortcut customization

**Deliverables:**
- 60fps consistent performance
- Comprehensive settings page

### Phase 6: Testing & Documentation (Weeks 11-12)
**Priority: Medium**

1. **Quality Assurance**
   - [ ] Write unit tests for new components
   - [ ] Add integration tests
   - [ ] E2E tests with Playwright
   - [ ] Accessibility testing
   - [ ] Performance testing

2. **Documentation**
   - [ ] Component documentation
   - [ ] Design system guide
   - [ ] Accessibility guide
   - [ ] Animation guide
   - [ ] Mobile best practices

**Deliverables:**
- 90%+ test coverage
- Comprehensive documentation

---

## Success Metrics

### Quantitative Metrics
- **Performance:** Lighthouse score > 95 across all categories
- **Accessibility:** WCAG AAA compliance (100%)
- **Test Coverage:** > 90% code coverage
- **Bundle Size:** < 200KB initial load (gzipped)
- **First Contentful Paint:** < 1.2s
- **Time to Interactive:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

### Qualitative Metrics
- User delight score (surveys)
- Task completion rate
- Error recovery success rate
- Mobile vs desktop satisfaction
- Accessibility user feedback

---

## Tools & Resources

### Design Tools
- **Figma** - Design mockups and prototypes
- **Storybook** - Component documentation
- **Chromatic** - Visual regression testing

### Testing Tools
- **Vitest** - Unit testing
- **Testing Library** - Component testing
- **Playwright** - E2E testing
- **axe DevTools** - Accessibility testing
- **Lighthouse** - Performance auditing

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type safety
- **Husky** - Git hooks
- **Commitlint** - Commit message linting

---

## Appendix

### Color Palette Reference
See section: [Design System Enhancement > Color System Expansion](#1-color-system-expansion)

### Component API Reference
All new components should follow this structure:
```typescript
export interface ComponentProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof variants> {
  // Required props
  children: React.ReactNode;

  // Optional props with defaults
  variant?: "default" | "outline" | ...;
  size?: "sm" | "md" | "lg";

  // Event handlers
  onClick?: () => void;
  onFocus?: () => void;

  // Accessibility
  "aria-label"?: string;

  // Styling
  className?: string;
}
```

### Animation Timing Reference
- **Fast:** 150ms - Small UI elements (tooltips, dropdowns)
- **Base:** 250ms - Standard transitions (buttons, modals)
- **Slow:** 350ms - Large movements (page transitions, drawers)
- **Entrance:** 300-400ms with ease-out
- **Exit:** 200-300ms with ease-in

---

**End of Document**

This comprehensive guide provides a complete blueprint for transforming YouWorker.AI's frontend into a UI/UX masterpiece. Each section includes actionable code examples, best practices, and implementation details ready for development.
