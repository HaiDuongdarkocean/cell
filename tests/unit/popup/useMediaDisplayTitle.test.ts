import { resolveMediaDisplayTitle } from '@/popup/hooks/useMediaDisplayTitle';
import type { DetectedVideo, DetectedSubtitle } from '@/types/media';

describe('resolveMediaDisplayTitle', () => {
  const kisskhPageUrl = 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070';
  const streamUrl = 'https://cdn.example.com/index.m3u8';
  const subtitleUrl = 'https://cdn.example.com/subs/en.vtt';

  const makeVideo = (overrides?: Partial<DetectedVideo>): DetectedVideo => ({
    id: 'v1',
    url: streamUrl,
    format: 'm3u8',
    title: 'index',
    tabId: 1,
    tabUrl: kisskhPageUrl,
    detectedAt: 1000,
    variants: [],
    ...overrides,
  });

  const makeSubtitle = (overrides?: Partial<DetectedSubtitle>): DetectedSubtitle => ({
    id: 's1',
    url: subtitleUrl,
    format: 'vtt',
    language: 'en',
    tabId: 1,
    detectedAt: 1000,
    ...overrides,
  });

  describe('video — title-fallback mode', () => {
    it('uses enriched page title when available', () => {
      const video = makeVideo({ title: "A Good Girl's Guide to Murder S2 EP1" });
      expect(resolveMediaDisplayTitle(video, 'title-fallback')).toBe(
        "A Good Girl's Guide to Murder S2 EP1",
      );
    });

    it('falls back to tabTitle when video.title is "index"', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'title-fallback', 'Kisskh Page Title')).toBe(
        'Kisskh Page Title',
      );
    });

    it('falls back to beautified tabUrl when no title at all', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'title-fallback')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });

    it('falls back to beautified tabUrl when title is generic', () => {
      const video = makeVideo({ title: 'video' });
      expect(resolveMediaDisplayTitle(video, 'title-fallback')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });
  });

  describe('video — title-only mode', () => {
    it('uses enriched page title', () => {
      const video = makeVideo({ title: "A Good Girl's Guide to Murder S2 EP1" });
      expect(resolveMediaDisplayTitle(video, 'title-only')).toBe(
        "A Good Girl's Guide to Murder S2 EP1",
      );
    });

    it('uses tabTitle when video.title is "index"', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'title-only', 'Page Title Here')).toBe(
        'Page Title Here',
      );
    });

    it('returns untitled when no meaningful title', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'title-only')).toBe('untitled');
    });
  });

  describe('video — url-only mode', () => {
    it('ignores title and uses beautified tabUrl', () => {
      const video = makeVideo({ title: "A Good Girl's Guide to Murder" });
      expect(resolveMediaDisplayTitle(video, 'url-only')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });

    it('ignores tabTitle and uses beautified tabUrl', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'url-only', 'Some Page Title')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });
  });

  describe('subtitle — all modes', () => {
    it('title-fallback: uses beautified subtitle URL, not language', () => {
      const sub = makeSubtitle({ language: 'en' });
      expect(resolveMediaDisplayTitle(sub, 'title-fallback')).toBe('subs - en');
    });

    it('title-only: still uses URL (language is not meaningful)', () => {
      const sub = makeSubtitle({ language: 'en' });
      expect(resolveMediaDisplayTitle(sub, 'title-only')).toBe('subs - en');
    });

    it('url-only: uses beautified subtitle URL', () => {
      const sub = makeSubtitle({ language: 'en' });
      expect(resolveMediaDisplayTitle(sub, 'url-only')).toBe('subs - en');
    });

    it('handles complex subtitle URL path', () => {
      const sub = makeSubtitle({
        url: 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/subtitles/en.vtt',
      });
      expect(resolveMediaDisplayTitle(sub, 'title-fallback')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - subtitles - en",
      );
    });
  });

  describe('edge cases', () => {
    it('video with empty tabUrl falls back to stream URL', () => {
      const video = makeVideo({ tabUrl: '', url: 'https://example.com/movie.mp4' });
      expect(resolveMediaDisplayTitle(video, 'url-only')).toBe('movie');
    });

    it('video with generic tabTitle and "index" video.title uses URL', () => {
      const video = makeVideo({ title: 'index' });
      expect(resolveMediaDisplayTitle(video, 'title-fallback', 'video')).toBe(
        "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1",
      );
    });
  });
});
