import { BackgroundService } from '@/background/index';
import { OffscreenManager } from '@/background/offscreenManager';
import { NetworkInterceptor } from '@/background/networkInterceptor';
import { MessageBus } from '@/background/messageBus';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';
import type { DownloadItem, Settings } from '@/types/media';
import type {
  MessageRequest,
  MessageResponse,
  DetectedMediaUpdatePayload,
  DownloadListResponse,
} from '@/types/message';

// Mock OPFS so cleanupOrphanedDownloads doesn't fail in jsdom.
jest.mock('@/lib/storage/opfsStorage', () => ({
  ensureDownloadSubdir: jest.fn(),
  appendChunk: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
  deleteDownloadSubdir: jest.fn(),
  cleanupOrphanedDownloads: jest.fn().mockResolvedValue([]),
  isOpfsAvailable: jest.fn().mockReturnValue(false),
}));

// --- Types for mocked chrome APIs ---

interface MockListener {
  addListener: jest.Mock;
  removeListener: jest.Mock;
  hasListener: jest.Mock;
}

interface MockStorageArea {
  get: jest.Mock;
  set: jest.Mock;
  remove: jest.Mock;
}

interface MockChrome {
  runtime: {
    sendMessage: jest.Mock;
    onMessage: MockListener;
    getURL: jest.Mock;
  };
  action: {
    setBadgeText: jest.Mock;
    setBadgeBackgroundColor: jest.Mock;
    setBadgeTextColor: jest.Mock;
  };
  tabs: {
    query: jest.Mock;
    get: jest.Mock;
    reload: jest.Mock;
    onUpdated: MockListener;
    onRemoved: MockListener;
    onActivated: MockListener;
  };
  windows: {
    onFocusChanged: MockListener;
  };
  storage: {
    local: MockStorageArea;
  };
  webRequest: {
    onBeforeRequest: MockListener;
  };
  offscreen: {
    hasDocument: jest.Mock;
    createDocument: jest.Mock;
    closeDocument: jest.Mock;
    Reason: {
      WORKERS: string;
      BLOBS: string;
    };
  };
  downloads: {
    download: jest.Mock;
    onChanged: MockListener;
  };
}

function createMockListener(): MockListener {
  return {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(),
  };
}

function createMockChrome(): MockChrome {
  return {
    runtime: {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
      onMessage: createMockListener(),
      getURL: jest.fn((path: string) => `chrome-extension://fake-id/${path}`),
    },
    action: {
      setBadgeText: jest.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: jest.fn().mockResolvedValue(undefined),
      setBadgeTextColor: jest.fn().mockResolvedValue(undefined),
    },
    tabs: {
      query: jest.fn().mockResolvedValue([{ id: 123 }]),
      get: jest.fn().mockResolvedValue({ id: 123, url: 'https://example.com/page', title: 'Test Page' }),
      reload: jest.fn().mockResolvedValue(undefined),
      onUpdated: createMockListener(),
      onRemoved: createMockListener(),
      onActivated: createMockListener(),
    },
    windows: {
      onFocusChanged: createMockListener(),
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      },
    },
    webRequest: {
      onBeforeRequest: createMockListener(),
    },
    offscreen: {
      hasDocument: jest.fn().mockResolvedValue(false),
      createDocument: jest.fn().mockResolvedValue(undefined),
      closeDocument: jest.fn().mockResolvedValue(undefined),
      Reason: { WORKERS: 'WORKERS', BLOBS: 'BLOBS' },
    },
    downloads: {
      download: jest.fn().mockResolvedValue(1),
      onChanged: createMockListener(),
    },
  };
}

// --- Mock Downloader (avoids real fetch / ffmpeg) ---

interface MockDownloader {
  onProgress: jest.Mock;
  setConvertCallback: jest.Mock;
  setSaveOpfsFileCallback: jest.Mock;
  setConvertMode: jest.Mock;
  setSegmentConcurrency: jest.Mock;
  setParallelSettings: jest.Mock;
  setFilenameSource: jest.Mock;
  downloadVideo: jest.Mock;
  downloadSubtitle: jest.Mock;
  cancel: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  retry: jest.Mock;
}

