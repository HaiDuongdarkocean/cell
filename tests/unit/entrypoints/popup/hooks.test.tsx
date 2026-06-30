import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import { useDetectedMedia } from '@/entrypoints/popup/hooks/useDetectedMedia';
import { useDownloadProgress } from '@/entrypoints/popup/hooks/useDownloadProgress';
import { useExtensionStatus } from '@/entrypoints/popup/hooks/useExtensionStatus';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  DownloadProgress,
} from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DetectedMediaUpdatePayload,
  DownloadProgressUpdatePayload,
} from '@/types/message';

// --- chrome runtime mock -------------------------------------------------

type MessageListener = (
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void,
) => boolean;

interface ChromeRuntimeMock {
  sendMessage: jest.MockedFunction<
    (message: MessageRequest) => Promise<MessageResponse>
  >;
  onMessage: {
    addListener: jest.MockedFunction<(l: MessageListener) => void>;
    removeListener: jest.MockedFunction<(l: MessageListener) => void>;
    listeners: MessageListener[];
  };
}

function createChromeMock(): ChromeRuntimeMock {
  const listeners: MessageListener[] = [];
  const onMessage = {
    addListener: jest.fn((l: MessageListener) => {
      listeners.push(l);
    }),
    removeListener: jest.fn((l: MessageListener) => {
      const idx = listeners.indexOf(l);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    }),
    listeners,
  };
  return {
    // Default to a resolved empty-success response so hooks that call
    // `.then()` on mount don't blow up when a test doesn't care about it.
    sendMessage: jest.fn((_msg: MessageRequest): Promise<MessageResponse> =>
      Promise.resolve({ success: true }),
    ),
    onMessage,
  };
}

