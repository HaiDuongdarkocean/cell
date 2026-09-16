import type { HighlightTarget } from '../ui/wordHighlight';
import type { HighlightAnchor, PopupLevel } from './controllerTypes';

/** Compute the character offset of `offset` inside `textNode` relative to
 *  `parent`'s full textContent. Sums text-node siblings that come first. */
export function computeTextOffset(parent: Element, textNode: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode()) !== null) {
    if (node === textNode) return total + offset;
    total += node.textContent?.length ?? 0;
  }
  return total;
}

/** Web text path: the original Range covers a single word in a Text node.
 *  Search for the phrase starting from the word's position. */
function createPhraseRangeFromTextRange(original: Range, phrase: string): Range | null {
  const textNode = original.startContainer;
  if (!(textNode instanceof Text)) return null;
  const nodeText = textNode.textContent ?? '';
  const wordStart = original.startOffset;
  const lowerPhrase = phrase.toLowerCase();
  const lowerNodeText = nodeText.toLowerCase();
  // Try: phrase starts at the same position as the hovered word.
  if (lowerNodeText.startsWith(lowerPhrase, wordStart)) {
    const range = document.createRange();
    try {
      range.setStart(textNode, wordStart);
      range.setEnd(textNode, wordStart + phrase.length);
      return range;
    } catch { return null; }
  }
  // Try: phrase starts before the hovered word (user hovered the 2nd word
  // of the phrase, e.g. hovered "up" → result "pick up").
  const maxBack = Math.min(wordStart, phrase.length * 2);
  for (let back = 1; back <= maxBack; back++) {
    const start = wordStart - back;
    if (lowerNodeText.startsWith(lowerPhrase, start)) {
      const range = document.createRange();
      try {
        range.setStart(textNode, start);
        range.setEnd(textNode, start + phrase.length);
        return range;
      } catch { return null; }
    }
  }
  return null;
}

/** Web text path after the single-word highlight has been wrapped: the parent
 *  element still contains the full sentence text, so search it and build a
 *  Range that may span multiple split Text nodes. */
export function createPhraseRangeFromAnchor(
  anchor: HighlightAnchor,
  phrase: string,
): Range | null {
  const { parent, wordStart } = anchor;
  const parentText = parent.textContent ?? '';
  const lowerPhrase = phrase.toLowerCase();
  const lowerParentText = parentText.toLowerCase();

  let phraseStart = -1;
  if (lowerParentText.startsWith(lowerPhrase, wordStart)) {
    phraseStart = wordStart;
  } else {
    const maxBack = Math.min(wordStart, phrase.length * 2);
    for (let back = 1; back <= maxBack; back++) {
      const start = wordStart - back;
      if (lowerParentText.startsWith(lowerPhrase, start)) {
        phraseStart = start;
        break;
      }
    }
  }
  if (phraseStart === -1) return null;

  const phraseEnd = phraseStart + phrase.length;
  const range = document.createRange();
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startSet = false;
  let node;
  while ((node = walker.nextNode()) !== null) {
    const nodeText = node.textContent ?? '';
    const nodeLen = nodeText.length;
    const nodeStart = currentOffset;
    const nodeEnd = currentOffset + nodeLen;
    if (!startSet && phraseStart >= nodeStart && phraseStart < nodeEnd) {
      try {
        range.setStart(node, phraseStart - nodeStart);
        startSet = true;
      } catch {
        return null;
      }
    }
    if (startSet && phraseEnd > nodeStart && phraseEnd <= nodeEnd) {
      try {
        range.setEnd(node, phraseEnd - nodeStart);
        return range;
      } catch {
        return null;
      }
    }
    currentOffset += nodeLen;
  }
  return null;
}

/** Subtitle token path: the original target is a .js-cell-token span (one
 *  word). Find adjacent .js-cell-token spans that together form the phrase. */
function createPhraseRangeFromToken(token: HTMLElement, phrase: string): Range | null {
  const line = token.closest('[data-role="target"]');
  if (!line) return null;
  const tokens = Array.from(line.querySelectorAll('.js-cell-token--word'));
  const tokenIdx = tokens.indexOf(token as HTMLElement);
  if (tokenIdx === -1) return null;
  const phraseWords = phrase.toLowerCase().split(/\s+/);
  // Try: phrase starts at the hovered token.
  for (let startIdx = Math.max(0, tokenIdx - phraseWords.length + 1); startIdx <= tokenIdx; startIdx++) {
    const endIdx = startIdx + phraseWords.length;
    if (endIdx > tokens.length) continue;
    const candidateWords = tokens.slice(startIdx, endIdx).map((t) => (t.getAttribute('data-cell-term') ?? '').toLowerCase());
    if (candidateWords.join(' ') === phraseWords.join(' ')) {
      const range = document.createRange();
      try {
        range.setStartBefore(tokens[startIdx]!);
        range.setEndAfter(tokens[endIdx - 1]!);
        return range;
      } catch { return null; }
    }
  }
  return null;
}

/** Create a DOM Range covering the given phrase term, starting from the
 *  original highlight target (single word). Returns null if the phrase
 *  cannot be found in the DOM near the original word. */
function createPhraseRange(level: PopupLevel, original: HighlightTarget, phrase: string): Range | null {
  if (level.highlightAnchor) {
    return createPhraseRangeFromAnchor(level.highlightAnchor, phrase);
  }
  if (original instanceof Range) {
    return createPhraseRangeFromTextRange(original, phrase);
  }
  if (original instanceof HTMLElement) {
    return createPhraseRangeFromToken(original, phrase);
  }
  return null;
}

/** Expand or restore the word highlight to match the given term.
 *  - Single word (no spaces): restore the original highlight target (the
 *    single word the user hovered/clicked).
 *  - Phrase (contains spaces): create a new Range covering the full phrase
 *    in the DOM. For web text, search the text node for the phrase starting
 *    from the original word's position. For subtitle tokens, find adjacent
 *    .js-cell-token spans that together form the phrase.
 *  Called after renderLookupResult (winner) and on candidate switch. */
export function expandHighlightForTerm(level: PopupLevel, term: string): void {
  if (!level.originalHighlightTarget) return;

  // Always clear the current highlight before computing the new range.
  // The original range is mutated by wordHighlight.show's surroundContents
  // (the text node gets split and wrapped), so ranges must be recreated from
  // the highlight anchor after the DOM is restored.
  level.highlight.clear();

  const isPhrase = term.includes(' ');
  if (!isPhrase) {
    level.highlightTarget = (level.highlightAnchor && createPhraseRangeFromAnchor(level.highlightAnchor, term))
      || level.originalHighlightTarget;
    level.highlight.show(level.highlightTarget);
    return;
  }

  // Phrase — try to create a Range covering the full phrase.
  const phraseRange = createPhraseRange(level, level.originalHighlightTarget, term);
  if (phraseRange) {
    level.highlightTarget = phraseRange;
    level.highlight.show(phraseRange);
  } else {
    // Fallback: keep original single-word highlight.
    level.highlightTarget = level.originalHighlightTarget;
    level.highlight.show(level.originalHighlightTarget);
  }
}
