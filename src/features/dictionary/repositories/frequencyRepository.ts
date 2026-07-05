// frequencyRepository — CRUD + bulkInsert cho langFrequencyEntry (ADR-023 D1).
//
// Methods: add, bulkInsert, findByResource, findByTerm, findByPrefix,
// findBySuffix (via backwardTerm), countByResource, deleteByResource.

import { getDB, getStore, STORES, INDEXES, reverseString } from './baseRepository';
import type { FrequencyEntry } from '@/entities/dictionary';

/** Internal stored entry — adds backwardTerm for suffix index. */
interface StoredFrequencyEntry extends Omit<FrequencyEntry, 'id'> {
  readonly backwardTerm: string;
  id?: number;
}

/** Add a single frequency entry. Returns auto-generated id. */
export async function addFrequencyEntry(langCode: string, entry: Omit<FrequencyEntry, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  const stored: StoredFrequencyEntry = { ...entry, backwardTerm: reverseString(entry.term) };
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY);
    const request = store.add(stored);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Bulk insert frequency entries (1 transaction per batch — ADR-023 D8). */
export async function bulkInsertFrequencyEntries(
  langCode: string,
  entries: ReadonlyArray<Omit<FrequencyEntry, 'id'>>,
): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY);
    for (const entry of entries) {
      const stored: StoredFrequencyEntry = { ...entry, backwardTerm: reverseString(entry.term) };
      store.add(stored);
    }
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Find all frequency entries for a resource. */
export async function findFrequencyByResource(langCode: string, resourceId: number): Promise<FrequencyEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.getAll(resourceId);
    request.onsuccess = () => resolve(request.result as FrequencyEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find frequency entries by exact term match. */
export async function findFrequencyByTerm(langCode: string, term: string): Promise<FrequencyEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const request = index.getAll(term);
    request.onsuccess = () => resolve(request.result as FrequencyEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find frequency entries by term prefix (e.g. "app" → "apple", "application"). */
export async function findFrequencyByPrefix(langCode: string, prefix: string): Promise<FrequencyEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as FrequencyEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find frequency entries by term suffix (e.g. "ing" → "running", "walking")
 *  via backwardTerm index — reverse prefix search. */
export async function findFrequencyBySuffix(langCode: string, suffix: string): Promise<FrequencyEntry[]> {
  const db = await getDB(langCode);
  const reversedSuffix = reverseString(suffix);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_backwardTerm);
    const range = IDBKeyRange.bound(reversedSuffix, reversedSuffix + '\uffff', false, false);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as FrequencyEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Count frequency entries for a resource. */
export async function countFrequencyByResource(langCode: string, resourceId: number): Promise<number> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.count(resourceId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Delete all frequency entries for a resource (rollback cascade). */
export async function deleteFrequencyByResource(langCode: string, resourceId: number): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY);
    const index = store.index(INDEXES.by_resource);
    const cursorRequest = index.openCursor(resourceId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
