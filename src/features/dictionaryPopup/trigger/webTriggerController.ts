// webTriggerController — spec §4.6 P1.1: generic web-text selection/hover lookup.
//
// Works on any text node in the page (not just subtitle overlay).
// Two trigger modes:
// 1. Selection: user selects text → lookup the selection (verbatim, fallback=true).
// 2. Hover: user hovers a word → extract sentence from parent element + lookup.
//
// Same debounce + cancellation as subtitleTriggerController.
// Same LookupRequest contract — just different source (page DOM vs subtitle span).

import type { LookupRequest, TriggerMode } from '../types';
import { detectLangCode, nextRequestId } from './subtitleTriggerController';

/** Hover debounce for web text (same as subtitle: 150ms). */
const WEB_HOVER_DEBOUNCE_MS = 150;

/** Minimum selection length to trigger lookup. */
const MIN_SELECTION_LENGTH = 1;
/** Maximum selection length (avoid looking up whole paragraphs). */
const MAX_SELECTION_LENGTH = 100;

/**
 * Extract the sentence containing a text node + offset.
 * Walks up to the nearest block element, gets its text content,
 * and computes the cursor offset within that text.
 */
export function extractSentenceContext(
  textNode: Text,
  offsetInNode: number,
): { sentence: string; cursorOffset: number; term: string } | null {
  // Walk up to nearest block-level element.
  let block: HTMLElement | null = textNode.parentElement;
  while (block) {
    const display = getComputedStyle(block).display;
    if (display === 'block' || display === 'list-item' || display === 'table-cell' || block.tagName === 'P' || block.tagName === 'DIV' || block.tagName === 'LI' || block.tagName === 'H1' || block.tagName === 'H2' || block.tagName === 'H3' || block.tagName === 'H4' || block.tagName === 'H5' || block.tagName === 'H6') {
      break;
    }
    block = block.parentElement;
  }
  if (!block) return null;

  // Get the full text content of the block element.
  const fullText = block.textContent ?? '';
  if (!fullText.trim()) return null;

  // Compute the cursor offset within the block's text content.
  // We need to find where textNode's text starts within the block's textContent.
  // This is approximate — textContent concatenates all descendant text.
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let cursorOffset = 0;
  let currentText: Text | null;
  while ((currentText = walker.nextNode() as Text | null)) {
    if (currentText === textNode) {
      cursorOffset += offsetInNode;
      break;
    }
    cursorOffset += currentText.textContent?.length ?? 0;
  }

  // Extract the word at the cursor position.
  const word = extractWordAtOffset(fullText, cursorOffset);
  if (!word) return null;

  return {
    sentence: fullText,
    cursorOffset: word.start,
    term: word.text,
  };
}

/** Extract the word at a given UTF-16 offset in a string. */
export function extractWordAtOffset(text: string, offset: number): { text: string; start: number } | null {
  if (offset < 0 || offset >= text.length) return null;
  const ch = text[offset];
  if (!ch) return null;
  // Whitespace/punctuation at offset → no word.
  if (!/[\w\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) return null;
  // For CJK: single char is a "word" for triggering.
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
    return { text: ch, start: offset };
  }
  // For Latin: walk left + right to find word boundaries.
  let start = offset;
  while (start > 0 && /[\w]/.test(text[start - 1]!)) start--;
  let end = offset;
  while (end < text.length && /[\w]/.test(text[end]!)) end++;
  const word = text.slice(start, end);
  if (!word) return null;
  return { text: word, start };
}

/** Build a LookupRequest from a text selection. */
export function buildSelectionLookupRequest(selection: Selection): LookupRequest | null {
  const text = selection.toString().trim();
  if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) return null;

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer as Text;
  if (textNode.nodeType !== Node.TEXT_NODE) return null;

  const langCode = detectLangCode(text);
  const block = textNode.parentElement?.closest('p, div, li, h1, h2, h3, h4, h5, h6, span');
  const sentence = block?.textContent ?? text;

  return {
    term: text,
    langCode,
    contextSentence: sentence,
    cursorOffset: 0,
    fallback: true,
  };
}

/** Build a LookupRequest from a hover event on a text node. */
export function buildHoverLookupRequest(textNode: Text, offset: number): LookupRequest | null {
  const ctx = extractSentenceContext(textNode, offset);
  if (!ctx) return null;
  const langCode = detectLangCode(ctx.sentence);
  return {
    term: ctx.term,
    langCode,
    contextSentence: ctx.sentence,
    cursorOffset: ctx.cursorOffset,
    fallback: false,
  };
}

