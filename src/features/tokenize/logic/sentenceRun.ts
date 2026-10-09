import type { TokenBlock } from '@/features/tokenize/types';

/** Nearest paragraph-ish container used to keep a sentence run inside one
 *  visual paragraph — a run never jumps across two separate paragraphs. */
const CONTAINER_SELECTOR = 'p, li, dd, dt, blockquote, figcaption, td, th, h1, h2, h3, h4, h5, h6';

const SENTENCE_END_RE = /[.!?]/;

export interface SentenceRunEntry {
  readonly block: TokenBlock;
  /** Sentence index to highlight inside that block. */
  readonly sentenceIndex: number;
}

function tailSentence(block: TokenBlock): { sentenceIndex: number; endsSentence: boolean } | null {
  const words = block.tokens?.filter((token) => !token.isSeparator) ?? [];
  const last = words[words.length - 1];
  if (!last) return null;
  return {
    sentenceIndex: last.sentenceIndex,
    endsSentence: SENTENCE_END_RE.test(block.originalText.slice(last.end)),
  };
}

function containerOf(block: TokenBlock): Element | null {
  return block.element.closest(CONTAINER_SELECTOR) ?? block.element.parentElement;
}

/**
 * Blocks whose text continues the hovered sentence.
 *
 * A block is one text node, so a sentence split by inline elements (links,
 * emphasis) spans several blocks. Sentence indices are per block, so the run
 * is rebuilt from the two ends: a neighbouring block joins when the previous
 * block has no sentence-ending punctuation after its last token; the join
 * stops at the block that carries the boundary punctuation.
 */
export function collectSentenceRun(
  blocks: readonly TokenBlock[],
  block: TokenBlock,
  sentenceIndex: number,
): SentenceRunEntry[] {
  const index = blocks.indexOf(block);
  if (index < 0) return [{ block, sentenceIndex }];

  const run: SentenceRunEntry[] = [{ block, sentenceIndex }];

  let cursor = block;
  for (let i = index; i + 1 < blocks.length; i++) {
    const tail = tailSentence(cursor);
    if (!tail || tail.endsSentence) break;
    const next = blocks[i + 1]!;
    if (containerOf(next) !== containerOf(cursor)) break;
    const nextTail = tailSentence(next);
    if (!nextTail) break;
    run.push({ block: next, sentenceIndex: 0 });
    if (nextTail.sentenceIndex > 0) break;
    cursor = next;
  }

  // The run only continues left when the hovered sentence starts at the
  // beginning of its own block — otherwise the sentence began mid-block.
  if (sentenceIndex === 0) {
    cursor = block;
    for (let i = index; i > 0; i--) {
      const prev = blocks[i - 1]!;
      if (containerOf(prev) !== containerOf(cursor)) break;
      const prevTail = tailSentence(prev);
      if (!prevTail || prevTail.endsSentence) break;
      run.push({ block: prev, sentenceIndex: prevTail.sentenceIndex });
      if (prevTail.sentenceIndex > 0) break;
      cursor = prev;
    }
  }

  return run;
}
