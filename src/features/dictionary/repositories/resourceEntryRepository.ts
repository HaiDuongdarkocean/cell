// resourceEntryRepository — CRUD + bulkInsert for the unified entry store
// (langDictionaryEntry — unified-resource-import spec).
//
// One store holds both row kinds: dictionary rows (kind absent) and frequency
// rows (`kind: 'freq'`). Dict queries filter `kind !== 'freq'`, freq queries
// filter `kind === 'freq'`; shared indexes (by_term/by_backwardTerm/
// by_resource) serve both. Resource-scoped deletes/counts cover all kinds.

import { getDB, getStore, STORES, INDEXES, reverseString } from './baseRepository';
import type {
  DictionaryEntry,
  FrequencyEntry,
  StoredDictionaryEntry,
  StoredFrequencyEntry,
  StoredResourceEntry,
} from '@/entities/dictionary';

const isFreqRow = (v: StoredResourceEntry): v is StoredFrequencyEntry => 'kind' in v && v.kind === 'freq';
const isDictRow = (v: StoredResourceEntry): v is StoredDictionaryEntry => !isFreqRow(v);

const toWireFreq = ({ kind: _kind, backwardTerm: _bt, ...entry }: StoredFrequencyEntry): FrequencyEntry => entry;
const toWireDict = ({ backwardTerm: _bt, ...entry }: StoredDictionaryEntry): DictionaryEntry => entry as DictionaryEntry;

/** Add a single dictionary entry. Returns auto-generated id. */
export async function addDictionaryEntry(langCode: string, entry: Omit<DictionaryEntry, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  const stored: StoredDictionaryEntry = { ...entry, backwardTerm: reverseString(entry.term) };
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY);
    const request = store.add(stored);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Add a single frequency entry. Returns auto-generated id. */
export async function addFrequencyEntry(langCode: string, entry: Omit<FrequencyEntry, 'id'>): Promise<number> {
  const db = await getDB(langCode);
  const stored: StoredFrequencyEntry = { ...entry, kind: 'freq', backwardTerm: reverseString(entry.term) };
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY);
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
    const store = getStore(db, STORES.ENTRY);
    for (const entry of entries) {
      store.add({ ...entry, backwardTerm: reverseString(entry.term) });
    }
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Bulk insert frequency entries — each row stamped `kind: 'freq'`. */
export async function bulkInsertFrequencyEntries(
  langCode: string,
  entries: ReadonlyArray<Omit<FrequencyEntry, 'id'>>,
): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY);
    for (const entry of entries) {
      store.add({ ...entry, kind: 'freq', backwardTerm: reverseString(entry.term) });
    }
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Collect rows for a resource of one kind via the by_resource index. */
async function findByResource<T extends StoredResourceEntry>(
  langCode: string,
  resourceId: number,
  keep: (v: StoredResourceEntry) => v is T,
): Promise<T[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.getAll(resourceId);
    request.onsuccess = () => resolve((request.result as StoredResourceEntry[]).filter(keep));
    request.onerror = () => reject(request.error);
  });
}

/** Collect rows for an index value of one kind. */
async function findByIndex<T extends StoredResourceEntry>(
  langCode: string,
  indexName: string,
  range: IDBValidKey | IDBKeyRange,
  keep: (v: StoredResourceEntry) => v is T,
): Promise<T[]> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const request = store.index(indexName).getAll(range);
    request.onsuccess = () => resolve((request.result as StoredResourceEntry[]).filter(keep));
    request.onerror = () => reject(request.error);
  });
}

/** Find all dictionary entries for a resource. */
export async function findDictionaryByResource(langCode: string, resourceId: number): Promise<DictionaryEntry[]> {
  return (await findByResource(langCode, resourceId, isDictRow)).map(toWireDict);
}

/** Find all frequency entries for a resource. */
export async function findFrequencyByResource(langCode: string, resourceId: number): Promise<FrequencyEntry[]> {
  return (await findByResource(langCode, resourceId, isFreqRow)).map(toWireFreq);
}

/** Find dictionary entries by exact term match. */
export async function findDictionaryByTerm(langCode: string, term: string): Promise<DictionaryEntry[]> {
  return (await findByIndex(langCode, INDEXES.by_term, term, isDictRow)).map(toWireDict);
}

/** Find frequency entries by exact term match. */
export async function findFrequencyByTerm(langCode: string, term: string): Promise<FrequencyEntry[]> {
  return (await findByIndex(langCode, INDEXES.by_term, term, isFreqRow)).map(toWireFreq);
}

