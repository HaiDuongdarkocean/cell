import { describe, expect, it } from '@jest/globals';
import {
  tokenizeTextBlock,
  resolveTokenMetadata,
  getSentenceText,
  prepareTokenBlock,
  sentenceRangeForIndex,
  sentenceIndexAtOffset,
  sentenceRangeAtOffset,
  sentenceTextForIndex,
} from './textTokenizer';
import type { Token, TokenBlock } from '@/features/tokenize/types';

describe('tokenizeTextBlock', () => {
  it('tokenizes English preserving surface case', () => {
    const tokens = tokenizeTextBlock('Hello world.', 'en');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false });
    expect(tokens[1]).toMatchObject({ text: 'world', term: 'world', start: 6, end: 11, isSeparator: false });
  });

  it('tokenizes contractions with offsets', () => {
    const tokens = tokenizeTextBlock("don't go", 'en');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ text: "don't", term: "don't", start: 0, end: 5 });
    expect(tokens[1]).toMatchObject({ text: 'go', term: 'go', start: 6, end: 8 });
  });

  it('opens a new sentence when the block starts with the previous terminator', () => {
    const tokens = tokenizeTextBlock('. The example program', 'en');
    const words = tokens.filter((t) => !t.isSeparator);
    expect(words.every((t) => t.sentenceIndex === 1)).toBe(true);
  });

  it.each([
    ['CJK', '你好。世界很好', 'zh', 1],
    ['CJK fullwidth question', '你好？世界很好', 'zh', 1],
    ['CJK ellipsis', 'そう…ですね', 'zh', 1],
  ])('splits %s sentences on their own terminator', (_name, text, lang, expectedLast) => {
    const words = tokenizeTextBlock(text, lang).filter((t) => !t.isSeparator);
    expect(words[words.length - 1]!.sentenceIndex).toBe(expectedLast);
  });

  it.each([
    ['Arabic question mark', 'كيف حالك؟ بخير', 'ar'],
    ['Devanagari danda', 'यह ठीक है। फिर', 'hi'],
  ])('splits %s sentences on their own terminator', (_name, text, lang) => {
    const words = tokenizeTextBlock(text, lang).filter((t) => !t.isSeparator);
    expect(words[words.length - 1]!.sentenceIndex).toBe(1);
  });

  it('marks compact duration stamps as separators (timestamps are chrome, not words)', () => {
    const tokens = tokenizeTextBlock('Posted 15h ago, edited 29m later', 'en');
    const byText = Object.fromEntries(tokens.map((t) => [t.text, t.isSeparator]));
    expect(byText['15h']).toBe(true);
    expect(byText['29m']).toBe(true);
    expect(byText['ago']).toBe(false);
    expect(byText['edited']).toBe(false);
  });

  it('drops single letters other than a/I (anti-scraping splinters, timestamp units)', () => {
    const tokens = tokenizeTextBlock('16 h a day, I saw x marks', 'en');
    const words = tokens.filter((t) => !t.isSeparator).map((t) => t.text);
    expect(words).toContain('a');
    expect(words).toContain('I');
    expect(words).toContain('day');
    expect(words).not.toContain('h');
    expect(words).not.toContain('x');
  });

  it('tokenizes Chinese by single characters when no dict', () => {
    const tokens = tokenizeTextBlock('我喜欢你', 'zh');
    expect(tokens.map((t) => t.text)).toEqual(['我', '喜', '欢', '你']);
    expect(tokens.every((t) => !t.isSeparator)).toBe(true);
  });

  it('defaults to English', () => {
    const tokens = tokenizeTextBlock('A quick test.');
    expect(tokens).toHaveLength(3);
    expect(tokens[0]!.term).toBe('a');
    expect(tokens[1]!.term).toBe('quick');
    expect(tokens[2]!.term).toBe('test');
  });

  it('assigns sentenceIndex incrementing at sentence-ending punctuation', () => {
    const tokens = tokenizeTextBlock('Hello world. Bye now!', 'en');
    // Sentence 0: "Hello world." → Hello, world
    // Sentence 1: "Bye now!" → Bye, now
    expect(tokens).toHaveLength(4);
    expect(tokens[0]).toMatchObject({ text: 'Hello', sentenceIndex: 0 });
    expect(tokens[1]).toMatchObject({ text: 'world', sentenceIndex: 0 });
    expect(tokens[2]).toMatchObject({ text: 'Bye', sentenceIndex: 1 });
    expect(tokens[3]).toMatchObject({ text: 'now', sentenceIndex: 1 });
  });

  it('handles multiple sentences with question marks', () => {
    const tokens = tokenizeTextBlock('Are you sure? Yes I am.', 'en');
    expect(tokens).toHaveLength(6);
    expect(tokens[0]).toMatchObject({ text: 'Are', sentenceIndex: 0 });
    expect(tokens[2]).toMatchObject({ text: 'sure', sentenceIndex: 0 });
    expect(tokens[3]).toMatchObject({ text: 'Yes', sentenceIndex: 1 });
    expect(tokens[5]).toMatchObject({ text: 'am', sentenceIndex: 1 });
  });

  it('filters out Vietnamese words with diacritics when tokenizing English', () => {
    // Most Vietnamese words carry tone marks/diacritics and are filtered.
    const tokens = tokenizeTextBlock('Tôi rất thích bài viết này.', 'en');
    expect(tokens.map((t) => t.text)).toEqual([]);
  });

  it('lets unmarked Latin words through (ASCII-only heuristic limitation)', () => {
    // "gia" has no Vietnamese tone marks so it shares the basic Latin alphabet
    // with English. Per-token filtering cannot distinguish it without context
    // or a dictionary. This is the known ceiling of the fast ASCII heuristic.
    const tokens = tokenizeTextBlock('Hello đại gia đình.', 'en');
    expect(tokens.map((t) => t.text)).toEqual(['Hello', 'gia']);
  });

  it('keeps English contractions, hyphenated words, and possessives', () => {
    const tokens = tokenizeTextBlock("don't go well-known dogs'", 'en');
    expect(tokens.map((t) => t.text)).toEqual(["don't", 'go', 'well-known', "dogs'"]);
  });

  it('normalizes curly apostrophe to straight so contractions are not filtered', () => {
    const tokens = tokenizeTextBlock('don\u2019t go', 'en');
    expect(tokens.map((t) => t.text)).toEqual(["don't", 'go']);
    expect(tokens[1]).toMatchObject({ start: 6, end: 8 });
  });

  it('filters non-English words for en-US subtag', () => {
    const tokens = tokenizeTextBlock('Hello thế giới.', 'en-US');
    expect(tokens.map((t) => t.text)).toEqual(['Hello']);
  });

  it('does not filter Chinese tokens when langCode is zh', () => {
    const tokens = tokenizeTextBlock('我喜欢你', 'zh');
    expect(tokens.map((t) => t.text)).toEqual(['我', '喜', '欢', '你']);
  });
});

