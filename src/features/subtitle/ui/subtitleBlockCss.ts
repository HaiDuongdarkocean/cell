// Unified subtitle block CSS — injected into content-script isolated world (ADR-025).
// Uses theme tokens from themeTokens.ts and CSS variables updated by the controller.

export const SUBTITLE_BLOCK_CSS = `
.subtitle-block {
  position: absolute;
  left: 0;
  /* --sb-top controls the CENTER of the block (not the top edge), because the
   * block is translated up by 50% of its own height. Default 75% places the
   * block center at 3/4 of the video height. */
  top: var(--sb-top, 75%);
  transform: translateY(-50%);
  width: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  background: transparent;
  overflow: hidden;
  z-index: 1000001;
  pointer-events: auto;
  user-select: none;
  cursor: grab;
  transition: border-color var(--transition, 150ms ease);
}

.subtitle-block::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md, 8px);
  background: var(--color-surface);
  backdrop-filter: blur(8px);
  opacity: 0;
  z-index: -1;
  transition: opacity var(--transition, 150ms ease);
}

.subtitle-block.dragging {
  border-color: var(--color-border);
  box-shadow: none;
  cursor: grabbing;
}

.subtitle-block.dragging::before {
  opacity: var(--sb-bg-opacity, 0.7);
}

.block-body {
  display: grid;
  grid-template-columns: var(--sb-cluster-width, 84px) 1fr var(--sb-cluster-width, 84px);
  gap: var(--space-1, 4px);
  align-items: center;
  min-height: 0;
}

.cluster-columns {
  grid-column: 1;
  justify-self: start;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-1, 4px);
  padding: var(--space-1, 4px);
}

.cluster-column {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.no-sub-column {
  display: none;
}

.cluster-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--sb-btn-size, 40px);
  height: var(--sb-btn-size, 40px);
  /* Overlay appearance: no border, feathered backdrop blur, bg opacity from setting. */
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: rgba(30, 41, 59, var(--sb-bg-opacity, 0.2));
  color: rgba(241, 245, 249, var(--sb-text-opacity, 1));
  cursor: pointer;
  padding: 0;
  position: relative;
  isolation: isolate;
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275), background var(--transition, 150ms ease), color var(--transition, 150ms ease);
}

/* Feathered backdrop — ::before mở rộng + backdrop-filter blur 1px + mask radial fade.
   Button hòa vào video không có ranh giới rõ (Josh W. Comeau technique). */
.cluster-btn::before {
  content: '';
  position: absolute;
  inset: -1.5px;
  border-radius: var(--radius-full, 9999px);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  background: rgba(15, 23, 42, 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  z-index: -1;
  transition: background 150ms ease;
}

.cluster-btn:hover {
  color: var(--color-primary);
}

.cluster-btn:hover::before {
  background: rgba(15, 23, 42, 0.25);
}

.cluster-btn:active {
  transform: scale(0.88);
}

.cluster-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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

/* Focus ring — keyboard only (WCAG 2.4.7). Mouse click does not trigger
   :focus-visible, so no outline appears on click — only the scale animation. */
[data-testid="panel-toggle"]:focus-visible,
[data-testid="subtitle-manager-icon"]:focus-visible,
[data-testid="subtitle-import-button"]:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.cluster-btn svg {
  width: 65%;
  height: 65%;
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
  padding: var(--space-1, 4px);
  gap: 2px;
  text-align: center;
}

.subtitle-line {
  display: block;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.4;
  text-align: center;
  white-space: pre-wrap;
  max-width: 100%;
  overflow-wrap: break-word;
  cursor: text;
  pointer-events: auto;
  user-select: text;
}

.subtitle-line.target {
  font-size: var(--sb-target-font, 18px);
}

.subtitle-line.native {
  font-size: var(--sb-native-font, 14px);
}

.subtitle-block.cluster-off .cluster-columns {
  display: none;
}

.subtitle-block.cluster-off .block-body {
  grid-template-columns: 0 1fr 0;
}

/* === Card Creator entry buttons (spec §4.1) ===
   ADR-026: Card Creator buttons are part of the cluster — they follow the
   same enabled/buttonSize/textOpacity/bgOpacity settings. They live in the right
   column (grid-column 3) but inherit --sb-btn-size + --sb-text-opacity +
   --sb-bg-opacity from the block (set in applyScale), so they scale + fade
   with the cluster. When cluster is off, applyClusterLayout hides this column. */
.block-right-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
}

/* Card Creator buttons inherit the cluster button size + opacity — no
   separate --sb-cluster-btn-size override (ADR-026: "two buttons ARE the
   cluster"). The base .cluster-btn rule already uses --sb-btn-size +
   --sb-text-opacity + --sb-bg-opacity, so no override is needed here. */

/* Hide Card Creator buttons on mobile width < 768px (mobile uses floating cluster) */
@media (max-width: 767px) {
  .block-right-column {
    display: none;
  }
}

/* === Subtitle selector dropdown (ADR-014 D3) ===
   Dark overlay colors intentional — sits on top of video, not theme-aware. */
.subtitle-selector-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000001;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.subtitle-selector-popover {
  position: absolute;
  top: 40px;
  right: 8px;
  z-index: 1000002;
  max-height: 200px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 4px;
  min-width: 180px;
  font-size: 12px;
}

.subtitle-selector-item {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.subtitle-selector-item--active {
  background: rgba(255, 255, 255, 0.15);
  font-weight: bold;
}

.subtitle-selector-item:hover:not(.subtitle-selector-item--active) {
  background: rgba(255, 255, 255, 0.1);
}

.subtitle-selector-asr-badge {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.85);
  margin-left: 4px;
}

.subtitle-selector-meta {
  opacity: 0.7;
  font-size: 11px;
}

/* === Subtitle offset panel (ADR-019 V3) ===
   Uses design tokens — theme-aware (sits inside manager panel, not on video). */
.offset-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  user-select: none;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  text-align: left;
  transition: background 150ms ease;
}

.offset-header:hover {
  background: var(--color-surface-hover);
}

.offset-header-chevron {
  display: inline-flex;
  color: var(--color-text-muted);
  transition: transform 150ms ease;
}

.offset-header-label {
  font-size: var(--font-size-xs, 12px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  color: var(--color-text-muted);
}

.offset-body {
  padding: var(--space-1, 4px) var(--space-1, 4px) var(--space-2, 8px);
  display: block;
}

.offset-pill {
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr 1fr 1fr;
  align-items: stretch;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full, 9999px);
  padding: 3px;
  gap: 0;
  margin-bottom: var(--space-2, 8px);
  isolation: isolate;
}

.offset-step-btn {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-family, sans-serif);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-medium, 500);
  font-variant-numeric: tabular-nums;
  padding: 8px 4px;
  min-height: 40px;
  transition: background 150ms ease, color 150ms ease;
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
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
  color: var(--color-primary);
  font-family: var(--font-family, sans-serif);
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-semibold, 600);
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm, 6px);
  padding: 4px 8px;
  min-height: 40px;
  min-width: 0;
  width: 100%;
  border: none;
  transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
  text-align: center;
  outline: none;
}

.offset-value:focus {
  z-index: 3;
  box-shadow: inset 0 0 0 2px var(--color-primary);
  background: var(--color-background);
}

.offset-value--zero {
  color: var(--color-text-muted);
  background: var(--color-surface-hover);
}

.offset-value--positive {
  color: var(--color-success);
  background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
}

.offset-value--negative {
  color: var(--color-info);
  background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
}

.offset-reset-btn {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full, 9999px);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-family, sans-serif);
  font-size: var(--font-size-xs, 12px);
  font-weight: var(--font-weight-medium, 500);
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}

.offset-reset-btn:hover:not(:disabled) {
  background: var(--color-error-subtle, rgba(239, 68, 68, 0.08));
  color: var(--color-error);
  border-color: var(--color-error);
}

.offset-reset-icon {
  display: inline-flex;
}

.offset-disabled-hint {
  padding: 8px 0 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs, 12px);
  display: none;
}

.offset-disabled-hint--visible {
  display: block;
}

/* === Subtitle Manager Panel (ADR-015 V2) ===
   Panel uses design tokens (theme-aware). Manager icon uses overlay colors
   (sits on video). Item active state uses role-colored border + bg. */
.subtitle-toolbar {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: var(--space-2, 8px);
  z-index: 1000001;
  pointer-events: none;
}

.subtitle-manager-icon {
  width: var(--sb-btn-size, 40px);
  height: var(--sb-btn-size, 40px);
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: rgba(30, 41, 59, var(--sb-bg-opacity, 0.2));
  color: rgba(241, 245, 249, var(--sb-text-opacity, 1));
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
  transition: background 150ms ease, color 150ms ease, transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.subtitle-manager-icon-feather {
  position: absolute;
  inset: -1.5px;
  border-radius: var(--radius-full, 9999px);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  background: rgba(15, 23, 42, 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  z-index: -1;
  transition: background 150ms ease;
  pointer-events: none;
}

.subtitle-manager-icon--active,
.subtitle-manager-icon:hover:not(.subtitle-manager-icon--active) {
  color: var(--color-primary);
}

.subtitle-manager-icon:hover:not(.subtitle-manager-icon--active) .subtitle-manager-icon-feather {
  background: rgba(15, 23, 42, 0.25);
}

.subtitle-manager-icon:active {
  transform: scale(0.88);
}

.subtitle-manager-icon:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.subtitle-manager-panel {
  display: none;
  position: absolute;
  top: 44px;
  left: 8px;
  z-index: 1000002;
  width: 320px;
  max-height: 360px;
  overflow-y: auto;
  background-color: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl, 12px);
  box-shadow: var(--shadow-md, none);
  padding: var(--space-1, 4px);
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  font-size: var(--font-size-base, 14px);
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: normal;
  text-align: left;
  text-shadow: none;
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
  line-height: 1.5;
}

.subtitle-manager-panel::-webkit-scrollbar {
  width: var(--space-2, 8px);
}

.subtitle-manager-panel::-webkit-scrollbar-track {
  background: var(--color-surface-hover);
  border-radius: var(--radius-full, 9999px);
}

.subtitle-manager-panel::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-full, 9999px);
  border: 2px solid var(--color-surface-hover);
}

.subtitle-manager-panel::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

.subtitle-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  margin: 0;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border-bottom: 1px solid var(--color-border-subtle);
  box-sizing: border-box;
}

.subtitle-manager-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--color-text);
}

.subtitle-manager-close {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  border-radius: var(--radius-sm, 6px);
  transition: background 150ms ease, color 150ms ease, transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
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
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  user-select: none;
  width: 100%;
  min-height: 40px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  line-height: 1.5;
  text-align: left;
  box-sizing: border-box;
  transition: background 150ms ease;
}

.subtitle-manager-section-header:hover {
  background: var(--color-surface-hover);
}

.subtitle-manager-section-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  margin: 0;
  color: var(--color-text-muted);
  transition: transform 150ms ease;
}

.subtitle-manager-section-label {
  font-size: var(--font-size-xs, 12px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.subtitle-manager-section-label--target {
  color: var(--color-primary);
}

.subtitle-manager-section-label--native {
  color: var(--color-warning);
}

.subtitle-manager-section-count {
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted);
}

.subtitle-manager-section-body {
  padding: 0 var(--space-1, 4px);
  display: block;
}

.subtitle-manager-item {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid transparent;
  background: transparent;
  transition: background 150ms ease;
}

.subtitle-manager-item:hover:not(.subtitle-manager-item--active) {
  background: var(--color-surface-hover);
}

.subtitle-manager-item--active {
  padding: calc(var(--space-2, 8px) - 1px) calc(var(--space-3, 12px) - 1px);
}

.subtitle-manager-item--active.subtitle-manager-item--target {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.subtitle-manager-item--active.subtitle-manager-item--native {
  border-color: var(--color-warning);
  background: var(--color-warning-subtle, rgba(245, 158, 11, 0.1));
}

.subtitle-manager-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--color-text-muted);
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
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-text-inverse, white);
}

.subtitle-manager-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.subtitle-manager-item-name {
  font-size: var(--font-size-sm, 13px);
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.subtitle-manager-item-meta {
  display: flex;
  gap: var(--space-2, 8px);
  align-items: center;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-text-muted);
}

.subtitle-manager-format-badge {
  padding: 1px 5px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-surface-hover);
  font-weight: 600;
  font-size: 9px;
  letter-spacing: 0.04em;
}

.subtitle-manager-asr-badge {
  padding: 1px 5px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-warning-subtle, rgba(245, 158, 11, 0.15));
  color: var(--color-warning);
  font-weight: 600;
  font-size: 9px;
  letter-spacing: 0.04em;
}

.subtitle-manager-imported-badge {
  color: var(--color-success);
  font-weight: 600;
}

.subtitle-manager-translated-badge {
  padding: 1px 5px;
  border-radius: var(--radius-sm, 6px);
  background: var(--color-warning-subtle, rgba(245, 158, 11, 0.15));
  color: var(--color-warning);
  font-weight: 600;
  font-size: 9px;
  letter-spacing: 0.04em;
}

.subtitle-manager-role-indicator {
  font-weight: 600;
}

.subtitle-manager-role-indicator--target {
  color: var(--color-primary);
}

.subtitle-manager-role-indicator--native {
  color: var(--color-warning);
}

/* === Panel toggle button (ADR-008 D1) ===
   Overlay appearance — sits on video, not theme-aware. */
.panel-toggle {
  position: absolute;
  right: 8px;
  top: 8px;
  width: var(--sb-btn-size, 40px);
  height: var(--sb-btn-size, 40px);
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: rgba(30, 41, 59, var(--sb-bg-opacity, 0.2));
  color: rgba(241, 245, 249, var(--sb-text-opacity, 1));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  isolation: isolate;
  z-index: 1000000;
  user-select: none;
  pointer-events: auto;
  transition: background 150ms ease, color 150ms ease, transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.panel-toggle:hover {
  color: var(--color-primary);
}

.panel-toggle:active {
  transform: scale(0.88);
}

.panel-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.panel-toggle-feather {
  position: absolute;
  inset: -1.5px;
  border-radius: var(--radius-full, 9999px);
  backdrop-filter: blur(1px);
  -webkit-backdrop-filter: blur(1px);
  background: rgba(15, 23, 42, 0.1);
  -webkit-mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  mask-image: radial-gradient(ellipse at center, black 55%, transparent 100%);
  z-index: -1;
  transition: background 150ms ease;
  pointer-events: none;
}

.panel-toggle:hover .panel-toggle-feather {
  background: rgba(15, 23, 42, 0.25);
}

/* === Subtitle track dropdown (overlay) ===
   Dark overlay colors intentional — sits on top of video. */
.subtitle-track-dropdown {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 999999;
  font-size: 12px;
  padding: 2px 4px;
  background-color: rgba(0, 0, 0, 0.7);
  color: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 4px;
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
  padding: 4px 12px;
  border-radius: 4px;
  pointer-events: auto;
  cursor: ns-resize;
  white-space: pre-wrap !important;
  line-height: 1.4 !important;
  max-width: 90%;
}

.subtitle-overlay[data-role="target"] {
  z-index: 999999;
}

.subtitle-overlay[data-role="native"] {
  z-index: 999998;
}

.subtitle-overlay-text {
  display: block;
  pointer-events: auto;
  user-select: text;
  cursor: text;
  line-height: 1.4 !important;
}

/* === Drag hint overlay ===
   Dark overlay colors intentional — sits on top of video. */
.subtitle-drag-hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 150, 255, 0.2);
  border: 3px dashed rgba(0, 150, 255, 0.8);
  border-radius: 8px;
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 999998;
  pointer-events: none;
  user-select: none;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  font-family: sans-serif;
}

.subtitle-drag-hint--visible {
  display: flex;
}

/* === Toast notification (UI v4) ===
   Theme-aware — uses design tokens. Variant color via CSS custom property. */
.subtitle-toast {
  position: absolute;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000003;
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--toast-variant-color, var(--color-info));
  border-radius: var(--radius-md, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-size: var(--font-size-sm, 13px);
  font-weight: 500;
  font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
  box-shadow: var(--shadow-md, none);
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  animation: subtitle-toast-in 0.2s ease;
}

.subtitle-toast-icon {
  color: var(--toast-variant-color, var(--color-info));
  display: inline-flex;
  flex-shrink: 0;
}

.subtitle-toast--fade-out {
  opacity: 0;
  transition: opacity 0.3s ease;
}

@keyframes subtitle-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;
