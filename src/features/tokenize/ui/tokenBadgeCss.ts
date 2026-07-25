export const BADGE_STYLE_ID = 'cell-token-badge-style';

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
  font-family: var(--font-family, sans-serif);
  color: var(--color-foreground, #0f172a);
}

/* FAB — floating action button. .btn--primary provides bg/color/hover/active.
   .cell-token-fab only adds floating layout (position, size, z-index).
   --badge-size is SSOT with the orbital badge (default 36px). */
.cell-token-fab {
  position: fixed !important;
  right: var(--space-4, 16px) !important;
  bottom: var(--space-4, 16px) !important;
  width: var(--badge-size, 36px) !important;
  height: var(--badge-size, 36px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: var(--radius-full, 9999px) !important;
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
  width: var(--iconbutton-icon-sm, 18px) !important;
  height: var(--iconbutton-icon-sm, 18px) !important;
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
  transform: translateX(calc(var(--badge-size, 36px) / -4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="left"] svg {
  transform: translateX(calc(var(--badge-size, 36px) / 4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="bottom"] svg {
  transform: translateY(calc(var(--badge-size, 36px) / -4)) scale(0.7) !important;
}
.cell-token-fab--collapsed[data-collapse-edge="top"] svg {
  transform: translateY(calc(var(--badge-size, 36px) / 4)) scale(0.7) !important;
}

/* Panel — popover container. data-theme is set on this element so dark-mode
   tokens cascade to all children. */
.cell-token-panel {
  position: fixed !important;
  right: var(--space-4, 16px) !important;
  /* ponytail: 260px panel width is a design choice — no exact token; keep
     hardcoded with fallback until a --panel-width token is introduced. */
  width: 260px !important;
  max-width: calc(100vw - var(--space-8, 32px)) !important;
  /* bottom = FAB height (var(--badge-size)) + gap (var(--space-2)) + base offset (var(--space-4)) */
  bottom: calc(var(--space-4, 16px) + var(--badge-size, 36px) + var(--space-2, 8px)) !important;
  background: var(--color-popover, #ffffff) !important;
  color: var(--color-popover-foreground, #0f172a) !important;
  border: 1px solid var(--color-border, #e2e8f0) !important;
  border-radius: var(--radius-lg, 12px) !important;
  padding: var(--space-4, 16px) !important;
  z-index: 2147483646 !important;
  display: none;
  flex-direction: column !important;
  gap: var(--space-3, 12px) !important;
  box-shadow: none !important;
}

.cell-token-panel--open {
  display: flex !important;
}

.cell-token-panel__header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-base, 14px) !important;
  font-weight: var(--font-weight-semibold, 600) !important;
}

/* Close button — .icon-btn--xs provides size/hover/active. .cell-token-panel__close
   is kept only as a BEM hook for tests/inspector; no extra CSS needed. */

/* Toggle row — label + toggle */
.cell-token-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-base, 14px) !important;
}

.cell-token-row__label {
  color: var(--color-foreground, #0f172a) !important;
}

/* Toggle block — matches DS Toggle.tsx pattern (button + aria-pressed + thumb).
   Mirrors Toggle.module.css so vanilla DOM and React share the same look. */
.cell-toggle {
  width: var(--space-8, 32px);
  height: 18px;
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
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.cell-toggle__thumb {
  position: absolute;
  top: var(--space-0-5, 2px);
  left: var(--space-0-5, 2px);
  width: var(--space-3-5, 14px);
  height: var(--space-3-5, 14px);
  border-radius: var(--radius-full);
  background: var(--color-text-inverse);
  transition: transform var(--transition);
}

.cell-toggle[aria-pressed="true"] .cell-toggle__thumb {
  transform: translateX(var(--space-3-5, 14px));
}

/* Dictionary action button — .btn--primary provides bg/color/hover/active.
   .cell-token-action only adds full-width layout. */
.cell-token-action {
  width: 100% !important;
}
`.trim();
}
