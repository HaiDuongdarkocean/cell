import type { SrtCue } from '@/entities/media';
import {
  buildTranslateUrl,
  parseGoogleResponse,
  joinCueTexts,
  alignTranslatedSegments,
  encodePunctuation,
  decodePunctuation,
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

  describe('encodePunctuation', () => {
    it('replaces . ? ! ; with placeholders', () => {
      const encoded = encodePunctuation('Hello. World? Yes! No; Maybe');
      expect(encoded).not.toContain('.');
      expect(encoded).not.toContain('?');
      expect(encoded).not.toContain('!');
      expect(encoded).not.toContain(';');
      expect(encoded).toContain('DOT');
      expect(encoded).toContain('Q');
      expect(encoded).toContain('EXCL');
      expect(encoded).toContain('SEMI');
    });

    it('preserves comma and colon (Google does not split on them)', () => {
      const encoded = encodePunctuation('00:00:26,440 --> 00:00:32,740');
      expect(encoded).toBe('00:00:26,440 --> 00:00:32,740');
    });

    it('preserves CJK/Arabic/Hindi punctuation (Google does not split on them)', () => {
      expect(encodePunctuation('こんにちは。')).toBe('こんにちは。');
      expect(encodePunctuation('你好？')).toBe('你好？');
      expect(encodePunctuation('مرحبا؟')).toBe('مرحبا؟');
      expect(encodePunctuation('नमस्ते।')).toBe('नमस्ते।');
    });

    it('handles text without punctuation', () => {
      expect(encodePunctuation('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(encodePunctuation('')).toBe('');
    });

    it('encodes multiple occurrences of same punctuation', () => {
      const encoded = encodePunctuation('A. B. C.');
      expect(encoded.match(/DOT/g)?.length).toBe(3);
    });
  });

  describe('decodePunctuation', () => {
    it('restores . ? ! ; from placeholders', () => {
      const encoded = encodePunctuation('Hello. World? Yes! No; Maybe');
      const decoded = decodePunctuation(encoded);
      expect(decoded).toBe('Hello. World? Yes! No; Maybe');
    });

    it('round-trip: encode → decode preserves original text', () => {
      const originals = [
        'Hello world. Goodbye world.',
        'Are you ready? Let\'s go!',
        'No; yes; maybe.',
        '00:00:26,440 --> 00:00:32,740',
        'こんにちは。さようなら。',
        'مرحبا. كيف حالك؟',
        'नमस्ते। फिर मिलेंगे।',
        'No punctuation at all',
        '',
      ];
      for (const original of originals) {
        expect(decodePunctuation(encodePunctuation(original))).toBe(original);
      }
    });

    it('handles text without placeholders', () => {
      expect(decodePunctuation('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(decodePunctuation('')).toBe('');
    });
  });

  function cue(text: string, index = 1): SrtCue {
    return { index, start: 0, end: 0, text };
  }

  describe('joinCueTexts', () => {
    it('wraps cues in markers and encodes punctuation', () => {
      const joined = joinCueTexts([cue('Hello.'), cue('World?')]);
      expect(joined).not.toContain('.');
      expect(joined).not.toContain('?');
      expect(joined).toContain('⟦C0⟧');
      expect(joined).toContain('⟦/C0⟧');
      expect(joined).toContain('⟦C1⟧');
      expect(joined).toContain('⟦/C1⟧');
      expect(joined).toContain('DOT');
      expect(joined).toContain('Q');
    });

    it('returns empty string for empty array', () => {
      expect(joinCueTexts([])).toBe('');
    });

    it('wraps single cue in markers', () => {
      const joined = joinCueTexts([cue('Hello.')]);
      expect(joined).toBe('⟦C0⟧Hello ⦊⦋DOT⟦/C0⟧');
    });

    it('preserves comma and colon in joined text', () => {
      const joined = joinCueTexts([cue('00:00:26,440'), cue('00:00:32,740')]);
      expect(joined).toContain('00:00:26,440');
      expect(joined).toContain('00:00:32,740');
    });

    it('normalizes internal newlines to a single space before joining', () => {
      const joined = joinCueTexts([cue('Hello\nworld.'), cue('Foo\nbar')]);
      expect(joined).toContain('Hello world ⦊⦋DOT');
      expect(joined).toContain('Foo bar');
    });
  });

  describe('alignTranslatedSegments', () => {
    it('decodes placeholders when markers match', () => {
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
  });
});
