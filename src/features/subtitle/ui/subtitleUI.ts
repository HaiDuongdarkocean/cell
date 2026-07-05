import type { OverlayStyleConfig, TextShadowConfig } from '@/entities/subtitle';

// === Pure style helpers (ADR-013 D6) ===
// Logic ở pure function — testable 100%, no DOM side effect.

/**
 * Calculate Y-offset percent from pointer delta + container height.
 * Clamps result to [0, 95] and rounds to nearest integer.
 * Pure — no DOM access.
 */
export function calcYOffsetPercent(
  pointerDeltaY: number,
  containerHeight: number,
  currentOffset: number,
): number {
  if (containerHeight <= 0) return clamp(currentOffset, 0, 95);
  // Subtract: overlay anchored at `bottom%` (distance from bottom). Pointer Y
  // increases downward on screen, but bottom% increases upward. Drag up
  // (deltaY<0) → offset increases → subtitle moves up (natural drag direction).
  const deltaPercent = (pointerDeltaY / containerHeight) * 100;
  return clamp(Math.round(currentOffset - deltaPercent), 0, 95);
}

/**
 * Build CSS text-shadow string from config.
 * 3 preset (none/soft/cinema) + custom (offsetX/offsetY/blur/color).
 * Pure — no DOM access.
 */
export function buildTextShadow(config: TextShadowConfig): string {
  if (config.preset === 'none') return 'none';
  if (config.preset === 'soft') return `0 1px 2px ${config.color}`;
  if (config.preset === 'cinema') return `2px 2px 4px ${config.color}`;
  return `${config.offsetX}px ${config.offsetY}px ${config.blur}px ${config.color}`;
}

/**
 * Sanitize CSS font-family string.
 * Blocks url()/@import/expression()/javascript: (security — no font loading exploit).
 * Falls back to 'sans-serif' for empty/invalid input.
 * Pure — no DOM access.
 */
