import { detectVideo } from '../../../src/lib/detectors/videoDetector';
import type { NetworkRequest } from '../../../src/types/media';

function makeRequest(url: string): NetworkRequest {
  return {
    url,
    method: 'GET',
    tabId: 1,
    type: 'media',
    timeStamp: 1000,
  };
}

describe('detectVideo', () => {
  it('detects m3u8 URL and returns DetectedVideo with format m3u8', () => {
    const request = makeRequest('https://example.com/video/playlist.m3u8');
    const result = detectVideo(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('m3u8');
    expect(result?.url).toBe('https://example.com/video/playlist.m3u8');
    expect(result?.tabId).toBe(1);
    expect(result?.tabUrl).toBe('https://example.com/video/playlist.m3u8');
    expect(result?.variants).toEqual([]);
    expect(result?.title).toBe('playlist');
    expect(result?.id).toBeTruthy();
    expect(typeof result?.detectedAt).toBe('number');
  });

  it('detects mp4 URL and returns DetectedVideo with format mp4', () => {
    const request = makeRequest('https://example.com/movie.mp4');
    const result = detectVideo(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('mp4');
    expect(result?.variants).toHaveLength(1);
    expect(result?.variants[0].url).toBe('https://example.com/movie.mp4');
    expect(result?.variants[0].quality).toBe('auto');
    expect(result?.title).toBe('movie');
  });

  it('returns null for .ts URL (segments are not standalone videos)', () => {
    const request = makeRequest('https://example.com/segment0.ts');
    const result = detectVideo(request);

    expect(result).toBeNull();
  });

  it('returns null for non-video URLs (e.g. .js, .css)', () => {
    const jsRequest = makeRequest('https://example.com/app.js');
    const cssRequest = makeRequest('https://example.com/style.css');

    expect(detectVideo(jsRequest)).toBeNull();
    expect(detectVideo(cssRequest)).toBeNull();
  });

  it('detects URL with query string correctly', () => {
    const request = makeRequest('https://example.com/video.mp4?token=abc123&expires=999');
    const result = detectVideo(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('mp4');
    expect(result?.url).toBe('https://example.com/video.mp4?token=abc123&expires=999');
    expect(result?.title).toBe('video');
  });

  it('detects webm URL and returns DetectedVideo with format webm', () => {
    const request = makeRequest('https://example.com/clip.webm');
    const result = detectVideo(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('webm');
    expect(result?.variants).toHaveLength(1);
    expect(result?.variants[0].url).toBe('https://example.com/clip.webm');
    expect(result?.variants[0].quality).toBe('auto');
    expect(result?.title).toBe('clip');
  });

  it('generates unique ids for different requests', () => {
    const request1 = makeRequest('https://example.com/a.mp4');
    const request2 = makeRequest('https://example.com/b.mp4');

    const result1 = detectVideo(request1);
    const result2 = detectVideo(request2);

    expect(result1?.id).not.toBe(result2?.id);
  });

  describe('extractExtension / extractTitle edge cases', () => {
    it('returns null when the last path segment is only an extension (dot at index 0)', () => {
      // ".mp4" as the last segment: dotIndex === 0, so extractExtension returns
      // null in the try block and detectVideo returns null.
      const request = makeRequest('https://example.com/.mp4');
      expect(detectVideo(request)).toBeNull();
    });

    it('falls back to manual extraction for a malformed URL with a valid extension', () => {
      // "not-a-url.mp4" cannot be parsed by new URL(), so both extractExtension
      // and extractTitle fall back to the manual catch-block path.
      const request = makeRequest('not-a-url.mp4');
      const result = detectVideo(request);

      expect(result).not.toBeNull();
      expect(result?.format).toBe('mp4');
      expect(result?.title).toBe('not-a-url');
      expect(result?.url).toBe('not-a-url.mp4');
    });

    it('returns null for a malformed URL whose last segment has no real extension', () => {
      // ".mp4" alone matches the video pattern but, after the URL parse fails,
      // the manual fallback also finds dotIndex === 0 and returns null.
      const request = makeRequest('.mp4');
      expect(detectVideo(request)).toBeNull();
    });

    it('returns null when extractExtension yields null (e.g. hidden-file segment)', () => {
      const request = makeRequest('https://example.com/.ts');
      expect(detectVideo(request)).toBeNull();
    });
  });

  describe('generateId fallback', () => {
    it('uses the timestamp+random fallback when crypto.randomUUID is unavailable', () => {
      const realRandomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      });

      try {
        const request = makeRequest('https://example.com/movie.mp4');
        const result = detectVideo(request);

        expect(result).not.toBeNull();
        expect(typeof result?.id).toBe('string');
        expect(result?.id.length).toBeGreaterThan(0);
        // Fallback ids are "timestamp-random" form, not UUID form.
        expect(result?.id).not.toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      } finally {
        Object.defineProperty(crypto, 'randomUUID', {
          value: realRandomUUID,
          configurable: true,
        });
      }
    });
  });
});
