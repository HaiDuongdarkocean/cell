// Subtitle panel — toggle button + seek helper.
// ADR-008 D1: panel UI moved to Chrome Side Panel (src/entrypoints/sidepanel/).
// Only the overlay toggle button + seek helper remain in content script.
//
// Design-system sync (2026-07-02): panel-toggle, subtitle-manager-icon, and
// subtitle-import-button share the same hover/focus pattern —
//   box: 32×32, --radius-md, --color-surface bg, 1px solid --color-border
//   hover: --color-surface-hover bg + --color-border-focus border
//   focus: outline 2px --color-border-focus, offset 2px
// Reference: subtitleImport.ts createImportButton.

import { seekVideo, mountToWatchVideo } from './netflixPlayback';

/**
 * Create toggle button to show/hide panel (now opens Side Panel).
 * Appended to container, positioned at top-right corner.
 */
export function createToggleButton(container: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.setAttribute('data-testid', 'panel-toggle');
  btn.setAttribute('aria-label', 'Toggle subtitle panel');
  btn.setAttribute('title', 'Toggle subtitle panel');
  btn.textContent = '☰';
  btn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 8px;
    width: 32px;
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 8px);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    z-index: 1000000;
    user-select: none;
    pointer-events: auto;
    transition: border-color 150ms ease, background 150ms ease, color 150ms ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  `;

  // Hover — align with subtitle-import-button + subtitle-manager-icon
  btn.addEventListener('mouseenter', () => {
    btn.style.borderColor = 'var(--color-border-focus)';
    btn.style.background = 'var(--color-surface-hover)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = 'var(--color-border)';
    btn.style.background = 'var(--color-surface)';
  });
  // Focus — align with subtitle-import-button
  btn.addEventListener('focus', () => {
    btn.style.outline = '2px solid var(--color-border-focus)';
    btn.style.outlineOffset = '2px';
  });
  btn.addEventListener('blur', () => {
    btn.style.outline = 'none';
  });

  container.appendChild(btn);
  // ADR-031: Netflix z-index fix — toggle button must sit above Netflix overlays.
  mountToWatchVideo(btn, container);
  return btn;
}

/**
 * Seek video so the overlay DISPLAYS the given cue (ADR-019 sync).
 * Overlay shows cue C when video.currentTime = (C.start - offsetMs) / 1000,
 * because findCurrentLine searches at effective = currentTime + offsetMs.
 * Default offsetMs=0 → raw cue.start/1000 (backward compatible).
 * @param video - Target video element
 * @param cue - Cue to seek to (uses cue.start in milliseconds → seconds)
 * @param offsetMs - Subtitle offset in ms (default 0). Seek target shifts by -offsetMs.
 */
export function seekToCue(video: HTMLVideoElement, cue: { start: number }, offsetMs: number = 0): void {
  // ADR-030: route through seekVideo to avoid Netflix M7375.
  seekVideo(video, (cue.start - offsetMs) / 1000);
}
