import type { TokenBlock } from '@/features/tokenize/types';

const FORBIDDEN_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'CANVAS',
  'SVG',
  'MATH',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'OPTGROUP',
  'LABEL',
  'CODE',
  'PRE',
  'KBD',
  'SAMP',
  'VAR',
]);

const SUBTITLE_LINE_CLASS = 'subtitle-line';
const NATIVE_CLASS = 'native';

// 'link' is intentionally NOT forbidden: <a href> is already implicit link and
// is tokenized (see test). Many sites (Facebook, Twitter) add explicit
// role="link" to anchors for ARIA redundancy — that must not disable tokenize
// for content like names, article titles, or post text inside those anchors.
const FORBIDDEN_ROLE_ATTRS = ['textbox', 'tab', 'menuitem'];

export interface FindTextBlocksOptions {
  /** Maximum characters for a single text block. Longer blocks are skipped. */
  readonly maxLength?: number;
  /** Language code hint for downstream tokenization. */
  readonly langCode?: string;
  /** Prefix for block IDs. Defaults to 'block-'. */
  readonly idPrefix?: string;
}

/** Skip text nodes inside elements that are not meant for reading. */
function isNativeLine(element: Element): boolean {
  return element.classList.contains(SUBTITLE_LINE_CLASS) && element.classList.contains(NATIVE_CLASS);
}

function isForbiddenElement(element: Element): boolean {
  if (FORBIDDEN_TAGS.has(element.tagName)) return true;
  if (isNativeLine(element)) return true;
  const role = element.getAttribute('role');
  if (role && FORBIDDEN_ROLE_ATTRS.includes(role)) return true;
  const contenteditable = element.getAttribute('contenteditable');
  if (contenteditable === 'true' || contenteditable === '') return true;
  return false;
}

/** Check whether `element` or any ancestor up to (but not including) `root` is forbidden. */
function hasForbiddenContext(element: Element, root: Node): boolean {
  if (isForbiddenElement(element)) return true;
  let current: Element | null = element.parentElement;
  while (current && current !== root) {
    if (isForbiddenElement(current)) return true;
    current = current.parentElement;
  }
  return false;
}

function createBlock(textNode: Text, id: string, text: string): TokenBlock {
  return {
    id,
    element: textNode.parentElement!,
    sourceNodes: [textNode],
    originalText: text,
    tokens: undefined,
    isBound: false,
    lastAccessedAt: 0,
  };
}

function insideTokenSpan(element: Element | null): boolean {
  if (!element) return false;
  return element.closest('.js-cell-token') !== null;
}

/**
 * Find candidate text blocks inside a root element.
 *
 * Each block maps to one source text node and its parent element.
 * This keeps rendering simple and avoids crossing inline-element boundaries.
 *
 * ponytail: does not merge adjacent text nodes under the same parent, so
 * paragraphs with many inline tags produce many small blocks. Upgrade path:
 * merge adjacent text nodes and teach the renderer to map token offsets to
 * multiple source nodes.
 */
export function findTextBlocks(root: Node, options: FindTextBlocksOptions = {}): TokenBlock[] {
  const { maxLength = 2000, idPrefix = 'block-' } = options;
  const blocks: TokenBlock[] = [];
  let idCounter = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let textNode: Text | null = walker.nextNode() as Text | null;

  while (textNode) {
    const text = textNode.textContent ?? '';
    if (text.trim().length > 0 && text.length <= maxLength) {
      const parent = textNode.parentElement;
      if (parent && !hasForbiddenContext(parent, root)) {
        blocks.push(createBlock(textNode, `${idPrefix}${idCounter++}`, text));
      }
    }
    textNode = walker.nextNode() as Text | null;
  }

  return blocks;
}

/**
 * Find candidate text blocks inside a list of newly added DOM nodes.
 *
 * This is used by the MutationObserver re-scan path to avoid walking the
 * entire document body after every small DOM change (Facebook re-renders,
 * lazy-loaded content, etc.). Text nodes are handled directly; elements and
 * document fragments are walked recursively. Nodes inside existing token
 * spans are skipped.
 */
export function findTextBlocksInNodes(nodes: readonly Node[], options: FindTextBlocksOptions = {}): TokenBlock[] {
  const { maxLength = 2000, idPrefix = 'block-' } = options;
  const blocks: TokenBlock[] = [];
  let idCounter = 0;

  function addTextNode(textNode: Text, root: Node): void {
    const text = textNode.textContent ?? '';
    if (text.trim().length === 0 || text.length > maxLength) return;
    const parent = textNode.parentElement;
    if (!parent || insideTokenSpan(parent) || hasForbiddenContext(parent, root)) return;
    blocks.push(createBlock(textNode, `${idPrefix}${idCounter++}`, text));
  }

  function walkRoot(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let textNode: Text | null = walker.nextNode() as Text | null;
    while (textNode) {
      addTextNode(textNode, root);
      textNode = walker.nextNode() as Text | null;
    }
  }

  for (const node of nodes) {
    if (!node.isConnected) continue;
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = (node as Text).parentElement;
      if (parent && !insideTokenSpan(parent)) {
        addTextNode(node as Text, parent);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      if (node instanceof Element && (insideTokenSpan(node) || isForbiddenElement(node))) continue;
      walkRoot(node);
    }
  }

  return blocks;
}
