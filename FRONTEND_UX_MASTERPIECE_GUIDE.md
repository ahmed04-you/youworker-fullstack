# YouWorker.AI Frontend - UI/UX Masterpiece Refactoring Guide

> **Version:** 2.0
> **Last Updated:** 2025-10-30
> **Status:** Comprehensive Refactoring Roadmap
> **Goal:** Transform the frontend into a world-class, delightful user experience

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Design System Evolution](#3-design-system-evolution)
4. [Visual Design Enhancements](#4-visual-design-enhancements)
5. [Component-Level Refactoring](#5-component-level-refactoring)
6. [Layout & Information Architecture](#6-layout--information-architecture)
7. [Interaction Design & Micro-interactions](#7-interaction-design--micro-interactions)
8. [Animation & Motion Design](#8-animation--motion-design)
9. [Accessibility Excellence](#9-accessibility-excellence)
10. [Performance Optimizations](#10-performance-optimizations)
11. [Mobile-First Experience](#11-mobile-first-experience)
12. [Advanced UX Patterns](#12-advanced-ux-patterns)
13. [Empty States & Error Handling](#13-empty-states--error-handling)
14. [Onboarding & User Guidance](#14-onboarding--user-guidance)
15. [Implementation Roadmap](#15-implementation-roadmap)
16. [Success Metrics](#16-success-metrics)

---

## 1. Executive Summary

### Current Strengths
- **Modern Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Solid Foundation:** Radix UI for accessible components, Zustand for state management
- **Good Architecture:** Feature-based structure, clean separation of concerns
- **Accessibility Base:** ARIA labels, keyboard shortcuts, skip links implemented
- **Dark Mode:** Theme switching with next-themes

### Key Gaps Identified
- **Generic Visual Identity:** Default shadcn/ui colors, lacks unique brand personality
- **Basic Interactions:** Limited micro-interactions and feedback mechanisms
- **Simple Animations:** Minimal use of motion design for delight
- **Information Hierarchy:** Could be stronger in visual hierarchy and content organization
- **Empty States:** Basic empty states lack engagement
- **Loading Patterns:** Simple loaders, could use skeleton screens
- **Mobile UX:** Functional but not optimized for mobile-first experience

### Vision
Transform YouWorker.AI into a **premium, delightful AI assistant interface** that combines:
- **Beautiful Visual Design** - Unique, memorable, and polished
- **Fluid Interactions** - Smooth animations and responsive feedback
- **Intuitive UX** - Zero learning curve, progressive disclosure
- **Accessible** - WCAG AAA compliant where possible
- **Performant** - 60fps animations, instant feedback

---

## 2. Current State Analysis

### 2.1 Architecture Assessment

**Strengths:**
- Feature-based organization (`features/chat`, `features/documents`)
- Shared UI components library (`components/ui/`)
- Proper state management separation (Zustand stores, Context API)
- TanStack Query for server state
- Comprehensive TypeScript coverage

**Areas for Improvement:**
- Component prop interfaces could be more granular
- Limited use of compound component patterns
- Some components are too large (sidebar.tsx is 470 lines)
- Missing component composition documentation

### 2.2 Design System Analysis

**Current Color System:**
```css
/* globals.css - Current HSL Variables */
--primary: 222.2 47.4% 11.2%  /* Dark blue-gray */
--secondary: 210 40% 96.1%     /* Light gray */
--accent: 210 40% 96.1%        /* Same as secondary - no distinction */
```

**Issues:**
- Generic shadcn/ui default colors
- No brand personality or emotional connection
- Limited color palette (only 7 semantic colors)
- No intermediate shades for depth
- Accent color identical to secondary (redundant)

**Current Typography:**
```tsx
// layout.tsx
const inter = Inter({ subsets: ["latin"] });
```

**Issues:**
- Single font family (Inter)
- No display font for headings
- Basic font size system (relies on Tailwind defaults)
- No fluid typography (responsive font scaling)

### 2.3 Component Inventory

| Component | Accessibility | Visual Polish | Interactions | Notes |
|-----------|--------------|---------------|--------------|-------|
| Button | ✅ Good | ⚠️ Basic | ⚠️ Basic | Lacks pressed states, loading variants |
| Sidebar | ✅ Good | ⚠️ Basic | ⚠️ Limited | 470 lines, needs splitting |
| MessageList | ✅ Good | ⚠️ Basic | ⚠️ Basic | Simple bubbles, no reactions |
| ChatComposer | ✅ Excellent | ✅ Good | ✅ Good | Best component, voice waveform |
| Dialog | ✅ Excellent | ⚠️ Basic | ⚠️ Basic | Radix native, minimal customization |
| Empty State | ✅ Good | ❌ Poor | ❌ Poor | No illustrations, minimal engagement |

**Legend:** ✅ Good | ⚠️ Needs Improvement | ❌ Requires Major Work

### 2.4 User Flow Analysis

**Chat Flow:**
1. **Home Page** → Basic empty state with sample prompts
2. **Message Input** → Textarea with voice button
3. **Response Streaming** → Text appears with cursor
4. **Session Management** → Sidebar list with rename/delete

**Pain Points:**
- No visual feedback during streaming beyond cursor
- Empty state doesn't showcase features
- Session list is plain text (no previews, tags, or metadata)
- No inline message actions (copy, regenerate, edit)
- Limited keyboard navigation between messages

**Document Flow:**
1. **Documents Page** → Simple list with tabs
2. **Upload** → Basic dialog
3. **Ingestion History** → Table view

**Pain Points:**
- No drag-and-drop area highlighting
- No upload progress visualization
- No document preview on hover
- No bulk actions
- Limited filtering UI

---

## 3. Design System Evolution

### 3.1 Color Palette Redesign

**Objective:** Create a unique, memorable brand identity with a comprehensive color system.

#### Primary Brand Colors

```typescript
// apps/frontend/src/lib/design-tokens.ts (NEW FILE)

export const brandColors = {
  // Primary - Deep Neural Blue (AI/Tech aesthetic)
  primary: {
    50: '237 242 255',   // hsl(230, 100%, 97%)
    100: '219 229 255',  // hsl(230, 100%, 93%)
    200: '191 207 255',  // hsl(230, 100%, 87%)
    300: '145 175 255',  // hsl(230, 100%, 78%)
    400: '99 143 255',   // hsl(230, 100%, 69%)
    500: '59 113 255',   // hsl(230, 100%, 62%) - Main
    600: '37 85 230',    // hsl(230, 84%, 52%)
    700: '25 63 184',    // hsl(230, 76%, 41%)
    800: '20 51 138',    // hsl(230, 75%, 31%)
    900: '18 42 92',     // hsl(230, 67%, 22%)
    950: '11 23 46',     // hsl(230, 62%, 11%)
  },

  // Secondary - Electric Cyan (Accent/Energy)
  secondary: {
    50: '236 254 255',   // hsl(185, 100%, 96%)
    100: '207 250 254',  // hsl(185, 96%, 90%)
    200: '165 243 252',  // hsl(185, 96%, 82%)
    300: '103 232 249',  // hsl(185, 92%, 69%)
    400: '34 211 238',   // hsl(185, 84%, 53%)
    500: '6 182 212',    // hsl(185, 94%, 43%) - Main
    600: '8 145 178',    // hsl(185, 91%, 36%)
    700: '14 116 144',   // hsl(185, 82%, 31%)
    800: '21 94 117',    // hsl(185, 69%, 27%)
    900: '22 78 99',     // hsl(185, 64%, 24%)
    950: '8 51 68',      // hsl(185, 79%, 15%)
  },

  // Accent - Vibrant Purple (Premium/Creative)
  accent: {
    50: '250 245 255',   // hsl(270, 100%, 98%)
    100: '243 232 255',  // hsl(270, 100%, 95%)
    200: '233 213 255',  // hsl(270, 100%, 92%)
    300: '216 180 254',  // hsl(270, 95%, 85%)
    400: '192 132 252',  // hsl(270, 95%, 75%)
    500: '168 85 247',   // hsl(270, 91%, 65%) - Main
    600: '147 51 234',   // hsl(270, 81%, 56%)
    700: '126 34 206',   // hsl(270, 72%, 47%)
    800: '107 33 168',   // hsl(270, 67%, 39%)
    900: '88 28 135',    // hsl(270, 66%, 32%)
    950: '59 7 100',     // hsl(270, 87%, 21%)
  },

  // Success - Emerald Green
  success: {
    50: '236 253 245',
    500: '16 185 129',  // Main
    900: '6 78 59',
  },

  // Warning - Amber
  warning: {
    50: '255 251 235',
    500: '245 158 11',  // Main
    900: '120 53 15',
  },

  // Error - Rose Red
  error: {
    50: '255 241 242',
    500: '244 63 94',   // Main
    900: '136 19 55',
  },

  // Neutral - Refined Grays
  neutral: {
    50: '250 250 250',
    100: '245 245 245',
    200: '229 229 229',
    300: '212 212 212',
    400: '163 163 163',
    500: '115 115 115',
    600: '82 82 82',
    700: '64 64 64',
    800: '38 38 38',
    900: '23 23 23',
    950: '10 10 10',
  }
};
```

#### Updated CSS Variables

```css
/* apps/frontend/src/app/globals.css - REPLACE */

@layer base {
  :root {
    /* Light Mode */
    --background: 0 0% 100%;
    --foreground: 230 67% 11%;

    /* Primary Brand Colors */
    --primary: 230 100% 62%;
    --primary-foreground: 0 0% 100%;
    --primary-hover: 230 84% 52%;

    /* Secondary/Accent */
    --secondary: 185 94% 43%;
    --secondary-foreground: 0 0% 100%;
    --secondary-hover: 185 91% 36%;

    /* Accent */
    --accent: 270 91% 65%;
    --accent-foreground: 0 0% 100%;
    --accent-hover: 270 81% 56%;

    /* Semantic Colors */
    --success: 158 64% 52%;
    --success-foreground: 0 0% 100%;

    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;

    --destructive: 350 89% 60%;
    --destructive-foreground: 0 0% 100%;

    /* Surface Colors */
    --card: 0 0% 100%;
    --card-foreground: 230 67% 11%;

    --popover: 0 0% 100%;
    --popover-foreground: 230 67% 11%;

    --muted: 230 30% 96%;
    --muted-foreground: 230 15% 45%;

    /* Borders & Inputs */
    --border: 230 20% 88%;
    --input: 230 20% 88%;
    --ring: 230 100% 62%;

    /* Radius */
    --radius: 0.75rem; /* Increased from 0.5rem for softer feel */
  }

  .dark {
    /* Dark Mode */
    --background: 230 35% 7%;
    --foreground: 230 15% 95%;

    /* Primary Brand Colors */
    --primary: 230 100% 69%;
    --primary-foreground: 230 67% 11%;
    --primary-hover: 230 100% 78%;

    /* Secondary/Accent */
    --secondary: 185 92% 69%;
    --secondary-foreground: 185 79% 15%;
    --secondary-hover: 185 96% 82%;

    /* Accent */
    --accent: 270 95% 75%;
    --accent-foreground: 270 87% 21%;
    --accent-hover: 270 95% 85%;

    /* Semantic Colors */
    --success: 158 64% 52%;
    --success-foreground: 158 50% 10%;

    --warning: 38 92% 50%;
    --warning-foreground: 38 80% 10%;

    --destructive: 350 89% 60%;
    --destructive-foreground: 350 75% 10%;

    /* Surface Colors */
    --card: 230 30% 11%;
    --card-foreground: 230 15% 95%;

    --popover: 230 30% 11%;
    --popover-foreground: 230 15% 95%;

    --muted: 230 25% 17%;
    --muted-foreground: 230 15% 65%;

    /* Borders & Inputs */
    --border: 230 20% 22%;
    --input: 230 20% 22%;
    --ring: 230 100% 69%;
  }
}
```

### 3.2 Typography System

**Objective:** Create a hierarchical, readable, and expressive type system.

#### Font Stack

```typescript
// apps/frontend/src/app/layout.tsx - UPDATE

import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

// Body font - Inter (keep existing, excellent readability)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Display font - Plus Jakarta Sans (headings, hero text)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Monospace - JetBrains Mono (code blocks, technical content)
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// In body tag:
<body className={`${inter.variable} ${jakarta.variable} ${mono.variable} font-sans`}>
```

#### Typography Scale

```css
/* apps/frontend/src/app/globals.css - ADD */

@layer base {
  /* Fluid Typography - Responsive font sizes */
  :root {
    /* Font Families */
    --font-sans: Inter, system-ui, sans-serif;
    --font-display: "Plus Jakarta Sans", Inter, system-ui, sans-serif;
    --font-mono: "JetBrains Mono", "Fira Code", monospace;

    /* Type Scale - Fluid sizing */
    --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
    --text-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
    --text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
    --text-lg: clamp(1.125rem, 1.05rem + 0.375vw, 1.25rem);
    --text-xl: clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem);
    --text-2xl: clamp(1.5rem, 1.35rem + 0.75vw, 1.875rem);
    --text-3xl: clamp(1.875rem, 1.65rem + 1.125vw, 2.25rem);
    --text-4xl: clamp(2.25rem, 1.95rem + 1.5vw, 3rem);
    --text-5xl: clamp(3rem, 2.55rem + 2.25vw, 4rem);

    /* Line Heights */
    --leading-tight: 1.25;
    --leading-snug: 1.375;
    --leading-normal: 1.5;
    --leading-relaxed: 1.625;
    --leading-loose: 2;

    /* Letter Spacing */
    --tracking-tighter: -0.05em;
    --tracking-tight: -0.025em;
    --tracking-normal: 0;
    --tracking-wide: 0.025em;
    --tracking-wider: 0.05em;
  }

  /* Typography Classes */
  .text-display {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: var(--tracking-tight);
    line-height: var(--leading-tight);
  }

  .text-body {
    font-family: var(--font-sans);
    font-weight: 400;
    letter-spacing: var(--tracking-normal);
    line-height: var(--leading-normal);
  }

  .text-mono {
    font-family: var(--font-mono);
    font-size: 0.9em;
    letter-spacing: var(--tracking-tight);
  }
}
```

### 3.3 Spacing & Layout System

```typescript
// apps/frontend/tailwind.config.ts - UPDATE extend section

extend: {
  spacing: {
    '18': '4.5rem',
    '88': '22rem',
    '112': '28rem',
    '128': '32rem',
  },

  maxWidth: {
    '8xl': '88rem',
    '9xl': '96rem',
  },

  zIndex: {
    '60': '60',
    '70': '70',
    '80': '80',
    '90': '90',
    '100': '100',
  },
}
```

### 3.4 Shadow System

```css
/* apps/frontend/src/app/globals.css - ADD */

@layer base {
  :root {
    /* Elevation System */
    --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
    --shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);

    /* Colored Shadows for Brand Elements */
    --shadow-primary: 0 10px 25px -5px hsl(var(--primary) / 0.3);
    --shadow-secondary: 0 10px 25px -5px hsl(var(--secondary) / 0.3);
    --shadow-accent: 0 10px 25px -5px hsl(var(--accent) / 0.3);
  }

  .dark {
    --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.3);
    --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5);
    --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.6);

    --shadow-primary: 0 10px 25px -5px hsl(var(--primary) / 0.5);
    --shadow-secondary: 0 10px 25px -5px hsl(var(--secondary) / 0.5);
    --shadow-accent: 0 10px 25px -5px hsl(var(--accent) / 0.5);
  }
}
```

---

## 4. Visual Design Enhancements

### 4.1 Glassmorphism & Depth

**Current State:** Basic backdrop-blur on some components.

**Enhancement:**

```css
/* apps/frontend/src/app/globals.css - UPDATE components layer */

@layer components {
  /* Glass Effect - Premium feel */
  .glass {
    background: hsl(var(--card) / 0.7);
    backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid hsl(var(--border) / 0.5);
  }

  .glass-strong {
    background: hsl(var(--card) / 0.85);
    backdrop-filter: blur(24px) saturate(200%);
    border: 1px solid hsl(var(--border) / 0.8);
  }

  /* Gradient Overlays */
  .gradient-overlay {
    position: relative;
  }

  .gradient-overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      hsl(var(--primary) / 0.1) 0%,
      transparent 50%,
      hsl(var(--accent) / 0.1) 100%
    );
    pointer-events: none;
    border-radius: inherit;
  }

  /* Mesh Gradient Background */
  .mesh-gradient {
    background:
      radial-gradient(at 27% 37%, hsl(var(--primary) / 0.15) 0px, transparent 50%),
      radial-gradient(at 97% 21%, hsl(var(--secondary) / 0.15) 0px, transparent 50%),
      radial-gradient(at 52% 99%, hsl(var(--accent) / 0.15) 0px, transparent 50%),
      radial-gradient(at 10% 29%, hsl(var(--primary) / 0.1) 0px, transparent 50%),
      radial-gradient(at 97% 96%, hsl(var(--secondary) / 0.1) 0px, transparent 50%),
      radial-gradient(at 33% 50%, hsl(var(--accent) / 0.1) 0px, transparent 50%),
      radial-gradient(at 79% 53%, hsl(var(--primary) / 0.1) 0px, transparent 50%);
  }

  /* Spotlight Effect for Interactive Elements */
  .spotlight {
    position: relative;
    overflow: hidden;
  }

  .spotlight::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
      hsl(var(--primary) / 0.1),
      transparent 40%
    );
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }

  .spotlight:hover::after {
    opacity: 1;
  }
}
```

### 4.2 Button Enhancements

**File:** `apps/frontend/src/components/ui/button.tsx`

```typescript
// UPDATE buttonVariants

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",

        secondary:
          "bg-secondary text-secondary-foreground shadow-md hover:bg-secondary-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",

        accent:
          "bg-accent text-accent-foreground shadow-md hover:bg-accent-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",

        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",

        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent",

        ghost:
          "hover:bg-accent/50 hover:text-accent-foreground",

        link:
          "text-primary underline-offset-4 hover:underline",

        gradient:
          "bg-gradient-to-r from-primary via-secondary to-accent text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### 4.3 Card Enhancements

**Create:** `apps/frontend/src/components/ui/enhanced-card.tsx`

```typescript
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient" | "spotlight";
  hover?: boolean;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant = "default", hover = true, children, ...props }, ref) => {
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
    const cardRef = React.useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current || variant !== "spotlight") return;

      const rect = cardRef.current.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const variantClasses = {
      default: "bg-card border border-border",
      glass: "glass",
      gradient: "gradient-overlay bg-card border border-border",
      spotlight: "spotlight bg-card border border-border",
    };

    const hoverClass = hover
      ? "transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      : "";

    return (
      <div
        ref={(node) => {
          cardRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        onMouseMove={handleMouseMove}
        style={
          variant === "spotlight"
            ? ({
                "--mouse-x": `${mousePosition.x}px`,
                "--mouse-y": `${mousePosition.y}px`,
              } as React.CSSProperties)
            : undefined
        }
        className={cn(
          "rounded-xl p-6 shadow-lg",
          variantClasses[variant],
          hoverClass,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
EnhancedCard.displayName = "EnhancedCard";

export { EnhancedCard };
```

---

## 5. Component-Level Refactoring

### 5.1 Sidebar Redesign

**Current Issues:**
- 470 lines (too large)
- Basic visual design
- No session preview
- Limited metadata display

**Refactoring Strategy:**

Split into smaller components:

```
components/sidebar/
├── SidebarContainer.tsx        # Main container
├── SidebarHeader.tsx           # Logo & branding
├── SessionList.tsx             # Session list
├── SessionCard.tsx             # Individual session
├── SessionActions.tsx          # Rename/Delete dropdowns
├── NavigationLinks.tsx         # Documents/Settings links
└── UserProfile.tsx             # User info at bottom
```

**Enhanced Session Card:**

```typescript
// apps/frontend/src/components/sidebar/SessionCard.tsx (NEW FILE)

"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { MessageSquare, Clock, Sparkles, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SessionCardProps {
  session: {
    id: string;
    title?: string;
    updated_at: string;
    message_count?: number;
    has_tools?: boolean;
    preview_text?: string;
  };
  isActive: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function SessionCard({
  session,
  isActive,
  onClick,
  onRename,
  onDelete
}: SessionCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative w-full rounded-xl border p-3 transition-all duration-200 cursor-pointer",
        isActive
          ? "border-primary bg-primary/5 shadow-md shadow-primary/20"
          : "border-border/50 bg-card/50 hover:border-primary/30 hover:bg-card hover:shadow-md"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn(
              "text-sm font-semibold truncate",
              isActive ? "text-primary" : "text-foreground"
            )}>
              {session.title || "New Conversation"}
            </h4>
            {session.has_tools && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-xs"
              >
                <Sparkles className="h-3 w-3" />
              </Badge>
            )}
          </div>

          {/* Preview Text */}
          {session.preview_text && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {session.preview_text}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}</span>
            </div>
            {session.message_count && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{session.message_count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-full transition-opacity",
                isHovered || isActive ? "opacity-100" : "opacity-0"
              )}
              aria-label="Session options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

### 5.2 Message Bubble Redesign

**Current Issues:**
- Simple text bubbles
- No inline actions
- No reactions or formatting toolbar
- Limited visual hierarchy

**Enhanced Message Bubble:**

```typescript
// apps/frontend/src/features/chat/components/EnhancedMessageBubble.tsx (NEW FILE)

"use client";

import { useState, memo } from "react";
import { Bot, User, Copy, RefreshCw, Edit2, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { cn } from "@/lib/utils";

interface EnhancedMessageBubbleProps {
  message: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    streaming?: boolean;
    toolCallName?: string;
    timestamp?: string;
  };
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onFeedback?: (type: "up" | "down") => void;
}

export const EnhancedMessageBubble = memo(function EnhancedMessageBubble({
  message,
  onCopy,
  onRegenerate,
  onEdit,
  onFeedback,
}: EnhancedMessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const handleFeedback = (type: "up" | "down") => {
    setFeedbackGiven(type);
    onFeedback?.(type);
  };

  if (isUser) {
    return (
      <div
        className="flex items-start gap-3 justify-end group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Inline Actions (Left of Message) */}
        <div
          className={cn(
            "flex items-center gap-1 mt-2 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit message</TooltipContent>
          </Tooltip>
        </div>

        {/* Message Content */}
        <div className="flex flex-col items-end gap-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground shadow-lg">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-1.5 ring-2 ring-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    return (
      <div
        className="flex items-start gap-3 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div className="relative">
            <div className="rounded-full bg-gradient-to-br from-primary to-accent p-1.5 shadow-md">
              <Bot className="h-4 w-4 text-white" />
            </div>
            {message.streaming && (
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            )}
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-muted/50 px-4 py-3 shadow-sm">
            <div className="text-sm leading-relaxed text-foreground">
              <MarkdownRenderer content={message.content} />
              {message.streaming && (
                <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse" />
              )}
            </div>

            {/* Tool Call Badge */}
            {message.toolCallName && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {message.toolCallName}
                </Badge>
              </div>
            )}
          </div>

          {/* Inline Actions (Below Message) */}
          <div
            className={cn(
              "flex items-center gap-1 mt-2 transition-opacity",
              isHovered ? "opacity-100" : "opacity-0"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRegenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>

            <div className="w-px h-4 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    feedbackGiven === "up" && "text-success"
                  )}
                  onClick={() => handleFeedback("up")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Good response</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    feedbackGiven === "down" && "text-destructive"
                  )}
                  onClick={() => handleFeedback("down")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Poor response</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  }

  return null;
});
```

### 5.3 Chat Composer Enhancement

**Current State:** Good foundation with voice waveform.

**Enhancements:**

```typescript
// apps/frontend/src/features/chat/components/ChatComposer.tsx - ADD features

// After existing textarea, add:

{/* Character Counter */}
<div className="flex items-center justify-between text-xs text-muted-foreground px-1">
  <div className="flex items-center gap-2">
    {input.length > 0 && (
      <span className={cn(
        "transition-colors",
        input.length > 5000 && "text-warning",
        input.length > 8000 && "text-destructive"
      )}>
        {input.length} / 10000
      </span>
    )}
  </div>

  <div className="flex items-center gap-2">
    <span className="text-muted-foreground/70">
      Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to send,{" "}
      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Shift+Enter</kbd> for new line
    </span>
  </div>
</div>

{/* Quick Actions / Suggestions */}
{input.length === 0 && !isRecording && (
  <div className="flex flex-wrap gap-2 mt-2">
    {["Explain...", "Write code", "Summarize", "Brainstorm"].map((prompt) => (
      <button
        key={prompt}
        onClick={() => onInputChange(prompt + " ")}
        className="px-3 py-1.5 text-xs rounded-full bg-muted/50 hover:bg-muted transition-colors"
      >
        {prompt}
      </button>
    ))}
  </div>
)}
```

---

## 6. Layout & Information Architecture

### 6.1 Homepage Hero Section

**Current:** Basic empty state with minimal branding.

**Enhanced Hero:**

```typescript
// apps/frontend/src/components/HeroEmptyState.tsx (NEW FILE)

"use client";

import { useState } from "react";
import { BrainCircuit, Sparkles, Zap, Search, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedCard } from "@/components/ui/enhanced-card";

interface HeroEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export function HeroEmptyState({ onPromptClick }: HeroEmptyStateProps) {
  const features = [
    {
      icon: Sparkles,
      title: "AI Tools",
      description: "Access powerful tools for research and analysis",
      color: "text-accent",
    },
    {
      icon: Zap,
      title: "Instant Answers",
      description: "Get fast, accurate responses to any question",
      color: "text-secondary",
    },
    {
      icon: Search,
      title: "Semantic Search",
      description: "Find information across your documents instantly",
      color: "text-primary",
    },
  ];

  const examplePrompts = [
    {
      category: "Creative",
      prompts: [
        "Write a compelling blog post about AI in healthcare",
        "Generate creative ideas for a mobile app",
        "Draft a professional email to a client",
      ],
    },
    {
      category: "Technical",
      prompts: [
        "Explain how neural networks work",
        "Write a Python function to sort an array",
        "Debug this JavaScript code snippet",
      ],
    },
    {
      category: "Research",
      prompts: [
        "Summarize the latest AI research trends",
        "Compare different project management methodologies",
        "Analyze this data and find patterns",
      ],
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-6 mesh-gradient">
      {/* Hero Section */}
      <div className="max-w-4xl w-full space-y-8 text-center">
        {/* Logo & Branding */}
        <div className="space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 rounded-3xl bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 backdrop-blur-sm border border-white/10 shadow-2xl">
            <BrainCircuit className="h-16 w-16 text-primary" />
          </div>

          <h1 className="text-display text-5xl md:text-6xl bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            YouWorker.AI
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your intelligent assistant for work, research, and creativity.
            Powered by advanced AI with semantic search and extensible tools.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
          {features.map((feature, index) => (
            <EnhancedCard
              key={feature.title}
              variant="glass"
              className="p-6 text-center"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${
                feature.color === "text-primary" ? "from-primary/20 to-primary/10" :
                feature.color === "text-secondary" ? "from-secondary/20 to-secondary/10" :
                "from-accent/20 to-accent/10"
              } mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </EnhancedCard>
          ))}
        </div>

        {/* Example Prompts */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-semibold text-foreground">Try asking...</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {examplePrompts.map((category) => (
              <div key={category.category} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.prompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => onPromptClick(prompt)}
                      className="w-full text-left p-3 rounded-lg bg-card/50 border border-border/50 hover:border-primary/50 hover:bg-card hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group"
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                          {prompt}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-8">
          <p className="text-sm text-muted-foreground">
            Ready to get started? Just type your question or tap a suggestion above.
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 6.2 Responsive Layout System

**Update:** `apps/frontend/src/app/layout.tsx`

```typescript
// Replace the main layout div with:

<div className="flex h-screen bg-background overflow-hidden">
  {/* Sidebar - Desktop */}
  <div className="hidden lg:block">
    <Sidebar />
  </div>

  {/* Main Content Area */}
  <main
    id="main-content"
    className="flex-1 overflow-auto relative"
  >
    {/* Optional: Add a background pattern */}
    <div className="absolute inset-0 mesh-gradient opacity-30 pointer-events-none" />

    {/* Content */}
    <div className="relative z-10">
      {children}
    </div>
  </main>
</div>
```

---

## 7. Interaction Design & Micro-interactions

### 7.1 Haptic Feedback Patterns

**Enhance:** `apps/frontend/src/hooks/useHapticFeedback.ts`

```typescript
// ADD more sophisticated patterns

export const HAPTIC_PATTERNS = {
  light: [10],          // Quick tap
  medium: [20],         // Button press
  heavy: [30],          // Important action
  success: [10, 50, 10], // Success confirmation
  error: [20, 100, 20, 100, 20], // Error alert
  selection: [5],       // Item selection
  impact: [15, 30],     // Strong impact
} as const;

export function useHapticFeedback() {
  const trigger = useCallback((pattern: keyof typeof HAPTIC_PATTERNS = "medium") => {
    if (!("vibrate" in navigator)) return;

    try {
      navigator.vibrate(HAPTIC_PATTERNS[pattern]);
    } catch (error) {
      console.warn("Haptic feedback not supported");
    }
  }, []);

  return trigger;
}
```

### 7.2 Keyboard Shortcuts Enhancement

**Create:** `apps/frontend/src/components/KeyboardShortcutsPanel.tsx`

```typescript
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Command, Keyboard } from "lucide-react";

interface KeyboardShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsPanel({ open, onClose }: KeyboardShortcutsPanelProps) {
  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { keys: ["Cmd", "K"], description: "Open command palette" },
        { keys: ["Cmd", "N"], description: "New chat session" },
        { keys: ["Cmd", "B"], description: "Toggle sidebar" },
        { keys: ["/"], description: "Focus search" },
      ],
    },
    {
      category: "Chat",
      items: [
        { keys: ["Enter"], description: "Send message" },
        { keys: ["Shift", "Enter"], description: "New line" },
        { keys: ["Cmd", "Shift", "V"], description: "Voice input" },
        { keys: ["Esc"], description: "Stop generation" },
        { keys: ["Cmd", "↑"], description: "Edit last message" },
      ],
    },
    {
      category: "Messages",
      items: [
        { keys: ["Cmd", "C"], description: "Copy message" },
        { keys: ["Cmd", "R"], description: "Regenerate response" },
        { keys: ["Cmd", "D"], description: "Delete message" },
      ],
    },
  ];

  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Keyboard className="h-6 w-6 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <span key={index} className="inline-flex items-center">
                          <Badge variant="outline" className="px-2 py-1 font-mono text-xs">
                            {key === "Cmd" && isMac ? "⌘" : key}
                          </Badge>
                          {index < shortcut.keys.length - 1 && (
                            <span className="mx-1 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground text-center">
            Press <Badge variant="outline" className="mx-1 font-mono">?</Badge> anywhere to show this panel
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 7.3 Toast Notifications Enhancement

**Update:** Use Sonner with custom styling

```typescript
// apps/frontend/src/lib/toast-helpers.ts - ADD

import { toast } from "sonner";
import { Check, X, Info, AlertTriangle } from "lucide-react";

export const showSuccessToast = (message: string, description?: string) => {
  toast.success(message, {
    description,
    icon: <Check className="h-5 w-5" />,
    className: "border-success/20 bg-success/10",
  });
};

export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, {
    description,
    icon: <X className="h-5 w-5" />,
    className: "border-destructive/20 bg-destructive/10",
  });
};

export const showInfoToast = (message: string, description?: string) => {
  toast.info(message, {
    description,
    icon: <Info className="h-5 w-5" />,
    className: "border-primary/20 bg-primary/10",
  });
};

export const showWarningToast = (message: string, description?: string) => {
  toast.warning(message, {
    description,
    icon: <AlertTriangle className="h-5 w-5" />,
    className: "border-warning/20 bg-warning/10",
  });
};

// Loading toast with promise
export const showLoadingToast = async <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(promise, messages);
};
```

---

## 8. Animation & Motion Design

### 8.1 Page Transitions

**Create:** `apps/frontend/src/components/PageTransition.tsx`

```typescript
"use client";

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
          ease: [0.4, 0, 0.2, 1], // Cubic bezier for smooth easing
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### 8.2 Scroll-Based Animations

**Create:** `apps/frontend/src/hooks/useScrollAnimation.ts`

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, stop observing
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
```

### 8.3 Stagger Animations

**Create:** `apps/frontend/src/components/StaggeredList.tsx`

```typescript
"use client";

import { motion } from "framer-motion";

interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
}

export function StaggeredList({ children, staggerDelay = 0.1 }: StaggeredListProps) {
  return (
    <>
      {children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: index * staggerDelay,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
```

### 8.4 Loading Skeletons

**Create:** `apps/frontend/src/components/ui/skeleton-variants.tsx`

```typescript
"use client";

import { Skeleton } from "./skeleton";

export function MessageSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
```

---

## 9. Accessibility Excellence

### 9.1 ARIA Live Regions

**Update:** `apps/frontend/src/features/chat/components/MessageList.tsx`

```typescript
// ADD proper live regions

<div
  ref={ref}
  className="flex h-full flex-col gap-2 overflow-y-auto rounded-lg bg-background/70 p-2 shadow-inner scroll-smooth"
  role="log"
  aria-label="Chat messages"
  aria-live="polite"
  aria-atomic="false"
  aria-relevant="additions text"
>
  {/* Accessibility announcement for screen readers */}
  <div className="sr-only" aria-live="assertive" aria-atomic="true">
    {messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
      <span>
        New message from assistant: {messages[messages.length - 1].content.substring(0, 100)}
      </span>
    )}
  </div>

  {messages.map((message, index) => (
    <MessageBubble key={message.id} message={message} />
  ))}
</div>
```

### 9.2 Focus Management

**Create:** `apps/frontend/src/hooks/useFocusTrap.ts`

```typescript
"use client";

import { useEffect, useRef } from "react";

export function useFocusTrap<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    firstElement?.focus();

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return containerRef;
}
```

### 9.3 Color Contrast Checker

**Create:** `apps/frontend/src/lib/accessibility/contrast.ts`

```typescript
// Utility to check WCAG color contrast ratios

export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG(ratio: number, level: "AA" | "AAA" = "AA"): boolean {
  return level === "AA" ? ratio >= 4.5 : ratio >= 7;
}
```

---

## 10. Performance Optimizations

### 10.1 Virtual Scrolling Enhancement

**Update:** Message list with react-virtual

```typescript
// apps/frontend/src/features/chat/components/VirtualizedMessageList.tsx (NEW)

"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useEffect } from "react";
import { EnhancedMessageBubble } from "./EnhancedMessageBubble";

interface VirtualizedMessageListProps {
  messages: Array<any>;
  onCopy: (id: string) => void;
  onRegenerate: (id: string) => void;
  onEdit: (id: string) => void;
  onFeedback: (id: string, type: "up" | "down") => void;
}

export function VirtualizedMessageList({
  messages,
  onCopy,
  onRegenerate,
  onEdit,
  onFeedback,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Estimated height per message
    overscan: 5, // Render 5 extra items off-screen for smooth scrolling
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: "smooth",
      });
    }
  }, [messages.length, virtualizer]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto rounded-lg bg-background/70 shadow-inner"
      role="log"
      aria-label="Chat messages"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="p-4">
                <EnhancedMessageBubble
                  message={message}
                  onCopy={() => onCopy(message.id)}
                  onRegenerate={() => onRegenerate(message.id)}
                  onEdit={() => onEdit(message.id)}
                  onFeedback={(type) => onFeedback(message.id, type)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 10.2 Image Optimization

**Add:** `apps/frontend/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Enable experimental features
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

module.exports = nextConfig;
```

### 10.3 Code Splitting

**Strategy:**

```typescript
// Use dynamic imports for heavy components

// apps/frontend/src/app/documents/page.tsx - UPDATE

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { DocumentListSkeleton } from "@/components/loading/DocumentListSkeleton";

// Lazy load heavy document components
const DocumentList = dynamic(
  () => import("@/features/documents/components/DocumentList").then((mod) => mod.DocumentList),
  {
    loading: () => <DocumentListSkeleton />,
    ssr: false, // Disable SSR for client-heavy components
  }
);

const IngestionHistory = dynamic(
  () => import("@/features/documents/components/IngestionHistory").then((mod) => mod.IngestionHistory),
  {
    loading: () => <DocumentListSkeleton />,
    ssr: false,
  }
);

export default function DocumentsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Documents</TabsTrigger>
          <TabsTrigger value="history">Ingestion History</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <Suspense fallback={<DocumentListSkeleton />}>
            <DocumentList />
          </Suspense>
        </TabsContent>
        <TabsContent value="history" className="mt-6">
          <Suspense fallback={<DocumentListSkeleton />}>
            <IngestionHistory limit={20} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 11. Mobile-First Experience

### 11.1 Mobile Navigation

**Create:** `apps/frontend/src/components/MobileNavBar.tsx`

```typescript
"use client";

import { Home, FileText, Settings, MessageSquare, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MobileNavBar() {
  const pathname = usePathname();

  const links = [
    { href: "/", icon: Home, label: "Chat" },
    { href: "/documents", icon: FileText, label: "Docs" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-2xl">
      <div className="flex items-center justify-around h-16 px-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <link.icon className={cn("h-5 w-5", isActive && "scale-110")} />
              <span className="text-xs font-medium">{link.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### 11.2 Touch Gestures

**Create:** `apps/frontend/src/hooks/useSwipeGesture.ts`

```typescript
"use client";

import { useEffect, useRef } from "react";

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum distance for a swipe (in px)
}

export function useSwipeGesture<T extends HTMLElement>({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
}: SwipeGestureOptions) {
  const ref = useRef<T>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };

      const deltaX = touchEnd.x - touchStartRef.current.x;
      const deltaY = touchEnd.y - touchStartRef.current.y;

      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold) {
          if (deltaY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      touchStartRef.current = null;
    };

    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchend", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

  return ref;
}
```

### 11.3 Pull-to-Refresh

**Create:** `apps/frontend/src/components/PullToRefresh.tsx`

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number; // Pull distance threshold (in px)
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [status, setStatus] = useState<"idle" | "pulling" | "ready" | "refreshing">("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);

  const handleTouchStart = (e: TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      setStatus("pulling");
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (status !== "pulling" && status !== "ready") return;
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startYRef.current;

      if (distance > 0) {
        setPullDistance(Math.min(distance, threshold * 1.5));
        setStatus(distance > threshold ? "ready" : "pulling");
      }
    }
  };

  const handleTouchEnd = async () => {
    if (status === "ready") {
      setStatus("refreshing");
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setStatus("idle");
        setPullDistance(0);
      }
    } else {
      setStatus("idle");
      setPullDistance(0);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart);
    container.addEventListener("touchmove", handleTouchMove);
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [status]);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200",
          isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: `${pullDistance}px`,
          transform: `translateY(${pullDistance - threshold}px)`,
        }}
      >
        <div className="flex items-center gap-2 text-primary">
          {status === "refreshing" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Refreshing...</span>
            </>
          ) : status === "ready" ? (
            <>
              <RefreshCw className="h-5 w-5" />
              <span className="text-sm font-medium">Release to refresh</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5" />
              <span className="text-sm font-medium">Pull to refresh</span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? threshold : pullDistance}px)`,
          transition: status === "idle" ? "transform 0.2s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

---

## 12. Advanced UX Patterns

### 12.1 Command Palette Enhancement

**Update:** `apps/frontend/src/components/CommandPalette.tsx`

```typescript
// ADD more sophisticated command palette

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  FileText,
  Settings,
  MessageSquare,
  Plus,
  Search,
  Moon,
  Sun,
  Laptop,
  History,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useChatController } from "@/features/chat";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();
  const { startNewSession, sessions } = useChatController();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/documents"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Documents</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(startNewSession)}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Chat</span>
            <kbd className="ml-auto text-xs">⌘N</kbd>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Documents</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("system"))}>
            <Laptop className="mr-2 h-4 w-4" />
            <span>System</span>
          </CommandItem>
        </CommandGroup>

        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Sessions">
              {sessions.slice(0, 5).map((session) => (
                <CommandItem
                  key={session.id}
                  onSelect={() =>
                    runCommand(() => router.push(`/?session=${session.id}`))
                  }
                >
                  <History className="mr-2 h-4 w-4" />
                  <span>{session.title || `Session ${session.id.slice(0, 8)}`}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
```

### 12.2 Undo/Redo System

**Create:** `apps/frontend/src/hooks/useUndoRedo.ts`

```typescript
"use client";

import { useState, useCallback } from "react";

interface UseUndoRedoOptions<T> {
  initialState: T;
  maxHistory?: number;
}

export function useUndoRedo<T>({
  initialState,
  maxHistory = 50,
}: UseUndoRedoOptions<T>) {
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const set = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof newState === "function" ? (newState as (prev: T) => T)(prev) : newState;

        // Remove any future history when making a new change
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(next);

        // Limit history size
        if (newHistory.length > maxHistory) {
          newHistory.shift();
        }

        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);

        return next;
      });
    },
    [currentIndex, history, maxHistory]
  );

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [canUndo, currentIndex, history]);

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [canRedo, currentIndex, history]);

  const reset = useCallback(() => {
    setState(initialState);
    setHistory([initialState]);
    setCurrentIndex(0);
  }, [initialState]);

  return {
    state,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}
```

### 12.3 Optimistic Updates

**Pattern for sessions:**

```typescript
// apps/frontend/src/features/chat/api/session-service.ts - UPDATE

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useRenameSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      return apiClient.patch(`/api/sessions/${sessionId}`, { title });
    },

    // Optimistic update
    onMutate: async ({ sessionId, title }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["sessions"] });

      // Snapshot previous value
      const previousSessions = queryClient.getQueryData(["sessions"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["sessions"], (old: any) => {
        if (!old) return old;
        return old.map((session: any) =>
          session.id === sessionId ? { ...session, title } : session
        );
      });

      return { previousSessions };
    },

    // If mutation fails, rollback
    onError: (err, variables, context) => {
      queryClient.setQueryData(["sessions"], context?.previousSessions);
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
```

---

## 13. Empty States & Error Handling

### 13.1 Enhanced Empty States

**Create:** `apps/frontend/src/components/EmptyState.tsx`

```typescript
"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-12 space-y-6",
        className
      )}
    >
      {/* Icon or Illustration */}
      {illustration ? (
        <div className="w-64 h-64 animate-fade-in">{illustration}</div>
      ) : Icon ? (
        <div className="p-6 rounded-full bg-muted/50 animate-slide-in-up">
          <Icon className="h-12 w-12 text-muted-foreground" />
        </div>
      ) : null}

      {/* Content */}
      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Action */}
      {action && (
        <Button onClick={action.onClick} size="lg">
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

### 13.2 Error Boundary Enhancement

**Update:** `apps/frontend/src/components/ErrorBoundary.tsx`

```typescript
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/button";
import { EnhancedCard } from "./ui/enhanced-card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Send to error tracking service
    if (typeof window !== "undefined") {
      // Example: Sentry, LogRocket, etc.
      // Sentry.captureException(error, { extra: errorInfo });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-background">
          <EnhancedCard variant="glass" className="max-w-lg">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Error Icon */}
              <div className="p-4 rounded-full bg-destructive/10">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>

              {/* Error Message */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Oops! Something went wrong
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We're sorry, but something unexpected happened. Don't worry, your data is safe.
                </p>
              </div>

              {/* Error Details (dev mode only) */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="w-full text-left">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Error Details
                  </summary>
                  <pre className="mt-2 p-4 rounded-lg bg-muted text-xs overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {"\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={this.handleReset}
                  variant="default"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => (window.location.href = "/")}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </div>
          </EnhancedCard>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 13.3 Network Error Handling

**Create:** `apps/frontend/src/components/NetworkStatus.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
            isOnline
              ? "bg-success text-success-foreground"
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Back online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4" />
              <span className="text-sm font-medium">No internet connection</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 14. Onboarding & User Guidance

### 14.1 Interactive Product Tour

**Create:** `apps/frontend/src/features/onboarding/components/ProductTour.tsx`

```typescript
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedCard } from "@/components/ui/enhanced-card";

interface TourStep {
  title: string;
  description: string;
  target: string; // CSS selector for the element to highlight
  placement: "top" | "bottom" | "left" | "right";
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to YouWorker.AI!",
    description: "Let's take a quick tour to get you started with all the amazing features.",
    target: "body",
    placement: "bottom",
  },
  {
    title: "Chat Interface",
    description: "Ask any question or request help with your work. Your AI assistant is always ready to help.",
    target: "[data-tour='chat-composer']",
    placement: "top",
  },
  {
    title: "Voice Input",
    description: "Hold the microphone button to record your question. Release to send.",
    target: "[data-testid='mic-button']",
    placement: "top",
  },
  {
    title: "Sessions",
    description: "All your conversations are automatically saved. You can rename or delete them anytime.",
    target: "[data-tour='session-list']",
    placement: "right",
  },
  {
    title: "Documents",
    description: "Upload your documents here to enable semantic search across all your files.",
    target: "[href='/documents']",
    placement: "right",
  },
  {
    title: "You're all set!",
    description: "That's it! Start chatting and explore the features at your own pace.",
    target: "body",
    placement: "bottom",
  },
];

interface ProductTourProps {
  onComplete: () => void;
}

export function ProductTour({ onComplete }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate position based on target element
  useEffect(() => {
    const updatePosition = () => {
      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();

        let top = 0;
        let left = 0;

        switch (step.placement) {
          case "top":
            top = rect.top - 20;
            left = rect.left + rect.width / 2;
            break;
          case "bottom":
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2;
            left = rect.left - 20;
            break;
          case "right":
            top = rect.top + rect.height / 2;
            left = rect.right + 20;
            break;
        }

        setPosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [currentStep, step]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={handleSkip}
      />

      {/* Spotlight on target element */}
      {step.target !== "body" && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            // Calculate position and size based on target
          }}
        />
      )}

      {/* Tour Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="fixed z-50"
          style={{
            top: position.top,
            left: position.left,
            transform: "translate(-50%, -50%)",
          }}
        >
          <EnhancedCard variant="glass" className="max-w-sm p-6 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mt-2 -mr-2"
                onClick={handleSkip}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Step {currentStep + 1} of {tourSteps.length}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
              <Button onClick={handleNext} className="flex-1">
                {isLastStep ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </EnhancedCard>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
```

### 14.2 Feature Highlights

**Create:** `apps/frontend/src/components/FeatureHighlight.tsx`

```typescript
"use client";

import { ReactNode, useEffect, useState } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "./ui/button";
import { EnhancedCard } from "./ui/enhanced-card";
import { motion, AnimatePresence } from "framer-motion";

interface FeatureHighlightProps {
  id: string; // Unique ID to track if user has seen it
  title: string;
  description: string;
  targetElement: string; // CSS selector
  placement?: "top" | "bottom" | "left" | "right";
  icon?: ReactNode;
  onDismiss?: () => void;
}

export function FeatureHighlight({
  id,
  title,
  description,
  targetElement,
  placement = "bottom",
  icon,
  onDismiss,
}: FeatureHighlightProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // Check if user has seen this highlight
    const seen = localStorage.getItem(`feature-highlight-${id}`);
    if (!seen) {
      // Delay showing the highlight
      const timer = setTimeout(() => {
        setShow(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [id]);

  useEffect(() => {
    if (!show) return;

    const updatePosition = () => {
      const target = document.querySelector(targetElement);
      if (target) {
        const rect = target.getBoundingClientRect();

        let top = 0;
        let left = 0;

        switch (placement) {
          case "top":
            top = rect.top - 150;
            left = rect.left + rect.width / 2;
            break;
          case "bottom":
            top = rect.bottom + 20;
            left = rect.left + rect.width / 2;
            break;
          case "left":
            top = rect.top + rect.height / 2;
            left = rect.left - 320;
            break;
          case "right":
            top = rect.top + rect.height / 2;
            left = rect.right + 20;
            break;
        }

        setPosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [show, targetElement, placement]);

  const handleDismiss = () => {
    localStorage.setItem(`feature-highlight-${id}`, "true");
    setShow(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Pulse animation on target */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-40 pointer-events-none"
            style={{
              // Position over target element
            }}
          >
            <div className="absolute inset-0 bg-primary/20 rounded-lg animate-ping" />
          </motion.div>

          {/* Highlight Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-50"
            style={{
              top: position.top,
              left: position.left,
              transform: placement === "right" || placement === "left"
                ? "translateY(-50%)"
                : "translateX(-50%)",
            }}
          >
            <EnhancedCard variant="gradient" className="max-w-xs p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/20">
                  {icon || <Lightbulb className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    {title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mt-1 -mr-1"
                  onClick={handleDismiss}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDismiss}
                className="w-full"
              >
                Got it!
              </Button>
            </EnhancedCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## 15. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Priority: Critical**

1. **Design System Setup**
   - [ ] Implement new color palette
   - [ ] Add typography system
   - [ ] Update shadow and spacing tokens
   - [ ] Create design tokens file
   - [ ] Test theme switching with new colors

2. **Core Components Enhancement**
   - [ ] Enhance Button component with new variants
   - [ ] Create EnhancedCard component
   - [ ] Update all UI components with new design tokens
   - [ ] Add keyboard shortcut system

**Success Criteria:**
- All colors are updated across the app
- Components use new design system
- Theme switching works correctly
- No visual regressions

---

### Phase 2: Visual Polish (Week 3-4)
**Priority: High**

1. **Component Refinement**
   - [ ] Implement enhanced message bubbles
   - [ ] Redesign session cards
   - [ ] Update sidebar with new visual style
   - [ ] Add glassmorphism effects
   - [ ] Implement gradient overlays

2. **Animation & Motion**
   - [ ] Add page transitions
   - [ ] Implement micro-interactions
   - [ ] Create loading skeletons
   - [ ] Add stagger animations
   - [ ] Implement scroll-based animations

**Success Criteria:**
- All components have polished visuals
- Animations are smooth (60fps)
- Loading states are informative
- Micro-interactions provide feedback

---

### Phase 3: UX Enhancements (Week 5-6)
**Priority: High**

1. **Interaction Improvements**
   - [ ] Implement command palette
   - [ ] Add inline message actions (copy, regenerate)
   - [ ] Create undo/redo system
   - [ ] Enhance haptic feedback patterns
   - [ ] Add keyboard shortcuts panel

2. **Empty States & Errors**
   - [ ] Create hero empty state
   - [ ] Design empty states for all features
   - [ ] Enhance error boundary
   - [ ] Add network status indicator
   - [ ] Implement toast notifications system

**Success Criteria:**
- All empty states are engaging
- Error handling is graceful
- User feedback is immediate
- Keyboard navigation works everywhere

---

### Phase 4: Mobile Excellence (Week 7-8)
**Priority: Medium**

1. **Mobile Optimizations**
   - [ ] Implement mobile bottom navigation
   - [ ] Add swipe gestures
   - [ ] Create pull-to-refresh
   - [ ] Optimize touch targets
   - [ ] Enhance mobile layouts

2. **Responsive Design**
   - [ ] Test all breakpoints
   - [ ] Optimize images for mobile
   - [ ] Implement mobile-specific components
   - [ ] Test touch interactions

**Success Criteria:**
- App works flawlessly on mobile
- All gestures are intuitive
- Touch targets meet 44px minimum
- Mobile performance is optimal

---

### Phase 5: Advanced Features (Week 9-10)
**Priority: Medium**

1. **Onboarding & Guidance**
   - [ ] Create product tour
   - [ ] Implement feature highlights
   - [ ] Add contextual help
   - [ ] Design welcome flow
   - [ ] Create video tutorials

2. **Performance Optimization**
   - [ ] Implement virtual scrolling
   - [ ] Optimize bundle size
   - [ ] Add code splitting
   - [ ] Optimize images
   - [ ] Implement caching strategies

**Success Criteria:**
- New users understand the app
- Performance metrics improved by 30%
- Bundle size reduced
- Lighthouse score >90

---

### Phase 6: Accessibility & Testing (Week 11-12)
**Priority: Critical**

1. **Accessibility Enhancement**
   - [ ] ARIA live regions everywhere
   - [ ] Focus management
   - [ ] Color contrast WCAG AAA
   - [ ] Screen reader testing
   - [ ] Keyboard navigation testing

2. **Testing & QA**
   - [ ] Write unit tests for new components
   - [ ] E2E tests for critical flows
   - [ ] Visual regression tests
   - [ ] Performance testing
   - [ ] Accessibility audit

**Success Criteria:**
- WCAG AAA compliance
- >80% test coverage
- All critical flows tested
- Zero accessibility violations

---

## 16. Success Metrics

### User Experience Metrics

**Engagement:**
- [ ] Time on site increases by 40%
- [ ] Session duration increases by 35%
- [ ] Daily active users increase by 25%
- [ ] Feature adoption increases by 50%

**Performance:**
- [ ] First Contentful Paint < 1s
- [ ] Time to Interactive < 2s
- [ ] Lighthouse Performance Score > 90
- [ ] Core Web Vitals pass

**Satisfaction:**
- [ ] User satisfaction score > 4.5/5
- [ ] Net Promoter Score > 50
- [ ] Error rate < 0.1%
- [ ] Support tickets decrease by 40%

### Technical Metrics

**Code Quality:**
- [ ] Test coverage > 80%
- [ ] TypeScript strict mode enabled
- [ ] Zero ESLint errors
- [ ] Bundle size < 500KB (gzipped)

**Accessibility:**
- [ ] WCAG AAA compliance
- [ ] Zero accessibility violations
- [ ] Screen reader compatible
- [ ] Keyboard navigable

**Performance:**
- [ ] 60fps animations
- [ ] < 100ms response time
- [ ] Optimistic UI updates
- [ ] Efficient re-renders

---

## 17. Maintenance & Evolution

### Continuous Improvement

**Monthly Reviews:**
- User feedback analysis
- Performance monitoring
- Accessibility audits
- Component library updates

**Quarterly Updates:**
- Design system evolution
- New feature development
- Performance optimizations
- Security updates

**Annual Overhaul:**
- Complete design refresh evaluation
- Technology stack updates
- User research and testing
- Competitive analysis

---

## Conclusion

This comprehensive refactoring guide provides a roadmap to transform YouWorker.AI's frontend into a world-class, delightful user experience. The focus is on:

1. **Beautiful Visual Design** - Unique brand identity with polished aesthetics
2. **Fluid Interactions** - Smooth animations and responsive feedback
3. **Intuitive UX** - Zero learning curve with progressive disclosure
4. **Accessible** - WCAG AAA compliant
5. **Performant** - 60fps animations with instant feedback

**Implementation Priority:**
1. Phase 1: Foundation (Critical)
2. Phase 6: Accessibility (Critical)
3. Phase 2: Visual Polish (High)
4. Phase 3: UX Enhancements (High)
5. Phase 4: Mobile Excellence (Medium)
6. Phase 5: Advanced Features (Medium)

**Next Steps:**
1. Review and approve this guide
2. Set up project tracking (Linear, Jira, etc.)
3. Assign team members to phases
4. Begin Phase 1 implementation
5. Schedule weekly reviews

Remember: **UI/UX is never "done"** - it's an ongoing process of refinement and improvement based on user feedback and evolving best practices.

---

**Document Version:** 2.0
**Last Updated:** 2025-10-30
**Maintained By:** UI/UX Team
**Questions?** Open an issue or discussion in the repository.
