# Motion Audit — 8 Categories

## Core Rule

**Motion is a risk, not a feature.** Add it only when the page would feel broken without it.

## Step 1: Classify by Frequency

Before judging any animation, decide how often the user sees it.

| Frequency | Decision |
|---|---|
| 100+ times/day (keyboard, command palette, list nav) | **No animation. Ever.** |
| Tens of times/day (hover, small toggles) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare / first-time (onboarding, success, celebration) | Can add delight |

## Step 2: Audit the 8 Categories

### 1. Purpose

Ask for every transition: **"If I remove this animation, what do I lose?"**

Valid purposes: spatial consistency, state indication, feedback, explanation, preventing jarring change.

If the answer is only "it looks premium", delete it.

### 2. Easing & Duration

**Easing decision tree:**

- Entering or exiting → `ease-out`
- Moving on screen → `ease-in-out`
- Hover / color → `ease`
- Constant motion → `linear`
- Default → `ease-out`

**`ease-in` on UI is always a finding.** It starts slow, which feels unresponsive.

**Use strong custom curves as tokens:**

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

**Duration budget (UI under 300ms):**

| Element | Duration |
|---|---|
| Button press | 100–160ms |
| Tooltip / small popover | 125–200ms |
| Dropdown / select | 150–250ms |
| Modal / drawer | 200–500ms |
| Marketing / explanation | Can be longer, but justify |

### 3. Physicality & Origin

- Never `scale(0)`. Start from `scale(0.9–0.97)` + `opacity: 0`.
- Press feedback: `transform: scale(0.97)`, 160ms `ease-out`.
- Popovers/ dropdowns / tooltips scale from their trigger, not center.
- Modals keep `transform-origin: center`.

### 4. Interruptibility

- Use CSS transitions for rapidly triggered UI.
- Use springs for gestures.
- Spring default: `{ type: "spring", duration: 0.5, bounce: 0.2 }`.
- Bounce 0.1–0.3 only; reserve for drag-to-dismiss or playful moments.
- Asymmetric timing: press/hold slower, release faster.

### 5. Performance

- Animate only `transform` and `opacity`.
- `transition: all` is a finding.
- Avoid animating `width`, `height`, `margin`, `padding`, `top`, `left`.
- Blur under 20px; never on scrolling containers.

### 6. Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .element { animation: fade 0.2s ease; /* keep opacity/color, drop movement */ }
}

@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); }
}
```

### 7. Cohesion & Tokens

- Motion must match product personality.
- Curves and durations should be shared tokens.
- Stagger group entrances with 30–80ms between items.
- Crossfade with subtle `filter: blur(2px)` if states visibly overlap.

### 8. Missed Opportunities

Where a brief transition would prevent a jarring change:

- State changes that teleport.
- Panels that appear without origin motion.
- Rare high-emotion moments.
- Use `translateY(100%)` and `clip-path: inset()` — no hardcoded pixels.

## Quick Review Checklist

| Issue | Fix |
|---|---|
| `transition: all` | Specify exact properties |
| `scale(0)` entry | Start from `scale(0.95)` + opacity |
| `ease-in` on UI | Switch to `ease-out` or custom curve |
| `transform-origin: center` on popover | Set to trigger |
| Animation on keyboard action | Remove |
| Duration > 300ms on UI | Reduce |
| Hover animation without media query | Add `@media (hover: hover)` |
| Keyframes on rapidly triggered element | Use CSS transitions |
| Same enter/exit speed | Make exit faster |
| Elements all appear at once | Add 30–80ms stagger |