describe('getSentenceText', () => {
  function makeBlock(text: string, tokens: Token[]): TokenBlock {
    return {
      id: 'test',
      element: {} as Element,
      sourceNodes: [],
      originalText: text,
      tokens,
      isBound: false,
      lastAccessedAt: 0,
    };
  }

  it('extracts the sentence containing a token (single sentence)', () => {
    const text = 'Hello world.';
    const tokens = tokenizeTextBlock(text, 'en');
    const block = makeBlock(text, tokens);
    expect(getSentenceText(block, tokens[1]!)).toBe('Hello world.');
  });

  it('extracts the correct sentence from a multi-sentence block', () => {
    const text = 'Hello world. Bye now!';
    const tokens = tokenizeTextBlock(text, 'en');
    const block = makeBlock(text, tokens);
    expect(getSentenceText(block, tokens[0]!)).toBe('Hello world.');
    expect(getSentenceText(block, tokens[2]!)).toBe('Bye now!');
  });

  it('extracts sentence with question mark boundary', () => {
    const text = 'Are you sure? Yes I am.';
    const tokens = tokenizeTextBlock(text, 'en');
    const block = makeBlock(text, tokens);
    expect(getSentenceText(block, tokens[0]!)).toBe('Are you sure?');
    expect(getSentenceText(block, tokens[3]!)).toBe('Yes I am.');
  });
});