/** Find dictionary entries by term prefix. */
export async function findDictionaryByPrefix(langCode: string, prefix: string): Promise<DictionaryEntry[]> {
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
  return (await findByIndex(langCode, INDEXES.by_term, range, isDictRow)).map(toWireDict);
}

/** Find frequency entries by term prefix. */
export async function findFrequencyByPrefix(langCode: string, prefix: string): Promise<FrequencyEntry[]> {
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
  return (await findByIndex(langCode, INDEXES.by_term, range, isFreqRow)).map(toWireFreq);
}

/** Find dictionary entries by term suffix (via backwardTerm index). */
export async function findDictionaryBySuffix(langCode: string, suffix: string): Promise<DictionaryEntry[]> {
  const reversed = reverseString(suffix);
  const range = IDBKeyRange.bound(reversed, reversed + '\uffff', false, false);
  return (await findByIndex(langCode, INDEXES.by_backwardTerm, range, isDictRow)).map(toWireDict);
}

/** Find frequency entries by term suffix (via backwardTerm index). */
export async function findFrequencyBySuffix(langCode: string, suffix: string): Promise<FrequencyEntry[]> {
  const reversed = reverseString(suffix);
  const range = IDBKeyRange.bound(reversed, reversed + '\uffff', false, false);
  return (await findByIndex(langCode, INDEXES.by_backwardTerm, range, isFreqRow)).map(toWireFreq);
}

/** Find frequency entries for multiple exact terms in a single bounded cursor
 *  pass — the hot lookup path (FREQUENCY_GET). Rows without `kind: 'freq'`
 *  are skipped; wire shape excludes internal fields. `resourceIds` optionally
 *  restricts to enabled frequency resources. */
