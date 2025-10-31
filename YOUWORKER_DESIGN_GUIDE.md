# YouWorker Frontend Design Specification Guide

**Based on:** GPT4All v3.10.0 Interface Design
**Target Framework:** Next.js 16
**Project:** YouWorker (youworker-fullstack)
**Purpose:** Complete design handoff for pixel-perfect UI implementation

---

## Table of Contents

1. [Overview & Design Philosophy](#overview--design-philosophy)
2. [Design System](#design-system)
   - [Color Palette](#color-palette)
   - [Typography](#typography)
   - [Spacing & Dimensions](#spacing--dimensions)
3. [Layout Architecture](#layout-architecture)
4. [Component Specifications](#component-specifications)
5. [Animations & Transitions](#animations--transitions)
6. [Implementation Guide](#implementation-guide)
7. [Appendix](#appendix)

---

## Overview & Design Philosophy

**YouWorker** is a modern LLM chat application frontend with a clean, uncluttered interface. This design is based on GPT4All v3.10.0's interface design (originally created by Vincent Giardina), adapted for the YouWorker platform.

### Key Design Principles
- **Privacy-first:** Clean, distraction-free interface
- **Modern:** View-based navigation, smooth transitions
- **Accessible:** ARIA roles, keyboard navigation, screen reader support
- **Responsive:** Adaptive three-panel layout
- **Themable:** Three complete theme modes

### Design Source
This specification is based on GPT4All v3.10.0's QML source code, ensuring a proven, production-tested design that we're adapting for YouWorker.

---

## Design System

### Color Palette

YouWorker uses a comprehensive color system with three theme modes (inherited from GPT4All v3.10 design). All colors are defined in HSL/HSLA format for consistency.

#### Base Colors

```css
/* Foundation Colors */
--color-black: hsl(231, 15%, 19%)
--color-white: hsl(0, 0%, 100%)
--color-dark-white: hsl(0, 0%, 85%)
```

#### Gray Scale (11 shades)
*Hue: 25°, Saturation: 5%*

```css
--gray-0:   hsl(25, 5%, 97%)    /* Lightest */
--gray-50:  hsl(25, 5%, 95%)
--gray-100: hsl(25, 5%, 90%)
--gray-200: hsl(25, 5%, 80%)
--gray-300: hsl(25, 5%, 70%)
--gray-400: hsl(25, 5%, 60%)
--gray-500: hsl(25, 5%, 50%)
--gray-600: hsl(25, 5%, 40%)
--gray-700: hsl(25, 5%, 30%)
--gray-800: hsl(25, 5%, 20%)
--gray-950: hsl(25, 5%, 15%)    /* Darkest */
```

#### Dark Gray Scale (for dark themes)
*Hue: 25°, Saturation: 5%, Lightness: 23% → 1%*

```css
--dark-gray-0:   hsl(25, 5%, 23%)
--dark-gray-50:  hsl(25, 5%, 5%)
--dark-gray-100: hsl(25, 5%, 10%)
--dark-gray-200: hsl(25, 5%, 15%)
--dark-gray-300: hsl(25, 5%, 30%)
/* ... continues to dark-gray-950 */
```

#### Green Scale (11 shades)
*Used for primary buttons*

```css
--green-50:  hsl(120, 89%, 95%)
--green-100: hsl(120, 89%, 90%)
--green-200: hsl(120, 89%, 80%)
--green-300: hsl(120, 89%, 70%)
--green-400: hsl(120, 89%, 60%)
--green-500: hsl(120, 89%, 50%)
--green-600: hsl(120, 89%, 40%)    /* Primary button color */
--green-700: hsl(120, 89%, 35%)    /* Button hover */
--green-800: hsl(120, 89%, 30%)
--green-900: hsl(120, 89%, 25%)
--green-950: hsl(120, 89%, 20%)
```

#### Yellow Scale (accent colors)
*Hue varies: 19° → 47°*

```css
--yellow-0:   hsl(45, 100%, 97%)
--yellow-50:  hsl(45, 100%, 95%)
--yellow-100: hsl(45, 100%, 90%)
--yellow-200: hsl(45, 100%, 80%)
--yellow-300: hsl(45, 100%, 50%)    /* Primary accent */
--yellow-400: hsl(38, 100%, 50%)
--yellow-500: hsl(32, 100%, 50%)
--yellow-600: hsl(27, 89%, 47%)
--yellow-700: hsl(23, 73%, 42%)
--yellow-800: hsl(20, 66%, 37%)
--yellow-950: hsl(19, 56%, 15%)
```

#### Blue Scale (Legacy Dark theme)

```css
--blue-0:   #d0d5db
--blue-50:  #c2cace
--blue-100: #b4bfc2
--blue-200: #a6b4b7    /* LegacyDark accent */
--blue-300: #98a9ab
--blue-400: #8a9ea0
--blue-500: #7c9394    /* LegacyDark conversation bg */
--blue-600: #6e8889
--blue-700: #607d7d
--blue-800: #527272    /* LegacyDark view bg */
--blue-900: #0e1011
--blue-950: #0e1011    /* LegacyDark button bg */
```

#### Red Scale (errors, destructive actions)

```css
--red-50:  hsl(0, 89%, 97%)
--red-100: hsl(0, 89%, 94%)
--red-200: hsl(0, 89%, 87%)
--red-300: hsl(0, 89%, 80%)
--red-400: hsl(0, 89%, 60%)
--red-500: hsl(0, 89%, 50%)    /* Error color */
--red-600: hsl(0, 89%, 40%)
--red-700: hsl(0, 89%, 30%)
--red-800: hsl(0, 89%, 25%)
--red-950: hsl(0, 89%, 15%)
```

#### Purple Scale

```css
--purple-50:  hsl(279, 100%, 97%)
--purple-100: hsl(279, 100%, 94%)
--purple-200: hsl(279, 100%, 87%)
--purple-300: hsl(279, 100%, 80%)
--purple-400: hsl(279, 100%, 70%)
--purple-500: hsl(279, 100%, 60%)
--purple-600: hsl(279, 100%, 50%)
--purple-700: hsl(279, 100%, 40%)
--purple-800: hsl(279, 100%, 30%)
--purple-900: hsl(279, 100%, 25%)
--purple-950: hsl(279, 100%, 20%)
```

---

### Theme Color Mappings

#### Light Theme (Default)

```css
/* Text Colors */
--text-color: hsl(0, 0%, 0%)                    /* black */
--text-muted: hsl(25, 5%, 50%)                  /* gray-500 */
--text-opposite: hsl(0, 0%, 100%)               /* white */
--text-opposite-muted: hsl(0, 0%, 85%)          /* dark-white */
--text-conversation-header: hsl(25, 5%, 30%)    /* gray-700 */
--text-settings-title: hsl(25, 5%, 20%)         /* gray-800 */
--text-styled: hsl(25, 5%, 30%)                 /* gray-700 */

/* Background Colors */
--bg-view: hsl(25, 5%, 97%)                     /* gray-0 */
--bg-conversation: hsl(0, 0%, 100%)             /* white */
--bg-control: hsl(0, 0%, 100%)                  /* white */
--bg-button: hsl(120, 89%, 40%)                 /* green-600 */
--bg-button-hover: hsl(120, 89%, 35%)           /* green-700 */
--bg-selected: hsl(45, 100%, 50%)               /* yellow-300 */
--bg-sources: hsl(25, 5%, 90%)                  /* gray-100 */
--bg-sources-hover: hsl(25, 5%, 80%)            /* gray-200 */
--bg-attachment: hsl(25, 5%, 95%)               /* gray-50 */
--bg-collections-button: hsl(45, 100%, 95%)     /* yellow-0 */
--bg-lighter-button: hsl(25, 5%, 90%)           /* gray-100 */
--bg-container: hsl(0, 0%, 100%)                /* white */

/* Border Colors */
--border-divider: hsl(25, 5%, 80%)              /* gray-200 */
--border-control: hsl(25, 5%, 70%)              /* gray-300 */
--border-dialog: hsl(25, 5%, 70%)               /* gray-300 */
--border-button: hsl(25, 5%, 60%)               /* gray-400 */

/* Accent & Error */
--accent-color: hsl(45, 100%, 50%)              /* yellow-300 */
--error-color: hsl(0, 89%, 50%)                 /* red-500 */

/* Context Menu */
--context-menu-frame: hsl(25, 5%, 70%)
--context-menu-bg: hsl(0, 0%, 100%)
--context-menu-highlight: hsl(45, 100%, 95%)

/* Settings */
--settings-divider: hsl(25, 5%, 80%)
```

#### Dark Theme

```css
/* Text Colors */
--text-color: hsl(0, 0%, 85%)                   /* dark-white */
--text-muted: hsl(25, 5%, 50%)
--text-opposite: hsl(25, 5%, 15%)               /* dark-gray-950 */
--text-opposite-muted: hsl(25, 5%, 20%)
--text-conversation-header: hsl(0, 0%, 75%)
--text-settings-title: hsl(0, 0%, 85%)
--text-styled: hsl(0, 0%, 75%)

/* Background Colors */
--bg-view: hsl(25, 5%, 23%)                     /* dark-gray-0 */
--bg-conversation: hsl(25, 5%, 5%)              /* dark-gray-50 */
--bg-control: hsl(25, 5%, 10%)                  /* dark-gray-100 */
--bg-button: hsl(25, 5%, 30%)                   /* dark-gray-300 */
--bg-button-hover: hsl(25, 5%, 35%)
--bg-selected: hsl(45, 100%, 40%)
--bg-sources: hsl(25, 5%, 15%)
--bg-sources-hover: hsl(25, 5%, 20%)
--bg-attachment: hsl(25, 5%, 18%)
--bg-collections-button: hsl(45, 100%, 30%)
--bg-lighter-button: hsl(25, 5%, 25%)
--bg-container: hsl(25, 5%, 10%)

/* Border Colors */
--border-divider: hsl(25, 5%, 30%)
--border-control: hsl(25, 5%, 35%)
--border-dialog: hsl(25, 5%, 35%)
--border-button: hsl(25, 5%, 40%)

/* Accent & Error */
--accent-color: hsl(45, 100%, 50%)              /* yellow-300 */
--error-color: hsl(0, 89%, 60%)                 /* red-400 */

/* Context Menu */
--context-menu-frame: hsl(25, 5%, 35%)
--context-menu-bg: hsl(25, 5%, 10%)
--context-menu-highlight: hsl(45, 100%, 30%)

/* Settings */
--settings-divider: hsl(25, 5%, 30%)
```

#### LegacyDark Theme (Blue-based)

```css
/* Text Colors */
--text-color: hsl(210, 50%, 83%)                /* blue-0 */
--text-muted: hsl(210, 50%, 60%)
--text-opposite: hsl(210, 50%, 6%)              /* blue-900/950 */
--text-opposite-muted: hsl(210, 50%, 20%)
--text-conversation-header: hsl(210, 50%, 75%)
--text-settings-title: hsl(210, 50%, 83%)
--text-styled: hsl(210, 50%, 75%)

/* Background Colors */
--bg-view: hsl(210, 50%, 50%)                   /* blue-800 */
--bg-conversation: hsl(210, 50%, 58%)           /* blue-500 */
--bg-control: hsl(210, 50%, 53%)                /* blue-600 */
--bg-button: hsl(210, 50%, 6%)                  /* blue-950 */
--bg-button-hover: hsl(210, 50%, 10%)
--bg-selected: hsl(210, 50%, 70%)               /* blue-200 */
--bg-sources: hsl(210, 50%, 45%)
--bg-sources-hover: hsl(210, 50%, 40%)
--bg-attachment: hsl(210, 50%, 48%)
--bg-collections-button: hsl(210, 50%, 65%)
--bg-lighter-button: hsl(210, 50%, 55%)
--bg-container: hsl(210, 50%, 53%)

/* Border Colors */
--border-divider: hsl(210, 50%, 40%)
--border-control: hsl(210, 50%, 35%)
--border-dialog: hsl(210, 50%, 35%)
--border-button: hsl(210, 50%, 30%)

/* Accent & Error */
--accent-color: hsl(210, 50%, 70%)              /* blue-200 */
--error-color: hsl(0, 89%, 60%)

/* Context Menu */
--context-menu-frame: hsl(210, 50%, 35%)
--context-menu-bg: hsl(210, 50%, 53%)
--context-menu-highlight: hsl(210, 50%, 65%)

/* Settings */
--settings-divider: hsl(210, 50%, 40%)
```

---

### Typography

#### Font Family

```css
--font-primary: 'Roboto', sans-serif
--font-monospace: 'Roboto Mono', monospace
```

**Installation Note:** Import Roboto and Roboto Mono from Google Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700&display=swap" rel="stylesheet">
```

#### Font Sizes

Base sizes in points (convert to pixels: 1pt ≈ 1.333px at 96 DPI)

```css
/* Standard Sizes */
--font-smallest:  8pt   /* ~10.7px */
--font-smaller:   9pt   /* ~12px */
--font-small:     10pt  /* ~13.3px */
--font-medium:    11pt  /* ~14.7px */
--font-large:     12pt  /* ~16px */
--font-larger:    14pt  /* ~18.7px */
--font-largest:   18pt  /* ~24px */

/* Banner Sizes (multiplied by 0.8 scale factor) */
--font-banner:       24pt  /* ~32px */
--font-banner-small: 32pt  /* ~42.7px */
--font-banner-large: 48pt  /* ~64px */
```

#### Font Scale Multipliers

Users can adjust font size globally:

```css
/* Scale Options */
--scale-small:  1.0   /* Default */
--scale-medium: 1.3
--scale-large:  1.8
```

All font sizes multiply by the active scale factor.

#### Font Weights

```css
--font-weight-normal: 400
--font-weight-bold: 700
```

**Usage:**
- **Normal:** Body text, descriptions, secondary labels
- **Bold:** Headers, titles, button text, chat names, section headers

---

### Spacing & Dimensions

#### Global Spacing Scale

```css
--spacing-xs:  10px
--spacing-sm:  20px
--spacing-md:  30px
--spacing-lg:  50px
```

#### Common Component Dimensions

```css
/* Icons */
--icon-small:  24px
--icon-medium: 32px
--icon-large:  40px

/* Buttons */
--button-height: auto (based on padding + text)
--button-padding-v: 10px
--button-padding-h: 18px
--tool-button-size: 40px × 40px

/* Avatars */
--avatar-size: 32px × 32px

/* Cards */
--attachment-card: 350px × 50px
--source-card: 200px × 75px

/* Inputs */
--text-area-max-height: 200px
```

#### Border Radius

```css
--radius-small: 5px
--radius-standard: 10px
```

**Usage:**
- **5px:** Small controls, nested elements
- **10px:** Buttons, cards, inputs, dialogs, containers

#### Border Width

```css
--border-normal: 1px
--border-error: 2px
--border-button-legacy: 1px  /* LegacyDark theme only */
--border-button-modern: 0px  /* Light & Dark themes */
```

---

## Layout Architecture

### Application Window Structure

YouWorker uses a responsive three-panel layout:

```
┌─────────────────────────────────────────────────────────────────┐
│                       Application Window                        │
├─────────────┬───────────────────────────────┬────────────────────┤
│             │                               │                    │
│  ChatDrawer │      Main Content Area        │ CollectionsDrawer  │
│  (Sidebar)  │                               │  (Right Panel)     │
│             │                               │                    │
│  180-600px  │      Flexible Width           │   180-600px        │
│  (23% max)  │                               │   (23% max)        │
│             │                               │                    │
│  Always     │  ┌─────────────────────────┐  │   Toggle           │
│  Visible    │  │       Header            │  │   (Hidden by       │
│  (toggles   │  │       (100px)           │  │   default)         │
│  to min)    │  ├─────────────────────────┤  │                    │
│             │  │                         │  │                    │
│             │  │   Conversation Area     │  │                    │
│             │  │   (ScrollView)          │  │                    │
│             │  │                         │  │                    │
│             │  │   Max Width: 1280px     │  │                    │
│             │  │   Centered              │  │                    │
│             │  │                         │  │                    │
│             │  ├─────────────────────────┤  │                    │
│             │  │   Text Input Area       │  │                    │
│             │  │   (Dynamic Height)      │  │                    │
│             │  └─────────────────────────┘  │                    │
│             │                               │                    │
└─────────────┴───────────────────────────────┴────────────────────┘
```

### Panel Specifications

#### Left Panel (ChatDrawer)

```css
/* Dimensions */
min-width: 180px
max-width: 600px
preferred-width: min(23vw, 600px)  /* 23% of viewport, capped at 600px */

/* Behavior */
collapsible: Yes (collapses to minimum width, doesn't hide)
transition: width 200ms cubic-bezier(0.45, 0, 0.55, 1)

/* Border */
border-right: 1px solid var(--border-divider)
```

**Contents:**
1. "New Chat" button (top)
2. Divider (1px)
3. Scrollable chat list

#### Center Panel (Main Area)

```css
/* Dimensions */
width: Flexible (expands based on sidebar states)
max-content-width: 1280px
margin: 0 auto  /* Centers content */

/* Structure (top to bottom) */
1. Header (100px height)
2. Conversation area (flexible, scrollable)
3. Text input area (dynamic height)
```

#### Right Panel (CollectionsDrawer)

```css
/* Dimensions */
min-width: 180px
max-width: 600px
preferred-width: min(23vw, 600px)

/* Behavior */
collapsible: Yes
default-state: Collapsed (hidden)
transition: width 300ms cubic-bezier(0.45, 0, 0.55, 1)

/* Border */
border-left: 1px solid var(--border-divider)
```

**Contents:**
1. Collection list (scrollable, checkboxes)
2. Divider
3. "Add Docs" button
4. Instructions text

### Responsive Behavior

```css
/* Breakpoint Guidelines */
@media (max-width: 1024px) {
  /* Sidebars collapse to minimum width (180px) */
  --sidebar-width: 180px
}

@media (max-width: 768px) {
  /* Consider single-panel mobile layout */
  /* Sidebars become overlay drawers */
}
```

---

## Component Specifications

### 1. ChatDrawer (Left Sidebar)

#### Structure

```
┌────────────────────────┐
│  + New Chat            │ ← Button (24px top/bottom, 20px left/right padding)
├────────────────────────┤ ← 1px divider
│                        │
│  [Chat List]           │ ← ScrollView
│  ┌──────────────────┐  │
│  │ Chat 1  [Edit]   │  │
│  │         [Delete] │  │
│  ├──────────────────┤  │
│  │ Chat 2  [Edit]   │  │
│  │         [Delete] │  │
│  ├──────────────────┤  │
│  │ Chat 3  [Edit]   │  │
│  │         [Delete] │  │
│  └──────────────────┘  │
│                        │
└────────────────────────┘
```

#### New Chat Button

```css
/* Styling */
padding: 24px 20px
font-size: var(--font-large)
font-weight: bold
background: transparent
text-align: left

/* Hover */
background: var(--bg-lighter-button)
```

#### Chat List Items

Each chat item contains:

**1. Chat Name (TextField)**
```css
font-size: var(--font-large)
font-weight: bold
color: var(--text-color)
text-overflow: ellipsis
background: transparent
editable: when selected

/* Selected State */
background: var(--bg-selected)
```

**2. Edit Button**
```css
size: 24px × 24px
icon: pencil/edit icon
visibility: visible
opacity: 0.2 (default), 1.0 (hover)
```

**3. Delete Button**
```css
size: 24px × 24px
icon: trash icon
visibility: visible
opacity: 0.2 (default), 1.0 (hover)
```

**4. Confirmation Popup (Delete)**
```css
/* Appears on delete click */
buttons: Checkmark (confirm) | X (cancel)
auto-dismiss: 3 seconds
animation: fade in/out 200ms
```

#### Section Headers

```css
font-size: var(--font-smaller)
color: var(--text-muted)
padding: 10px 20px
```

---

### 2. Header Section

#### Dimensions

```css
height: 100px
width: 100% (of center panel)
padding: 0 30px
display: flex
align-items: center
justify-content: space-between
```

#### Components (Left → Right)

**1. Drawer Toggle Button**

```css
size: 40px × 40px
border-radius: var(--radius-standard)  /* 10px */
background: var(--bg-lighter-button)
icon-size: var(--icon-small)  /* 24px */

/* Icon States */
drawer-open: hamburger icon (three lines)
drawer-closed: close/X icon

/* Hover */
opacity: 0.8
```

**2. Application Title/Logo**

```css
/* Container */
margin-left: 15px
display: flex
align-items: center
gap: 10px

/* Text */
font-size: var(--font-larger)  /* 18.7px */
font-weight: bold
color: var(--text-color)
text: "YouWorker"

/* Or Logo Image */
height: 40px
width: auto
/* Use YouWorker logo image */
```

**Note:** Model selector removed - models are managed via backend/API

**3. LocalDocs Button**

```css
/* Dimensions */
padding: 10px 18px
border-radius: var(--radius-standard)  /* 10px */
font-size: var(--font-large)
font-weight: bold

/* States */
default-background: var(--bg-lighter-button)
active-background: var(--bg-collections-button)
color: var(--text-color)

/* Icon/Badge */
icon-size: 24px
badge-size: 20px × 20px (circular)
badge-background: var(--accent-color)
badge-color: var(--text-opposite)
badge-font-size: var(--font-smaller)

/* Busy Indicator */
spinner-size: 20px
spinner-color: var(--accent-color)
animation: rotate infinite 1s linear
```

---

### 3. Conversation Area

#### Container

```css
/* Dimensions */
width: 100%
max-width: 1280px
margin: 0 auto
padding: 20px 50px
flex: 1  /* Fills available space */
overflow-y: auto
overflow-x: hidden

/* Scrollbar */
scrollbar-width: none  /* Firefox */
-ms-overflow-style: none  /* IE/Edge */

/* Webkit browsers */
&::-webkit-scrollbar {
  display: none
}

/* Background */
background: var(--bg-conversation)
```

#### HomePage Overlay (Empty State)

```css
/* Container */
position: absolute
top: 0
left: 0
width: 100%
height: 100%
z-index: 200
display: flex
flex-direction: column
align-items: center
justify-content: center
background: var(--bg-conversation)
```

**YouWorker Logo**
```css
width: 160px
height: 110px
margin-bottom: 30px
/* Note: Replace with YouWorker branding */
```

**Load Model Button**
```css
padding: 15px 30px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-size: var(--font-large)
font-weight: bold

/* Content */
"Load · [Model Name] (default)" with arrow icon
```

**No Model State**
```css
font-size: var(--font-larger)
color: var(--text-muted)
text-align: center
```

#### Chat Message List

```css
/* Container */
display: flex
flex-direction: column
gap: 10px
width: 100%
max-width: 1280px

/* Performance */
cache-buffer: max integer (for virtualization)
```

---

### 4. Chat Message Bubble (ChatItemView)

#### Overall Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Avatar] Name (Bold)  Model Name           Status (Muted)   │ ← Header (38px)
│  32×32                                                       │
│                                                              │
│           Message content text appears here...              │
│           It can span multiple lines and includes           │
│           formatting like bold, italics, code blocks.       │
│                                                              │
│           ┌──────────────────────────────────────┐          │
│           │ 📎 attachment.pdf            [×]     │          │ ← Attachment
│           └──────────────────────────────────────┘          │
│                                                              │
│           ┌──────────────┐ ┌──────────────┐                │
│           │ Source 1     │ │ Source 2     │                │ ← Sources
│           │ Title        │ │ Title        │                │
│           │ (200×75px)   │ │ (200×75px)   │                │
│           └──────────────┘ └──────────────┘                │
│                                                              │
│           [Copy] [👍] [👎] [Edit] [Regenerate]             │ ← Actions
│                                                              │
│           ┌──────────────────────────────────────┐          │
│           │ Suggested follow-up question 1       │          │ ← Suggested
│           └──────────────────────────────────────┘          │   Follow-ups
│           ┌──────────────────────────────────────┐          │
│           │ Suggested follow-up question 2       │          │
│           └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

#### Avatar

```css
/* Dimensions */
size: 32px × 32px
border-radius: 50%  /* Circular */
margin-top: 25px  /* For non-first messages */
margin-top: 0  /* First message in list */

/* User Avatar */
icon: "you.svg" /* or user profile icon */
color-overlay: var(--text-conversation-header)

/* AI Avatar */
icon: "youworker_logo.svg" /* Replace with YouWorker branding */
color-overlay: var(--text-conversation-header)

/* Active Response State */
animation: rotate infinite 2s linear
```

#### Header Row

```css
/* Container */
height: 38px
display: flex
align-items: center
gap: 10px
margin-left: 10px  /* Offset from avatar */

/* Name Label */
font-size: var(--font-larger)
font-weight: bold
color: var(--text-conversation-header)

/* User */
text: "You"

/* AI */
text: "YouWorker"

/* Model Name */
font-size: var(--font-larger)
font-weight: normal
color: var(--text-muted)
margin-left: 5px

/* Status Text */
font-size: var(--font-medium)
color: var(--text-muted)
margin-left: auto
text: "Retrieving..." | "Processing..." | "Generating..."
```

#### Message Content

```css
/* Container */
margin-left: 42px  /* Aligns with header text (32px avatar + 10px gap) */
margin-top: 10px
width: calc(100% - 42px)

/* Text */
font-size: var(--font-large)
color: var(--text-color)
line-height: 1.5
white-space: pre-wrap
word-wrap: break-word

/* Markdown Support */
- Headers: font-weight: bold
- Code blocks: background: var(--bg-sources), padding: 10px, border-radius: 5px, font-family: var(--font-monospace)
- Inline code: background: var(--bg-sources), padding: 2px 5px, border-radius: 3px
- Links: color: var(--accent-color), text-decoration: underline
```

#### Attachments

```css
/* Container */
display: flex
flex-direction: column
gap: 10px
margin-top: 10px
margin-left: 42px

/* Attachment Card */
width: 350px
height: 50px
background: var(--bg-attachment)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)  /* 10px */
padding: 5px 10px
display: grid
grid-template-columns: 40px 265px auto
align-items: center
gap: 5px
```

**File Icon**
```css
size: 40px × 40px
color: var(--accent-color)
```

**Filename**
```css
width: 265px
font-size: var(--font-medium)
color: var(--text-color)
text-overflow: ellipsis
white-space: nowrap
overflow: hidden
```

**Remove Button**
```css
size: 24px × 24px
background: transparent
border-radius: 50%
icon: X/close
color: var(--text-muted)

/* Hover */
background: var(--bg-sources-hover)
color: var(--error-color)
```

#### Sources Section

```css
/* Container */
display: flex
flex-wrap: wrap
gap: 10px
margin-top: 10px
margin-left: 42px

/* Source Card */
width: 200px
height: 75px
background: var(--bg-sources)
border-radius: var(--radius-standard)  /* 10px */
padding: 10px
cursor: pointer
transition: background 200ms ease

/* Hover */
background: var(--bg-sources-hover)

/* Expand/Collapse Transition */
height: 75px (collapsed)
height: auto (expanded)
transition: height 300ms cubic-bezier(0.45, 0, 0.55, 1)
```

**Source Card Content**
```css
/* Title */
font-size: var(--font-medium)
font-weight: bold
color: var(--text-color)
margin-bottom: 5px
text-overflow: ellipsis
overflow: hidden

/* Excerpt */
font-size: var(--font-small)
color: var(--text-muted)
line-height: 1.4
display: -webkit-box
-webkit-line-clamp: 2
-webkit-box-orient: vertical
overflow: hidden

/* Expanded State */
height: auto
-webkit-line-clamp: unset
```

#### Action Buttons Row

```css
/* Container */
display: flex
gap: 15px
margin-top: 15px
margin-left: 42px
align-items: center
```

**Copy Button**
```css
background: transparent
border: none
padding: 5px 10px
border-radius: var(--radius-small)
font-size: var(--font-medium)
color: var(--text-muted)
cursor: pointer
transition: opacity 30ms ease

/* Hover */
opacity: 1
background: var(--bg-lighter-button)
color: var(--text-color)
```

**Thumbs Up/Down**
```css
size: 24px × 24px
background: transparent
border: none
cursor: pointer

/* Inactive */
opacity: 0.2
filter: grayscale(100%)

/* Active */
opacity: 1
filter: grayscale(0%)

/* Hover */
opacity: 0.6
```

**Edit/Regenerate Buttons**
```css
size: 24px × 24px
background: transparent
border-radius: var(--radius-small)
padding: 5px
cursor: pointer

/* Hover */
background: var(--bg-lighter-button)
```

#### Suggested Follow-ups

```css
/* Container */
display: flex
flex-direction: column
gap: 10px
margin-top: 15px
margin-left: 42px
```

**Suggestion Button**
```css
/* Dimensions */
padding: 10px 20px 10px 40px  /* Extra right padding for icon */
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)  /* 10px */
position: relative
cursor: pointer
transition: background 200ms ease

/* Text */
font-size: var(--font-large)
color: var(--text-color)
text-align: left

/* Icon (arrow) */
position: absolute
right: 10px
top: 50%
transform: translateY(-50%)
size: 20px × 20px
color: var(--text-muted)

/* Hover */
background: var(--bg-lighter-button)
border-color: var(--accent-color)
```

**Loading State**
```css
/* Two animated bars */
bar-1-opacity: 0.3 → 1.0 (0-750ms), 1.0 → 0.3 (750-1500ms)
bar-2-opacity: 1.0 → 0.3 (0-750ms), 0.3 → 1.0 (750-1500ms)
animation-duration: 1500ms
animation-iteration: infinite
```

---

### 5. Text Input Area

#### Container

```css
/* Dimensions */
width: calc(100% - 60px)  /* 30px margins on each side */
min-height: 60px
max-height: 240px  /* Accounts for max text area height + controls */
margin: 30px
position: sticky
bottom: 0

/* Visual */
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)  /* 10px */

/* Error State */
border: 2px solid var(--error-color)

/* Responsive */
@media (max-width: 768px) {
  margin: 15px
  width: calc(100% - 30px)
}
```

#### Layout Grid

```css
/* Grid Structure */
display: grid
grid-template-columns: auto 1fr auto
grid-template-rows: auto auto
gap: 10px
padding: 10px

/* Row 1: Attachments (spans all columns) */
grid-row: 1
grid-column: 1 / -1

/* Row 2, Col 0: Plus Button */
grid-row: 2
grid-column: 1

/* Row 2, Col 1: Text Input */
grid-row: 2
grid-column: 2

/* Row 2, Col 2: Send/Stop Button */
grid-row: 2
grid-column: 3
```

#### Attachment Flow (Row 1)

```css
/* Container */
display: flex
flex-wrap: wrap
gap: 10px
visibility: hidden  /* When no attachments */
visibility: visible  /* When attachments exist */
```

**Attachment Card** (same as in message bubble)
```css
width: 350px
height: 50px
background: var(--bg-attachment)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
/* ... (see Attachments section above) */
```

#### Plus Button (Attachment)

```css
/* Dimensions */
size: 40px × 40px
margin: 15px
background: transparent
border: none
border-radius: var(--radius-small)
cursor: pointer

/* Icon */
icon-size: var(--font-largest)  /* 24px */
color: var(--text-muted)

/* States */
disabled: opacity 0.3, cursor: not-allowed
hover: background: var(--bg-lighter-button), color: var(--text-color)
```

#### Text Input (TextArea)

```css
/* Dimensions */
width: 100%
min-height: 40px
max-height: 200px
padding: 10px
resize: none  /* User cannot manually resize */
overflow-y: auto  /* Scrolls when content exceeds max-height */

/* Visual */
background: transparent
border: none
border-radius: var(--radius-small)
font-family: var(--font-primary)
font-size: var(--font-larger)
color: var(--text-color)

/* Placeholder */
placeholder: "Send a message..."
placeholder-color: var(--text-muted)

/* Unloaded State */
placeholder: "Load a model to continue..."
disabled: true
opacity: 0.5

/* Focus */
outline: none
```

**Context Menu**
```css
/* Right-click menu */
items: Cut | Copy | Paste | Select All
background: var(--context-menu-bg)
border: 1px solid var(--context-menu-frame)
border-radius: var(--radius-small)
padding: 5px 0
```

**Keyboard Shortcuts**
- **Enter:** Submit message
- **Ctrl+Shift+Enter (or Shift+Enter):** Insert newline

#### Send/Stop Button

**Send Button (Idle State)**
```css
/* Dimensions */
size: 40px × 40px
background: var(--bg-button)
border: none
border-radius: 50%  /* Circular */
cursor: pointer

/* Icon */
icon: arrow-up or paper-plane
icon-size: 20px
color: var(--text-opposite)

/* Disabled */
background: var(--bg-lighter-button)
opacity: 0.5
cursor: not-allowed

/* Hover */
background: var(--bg-button-hover)
```

**Stop Button (Generating State)**
```css
/* Dimensions */
size: 40px × 40px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: 50%

/* Icon */
icon: square (stop icon)
icon-size: 16px
color: var(--error-color)

/* Hover */
border-color: var(--error-color)
background: var(--bg-sources)
```

#### Status Bar (Bottom)

```css
/* Container */
position: absolute
bottom: -25px  /* Below input container */
right: 0
display: flex
gap: 10px
font-size: var(--font-smaller)
font-weight: bold
color: var(--text-muted)
padding: 5px 0
```

**Content Elements**
- **Token Speed:** "[X] tokens/sec"
- **Device Name:** "Device: [name] ([backend])"
- **Fallback Reason:** Shows when model falls back to CPU

**Error State**
```css
color: var(--error-color)
font-size: var(--font-medium)
```

---

### 6. Floating Controls (Conversation Tray)

```css
/* Container */
position: absolute
bottom: calc(100% + 10px)  /* 10px above text input */
right: 30px
z-index: 400
display: flex
gap: 10px
opacity: 0  /* Hidden by default */
opacity: 1  /* Visible on hover */
transition: opacity 300ms ease
```

#### Reset Button

```css
/* Dimensions */
size: 40px × 40px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: 50%
cursor: pointer

/* Icon */
icon: recycle/refresh
icon-size: 20px
color: var(--text-muted)

/* Hover */
background: var(--bg-lighter-button)
border-color: var(--accent-color)
color: var(--text-color)

/* Tooltip */
"Reset conversation"
```

#### Copy Conversation Button

```css
/* Same styling as Reset Button */

/* Icon */
icon: copy/duplicate
icon-size: 20px

/* Tooltip */
"Copy conversation to clipboard"
```

---

### 7. Home View

#### Container

```css
/* Dimensions */
max-width: 1530px
margin: 0 auto
padding: 30px

/* Layout */
display: flex
flex-direction: column
gap: 50px
align-items: center
```

#### Welcome Section

```css
/* Container */
display: flex
flex-direction: column
align-items: center
text-align: center
gap: 20px
margin-top: 50px
```

**Title**
```css
font-size: var(--font-banner)  /* 24pt / ~32px */
font-weight: bold
color: var(--text-color)
text: "Welcome to YouWorker"
```

**Subtitle**
```css
font-size: var(--font-larger)  /* 14pt / ~18.7px */
color: var(--text-muted)
text: "Your AI-powered work assistant"
```

**Start Chatting Button** (first-time users)
```css
padding: 15px 30px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-size: var(--font-large)
font-weight: bold
margin-top: 20px

/* Hover */
background: var(--bg-button-hover)
```

#### Action Buttons Row

```css
/* Container */
display: flex
gap: 30px
margin-top: 30px
flex-wrap: wrap
justify-content: center
```

**Button Card (MyWelcomeButton)**
```css
/* Dimensions */
min-width: 250px
max-width: 350px
padding: 30px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
cursor: pointer
transition: all 200ms ease

/* Layout */
display: flex
flex-direction: column
align-items: center
text-align: center
gap: 15px

/* Hover */
background: var(--bg-lighter-button)
border-color: var(--accent-color)
transform: translateY(-5px)
box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1)
```

**Icon**
```css
size: 64px × 64px
color: var(--accent-color)
margin-bottom: 10px
```

**Title**
```css
font-size: var(--font-larger)
font-weight: bold
color: var(--text-color)
```

**Description**
```css
font-size: var(--font-medium)
color: var(--text-muted)
line-height: 1.4
```

**Two Buttons:**
1. **Start Chatting** - "Initiate chat with AI"
2. **LocalDocs** - "Enable chat with local documents"

**Note:** "Find Models" button removed - models are managed via backend/API

#### News Section

```css
/* Container */
width: 100%
max-width: 800px
padding: 30px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
margin-top: 30px

/* Header */
display: flex
align-items: center
gap: 15px
margin-bottom: 20px
```

**Logo Icon**
```css
size: 40px × 40px
color: var(--accent-color)
/* Note: Use YouWorker logo/icon */
```

**Title**
```css
font-size: var(--font-larger)
font-weight: bold
color: var(--text-color)
text: "Latest News" /* or "Updates" for YouWorker */
```

**Content Area**
```css
/* Scrollable markdown content */
max-height: 400px
overflow-y: auto
font-size: var(--font-medium)
color: var(--text-color)
line-height: 1.6

/* Markdown Styling */
- Headings: font-weight: bold, margin: 10px 0
- Links: color: var(--accent-color), text-decoration: underline
- Paragraphs: margin: 10px 0
```

#### Footer Navigation

```css
/* Container */
display: flex
justify-content: space-between
align-items: center
width: 100%
max-width: 800px
margin-top: 50px
padding-top: 30px
border-top: 1px solid var(--border-divider)
```

**Left Links**
```css
display: flex
gap: 20px
flex-wrap: wrap
```

**Link Style**
```css
font-size: var(--font-medium)
color: var(--accent-color)
text-decoration: none

/* Hover */
text-decoration: underline
opacity: 0.8
```

**Links:**
- Release Notes
- Documentation
- Support / Contact
- GitHub (youworker repository)
- Community

**Right Link** (YouWorker website)
```css
/* Same styling as left links */
```

#### Newsletter Subscription

```css
/* Container */
position: absolute
top: 30px
right: 30px
padding: 20px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1)
```

---

### 8. LocalDocs View

#### Container

```css
/* Layout */
display: flex
flex-direction: column
gap: 50px
padding: 30px
```

#### Header Section

```css
/* Container */
display: flex
justify-content: space-between
align-items: flex-start
```

**Left Column**
```css
/* Title */
font-size: var(--font-banner)  /* 24pt / ~32px */
font-weight: bold
color: var(--text-color)
text: "LocalDocs"
margin-bottom: 10px

/* Subtitle */
font-size: var(--font-larger)
color: var(--text-muted)
text: "Chat with your local files"
```

**Right Column**
```css
/* Add Collection Button */
padding: 10px 18px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-weight: bold
text: "+ Add Collection"

/* Hover */
background: var(--bg-button-hover)
```

#### Error State

```css
/* Container */
width: 100%
min-height: 400px
display: flex
flex-direction: column
align-items: center
justify-content: center
padding: 50px
background: var(--bg-control)
border: 2px solid var(--error-color)
border-radius: var(--radius-standard)
```

**Title**
```css
font-size: var(--font-larger)
font-weight: bold
color: var(--error-color)
margin-bottom: 20px
text: "Database Access Error"
```

**Message**
```css
font-size: var(--font-medium)
color: var(--text-color)
line-height: 1.6
text-align: center
max-width: 600px

/* Includes troubleshooting steps */
```

#### Empty State

```css
/* Container */
display: flex
flex-direction: column
align-items: center
justify-content: center
min-height: 400px
gap: 20px
```

**Text**
```css
font-size: var(--font-larger)
color: var(--text-muted)
text: "No Collections Installed"
```

**Explanation**
```css
font-size: var(--font-medium)
color: var(--text-muted)
text-align: center
max-width: 500px
```

**Button**
```css
padding: 10px 18px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-weight: bold
text: "+ Add Doc Collection"
```

#### Collection Cards

```css
/* Container */
background: var(--bg-conversation)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
padding: 30px
margin-bottom: 30px

/* Layout */
display: flex
flex-direction: column
gap: 20px
```

**Row 1: Title & Progress**

*Collection Name*
```css
font-size: var(--font-largest)
font-weight: bold
color: var(--text-color)
```

*Progress Indicator*
```css
/* Circular progress or percentage */
size: 40px × 40px
color: var(--accent-color)
font-size: var(--font-medium)
font-weight: bold
```

**Row 2: Path & Status**

*Folder Path*
```css
font-size: var(--font-medium)
color: var(--text-muted)
font-family: var(--font-monospace)
text-overflow: ellipsis
overflow: hidden
```

*Status Message*
```css
font-size: var(--font-medium)
color: var(--text-color)
/* Examples: "Ready", "Updating...", "Indexing 35%", "Error" */
```

**Row 3: Metadata**

```css
/* Container */
display: flex
gap: 30px
flex-wrap: wrap
```

**Metadata Item**
```css
display: flex
flex-direction: column
gap: 5px
```

**Label**
```css
font-size: var(--font-small)
color: var(--text-muted)
text-transform: uppercase
```

**Value**
```css
font-size: var(--font-medium)
font-weight: bold
color: var(--text-color)
```

**Metadata Fields:**
- Files: "[X] files"
- Words: "[X] words"
- Embedding Model: "[Model name]"
- Last Updated: "[Timestamp]"

**Row 4: Current File** (during processing)

```css
/* Container */
display: flex
align-items: center
gap: 10px
padding: 10px
background: var(--bg-sources)
border-radius: var(--radius-small)
```

**Busy Indicator**
```css
size: 20px × 20px
color: var(--accent-color)
animation: rotate infinite 1s linear
```

**Filename**
```css
font-size: var(--font-medium)
color: var(--text-color)
font-family: var(--font-monospace)
text-overflow: ellipsis
overflow: hidden
```

**Row 5: Actions**

```css
/* Container */
display: flex
gap: 10px
```

**Remove Button**
```css
padding: 10px 18px
background: transparent
color: var(--error-color)
border: 1px solid var(--error-color)
border-radius: var(--radius-standard)
font-weight: bold

/* Hover */
background: var(--error-color)
color: var(--text-opposite)
```

**Rebuild Button**
```css
padding: 10px 18px
background: transparent
color: var(--accent-color)
border: 1px solid var(--accent-color)
border-radius: var(--radius-standard)
font-weight: bold

/* Hover */
background: var(--accent-color)
color: var(--text-opposite)
```

**Update Button**
```css
padding: 10px 18px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-weight: bold

/* Disabled */
opacity: 0.5
cursor: not-allowed

/* Success State */
background: var(--green-600)

/* Error State */
background: var(--error-color)
```

---

### 9. Collections Drawer (Right Sidebar)

#### Container

```css
/* Dimensions */
min-width: 180px
max-width: 600px
preferred-width: min(23vw, 600px)
height: 100%
background: var(--bg-view)
border-left: 1px solid var(--border-divider)
padding: 20px

/* Layout */
display: flex
flex-direction: column
gap: 15px
```

#### Collection List

```css
/* Container */
flex: 1
overflow-y: auto
display: flex
flex-direction: column
gap: 15px
```

#### Collection Item

```css
/* Container */
padding: 15px
background: transparent
border-radius: var(--radius-standard)
cursor: pointer
transition: background 200ms ease

/* Checked State */
background: var(--bg-collections-button)

/* Hover */
background: var(--bg-lighter-button)

/* Layout */
display: flex
align-items: flex-start
gap: 10px
```

**Checkbox**
```css
/* Dimensions */
size: 20px × 20px
border: 2px solid var(--border-control)
border-radius: var(--radius-small)
background: var(--bg-control)
cursor: pointer

/* Checked */
background: var(--accent-color)
border-color: var(--accent-color)

/* Checkmark Icon */
icon: checkmark
color: var(--text-opposite)
size: 14px × 14px
```

**Content Column**
```css
flex: 1
display: flex
flex-direction: column
gap: 5px
```

**Collection Name**
```css
font-size: var(--font-medium)
font-weight: bold
color: var(--text-color)
text-overflow: ellipsis
white-space: nowrap
overflow: hidden
```

**Metadata**
```css
font-size: var(--font-small)
color: var(--text-muted)
text: "[X] files • [Y] words"
```

**Loading Indicator** (when updating)
```css
size: 16px × 16px
color: var(--accent-color)
animation: rotate infinite 1s linear
```

#### Footer

```css
/* Container */
padding-top: 15px
border-top: 1px solid var(--border-divider)
display: flex
flex-direction: column
gap: 15px
```

**Add Docs Button**
```css
padding: 10px 18px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-weight: bold
text: "+ Add Docs"
text-align: center

/* Hover */
background: var(--bg-button-hover)
```

**Instructions Text**
```css
font-size: var(--font-small)
color: var(--text-muted)
line-height: 1.4
text-align: center
text: "Select a collection to make it available to the chat model"
```

---

### 10. Settings View

#### Container

```css
/* Layout */
display: flex
gap: 30px
padding: 30px
height: 100%
```

#### Header

```css
/* Full width, top of container */
width: 100%
margin-bottom: 50px
```

**Title**
```css
font-size: var(--font-banner)  /* 24pt / ~32px */
font-weight: bold
color: var(--text-color)
text: "Settings"
```

#### Navigation Panel (Left)

```css
/* Dimensions */
width: 220px
flex-shrink: 0

/* Visual */
background: var(--bg-control)
border-radius: var(--radius-standard)
padding: 10px
```

**Navigation Items**

```css
/* Container */
display: flex
flex-direction: column
gap: 5px
```

**Navigation Button**
```css
/* Dimensions */
padding: 15px 20px
background: transparent
border: none
border-radius: var(--radius-small)
font-size: var(--font-large)
color: var(--text-color)
text-align: left
cursor: pointer
transition: background 200ms ease

/* Selected State */
background: var(--bg-selected)
font-weight: bold

/* Hover */
background: var(--bg-lighter-button)
```

**Navigation Items:**
1. Application
2. LocalDocs

**Note:** Model settings removed - model selection is handled via the header dropdown

#### Settings Panel (Right)

```css
/* Dimensions */
flex: 1
overflow-y: auto
padding: 10px

/* Layout */
display: flex
flex-direction: column
gap: 30px
```

---

### 11. Application Settings

#### Layout

```css
/* Grid Layout */
display: grid
grid-template-columns: auto 1fr
row-gap: 30px
column-gap: 10px
align-items: center
```

#### Setting Item

Each setting consists of:
1. **Label** (left column)
2. **Control** (right column)

**Label**
```css
font-size: var(--font-medium)
font-weight: bold
color: var(--text-settings-title)
text-align: right
padding-right: 20px
```

**Control**
- Varies by setting type (dropdown, checkbox, text input, button)

#### Setting Types

**1. Theme (Dropdown)**

```css
/* ComboBox */
min-width: 200px
padding: 10px 15px
background: var(--bg-container)
border: 1px solid var(--border-dialog)
border-radius: var(--radius-standard)
font-size: var(--font-medium)

/* Options */
- Light (default)
- Dark
- LegacyDark (can be renamed to "Classic Dark" for YouWorker)
```

**2. Font Size (Dropdown)**

```css
/* Same styling as Theme */

/* Options */
- Small (default)
- Medium
- Large
```

**3. Language and Locale (Dropdown)**

```css
/* Same styling */
/* Default: System locale */
```

**4. Device (Dropdown)**

```css
/* Options */
- Auto (default)
- Metal (Apple Silicon M1+)
- CPU
- GPU
```

**5. Default Model (Dropdown)**

```css
/* Populated with installed models */
```

**6. Suggestion Mode (Dropdown)**

```css
/* Options for follow-up question generation */
/* 3 modes */
```

**7. Download Path (Directory Field)**

```css
/* Container */
display: flex
gap: 10px
```

**Text Input**
```css
flex: 1
padding: 10px
background: var(--bg-container)
border: 1px solid var(--border-dialog)
border-radius: var(--radius-standard)
font-size: var(--font-medium)
font-family: var(--font-monospace)
color: var(--text-styled)
```

**Browse Button**
```css
padding: 10px 18px
background: var(--bg-lighter-button)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
font-weight: bold
text: "Browse..."

/* Hover */
background: var(--bg-button)
color: var(--text-opposite)
```

**8. Enable Telemetry/Analytics (Checkbox)**

```css
/* Checkbox */
size: 20px × 20px
border: 2px solid var(--border-control)
border-radius: var(--radius-small)
background: var(--bg-container)

/* Checked */
background: var(--accent-color)
border-color: var(--accent-color)

/* Label */
margin-left: 10px
font-size: var(--font-medium)
color: var(--text-color)
/* Note: Renamed from "Enable Datalake" for YouWorker context */
```

#### Advanced Section

**Section Divider**
```css
grid-column: 1 / -1
height: 1px
background: var(--settings-divider)
margin: 20px 0
```

**Section Title**
```css
grid-column: 1 / -1
font-size: var(--font-larger)
font-weight: bold
color: var(--text-settings-title)
margin-bottom: 10px
```

**9. CPU Threads (Number Input)**

```css
/* Input */
width: 100px
padding: 10px
background: var(--bg-container)
border: 1px solid var(--border-dialog)
border-radius: var(--radius-standard)
font-size: var(--font-medium)
text-align: center

/* Minimum: 1 */
```

**10. Enable System Tray (Checkbox)**

```css
/* Same as Enable Datalake checkbox */
```

**11. Enable Local API Server (Checkbox)**

```css
/* Same styling */
```

**12. API Server Port (Number Input)**

```css
/* Same as CPU Threads input */
width: 120px
placeholder: "4891"
```

**13. Check For Updates (Button)**

```css
padding: 10px 18px
background: var(--bg-button)
color: var(--text-opposite)
border-radius: var(--radius-standard)
font-weight: bold
text: "Check For Updates"

/* Hover */
background: var(--bg-button-hover)
```

---

### 12. Button Components

#### MyButton (Standard Button)

```css
/* Dimensions */
padding: 10px 18px
min-height: 40px

/* Visual */
background: var(--bg-button)
color: var(--text-opposite)
border: 0px  /* Light & Dark themes */
border: 1px solid var(--border-button)  /* LegacyDark theme */
border-radius: var(--radius-standard)  /* 10px */
font-family: var(--font-primary)
font-size: var(--font-large)
font-weight: bold
text-align: center
cursor: pointer
transition: background 200ms ease

/* Hover */
background: var(--bg-button-hover)

/* Disabled */
background: var(--text-muted)
color: var(--text-opposite-muted)
cursor: not-allowed
opacity: 0.5

/* Focus (Accessibility) */
outline: 2px solid var(--accent-color)
outline-offset: 2px

/* Active/Pressed */
transform: translateY(1px)
```

#### MyMiniButton

```css
/* Same as MyButton but: */
padding: 5px 10px
min-height: 30px
font-size: var(--font-medium)
```

#### MySettingsButton

```css
/* Same as MyButton but: */
background: transparent
color: var(--text-color)
text-align: left

/* Selected State */
background: var(--bg-selected)
font-weight: bold

/* Hover */
background: var(--bg-lighter-button)
```

#### MySettingsDestructiveButton

```css
/* Same as MyButton but: */
background: transparent
color: var(--error-color)
border: 1px solid var(--error-color)

/* Hover */
background: var(--error-color)
color: var(--text-opposite)
```

#### MyTabButton

```css
/* Dimensions */
padding: 15px 30px
background: transparent
border: none
border-bottom: 3px solid transparent
font-size: var(--font-large)
font-weight: bold
color: var(--text-muted)
cursor: pointer
transition: all 200ms ease

/* Active/Selected */
color: var(--text-color)
border-bottom-color: var(--accent-color)

/* Hover */
color: var(--text-color)
background: var(--bg-lighter-button)
```

#### MyTextButton

```css
/* Dimensions */
padding: 5px 10px
background: transparent
border: none
font-size: var(--font-medium)
color: var(--accent-color)
text-decoration: underline
cursor: pointer

/* Hover */
opacity: 0.8
text-decoration: none
```

#### MyToolButton

```css
/* Dimensions */
size: 40px × 40px
padding: 0
background: transparent
border: none
border-radius: var(--radius-small)
cursor: pointer
transition: background 200ms ease

/* Icon */
icon-size: 24px
color: var(--text-muted)

/* Hover */
background: var(--bg-lighter-button)
color: var(--text-color)
```

#### MyWelcomeButton

```css
/* Dimensions */
min-width: 250px
max-width: 350px
padding: 30px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
cursor: pointer
transition: all 200ms ease

/* Layout */
display: flex
flex-direction: column
align-items: center
text-align: center
gap: 15px

/* Hover */
background: var(--bg-lighter-button)
border-color: var(--accent-color)
transform: translateY(-5px)
box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1)

/* Icon */
size: 64px × 64px
color: var(--accent-color)

/* Title */
font-size: var(--font-larger)
font-weight: bold
color: var(--text-color)

/* Description */
font-size: var(--font-medium)
color: var(--text-muted)
```

---

### 13. Input Components

#### MyTextField

```css
/* Dimensions */
width: 100%
min-height: 40px
padding: 10px 15px

/* Visual */
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)  /* 10px */
font-family: var(--font-primary)
font-size: var(--font-large)
color: var(--text-color)

/* Placeholder */
placeholder-color: var(--text-muted)

/* Focus */
outline: none
border-color: var(--accent-color)

/* Error State */
border: 2px solid var(--error-color)

/* Disabled */
opacity: 0.5
cursor: not-allowed
background: var(--bg-lighter-button)
```

#### MyTextArea

```css
/* Same as MyTextField but: */
min-height: 60px
max-height: 200px
resize: none  /* Disable manual resize */
overflow-y: auto  /* Scroll when exceeds max-height */
line-height: 1.5
```

#### MyCheckBox

```css
/* Container */
display: flex
align-items: center
gap: 10px
cursor: pointer

/* Checkbox */
size: 20px × 20px
border: 2px solid var(--border-control)
border-radius: var(--radius-small)  /* 5px */
background: var(--bg-control)
position: relative
transition: all 200ms ease

/* Checked */
background: var(--accent-color)
border-color: var(--accent-color)

/* Checkmark Icon */
position: absolute
top: 50%
left: 50%
transform: translate(-50%, -50%)
size: 14px × 14px
color: var(--text-opposite)
visibility: hidden  /* Hidden when unchecked */
visibility: visible  /* Visible when checked */

/* Label */
font-size: var(--font-medium)
color: var(--text-color)
user-select: none

/* Focus */
outline: 2px solid var(--accent-color)
outline-offset: 2px
```

#### MyComboBox

```css
/* Container */
min-width: 150px
position: relative

/* Select Button */
padding: 10px 15px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
font-size: var(--font-medium)
color: var(--text-color)
cursor: pointer
display: flex
justify-content: space-between
align-items: center
gap: 10px

/* Dropdown Icon */
size: 20px × 20px
color: var(--text-muted)
transition: transform 200ms ease

/* Open State */
transform: rotate(180deg)

/* Dropdown Menu */
position: absolute
top: calc(100% + 5px)
left: 0
width: 100%
max-height: 300px
overflow-y: auto
background: var(--context-menu-bg)
border: 1px solid var(--context-menu-frame)
border-radius: var(--radius-standard)
box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2)
z-index: 1000
```

**Menu Item**
```css
padding: 10px 15px
font-size: var(--font-medium)
color: var(--text-color)
cursor: pointer
transition: background 100ms ease

/* Hover/Selected */
background: var(--context-menu-highlight)
```

#### MyDirectoryField

```css
/* Container */
display: flex
gap: 10px
width: 100%

/* Text Field */
flex: 1
/* Uses MyTextField styling */

/* Browse Button */
padding: 10px 18px
background: var(--bg-lighter-button)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
font-weight: bold
white-space: nowrap

/* Hover */
background: var(--bg-button)
color: var(--text-opposite)
```

---

### 14. Dialog Components

#### MyDialog (Base)

```css
/* Overlay */
position: fixed
top: 0
left: 0
width: 100vw
height: 100vh
background: rgba(0, 0, 0, 0.5)
z-index: 9999
display: flex
align-items: center
justify-content: center

/* Dialog Container */
min-width: 300px
max-width: 600px
max-height: 80vh
overflow-y: auto
background: var(--bg-control)
border: 1px solid var(--border-dialog)
border-radius: var(--radius-standard)
padding: 30px
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3)
```

#### ConfirmationDialog

```css
/* Container */
/* Uses MyDialog base */

/* Title */
font-size: var(--font-larger)
font-weight: bold
color: var(--text-color)
margin-bottom: 20px

/* Message */
font-size: var(--font-medium)
color: var(--text-color)
margin-bottom: 30px
line-height: 1.5

/* Button Row */
display: flex
gap: 10px
justify-content: flex-end
```

**Confirm Button**
```css
/* MyButton with green/success styling */
background: var(--green-600)
icon: checkmark
```

**Cancel Button**
```css
/* MyButton with default styling */
background: var(--bg-lighter-button)
color: var(--text-color)
icon: X
```

**Auto-dismiss**
```css
/* Automatically closes after 3 seconds if no action */
```

#### PopupDialog

```css
/* Same as MyDialog base */
/* Used for generic popups */
```

---

### 15. Utility Components

#### Toast Notifications

```css
/* Container */
position: fixed
bottom: 30px
left: 50%
transform: translateX(-50%)
z-index: 10000
min-width: 300px
max-width: 500px
padding: 15px 20px
background: var(--bg-control)
border: 1px solid var(--border-control)
border-radius: var(--radius-standard)
box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3)

/* Animation */
animation: slideUp 200ms ease, fadeIn 200ms ease

/* Text */
font-size: var(--font-medium)
color: var(--text-color)

/* Auto-dismiss */
/* Duration varies by message type */
```

**Toast Types:**

*Success*
```css
border-left: 4px solid var(--green-600)
```

*Error*
```css
border-left: 4px solid var(--error-color)
```

*Info*
```css
border-left: 4px solid var(--accent-color)
```

#### MyBusyIndicator

```css
/* Container */
display: inline-block
size: 24px × 24px  /* Default, can vary */

/* Spinner */
border: 3px solid var(--bg-lighter-button)
border-top-color: var(--accent-color)
border-radius: 50%
animation: rotate infinite 1s linear

/* Sizes */
small: 16px × 16px
medium: 24px × 24px
large: 40px × 40px
```

#### MyFancyLink

```css
/* Link */
font-size: var(--font-medium)
color: var(--accent-color)
text-decoration: none
cursor: pointer
transition: all 200ms ease

/* Hover */
text-decoration: underline
opacity: 0.8

/* Visited */
color: var(--purple-600)

/* Focus */
outline: 2px solid var(--accent-color)
outline-offset: 2px
```

#### MyFileIcon

```css
/* Icon */
size: 40px × 40px
color: var(--accent-color)

/* File type variants */
/* Different icons for: */
- PDF
- Image (jpg, png, etc.)
- Text (txt, md, etc.)
- Code (js, py, etc.)
- Document (doc, docx, etc.)
- Generic/Unknown
```

#### MyMenu & MyMenuItem

```css
/* Menu Container */
position: absolute
min-width: 150px
max-width: 300px
background: var(--context-menu-bg)
border: 1px solid var(--context-menu-frame)
border-radius: var(--radius-standard)
padding: 5px 0
box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2)
z-index: 1000
```

**Menu Item**
```css
/* Dimensions */
padding: 10px 20px
display: flex
align-items: center
gap: 10px
cursor: pointer
transition: background 100ms ease

