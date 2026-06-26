// Floating subtitle panel UI — inline DOM + inline styles (ADR-005 D1).
// ponytail: follow existing overlay pattern (subtitleUI.ts), no Shadow DOM.
// Class prefix: vd-subtitle-panel-* to avoid CSS collision with page.

import type { BilingualCue } from '@/types/media';

/**
 * Create floating panel appended to video parent.
 * Inline DOM + inline styles, semi-transparent, draggable via header.
 * Hidden initially — caller shows via toggle button.
 */
export function createPanel(video: HTMLVideoElement): HTMLDivElement {
  const panel = document.createElement('div');
  panel.setAttribute('data-testid', 'subtitle-panel');
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Subtitle list');
  panel.className = 'vd-subtitle-panel';

  // Panel container styles
  panel.style.position = 'absolute';
  panel.style.right = '0px';
  panel.style.top = '0px';
  panel.style.width = '280px';
  panel.style.maxHeight = '100%';
  panel.style.backgroundColor = 'rgba(20, 20, 20, 0.85)';
  panel.style.color = '#ffffff';
  panel.style.fontFamily = 'sans-serif';
  panel.style.borderRadius = '8px 0 0 8px';
  panel.style.zIndex = '999999';
  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';

  // Header: title + drag handle + close button
  const header = document.createElement('div');
  header.setAttribute('data-testid', 'panel-header');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.padding = '8px 12px';
  header.style.borderBottom = '1px solid rgba(255,255,255,0.15)';
  header.style.cursor = 'grab';
  header.style.userSelect = 'none';

  const title = document.createElement('span');
  title.textContent = 'Subtitles';
  title.style.flex = '1';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  header.appendChild(title);

  const dragHandle = document.createElement('span');
  dragHandle.setAttribute('data-testid', 'panel-drag-handle');
  dragHandle.textContent = '⋮⋮';
  dragHandle.style.marginRight = '8px';
  dragHandle.style.cursor = 'grab';
  dragHandle.style.opacity = '0.6';
  header.appendChild(dragHandle);

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-testid', 'panel-close');
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#ffffff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.padding = '0 4px';
  closeBtn.style.opacity = '0.7';
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Body: scrollable cue list
  const body = document.createElement('div');
  body.setAttribute('data-testid', 'panel-body');
  body.style.overflowY = 'auto';
  body.style.flex = '1';
  body.style.padding = '4px 0';
  body.style.maxHeight = '400px';
  panel.appendChild(body);

  video.parentElement?.appendChild(panel);
  return panel;
}

/** Format milliseconds to HH:MM:SS timestamp string. */
function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const millis = ms % 1000;
  const pad = (n: number) => n.toString().padStart(2, '0');
  // ponytail: show millis only if non-zero — avoids clutter for whole-second cues
  const msStr = millis > 0 ? `.${String(millis).padStart(3, '0')}` : '';
  return `${pad(h)}:${pad(m)}:${pad(s)}${msStr}`;
}

/**
 * Render cue list items in panel body.
 * Each item: timestamp (clickable) + target text (prominent) + native text (muted).
 * Clears previous content before rendering.
 */
export function renderCueList(panel: HTMLDivElement, cues: BilingualCue[]): void {
  const body = panel.querySelector('[data-testid="panel-body"]');
  if (!body) return;

  body.innerHTML = '';

  for (const cue of cues) {
    const item = document.createElement('div');
    item.setAttribute('data-testid', 'cue-item');
    item.setAttribute('data-cue-index', String(cue.index));
    item.style.padding = '6px 12px';
    item.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
    item.style.cursor = 'pointer';

    // Timestamp (clickable → seek)
    const timestamp = document.createElement('span');
    timestamp.setAttribute('data-testid', 'cue-timestamp');
    timestamp.setAttribute('data-cue-index', String(cue.index));
    timestamp.textContent = formatTimestamp(cue.start);
    timestamp.style.display = 'block';
    timestamp.style.fontSize = '11px';
    timestamp.style.color = 'rgba(255, 255, 255, 0.5)';
    timestamp.style.cursor = 'pointer';
    timestamp.style.marginBottom = '2px';
    item.appendChild(timestamp);

    // Target text (prominent)
    const targetText = document.createElement('div');
    targetText.setAttribute('data-testid', 'cue-target-text');
    targetText.textContent = cue.targetText;
    targetText.style.fontSize = '14px';
    targetText.style.color = '#ffffff';
    targetText.style.lineHeight = '1.3';
    item.appendChild(targetText);

    // Native text (muted) — only if non-empty
    const nativeText = document.createElement('div');
    nativeText.setAttribute('data-testid', 'cue-native-text');
    nativeText.textContent = cue.nativeText;
    nativeText.style.fontSize = '12px';
    nativeText.style.color = 'rgba(255, 255, 255, 0.6)';
    nativeText.style.lineHeight = '1.3';
    nativeText.style.marginTop = '2px';
    item.appendChild(nativeText);

    body.appendChild(item);
  }
}

/**
 * Create toggle button to show/hide panel.
 * Appended to video parent, positioned at top-right corner.
 */
export function createToggleButton(video: HTMLVideoElement): HTMLButtonElement {
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

  video.parentElement?.appendChild(btn);
  return btn;
}

/**
 * Switch panel position between left and right.
 * Clears the opposite side and sets the new side to '0px'.
 */
export function switchPanelPosition(panel: HTMLDivElement, side: 'left' | 'right'): void {
  if (side === 'left') {
    panel.style.left = '0px';
    panel.style.right = '';
    panel.style.borderRadius = '0 8px 8px 0';
  } else {
    panel.style.right = '0px';
    panel.style.left = '';
    panel.style.borderRadius = '8px 0 0 8px';
  }
}

