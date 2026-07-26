// wordHighlight — spec §3: temporary word/sentence highlight in page DOM.
//
// Marks the target word/token and its containing sentence visually when a lookup
// is triggered, so the user sees which word the popup is about and the surrounding
// context. Lives in host page DOM (not Shadow DOM) because it highlights the page's
// own text.
//
// Three modes for each highlighter:
// 1. Element mode: add `.js-cell-word-highlight` class to an existing element
//    (subtitle token span). No DOM structure change.
// 2. DOM wrap mode (primary for Range): wrap the range contents in
//    `<mark class="js-cell-word-highlight">`. Restores original DOM on clear.
// 3. Overlay mode (fallback for Range): when surroundContents throws
//    (word split by inline tags or sentence spans multiple elements),
//    create absolute-positioned overlay divs based on Range.getClientRects().
//    No DOM text mutation — safe for host pages with hidden responsive copies.
//
// Knowledge applied:
// - host-css-overrides-injected-elements: !important on background-color +
//   color + explicit reset (padding, margin, box-sizing) to survive host CSS.
// - inline-style-leak-state-transition: clear() removes everything show() set.
// - css-js-hook-separate-from-data-attribute: `.js-cell-*` class for JS hooks.

import tokensJson from '@/shared/styles/tokens.json';
import { hexToRgb } from '@/features/theme/logic/colorGenerator';

type HighlightConfig = {
  readonly styleId: string;
  readonly highlightClass: string;
  readonly overlayClass: string;
  readonly buildCss: () => string;
};

const RGBA_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/;

/** Build a translucent variant of a color (hex or rgba) at a new alpha. */
function alphaVariant(baseColor: string, alpha: number): string {
  const hexMatch = baseColor.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const { r, g, b } = hexToRgb(baseColor);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgbaMatch = RGBA_RE.exec(baseColor);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return baseColor;
}

const WORD_CONFIG: HighlightConfig = {
  styleId: 'cell-word-highlight-style',
  highlightClass: 'js-cell-word-highlight',
  overlayClass: 'js-cell-word-highlight-overlay',
  buildCss(): string {
    const lightSubtle = tokensJson.derived.light['color-primary-subtle'];
    const darkSubtle = tokensJson.derived.dark['color-primary-subtle'];
    const radiusXs = tokensJson.static.radius.xs;
    const duration100 = tokensJson.static.motion['duration-100'];
    return `
.${WORD_CONFIG.highlightClass} {
  background-color: ${lightSubtle} !important;
  color: inherit !important;
  border-radius: ${radiusXs} !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${WORD_CONFIG.highlightClass} {
    background-color: ${darkSubtle} !important;
  }
}
[data-theme="dark"] .${WORD_CONFIG.highlightClass} {
  background-color: ${darkSubtle} !important;
}
.${WORD_CONFIG.overlayClass} {
  position: absolute !important;
  background-color: ${lightSubtle} !important;
  border-radius: ${radiusXs} !important;
  pointer-events: none !important;
  z-index: 2147483646 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${WORD_CONFIG.overlayClass} {
    background-color: ${darkSubtle} !important;
  }
}
[data-theme="dark"] .${WORD_CONFIG.overlayClass} {
  background-color: ${darkSubtle} !important;
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

const SENTENCE_CONFIG: HighlightConfig = {
  styleId: 'cell-sentence-highlight-style',
  highlightClass: 'js-cell-sentence-highlight',
  overlayClass: 'js-cell-sentence-highlight-overlay',
  buildCss(): string {
    // Derived from color-primary-subtle at roughly half opacity so the word
    // highlight stays visually dominant and the sentence is a subtle halo.
    const lightBase = tokensJson.derived.light['color-primary-subtle'];
    const darkBase = tokensJson.derived.dark['color-primary-subtle'];
    const lightSubtle = alphaVariant(lightBase, 0.05);
    const darkSubtle = alphaVariant(darkBase, 0.08);
    const radiusXs = tokensJson.static.radius.xs;
    const duration100 = tokensJson.static.motion['duration-100'];
    return `
.${SENTENCE_CONFIG.highlightClass} {
  background-color: ${lightSubtle} !important;
  color: inherit !important;
  border-radius: ${radiusXs} !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${SENTENCE_CONFIG.highlightClass} {
    background-color: ${darkSubtle} !important;
  }
}
[data-theme="dark"] .${SENTENCE_CONFIG.highlightClass} {
  background-color: ${darkSubtle} !important;
}
.${SENTENCE_CONFIG.overlayClass} {
  position: absolute !important;
  background-color: ${lightSubtle} !important;
  border-radius: ${radiusXs} !important;
  pointer-events: none !important;
  z-index: 2147483646 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${SENTENCE_CONFIG.overlayClass} {
    background-color: ${darkSubtle} !important;
  }
}
[data-theme="dark"] .${SENTENCE_CONFIG.overlayClass} {
  background-color: ${darkSubtle} !important;
}
@media (prefers-reduced-motion: reduce) {
  .${SENTENCE_CONFIG.highlightClass},
  .${SENTENCE_CONFIG.overlayClass} {
    transition: none !important;
  }
}
`.trim();
  },
};

/** Inject the highlight <style> into document.head (idempotent). */
function injectStyle(config: HighlightConfig): void {
  if (document.getElementById(config.styleId)) return;
  const style = document.createElement('style');
  style.id = config.styleId;
  style.textContent = config.buildCss();
  (document.head ?? document.documentElement).appendChild(style);
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
    // Clear DOM wrap (<mark>).
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

  function showOverlay(range: Range): void {
    if (!document.body) return; // guard: content scripts may fire before </body>
    // jsdom doesn't implement getClientRects — guard against non-function.
    if (typeof range.getClientRects !== 'function') return;
    const rects = range.getClientRects();
    for (const rect of rects) {
      const overlay = document.createElement('div');
      overlay.className = config.overlayClass;
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
      activeElement = target;
      return;
    }

    // Range mode: try DOM wrap first, fallback to overlay.
    const range = target as Range;
    try {
      const mark = document.createElement('mark');
      mark.className = config.highlightClass;
      range.surroundContents(mark);
      activeMark = mark;
    } catch {
      // surroundContents throws if range spans element boundaries.
      // Use overlay mode (non-destructive): extractContents + insertNode
      // is destructive and can break host page CSS (e.g. hidden responsive
      // copies become visible inside the mark, causing duplicate text).
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
export function createWordHighlight(): WordHighlight {
  return createTextHighlight(WORD_CONFIG);
}

/** Create a SentenceHighlight instance. Call show/clear to toggle highlight. */
export type SentenceHighlight = TextHighlight;
export function createSentenceHighlight(): SentenceHighlight {
  return createTextHighlight(SENTENCE_CONFIG);
}
