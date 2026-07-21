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
  readonly onTokenClick?: (term: string, block: TokenBlock, element: HTMLElement, token: Token) => void;
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
        return;
      }
      // Inside <a> or <button>: single click opens popup, double click triggers native action.
      // e.detail === 2 on the second click of a double-click sequence.
      const interactive = span.closest('a, button');
      if (interactive) {
        e.preventDefault();
        if (e.detail === 2) {
          if (interactive.tagName === 'A') {
            const href = (interactive as HTMLAnchorElement).href;
            if (href) window.location.href = href;
          } else {
            // Re-dispatch a clean click so the button's own handler fires.
            interactive.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
          return;
        }
      }
      options.onTokenClick?.(token.term, block, span, token);
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

  // The showFrequency toggle controls the frequency layer for all tokens;
  // known/ignore words still keep their status styling, but frequency can be
  // shown when the user wants 100% frequency coverage.
  if (!options.showFrequency) {
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
  if (!block.tokens || block.tokens.length === 0 || block.sourceNodes.length === 0) return;

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
