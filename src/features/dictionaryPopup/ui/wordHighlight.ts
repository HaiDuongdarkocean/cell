// wordHighlight — spec §3: temporary word highlight in page DOM.
//
// Marks the target word/token visually when a lookup is triggered, so the
// user sees which word the popup is about. Lives in host page DOM (not
// Shadow DOM) because it highlights the page's own text.
//
// Three modes:
// 1. Element mode: add `.js-cell-word-highlight` class to an existing element
//    (subtitle token span). No DOM structure change.
// 2. DOM wrap mode (primary for Range): wrap the range contents in
//    `<mark class="js-cell-word-highlight">`. Restores original DOM on clear.
// 3. Overlay mode (fallback for Range): when surroundContents throws
//    (word split by inline tags), create absolute-positioned overlay divs
//    based on Range.getClientRects(). No DOM text mutation.
//
// Knowledge applied:
// - host-css-overrides-injected-elements: !important on background-color +
//   color + explicit reset (padding, margin, box-sizing) to survive host CSS.
// - inline-style-leak-state-transition: clear() removes everything show() set.
// - css-js-hook-separate-from-data-attribute: `.js-cell-*` class for JS hooks.

import tokensJson from '@/shared/styles/tokens.json';

const HIGHLIGHT_STYLE_ID = 'cell-word-highlight-style';
const HIGHLIGHT_CLASS = 'js-cell-word-highlight';
const OVERLAY_CLASS = 'js-cell-word-highlight-overlay';

/** Build the CSS string from tokens.json (host page has no tokens.css). */
function buildHighlightCss(): string {
  const lightSubtle = tokensJson.derived.light['color-primary-subtle'] ?? 'rgba(37, 99, 235, 0.1)';
  const darkSubtle = tokensJson.derived.dark['color-primary-subtle'] ?? 'rgba(96, 165, 250, 0.15)';
  const radiusXs = tokensJson.static.radius.xs ?? '2px';
  const duration100 = tokensJson.static.motion['duration-100'] ?? '100ms';
  return `
.${HIGHLIGHT_CLASS} {
  background-color: ${lightSubtle} !important;
  color: inherit !important;
  border-radius: ${radiusXs} !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  transition: background-color ${duration100} ease !important;
}
@media (prefers-color-scheme: dark) {
  .${HIGHLIGHT_CLASS} {
    background-color: ${darkSubtle} !important;
  }
}
.${OVERLAY_CLASS} {
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
  .${OVERLAY_CLASS} {
    background-color: ${darkSubtle} !important;
  }
}
`.trim();
}

/** Inject the highlight <style> into document.head (idempotent). */
function injectHighlightStyle(): void {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = buildHighlightCss();
  (document.head ?? document.documentElement).appendChild(style);
}

/** Remove the highlight <style> from document.head (idempotent). */
function removeHighlightStyle(): void {
  document.getElementById(HIGHLIGHT_STYLE_ID)?.remove();
}

/** Highlight target: either a DOM Range (web text) or an HTMLElement (subtitle token). */
export type HighlightTarget = Range | HTMLElement;

export interface WordHighlight {
  /** Highlight a DOM element (subtitle token span) or a Range (web text). */
  show(target: HighlightTarget): void;
  /** Clear active highlight and restore original DOM. */
  clear(): void;
  /** Remove all DOM artifacts (style element + highlights). */
  destroy(): void;
}

/** Create a WordHighlight instance. Call show/clear to toggle highlight. */
export function createWordHighlight(): WordHighlight {
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
      activeElement.classList.remove(HIGHLIGHT_CLASS);
      activeElement = null;
    }
    // Clear overlay divs.
    for (const overlay of activeOverlays) {
      overlay.remove();
    }
    activeOverlays = [];
  }

  function show(target: HighlightTarget): void {
    injectHighlightStyle();
    clear();

    if (target instanceof HTMLElement) {
      // Element mode: just add the class.
      target.classList.add(HIGHLIGHT_CLASS);
      activeElement = target;
      return;
    }

    // Range mode: try DOM wrap first, fallback to overlay.
    const range = target as Range;
    try {
      const mark = document.createElement('mark');
      mark.className = HIGHLIGHT_CLASS;
      range.surroundContents(mark);
      activeMark = mark;
    } catch {
      // surroundContents throws if range spans element boundaries.
      // Fallback: try extractContents + insertNode (handles partial wraps).
      try {
        const contents = range.extractContents();
        const mark = document.createElement('mark');
        mark.className = HIGHLIGHT_CLASS;
        mark.appendChild(contents);
        range.insertNode(mark);
        activeMark = mark;
      } catch {
        // Final fallback: overlay divs based on getClientRects.
        showOverlay(range);
      }
    }
  }

  function showOverlay(range: Range): void {
    if (!document.body) return; // guard: content scripts may fire before </body>
    const rects = range.getClientRects();
    for (const rect of rects) {
      const overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      overlay.style.setProperty('left', `${rect.left + window.scrollX}px`, 'important');
      overlay.style.setProperty('top', `${rect.top + window.scrollY}px`, 'important');
      overlay.style.setProperty('width', `${rect.width}px`, 'important');
      overlay.style.setProperty('height', `${rect.height}px`, 'important');
      document.body.appendChild(overlay);
      activeOverlays.push(overlay);
    }
  }

  function destroy(): void {
    clear();
    removeHighlightStyle();
  }

  return { show, clear, destroy };
}