/* Text */
font-size: var(--font-medium)
color: var(--text-color)

/* Icon */
size: 20px × 20px
color: var(--text-muted)

/* Hover/Selected */
background: var(--context-menu-highlight)

/* Disabled */
opacity: 0.5
cursor: not-allowed
background: transparent

/* Divider */
height: 1px
background: var(--border-divider)
margin: 5px 0
```

---

## Animations & Transitions

### Standard Durations

```css
/* Quick (Hover effects) */
--duration-quick: 30ms

/* Standard (Transitions) */
--duration-standard: 200ms

/* Medium (Panel toggles) */
--duration-medium: 300ms

/* Slow (Removals) */
--duration-slow: 500ms

/* Cyclic (Loading) */
--duration-cyclic: 1500ms
```

### Easing Functions

```css
/* Primary Easing */
--easing-primary: cubic-bezier(0.45, 0, 0.55, 1)  /* InOutQuad */

/* Linear */
--easing-linear: linear
```

### Common Animations

#### Fade In

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 200ms var(--easing-primary);
}
```

#### Fade Out

```css
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.fade-out {
  animation: fadeOut 200ms var(--easing-primary);
}
```

#### Slide Up

```css
@keyframes slideUp {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}

.slide-up {
  animation: slideUp 200ms var(--easing-primary);
}
```

