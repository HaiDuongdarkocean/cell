import type { OverlayConfig } from '../types/subtitle';

/**
 * Create subtitle overlay div appended to video parent.
 * Minimal overlay — just a styled div for displaying subtitle text.
 *
 * @param video - Target video element
 * @param config - Overlay configuration (fontSize, position, colors)
 * @returns Overlay div element
 */
export function createOverlay(video: HTMLVideoElement, config: OverlayConfig): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-testid', 'subtitle-overlay');

  // Style: absolute positioned over video, bottom by default
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

  // Append to video parent (so it overlays the video)
  video.parentElement?.appendChild(overlay);
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
export function createDragHint(video: HTMLVideoElement): HTMLDivElement {
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

  video.parentElement?.appendChild(hint);
  return hint;
}

/**
 * Show a temporary toast notification at bottom-center of video.
 * Auto-hides after 3 seconds.
 * ponytail: position absolute in video parent (same pattern as overlay/dragHint),
 * not fixed viewport — toast stays anchored to video even on scroll.
 */
export function showToast(message: string, video: HTMLVideoElement): void {
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

  video.parentElement?.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
