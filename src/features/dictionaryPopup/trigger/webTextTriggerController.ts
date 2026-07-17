// webTextTriggerController — spec §5.2 P1: web text lookup trigger.
// Select text on web page → build LookupRequest → dispatch to same lookup pipeline.
// Ponytail: hover-on-arbitrary-DOM-text skipped (fragile, low ROI vs selection).
// Upgrade: hover mode = wrap text node under cursor into temporary token span.

import type { LookupRequest, TriggerMode } from '../types';
import { detectLangCode } from './subtitleTriggerController';
import { nextRequestId } from './subtitleTriggerController';

export interface WebTextTriggerDeps {
  readonly triggerMode: TriggerMode;
  readonly onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect) => void;
  readonly onCancel: (requestId: string) => void;
}

/**
 * Web text trigger — listens to mouseup on document, checks for text selection,
 * builds a LookupRequest from the selected text, and dispatches to the lookup
 * pipeline. Auto-detects sentence context from the selection's closest block
 * element (paragraph, div, li, etc.).
 *
 * Usage:
 *   const ctrl = new WebTextTriggerController({
 *     triggerMode: 'click',
 *     onLookup: (req, id, rect) => { ... },
 *     onCancel: (id) => { ... },
 *   });
 *   ctrl.attach();
 *   ctrl.detach();
 */
export class WebTextTriggerController {
  private readonly deps: WebTextTriggerDeps;
  private inFlightRequestId: string | null = null;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundKeyDown: (e: KeyboardEvent) => void;

  constructor(deps: WebTextTriggerDeps) {
    this.deps = deps;
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
  }

  /** Attach document-level listeners. */
  attach(): void {
    document.addEventListener('mouseup', this.boundMouseUp);
    // In hover+modifier modes, also allow key-triggered lookup on selection.
    if (this.deps.triggerMode.startsWith('hover-')) {
      document.addEventListener('keydown', this.boundKeyDown);
    }
  }

  /** Remove listeners. */
  detach(): void {
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('keydown', this.boundKeyDown);
  }

  /** Update trigger mode. */
  setTriggerMode(mode: TriggerMode): void {
    this.detach();
    (this.deps as { triggerMode: TriggerMode }).triggerMode = mode;
    this.attach();
  }

  private onMouseUp(e: MouseEvent): void {
    // Ignore clicks inside the popup's Shadow DOM host.
    const target = e.target as Node | null;
    if (target && target.getRootNode() instanceof ShadowRoot) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text || text.length > 200) return; // skip very long selections

    // In hover+modifier modes, require the modifier key.
    if (this.deps.triggerMode.startsWith('hover-')) {
      // For modifier modes, mouseup alone isn't enough — user must hold modifier.
      // But mouseup doesn't have modifier info reliably; rely on keydown handler.
      return;
    }

    this.dispatchFromSelection(text, selection);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.deps.triggerMode.startsWith('hover-')) return;
    const modifierMatch =
      (this.deps.triggerMode === 'hover-ctrl' && e.ctrlKey) ||
      (this.deps.triggerMode === 'hover-shift' && e.shiftKey) ||
      (this.deps.triggerMode === 'hover-alt' && e.altKey);
    if (!modifierMatch) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text || text.length > 200) return;

    this.dispatchFromSelection(text, selection);
  }

  private dispatchFromSelection(text: string, selection: Selection): void {
    // Cancel any in-flight request.
    if (this.inFlightRequestId) {
      this.deps.onCancel(this.inFlightRequestId);
      this.inFlightRequestId = null;
    }

    const langCode = detectLangCode(text);
    // Extract sentence context from the closest block ancestor.
    const range = selection.getRangeAt(0);
    const block = findClosestBlock(range.commonAncestorContainer);
    const contextSentence = block?.textContent?.trim() ?? text;

    const request: LookupRequest = {
      term: text,
      langCode,
      contextSentence,
      cursorOffset: 0,
      fallback: false,
    };
    const requestId = nextRequestId();
    this.inFlightRequestId = requestId;

    // jsdom doesn't implement range.getBoundingClientRect — use anchor
    // element rect as fallback (real browsers give proper Range rect).
    const anchorEl = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as HTMLElement
      : range.commonAncestorContainer.parentElement;
    let rect: DOMRect;
    try {
      rect = range.getBoundingClientRect();
      if (rect.width === 0 && anchorEl) rect = anchorEl.getBoundingClientRect();
    } catch {
      rect = anchorEl?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    }
    this.deps.onLookup(request, requestId, rect);
  }

  /** Check if a LOOKUP_RESULT's requestId matches. */
  isCurrentRequestId(requestId: string): boolean {
    return this.inFlightRequestId === requestId;
  }

  /** Clear the in-flight requestId after receiving a result. */
  clearRequestId(requestId: string): void {
    if (this.inFlightRequestId === requestId) {
      this.inFlightRequestId = null;
    }
  }

  /** Cancel and clear in-flight request. */
  cancelInFlight(): void {
    if (this.inFlightRequestId) {
      this.deps.onCancel(this.inFlightRequestId);
      this.inFlightRequestId = null;
    }
  }
}

/** Block-level tags for sentence context extraction. */
const BLOCK_TAGS = new Set([
  'p', 'div', 'li', 'blockquote', 'td', 'th', 'section', 'article',
  'main', 'aside', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

/** Find the closest block-level ancestor of a node (tag-based, no getComputedStyle). */
function findClosestBlock(node: Node): HTMLElement | null {
  let current: Node | null = node.nodeType === Node.ELEMENT_NODE
    ? node
    : node.parentElement;
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement;
      if (BLOCK_TAGS.has(el.tagName.toLowerCase())) {
        return el;
      }
    }
    current = current.parentElement;
  }
  return null;
}