#### Rotate (Infinite)

```css
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rotate-infinite {
  animation: rotate 1s linear infinite;
}
```

#### Width Expand

```css
/* Applied to mini buttons on hover */
.expand-width {
  width: 0;
  transition: width 300ms var(--easing-primary);
}

.expand-width:hover {
  width: 40px;
}
```

#### Opacity Cycle (Loading)

```css
@keyframes opacityCycle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1.0; }
}

.loading-bar-1 {
  animation: opacityCycle 1500ms ease infinite;
}

.loading-bar-2 {
  animation: opacityCycle 1500ms ease infinite reverse;
}
```

#### Panel Slide (Drawer)

```css
.drawer {
  width: 180px;
  transition: width 200ms var(--easing-primary);
}

.drawer.open {
  width: min(23vw, 600px);
}
```

#### Remove Transition

```css
.chat-item-remove {
  opacity: 1;
  transition: opacity 500ms ease;
}

.chat-item-remove.removing {
  opacity: 0;
}
```

---

## Implementation Guide

### Technology Stack Recommendations

#### React/Next.js Libraries

**UI Component Libraries:**
- **Radix UI** - Unstyled, accessible component primitives
  - Dialog, Dropdown, Checkbox, Tabs, etc.
  - Full keyboard navigation and ARIA support