interface ChromeTabsMock {
  query: jest.MockedFunction<
    (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>
  >;
}

let chromeMock: ChromeRuntimeMock;
let tabsMock: ChromeTabsMock;

beforeEach(() => {
  chromeMock = createChromeMock();
  tabsMock = {
    // Default active tab id = 1 (matches mockVideo.tabId).
    query: jest.fn((_q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> =>
      Promise.resolve([{ id: 1 } as chrome.tabs.Tab]),
    ),
  };
  (global as unknown as {
    chrome: {
      runtime: ChromeRuntimeMock;
      tabs: ChromeTabsMock;
      storage: {
        local: {
          set: jest.MockedFunction<(items: Record<string, unknown>) => Promise<void>>;
          get: jest.MockedFunction<(keys: string[]) => Promise<Record<string, unknown>>>;
        };
      };
    };
  }).chrome = {
    runtime: chromeMock,
    tabs: tabsMock,
    storage: {
      local: {
        set: jest.fn((_items: Record<string, unknown>): Promise<void> =>
          Promise.resolve(),
        ),
        get: jest.fn((_keys: string[]): Promise<Record<string, unknown>> =>
          Promise.resolve({}),
        ),
      },
    },
  };
  // Reset the zustand store between tests.
  usePopupStore.getState().reset();
  jest.clearAllMocks();
});

// --- fixtures -------------------------------------------------------------

const mockVideo: DetectedVideo = {
  id: 'video-1',
  url: 'https://example.com/video.m3u8',
  format: 'm3u8',
  title: 'Test Video',
  tabId: 1,
  tabUrl: 'https://example.com',
  detectedAt: 1000,
  variants: [{ url: 'https://example.com/1080.m3u8', quality: '1080p' }],
};

const mockSubtitle: DetectedSubtitle = {
  id: 'sub-1',
  url: 'https://example.com/sub.vtt',
  format: 'vtt',
  language: 'en',
  tabId: 1,
  detectedAt: 1000,
};

const mockDownload: DownloadItem = {
  id: 'dl-1',
  mediaType: 'video',
  url: 'https://example.com/video.m3u8',
  title: 'Test Video',
  tabId: 1,
  status: 'downloading',
  progress: 50,
  startedAt: 1000,
};

// --- useDetectedMedia -----------------------------------------------------

describe('useDetectedMedia', () => {
  it('returns videos + subtitles from the store', () => {
    usePopupStore.getState().setVideos([mockVideo]);
    usePopupStore.getState().setSubtitles([mockSubtitle]);

    const { result } = renderHook(() => useDetectedMedia());

    expect(result.current.videos).toEqual([mockVideo]);
    expect(result.current.subtitles).toEqual([mockSubtitle]);
  });

  it('sends GET_DETECTED_MEDIA with the active tabId on mount and updates the store with the response', async () => {
    const mediaPayload: DetectedMediaUpdatePayload = {
      videos: [mockVideo],
      subtitles: [mockSubtitle],
      tabId: 1,
    };
    const response: MessageResponse<DetectedMediaUpdatePayload> = {
      success: true,
      data: mediaPayload,
    };
    chromeMock.sendMessage.mockResolvedValue(response);

    renderHook(() => useDetectedMedia());

    // Wait for the async tab query + sendMessage promise to resolve.
    // getActiveContentTabId uses Promise.all over 3 tab queries, then the
    // hook awaits it and calls sendMessage — needs a few extra microtask
    // flushes vs the old 2-query path.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'GET_DETECTED_MEDIA',
      payload: { tabId: 1 },
    });
    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('subscribes to DETECTED_MEDIA_UPDATE messages and updates the store when tabId matches', async () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true } as MessageResponse);

    renderHook(() => useDetectedMedia());

    // Wait for the async tab query to resolve so tabIdRef is populated.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(chromeMock.onMessage.addListener).toHaveBeenCalledTimes(1);
    const listener = chromeMock.onMessage.listeners[0];

    const updatePayload: DetectedMediaUpdatePayload = {
      videos: [mockVideo],
      subtitles: [mockSubtitle],
      tabId: 1,
    };
    const message: MessageRequest = {
      type: 'DETECTED_MEDIA_UPDATE',
      payload: updatePayload,
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('ignores DETECTED_MEDIA_UPDATE messages from a different tab', async () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true } as MessageResponse);

    renderHook(() => useDetectedMedia());

    // Wait for the async tab query to resolve so tabIdRef is populated (tabId=1).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const listener = chromeMock.onMessage.listeners[0];

    // Seed the store with tab-1 media so we can detect a (wrong) overwrite.
    usePopupStore.getState().setVideos([mockVideo]);
    usePopupStore.getState().setSubtitles([mockSubtitle]);

    const otherTabVideo: DetectedVideo = { ...mockVideo, id: 'video-99', tabId: 99 };
    const otherTabSub: DetectedSubtitle = { ...mockSubtitle, id: 'sub-99', tabId: 99 };
    const updatePayload: DetectedMediaUpdatePayload = {
      videos: [otherTabVideo],
      subtitles: [otherTabSub],
      tabId: 99,
    };
    const message: MessageRequest = {
      type: 'DETECTED_MEDIA_UPDATE',
      payload: updatePayload,
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    // Store must NOT be overwritten by tab-99 media.
    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('does not update the store when active tab query returns no tab', async () => {
    tabsMock.query.mockResolvedValue([]);
    chromeMock.sendMessage.mockResolvedValue({
      success: true,
      data: { videos: [mockVideo], subtitles: [], tabId: 0 },
    } as MessageResponse<DetectedMediaUpdatePayload>);

    renderHook(() => useDetectedMedia());

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // No tabId → no GET_DETECTED_MEDIA sent → store stays empty.
    expect(chromeMock.sendMessage).not.toHaveBeenCalled();
    expect(usePopupStore.getState().videos).toEqual([]);
  });

  // Regression: Edge ships built-in app-windows (e.g. the dictionary sidebar)
  // that are themselves `active: true` and live in their own window. When the
  // popup is open, `chrome.tabs.query({ active: true, currentWindow: false })`
  // on Edge returns THAT app-window tab (a chrome-extension:// URL) instead of
  // the content tab in the browser window. The hook must skip chrome-extension
  // URLs and fall back to scanning all tabs for a real content tab, otherwise
  // the popup renders empty with no console error.
  it('skips chrome-extension app-window tabs returned by currentWindow:false (Edge regression) and uses the real content tab', async () => {
    // Simulate the exact Edge layout Anh yêu observed:
    //   currentWindow:false  -> [{ chrome-extension app-window, active }]
    //   lastFocusedWindow    -> [] (null)
    //   all tabs             -> [app-window, content-tab, ...]
    const extensionTab = {
      id: 999,
      url: 'chrome-extension://dmeppfcidcpcocleneopiblmpnbokhep/pages/app-window/index.html#/app/dictionary',
      active: true,
      windowId: 2138817063,
    } as chrome.tabs.Tab;
    const contentTab = {
      id: 1,
      url: 'https://themoviebox.org/movies/see-you-at-work-tomorrow',
      active: true,
      windowId: 2138816832,
    } as chrome.tabs.Tab;

    tabsMock.query.mockImplementation((q: chrome.tabs.QueryInfo) => {
      if (q.currentWindow === false) return Promise.resolve([extensionTab]);
      if (q.lastFocusedWindow === true) return Promise.resolve([]);
      if (q.currentWindow === true) return Promise.resolve([contentTab]);
      // query({}) — all tabs
      return Promise.resolve([extensionTab, contentTab]);
    });

    const mediaPayload: DetectedMediaUpdatePayload = {
      videos: [mockVideo],
      subtitles: [mockSubtitle],
      tabId: 1,
    };
    chromeMock.sendMessage.mockResolvedValue({
      success: true,
      data: mediaPayload,
    } as MessageResponse<DetectedMediaUpdatePayload>);

    renderHook(() => useDetectedMedia());

    // Flush the async tab-query + sendMessage chain.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Must request media for the CONTENT tab (id=1), never the extension
    // app-window (id=999).
    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'GET_DETECTED_MEDIA',
      payload: { tabId: 1 },
    });
    expect(usePopupStore.getState().videos).toEqual([mockVideo]);
    expect(usePopupStore.getState().subtitles).toEqual([mockSubtitle]);
  });

  it('removes the listener on unmount', () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true } as MessageResponse);

