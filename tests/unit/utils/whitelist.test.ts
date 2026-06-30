/**
 * Unit tests for whitelist utility functions.
 *
 * `chrome.storage.local` is mocked with an in-memory store so the CRUD
 * helpers can be exercised end-to-end without a real extension runtime.
 */

import { STORAGE_KEYS } from '@/shared/config/config';
import type { WhitelistEntry } from '@/types/media';

import {
  normalizeUrl,
  getWhitelist,
  isWhitelisted,
  addToWhitelist,
  removeFromWhitelist,
} from '@/lib/utils/whitelist';

// --- In-memory chrome.storage.local mock ---

const store = new Map<string, unknown>();

const storageLocalGetMock = jest.fn<
  Promise<Record<string, unknown>>,
  [string | string[] | Record<string, unknown> | null]
>();

const storageLocalSetMock = jest.fn<
  Promise<void>,
  [Record<string, unknown>]
>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: storageLocalSetMock as unknown as typeof chrome.storage.local.set,
      },
    },
  } as unknown as typeof chrome;

  storageLocalGetMock.mockImplementation(async (keys) => {
    const result: Record<string, unknown> = {};
    if (keys === null) {
      for (const [k, v] of store) result[k] = v;
      return result;
    }
    // Normalize the keys argument into a list of string keys. The production
    // code only ever passes a single string key, but the chrome typings allow
    // an array or a defaults-object form, so handle those defensively.
    let keyList: string[];
    if (typeof keys === 'string') {
      keyList = [keys];
    } else if (Array.isArray(keys)) {
      keyList = keys;
    } else {
      keyList = Object.keys(keys as Record<string, unknown>);
    }
    for (const key of keyList) {
      if (store.has(key)) result[key] = store.get(key);
    }
    return result;
  });

  storageLocalSetMock.mockImplementation(async (items) => {
    for (const [k, v] of Object.entries(items)) store.set(k, v);
  });
});

beforeEach(() => {
  store.clear();
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

// --- normalizeUrl ---

describe('normalizeUrl', () => {
  it('strips the query string', () => {
    expect(
      normalizeUrl('https://site.com/lesson/123?ref=abc&t=120'),
    ).toBe('https://site.com/lesson');
  });

  it('strips the hash fragment', () => {
    expect(normalizeUrl('https://site.com/lesson/123#section')).toBe(
      'https://site.com/lesson',
    );
  });

  it('keeps the first path segment and drops the rest', () => {
    expect(normalizeUrl('https://site.com/lesson/123')).toBe(
      'https://site.com/lesson',
    );
  });

  it('treats two episodes of the same show as the same normalized url', () => {
    expect(normalizeUrl('https://site.com/lesson/123')).toBe(
      normalizeUrl('https://site.com/lesson/456'),
    );
  });

  it('treats two shows under the same category as the same normalized url', () => {
    expect(
      normalizeUrl(
        'https://site.com/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1',
      ),
    ).toBe(
      normalizeUrl(
        'https://site.com/Drama/Another-Show/Episode-1',
      ),
    );
  });

  it('keeps the origin when only the root path is present', () => {
    expect(normalizeUrl('https://site.com/')).toBe('https://site.com');
    expect(normalizeUrl('https://site.com')).toBe('https://site.com');
  });

  it('returns the input as-is when the URL cannot be parsed', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

// --- getWhitelist ---

describe('getWhitelist', () => {
  it('returns an empty array when no data is stored', async () => {
    const result = await getWhitelist();
    expect(result).toEqual([]);
  });

  it('returns stored entries when present', async () => {
    const entries: WhitelistEntry[] = [
      { url: 'https://site.com/lesson', addedAt: 1000 },
    ];
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, entries);
    const result = await getWhitelist();
    expect(result).toEqual(entries);
  });
});

// --- addToWhitelist ---

describe('addToWhitelist', () => {
  it('adds a new entry with a normalized url and timestamp', async () => {
    const before = Date.now();
    const result = await addToWhitelist(
      'https://site.com/lesson/123?ref=abc',
      42,
    );
    const after = Date.now();

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://site.com/lesson');
    expect(result[0].tabId).toBe(42);
    expect(result[0].addedAt).toBeGreaterThanOrEqual(before);
    expect(result[0].addedAt).toBeLessThanOrEqual(after);
  });

  it('is idempotent — adding the same url twice does not duplicate', async () => {
    await addToWhitelist('https://site.com/lesson/123?t=1');
    const result = await addToWhitelist('https://site.com/lesson/123?t=2');
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://site.com/lesson');
  });

  it('treats two episodes of the same show as the same entry', async () => {
    await addToWhitelist('https://site.com/lesson/123');
    const result = await addToWhitelist('https://site.com/lesson/456');
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://site.com/lesson');
  });
});

// --- removeFromWhitelist ---

describe('removeFromWhitelist', () => {
  it('removes the matching entry (normalized comparison)', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
      { url: 'https://site.com/other', addedAt: 2 },
    ]);

    const result = await removeFromWhitelist('https://site.com/lesson/123?x=1');
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://site.com/other');
  });

  it('returns the list unchanged when the url is not present', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    const result = await removeFromWhitelist('https://site.com/zzz');
    expect(result).toHaveLength(1);
  });
});

// --- isWhitelisted ---

describe('isWhitelisted', () => {
  it('returns true for a whitelisted url', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    expect(await isWhitelisted('https://site.com/lesson/123')).toBe(true);
  });

  it('returns true for another episode of the same whitelisted category', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    expect(await isWhitelisted('https://site.com/lesson/456')).toBe(true);
  });

  it('returns false for a url not in the whitelist', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    expect(await isWhitelisted('https://site.com/other')).toBe(false);
  });

  it('returns false for a different domain', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    expect(await isWhitelisted('https://anime.uniquestream.net/watch/lesson/123')).toBe(false);
  });

  it('normalizes the input before checking', async () => {
    store.set(STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST, [
      { url: 'https://site.com/lesson', addedAt: 1 },
    ]);
    expect(
      await isWhitelisted('https://site.com/lesson/123?ref=abc#top'),
    ).toBe(true);
  });
});
