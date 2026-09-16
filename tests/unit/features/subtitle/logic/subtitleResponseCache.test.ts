import {
  cacheSubtitleBody,
  getCachedSubtitleBody,
  waitForCachedSubtitleBody,
  clearSubtitleBodyCache,
  MAX_ENTRIES,
} from '@/features/subtitle/logic/subtitleResponseCache';

describe('subtitleResponseCache', () => {
  beforeEach(() => {
    clearSubtitleBodyCache();
  });

  it('stores and retrieves subtitle bodies', () => {
    const body = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n';
    cacheSubtitleBody('https://example.com/subtitle?v=token', body);
    expect(getCachedSubtitleBody('https://example.com/subtitle?v=token')).toBe(body);
  });

  it('does not store non-subtitle bodies', () => {
    cacheSubtitleBody('https://example.com/subtitles', '{"tracks":[]}');
    expect(getCachedSubtitleBody('https://example.com/subtitles')).toBeUndefined();
  });

  it('does not store oversized bodies', () => {
    const body = 'WEBVTT\n' + 'x'.repeat(600_000);
    cacheSubtitleBody('https://example.com/subtitle?v=big', body);
    expect(getCachedSubtitleBody('https://example.com/subtitle?v=big')).toBeUndefined();
  });

  it('evicts the oldest entry once MAX_ENTRIES is exceeded', () => {
    const body = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n';
    for (let i = 0; i < MAX_ENTRIES + 1; i++) {
      cacheSubtitleBody(`https://example.com/sub-${i}`, body);
    }
    expect(getCachedSubtitleBody('https://example.com/sub-0')).toBeUndefined();
    expect(getCachedSubtitleBody(`https://example.com/sub-${MAX_ENTRIES}`)).toBe(body);
  });

  it('a cache hit refreshes recency so the entry survives eviction', () => {
    const body = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n';
    for (let i = 0; i < MAX_ENTRIES; i++) {
      cacheSubtitleBody(`https://example.com/sub-${i}`, body);
    }
    getCachedSubtitleBody('https://example.com/sub-0');
    cacheSubtitleBody('https://example.com/sub-new', body);
    expect(getCachedSubtitleBody('https://example.com/sub-0')).toBe(body);
    expect(getCachedSubtitleBody('https://example.com/sub-1')).toBeUndefined();
  });

  it('clears all entries', () => {
    cacheSubtitleBody('https://example.com/subtitle', 'WEBVTT');
    clearSubtitleBodyCache();
    expect(getCachedSubtitleBody('https://example.com/subtitle')).toBeUndefined();
  });

  it('waitForCachedSubtitleBody returns immediately when body exists', async () => {
    const body = 'WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n';
    cacheSubtitleBody('https://example.com/subtitle', body);
    const result = await waitForCachedSubtitleBody('https://example.com/subtitle', 1000);
    expect(result).toBe(body);
  });

  it('waitForCachedSubtitleBody resolves when body is set while waiting', async () => {
    const url = 'https://example.com/subtitle?token';
    const body = 'WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n';
    setTimeout(() => cacheSubtitleBody(url, body), 50);
    const result = await waitForCachedSubtitleBody(url, 1000);
    expect(result).toBe(body);
  });

  it('waitForCachedSubtitleBody returns undefined after timeout', async () => {
    const result = await waitForCachedSubtitleBody('https://example.com/missing', 50);
    expect(result).toBeUndefined();
  });
});
