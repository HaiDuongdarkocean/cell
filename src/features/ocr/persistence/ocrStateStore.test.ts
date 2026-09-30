// ocrStateStore tests — spec §AD4, T3.
// Reuses tokenizeSettingsStore test pattern: mock chrome.storage.local.

import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import {
  loadOcrSettings,
  saveOcrSettings,
  getOcrPreference,
  isOcrEnabledForUrl,
  setOcrPreference,
  enableOcrForOrigin,
  clearOcrPreference,
  extractOriginFromUrl,
} from './ocrStateStore';
import {
  DEFAULT_OCR_SETTINGS,
  DEFAULT_OCR_ORIGIN_STATE,
} from './ocrStateTypes';
import { STORAGE_KEYS } from '@/shared/config/config';

const storageData: Record<string, unknown> = {};

beforeAll(() => {
  const g = global as unknown as { chrome: unknown };
  g.chrome = {
    storage: {
      local: {
        get: jest.fn(async (keys?: string | string[] | null) => {
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((k) => [k, storageData[k]]));
          }
          if (typeof keys === 'string') return { [keys]: storageData[keys] };
          return { ...storageData };
        }),
        set: jest.fn(async (items: Record<string, unknown>) => {
          Object.assign(storageData, items);
        }),
      },
    },
  };
});

beforeEach(() => {
  Object.keys(storageData).forEach((k) => delete storageData[k]);
});

describe('extractOriginFromUrl', () => {
  it('extracts scheme + host + port origin from URL', () => {
    expect(extractOriginFromUrl('https://themoviebox.xyz/movies/123')).toBe('https://themoviebox.xyz');
    expect(extractOriginFromUrl('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com');
  });

  it('distinguishes scheme and port', () => {
    expect(extractOriginFromUrl('http://themoviebox.xyz/movies/123')).toBe('http://themoviebox.xyz');
    expect(extractOriginFromUrl('https://themoviebox.xyz:8443/x')).toBe('https://themoviebox.xyz:8443');
    expect(isOcrEnabledForUrl(
      { schemaVersion: 1, origins: { 'http://a.com': DEFAULT_OCR_ORIGIN_STATE } },
      'https://a.com/',
    )).toBe(false);
  });

  it('returns empty string for invalid or originless URL', () => {
    expect(extractOriginFromUrl('not-a-url')).toBe('');
    expect(extractOriginFromUrl('')).toBe('');
    expect(extractOriginFromUrl('file:///c:/movie.mp4')).toBe('');
  });
});

describe('ocrStateStore', () => {
  it('loads defaults when nothing is stored', async () => {
    const settings = await loadOcrSettings();
    expect(settings).toEqual(DEFAULT_OCR_SETTINGS);
    expect(settings.origins).toEqual({});
  });

  it('saves and reloads settings', async () => {
    const next = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    await saveOcrSettings(next);
    const loaded = await loadOcrSettings();
    expect(loaded.origins['https://themoviebox.xyz']).toEqual(DEFAULT_OCR_ORIGIN_STATE);
  });

  it('migrates legacy hostname keys to https origins on load', async () => {
    storageData[STORAGE_KEYS.OCR_SETTINGS] = {
      schemaVersion: 1,
      origins: { 'themoviebox.xyz': DEFAULT_OCR_ORIGIN_STATE },
    };
    const loaded = await loadOcrSettings();
    expect(loaded.origins['https://themoviebox.xyz']).toEqual(DEFAULT_OCR_ORIGIN_STATE);
    expect(loaded.origins['themoviebox.xyz']).toBeUndefined();
  });

  it('getOcrPreference returns state for enabled origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    const state = getOcrPreference(settings, 'https://themoviebox.xyz');
    expect(state).toEqual(DEFAULT_OCR_ORIGIN_STATE);
    expect(state?.ocrEnabled).toBe(true);
  });

  it('getOcrPreference returns undefined for unknown origin', () => {
    const state = getOcrPreference(DEFAULT_OCR_SETTINGS, 'https://unknown.com');
    expect(state).toBeUndefined();
  });

  it('isOcrEnabledForUrl checks origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    expect(isOcrEnabledForUrl(settings, 'https://themoviebox.xyz/movies/123')).toBe(true);
    expect(isOcrEnabledForUrl(settings, 'https://themoviebox.xyz/other')).toBe(true);
    expect(isOcrEnabledForUrl(settings, 'https://youtube.com/watch?v=abc')).toBe(false);
  });

  it('isOcrEnabledForUrl returns false for invalid URL', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    expect(isOcrEnabledForUrl(settings, 'not-a-url')).toBe(false);
  });

  it('setOcrPreference overwrites existing state', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    const updated = setOcrPreference(settings, 'https://themoviebox.xyz', {
      ...DEFAULT_OCR_ORIGIN_STATE,
      ocrEnabled: true,
      languageMode: 'ch',
      subtitleRegionPct: 20,
      subtitleRegionWidthPct: 100,
      customRegion: null,
    });
    expect(getOcrPreference(updated, 'https://themoviebox.xyz')?.languageMode).toBe('ch');
    expect(getOcrPreference(updated, 'https://themoviebox.xyz')?.subtitleRegionPct).toBe(20);
  });

  it('clearOcrPreference removes origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    const cleared = clearOcrPreference(settings, 'https://themoviebox.xyz');
    expect(getOcrPreference(cleared, 'https://themoviebox.xyz')).toBeUndefined();
    expect(cleared.origins).toEqual({});
  });

  it('enableOcrForOrigin does not affect other origins', () => {
    let settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'https://themoviebox.xyz');
    settings = enableOcrForOrigin(settings, 'https://kisskh.co');
    expect(getOcrPreference(settings, 'https://themoviebox.xyz')).toBeDefined();
    expect(getOcrPreference(settings, 'https://kisskh.co')).toBeDefined();
  });
});
