import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
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

    expect(loaded.schemaVersion).toBe(22);
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

    expect(loaded.schemaVersion).toBe(22);
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

    expect(loaded.schemaVersion).toBe(22);
    expect(loaded.localPlayerSettings.subtitleMatchEnabled).toBe(true);
    expect(loaded.localPlayerSettings.resumePromptEnabled).toBe(true);
    expect(loaded.localPlayerSettings.lastDirectoryId).toBeNull();
  });
});
