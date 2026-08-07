# Plan 001 — UniversalPanel close: kill the blink, snappy exit

Stamp: `572126f2`
Scope: `src/features/universalPanel/UniversalPanel.tsx` + `UniversalPanel.module.css` only.

## Problem

Clicking `universal-panel-close` flashes the full panel ("giãn như chớp mắt") then fades slowly (~975ms).

Root cause:
1. **Remount blink.** `isClosing` is set in `useEffect` (runs *after* render). The render where `isOpen` flips `false` still has `isClosing=false` → `if (!isOpen && !isClosing) return null` unmounts the node. The effect then sets `isClosing=true` → remounts with `.close` → keyframe restarts from `scale(1) opacity(1)` = full-panel flash before fade.
2. **Slow exit.** `.close` uses `--duration-slow` (975ms) + `--ease-in-out` (on-screen curve). Exits must be faster than entrances and use a strong ease-out.
3. **Backdrop snap.** `.overlay` has no close animation; it stays opaque then unmounts in one frame = a second blink.

## Fix

### A. `UniversalPanel.tsx` — keep mounted through close (no remount)

Add `wasOpenRef.current` to the render guard so the panel never unmounts during the one-render gap between `isOpen` flipping false and `isClosing` being set:

```tsx
// Keep mounted through the close animation. Without the wasOpenRef term,
// the render where isOpen flips false (isClosing not set yet) returns null,
// unmounting the node; the effect then remounts it with .close, flashing
// the full panel before it fades.
const shouldRender = isOpen || isClosing || wasOpenRef.current;

if (!shouldRender) return null;

const panelClass = `${styles.panel} ${isOpen ? styles.open : styles.close}`.trim();
const overlayClass = isOpen ? styles.overlay : `${styles.overlay} ${styles.overlayClosing}`.trim();
```

Apply `overlayClass` to the overlay div (replaces `className={styles.overlay}`).

### B. `UniversalPanel.module.css` — snappy, single-action close

```css
.close {
  animation: scale-out var(--duration-normal) var(--ease-standard) both;
}

.overlayClosing {
  animation: overlay-fade-out var(--duration-normal) var(--ease-standard) both;
}

@keyframes scale-out {
  from { transform: scale(1); }
  to   { transform: scale(0.96); }
}

@keyframes overlay-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
```

- `--duration-normal` = 200ms (was 975ms). Exit faster than entry — correct.
- `--ease-standard` = cubic-bezier(0.24,1,0.4,1) strong ease-out (was `--ease-in-out`).
- `scale(0.96)` readable shrink (was 0.98). No `scale(0)`.
- Panel `scale-out` is **transform-only** (no opacity) — the overlay's `overlay-fade-out` drives the fade for both backdrop and panel together, avoiding double-fade and the backdrop snap.
- `.open` synced to `--duration-normal` (200ms) + `--ease-standard` — open and close share one duration/easing for cohesion.

`prefers-reduced-motion` block already nukes `.overlay` + `.panel` animation — covers `.overlayClosing`? No: it targets `.overlay` and `.panel` by class, and `.overlayClosing` is a separate class on the same overlay element. Add `.overlayClosing` to the reduced-motion selector.

## Verification

- `npm run typecheck`, `npm run test:unit` (existing close/backdrop/Escape tests must pass; "renders nothing when closed" still passes because `wasOpenRef` initializes to `isOpen`=false).
- `npm run build`.
- Feel-check in Chrome (stealth MCP): open via `orbital-badge-button`, close via `universal-panel-close`. Expect ONE clean action: panel scales down + backdrop fades together over ~200ms, no full-panel flash, no backdrop snap. Slow-mo via DevTools animations panel if needed.
