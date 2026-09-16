import {
  generateSourceKey,
  hasGenerateSourceData,
  isPrefillUsableForTerm,
} from './generateSource';

describe('isPrefillUsableForTerm', () => {
  it('is unusable without a prefill', () => {
    expect(isPrefillUsableForTerm(undefined, 'word')).toBe(false);
  });

  it('is usable for an empty target word', () => {
    expect(isPrefillUsableForTerm({ targetWord: 'book' }, '')).toBe(true);
  });

  it('is usable when the prefill term matches (case-insensitive)', () => {
    expect(isPrefillUsableForTerm({ targetWord: 'Book' }, 'book')).toBe(true);
  });

  it('is unusable when the target word differs or prefill has no term', () => {
    expect(isPrefillUsableForTerm({ targetWord: 'book' }, 'car')).toBe(false);
    expect(isPrefillUsableForTerm({ definitions: 'd' }, 'car')).toBe(false);
  });
});

describe('generateSourceKey', () => {
  it('is lowercase-normalized per lang + term', () => {
    expect(generateSourceKey('en', 'Hello')).toBe('en:hello');
  });
});

describe('hasGenerateSourceData', () => {
  it('is false for an empty source', () => {
    expect(hasGenerateSourceData({})).toBe(false);
    expect(hasGenerateSourceData({ definitions: '  ', imageUrls: [] })).toBe(false);
  });

  it('is true when any resource is present', () => {
    expect(hasGenerateSourceData({ definitions: 'd' })).toBe(true);
    expect(hasGenerateSourceData({ wordAudioUrls: ['a.mp3'] })).toBe(true);
    expect(hasGenerateSourceData({ sentenceAudioUrls: ['s.mp3'] })).toBe(true);
    expect(hasGenerateSourceData({ imageUrls: ['i.png'] })).toBe(true);
  });
});
