/**
 * Tests for cardCreatorPrefetch: cache-first schema return, background
 * revalidation, listener notification, and per-URL in-flight promise.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  prefetchAnkiConnectData,
  clearAnkiConnectPrefetch,
  onAnkiSchemaRefreshed,
  getPrefetchedAnkiConnectData,
} from './cardCreatorPrefetch';
import type { Result } from './cardCreatorService';
import type { AnkiSchemaCache } from './ankiSchemaCache';

const store: Record<string, unknown> = {};

jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: jest.fn(async <T extends Record<string, unknown>>(keys?: string | string[] | null) => {
    if (keys === null || keys === undefined) return { ...store } as T;
    if (typeof keys === 'string') return { [keys]: store[keys] } as T;
    const result: Record<string, unknown> = {};
    for (const k of keys) result[k] = store[k];
    return result as T;
  }),
  setStorage: jest.fn(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  }),
  removeStorage: jest.fn(async (keys: string | string[]) => {
    for (const k of [keys].flat()) delete store[k];
  }),
}));

jest.mock('./ankiSchemaCache', () => ({
  loadAnkiSchemaCache: jest.fn(async () => null as AnkiSchemaCache | null),
  refreshAnkiSchemaCache: jest.fn(async () => ({ ok: false, error: 'down' }) as Result<AnkiSchemaCache>),
  saveAnkiSchemaCache: jest.fn(async () => {}),
  removeAnkiSchemaCache: jest.fn(async () => {}),
  getModelFields: jest.fn(async () => null as readonly string[] | null),
}));

const { loadAnkiSchemaCache, refreshAnkiSchemaCache } = jest.requireMock('./ankiSchemaCache') as unknown as {
  loadAnkiSchemaCache: jest.Mock<(...args: unknown[]) => Promise<AnkiSchemaCache | null>>;
  refreshAnkiSchemaCache: jest.Mock<(...args: unknown[]) => Promise<Result<AnkiSchemaCache>>>;
};

const URL = 'http://localhost:8765';

function seedCache(overrides?: Partial<AnkiSchemaCache>): AnkiSchemaCache {
  return {
    url: URL,
    fetchedAt: 1,
    decks: ['Default'],
    models: ['Basic'],
    fieldsByModel: { Basic: ['Front', 'Back'] },
    ...overrides,
  };
}

describe('cardCreatorPrefetch', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.clearAllMocks();
    clearAnkiConnectPrefetch();
    loadAnkiSchemaCache.mockResolvedValue(null);
  });

  it('fetches and returns decks/models when no cache exists', async () => {
    const cache = seedCache({ decks: ['A', 'B'], models: ['M1', 'M2'] });
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: cache });
    const data = await prefetchAnkiConnectData(URL);
    expect(data).toEqual({ decks: ['A', 'B'], models: ['M1', 'M2'] });
    expect(refreshAnkiSchemaCache).toHaveBeenCalledWith(URL);
  });

  it('returns cached data immediately and revalidates in the background', async () => {
    const cached = seedCache({ decks: ['Default'], models: ['Basic'] });
    loadAnkiSchemaCache.mockResolvedValue(cached);
    const fresh = seedCache({ decks: ['Default', 'Extra'], models: ['Basic', 'Advanced'] });
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: fresh });

    const data = await prefetchAnkiConnectData(URL);
    expect(data).toEqual({ decks: ['Default'], models: ['Basic'] });
    // Background revalidate must run and eventually notify listeners.
    await new Promise((r) => setTimeout(r, 10));
    expect(refreshAnkiSchemaCache).toHaveBeenCalledWith(URL);
  });

  it('notifies listeners only when decks or models changed after revalidation', async () => {
    const cached = seedCache({ decks: ['Default'], models: ['Basic'] });
    loadAnkiSchemaCache.mockResolvedValue(cached);
    const fresh = seedCache({ decks: ['Default'], models: ['Basic', 'Advanced'] });
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: fresh });

    const handler = jest.fn();
    onAnkiSchemaRefreshed(handler);

    await prefetchAnkiConnectData(URL);
    await new Promise((r) => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ decks: ['Default'], models: ['Basic', 'Advanced'] });
  });

  it('does not notify listeners when revalidation returns unchanged data', async () => {
    const cached = seedCache({ decks: ['Default'], models: ['Basic'] });
    loadAnkiSchemaCache.mockResolvedValue(cached);
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: cached });

    const handler = jest.fn();
    onAnkiSchemaRefreshed(handler);
    await prefetchAnkiConnectData(URL);
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not notify listeners when revalidation fails', async () => {
    const cached = seedCache();
    loadAnkiSchemaCache.mockResolvedValue(cached);
    refreshAnkiSchemaCache.mockResolvedValue({ ok: false, error: 'down' });

    const handler = jest.fn();
    onAnkiSchemaRefreshed(handler);
    await prefetchAnkiConnectData(URL);
    await new Promise((r) => setTimeout(r, 10));
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns the same in-flight promise for the same URL', async () => {
    const cache = seedCache();
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: cache });
    const a = prefetchAnkiConnectData(URL);
    const b = prefetchAnkiConnectData(URL);
    expect(a).toBe(b);
    expect(await a).toEqual({ decks: cache.decks, models: cache.models });
    expect(refreshAnkiSchemaCache).toHaveBeenCalledTimes(1);
  });

  it('drops stale in-flight promise when URL changes', async () => {
    const cache = seedCache();
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: cache });
    await prefetchAnkiConnectData(URL);
    const next = 'http://other:8765';
    const otherCache = seedCache({ url: next, decks: ['OtherDeck'], models: ['OtherModel'] });
    loadAnkiSchemaCache.mockImplementation(async (...args: unknown[]) => {
      const [url] = args as [string];
      return url === next ? otherCache : null;
    });
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: otherCache });
    const data = await prefetchAnkiConnectData(next);
    expect(data).toEqual({ decks: ['OtherDeck'], models: ['OtherModel'] });
    expect(refreshAnkiSchemaCache).toHaveBeenCalledWith(next);
  });

  it('clears the rejected in-flight promise so the next call retries', async () => {
    loadAnkiSchemaCache.mockResolvedValue(null);
    refreshAnkiSchemaCache.mockRejectedValue(new Error('network'));
    await expect(prefetchAnkiConnectData(URL)).rejects.toThrow('network');
    expect(getPrefetchedAnkiConnectData()).toBeNull();

    refreshAnkiSchemaCache.mockReset();
    const cache = seedCache();
    refreshAnkiSchemaCache.mockResolvedValue({ ok: true, value: cache });
    const data = await prefetchAnkiConnectData(URL);
    expect(data).toEqual({ decks: cache.decks, models: cache.models });
  });
});
