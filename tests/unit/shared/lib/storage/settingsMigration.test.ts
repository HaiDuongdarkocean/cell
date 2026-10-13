import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CURRENT_SCHEMA_VERSION, loadSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_LOCAL_PLAYER_SETTINGS } from '@/shared/config/config';

const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[]) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        return { [key]: storage[key] };
      }),
      set: jest.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storage, obj);
      }),
    },
  },
};
(global as { chrome?: unknown }).chrome = chromeMock;

describe('settingsStore v21→v22 migration (localPlayerSettings)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('migrates v21 → v22 adding localPlayerSettings with defaults', async () => {
    // v21 settings object WITHOUT localPlayerSettings (pre-v22 shape).
    const v21 = { ...DEFAULT_SETTINGS, schemaVersion: 21 } as unknown as Record<string, unknown>;
    delete v21.localPlayerSettings;
    storage[STORAGE_KEYS.SETTINGS] = v21;

    const loaded = await loadSettings();

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.localPlayerSettings).toEqual(DEFAULT_LOCAL_PLAYER_SETTINGS);
  });

  it('preserves existing settings fields during v21→v22 migration', async () => {
    const v21 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 21,
      concurrentDownloads: 7,
      defaultQuality: '720p',
      subtitleOverlayTargetLanguage: 'ja',
      navClusterButtonSize: 50,
    } as unknown as Record<string, unknown>;
    delete v21.localPlayerSettings;
    storage[STORAGE_KEYS.SETTINGS] = v21;

    const loaded = await loadSettings();

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Existing fields preserved.
    expect(loaded.concurrentDownloads).toBe(7);
    expect(loaded.defaultQuality).toBe('720p');
    expect(loaded.subtitleOverlayTargetLanguage).toBe('ja');
    expect(loaded.navClusterButtonSize).toBe(50);
    // New field added with defaults.
    expect(loaded.localPlayerSettings).toEqual(DEFAULT_LOCAL_PLAYER_SETTINGS);
  });

  it('localPlayerSettings defaults are { subtitleMatchEnabled: true, resumePromptEnabled: true, lastDirectoryId: null }', () => {
    expect(DEFAULT_LOCAL_PLAYER_SETTINGS).toEqual({
      subtitleMatchEnabled: true,
      resumePromptEnabled: true,
      lastDirectoryId: null,
    });
  });

  it('coerces invalid localPlayerSettings booleans to defaults (v22 validation)', async () => {
    const v22Invalid = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 22,
      localPlayerSettings: {
        subtitleMatchEnabled: 'yes',
        resumePromptEnabled: 0,
        lastDirectoryId: 123,
      },
    };
    storage[STORAGE_KEYS.SETTINGS] = v22Invalid;

    const loaded = await loadSettings();

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.localPlayerSettings.subtitleMatchEnabled).toBe(true);
    expect(loaded.localPlayerSettings.resumePromptEnabled).toBe(true);
    expect(loaded.localPlayerSettings.lastDirectoryId).toBeNull();
  });
});

describe('settingsStore v40→v41 migration (word display modes)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('maps persisted booleans to display modes on flat settings and every profile', async () => {
    const v40 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 40,
      showReadings: true,
      showWordTranslations: false,
      languageProfiles: [
        { id: 'p1', target: 'en', native: '', name: 'a', order: 1, showReadings: true, showWordTranslations: true },
        { id: 'p2', target: 'ja', native: '', name: 'b', order: 2, showReadings: false, showWordTranslations: false },
      ],
      activeProfileId: 'p1',
    } as Record<string, unknown>;
    delete v40.readingDisplay;
    delete v40.glossDisplay;
    storage[STORAGE_KEYS.SETTINGS] = v40;

    const loaded = await loadSettings();

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect('showReadings' in loaded).toBe(false);
    expect('showWordTranslations' in loaded).toBe(false);
    const [p1, p2] = loaded.languageProfiles as unknown as Record<string, unknown>[];
    expect(p1.readingDisplay).toBe('always');
    expect(p1.glossDisplay).toBe('always');
    expect('showReadings' in p1).toBe(false);
    expect('showWordTranslations' in p1).toBe(false);
    expect(p2.readingDisplay).toBe('off');
    expect(p2.glossDisplay).toBe('off');
    // Flat mirror resolves from the active profile.
    expect(loaded.readingDisplay).toBe('always');
    expect(loaded.glossDisplay).toBe('always');
  });

  it('maps missing booleans to off', async () => {
    const v40 = { ...DEFAULT_SETTINGS, schemaVersion: 40 } as Record<string, unknown>;
    delete v40.readingDisplay;
    delete v40.glossDisplay;
    storage[STORAGE_KEYS.SETTINGS] = v40;

    const loaded = await loadSettings();

    expect(loaded.readingDisplay).toBe('off');
    expect(loaded.glossDisplay).toBe('off');
  });
});

describe('settingsStore v41→v42 migration (frequency display pref)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('moves cardCreator.frequencyDisplay to dictionaryPopup and drops the old key', async () => {
    // dictionaryPopup is a per-profile flat field — the active profile's
    // slice wins over the top-level object after load, so the migrated value
    // must land on the profile too.
    const v41 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 41,
      cardCreator: { ...DEFAULT_SETTINGS.cardCreator, frequencyDisplay: 'rank' },
      dictionaryPopup: { ...DEFAULT_SETTINGS.dictionaryPopup },
      languageProfiles: [
        {
          id: 'p-en',
          target: 'en',
          native: '',
          name: 'English',
          order: 1,
          dictionaryPopup: { ...DEFAULT_SETTINGS.dictionaryPopup },
        },
      ],
      activeProfileId: 'p-en',
    } as Record<string, unknown>;
    delete (v41.dictionaryPopup as Record<string, unknown>).frequencyDisplay;
    delete ((v41.languageProfiles as Record<string, unknown>[])[0].dictionaryPopup as Record<string, unknown>).frequencyDisplay;
    storage[STORAGE_KEYS.SETTINGS] = v41;

    const loaded = await loadSettings();

    expect(loaded.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.dictionaryPopup?.frequencyDisplay).toBe('rank');
    const profiles = loaded.languageProfiles as unknown as Record<string, unknown>[];
    expect((profiles[0].dictionaryPopup as Record<string, unknown>).frequencyDisplay).toBe('rank');
    expect('frequencyDisplay' in (loaded.cardCreator as unknown as Record<string, unknown>)).toBe(false);
  });

  it('defaults to stars when the old key was never stored', async () => {
    const v41 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 41,
      dictionaryPopup: { ...DEFAULT_SETTINGS.dictionaryPopup },
    } as Record<string, unknown>;
    delete (v41.dictionaryPopup as Record<string, unknown>).frequencyDisplay;
    storage[STORAGE_KEYS.SETTINGS] = v41;

    const loaded = await loadSettings();

    expect(loaded.dictionaryPopup?.frequencyDisplay).toBe('stars');
  });

  it('keeps an already-migrated dictionaryPopup.frequencyDisplay over the old key', async () => {
    const v41 = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 41,
      cardCreator: { ...DEFAULT_SETTINGS.cardCreator, frequencyDisplay: 'rank' },
      dictionaryPopup: { ...DEFAULT_SETTINGS.dictionaryPopup, frequencyDisplay: 'stars' },
    } as Record<string, unknown>;
    storage[STORAGE_KEYS.SETTINGS] = v41;

    const loaded = await loadSettings();

    expect(loaded.dictionaryPopup?.frequencyDisplay).toBe('stars');
  });
});
