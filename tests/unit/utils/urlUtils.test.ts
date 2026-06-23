import {
  resolveUrl,
  isAbsoluteUrl,
  getFileExtension,
  normalizeUrl,
} from '@/lib/utils/urlUtils';

describe('urlUtils', () => {
  describe('resolveUrl', () => {
    it('resolves a relative URL against a base page URL', () => {
      expect(
        resolveUrl('https://example.com/page/index.html', 'video.m3u8'),
      ).toBe('https://example.com/page/video.m3u8');
    });

    it('resolves a path-relative URL against a base directory', () => {
      expect(resolveUrl('https://example.com/segments/', '../seg-1.ts')).toBe(
        'https://example.com/seg-1.ts',
      );
    });

    it('returns the absolute URL unchanged when relative is already absolute', () => {
      expect(
        resolveUrl('https://example.com/page', 'https://cdn.example.com/v.mp4'),
      ).toBe('https://cdn.example.com/v.mp4');
    });

    it('resolves a root-relative URL', () => {
      expect(resolveUrl('https://example.com/a/b/c', '/media/playlist.m3u8')).toBe(
        'https://example.com/media/playlist.m3u8',
      );
    });
  });

  describe('isAbsoluteUrl', () => {
    it('returns true for https URLs', () => {
      expect(isAbsoluteUrl('https://example.com/video.mp4')).toBe(true);
    });

    it('returns true for http URLs', () => {
      expect(isAbsoluteUrl('http://example.com/video.mp4')).toBe(true);
    });

    it('returns false for protocol-relative URLs', () => {
      expect(isAbsoluteUrl('//example.com/video.mp4')).toBe(false);
    });

    it('returns false for relative paths', () => {
      expect(isAbsoluteUrl('video.mp4')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('extracts extension and strips query string', () => {
      expect(getFileExtension('https://example.com/video.m3u8?token=abc')).toBe(
        'm3u8',
      );
    });

    it('returns lowercase extension', () => {
      expect(getFileExtension('https://example.com/VIDEO.MP4')).toBe('mp4');
    });

    it('returns empty string when no extension exists', () => {
      expect(getFileExtension('https://example.com/playlist')).toBe('');
    });

    it('extracts extension from a URL with path and fragment', () => {
      expect(getFileExtension('https://example.com/a/b/seg-001.ts#frag')).toBe(
        'ts',
      );
    });
  });

  describe('normalizeUrl', () => {
    it('strips a trailing slash', () => {
      expect(normalizeUrl('https://example.com/page/')).toBe(
        'https://example.com/page',
      );
    });

    it('removes duplicate slashes in the path while preserving the protocol', () => {
      expect(normalizeUrl('https://example.com//a///b/c')).toBe(
        'https://example.com/a/b/c',
      );
    });

    it('does not alter an already-normalized URL', () => {
      expect(normalizeUrl('https://example.com/a/b')).toBe(
        'https://example.com/a/b',
      );
    });

    it('handles a URL with a trailing slash and duplicate slashes together', () => {
      expect(normalizeUrl('https://example.com//a//b//')).toBe(
        'https://example.com/a/b',
      );
    });
  });
});
