import {
  buildGoogleImagesUrl,
  parseGoogleImagesHtml,
  DEFAULT_MAX_IMAGE_RESULTS,
} from './imageSearchService';
import type { ImageItem } from '../types';

describe('imageSearchService', () => {
  describe('buildGoogleImagesUrl', () => {
    it('builds the Google Images tbm=isch URL with encoded term', () => {
      expect(buildGoogleImagesUrl('apple pie')).toBe(
        'https://www.google.com/search?q=apple%20pie&tbm=isch',
      );
    });

    it('encodes special characters', () => {
      expect(buildGoogleImagesUrl('café & crème')).toBe(
        'https://www.google.com/search?q=caf%C3%A9%20%26%20cr%C3%A8me&tbm=isch',
      );
    });
  });

  describe('parseGoogleImagesHtml', () => {
    const SAMPLE_HTML = [
      '<div data-id="x">',
      '"https://example.com/a.jpg"',
      '"https://images.example.com/b.png"',
      '"https://lh3.gstatic.com/chrome.png"',
      '"https://example.com/a.jpg"',
      '"https://encrypted-tbn0.gstatic.com/c.jpeg"',
      '</div>',
    ].join('\n');

    it('extracts jpg/png/jpeg URLs, filters gstatic + encrypted, dedups', () => {
      const items = parseGoogleImagesHtml(SAMPLE_HTML, 'apple', 10);
      // gstatic.com (lh3.gstatic.com) and encrypted-tbn0.gstatic.com filtered,
      // duplicate example.com/a.jpg collapsed → 2 unique items.
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.src)).toEqual([
        'https://example.com/a.jpg',
        'https://images.example.com/b.png',
      ]);
    });

    it('sets id=img-{idx}, alt=term, defaultSelected=false', () => {
      const items = parseGoogleImagesHtml(SAMPLE_HTML, 'apple', 10);
      const expected: ImageItem[] = [
        { id: 'img-0', alt: 'apple', src: 'https://example.com/a.jpg', defaultSelected: false },
        { id: 'img-1', alt: 'apple', src: 'https://images.example.com/b.png', defaultSelected: false },
      ];
      expect(items).toEqual(expected);
    });

    it('respects maxResults cap', () => {
      const items = parseGoogleImagesHtml(SAMPLE_HTML, 'apple', 1);
      expect(items).toHaveLength(1);
      expect(items[0].src).toBe('https://example.com/a.jpg');
    });

    it('returns [] for empty string', () => {
      expect(parseGoogleImagesHtml('', 'apple', 10)).toEqual([]);
    });

    it('returns [] for malformed input (no image URLs)', () => {
      expect(parseGoogleImagesHtml('<html><body>no images here</body></html>', 'apple', 10)).toEqual([]);
    });

    it('returns [] when maxResults <= 0', () => {
      expect(parseGoogleImagesHtml(SAMPLE_HTML, 'apple', 0)).toEqual([]);
      expect(parseGoogleImagesHtml(SAMPLE_HTML, 'apple', -1)).toEqual([]);
    });

    it('does not throw on non-string input (defensive)', () => {
      // The guard checks typeof; pass empty string as the safe fallback.
      expect(parseGoogleImagesHtml('', 'apple', 10)).toEqual([]);
    });

    it('handles .jpeg extension', () => {
      const html = '"https://cdn.example.com/photo.jpeg"';
      const items = parseGoogleImagesHtml(html, 'cat', 10);
      expect(items).toHaveLength(1);
      expect(items[0].src).toBe('https://cdn.example.com/photo.jpeg');
    });

    it('filters any URL containing "encrypted" even off gstatic', () => {
      const html = [
        '"https://example.com/real.png"',
        '"https://somehost.com/encrypted/path.jpg"',
      ].join('\n');
      const items = parseGoogleImagesHtml(html, 'x', 10);
      expect(items.map((i) => i.src)).toEqual(['https://example.com/real.png']);
    });
  });

  describe('DEFAULT_MAX_IMAGE_RESULTS', () => {
    it('is a positive integer', () => {
      expect(typeof DEFAULT_MAX_IMAGE_RESULTS).toBe('number');
      expect(DEFAULT_MAX_IMAGE_RESULTS).toBeGreaterThan(0);
      expect(Number.isInteger(DEFAULT_MAX_IMAGE_RESULTS)).toBe(true);
    });
  });
});
