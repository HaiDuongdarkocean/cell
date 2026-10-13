// wordHighlight — spec §3: temporary word highlight in page DOM.
//
// Marks the target word/token visually when a lookup is triggered, so the user
// sees which word the popup is about. Lives in host page DOM (not Shadow DOM)
// because it highlights the page's own text.
//
// Three modes for each highlighter:
// 1. Element mode: add `.js-Tihoka-word-highlight` class to an existing element
//    (subtitle token span). No DOM structure change.
// 2. DOM wrap mode (primary for Range): wrap the range contents in
//    `<span class="js-Tihoka-word-highlight">`. Restores original DOM on clear.
// 3. Overlay mode (fallback for Range): when surroundContents throws or the
//    wrapper is empty (word split by inline tags, range collapsed, or host page
//    mutates the DOM), create absolute-positioned overlay divs based on
//    Range.getClientRects(). No DOM text mutation — safe for host pages with
//    hidden responsive copies.
//
// Knowledge applied:
// - host-css-overrides-injected-elements: !important on background-color +
//   color + explicit reset (padding, margin, box-sizing) to survive host CSS.
// - inline-style-leak-state-transition: clear() removes everything show() set.
// - css-js-hook-separate-from-data-attribute: `.js-Tihoka-*` class for JS hooks.

import tokensJson from '@/shared/styles/tokens.json';
import { findThemeCarrier } from '@/features/theme';

type HighlightConfig = {
  readonly styleId: string;
  readonly highlightClass: string;
  readonly overlayClass: string;
  readonly buildCss: () => string;
};

const WORD_CONFIG: HighlightConfig = {
  styleId: 'Tihoka-word-highlight-style',
  highlightClass: 'js-Tihoka-word-highlight',
  overlayClass: 'js-Tihoka-word-highlight-overlay',
  buildCss(): string {
    const lightSubtle = tokensJson.derived.light['color-primary-subtle'];
    const darkSubtle = tokensJson.derived.dark['color-primary-subtle'];
    const radiusXs = tokensJson.static.radius.xs;
    const duration100 = tokensJson.static.motion['duration-100'];
    // --Tihoka-highlight-subtle is resolved live from the theme carrier in
    // show() (preset or custom palette); --color-primary-subtle resolves for
    // spans inside a themed boundary (subtitle shadow); literals are the
    // base-palette fallback for unthemed page DOM.
    return `
.${WORD_CONFIG.highlightClass} {
  background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${lightSubtle})) !important;
  color: inherit !important;
  border-radius: ${radiusXs} !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${WORD_CONFIG.highlightClass} {
    background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${darkSubtle})) !important;
  }
}
[data-theme="dark"] .${WORD_CONFIG.highlightClass} {
  background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${darkSubtle})) !important;
}
.${WORD_CONFIG.overlayClass} {
  position: absolute !important;
  background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${lightSubtle})) !important;
  border-radius: ${radiusXs} !important;
  pointer-events: none !important;
  z-index: var(--z-overlay-secondary) !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${WORD_CONFIG.overlayClass} {
    background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${darkSubtle})) !important;
  }
}
[data-theme="dark"] .${WORD_CONFIG.overlayClass} {
  background-color: var(--Tihoka-highlight-subtle, var(--color-primary-subtle, ${darkSubtle})) !important;
}
@media (prefers-reduced-motion: reduce) {
  .${WORD_CONFIG.highlightClass},
  .${WORD_CONFIG.overlayClass} {
    transition: none !important;
  }
}
`.trim();
  },
};

/** Inject the highlight <style> into a document or shadow root (idempotent).
 *  Shadow roots need their own copy — document styles do not cross the shadow
 *  boundary (subtitle cue text lives inside #Tihoka-subtitle-root). */
function injectStyle(config: HighlightConfig, root: Document | ShadowRoot = document): void {
  if (root.getElementById(config.styleId)) return;
  const style = document.createElement('style');
  style.id = config.styleId;
  style.textContent = config.buildCss();
  const parent = root instanceof ShadowRoot ? root : (root.head ?? root.documentElement);
  parent.appendChild(style);
}

/** Remove the highlight <style> from document.head (idempotent). */
function removeStyle(config: HighlightConfig): void {
  document.getElementById(config.styleId)?.remove();
}

/** Highlight target: either a DOM Range (web text) or an HTMLElement (subtitle token). */
export type HighlightTarget = Range | HTMLElement;

