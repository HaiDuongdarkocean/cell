import type { Token, TokenBlock } from '@/features/tokenize/types';
import type { AnnotationDisplayMode } from '@/entities/settings';
import { collectSentenceRun, type SentenceRunEntry, type SentenceSegment } from '@/features/tokenize/logic/sentenceRun';
import { IPLUS1_OFF_CLASS, pickIPlus1Index } from '@/features/tokenize/logic/iPlus1Marking';
import { isNotKnown } from '@/features/dictionary';
import { hasSentenceEnd } from '@/shared/lib/sentencePunct';
import { injectTokenSpanStyle } from './tokenSpanCss';

export interface TokenSpanBindOptions {
  /** Show status underline layer. */
  readonly showStatus: boolean;
  /** Show frequency background/text layer. */
  readonly showFrequency: boolean;
  /** Reading cap display mode above tokens. Absent → 'off'; web-tokenize
   *  surfaces omit this (v1 renders on controlled surfaces only). */
  readonly readingDisplay?: AnnotationDisplayMode;
  /** Native-language gloss display mode below tokens. Absent → 'off';
   *  subtitle overlay only in v1. */
  readonly glossDisplay?: AnnotationDisplayMode;
  /** Hover a word token (desktop). */
  readonly onTokenEnter?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Leave a word token (desktop). */
  readonly onTokenLeave?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Click a word token to open the popup dictionary. */
  readonly onTokenClick?: (term: string, block: TokenBlock, element: HTMLElement, token: Token, event: MouseEvent) => void;
  /** Ctrl/Cmd+click a word token to multi-select. */
  readonly onTokenCtrlClick?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Hover a gap span (spaces/punctuation between tokens) — washes its sentence. */
  readonly onSeparatorEnter?: (block: TokenBlock, element: HTMLElement) => void;
  readonly onSeparatorLeave?: (block: TokenBlock, element: HTMLElement) => void;
  /** Click a gap span — pins the sentence wash; gaps carry no term so no popup. */
  readonly onSeparatorClick?: (block: TokenBlock, element: HTMLElement, event: MouseEvent) => void;
  /** Whether the term is in the bulk selection — marks the selected wash. */
  readonly isSelected?: (term: string) => boolean;
}

export const TOKEN_CLASS = 'js-Tihoka-token';
const WORD_CLASS = 'js-Tihoka-token--word';
export const SEPARATOR_CLASS = 'js-Tihoka-token--separator';
/** Sentence index of the token/gap, stamped at bind time. */
export const SENTENCE_ATTR = 'data-tihoka-sentence';
const WORD_INNER_CLASS = 'js-Tihoka-token-word';
const STATUS_CLASS = 'js-Tihoka-token-status';
const READING_OFF_CLASS = 'js-Tihoka-token--reading-off';
const GLOSS_OFF_CLASS = 'js-Tihoka-token--gloss-off';
const READING_HOVER_CLASS = 'js-Tihoka-token--reading-hover';
const GLOSS_HOVER_CLASS = 'js-Tihoka-token--gloss-hover';
const READING_I1_CLASS = 'js-Tihoka-token--reading-i1';
const GLOSS_I1_CLASS = 'js-Tihoka-token--gloss-i1';
const HAS_CARD_CLASS = 'js-Tihoka-token--has-card';
const BLOCK_ATTR = 'data-tihoka-block-id';

/** Paragraph-ish container: a sentence never reaches past one visual
 *  paragraph, so runs and i+1 marks are scoped to the spans inside it. */
export const CONTAINER_SELECTOR = 'p, li, dd, dt, blockquote, figcaption, td, th, h1, h2, h3, h4, h5, h6';

export interface RenderedSentenceSegment extends SentenceSegment {
  readonly spans: HTMLElement[];
}

/** Group the container's rendered spans into text blocks, in DOM order.
 *  Block scan order is not document order (links are scanned in a different
 *  pass than the surrounding text), so the DOM is the only reliable order.
 *  Untokenized text between blocks — a lone "." text node after a link, a
 *  footnote like ".[5]" — is folded into the previous segment's trailingText:
 *  the terminator closing a sentence often lives in that gap, and a run that
 *  never sees it washes the next sentence into the previous one. */
