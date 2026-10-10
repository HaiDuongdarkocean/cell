import { describe, expect, it } from '@jest/globals';
import {
  clearSentenceHighlight,
  computeSentenceBands,
  highlightSentence,
  sentenceTextForSpan,
  SENTENCE_CLASS,
  type BandBox,
} from './sentenceHighlight';

type Piece = readonly [text: string, sentence: number, separator?: boolean];

/** Render the paragraph exactly as the renderer does: one span per token or
 *  gap, the gap before a token carrying the *previous* token's sentence. */
function paragraph(blocks: readonly (readonly Piece[])[]): HTMLElement {
  const p = document.createElement('p');
  blocks.forEach((pieces, i) => {
    for (const [text, sentence, separator] of pieces) {
      const span = document.createElement('span');
      span.className = separator ? 'js-cell-token js-cell-token--separator' : 'js-cell-token js-cell-token--word';
      span.setAttribute('data-cell-block-id', `b${i}`);
      span.setAttribute('data-cell-sentence', String(sentence));
      span.textContent = text;
      p.appendChild(span);
    }
  });
  return p;
}

describe('highlightSentence', () => {
  it('washes every token of the hovered sentence across its blocks, and nothing else', () => {
    const p = paragraph([
      [['while', 0], [' ', 0, true], ['some', 0], [' ', 0, true]],
      [['esoteric', 0]],
      // ". " closes the previous sentence, "Other words " opens the hovered one.
      [['. ', 0, true], ['Other', 1], [' ', 1, true], ['words', 1], [' ', 1, true]],
      [['Chinese', 0]],
      [[' ', 0, true], ['or', 0], [' ', 0, true]],
      [['more', 0]],
      [[' ', 0, true], ['support', 0], ['.', 0, true]],
      [[' ', 0, true], ['Another', 0], [' ', 0, true], ['sentence', 0], ['.', 0, true]],
    ]);
    document.body.appendChild(p);
    const hovered = [...p.querySelectorAll<HTMLElement>('[data-cell-block-id="b3"]')][0]!;

    const washed = highlightSentence(hovered);
    const text = washed.map((el) => el.textContent).join('');

    expect(text).toContain('Other');
    expect(text).toContain('words');
    expect(text).toContain('Chinese');
    expect(text).toContain('or');
    expect(text).toContain('more');
    expect(text).toContain('support.');
    expect(text).not.toContain('esoteric');
    expect(text).not.toContain('while');
    expect(text).not.toContain('Another');
    expect(text).not.toContain('sentence');

    clearSentenceHighlight(washed);
    expect(p.querySelectorAll(`.${SENTENCE_CLASS}`)).toHaveLength(0);
  });
});

describe('sentenceTextForSpan', () => {
  it('returns the text of exactly the run the wash paints', () => {
    const p = paragraph([
      [['while', 0], [' ', 0, true], ['some', 0], [' ', 0, true]],
      [['esoteric', 0]],
      [['. ', 0, true], ['Other', 1], [' ', 1, true], ['words', 1], [' ', 1, true]],
      [['Chinese', 0]],
      [[' ', 0, true], ['or', 0], [' ', 0, true]],
      [['more', 0]],
      [[' ', 0, true], ['support', 0], ['.', 0, true]],
      [[' ', 0, true], ['Another', 0], [' ', 0, true], ['sentence', 0], ['.', 0, true]],
    ]);
    document.body.appendChild(p);
    const hovered = [...p.querySelectorAll<HTMLElement>('[data-cell-block-id="b3"]')][0]!;

    expect(sentenceTextForSpan(hovered)).toBe('Other words Chinese or more support.');
  });

  it('returns empty for a span outside a tokenized container', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    expect(sentenceTextForSpan(span)).toBe('');
  });
});

describe('computeSentenceBands', () => {
  const box = (top: number, bottom: number, left: number, right: number): BandBox => ({
    top,
    bottom,
    left,
    right,
  });

  it('merges same-line fragments into one band spanning the gaps between them', () => {
    const bands = computeSentenceBands([box(10, 20, 0, 30), box(10, 20, 34, 60), box(10, 20, 63, 90)], 32);
    expect(bands).toEqual([{ top: 10, bottom: 20, left: 0, right: 90 }]);
  });

  it('snaps a protruding fragment to the line modal edge so the band stays flat', () => {
    const bands = computeSentenceBands([box(10, 20, 0, 30), box(9, 21, 34, 60), box(10, 20, 63, 90)], 32);
    expect(bands).toEqual([{ top: 10, bottom: 20, left: 0, right: 90 }]);
  });

  it('emits one band per visual line for a wrapped sentence', () => {
    const bands = computeSentenceBands([box(10, 20, 0, 400), box(30, 40, 0, 120)], 32);
    expect(bands).toEqual([
      { top: 10, bottom: 20, left: 0, right: 400 },
      { top: 30, bottom: 40, left: 0, right: 120 },
    ]);
  });

  it('splits the band when the horizontal gap exceeds maxGap', () => {
    const bands = computeSentenceBands([box(10, 20, 0, 30), box(10, 20, 90, 120)], 32);
    expect(bands).toEqual([
      { top: 10, bottom: 20, left: 0, right: 30 },
      { top: 10, bottom: 20, left: 90, right: 120 },
    ]);
  });

  it('returns no bands for empty input', () => {
    expect(computeSentenceBands([], 32)).toEqual([]);
  });
});
