import { loadSettings, CURRENT_SCHEMA_VERSION } from './settingsStore';
import { DEFAULT_SETTINGS, DEFAULT_CARD_CREATOR_SETTINGS, DEFAULT_PRONUNCIATION_SETTINGS, DEFAULT_SRS_SETTINGS, STORAGE_KEYS } from '@/shared/config/config';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();
const storageLocalSetMock = jest.fn<Promise<void>, [Record<string, unknown>]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalSetMock.mockReset();
  storageLocalSetMock.mockResolvedValue(undefined);
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

describe('loadSettings migration', () => {
  it('migrates v24 settings to v26 and adds pronunciation defaults', async () => {
    const v24Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 24,
    };
    delete (v24Settings as Record<string, unknown>).pronunciation;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v24Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.pronunciation).toEqual(DEFAULT_PRONUNCIATION_SETTINGS);
  });

  it('keeps stored pronunciation values when migrating v25 to v26', async () => {
    const storedSettings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 25,
      pronunciation: {
        fallbackEngines: ['browserTts', 'espeak'],
        downloadEspeakTtsData: true,
      },
    };

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: storedSettings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.pronunciation?.fallbackEngines).toEqual(['browserTts', 'espeak']);
    expect(settings.pronunciation?.downloadEspeakTtsData).toBe(true);
    expect(settings.pronunciation?.localFile).toEqual(DEFAULT_PRONUNCIATION_SETTINGS.localFile);
  });

  it('migrates v26 settings to v27 and adds SRS settings slice', async () => {
    const v26Settings = { ...DEFAULT_SETTINGS, schemaVersion: 26 } as Record<string, unknown>;
    delete v26Settings.srs;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v26Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.srs).toEqual(DEFAULT_SRS_SETTINGS);
  });

  it('resets undefined nested objects to their defaults', async () => {
    const stored = { ...DEFAULT_SETTINGS, schemaVersion: CURRENT_SCHEMA_VERSION } as Record<string, unknown>;
    stored.cardCreator = undefined;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: stored,
    });

    const settings = await loadSettings();

    expect(settings.cardCreator).toEqual(DEFAULT_CARD_CREATOR_SETTINGS);
  });

  it('coerces corrupted arrays back to defaults', async () => {
    const stored = { ...DEFAULT_SETTINGS, schemaVersion: CURRENT_SCHEMA_VERSION } as Record<string, unknown>;
    stored.keyboardShortcuts = { notAnArray: true };
    stored.languageProfiles = 'corrupted';

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: stored,
    });

    const settings = await loadSettings();

    expect(Array.isArray(settings.keyboardShortcuts)).toBe(true);
    expect(Array.isArray(settings.languageProfiles)).toBe(true);
    expect(settings.keyboardShortcuts).toEqual(DEFAULT_SETTINGS.keyboardShortcuts);
    expect(settings.languageProfiles).toEqual(DEFAULT_SETTINGS.languageProfiles);
  });
});
