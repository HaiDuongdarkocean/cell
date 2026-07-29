import { describe, expect, it } from '@jest/globals';
import { tokenizeTextBlock, resolveTokenMetadata, getSentenceText, prepareTokenBlock } from './textTokenizer';
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

describe('resolveTokenMetadata', () => {
  it('fills status and frequency band for unique terms', async () => {
    const tokens: Token[] = [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: undefined, frequencyBand: undefined },
      { text: 'hello', term: 'hello', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: undefined, frequencyBand: undefined },
      { text: ' ', term: ' ', start: 5, end: 6, isSeparator: true, sentenceIndex: 0, status: undefined, frequencyBand: undefined },
    ];
    await resolveTokenMetadata(
      tokens,
      async (term) => (term === 'hello' ? 'known' : 'unknown'),
      async (term) => (term === 'hello' ? 'core' : 'none'),
    );
    expect(tokens[0]).toMatchObject({ status: 'known', frequencyBand: 'core' });
    expect(tokens[1]).toMatchObject({ status: 'known', frequencyBand: 'core' });
    expect(tokens[2]).toMatchObject({ status: undefined, frequencyBand: undefined });
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
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none' },
      { text: 'world', term: 'world', start: 6, end: 11, isSeparator: false, sentenceIndex: 0, status: 'unknown', frequencyBand: 'none' },
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
