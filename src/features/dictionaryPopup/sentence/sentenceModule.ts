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

/** Walk up from a text node to the nearest block-level container. */
function findBlockContainer(textNode: Text): HTMLElement | null {
  let el: HTMLElement | null = textNode.parentElement;
  while (el && !isBlockContainer(el)) el = el.parentElement;
  return el;
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
  let start = segments[idx].start;
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

/** Build a DOM Range covering the entire sentence returned by extractSentenceContext.
 *  Walks the block's text nodes and maps block-level sentenceStart/sentenceEnd
 *  back to the original text node endpoints. Returns null if the mapping fails. */
export function createSentenceRange(
  textNode: Text,
  offsetInNode: number,
  ctx: SentenceContext,
): Range | null {
  // Validate that the cursor still maps to the same block/word used to build ctx.
  // ctx was computed from textNode + offsetInNode; if the DOM changed since then
  // the offsets may be stale, so guard before building the Range.
  const block = findBlockContainer(textNode);
  if (!block || block !== ctx.blockEl) return null;

  const nodeOffset = ctx.blockOffset - offsetInNode;
  if (nodeOffset < 0) return null;

  const range = document.createRange();
  try {
    // Start: map the sentence's start (relative to full block text) into the
    // text node that contains the cursor. Because ctx.sentenceStart and
    // nodeOffset are both offsets within the block's textContent, the cursor
    // node's local start is just the difference.
    const startInCursorNode = ctx.sentenceStart - nodeOffset;
    const endInCursorNode = ctx.sentenceEnd - nodeOffset;
    const nodeText = textNode.textContent ?? '';

    if (
      startInCursorNode >= 0 &&
      endInCursorNode <= nodeText.length &&
      startInCursorNode < endInCursorNode
    ) {
      range.setStart(textNode, startInCursorNode);
      range.setEnd(textNode, endInCursorNode);
      return range;
    }

    // Sentence spans multiple text nodes (e.g. inline <b>/<a> tags). Walk the
    // block and find the exact nodes that contain sentenceStart and sentenceEnd.
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let current: Text | null;
    let startSet = false;
    while ((current = walker.nextNode() as Text | null)) {
      const length = current.textContent?.length ?? 0;
      if (!startSet && ctx.sentenceStart >= offset && ctx.sentenceStart < offset + length) {
        range.setStart(current, ctx.sentenceStart - offset);
        startSet = true;
      }
      if (ctx.sentenceEnd > offset && ctx.sentenceEnd <= offset + length) {
        if (!startSet) {
          // sentenceEnd is in a node before the start would be — invalid.
          return null;
        }
        range.setEnd(current, ctx.sentenceEnd - offset);
        return range;
      }
      offset += length;
    }
  } catch {
    return null;
  }
  return null;
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
  readonly elementsFromPoint?: (x: number, y: number) => Element[];
}

export interface ResolvedWordAtPoint {
  readonly ctx: SentenceContext;
  readonly range: Range;
}

/** Proximity gate as a multiple of the block's line-height. A click whose
 *  nearest word rect is farther than this is treated as empty space. */
const PROXIMITY_LINE_HEIGHT_MULT = 1.5;
/** Fallback gate (px) when line-height can't be computed — matches the spec
 *  default of 40px (≈ 1.5 × 26.67px typical body line-height). */
const MAX_LOOKUP_DISTANCE_PX = 40;
/** ponytail: ceiling on words scanned in the geometry fallback — a very long
 *  paragraph. Bounds the O(n) scan so a pathological block can't stall. */
const MAX_BLOCK_WORDS_SCAN = 500;

/** Default caret resolver: tries caretPositionFromPoint (Firefox) then
 *  caretRangeFromPoint (Chromium). Returns a collapsed Range at the caret. */
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
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

/** Proximity gate (px) for `block`: 1.5 × line-height, or MAX_LOOKUP_DISTANCE_PX
 *  (40px) when line-height can't be computed. */
function proximityGateFor(block: HTMLElement): number {
  const px = parseFloat(getComputedStyle(block).lineHeight);
  return Number.isFinite(px) && px > 0
    ? px * PROXIMITY_LINE_HEIGHT_MULT
    : MAX_LOOKUP_DISTANCE_PX;
}

/** Min Euclidean distance from (x, y) to any non-empty client rect of `range`.
 *  Returns 0 when the point lies inside a rect or getClientRects is unavailable
 *  (jsdom). Otherwise computes the distance to the nearest rect edge. */
function minDistanceToRects(x: number, y: number, range: Range): number {
  if (typeof range.getClientRects !== 'function') return 0;
  const rects = range.getClientRects();
  let min = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    if (r.width <= 0 || r.height <= 0) continue;
    // Point inside the rect → distance 0 (the word is under the click).
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return 0;
    // Otherwise distance to the nearest edge.
    const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    const d = Math.hypot(dx, dy);
    if (d < min) min = d;
  }
  return min === Infinity ? 0 : min;
}

