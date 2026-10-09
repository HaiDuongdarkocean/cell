import { describe, expect, it } from '@jest/globals';
import type { Token, TokenBlock } from '@/features/tokenize/types';
import { collectSentenceRun } from './sentenceRun';

function tokensFor(sentences: number[]): Token[] {
  return sentences.map((sentenceIndex, i) => ({
    text: `w${i}`,
    term: `w${i}`,
    start: i * 2,
    end: i * 2 + 1,
    isSeparator: false,
    sentenceIndex,
    status: 'unknown',
    frequencyBand: undefined,
    reading: undefined,
  }));
}

function makeBlock(id: string, text: string, sentences: number[], parent: Element): TokenBlock {
  const element = document.createElement('span');
  parent.appendChild(element);
  const textNode = document.createTextNode(text);
  element.appendChild(textNode);
  return {
    id,
    element,
    sourceNodes: [textNode],
    originalText: text,
    tokens: tokensFor(sentences),
    isBound: false,
    lastAccessedAt: 0,
  };
}

describe('collectSentenceRun', () => {
  it('joins neighbouring blocks of one sentence split by inline elements', () => {
    const p = document.createElement('p');
    document.body.appendChild(p);
    // "A " + link + " program runs. Next one."
    const a = makeBlock('a', 'A ', [0], p);
    const b = makeBlock('b', 'Hello, world', [0], p);
    const c = makeBlock('c', '" program runs. Next', [0, 1], p);
    const d = makeBlock('d', ' one.', [0], p);
    const blocks = [a, b, c, d];

    const run = collectSentenceRun(blocks, c, 0);
    expect(run.map((e) => e.block.id).sort()).toEqual(['a', 'b', 'c']);
    expect(run.find((e) => e.block.id === 'c')!.sentenceIndex).toBe(0);

    // Sentence 1 starts mid-block, so it never merges left or right.
    const second = collectSentenceRun(blocks, c, 1);
    expect(second.map((e) => e.block.id)).toEqual(['c']);
  });

  it('stops at the block that closes the sentence', () => {
    const p = document.createElement('p');
    document.body.appendChild(p);
    const a = makeBlock('a', 'Done. ', [0], p);
    const b = makeBlock('b', 'Fresh sentence', [0], p);
    const blocks = [a, b];

    const run = collectSentenceRun(blocks, b, 0);
    expect(run.map((e) => e.block.id)).toEqual(['b']);
  });

  it('stops when the next block opens with the terminator of the hovered sentence', () => {
    const p = document.createElement('p');
    document.body.appendChild(p);
    // "…use in BCPL" + ". The example program was inherited" — the second
    // sentence is a separate sentence that only *looks* like sentence 0 of its
    // own block.
    const a = makeBlock('a', 'earlier use in ', [0], p);
    const b = makeBlock('b', 'BCPL', [0], p);
    const c = makeBlock('c', '. The example program', [1], p);
    const blocks = [a, b, c];

    const run = collectSentenceRun(blocks, b, 0);
    expect(run.map((e) => e.block.id).sort()).toEqual(['a', 'b', 'c']);
    // Only the leading terminator gap of block c belongs to the hovered
    // sentence; its words are sentence 1 and must stay unwashed.
    expect(run.find((e) => e.block.id === 'c')!.sentenceIndex).toBe(0);
  });

  it('never merges across separate paragraphs', () => {
    const p1 = document.createElement('p');
    const p2 = document.createElement('p');
    document.body.append(p1, p2);
    const a = makeBlock('a', 'open ended', [0], p1);
    const b = makeBlock('b', 'other para', [0], p2);
    const blocks = [a, b];

    expect(collectSentenceRun(blocks, b, 0).map((e) => e.block.id)).toEqual(['b']);
    expect(collectSentenceRun(blocks, a, 0).map((e) => e.block.id)).toEqual(['a']);
  });
});
