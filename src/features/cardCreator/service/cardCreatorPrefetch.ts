/**
 * cardCreatorPrefetch — cache-first entry point for AnkiConnect schema data
 * (decks + note types). Started on Card Creator button click so the round-trip
 * overlaps with media capture; `useCardCreatorState.loadData` awaits the same
 * promise.
 *
 * spec anki-config-in-settings (schema v29): the schema is persisted in
 * `ankiSchemaCache` (chrome.storage.local). Cache hit → resolve instantly and
 * revalidate in the background; listeners registered via
 * `onAnkiSchemaRefreshed` receive the fresh decks/models when they differ.
 * Cache miss → full fetch + persist, same as before.
 *
 * The in-flight promise is cleared on dialog close so the next open re-reads
 * the persisted cache (and revalidates again).
 */
import {
  loadAnkiSchemaCache,
  refreshAnkiSchemaCache,
  type AnkiSchemaCache,
} from './ankiSchemaCache';

/** Prefetched AnkiConnect data (the note-type/deck-independent portion). */
export interface PrefetchedAnkiConnectData {
  readonly decks: readonly string[];
  readonly models: readonly string[];
}

let prefetchPromise: Promise<PrefetchedAnkiConnectData> | null = null;
let prefetchUrl: string | null = null;

const refreshListeners = new Set<(data: PrefetchedAnkiConnectData) => void>();

/**
 * Subscribe to background revalidation results. Called when a cache-hit
 * prefetch refreshes and the schema actually changed. Returns an unsubscribe.
 */
export function onAnkiSchemaRefreshed(
  cb: (data: PrefetchedAnkiConnectData) => void,
): () => void {
  refreshListeners.add(cb);
  return () => refreshListeners.delete(cb);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Background revalidate after a cache hit — notify listeners on change. */
async function revalidateInBackground(url: string, cached: AnkiSchemaCache): Promise<void> {
  const fresh = await refreshAnkiSchemaCache(url);
  if (!fresh.ok) return; // offline — keep serving the stale cache
  const changed =
    !arraysEqual(fresh.value.decks, cached.decks) ||
    !arraysEqual(fresh.value.models, cached.models);
  if (changed) {
    const data: PrefetchedAnkiConnectData = { decks: fresh.value.decks, models: fresh.value.models };
    for (const cb of refreshListeners) cb(data);
  }
}

/**
 * Start (or reuse) a prefetch for AnkiConnect decks + note types at the given
 * URL. Safe to call multiple times — returns the same in-flight promise.
 * On rejection the in-flight cache is cleared so the next call retries.
 */
export function prefetchAnkiConnectData(url: string): Promise<PrefetchedAnkiConnectData> {
  // Reuse in-flight promise for the same URL.
  if (prefetchPromise && prefetchUrl === url) return prefetchPromise;
  // URL changed (user updated AnkiConnect URL) — drop stale cache.
  if (prefetchUrl !== url) {
    prefetchPromise = null;
    prefetchUrl = null;
  }
  prefetchUrl = url;
  prefetchPromise = (async () => {
    const cached = await loadAnkiSchemaCache(url);
    if (cached) {
      void revalidateInBackground(url, cached);
      return { decks: cached.decks, models: cached.models };
    }
    const fresh = await refreshAnkiSchemaCache(url);
    if (!fresh.ok) throw new Error(fresh.error);
    return { decks: fresh.value.decks, models: fresh.value.models };
  })().catch((err) => {
    // Clear cache on failure so the next attempt retries instead of
    // reusing a rejected promise.
    prefetchPromise = null;
    prefetchUrl = null;
    throw err;
  });
  return prefetchPromise;
}

/** Return the current in-flight prefetch promise, or null if none. */
export function getPrefetchedAnkiConnectData(): Promise<PrefetchedAnkiConnectData> | null {
  return prefetchPromise;
}

/** Clear the in-flight prefetch (call on dialog close). The persisted schema
 *  cache is NOT cleared — it is the whole point of the feature. */
export function clearAnkiConnectPrefetch(): void {
  prefetchPromise = null;
  prefetchUrl = null;
}
