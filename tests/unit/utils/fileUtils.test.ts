import {
  sanitizeFileName,
  changeExtension,
  generateFileName,
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
});
