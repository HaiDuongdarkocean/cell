import type { OverlayConfig, OverlayStyleConfig, TextShadowConfig } from '../types/subtitle';

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
  const deltaPercent = (pointerDeltaY / containerHeight) * 100;
  return clamp(Math.round(currentOffset + deltaPercent), 0, 95);
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

// === Overlay layer (ADR-013 D1) ===
// 2 div độc lập (target + native), mỗi cái 1 text span + 1 drag handle.
// Refactor từ createOverlay (1 div 2 span) — kept tạm cho backward compat (Task 5 xóa).

/** SVG icon move-vertical (2 mũi tên lên-xuống) — Lucide-style. */
const MOVE_VERTICAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 18 12 22 16 18"/><polyline points="8 6 12 2 16 6"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;

/**
 * Create 1 overlay layer độc lập (target OR native) — ADR-013 D1.
 * Returns overlay div + text span + drag handle (handle logic wire ở Task 4).
 *
 * @param role - 'target' | 'native'
 * @param config - Per-layer appearance (OverlayStyleConfig)
 * @param container - Video wrapper (overlay append here, fullscreen-safe)
 */
export function createOverlayLayer(
  role: 'target' | 'native',
  config: OverlayStyleConfig,
  container: HTMLElement,
): { overlay: HTMLDivElement; textSpan: HTMLSpanElement; dragHandle: HTMLButtonElement } {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-role', role);
  overlay.setAttribute('data-testid', `subtitle-overlay-${role}`);

  // Base positioning: absolute in container, bottom-anchored (yOffset applies)
  overlay.style.position = 'absolute';
  overlay.style.left = '50%';
  overlay.style.transform = 'translateX(-50%)';
  overlay.style.padding = '4px 12px';
  overlay.style.borderRadius = '4px';
  overlay.style.pointerEvents = 'none'; // container passes clicks; handle + span re-enable
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.maxWidth = '90%';
  overlay.style.zIndex = role === 'target' ? '999999' : '999998';

  // Text span: user-select text (copy word), pointer-events auto
  const textSpan = document.createElement('span');
  textSpan.setAttribute('data-testid', `overlay-${role}-text`);
  textSpan.style.display = 'block';
  textSpan.style.pointerEvents = 'auto';
  textSpan.style.userSelect = 'text';
  textSpan.style.cursor = 'text';
  overlay.appendChild(textSpan);

  // Drag handle: icon move-vertical, pointer-events auto, aria slider
  // ponytail: handle position left edge, hardcode v1 (ceiling: configurable v2)
  const dragHandle = document.createElement('button');
  dragHandle.setAttribute('data-testid', `overlay-${role}-drag-handle`);
  dragHandle.setAttribute('aria-label', 'Drag to move subtitle');
  dragHandle.setAttribute('role', 'slider');
  dragHandle.setAttribute('aria-orientation', 'vertical');
  dragHandle.setAttribute('aria-valuemin', '0');
  dragHandle.setAttribute('aria-valuemax', '95');
  dragHandle.setAttribute('aria-valuenow', String(config.yOffsetPercent));
  dragHandle.style.position = 'absolute';
  dragHandle.style.left = '-28px';
  dragHandle.style.top = '50%';
  dragHandle.style.transform = 'translateY(-50%)';
  dragHandle.style.width = '24px';
  dragHandle.style.height = '24px';
  dragHandle.style.padding = '0';
  dragHandle.style.border = '1px solid rgba(255,255,255,0.4)';
  dragHandle.style.borderRadius = '4px';
  dragHandle.style.backgroundColor = 'rgba(0,0,0,0.6)';
  dragHandle.style.color = '#ffffff';
  dragHandle.style.cursor = 'ns-resize';
  dragHandle.style.pointerEvents = 'auto';
  dragHandle.style.display = 'flex';
  dragHandle.style.alignItems = 'center';
  dragHandle.style.justifyContent = 'center';
  dragHandle.style.zIndex = '1000001';
  dragHandle.innerHTML = MOVE_VERTICAL_SVG;
  overlay.appendChild(dragHandle);

  // Apply initial style
  applyStyle(config, overlay);

  // Hidden initially (cue sync will show when text arrives)
  overlay.style.display = 'none';

  container.appendChild(overlay);
  return { overlay, textSpan, dragHandle };
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
  overlay.style.display = config.visible ? 'block' : 'none';

  // Update drag handle aria-valuenow if handle exists
  const handle = overlay.querySelector('[role="slider"]') as HTMLButtonElement | null;
  if (handle) {
    handle.setAttribute('aria-valuenow', String(config.yOffsetPercent));
  }
}

/**
 * Create subtitle overlay div appended to video parent.
 * Minimal overlay — just a styled div for displaying subtitle text.
 *
 * @param video - Target video element
 * @param config - Overlay configuration (fontSize, position, colors)
 * @returns Overlay div element
 */
