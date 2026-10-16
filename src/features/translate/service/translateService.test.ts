import type { SrtCue } from '@/entities/media';
import {
  buildTranslateRequest,
  normalizeTranslationInput,
  parseGoogleResponse,
  joinCueTexts,
  alignTranslatedSegments,
  joinTermTexts,
  alignTermGlosses,
  chunkTermMarkerTexts,
} from '@/features/translate/service/translateService';

describe('translateService', () => {
  describe('normalizeTranslationInput', () => {
    it('restores g-dropping slang', () => {
      expect(normalizeTranslationInput("leavin' isn't better than tryin'"))
        .toBe("leaving isn't better than trying");
    });

    it('preserves case on ALL-CAPS tracks', () => {
      expect(normalizeTranslationInput("LEAVIN' ISN'T BETTER THAN TRYIN'"))
        .toBe("LEAVING ISN'T BETTER THAN TRYING");
    });

    it('leaves possessives and inner apostrophes alone', () => {
      expect(normalizeTranslationInput("Martin's guitar")).toBe("Martin's guitar");
      expect(normalizeTranslationInput("isn't ain't")).toBe("isn't ain't");
    });
  });

  describe('buildTranslateRequest', () => {
    it('builds URL params + POST body with q', () => {
      const { url, body } = buildTranslateRequest('hello world', 'en', 'vi');
      expect(url).toContain('client=gtx');
      expect(url).toContain('sl=en');
      expect(url).toContain('tl=vi');
      expect(url).toContain('dt=t');
      expect(url).not.toContain('q=');
      expect(body).toBe('q=hello+world');
    });

    it('encodes multi-line text with %0A in the body', () => {
      const { body } = buildTranslateRequest('line1\nline2', 'en', 'vi');
      expect(body).toContain('q=line1%0Aline2');
    });

    it('supports auto-detect source language', () => {
      const { url } = buildTranslateRequest('hello', 'auto', 'vi');
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

  function cue(text: string, index = 1): SrtCue {
    return { index, start: 0, end: 0, text };
  }

  describe('joinCueTexts', () => {
    it('wraps cues in markers and preserves punctuation verbatim', () => {
      const joined = joinCueTexts([cue('Hello.'), cue('World?')]);
      expect(joined).toContain('⟦C0⟧');
      expect(joined).toContain('⟦/C0⟧');
      expect(joined).toContain('⟦C1⟧');
      expect(joined).toContain('⟦/C1⟧');
      // Punctuation sent verbatim (no placeholder encoding).
      expect(joined).toContain('Hello.');
      expect(joined).toContain('World?');
      expect(joined).not.toContain('DOT');
      expect(joined).not.toContain('\u298A');
    });

    it('returns empty string for empty array', () => {
      expect(joinCueTexts([])).toBe('');
    });

    it('wraps single cue in markers', () => {
      const joined = joinCueTexts([cue('Hello.')]);
      expect(joined).toBe('⟦C0⟧Hello.⟦/C0⟧');
    });

    it('preserves comma and colon in joined text', () => {
      const joined = joinCueTexts([cue('00:00:26,440'), cue('00:00:32,740')]);
      expect(joined).toContain('00:00:26,440');
      expect(joined).toContain('00:00:32,740');
    });

    it('normalizes internal newlines to a single space before joining', () => {
      const joined = joinCueTexts([cue('Hello\nworld.'), cue('Foo\nbar')]);
      expect(joined).toContain('Hello world.');
      expect(joined).toContain('Foo bar');
    });
  });

  describe('alignTranslatedSegments', () => {
    it('extracts per-cue text when markers match', () => {
      const joined = joinCueTexts([cue('Xin chào.')]);
      const aligned = alignTranslatedSegments([joined], 1);
      expect(aligned).toEqual(['Xin chào.']);
    });

    it('aligns multiple cues from one segment', () => {
      const joined = joinCueTexts([cue('Xin chào.'), cue('Tạm biệt.')]);
      const aligned = alignTranslatedSegments([joined], 2);
      expect(aligned).toEqual(['Xin chào.', 'Tạm biệt.']);
    });

    it('aligns multiple cues from multiple segments', () => {
      const joined = joinCueTexts([cue('Xin chào.'), cue('Tạm biệt.')]);
      // Simulate Google splitting into 2 segments at each cue
      const seg1 = joined.slice(0, joined.indexOf('⟦/C0⟧') + '⟦/C0⟧'.length);
      const seg2 = joined.slice(seg1.length);
      const aligned = alignTranslatedSegments([seg1, seg2], 2);
      expect(aligned).toEqual(['Xin chào.', 'Tạm biệt.']);
    });

    it('pads with empty strings when markers are missing', () => {
      const aligned = alignTranslatedSegments(['⟦C0⟧hello⟦/C0⟧'], 3);
      expect(aligned).toEqual(['hello', '', '']);
    });

    it('returns array of empty strings when translated is empty', () => {
      expect(alignTranslatedSegments([], 3)).toEqual(['', '', '']);
    });

    it('returns empty array when both are empty', () => {
      expect(alignTranslatedSegments([], 0)).toEqual([]);
    });

    it('handles merged segment with spaces around marker content', () => {
      const joined = joinCueTexts([cue('Xin chào.'), cue('Tạm biệt.')]);
      // Google sometimes adds spaces around markers
      const spaced = joined.replace(/⟦/g, ' ⟦').replace(/⟧/g, '⟧ ');
      const aligned = alignTranslatedSegments([spaced], 2);
      expect(aligned).toEqual(['Xin chào.', 'Tạm biệt.']);
    });

    it('aligns cues when Google ASCII-ifies markers into [[Cn]]', () => {
      // Observed on YouTube ASR lyric tracks: ⟦/C60⟧ comes back as [[/C60]] —
      // without normalization the cue text would swallow the neighbour's
      // markers and print `[[/C60]][[C61]]` to the user.
      const aligned = alignTranslatedSegments(
        ['⟦C0⟧Anh sẽ chờ tình yêu[[/C0]]\n[[C1]]I will wait for love[[/C1]]'],
        2,
      );
      expect(aligned).toEqual(['Anh sẽ chờ tình yêu', 'I will wait for love']);
    });

    it('strips marker residue that lands inside extracted cue text', () => {
      const aligned = alignTranslatedSegments(
        ['⟦C0⟧Anh sẽ chờ [[/C99]] tình yêu⟦/C0⟧'],
        1,
      );
      expect(aligned).toEqual(['Anh sẽ chờ tình yêu']);
    });

    it('accepts fullwidth 【Cn】 marker variants', () => {
      const aligned = alignTranslatedSegments(
        ['【C0】xin chào【/C0】'],
        1,
      );
      expect(aligned).toEqual(['xin chào']);
    });
  });

  describe('joinTermTexts', () => {
    it('wraps each term in ⟦Ti⟧ markers separated by newlines', () => {
      // '\n' separators keep Google translating the terms instead of echoing
      // the marker-glued blob back untranslated.
      expect(joinTermTexts(['hello', 'world'])).toBe('⟦T0⟧hello⟦/T0⟧\n⟦T1⟧world⟦/T1⟧');
    });

    it('strips newlines from terms', () => {
      expect(joinTermTexts(['a\nb'])).toBe('⟦T0⟧a b⟦/T0⟧');
    });
  });

  describe('alignTermGlosses', () => {
    it('maps marked segments back to indices', () => {
      const aligned = alignTermGlosses(['⟦T0⟧xin chào⟦/T0⟧⟦T1⟧thế giới⟦/T1⟧'], 2);
      expect(aligned).toEqual(['xin chào', 'thế giới']);
    });

    it('pads with empty strings for absent markers', () => {
      expect(alignTermGlosses(['⟦T1⟧thế giới⟦/T1⟧'], 2)).toEqual(['', 'thế giới']);
    });

    it('survives the provider reordering markers', () => {
      const aligned = alignTermGlosses(['⟦T1⟧thế giới⟦/T1⟧ ⟦T0⟧xin chào⟦/T0⟧'], 2);
      expect(aligned).toEqual(['xin chào', 'thế giới']);
    });
  });

  describe('chunkTermMarkerTexts', () => {
    it('keeps every chunk under the char budget', () => {
      const terms = Array.from({ length: 50 }, (_, i) => `term-${i}-${'x'.repeat(40)}`);
      const chunks = chunkTermMarkerTexts(terms, 1500);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(joinTermTexts(chunk).length).toBeLessThanOrEqual(1500);
      }
      expect(chunks.flat()).toEqual(terms);
    });

    it('restarts marker indices per chunk', () => {
      // 1484 + 11 marker chars = 1495; adding "b" (12 marked chars) overflows.
      const chunks = chunkTermMarkerTexts(['a'.repeat(1484), 'b'], 1500);
      expect(chunks).toHaveLength(2);
      expect(joinTermTexts(chunks[1]!)).toBe('⟦T0⟧b⟦/T0⟧');
    });

    it('returns a single chunk for a lone oversized term', () => {
      const chunks = chunkTermMarkerTexts(['a'.repeat(2000)], 1500);
      expect(chunks).toHaveLength(1);
    });
  });
});
