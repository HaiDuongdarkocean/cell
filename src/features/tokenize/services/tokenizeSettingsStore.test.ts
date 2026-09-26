import { describe, expect, it, jest, beforeAll, beforeEach } from '@jest/globals';
import {
  loadTokenizeSettings,
  saveTokenizeSettings,
  isTokenizeEnabledForUrl,
  setTokenizeEnabledForUrl,
  setTokenizeEnabledForOrigin,
  isSubtitleTokenizeEnabledForUrl,
  setSubtitleTokenizeEnabledForUrl,
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

  it('subtitle setting survives volatile query param churn', () => {
    const settings = setSubtitleTokenizeEnabledForUrl(
      DEFAULT_TOKENIZE_SETTINGS,
      'http://localhost:4321/?theme=dark',
      true,
    );
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'http://localhost:4321/?theme=light')).toBe(true);
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'http://localhost:4321/')).toBe(true);
  });

  it('subtitle setting keeps video identity via v param and inherits across videos', () => {
    const settings = setSubtitleTokenizeEnabledForUrl(
      DEFAULT_TOKENIZE_SETTINGS,
      'https://www.youtube.com/watch?v=abc&t=42&themeRefresh=1',
      true,
    );
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://www.youtube.com/watch?v=abc&list=xyz')).toBe(true);
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://www.youtube.com/watch?v=other')).toBe(true);
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://vimeo.com/watch?v=abc')).toBe(false);
  });

  it('subtitle explicit URL entry overrides origin default', () => {
    const settings = {
      ...DEFAULT_TOKENIZE_SETTINGS,
      subtitleOrigins: { 'https://www.youtube.com': true },
      subtitleUrls: { 'https://www.youtube.com/watch?v=abc': false },
    };
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://www.youtube.com/watch?v=other')).toBe(true);
  });

  it('text tokenize toggle on one page is inherited by same-origin pages', () => {
    const settings = setTokenizeEnabledForUrl(
      DEFAULT_TOKENIZE_SETTINGS,
      'https://www.youtube.com/watch?v=abc',
      true,
    );
    expect(isTokenizeEnabledForUrl(settings, 'https://www.youtube.com/watch?v=other')).toBe(true);
    expect(isTokenizeEnabledForUrl(settings, 'https://example.com/')).toBe(false);
  });

  it('subtitle read falls back to legacy raw-href key', () => {
    const settings = {
      ...DEFAULT_TOKENIZE_SETTINGS,
      subtitleUrls: { 'https://example.com/watch?theme=dark': true },
    };
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://example.com/watch?theme=dark')).toBe(true);
    expect(isSubtitleTokenizeEnabledForUrl(settings, 'https://example.com/watch?theme=light')).toBe(false);
  });

  it('text tokenize setting survives volatile query param churn', () => {
    const settings = setTokenizeEnabledForUrl(
      DEFAULT_TOKENIZE_SETTINGS,
      'https://example.com/read?utm=a',
      true,
    );
    expect(isTokenizeEnabledForUrl(settings, 'https://example.com/read?utm=b&x=1')).toBe(true);
  });
});