    const { unmount } = renderHook(() => useDetectedMedia());

    const listener = chromeMock.onMessage.listeners[0];
    unmount();

    expect(chromeMock.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});

// --- useDownloadProgress --------------------------------------------------

describe('useDownloadProgress', () => {
  it('returns downloads + totalProgress from the store', () => {
    usePopupStore.getState().addDownload(mockDownload);

    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.downloads).toEqual([mockDownload]);
    expect(result.current.totalProgress).toBe(50);
  });

  it('totalProgress = 0 when there are no downloads', () => {
    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.downloads).toEqual([]);
    expect(result.current.totalProgress).toBe(0);
  });

  it('totalProgress = average of all download progress values', () => {
    usePopupStore.getState().addDownload({
      ...mockDownload,
      id: 'dl-1',
      progress: 40,
    });
    usePopupStore.getState().addDownload({
      ...mockDownload,
      id: 'dl-2',
      progress: 60,
    });

    const { result } = renderHook(() => useDownloadProgress());

    expect(result.current.totalProgress).toBe(50);
  });

  it('subscribes to DOWNLOAD_PROGRESS_UPDATE messages and updates the store', async () => {
    usePopupStore.getState().addDownload(mockDownload);

    renderHook(() => useDownloadProgress());

    // Wait for the async tab query to resolve so tabIdRef is populated.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const listener = chromeMock.onMessage.listeners[0];

    const progress: DownloadProgress = {
      itemId: 'dl-1',
      status: 'downloading',
      progress: 75,
    };
    const payload: DownloadProgressUpdatePayload = { progress, tabId: 1 };
    const message: MessageRequest = {
      type: 'DOWNLOAD_PROGRESS_UPDATE',
      payload,
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    const updated = usePopupStore
      .getState()
      .downloads.find((d) => d.id === 'dl-1');
    expect(updated?.progress).toBe(75);
  });

  it('adds a stub for unknown downloads and merges when the real item arrives', async () => {
    renderHook(() => useDownloadProgress());

    // Wait for the async tab query to resolve so tabIdRef is populated.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const listener = chromeMock.onMessage.listeners[0];

    // A progress update arrives before the popup response has been processed.
    const progress: DownloadProgress = {
      itemId: 'dl-new',
      status: 'downloading',
      progress: 10,
    };
    const message: MessageRequest = {
      type: 'DOWNLOAD_PROGRESS_UPDATE',
      payload: { progress, tabId: 1 },
    };

    act(() => {
      listener(message, {} as chrome.runtime.MessageSender, jest.fn());
    });

    // A stub was created.
    let downloads = usePopupStore.getState().downloads;
    expect(downloads).toHaveLength(1);
    expect(downloads[0].title).toBe('Download');
    expect(downloads[0].status).toBe('downloading');
    expect(downloads[0].progress).toBe(10);

    // The real response from the background arrives.
    const realItem: DownloadItem = {
      id: 'dl-new',
      mediaType: 'subtitle',
      url: 'https://example.com/sub.srt',
      title: 'e29ac9d2ef1f849eb73428410d055c26.en',
      tabId: 1,
      status: 'queued',
      progress: 0,
    };
    act(() => {
      usePopupStore.getState().addDownload(realItem);
    });

    // Only one item remains, with real metadata and stub progress.
    downloads = usePopupStore.getState().downloads;
    expect(downloads).toHaveLength(1);
    expect(downloads[0].title).toBe('e29ac9d2ef1f849eb73428410d055c26.en');
    expect(downloads[0].status).toBe('downloading');
    expect(downloads[0].progress).toBe(10);
  });

  // Regression: same Edge app-window leak as useDetectedMedia. The download
  // list must be fetched for the real content tab, not the chrome-extension
  // app-window tab, otherwise the Downloads section renders empty.
  it('skips chrome-extension app-window tabs returned by currentWindow:false (Edge regression) and fetches downloads for the real content tab', async () => {
    const extensionTab = {
      id: 999,
      url: 'chrome-extension://dmeppfcidcpcocleneopiblmpnbokhep/pages/app-window/index.html#/app/dictionary',
      active: true,
      windowId: 2138817063,
    } as chrome.tabs.Tab;
    const contentTab = {
      id: 1,
      url: 'https://themoviebox.org/movies/see-you-at-work-tomorrow',
      active: true,
      windowId: 2138816832,
    } as chrome.tabs.Tab;

    tabsMock.query.mockImplementation((q: chrome.tabs.QueryInfo) => {
      if (q.currentWindow === false) return Promise.resolve([extensionTab]);
      if (q.lastFocusedWindow === true) return Promise.resolve([]);
      if (q.currentWindow === true) return Promise.resolve([contentTab]);
      return Promise.resolve([extensionTab, contentTab]);
    });

    const realItem: DownloadItem = {
      id: 'dl-new',
      mediaType: 'video',
      url: 'https://example.com/video.m3u8',
      title: 'Test Video',
      tabId: 1,
      status: 'downloading',
      progress: 30,
      startedAt: 1000,
    };
    chromeMock.sendMessage.mockResolvedValue({
      success: true,
      data: { downloads: [realItem] },
    } as MessageResponse);

    renderHook(() => useDownloadProgress());

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'GET_DOWNLOAD_PROGRESS',
      payload: { tabId: 1 },
    });
    expect(usePopupStore.getState().downloads).toEqual([realItem]);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useDownloadProgress());

    const listener = chromeMock.onMessage.listeners[0];
    unmount();

    expect(chromeMock.onMessage.removeListener).toHaveBeenCalledWith(listener);
  });
});