function createMockDownloader(): MockDownloader {
  return {
    onProgress: jest.fn(),
    setConvertCallback: jest.fn(),
    setSaveOpfsFileCallback: jest.fn(),
    setConvertMode: jest.fn(),
    setSegmentConcurrency: jest.fn(),
    setParallelSettings: jest.fn(),
    setFilenameSource: jest.fn(),
    downloadVideo: jest.fn().mockResolvedValue(undefined),
    downloadSubtitle: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    retry: jest.fn(),
  };
}

// --- Mock DownloadQueue ---

interface MockDownloadQueue {
  setExecutor: jest.Mock;
  add: jest.Mock;
  addAll: jest.Mock;
  cancel: jest.Mock;
  pause: jest.Mock;
  resume: jest.Mock;
  retry: jest.Mock;
  remove: jest.Mock;
  getAll: jest.Mock;
  getById: jest.Mock;
  updateProgress: jest.Mock;
  onProgress: jest.Mock;
  setMaxConcurrent: jest.Mock;
  getMaxConcurrent: jest.Mock;
  processNext: jest.Mock;
}

function createMockDownloadQueue(): MockDownloadQueue {
  const items: DownloadItem[] = [];
  return {
    setExecutor: jest.fn(),
    add: jest.fn((item: DownloadItem) => items.push(item)),
    addAll: jest.fn((newItems: DownloadItem[]) => items.push(...newItems)),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    retry: jest.fn(),
    remove: jest.fn(),
    getAll: jest.fn(() => items),
    getById: jest.fn((id: string) => items.find((i) => i.id === id)),
    updateProgress: jest.fn(),
    onProgress: jest.fn(() => () => {}),
    setMaxConcurrent: jest.fn(),
    getMaxConcurrent: jest.fn(() => 3),
    processNext: jest.fn(),
  };
}

// --- Helpers ---

/** Build a webRequest details object for feeding the NetworkInterceptor. */
function makeWebRequestDetails(
  url: string,
  tabId: number,
): chrome.webRequest.OnBeforeRequestDetails {
  return {
    url,
    method: 'GET',
    tabId,
    type: 'media',
    timeStamp: 1000,
    documentLifecycle: 'active',
    frameId: 0,
    frameType: 'outermost_frame',
    parentFrameId: -1,
    requestId: `req-${tabId}-${url}`,
  } as chrome.webRequest.OnBeforeRequestDetails;
}

// =====================================================================
// Background integration tests
// =====================================================================

