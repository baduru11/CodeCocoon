# CodeCocoon — Design System

---

## `app/globals.css` — Full File

```css
@import "tailwindcss";

@theme inline {
  /* === COLOR PALETTE === */
  --color-primary: #4F46E5;
  --color-primary-hover: #4338CA;
  --color-secondary: #0D9488;
  --color-secondary-hover: #0F766E;
  --color-accent-yellow: #F59E0B;
  --color-accent-green: #10B981;
  --color-accent-purple: #8B5CF6;
  --color-accent-orange: #F97316;
  --color-accent-pink: #F43F5E;

  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-foreground: #1E293B;
  --color-muted: #64748B;
  --color-border: #1E293B;

  /* === TYPOGRAPHY === */
  --font-heading: var(--font-space-grotesk);
  --font-body: var(--font-dm-sans);
  --font-mono: var(--font-geist-mono);

  /* === SHADOWS (neo-brutalist signature) === */
  --shadow-brutal-sm: 3px 3px 0px 0px #1E293B;
  --shadow-brutal: 4px 4px 0px 0px #1E293B;
  --shadow-brutal-lg: 6px 6px 0px 0px #1E293B;
  --shadow-brutal-xl: 8px 8px 0px 0px #1E293B;

  /* === BORDERS === */
  --radius-brutal: 8px;

  /* === SPACING === */
  --shadow-offset: 4px;
  --shadow-offset-sm: 3px;
}

/* === BASE STYLES === */
html { scroll-behavior: smooth; }

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-body), system-ui, sans-serif;
  font-weight: 400;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading), system-ui, sans-serif;
  font-weight: 700;
}

/* === SUBTLE DOT GRID BACKGROUND === */
.dot-grid {
  background-image: radial-gradient(circle, #CBD5E1 1px, transparent 1px);
  background-size: 24px 24px;
}

/* === NEO-BRUTALISM UTILITY CLASSES === */
.brutal-border { border: 2px solid var(--color-border); }
.brutal-border-thick { border: 3px solid var(--color-border); }
.brutal-shadow { box-shadow: var(--shadow-brutal); }
.brutal-shadow-sm { box-shadow: var(--shadow-brutal-sm); }
.brutal-shadow-lg { box-shadow: var(--shadow-brutal-lg); }
.brutal-shadow-xl { box-shadow: var(--shadow-brutal-xl); }

.brutal-hover { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.brutal-hover:hover { transform: translate(2px, 2px); box-shadow: none !important; }

.brutal-hover-reverse { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.brutal-hover-reverse:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-brutal-lg); }

/* === CODE BLOCKS === */
.code-block pre {
  border: 2px solid var(--color-border) !important;
  border-radius: var(--radius-brutal) !important;
  box-shadow: var(--shadow-brutal-sm) !important;
}

/* Force code block content to wrap */
.code-block-wrap pre,
.code-block-wrap pre code,
.code-block-wrap pre code span {
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}

/* === SCROLLBAR STYLING === */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--color-background); }
::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

/* === TEXT SELECTION === */
::selection { background: var(--color-accent-yellow); color: var(--color-foreground); }

/* === ANIMATIONS === */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-brutal {
  0%, 100% { box-shadow: var(--shadow-brutal); }
  50% { box-shadow: var(--shadow-brutal-lg); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-slide-up { animation: slideUp 0.4s ease-out forwards; }
.animate-slide-in { animation: slideIn 0.4s ease-out forwards; }

/* Uses CSS custom property --delay for staggered animations */
.animate-fade-in {
  opacity: 0;
  animation: fadeIn 0.5s ease-out forwards;
  animation-delay: var(--delay, 0ms);
}

.animate-pulse-brutal { animation: pulse-brutal 2s ease-in-out infinite; }
.animate-blink { animation: blink 1s step-end infinite; }

/* === PROGRESS BAR STRIPES === */
.progress-stripes {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%,
    rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%,
    transparent 75%, transparent
  );
  background-size: 16px 16px;
  animation: shimmer 1s linear infinite;
}

/* === REDUCED MOTION === */
@media (prefers-reduced-motion: reduce) {
  .animate-slide-up, .animate-slide-in, .animate-fade-in,
  .animate-pulse-brutal, .animate-blink {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .progress-stripes { animation: none; }
  html { scroll-behavior: auto; }
}
```

---

## Neo-Brutalist Pattern (Applied Everywhere)

### The Signature Effect
```
1. border-2 border-foreground          → solid 2px dark border
2. shadow-[3px_3px_0px_0px_#1E293B]   → offset box shadow (no blur)
3. On hover:
   - translate-x-[2px] translate-y-[2px]  → shift toward shadow
   - shadow-none                           → shadow disappears (creates "press" effect)
```

### Tailwind Inline Classes Used
```
shadow-[3px_3px_0px_0px_#1E293B]    → sm brutal shadow (3px)
shadow-[4px_4px_0px_0px_#1E293B]    → default brutal shadow (4px)
shadow-[6px_6px_0px_0px_#1E293B]    → lg brutal shadow (6px)

hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none
active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
```

