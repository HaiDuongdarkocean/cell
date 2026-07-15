// wordStatusStore — spec §D1: IndexedDB 4-status cycle for words.
//
// Status cycle: unknown → tracking → known → ignore → unknown (loop).
// Keyed by term (unique). The popup footer cycles status on click.
//
// Storage: langWordStatus store, keyPath 'term', index by_status.

import { getDB, getStore, awaitTx, STORES } from '@/features/dictionary/repositories/baseRepository';
import type { WordStatus } from '../types';

/** Word status entry — 1 row per term (langWordStatus store). */
export interface WordStatusEntry {
  /** The term (unique key). */
  readonly term: string;
  /** The status: unknown | tracking | known | ignore. */
  readonly status: WordStatus;
  /** Last updated timestamp (ms). */
  readonly updatedAt: number;
}

/** The 4-status cycle order (spec §D1). */
export const STATUS_CYCLE: readonly WordStatus[] = ['unknown', 'tracking', 'known', 'ignore'];

/** Get the next status in the cycle. */
export function nextStatus(current: WordStatus): WordStatus {
  const idx = STATUS_CYCLE.indexOf(current);
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!;
}

/** Default status for a word not in the store. */
export const DEFAULT_STATUS: WordStatus = 'unknown';

/** Get the status for a term. Returns 'unknown' if not stored. */
export async function getWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  return new Promise((resolve, reject) => {
    const req = store.get(term);
    req.onsuccess = () => {
      const entry = req.result as WordStatusEntry | undefined;
      resolve(entry?.status ?? DEFAULT_STATUS);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get statuses for multiple terms in one transaction. */
export async function getWordStatuses(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, WordStatus>> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const result = new Map<string, WordStatus>();
  await Promise.all(
    terms.map(
      (term) =>
        new Promise<void>((resolve, reject) => {
          const req = store.get(term);
          req.onsuccess = () => {
            const entry = req.result as WordStatusEntry | undefined;
            result.set(term, entry?.status ?? DEFAULT_STATUS);
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  return result;
}

/** Set the status for a term (upsert). */
export async function setWordStatus(langCode: string, term: string, status: WordStatus): Promise<void> {
  const db = await getDB(langCode);
  const store = getStore(db, STORES.WORD_STATUS);
  const entry: WordStatusEntry = { term, status, updatedAt: Date.now() };
  store.put(entry);
  await awaitTx(store.transaction!);
}

/** Cycle the status for a term: get current → next → set. */
export async function cycleWordStatus(langCode: string, term: string): Promise<WordStatus> {
  const current = await getWordStatus(langCode, term);
  const next = nextStatus(current);
  await setWordStatus(langCode, term, next);
  return next;
}

/** Delete the status entry for a term (reset to unknown). */
export async function deleteWordStatus(langCode: string, term: string): Promise<void> {
  const db = await getDB(langCode);
  const store = getStore(db, STORES.WORD_STATUS);
  store.delete(term);
  await awaitTx(store.transaction!);
}

/** Get all terms with a given status. */
export async function getTermsByStatus(langCode: string, status: WordStatus): Promise<string[]> {
  const db = await getDB(langCode);
  const tx = db.transaction(STORES.WORD_STATUS, 'readonly');
  const store = tx.objectStore(STORES.WORD_STATUS);
  const index = store.index('by_status');
  return new Promise((resolve, reject) => {
    const req = index.getAll(status);
    req.onsuccess = () => {
      const entries = req.result as WordStatusEntry[];
      resolve(entries.map((e) => e.term));
    };
    req.onerror = () => reject(req.error);
  });
}