- **shadcn/ui** - Pre-styled Radix components (customizable)
- **Headless UI** - Alternative to Radix

**Styling:**
- **Tailwind CSS** - Utility-first CSS (rapid development)
  - Configure with YouWorker theme colors (from design guide)
  - Use @apply for component classes
- **styled-components** - CSS-in-JS with theme support
  - Dynamic theming
  - Scoped styles
- **CSS Modules** - Scoped CSS files

**State Management:**
- **Zustand** - Lightweight state management
  - Theme state
  - Chat state
  - Model state
- **React Context** - For theme provider

**Virtualization:**
- **react-window** - Virtual scrolling for chat messages
- **TanStack Virtual** - Alternative virtualization

**Animations:**
- **Framer Motion** - React animation library
  - Smooth transitions
  - Gesture animations
- **CSS Transitions** - For simpler animations

**Markdown:**
- **react-markdown** - Markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support
- **rehype-highlight** - Code syntax highlighting

**Icons:**
- **Lucide React** - Extensive icon library
- **Heroicons** - Alternative icon set

**File Handling:**
- **react-dropzone** - Drag & drop file uploads

**Routing:**
- **Next.js App Router** - Built-in routing

### Folder Structure

```
app/
├─ layout.tsx                 # Root layout with theme provider
├─ page.tsx                   # Home view
├─ chat/
│  └─ page.tsx                # Chat view (main interface)
├─ models/
│  ├─ page.tsx                # Models list view
│  └─ add/
│     └─ page.tsx             # Add model view
├─ settings/
│  └─ page.tsx                # Settings view
└─ localdocs/
   └─ page.tsx                # LocalDocs view

components/
├─ ui/                        # Reusable UI components
│  ├─ button.tsx              # MyButton variants
│  ├─ text-field.tsx          # MyTextField
│  ├─ text-area.tsx           # MyTextArea
│  ├─ checkbox.tsx            # MyCheckBox
│  ├─ combobox.tsx            # MyComboBox
│  ├─ dialog.tsx              # Dialog components
│  ├─ toast.tsx               # Toast notifications
│  ├─ busy-indicator.tsx      # Loading spinner
│  ├─ fancy-link.tsx          # Styled links
│  ├─ file-icon.tsx           # File type icons
│  └─ menu.tsx                # Context menus
├─ layout/                    # Layout components
│  ├─ chat-drawer.tsx         # Left sidebar
│  ├─ collections-drawer.tsx  # Right sidebar
│  ├─ header.tsx              # Top header
│  └─ main-layout.tsx         # Three-panel layout
├─ chat/                      # Chat-specific components
│  ├─ chat-view.tsx           # Conversation area
│  ├─ chat-item-view.tsx      # Message bubble
│  ├─ text-input-area.tsx     # Input area
│  ├─ conversation-tray.tsx   # Floating controls
│  └─ suggested-follow-up.tsx # Follow-up suggestions
├─ models/                    # Models-specific components
│  ├─ models-view.tsx         # Models list
│  ├─ model-card.tsx          # Model card
│  └─ add-model-view.tsx      # Add model interface
├─ settings/                  # Settings components
│  ├─ settings-view.tsx       # Settings container
│  ├─ application-settings.tsx
│  ├─ model-settings.tsx
│  └─ localdocs-settings.tsx
└─ home/                      # Home view components
   ├─ welcome-section.tsx
   ├─ action-buttons.tsx
   ├─ news-section.tsx
   └─ footer-navigation.tsx

styles/
├─ globals.css                # Global styles and CSS variables
├─ theme.ts                   # Theme object (if using styled-components)
├─ animations.css             # Keyframe animations
└─ utils.ts                   # Utility functions (cn, etc.)

lib/
├─ hooks/
│  ├─ use-theme.ts            # Theme switching hook
│  ├─ use-chat.ts             # Chat state management
│  ├─ use-models.ts           # Models state
│  └─ use-localdocs.ts        # LocalDocs state
├─ stores/
│  ├─ theme-store.ts          # Zustand theme store
│  ├─ chat-store.ts           # Chat state store
│  └─ settings-store.ts       # Settings store
└─ utils/
   ├─ cn.ts                   # classnames utility
   └─ colors.ts               # Color manipulation

public/
├─ icons/
│  ├─ you.svg
│  ├─ gpt4all_transparent.svg
│  └─ nomic.png
└─ illustrations/
   ├─ illu_privacy.png
   ├─ illu_localdocs.png
   └─ ... (other illustrations)
```

