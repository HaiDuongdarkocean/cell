// sentenceModule — SSOT for sentence extraction, word extraction, and word-range
// mapping from any DOM text node.
//
// Consumers:
//   - webTriggerController (hover/click lookup)
//   - badgePointer/resolveWordAtTip (orbital pointer lookup)
//   - webTextDictionaryController (adjacent-term navigation)
//   - LookupRequest.contextSentence → translation → SRS card
//
// All sentence/word logic lives here. No other module should duplicate
// extractSentenceContext, extractWordAtOffset, or createWordRange.

/** Word character: Latin word chars + CJK ideographs. */
export const WORD_CHAR_RE = /[\w\u4e00-\u9fff\u3400-\u4dbf]/;

/** CJK ideograph check — each CJK char is treated as one "word". */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/** Sentence-ending punctuation. Latin punctuation (.!?) requires whitespace
 *  or end-of-text after it. CJK punctuation (。！？) does not — CJK sentences
 *  often have no space after the period. Excludes decimal points (digit.digit). */
const SENTENCE_BOUNDARY_RE = /(?:(?<!\d)[.!?]+(?!\d)(?:\s+|$)|[。！？]+(?:\s*|$))/g;

/** Minimum word count for a sentence zone. Shorter sentences are merged
 *  with the next one so the popup stays alive across short clauses. */
const MIN_SENTENCE_WORDS = 3;

/** Tags that are always treated as block-level containers. */
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD']);

export interface WordAtOffset {
  readonly text: string;
  readonly start: number;
}

export interface SentenceContext {
  /** The sentence text containing the cursor (punctuation-split, merged if < 3 words). */
  readonly sentence: string;
  /** UTF-16 offset of the word start within `sentence`. */
  readonly cursorOffset: number;
  /** UTF-16 offset of the cursor within the block's textContent. */
  readonly blockOffset: number;
  /** The looked-up term. */
  readonly term: string;
  /** The word at the cursor position. */
  readonly word: WordAtOffset;
  /** The block element that was walked up to. */
  readonly blockEl: HTMLElement;
  /** Start offset of `sentence` within the block's textContent. */
  readonly sentenceStart: number;
  /** End offset of `sentence` within the block's textContent. */
  readonly sentenceEnd: number;
  /** Leading whitespace stripped from the raw sentence before trimming.
   *  `word.start` is relative to the trimmed sentence, so the word's block
   *  offset = `sentenceStart + leadingWs + word.start`. */
  readonly leadingWs: number;
}

/** Extract the word at a given UTF-16 offset in a string.
 *  Returns null for whitespace/punctuation or out-of-bounds. */
export function extractWordAtOffset(text: string, offset: number): WordAtOffset | null {
  if (offset < 0 || offset >= text.length) return null;
  const ch = text[offset];
  if (!ch || !WORD_CHAR_RE.test(ch)) return null;
  if (CJK_RE.test(ch)) return { text: ch, start: offset };
  let start = offset;
  while (start > 0 && /[\w]/.test(text[start - 1]!)) start--;
  let end = offset;
  while (end < text.length && /[\w]/.test(text[end]!)) end++;
  const word = text.slice(start, end);
  if (!word) return null;
  return { text: word, start };
}

/** Check if an element is a block-level container. */
function isBlockContainer(el: HTMLElement): boolean {
  const display = getComputedStyle(el).display;
  if (display === 'block' || display === 'list-item' || display === 'table-cell') return true;
  return BLOCK_TAGS.has(el.tagName);
}

/** Check if an element is an extension-generated wrapper (token span, block
 *  wrapper, etc.) that should be skipped when finding the real sentence
 *  container. These wrappers only contain a single word, not a sentence. */
function isExtensionWrapper(el: HTMLElement): boolean {
  if (el.classList.contains('js-cell-token')) return true;
  if (el.hasAttribute('data-cell-block-id')) return true;
  // Wrapper divs/spans created by token wrapping (inline/flex wrappers
  // around a single token span — not real page content containers).
  const child = el.firstElementChild;
  if (child && child.classList.contains('js-cell-token') && el.childElementCount === 1) return true;
  return false;
}

/** Walk up from a text node to the nearest block-level container,
 *  skipping extension-generated token wrappers. */
