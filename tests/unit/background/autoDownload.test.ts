/**
 * Unit tests for the auto-download orchestrator.
 *
 * `chrome.storage.local` is mocked with an in-memory store so the whitelist
 * check and settings load can be exercised end-to-end without a real
 * extension runtime. The injected deps (`getMedia`, `createDownloadItem`,
 * `addToQueue`) are stubs so the pure selection logic in `selectBestMedia`
 * runs against realistic fixtures.
 */

import { STORAGE_KEYS } from '@/constants/config';
import type {
  DetectedSubtitle,
  DetectedVideo,
  DownloadItem,
  Settings,
  WhitelistEntry,
} from '@/types/media';

import { tryAutoDownload, type AutoDownloadDeps } from '@/background/autoDownload';
import { normalizeUrl } from '@/lib/utils/whitelist';

// --- In-memory chrome.storage.local mock ---

const store = new Map<string, unknown>();

const storageLocalGetMock = jest.fn<
  Promise<Record<string, unknown>>,
  [string | string[] | Record<string, unknown> | null]
>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
      },
    },
  } as unknown as typeof chrome;

  storageLocalGetMock.mockImplementation(async (keys) => {
    const result: Record<string, unknown> = {};
    if (keys === null) {
      for (const [k, v] of store) result[k] = v;
      return result;
    }
    let keyList: string[];
    if (typeof keys === 'string') {
      keyList = [keys];
    } else if (Array.isArray(keys)) {
      keyList = keys;
    } else {
      keyList = Object.keys(keys as Record<string, unknown>);
    }
    for (const key of keyList) {
      if (store.has(key)) result[key] = store.get(key);
    }
    return result;
  });
});