### Card Variant (lighter border)
```
border-2 border-foreground/15 rounded-xl shadow-sm
```

---

## Typography

| Role | Font | Variable |
|------|------|----------|
| Headings (h1-h6) | Space Grotesk | `--font-space-grotesk` |
| Body text | DM Sans | `--font-dm-sans` |
| Code / monospace | Geist Mono | `--font-geist-mono` |

**Font weights**: headings = 700, body = 400 (components use `font-medium` = 500, `font-bold` = 700)

---

## Color System

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | #4F46E5 | CTAs, links, primary actions |
| `primary-hover` | #4338CA | Primary button hover |
| `secondary` | #0D9488 | Secondary actions, success-adjacent |
| `secondary-hover` | #0F766E | Secondary button hover |
| `accent-yellow` | #F59E0B | Warnings, badges, highlights |
| `accent-green` | #10B981 | Success states |
| `accent-purple` | #8B5CF6 | Special, exercises |
| `accent-orange` | #F97316 | Danger/caution |
| `accent-pink` | #F43F5E | Rare use, decorative |
| `background` | #F8FAFC | Page background |
| `surface` | #FFFFFF | Card backgrounds |
| `foreground` | #1E293B | Text, borders |
| `muted` | #64748B | Secondary text |
| `border` | #1E293B | (same as foreground) |

---

## Animation Classes

| Class | Keyframe | Duration | Notes |
|-------|----------|----------|-------|
| `animate-slide-up` | slideUp | 0.4s | y+20 → 0, opacity 0→1 |
| `animate-slide-in` | slideIn | 0.4s | x-20 → 0, opacity 0→1 |
| `animate-fade-in` | fadeIn | 0.5s | y+10 → 0, uses `--delay` CSS var |
| `animate-pulse-brutal` | pulse-brutal | 2s infinite | shadow alternates brutal/brutal-lg |
| `animate-blink` | blink | 1s infinite | opacity 1→0→1 step |
| `progress-stripes` | shimmer | 1s infinite | diagonal stripe movement |

### Staggered Animations
Used in Hero and Features sections with inline style:
```tsx
style={{ "--delay": "200ms" } as React.CSSProperties}
className="animate-fade-in"
```

---

## Component Style Tokens

### Rounded Corners
- Cards, inputs, menus: `rounded-xl` (12px)
- Buttons, badges, small elements: `rounded-lg` (8px)
- Avatars, circular: `rounded-full`

### Spacing Scale (common patterns)
- Card padding: `p-6`
- Card header: `p-6 pb-0`
- Button sizes: `px-3 py-1.5` (sm), `px-5 py-2.5` (md), `px-7 py-3` (lg)
- Gap between items: `gap-2`, `gap-3`, `gap-4`

### Section Layout
- Max width: `max-w-4xl mx-auto px-4` (forms), `max-w-6xl mx-auto px-4` (grids), `max-w-7xl mx-auto px-4` (navbar/footer)
- Section padding: `py-12` (pages), `py-24` (landing sections)

---

## Special CSS Classes

### `.dot-grid`
Used in Hero and Features section backgrounds:
```css
background-image: radial-gradient(circle, #CBD5E1 1px, transparent 1px);
background-size: 24px 24px;
```

### `.code-block` and `.code-block-wrap`
Applied to `<CodeBlock>` component wrapper div. Gives the `pre` element brutal border/shadow. `code-block-wrap` forces text wrapping for long lines.

### `.progress-stripes`
Applied to progress bar fill elements. Creates animated diagonal stripe overlay on top of the `bg-*` color class.

---

## Background Patterns

### Landing Page Sections
```tsx
// Dot grid (Hero + Features)
<div className="absolute inset-0 dot-grid opacity-40" />
<div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />

// Solid section bg (HowItWorks)
<section className="py-24 bg-surface border-y-2 border-foreground/10">
```

---

## Icon System

All icons from `lucide-react`. Common icon sizes:
- Inline text: `size={14}`, `size={16}`
- Card icons: `size={20}`, `size={24}`
- Hero/section icons: `size={28}`, `size={32}`, `size={40}`
- Empty states: `size={48}`

`strokeWidth` defaults to 2 for most. Some icons use `strokeWidth={2.5}` or `strokeWidth={3}` for bolder look.

---

## Form Elements

### Input
```
border-2 border-foreground/20 rounded-lg
focus:border-primary focus:ring-2 focus:ring-primary/20
transition-colors
```

### Checkbox-style buttons (file selection)
```
CheckSquare / Square icons from lucide-react
Green (accent-green) when selected, gray (muted) when not
```

### Select/Dropdown Buttons
```
inline, styled as pill buttons
border-2 rounded-xl font-bold
Active: border-foreground + shadow, Inactive: border-foreground/15
```
