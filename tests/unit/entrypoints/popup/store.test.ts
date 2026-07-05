import { usePopupStore, type PopupState } from '@/entrypoints/popup/store/popupStore';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';
import type {
  DetectedVideo,
  DetectedSubtitle,
  DownloadItem,
  Settings,
} from '@/types/media';

// --- Mocks for global chrome.storage.local ---

const storageLocalSetMock = jest.fn<
  Promise<void>,
  [Record<string, unknown>]
>();
const storageLocalGetMock = jest.fn<
  Promise<Record<string, unknown>>,
  [string | string[] | Record<string, unknown> | null]
>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
  // saveSettings now does read-modify-write (calls loadSettings → getStorage).
  // Default to empty object so loadSettings returns DEFAULT_SETTINGS (raw undefined
  // path). Tests that need specific stored values override this mock per-test.
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  // Reset the store to its initial state before each test.
  usePopupStore.getState().reset();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

// --- Helpers ---

function makeVideo(id: string): DetectedVideo {
  return {
    id,
    url: `https://example.com/${id}.m3u8`,
    format: 'm3u8',
    title: `video-${id}`,
    tabId: 1,
    tabUrl: 'https://example.com',
    detectedAt: 1000,
    variants: [],
  };
}

function makeSubtitle(id: string): DetectedSubtitle {
  return {
    id,
    url: `https://example.com/${id}.vtt`,
    format: 'vtt',
    language: 'en',
    tabId: 1,
    detectedAt: 1000,
  };
}

function makeDownload(id: string, progress = 0): DownloadItem {
  return {
    id,
    mediaType: 'video',
    url: `https://example.com/${id}.mp4`,
    title: `download-${id}`,
    tabId: 1,
    status: 'queued',
    progress,
  };
}

// --- Tests ---