export function readSegments(container: Element): RenderedSentenceSegment[] {
  const segments: RenderedSentenceSegment[] = [];
  let current: { id: string; spans: HTMLElement[]; lastSentenceIndex: number; trailingText: string } | null = null;
  const blockSelector = `[${BLOCK_ATTR}]`;

  const walker = container.ownerDocument.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof HTMLElement && node.hasAttribute(BLOCK_ATTR)) {
      const span = node;
      const id = span.getAttribute(BLOCK_ATTR)!;
      if (!current || current.id !== id) {
        current = { id, spans: [], lastSentenceIndex: -1, trailingText: '' };
        segments.push(current);
      }
      const isSeparator = span.classList.contains(SEPARATOR_CLASS);
      current.spans.push(span);
      if (isSeparator) {
        current.trailingText = span.textContent ?? '';
      } else {
        current.trailingText = '';
        current.lastSentenceIndex = Number(span.getAttribute(SENTENCE_ATTR) ?? '0');
      }
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE && current) {
      const parent = (node as Text).parentElement;
      if (!parent?.closest(blockSelector)) {
        current.trailingText += node.textContent ?? '';
      }
    }
  }

  return segments;
}

function isNewWordSpan(span: HTMLElement): boolean {
  return (
    !span.classList.contains(`${TOKEN_CLASS}--status-known`) &&
    !span.classList.contains(`${TOKEN_CLASS}--status-ignore`)
  );
}

function applyRunMark(segments: readonly RenderedSentenceSegment[], entries: readonly SentenceRunEntry[]): void {
  const words: HTMLElement[] = [];
  for (const entry of entries) {
    for (const span of segments[entry.segment]?.spans ?? []) {
      if (span.classList.contains(SEPARATOR_CLASS)) continue;
      if (span.getAttribute(SENTENCE_ATTR) !== String(entry.sentenceIndex)) continue;
      words.push(span);
    }
  }
  const markedIndex = pickIPlus1Index(
    words.map((span) => ({ term: span.getAttribute('data-tihoka-term') ?? '', isNew: isNewWordSpan(span) })),
  );
  const marked = markedIndex === null ? null : words[markedIndex];
  for (const span of words) {
    const off = span !== marked;
    span.classList.toggle(IPLUS1_OFF_CLASS, off);
    // Annotation lanes in 'i1' display mode gate their --*-off class off the
    // same mark — the single new word shows the lane, every other token is flat.
    if (span.classList.contains(READING_I1_CLASS)) span.classList.toggle(READING_OFF_CLASS, off);
    if (span.classList.contains(GLOSS_I1_CLASS)) span.classList.toggle(GLOSS_OFF_CLASS, off);
  }
}

/** Re-mark every i+1 run inside `container` — the same sentence runs the wash
 *  paints, so a gap counts against the real cross-block sentence, not the
 *  per-block fragment its tokenize block happens to be. */
export function markIPlus1Runs(container: Element): void {
  const segments = readSegments(container);
  const seen = new Set<string>();
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const sentenceIndexes = new Set<number>();
    for (const span of segments[segIdx]!.spans) {
      if (!span.classList.contains(SEPARATOR_CLASS)) {
        sentenceIndexes.add(Number(span.getAttribute(SENTENCE_ATTR) ?? '0'));
      }
    }
    for (const sentenceIndex of sentenceIndexes) {
      const entries = collectSentenceRun(segments, segIdx, sentenceIndex);
      const key = entries
        .map((e) => `${e.segment}:${e.sentenceIndex}`)
        .sort()
        .join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      applyRunMark(segments, entries);
    }
  }
}

/** Re-mark i+1 gaps for the sentence runs around `span`. Called after bind,
 *  restyle and direct status writes so marks follow status changes. */
export function refreshIPlus1Marking(span: HTMLElement): void {
  const container = span.closest(CONTAINER_SELECTOR) ?? span.parentElement;
  if (container) markIPlus1Runs(container);
}

/** Inside an <a>, <button> or <label>: single click opens our popup, double
 *  click triggers the native action. preventDefault on the click also
 *  suppresses the label's control activation. e.detail === 2 on the second
 *  click. Returns true when the click was consumed by the native action. */
function passThroughInteractiveClick(e: MouseEvent, span: HTMLElement): boolean {
  const interactive = span.closest('a, button, label');
  if (!interactive) return false;
  e.preventDefault();
  if (e.detail !== 2) return false;
  if (interactive.tagName === 'A') {
    const href = (interactive as HTMLAnchorElement).href;
    if (href) window.location.href = href;
  } else {
    // Re-dispatch a clean click so the button/label's own handler fires.
    interactive.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  return true;
}

function createSeparatorSpan(text: string, block: TokenBlock, sentenceIndex: number, options: TokenSpanBindOptions): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `${TOKEN_CLASS} ${SEPARATOR_CLASS}`;
  span.setAttribute('data-tihoka-block-id', block.id);
  span.setAttribute(SENTENCE_ATTR, String(sentenceIndex));
  span.textContent = text;

  if (options.onSeparatorEnter || options.onSeparatorLeave || options.onSeparatorClick) {
    span.addEventListener('mouseenter', () => options.onSeparatorEnter?.(block, span));
    span.addEventListener('mouseleave', () => options.onSeparatorLeave?.(block, span));
    span.addEventListener('click', (e) => {
      if (passThroughInteractiveClick(e, span)) return;
      options.onSeparatorClick?.(block, span, e);
    });
  }
  return span;
}

