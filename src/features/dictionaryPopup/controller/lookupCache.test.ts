import { createLookupCache } from '@/features/dictionaryPopup/controller/lookupCache';
import type { LookupResult } from '@/entities/dictionary';

function makeResult(term: string): LookupResult {
  return {
    term,
    definitions: [],
    status: 'unknown',
    sourceResourceId: 1,
    matchSource: 'dictionary',
  } as unknown as LookupResult;
}

describe('lookupCache', () => {
  it('returns the cached result for the same term in the same context', () => {
    const cache = createLookupCache();
    const context = { contextSentence: 'Wrap your head around something.', cursorOffset: 25 };

    cache.set('something', 'en', [makeResult('something')], context);

    expect(cache.get('something', 'en', context)).toHaveLength(1);
    expect(cache.has('something', 'en', context)).toBe(true);
  });

  it('misses when the same term is looked up in a different context sentence', () => {
    const cache = createLookupCache();
    cache.set('something', 'en', [makeResult('something')], {
      contextSentence: 'I have something to say.',
      cursorOffset: 8,
    });

    expect(
      cache.get('something', 'en', {
        contextSentence: 'Wrap your head around something.',
        cursorOffset: 25,
      }),
    ).toBeUndefined();
    expect(
      cache.has('something', 'en', {
        contextSentence: 'Wrap your head around something.',
        cursorOffset: 25,
      }),
    ).toBe(false);
  });

  it('misses when the same term sits at another cursor in the same sentence', () => {
    const cache = createLookupCache();
    const sentence = 'You want what you want.';
    cache.set('want', 'en', [makeResult('want')], { contextSentence: sentence, cursorOffset: 4 });

    expect(cache.get('want', 'en', { contextSentence: sentence, cursorOffset: 19 })).toBeUndefined();
  });

  it('keeps the context key when updating a word status', () => {
    const cache = createLookupCache();
    const context = { contextSentence: 'Wrap your head around something.', cursorOffset: 25 };
    cache.set('something', 'en', [makeResult('something')], context);

    cache.updateStatus('something', 'en', 'tracking');

    expect(cache.get('something', 'en', context)?.[0]?.status).toBe('tracking');
  });
});