/** Check if a modifier key matches the trigger mode. */
function modifierMatches(mode: TriggerMode, e: MouseEvent): boolean {
  switch (mode) {
    case 'hover-ctrl': return e.ctrlKey;
    case 'hover-shift': return e.shiftKey;
    case 'hover-alt': return e.altKey;
    default: return true;
  }
}

export interface WebTriggerDeps {
  readonly triggerMode: TriggerMode;
  readonly onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect) => void;
  readonly onCancel: (requestId: string) => void;
}

/**
 * Web trigger controller — listens to selectionchange + mousemove on
 * document.body. Triggers lookup on:
 * - click mode: text selection (mouseup with non-empty selection).
 * - hover mode: hover over text (mouseenter on text node via mousemove).
 *
 * Same debounce + cancellation as SubtitleTriggerController.
 */
export class WebTriggerController {
  private readonly deps: WebTriggerDeps;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightRequestId: string | null = null;
  private readonly boundMouseUp: (e: MouseEvent) => void;
  private readonly boundMouseMove: (e: MouseEvent) => void;
  private readonly boundSelectionChange: () => void;
  private lastHoveredTerm: string | null = null;

  constructor(deps: WebTriggerDeps) {
    this.deps = deps;
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundSelectionChange = this.onSelectionChange.bind(this);
  }

  /** Attach listeners to document. */
  attach(): void {
    if (this.deps.triggerMode === 'click') {
      document.addEventListener('mouseup', this.boundMouseUp);
      document.addEventListener('selectionchange', this.boundSelectionChange);
    } else {
      document.addEventListener('mousemove', this.boundMouseMove);
      // Also allow selection in hover modes.
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  /** Remove all listeners + clear timers. */
  detach(): void {
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
    document.removeEventListener('mouseup', this.boundMouseUp);
    document.removeEventListener('mousemove', this.boundMouseMove);
    document.removeEventListener('selectionchange', this.boundSelectionChange);
    this.cancelInFlight();
  }

  /** Update trigger mode. */
  setTriggerMode(mode: TriggerMode): void {
    this.detach();
    // Re-attach with new mode (hack: reassign deps.triggerMode not possible,
    // so caller should create a new controller. For now, just re-attach.)
    // ponytail: upgrade — accept mode in constructor only, caller recreates.
    if (mode === 'click') {
      document.addEventListener('mouseup', this.boundMouseUp);
      document.addEventListener('selectionchange', this.boundSelectionChange);
    } else {
      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  cancelInFlight(): void {
    if (this.inFlightRequestId) {
      this.deps.onCancel(this.inFlightRequestId);
      this.inFlightRequestId = null;
    }
  }

  isCurrentRequestId(requestId: string): boolean {
    return this.inFlightRequestId === requestId;
  }

  clearRequestId(requestId: string): void {
    if (this.inFlightRequestId === requestId) {
      this.inFlightRequestId = null;
    }
  }

  private onMouseUp(_e: MouseEvent): void {
    // Selection-based lookup (click mode or fallback in hover mode).
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (!text) return;
    const request = buildSelectionLookupRequest(selection);
    if (!request) return;
    const range = selection.getRangeAt(0);
    const rect = safeGetRangeRect(range);
    this.dispatchLookup(request, rect);
  }

  private onSelectionChange(): void {
    // Clear hover timer when selection changes (user is selecting text).
    if (this.hoverTimer) { clearTimeout(this.hoverTimer); this.hoverTimer = null; }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!modifierMatches(this.deps.triggerMode, e)) return;
    // Get the text node under the cursor.
    const target = e.target as HTMLElement | null;
    if (!target) return;
    // Skip our own popup + subtitle overlay (handled by subtitleTriggerController).
    if (target.closest('.js-cell-popup-host')) return;

    // Get the text node + offset at the cursor position.
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;
    const textNode = range.startContainer as Text;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const offset = range.startOffset;

    // Build the request (debounced).
    const request = buildHoverLookupRequest(textNode, offset);
    if (!request) return;
    // Skip if same term as last hover (avoid re-triggering).
    if (request.term === this.lastHoveredTerm) return;
    this.lastHoveredTerm = request.term;

    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      const rect = safeGetRangeRect(range);
      this.dispatchLookup(request, rect);
    }, WEB_HOVER_DEBOUNCE_MS);
  }

  private dispatchLookup(request: LookupRequest, anchorRect: DOMRect): void {
    this.cancelInFlight();
    const requestId = nextRequestId();
    this.inFlightRequestId = requestId;
    this.deps.onLookup(request, requestId, anchorRect);
  }
}

/** Safely get a DOMRect from a Range (jsdom fallback). */
function safeGetRangeRect(range: Range): DOMRect {
  try {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0) return rect;
  } catch { /* jsdom */ }
  const parent = range.startContainer.parentElement;
  return parent?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
}
