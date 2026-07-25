import { extractWordAtOffset, resolveWordAtPoint } from '../sentence/sentenceModule';
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

/**
 * Resolve the word under the pointer tip via the SSOT hybrid lookup algorithm
 * (caret fast-path + nearest-word char-scan + geometry fallback). See
 * `resolveWordAtPoint` in sentenceModule for the algorithm.
 *
 * The orbital badge floats above the page; `resolveWordAtPoint`'s default
 * caret resolver uses `elementsFromPoint`-aware fallback so the badge's own
 * shadow DOM does not block resolution. For sites where the badge covers the
 * tip, callers should pass a `getCaretRange` that disables the badge's
 * pointer-events first.
 *
 * @returns ResolvedWord or null when the tip is over non-text or only the badge.
 */
export function resolveWordAtTip(tip: Point): ResolvedWord | null {
  const resolved = resolveWordAtPoint(tip.x, tip.y);
  if (!resolved) return null;

  const request: LookupRequest = {
    term: resolved.ctx.term,
    langCode: detectLangCode(resolved.ctx.sentence),
    contextSentence: resolved.ctx.sentence,
    cursorOffset: resolved.ctx.cursorOffset,
    fallback: false,
  };

  return { request, range: resolved.range };
}

/** Extract a word at a UTF-16 offset (re-exported for tests). */
export { extractWordAtOffset };
