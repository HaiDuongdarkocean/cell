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

/** Find frequency entries for multiple exact terms in a single cursor pass. */
export async function findFrequencyByTerms(
  langCode: string,
  terms: readonly string[],
): Promise<Map<string, FrequencyEntry[]>> {
  const result = new Map<string, FrequencyEntry[]>();
  if (terms.length === 0) return result;

  const sortedTerms = [...terms].sort();
  for (const term of terms) {
    result.set(term, []);
  }

  const db = await getDB(langCode);
  const tx = db.transaction(STORES.FREQUENCY, 'readonly');
  const index = tx.objectStore(STORES.FREQUENCY).index(INDEXES.by_term);
  const lower = sortedTerms[0];
  const upper = sortedTerms[sortedTerms.length - 1] + '\uffff';

  return new Promise((resolve, reject) => {
    let termIndex = 0;
    const request = index.openCursor(IDBKeyRange.bound(lower, upper, false, false));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(result);
        return;
      }

      const key = cursor.key as string;
      // Skip requested terms the cursor has already passed (no entries for them).
      while (termIndex < sortedTerms.length && sortedTerms[termIndex] < key) {
        termIndex++;
      }
      if (termIndex >= sortedTerms.length) {
        resolve(result);
        return;
      }

      if (sortedTerms[termIndex] === key) {
        const entries = result.get(key) ?? [];
        entries.push(cursor.value as FrequencyEntry);
        result.set(key, entries);
        cursor.continue();
      } else {
        // key is between two requested terms; jump to the next requested term.
        cursor.continue(sortedTerms[termIndex]);
      }
    };
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

/** Sample the first N frequency entries for a resource via cursor over the resourceId index. */
export async function sampleFrequencyEntries(langCode: string, resourceId: number, limit: number): Promise<FrequencyEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.openCursor(resourceId);
    const results: FrequencyEntry[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        const { backwardTerm, ...entry } = cursor.value as StoredFrequencyEntry;
        results.push(entry as FrequencyEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Find a frequency entry by exact term match within a single resource. */
export async function findFrequencyEntry(langCode: string, resourceId: number, term: string): Promise<FrequencyEntry | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.FREQUENCY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const request = index.openCursor(term);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const value = cursor.value as StoredFrequencyEntry;
      if (value.resourceId === resourceId) {
        const { backwardTerm, ...entry } = value;
        resolve(entry as FrequencyEntry);
        return;
      }
      cursor.continue();
    };
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
