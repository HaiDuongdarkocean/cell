import {
  shouldAutoLoad,
  validateOverride,
  fetchAndParseSubtitle,
  formatFromUrl,
  handleAutoLoadSubtitles,
  clearAutoLoadCache,
} from '@/features/subtitle/logic/subtitleAutoLoad';
import type { SubtitleForOverlayResult } from '@/types/message';

// Mock parseSubtitle: default to real implementation, override per-test for
// edge cases (e.g. AC4 empty file → success:true, cues:[]).
jest.mock('@/features/subtitle/logic/subtitleParser', () => {
  const actual = jest.requireActual<typeof import('@/features/subtitle/logic/subtitleParser')>(
    '@/features/subtitle/logic/subtitleParser',
  );
  return { ...actual, parseSubtitle: jest.fn(actual.parseSubtitle) };
});
import { parseSubtitle } from '@/features/subtitle/logic/subtitleParser';
const mockParseSubtitle = parseSubtitle as jest.MockedFunction<typeof parseSubtitle>;

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock chrome.runtime.sendMessage for CORS fallback tests
const mockSendMessage = jest.fn();
(globalThis as unknown as { chrome: { runtime: { sendMessage: jest.Mock } } }).chrome = {
  runtime: { sendMessage: mockSendMessage },
};

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
      mockSendMessage.mockReset();
      mockParseSubtitle.mockReset();
      mockParseSubtitle.mockImplementation(jest.requireActual<typeof import('@/features/subtitle/logic/subtitleParser')>('@/features/subtitle/logic/subtitleParser').parseSubtitle);
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

    it('returns error when content-script 403 + background also fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve(''),
      } as Response);
      mockSendMessage.mockResolvedValueOnce({ success: false, error: 'HTTP 403' });

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/background fetch/);
    });

    it('returns error when content-script network error + background also fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('CORS blocked'));
      mockSendMessage.mockResolvedValueOnce({ success: false, error: 'network down' });

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/network down/);
    });

    it('falls back to background FETCH_SUBTITLE_CONTENT on CORS error (TypeError)', async () => {
      // First fetch throws TypeError (CORS) → background fallback.
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { content: SAMPLE_SRT, finalUrl: 'https://example.com/sub.en.srt' },
      });

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt', 'https://example.com/page');
      expect(result.success).toBe(true);
      expect(result.cues).toHaveLength(1);
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'FETCH_SUBTITLE_CONTENT',
        payload: { url: 'https://example.com/sub.en.srt', tabUrl: 'https://example.com/page' },
      });
    });

    it('falls back to background on non-ok response (403)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve('') } as Response);
      mockSendMessage.mockResolvedValueOnce({
        success: true,
        data: { content: SAMPLE_SRT, finalUrl: 'https://example.com/sub.en.srt' },
      });

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(true);
      expect(result.cues).toHaveLength(1);
    });

    it('returns error when both content-script + background fetch fail', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      mockSendMessage.mockResolvedValueOnce({ success: false, error: 'HTTP 403' });

      const result = await fetchAndParseSubtitle('https://example.com/sub.en.srt', 'srt');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/HTTP 403/);
    });
  });

  describe('handleAutoLoadSubtitles', () => {
    beforeEach(() => {
      mockFetch.mockReset();
      mockSendMessage.mockReset();
      mockParseSubtitle.mockReset();
      mockParseSubtitle.mockImplementation(jest.requireActual<typeof import('@/features/subtitle/logic/subtitleParser')>('@/features/subtitle/logic/subtitleParser').parseSubtitle);
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
      mockSendMessage.mockResolvedValueOnce({ success: false, error: 'CORS' });
      const controller = makeController();
      const onPanelRender = jest.fn();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onPanelRender, onLoadStatus },
      );

      // Target failed + native null → nothing loaded, error status reported.
      expect(controller.loadBilingualCues).not.toHaveBeenCalled();
      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'error' }));
    });

    it('AC1: native null → onLoadStatus NOT called for native', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(SAMPLE_SRT),
      } as Response);

      const controller = makeController();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onLoadStatus },
      );

      // Only 'target' loading + loaded (via setCues) — never 'native'.
      const nativeCalls = onLoadStatus.mock.calls.filter(([role]) => role === 'native');
      expect(nativeCalls).toHaveLength(0);
      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'loading', source: 'auto' }));
    });

    it('AC5: loading status includes source: "auto"', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(SAMPLE_SRT) } as Response)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(SAMPLE_SRT_NATIVE) } as Response);

      const controller = makeController();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: makeSub('https://example.com/sub.vi.srt', 'vi', 'srt'),
        },
        { controller, onLoadStatus },
      );

      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'loading', source: 'auto' }));
      expect(onLoadStatus).toHaveBeenCalledWith('native', expect.objectContaining({ state: 'loading', source: 'auto' }));
    });

    it('AC3: fetch timeout → errorType: "timeout"', async () => {
      // Simulate AbortError (our 15s timeout fires).
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);
      const controller = makeController();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onLoadStatus },
      );

      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'error', errorType: 'timeout' }));
    });

    it('AC3: 404 error → errorType: "not-found"', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') } as Response);
      // Background fallback is retried (CORS fallback logic) → mock consistently.
      mockSendMessage.mockResolvedValue({ success: false, error: 'HTTP 404 not found' });
      const controller = makeController();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onLoadStatus },
      );

      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'error', errorType: 'not-found' }));
    });

    it('AC4: empty file (parse success, 0 cues) → errorType: "empty"', async () => {
      // Fetch succeeds; mock parser to return success with 0 cues (empty file).
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('placeholder'),
      } as Response);
      mockParseSubtitle.mockImplementationOnce(() => ({ success: true, cues: [], format: 'srt' }));

      const controller = makeController();
      const onLoadStatus = jest.fn();

      await handleAutoLoadSubtitles(
        {
          tabId: 123,
          target: makeSub('https://example.com/sub.en.srt', 'en', 'srt'),
          native: null,
        },
        { controller, onLoadStatus },
      );

      expect(onLoadStatus).toHaveBeenCalledWith('target', expect.objectContaining({ state: 'error', errorType: 'empty' }));
    });
  });
});
