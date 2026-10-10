import { describe, expect, it } from '@jest/globals';
import type { Token } from '@/features/tokenize/types';
import type { WordStatus } from '@/entities/dictionary';
import { markIPlus1Runs } from '@/features/tokenize/ui/tokenSpanRenderer';
import { hasSentenceEnd } from '@/shared/lib/sentencePunct';
import {
  IPLUS1_OFF_CLASS,
  IPLUS1_MIN_SCORABLE,
  markedTokenIndexes,
  pickIPlus1Index,
  type IPlus1Word,
} from './iPlus1Marking';

function word(term: string, isNew: boolean): IPlus1Word {
  return { term, isNew };
}

function tok(term: string, status?: WordStatus, sentenceIndex = 0, isSeparator = false): Token {
  return {
    text: term,
    term,
    start: 0,
    end: term.length,
    isSeparator,
    sentenceIndex,
    status,
    frequencyBand: undefined,
    reading: undefined,
  };
}

describe('pickIPlus1Index', () => {
  it('returns null when no word is new', () => {
    expect(pickIPlus1Index([word('a', false), word('b', false), word('c', false)])).toBeNull();
  });

  it('returns the index of the single new word', () => {
    expect(pickIPlus1Index([word('a', false), word('b', true), word('c', false)])).toBe(1);
  });

  it('returns null when two or more words are new', () => {
    expect(pickIPlus1Index([word('a', true), word('b', false), word('c', true), word('d', false)])).toBeNull();
  });

  it('returns null under the minimum scorable count', () => {
    expect(pickIPlus1Index([word('a', false), word('b', true)])).toBeNull();
    expect(pickIPlus1Index([word('a', true)])).toBeNull();
    expect(pickIPlus1Index([])).toBeNull();
  });

  it('excludes numeric terms from the scorable count', () => {
    expect(pickIPlus1Index([word('a', false), word('b', true), word('3', false)])).toBeNull();
    expect(pickIPlus1Index([word('a', false), word('b', true), word('c', false), word('3', false)])).toBe(1);
  });

  it('counts isNew only on scorable entries', () => {
    expect(pickIPlus1Index([word('a', false), word('b', false), word('c', false), word('42', true)])).toBeNull();
    expect(pickIPlus1Index([word('a', true), word('b', false), word('c', false), word('42', true)])).toBe(0);
  });
});

describe('markedTokenIndexes', () => {
  it('marks per sentence in isolation', () => {
    const tokens = [
      tok('one', 'known', 0),
      tok('two', 'known', 0),
      tok('durian', 'unknown', 0),
      tok('three', 'known', 1),
      tok('four', 'unknown', 1),
      tok('five', 'unknown', 1),
    ];
    expect([...markedTokenIndexes(tokens)]).toEqual([2]);
  });

  it('returns indexes into the full tokens array, separators included', () => {
    const tokens = [
      tok('one', 'known', 0),
      tok('.', 'known', 0, true),
      tok('two', 'known', 0),
      tok('durian', 'unknown', 0),
    ];
    expect([...markedTokenIndexes(tokens)]).toEqual([3]);
  });

  it('treats undefined status and tracking as new', () => {
    const tokens = [
      tok('one', 'known', 0),
      tok('two', 'known', 0),
      tok('durian', undefined, 0),
      tok('three', 'known', 1),
      tok('four', 'known', 1),
      tok('mango', 'tracking', 1),
    ];
    expect([...markedTokenIndexes(tokens)].sort((a, b) => a - b)).toEqual([2, 5]);
  });

  it('never marks a numeric token and excludes it from the scorable count', () => {
    const tokens = [
      tok('one', 'known', 0),
      tok('two', 'known', 0),
      tok('2024', undefined, 0),
    ];
    expect(markedTokenIndexes(tokens).size).toBe(0);

    const withNew = [
      tok('one', 'known', 0),
      tok('two', 'known', 0),
      tok('durian', 'unknown', 0),
      tok('2024', undefined, 0),
    ];
    expect([...markedTokenIndexes(withNew)]).toEqual([2]);
  });

  it('exports the i1-off class and minimum the renderers share', () => {
    expect(IPLUS1_OFF_CLASS).toBe('js-cell-token--i1-off');
    expect(IPLUS1_MIN_SCORABLE).toBe(3);
  });
});

function spanTok(
  text: string,
  start: number,
  status: WordStatus | undefined,
  sentenceIndex = 0,
  isSeparator = false,
): Token {
  return {
    text,
    term: text,
    start,
    end: start + text.length,
    isSeparator,
    sentenceIndex,
    status,
    frequencyBand: undefined,
    reading: undefined,
  };
}

/** Mirrors the DOM CueTokenText emits: word spans only for non-separator
 *  tokens, gap spans stamped with the binder's sentence convention. */
