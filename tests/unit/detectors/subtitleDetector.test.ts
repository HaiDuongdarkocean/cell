import { detectSubtitle } from '../../../src/lib/detectors/subtitleDetector';
import type { NetworkRequest } from '../../../src/types/media';

function makeRequest(url: string, tabId = 1): NetworkRequest {
  return {
    url,
    method: 'GET',
    tabId,
    type: 'xmlhttprequest',
    timeStamp: 1000,
  };
}

describe('detectSubtitle', () => {
  it('detects .ass URL and returns DetectedSubtitle with format="ass"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.ass');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('ass');
    expect(result?.url).toBe('https://example.com/subtitles/movie.ass');
    expect(result?.tabId).toBe(1);
    expect(result?.detectedAt).toBe(1000);
    expect(typeof result?.id).toBe('string');
    expect(result?.id.length).toBeGreaterThan(0);
  });

  it('detects .vtt URL and returns DetectedSubtitle with format="vtt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.vtt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('vtt');
  });

  it('detects .srt URL and returns DetectedSubtitle with format="srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
  });

  it('returns null for a non-subtitle URL', () => {
    const request = makeRequest('https://example.com/video/movie.mp4');
    const result = detectSubtitle(request);

    expect(result).toBeNull();
  });

  it('extracts language from filename pattern "movie.en.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.en.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('extracts language from filename pattern "movie.vi.vtt"', () => {
    const request = makeRequest('https://example.com/subtitles/movie.vi.vtt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('vi');
  });

  it('extracts language from URL path "/subtitles/en/movie.srt"', () => {
    const request = makeRequest('https://example.com/subtitles/en/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
  });

  it('defaults language to "unknown" when language cannot be detected', () => {
    const request = makeRequest('https://example.com/movie.srt');
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('unknown');
  });

  it('still detects subtitle correctly when URL has a query string', () => {
    const request = makeRequest(
      'https://example.com/subtitles/movie.en.srt?token=abc123&t=2',
    );
    const result = detectSubtitle(request);

    expect(result).not.toBeNull();
    expect(result?.format).toBe('srt');
    expect(result?.language).toBe('en');
    expect(result?.url).toBe(
      'https://example.com/subtitles/movie.en.srt?token=abc123&t=2',
    );
  });

  it('generates unique IDs across multiple calls', () => {
    const request = makeRequest('https://example.com/movie.srt');
    const result1 = detectSubtitle(request);
    const result2 = detectSubtitle(request);

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1?.id).not.toBe(result2?.id);
  });
});
