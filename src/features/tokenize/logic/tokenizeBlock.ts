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

const FORBIDDEN_ROLE_ATTRS = ['link', 'textbox', 'tab', 'menuitem'];

export interface FindTextBlocksOptions {
  /** Maximum characters for a single text block. Longer blocks are skipped. */
  readonly maxLength?: number;
  /** Language code hint for downstream tokenization. */
  readonly langCode?: string;
  /** Prefix for block IDs. Defaults to 'block-'. */
  readonly idPrefix?: string;
}

/** Skip text nodes inside elements that are not meant for reading. */
function isForbiddenElement(element: Element): boolean {
  if (FORBIDDEN_TAGS.has(element.tagName)) return true;
  const role = element.getAttribute('role');
  if (role && FORBIDDEN_ROLE_ATTRS.includes(role)) return true;
  const contenteditable = element.getAttribute('contenteditable');
  if (contenteditable === 'true' || contenteditable === '') return true;
  return false;
}

/** Walk up to root, stopping if a forbidden ancestor is found. */
function hasForbiddenAncestor(element: Element, root: Node): boolean {
  let current: Element | null = element;
  while (current && current !== root) {
    if (isForbiddenElement(current)) return true;
    current = current.parentElement;
  }
  return false;
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
  let textNode: Text | null = walker.currentNode as Text | null;

  while (textNode) {
    const text = textNode.textContent ?? '';
    if (text.trim().length > 0 && text.length <= maxLength) {
      const parent = textNode.parentElement;
      if (parent && !hasForbiddenAncestor(parent, root)) {
        blocks.push({
          id: `${idPrefix}${idCounter++}`,
          element: parent,
          sourceNodes: [textNode],
          originalText: text,
          tokens: undefined,
          isBound: false,
          lastAccessedAt: 0,
        });
      }
    }
    textNode = walker.nextNode() as Text | null;
  }

  return blocks;
}