export function sanitizeFontFamily(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'sans-serif';
  // Block dangerous patterns (font loading exploit, XSS via expression)
  if (/url\(|@import|expression|javascript:/i.test(trimmed)) return 'sans-serif';
  return trimmed;
}

/**
 * Convert hex color + alpha to rgba string.
 * Supports 3-digit (#fff) and 6-digit (#ffffff) hex.
 * Falls back to rgba(0,0,0,alpha) for invalid hex.
 * Pure — no DOM access.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6) {
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  }
  // NaN guard — fallback to 0
  if (Number.isNaN(r)) r = 0;
  if (Number.isNaN(g)) g = 0;
  if (Number.isNaN(b)) b = 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Internal clamp helper. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// === Overlay layer (ADR-013 D1, ADR-015 D1-D3) ===
// 2 div độc lập (target + native), mỗi cái 1 text span.
// ADR-015: drag tích hợp trực tiếp vào overlay background (xóa handle button riêng).
// Text span giữ user-select: text + pointer-events: auto cho select text + tra cứu.

/**
 * Create 1 overlay layer độc lập (target OR native) — ADR-013 D1, ADR-015 D1-D3.
 * Returns overlay div + text span. Overlay is the drag target (background drag),
 * text span keeps select-text + dictionary lookup.
 *
 * @param role - 'target' | 'native'
 * @param config - Per-layer appearance (OverlayStyleConfig)
 * @param container - Video wrapper (overlay append here, fullscreen-safe)
 */
export function createOverlayLayer(
  role: 'target' | 'native',
  config: OverlayStyleConfig,
  container: HTMLElement,
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement } {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-role', role);
  overlay.setAttribute('data-testid', `subtitle-overlay-${role}`);

  // Base positioning: absolute in container, bottom-anchored (yOffset applies)
  overlay.style.position = 'absolute';
  overlay.style.left = '50%';
  overlay.style.transform = 'translateX(-50%)';
  overlay.style.padding = '4px 12px';
  overlay.style.borderRadius = '4px';
  // ADR-015 D1: overlay receives pointer events for background drag.
  // Text span keeps pointer-events: auto + user-select: text below.
  overlay.style.pointerEvents = 'auto';
  overlay.style.cursor = 'ns-resize'; // hover affordance — ADR-015 D1
  // G7: guard against host CSS leaking line-height / white-space and breaking
  // multi-line subtitle cues. Use !important because the overlay lives in a
  // hostile page and must keep its own typography regardless of site resets.
  overlay.style.setProperty('white-space', 'pre-wrap', 'important');
  overlay.style.setProperty('line-height', '1.4', 'important');
  overlay.style.maxWidth = '90%';
  overlay.style.zIndex = role === 'target' ? '999999' : '999998';

  // ARIA slider on overlay div (ADR-015 D2 — moved from handle button)
  overlay.setAttribute('role', 'slider');
  overlay.setAttribute('aria-label', `Drag to move ${role} subtitle`);
  overlay.setAttribute('aria-orientation', 'vertical');
  overlay.setAttribute('aria-valuemin', '0');
  overlay.setAttribute('aria-valuemax', '95');
  overlay.setAttribute('aria-valuenow', String(config.yOffsetPercent));

  // Text span: user-select text (copy word), pointer-events auto
  const textSpan = document.createElement('span');
  textSpan.setAttribute('data-testid', `overlay-${role}-text`);
  textSpan.style.display = 'block';
  textSpan.style.pointerEvents = 'auto';
  textSpan.style.userSelect = 'text';
  textSpan.style.cursor = 'text';
  // G7: line-height guard inherited from overlay, but set directly with
  // !important on the span as well to defeat any host selector targeting the span.
  textSpan.style.setProperty('line-height', '1.4', 'important');
  overlay.appendChild(textSpan);

  // Apply initial style
  applyStyle(config, overlay);

  // Hidden initially (cue sync will show when text arrives)
  overlay.style.display = 'none';

  container.appendChild(overlay);
  return { overlay, textSpan };
}

/**
 * Apply OverlayStyleConfig to overlay div via inline style — ADR-013 D6.
 * Thin wrapper: logic ở pure function (buildTextShadow, sanitizeFontFamily, hexToRgba).
 * O(1) set inline style, không recreate DOM.
 */
export function applyStyle(config: OverlayStyleConfig, overlay: HTMLDivElement): void {
  overlay.style.fontSize = `${config.fontSize}px`;
  overlay.style.color = config.textColor;
  overlay.style.backgroundColor = hexToRgba(config.backgroundColor, config.backgroundOpacity);
  overlay.style.opacity = String(config.textOpacity);
  overlay.style.textShadow = buildTextShadow(config.textShadow);
  overlay.style.fontFamily = sanitizeFontFamily(config.fontFamily);
  overlay.style.bottom = `${config.yOffsetPercent}%`;
  overlay.style.textAlign = config.horizontalAlign;
  // G7: re-apply line-height guard whenever style is refreshed; host CSS may
  // have overridden it via !important or high-specificity selectors.
  overlay.style.setProperty('line-height', '1.4', 'important');
  // Only hide when visible=false. When visible=true, do NOT force display:block —
  // display is managed by timeupdate (updateOverlayText/hideOverlay) based on
  // current cue. Forcing block here shows drag handle with no subtitle (bug fix).
  if (!config.visible) overlay.style.display = 'none';

  // ADR-015 D2: ARIA valuenow directly on overlay (role=slider moved from handle
  // button to overlay div). querySelector('[role="slider"]') would return null
  // because it doesn't match the element itself — set attribute directly.
  overlay.setAttribute('aria-valuenow', String(config.yOffsetPercent));
}

/**
 * Update overlay text and show it.
 * ADR-013: finds text span in overlay layer (data-testid="overlay-{role}-text").
 * Falls back to overlay.textContent if span not found (legacy compat).
 */
export function updateOverlayText(overlay: HTMLDivElement, text: string): void {
  const span = overlay.querySelector('span[data-testid]') as HTMLSpanElement | null;
  if (span) {
    span.textContent = text;
  } else {
    overlay.textContent = text;
  }
  overlay.style.display = 'block';
}

/**
 * Clear text and hide overlay.
 * Clears text span (bilingual-safe — each overlay layer has 1 span).
 */
export function hideOverlay(overlay: HTMLDivElement): void {
  const span = overlay.querySelector('span[data-testid]') as HTMLSpanElement | null;
  if (span) {
    span.textContent = '';
  }
  overlay.style.display = 'none';
}

/**
 * Remove overlay from DOM.
 */
export function removeOverlay(overlay: HTMLDivElement): void {
  overlay.remove();
}

/**
 * Create drag hint overlay — semi-transparent full-cover with dashed border.
 * Shown on dragenter, hidden on dragleave/drop.
 * ponytail: counter-based to avoid flicker from nested dragenter/dragleave events.
 */
export function createDragHint(container: HTMLElement): HTMLDivElement {
  const hint = document.createElement('div');
  hint.setAttribute('data-testid', 'subtitle-drag-hint');

  hint.style.position = 'absolute';
  hint.style.top = '0';
  hint.style.left = '0';
  hint.style.width = '100%';
  hint.style.height = '100%';
  hint.style.backgroundColor = 'rgba(0, 150, 255, 0.2)';
  hint.style.border = '3px dashed rgba(0, 150, 255, 0.8)';
  hint.style.borderRadius = '8px';
  hint.style.display = 'flex';
  hint.style.alignItems = 'center';
  hint.style.justifyContent = 'center';
  hint.style.zIndex = '999998';
  hint.style.pointerEvents = 'none';
  hint.style.userSelect = 'none';
  hint.style.fontSize = '18px';
  hint.style.color = '#ffffff';
  hint.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
  hint.style.fontFamily = 'sans-serif';
  hint.textContent = 'Drop subtitle file here';
  hint.style.display = 'none';

  container.appendChild(hint);
  return hint;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
}

const ICONS: Record<ToastVariant, string> = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-info)',
};

/**
 * Show a temporary toast notification at bottom-center of video (UI v4).
 * Matches docs/mockups/subtitle-selector-mockup.html: bottom 30%, theme tokens,
 * bordered card. Auto-hides after 3 seconds.
 * ponytail: position absolute in video parent (same pattern as overlay/dragHint),
 * not fixed viewport — toast stays anchored to video even on scroll.
 */
export function showToast(message: string, container: HTMLElement, options: ToastOptions = {}): void {
  const { variant = 'info' } = options;
  const color = VARIANT_COLORS[variant];

  const toast = document.createElement('div');
  toast.setAttribute('data-testid', 'subtitle-toast');
  toast.setAttribute('data-variant', variant);

  toast.style.cssText = `
    position: absolute;
    bottom: 30%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000003;
    background: var(--color-background);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-left: 3px solid ${color};
    border-radius: var(--radius-md, 8px);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    font-size: var(--font-size-sm, 13px);
    font-weight: 500;
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    animation: subtitle-toast-in 0.2s ease;
  `;

  const icon = document.createElement('span');
  icon.style.cssText = `color: ${color}; display: inline-flex; flex-shrink: 0;`;
  icon.innerHTML = ICONS[variant];
  toast.appendChild(icon);

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
