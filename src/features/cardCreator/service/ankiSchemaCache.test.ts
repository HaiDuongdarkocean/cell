/**
 * Tests for ankiSchemaCache: persisted schema cache, URL matching,
 * background refresh, and cache-first getModelFields.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { STORAGE_KEYS } from '@/shared/config/config';
import {
  loadAnkiSchemaCache,
  saveAnkiSchemaCache,
  removeAnkiSchemaCache,
  refreshAnkiSchemaCache,
  getModelFields,
  type AnkiSchemaCache,
} from './ankiSchemaCache';

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

import type { Result } from './cardCreatorService';

const { listDecks, listModels, listModelFields } = jest.requireMock('./cardCreatorService') as unknown as {
  listDecks: jest.Mock<(...args: unknown[]) => Promise<Result<string[]>>>;
  listModels: jest.Mock<(...args: unknown[]) => Promise<Result<string[]>>>;
  listModelFields: jest.Mock<(...args: unknown[]) => Promise<Result<string[]>>>;
};

jest.mock('./cardCreatorService', () => ({
  ensureDefaultModel: jest.fn(async () => ({ ok: true, value: undefined })),
  listDecks: jest.fn(async () => ({ ok: true, value: ['Default', 'MyDeck'] } as Result<string[]>)),
  listModels: jest.fn(async () => ({ ok: true, value: ['Basic', 'Cell Video Card'] } as Result<string[]>)),
  listModelFields: jest.fn(async () => ({ ok: true, value: ['Front', 'Back', 'Definitions'] } as Result<string[]>)),
}));

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

describe('ankiSchemaCache', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.clearAllMocks();
    listDecks.mockResolvedValue({ ok: true, value: ['Default', 'MyDeck'] });
    listModels.mockResolvedValue({ ok: true, value: ['Basic', 'Cell Video Card'] });
    listModelFields.mockResolvedValue({ ok: true, value: ['Front', 'Back', 'Definitions'] });
  });

  it('save then load returns the same cache for the matching URL', async () => {
    const cache = seedCache();
    await saveAnkiSchemaCache(cache);
    expect(await loadAnkiSchemaCache(URL)).toEqual(cache);
  });

  it('load returns null when the URL does not match', async () => {
    await saveAnkiSchemaCache(seedCache());
    expect(await loadAnkiSchemaCache('http://other:8765')).toBeNull();
    expect(await loadAnkiSchemaCache(URL)).not.toBeNull();
  });

  it('remove clears the cache', async () => {
    await saveAnkiSchemaCache(seedCache());
    await removeAnkiSchemaCache();
    expect(await loadAnkiSchemaCache(URL)).toBeNull();
  });

  it('refresh fetches decks+models, persists, keeps cached fields for surviving models', async () => {
    await saveAnkiSchemaCache(
      seedCache({ fieldsByModel: { Basic: ['F1'], Gone: ['X'] } }),
    );
    const r = await refreshAnkiSchemaCache(URL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.decks).toEqual(['Default', 'MyDeck']);
    expect(r.value.models).toEqual(['Basic', 'Cell Video Card']);
    expect(r.value.fieldsByModel).toEqual({ Basic: ['F1'] });
    expect(await loadAnkiSchemaCache(URL)).toEqual(r.value);
  });

  it('refresh fails without clobbering the cache when AnkiConnect is down', async () => {
    await saveAnkiSchemaCache(seedCache());
    listDecks.mockResolvedValueOnce({ ok: false, error: 'connection refused' });
    const r = await refreshAnkiSchemaCache(URL);
    expect(r).toEqual({ ok: false, error: 'connection refused' });
    expect(await loadAnkiSchemaCache(URL)).toEqual(seedCache());
  });

  it('getModelFields returns cached fields without calling AnkiConnect', async () => {
    await saveAnkiSchemaCache(seedCache());
    const fields = await getModelFields(URL, 'Basic');
    expect(fields).toEqual(['Front', 'Back']);
    expect(listModelFields).not.toHaveBeenCalled();
  });

  it('getModelFields fetches and caches fields on miss', async () => {
    await saveAnkiSchemaCache(seedCache({ fieldsByModel: {} }));
    const fields = await getModelFields(URL, 'Cell Video Card');
    expect(fields).toEqual(['Front', 'Back', 'Definitions']);
    expect(listModelFields).toHaveBeenCalledWith(URL, 'Cell Video Card');
    const cached = await loadAnkiSchemaCache(URL);
    expect(cached?.fieldsByModel['Cell Video Card']).toEqual(['Front', 'Back', 'Definitions']);
  });

  it('getModelFields returns null and does not persist when AnkiConnect fails', async () => {
    // No cache so the service must call listModelFields.
    listModelFields.mockResolvedValueOnce({ ok: false, error: 'down' });
    const fields = await getModelFields(URL, 'Basic');
    expect(fields).toBeNull();
  });

  it('getModelFields does not persist a malformed cache when no cache exists', async () => {
    const fields = await getModelFields(URL, 'Basic');
    expect(fields).toEqual(['Front', 'Back', 'Definitions']);
    expect(store[STORAGE_KEYS.ANKI_SCHEMA_CACHE]).toBeUndefined();
  });
});
