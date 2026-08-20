// ocrCache tests — T11.

import { describe, expect, it } from '@jest/globals';
import { OcrCache, bucketTimestamp, buildCacheKey, computeVideoId } from './ocrCache';
import type { OcrResultItem } from '@/features/ocr/engine/types';

const mockItem: OcrResultItem = {
  poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'],
  text: 'test',
  score: 0.9,
};

describe('ocrCache (T11)', () => {
  describe('bucketTimestamp', () => {
    it('rounds down to nearest bucket', () => {
      expect(bucketTimestamp(5999, 1000)).toBe(5000);
      expect(bucketTimestamp(5000, 1000)).toBe(5000);
      expect(bucketTimestamp(5500, 1000)).toBe(5000);
    });

    it('handles zero time', () => {
      expect(bucketTimestamp(0, 1000)).toBe(0);
    });

    it('handles custom bucket size', () => {
      expect(bucketTimestamp(5500, 2000)).toBe(4000);
    });
  });

  describe('buildCacheKey', () => {
    it('builds key from videoId + bucket', () => {
      expect(buildCacheKey('abc123', 5000)).toBe('abc123:5000');
      expect(buildCacheKey('xyz789', 0)).toBe('xyz789:0');
    });
  });

  describe('computeVideoId', () => {
    it('extracts YouTube videoId from watch URL', () => {
      expect(computeVideoId({ src: 'https://youtube.com/watch?v=dQw4w9WgXcQ', duration: 212 })).toBe('dQw4w9WgXcQ');
    });

    it('extracts YouTube videoId from youtu.be URL', () => {
      expect(computeVideoId({ src: 'https://youtu.be/dQw4w9WgXcQ', duration: 212 })).toBe('dQw4w9WgXcQ');
    });

    it('hashes blob URL to 16 chars', () => {
      const id = computeVideoId({ src: 'blob:https://example.com/abc-123', duration: 120 });
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it('hashes direct URL to 16 chars', () => {
      const id = computeVideoId({ src: 'https://example.com/video.mp4', duration: 60 });
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it('same input → same hash', () => {
      const a = computeVideoId({ src: 'https://example.com/video.mp4', duration: 60 });
      const b = computeVideoId({ src: 'https://example.com/video.mp4', duration: 60 });
      expect(a).toBe(b);
    });

    it('different duration → different hash', () => {
      const a = computeVideoId({ src: 'https://example.com/video.mp4', duration: 60 });
      const b = computeVideoId({ src: 'https://example.com/video.mp4', duration: 120 });
      expect(a).not.toBe(b);
    });
  });

  describe('OcrCache LRU', () => {
    it('get returns undefined on miss', () => {
      const cache = new OcrCache();
      expect(cache.get('vid', 5000)).toBeUndefined();
    });

    it('set + get roundtrip', () => {
      const cache = new OcrCache();
      cache.set('vid', 5000, { items: [mockItem], scriptRuns: [], timestamp: 5000 });
      const entry = cache.get('vid', 5000);
      expect(entry).toBeDefined();
      expect(entry!.items).toHaveLength(1);
    });

    it('clear removes entries for videoId', () => {
      const cache = new OcrCache();
      cache.set('vid1', 1000, { items: [mockItem], scriptRuns: [], timestamp: 1000 });
      cache.set('vid1', 2000, { items: [mockItem], scriptRuns: [], timestamp: 2000 });
      cache.set('vid2', 1000, { items: [mockItem], scriptRuns: [], timestamp: 1000 });
      cache.clear('vid1');
      expect(cache.get('vid1', 1000)).toBeUndefined();
      expect(cache.get('vid1', 2000)).toBeUndefined();
      expect(cache.get('vid2', 1000)).toBeDefined();
    });

    it('clearAll removes everything', () => {
      const cache = new OcrCache();
      cache.set('vid', 1000, { items: [mockItem], scriptRuns: [], timestamp: 1000 });
      cache.clearAll();
      expect(cache.size).toBe(0);
    });

    it('LRU eviction removes oldest', () => {
      const cache = new OcrCache(3);
      cache.set('a', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      cache.set('b', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      cache.set('c', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      // Access 'a' to make it recently used.
      cache.get('a', 0);
      // Insert 'd' → evict 'b' (oldest unused).
      cache.set('d', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      expect(cache.get('a', 0)).toBeDefined();
      expect(cache.get('b', 0)).toBeUndefined();
      expect(cache.get('c', 0)).toBeDefined();
      expect(cache.get('d', 0)).toBeDefined();
    });

    it('size tracks entries', () => {
      const cache = new OcrCache();
      expect(cache.size).toBe(0);
      cache.set('a', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      expect(cache.size).toBe(1);
      cache.set('a', 0, { items: [mockItem], scriptRuns: [], timestamp: 0 });
      expect(cache.size).toBe(1); // Same key, no growth.
    });
  });
});
