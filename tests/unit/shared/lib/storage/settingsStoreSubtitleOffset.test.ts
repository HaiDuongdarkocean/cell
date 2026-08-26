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

describe('settingsStore schema v3 migration (ADR-019 subtitleOffset)', () => {
  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  });

  it('DEFAULT_SETTINGS includes subtitleOffset: {}', () => {
    expect(DEFAULT_SETTINGS.subtitleOffset).toEqual({});
  });

  it('CURRENT_SCHEMA_VERSION is 21 (V21 adds subtitleApiKeys)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(24);
  });

  it('migrates v2 settings (no subtitleOffset) to v3 with default {}', async () => {
    const v2Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 2,
    };
    delete (v2Settings as Record<string, unknown>).subtitleOffset;
    storage[STORAGE_KEYS.SETTINGS] = v2Settings;

    const result = await loadSettings();

    expect(result.subtitleOffset).toEqual({});
    // Persisted back as v3
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number; subtitleOffset: Record<string, number> };
    expect(stored.schemaVersion).toBe(24);
    expect(stored.subtitleOffset).toEqual({});
  });

  it('preserves existing subtitleOffset data through migration v2→v3', async () => {
    const v2Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 2,
      subtitleOffset: { 'https://example.com/video?id=abc': 500 },
    };
    storage[STORAGE_KEYS.SETTINGS] = v2Settings;

    const result = await loadSettings();

    expect(result.subtitleOffset).toEqual({ 'https://example.com/video?id=abc': 500 });
  });

  it('persist round-trip: save subtitleOffset → load returns same value', async () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&feature=shared';
    const offsetMs = 700;

    await saveSettings({ subtitleOffset: { [url]: offsetMs } });
    const loaded = await loadSettings();

    expect(loaded.subtitleOffset).toBeDefined();
    expect(loaded.subtitleOffset![url]).toBe(offsetMs);
  });

  it('persist round-trip with long YouTube URL (query string) — no truncation', async () => {
    const longUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmRdnEQy6nuLMHjMZOz59Oq8B9k1F&index=42&t=125s&feature=shared&app=desktop';
    const offsetMs = -1500;

    await saveSettings({ subtitleOffset: { [longUrl]: offsetMs } });
    const loaded = await loadSettings();

    expect(loaded.subtitleOffset![longUrl]).toBe(offsetMs);
  });

  it('persist round-trip with negative offset', async () => {
    const url = 'https://example.com/video';
    const offsetMs = -2500;

    await saveSettings({ subtitleOffset: { [url]: offsetMs } });
    const loaded = await loadSettings();

    expect(loaded.subtitleOffset![url]).toBe(-2500);
  });

  it('persist round-trip with multiple URLs', async () => {
    const offsets = {
      'https://site1.com/a': 500,
      'https://site2.com/b': -1000,
      'https://site3.com/c': 2000,
    };

    await saveSettings({ subtitleOffset: offsets });
    const loaded = await loadSettings();

    expect(loaded.subtitleOffset).toEqual(offsets);
  });

  it('saveSettings stamps schemaVersion 22', async () => {
    await saveSettings({ subtitleOffset: { 'https://x.com': 100 } });
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number };
    expect(stored.schemaVersion).toBe(24);
  });

  it('v3 settings pass through without re-migration', async () => {
    const v3Settings = {
      ...DEFAULT_SETTINGS,
      schemaVersion: 5,
      subtitleOffset: { 'https://example.com': 800 },
    };
    storage[STORAGE_KEYS.SETTINGS] = v3Settings;
    const result = await loadSettings();
    expect(result.subtitleOffset).toEqual({ 'https://example.com': 800 });
  });

  it('migrates v0 (unversioned) settings all the way to v3', async () => {
    // Unversioned settings (no schemaVersion) treated as v0
    const v0Settings = {
      concurrentDownloads: 3,
    };
    storage[STORAGE_KEYS.SETTINGS] = v0Settings;

    const result = await loadSettings();

    expect(result.subtitleOffset).toEqual({});
    const stored = storage[STORAGE_KEYS.SETTINGS] as { schemaVersion: number };
    expect(stored.schemaVersion).toBe(24);
  });
});








