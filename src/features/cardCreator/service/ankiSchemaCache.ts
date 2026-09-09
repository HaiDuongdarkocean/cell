/**
 * Persistent AnkiConnect schema cache for Card Creator.
 *
 * Stores the last successfully fetched decks, note types, and per-note-type
 * field lists in chrome.storage.local under STORAGE_KEYS.ANKI_SCHEMA_CACHE.
 *
 * Design notes:
 * - The cache is keyed by AnkiConnect URL. A URL mismatch makes the cache
 *   unusable (prevents stale data from a different AnkiConnect instance).
 * - `getModelFields` is lazy: it only fetches and caches field names for the
 *   note types that the Card Creator form actually touches.
 * - Storage-write failures are non-fatal: we still return the fetched value.
 *
 * spec anki-config-in-settings (schema v29).
 */
import { getStorage, setStorage, removeStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import {
  ensureDefaultModel,
  listDecks,
  listModels,
  listModelFields,
  type Result,
} from './cardCreatorService';

export interface AnkiSchemaCache {
  /** AnkiConnect URL this cache was fetched from — mismatched URL = no cache. */
  readonly url: string;
  /** Timestamp (ms) when the cache was last refreshed. */
  readonly fetchedAt: number;
  /** Deck names returned by deckNames. */
  readonly decks: readonly string[];
  /** Note type (model) names returned by modelNames. */
  readonly models: readonly string[];
  /** Lazy field-name cache keyed by model name. */
  readonly fieldsByModel: Record<string, readonly string[]>;
}

/** Load the persisted schema cache, but only if it belongs to the given URL. */
export async function loadAnkiSchemaCache(url: string): Promise<AnkiSchemaCache | null> {
  const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.ANKI_SCHEMA_CACHE);
  const raw = data[STORAGE_KEYS.ANKI_SCHEMA_CACHE] as unknown;
  if (!raw || typeof raw !== 'object') return null;
  const cache = raw as AnkiSchemaCache;
  if (cache.url !== url) return null;
  return cache;
}

/** Persist the schema cache. Failures are non-fatal. */
export async function saveAnkiSchemaCache(cache: AnkiSchemaCache): Promise<void> {
  try {
    await setStorage({ [STORAGE_KEYS.ANKI_SCHEMA_CACHE]: cache });
  } catch {
    // Storage write failure is non-fatal — callers already have the value.
  }
}

/** Remove the persisted schema cache. */
export async function removeAnkiSchemaCache(): Promise<void> {
  await removeStorage(STORAGE_KEYS.ANKI_SCHEMA_CACHE);
}

/**
 * Re-fetch decks + note types and persist. Field lists already cached for
 * note types that still exist are kept (field names change even more rarely).
 * Returns `ok:false` when AnkiConnect is unreachable — callers with a stale
 * cache treat that as "offline, keep serving the cache"; callers without a
 * cache surface the error.
 */
export async function refreshAnkiSchemaCache(url: string): Promise<Result<AnkiSchemaCache>> {
  await ensureDefaultModel(url);
  const [decksR, modelsR] = await Promise.all([listDecks(url), listModels(url)]);
  if (!decksR.ok) return { ok: false, error: decksR.error };
  if (!modelsR.ok) return { ok: false, error: modelsR.error };

  const prev = await loadAnkiSchemaCache(url);
  const fieldsByModel: Record<string, readonly string[]> = {};
  for (const model of modelsR.value) {
    const cached = prev?.fieldsByModel[model];
    if (cached) fieldsByModel[model] = cached;
  }

  const cache: AnkiSchemaCache = {
    url,
    fetchedAt: Date.now(),
    decks: decksR.value,
    models: modelsR.value,
    fieldsByModel,
  };
  try {
    await saveAnkiSchemaCache(cache);
  } catch {
    // Storage write failure is non-fatal — the fresh value is still returned.
  }
  return { ok: true, value: cache };
}

/**
 * Field names of a note type — cache-first. On a cache miss the fields are
 * fetched once and merged into the persisted cache. Returns null on failure.
 */
export async function getModelFields(
  url: string,
  model: string,
): Promise<readonly string[] | null> {
  const cache = await loadAnkiSchemaCache(url);
  const hit = cache?.fieldsByModel[model];
  if (hit) return hit;

  const r = await listModelFields(url, model);
  if (!r.ok) return null;

  // Only merge into an existing cache — persisting a cache with empty
  // decks/models would be internally inconsistent (the model exists but is
  // missing from the list). When no cache exists, the next prefetch fetches
  // the full schema anyway.
  if (cache) {
    try {
      await saveAnkiSchemaCache({
        ...cache,
        fieldsByModel: { ...cache.fieldsByModel, [model]: r.value },
      });
    } catch {
      // Storage write failure is non-fatal — fields were still fetched.
    }
  }
  return r.value;
}
