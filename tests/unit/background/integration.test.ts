import { BackgroundService } from '@/background/index';
import { OffscreenManager } from '@/background/offscreenManager';
import { NetworkInterceptor } from '@/background/networkInterceptor';
import { MessageBus } from '@/background/messageBus';
import { MESSAGE_TYPES } from '@/constants/messages';
import { DEFAULT_SETTINGS, STORAGE_KEYS, DEFAULT_KEYBOARD_SHORTCUTS } from '@/constants/config';
import type { DownloadItem, Settings, WhitelistEntry } from '@/types/media';
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
    sendMessage: jest.Mock;
    onUpdated: MockListener;
    onRemoved: MockListener;
    onActivated: MockListener;
  };
  windows: {
    onFocusChanged: MockListener;
  };
  storage: {
    local: MockStorageArea;
    session: MockStorageArea;
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
    onDeterminingFilename: MockListener;
    search: jest.Mock;
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
      sendMessage: jest.fn().mockResolvedValue(undefined),
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
      session: {
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
      onDeterminingFilename: createMockListener(),
      search: jest.fn().mockResolvedValue([]),
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
      selectedSubtitleLanguages: ['ja'],
      theme: 'dark',
      convertToMp4: 'always',
      parallelConversion: 'auto',
      manualWorkerCount: 4,
      parallelFallback: 'save-ts',
      segmentConcurrency: 6,
      filenameSource: 'title-fallback',
      preferredVideoFormat: 'mp4',
      autoSelectEnabled: true,
      subtitleOverlayTargetLanguage: '',
      subtitleOverlayNativeLanguage: '',
      subtitleOverlayAutoLoad: false,
      keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
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

  it('enriches m3u8 variants from the master playlist and re-broadcasts', async () => {
    const originalFetch = global.fetch;
    const masterPlaylist = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.640028"
https://cdn.example.com/high.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,CODECS="avc1.4d401f"
https://cdn.example.com/mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=640x360,CODECS="avc1.4d4015"
https://cdn.example.com/low.m3u8`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(masterPlaylist),
    }) as unknown as typeof fetch;

    try {
      // Clear previous sendMessage calls from init.
      mockChrome.runtime.sendMessage.mockClear();

      interceptor.handleRequest(
        makeWebRequestDetails('https://example.com/master.m3u8', 123),
      );

      // Wait for the async fetch + parse + broadcast.
      await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 50));

      const video = interceptor.getVideos(123)[0];
      expect(video.format).toBe('m3u8');
      expect(video.variants).toHaveLength(3);
      expect(video.variants[0].quality).toBe('1080p');
      expect(video.variants[1].quality).toBe('720p');
      expect(video.variants[2].quality).toBe('360p');
      expect(video.variants[0].resolution).toBe('1920x1080');

      // Should have re-broadcast with enriched variants.
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MESSAGE_TYPES.DETECTED_MEDIA_UPDATE,
          payload: expect.objectContaining({ tabId: 123 }),
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('ignores m3u8 enrichment when fetch fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }) as unknown as typeof fetch;

    try {
      mockChrome.runtime.sendMessage.mockClear();

      interceptor.handleRequest(
        makeWebRequestDetails('https://example.com/master.m3u8', 123),
      );

      await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 50));

      const video = interceptor.getVideos(123)[0];
      expect(video.variants).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
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

  it('clears toolbar badge + media when tab navigates to a new page (loading event)', async () => {
    // Add media first so there is a badge.
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

    // Badge should be cleared on navigation - media is cleared
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '',
      tabId: 123,
    });
    // Media should be cleared from the interceptor
    const media = interceptor.getMedia(123);
    expect(media.videos).toHaveLength(0);
    expect(media.subtitles).toHaveLength(0);
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

  // --- OffscreenManager direct tests ---
  let manager: OffscreenManager;

  // 10. OffscreenManager creates document on demand
  it('creates an offscreen document on demand', async () => {
    manager = new OffscreenManager();
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
    manager = new OffscreenManager();
    mockChrome.offscreen.hasDocument.mockResolvedValue(true);

    await manager.ensureOffscreenDocument();

    expect(mockChrome.offscreen.createDocument).not.toHaveBeenCalled();
    expect(manager.hasDocument()).toBe(true);
  });

  it('does not create a duplicate document on repeated calls', async () => {
    manager = new OffscreenManager();
    await manager.ensureOffscreenDocument();
    await manager.ensureOffscreenDocument();

    expect(mockChrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
  });

  // 11. OffscreenManager closes document
  it('closes the offscreen document', async () => {
    manager = new OffscreenManager();
    await manager.ensureOffscreenDocument();
    await manager.closeOffscreenDocument();

    expect(mockChrome.offscreen.closeDocument).toHaveBeenCalled();
    expect(manager.hasDocument()).toBe(false);
  });

  it('close is a no-op when no document exists', async () => {
    manager = new OffscreenManager();
    await manager.closeOffscreenDocument();

    expect(mockChrome.offscreen.closeDocument).not.toHaveBeenCalled();
  });

  // 12. ensureOffscreenReady does ping-pong handshake
  it('ensureOffscreenReady pings until listener responds', async () => {
    manager = new OffscreenManager();
    // First ping fails (listener not ready), second succeeds.
    mockChrome.runtime.sendMessage
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValueOnce({ success: true });

    await manager.ensureOffscreenReady();

    // Should have called sendMessage at least twice (retry).
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('ensureOffscreenReady throws after max retries if listener never responds', async () => {
    manager = new OffscreenManager();
    mockChrome.runtime.sendMessage.mockRejectedValue(
      new Error('Could not establish connection'),
    );

    await expect(manager.ensureOffscreenReady()).rejects.toThrow(
      /did not respond to ping/i,
    );
  });

  it('ensureOffscreenReady is cached after first success', async () => {
    manager = new OffscreenManager();
    mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

    await manager.ensureOffscreenReady();
    await manager.ensureOffscreenReady();

    // Second call should not re-ping (cached).
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('clears toolbar badge + media when tab navigates to a new page (loading event)', async () => {
    // Add media first so there is a badge.
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

    // Badge should be cleared on navigation - media is cleared
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
      text: '',
      tabId: 123,
    });
    // Media should be cleared from the interceptor
    const media = interceptor.getMedia(123);
    expect(media.videos).toHaveLength(0);
    expect(media.subtitles).toHaveLength(0);
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

  // --- Auto-download on media detection (whitelisted tabs) ---

  /**
   * Helper: configure storage.local.get to return settings + whitelist so
   * `tryAutoDownload` can proceed. The mock returns the requested keys.
   */
  function setupStorageForAutoDownload(tabUrl: string): void {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      autoSelectEnabled: true,
      preferredVideoFormat: 'm3u8',
    };
    const whitelist: WhitelistEntry[] = [{ url: tabUrl, addedAt: 1, tabId: 123 }];
    mockChrome.storage.local.get.mockImplementation(async (keys) => {
      const result: Record<string, unknown> = {};
      const keyList = typeof keys === 'string' ? [keys] : (keys as string[]);
      for (const key of keyList) {
        if (key === STORAGE_KEYS.SETTINGS) result[key] = settings;
        else if (key === STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST) result[key] = whitelist;
      }
      return result;
    });
  }

  it('auto-downloads best media when a whitelisted tab detects media', async () => {
    // The mock tab URL is https://example.com/page (from createMockChrome).
    setupStorageForAutoDownload('https://example.com/page');
    mockQueue.addAll.mockClear();

    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );

    // maybeAutoDownload is async (chrome.tabs.get + tryAutoDownload).
    await new Promise((r) => setTimeout(r, 50));

    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);
    const items = mockQueue.addAll.mock.calls[0][0] as DownloadItem[];
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].mediaType).toBe('video');
    expect(items[0].url).toBe('https://example.com/movie.m3u8');
  });

  it('does not auto-download when the tab URL is not whitelisted', async () => {
    // Whitelist a different URL than the tab's actual URL.
    setupStorageForAutoDownload('https://other.com/page');
    mockQueue.addAll.mockClear();

    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(mockQueue.addAll).not.toHaveBeenCalled();
  });

  it('catches up subtitles discovered after the video without re-downloading the video', async () => {
    setupStorageForAutoDownload('https://example.com/page');
    mockQueue.addAll.mockClear();

    // First detection: only the m3u8 is known → auto-download enqueues the
    // video only (no subtitles detected yet).
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);
    const firstItems = mockQueue.addAll.mock.calls[0][0] as DownloadItem[];
    expect(firstItems).toHaveLength(1);
    expect(firstItems[0].mediaType).toBe('video');
    expect(firstItems[0].url).toBe('https://example.com/movie.m3u8');

    // Second detection: a subtitle is discovered later → the subtitle is
    // enqueued (catch-up), but the video is NOT re-downloaded.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/sub.vtt', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(2);
    const secondItems = mockQueue.addAll.mock.calls[1][0] as DownloadItem[];
    expect(secondItems).toHaveLength(1);
    expect(secondItems[0].mediaType).toBe('subtitle');
    expect(secondItems[0].url).toBe('https://example.com/sub.vtt');
  });

  it('does not re-enqueue media already auto-downloaded for the same page load', async () => {
    setupStorageForAutoDownload('https://example.com/page');
    mockQueue.addAll.mockClear();

    // First detection → auto-download the video.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);

    // A second m3u8 detection for the same media (e.g. an enriched variant
    // re-broadcast) → the video is already enqueued, so nothing new is
    // queued.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);
  });

  it('re-enables auto-download after the tab navigates (loading event clears guard)', async () => {
    setupStorageForAutoDownload('https://example.com/page');
    mockQueue.addAll.mockClear();

    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);

    // Tab navigates → loading event clears the guard.
    const onUpdated = mockChrome.tabs.onUpdated.addListener.mock.calls[0][0] as (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) => void;
    onUpdated(123, { status: 'loading' });

    // New media detected after navigation → auto-download fires again.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie2.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(2);
  });

  it('auto-downloads each episode under the same whitelisted category without a loading event', async () => {
    // Whitelist the category (first path segment), then navigate between two
    // episodes in the same tab. Each episode should auto-download once.
    setupStorageForAutoDownload('https://example.com/page');
    mockQueue.addAll.mockClear();

    // First episode.
    mockChrome.tabs.get
      .mockResolvedValueOnce({ id: 123, url: 'https://example.com/page/1', title: 'Ep 1' })
      .mockResolvedValueOnce({ id: 123, url: 'https://example.com/page/2', title: 'Ep 2' });

    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie1.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(1);

    // Second episode under the same category (no loading event in between).
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/movie2.m3u8', 123),
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(mockQueue.addAll).toHaveBeenCalledTimes(2);
  });

  // --- AUTO_LOAD_SUBTITLES push on PAGE_SCAN_RESULT ---

  /**
   * Helper: configure storage.local.get to return settings with auto-load on
   * + target 'en' + native 'vi'.
   */
  function setupStorageForAutoLoad(): void {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      subtitleOverlayAutoLoad: true,
      subtitleOverlayTargetLanguage: 'en',
      subtitleOverlayNativeLanguage: 'vi',
    };
    mockChrome.storage.local.get.mockImplementation(async (keys) => {
      const result: Record<string, unknown> = {};
      const keyList = typeof keys === 'string' ? [keys] : (keys as string[]);
      for (const key of keyList) {
        if (key === STORAGE_KEYS.SETTINGS) result[key] = settings;
      }
      return result;
    });
  }

  it('PAGE_SCAN_RESULT pushes AUTO_LOAD_SUBTITLES when autoLoad on + subtitles match', async () => {
    setupStorageForAutoLoad();
    mockChrome.tabs.sendMessage.mockClear();

    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: 123,
        videoUrls: [],
        subtitleUrls: [
          'https://example.com/sub.en.srt',
          'https://example.com/sub.vi.srt',
        ],
      },
    };

    await messageBus.handleMessage(request, { id: 'tab' });

    // Wait for the async push (loadSettings → findSubtitlesForOverlay → sendMessage).
    await new Promise((r) => setTimeout(r, 50));

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: expect.objectContaining({
          tabId: 123,
          target: expect.objectContaining({ language: 'en' }),
          native: expect.objectContaining({ language: 'vi' }),
        }),
      }),
    );
  });

  it('PAGE_SCAN_RESULT does NOT push AUTO_LOAD_SUBTITLES when autoLoad off', async () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      subtitleOverlayAutoLoad: false,
      subtitleOverlayTargetLanguage: 'en',
      subtitleOverlayNativeLanguage: 'vi',
    };
    mockChrome.storage.local.get.mockImplementation(async (keys) => {
      const result: Record<string, unknown> = {};
      const keyList = typeof keys === 'string' ? [keys] : (keys as string[]);
      for (const key of keyList) {
        if (key === STORAGE_KEYS.SETTINGS) result[key] = settings;
      }
      return result;
    });
    mockChrome.tabs.sendMessage.mockClear();

    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: 123,
        videoUrls: [],
        subtitleUrls: ['https://example.com/sub.en.srt'],
      },
    };

    await messageBus.handleMessage(request, { id: 'tab' });
    await new Promise((r) => setTimeout(r, 50));

    const autoLoadCalls = mockChrome.tabs.sendMessage.mock.calls.filter(
      ([, msg]) => (msg as MessageRequest).type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
    );
    expect(autoLoadCalls).toHaveLength(0);
  });

  it('REQUEST_AUTO_LOAD_SUBTITLES re-pushes from session_media', async () => {
    setupStorageForAutoLoad();
    mockChrome.tabs.sendMessage.mockClear();

    // Simulate session_media containing previously-detected subtitles for tab 123.
    mockChrome.storage.session.get.mockResolvedValue({
      [STORAGE_KEYS.SESSION_MEDIA]: {
        '123': {
          videos: [],
          subtitles: [
            {
              id: 'sub-en',
              url: 'https://example.com/sub.en.srt',
              format: 'srt',
              language: 'en',
              tabId: 123,
              detectedAt: 1000,
            },
            {
              id: 'sub-vi',
              url: 'https://example.com/sub.vi.srt',
              format: 'srt',
              language: 'vi',
              tabId: 123,
              detectedAt: 1000,
            },
          ],
        },
      },
    });

    const request: MessageRequest = {
      type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
      payload: { tabId: 123 },
    };

    await messageBus.handleMessage(request, { id: 'tab' });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
        payload: expect.objectContaining({
          tabId: 123,
          target: expect.objectContaining({ language: 'en' }),
          native: expect.objectContaining({ language: 'vi' }),
        }),
      }),
    );
  });

  it('REQUEST_AUTO_LOAD_SUBTITLES does not push when no session media for tab', async () => {
    setupStorageForAutoLoad();
    mockChrome.tabs.sendMessage.mockClear();
    mockChrome.storage.session.get.mockResolvedValue({});

    const request: MessageRequest = {
      type: MESSAGE_TYPES.REQUEST_AUTO_LOAD_SUBTITLES,
      payload: { tabId: 999 },
    };

    await messageBus.handleMessage(request, { id: 'tab' });
    await new Promise((r) => setTimeout(r, 50));

    const autoLoadCalls = mockChrome.tabs.sendMessage.mock.calls.filter(
      ([, msg]) => (msg as MessageRequest).type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
    );
    expect(autoLoadCalls).toHaveLength(0);
  });

  // --- Content-based language resolution for hash-based subtitle URLs (ADR-007 A6) ---

  it('PAGE_SCAN_RESULT resolves unknown languages via content detection then pushes AUTO_LOAD_SUBTITLES', async () => {
    setupStorageForAutoLoad();
    mockChrome.tabs.sendMessage.mockClear();

    // Mock global fetch: return English content for first URL, Vietnamese for second.
    // English topWords (threshold 8): the, and, for, are, but, not, you, all, can, her
    // Vietnamese topWords (threshold 8): trong, được, cho, một, với, người, này, không, cũng, những
    const mockGlobalFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('aabbccdd')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(
            '1\n00:00:00,000 --> 00:00:02,000\nthe and for are but not you all can her\n',
          ),
        });
      }
      if (url.includes('eeffgghh')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(
            '1\n00:00:00,000 --> 00:00:02,000\ntrong được cho một với người này không cũng những\n',
          ),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as jest.MockedFunction<typeof fetch>;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockGlobalFetch;

    // Hash-based URLs — extractLanguage returns 'unknown' for both.
    const request: MessageRequest = {
      type: MESSAGE_TYPES.PAGE_SCAN_RESULT,
      payload: {
        tabId: 123,
        videoUrls: [],
        subtitleUrls: [
          'https://example.com/subtitle/aabbccdd.srt',
          'https://example.com/subtitle/eeffgghh.srt',
        ],
      },
    };

    await messageBus.handleMessage(request, { id: 'tab' });
    // Wait for: pushAutoLoadSubtitles → fetch + detectLanguage + update + re-run.
    await new Promise((r) => setTimeout(r, 200));

    const autoLoadCalls = mockChrome.tabs.sendMessage.mock.calls.filter(
      ([, msg]) => (msg as MessageRequest).type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
    );
    expect(autoLoadCalls.length).toBeGreaterThanOrEqual(1);
    expect(autoLoadCalls[0][0]).toBe(123);
    const payload = (autoLoadCalls[0][1] as MessageRequest).payload as { target: { language: string }; native: { language: string } };
    expect(payload.target.language).toBe('en');
    expect(payload.native.language).toBe('vi');

    delete (globalThis as unknown as { fetch?: jest.Mock }).fetch;
  });

  it('UPDATE_SUBTITLE_LANGUAGE re-triggers pushAutoLoadSubtitles when language resolved', async () => {
    setupStorageForAutoLoad();
    mockChrome.tabs.sendMessage.mockClear();

    // Seed networkInterceptor with two unknown-language subtitles for tab 123.
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/subtitle/aabbccdd.srt', 123),
    );
    interceptor.handleRequest(
      makeWebRequestDetails('https://example.com/subtitle/eeffgghh.srt', 123),
    );

    // Get the detected subtitle IDs.
    const subs = interceptor.getSubtitles(123);
    expect(subs.length).toBe(2);
    expect(subs.every((s) => s.language === 'unknown')).toBe(true);

    // Simulate popup resolving language for the first subtitle to 'en'.
    const request: MessageRequest = {
      type: MESSAGE_TYPES.UPDATE_SUBTITLE_LANGUAGE,
      payload: { subtitleId: subs[0].id, language: 'en' },
    };

    await messageBus.handleMessage(request, { id: 'tab' });
    // Wait for the re-triggered pushAutoLoadSubtitles (loadSettings → findSubtitlesForOverlay).
    // Only one subtitle is 'en', native 'vi' still unknown → partial load (target only).
    await new Promise((r) => setTimeout(r, 100));

    const autoLoadCalls = mockChrome.tabs.sendMessage.mock.calls.filter(
      ([, msg]) => (msg as MessageRequest).type === MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
    );
    // pushAutoLoadSubtitles should have been called — findSubtitlesForOverlay
    // returns partial (target='en', native=null) since only 'en' is resolved.
    expect(autoLoadCalls.length).toBeGreaterThanOrEqual(1);
    const payload = (autoLoadCalls[0][1] as MessageRequest).payload as { target: { language: string } | null; native: { language: string } | null };
    expect(payload.target?.language).toBe('en');
  });

  // --- FETCH_SUBTITLE_CONTENT (CORS fallback) ---

  it('FETCH_SUBTITLE_CONTENT fetches + returns content', async () => {
    // Mock global fetch for the background handler.
    const mockGlobalFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('1\n00:00:00,000 --> 00:00:01,000\nHello\n'),
    }) as jest.MockedFunction<typeof fetch>;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockGlobalFetch;

    const request: MessageRequest = {
      type: MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT,
      payload: { url: 'https://example.com/sub.en.srt', tabUrl: 'https://example.com/page' },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(true);
    expect((response.data as { content?: string })?.content).toContain('Hello');
    expect((response.data as { finalUrl?: string })?.finalUrl).toBe('https://example.com/sub.en.srt');

    delete (globalThis as unknown as { fetch?: jest.Mock }).fetch;
  });

  it('FETCH_SUBTITLE_CONTENT resolves relative URL against tabUrl', async () => {
    const mockGlobalFetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('content'),
    }) as jest.MockedFunction<typeof fetch>;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockGlobalFetch;

    const request: MessageRequest = {
      type: MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT,
      payload: { url: '/subs/sub.en.srt', tabUrl: 'https://example.com/watch' },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(true);
    expect(mockGlobalFetch).toHaveBeenCalledWith('https://example.com/subs/sub.en.srt');

    delete (globalThis as unknown as { fetch?: jest.Mock }).fetch;
  });

  it('FETCH_SUBTITLE_CONTENT returns error on missing url', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT,
      payload: {},
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/url/i);
  });

  it('FETCH_SUBTITLE_CONTENT returns error on fetch failure', async () => {
    const mockGlobalFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve(''),
    }) as jest.MockedFunction<typeof fetch>;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = mockGlobalFetch;

    const request: MessageRequest = {
      type: MESSAGE_TYPES.FETCH_SUBTITLE_CONTENT,
      payload: { url: 'https://example.com/sub.en.srt' },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/403/);

    delete (globalThis as unknown as { fetch?: jest.Mock }).fetch;
  });

  // --- SUBTITLE_CUES_LOADED caching + REQUEST_SUBTITLE_CUES re-send (ADR-008 D5) ---

  it('SUBTITLE_CUES_LOADED caches cues per tab and relays to side panel', async () => {
    mockChrome.runtime.sendMessage.mockClear();

    const cues = [
      { id: 0, start: 0, end: 1000, target: 'Hello', native: 'Xin chào' },
      { id: 1, start: 1000, end: 2000, target: 'World', native: 'Thế giới' },
    ];

    const request: MessageRequest = {
      type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
      payload: { tabId: 123, cues },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(true);

    // Relayed to side panel via runtime.sendMessage
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
        payload: expect.objectContaining({ cues }),
      }),
    );
  });

  it('REQUEST_SUBTITLE_CUES returns cached cues for the tab', async () => {
    const cues = [
      { id: 0, start: 0, end: 1000, target: 'Hello', native: 'Xin chào' },
    ];

    // First, send SUBTITLE_CUES_LOADED to cache the cues.
    await messageBus.handleMessage(
      { type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED, payload: { tabId: 123, cues } },
      { id: 'tab' },
    );

    // Now request cached cues (simulating side panel opening late).
    const request: MessageRequest = {
      type: MESSAGE_TYPES.REQUEST_SUBTITLE_CUES,
      payload: { tabId: 123 },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(true);
    expect((response.data as { cues: unknown[] })?.cues).toEqual(cues);
  });

  it('REQUEST_SUBTITLE_CUES returns empty array when no cues cached for tab', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.REQUEST_SUBTITLE_CUES,
      payload: { tabId: 999 },
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(true);
    expect((response.data as { cues: unknown[] })?.cues).toEqual([]);
  });

  it('REQUEST_SUBTITLE_CUES returns error when tabId is missing', async () => {
    const request: MessageRequest = {
      type: MESSAGE_TYPES.REQUEST_SUBTITLE_CUES,
      payload: {},
    };

    const response = await messageBus.handleMessage(request, { id: 'tab' });
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/tabId/i);
  });
});