export interface TextHighlight {
  /** Highlight a DOM element (subtitle token span) or a Range (web text). */
  show(target: HighlightTarget): void;
  /** Clear active highlight and restore original DOM. */
  clear(): void;
  /** Remove all DOM artifacts (style element + highlights). */
  destroy(): void;
}

/** Internal highlight factory shared by word and sentence highlighters. */
function createTextHighlight(config: HighlightConfig): TextHighlight {
  let activeMark: HTMLElement | null = null;
  let activeElement: HTMLElement | null = null;
  let activeOverlays: HTMLElement[] = [];

  function clear(): void {
    // Clear DOM wrap (<span>).
    if (activeMark) {
      const parent = activeMark.parentNode;
      if (parent) {
        // Move children back out before removing the mark.
        while (activeMark.firstChild) {
          parent.insertBefore(activeMark.firstChild, activeMark);
        }
        parent.removeChild(activeMark);
      }
      activeMark = null;
    }
    // Clear element mode (remove class).
    if (activeElement) {
      activeElement.classList.remove(config.highlightClass);
      activeElement = null;
    }
    // Clear overlay divs.
    for (const overlay of activeOverlays) {
      overlay.remove();
    }
    activeOverlays = [];
  }

  function applyCarrierSubtle(el: HTMLElement): void {
    const subtle = resolveCarrierSubtle();
    if (subtle) el.style.setProperty('--Tihoka-highlight-subtle', subtle);
  }

  function showOverlay(range: Range): void {
    if (!document.body) return; // guard: content scripts may fire before </body>
    // jsdom doesn't implement getClientRects — guard against non-function.
    if (typeof range.getClientRects !== 'function') return;
    const rects = range.getClientRects();
    for (const rect of rects) {
      const overlay = document.createElement('div');
      overlay.className = config.overlayClass;
      applyCarrierSubtle(overlay);
      overlay.style.setProperty('left', `${rect.left + window.scrollX}px`, 'important');
      overlay.style.setProperty('top', `${rect.top + window.scrollY}px`, 'important');
      overlay.style.setProperty('width', `${rect.width}px`, 'important');
      overlay.style.setProperty('height', `${rect.height}px`, 'important');
      document.body.appendChild(overlay);
      activeOverlays.push(overlay);
    }
  }

  function show(target: HighlightTarget): void {
    injectStyle(config);
    clear();

    if (target instanceof HTMLElement) {
      // Element mode: just add the class.
      target.classList.add(config.highlightClass);
      applyCarrierSubtle(target);
      activeElement = target;
      return;
    }

    // Range mode: try DOM wrap first, fallback to overlay.
    const range = target as Range;
    const rangeRoot = range.startContainer.getRootNode();
    if (rangeRoot instanceof ShadowRoot) injectStyle(config, rangeRoot);
    try {
      const wrapper = document.createElement('span');
      wrapper.className = config.highlightClass;
      applyCarrierSubtle(wrapper);
      range.surroundContents(wrapper);
      // Guard against empty wrappers caused by collapsed ranges or host DOM
      // mutation: if surroundContents produced an empty node, remove it and
      // fall back to overlay so the user still sees a highlight.
      if (wrapper.textContent === '' && wrapper.childNodes.length === 0) {
        wrapper.remove();
        showOverlay(range);
      } else {
        activeMark = wrapper;
      }
    } catch {
      // surroundContents throws if range spans element boundaries or is
      // collapsed. Use overlay mode (non-destructive): extractContents +
      // insertNode is destructive and can break host page CSS (e.g. hidden
      // responsive copies become visible inside the wrapper, causing duplicate
      // text).
      showOverlay(range);
    }
  }

  function destroy(): void {
    clear();
    removeStyle(config);
  }

  return { show, clear, destroy };
}

/** Create a WordHighlight instance. Call show/clear to toggle highlight. */
export type WordHighlight = TextHighlight;

/** Resolve the live --color-primary-subtle from the theme carrier so page-DOM
 *  highlights (outside any themed boundary) still follow the active palette. */
function resolveCarrierSubtle(): string | null {
  const carrier = findThemeCarrier();
  if (carrier === document.body && !carrier.hasAttribute('data-theme')) return null;
  const value = getComputedStyle(carrier).getPropertyValue('--color-primary-subtle').trim();
  return value || null;
}

export function createWordHighlight(): WordHighlight {
  return createTextHighlight(WORD_CONFIG);
}