### Theme Implementation

#### CSS Variables Approach (Recommended)

**styles/globals.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700&display=swap');

:root {
  /* Light Theme (Default) */

  /* Text Colors */
  --text-color: hsl(0, 0%, 0%);
  --text-muted: hsl(25, 5%, 50%);
  --text-opposite: hsl(0, 0%, 100%);
  --text-opposite-muted: hsl(0, 0%, 85%);
  --text-conversation-header: hsl(25, 5%, 30%);
  --text-settings-title: hsl(25, 5%, 20%);
  --text-styled: hsl(25, 5%, 30%);

  /* Background Colors */
  --bg-view: hsl(25, 5%, 97%);
  --bg-conversation: hsl(0, 0%, 100%);
  --bg-control: hsl(0, 0%, 100%);
  --bg-button: hsl(120, 89%, 40%);
  --bg-button-hover: hsl(120, 89%, 35%);
  --bg-selected: hsl(45, 100%, 50%);
  --bg-sources: hsl(25, 5%, 90%);
  --bg-sources-hover: hsl(25, 5%, 80%);
  --bg-attachment: hsl(25, 5%, 95%);
  --bg-collections-button: hsl(45, 100%, 95%);
  --bg-lighter-button: hsl(25, 5%, 90%);
  --bg-container: hsl(0, 0%, 100%);

  /* Border Colors */
  --border-divider: hsl(25, 5%, 80%);
  --border-control: hsl(25, 5%, 70%);
  --border-dialog: hsl(25, 5%, 70%);
  --border-button: hsl(25, 5%, 60%);

  /* Accent & Error */
  --accent-color: hsl(45, 100%, 50%);
  --error-color: hsl(0, 89%, 50%);

  /* Context Menu */
  --context-menu-frame: hsl(25, 5%, 70%);
  --context-menu-bg: hsl(0, 0%, 100%);
  --context-menu-highlight: hsl(45, 100%, 95%);

  /* Settings */
  --settings-divider: hsl(25, 5%, 80%);

  /* Typography */
  --font-primary: 'Roboto', sans-serif;
  --font-monospace: 'Roboto Mono', monospace;

  /* Font Sizes (converted to px) */
  --font-smallest: 10.7px;
  --font-smaller: 12px;
  --font-small: 13.3px;
  --font-medium: 14.7px;
  --font-large: 16px;
  --font-larger: 18.7px;
  --font-largest: 24px;
  --font-banner: 32px;
  --font-banner-small: 42.7px;
  --font-banner-large: 64px;

  /* Spacing */
  --spacing-xs: 10px;
  --spacing-sm: 20px;
  --spacing-md: 30px;
  --spacing-lg: 50px;

  /* Radius */
  --radius-small: 5px;
  --radius-standard: 10px;

  /* Durations */
  --duration-quick: 30ms;
  --duration-standard: 200ms;
  --duration-medium: 300ms;
  --duration-slow: 500ms;
  --duration-cyclic: 1500ms;

  /* Easing */
  --easing-primary: cubic-bezier(0.45, 0, 0.55, 1);
  --easing-linear: linear;
}

