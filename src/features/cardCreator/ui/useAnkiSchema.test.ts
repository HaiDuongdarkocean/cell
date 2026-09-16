import { describe, expect, it } from '@jest/globals';
import { isSameOpenContextSession } from './useAnkiSchema';
import type { CardCreatorOpenContext } from '../types';

const baseContext: CardCreatorOpenContext = {
  sourceLang: 'en',
  targetLang: 'vi',
  prefill: { targetWord: 'book' },
};

describe('isSameOpenContextSession', () => {
  it('returns true for structurally identical contexts', () => {
    expect(isSameOpenContextSession(baseContext, { ...baseContext })).toBe(true);
  });

  it('returns true when only the prefill differs', () => {
    const resent: CardCreatorOpenContext = {
      ...baseContext,
      prefill: { targetWord: 'book', sentence: 'new sentence' },
    };
    expect(isSameOpenContextSession(baseContext, resent)).toBe(true);
  });

  it('returns false when sourceLang differs', () => {
    expect(
      isSameOpenContextSession(baseContext, { ...baseContext, sourceLang: 'ja' }),
    ).toBe(false);
  });

  it('returns false when targetLang differs', () => {
    expect(
      isSameOpenContextSession(baseContext, { ...baseContext, targetLang: 'en' }),
    ).toBe(false);
  });

  it('returns false when the queue reference differs', () => {
    const withQueue: CardCreatorOpenContext = {
      ...baseContext,
      queue: [{ term: 'apple', definitions: '', status: 'unknown' }],
    };
    expect(isSameOpenContextSession(baseContext, withQueue)).toBe(false);
  });

  it('returns true when the queue reference is shared', () => {
    const queue: CardCreatorOpenContext['queue'] = [
      { term: 'apple', definitions: '', status: 'unknown' },
    ];
    const a: CardCreatorOpenContext = { ...baseContext, queue };
    const b: CardCreatorOpenContext = { ...baseContext, queue };
    expect(isSameOpenContextSession(a, b)).toBe(true);
  });
});
