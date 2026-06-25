import {
  sanitizeFileName,
  changeExtension,
  generateFileName,
  extractBaseNameFromUrl,
  beautifyUrlFilename,
  isTitleMeaningful,
  resolveFilenameBase,
  buildSubtitleFileName,
} from '@/lib/utils/fileUtils';

describe('fileUtils', () => {
  describe('sanitizeFileName', () => {
    it('removes invalid filename characters', () => {
      expect(sanitizeFileName('a<b>c:"d/e\\f|g?h*i')).toBe('abcdefghi');
    });

    it('replaces spaces with underscores', () => {
      expect(sanitizeFileName('Episode 1')).toBe('Episode_1');
    });

    it('returns the name unchanged when no invalid chars or spaces', () => {
      expect(sanitizeFileName('valid_name-01')).toBe('valid_name-01');
    });

    it('handles a mix of invalid characters and spaces', () => {
      expect(sanitizeFileName('Hello: World / 2024')).toBe('Hello_World__2024');
    });
  });

  describe('changeExtension', () => {
    it('replaces an existing extension', () => {
      expect(changeExtension('video.ass', 'srt')).toBe('video.srt');
    });

    it('appends an extension when none exists', () => {
      expect(changeExtension('video', 'mp4')).toBe('video.mp4');
    });

    it('replaces a multi-part extension correctly using the last segment', () => {
      expect(changeExtension('archive.tar.gz', 'zip')).toBe('archive.tar.zip');
    });

    it('handles a filename with dots in the name', () => {
      expect(changeExtension('my.video.file.ts', 'js')).toBe('my.video.file.js');
    });
  });

  describe('generateFileName', () => {
    it('generates a filename without an index', () => {
      expect(generateFileName('Episode 1', 'mp4')).toBe('Episode_1.mp4');
    });

    it('generates a filename with an index', () => {
      expect(generateFileName('Episode 1', 'mp4', 2)).toBe('Episode_1_(2).mp4');
    });

    it('sanitizes invalid characters in the title', () => {
      expect(generateFileName('Show: Part 1?', 'mkv')).toBe('Show_Part_1.mkv');
    });

    it('generates a filename with index 1', () => {
      expect(generateFileName('Clip', 'mp4', 1)).toBe('Clip_(1).mp4');
    });
  });

  describe('extractBaseNameFromUrl', () => {
    it('extracts all path segments from a multi-segment URL', () => {
      const url = 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070';
      expect(extractBaseNameFromUrl(url)).toBe('Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1');
    });

    it('extracts segments from yanhh3d URL', () => {
      const url = 'https://yanhh3d.ee/xuyen-khong/thon-phe-tinh-khong/tap-33.html';
      expect(extractBaseNameFromUrl(url)).toBe('xuyen-khong/thon-phe-tinh-khong/tap-33');
    });

    it('strips file extension from last segment', () => {
      expect(extractBaseNameFromUrl('https://example.com/video.m3u8')).toBe('video');
    });

    it('handles URL with no path', () => {
      expect(extractBaseNameFromUrl('https://example.com')).toBe('media');
    });

    it('handles root path', () => {
      expect(extractBaseNameFromUrl('https://example.com/')).toBe('media');
    });

    it('handles invalid URL', () => {
      expect(extractBaseNameFromUrl('not-a-url')).toBe('media');
    });

    it('handles empty string', () => {
      expect(extractBaseNameFromUrl('')).toBe('media');
    });

    it('handles trailing slash', () => {
      expect(extractBaseNameFromUrl('https://example.com/a/b/c/')).toBe('a/b/c');
    });

    it('handles multiple dots in filename', () => {
      expect(extractBaseNameFromUrl('https://example.com/file.with.dots.mp4')).toBe('file.with.dots');
    });

    it('handles URL with port', () => {
      expect(extractBaseNameFromUrl('https://localhost:8080/stream/video.m3u8')).toBe('stream/video');
    });
  });

  describe('beautifyUrlFilename', () => {
    it('replaces underscores with spaces', () => {
      expect(beautifyUrlFilename('my_video_title_1080p')).toBe('my video title 1080p');
    });

    it('handles smart apostrophe in URL slug', () => {
      expect(beautifyUrlFilename('A-Good-Girl-s-Guide-to-Murder---Season-2')).toBe(
        "A Good Girl's Guide to Murder - Season 2",
      );
    });

    it('handles smart apostrophe at end of segment', () => {
      expect(beautifyUrlFilename('A-Good-Girl-s-Guide')).toBe("A Good Girl's Guide");
    });

    it('replaces triple dash with separator', () => {
      expect(beautifyUrlFilename('a---b---c')).toBe('a - b - c');
    });

    it('replaces double dash with separator', () => {
      expect(beautifyUrlFilename('cafe-mocha--latte')).toBe('cafe mocha - latte');
    });

    it('replaces path separators with dash separator', () => {
      expect(beautifyUrlFilename('Drama/A-Good-Girl-s-Guide/Episode-1')).toBe(
        "Drama - A Good Girl's Guide - Episode 1",
      );
    });

    it('decodes percent-encoded characters', () => {
      expect(beautifyUrlFilename('Hero%20Movie%20Final')).toBe('Hero Movie Final');
    });

    it('decodes unicode percent-encoded characters', () => {
      expect(beautifyUrlFilename('T%E1%BA%ADp-33')).toBe('Tập 33');
    });

    it('handles invalid percent encoding gracefully', () => {
      expect(() => beautifyUrlFilename('invalid%zz%encoding')).not.toThrow();
    });

    it('preserves case', () => {
      expect(beautifyUrlFilename('UPPER_CASE')).toBe('UPPER CASE');
    });

    it('preserves camelCase', () => {
      expect(beautifyUrlFilename('mixedCaseString')).toBe('mixedCaseString');
    });

    it('returns media for empty string', () => {
      expect(beautifyUrlFilename('')).toBe('media');
    });

    it('handles full kisskh URL path', () => {
      const raw = 'Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1';
      expect(beautifyUrlFilename(raw)).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });

    it('handles full yanhh3d URL path', () => {
      const raw = 'xuyen-khong/thon-phe-tinh-khong/tap-33';
      expect(beautifyUrlFilename(raw)).toBe('xuyen khong - thon phe tinh khong - tap 33');
    });
  });

  describe('isTitleMeaningful', () => {
    it('returns true for a normal title', () => {
      expect(isTitleMeaningful('Hero Movie')).toBe(true);
    });

    it('returns true for a long title', () => {
      expect(isTitleMeaningful("A Good Girl's Guide to Murder S2 EP1")).toBe(true);
    });

    it('returns true for unicode title', () => {
      expect(isTitleMeaningful('Thôn Phệ Tinh Không Tập 33')).toBe(true);
    });

    it('returns false for generic "video"', () => {
      expect(isTitleMeaningful('video')).toBe(false);
    });

    it('returns false for generic "untitled"', () => {
      expect(isTitleMeaningful('untitled')).toBe(false);
    });

    it('returns false for generic "media"', () => {
      expect(isTitleMeaningful('media')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isTitleMeaningful('')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTitleMeaningful(undefined)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isTitleMeaningful(null)).toBe(false);
    });

    it('returns false for title shorter than 3 chars', () => {
      expect(isTitleMeaningful('ab')).toBe(false);
    });

    it('returns true for exactly 3 chars', () => {
      expect(isTitleMeaningful('abc')).toBe(true);
    });

    it('returns false for uppercase generic', () => {
      expect(isTitleMeaningful('VIDEO')).toBe(false);
    });

    it('returns true for padded title', () => {
      expect(isTitleMeaningful('  Hero  ')).toBe(true);
    });
  });

  describe('resolveFilenameBase', () => {
    const kisskhUrl = 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070';
    const yanhhUrl = 'https://yanhh3d.ee/xuyen-khong/thon-phe-tinh-khong/tap-33.html';
    const cdnUrl = 'https://cdn.example.com/playlist_1080p.m3u8';

    describe('title-fallback mode', () => {
      it('uses meaningful title when available', () => {
        expect(resolveFilenameBase('title-fallback', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl)).toBe(
          "A Good Girl's Guide to Murder S2 EP1",
        );
      });

      it('falls back to URL when title is undefined', () => {
        expect(resolveFilenameBase('title-fallback', undefined, kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('falls back to URL when title is empty', () => {
        expect(resolveFilenameBase('title-fallback', '', kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('falls back to URL when title is generic', () => {
        expect(resolveFilenameBase('title-fallback', 'video', kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('uses unicode title when meaningful', () => {
        expect(resolveFilenameBase('title-fallback', 'Thôn Phệ Tinh Không Tập 33', yanhhUrl)).toBe(
          'Thôn Phệ Tinh Không Tập 33',
        );
      });

      it('beautifies CDN URL when no title', () => {
        expect(resolveFilenameBase('title-fallback', undefined, cdnUrl)).toBe('playlist 1080p');
      });
    });

    describe('title-only mode', () => {
      it('uses meaningful title', () => {
        expect(resolveFilenameBase('title-only', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl)).toBe(
          "A Good Girl's Guide to Murder S2 EP1",
        );
      });

      it('returns untitled for undefined title', () => {
        expect(resolveFilenameBase('title-only', undefined, kisskhUrl)).toBe('untitled');
      });

      it('returns untitled for empty title', () => {
        expect(resolveFilenameBase('title-only', '', kisskhUrl)).toBe('untitled');
      });

      it('returns untitled for generic title', () => {
        expect(resolveFilenameBase('title-only', 'video', kisskhUrl)).toBe('untitled');
      });
    });

    describe('url-only mode', () => {
      it('ignores title and uses URL', () => {
        expect(resolveFilenameBase('url-only', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('uses URL when no title', () => {
        expect(resolveFilenameBase('url-only', undefined, kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('ignores generic title', () => {
        expect(resolveFilenameBase('url-only', 'video', kisskhUrl)).toBe(
          "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
        );
      });

      it('beautifies yanhh3d URL', () => {
        expect(resolveFilenameBase('url-only', undefined, yanhhUrl)).toBe(
          'xuyen khong - thon phe tinh khong - tap 33',
        );
      });
    });

    describe('full pipeline (resolve + generate)', () => {
      it('produces correct mp4 filename with title', () => {
        const base = resolveFilenameBase('title-fallback', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl);
        expect(generateFileName(base, 'mp4')).toBe("A_Good_Girl's_Guide_to_Murder_S2_EP1.mp4");
      });

      it('produces correct mp4 filename with URL fallback', () => {
        const base = resolveFilenameBase('title-fallback', undefined, kisskhUrl);
        expect(generateFileName(base, 'mp4')).toBe(
          "Drama_-_A_Good_Girl's_Guide_to_Murder_-_Season_2_-_Episode_1.mp4",
        );
      });

      it('produces correct srt filename with URL fallback', () => {
        const base = resolveFilenameBase('title-fallback', undefined, kisskhUrl);
        expect(generateFileName(base, 'srt')).toBe(
          "Drama_-_A_Good_Girl's_Guide_to_Murder_-_Season_2_-_Episode_1.srt",
        );
      });

      it('produces untitled.srt for title-only with no title', () => {
        const base = resolveFilenameBase('title-only', undefined, yanhhUrl);
        expect(generateFileName(base, 'srt')).toBe('untitled.srt');
      });

      it('produces correct ts filename with unicode title', () => {
        const base = resolveFilenameBase('title-only', 'Thôn Phệ Tinh Không Tập 33', yanhhUrl);
        expect(generateFileName(base, 'ts')).toBe('Thôn_Phệ_Tinh_Không_Tập_33.ts');
      });
    });

    describe('buildSubtitleFileName', () => {
      it('appends language suffix before extension', () => {
        expect(buildSubtitleFileName('See You at Work Tomorrow!', 'en', 'srt')).toBe(
          'See_You_at_Work_Tomorrow!.en.srt',
        );
      });

      it('sanitizes the base name (spaces → underscores, invalid chars removed)', () => {
        expect(buildSubtitleFileName('Show: Part 1?', 'vi', 'srt')).toBe('Show_Part_1.vi.srt');
      });

      it('skips suffix when language is empty string', () => {
        expect(buildSubtitleFileName('My Video', '', 'srt')).toBe('My_Video.srt');
      });

      it('skips suffix when language is undefined', () => {
        expect(buildSubtitleFileName('My Video', undefined, 'srt')).toBe('My_Video.srt');
      });

      it('skips suffix when language is "unknown" (sentinel)', () => {
        expect(buildSubtitleFileName('My Video', 'unknown', 'srt')).toBe('My_Video.srt');
      });

      it('skips suffix when language is whitespace-only', () => {
        expect(buildSubtitleFileName('My Video', '   ', 'srt')).toBe('My_Video.srt');
      });

      it('sanitizes language label with spaces and invalid chars', () => {
        // Label like "português (BR)" → sanitized + lowercased to "português_br"
        expect(buildSubtitleFileName('Movie', 'português (BR)', 'srt')).toBe(
          'Movie.português_br.srt',
        );
      });

      it('lowercases the language suffix for consistency', () => {
        expect(buildSubtitleFileName('Movie', 'EN', 'srt')).toBe('Movie.en.srt');
      });

      it('skips suffix when sanitized language becomes empty', () => {
        // All-invalid chars → sanitized to empty → no suffix
        expect(buildSubtitleFileName('Movie', '?:*', 'srt')).toBe('Movie.srt');
      });

      it('works with unicode base name', () => {
        expect(buildSubtitleFileName('Thôn Phệ Tinh Không', 'en', 'srt')).toBe(
          'Thôn_Phệ_Tinh_Không.en.srt',
        );
      });

      it('works with non-srt extension', () => {
        expect(buildSubtitleFileName('Movie', 'en', 'vtt')).toBe('Movie.en.vtt');
      });

      it('handles base name that already contains dots', () => {
        expect(buildSubtitleFileName('Mr. Smith', 'en', 'srt')).toBe('Mr._Smith.en.srt');
      });
    });
  });
});
