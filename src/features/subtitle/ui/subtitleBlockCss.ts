// Unified subtitle block CSS — injected into content-script isolated world (ADR-025).
// Uses theme tokens from themeTokens.ts and CSS variables updated by the controller.

export const SUBTITLE_BLOCK_CSS = `
.subtitle-block {
  /* position:fixed escapes the video container's stacking context so the
     block is never covered by site overlays (YouTube gradients, ad layers,
     player chrome). The controller syncs left/top/width from the container's
     getBoundingClientRect() on scroll/resize/fullscreen. In fullscreen mode,
     the controller switches to position:absolute inside the fullscreen element.
     z-index tier: above YouTube overlays (<1000000), below settings dialog
     (var(--z-overlay-settings)) and dictionary popup (var(--z-overlay-top)) so those float above. */
  position: fixed;
  /* left, top, width set by controller syncPosition() — no CSS defaults. */
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-pill);
  border: var(--border-width-hairline) solid transparent;
  background: transparent;
  /* overflow:visible — NOT hidden — so popup panels (subtitle-manager-panel,
     more-popover, subtitle-selector-popover) positioned absolute inside the
     block can extend beyond its bounds without being clipped. The ::before
     backdrop is clipped by its own border-radius + inset:0, not by overflow. */
  overflow: visible;
  z-index: var(--z-overlay-video);
  pointer-events: auto;
  user-select: none;
  cursor: grab;
  touch-action: none;
  transition: border-color var(--transition);
}

.subtitle-block::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  backdrop-filter: blur(var(--blur-lg));
  opacity: 0;
  z-index: calc(var(--z-dropdown) - 1001);
  transition: opacity var(--transition);
}

.subtitle-block.dragging {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
  cursor: grabbing;
  /* Promote to a compositor layer only while dragging so the translateY drag
     transform bypasses main-thread layout/paint. Set on .dragging (not the base
     rule) because the block is large (full video width) and a permanent layer
     would waste memory. The layer is created at drag start, before movement. */
  will-change: transform;
}

.subtitle-block.dragging::before {
  opacity: var(--sb-bg-opacity, 0.7);
}

.block-body {
  display: grid;
  grid-template-columns: var(--sb-cluster-width, calc(var(--space-20) + var(--space-1))) 1fr var(--sb-cluster-width, calc(var(--space-20) + var(--space-1)));
  gap: var(--space-1);
  align-items: center;
  min-height: 0;
  padding: var(--space-1) var(--space-2);
}

.cluster-columns {
  grid-column: 1;
  justify-self: start;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1);
}

.cluster-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  align-items: center;
}

.no-sub-column {
  display: none;
}

.cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--sb-btn-size, var(--space-10));
  height: var(--sb-btn-size, var(--space-10));
  /* Overlay appearance: no border, feathered backdrop blur, bg opacity from setting. */
  border: none;
  border-radius: var(--radius-full);
  background: rgba(var(--color-surface-rgb), var(--sb-bg-opacity, 0.2));
  color: rgba(var(--color-text-rgb), var(--sb-text-opacity, 1));
  cursor: pointer;
  padding: 0;
  position: relative;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
  outline: none;
  transition: transform var(--duration-normal) var(--ease-bounce), background var(--transition), color var(--transition);
}

/* Feathered backdrop — ::before mở rộng + backdrop-filter blur 1px + mask radial fade.
   Button hòa vào video không có ranh giới rõ (Josh W. Comeau technique). */
.cluster-btn::before {
  content: '';
  position: absolute;
  inset: calc(var(--space-0-5) * -1);
  border-radius: var(--radius-full);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  background: rgba(var(--color-background-rgb), 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  z-index: calc(var(--z-dropdown) - 1001);
  transition: background var(--duration-fast) ease;
}

/* Hover chỉ áp dụng trên thiết bị có hover thật (mouse/trackpad).
   Trên touch screen, :hover bị browser "dính" sau tap → icon xanh không tự tắt.
   @media (hover:hover) loại bỏ hoàn toàn hover trên touch. */
@media (hover: hover) {
  .cluster-btn:hover {
    color: var(--color-primary);
  }

  .cluster-btn:hover::before {
    background: rgba(var(--color-background-rgb), 0.25);
  }
}

.cluster-btn:active {
  transform: scale(0.88);
}

/* Overlay icon buttons (panel-toggle, subtitle-manager-icon, subtitle-import-button)
   share the cluster button's press animation — :active scale 0.88 with bouncy
   easing. These buttons use inline style for color/bg/transition but NOT for
   transform, so this CSS :active rule applies. The inline transition must
   include "transform 200ms cubic-bezier(...)" for the bounce to animate. */
[data-testid="panel-toggle"]:active,
[data-testid="subtitle-manager-icon"]:active,
[data-testid="subtitle-import-button"]:active {
  transform: scale(0.88);
}

.cluster-btn svg {
  width: var(--nav-cluster-icon-size-ratio);
  height: var(--nav-cluster-icon-size-ratio);
  display: block;
  fill: none !important;
  background: transparent !important;
}

.cluster-btn svg *:not(text) {
  fill: none !important;
  background: transparent !important;
}

.block-right-column {
  grid-column: 3;
}

.subtitle-column {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: var(--space-1);
  gap: var(--space-0-5);
  text-align: center;
}

.subtitle-line {
  display: block;
  padding: var(--space-0-5) var(--space-2);
  border-radius: var(--radius-2xs);
  line-height: var(--subtitle-line-height);
  text-align: center;
  white-space: pre-wrap;
  max-width: 100%;
  overflow-wrap: break-word;
  cursor: text;
  pointer-events: auto;
  user-select: text;
}

.subtitle-line.target {
  font-size: var(--sb-target-font, var(--space-4-5));
}

.subtitle-line.native {
  font-size: var(--sb-native-font, var(--font-size-sm));
}

.subtitle-block.cluster-off .cluster-columns {
  display: none;
}

.subtitle-block.cluster-off .block-body {
  grid-template-columns: 0 1fr 0;
}

/* === Card Creator entry buttons (spec §4.1) ===
   ADR-026/ADR-027: Right column has 2 sub-columns.
   Cột 1 (primary): quick add, send to card, more button (overflow popover).
   Cột 2 (secondary): update current card, translate, subtitle manager icon.
   Both sub-columns inherit --sb-btn-size + --sb-text-opacity + --sb-bg-opacity
   from the block (set in applyScale), so they scale + fade with the cluster.
   When cluster is off, applyClusterLayout hides this column. */
.block-right-column {
  display: flex;
  flex-direction: row;
  gap: var(--space-1);
  align-items: center;
  justify-content: center;
}

.right-col-primary,
.right-col-secondary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: center;
  justify-content: center;
}

/* Primary column is the anchor for the more-popover (absolute positioned). */
.right-col-primary {
  position: relative;
}

/* More popover — horizontal row of overflow buttons, opens to the LEFT of
   the more button with a slide+fade animation. Absolute positioned relative
   to .right-col-primary, aligned to the more button's row (bottom: 0).
   No padding — buttons sit flush like cluster buttons. Gap between popover
   and moreBtn = cluster gap (var(--space-1)) via margin-right.
   Uses the same feathered backdrop as cluster-btn. */
.more-popover {
  position: absolute;
  right: 100%;
  bottom: 0;
  z-index: var(--z-overlay-video-popover);
  display: flex;
  flex-direction: row;
  gap: var(--space-1);
  align-items: center;
  margin-right: var(--space-1);
  border-radius: var(--radius-full);
  isolation: isolate;
  /* Hidden state — animate from here to --open */
  opacity: 0;
  transform: translateX(var(--space-2));
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity var(--duration-normal) ease,
    transform var(--duration-normal) var(--ease-bounce);
}

/* Open state — slide in from right + fade in */
.more-popover--open {
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
  pointer-events: auto;
  transition:
    opacity var(--duration-normal) ease,
    transform var(--duration-normal) var(--ease-bounce);
}

/* Feathered backdrop — same technique as .cluster-btn::before */
.more-popover::before {
  content: '';
  position: absolute;
  inset: calc(var(--space-0-5) * -1);
  border-radius: var(--radius-full);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  background: rgba(var(--color-background-rgb), 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  z-index: calc(var(--z-dropdown) - 1001);
}

.more-popover__slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Manager icon slot — wraps the subtitle-manager-icon in the secondary column.
   The icon itself is created by subtitleManagerPanel and appended here. */
.manager-icon-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* More button chevron rotates when popover is open (visual feedback) */
.right-col-more[aria-expanded="true"] svg {
  transform: rotate(180deg);
}

.right-col-more svg {
  transition: transform var(--duration-fast) ease;
}

/* Hide Card Creator buttons on mobile width < POPUP_SHEET_BREAKPOINT_PX.
   CSS media queries cannot use CSS variables, so hardcode 767px
   (one pixel below the 768px breakpoint used in popupShell.ts). */
@media (max-width: 767px) {
  .block-right-column {
    display: none;
  }
}

/* === Subtitle selector dropdown (ADR-014 D3) ===
   Dark overlay colors intentional — sits on top of video, not theme-aware. */
.subtitle-selector-icon {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: var(--z-overlay-video-popover);
  width: var(--space-7);
  height: var(--space-7);
  padding: 0;
  border: var(--border-width-hairline) solid rgba(var(--overlay-text-rgb), 0.3);
  border-radius: var(--radius-2xs);
  background: rgba(var(--overlay-background-rgb), 0.6);
  color: var(--overlay-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.subtitle-selector-popover {
  position: absolute;
  top: var(--touch-target-desktop);
  right: var(--space-2);
  z-index: var(--z-overlay-video-popover);
  max-height: calc(var(--space-5) * 10);
  overflow-y: auto;
  background: rgba(var(--overlay-background-rgb), 0.85);
  color: var(--overlay-text);
  border: var(--border-width-hairline) solid rgba(var(--overlay-text-rgb), 0.2);
  border-radius: var(--radius-sm);
  padding: var(--space-1);
  min-width: calc(var(--space-5) * 9);
  font-size: var(--font-size-xs);
}

.subtitle-selector-item {
  padding: var(--space-1-5) var(--space-2);
  cursor: pointer;
  border-radius: var(--radius-2xs);
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.subtitle-selector-item--active {
  background: rgba(var(--overlay-text-rgb), 0.15);
  font-weight: var(--font-weight-bold);
}

.subtitle-selector-item:hover:not(.subtitle-selector-item--active) {
  background: rgba(var(--overlay-text-rgb), 0.1);
}

.subtitle-selector-asr-badge {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: calc(var(--space-0-5) / 2) var(--space-1-5);
  border-radius: var(--radius-2xs);
  background: rgba(var(--overlay-text-rgb), 0.18);
  color: rgba(var(--overlay-text-rgb), 0.85);
  margin-left: var(--space-1);
}

.subtitle-selector-meta {
  opacity: 0.7;
  font-size: var(--font-size-xs);
}

/* === Subtitle offset panel (ADR-019 V3) ===
   Uses design tokens — theme-aware (sits inside manager panel, not on video). */
.offset-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  user-select: none;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  transition: background var(--duration-fast) ease;
}

.offset-header:hover {
  background: var(--color-surface-hover);
}

.offset-header-chevron {
  display: inline-flex;
  color: var(--color-text-muted);
  transition: transform var(--duration-fast) ease;
}

.offset-header-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  flex: 1;
  color: var(--color-text-muted);
}

.offset-body {
  padding: var(--space-1) var(--space-1) var(--space-2);
  display: block;
}

.offset-pill {
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr 1fr 1fr;
  align-items: stretch;
  background: var(--color-surface);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-full);
  padding: var(--space-1);
  gap: 0;
  margin-bottom: var(--space-2);
  isolation: isolate;
}

.offset-step-btn {
  position: relative;
  z-index: calc(var(--z-dropdown) - 999);
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  padding: var(--space-2) var(--space-1);
  min-height: var(--touch-target-desktop);
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.offset-step-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.offset-step-btn--plus {
  color: var(--color-success);
}

.offset-step-btn--minus {
  color: var(--color-info);
}

.offset-value {
  position: relative;
  z-index: calc(var(--z-dropdown) - 998);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-primary-rgb), 0.1);
  color: var(--color-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  min-height: var(--touch-target-desktop);
  min-width: 0;
  width: 100%;
  border: none;
  transition: color var(--duration-fast) ease, background var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
  text-align: center;
  outline: none;
}

.offset-value:focus {
  z-index: calc(var(--z-dropdown) - 997);
  box-shadow: var(--shadow-focus-primary);
  background: var(--color-background);
}

.offset-value--zero {
  color: var(--color-text-muted);
  background: var(--color-surface-hover);
}

.offset-value--positive {
  color: var(--color-success);
  background: rgba(var(--color-primary-rgb), 0.1);
}

.offset-value--negative {
  color: var(--color-info);
  background: rgba(var(--color-primary-rgb), 0.1);
}

.offset-reset-btn {
  width: 100%;
  padding: var(--space-2);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1-5);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease, border-color var(--duration-fast) ease;
  -webkit-tap-highlight-color: transparent;
}

.offset-reset-btn:hover:not(:disabled) {
  background: rgba(var(--color-error-rgb), 0.08);
  color: var(--color-error);
  border-color: var(--color-error);
}

.offset-reset-icon {
  display: inline-flex;
}

.offset-disabled-hint {
  padding: var(--space-2) 0 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  display: none;
}

.offset-disabled-hint--visible {
  display: block;
}

/* === Subtitle Manager Panel (ADR-015 V2 / ADR-027) ===
   Panel uses design tokens (theme-aware). Manager icon uses overlay colors
   (sits on video in the secondary column slot). Item active state uses
   role-colored border + bg.
   ADR-027: .subtitle-toolbar removed — manager icon is now in the subtitle
   block's secondary column, not a separate top-left toolbar. */
.subtitle-manager-icon {
  width: var(--sb-btn-size, var(--space-10));
  height: var(--sb-btn-size, var(--space-10));
  border: none;
  border-radius: var(--radius-full);
  background: rgba(var(--color-surface-rgb), var(--sb-bg-opacity, 0.2));
  color: rgba(var(--color-text-rgb), var(--sb-text-opacity, 1));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  isolation: isolate;
  pointer-events: auto;
  user-select: none;
  position: relative;
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease, transform var(--duration-normal) var(--ease-bounce);
}

.subtitle-manager-icon-feather {
  position: absolute;
  inset: calc(var(--space-0-5) * -1);
  border-radius: var(--radius-full);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  background: rgba(var(--color-background-rgb), 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  z-index: calc(var(--z-dropdown) - 1001);
  transition: background var(--duration-fast) ease;
  pointer-events: none;
}

.subtitle-manager-icon--active {
  color: var(--color-primary);
}

@media (hover: hover) {
  .subtitle-manager-icon:hover:not(.subtitle-manager-icon--active) {
    color: var(--color-primary);
  }

  .subtitle-manager-icon:hover:not(.subtitle-manager-icon--active) .subtitle-manager-icon-feather {
    background: rgba(var(--color-background-rgb), 0.25);
  }
}

.subtitle-manager-icon:active {
  transform: scale(0.88);
}

.subtitle-manager-panel {
  display: none;
  position: absolute;
  top: var(--touch-target-mobile);
  left: var(--space-2);
  z-index: var(--z-overlay-video-popover);
  width: calc(var(--space-5) * 16);
  max-height: calc(var(--space-5) * 18);
  overflow-y: auto;
  background-color: var(--color-background);
  color: var(--color-text);
  border: var(--border-width-hairline) solid var(--color-border);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-md, none);
  padding: var(--space-1);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--leading-normal);
  letter-spacing: var(--tracking-normal);
  text-align: left;
  text-shadow: var(--shadow-sm);
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) var(--color-surface-hover);
}

.subtitle-manager-panel--open {
  display: block;
}

.subtitle-manager-panel *,
.subtitle-manager-panel *::before,
.subtitle-manager-panel *::after {
  box-sizing: border-box;
  max-width: 100%;
}

.subtitle-manager-panel button {
  margin: 0;
  font-family: inherit;
  line-height: var(--leading-normal);
}

.subtitle-manager-panel::-webkit-scrollbar {
  width: var(--space-2);
}

.subtitle-manager-panel::-webkit-scrollbar-track {
  background: var(--color-surface-hover);
  border-radius: var(--radius-full);
}

.subtitle-manager-panel::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full);
  border: var(--space-0-5) solid var(--color-surface-hover);
}

.subtitle-manager-panel::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

.subtitle-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--touch-target-desktop);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-hairline) solid var(--color-border-subtle);
  box-sizing: border-box;
}

.subtitle-manager-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
}

.subtitle-manager-close {
  width: var(--space-5);
  height: var(--space-5);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease, transform var(--duration-normal) var(--ease-bounce);
}

.subtitle-manager-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.subtitle-manager-close:active {
  transform: scale(0.88);
}

.subtitle-manager-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  user-select: none;
  width: 100%;
  min-height: var(--touch-target-desktop);
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  line-height: var(--leading-normal);
  text-align: left;
  box-sizing: border-box;
  transition: background var(--duration-fast) ease;
}

.subtitle-manager-section-header:hover {
  background: var(--color-surface-hover);
}

.subtitle-manager-section-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--space-4);
  width: var(--space-4);
  height: var(--space-4);
  margin: 0;
  color: var(--color-text-muted);
  transition: transform var(--duration-fast) ease;
}

.subtitle-manager-section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  flex: 1;
}

.subtitle-manager-section-label--target {
  color: var(--color-primary);
}

.subtitle-manager-section-label--native {
  color: var(--color-warning);
}

.subtitle-manager-section-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.subtitle-manager-section-body {
  padding: 0 var(--space-1);
  display: block;
}

.subtitle-manager-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  border: var(--border-width-hairline) solid transparent;
  background: transparent;
  transition: background var(--duration-fast) ease;
}

.subtitle-manager-item:hover:not(.subtitle-manager-item--active) {
  background: var(--color-surface-hover);
}

.subtitle-manager-item--active {
  padding: calc(var(--space-2) - var(--space-0-5) / 2) calc(var(--space-3) - var(--space-0-5) / 2);
}

.subtitle-manager-item--active.subtitle-manager-item--target {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.subtitle-manager-item--active.subtitle-manager-item--native {
  border-color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), 0.1);
}

.subtitle-manager-radio {
  width: var(--space-3-5);
  height: var(--space-3-5);
  border-radius: var(--radius-full);
  border: var(--space-0-5) solid var(--color-text-muted);
  background: transparent;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subtitle-manager-radio--active.subtitle-manager-radio--target {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.subtitle-manager-radio--active.subtitle-manager-radio--native {
  border-color: var(--color-warning);
  background: var(--color-warning);
}

.subtitle-manager-radio-dot {
  width: var(--space-1);
  height: var(--space-1);
  border-radius: var(--radius-full);
  background: var(--color-text-inverse);
}

.subtitle-manager-item-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-0-5);
  min-width: 0;
  flex: 1;
}

.subtitle-manager-item-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtitle-manager-item-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.subtitle-manager-format-badge {
  padding: calc(var(--space-0-5) / 2) var(--space-1-5);
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  letter-spacing: var(--tracking-wide);
}

.subtitle-manager-asr-badge {
  padding: calc(var(--space-0-5) / 2) var(--space-1-5);
  border-radius: var(--radius-sm);
  background: rgba(var(--color-warning-rgb), 0.15);
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  letter-spacing: var(--tracking-wide);
}

.subtitle-manager-imported-badge {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.subtitle-manager-translated-badge {
  padding: calc(var(--space-0-5) / 2) var(--space-1-5);
  border-radius: var(--radius-sm);
  background: rgba(var(--color-warning-rgb), 0.15);
  color: var(--color-warning);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xs);
  letter-spacing: var(--tracking-wide);
}

.subtitle-manager-role-indicator {
  font-weight: var(--font-weight-semibold);
}

.subtitle-manager-role-indicator--target {
  color: var(--color-primary);
}

.subtitle-manager-role-indicator--native {
  color: var(--color-warning);
}

/* === Panel toggle button (ADR-008 D1 / ADR-027) ===
   Overlay appearance — sits in more-popover slot, not theme-aware.
   ADR-027: No longer position:absolute top-right — now inline in popover. */
.panel-toggle {
  width: var(--sb-btn-size, var(--space-10));
  height: var(--sb-btn-size, var(--space-10));
  border: none;
  border-radius: var(--radius-full);
  background: rgba(var(--color-surface-rgb), var(--sb-bg-opacity, 0.2));
  color: rgba(var(--color-text-rgb), var(--sb-text-opacity, 1));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  isolation: isolate;
  user-select: none;
  pointer-events: auto;
  transition: background var(--duration-fast) ease, color var(--duration-fast) ease, transform var(--duration-normal) var(--ease-bounce);
}

@media (hover: hover) {
  .panel-toggle:hover {
    color: var(--color-primary);
  }

  .panel-toggle:hover .panel-toggle-feather {
    background: rgba(var(--color-background-rgb), 0.25);
  }
}

.panel-toggle:active {
  transform: scale(0.88);
}

.panel-toggle-feather {
  position: absolute;
  inset: calc(var(--space-0-5) * -1);
  border-radius: var(--radius-full);
  backdrop-filter: blur(var(--blur-xs));
  -webkit-backdrop-filter: blur(var(--blur-xs));
  background: rgba(var(--color-background-rgb), 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, var(--overlay-background) 55%, transparent 100%);
  z-index: calc(var(--z-dropdown) - 1001);
  transition: background var(--duration-fast) ease;
  pointer-events: none;
}

/* === Subtitle track dropdown (overlay) ===
   Dark overlay colors intentional — sits on top of video. */
.subtitle-track-dropdown {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: var(--z-overlay-video-popover);
  font-size: var(--font-size-xs);
  padding: var(--space-0-5) var(--space-1);
  background-color: rgba(var(--overlay-background-rgb), 0.7);
  color: rgba(var(--overlay-text-rgb), 0.95);
  border: none;
  border-radius: var(--radius-2xs);
  display: none;
}

.subtitle-track-dropdown--visible {
  display: block;
}

/* === Subtitle overlay layers (ADR-013 D6) ===
   Static positioning via class; dynamic config (fontSize, color, opacity,
   textShadow, fontFamily, textAlign, display) stays as inline style. */
.subtitle-overlay {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-2xs);
  pointer-events: auto;
  cursor: ns-resize;
  white-space: pre-wrap !important;
  line-height: var(--subtitle-line-height) !important;
  max-width: var(--subtitle-overlay-max-width);
}

.subtitle-overlay[data-role="target"] {
  z-index: var(--z-subtitle-target);
}

.subtitle-overlay[data-role="native"] {
  z-index: var(--z-subtitle-native);
}

.subtitle-overlay-text {
  display: block;
  pointer-events: auto;
  user-select: text;
  cursor: text;
  line-height: var(--subtitle-line-height) !important;
}

/* === Drag hint overlay ===
   Dark overlay colors intentional — sits on top of video. */
.subtitle-drag-hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(var(--subtitle-drag-hint-rgb), 0.2);
  border: var(--space-1) dashed rgba(var(--subtitle-drag-hint-rgb), 0.8);
  border-radius: var(--radius-md);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: var(--z-subtitle-native);
  pointer-events: none;
  user-select: none;
  font-size: var(--font-size-base);
  color: rgba(var(--overlay-text-rgb), 0.95);
  text-shadow: var(--shadow-textSoft) rgba(var(--overlay-background-rgb), 0.8);
  font-family: var(--font-family);
}

.subtitle-drag-hint--visible {
  display: flex;
}

/* === Toast notification (UI v4) ===
   Theme-aware — uses design tokens. Variant color via CSS custom property. */
.subtitle-toast {
  position: absolute;
  bottom: var(--subtitle-toast-bottom);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-overlay-video-popover);
  background: var(--color-background);
  color: var(--color-text);
  border: var(--border-width-hairline) solid var(--color-border);
  border-left: var(--space-1) solid var(--toast-variant-color, var(--color-info));
  border-radius: var(--radius-pill);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  font-family: var(--font-family);
  box-shadow: var(--shadow-md, none);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  animation: subtitle-toast-in var(--duration-normal) var(--ease-standard);
}

.subtitle-toast-icon {
  color: var(--toast-variant-color, var(--color-info));
  display: inline-flex;
  flex-shrink: 0;
}

.subtitle-toast--fade-out {
  opacity: 0;
  transition: opacity var(--duration-slow) ease;
}

@keyframes subtitle-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(var(--space-2)); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* YouTube: app-drawer swipe-open overlay che cluster buttons — set width 0 */
#contentContainer.tp-yt-app-drawer[swipe-open]::after {
  width: 0 !important;
}

/* Respect user preference for reduced motion inside the subtitle overlay. */
@media (prefers-reduced-motion: reduce) {
  .subtitle-block *,
  .subtitle-block *::before,
  .subtitle-block *::after,
  .subtitle-toast {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

`;
