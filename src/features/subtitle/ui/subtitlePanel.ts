// Subtitle panel — toggle button + seek helper.
// ADR-008 D1: panel UI moved to Chrome Side Panel (src/sidepanel/).
// Only the overlay toggle button + seek helper remain in content script.

/**
 * Create toggle button to show/hide panel (now opens Side Panel).
 * Appended to container, positioned at top-right corner.
 */
export function createToggleButton(container: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.setAttribute('data-testid', 'panel-toggle');
  btn.setAttribute('aria-label', 'Toggle subtitle panel');
  btn.textContent = '☰';
  btn.style.position = 'absolute';
  btn.style.right = '8px';
  btn.style.top = '8px';
  btn.style.width = '32px';
  btn.style.height = '32px';
  btn.style.backgroundColor = 'rgba(20, 20, 20, 0.85)';
  btn.style.color = '#ffffff';
  btn.style.border = 'none';
  btn.style.borderRadius = '6px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '16px';
  btn.style.zIndex = '1000000';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';

  container.appendChild(btn);
  return btn;
}

/**
 * Seek video to cue start time.
 * @param video - Target video element
 * @param cue - Cue to seek to (uses cue.start in milliseconds → seconds)
 */
export function seekToCue(video: HTMLVideoElement, cue: { start: number }): void {
  video.currentTime = cue.start / 1000;
}
