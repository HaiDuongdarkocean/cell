import { usePopupStore, type PopupState } from '@/popup/store/popupStore';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/constants/config';
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

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
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

  it('updateSettings merges partial settings and persists to chrome.storage.local', () => {
    const partial: Partial<Settings> = { theme: 'dark', concurrentDownloads: 5 };
    usePopupStore.getState().updateSettings(partial);

    const settings = usePopupStore.getState().settings;
    expect(settings.theme).toBe('dark');
    expect(settings.concurrentDownloads).toBe(5);
    // Untouched fields retain their default values.
    expect(settings.defaultQuality).toBe(DEFAULT_SETTINGS.defaultQuality);
    expect(settings.defaultSubtitleLanguage).toBe(DEFAULT_SETTINGS.defaultSubtitleLanguage);

    expect(storageLocalSetMock).toHaveBeenCalledTimes(1);
    const [arg] = storageLocalSetMock.mock.calls[0];
    expect(arg[STORAGE_KEYS.SETTINGS]).toEqual(settings);
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
});