[data-theme="dark"] {
  /* Dark Theme */

  /* Text Colors */
  --text-color: hsl(0, 0%, 85%);
  --text-muted: hsl(25, 5%, 50%);
  --text-opposite: hsl(25, 5%, 15%);
  --text-opposite-muted: hsl(25, 5%, 20%);
  --text-conversation-header: hsl(0, 0%, 75%);
  --text-settings-title: hsl(0, 0%, 85%);
  --text-styled: hsl(0, 0%, 75%);

  /* Background Colors */
  --bg-view: hsl(25, 5%, 23%);
  --bg-conversation: hsl(25, 5%, 5%);
  --bg-control: hsl(25, 5%, 10%);
  --bg-button: hsl(25, 5%, 30%);
  --bg-button-hover: hsl(25, 5%, 35%);
  --bg-selected: hsl(45, 100%, 40%);
  --bg-sources: hsl(25, 5%, 15%);
  --bg-sources-hover: hsl(25, 5%, 20%);
  --bg-attachment: hsl(25, 5%, 18%);
  --bg-collections-button: hsl(45, 100%, 30%);
  --bg-lighter-button: hsl(25, 5%, 25%);
  --bg-container: hsl(25, 5%, 10%);

  /* Border Colors */
  --border-divider: hsl(25, 5%, 30%);
  --border-control: hsl(25, 5%, 35%);
  --border-dialog: hsl(25, 5%, 35%);
  --border-button: hsl(25, 5%, 40%);

  /* Accent & Error */
  --accent-color: hsl(45, 100%, 50%);
  --error-color: hsl(0, 89%, 60%);

  /* Context Menu */
  --context-menu-frame: hsl(25, 5%, 35%);
  --context-menu-bg: hsl(25, 5%, 10%);
  --context-menu-highlight: hsl(45, 100%, 30%);

  /* Settings */
  --settings-divider: hsl(25, 5%, 30%);
}

