# Showcase Gallery — Dark Mode Redesign Brief

## 1. Page Identity

- Page name: Design System Showcase (`ShowcaseGallery.tsx`)
- Page kind: app / dashboard
- Primary device context: desktop-first, responsive down to 320px
- Design Read: The dark-mode showcase feels muddy and flat because glass surfaces inherit the preset's dark surface without enough luminance separation, the CTA lacks a focal point, and the background has no ambient depth.

## 2. 3 Dials

| Dial | Value | Evidence |
|---|---|---|
| DESIGN_VARIANCE | 6 | Reference `liquid-glass-warmth.html` uses warm gradient, tinted glass, strong inner highlight, and a filled primary CTA — the current showcase is more neutral and flat. |
| MOTION_INTENSITY | 3 | Keep existing press scale and hover lift; no new motion needed. |
| VISUAL_DENSITY | 5 | Same information density; goal is clearer depth layers, not more content. |

## 3. ASCII Wireframes

### 1280px

```text
+-------------------------------------------------------------+
|  [topbar glass pill]                                        |
+-------------------------------------------------------------+
| +-----------+ +-------------------------------------------+ |
| | sidebar   | | preview card (glass)                      | |
| | glass     | | +---------------------------------------+ | |
| |           | | | header (glass) | Badge                | | |
| | tree      | | +---------------------------------------+ | |
| |           | | | stage (surface-elevated)                | | |
| |           | | |  [CTA] [Accent] [Secondary] ...         | | |
| |           | | |                                         | | |
| | result    | | |  [Card] [Card] [Selected] ...           | | |
| +-----------+ | +-----------------------------------------+ |
+---------------+---------------------------------------------+
```

### 320px

```text
+-----------------+
|  [topbar pill]  |
+-----------------+
|  [sidebar]      |
+-----------------+
|  [preview card] |
|  [stage]        |
+-----------------+
```

## 4. Inventories

### Functions

- Browse design-system components by level/category.
- Switch theme (light/dark) and preset (dawn/forest/ocean/warmth).
- Preview a selected component in a canvas.

### States

- Light / dark.
- Preset switch (re-tints the whole page).
- Tree expanded/collapsed.
- Active component selected.
- Hover/pressed/focused on buttons and cards.

### Components

| Element | Current | Decision | Notes |
|---|---|---|---|
| Topbar | Glass pill | Keep & refine | Add inner highlight, stronger blur. |
| Sidebar | Glass card | Keep & refine | Same glass treatment, active item uses primary-subtle. |
| Preview card | Glass + stage | Refine | Remove double-border feel; stronger glass inner highlight. |
| Stage | `surface-elevated` flat | Keep, maybe subtle radial gradient | Must keep component canvas distinct from card. |
| CTA button | Glass neutral | Change to filled primary + dark text | Matches `liquid-glass-warmth` reference, keeps primary as focal point. |
| Secondary button | `surface-elevated` | Change to glass | Looks better against dark stage. |
| Accent button | primary-subtle | Keep | Primary as small accent. |
| Card default | `surface` | Keep | Slight lift on hover. |
| Card glass | `color-glass-surface` | Keep | Add inner highlight. |
| Card selected | primary border + subtle | Keep | Slight shadow. |

### Tokens Used / Missing

- Used: `--color-background`, `--color-surface-elevated`, `--color-glass-surface`, `--color-glass-border`, `--color-glass-border-subtle`, `--color-primary`, `--color-primary-foreground`, `--color-primary-subtle`, `--color-text-accent`.
- Missing / need review: gradient background is not a token; implemented in CSS. `--color-glass-border-subtle` opacity may be too low in dark for the inner highlight to read as glass.

## 5. Findings: Current → Proposed → Risk

