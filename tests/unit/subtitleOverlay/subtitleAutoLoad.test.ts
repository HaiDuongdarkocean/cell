import {
  shouldAutoLoad,
  validateOverride,
  fetchAndParseSubtitle,
  formatFromUrl,
  handleAutoLoadSubtitles,
  clearAutoLoadCache,
} from '../../../src/content/subtitleAutoLoad';
import type { SubtitleForOverlayResult } from '@/types/message';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

interface MockController {
  loadBilingualCues: jest.Mock;
  loadCues: jest.Mock;
  clearCues: jest.Mock;
}

function makeController(): MockController {
  return {
    loadBilingualCues: jest.fn(),
    loadCues: jest.fn(),
    clearCues: jest.fn(),
  };
}

function makeSub(url: string, language: string, format: string): SubtitleForOverlayResult {
  return { url, language, format };
}

const SAMPLE_SRT = '1\n00:00:00,000 --> 00:00:01,000\nHello\n';
const SAMPLE_SRT_NATIVE = '1\n00:00:00,000 --> 00:00:01,000\nXin chào\n';

describe('subtitleAutoLoad', () => {
  describe('shouldAutoLoad', () => {
    it('should return true when autoLoad enabled and target language set', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: 'en' })).toBe(true);
    });

    it('should return false when autoLoad disabled', () => {
      expect(shouldAutoLoad({ autoLoad: false, targetLanguage: 'en' })).toBe(false);
    });

    it('should return false when target language empty', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: '' })).toBe(false);
    });

    it('should return false when target language is whitespace only', () => {
      expect(shouldAutoLoad({ autoLoad: true, targetLanguage: '   ' })).toBe(false);
    });
  });

  describe('validateOverride', () => {
    it('should allow override when file language matches target language', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'en',
      });
      expect(result.allowed).toBe(true);
    });

    it('should block override when file language differs from target', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'vi',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('different from target');
    });

    it('should allow override when target language is empty (no restriction)', () => {
      const result = validateOverride({
        targetLanguage: '',
        fileLanguage: 'vi',
      });
      expect(result.allowed).toBe(true);
    });

    it('should match case-insensitively', () => {
      const result = validateOverride({
        targetLanguage: 'en',
        fileLanguage: 'EN',
      });
      expect(result.allowed).toBe(true);
    });

    it('should trim whitespace before comparing', () => {
      const result = validateOverride({
        targetLanguage: '  en  ',
        fileLanguage: 'en',
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('formatFromUrl', () => {
    it('detects .srt', () => {
      expect(formatFromUrl('https://example.com/sub.en.srt')).toBe('srt');
    });
    it('detects .vtt', () => {
      expect(formatFromUrl('https://example.com/sub.en.vtt')).toBe('vtt');
    });
    it('detects .ass', () => {
      expect(formatFromUrl('https://example.com/sub.en.ass')).toBe('ass');
    });
    it('detects .ssa as ass', () => {
      expect(formatFromUrl('https://example.com/sub.en.ssa')).toBe('ass');
    });
    it('returns srt fallback for unknown extension', () => {
      // ponytail: most subtitle URLs are SRT; fallback avoids skipping valid subs.
      expect(formatFromUrl('https://example.com/sub')).toBe('srt');
    });
    it('strips query string before checking extension', () => {
      expect(formatFromUrl('https://example.com/sub.en.vtt?token=abc')).toBe('vtt');
    });
  });

  describe('fetchAndParseSubtitle', () => {
    beforeEach(() => {
      mockFetch.mockReset();
      clearAutoLoadCache();
    });

    it('fetches + parses SRT and caches by URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT),
      } as Response);

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(true);
      expect(result.cues).toHaveLength(1);
      expect(result.cues[0]?.text).toBe('Hello');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call → cache hit, no fetch.
      const result2 = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result2.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns error on fetch failure (non-ok response)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(''),
      } as Response);

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/403/);
    });

    it('returns error on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CORS blocked'));

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/CORS blocked/);
    });
  });

  describe('handleAutoLoadSubtitles', () => {
    beforeEach(() => {
      mockFetch.mockReset();
      clearAutoLoadCache();
    });

    it('loads both target + native when both present', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(SAMPLE_SRT) } as Response)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(SAMPLE_SRT_NATIVE) } as Response);

      const controller = makeController();
      const onPanelRender = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: makeSub('https://example.com/sub.vi.srt', 'vi', 'srt'),
        },
        { controller, onPanelRender },
      );

      expect(controller.loadBilingualCues).toHaveBeenCalledTimes(1);
      const [targetCues, nativeCues] = controller.loadBilingualCues.mock.calls[0];
      expect(targetCues).toHaveLength(1);
      expect(nativeCues).toHaveLength(1);
      expect(onPanelRender).toHaveBeenCalledTimes(1);
    });

    it('loads target-only when native is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT),
      } as Response);

      const controller = makeController();
      const onPanelRender = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onPanelRender },
      );

      expect(controller.loadBilingualCues).toHaveBeenCalledTimes(1);
      const [targetCues, nativeCues] = controller.loadBilingualCues.mock.calls[0];
      expect(targetCues).toHaveLength(1);
      expect(nativeCues).toHaveLength(0);
    });

    it('loads native-only when target is null (fallback skeleton)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT_NATIVE),
      } as Response);

      const controller = makeController();
      const onPanelRender = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: null,
          native: makeSub('https://example.com/sub.vi.srt', 'vi', 'srt'),
        },
        { controller, onPanelRender },
      );

      expect(controller.loadBilingualCues).toHaveBeenCalledTimes(1);
      const [targetCues, nativeCues] = controller.loadBilingualCues.mock.calls[0];
      expect(targetCues).toHaveLength(0);
      expect(nativeCues).toHaveLength(1);
    });

    it('does nothing when both target and native are null', async () => {
      const controller = makeController();
      const onPanelRender = jest.fn();

      await handleAutoLoadSubtitles(
        { tabId: 123, target: null, native: null },
        { controller, onPanelRender },
      );

      expect(controller.loadBilingualCues).not.toHaveBeenCalled();
      expect(onPanelRender).not.toHaveBeenCalled();
    });

    it('re-renders fully when second sub arrives (no accumulation)', async () => {
      // First push: target only.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT),
      } as Response);
      const controller = makeController();
      const onPanelRender = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onPanelRender },
      );
      expect(controller.loadBilingualCues).toHaveBeenCalledTimes(1);
      expect(onPanelRender).toHaveBeenCalledTimes(1);

      // Second push: target (cached) + native (new fetch).
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT_NATIVE),
      } as Response);
      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: makeSub('https://example.com/sub.vi.srt', 'vi', 'srt'),
        },
        { controller, onPanelRender },
      );
      // Re-rendered fully (not accumulated) — loadBilingualCues called again with both.
      expect(controller.loadBilingualCues).toHaveBeenCalledTimes(2);
      const [t2, n2] = controller.loadBilingualCues.mock.calls[1];
      expect(t2).toHaveLength(1);
      expect(n2).toHaveLength(1);
      expect(onPanelRender).toHaveBeenCalledTimes(2);
    });

    it('skips + does not crash when fetch fails for target', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CORS'));
      const controller = makeController();
      const onPanelRender = jest.fn();
      const onToast = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onPanelRender, onToast },
      );

      // Target failed + native null → nothing loaded, toast shown.
      expect(controller.loadBilingualCues).not.toHaveBeenCalled();
      expect(onToast).toHaveBeenCalled();
    });
  });
});
