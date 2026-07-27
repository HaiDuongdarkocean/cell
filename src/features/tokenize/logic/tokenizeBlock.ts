import type { TokenBlock } from '@/features/tokenize/types';
import { languageMatches } from '@/shared/config/languageRegistry';

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
const SUBTITLE_NATIVE_CLASS = 'native';

/** Extension UI host selectors — text inside these must NOT be tokenized.
 *  Light-DOM hosts (#cell-settings-dialog-host, #cell-card-creator-host,
 *  .js-cell-popup-host, #cell-universal-panel-host) contain React-rendered text
 *  that TreeWalker can reach. Shadow-DOM hosts (.js-cell-orbital-badge-host,
 *  .js-cell-token-badge-host) are included for safety even though TreeWalker
 *  doesn't cross shadow boundaries.
 *  Sub-trees marked `data-allow-tokenize` are whitelisted (e.g. card creator
 *  preview inside the universal panel). */
const EXTENSION_UI_HOST_SELECTORS =
  '#cell-settings-dialog-host, #cell-card-creator-host, #cell-universal-panel-host, .js-cell-popup-host, .js-cell-orbital-badge-host, .js-cell-token-badge-host';

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
  /** Optional predicate to reject blocks by parent element (e.g. visible viewport only).
   *  Results are cached per parent within the walk so the predicate is called once per element. */
  readonly filter?: (element: Element) => boolean;
}

/** Skip text nodes inside the native subtitle translation line. The target line
 *  is tokenized by this controller; the native line is a translation and must
 *  not be tokenized to avoid wrong-language lookups. */
function isNativeSubtitleLine(element: Element): boolean {
  return element.classList.contains(SUBTITLE_LINE_CLASS) && element.classList.contains(SUBTITLE_NATIVE_CLASS);
}

const ALLOW_TOKENIZE_SELECTOR = '[data-allow-tokenize]';

function isForbiddenElement(element: Element): boolean {
  if (FORBIDDEN_TAGS.has(element.tagName)) return true;
  if (isNativeSubtitleLine(element)) return true;
  if (element.closest(ALLOW_TOKENIZE_SELECTOR)) {
    return false;
  }
  if (element.closest(EXTENSION_UI_HOST_SELECTORS)) return true;
  const role = element.getAttribute('role');
  if (role && FORBIDDEN_ROLE_ATTRS.includes(role)) return true;
  const contenteditable = element.getAttribute('contenteditable');
  if (contenteditable === 'true' || contenteditable === '') return true;
  return false;
}

/** Reject text nodes that cannot produce a word in the target language.
 *  This avoids creating empty/separator-only blocks (e.g. "[1]", "3,000",
 *  pure whitespace) and lowers per-block overhead on pages with many inline tags.
 */
function hasPotentialWord(text: string, langCode?: string): boolean {
  if (!langCode || languageMatches('zh', langCode)) {
    return /[\p{Script=Han}\p{L}]/u.test(text);
  }
  if (languageMatches('en', langCode)) {
    return /[A-Za-z]/.test(text);
  }
  return /\p{L}/u.test(text);
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

// Stable IDs across findTextBlocks/findTextBlocksInNodes calls, so the cache
// can deduplicate the same text node whether it was discovered during the
// cold-start viewport scan or the full-page scan.
const blockIdMap = new WeakMap<Text, string>();
let nextBlockId = 0;

function getBlockId(textNode: Text, idPrefix: string): string {
  let id = blockIdMap.get(textNode);
  if (id === undefined) {
    id = `${idPrefix}${nextBlockId++}`;
    blockIdMap.set(textNode, id);
  }
  return id;
}

// Stable block objects per text node so the controller never observes two
// different TokenBlock instances for the same source text. This is required
// now that offscreen blocks are observed without being cached: a mutation
// re-scan must find the same block object the main scan already registered.
const blockByTextNode = new WeakMap<Text, TokenBlock>();

function createBlock(textNode: Text, idPrefix: string, text: string): TokenBlock {
  const existing = blockByTextNode.get(textNode);
  if (existing) {
    // Text may have changed while the controller was disabled or between scans;
    // invalidate tokens so the next bind uses the current text.
    if (existing.originalText !== text) {
      existing.originalText = text;
      existing.tokens = undefined;
      existing.isBound = false;
    }
    return existing;
  }
  const block: TokenBlock = {
    id: getBlockId(textNode, idPrefix),
    element: textNode.parentElement!,
    sourceNodes: [textNode],
    originalText: text,
    tokens: undefined,
    isBound: false,
    lastAccessedAt: 0,
  };
  blockByTextNode.set(textNode, block);
  return block;
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
  const { maxLength = 2000, idPrefix = 'block-', filter, langCode } = options;
  const blocks: TokenBlock[] = [];
  const filterCache = filter ? new Map<Element, boolean>() : null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let textNode: Text | null = walker.nextNode() as Text | null;

  while (textNode) {
    const text = textNode.textContent ?? '';
    if (text.trim().length > 0 && text.length <= maxLength && hasPotentialWord(text, langCode)) {
      const parent = textNode.parentElement;
      if (parent && !hasForbiddenContext(parent, root) && !insideTokenSpan(parent)) {
        if (filterCache) {
          let passes = filterCache.get(parent);
          if (passes === undefined) {
            passes = filter!(parent);
            filterCache.set(parent, passes);
          }
          if (!passes) {
            textNode = walker.nextNode() as Text | null;
            continue;
          }
        }
        blocks.push(createBlock(textNode, idPrefix, text));
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
  const { maxLength = 2000, idPrefix = 'block-', langCode } = options;
  const blocks: TokenBlock[] = [];

  function addTextNode(textNode: Text, root: Node): void {
    const text = textNode.textContent ?? '';
    if (text.trim().length === 0 || text.length > maxLength || !hasPotentialWord(text, langCode)) return;
    const parent = textNode.parentElement;
    if (!parent || insideTokenSpan(parent) || hasForbiddenContext(parent, root)) return;
    blocks.push(createBlock(textNode, idPrefix, text));
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