// --- useExtensionStatus ---------------------------------------------------

describe('useExtensionStatus', () => {
  it('returns isActive + toggle', () => {
    const { result } = renderHook(() => useExtensionStatus());

    expect(typeof result.current.isActive).toBe('boolean');
    expect(typeof result.current.toggle).toBe('function');
    expect(result.current.isActive).toBe(true);
  });

  it('toggle sends a TOGGLE_EXTENSION message and updates the store', () => {
    chromeMock.sendMessage.mockResolvedValue({ success: true } as MessageResponse);

    const { result } = renderHook(() => useExtensionStatus());

    act(() => {
      result.current.toggle();
    });

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'TOGGLE_EXTENSION',
    });
    expect(usePopupStore.getState().extensionActive).toBe(false);
  });

  it('toggle flips the active state back to true when already inactive', () => {
    usePopupStore.getState().setExtensionActive(false);
    chromeMock.sendMessage.mockResolvedValue({ success: true } as MessageResponse);

    const { result } = renderHook(() => useExtensionStatus());

    act(() => {
      result.current.toggle();
    });

    expect(chromeMock.sendMessage).toHaveBeenCalledWith({
      type: 'TOGGLE_EXTENSION',
    });
    expect(usePopupStore.getState().extensionActive).toBe(true);
  });
});