| Finding | Current | Proposed | Risk | Priority | Principle |
|---|---|---|---|---|---|
| Background is not liquid | `var(--color-background)` solid dark | Body background = gradient + 3 large `color-mix` radial blobs using only `var(--color-primary)` / `var(--color-primary-hover)` + fixed attachment; preview card becomes `glass-liquid` (`color-mix(glass, transparent 55%)` + `blur-xl`) | Monochrome liquid may feel too uniform if only one shade; use `primary-hover` to create tonal variation | P0 | Depth / layering / brand feel |
| Glass lacks highlight | `inset 0 1px 0 rgba(255,255,255,0.04)` | `inset 0 1px 0 rgba(255,255,255,0.08-0.12)` for dark; light keeps strong inner highlight | Too strong can look like a border | P1 | Material / glass feel |
| CTA lacks focal point | Glass neutral | Filled primary with `color-primary-foreground` (dark) text | Could conflict with "primary only accent" rule; resolve by limiting filled primary to one CTA per view | P0 | Visual hierarchy / focus |
| Glass surface too cool for some presets | `rgba(22,38,55,0.82)` for dawn dark | Keep `color-glass-surface` token (already derived from preset surface); use `glass-liquid` only for large preview canvas, keep denser panels at token opacity | Over-opacity reduces glass effect | P1 | Color harmony |

## 6. What to Keep

- Pill-shaped topbar, sidebar, and buttons.
- Backdrop-filter glass layers.
- Tree navigation and preview layout.
- Low-density, breathable spacing.
- Existing motion (press scale, hover lift).

## 7. What to Reject

- Fully neutral CTA: the page needs one high-contrast focal action.
- Flat, single-color background in dark mode: it kills depth.
- Tiny inner highlight: it makes glass look like a flat tinted box.

## 8. Responsive Behavior

- 320px: topbar becomes compact, sidebar stacks above viewport, preview card full width.
- 768px: sidebar collapses to top sheet or stays narrow.
- 1024px+: two-column layout, topbar pill.
- 1280px: comfortable two-pane, max preview width.
- 1920px: centered, constrained max-width, large blobs.

## 9. Motion Plan

| Element | Trigger | Animation | Tokens | Reduced Motion |
|---|---|---|---|---|
| Button hover | pointerenter | translateY(-1px), shadow grow | `var(--ease-out)`, 180ms | none |
| Button press | pointerdown | translateY(0) scale(0.98) | `var(--ease-out)`, 100ms | none |
| Card hover | pointerenter | translateY(-2px), shadow grow | `var(--ease-out)`, 180ms | none |
| Theme/preset switch | state change | CSS transition on `background`, `color` | `var(--transition)` | none |

## 10. Accessibility Notes

- Contrast: primary foreground text on primary background must be WCAG AA; tokens already compute `color-text-on-primary`.
- Focus: `box-shadow: var(--shadow-focus)` on interactive elements.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables transforms/animations.
- Touch targets: all buttons/cards meet `var(--touch-target)`.

## 11. Technical Feasibility

| Proposal | New deps? | Bundle impact? | SSR/Shadow DOM safe? | Notes |
|---|---|---|---|---|
| Gradient background | No | None | Yes | CSS only |
| Stronger glass inner highlight | No | None | Yes | Token or CSS only |
| Filled primary CTA | No | None | Yes | Reuse `Button.primary` with `color-primary-foreground` |
| Ambient blobs | No | None | Yes | `position: fixed`, low count, no animation |

## 12. Implementation Priority

- **P0**: Liquid background — radial `color-mix` blobs + `glass-liquid` preview.
- **P0**: CTA — filled primary + dark text.
- **P1**: Glass inner highlight + frosted secondary buttons.
- **P2**: Ambient blob placement and `background-attachment: fixed` performance review.

## 13. Confirmation Question

> Brief này có đúng cảm giác anh muốn không?

Options:
- A. Đúng, triển khai P0 + P1
- B. Gần đúng, chỉnh lại...
- C. Sai hướng, quay lại Step 1