[data-theme="legacy-dark"] {
  /* LegacyDark Theme (Blue-based) */

  /* Text Colors */
  --text-color: hsl(210, 50%, 83%);
  --text-muted: hsl(210, 50%, 60%);
  --text-opposite: hsl(210, 50%, 6%);
  --text-opposite-muted: hsl(210, 50%, 20%);
  --text-conversation-header: hsl(210, 50%, 75%);
  --text-settings-title: hsl(210, 50%, 83%);
  --text-styled: hsl(210, 50%, 75%);

  /* Background Colors */
  --bg-view: hsl(210, 50%, 50%);
  --bg-conversation: hsl(210, 50%, 58%);
  --bg-control: hsl(210, 50%, 53%);
  --bg-button: hsl(210, 50%, 6%);
  --bg-button-hover: hsl(210, 50%, 10%);
  --bg-selected: hsl(210, 50%, 70%);
  --bg-sources: hsl(210, 50%, 45%);
  --bg-sources-hover: hsl(210, 50%, 40%);
  --bg-attachment: hsl(210, 50%, 48%);
  --bg-collections-button: hsl(210, 50%, 65%);
  --bg-lighter-button: hsl(210, 50%, 55%);
  --bg-container: hsl(210, 50%, 53%);

  /* Border Colors */
  --border-divider: hsl(210, 50%, 40%);
  --border-control: hsl(210, 50%, 35%);
  --border-dialog: hsl(210, 50%, 35%);
  --border-button: hsl(210, 50%, 30%);

  /* Accent & Error */
  --accent-color: hsl(210, 50%, 70%);
  --error-color: hsl(0, 89%, 60%);

  /* Context Menu */
  --context-menu-frame: hsl(210, 50%, 35%);
  --context-menu-bg: hsl(210, 50%, 53%);
  --context-menu-highlight: hsl(210, 50%, 65%);

  /* Settings */
  --settings-divider: hsl(210, 50%, 40%);
}