function applyTokenClasses(span: HTMLElement, token: Token, options: TokenSpanBindOptions): void {
  for (const cls of [...span.classList]) {
    if (cls.startsWith(`${TOKEN_CLASS}--status-`) || cls.startsWith(`${TOKEN_CLASS}--frequency-`)) {
      span.classList.remove(cls);
    }
  }
  if (token.status) {
    span.classList.add(`${TOKEN_CLASS}--status-${token.status}`);
  }
  if (token.frequencyBand && token.frequencyBand !== 'none') {
    span.classList.add(`${TOKEN_CLASS}--frequency-${token.frequencyBand}`);
  }
  if (token.hasCard) {
    span.classList.add(HAS_CARD_CLASS);
  } else {
    span.classList.remove(HAS_CARD_CLASS);
  }
  if (options.isSelected?.(token.term)) {
    span.classList.add(`${TOKEN_CLASS}--selected`);
  } else {
    span.classList.remove(`${TOKEN_CLASS}--selected`);
  }
  if (!options.showStatus) {
    span.classList.add(`${TOKEN_CLASS}--status-off`);
  }
  // The showFrequency toggle controls the frequency layer for all tokens;
  // known/ignore words still keep their status styling, but frequency can be
  // shown when the user wants 100% frequency coverage.
  if (!options.showFrequency) {
    span.classList.add(`${TOKEN_CLASS}--frequency-off`);
  }
  applyAnnotationClasses(span, token, options.readingDisplay ?? 'off', READING_OFF_CLASS, READING_HOVER_CLASS, READING_I1_CLASS);
  applyAnnotationClasses(span, token, options.glossDisplay ?? 'off', GLOSS_OFF_CLASS, GLOSS_HOVER_CLASS, GLOSS_I1_CLASS);
}

/** Map a display mode onto the token's annotation classes. 'i1' skips the
 *  --*-off write — the sentence-level mark pass (applyRunMark) owns it and
 *  runs on every bind/restyle/status change. */
function applyAnnotationClasses(
  span: HTMLElement,
  token: Token,
  mode: AnnotationDisplayMode,
  offClass: string,
  hoverClass: string,
  i1Class: string,
): void {
  span.classList.toggle(hoverClass, mode === 'hover');
  span.classList.toggle(i1Class, mode === 'i1');
  switch (mode) {
    case 'off':
      span.classList.add(offClass);
      break;
    case 'always':
    case 'hover':
      span.classList.remove(offClass);
      break;
    case 'unknown':
      span.classList.toggle(offClass, !isNotKnown(token.status ?? 'unknown'));
      break;
    case 'i1':
      break;
  }
}

/** Mirror token.reading/token.gloss onto the token span's data-reading and
 *  data-gloss attributes — the CSS ::before cap lane and ::after gloss lane
 *  are in-flow items of the token's flex column and read attr() from the
 *  token element itself. Runs on both bind and in-place restyle so late
 *  metadata updates don't rebuild the DOM. */
function applyTokenReading(span: HTMLElement, token: Token): void {
  if (token.reading) {
    span.setAttribute('data-reading', token.reading);
  } else {
    span.removeAttribute('data-reading');
  }
  if (token.gloss) {
    span.setAttribute('data-gloss', token.gloss);
  } else {
    span.removeAttribute('data-gloss');
  }
}

function createTokenSpan(token: Token, block: TokenBlock, options: TokenSpanBindOptions): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = TOKEN_CLASS;
  span.setAttribute('data-tihoka-term', token.term);
  span.setAttribute('data-tihoka-block-id', block.id);
  span.setAttribute('data-tihoka-start', String(token.start));
  span.setAttribute('data-tihoka-end', String(token.end));
  span.setAttribute(SENTENCE_ATTR, String(token.sentenceIndex));

  if (!token.isSeparator && (options.onTokenEnter || options.onTokenLeave || options.onTokenClick || options.onTokenCtrlClick)) {
    span.addEventListener('mouseenter', () => options.onTokenEnter?.(token.term, block, span));
    span.addEventListener('mouseleave', () => options.onTokenLeave?.(token.term, block, span));
    span.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        options.onTokenCtrlClick?.(token.term, block, span);
        return;
      }
      if (passThroughInteractiveClick(e, span)) return;
      options.onTokenClick?.(token.term, block, span, token, e);
    });
  }

  applyTokenClasses(span, token, options);

  span.classList.add(WORD_CLASS);

  const word = document.createElement('span');
  word.className = WORD_INNER_CLASS;
  word.textContent = token.text;
  span.appendChild(word);
  applyTokenReading(span, token);

  const status = document.createElement('span');
  status.className = STATUS_CLASS;
  status.setAttribute('aria-hidden', 'true');
  span.appendChild(status);

  return span;
}