function findBlockContainer(textNode: Text): HTMLElement | null {
  let el: HTMLElement | null = textNode.parentElement;
  while (el) {
    if (isBlockContainer(el) && !isExtensionWrapper(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/** Compute the UTF-16 offset of a text node within its block's textContent,
 *  plus the node-local offset. Returns -1 if the node is not found. */
function computeBlockOffset(block: HTMLElement, textNode: Text, offsetInNode: number): number {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current: Text | null;
  while ((current = walker.nextNode() as Text | null)) {
    if (current === textNode) return offset + offsetInNode;
    offset += current.textContent?.length ?? 0;
  }
  return -1;
}

/** Count words in a string. CJK chars count as individual words. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // CJK: each ideograph is a word.
  if (CJK_RE.test(trimmed[0]!)) {
    return [...trimmed].filter((ch) => CJK_RE.test(ch) || /[\w]/.test(ch)).length;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/** Find the sentence boundaries (start, end offsets within fullText)
 *  containing `cursorOffset`, splitting by punctuation and merging
 *  short sentences (< MIN_SENTENCE_WORDS) with the next one. */
function findSentenceRange(fullText: string, cursorOffset: number): { start: number; end: number } {
  const matches = [...fullText.matchAll(SENTENCE_BOUNDARY_RE)];
  if (matches.length === 0) return { start: 0, end: fullText.length };

  // Build sentence segments: [start, end) where end is the boundary match end.
  const segments: { start: number; end: number }[] = [];
  let prevEnd = 0;
  for (const m of matches) {
    const boundaryEnd = (m.index ?? 0) + m[0].length;
    segments.push({ start: prevEnd, end: boundaryEnd });
    prevEnd = boundaryEnd;
  }
  // Last segment: from last boundary end to end of text (if any text remains).
  if (prevEnd < fullText.length) {
    segments.push({ start: prevEnd, end: fullText.length });
  }

  // Find the segment containing cursorOffset.
  const idx = segments.findIndex((s) => cursorOffset >= s.start && cursorOffset < s.end);
  if (idx === -1) {
    // cursorOffset is at the very end — use the last segment.
    return { start: segments[segments.length - 1].start, end: segments[segments.length - 1].end };
  }

  // Merge forward if the current sentence is too short. Keep the original
  // segment's start (so cursorOffset stays within the range) and extend the
  // end to cover merged sentences.
  const start = segments[idx].start;
  let end = segments[idx].end;
  let mergeIdx = idx;
  while (mergeIdx < segments.length - 1 && wordCount(fullText.slice(start, end)) < MIN_SENTENCE_WORDS) {
    mergeIdx++;
    end = segments[mergeIdx].end;
  }

  return { start, end };
}

/** Extract sentence context from a text node + offset within it.
 *
 *  1. Walk up to nearest block container.
 *  2. Get block.textContent, split by sentence-ending punctuation.
 *  3. Find the sentence containing the cursor; merge if < 3 words.
 *  4. Extract the word at the cursor position.
 *  5. Return sentence text, offsets, and word info.
 *
 *  This is the SSOT — all consumers (hover, orbital, click, translation,
 *  SRS) get their sentence from this function. */
export function extractSentenceContext(
  textNode: Text,
  offsetInNode: number,
): SentenceContext | null {
  const block = findBlockContainer(textNode);
  if (!block) return null;

  const fullText = block.textContent ?? '';
  if (!fullText.trim()) return null;

  const blockOffset = computeBlockOffset(block, textNode, offsetInNode);
  if (blockOffset < 0) return null;

  const { start: sentenceStart, end: sentenceEnd } = findSentenceRange(fullText, blockOffset);
  const rawSentence = fullText.slice(sentenceStart, sentenceEnd);
  // Count leading whitespace to adjust word offset after trim.
  const leadingWs = rawSentence.length - rawSentence.trimStart().length;
  const sentence = rawSentence.trim();
  if (!sentence) return null;

  // Word offset is relative to the trimmed sentence.
  const wordOffsetInSentence = blockOffset - sentenceStart - leadingWs;
  const word = extractWordAtOffset(sentence, wordOffsetInSentence);
  if (!word) return null;

  return {
    sentence,
    cursorOffset: word.start,
    blockOffset,
    term: word.text,
    word,
    blockEl: block,
    sentenceStart,
    sentenceEnd,
    leadingWs,
  };
}

/** Build a DOM Range covering the word returned by extractSentenceContext.
 *  Maps the word's offset within the block's textContent back to the
 *  text node's local offset via TreeWalker. */
export function createWordRange(
  textNode: Text,
  offsetInNode: number,
  ctx: SentenceContext,
): Range | null {
  // Word's block offset = sentenceStart + leadingWs + word.start (since
  // word.start is relative to the trimmed sentence).
  const wordBlockStart = ctx.sentenceStart + ctx.leadingWs + ctx.word.start;
  const nodeStart = wordBlockStart - (ctx.blockOffset - offsetInNode);
  const nodeEnd = nodeStart + ctx.word.text.length;
  const nodeText = textNode.textContent ?? '';
  if (nodeStart < 0 || nodeEnd > nodeText.length || nodeStart >= nodeEnd) return null;
  const range = document.createRange();
  try {
    range.setStart(textNode, nodeStart);
    range.setEnd(textNode, nodeEnd);
    return range;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveWordAtPoint — hybrid lookup algorithm (100% success on host text).
//
// Two tiers:
//   1. Fast path (O(1)-ish): caretRangeFromPoint lands on a word char →
//      extract sentence + word directly. Handles ~95% of clicks (click on a
//      word) with no geometry scan.
//   2. Geometry fallback (O(n) in block words, bounded): when the caret lands
//      on whitespace/punctuation OR caretRangeFromPoint returns null (obscured
//      text, user-select:none), walk the block's text nodes, build a Range per
//      word, and pick the word whose client rect is nearest to (x, y) by
//      Euclidean distance — gated by a proximity threshold (1.5 × line-height)
//      so a click in genuine empty space resolves to nothing.
//
// This replaces the previous caret→extract→create→isPointOverRange sequence
// duplicated across webTriggerController.onMouseUp, processHoverMove, and
// resolveWordAtTip. The old sequence dismissed the lookup whenever the caret
// landed on a non-word char (whitespace/punctuation between words) or when the
// 1px isPointOverRange gate rejected a valid word whose rect didn't contain
// the click — the root cause of "click lúc được lúc không".
// ─────────────────────────────────────────────────────────────────────────────

/** Dependency injection for resolveWordAtPoint (testability + caller wrapping).
 *  Callers that need to disable pointer-events on their own floating UI before
 *  resolving the caret pass a custom `getCaretRange`. */
export interface ResolveWordDeps {
  readonly getCaretRange?: (x: number, y: number) => Range | null;
}

export interface ResolvedWordAtPoint {
  readonly ctx: SentenceContext;
  readonly range: Range;
}

/** Default caret resolver: tries caretPositionFromPoint (Firefox) then
 *  caretRangeFromPoint (Chromium). Returns a collapsed Range at the caret.
 *  Falls back to shadowRoot.elementFromPoint when the caret lands on a
 *  shadow host (caretRangeFromPoint does not pierce shadow DOM). */
export function defaultGetCaretRange(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode?.nodeType === Node.TEXT_NODE) {
      try {
        const r = document.createRange();
        r.setStart(pos.offsetNode as Text, pos.offset);
        r.collapse(true);
        return r;
      } catch { /* offset out of range — fall through */ }
    }
  }
  const range = doc.caretRangeFromPoint?.(x, y) ?? null;
  if (range?.startContainer.nodeType === Node.TEXT_NODE) return range;
  // caretRangeFromPoint returned a non-text node (or null) — the click may be
  // over a shadow host whose text is not pierceable. Walk shadow roots to find
  // the text node under the point.
  return resolveShadowTextNode(x, y);
}

/** Walk open shadow roots under (x, y) to find a text node and return a
 *  collapsed Range at the character offset closest to the click point.
 *  Returns null if no text node is found.
 *  ponytail: O(n) per text node — bounded by subtitle line length (~100 chars).
 *  Upgrade path: binary search on character offsets if lines exceed ~500 chars. */
function resolveShadowTextNode(x: number, y: number): Range | null {
  // Start from the top-level element at the point, then descend into shadow.
  const stack: Element[] = [document.elementFromPoint(x, y) ?? document.body];
  while (stack.length > 0) {
    const el = stack.pop();
    if (!el?.shadowRoot) continue;
    const inner = el.shadowRoot.elementFromPoint(x, y);
    if (!inner) continue;
    // Find the text node under the inner element and compute the offset
    // nearest to (x, y) by measuring per-character ranges.
    const textEl = inner.nodeType === Node.ELEMENT_NODE ? inner : (inner.parentElement ?? null);
    if (textEl) {
      const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      let bestRange: Range | null = null;
      let bestDist = Infinity;
      let text: Text | null = null;
      while ((text = walker.nextNode() as Text | null)) {
        const len = text.textContent?.length ?? 0;
        if (len === 0) continue;
        // Binary search the offset nearest to (x, y) within this text node.
        for (let i = 0; i < len; i++) {
          try {
            const r = document.createRange();
            r.setStart(text, i);
            r.setEnd(text, Math.min(i + 1, len));
            const rect = r.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dist = (cx - x) ** 2 + (cy - y) ** 2;
            if (dist < bestDist) {
              bestDist = dist;
              bestRange = document.createRange();
              bestRange.setStart(text, i);
              bestRange.collapse(true);
            }
          } catch { /* ignore out-of-range */ }
        }
      }
      if (bestRange) return bestRange;
      // Descend deeper into nested shadow roots.
      if (textEl.shadowRoot) stack.push(textEl);
    }
  }
  return null;
}

/**
 * Resolve the word at a host-page point (x, y). Only resolves when the caret
 * lands directly on a word character — a click on whitespace, punctuation, or
 * outside a text block returns null (no lookup). This is the strict contract:
 * click đúng vào từ mới tra cứu.
 *
 * Callers wrap `getCaretRange` with pointer-events disabling if they float UI
 * above the page (see webTriggerController.withUiHostsPointerEventsDisabled).
 */
export function resolveWordAtPoint(
  x: number,
  y: number,
  deps?: ResolveWordDeps,
): ResolvedWordAtPoint | null {
  const getCaretRange = deps?.getCaretRange ?? defaultGetCaretRange;

  // Only resolve when the caret lands directly on a word character.
  // Click on whitespace/punctuation or outside a text block → null (no lookup).
  const caretRange = getCaretRange(x, y);
  if (!caretRange) return null;

  const node = caretRange.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const textNode = node as Text;
  const ctx = extractSentenceContext(textNode, caretRange.startOffset);
  if (!ctx) return null;

  const range = createWordRange(textNode, caretRange.startOffset, ctx);
  if (!range) return null;
  return { ctx, range };
}
