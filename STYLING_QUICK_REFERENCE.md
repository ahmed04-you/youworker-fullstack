# Styling Quick Reference & Inconsistencies

## Visual Comparison of Key Pages

### Horizontal Padding (CRITICAL INCONSISTENCY)

```
CHAT PAGE (✓ CORRECT - Mobile-First Responsive)
┌─────────────────────────────────────────────┐
│ px-4 (16px) │     CONTENT      │ px-4 (16px) │  Mobile (< 640px)
│ px-6 (24px) │     CONTENT      │ px-6 (24px) │  Tablet (sm)
│ px-10(40px) │     CONTENT      │ px-10(40px) │  Desktop (lg)
└─────────────────────────────────────────────┘

INGEST PAGE (✗ WRONG - Not Responsive)
┌─────────────────────────────────────────────┐
│ px-8 (32px) │     CONTENT      │ px-8 (32px) │  ALL SIZES
│ px-8 (32px) │     CONTENT      │ px-8 (32px) │  ALL SIZES
│ px-8 (32px) │     CONTENT      │ px-8 (32px) │  ALL SIZES ← Too large for mobile!
└─────────────────────────────────────────────┘

HISTORY PAGE (✓ ACCEPTABLE)
┌─────────────────────────────────────────────┐
│ p-6  (24px) │     CONTENT      │ p-6  (24px) │  ALL SIZES
│ p-6  (24px) │     CONTENT      │ p-6  (24px) │  ALL SIZES
└─────────────────────────────────────────────┘

SETTINGS PAGE (~ PARTIAL - Has max-width constraint)
┌──────────────────────────────────────────────────────────────┐
│            px-4 (16px) │   CONTENT   │ px-4 (16px)           │  Mobile
│            px-4 (16px) │   CONTENT   │ px-4 (16px)  max-3xl  │  All sizes
└──────────────────────────────────────────────────────────────┘

ANALYTICS PAGE (✓ ACCEPTABLE)
┌─────────────────────────────────────────────┐
│ p-6  (24px) │     CONTENT      │ p-6  (24px) │  ALL SIZES
└─────────────────────────────────────────────┘
```

---

## Container Width Patterns

### Current Approach
```
┌── container mx-auto ──────────────────────────────┐
│  (auto, respects Tailwind default container)     │
│                                                  │
│  ┌── Analytics/History/Ingest ───────────────┐  │
│  │ p-6 all around                            │  │
│  │ No max-width constraint                    │  │
│  │ Stretches full on ultra-wide monitors      │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

┌── container mx-auto max-w-3xl ──────────────────┐
│  (Settings page only)                           │
│                                                 │
│  ┌── Settings ─────────────────────────────┐   │
│  │ Limited to 768px max-width              │   │
│  │ Breaks pattern from other pages         │   │
│  └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘

┌── Chat (no container) ──────────────────────────┐
│  Fixed navbar padding, flexible content width  │
│                                                 │
│  Toolbar: px-4 sm:px-6 lg:px-10                │
│                                                 │
│  Content: max-w-4xl (desktop), max-w-5xl (lg)  │
└──────────────────────────────────────────────────┘
```

---

## Card/Section Background Opacity

```
Settings Page Cards:          History/Analytics Cards:
┌─────────────────┐          ┌──────────────────┐
│ bg-card/30      │          │ bg-card/50       │
│ (lighter)       │          │ (darker)         │
│ p-4 (16px)      │          │ p-6 (24px)       │
│ grid layout     │          │ shadow included  │
└─────────────────┘          └──────────────────┘

Result: Settings appears lighter and less prominent
```

---

## Sidebar Width Management

```
┌────────────────────────────────────────────────────────┐
│                      Main Content                      │
│ ┌──────────┐ ┌─────────────────────────┐ ┌──────────┐ │
│ │ Navbar   │ │   Page Content          │ │ Right    │ │
│ │ w-20     │ │   (flex-1)              │ │ Panel    │ │
│ │(80px)    │ │                         │ │ width:   │ │
│ │(lg only) │ │   Uses:                 │ │ 360px /  │ │
│ │          │ │   px-4/px-6/px-8        │ │ 56px     │ │
│ │Hidden    │ │   max-w-3xl/4xl/5xl     │ │(hardcod) │ │
│ │on mobile │ │   (not consistent)      │ │(lg only) │ │
│ └──────────┘ └─────────────────────────┘ └──────────┘ │
│ └─────────────┘ └────────────────────────┘ └────────────┘
│   Always on       INCONSISTENT PADDING     Dynamic size
│                                             but hardcoded
└────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior Comparison

| Breakpoint | Chat | Settings | History | Analytics | Ingest |
|-----------|------|----------|---------|-----------|--------|
| Mobile    | 16px | 16px     | 24px    | 24px      | 32px ✗ |
| Tablet    | 24px | 16px     | 24px    | 24px      | 32px ✗ |
| Desktop   | 40px | 16px ✗   | 24px    | 24px      | 32px ✗ |
| Ultra-Wide| 40px | max-3xl  | Full    | Full      | Full   |

Legend: ✗ = Problematic

---

## Key Width Values in Use

```typescript
// Sidebar widths (Tailwind classes)
w-20         // 80px - Navbar
w-64         // 256px - Left sidebar