/** Bind a prepared block to the DOM: replace source text with token spans. */
export function bindTokenBlock(block: TokenBlock, options: TokenSpanBindOptions): void {
  if (!block.tokens || block.tokens.length === 0 || block.sourceNodes.length === 0) {
    return;
  }

  const parent = block.element;
  const sourceNode = block.sourceNodes[0]!;
  if (!parent.contains(sourceNode)) {
    // SPA re-render removed the original text node; we cannot safely bind here.
    block.isBound = false;
    return;
  }

  // If already bound, verify the rendered spans are still present. SPA re-renders
  // can wipe them while leaving block.isBound=true, which would no-op rebinding.
  if (block.isBound) {
    if (parent.querySelector(`[data-tihoka-block-id="${block.id}"]`)) return;
    block.isBound = false;
  }

  injectTokenSpanStyle();

  const text = block.originalText;
  const tokens = [...block.tokens].sort((a, b) => a.start - b.start);

  const fragment = document.createDocumentFragment();
  let lastEnd = 0;
  // A gap carries the sentence of the token before it — the punctuation that
  // closes a sentence belongs to that sentence, not the next one. The leading
  // gap is the exception: when it holds the terminator of the previous
  // sentence, it belongs to that sentence (one index below the first token).
  const first = tokens[0];
  const leadingSentence = first
    ? Math.max(0, first.sentenceIndex - (hasSentenceEnd(text.slice(0, first.start)) ? 1 : 0))
    : 0;
  let lastSentence = leadingSentence;
  let firstWordSpan: HTMLElement | null = null;
  for (const token of tokens) {
    if (token.start > lastEnd) {
      fragment.appendChild(createSeparatorSpan(text.slice(lastEnd, token.start), block, lastSentence, options));
    }
    const span = createTokenSpan(token, block, options);
    firstWordSpan ??= span;
    fragment.appendChild(span);
    lastEnd = token.end;
    lastSentence = token.sentenceIndex;
  }
  if (lastEnd < text.length) {
    fragment.appendChild(createSeparatorSpan(text.slice(lastEnd), block, lastSentence, options));
  }

  parent.replaceChild(fragment, sourceNode);
  block.isBound = true;
  if (firstWordSpan) refreshIPlus1Marking(firstWordSpan);
}

/** Restyle a bound block in place: recompute status/frequency classes on the
 *  rendered word spans without replacing DOM nodes, so an active text
 *  selection over the tokens survives status/metadata updates. Returns false
 *  when the rendered spans are missing or no longer match the block's tokens
 *  (caller should fall back to unbind + bind). */
export function restyleTokenBlock(block: TokenBlock, options: TokenSpanBindOptions): boolean {
  if (!block.isBound || !block.tokens) return false;
  const tokens = [...block.tokens]
    .sort((a, b) => a.start - b.start)
    .filter((token) => !token.isSeparator);
  const spans = Array.from(
    block.element.querySelectorAll<HTMLElement>(`.${TOKEN_CLASS}[data-tihoka-block-id="${block.id}"]`),
  ).filter((el) => !el.classList.contains(SEPARATOR_CLASS));
  if (spans.length !== tokens.length) return false;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]!;
    const token = tokens[i]!;
    if (
      span.getAttribute('data-tihoka-start') !== String(token.start) ||
      span.getAttribute('data-tihoka-end') !== String(token.end)
    ) {
      return false;
    }
    applyTokenClasses(span, token, options);
    applyTokenReading(span, token);
  }
  refreshIPlus1Marking(spans[0]!);
  return true;
}

/** Unbind a block: restore the original source node. */
export function unbindTokenBlock(block: TokenBlock): void {
  if (!block.isBound || block.sourceNodes.length === 0) return;

  const parent = block.element;
  let sourceNode = block.sourceNodes[0]!;
  const selector = `[data-tihoka-block-id="${block.id}"]`;
  const rendered = Array.from(parent.querySelectorAll(selector));
  if (rendered.length === 0) {
    block.isBound = false;
    return;
  }

  // SPA re-render may have removed the original source node (e.g. React replaced
  // the parent). Restore the text with a fresh text node and update the block so
  // subsequent rebinds can replace the new node instead of the detached one.
  if (!parent.contains(sourceNode)) {
    sourceNode = document.createTextNode(block.originalText);
    block.sourceNodes = [sourceNode];
  }

  parent.insertBefore(sourceNode, rendered[0]!);
  for (const node of rendered) {
    node.remove();
  }
  block.isBound = false;
}
