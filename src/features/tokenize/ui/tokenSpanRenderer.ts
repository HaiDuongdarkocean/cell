import type { Token, TokenBlock } from '@/features/tokenize/types';
import { markIPlus1Tokens } from '@/features/tokenize/logic/comprehensionScore';
import { hasSentenceEnd } from '@/shared/lib/sentencePunct';
import { injectTokenSpanStyle } from './tokenSpanCss';

export interface TokenSpanBindOptions {
  /** Show status underline layer. */
  readonly showStatus: boolean;
  /** Show frequency background/text layer. */
  readonly showFrequency: boolean;
  /** Show the reading cap above tokens. Absent → caps hidden; web-tokenize
   *  surfaces omit this (v1 renders on controlled surfaces only). */
  readonly showReadings?: boolean;
  /** Show the native-language gloss below tokens. Absent → glosses hidden;
   *  subtitle overlay only in v1. */
  readonly showGlosses?: boolean;
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

export const TOKEN_CLASS = 'js-cell-token';
const WORD_CLASS = 'js-cell-token--word';
export const SEPARATOR_CLASS = 'js-cell-token--separator';
/** Sentence index of the token/gap, stamped at bind time. */
export const SENTENCE_ATTR = 'data-cell-sentence';
const WORD_INNER_CLASS = 'js-cell-token-word';
const STATUS_CLASS = 'js-cell-token-status';
const READING_OFF_CLASS = 'js-cell-token--reading-off';
const GLOSS_OFF_CLASS = 'js-cell-token--gloss-off';
const IPLUS1_OFF_CLASS = 'js-cell-token--i1-off';
const HAS_CARD_CLASS = 'js-cell-token--has-card';

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
  span.setAttribute('data-cell-block-id', block.id);
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
  if (token.iPlus1) {
    span.classList.remove(IPLUS1_OFF_CLASS);
  } else {
    span.classList.add(IPLUS1_OFF_CLASS);
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
  if (!options.showReadings) {
    span.classList.add(READING_OFF_CLASS);
  } else {
    span.classList.remove(READING_OFF_CLASS);
  }
  if (!options.showGlosses) {
    span.classList.add(GLOSS_OFF_CLASS);
  } else {
    span.classList.remove(GLOSS_OFF_CLASS);
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
  span.setAttribute('data-cell-term', token.term);
  span.setAttribute('data-cell-block-id', block.id);
  span.setAttribute('data-cell-start', String(token.start));
  span.setAttribute('data-cell-end', String(token.end));
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
    if (parent.querySelector(`[data-cell-block-id="${block.id}"]`)) return;
    block.isBound = false;
  }

  injectTokenSpanStyle();

  const text = block.originalText;
  markIPlus1Tokens(block.tokens);
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
  for (const token of tokens) {
    if (token.start > lastEnd) {
      fragment.appendChild(createSeparatorSpan(text.slice(lastEnd, token.start), block, lastSentence, options));
    }
    fragment.appendChild(createTokenSpan(token, block, options));
    lastEnd = token.end;
    lastSentence = token.sentenceIndex;
  }
  if (lastEnd < text.length) {
    fragment.appendChild(createSeparatorSpan(text.slice(lastEnd), block, lastSentence, options));
  }

  parent.replaceChild(fragment, sourceNode);
  block.isBound = true;
}

/** Restyle a bound block in place: recompute status/frequency classes on the
 *  rendered word spans without replacing DOM nodes, so an active text
 *  selection over the tokens survives status/metadata updates. Returns false
 *  when the rendered spans are missing or no longer match the block's tokens
 *  (caller should fall back to unbind + bind). */
export function restyleTokenBlock(block: TokenBlock, options: TokenSpanBindOptions): boolean {
  if (!block.isBound || !block.tokens) return false;
  markIPlus1Tokens(block.tokens);
  const tokens = [...block.tokens]
    .sort((a, b) => a.start - b.start)
    .filter((token) => !token.isSeparator);
  const spans = Array.from(
    block.element.querySelectorAll<HTMLElement>(`.${TOKEN_CLASS}[data-cell-block-id="${block.id}"]`),
  ).filter((el) => !el.classList.contains(SEPARATOR_CLASS));
  if (spans.length !== tokens.length) return false;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]!;
    const token = tokens[i]!;
    if (
      span.getAttribute('data-cell-start') !== String(token.start) ||
      span.getAttribute('data-cell-end') !== String(token.end)
    ) {
      return false;
    }
    applyTokenClasses(span, token, options);
    applyTokenReading(span, token);
  }
  return true;
}

/** Unbind a block: restore the original source node. */
export function unbindTokenBlock(block: TokenBlock): void {
  if (!block.isBound || block.sourceNodes.length === 0) return;

  const parent = block.element;
  let sourceNode = block.sourceNodes[0]!;
  const selector = `[data-cell-block-id="${block.id}"]`;
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
