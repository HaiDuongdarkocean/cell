import { createLookupCache } from '@/features/dictionaryPopup/controller/lookupCache';
import type { LookupResult } from '@/entities/dictionary';

function makeResult(term: string, langCode = 'en'): LookupResult {
  return {
    term,
    langCode,
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

  it('drops the entry when a word status is invalidated', () => {
    const cache = createLookupCache();
    const context = { contextSentence: 'Wrap your head around something.', cursorOffset: 25 };
    cache.set('something', 'en', [makeResult('something')], context);

    cache.invalidate('something', 'en');

    expect(cache.get('something', 'en', context)).toBeUndefined();
    expect(cache.has('something', 'en', context)).toBe(false);
  });

  it('invalidates entries cached under a different surface key but containing the resolved term', () => {
    const cache = createLookupCache();
    const context = { contextSentence: 'She is leaving soon.', cursorOffset: 7 };
    const withVariants = {
      ...makeResult('leave'),
      variants: [{ pos: 'verb', status: 'unknown' }],
    } as unknown as LookupResult;
    cache.set('leaving', 'en', [withVariants], context);

    cache.invalidate('leave', 'en');

    expect(cache.get('leaving', 'en', context)).toBeUndefined();
  });

  it('keeps entries for other terms and languages intact on invalidate', () => {
    const cache = createLookupCache();
    const context = { contextSentence: 'Wrap your head around something.', cursorOffset: 25 };
    cache.set('something', 'en', [makeResult('something')], context);
    cache.set('other', 'en', [makeResult('other')], context);
    cache.set('something', 'ja', [makeResult('something', 'ja')], context);

    cache.invalidate('something', 'en');

    expect(cache.get('other', 'en', context)).toHaveLength(1);
    expect(cache.get('something', 'ja', context)).toHaveLength(1);
  });
});
