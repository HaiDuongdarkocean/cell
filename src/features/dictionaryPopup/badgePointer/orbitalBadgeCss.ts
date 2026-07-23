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
  width: var(--badge-size, 36px) !important;
  height: var(--badge-size, 36px) !important;
  box-sizing: border-box !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 50% !important;
  background: var(--color-primary, #3b82f6) !important;
  color: var(--color-primary-foreground, #ffffff) !important;
  cursor: grab !important;
  pointer-events: auto !important;
  touch-action: none !important;
  outline: none !important;
  box-shadow: none !important;
  z-index: 2147483647 !important;
  transform: translate(-50%, -50%) !important;
  transition: transform 200ms ease, background-color 200ms ease, width 200ms ease, height 200ms ease, left 0ms, top 0ms !important;
  /* will-change promotes the badge to its own compositor layer so repositioning
     (left/top on a position:fixed element) is cheaper — the layer is moved on
     the compositor instead of re-laying out the host page. One 36px layer is
     negligible memory. */
  will-change: transform !important;
}

.cell-orbital-badge:active {
  cursor: grabbing !important;
  background: var(--color-primary-active, #2563eb) !important;
}

/* Peek mode — when the pointer preset is 'center', the tip sits inside the
   badge. Make the badge translucent + faint border so the user can see the
   text under it for easier lookup. The pointer (9px) remains solid white so
   the tip is still visible against the page. */
.cell-orbital-badge--peek {
  background: transparent !important;
  border: 1px solid color-mix(in srgb, var(--color-primary, #3b82f6) 40%, transparent) !important;
}

/* The "moon" pointer orbiting the badge. pointer-events: none so it never
   blocks document hit-testing at its tip. When collapsed, it is centered
   inside the visible half-moon so it is not clipped by the viewport edge. */
.cell-orbital-pointer {
  position: fixed !important;
  width: var(--pointer-size, 9px) !important;
  height: var(--pointer-size, 9px) !important;
  box-sizing: border-box !important;
  border-radius: 50% !important;
  background: var(--color-text-inverse, #ffffff) !important;
  border: 2px solid var(--color-primary, #3b82f6) !important;
  padding: 0 !important;
  margin: 0 !important;
  pointer-events: none !important;
  outline: none !important;
  box-shadow: none !important;
  z-index: 2147483647 !important;
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) !important;
  transition: opacity 200ms ease, transform 200ms ease, left 0ms, top 0ms;
}

.cell-orbital-pointer--hidden {
  opacity: 0 !important;
  transform: translate(-50%, -50%) scale(1e-5) !important;
}

/* === Settings panel (mobile-first center screen) ===
   Shown on single click. Mobile-first: 280px width on 320px screens with
   16px margin, expanding to 320px on larger screens. Vertically centered
   with a max-height clamp so it scrolls if content overflows. data-theme
   is set on the panel element so dark-mode tokens cascade. */
.cell-orbital-panel {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: calc(100vw - var(--space-8, 32px)) !important;
  max-width: 320px !important;
  max-height: calc(100vh - var(--space-8, 32px)) !important;
  overflow-y: auto !important;
  background: var(--color-popover, #ffffff) !important;
  color: var(--color-popover-foreground, #0f172a) !important;
  border: 1px solid var(--color-border, #e2e8f0) !important;
  border-radius: var(--radius-lg, 12px) !important;
  padding: var(--space-4, 16px) !important;
  z-index: 2147483647 !important;
  pointer-events: auto !important;
  display: none;
  flex-direction: column !important;
  gap: var(--space-3, 12px) !important;
  box-shadow: none !important;
}

.cell-orbital-panel--open {
  display: flex !important;
}

.cell-orbital-panel__header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-sm, 13px) !important;
  font-weight: var(--font-weight-semibold, 600) !important;
}

.cell-orbital-panel__row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-sm, 13px) !important;
}

.cell-orbital-panel__label {
  color: var(--color-foreground, #0f172a) !important;
}

.cell-orbital-panel__action {
  width: 100% !important;
}

/* Larger screens (≥768px): fixed 320px width, no longer viewport-relative. */
@media (min-width: 768px) {
  .cell-orbital-panel {
    width: 320px !important;
  }
}
`.trim();
}
