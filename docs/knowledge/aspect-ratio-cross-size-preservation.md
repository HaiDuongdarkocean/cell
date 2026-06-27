# Aspect-ratio cross-size preservation when docking subtitle panel

> **Principle**: [Preserve cross-axis size when aspect-ratio conflicts with layout change](principles.md#preserve-cross-axis-size-when-aspect-ratio-conflicts-with-layout-change)

## Problem

When the subtitle panel opened in docked mode, the video height shrank along with its width. The user expected the panel to sit beside the video while the video kept its original height.

Before fix:

- Original playerContainer height: 453.25px
- After opening panel: height dropped because the width was reduced to 70%

## Root causes

`showPanelDocked` reduced `playerContainer` width to 70% via `flex: 0 0 70%`. The site's player wrapper (`.artplayer-app` / `.art-video-player`) has CSS `aspect-ratio` to maintain a 16:9 box. When the width shrank, the browser automatically shrank the height proportionally to preserve the ratio.

Code path: `src/content/subtitleDocking.ts` → `showPanelDocked()`.

## Fix

1. Record F0's natural height before applying flex layout.
2. Set `f0.style.height` to that recorded value so the flex container has a definite cross-axis size.
3. Set `playerContainer.style.height = '100%'` and override `aspect-ratio: auto !important` so the player fills the preserved height instead of recomputing it from the reduced width.
4. Set `panel.style.height = '100%'` so it stretches to the same height as the video.

In `hidePanelDocked`:

- Reset `f0.style.height`, `playerContainer.style.height`, and `playerContainer.style.aspectRatio`.

## Key insight

`aspect-ratio` creates an intrinsic cross-axis size that fights your layout intent when you change the main-axis size. To keep the element's original height, either preserve the container's cross-axis size and override the element's aspect-ratio, or accept proportional scaling.

## Verification

- Inline browser fix (Edge DevTools MCP):
  - F0 height: 453.25px → 453.25px (unchanged)
  - playerContainer height: 453.25px (preserved)
  - panel height: 453.25px (matches video)
  - panel width: 30% of F0
  - no overflow
- Unit tests: `subtitleDocking.test.ts` updated to assert F0 height, playerContainer height, and aspect-ratio override.
- All tests: 1095/1095 passed.
- Build + tsc passed.

## Related files

- `src/content/subtitleDocking.ts`
- `tests/unit/subtitleOverlay/subtitleDocking.test.ts`
