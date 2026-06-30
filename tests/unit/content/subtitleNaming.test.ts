import { formatSubtitleName } from '../../../src/features/subtitle/logic/subtitleNaming';

describe('formatSubtitleName (ADR-015 — friendly naming convention)', () => {
  describe('auto-detected subtitles', () => {
    it('formats ISO code + index → capitalized language + #(index+1)', () => {
      expect(formatSubtitleName('auto', 'en', 1)).toBe('English #2');
      expect(formatSubtitleName('auto', 'ar', 0)).toBe('Arabic #1');
      expect(formatSubtitleName('auto', 'vi', 2)).toBe('Vietnamese #3');
    });

    it('falls back to Sub #N when language unknown', () => {
      expect(formatSubtitleName('auto', 'xx', 0)).toBe('Sub #1');
      expect(formatSubtitleName('auto', '', 3)).toBe('Sub #4');
    });
  });

  describe('imported subtitles', () => {
    it('strips .srt extension', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'my-subtitle.srt')).toBe('my-subtitle');
    });

    it('strips .vtt extension', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'my-sub.vtt')).toBe('my-sub');
    });

    it('strips .ass extension', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'my-sub.ass')).toBe('my-sub');
    });

    it('strips .ssa extension', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'my-sub.ssa')).toBe('my-sub');
    });

    it('preserves dots in filename (only strips last extension)', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'my.sub.title.srt')).toBe('my.sub.title');
    });

    it('truncates filename >20 chars + ellipsis', () => {
      const long = 'very-long-filename-here-123456.srt';
      const result = formatSubtitleName('imported', 'en', 0, long);
      expect(result).toBe('very-long-filename-h…');
      expect(result.length).toBe(21); // 20 chars + '…' (U+2026, 1 char)
    });

    it('does not truncate filename exactly 20 chars', () => {
      const exact = 'exactly-twenty-chars.srt'; // 'exactly-twenty-chars' = 20 chars
      expect(formatSubtitleName('imported', 'en', 0, exact)).toBe('exactly-twenty-chars');
    });

    it('ignores index for imported (filename is the name)', () => {
      expect(formatSubtitleName('imported', 'en', 5, 'my-sub.srt')).toBe('my-sub');
    });

    it('returns filename as-is when no extension matched', () => {
      expect(formatSubtitleName('imported', 'en', 0, 'no-extension')).toBe('no-extension');
    });
  });
});
