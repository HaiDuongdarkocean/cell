import { extractSentenceContext, extractWordAtOffset, createWordRange } from '../sentence/sentenceModule';
import { detectLangCode } from '../trigger/subtitleTriggerController';
import type { LookupRequest } from '../types';

export interface ResolvedWord {
  readonly request: LookupRequest;
  readonly range: Range;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** @returns true when the element (or any ancestor) belongs to the orbital badge. */
function isBadgeOwned(element: Element | null): boolean {
  if (!element) return false;
  if (element.getAttribute('data-cell-orbital-badge') === 'true') return true;
  return element.closest('[data-cell-orbital-badge="true"]') !== null;
}

/** Find the first page element at a point that is not owned by the badge. */
function findTargetElement(tip: Point): Element | null {
  const elements = document.elementsFromPoint(tip.x, tip.y);
  for (const element of elements) {
    if (!isBadgeOwned(element)) return element;
  }
  return null;
}

/** Get the deepest text node + offset at a point using caret position APIs. */
function caretAtPoint(tip: Point): { textNode: Text; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(tip.x, tip.y);
    if (pos?.offsetNode?.nodeType === Node.TEXT_NODE) {
      return { textNode: pos.offsetNode as Text, offset: pos.offset };
    }
  } else if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(tip.x, tip.y);
    if (range?.startContainer?.nodeType === Node.TEXT_NODE) {
      return { textNode: range.startContainer as Text, offset: range.startOffset };
    }
  }
  return null;
}

/**
 * Resolve the word under the pointer tip.
 *
 * 1. Uses document.elementsFromPoint and skips elements owned by the orbital badge.
 * 2. Uses caret position APIs to find the text node + offset under the tip.
 * 3. Extracts sentence context and word from that text node (SSOT sentenceModule).
 *
 * @returns ResolvedWord or null when the tip is over non-text or only the badge.
 */
export function resolveWordAtTip(tip: Point): ResolvedWord | null {
  const target = findTargetElement(tip);
  if (!target) return null;

  const caret = caretAtPoint(tip);
  if (!caret) return null;

  const { textNode, offset } = caret;
  const ctx = extractSentenceContext(textNode, offset);
  if (!ctx) return null;

  const range = createWordRange(textNode, offset, ctx);
  if (!range) return null;

  const request: LookupRequest = {
    term: ctx.term,
    langCode: detectLangCode(ctx.sentence),
    contextSentence: ctx.sentence,
    cursorOffset: ctx.cursorOffset,
    fallback: false,
  };

  return { request, range };
}

/** Extract a word at a UTF-16 offset (re-exported for tests). */
export { extractWordAtOffset };
