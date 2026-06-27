# Out-of-flow video wrapper collapse (learned while fixing subtitle panel video disappear on page load)

> **Principle**: [Out-of-flow element needs explicit containing block → fill 100% of original box](principles.md#out-of-flow-element-needs-explicit-containing-block--fill-100-of-original-box)

## Problem

On page load (panel closed), the video was not filling its F0 container:
- `videoRect.width = 0`, `videoRect.height = 0` — video invisible
- Or video positioned at wrong coordinates, not matching F0 box

The video element was `position: absolute` (art-player's default), taken out of normal flow.

## Root causes

`createDockingWrapper` moves the video into a new wrapper hierarchy:

```
F0 (div.w-[75%], position: static)
  └── outerWrapper (position: absolute, width: 100%, height: 100%)
      └── videoWrapper (position: static, width: auto, height: auto)
          └── video (position: absolute, art-player default)
```

Two problems:

1. **F0 was `position: static`** → `outerWrapper` (absolute) positioned against a wider ancestor, not F0. `outerWrapper` overflowed F0.

2. **videoWrapper had no explicit width/height** → since the video is `position: absolute` (out-of-flow), it contributes no height to `videoWrapper`. The wrapper collapsed to `height: 0`, making the video invisible on page load (before the panel was ever toggled).

## Fix

In `createDockingWrapper` (`src/content/subtitleDocking.ts`):

```typescript
// F0 must be a positioned containing block for absolute outerWrapper
if (f0 && getComputedStyle(f0).position === 'static') {
  f0.style.position = 'relative';
}

// Out-of-flow video: wrapper collapses to height 0 without explicit size
if (isOutOfFlowVideo(video)) {
  outerWrapper.style.position = 'absolute';
  outerWrapper.style.width = '100%';
  outerWrapper.style.height = '100%';
  outerWrapper.style.top = '0';
  outerWrapper.style.left = '0';
  videoWrapper.style.width = '100%';
  videoWrapper.style.height = '100%';
}
```

In `hidePanelDocked`: keep `outerWrapper` as `position: absolute; width: 100%; height: 100%` for out-of-flow video (don't reset to `static` — that collapses height back to 0).

## Key insight

When moving an out-of-flow element (`position: absolute/fixed`) into a new wrapper, the wrapper does NOT inherit the element's size — absolute elements contribute no height to their containing block. The wrapper must have explicit `width: 100%; height: 100%` to match the original box. Additionally, the original container must become a positioned containing block (`position: relative`) so the absolute wrapper fills the right box, not a wider ancestor. This applies on initial setup AND on every restore path — resetting wrapper to `static` collapses it again.

## Verification

Browser-verified via Edge DevTools MCP on themoviebox.org:

| Measurement | Before fix | After fix |
|---|---|---|
| F0 position | `static` | `relative` |
| outerWrapper | overflowed F0 | `100% × 100%` of F0 |
| videoWrapper height | `0` (collapsed) | `100%` of F0 |
| videoRect (fresh load) | `0 × 0` (invisible) | `756 × 425` = F0 ✓ |

Polled 15 seconds after fresh reload: panel stayed `display: none`, video stayed `756×425` — stable, no collapse.

Unit tests: 11/11 passed (`subtitleDocking.test.ts`).
