/**
 * CSS for the orbital dictionary badge.
 *
 * Rendered inside a Shadow DOM. tokens.css is injected with :root remapped to
 * :host; theme is driven by a data-theme attribute set on the badge container
 * so [data-theme="dark"] selectors in tokens.css cascade.
 */

export const ORBITAL_BADGE_STYLE_ID = 'cell-orbital-badge-style';

export function buildOrbitalBadgeCss(): string {
  return `
:host {
  font-family: var(--font-family, sans-serif);
}

/* Zero-size host that still establishes the top-most stacking context. */
.cell-orbital-badge-host {
  position: fixed !important;
  left: 0 !important;
  top: 0 !important;
  width: 0 !important;
  height: 0 !important;
  z-index: 2147483647 !important;
  pointer-events: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
}

/* Inner container that holds both badge and pointer. We set data-theme here. */
.cell-orbital-badge-root {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: 0 !important;
  height: 0 !important;
}

/* The draggable badge. Starts with its center on the right viewport edge so
   the viewport clips it to a half-moon/crescent. Dragging pulls it inward and
   reveals the full circle. pointer-events: auto so it can receive drag/tap events. */
.cell-orbital-badge {
  position: fixed !important;
  width: var(--badge-size, var(--space-9)) !important;
  height: var(--badge-size, var(--space-9)) !important;
  box-sizing: border-box !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 50% !important;
  background: var(--color-primary) !important;
  color: var(--color-primary-foreground) !important;
  cursor: grab !important;
  pointer-events: auto !important;
  touch-action: none !important;
  outline: none !important;
  box-shadow: none !important;
  z-index: 2147483647 !important;
  transform: translate(-50%, -50%) !important;
  transition: transform var(--duration-normal) ease, background-color var(--duration-normal) ease, width var(--duration-normal) ease, height var(--duration-normal) ease !important;
  /* will-change promotes the badge to its own compositor layer so repositioning
     (left/top on a position:fixed element) is cheaper — the layer is moved on
     the compositor instead of re-laying out the host page. One 36px layer is
     negligible memory. */
  will-change: transform !important;
}

.cell-orbital-badge:active {
  cursor: grabbing !important;
}

/* Peek mode — when the pointer preset is 'center', the tip sits inside the
   badge. Make the badge translucent + faint border so the user can see the
   text under it for easier lookup. The pointer also becomes translucent so
   the text under the tip is visible for lookup. */
.cell-orbital-badge--peek {
  background: transparent !important;
  border: var(--border-width-hairline) solid color-mix(in srgb, var(--color-primary) 40%, transparent) !important;
}

/* Pointer in peek mode: translucent so text under the tip is visible.
   Badge and pointer are siblings inside .cell-orbital-badge-root. */
.cell-orbital-badge--peek + .cell-orbital-pointer {
  background: color-mix(in srgb, var(--color-text-inverse) 20%, transparent) !important;
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent) !important;
}

/* The "moon" pointer orbiting the badge. pointer-events: none so it never
   blocks document hit-testing at its tip. When collapsed, it is centered
   inside the visible half-moon so it is not clipped by the viewport edge. */
.cell-orbital-pointer {
  position: fixed !important;
  width: var(--pointer-size, calc(var(--badge-size, var(--space-9)) * 0.25)) !important;
  height: var(--pointer-size, calc(var(--badge-size, var(--space-9)) * 0.25)) !important;
  box-sizing: border-box !important;
  border-radius: 50% !important;
  background: var(--color-text-inverse) !important;
  border: var(--space-0-5) solid var(--color-primary) !important;
  padding: 0 !important;
  margin: 0 !important;
  pointer-events: none !important;
  outline: none !important;
  box-shadow: none !important;
  z-index: 2147483647 !important;
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
  transition: opacity var(--duration-normal) ease, transform var(--duration-normal) ease;
}

.cell-orbital-pointer--hidden {
  opacity: 0 !important;
  transform: translate(-50%, -50%) scale(1e-5) !important;
}

@media (prefers-reduced-motion: reduce) {
  .cell-orbital-badge,
  .cell-orbital-pointer {
    transition: none !important;
  }
}
`.trim();
}