export async function findFrequencyByTerms(
  langCode: string,
  terms: readonly string[],
  resourceIds?: ReadonlySet<number>,
): Promise<Map<string, FrequencyEntry[]>> {
  const result = new Map<string, FrequencyEntry[]>();
  if (terms.length === 0) return result;

  const sortedTerms = [...terms].sort();
  for (const term of terms) {
    result.set(term, []);
  }

  const db = await getDB(langCode);
  const tx = db.transaction(STORES.ENTRY, 'readonly');
  const index = tx.objectStore(STORES.ENTRY).index(INDEXES.by_term);
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
        const value = cursor.value as StoredResourceEntry;
        if (isFreqRow(value) && (!resourceIds || resourceIds.has(value.resourceId))) {
          const entries = result.get(key) ?? [];
          entries.push(toWireFreq(value));
          result.set(key, entries);
        }
        cursor.continue();
      } else {
        // key is between two requested terms; jump to the next requested term.
        cursor.continue(sortedTerms[termIndex]);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Find dictionary entries for multiple exact terms in a single bounded cursor
 *  pass (READINGS_GET). Same skip-ahead walk as findFrequencyByTerms; rows
 *  without `kind: 'dict'` are skipped. `resourceIds` optionally restricts to
 *  eligible dictionary resources. */
export async function findDictionaryByTerms(
  langCode: string,
  terms: readonly string[],
  resourceIds?: ReadonlySet<number>,
): Promise<Map<string, DictionaryEntry[]>> {
  const result = new Map<string, DictionaryEntry[]>();
  if (terms.length === 0) return result;

  const sortedTerms = [...terms].sort();
  for (const term of terms) {
    result.set(term, []);
  }

  const db = await getDB(langCode);
  const tx = db.transaction(STORES.ENTRY, 'readonly');
  const index = tx.objectStore(STORES.ENTRY).index(INDEXES.by_term);
  const lower = sortedTerms[0];
  const upper = sortedTerms[sortedTerms.length - 1] + '￿';

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
      while (termIndex < sortedTerms.length && sortedTerms[termIndex] < key) {
        termIndex++;
      }
      if (termIndex >= sortedTerms.length) {
        resolve(result);
        return;
      }

      if (sortedTerms[termIndex] === key) {
        const value = cursor.value as StoredResourceEntry;
        if (isDictRow(value) && (!resourceIds || resourceIds.has(value.resourceId))) {
          const entries = result.get(key) ?? [];
          entries.push(toWireDict(value));
          result.set(key, entries);
        }
        cursor.continue();
      } else {
        cursor.continue(sortedTerms[termIndex]);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Sample the first N rows of one kind for a resource via cursor. */
async function sampleEntries<T extends StoredResourceEntry>(
  langCode: string,
  resourceId: number,
  limit: number,
  keep: (v: StoredResourceEntry) => v is T,
  toWire: (v: T) => DictionaryEntry | FrequencyEntry,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    const request = index.openCursor(resourceId);
    const results: Array<DictionaryEntry | FrequencyEntry> = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        const value = cursor.value as StoredResourceEntry;
        if (keep(value)) results.push(toWire(value));
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/** Sample the first N dictionary entries for a resource. */
export async function sampleDictionaryEntries(langCode: string, resourceId: number, limit: number): Promise<DictionaryEntry[]> {
  return (await sampleEntries(langCode, resourceId, limit, isDictRow, toWireDict)) as DictionaryEntry[];
}

/** Sample the first N frequency entries for a resource. */
export async function sampleFrequencyEntries(langCode: string, resourceId: number, limit: number): Promise<FrequencyEntry[]> {
  return (await sampleEntries(langCode, resourceId, limit, isFreqRow, toWireFreq)) as FrequencyEntry[];
}

/** Find a row of one kind by exact term within a single resource. */
async function findEntry<T extends StoredResourceEntry>(
  langCode: string,
  resourceId: number,
  term: string,
  keep: (v: StoredResourceEntry) => v is T,
  toWire: (v: T) => DictionaryEntry | FrequencyEntry,
): Promise<DictionaryEntry | FrequencyEntry | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const index = store.index(INDEXES.by_term);
    const request = index.openCursor(term);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(undefined);
        return;
      }
      const value = cursor.value as StoredResourceEntry;
      if (keep(value) && value.resourceId === resourceId) {
        resolve(toWire(value));
        return;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Find a dictionary entry by exact term within a single resource. */
export async function findDictionaryEntry(langCode: string, resourceId: number, term: string): Promise<DictionaryEntry | undefined> {
  return (await findEntry(langCode, resourceId, term, isDictRow, toWireDict)) as DictionaryEntry | undefined;
}

/** Find a frequency entry by exact term within a single resource. */
export async function findFrequencyEntry(langCode: string, resourceId: number, term: string): Promise<FrequencyEntry | undefined> {
  return (await findEntry(langCode, resourceId, term, isFreqRow, toWireFreq)) as FrequencyEntry | undefined;
}

/** Count rows of one kind for a resource (cursor — indexes can't filter kind). */
async function countByResource(
  langCode: string,
  resourceId: number,
  keep?: (v: StoredResourceEntry) => boolean,
): Promise<number> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const index = store.index(INDEXES.by_resource);
    if (!keep) {
      const request = index.count(resourceId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      return;
    }
    let n = 0;
    const request = index.openCursor(resourceId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(n);
        return;
      }
      if (keep(cursor.value as StoredResourceEntry)) n += 1;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Count dictionary entries for a resource. */
export async function countDictionaryByResource(langCode: string, resourceId: number): Promise<number> {
  return countByResource(langCode, resourceId, isDictRow);
}

/** Count frequency entries for a resource. */
export async function countFrequencyByResource(langCode: string, resourceId: number): Promise<number> {
  return countByResource(langCode, resourceId, isFreqRow);
}

/** Count all rows (any kind) for a resource. */
export async function countEntriesByResource(langCode: string, resourceId: number): Promise<number> {
  return countByResource(langCode, resourceId);
}

/** True when primary keys form one unbroken autoincrement run. */
export function isContiguousKeys(keys: readonly IDBValidKey[]): boolean {
  const first = keys[0];
  if (typeof first !== 'number') return false;
  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i] !== first + i) return false;
  }
  return true;
}

/** Delete all rows (any kind) for a resource — resource removal / replace-import
 *  rollback cascade. One import's rows sit on contiguous autoincrement keys, so a
 *  contiguous run deletes via a single IDBKeyRange; interleaved keys (concurrent
 *  import) fall back to the per-row cursor. */
export async function deleteEntriesByResource(
  langCode: string,
  resourceId: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY);
    const index = store.index(INDEXES.by_resource);
    const tx = store.transaction;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    const keysRequest = index.getAllKeys(resourceId);
    keysRequest.onsuccess = () => {
      const keys = keysRequest.result;
      if (keys.length > 0) {
        try {
          onProgress?.(0, keys.length);
        } catch {}
      }
      if (isContiguousKeys(keys)) {
        const deleteRequest = store.delete(IDBKeyRange.bound(keys[0], keys[keys.length - 1]));
        deleteRequest.onsuccess = () => onProgress?.(keys.length, keys.length);
        return;
      }
      const total = keys.length;
      let deleted = 0;
      const cursorRequest = index.openCursor(resourceId);
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          deleted += 1;
          if (deleted === total || deleted % 512 === 0) onProgress?.(deleted, total);
          cursor.continue();
        }
      };
    };
  });
}