export function createOverlay(container: HTMLElement, config: OverlayConfig): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-testid', 'subtitle-overlay');

  // Style: absolute positioned over video, bottom by default.
  // The container is the video wrapper (video area) so the overlay stays within
  // the video bounds in both normal and fullscreen modes.
  overlay.style.position = 'absolute';
  overlay.style.left = '50%';
  overlay.style.transform = 'translateX(-50%)';
  overlay.style.fontSize = `${config.fontSize}px`;
  overlay.style.color = config.textColor;
  overlay.style.backgroundColor = config.backgroundColor;
  overlay.style.padding = '4px 12px';
  overlay.style.borderRadius = '4px';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.textAlign = 'center';
  overlay.style.maxWidth = '90%';

  // Inner spans: target (prominent) + native (muted, below target).
  // Container keeps pointer-events: none so background padding passes clicks
  // through to video controls beneath. Only the text itself is interactive.
  // Bilingual layout (ADR-007 D1): target on top, native below at 0.85em.
  const targetSpan = document.createElement('span');
  targetSpan.setAttribute('data-testid', 'overlay-target');
  targetSpan.style.display = 'block';
  targetSpan.style.pointerEvents = 'auto';
  targetSpan.style.userSelect = 'text';
  targetSpan.style.cursor = 'text';
  overlay.appendChild(targetSpan);

  const nativeSpan = document.createElement('span');
  nativeSpan.setAttribute('data-testid', 'overlay-native');
  nativeSpan.style.display = 'block';
  nativeSpan.style.pointerEvents = 'auto';
  nativeSpan.style.userSelect = 'text';
  nativeSpan.style.cursor = 'text';
  nativeSpan.style.fontSize = '0.85em';
  nativeSpan.style.opacity = '0.85';
  nativeSpan.style.marginTop = '2px';
  overlay.appendChild(nativeSpan);

  // Position: bottom/top/center
  if (config.position === 'bottom') {
    overlay.style.bottom = '10%';
  } else if (config.position === 'top') {
    overlay.style.top = '10%';
  } else {
    overlay.style.top = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
  }

  // Hidden initially
  overlay.style.display = 'none';

  // Append to the video wrapper (so it overlays the video area)
  container.appendChild(overlay);
  return overlay;
}

/**
 * Update overlay text and show it (single-line mode, backward compat).
 * Sets text on the target span (first span), not on container.
 */
export function updateOverlayText(overlay: HTMLDivElement, text: string): void {
  const span = overlay.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement | null;
  if (span) {
    span.textContent = text;
  } else {
    overlay.textContent = text;
  }
  overlay.style.display = 'block';
}

/**
 * Update overlay with bilingual text (target + native) and show it.
 * Target on top (prominent), native below (muted 0.85em). Either may be
 * empty string — the empty span is hidden so layout collapses cleanly.
 * When both are empty, the overlay is hidden via `hideOverlay`.
 */
export function updateOverlayBilingual(
  overlay: HTMLDivElement,
  targetText: string,
  nativeText: string,
): void {
  if (!targetText && !nativeText) {
    hideOverlay(overlay);
    return;
  }
  const targetSpan = overlay.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement | null;
  const nativeSpan = overlay.querySelector('[data-testid="overlay-native"]') as HTMLSpanElement | null;
  if (targetSpan) {
    targetSpan.textContent = targetText;
    targetSpan.style.display = targetText ? 'block' : 'none';
  }
  if (nativeSpan) {
    nativeSpan.textContent = nativeText;
    nativeSpan.style.display = nativeText ? 'block' : 'none';
  }
  overlay.style.display = 'block';
}

/**
 * Clear text and hide overlay.
 * Clears both target + native spans (bilingual-safe).
 */
export function hideOverlay(overlay: HTMLDivElement): void {
  const targetSpan = overlay.querySelector('[data-testid="overlay-target"]') as HTMLSpanElement | null;
  const nativeSpan = overlay.querySelector('[data-testid="overlay-native"]') as HTMLSpanElement | null;
  if (targetSpan) {
    targetSpan.textContent = '';
  }
  if (nativeSpan) {
    nativeSpan.textContent = '';
    nativeSpan.style.display = 'block';
  }
  if (targetSpan) {
    targetSpan.style.display = 'block';
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

/**
 * Show a temporary toast notification at bottom-center of video.
 * Auto-hides after 3 seconds.
 * ponytail: position absolute in video parent (same pattern as overlay/dragHint),
 * not fixed viewport — toast stays anchored to video even on scroll.
 */
export function showToast(message: string, container: HTMLElement): void {
  const toast = document.createElement('div');
  toast.setAttribute('data-testid', 'subtitle-toast');
  toast.textContent = message;

  toast.style.position = 'absolute';
  toast.style.bottom = '5%';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(20, 20, 20, 0.9)';
  toast.style.color = '#ffffff';
  toast.style.padding = '8px 16px';
  toast.style.borderRadius = '6px';
  toast.style.fontSize = '14px';
  toast.style.fontFamily = 'sans-serif';
  toast.style.zIndex = '1000000';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.transition = 'opacity 0.3s';
  toast.style.opacity = '1';
  toast.style.pointerEvents = 'none';
  toast.style.userSelect = 'none';
  toast.style.whiteSpace = 'nowrap';

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
