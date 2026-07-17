# Percentage sizing calculates against content-box, not border-box (learned while debugging SVG icon size)

> **Principle**: [Percentage sizing calculates against content-box, not border-box](principles.md#percentage-sizing-calculates-against-content-box-not-border-box)

## Problem

SVG icon inside overlay button rendered at 7.66px instead of expected 16px. Button was 25px, SVG had `width: 65%` — 65% of 25px should be 16.25px, but actual was 7.66px.

## Root causes

1. Button had `padding: 1px 6px` (from host CSS) + `box-sizing: border-box`.
2. With `border-box`, `width: 25px` includes border + padding. Content-box = 25 - 2*0.89 (border) - 2*6 (padding) = **10.94px**.
3. SVG `width: 65%` calculates against **containing block's content-box** (10.94px), NOT the element's border-box (25px).
4. 65% of 10.94px = 7.11px ≈ 7.66px measured (rounding + flex shrink).

CSS spec: percentage `width` on a flex item resolves against the flex container's **content box** (per CSS Flexible Box Layout §9.2). With `border-box` sizing, padding eats into the content area, so percentage children shrink proportionally.

## Fix

Set `padding: 0; box-sizing: border-box` on the button container. With zero padding, content-box = border-box = 25px → `width: 65%` = 16.25px as expected.

```css
/* Button container */
padding: 0;
box-sizing: border-box;

/* SVG child */
width: 65%;  /* now resolves against full 25px */
```

## Key insight

Percentage `width`/`height` on a child resolves against the parent's **content-box**, not border-box. If the parent has padding (especially horizontal padding like `1px 6px`), percentage children shrink unexpectedly — 12px of horizontal padding on a 25px button cuts the SVG nearly in half. This is invisible when the parent has `padding: 0`, which is why cluster buttons (CSS class with `padding: 0`) were unaffected while overlay buttons (inline style without `padding`) were. Always set `padding: 0` explicitly on percentage-sized containers, or use absolute units for the child.

## Verification

Edge DevTools MCP `evaluate_script` on themoviebox.org:

Before (`padding: 1px 6px`):
```
svgWidth: "7.65972px"  // 65% of 10.94px content-box
```

After (`padding: 0`):
```
svgWidth: "14.9097px"  // 65% of 22.94px content-box (25px - 2*0.89 border)
```

Matches cluster button SVG width (14.9097px) — confirmed identical render size across all overlay buttons.