/** CSS background color for highlighted (current) cue. */
const HIGHLIGHT_BG = 'rgba(0, 150, 255, 0.3)';

/**
 * Highlight the current cue item by index.
 * Removes highlight from all other items first.
 */
export function highlightCue(panel: HTMLDivElement, cueIndex: number): void {
  const body = panel.querySelector('[data-testid="panel-body"]');
  if (!body) return;

  // Clear all highlights
  const items = body.querySelectorAll('[data-testid="cue-item"]');
  items.forEach((item) => {
    (item as HTMLElement).style.backgroundColor = '';
  });

  // Highlight target cue
  const target = body.querySelector(`[data-cue-index="${cueIndex}"]`);
  if (target) {
    (target as HTMLElement).style.backgroundColor = HIGHLIGHT_BG;
  }
}

/**
 * Scroll the cue item into view in the panel body.
 * Uses native scrollIntoView with smooth behavior.
 */
export function scrollToCue(panel: HTMLDivElement, cueIndex: number): void {
  const body = panel.querySelector('[data-testid="panel-body"]');
  if (!body) return;

  const target = body.querySelector(`[data-cue-index="${cueIndex}"]`);
  if (target) {
    (target as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Seek video to cue start time.
 * @param video - Target video element
 * @param cue - Cue to seek to (uses cue.start in milliseconds → seconds)
 */
export function seekToCue(video: HTMLVideoElement, cue: { start: number }): void {
  video.currentTime = cue.start / 1000;
}

/** Threshold: below this count, render all cues (skip observer overhead). */
const LAZY_THRESHOLD = 50;
/** Initial buffer: render this many cues at top on first paint. */
const LAZY_INITIAL_BUFFER = 10;

/**
 * Render cue list with lazy loading via IntersectionObserver.
 * ADR-005 D4: fallback to renderCueList if < 50 cues (skip observer overhead).
 *
 * Lazy mode: creates placeholder divs for all cues, fills initial buffer,
 * then IntersectionObserver fills placeholders as they scroll into view.
 *
 * @param panel - Panel element with body
 * @param cues - Bilingual cues to render
 * @returns Observer if lazy mode was used, null if fallback (render all)
 */
export function renderCueListLazy(
  panel: HTMLDivElement,
  cues: BilingualCue[],
): IntersectionObserver | null {
  // Fallback: small list → render all, no observer
  if (cues.length < LAZY_THRESHOLD) {
    renderCueList(panel, cues);
    return null;
  }

  const body = panel.querySelector('[data-testid="panel-body"]');
  if (!body) return null;

  body.innerHTML = '';

  // Create placeholders for all cues
  for (const cue of cues) {
    const placeholder = document.createElement('div');
    placeholder.setAttribute('data-testid', 'cue-placeholder');
    placeholder.setAttribute('data-cue-index', String(cue.index));
    placeholder.style.padding = '6px 12px';
    placeholder.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
    placeholder.style.minHeight = '40px';
    body.appendChild(placeholder);
  }

  // Fill initial buffer (first N items)
  const fillCue = (cue: BilingualCue, placeholder: HTMLElement): void => {
    placeholder.setAttribute('data-testid', 'cue-item');
    placeholder.innerHTML = '';

    const timestamp = document.createElement('span');
    timestamp.setAttribute('data-testid', 'cue-timestamp');
    timestamp.setAttribute('data-cue-index', String(cue.index));
    timestamp.textContent = formatTimestamp(cue.start);
    timestamp.style.display = 'block';
    timestamp.style.fontSize = '11px';
    timestamp.style.color = 'rgba(255, 255, 255, 0.5)';
    timestamp.style.cursor = 'pointer';
    timestamp.style.marginBottom = '2px';
    placeholder.appendChild(timestamp);

    const targetText = document.createElement('div');
    targetText.setAttribute('data-testid', 'cue-target-text');
    targetText.textContent = cue.targetText;
    targetText.style.fontSize = '14px';
    targetText.style.color = '#ffffff';
    targetText.style.lineHeight = '1.3';
    placeholder.appendChild(targetText);

    const nativeText = document.createElement('div');
    nativeText.setAttribute('data-testid', 'cue-native-text');
    nativeText.textContent = cue.nativeText;
    nativeText.style.fontSize = '12px';
    nativeText.style.color = 'rgba(255, 255, 255, 0.6)';
    nativeText.style.lineHeight = '1.3';
    nativeText.style.marginTop = '2px';
    placeholder.appendChild(nativeText);
  };

  // Fill initial buffer
  const placeholders = body.querySelectorAll('[data-testid="cue-placeholder"]');
  cues.slice(0, LAZY_INITIAL_BUFFER).forEach((cue, i) => {
    fillCue(cue, placeholders[i] as HTMLElement);
  });

  // Set up IntersectionObserver for lazy fill (if available)
  if (typeof IntersectionObserver === 'undefined') {
    // ponytail: jsdom doesn't have IntersectionObserver — leave placeholders
    // unfilled. In real browser, observer fills them on scroll.
    return null;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          if (el.getAttribute('data-testid') === 'cue-placeholder') {
            const idx = parseInt(el.getAttribute('data-cue-index') ?? '0', 10) - 1;
            if (idx >= 0 && idx < cues.length) {
              fillCue(cues[idx], el);
              observer.unobserve(el);
            }
          }
        }
      }
    },
    { root: body as HTMLElement, rootMargin: '100px' },
  );

  // Observe remaining placeholders
  placeholders.forEach((p, i) => {
    if (i >= LAZY_INITIAL_BUFFER) {
      observer.observe(p);
    }
  });

  return observer;
}
