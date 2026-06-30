import { resolveMediaDisplayTitle } from '@/entrypoints/popup/hooks/useMediaDisplayTitle';
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

  describe('subtitle — with video context (filename format)', () => {
    const makeVideoContext = (overrides?: Partial<{ videoTitle: string; videoTabUrl: string }>) => ({
      videoTitle: overrides?.videoTitle ?? "A Good Girl's Guide to Murder S2 EP1",
      videoTabUrl: overrides?.videoTabUrl ?? kisskhPageUrl,
    });

    it('title-fallback: uses video title + lang + .vtt', () => {
      const sub = makeSubtitle({ language: 'en', format: 'vtt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'title-fallback', undefined, vc)).toBe(
        "A_Good_Girl's_Guide_to_Murder_S2_EP1.en.vtt",
      );
    });

    it('title-fallback: video title with .srt subtitle format', () => {
      const sub = makeSubtitle({ language: 'en', format: 'srt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'title-fallback', undefined, vc)).toBe(
        "A_Good_Girl's_Guide_to_Murder_S2_EP1.en.srt",
      );
    });

    it('url-only: uses video URL base + lang + ext', () => {
      const sub = makeSubtitle({ language: 'ar', format: 'srt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'url-only', undefined, vc)).toBe(
        "Drama_-_A_Good_Girl's_Guide_to_Murder_-_Season_2_-_Episode_1.ar.srt",
      );
    });

    it('title-only: uses video title + lang + ext', () => {
      const sub = makeSubtitle({ language: 'fr', format: 'vtt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'title-only', undefined, vc)).toBe(
        "A_Good_Girl's_Guide_to_Murder_S2_EP1.fr.vtt",
      );
    });

    it('skips lang suffix when language is unknown', () => {
      const sub = makeSubtitle({ language: 'unknown', format: 'srt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'title-fallback', undefined, vc)).toBe(
        "A_Good_Girl's_Guide_to_Murder_S2_EP1.srt",
      );
    });

    it('skips lang suffix when language is empty', () => {
      const sub = makeSubtitle({ language: '', format: 'srt' });
      const vc = makeVideoContext();
      expect(resolveMediaDisplayTitle(sub, 'title-fallback', undefined, vc)).toBe(
        "A_Good_Girl's_Guide_to_Murder_S2_EP1.srt",
      );
    });

    it('falls back to subtitle URL when no video context', () => {
      const sub = makeSubtitle({ language: 'en' });
      // No videoContext → uses subtitle URL base
      expect(resolveMediaDisplayTitle(sub, 'title-fallback')).toBe('subs - en');
    });

    it('falls back to subtitle URL when video context is undefined', () => {
      const sub = makeSubtitle({ language: 'en', format: 'srt' });
      expect(resolveMediaDisplayTitle(sub, 'title-fallback', undefined, undefined)).toBe(
        'subs - en',
      );
    });
  });

  describe('subtitle — without video context (legacy fallback)', () => {
    it('title-fallback: uses beautified subtitle URL', () => {
      const sub = makeSubtitle({ language: 'en' });
      expect(resolveMediaDisplayTitle(sub, 'title-fallback')).toBe('subs - en');
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
