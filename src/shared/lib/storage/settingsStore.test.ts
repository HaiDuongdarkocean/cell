import { loadSettings, saveSettings, CURRENT_SCHEMA_VERSION } from './settingsStore';
import {
  DEFAULT_SETTINGS,
  DEFAULT_CARD_CREATOR_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_PRONUNCIATION_SETTINGS,
  DEFAULT_SRS_SETTINGS,
  DEFAULT_FREQUENCY_BANDS,
  STORAGE_KEYS,
} from '@/shared/config/config';

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

  it('migrates v27 settings to v28 and adds frequencyBands', async () => {
    const v27Settings = { ...DEFAULT_SETTINGS, schemaVersion: 27 } as Record<string, unknown>;
    delete v27Settings.frequencyBands;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v27Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.frequencyBands).toEqual(DEFAULT_FREQUENCY_BANDS);
  });

  it('preserves partial frequencyBands overrides across migration', async () => {
    const v27Settings = { ...DEFAULT_SETTINGS, schemaVersion: 27 } as Record<string, unknown>;
    v27Settings.frequencyBands = { core: 1000 };

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v27Settings,
    });

    const settings = await loadSettings();

    expect(settings.frequencyBands).toEqual({
      core: 1000,
      common: 5000,
      general: 10000,
      advanced: 20000,
    });
  });

  it('migrates v29 cardCreator overwrite to skip', async () => {
    const v29Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 29,
      cardCreator: { ...DEFAULT_CARD_CREATOR_SETTINGS, mediaUpdateMode: 'overwrite' },
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v29Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.cardCreator.mediaUpdateMode).toBe('skip');
  });

  it('preserves v29 cardCreator append mode during migration', async () => {
    const v29Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 29,
      cardCreator: { ...DEFAULT_CARD_CREATOR_SETTINGS, mediaUpdateMode: 'append' },
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v29Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(settings.cardCreator.mediaUpdateMode).toBe('append');
  });

  it('migrates v30 shortcuts: rebinds n→x for vocab nav and adds prev-vocab-token z', async () => {
    const v30Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 30,
      keyboardShortcuts: [
        { action: 'prev-cue', key: 'a' },
        { action: 'next-unknown-cue', key: 'n' },
      ],
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v30Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const byAction = new Map(settings.keyboardShortcuts.map((sc) => [sc.action, sc.key]));
    expect(byAction.get('next-vocab-token')).toBe('x');
    expect(byAction.get('prev-vocab-token')).toBe('z');
    expect(byAction.get('prev-cue')).toBe('a');
  });

  it('keeps a custom vocab-nav binding and still adds prev-vocab-token', async () => {
    const v30Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 30,
      keyboardShortcuts: [{ action: 'next-unknown-cue', key: 'm' }],
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v30Settings,
    });

    const settings = await loadSettings();

    const byAction = new Map(settings.keyboardShortcuts.map((sc) => [sc.action, sc.key]));
    expect(byAction.get('next-vocab-token')).toBe('m');
    expect(byAction.get('prev-vocab-token')).toBe('z');
  });

  it('migrates v38 shortcuts: appends toggle-universal-panel Ctrl+U', async () => {
    const v38Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 38,
      keyboardShortcuts: [{ action: 'prev-cue', key: 'a' }],
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v38Settings,
    });

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const binding = settings.keyboardShortcuts.find((sc) => sc.action === 'toggle-universal-panel');
    expect(binding).toEqual({ action: 'toggle-universal-panel', key: 'u', ctrl: true });
    expect(settings.keyboardShortcuts.find((sc) => sc.action === 'prev-cue')?.key).toBe('a');
  });

  it('keeps an existing toggle-universal-panel remap during migration', async () => {
    const v38Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 38,
      keyboardShortcuts: [{ action: 'toggle-universal-panel', key: 'p', ctrl: true, shift: true }],
    } as Record<string, unknown>;

    storageLocalGetMock.mockResolvedValue({
      [STORAGE_KEYS.SETTINGS]: v38Settings,
    });

    const settings = await loadSettings();

    const bindings = settings.keyboardShortcuts.filter((sc) => sc.action === 'toggle-universal-panel');
    expect(bindings).toEqual([{ action: 'toggle-universal-panel', key: 'p', ctrl: true, shift: true }]);
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

describe('saveSettings — profile sync', () => {
  function storedWithProfiles() {
    const mkProfile = (id: string, links: { id: string; name: string; urlTemplate: string; langCodes: string[] }[]) => ({
      id,
      target: 'en',
      native: 'vi',
      name: `Profile ${id}`,
      order: 1,
      subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
      subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
      subtitleOverlayAutoLoad: true,
      subtitleOverlayAutoLoadAsr: false,
      subtitleOverlayAutoTranslate: false,
      dictionaryPopup: { ...DEFAULT_DICTIONARY_POPUP_SETTINGS, externalDictLinks: links },
    });
    return {
      ...DEFAULT_SETTINGS,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activeProfileId: 'p1',
      languageProfiles: [
        mkProfile('p1', []),
        mkProfile('p2', [{ id: 'x', name: 'B', urlTemplate: 'https://b.example/{term}', langCodes: [] }]),
      ],
    };
  }

  it('writes a partial dictionaryPopup update into the active profile (REQ-7)', async () => {
    storageLocalGetMock.mockResolvedValue({ [STORAGE_KEYS.SETTINGS]: storedWithProfiles() });

    const newLinks = [{ id: 'n1', name: 'Cambridge', urlTemplate: 'https://cam.example/{term}', langCodes: [] }];
    await saveSettings({
      dictionaryPopup: { ...DEFAULT_DICTIONARY_POPUP_SETTINGS, externalDictLinks: newLinks },
    });

    const persisted = storageLocalSetMock.mock.calls.at(-1)![0][STORAGE_KEYS.SETTINGS] as {
      dictionaryPopup: { externalDictLinks: unknown[] };
      languageProfiles: { id: string; dictionaryPopup: { externalDictLinks: unknown[] } }[];
    };
    expect(persisted.dictionaryPopup.externalDictLinks).toEqual(newLinks);
    expect(persisted.languageProfiles.find((p) => p.id === 'p1')!.dictionaryPopup.externalDictLinks).toEqual(newLinks);
    expect(persisted.languageProfiles.find((p) => p.id === 'p2')!.dictionaryPopup.externalDictLinks).toEqual([
      { id: 'x', name: 'B', urlTemplate: 'https://b.example/{term}', langCodes: [] },
    ]);
  });
});