describe('sentenceRangeForIndex', () => {
  it('covers first to last token plus the closing terminator', () => {
    const text = 'Hello world. Bye now!';
    const tokens = tokenizeTextBlock(text, 'en');
    expect(sentenceRangeForIndex(tokens, text, 0)).toEqual({ start: 0, end: 12 });
    expect(sentenceRangeForIndex(tokens, text, 1)).toEqual({ start: 13, end: 21 });
  });

  it('extends over closing quotes after the terminator', () => {
    const text = 'She said "hi." Then left.';
    const tokens = tokenizeTextBlock(text, 'en');
    const idx = sentenceIndexAtOffset(tokens, 1)!;
    const range = sentenceRangeForIndex(tokens, text, idx)!;
    expect(text.slice(range.start, range.end)).toBe('She said "hi."');
  });

  it('returns null for an unknown index', () => {
    const tokens = tokenizeTextBlock('Hello.', 'en');
    expect(sentenceRangeForIndex(tokens, 'Hello.', 7)).toBeNull();
  });
});

describe('sentenceIndexAtOffset', () => {
  const text = 'Hello world. Bye now!';
  const tokens = tokenizeTextBlock(text, 'en');

  it('resolves the token containing the offset', () => {
    expect(sentenceIndexAtOffset(tokens, 7)).toBe(0);
    expect(sentenceIndexAtOffset(tokens, 14)).toBe(1);
  });

  it('resolves gap offsets to the nearer sentence; ties go forward', () => {
    expect(sentenceIndexAtOffset(tokens, 11)).toBe(0); // '.' closes sentence 0
    expect(sentenceIndexAtOffset(tokens, 12)).toBe(1); // space before 'Bye'
  });

  it('returns null for empty token lists', () => {
    expect(sentenceIndexAtOffset([], 0)).toBeNull();
  });
});

describe('sentenceRangeAtOffset + sentenceTextForIndex', () => {
  it('locates the sentence at an offset in raw text', () => {
    const text = 'The depth is 3.5 km. That is deep.';
    const range = sentenceRangeAtOffset(text, 5, 'en')!;
    expect(text.slice(range.start, range.end)).toBe('The depth is 3.5 km.');
    const deep = sentenceRangeAtOffset(text, 30, 'en')!;
    expect(text.slice(deep.start, deep.end)).toBe('That is deep.');
  });

  it('renders the sentence text for a token index', () => {
    const text = 'Go. The ocean is vast.';
    const tokens = tokenizeTextBlock(text, 'en');
    expect(sentenceTextForIndex(tokens, text, 0)).toBe('Go.');
    expect(sentenceTextForIndex(tokens, text, 1)).toBe('The ocean is vast.');
  });
});

describe('resolveTokenMetadata', () => {
  it('fills status and frequency band for unique terms', async () => {
    const tokens: Token[] = [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: undefined, frequencyBand: undefined, reading: undefined },
      { text: 'hello', term: 'hello', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: undefined, frequencyBand: undefined, reading: undefined },
      { text: ' ', term: ' ', start: 5, end: 6, isSeparator: true, sentenceIndex: 0, status: undefined, frequencyBand: undefined, reading: undefined },
    ];
    await resolveTokenMetadata(
      tokens,
      async (term) => (term === 'hello' ? 'known' : 'unknown'),
      async (term) => (term === 'hello' ? 'core' : 'none'),
    );
    expect(tokens[0]).toMatchObject({ status: 'known', frequencyBand: 'core', reading: undefined });
    expect(tokens[1]).toMatchObject({ status: 'known', frequencyBand: 'core', reading: undefined });
    expect(tokens[2]).toMatchObject({ status: undefined, frequencyBand: undefined, reading: undefined });
  });
});

describe('prepareTokenBlock', () => {
  it('tokenizes when block.tokens is undefined', () => {
    const block = {
      id: 'b1',
      element: document.createElement('p'),
      sourceNodes: [],
      originalText: 'Hello world.',
    } as unknown as TokenBlock;
    prepareTokenBlock(block, 'en');
    expect(block.tokens).toHaveLength(2);
  });

  it('does not re-tokenize when block.tokens is already set', () => {
    const tokens: Token[] = [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none', reading: undefined },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none', reading: undefined },
    ];
    const block = {
      id: 'b1',
      element: document.createElement('p'),
      sourceNodes: [],
      originalText: 'completely different text',
      tokens,
    } as unknown as TokenBlock;
    prepareTokenBlock(block, 'en');
    expect(block.tokens).toBe(tokens);
    expect(block.tokens).toHaveLength(2);
  });
});
