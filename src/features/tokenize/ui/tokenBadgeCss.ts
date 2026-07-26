/**
 * CSS for the Shadow DOM mini badge + panel.
 *
 * Conventions:
 * - Uses --color-* / --space-* / --radius-* / --transition tokens from tokens.css.
 * - Buttons reuse .btn / .icon-btn classes from components.css for hover/active
 *   states (SSOT — never redefine hover here).
 * - BEM: .cell-token-panel is the block; .cell-toggle is its own block (matches
 *   DS Toggle.tsx pattern: button + aria-pressed + .cell-toggle__thumb).
 * - Theme: caller sets data-theme on the panel element inside the shadow tree
 *   so [data-theme="dark"] selectors in tokens.css match and cascade.
 */
export function buildTokenBadgeCss(): string {
  return `
:host {
  font-family: var(--font-family);
  color: var(--color-foreground);
}

/* FAB — floating action button. .btn--primary provides bg/color/hover/active.
   .cell-token-fab only adds floating layout (position, size, z-index).
   --badge-size is SSOT with the orbital badge (default 36px). */
.cell-token-fab {
  position: fixed !important;
  right: var(--space-4) !important;
  bottom: var(--space-4) !important;
  width: var(--badge-size) !important;
  height: var(--badge-size) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: var(--radius-full) !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: pointer !important;
  z-index: 2147483646 !important;
  /* touch-action:none prevents the browser from hijacking the touch gesture
     for page scroll/zoom during drag, which fires pointercancel and aborts/
     jitters the drag on touch screens. Tap (click) still fires — touch-action
     only gates pan/zoom, not clicks. */
  touch-action: none !important;
  /* will-change promotes the FAB to its own compositor layer so drag transforms
     bypass main-thread layout/paint entirely. One 36x36 layer is negligible
     memory; keeping it permanent avoids layer-creation jank at drag start. */
  will-change: transform !important;
  box-shadow: none !important;
  outline: none !important;
}

.cell-token-fab svg {
  width: var(--iconbutton-icon-sm) !important;
  height: var(--iconbutton-icon-sm) !important;
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 2 !important;
}

/* Collapsed state — the FAB center sits on a viewport edge so the viewport
   clips half of it → visible half-moon (kế thừa orbital badge). The class is
   a visual hook; the half-moon shape comes from the viewport clipping the
   position:fixed button whose center is exactly on the edge. data-collapse-edge
   shifts the icon into the visible half so it is not clipped. */
.cell-token-fab--collapsed {
  cursor: grab !important;
}

/* Shift the icon inward by 1/4 badge-size (center of the visible half-moon)
   and scale it down to fit comfortably with padding. The visible half is
   badge-size/2 = 18px; the icon is 18px, so without scaling it fills the
   half entirely with zero padding. scale(0.7) → ~12.6px, leaving ~2.7px
   padding on each side. Transform order: scale first (shrink around center),
   then translate (move to visible-half center). */
.cell-token-fab--collapsed[data-collapse-edge="right"] svg {
  transform: translateX(calc(var(--badge-size) / -4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="left"] svg {
  transform: translateX(calc(var(--badge-size) / 4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="bottom"] svg {
  transform: translateY(calc(var(--badge-size) / -4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="top"] svg {
  transform: translateY(calc(var(--badge-size) / 4)) scale(0.7) !important;
}

/* Panel — popover container. data-theme is set on this element so dark-mode
   tokens cascade to all children. */
.cell-token-panel {
  position: fixed !important;
  right: var(--space-4) !important;
  /* 260px panel width is expressed as calc(var(--space-5) * 13) to keep the
     value derived from the spacing scale instead of a bare pixel value. */
  width: calc(var(--space-5) * 13) !important;
  max-width: calc(100vw - var(--space-8)) !important;
  /* bottom = FAB height (var(--badge-size)) + gap (var(--space-2)) + base offset (var(--space-4)) */
  bottom: calc(var(--space-4) + var(--badge-size) + var(--space-2)) !important;
  background: var(--color-popover) !important;
  color: var(--color-popover-foreground) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-lg) !important;
  padding: var(--space-4) !important;
  z-index: 2147483646 !important;
  display: none;
  flex-direction: column !important;
  gap: var(--space-3) !important;
  box-shadow: none !important;
}

.cell-token-panel--open {
  display: flex !important;
}

.cell-token-panel__header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-base) !important;
  font-weight: var(--font-weight-semibold) !important;
}

/* Close button — .icon-btn--xs provides size/hover/active. .cell-token-panel__close
   is kept only as a BEM hook for tests/inspector; no extra CSS needed. */

/* Toggle row — label + toggle */
.cell-token-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-base) !important;
}

.cell-token-row__label {
  color: var(--color-foreground) !important;
}

/* Toggle block — matches DS Toggle.tsx pattern (button + aria-pressed + thumb).
   Mirrors Toggle.module.css so vanilla DOM and React share the same look. */
.cell-toggle {
  width: var(--space-8);
  height: var(--space-4-5);
  border-radius: var(--radius-full);
  background: var(--color-border);
  position: relative;
  transition: background var(--transition);
  cursor: pointer;
  flex-shrink: 0;
  border: none;
  padding: 0;
}

.cell-toggle[aria-pressed="true"] {
  background: var(--color-primary);
}

.cell-toggle:hover {
  background: var(--color-text-muted);
}

.cell-toggle[aria-pressed="true"]:hover {
  background: var(--color-primary-hover);
}

.cell-toggle:focus-visible {
  outline: var(--space-0-5) solid var(--color-primary);
  outline-offset: var(--space-0-5);
}

.cell-toggle__thumb {
  position: absolute;
  top: var(--space-0-5);
  left: var(--space-0-5);
  width: var(--space-3-5);
  height: var(--space-3-5);
  border-radius: var(--radius-full);
  background: var(--color-text-inverse);
  transition: transform var(--transition);
}

.cell-toggle[aria-pressed="true"] .cell-toggle__thumb {
  transform: translateX(var(--space-3-5));
}

/* Dictionary action button — .btn--primary provides bg/color/hover/active.
   .cell-token-action only adds full-width layout. */
.cell-token-action {
  width: 100% !important;
}

@media (prefers-reduced-motion: reduce) {
  .cell-toggle,
  .cell-toggle__thumb {
    transition: none !important;
  }
}
`.trim();
}