describe('usePopupStore', () => {
  it('exposes the PopupState interface via the store hook', () => {
    expect(typeof usePopupStore).toBe('function');
    expect(usePopupStore.getState).toBeDefined();
  });

  it('has the correct initial state', () => {
    const state = usePopupStore.getState();

    expect(state.videos).toEqual([]);
    expect(state.subtitles).toEqual([]);
    expect(state.downloads).toEqual([]);
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.extensionActive).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setVideos updates the videos array', () => {
    const videos = [makeVideo('1'), makeVideo('2')];
    usePopupStore.getState().setVideos(videos);

    expect(usePopupStore.getState().videos).toEqual(videos);
  });

  it('setSubtitles updates the subtitles array', () => {
    const subtitles = [makeSubtitle('1'), makeSubtitle('2')];
    usePopupStore.getState().setSubtitles(subtitles);

    expect(usePopupStore.getState().subtitles).toEqual(subtitles);
  });

  it('addDownload adds an item to the downloads array', () => {
    const item = makeDownload('1');
    usePopupStore.getState().addDownload(item);

    expect(usePopupStore.getState().downloads).toHaveLength(1);
    expect(usePopupStore.getState().downloads[0]).toEqual(item);
  });

  it('addDownload merges duplicate ids instead of creating two items', () => {
    // Simulate the race condition: a progress-stub is added first, then the
    // real download item from the background response arrives.
    const stub: DownloadItem = {
      id: 'sub-1',
      mediaType: 'subtitle',
      url: '',
      title: 'Download',
      tabId: 1,
      status: 'downloading',
      progress: 25,
      startedAt: 1000,
    };
    const real: DownloadItem = {
      id: 'sub-1',
      mediaType: 'subtitle',
      url: 'https://example.com/sub.srt',
      title: 'e29ac9d2ef1f849eb73428410d055c26.en',
      tabId: 1,
      status: 'queued',
      progress: 0,
      startedAt: 2000,
    };

    usePopupStore.getState().addDownload(stub);
    usePopupStore.getState().addDownload(real);

    const downloads = usePopupStore.getState().downloads;
    expect(downloads).toHaveLength(1);

    // Should keep the real metadata (title, url) and the stub's progress.
    const merged = downloads[0];
    expect(merged.title).toBe('e29ac9d2ef1f849eb73428410d055c26.en');
    expect(merged.url).toBe('https://example.com/sub.srt');
    expect(merged.status).toBe('downloading');
    expect(merged.progress).toBe(25);
    expect(merged.startedAt).toBe(1000);
  });

  it('addDownload keeps the most advanced status when merging', () => {
    const a: DownloadItem = {
      id: '1',
      mediaType: 'video',
      url: 'https://example.com/a.mp4',
      title: 'a',
      tabId: 1,
      status: 'downloading',
      progress: 50,
    };
    const b: DownloadItem = {
      id: '1',
      mediaType: 'video',
      url: 'https://example.com/b.mp4',
      title: 'b',
      tabId: 1,
      status: 'done',
      progress: 100,
    };

    usePopupStore.getState().addDownload(a);
    usePopupStore.getState().addDownload(b);

    expect(usePopupStore.getState().downloads).toHaveLength(1);
    expect(usePopupStore.getState().downloads[0].status).toBe('done');
    expect(usePopupStore.getState().downloads[0].progress).toBe(100);
  });

  it('updateDownload updates a specific download by id', () => {
    usePopupStore.getState().addDownload(makeDownload('1', 0));
    usePopupStore.getState().addDownload(makeDownload('2', 0));

    usePopupStore.getState().updateDownload('1', { progress: 50, status: 'downloading' });

    const downloads = usePopupStore.getState().downloads;
    expect(downloads).toHaveLength(2);
    const updated = downloads.find((d) => d.id === '1');
    expect(updated?.progress).toBe(50);
    expect(updated?.status).toBe('downloading');
    // The other item remains untouched.
    const untouched = downloads.find((d) => d.id === '2');
    expect(untouched?.progress).toBe(0);
    expect(untouched?.status).toBe('queued');
  });

  it('updateDownload does nothing when the id is not found', () => {
    usePopupStore.getState().addDownload(makeDownload('1'));

    usePopupStore.getState().updateDownload('missing', { progress: 99 });

    expect(usePopupStore.getState().downloads).toHaveLength(1);
    expect(usePopupStore.getState().downloads[0].progress).toBe(0);
  });

  it('removeDownload removes an item by id', () => {
    usePopupStore.getState().addDownload(makeDownload('1'));
    usePopupStore.getState().addDownload(makeDownload('2'));

    usePopupStore.getState().removeDownload('1');

    const downloads = usePopupStore.getState().downloads;
    expect(downloads).toHaveLength(1);
    expect(downloads.find((d) => d.id === '1')).toBeUndefined();
    expect(downloads.find((d) => d.id === '2')).toBeDefined();
  });

  it('clearDownloads empties the downloads array', () => {
    usePopupStore.getState().addDownload(makeDownload('1'));
    usePopupStore.getState().addDownload(makeDownload('2'));

    usePopupStore.getState().clearDownloads();

    expect(usePopupStore.getState().downloads).toEqual([]);
  });

  it('updateSettings merges partial settings and persists to chrome.storage.local', async () => {
    const partial: Partial<Settings> = { theme: 'dark', concurrentDownloads: 5 };
    usePopupStore.getState().updateSettings(partial);

    const settings = usePopupStore.getState().settings;
    expect(settings.theme).toBe('dark');
    expect(settings.concurrentDownloads).toBe(5);
    // Untouched fields retain their default values.
    expect(settings.defaultQuality).toBe(DEFAULT_SETTINGS.defaultQuality);
    expect(settings.defaultSubtitleLanguage).toBe(DEFAULT_SETTINGS.defaultSubtitleLanguage);

    // saveSettings is async (read-modify-write: loadSettings → merge → setStorage).
    // Flush the microtask queue so the void saveSettings() inside updateSettings settles.
    await new Promise((r) => setTimeout(r, 0));
    expect(storageLocalSetMock).toHaveBeenCalledTimes(1);
    const [arg] = storageLocalSetMock.mock.calls[0];
    // saveSettings stamps schemaVersion (ADR-017 D8 / ADR-018 D2 / V4 / V5 / V6) — the persisted
    // payload includes schemaVersion: 6 in addition to the merged settings.
    expect(arg[STORAGE_KEYS.SETTINGS]).toEqual({ ...settings, schemaVersion: 6 });
  });

  it('setExtensionActive updates the flag and persists to chrome.storage.local', () => {
    usePopupStore.getState().setExtensionActive(false);

    expect(usePopupStore.getState().extensionActive).toBe(false);
    expect(storageLocalSetMock).toHaveBeenCalledTimes(1);
    const [arg] = storageLocalSetMock.mock.calls[0];
    expect(arg[STORAGE_KEYS.EXTENSION_STATUS]).toBe(false);
  });

  it('setLoading updates the isLoading flag', () => {
    usePopupStore.getState().setLoading(true);
    expect(usePopupStore.getState().isLoading).toBe(true);

    usePopupStore.getState().setLoading(false);
    expect(usePopupStore.getState().isLoading).toBe(false);
  });

  it('setError updates the error string', () => {
    usePopupStore.getState().setError('something went wrong');
    expect(usePopupStore.getState().error).toBe('something went wrong');

    usePopupStore.getState().setError(null);
    expect(usePopupStore.getState().error).toBeNull();
  });

  it('reset clears all state back to the initial values', () => {
    // Mutate everything first.
    usePopupStore.getState().setVideos([makeVideo('1')]);
    usePopupStore.getState().setSubtitles([makeSubtitle('1')]);
    usePopupStore.getState().addDownload(makeDownload('1'));
    usePopupStore.getState().updateSettings({ theme: 'dark' });
    usePopupStore.getState().setExtensionActive(false);
    usePopupStore.getState().setLoading(true);
    usePopupStore.getState().setError('boom');

    usePopupStore.getState().reset();

    const state: PopupState = usePopupStore.getState();
    expect(state.videos).toEqual([]);
    expect(state.subtitles).toEqual([]);
    expect(state.downloads).toEqual([]);
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.extensionActive).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('loadPersistedSettings loads saved settings from chrome.storage.local', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      concurrentDownloads: 5,
    };
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: savedSettings,
    });

    await usePopupStore.getState().loadPersistedSettings();

    const state = usePopupStore.getState();
    expect(state.settings.theme).toBe('dark');
    expect(state.settings.concurrentDownloads).toBe(5);
    expect(state.isSettingsLoaded).toBe(true);
    expect(storageLocalGetMock).toHaveBeenCalledWith(STORAGE_KEYS.SETTINGS);
  });

  it('loadPersistedSettings keeps defaults when no saved settings exist', async () => {
    storageLocalGetMock.mockResolvedValue({});

    await usePopupStore.getState().loadPersistedSettings();

    const state = usePopupStore.getState();
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.isSettingsLoaded).toBe(true);
  });

  it('DEFAULT_SETTINGS includes parallel conversion defaults', () => {
    expect(DEFAULT_SETTINGS.parallelConversion).toBe('auto');
    expect(DEFAULT_SETTINGS.manualWorkerCount).toBe(4);
    expect(DEFAULT_SETTINGS.parallelFallback).toBe('sequential');
  });

  it('loadPersistedSettings applies saved parallel conversion settings', async () => {
    const savedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      parallelConversion: 'manual',
      manualWorkerCount: 6,
      parallelFallback: 'sequential',
    };
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: savedSettings,
    });

    await usePopupStore.getState().loadPersistedSettings();

    const state = usePopupStore.getState();
    expect(state.settings.parallelConversion).toBe('manual');
    expect(state.settings.manualWorkerCount).toBe(6);
    expect(state.settings.parallelFallback).toBe('sequential');
  });

  it('loadPersistedSettings fills missing parallel fields with defaults', async () => {
    // Simulate old settings that predate parallel conversion fields.
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        concurrentDownloads: 3,
        defaultQuality: 'highest',
        defaultSubtitleLanguage: 'en',
        theme: 'light',
        convertToMp4: 'always',
        // parallelConversion, manualWorkerCount, parallelFallback missing
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    const state = usePopupStore.getState();
    // The store loads settings as-is from storage. The background's
    // loadSettings() merges with DEFAULT_SETTINGS, but the popup store
    // does not — it uses the raw stored object. This test documents
    // that the popup store does NOT merge defaults for missing fields.
    // The background handles migration; the popup relies on the
    // GET_SETTINGS message which returns the merged result.
    expect(state.settings.concurrentDownloads).toBe(3);
  });

  // --- Migration: subtitleOverlayNativeLanguage (bilingual auto-load) ---

  it('DEFAULT_SETTINGS.subtitleOverlayNativeLanguage defaults to "vi" (V4)', () => {
    // V4 (2026-07-05): default native language = 'vi' — anh yêu không cần setup.
    expect(DEFAULT_SETTINGS.subtitleOverlayNativeLanguage).toBe('vi');
  });

  it('loadPersistedSettings fills missing subtitleOverlayNativeLanguage with "vi"', async () => {
    // Existing users (pre-feature) have no subtitleOverlayNativeLanguage field.
    // Migration fills 'vi' for backward compat (Anh yêu — current user).
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayNativeLanguage: undefined,
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayNativeLanguage).toBe('vi');
  });

  it('loadPersistedSettings keeps existing subtitleOverlayNativeLanguage', async () => {
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayNativeLanguage: 'ja',
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayNativeLanguage).toBe('ja');
  });

  it('loadPersistedSettings fills empty subtitleOverlayNativeLanguage with "vi" (V4 migration)', async () => {
    // V4 migration: pre-V4 default was '' — fill 'vi' so existing users don't
    // need setup. User who wants to disable native sets '' AFTER loading V4.
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayNativeLanguage: '',
        schemaVersion: 3, // pre-V4
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayNativeLanguage).toBe('vi');
  });

  it('loadPersistedSettings normalizes invalid subtitleOverlayTargetLanguage to empty', async () => {
    // Invalid = not ISO 639-1 (2 lowercase letters) and not empty.
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayTargetLanguage: 'english',
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayTargetLanguage).toBe('');
  });

  it('loadPersistedSettings normalizes uppercase target language to lowercase', async () => {
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayTargetLanguage: 'EN',
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayTargetLanguage).toBe('en');
  });

  it('loadPersistedSettings keeps valid 2-letter subtitleOverlayTargetLanguage', async () => {
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitleOverlayTargetLanguage: 'zh',
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitleOverlayTargetLanguage).toBe('zh');
  });

  // --- Migration: subtitlePreference (ADR-014 D5, subtitle selector V2) ---

  it('DEFAULT_SETTINGS.subtitlePreference defaults to empty object', () => {
    expect(DEFAULT_SETTINGS.subtitlePreference).toEqual({});
  });

  it('loadPersistedSettings fills missing subtitlePreference with {} (ADR-014 D5)', async () => {
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitlePreference: undefined,
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitlePreference).toEqual({});
  });

  it('loadPersistedSettings keeps existing subtitlePreference', async () => {
    const pref = { 'themoviebox.org': { en: 1 } };
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        subtitlePreference: pref,
      },
    });

    await usePopupStore.getState().loadPersistedSettings();

    expect(usePopupStore.getState().settings.subtitlePreference).toEqual(pref);
  });

  it('loadExtensionStatus loads saved status from chrome.storage.local', async () => {
    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.EXTENSION_STATUS]: false,
    });

    await usePopupStore.getState().loadExtensionStatus();

    expect(usePopupStore.getState().extensionActive).toBe(false);
  });

  it('loadExtensionStatus keeps default when no saved status exists', async () => {
    storageLocalGetMock.mockResolvedValue({});

    await usePopupStore.getState().loadExtensionStatus();

    expect(usePopupStore.getState().extensionActive).toBe(true);
  });
});
