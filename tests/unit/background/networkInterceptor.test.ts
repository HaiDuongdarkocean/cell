import { NetworkInterceptor } from '@/background/networkInterceptor';
import type { DetectedVideo, DetectedSubtitle } from '@/types/media';

/**
 * Minimal mock for chrome.webRequest.onBeforeRequest with addListener /
 * removeListener spies. Cast through `unknown` (never `any`) to satisfy the
 * large `typeof chrome` type.
 */
interface WebRequestListenerMock {
  addListener: jest.Mock;
  removeListener: jest.Mock;
}

interface WebRequestMock {
  onBeforeRequest: WebRequestListenerMock;
}

interface ChromeMock {
  webRequest: WebRequestMock;
}

function createChromeMock(): ChromeMock {
  return {
    webRequest: {
      onBeforeRequest: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  };
}

/**
 * Build a chrome.webRequest.OnBeforeRequestDetails-like object. Only the
 * fields consumed by NetworkInterceptor are populated.
 */
function makeDetails(
  url: string,
  tabId: number,
  overrides?: Partial<chrome.webRequest.OnBeforeRequestDetails>,
): chrome.webRequest.OnBeforeRequestDetails {
  return {
    documentLifecycle: 'active',
    frameId: 0,
    frameType: 'outermost_frame',
    method: 'GET',
    parentFrameId: -1,
    requestId: `req-${tabId}-${url}`,
    tabId,
    timeStamp: 1000,
    type: 'media',
    url,
    ...overrides,
  } as chrome.webRequest.OnBeforeRequestDetails;
}

describe('NetworkInterceptor', () => {
  let mockChrome: ChromeMock;
  let interceptor: NetworkInterceptor;

  beforeEach(() => {
    mockChrome = createChromeMock();
    (globalThis as unknown as { chrome: ChromeMock }).chrome = mockChrome;
    interceptor = new NetworkInterceptor();
  });

  afterEach(() => {
    interceptor.stop();
    delete (globalThis as unknown as { chrome?: ChromeMock }).chrome;
  });

  describe('start / stop', () => {
    it('start() adds a listener to chrome.webRequest.onBeforeRequest', () => {
      interceptor.start();

      expect(mockChrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(1);
      const args = mockChrome.webRequest.onBeforeRequest.addListener.mock.calls[0];
      expect(typeof args[0]).toBe('function');
      // The filter must request all URLs.
      const filter = args[1] as chrome.webRequest.RequestFilter;
      expect(filter.urls).toEqual(['<all_urls>']);
    });

    it('stop() removes the listener from chrome.webRequest.onBeforeRequest', () => {
      interceptor.start();
      const addedListener = mockChrome.webRequest.onBeforeRequest.addListener.mock
        .calls[0][0] as (...args: unknown[]) => void;

      interceptor.stop();

      expect(mockChrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalledTimes(1);
      const removedListener =
        mockChrome.webRequest.onBeforeRequest.removeListener.mock.calls[0][0];
      expect(removedListener).toBe(addedListener);
    });
  });

  describe('handleRequest - video detection', () => {
    it('detects an m3u8 URL, stores it, and notifies listeners', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(makeDetails('https://example.com/stream/playlist.m3u8', 1));

      const videos = interceptor.getVideos(1);
      expect(videos).toHaveLength(1);
      expect(videos[0].format).toBe('m3u8');
      expect(videos[0].url).toBe('https://example.com/stream/playlist.m3u8');
      expect(videos[0].tabId).toBe(1);

      expect(callback).toHaveBeenCalledTimes(1);
      const [notifiedVideos, notifiedSubtitles] = callback.mock.calls[0] as [
        DetectedVideo[],
        DetectedSubtitle[],
      ];
      expect(notifiedVideos).toHaveLength(1);
      expect(notifiedVideos[0].format).toBe('m3u8');
      expect(notifiedSubtitles).toHaveLength(0);
    });
  });

  describe('handleRequest - subtitle detection', () => {
    it('detects a .srt URL, stores it, and notifies listeners', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(makeDetails('https://example.com/subs/en.srt', 2));

      const subtitles = interceptor.getSubtitles(2);
      expect(subtitles).toHaveLength(1);
      expect(subtitles[0].format).toBe('srt');
      expect(subtitles[0].url).toBe('https://example.com/subs/en.srt');
      expect(subtitles[0].tabId).toBe(2);

      expect(callback).toHaveBeenCalledTimes(1);
      const [notifiedVideos, notifiedSubtitles] = callback.mock.calls[0] as [
        DetectedVideo[],
        DetectedSubtitle[],
      ];
      expect(notifiedVideos).toHaveLength(0);
      expect(notifiedSubtitles).toHaveLength(1);
      expect(notifiedSubtitles[0].format).toBe('srt');
    });
  });

  describe('handleRequest - non-media URLs', () => {
    it('does not detect anything for non-media URLs', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(makeDetails('https://example.com/app.js', 1));
      interceptor.handleRequest(makeDetails('https://example.com/style.css', 1));

      expect(interceptor.getVideos(1)).toHaveLength(0);
      expect(interceptor.getSubtitles(1)).toHaveLength(0);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('handleRequest - extension-initiated requests', () => {
    it('ignores requests with tabId -1', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(makeDetails('https://example.com/subs/en.srt', -1));

      expect(interceptor.getSubtitles(-1)).toHaveLength(0);
      expect(callback).not.toHaveBeenCalled();
    });

    it('ignores requests with chrome-extension initiator', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(
        makeDetails('https://example.com/subs/en.srt', 1, {
          initiator: 'chrome-extension://fake-extension-id',
        }),
      );

      expect(interceptor.getSubtitles(1)).toHaveLength(0);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getVideos / getSubtitles per-tab filtering', () => {
    it('getVideos(tabId) returns only videos for that tab', () => {
      interceptor.handleRequest(makeDetails('https://example.com/a.mp4', 1));
      interceptor.handleRequest(makeDetails('https://example.com/b.mp4', 2));
      interceptor.handleRequest(makeDetails('https://example.com/c.webm', 1));

      const tab1Videos = interceptor.getVideos(1);
      expect(tab1Videos).toHaveLength(2);
      expect(tab1Videos.every((v) => v.tabId === 1)).toBe(true);

      const tab2Videos = interceptor.getVideos(2);
      expect(tab2Videos).toHaveLength(1);
      expect(tab2Videos[0].tabId).toBe(2);
    });

    it('getSubtitles(tabId) returns only subtitles for that tab', () => {
      interceptor.handleRequest(makeDetails('https://example.com/en.srt', 1));
      interceptor.handleRequest(makeDetails('https://example.com/fr.vtt', 2));
      interceptor.handleRequest(makeDetails('https://example.com/de.ass', 1));

      const tab1Subs = interceptor.getSubtitles(1);
      expect(tab1Subs).toHaveLength(2);
      expect(tab1Subs.every((s) => s.tabId === 1)).toBe(true);

      const tab2Subs = interceptor.getSubtitles(2);
      expect(tab2Subs).toHaveLength(1);
      expect(tab2Subs[0].tabId).toBe(2);
    });
  });

  describe('getMedia', () => {
    it('returns both videos and subtitles for a tab', () => {
      interceptor.handleRequest(makeDetails('https://example.com/movie.mp4', 1));
      interceptor.handleRequest(makeDetails('https://example.com/en.srt', 1));

      const media = interceptor.getMedia(1);
      expect(media.videos).toHaveLength(1);
      expect(media.subtitles).toHaveLength(1);
    });
  });

  describe('clearTab', () => {
    it('removes only the media for the given tab', () => {
      interceptor.handleRequest(makeDetails('https://example.com/a.mp4', 1));
      interceptor.handleRequest(makeDetails('https://example.com/en.srt', 1));
      interceptor.handleRequest(makeDetails('https://example.com/b.mp4', 2));

      interceptor.clearTab(1);

      expect(interceptor.getVideos(1)).toHaveLength(0);
      expect(interceptor.getSubtitles(1)).toHaveLength(0);
      expect(interceptor.getVideos(2)).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('removes all detected media across all tabs', () => {
      interceptor.handleRequest(makeDetails('https://example.com/a.mp4', 1));
      interceptor.handleRequest(makeDetails('https://example.com/b.mp4', 2));
      interceptor.handleRequest(makeDetails('https://example.com/en.srt', 1));

      interceptor.clearAll();

      expect(interceptor.getVideos(1)).toHaveLength(0);
      expect(interceptor.getVideos(2)).toHaveLength(0);
      expect(interceptor.getSubtitles(1)).toHaveLength(0);
    });
  });

  describe('onMediaDetected subscription', () => {
    it('calls the callback when media is detected', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);

      interceptor.handleRequest(makeDetails('https://example.com/movie.mp4', 1));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops further notifications', () => {
      const callback = jest.fn();
      const unsubscribe = interceptor.onMediaDetected(callback);

      unsubscribe();

      interceptor.handleRequest(makeDetails('https://example.com/movie.mp4', 1));

      expect(callback).not.toHaveBeenCalled();
    });

    it('notifies multiple listeners and keeps them independent', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const unsub1 = interceptor.onMediaDetected(cb1);
      interceptor.onMediaDetected(cb2);

      interceptor.handleRequest(makeDetails('https://example.com/movie.mp4', 1));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);

      unsub1();

      interceptor.handleRequest(makeDetails('https://example.com/other.mp4', 1));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(2);
    });
  });

  describe('start() wiring', () => {
    it('forwards captured requests to handleRequest', () => {
      const callback = jest.fn();
      interceptor.onMediaDetected(callback);
      interceptor.start();

      const listener = mockChrome.webRequest.onBeforeRequest.addListener.mock
        .calls[0][0] as (details: chrome.webRequest.OnBeforeRequestDetails) => void;

      listener(makeDetails('https://example.com/stream/playlist.m3u8', 5));

      expect(interceptor.getVideos(5)).toHaveLength(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
