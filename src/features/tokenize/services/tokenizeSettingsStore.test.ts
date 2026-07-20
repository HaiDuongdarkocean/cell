import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import {
  loadTokenizeSettings,
  saveTokenizeSettings,
  isTokenizeEnabledForUrl,
  setTokenizeEnabledForUrl,
  setTokenizeEnabledForOrigin,
  DEFAULT_TOKENIZE_SETTINGS,
} from './tokenizeSettingsStore';

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

describe('tokenizeSettingsStore', () => {
  it('loads defaults when nothing is stored', async () => {
    const settings = await loadTokenizeSettings();
    expect(settings).toEqual(DEFAULT_TOKENIZE_SETTINGS);
  });

  it('saves and reloads settings', async () => {
    const next = setTokenizeEnabledForUrl(DEFAULT_TOKENIZE_SETTINGS, 'https://example.com/page', true);
    await saveTokenizeSettings(next);
    const loaded = await loadTokenizeSettings();
    expect(loaded.urls['https://example.com/page']).toBe(true);
  });

  it('exact URL wins over origin', () => {
    const settings = setTokenizeEnabledForOrigin(
      setTokenizeEnabledForUrl(DEFAULT_TOKENIZE_SETTINGS, 'https://example.com/page', true),
      'https://example.com',
      false,
    );
    expect(isTokenizeEnabledForUrl(settings, 'https://example.com/page')).toBe(true);
    expect(isTokenizeEnabledForUrl(settings, 'https://example.com/other')).toBe(false);
  });
});
