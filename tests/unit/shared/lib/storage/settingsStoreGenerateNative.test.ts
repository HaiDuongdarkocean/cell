import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';

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

describe('settingsStore keyboard shortcut migrations', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('migrates v11 settings to v12 and appends generate-native shortcut', async () => {
    const v11KeyboardShortcuts = DEFAULT_SETTINGS.keyboardShortcuts.filter((s) => s.action !== 'generate-native');
    const v11Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 11,
      keyboardShortcuts: v11KeyboardShortcuts,
    };
    storage[STORAGE_KEYS.SETTINGS] = v11Settings;

    const result = await loadSettings();

    expect(result.keyboardShortcuts).toEqual(
      expect.arrayContaining([
        { action: 'generate-native', key: 'h' },
        { action: 'toggle-player-mode', key: 'g' },
      ]),
    );
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number; keyboardShortcuts: { action: string; key: string }[] };
    expect(stored.schemaVersion).toBe(20);
    expect(stored.keyboardShortcuts).toEqual(
      expect.arrayContaining([
        { action: 'generate-native', key: 'h' },
        { action: 'toggle-player-mode', key: 'g' },
      ]),
    );
  });

  it('does not duplicate generate-native shortcut if user already has it', async () => {
    const v11KeyboardShortcuts = [
      ...DEFAULT_SETTINGS.keyboardShortcuts.filter((s) => s.action !== 'generate-native'),
      { action: 'generate-native', key: 'h' },
    ];
    const v11Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 11,
      keyboardShortcuts: v11KeyboardShortcuts,
    };
    storage[STORAGE_KEYS.SETTINGS] = v11Settings;

    const result = await loadSettings();

    const generateNativeBindings = result.keyboardShortcuts.filter((s) => s.action === 'generate-native');
    expect(generateNativeBindings.length).toBe(1);
    expect(generateNativeBindings[0].key).toBe('h');
  });

  it('DEFAULT_SETTINGS assigns H to generate-native and G to Player Mode', () => {
    const generateNative = DEFAULT_SETTINGS.keyboardShortcuts.find((s) => s.action === 'generate-native');
    const playerMode = DEFAULT_SETTINGS.keyboardShortcuts.find((s) => s.action === 'toggle-player-mode');
    expect(generateNative).toEqual({ action: 'generate-native', key: 'h' });
    expect(playerMode).toEqual({ action: 'toggle-player-mode', key: 'g' });
  });

  it('migrates v18 settings to v20 and appends play-pause shortcut', async () => {
    const v18KeyboardShortcuts = DEFAULT_SETTINGS.keyboardShortcuts.filter((s) => s.action !== 'play-pause');
    const v18Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 18,
      keyboardShortcuts: v18KeyboardShortcuts,
    };
    storage[STORAGE_KEYS.SETTINGS] = v18Settings;

    const result = await loadSettings();

    expect(result.keyboardShortcuts).toEqual(
      expect.arrayContaining([{ action: 'play-pause', key: ' ' }]),
    );
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number; keyboardShortcuts: { action: string; key: string }[] };
    expect(stored.schemaVersion).toBe(20);
    const playPauseBindings = stored.keyboardShortcuts.filter((s) => s.action === 'play-pause');
    expect(playPauseBindings.length).toBe(1);
    expect(playPauseBindings[0].key).toBe(' ');
  });

  it('does not duplicate play-pause shortcut if user already has it', async () => {
    const v18KeyboardShortcuts = [
      ...DEFAULT_SETTINGS.keyboardShortcuts.filter((s) => s.action !== 'play-pause'),
      { action: 'play-pause', key: 'space' },
    ];
    const v18Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 18,
      keyboardShortcuts: v18KeyboardShortcuts,
    };
    storage[STORAGE_KEYS.SETTINGS] = v18Settings;

    const result = await loadSettings();

    const playPauseBindings = result.keyboardShortcuts.filter((s) => s.action === 'play-pause');
    expect(playPauseBindings.length).toBe(1);
    expect(playPauseBindings[0].key).toBe('space');
  });
});


