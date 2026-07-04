import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CURRENT_SCHEMA_VERSION, loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '@/shared/config/config';

// Mock chrome.storage.local
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

describe('settingsStore schema v2 migration (ADR-018 D2)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('CURRENT_SCHEMA_VERSION is 3 (bumped for ADR-019 subtitleOffset)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it('migrates v1 settings to v2 with nav cluster defaults merged', async () => {
    const v1Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
      // Ensure nav fields absent (simulating real v1 storage)
    };
    delete (v1Settings as Record<string, unknown>).navClusterEnabled;
    delete (v1Settings as Record<string, unknown>).navClusterPosition;
    delete (v1Settings as Record<string, unknown>).navClusterButtonSize;
    delete (v1Settings as Record<string, unknown>).navClusterBgOpacity;
    delete (v1Settings as Record<string, unknown>).navClusterButtonOpacity;
    delete (v1Settings as Record<string, unknown>).navClusterCollapsed;
    storage[STORAGE_KEYS.SETTINGS] = v1Settings;

    const result = await loadSettings();

    expect(result.navClusterEnabled).toBe(true);
    expect(result.navClusterPosition).toEqual({ x: 0, y: 75 });
    expect(result.navClusterButtonSize).toBe(48);
    expect(result.navClusterBgOpacity).toBe(0.7);
    expect(result.navClusterButtonOpacity).toBe(0.9);
    expect(result.navClusterCollapsed).toBe(false);
  });

  it('preserves existing v1 fields after migration to v2', async () => {
    const v1Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 1,
      concurrentDownloads: 7,
      theme: 'dark' as const,
    };
    delete (v1Settings as Record<string, unknown>).navClusterEnabled;
    delete (v1Settings as Record<string, unknown>).navClusterPosition;
    delete (v1Settings as Record<string, unknown>).navClusterButtonSize;
    delete (v1Settings as Record<string, unknown>).navClusterBgOpacity;
    delete (v1Settings as Record<string, unknown>).navClusterButtonOpacity;
    delete (v1Settings as Record<string, unknown>).navClusterCollapsed;
    storage[STORAGE_KEYS.SETTINGS] = v1Settings;

    const result = await loadSettings();

    expect(result.concurrentDownloads).toBe(7);
    expect(result.theme).toBe('dark');
    expect(result.navClusterEnabled).toBe(true); // merged default
  });

  it('clamps invalid navClusterPosition.x > 100 to 100', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterPosition: { x: 150, y: 75 },
    };
    const result = await loadSettings();
    expect(result.navClusterPosition.x).toBe(100);
  });

  it('clamps invalid navClusterPosition.y < 0 to 0', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterPosition: { x: 0, y: -10 },
    };
    const result = await loadSettings();
    expect(result.navClusterPosition.y).toBe(0);
  });

  it('clamps invalid navClusterBgOpacity > 1 to 1', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterBgOpacity: 1.5,
    };
    const result = await loadSettings();
    expect(result.navClusterBgOpacity).toBe(1);
  });

  it('clamps invalid navClusterButtonOpacity < 0 to 0', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterButtonOpacity: -0.3,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonOpacity).toBe(0);
  });

  it('snaps invalid navClusterButtonSize=33 to nearest preset (40)', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterButtonSize: 33,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(40);
  });

  it('snaps invalid navClusterButtonSize=52 to nearest preset (56)', async () => {
    storage[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 3,
      navClusterButtonSize: 52,
    };
    const result = await loadSettings();
    expect(result.navClusterButtonSize).toBe(56);
  });

  it('saveSettings stamps schemaVersion 3', async () => {
    await saveSettings({ navClusterEnabled: false });
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number };
    expect(stored.schemaVersion).toBe(3);
  });

  it('v2 settings migrate to v3 with subtitleOffset default {}', async () => {
    const v2Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 2,
      navClusterEnabled: false,
      navClusterPosition: { x: 50, y: 50 },
    };
    delete (v2Settings as Record<string, unknown>).subtitleOffset;
    storage[STORAGE_KEYS.SETTINGS] = v2Settings;
    const result = await loadSettings();
    expect(result.navClusterEnabled).toBe(false);
    expect(result.navClusterPosition).toEqual({ x: 50, y: 50 });
    expect(result.subtitleOffset).toEqual({});
  });
});
