# Inline style leak across toggle cycle (learned while fixing subtitle panel video jump)

> **Principle**: [Inline style leak across state transitions → every set must have matching remove](principles.md#inline-style-leak-across-state-transitions--every-set-must-have-matching-remove)

## Problem

After toggling the subtitle panel open then close, the video jumped outside its container:
- `videoRect.left = -247` (negative, off-screen left)
- `videoRect.top = -111` (negative, off-screen top)
- Video width/height correct (823×463) but position wrong — `transform: translate(-50%, -50%)` shifted it by half its own size

On fresh page load (no toggle), video was correct. The bug only appeared after open→close cycle.

## Root causes

`applyAbsoluteDockedLayout` (show path) sets inline styles with `!important` to center the video inside the 70% wrapper:

```typescript
video.style.setProperty('position', 'absolute', 'important');
video.style.setProperty('left', '50%', 'important');
video.style.setProperty('top', '50%', 'important');
video.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
video.style.setProperty('object-fit', 'contain', 'important');
// ... width, height, max-width, max-height, min-width, min-height
```

`hidePanelDocked` (hide path) removed position/left/top/right/bottom/width/height/max-width/max-height/min-width/min-height — but **did NOT remove `transform` or `object-fit`**. After close:
- `transform: translate(-50%, -50%) !important` persisted → video shifted by -50% of its own width/height
- `object-fit: contain !important` persisted → not harmful alone, but inconsistent with art-player's `cover` default

Additionally, a `MutationObserver` guard (`startVideoStyleGuard`) re-applied the `!important` styles whenever the video's `style` attribute changed. Removing styles without stopping the observer first was futile — they came back within milliseconds.

## Fix

In `hidePanelDocked` (`src/content/subtitleDocking.ts`):

```typescript
// Must also clear transform + object-fit: applyAbsoluteDockedLayout sets them
// with !important to center the video inside the 70% wrapper. If left behind,
// translate(-50%, -50%) pushes the video out of the full-width wrapper.
video.style.removeProperty('transform');
video.style.setProperty('object-fit', 'contain', 'important'); // keep contain, not cover
```

Also in `createDockingWrapper`: force `object-fit: contain !important` on initial setup so art-player's `cover` default doesn't crop ultra-wide videos.

## Key insight

Every `setProperty(prop, value, 'important')` in a show/apply path MUST have a corresponding `removeProperty(prop)` (or explicit reset) in the hide/restore path. `!important` styles survive across state transitions — the browser does not auto-clean them. Audit: `grep setProperty.*important` → verify each has a matching `removeProperty` in the restore path. If a `MutationObserver` re-applies styles, stop the observer BEFORE removing styles, otherwise it re-applies them immediately.

## Verification

Browser-verified via Edge DevTools MCP on themoviebox.org:

| State | videoTransform | videoInline | videoFillsF0 |
|---|---|---|---|
| Fresh load | `none` | `(none)` | ✓ (756×425 = F0) |
| Toggle open | `translate(-50%,-50%)` | has transform | — (529px, 70%) |
| Toggle close | `none` | `(none)` | ✓ (756×425 = F0) |

Subagent visual check confirmed: full picture visible, letterbox 54px top/bottom, controls aligned, no glitches.

Unit tests: 11/11 passed (`subtitleDocking.test.ts`).