describe('Background integration', () => {
  let mockChrome: MockChrome;
  let service: BackgroundService;
  let interceptor: NetworkInterceptor;
  let messageBus: MessageBus;
  let mockQueue: MockDownloadQueue;
  let mockDownloader: MockDownloader;
  let mockOffscreen: OffscreenManager;

  beforeEach(async () => {
    mockChrome = createMockChrome();
    (globalThis as unknown as { chrome: unknown }).chrome = mockChrome;

    interceptor = new NetworkInterceptor();
    messageBus = new MessageBus();
    mockQueue = createMockDownloadQueue();
    mockDownloader = createMockDownloader();
    mockOffscreen = {
      ensureOffscreenDocument: jest.fn().mockResolvedValue(undefined),
      ensureOffscreenReady: jest.fn().mockResolvedValue(undefined),
      closeOffscreenDocument: jest.fn().mockResolvedValue(undefined),
      hasDocument: jest.fn().mockReturnValue(false),
    } as unknown as OffscreenManager;

    service = new BackgroundService({
      networkInterceptor: interceptor,
      messageBus,
      downloadQueue: mockQueue as unknown as never,
      downloader: mockDownloader as unknown as never,
      offscreenManager: mockOffscreen,
    });

    await service.init();
  });

  afterEach(() => {
    service.stop();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  // 1. Background initializes
  it('initializes and creates interceptor, messageBus, downloadQueue, downloader', () => {
    expect(service.networkInterceptor).toBeInstanceOf(NetworkInterceptor);
    expect(service.messageBus).toBeInstanceOf(MessageBus);
    expect(service.downloadQueue).toBeDefined();
    expect(service.downloader).toBeDefined();
    expect(service.offscreenManager).toBeDefined();
  });

  it('starts the networkInterceptor and messageBus on init when active', () => {
    expect(mockChrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(1);
    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('loads settings from storage and applies maxConcurrent to the queue', () => {
    expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
      STORAGE_KEYS.SETTINGS,
    );
    expect(mockQueue.setMaxConcurrent).toHaveBeenCalledWith(
      DEFAULT_SETTINGS.concurrentDownloads,
    );
  });

  // 2. GET_DETECTED_MEDIA returns videos + subtitles for active tab
  it('GET_DETECTED_MEDIA returns videos + subtitles for the active tab', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/video.mp4', 123),
    );

    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_DETECTED_MEDIA,
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'tab',
    })) as MessageResponse<DetectedMediaUpdatePayload>;

    expect(response.success).toBe(true);
    expect(response.data?.videos).toHaveLength(1);
    expect(response.data?.videos[0]?.url).toBe(
      'https://example.com/video.mp4',
    );
    expect(response.data?.subtitles).toEqual([]);
  });

  it('GET_DETECTED_MEDIA does NOT fall back to all-tab media when active tab is empty', async () => {
    // Active tab (123) has no media; a different tab (99) has media.
    mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

    interceptor.handleRequest({
      url: 'https://cdn.example.com/other-tab.m3u8',
      method: 'GET',
      tabId: 99,
      type: 'media',
      timeStamp: Date.now(),
      documentLifecycle: 'active',
      frameId: 0,
      frameType: 'outermost_frame',
      parentFrameId: -1,
      requestId: 'req-other',
    } as chrome.webRequest.OnBeforeRequestDetails);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_DETECTED_MEDIA,
    };
    const response = await messageBus.handleMessage(request, { id: 'tab' });

    // Must return empty — NOT leak media from tab 99.
    expect(response.success).toBe(true);
    const data = response.data as DetectedMediaUpdatePayload | undefined;
    expect(data?.videos).toHaveLength(0);
    expect(data?.subtitles).toHaveLength(0);
  });

  it('GET_DETECTED_MEDIA returns empty when no active tab is found', async () => {
    // No focused tab available.
    mockChrome.tabs.query.mockResolvedValue([]);

    // Inject a video via a different tab (tabId 99).
    interceptor.handleRequest({
      url: 'https://cdn.example.com/fallback.m3u8',
      method: 'GET',
      tabId: 99,
      type: 'media',
      timeStamp: Date.now(),
      documentLifecycle: 'active',
      frameId: 0,
      frameType: 'outermost_frame',
      parentFrameId: -1,
      requestId: 'req-fallback',
    } as chrome.webRequest.OnBeforeRequestDetails);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_DETECTED_MEDIA,
    };
    const response = await messageBus.handleMessage(request, { id: 'tab' });

    // No active tab → empty, NOT all-tab fallback.
    expect(response.success).toBe(true);
    const data = response.data as DetectedMediaUpdatePayload | undefined;
    expect(data?.videos).toHaveLength(0);
    expect(data?.subtitles).toHaveLength(0);
  });

  it('GET_DETECTED_MEDIA returns only the requested tab media when tabId is provided', async () => {
    // Media on tab 123 and tab 99.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/tabA.mp4', 123),
    );
    interceptor.handleRequest({
      url: 'https://cdn.example.com/tabB.m3u8',
      method: 'GET',
      tabId: 99,
      type: 'media',
      timeStamp: Date.now(),
      documentLifecycle: 'active',
      frameId: 0,
      frameType: 'outermost_frame',
      parentFrameId: -1,
      requestId: 'req-tabB',
    } as chrome.webRequest.OnBeforeRequestDetails);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_DETECTED_MEDIA,
      payload: { tabId: 123 },
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'tab',
    })) as MessageResponse<DetectedMediaUpdatePayload>;

    expect(response.success).toBe(true);
    expect(response.data?.videos).toHaveLength(1);
    expect(response.data?.videos[0]?.url).toBe('https://example.com/tabA.mp4');
    expect(response.data?.tabId).toBe(123);
  });

  // 3. DOWNLOAD_VIDEO creates download item + adds to queue
  it('DOWNLOAD_VIDEO creates a download item and adds it to the queue', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.mp4', 123),
    );
    const video = interceptor.getVideos(123)[0];

    const request: MessageRequest = {
      type: MESSAGE_TYPES.DOWNLOAD_VIDEO,
      payload: { videoId: video.id },
    };
    const response = await messageBus.handleMessage(request, { id: 'popup' });

    expect(response.success).toBe(true);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    const addedItem = mockQueue.add.mock.calls[0][0] as DownloadItem;
    expect(addedItem.mediaType).toBe('video');
    expect(addedItem.url).toBe('https://example.com/movie.mp4');
    expect(addedItem.status).toBe('queued');
    expect(addedItem.videoId).toBe(video.id);
  });

  it('DOWNLOAD_VIDEO returns error when video is not found', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.DOWNLOAD_VIDEO,
      payload: { videoId: 'nonexistent' },
    };
    const response = await messageBus.handleMessage(request, { id: 'popup' });

    expect(response.success).toBe(false);
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('DOWNLOAD_SUBTITLE creates a download item and adds it to the queue', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/sub.vtt', 123),
    );
    const subtitle = interceptor.getSubtitles(123)[0];

    const request: MessageRequest = {
      type: MESSAGE_TYPES.DOWNLOAD_SUBTITLE,
      payload: { subtitleId: subtitle.id },
    };
    const response = await messageBus.handleMessage(request, { id: 'popup' });

    expect(response.success).toBe(true);
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
    const addedItem = mockQueue.add.mock.calls[0][0] as DownloadItem;
    expect(addedItem.mediaType).toBe('subtitle');
    expect(addedItem.url).toBe('https://example.com/sub.vtt');
  });

  // 4. DOWNLOAD_ALL downloads all videos + subtitles
  it('DOWNLOAD_ALL downloads all detected videos + subtitles for a tab', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/a.mp4', 123),
    );
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/b.m3u8', 123),
    );
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/c.vtt', 123),
    );

    const request: MessageRequest = {
      type: MESSAGE_TYPES.DOWNLOAD_ALL,
      payload: { tabId: 123 },
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<DownloadListResponse>;

    expect(response.success).toBe(true);
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);
    const items = mockQueue.addAll.mock.calls[0][0] as DownloadItem[];
    // 2 videos + 1 subtitle
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.mediaType === 'video')).toHaveLength(2);
    expect(items.filter((i) => i.mediaType === 'subtitle')).toHaveLength(1);
  });

  it('DOWNLOAD_ALL does NOT fall back to all-tab media when the requested tab is empty', async () => {
    // Tab 123 (active) has no media; tab 99 has media.
    interceptor.handleRequest({
      url: 'https://cdn.example.com/other-tab.m3u8',
      method: 'GET',
      tabId: 99,
      type: 'media',
      timeStamp: Date.now(),
      documentLifecycle: 'active',
      frameId: 0,
      frameType: 'outermost_frame',
      parentFrameId: -1,
      requestId: 'req-other',
    } as chrome.webRequest.OnBeforeRequestDetails);

    const request: MessageRequest = {
      type: MESSAGE_TYPES.DOWNLOAD_ALL,
      payload: { tabId: 123 },
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<DownloadListResponse>;

    // Must fail — NOT leak/download media from tab 99.
    expect(response.success).toBe(false);
    expect(response.error).toContain('No media');
    expect(mockQueue.addAll).not.toHaveBeenCalled();
  });

  // 5. CANCEL_DOWNLOAD calls queue.cancel
  it('CANCEL_DOWNLOAD calls queue.cancel and downloader.cancel', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.CANCEL_DOWNLOAD,
      payload: { downloadId: 'dl-1' },
    };
    const response = await messageBus.handleMessage(request, { id: 'popup' });

    expect(response.success).toBe(true);
    expect(mockQueue.cancel).toHaveBeenCalledWith('dl-1');
    expect(mockDownloader.cancel).toHaveBeenCalledWith('dl-1');
  });

  it('PAUSE_DOWNLOAD calls queue.pause and downloader.pause', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAUSE_DOWNLOAD,
      payload: { downloadId: 'dl-1' },
    };
    await messageBus.handleMessage(request, { id: 'popup' });

    expect(mockQueue.pause).toHaveBeenCalledWith('dl-1');
    expect(mockDownloader.pause).toHaveBeenCalledWith('dl-1');
  });

  it('RESUME_DOWNLOAD calls queue.resume and downloader.resume', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.RESUME_DOWNLOAD,
      payload: { downloadId: 'dl-1' },
    };
    await messageBus.handleMessage(request, { id: 'popup' });

    expect(mockQueue.resume).toHaveBeenCalledWith('dl-1');
    expect(mockDownloader.resume).toHaveBeenCalledWith('dl-1');
  });

  it('RETRY_DOWNLOAD calls queue.retry and downloader.retry', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.RETRY_DOWNLOAD,
      payload: { downloadId: 'dl-1' },
    };
    await messageBus.handleMessage(request, { id: 'popup' });

    expect(mockQueue.retry).toHaveBeenCalledWith('dl-1');
    expect(mockDownloader.retry).toHaveBeenCalledWith('dl-1');
  });

  it('REMOVE_DOWNLOAD calls queue.remove', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.REMOVE_DOWNLOAD,
      payload: { downloadId: 'dl-1' },
    };
    await messageBus.handleMessage(request, { id: 'popup' });

    expect(mockQueue.remove).toHaveBeenCalledWith('dl-1');
  });

  it('GET_DOWNLOAD_PROGRESS returns all downloads from the queue', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_DOWNLOAD_PROGRESS,
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<DownloadListResponse>;

    expect(response.success).toBe(true);
    expect(mockQueue.getAll).toHaveBeenCalled();
    expect(Array.isArray(response.data?.downloads)).toBe(true);
  });

  // 6. GET_SETTINGS returns from storage
  it('GET_SETTINGS returns settings from storage', async () => {
    const storedSettings: Settings = {
      concurrentDownloads: 5,
      defaultQuality: '720p',
      defaultSubtitleLanguage: 'ja',
      theme: 'dark',
      convertToMp4: 'always',
      parallelConversion: 'auto',
      manualWorkerCount: 4,
      parallelFallback: 'save-ts',
      segmentConcurrency: 6,
      filenameSource: 'title-fallback',
    };
    mockChrome.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: storedSettings,
    });

    const request: MessageRequest = { type: MESSAGE_TYPES.GET_SETTINGS };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<Settings>;

    expect(response.success).toBe(true);
    expect(response.data).toEqual(storedSettings);
  });

  it('GET_SETTINGS returns DEFAULT_SETTINGS when storage is empty', async () => {
    mockChrome.storage.local.get.mockResolvedValue({});

    const request: MessageRequest = { type: MESSAGE_TYPES.GET_SETTINGS };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<Settings>;

    expect(response.success).toBe(true);
    expect(response.data).toEqual(DEFAULT_SETTINGS);
  });

  it('GET_SETTINGS merges defaults for old settings missing parallel fields', async () => {
    // Simulate settings saved before parallel conversion fields existed.
    mockChrome.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        concurrentDownloads: 3,
        defaultQuality: 'highest',
        defaultSubtitleLanguage: 'en',
        theme: 'light',
        convertToMp4: 'always',
        // parallelConversion, manualWorkerCount, parallelFallback missing
      },
    });

    const request: MessageRequest = { type: MESSAGE_TYPES.GET_SETTINGS };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<Settings>;

    expect(response.success).toBe(true);
    expect(response.data?.concurrentDownloads).toBe(3);
    expect(response.data?.convertToMp4).toBe('always');
    // Missing fields should be filled with defaults.
    expect(response.data?.parallelConversion).toBe('auto');
    expect(response.data?.manualWorkerCount).toBe(4);
    expect(response.data?.parallelFallback).toBe('sequential');
  });

  // 7. UPDATE_SETTINGS saves to storage + applies to queue
  it('UPDATE_SETTINGS saves to storage and applies concurrentDownloads to queue', async () => {
    mockChrome.storage.local.get.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    });

    const request: MessageRequest = {
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: { settings: { concurrentDownloads: 7 } },
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<Settings>;

    expect(response.success).toBe(true);
    expect(response.data?.concurrentDownloads).toBe(7);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.SETTINGS]: expect.objectContaining({ concurrentDownloads: 7 }),
    });
    expect(mockQueue.setMaxConcurrent).toHaveBeenCalledWith(7);
  });

  // 8. TOGGLE_EXTENSION toggles + persists
  it('TOGGLE_EXTENSION toggles active state and persists to storage', async () => {
    // Initial state is active (default true from empty storage)
    const request: MessageRequest = { type: MESSAGE_TYPES.TOGGLE_EXTENSION };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<{ active: boolean }>;

    expect(response.success).toBe(true);
    expect(response.data?.active).toBe(false);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.EXTENSION_STATUS]: false,
    });
    // Interceptor should be stopped when inactive
    expect(mockChrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalled();
  });

  it('TOGGLE_EXTENSION re-starts interceptor when toggled back to active', async () => {
    // First toggle: active → inactive
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );
    // Second toggle: inactive → active
    const response = (await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    )) as MessageResponse<{ active: boolean }>;

    expect(response.data?.active).toBe(true);
    // start() adds a listener; should have been called twice total (init + re-start)
    expect(mockChrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(2);
  });

  it('TOGGLE_EXTENSION reloads the active tab when toggled back to active', async () => {
    // First toggle: active → inactive (no reload on disable)
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );
    mockChrome.tabs.reload.mockClear();

    // Second toggle: inactive → active (should reload active tab)
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );

    expect(mockChrome.tabs.reload).toHaveBeenCalledWith(123);
  });

  it('TOGGLE_EXTENSION does not reload the active tab when disabled', async () => {
    mockChrome.tabs.reload.mockClear();
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );
    expect(mockChrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('TOGGLE_EXTENSION skips reload on restricted chrome:// URLs', async () => {
    // First toggle: active → inactive
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );
    // Make the active tab a restricted URL
    mockChrome.tabs.get.mockResolvedValueOnce({
      id: 123,
      url: 'chrome://settings/',
      title: 'Settings',
    });
    // Second toggle: inactive → active (should NOT reload)
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.TOGGLE_EXTENSION },
      { id: 'popup' },
    );
    expect(mockChrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('GET_EXTENSION_STATUS returns the current active state', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.GET_EXTENSION_STATUS,
    };
    const response = (await messageBus.handleMessage(request, {
      id: 'popup',
    })) as MessageResponse<{ active: boolean }>;

    expect(response.success).toBe(true);
    expect(response.data?.active).toBe(true);
  });

  // 9. PAGE_SCAN_RESULT merges URLs with network detection
  it('PAGE_SCAN_RESULT merges scanned URLs with network detection and broadcasts', async () => {
    // Pre-populate via network interception
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/net.mp4', 123),
    );

    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: 123,
        videoUrls: ['https://example.com/scanned.m3u8'],
        subtitleUrls: ['https://example.com/sub.srt'],
      },
    };
    const response = await messageBus.handleMessage(request, {
      id: 'content',
    });

    expect(response.success).toBe(true);
    const videos = interceptor.getVideos(123);
    const subtitles = interceptor.getSubtitles(123);
    // Original network video + scanned video
    expect(videos.length).toBeGreaterThanOrEqual(2);
    expect(subtitles).toHaveLength(1);
    expect(subtitles[0]?.url).toBe('https://example.com/sub.srt');

    // Should have broadcast a DETECTED_MEDIA_UPDATE
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
      }),
    );
  });

  it('PAGE_SCAN_RESULT deduplicates URLs already detected by network', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/dup.mp4', 123),
    );
    const initialCount = interceptor.getVideos(123).length;

    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: 123,
        videoUrls: ['https://example.com/dup.mp4'],
        subtitleUrls: [],
      },
    };
    await messageBus.handleMessage(request, { id: 'content' });

    // No new video should be added
    expect(interceptor.getVideos(123).length).toBe(initialCount);
  });

  // 12. Progress updates broadcast to popup
  it('broadcasts DOWNLOAD_PROGRESS_UPDATE when queue emits progress', async () => {
    // Grab the onProgress callback registered with the mock queue.
    const onProgressCall = mockQueue.onProgress.mock.calls[0][0] as (
      progress: { itemId: string; status: string; progress: number },
    ) => void;

    onProgressCall({ itemId: 'dl-1', status: 'downloading', progress: 42 });

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
        payload: expect.objectContaining({
          progress: expect.objectContaining({
            itemId: 'dl-1',
            progress: 42,
          }),
        }),
      }),
    );
  });

  it('broadcasts DETECTED_MEDIA_UPDATE when network interceptor detects new media', async () => {
    // Clear previous sendMessage calls from init.
    mockChrome.runtime.sendMessage.mockClear();

    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/new.m3u8', 123),
    );

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
      }),
    );
  });

  it('sets toolbar badge to media count when network interceptor detects new media', async () => {
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/new.m3u8', 123),
    );

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '1',
      tabId: 123,
    });
    expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#2563eb',
      tabId: 123,
    });
    expect(mockChrome.action.setBadgeTextColor).toHaveBeenCalledWith({
      color: '#ffffff',
      tabId: 123,
    });
  });

  it('clears toolbar badge when TOGGLE_EXTENSION disables the extension', async () => {
    mockChrome.action.setBadgeText.mockClear();

    const request: MessageRequest = { type: MESSAGE_TYPES.TOGGLE_EXTENSION };
    await messageBus.handleMessage(request, { id: 'sender-1' });

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('clears toolbar badge when tab navigates to a new page', async () => {
    // Add media first so there is a badge to clear.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/new.m3u8', 123),
    );
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '1',
      tabId: 123,
    });

    mockChrome.action.setBadgeText.mockClear();

    const onUpdated = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0] as (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) => void;
    onUpdated(123, { status: 'loading' });

    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '',
      tabId: 123,
    });
  });

  // --- convert callback wiring ---

  it('sets a convert callback on the downloader that uses the offscreen document', async () => {
    expect(mockDownloader.setConvertCallback).toHaveBeenCalledTimes(1);
    const convertCallback = mockDownloader.setConvertCallback.mock
      .calls[0][0] as (
      dirHandle: FileSystemDirectoryHandle,
      downloadId: string,
    ) => Promise<{ outputName: string; mimeType: string }>;

    mockChrome.runtime.sendMessage.mockResolvedValueOnce({
      success: true,
      data: {
        downloadId: 'dl-1',
        outputName: 'output.mp4',
        mimeType: 'video/mp4',
        success: true,
      },
    });

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    const result = await convertCallback(mockDirHandle, 'dl-1');

    expect(mockOffscreen.ensureOffscreenReady).toHaveBeenCalled();
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: MESSAGE_TYPES.CONVERT_TS_TO_MP4_V2 }),
    );
    expect(result).toEqual({ outputName: 'output.mp4', mimeType: 'video/mp4' });
  });

  it('convert callback throws when offscreen conversion fails', async () => {
    const convertCallback = mockDownloader.setConvertCallback.mock
      .calls[0][0] as (
      dirHandle: FileSystemDirectoryHandle,
      downloadId: string,
    ) => Promise<{ outputName: string; mimeType: string }>;

    mockChrome.runtime.sendMessage.mockResolvedValueOnce({
      success: false,
      error: 'transmux error',
    });

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    await expect(convertCallback(mockDirHandle, 'dl-1')).rejects.toThrow(
      'transmux error',
    );
  });

  it('convert callback throws clear error when offscreen returns undefined (listener not registered)', async () => {
    const convertCallback = mockDownloader.setConvertCallback.mock
      .calls[0][0] as (
      dirHandle: FileSystemDirectoryHandle,
      downloadId: string,
    ) => Promise<{ outputName: string; mimeType: string }>;

    // Simulate offscreen listener not registered → sendMessage returns undefined.
    mockChrome.runtime.sendMessage.mockResolvedValueOnce(undefined);

    const mockDirHandle = {} as FileSystemDirectoryHandle;
    await expect(convertCallback(mockDirHandle, 'dl-1')).rejects.toThrow(
      /did not respond to CONVERT_TS_TO_MP4_V2/i,
    );
  });

  it('saveOpfsFile callback throws clear error when offscreen returns undefined', async () => {
    const saveCallback = mockDownloader.setSaveOpfsFileCallback.mock
      .calls[0][0] as (
      downloadId: string,
      opfsFilename: string,
      downloadFilename: string,
      mimeType: string,
    ) => Promise<void>;

    mockChrome.runtime.sendMessage.mockResolvedValueOnce(undefined);

    await expect(
      saveCallback('dl-1', 'input.ts', 'video.ts', 'video/mp2t'),
    ).rejects.toThrow(/did not respond to CREATE_OPFS_BLOB_URL/i);
  });

  // --- CONVERSION_PROGRESS_UPDATE handler ---

  it('CONVERSION_PROGRESS_UPDATE broadcasts DOWNLOAD_PROGRESS_UPDATE with conversion detail', async () => {
    mockChrome.runtime.sendMessage.mockClear();

    const request: MessageRequest = {
      type: MESSAGE_TYPES.CONVERSION_PROGRESS_UPDATE,
      payload: {
        downloadId: 'dl-conv-1',
        percent: 90,
        phase: 'transmuxing',
        fileSize: 424 * 1024 * 1024,
        processedBytes: 212 * 1024 * 1024,
        workerCount: 4,
        usedWorkers: true,
      },
    };

    const response = await messageBus.handleMessage(request, { id: 'offscreen' });

    expect(response.success).toBe(true);
    expect(mockQueue.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'dl-conv-1',
        status: 'converting',
        progress: 90,
        conversionPhase: 'transmuxing',
        workerCount: 4,
        usedWorkers: true,
      }),
    );
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MESSAGE_TYPES.DOWNLOAD_PROGRESS_UPDATE,
        payload: expect.objectContaining({
          progress: expect.objectContaining({
            itemId: 'dl-conv-1',
            status: 'converting',
            progress: 90,
            conversionPhase: 'transmuxing',
            workerCount: 4,
            usedWorkers: true,
          }),
        }),
      }),
    );
  });

  it('CONVERSION_PROGRESS_UPDATE returns error when downloadId is missing', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.CONVERSION_PROGRESS_UPDATE,
      payload: {},
    };

    const response = await messageBus.handleMessage(request, { id: 'offscreen' });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/downloadId/i);
  });
});

