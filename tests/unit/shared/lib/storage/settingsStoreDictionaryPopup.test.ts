import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/settings';

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

describe('settingsStore dictionaryPopup roundtrip', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('preserves defaultActiveTab through save and load', async () => {
    storage[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
    const changed: Settings = {
      ...DEFAULT_SETTINGS,
      dictionaryPopup: {
        ...DEFAULT_DICTIONARY_POPUP_SETTINGS,
        defaultActiveTab: 'image',
      },
    };
    await saveSettings(changed);
    const loaded = await loadSettings();
    expect(loaded.dictionaryPopup?.defaultActiveTab).toBe('image');
  });

  it('migrates old badgePointerTrigger.enabled to triggerMode orbital and drops enabled', async () => {
    const v15: Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 15,
      dictionaryPopup: {
        ...DEFAULT_DICTIONARY_POPUP_SETTINGS,
        triggerMode: 'click',
        badgePointerTrigger: { enabled: true, position: 'right', size: 48, pointerScale: 0.3 } as unknown as typeof DEFAULT_DICTIONARY_POPUP_SETTINGS.badgePointerTrigger,
      },
    };
    storage[STORAGE_KEYS.SETTINGS] = v15;
    const loaded = await loadSettings();
    expect(loaded.dictionaryPopup?.triggerMode).toBe('orbital');
    expect(loaded.dictionaryPopup?.badgePointerTrigger).toEqual(
      expect.objectContaining({ position: 'right', size: 48, pointerScale: 0.3 }),
    );
    expect(loaded.dictionaryPopup?.badgePointerTrigger).not.toHaveProperty('enabled');
  });
});
