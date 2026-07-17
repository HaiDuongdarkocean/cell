# Flex min-width: auto overflow in docked subtitle panel

> **Principle**: [Flex items need explicit min-width: 0 / min-height: 0 to shrink below content](principles.md#flex-items-need-explicit-min-width-0--min-height-0-to-shrink-below-content)

## Problem

When the subtitle panel opened in docked mode, the video + panel flex row overflowed the right edge of the F0 container. The panel visually extended past the video boundary, and the two flex items together were wider than the F0 box.

Browser evidence before fix:

- F0 width: 820px
- playerContainer width: 574px (70% of F0)
- panel width: 324px (39.5% of F0, not 30%)
- panel right edge: 1062px
- F0 right edge: 984px
- panel overflow: ~78px

## Root causes

`showPanelDocked` created a flex row with:

- `playerContainer` = `flex: 0 0 70%` + `min-width: 0`
- `panel` = `flex: 0 0 30%` + **no explicit min-width**

CSS flex items default to `min-width: auto` (content-based). The panel contained subtitle cue text with timestamps. When the natural width of that content exceeded 30% of F0, the panel refused to shrink below its content width, pushing itself and the video beyond the container.

Code path: `src/content/subtitleDocking.ts` → `showPanelDocked()`.

## Fix

In `showPanelDocked`:

- Add `panel.style.minWidth = '0'` so the panel respects `flex-basis: 30%`.
- Add `panel.style.minHeight = '0'` for the mobile stacked layout.
- Add `panel.style.overflow = 'hidden'` to clip any residual long words.
- Add `box-sizing: border-box` to F0, playerContainer, and panel so padding/borders are counted inside the width budget.

In `hidePanelDocked`:

- Reset `minWidth`, `minHeight`, `overflow`, and `boxSizing` to restore the floating panel state.

## Key insight

`flex: 0 0 <percentage>` only guarantees the starting size. Without `min-width: 0` / `min-height: 0`, the browser's default intrinsic minimum sizing prevents flex items from shrinking below their content, breaking percentage layouts.

## Verification

- Inline browser fix (Edge DevTools MCP):
  - panel width: 324px → 246px (exactly 30% of 820px)
  - panel right edge: 1062px → 984px (aligned with F0)
  - overflow: false
- Unit tests: `subtitleDocking.test.ts` updated to assert `minWidth: 0`, `overflow: hidden`, `boxSizing: border-box`.
- All tests: 1095/1095 passed.
- Build + tsc passed.

## Related files

- `src/content/subtitleDocking.ts`
- `tests/unit/subtitleOverlay/subtitleDocking.test.ts`
