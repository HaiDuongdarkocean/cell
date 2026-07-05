import {
  buildTranslateUrl,
  parseGoogleResponse,
  joinCueTexts,
  alignTranslatedSegments,
} from '@/features/translate/service/translateService';

describe('translateService', () => {
  describe('buildTranslateUrl', () => {
    it('builds URL with client=gtx, sl, tl, dt=t, q params', () => {
      const url = buildTranslateUrl('hello world', 'en', 'vi');
      expect(url).toContain('client=gtx');
      expect(url).toContain('sl=en');
      expect(url).toContain('tl=vi');
      expect(url).toContain('dt=t');
      expect(url).toContain('q=hello+world');
    });

    it('encodes multi-line text with %0A', () => {
      const url = buildTranslateUrl('line1\nline2', 'en', 'vi');
      expect(url).toContain('q=line1%0Aline2');
    });

    it('supports auto-detect source language', () => {
      const url = buildTranslateUrl('hello', 'auto', 'vi');
      expect(url).toContain('sl=auto');
    });
  });

  describe('parseGoogleResponse', () => {
    it('extracts translated segments from valid response', () => {
      const response = [
        [
          ['Xin chào', 'Hello'],
          ['thế giới', 'world'],
        ],
      ];
      expect(parseGoogleResponse(response)).toEqual(['Xin chào', 'thế giới']);
    });

    it('returns empty array for non-array response', () => {
      expect(parseGoogleResponse(null)).toEqual([]);
      expect(parseGoogleResponse('not an array')).toEqual([]);
      expect(parseGoogleResponse(42)).toEqual([]);
      expect(parseGoogleResponse({})).toEqual([]);
    });

    it('returns empty array when first element is not an array', () => {
      expect(parseGoogleResponse(['not nested'])).toEqual([]);
      expect(parseGoogleResponse([42])).toEqual([]);
      expect(parseGoogleResponse([{}])).toEqual([]);
    });

    it('returns empty array for empty segments', () => {
      expect(parseGoogleResponse([[]])).toEqual([]);
    });

    it('skips segments where seg[0] is not a string', () => {
      const response = [
        [
          ['valid', 'orig'],
          [null, 'skip'],
          [42, 'skip2'],
          ['also valid', 'orig2'],
        ],
      ];
      expect(parseGoogleResponse(response)).toEqual(['valid', '', '', 'also valid']);
    });

    it('handles single-segment response', () => {
      const response = [[['Xin chào', 'Hello']]];
      expect(parseGoogleResponse(response)).toEqual(['Xin chào']);
    });
  });

  describe('joinCueTexts', () => {
    it('joins texts with newline', () => {
      expect(joinCueTexts(['hello', 'world'])).toBe('hello\nworld');
    });

    it('returns empty string for empty array', () => {
      expect(joinCueTexts([])).toBe('');
    });

    it('returns single text unchanged for one-element array', () => {
      expect(joinCueTexts(['solo'])).toBe('solo');
    });
  });

  describe('alignTranslatedSegments', () => {
    it('returns translated as-is when count matches', () => {
      expect(alignTranslatedSegments(['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c']);
    });

    it('pads with empty strings when translated is shorter than expected', () => {
      expect(alignTranslatedSegments(['a', 'b'], 4)).toEqual(['a', 'b', '', '']);
    });

    it('truncates when translated is longer than expected', () => {
      expect(alignTranslatedSegments(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b']);
    });

    it('returns array of empty strings when translated is empty', () => {
      expect(alignTranslatedSegments([], 3)).toEqual(['', '', '']);
    });

    it('returns empty array when both are empty', () => {
      expect(alignTranslatedSegments([], 0)).toEqual([]);
    });
  });
});
