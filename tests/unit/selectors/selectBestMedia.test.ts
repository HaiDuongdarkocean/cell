import {
  selectBestMedia,
  QUALITY_RANK,
} from '@/lib/selectors/selectBestMedia';
import type {
  DetectedVideo,
  DetectedSubtitle,
  Settings,
  VideoVariant,
} from '@/types/media';

type SelectSettings = Pick<
  Settings,
  'preferredVideoFormat' | 'defaultQuality' | 'selectedSubtitleLanguages'
>;

function makeVideo(
  overrides: Partial<DetectedVideo> & { format: DetectedVideo['format'] },
): DetectedVideo {
  return {
    id: 'v1',
    url: 'https://example.com/video',
    title: 'Video 1',
    tabId: 1,
    tabUrl: 'https://example.com',
    detectedAt: 0,
    variants: [],
    ...overrides,
  };
}

function makeVariant(quality: VideoVariant['quality']): VideoVariant {
  return { url: `https://example.com/${quality}`, quality };
}

function makeSub(overrides: Partial<DetectedSubtitle>): DetectedSubtitle {
  return {
    id: 's1',
    url: 'https://example.com/sub',
    format: 'vtt',
    language: 'en',
    tabId: 1,
    detectedAt: 0,
    ...overrides,
  };
}

describe('selectBestMedia', () => {
  describe('no videos', () => {
    it('returns null when videos is empty', () => {
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['all'],
      };
      expect(selectBestMedia([], [], settings)).toBeNull();
    });
  });

  describe('format filter', () => {
    it('picks video matching preferred format (m3u8)', () => {
      const video = makeVideo({ id: 'v1', format: 'm3u8', variants: [makeVariant('720p')] });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result).not.toBeNull();
      expect(result!.videoId).toBe('v1');
      expect(result!.matchedFormat).toBe('m3u8');
      expect(result!.fallbackReason).toBeUndefined();
    });

    it('falls back to other format when preferred not available, sets fallbackReason=format', () => {
      const video = makeVideo({ id: 'v1', format: 'mp4', variants: [makeVariant('720p')] });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result).not.toBeNull();
      expect(result!.videoId).toBe('v1');
      expect(result!.matchedFormat).toBe('mp4');
      expect(result!.fallbackReason).toBe('format');
    });
  });

  describe('quality pick', () => {
    it('picks exact quality match (720p)', () => {
      const video = makeVideo({
        id: 'v1',
        format: 'm3u8',
        variants: [makeVariant('1080p'), makeVariant('720p'), makeVariant('480p')],
      });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result).not.toBeNull();
      expect(result!.matchedQuality).toBe('720p');
      expect(result!.fallbackReason).toBeUndefined();
    });

    it("picks highest variant when defaultQuality='highest'", () => {
      const video = makeVideo({
        id: 'v1',
        format: 'm3u8',
        variants: [makeVariant('720p'), makeVariant('1080p'), makeVariant('480p')],
      });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: 'highest',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result).not.toBeNull();
      expect(result!.matchedQuality).toBe('1080p');
    });

    it("picks highest variant when defaultQuality='auto'", () => {
      const video = makeVideo({
        id: 'v1',
        format: 'm3u8',
        variants: [makeVariant('720p'), makeVariant('480p')],
      });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: 'auto',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result!.matchedQuality).toBe('720p');
    });

    it("picks nearest lower quality when no exact match (want 1080p, have 720p+480p)", () => {
      const video = makeVideo({
        id: 'v1',
        format: 'm3u8',
        variants: [makeVariant('720p'), makeVariant('480p')],
      });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '1080p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result!.matchedQuality).toBe('720p');
      expect(result!.fallbackReason).toBe('quality');
    });

    it("picks nearest higher quality when no lower available (want 360p, have 720p+480p)", () => {
      const video = makeVideo({
        id: 'v1',
        format: 'm3u8',
        variants: [makeVariant('720p'), makeVariant('480p')],
      });
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '360p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], [], settings);
      expect(result!.matchedQuality).toBe('480p');
      expect(result!.fallbackReason).toBe('quality');
    });
  });

  describe('subtitle filter', () => {
    it('matches multiple selected languages (en, vi)', () => {
      const video = makeVideo({ id: 'v1', format: 'm3u8', variants: [makeVariant('720p')] });
      const subs = [
        makeSub({ id: 's-en', language: 'en' }),
        makeSub({ id: 's-vi', language: 'vi' }),
        makeSub({ id: 's-fr', language: 'fr' }),
      ];
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['en', 'vi'],
      };
      const result = selectBestMedia([video], subs, settings);
      expect(result!.subtitleIds).toEqual(['s-en', 's-vi']);
    });

    it("matches any subtitle when 'all' is selected", () => {
      const video = makeVideo({ id: 'v1', format: 'm3u8', variants: [makeVariant('720p')] });
      const subs = [
        makeSub({ id: 's-en', language: 'en' }),
        makeSub({ id: 's-fr', language: 'fr' }),
      ];
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['all'],
      };
      const result = selectBestMedia([video], subs, settings);
      expect(result!.subtitleIds).toEqual(['s-en', 's-fr']);
    });

    it('returns empty subtitleIds and fallbackReason=subtitle when no subs match', () => {
      const video = makeVideo({ id: 'v1', format: 'm3u8', variants: [makeVariant('720p')] });
      const subs = [makeSub({ id: 's-fr', language: 'fr' })];
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '720p',
        selectedSubtitleLanguages: ['en'],
      };
      const result = selectBestMedia([video], subs, settings);
      expect(result!.subtitleIds).toEqual([]);
      expect(result!.fallbackReason).toBe('subtitle');
    });
  });

  describe('combined scenario', () => {
    it('format fallback + quality nearest + subtitle match', () => {
      const video = makeVideo({
        id: 'v1',
        format: 'mp4',
        variants: [makeVariant('720p'), makeVariant('480p')],
      });
      const subs = [
        makeSub({ id: 's-en', language: 'en' }),
        makeSub({ id: 's-vi', language: 'vi' }),
      ];
      const settings: SelectSettings = {
        preferredVideoFormat: 'm3u8',
        defaultQuality: '1080p',
        selectedSubtitleLanguages: ['en', 'vi'],
      };
      const result = selectBestMedia([video], subs, settings);
      expect(result!.videoId).toBe('v1');
      expect(result!.matchedFormat).toBe('mp4');
      expect(result!.matchedQuality).toBe('720p');
      expect(result!.subtitleIds).toEqual(['s-en', 's-vi']);
      // format fallback takes precedence over quality fallback in reason
      expect(result!.fallbackReason).toBe('format');
    });
  });

  describe('QUALITY_RANK helper', () => {
    it('ranks 1080p above 720p above 480p above 360p', () => {
      expect(QUALITY_RANK['1080p']).toBeGreaterThan(QUALITY_RANK['720p']);
      expect(QUALITY_RANK['720p']).toBeGreaterThan(QUALITY_RANK['480p']);
      expect(QUALITY_RANK['480p']).toBeGreaterThan(QUALITY_RANK['360p']);
    });
  });
});