// Content widths
max-w-3xl    // 768px - Settings page only
max-w-4xl    // 1024px - Chat content (desktop)
max-w-5xl    // 1280px - Chat content (large)
max-w-6xl    // 1536px - Proposed standard
max-w-full   // 100% - Default everywhere else

// Hardcoded pixel values (BAD!)
56px         // Right panel when collapsed (hardcoded)
360px        // Right panel when open (hardcoded)
```

---

## Spacing Scale in Use

```
Design System Defined:
semanticSpacing.container = {
  mobile: 16px,    // spacing[4]
  tablet: 24px,    // spacing[6]
  desktop: 32px    // spacing[8]
}

Actually Used:
px-4 = 16px  ✓ (matches mobile)
px-6 = 24px  ✓ (matches tablet)
px-8 = 32px  ✓ (matches desktop)
px-10 = 40px ✗ (exceeds design system!)
p-4 = 16px   ✓ (matches)
p-6 = 24px   ✓ (matches)

Problem: Used arbitrarily, not semantically referenced
```

---

## Recommended Standard Pattern

### For All Content Pages (History, Analytics, Ingest, Settings)

```tsx
// Root container - Responsive padding
<div className="container mx-auto flex min-h-full flex-col p-4 sm:p-6 lg:p-8">
  {/* Optional: Constrain width for readability */}
  <div className="mx-auto w-full max-w-6xl">
    {/* Page header */}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4 mb-6">
      {/* ... */}
    </div>

    {/* Content card - Consistent styling */}
    <div className="flex-1 rounded-2xl border-border/50 bg-card/50 p-6 shadow-xl backdrop-blur-sm">
      {/* ... */}
    </div>
  </div>
</div>
```

### For Right Panel

```tsx
// Instead of hardcoded pixel values
animate={{
  x: 0,
  opacity: 1,
  width: isCollapsed ? 56 : 360,  // Still hardcoded, but:
}}
// Wrap in className with Tailwind backup
className="w-[360px] lg:flex ..."  // Use arbitrary value if dynamic
```

---

## Design System Files to Reference

- `/apps/frontend/lib/design-system/spacing.ts` - Has spacing scale
- `/apps/frontend/lib/design-system/breakpoints.ts` - Responsive breakpoints
- `/apps/frontend/app/globals.css` - Global theme variables

## Files That Need Updates

Priority order:

1. **Ingest Page** (`/apps/frontend/app/(shell)/ingest/page.tsx`) - Most inconsistent
2. **Right Panel** (`/apps/frontend/components/shell/right-panel.tsx`) - Hardcoded values
3. **History Page** (`/apps/frontend/app/(shell)/history/page.tsx`) - Missing responsiveness
4. **Analytics Page** (`/apps/frontend/app/(shell)/analytics/page.tsx`) - Inconsistent widths
5. **Settings Page** (`/apps/frontend/app/(shell)/settings/page.tsx`) - Unique pattern

Reference: **Chat Page** (`/apps/frontend/app/(shell)/page.tsx`) as the correct pattern to follow.

---

## Quick Fixes Checklist

- [ ] Add responsive padding to Ingest page: `p-4 sm:p-6 lg:p-8`
- [ ] Add responsive padding to History page: `p-4 sm:p-6 lg:p-8`
- [ ] Add responsive padding to Analytics page: `p-4 sm:p-6 lg:p-8`
- [ ] Align Settings page padding with other pages
- [ ] Replace Right Panel hardcoded widths with Tailwind
- [ ] Document in design system README
- [ ] Consider adding `.prose` or content width constraint to prevent ultra-wide layout
- [ ] Export and use semantic spacing tokens from design system

