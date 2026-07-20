export const BADGE_STYLE_ID = 'cell-token-badge-style';

/**
 * CSS for the Shadow DOM mini badge + panel.
 *
 * Uses --color-* / --space-* / --radius-* tokens. The caller is expected to
 * inject tokens.css (with :root remapped to :host) before this stylesheet.
 */
export function buildTokenBadgeCss(): string {
  return `
:host {
  font-family: var(--font-family, sans-serif);
  color: var(--color-foreground, #0f172a);
}

.cell-token-fab {
  position: fixed !important;
  right: var(--space-4, 16px) !important;
  bottom: var(--space-4, 16px) !important;
  width: 48px !important;
  height: 48px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: var(--radius-full, 9999px) !important;
  background: var(--color-primary, #2563eb) !important;
  color: var(--color-primary-foreground, #ffffff) !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  cursor: pointer !important;
  z-index: 2147483646 !important;
  box-shadow: none !important;
  outline: none !important;
}

.cell-token-fab:hover {
  background: var(--color-primary-hover, #1d4ed8) !important;
}

.cell-token-fab svg {
  width: 22px !important;
  height: 22px !important;
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 2 !important;
}

.cell-token-panel {
  position: fixed !important;
  right: var(--space-4, 16px) !important;
  bottom: 72px !important;
  width: 260px !important;
  max-width: calc(100vw - var(--space-8, 32px)) !important;
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
  font-size: var(--font-size-sm, 13px) !important;
  font-weight: var(--font-weight-semibold, 600) !important;
}

.cell-token-panel__close {
  width: 28px !important;
  height: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: var(--radius-full, 9999px) !important;
  background: transparent !important;
  border: none !important;
  color: var(--color-muted-foreground, #64748b) !important;
  cursor: pointer !important;
  padding: 0 !important;
  margin: 0 !important;
}

.cell-token-panel__close:hover {
  background: var(--color-surface-hover, #f1f5f9) !important;
  color: var(--color-foreground, #0f172a) !important;
}

.cell-token-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  font-size: var(--font-size-sm, 13px) !important;
}

.cell-token-row__label {
  color: var(--color-foreground, #0f172a) !important;
}

.cell-token-toggle {
  appearance: none !important;
  width: 40px !important;
  height: 22px !important;
  border-radius: 11px !important;
  background: var(--color-muted, #f1f5f9) !important;
  position: relative !important;
  cursor: pointer !important;
  outline: none !important;
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.cell-token-toggle::after {
  content: '' !important;
  position: absolute !important;
  top: 2px !important;
  left: 2px !important;
  width: 18px !important;
  height: 18px !important;
  border-radius: 50% !important;
  background: var(--color-background, #ffffff) !important;
  transition: transform var(--duration-fast, 150ms) ease !important;
}

.cell-token-toggle:checked {
  background: var(--color-primary, #2563eb) !important;
}

.cell-token-toggle:checked::after {
  transform: translateX(18px) !important;
}

.cell-token-action {
  width: 100% !important;
  padding: var(--space-2, 8px) var(--space-3, 12px) !important;
  border-radius: var(--radius-md, 10px) !important;
  background: var(--color-primary, #2563eb) !important;
  color: var(--color-primary-foreground, #ffffff) !important;
  border: none !important;
  font-size: var(--font-size-sm, 13px) !important;
  font-weight: var(--font-weight-medium, 500) !important;
  cursor: pointer !important;
  text-align: center !important;
}

.cell-token-action:hover {
  background: var(--color-primary-hover, #1d4ed8) !important;
}
`.trim();
}