// =====================================================================
// OffscreenManager tests
// =====================================================================

describe('OffscreenManager', () => {
  let mockChrome: MockChrome;
  let manager: OffscreenManager;

  beforeEach(() => {
    mockChrome = createMockChrome();
    (globalThis as unknown as { chrome: unknown }).chrome = mockChrome;
    manager = new OffscreenManager();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  // 10. OffscreenManager creates document on demand
  it('creates an offscreen document on demand', async () => {
    await manager.ensureOffscreenDocument();

    expect(mockChrome.offscreen.hasDocument).toHaveBeenCalled();
    expect(mockChrome.offscreen.createDocument).toHaveBeenCalledWith({
      url: 'src/offscreen/ffmpeg.html',
      reasons: ['WORKERS', 'BLOBS'],
      justification: expect.any(String),
    });
    expect(manager.hasDocument()).toBe(true);
  });

  it('does not create a document when one already exists', async () => {
    mockChrome.offscreen.hasDocument.mockResolvedValue(true);

    await manager.ensureOffscreenDocument();

    expect(mockChrome.offscreen.createDocument).not.toHaveBeenCalled();
    expect(manager.hasDocument()).toBe(true);
  });

  it('does not create a duplicate document on repeated calls', async () => {
    await manager.ensureOffscreenDocument();
    await manager.ensureOffscreenDocument();

    expect(mockChrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
  });

  // 11. OffscreenManager closes document
  it('closes the offscreen document', async () => {
    await manager.ensureOffscreenDocument();
    await manager.closeOffscreenDocument();

    expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
    expect(manager.hasDocument()).toBe(false);
  });

  it('close is a no-op when no document exists', async () => {
    await manager.closeOffscreenDocument();

    expect(mockChrome.offscreen.closeDocument).not.toHaveBeenCalled();
  });

  // 12. ensureOffscreenReady does ping-pong handshake
  it('ensureOffscreenReady pings until listener responds', async () => {
    // First ping fails (listener not ready), second succeeds.
    mockChrome.runtime.sendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValueOnce({ success: true });

    await manager.ensureOffscreenReady();

    // Should have called sendMessage at least twice (retry).
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('ensureOffscreenReady throws after max retries if listener never responds', async () => {
    mockChrome.runtime.sendMessage.mockRejectedValue(
      new Error('Could not establish connection'),
    );

    await expect(manager.ensureOffscreenReady()).rejects.toThrow(
      /did not respond to ping/i,
    );
  });

  it('ensureOffscreenReady is cached after first success', async () => {
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await manager.ensureOffscreenReady();
    await manager.ensureOffscreenReady();

    // Second call should not re-ping (cached).
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });
});
