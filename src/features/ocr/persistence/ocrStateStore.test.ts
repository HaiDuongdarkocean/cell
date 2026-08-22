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
  it('extracts hostname from URL', () => {
    expect(extractOriginFromUrl('https://themoviebox.xyz/movies/123')).toBe('themoviebox.xyz');
    expect(extractOriginFromUrl('https://www.youtube.com/watch?v=abc')).toBe('www.youtube.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(extractOriginFromUrl('not-a-url')).toBe('');
    expect(extractOriginFromUrl('')).toBe('');
  });
});

describe('ocrStateStore', () => {
  it('loads defaults when nothing is stored', async () => {
    const settings = await loadOcrSettings();
    expect(settings).toEqual(DEFAULT_OCR_SETTINGS);
    expect(settings.origins).toEqual({});
  });

  it('saves and reloads settings', async () => {
    const next = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    await saveOcrSettings(next);
    const loaded = await loadOcrSettings();
    expect(loaded.origins['themoviebox.xyz']).toEqual(DEFAULT_OCR_ORIGIN_STATE);
  });

  it('getOcrPreference returns state for enabled origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    const state = getOcrPreference(settings, 'themoviebox.xyz');
    expect(state).toEqual(DEFAULT_OCR_ORIGIN_STATE);
    expect(state?.ocrEnabled).toBe(true);
  });

  it('getOcrPreference returns undefined for unknown origin', () => {
    const state = getOcrPreference(DEFAULT_OCR_SETTINGS, 'unknown.com');
    expect(state).toBeUndefined();
  });

  it('isOcrEnabledForUrl checks origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    expect(isOcrEnabledForUrl(settings, 'https://themoviebox.xyz/movies/123')).toBe(true);
    expect(isOcrEnabledForUrl(settings, 'https://themoviebox.xyz/other')).toBe(true);
    expect(isOcrEnabledForUrl(settings, 'https://youtube.com/watch?v=abc')).toBe(false);
  });

  it('isOcrEnabledForUrl returns false for invalid URL', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    expect(isOcrEnabledForUrl(settings, 'not-a-url')).toBe(false);
  });

  it('setOcrPreference overwrites existing state', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    const updated = setOcrPreference(settings, 'themoviebox.xyz', {
      ...DEFAULT_OCR_ORIGIN_STATE,
      ocrEnabled: true,
      languageMode: 'ch',
      subtitleRegionPct: 20,
      subtitleRegionWidthPct: 100,
      customRegion: null,
    });
    expect(getOcrPreference(updated, 'themoviebox.xyz')?.languageMode).toBe('ch');
    expect(getOcrPreference(updated, 'themoviebox.xyz')?.subtitleRegionPct).toBe(20);
  });

  it('clearOcrPreference removes origin', () => {
    const settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    const cleared = clearOcrPreference(settings, 'themoviebox.xyz');
    expect(getOcrPreference(cleared, 'themoviebox.xyz')).toBeUndefined();
    expect(cleared.origins).toEqual({});
  });

  it('enableOcrForOrigin does not affect other origins', () => {
    let settings = enableOcrForOrigin(DEFAULT_OCR_SETTINGS, 'themoviebox.xyz');
    settings = enableOcrForOrigin(settings, 'kisskh.co');
    expect(getOcrPreference(settings, 'themoviebox.xyz')).toBeDefined();
    expect(getOcrPreference(settings, 'kisskh.co')).toBeDefined();
  });
});