interface WordSpan {
  readonly node: Text;
  readonly offsetInNode: number;
  readonly length: number;
}

/** Walk a block's text nodes once and collect every word span (Latin run or
 *  single CJK ideograph). O(n) in block characters; bounded by MAX_BLOCK_WORDS_SCAN. */
function collectWordSpans(block: HTMLElement): WordSpan[] {
  const spans: WordSpan[] = [];
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let current: Text | null;
  while ((current = walker.nextNode() as Text | null)) {
    const data = current.data;
    if (!data) continue;
    let i = 0;
    while (i < data.length) {
      const ch = data[i]!;
      if (CJK_RE.test(ch)) {
        spans.push({ node: current, offsetInNode: i, length: 1 });
        i++;
      } else if (/[\w]/.test(ch)) {
        let j = i;
        while (j < data.length && /[\w]/.test(data[j]!)) j++;
        spans.push({ node: current, offsetInNode: i, length: j - i });
        i = j;
      } else {
        i++;
      }
    }
    if (spans.length > MAX_BLOCK_WORDS_SCAN) break;
  }
  return spans;
}

/** Find the block element under (x, y): prefer the caret's block, else scan
 *  elementsFromPoint for the first text-bearing block. */
function findBlockUnderPoint(
  x: number,
  y: number,
  caretRange: Range | null,
  elementsFromPoint: (x: number, y: number) => Element[],
): HTMLElement | null {
  if (caretRange) {
    const node = caretRange.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const block = findBlockContainer(node as Text);
      if (block && (block.textContent ?? '').trim()) return block;
    }
  }
  for (const el of elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement)) continue;
    const block = isBlockContainer(el) ? el : el.closest<HTMLElement>(BLOCK_TAGS_SELECTOR);
    if (block && (block.textContent ?? '').trim()) return block;
  }
  return null;
}

/** Map a block-level UTF-16 offset back to its (text node, local offset).
 *  Inverse of computeBlockOffset. O(n) TreeWalker pass. */
function findTextNodeAtBlockOffset(
  block: HTMLElement,
  targetBlockOffset: number,
): { node: Text; offset: number } | null {
  if (targetBlockOffset < 0) return null;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let current: Text | null;
  while ((current = walker.nextNode() as Text | null)) {
    const length = current.textContent?.length ?? 0;
    if (targetBlockOffset >= offset && targetBlockOffset < offset + length) {
      return { node: current, offset: targetBlockOffset - offset };
    }
    offset += length;
  }
  return null;
}

/** Find the nearest word-character block-offset to `blockOffset` by scanning
 *  left then right in the block's textContent. On tie, prefers the left
 *  (earlier) offset. Returns null if no word char exists in the block.
 *  ponytail: bounded scan — MAX_NEAREST_WORD_SCAN chars each direction. */