/* Global Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-primary);
  color: var(--text-color);
  background-color: var(--bg-view);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideUp {
  from { transform: translateY(20px); }
  to { transform: translateY(0); }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes opacityCycle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1.0; }
}
```

#### Theme Provider Component

**components/theme-provider.tsx**

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'legacy-dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

#### Example Component Usage

**components/ui/button.tsx**

```typescript
import { forwardRef } from 'react';
import styles from './button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'text' | 'tool';
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${className || ''}`}
        role="button"
        aria-label={typeof children === 'string' ? children : undefined}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**components/ui/button.module.css**

```css
.button {
  padding: 10px 18px;
  min-height: 40px;
  background: var(--bg-button);
  color: var(--text-opposite);
  border: none;
  border-radius: var(--radius-standard);
  font-family: var(--font-primary);
  font-size: var(--font-large);
  font-weight: bold;
  text-align: center;
  cursor: pointer;
  transition: background var(--duration-standard) ease;
}

.button:hover:not(:disabled) {
  background: var(--bg-button-hover);
}

.button:disabled {
  background: var(--text-muted);
  color: var(--text-opposite-muted);
  cursor: not-allowed;
  opacity: 0.5;
}

.button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.button:active {
  transform: translateY(1px);
}

/* Variants */
.destructive {
  background: transparent;
  color: var(--error-color);
  border: 1px solid var(--error-color);
}

.destructive:hover:not(:disabled) {
  background: var(--error-color);
  color: var(--text-opposite);
}

.text {
  background: transparent;
  color: var(--accent-color);
  text-decoration: underline;
  padding: 5px 10px;
}

.text:hover {
  opacity: 0.8;
  text-decoration: none;
}

.tool {
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border-radius: var(--radius-small);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool:hover {
  background: var(--bg-lighter-button);
}
```

---

## Appendix

### QML to React Component Mapping

| QML Component | React/Next.js Equivalent | Library |
|--------------|--------------------------|---------|
| Rectangle | `<div>` | HTML |
| ColumnLayout | Flexbox (flex-direction: column) | CSS |
| RowLayout | Flexbox (flex-direction: row) | CSS |
| GridLayout | CSS Grid | CSS |
| ScrollView | `overflow-y: auto` | CSS |
| ListView | `.map()` with virtualization | react-window |
| TextField | `<input type="text">` | HTML |
| TextArea | `<textarea>` | HTML |
| Button | `<button>` | HTML |
| ComboBox | Select/Dropdown | Radix UI Select |
| CheckBox | Checkbox | Radix UI Checkbox |
| Dialog | Dialog | Radix UI Dialog |
| Popup | Portal | Radix UI Portal |
| TabButton | Tabs | Radix UI Tabs |
| Theme object | CSS Variables / Context | React Context |
| PropertyAnimation | CSS Transitions | CSS |
| ColorOverlay | SVG filter / CSS filter | CSS |
| Image | `<img>` | HTML |
| Text | `<span>` / `<p>` | HTML |

### Accessibility Checklist

- [ ] All interactive elements have proper ARIA roles
- [ ] All buttons have accessible names
- [ ] All form inputs have associated labels
- [ ] Keyboard navigation works for all interactions
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for dynamic content
- [ ] Skip navigation links for keyboard users
- [ ] Semantic HTML structure

### Performance Optimization Checklist

- [ ] Virtual scrolling for long lists (chat messages, model lists)
- [ ] Lazy loading for images and heavy components
- [ ] Code splitting for routes
- [ ] Memoization for expensive components (React.memo)
- [ ] Debouncing for text input
- [ ] Optimized images (WebP, proper sizing)
- [ ] CSS containment for isolated components
- [ ] Avoid layout thrashing (batch DOM reads/writes)

### Testing Recommendations

**Unit Tests:**
- Component rendering
- User interactions
- Theme switching
- State management

**Integration Tests:**
- Chat flow (send message, receive response)
- Model selection
- File attachments
- Collection management

**E2E Tests:**
- Complete user journeys
- Cross-browser compatibility
- Responsive behavior

**Accessibility Tests:**
- axe-core automated testing
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)

### Resources

**Design Source (GPT4All v3.10):**
- **GPT4All GitHub:** https://github.com/nomic-ai/gpt4all
- **QML Source Code:** https://github.com/nomic-ai/gpt4all/tree/main/gpt4all-chat/qml
- **Theme File:** https://raw.githubusercontent.com/nomic-ai/gpt4all/main/gpt4all-chat/qml/Theme.qml
- **Official Documentation:** https://docs.gpt4all.io

**Implementation Libraries:**
- **Radix UI:** https://www.radix-ui.com/
- **Tailwind CSS:** https://tailwindcss.com/
- **Framer Motion:** https://www.framer.com/motion/
- **Next.js 16:** https://nextjs.org/

**YouWorker Project:**
- **Repository:** youworker-fullstack
- **This document:** Design specification for YouWorker frontend

---

**End of Design Specification Guide**

*This guide provides complete design specifications for YouWorker's frontend, based on GPT4All v3.10.0's proven interface design. All measurements, colors, typography, spacing, and interactions have been documented from GPT4All's official QML source code and adapted for YouWorker.*

*This is a design reference document. The actual implementation will be branded as YouWorker with appropriate logo, naming, and branding changes.*