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
  overlay.textContent = '';

  // Append to video parent (so it overlays the video)
  video.parentElement?.appendChild(overlay);
  return overlay;
}

/**
 * Update overlay text and show it.
 */
export function updateOverlayText(overlay: HTMLDivElement, text: string): void {
  overlay.textContent = text;
  overlay.style.display = 'block';
}

/**
 * Clear text and hide overlay.
 */
export function hideOverlay(overlay: HTMLDivElement): void {
  overlay.textContent = '';
  overlay.style.display = 'none';
}

/**
 * Remove overlay from DOM.
 */
export function removeOverlay(overlay: HTMLDivElement): void {
  overlay.remove();
}