function renderCueTokenTextDom(text: string, tokens: readonly Token[], blockId = 'cue-1'): HTMLElement {
  const container = document.createElement('div');
  const marked = markedTokenIndexes(tokens);
  const first = tokens[0];
  let lastSentence = first
    ? Math.max(0, first.sentenceIndex - (hasSentenceEnd(text.slice(0, first.start)) ? 1 : 0))
    : 0;
  let lastEnd = 0;
  const appendGap = (from: number, to: number): void => {
    const gap = document.createElement('span');
    gap.className = 'js-cell-token js-cell-token--separator';
    gap.setAttribute('data-cell-block-id', blockId);
    gap.setAttribute('data-cell-sentence', String(lastSentence));
    gap.textContent = text.slice(from, to);
    container.appendChild(gap);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.isSeparator) continue;
    if (token.start > lastEnd) appendGap(lastEnd, token.start);
    const span = document.createElement('span');
    span.className = [
      'js-cell-token',
      'js-cell-token--word',
      `js-cell-token--status-${token.status ?? 'unknown'}`,
      marked.has(i) ? '' : IPLUS1_OFF_CLASS,
    ]
      .filter(Boolean)
      .join(' ');
    span.setAttribute('data-cell-term', token.term);
    span.setAttribute('data-cell-block-id', blockId);
    span.setAttribute('data-cell-sentence', String(token.sentenceIndex));
    span.setAttribute('data-cell-start', String(token.start));
    span.setAttribute('data-cell-end', String(token.end));
    const word = document.createElement('span');
    word.className = 'js-cell-token-word';
    word.textContent = token.text;
    span.appendChild(word);
    const status = document.createElement('span');
    status.className = 'js-cell-token-status';
    span.appendChild(status);
    container.appendChild(span);
    lastEnd = token.end;
    lastSentence = token.sentenceIndex;
  }
  if (lastEnd < text.length) appendGap(lastEnd, text.length);
  return container;
}

function domMarkedStarts(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.js-cell-token--word'))
    .filter((span) => !span.classList.contains(IPLUS1_OFF_CLASS))
    .map((span) => Number(span.getAttribute('data-cell-start')));
}

function expectedMarkedStarts(tokens: readonly Token[]): number[] {
  return [...markedTokenIndexes(tokens)]
    .map((i) => tokens[i]!.start)
    .sort((a, b) => a - b);
}

describe('i+1 parity: markedTokenIndexes vs markIPlus1Runs on cue DOM', () => {
  it('agrees on a sentence containing a numeric token and a skipped separator', () => {
    const text = 'aa 12 bb cc dd.';
    const tokens: Token[] = [
      spanTok('aa', 0, 'known'),
      spanTok('12', 3, 'unknown'),
      spanTok('bb', 6, 'known'),
      spanTok('cc', 9, 'unknown'),
      spanTok('dd', 12, 'known'),
      spanTok('.', 14, 'known', 0, true),
    ];
    expect(expectedMarkedStarts(tokens)).toEqual([9]);

    const container = renderCueTokenTextDom(text, tokens);
    markIPlus1Runs(container);

    expect(domMarkedStarts(container)).toEqual(expectedMarkedStarts(tokens));
  });

  it('marks per sentence on a multi-sentence cue', () => {
    const text = 'aa bb cc. dd ee ff.';
    const tokens: Token[] = [
      spanTok('aa', 0, 'known'),
      spanTok('bb', 3, 'known'),
      spanTok('cc', 6, 'unknown'),
      spanTok('.', 8, 'known', 0, true),
      spanTok('dd', 10, 'known', 1),
      spanTok('ee', 13, 'unknown', 1),
      spanTok('ff', 16, 'unknown', 1),
      spanTok('.', 18, 'known', 1, true),
    ];
    expect(expectedMarkedStarts(tokens)).toEqual([6]);

    const container = renderCueTokenTextDom(text, tokens);
    markIPlus1Runs(container);

    expect(domMarkedStarts(container)).toEqual(expectedMarkedStarts(tokens));
  });

  it('keeps both writers in agreement after a status flip re-mark', () => {
    const text = 'aa bb cc dd.';
    const tokens: Token[] = [
      spanTok('aa', 0, 'known'),
      spanTok('bb', 3, 'known'),
      spanTok('cc', 6, 'unknown'),
      spanTok('dd', 9, 'known'),
      spanTok('.', 11, 'known', 0, true),
    ];
    const container = renderCueTokenTextDom(text, tokens);
    markIPlus1Runs(container);
    expect(domMarkedStarts(container)).toEqual([6]);

    // applyTokenStatus writes a class then re-marks via the DOM rule.
    const bb = container.querySelector<HTMLElement>('[data-cell-term="bb"]')!;
    bb.classList.remove('js-cell-token--status-known');
    bb.classList.add('js-cell-token--status-unknown');
    markIPlus1Runs(container);

    const flipped = tokens.map((t) => (t.term === 'bb' ? { ...t, status: 'unknown' as const } : t));
    expect(domMarkedStarts(container)).toEqual(expectedMarkedStarts(flipped));
    expect(domMarkedStarts(container)).toEqual([]);
  });
});
