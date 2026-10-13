import { describe, expect, it } from '@jest/globals';
import {
  clearSentenceHighlight,
  computeSentenceBands,
  highlightSentence,
  sentenceTextForSpan,
  subtractRects,
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
      span.className = separator ? 'js-Tihoka-token js-Tihoka-token--separator' : 'js-Tihoka-token js-Tihoka-token--word';
      span.setAttribute('data-tihoka-block-id', `b${i}`);
      span.setAttribute('data-tihoka-sentence', String(sentence));
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
    const hovered = [...p.querySelectorAll<HTMLElement>('[data-tihoka-block-id="b3"]')][0]!;

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
    const hovered = [...p.querySelectorAll<HTMLElement>('[data-tihoka-block-id="b3"]')][0]!;

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

describe('subtractRects — popup clipping', () => {
  const band: BandBox = { top: 10, bottom: 20, left: 0, right: 100 };

  it('keeps the band when no holes are open', () => {
    expect(subtractRects(band, [])).toEqual([band]);
  });

  it('splits a band around a hole covering its full height', () => {
    expect(subtractRects(band, [{ top: 8, bottom: 24, left: 40, right: 60 }])).toEqual([
      { top: 10, bottom: 20, left: 0, right: 40 },
      { top: 10, bottom: 20, left: 60, right: 100 },
    ]);
  });

  it('keeps top and bottom strips when the hole is shorter than the band', () => {
    expect(subtractRects(band, [{ top: 12, bottom: 18, left: 0, right: 100 }])).toEqual([
      { top: 10, bottom: 12, left: 0, right: 100 },
      { top: 18, bottom: 20, left: 0, right: 100 },
    ]);
  });

  it('clips only the overlapped edge for a partial overlap', () => {
    expect(subtractRects(band, [{ top: 0, bottom: 30, left: 80, right: 200 }])).toEqual([
      { top: 10, bottom: 20, left: 0, right: 80 },
    ]);
  });

  it('drops the band when a hole covers it entirely', () => {
    expect(subtractRects(band, [{ top: 0, bottom: 50, left: -10, right: 200 }])).toEqual([]);
  });

  it('ignores holes that do not intersect', () => {
    expect(subtractRects(band, [{ top: 30, bottom: 40, left: 0, right: 100 }])).toEqual([band]);
  });

  it('subtracts multiple holes across the same band', () => {
    const pieces = subtractRects(band, [
      { top: 0, bottom: 30, left: 20, right: 30 },
      { top: 0, bottom: 30, left: 70, right: 80 },
    ]);
    expect(pieces).toEqual([
      { top: 10, bottom: 20, left: 0, right: 20 },
      { top: 10, bottom: 20, left: 30, right: 70 },
      { top: 10, bottom: 20, left: 80, right: 100 },
    ]);
  });
});
