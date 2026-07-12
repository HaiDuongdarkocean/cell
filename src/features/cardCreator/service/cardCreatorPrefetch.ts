/**
 * cardCreatorPrefetch — singleton prefetcher for AnkiConnect data (decks +
 * models). Started on Card Creator button click so the network round-trip
 * overlaps with media capture (screenshot + sentence audio, 2-5s). When the
 * dialog mounts and `loadData` runs, it awaits the same cached promise —
 * resolving instantly if capture finished first, or waiting the remainder
 * if AnkiConnect is slower.
 *
 * Cached promise is cleared on dialog close so the next open re-fetches
 * (decks/models may have changed in Anki between sessions).
 */
import {
  ensureDefaultModel,
  listDecks,
  listModels,
} from './cardCreatorService';

/** Prefetched AnkiConnect data (the note-type/deck-independent portion). */
export interface PrefetchedAnkiConnectData {
  readonly decks: readonly string[];
  readonly models: readonly string[];
}

let prefetchPromise: Promise<PrefetchedAnkiConnectData> | null = null;
let prefetchUrl: string | null = null;

/**
 * Start (or reuse) a prefetch for AnkiConnect decks + models at the given
 * URL. Safe to call multiple times — returns the same in-flight promise.
 * On rejection the cache is cleared so the next call retries.
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
    // Ensure default model exists (desktop only; non-fatal on Android).
    await ensureDefaultModel(url);
    const [decksR, modelsR] = await Promise.all([listDecks(url), listModels(url)]);
    if (!decksR.ok) throw new Error(decksR.error);
    if (!modelsR.ok) throw new Error(modelsR.error);
    return { decks: decksR.value, models: modelsR.value };
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

/** Clear the cached prefetch (call on dialog close so the next open refreshes). */
export function clearAnkiConnectPrefetch(): void {
  prefetchPromise = null;
  prefetchUrl = null;
}