beforeEach(() => {
  store.clear();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

// --- Fixtures ---

const BASE_SETTINGS: Settings = {
  concurrentDownloads: 3,
  defaultQuality: 'highest',
  defaultSubtitleLanguage: 'en',
  selectedSubtitleLanguages: ['all'],
  theme: 'light',
  convertToMp4: 'always',
  parallelConversion: 'auto',
  manualWorkerCount: 4,
  parallelFallback: 'sequential',
  segmentConcurrency: 6,
  filenameSource: 'title-fallback',
  preferredVideoFormat: 'm3u8',
  autoSelectEnabled: true,
};

function makeVideo(id: string, tabId = 1): DetectedVideo {
  return {
    id,
    url: `https://cdn.example.com/${id}.m3u8`,
    format: 'm3u8',
    title: `video-${id}`,
    tabId,
    tabUrl: 'https://site.com/lesson/123',
    detectedAt: Date.now(),
    variants: [{ url: `https://cdn.example.com/${id}.m3u8`, quality: '720p' }],
  };
}

function makeSubtitle(id: string, language = 'en', tabId = 1): DetectedSubtitle {
  return {
    id,
    url: `https://cdn.example.com/${id}.vtt`,
    format: 'vtt',
    language,
    tabId,
    detectedAt: Date.now(),
  };
}

function makeDownloadItem(
  media: DetectedVideo | DetectedSubtitle,
  type: 'video' | 'subtitle',
): DownloadItem {
  return {
    id: `dl-${media.id}`,
    mediaType: type,
    url: media.url,
    title: type === 'video' ? (media as DetectedVideo).title : media.id,
    tabId: media.tabId,
    status: 'queued',
    progress: 0,
  };
}

function makeDeps(
  media: { videos: DetectedVideo[]; subtitles: DetectedSubtitle[] },
): {
  deps: AutoDownloadDeps;
  addToQueue: jest.Mock<void, [DownloadItem[]]>;
  createDownloadItem: jest.Mock<DownloadItem, [DetectedVideo | DetectedSubtitle, 'video' | 'subtitle']>;
  getMedia: jest.Mock<{ videos: DetectedVideo[]; subtitles: DetectedSubtitle[] }, [number]>;
} {
  const getMedia = jest.fn((_tabId: number) => media);
  const createDownloadItem = jest.fn(makeDownloadItem);
  const addToQueue = jest.fn();
  return {
    deps: { getMedia, createDownloadItem, addToQueue },
    addToQueue,
    createDownloadItem,
    getMedia,
  };
}

function whitelist(url: string): void {
  const entries: WhitelistEntry[] = [{ url: normalizeUrl(url), addedAt: 1 }];
  store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, entries);
}

function settings(overrides: Partial<Settings> = {}): void {
  store.set(STORAGE_KEYS.SETTINGS, { ...BASE_SETTINGS, ...overrides });
}

// --- Tests ---

describe('tryAutoDownload', () => {
  it('does nothing when the url is not whitelisted', async () => {
    settings();
    const video = makeVideo('v1');
    const { deps, addToQueue, createDownloadItem, getMedia } = makeDeps(
      { videos: [video], subtitles: [] },
    );

    await tryAutoDownload(1, 'https://site.com/other', deps);

    expect(getMedia).not.toHaveBeenCalled();
    expect(createDownloadItem).not.toHaveBeenCalled();
    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('is silent (no download) when whitelisted but no media detected', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [], subtitles: [] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(createDownloadItem).not.toHaveBeenCalled();
    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('uses default settings when none are stored', async () => {
    whitelist('https://site.com/lesson/123');
    // no settings stored
    const video = makeVideo('v1');
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [video], subtitles: [] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(createDownloadItem).toHaveBeenCalledTimes(1);
    expect(addToQueue).toHaveBeenCalledTimes(1);
  });

  it('downloads video only when no matching subtitles exist', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [video], subtitles: [] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(createDownloadItem).toHaveBeenCalledTimes(1);
    expect(createDownloadItem).toHaveBeenCalledWith(video, 'video');
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(addToQueue.mock.calls[0][0]).toHaveLength(1);
    expect(addToQueue.mock.calls[0][0][0].mediaType).toBe('video');
  });

  it('downloads video + 2 matching subtitles (3 items)', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const sub1 = makeSubtitle('s1', 'en');
    const sub2 = makeSubtitle('s2', 'vi');
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [video], subtitles: [sub1, sub2] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(createDownloadItem).toHaveBeenCalledTimes(3);
    expect(addToQueue).toHaveBeenCalledTimes(1);
    const items = addToQueue.mock.calls[0][0];
    expect(items).toHaveLength(3);
    expect(items[0].mediaType).toBe('video');
    expect(items[1].mediaType).toBe('subtitle');
    expect(items[2].mediaType).toBe('subtitle');
  });

  it('is silent when selectBestMedia returns null', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    // No videos → selectBestMedia returns null → nothing queued.
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [], subtitles: [makeSubtitle('s1')] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(createDownloadItem).not.toHaveBeenCalled();
    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('normalizes the url before checking the whitelist', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const { deps, addToQueue } = makeDeps({ videos: [video], subtitles: [] });

    await tryAutoDownload(1, 'https://site.com/lesson/123?ref=abc#top', deps);

    expect(addToQueue).toHaveBeenCalledTimes(1);
  });

  it('skips subtitle ids that are not found in detected subtitles', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const sub1 = makeSubtitle('s1', 'en');
    const { deps, addToQueue } = makeDeps(
      { videos: [video], subtitles: [sub1] },
    );

    await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    const items = addToQueue.mock.calls[0][0];
    expect(items).toHaveLength(2); // video + 1 found subtitle
  });

  // --- return value (used by background to guard duplicate auto-downloads) ---
  // tryAutoDownload returns the list of media ids it enqueued this call
  // (empty array = nothing enqueued). The background uses this both as a
  // "did anything happen" signal and to track per-tab enqueued ids so that
  // subtitles discovered after the video can be caught up without
  // re-downloading the video.

  it('returns the enqueued media ids when items are enqueued', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const { deps } = makeDeps({ videos: [video], subtitles: [] });

    const result = await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(result).toEqual(['v1']);
  });

  it('returns an empty array when not whitelisted', async () => {
    settings();
    const video = makeVideo('v1');
    const { deps } = makeDeps({ videos: [video], subtitles: [] });

    const result = await tryAutoDownload(1, 'https://site.com/other', deps);

    expect(result).toEqual([]);
  });

  it('returns an empty array when no media is detected', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const { deps } = makeDeps({ videos: [], subtitles: [] });

    const result = await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(result).toEqual([]);
  });

  it('returns an empty array when selectBestMedia returns null (no videos)', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const { deps } = makeDeps({ videos: [], subtitles: [makeSubtitle('s1')] });

    const result = await tryAutoDownload(1, 'https://site.com/lesson/123', deps);

    expect(result).toEqual([]);
  });

  // --- incremental subtitle catch-up ---
  // onMediaDetected fires incrementally: the m3u8 is captured first, then
  // subtitles arrive later. The background passes the set of media ids it has
  // already enqueued for this page load so tryAutoDownload can enqueue only
  // the newly discovered subtitles without re-downloading the video.

  it('enqueues only newly detected subtitles on a follow-up call (skipIds)', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const sub1 = makeSubtitle('s1', 'en');

    // First call: only the video is known → enqueue just the video.
    const deps1 = makeDeps({ videos: [video], subtitles: [] });
    const enqueued1 = await tryAutoDownload(1, 'https://site.com/lesson/123', deps1.deps);
    expect(enqueued1).toEqual(['v1']);

    // Second call: subtitle now detected, video already enqueued → enqueue
    // only the subtitle, do NOT rebuild/queue the video item.
    const deps2 = makeDeps({ videos: [video], subtitles: [sub1] });
    const enqueued2 = await tryAutoDownload(
      1,
      'https://site.com/lesson/123',
      deps2.deps,
      new Set(['v1']),
    );
    expect(enqueued2).toEqual(['s1']);
    expect(deps2.createDownloadItem).toHaveBeenCalledTimes(1);
    expect(deps2.createDownloadItem).toHaveBeenCalledWith(sub1, 'subtitle');
    const items = deps2.addToQueue.mock.calls[0][0];
    expect(items).toHaveLength(1);
    expect(items[0].mediaType).toBe('subtitle');
  });

  it('returns an empty array when all selected media were already enqueued', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const sub1 = makeSubtitle('s1', 'en');
    const { deps, addToQueue, createDownloadItem } = makeDeps(
      { videos: [video], subtitles: [sub1] },
    );

    const result = await tryAutoDownload(
      1,
      'https://site.com/lesson/123',
      deps,
      new Set(['v1', 's1']),
    );

    expect(result).toEqual([]);
    expect(createDownloadItem).not.toHaveBeenCalled();
    expect(addToQueue).not.toHaveBeenCalled();
  });

  it('still enqueues the video on the first call when skipIds is empty', async () => {
    whitelist('https://site.com/lesson/123');
    settings();
    const video = makeVideo('v1');
    const sub1 = makeSubtitle('s1', 'en');
    const { deps } = makeDeps({ videos: [video], subtitles: [sub1] });

    const result = await tryAutoDownload(
      1,
      'https://site.com/lesson/123',
      deps,
      new Set(),
    );

    expect(result).toEqual(['v1', 's1']);
  });
});
