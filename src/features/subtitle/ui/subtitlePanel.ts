// Subtitle panel — toggle button + seek helper.
// ADR-008 D1: panel UI moved to Chrome Side Panel (src/entrypoints/sidepanel/).
// Only the overlay toggle button + seek helper remain in content script.
//
// Design-system sync (2026-07-02): panel-toggle, subtitle-manager-icon, and
// subtitle-import-button share the same DS §2 Icon Button pattern —
//   box: 40×40, --radius-full (circular), no border at rest, no shadow
//   hover: --color-surface-hover bg
//   focus: outline 2px --color-primary, offset 2px
// Reference: design-system.md §2 Icon Button.

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
  // Side panel toggle icon — rounded rect 60/40 split (sync with navClusterIcons style)
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:65% !important;height:65% !important;display:block;fill:none !important"><rect x="1.5" y="2" width="21" height="20" rx="2.5"/><line x1="14.4" y1="2" x2="14.4" y2="22"/></svg>`;
  btn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 8px;
    width: var(--sb-btn-size, 40px);
    height: var(--sb-btn-size, 40px);
    /* Overlay appearance: no border, feathered backdrop, bg + text opacity from settings. */
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
  `;
  btn.style.setProperty('border', 'none', 'important');
  // Feathered backdrop — ::before mở rộng + blur 1px + mask radial fade
  const feather = document.createElement('span');
  feather.style.cssText = `
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
    pointer-events: none;
  `;
  btn.appendChild(feather);

  // Hover — icon đổi màu primary (no border feedback)
  btn.addEventListener('mouseenter', () => {
    btn.style.color = 'var(--color-primary, #60a5fa)';
    feather.style.background = 'rgba(15, 23, 42, 0.25)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.color = 'rgba(241, 245, 249, var(--sb-text-opacity, 1))';
    feather.style.background = 'rgba(15, 23, 42, 0.1)';
  });
  // Focus ring handled by CSS :focus-visible (WCAG 2.4.7) — no JS outline.

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
