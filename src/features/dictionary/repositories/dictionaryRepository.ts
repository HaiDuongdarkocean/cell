// dictionaryRepository — CRUD + bulkInsert cho langDictionaryEntry (ADR-023 D1).
//
// Same pattern as frequencyRepository but with rich fields (definition, pos,
// examples, audio). Methods mirror frequency repo.

import { getDB, getStore, STORES, INDEXES, reverseString } from './baseRepository';
import type { DictionaryEntry } from '@/entities/dictionary';

/** Internal stored entry — adds backwardTerm for suffix index. */
interface StoredDictionaryEntry extends Omit<DictionaryEntry, 'id'> {
  readonly backwardTerm: string;
  id?: number;
}

/** Add a single dictionary entry. Returns auto-generated id. */
export async function addDictionaryEntry(langCode: string, entry: Omit<DictionaryEntry, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  const stored: StoredDictionaryEntry = { ...entry, backwardTerm: reverseString(entry.term) };
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY);
    const request = store.add(stored);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Bulk insert dictionary entries (1 transaction per batch — ADR-023 D8). */
export async function bulkInsertDictionaryEntries(
  langCode: string,
  entries: ReadonlyArray<Omit<DictionaryEntry, 'id'>>,
): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY);
    for (const entry of entries) {
      const stored: StoredDictionaryEntry = { ...entry, backwardTerm: reverseString(entry.term) };
      store.add(stored);
    }
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Find all dictionary entries for a resource. */
export async function findDictionaryByResource(langCode: string, resourceId: number): Promise<DictionaryEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.getAll(resourceId);
    request.onsuccess = () => resolve(request.result as DictionaryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find dictionary entries by exact term match. */
export async function findDictionaryByTerm(langCode: string, term: string): Promise<DictionaryEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const request = index.getAll(term);
    request.onsuccess = () => resolve(request.result as DictionaryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find dictionary entries by term prefix. */
export async function findDictionaryByPrefix(langCode: string, prefix: string): Promise<DictionaryEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as DictionaryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Find dictionary entries by term suffix (via backwardTerm index). */
export async function findDictionaryBySuffix(langCode: string, suffix: string): Promise<DictionaryEntry[]> {
  const db = await getDB(langCode);
  const reversedSuffix = reverseString(suffix);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_backwardTerm);
    const range = IDBKeyRange.bound(reversedSuffix, reversedSuffix + '\uffff', false, false);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result as DictionaryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/** Sample the first N dictionary entries for a resource via cursor over the resourceId index. */
export async function sampleDictionaryEntries(langCode: string, resourceId: number, limit: number): Promise<DictionaryEntry[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.openCursor(resourceId);
    const results: DictionaryEntry[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        const { backwardTerm, ...entry } = cursor.value as StoredDictionaryEntry;
        results.push(entry as DictionaryEntry);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Find a dictionary entry by exact term match within a single resource. */
export async function findDictionaryEntry(langCode: string, resourceId: number, term: string): Promise<DictionaryEntry | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const request = index.openCursor(term);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const value = cursor.value as StoredDictionaryEntry;
      if (value.resourceId === resourceId) {
        const { backwardTerm, ...entry } = value;
        resolve(entry as DictionaryEntry);
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Count dictionary entries for a resource. */
export async function countDictionaryByResource(langCode: string, resourceId: number): Promise<number> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.count(resourceId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Delete all dictionary entries for a resource (rollback cascade). */
export async function deleteDictionaryByResource(langCode: string, resourceId: number): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.DICTIONARY);
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
