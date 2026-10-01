import { wireEvents } from '@/entrypoints/background/wireEvents';
import { STORAGE_KEYS } from '@/shared/config/config';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { BackgroundContext } from '@/entrypoints/background/context';

const mockStorageListeners: Array<
  (changes: Record<string, chrome.storage.StorageChange>, area: string) => void
> = [];

jest.mock('@/shared/lib/chrome-apis', () => ({
  onStorageChanged: (cb: (changes: Record<string, unknown>, area: string) => void) =>
    mockStorageListeners.push(cb),
  removeOnStorageChangedListener: jest.fn(),
  addOnTabActivatedListener: jest.fn(() => jest.fn()),
  addOnWindowFocusChangedListener: jest.fn(() => jest.fn()),
  addOnTabUpdatedListener: jest.fn(() => jest.fn()),
  addOnTabRemovedListener: jest.fn(() => jest.fn()),
  addOnDeterminingFilenameListener: jest.fn(),
  addOnDownloadsChangedListener: jest.fn(() => jest.fn()),
  removeOnDownloadsChangedListener: jest.fn(),
  getExtensionId: jest.fn(() => 'ext-id'),
  download: jest.fn(),
  searchDownloads: jest.fn(async () => []),
  getTab: jest.fn(),
  queryTabs: jest.fn(async () => []),
  getWindowIdNone: jest.fn(() => -1),
}));

jest.mock('@/entrypoints/background/helpers', () => ({
  enrichVideo: jest.fn((_ctx: unknown, v: unknown) => v),
  enrichM3u8Variants: jest.fn(),
  updateBadgeForTab: jest.fn(),
  updateBadgeForActiveTab: jest.fn(async () => undefined),
  clearBadge: jest.fn(),
  saveSessionMedia: jest.fn(),
  saveSessionDownloads: jest.fn(),
  clearSessionMedia: jest.fn(),
  clearSessionDownloads: jest.fn(),
  saveSessionAutoDownloadedTabs: jest.fn(),
  loadSettings: jest.fn(async () => ({})),
  maybeAutoDownload: jest.fn(async () => undefined),
  pushAutoLoadSubtitles: jest.fn(async () => undefined),
  resolveUnknownSubtitleLanguages: jest.fn(async () => undefined),
  findMediaForDownloadItem: jest.fn(),
  isMediaRelevantUrlChange: jest.fn(() => false),
}));

jest.mock('@/shared/i18n', () => ({ t: (key: string) => key }));

jest.mock('@/features/dictionaryPopup/logic/lookupOrchestrator', () => ({
  clearDictionaryProbeCache: jest.fn(),
}));

const mockedClear = clearDictionaryProbeCache as jest.MockedFunction<typeof clearDictionaryProbeCache>;

beforeAll(() => {
  global.chrome = {
    webNavigation: {
      onHistoryStateUpdated: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  } as unknown as typeof chrome;
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

function fireStorageChange(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
  for (const cb of mockStorageListeners) cb(changes, area);
}

describe('wireEvents — lookup cache invalidation on settings change', () => {
  const anyCallable: unknown = new Proxy(() => undefined, {
    get: () => anyCallable,
    apply: () => undefined,
  });
  const ctx = new Proxy(
    {},
    { get: () => anyCallable },
  ) as unknown as BackgroundContext;

  beforeEach(() => {
    mockStorageListeners.length = 0;
    mockedClear.mockClear();
    wireEvents(ctx);
  });

  it('clears the lookup cache when the settings key changes in local storage', () => {
    fireStorageChange({ [STORAGE_KEYS.SETTINGS]: {} as chrome.storage.StorageChange }, 'local');
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it('ignores settings writes in non-local areas', () => {
    fireStorageChange({ [STORAGE_KEYS.SETTINGS]: {} as chrome.storage.StorageChange }, 'sync');
    expect(mockedClear).not.toHaveBeenCalled();
  });

  it('ignores unrelated storage keys', () => {
    fireStorageChange({ downloads: {} as chrome.storage.StorageChange }, 'local');
    expect(mockedClear).not.toHaveBeenCalled();
  });
});
