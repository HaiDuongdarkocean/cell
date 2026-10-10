import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS } from '@/shared/config/config';

const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[] | null) => {
        if (keys === null) return { ...storage };
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

describe('settingsStore schema v38 migration (srs.reminder)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  it('fills reminder defaults into a v37 settings object missing the field', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      schemaVersion: 37,
      srs: {
        defaultStudyConfigId: null,
        activeCollectionId: 'col-1',
        activeDeckId: null,
        activeNotetypeId: null,
        activeLanguageProfileId: null,
        dataLifecycle: {
          reviewEventMaxAgeDays: 365,
          reviewEventMaxCount: 10000,
          audioQuotaMb: 50,
          imageQuotaMb: 50,
        },
      },
    };
    const settings = await loadSettings();
    expect(settings.schemaVersion).toBe(40);
    expect(settings.srs.reminder).toEqual({ enabled: false, preferredHour: 20 });
    expect(settings.srs.activeCollectionId).toBe('col-1');
  });
});
