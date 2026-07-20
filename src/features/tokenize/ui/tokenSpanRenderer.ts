import type { Token, TokenBlock } from '@/features/tokenize/types';
import { injectTokenSpanStyle } from './tokenSpanCss';

export interface TokenSpanBindOptions {
  /** Show status underline layer. */
  readonly showStatus: boolean;
  /** Show frequency background/text layer. */
  readonly showFrequency: boolean;
  /** Hover a word token (desktop). */
  readonly onTokenEnter?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Leave a word token (desktop). */
  readonly onTokenLeave?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Click a word token to open the popup dictionary. */
  readonly onTokenClick?: (term: string, block: TokenBlock, element: HTMLElement) => void;
  /** Ctrl/Cmd+click a word token to multi-select. */
  readonly onTokenCtrlClick?: (term: string, block: TokenBlock, element: HTMLElement) => void;
}

const TOKEN_CLASS = 'js-cell-token';
const WORD_CLASS = 'js-cell-token--word';
const SEPARATOR_CLASS = 'js-cell-token--separator';
const WORD_INNER_CLASS = 'js-cell-token-word';
const STATUS_CLASS = 'js-cell-token-status';

function createSeparatorSpan(text: string, block: TokenBlock): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `${TOKEN_CLASS} ${SEPARATOR_CLASS}`;
  span.setAttribute('data-cell-block-id', block.id);
  span.textContent = text;
  return span;
}

function createTokenSpan(token: Token, block: TokenBlock, options: TokenSpanBindOptions): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = TOKEN_CLASS;
  span.setAttribute('data-cell-term', token.term);
  span.setAttribute('data-cell-block-id', block.id);
  span.setAttribute('data-cell-start', String(token.start));
  span.setAttribute('data-cell-end', String(token.end));

  if (!token.isSeparator && (options.onTokenEnter || options.onTokenLeave || options.onTokenClick || options.onTokenCtrlClick)) {
    span.addEventListener('mouseenter', () => options.onTokenEnter?.(token.term, block, span));
    span.addEventListener('mouseleave', () => options.onTokenLeave?.(token.term, block, span));
    span.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        options.onTokenCtrlClick?.(token.term, block, span);
      } else {
        options.onTokenClick?.(token.term, block, span);
      }
    });
  }

  if (token.status) {
    span.classList.add(`js-cell-token--status-${token.status}`);
  }

  if (token.frequencyBand && token.frequencyBand !== 'none') {
    span.classList.add(`js-cell-token--frequency-${token.frequencyBand}`);
  }

  if (!options.showStatus) {
    span.classList.add('js-cell-token--status-off');
  }

  // known/ignore always hide frequency by default; showFrequency toggle only affects unknown/tracking
  if (!options.showFrequency || token.status === 'known' || token.status === 'ignore') {
    span.classList.add('js-cell-token--frequency-off');
  }

  span.classList.add(WORD_CLASS);

  const word = document.createElement('span');
  word.className = WORD_INNER_CLASS;
  word.textContent = token.text;
  span.appendChild(word);

  const status = document.createElement('span');
  status.className = STATUS_CLASS;
  status.setAttribute('aria-hidden', 'true');
  span.appendChild(status);

  return span;
}

/** Bind a prepared block to the DOM: replace source text with token spans. */
export function bindTokenBlock(block: TokenBlock, options: TokenSpanBindOptions): void {
  if (block.isBound || !block.tokens || block.tokens.length === 0 || block.sourceNodes.length === 0) return;

  injectTokenSpanStyle();

  const parent = block.element;
  const sourceNode = block.sourceNodes[0]!;
  const text = block.originalText;
  const tokens = [...block.tokens].sort((a, b) => a.start - b.start);

  const fragment = document.createDocumentFragment();
  let lastEnd = 0;
  for (const token of tokens) {
    if (token.start > lastEnd) {
      fragment.appendChild(createSeparatorSpan(text.slice(lastEnd, token.start), block));
    }
    fragment.appendChild(createTokenSpan(token, block, options));
    lastEnd = token.end;
  }
  if (lastEnd < text.length) {
    fragment.appendChild(createSeparatorSpan(text.slice(lastEnd), block));
  }

  parent.replaceChild(fragment, sourceNode);
  block.isBound = true;
}

/** Unbind a block: restore the original source node. */
export function unbindTokenBlock(block: TokenBlock): void {
  if (!block.isBound || block.sourceNodes.length === 0) return;

  const parent = block.element;
  const sourceNode = block.sourceNodes[0]!;
  const selector = `[data-cell-block-id="${block.id}"]`;
  const rendered = Array.from(parent.querySelectorAll(selector));
  if (rendered.length === 0) {
    block.isBound = false;
    return;
  }

  parent.insertBefore(sourceNode, rendered[0]!);
  for (const node of rendered) {
    node.remove();
  }
  block.isBound = false;
}
