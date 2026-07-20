import { describe, expect, it } from '@jest/globals';
import { tokenizeTextBlock, resolveTokenMetadata } from './textTokenizer';
import type { Token } from '@/features/tokenize/types';

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
});

describe('resolveTokenMetadata', () => {
  it('fills status and frequency band for unique terms', async () => {
    const tokens: Token[] = [
      { text: 'Hello', term: 'hello', start: 0, end: 5, isSeparator: false, status: undefined, frequencyBand: undefined },
      { text: 'hello', term: 'hello', start: 6, end: 11, isSeparator: false, status: undefined, frequencyBand: undefined },
      { text: ' ', term: ' ', start: 5, end: 6, isSeparator: true, status: undefined, frequencyBand: undefined },
    ];
    await resolveTokenMetadata(
      tokens,
      async (term) => (term === 'hello' ? 'known' : 'unknown'),
      async (term) => (term === 'hello' ? 'high' : 'none'),
    );
    expect(tokens[0]).toMatchObject({ status: 'known', frequencyBand: 'high' });
    expect(tokens[1]).toMatchObject({ status: 'known', frequencyBand: 'high' });
    expect(tokens[2]).toMatchObject({ status: undefined, frequencyBand: undefined });
  });
});
