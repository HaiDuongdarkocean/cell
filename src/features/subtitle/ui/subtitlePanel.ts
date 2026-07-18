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

import { ICON_CATALOG } from '@/shared/icons';
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
  btn.innerHTML = ICON_CATALOG.sidePanel.svg.replace(
    '<svg ',
    '<svg style="width:65% !important;height:65% !important;display:block;fill:none !important" ',
  );
  btn.className = 'panel-toggle';
  // Feathered backdrop — ::before mở rộng + blur 1px + mask radial fade
  const feather = document.createElement('span');
  feather.className = 'panel-toggle-feather';
  btn.appendChild(feather);

  // Hover + focus handled by CSS :hover and :focus-visible (WCAG 2.4.7) — no JS handlers.

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