const MAX_NEAREST_WORD_SCAN = 200;
function findNearestWordCharOffset(fullText: string, blockOffset: number): number | null {
  if (blockOffset < 0 || blockOffset > fullText.length) return null;
  let leftDist = Infinity;
  let leftIdx = -1;
  for (let i = blockOffset - 1; i >= 0 && (blockOffset - i) <= MAX_NEAREST_WORD_SCAN; i--) {
    if (WORD_CHAR_RE.test(fullText[i]!)) { leftIdx = i; leftDist = blockOffset - i; break; }
  }
  let rightDist = Infinity;
  let rightIdx = -1;
  for (let i = blockOffset + 1; i < fullText.length && (i - blockOffset) <= MAX_NEAREST_WORD_SCAN; i++) {
    if (WORD_CHAR_RE.test(fullText[i]!)) { rightIdx = i; rightDist = i - blockOffset; break; }
  }
  if (leftIdx === -1 && rightIdx === -1) return null;
  if (leftIdx === -1) return rightIdx;
  if (rightIdx === -1) return leftIdx;
  // Tie or left closer → prefer left (deterministic, earlier in text).
  return leftDist <= rightDist ? leftIdx : rightIdx;
}

/** Char-scan fallback: caret landed on a non-word char (whitespace/punct) →
 *  find the nearest word char in the block and resolve it. Deterministic,
 *  no geometry dependency. O(n) in block chars, bounded. */
function resolveByNearestWordChar(textNode: Text, offsetInNode: number): ResolvedWordAtPoint | null {
  const block = findBlockContainer(textNode);
  if (!block) return null;
  const fullText = block.textContent ?? '';
  if (!fullText.trim()) return null;
  const blockOffset = computeBlockOffset(block, textNode, offsetInNode);
  if (blockOffset < 0) return null;
  const nearest = findNearestWordCharOffset(fullText, blockOffset);
  if (nearest === null) return null;
  const mapped = findTextNodeAtBlockOffset(block, nearest);
  if (!mapped) return null;
  const ctx = extractSentenceContext(mapped.node, mapped.offset);
  if (!ctx) return null;
  const range = createWordRange(mapped.node, mapped.offset, ctx);
  if (!range) return null;
  return { ctx, range };
}

/** CSS selector for block-level containers, mirroring BLOCK_TAGS. */
const BLOCK_TAGS_SELECTOR = 'p, div, li, h1, h2, h3, h4, h5, h6, blockquote, td';

/**
 * Resolve the word at a host-page point (x, y) with 100% success whenever a
 * word exists near the click, and null only for genuine empty space.
 *
 * Fast path: caret on a word char → extract sentence + word directly.
 * Geometry fallback: caret on non-word char / null → nearest word by rect
 * distance, gated by 1.5 × line-height proximity.
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
  const elementsFromPoint = deps?.elementsFromPoint
    ?? ((cx: number, cy: number) => document.elementsFromPoint?.(cx, cy) ?? []);

  const caretRange = getCaretRange(x, y);

  // Fast path: caret on a word char → trust it (matches legacy resolveWordAtTip).
  if (caretRange) {
    const node = caretRange.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const ctx = extractSentenceContext(textNode, caretRange.startOffset);
      if (ctx) {
        const range = createWordRange(textNode, caretRange.startOffset, ctx);
        if (range) return { ctx, range };
      }
      // Char-scan fallback: caret on a non-word char (whitespace/punct) →
      // resolve the nearest word in the block. Deterministic, no geometry.
      const byChar = resolveByNearestWordChar(textNode, caretRange.startOffset);
      if (byChar) return byChar;
    }
  }

  // Geometry fallback: caret null (obscured / user-select:none) → nearest word
  // by rect distance, proximity-gated by 1.5 × line-height.
  const block = findBlockUnderPoint(x, y, caretRange, elementsFromPoint);
  if (!block) return null;
  const gate = proximityGateFor(block);
  const spans = collectWordSpans(block);
  if (spans.length === 0) return null;

  let best: WordSpan | null = null;
  let bestDist = Infinity;
  for (const span of spans) {
    const r = document.createRange();
    try {
      r.setStart(span.node, span.offsetInNode);
      r.setEnd(span.node, span.offsetInNode + span.length);
    } catch {
      continue;
    }
    const d = minDistanceToRects(x, y, r);
    if (d < bestDist) {
      bestDist = d;
      best = span;
    }
  }
  if (!best || bestDist > gate) return null;

  const ctx = extractSentenceContext(best.node, best.offsetInNode);
  if (!ctx) return null;
  const range = createWordRange(best.node, best.offsetInNode, ctx);
  if (!range) return null;
  return { ctx, range };
}
