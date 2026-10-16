// resourceEntryRepository — CRUD + bulkInsert for the unified entry store
// (langDictionaryEntry — unified-resource-import spec).
//
// One store holds both row kinds: dictionary rows (kind absent) and frequency
// rows (`kind: 'freq'`). Dict queries filter `kind !== 'freq'`, freq queries
// filter `kind === 'freq'`; shared indexes (by_term/by_backwardTerm/
// by_resource) serve both. Resource-scoped deletes/counts cover all kinds.

import { getEntryDB, getStore, entryDBs, STORES, INDEXES, reverseString, deleteRowsByIndex } from './baseRepository';
import {
  blobEntriesForResource,
  blobFindByPrefix,
  blobFindBySuffix,
  blobFindByTerm,
  blobFindByTerms,
  blobFindEntry,
  blobCountsForResource,
  blobSampleForResource,
  blobTermsForResource,
  deleteEntryBlobArtifacts,
  getEntryBlobMeta,
  getEntryBlobMetas,
} from './entryBlobStore';
import type { EntryBlobMeta } from './entryBlobStore';
import type {
  DictionaryEntry,
  FrequencyEntry,
  StoredDictionaryEntry,
  StoredFrequencyEntry,
  StoredResourceEntry,
} from '@/entities/dictionary';

const isFreqRow = (v: StoredResourceEntry): v is StoredFrequencyEntry => 'kind' in v && v.kind === 'freq';
const isDictRow = (v: StoredResourceEntry): v is StoredDictionaryEntry => !isFreqRow(v);

/** Allowed resources that still read staged ENTRY rows (no meta record).
 *  When the caller's allowed set is fully blob-backed the ENTRY read txn is
 *  skipped — it could only queue behind bulk import writes and yield rows the
 *  caller would filter out anyway. */
const rowScanUseful = (metas: Map<number, EntryBlobMeta>, resourceIds?: ReadonlySet<number>): boolean =>
  resourceIds === undefined || [...resourceIds].some((id) => !metas.has(id));

const toWireFreq = ({ kind: _kind, backwardTerm: _bt, ...entry }: StoredFrequencyEntry): FrequencyEntry => entry;
const toWireDict = ({ backwardTerm: _bt, ...entry }: StoredDictionaryEntry): DictionaryEntry => entry as DictionaryEntry;

/** Add a single dictionary entry. Returns auto-generated id. */
export async function addDictionaryEntry(langCode: string, entry: Omit<DictionaryEntry, 'id'>): Promise<number> {
  const db = await getEntryDB(langCode);
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
  const db = await getEntryDB(langCode);
  const stored: StoredFrequencyEntry = { ...entry, kind: 'freq', backwardTerm: reverseString(entry.term) };
  return new Promise((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY);
    const request = store.add(stored);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/** Bulk insert dictionary entries (1 transaction per batch — ADR-023 D8).
 *  durability:'relaxed' — a failed flush is recoverable by re-importing, so
 *  skip the per-tx fsync to keep staged writes cheap. */
export async function bulkInsertDictionaryEntries(
  langCode: string,
  entries: ReadonlyArray<Omit<DictionaryEntry, 'id'>>,
): Promise<void> {
  const db = await getEntryDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY, 'readwrite', { durability: 'relaxed' });
    const store = tx.objectStore(STORES.ENTRY);
    for (const entry of entries) {
      store.add({ ...entry, backwardTerm: reverseString(entry.term) });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.commit();
  });
}

/** Bulk insert frequency entries — each row stamped `kind: 'freq'`. */
export async function bulkInsertFrequencyEntries(
  langCode: string,
  entries: ReadonlyArray<Omit<FrequencyEntry, 'id'>>,
): Promise<void> {
  const db = await getEntryDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY, 'readwrite', { durability: 'relaxed' });
    const store = tx.objectStore(STORES.ENTRY);
    for (const entry of entries) {
      store.add({ ...entry, kind: 'freq', backwardTerm: reverseString(entry.term) });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    tx.commit();
  });
}

/** Collect rows for a resource of one kind via the by_resource index.
 *  Scans the ingest DB then the main DB — a resource's staged rows live in
 *  exactly one of them (bulk inserts are sequential per import). */
async function findByResource<T extends StoredResourceEntry>(
  langCode: string,
  resourceId: number,
  keep: (v: StoredResourceEntry) => v is T,
): Promise<T[]> {
  const dbs = await entryDBs(langCode);
  const rows = await Promise.all(dbs.map((db) => new Promise<StoredResourceEntry[]>((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const request = store.index(INDEXES.by_resource).getAll(resourceId);
    request.onsuccess = () => resolve(request.result as StoredResourceEntry[]);
    request.onerror = () => reject(request.error);
  })));
  return rows.flat().filter(keep);
}

/** Collect rows for an index value of one kind — ingest + main scan. */
async function findByIndex<T extends StoredResourceEntry>(
  langCode: string,
  indexName: string,
  range: IDBValidKey | IDBKeyRange,
  keep: (v: StoredResourceEntry) => v is T,
): Promise<T[]> {
  const dbs = await entryDBs(langCode);
  const rows = await Promise.all(dbs.map((db) => new Promise<StoredResourceEntry[]>((resolve, reject) => {
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const request = store.index(indexName).getAll(range);
    request.onsuccess = () => resolve(request.result as StoredResourceEntry[]);
    request.onerror = () => reject(request.error);
  })));
  return rows.flat().filter(keep);
}

/** Find all dictionary entries for a resource. Blob-backed resources decode
 *  chunk-by-chunk (bounded memory); row-backed resources read the live store. */
export async function findDictionaryByResource(langCode: string, resourceId: number): Promise<DictionaryEntry[]> {
  const blobbed = await blobEntriesForResource(langCode, resourceId, 'dict');
  if (blobbed) return blobbed as DictionaryEntry[];
  return (await findByResource(langCode, resourceId, isDictRow)).map(toWireDict);
}

/** Stream only the `term` field of dictionary rows — the cursor steps one row
 *  per task so a 100k+ scan never blocks the event loop the way getAll's
 *  single materialized clone does. Blob-backed resources read the terms
 *  record directly. */
export async function findDictionaryTermsByResource(langCode: string, resourceId: number): Promise<string[]> {
  const blobTerms = await blobTermsForResource(langCode, resourceId, 'dict');
  if (blobTerms) return blobTerms;
  const dbs = await entryDBs(langCode);
  const perDb = await Promise.all(dbs.map((db) => new Promise<string[]>((resolve, reject) => {
    const terms: string[] = [];
    const store = getStore(db, STORES.ENTRY, 'readonly');
    const request = store.index(INDEXES.by_resource).openCursor(resourceId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(terms);
        return;
      }
      const v = cursor.value as StoredResourceEntry;
      if (isDictRow(v)) terms.push(v.term);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  })));
  return perDb.flat();
}

/** Find all frequency entries for a resource. */
export async function findFrequencyByResource(langCode: string, resourceId: number): Promise<FrequencyEntry[]> {
  const blobbed = await blobEntriesForResource(langCode, resourceId, 'freq');
  if (blobbed) return blobbed as FrequencyEntry[];
  return (await findByResource(langCode, resourceId, isFreqRow)).map(toWireFreq);
}

/** Rows whose resource still lives in the row store — blob-backed resources
 *  keep stale staged rows out of merged results. */
const notBlobbed = (metas: Map<number, unknown>) =>
  (e: { resourceId: number }): boolean => !metas.has(e.resourceId);

/** Find dictionary entries by exact term match — blob chunks + live rows. */
export async function findDictionaryByTerm(
  langCode: string,
  term: string,
  resourceIds?: ReadonlySet<number>,
): Promise<DictionaryEntry[]> {
  const metas = await getEntryBlobMetas(langCode);
  const rows = rowScanUseful(metas, resourceIds)
    ? (await findByIndex(langCode, INDEXES.by_term, term, isDictRow))
      .filter(notBlobbed(metas)).map(toWireDict)
    : [];
  const blobbed = await blobFindByTerm(langCode, term, 'dict');
  return [...rows, ...blobbed as DictionaryEntry[]];
}

/** Find frequency entries by exact term match — blob chunks + live rows. */
export async function findFrequencyByTerm(
  langCode: string,
  term: string,
  resourceIds?: ReadonlySet<number>,
): Promise<FrequencyEntry[]> {
  const metas = await getEntryBlobMetas(langCode);
  const rows = rowScanUseful(metas, resourceIds)
    ? (await findByIndex(langCode, INDEXES.by_term, term, isFreqRow))
      .filter(notBlobbed(metas)).map(toWireFreq)
    : [];
  const blobbed = await blobFindByTerm(langCode, term, 'freq');
  return [...rows, ...blobbed as FrequencyEntry[]];
}

/** Find dictionary entries by term prefix. */
export async function findDictionaryByPrefix(langCode: string, prefix: string): Promise<DictionaryEntry[]> {
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
  const metas = await getEntryBlobMetas(langCode);
  const rows = (await findByIndex(langCode, INDEXES.by_term, range, isDictRow))
    .filter(notBlobbed(metas)).map(toWireDict);
  const blobbed = await blobFindByPrefix(langCode, prefix, 'dict');
  return [...rows, ...blobbed as DictionaryEntry[]];
}

/** Find frequency entries by term prefix. */
export async function findFrequencyByPrefix(langCode: string, prefix: string): Promise<FrequencyEntry[]> {
  const range = IDBKeyRange.bound(prefix, prefix + '\uffff', false, false);
  const metas = await getEntryBlobMetas(langCode);
  const rows = (await findByIndex(langCode, INDEXES.by_term, range, isFreqRow))
    .filter(notBlobbed(metas)).map(toWireFreq);
  const blobbed = await blobFindByPrefix(langCode, prefix, 'freq');
  return [...rows, ...blobbed as FrequencyEntry[]];
}

/** Find dictionary entries by term suffix (via backwardTerm index). */
export async function findDictionaryBySuffix(langCode: string, suffix: string): Promise<DictionaryEntry[]> {
  const reversed = reverseString(suffix);
  const range = IDBKeyRange.bound(reversed, reversed + '\uffff', false, false);
  const metas = await getEntryBlobMetas(langCode);
  const rows = (await findByIndex(langCode, INDEXES.by_backwardTerm, range, isDictRow))
    .filter(notBlobbed(metas)).map(toWireDict);
  const blobbed = await blobFindBySuffix(langCode, suffix, 'dict');
  return [...rows, ...blobbed as DictionaryEntry[]];
}

/** Find frequency entries by term suffix (via backwardTerm index). */
export async function findFrequencyBySuffix(langCode: string, suffix: string): Promise<FrequencyEntry[]> {
  const reversed = reverseString(suffix);
  const range = IDBKeyRange.bound(reversed, reversed + '\uffff', false, false);
  const metas = await getEntryBlobMetas(langCode);
  const rows = (await findByIndex(langCode, INDEXES.by_backwardTerm, range, isFreqRow))
    .filter(notBlobbed(metas)).map(toWireFreq);
  const blobbed = await blobFindBySuffix(langCode, suffix, 'freq');
  return [...rows, ...blobbed as FrequencyEntry[]];
}

/** Bounded skip-ahead cursor over by_term on one entry database (ingest or
 *  legacy main) — shared by the plural-term readers which scan both. */
async function scanTermsCursor<S extends StoredResourceEntry, T>(
  db: IDBDatabase,
  sortedTerms: readonly string[],
  result: Map<string, T[]>,
  metas: Map<number, EntryBlobMeta>,
  resourceIds: ReadonlySet<number> | undefined,
  keep: (v: StoredResourceEntry) => v is S,
  toWire: (v: S) => T,
): Promise<void> {
  // Per-term getAll requests pipelined per ≤64-term batch — one monolithic
  // burst serializes ~500 onsuccess callbacks on the SW thread and starves a
  // concurrent meta lookup (~2s observed on Wikipedia).
  const unique = [...new Set(sortedTerms)];
  for (let start = 0; start < unique.length; start += 64) {
    const slice = unique.slice(start, start + 64);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRY, 'readonly');
      const index = tx.objectStore(STORES.ENTRY).index(INDEXES.by_term);
      let pending = slice.length;
      for (const term of slice) {
        const request = index.getAll(term);
        request.onsuccess = () => {
          for (const value of request.result as StoredResourceEntry[]) {
            if (keep(value) && !metas.has(value.resourceId) && (!resourceIds || resourceIds.has(value.resourceId))) {
              const entries = result.get(term) ?? [];
              entries.push(toWire(value));
              result.set(term, entries);
            }
          }
          if (--pending === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      }
    });
    if (start + 64 < unique.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
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

  const metas = await getEntryBlobMetas(langCode);
  const sortedTerms = [...terms].sort();
  for (const term of terms) {
    result.set(term, []);
  }

  let rows = result;
  if (rowScanUseful(metas, resourceIds)) {
    for (const db of await entryDBs(langCode)) {
      await scanTermsCursor(db, sortedTerms, result, metas, resourceIds, isFreqRow, toWireFreq);
    }
  }

  const blobbed = await blobFindByTerms(langCode, terms, 'freq', resourceIds);
  for (const [term, entries] of blobbed) {
    rows.set(term, [...(rows.get(term) ?? []), ...entries as FrequencyEntry[]]);
  }
  return rows;
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

  const metas = await getEntryBlobMetas(langCode);
  const sortedTerms = [...terms].sort();
  for (const term of terms) {
    result.set(term, []);
  }

  let rows = result;
  if (rowScanUseful(metas, resourceIds)) {
    for (const db of await entryDBs(langCode)) {
      await scanTermsCursor(db, sortedTerms, result, metas, resourceIds, isDictRow, toWireDict);
    }
  }

  const blobbed = await blobFindByTerms(langCode, terms, 'dict', resourceIds);
  for (const [term, entries] of blobbed) {
    rows.set(term, [...(rows.get(term) ?? []), ...entries as DictionaryEntry[]]);
  }
  return rows;
}

/** Sample the first N rows of one kind for a resource via cursor —
 *  ingest DB first, topped up from legacy main rows. */
async function sampleEntries<T extends StoredResourceEntry>(
  langCode: string,
  resourceId: number,
  limit: number,
  keep: (v: StoredResourceEntry) => v is T,
  toWire: (v: T) => DictionaryEntry | FrequencyEntry,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const results: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const db of await entryDBs(langCode)) {
    if (results.length >= limit) break;
    await new Promise<void>((resolve, reject) => {
      const store = getStore(db, STORES.ENTRY, 'readonly');
      const index = store.index(INDEXES.by_resource);
      const request = index.openCursor(resourceId);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          const value = cursor.value as StoredResourceEntry;
          if (keep(value)) results.push(toWire(value));
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
  return results;
}

/** Sample the first N dictionary entries for a resource. */
export async function sampleDictionaryEntries(langCode: string, resourceId: number, limit: number): Promise<DictionaryEntry[]> {
  const blobbed = await blobSampleForResource(langCode, resourceId, 'dict', limit);
  if (blobbed) return blobbed as DictionaryEntry[];
  return (await sampleEntries(langCode, resourceId, limit, isDictRow, toWireDict)) as DictionaryEntry[];
}

/** Sample the first N frequency entries for a resource. */
export async function sampleFrequencyEntries(langCode: string, resourceId: number, limit: number): Promise<FrequencyEntry[]> {
  const blobbed = await blobSampleForResource(langCode, resourceId, 'freq', limit);
  if (blobbed) return blobbed as FrequencyEntry[];
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
  for (const db of await entryDBs(langCode)) {
    const hit = await new Promise<DictionaryEntry | FrequencyEntry | undefined>((resolve, reject) => {
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
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Find a dictionary entry by exact term within a single resource. */
export async function findDictionaryEntry(langCode: string, resourceId: number, term: string): Promise<DictionaryEntry | undefined> {
  const meta = await getEntryBlobMeta(langCode, resourceId);
  if (meta) {
    return (await blobFindEntry(langCode, meta, term, 'dict'))[0] as DictionaryEntry | undefined;
  }
  return (await findEntry(langCode, resourceId, term, isDictRow, toWireDict)) as DictionaryEntry | undefined;
}

/** Find a frequency entry by exact term within a single resource. */
export async function findFrequencyEntry(langCode: string, resourceId: number, term: string): Promise<FrequencyEntry | undefined> {
  const meta = await getEntryBlobMeta(langCode, resourceId);
  if (meta) {
    return (await blobFindEntry(langCode, meta, term, 'freq'))[0] as FrequencyEntry | undefined;
  }
  return (await findEntry(langCode, resourceId, term, isFreqRow, toWireFreq)) as FrequencyEntry | undefined;
}

/** Count rows of one kind for a resource (cursor — indexes can't filter kind). */
async function countByResource(
  langCode: string,
  resourceId: number,
  keep?: (v: StoredResourceEntry) => boolean,
): Promise<number> {
  const dbs = await entryDBs(langCode);
  const counts = await Promise.all(dbs.map((db) => new Promise<number>((resolve, reject) => {
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
  })));
  return counts.reduce((a, b) => a + b, 0);
}

/** Count dictionary entries for a resource. */
export async function countDictionaryByResource(langCode: string, resourceId: number): Promise<number> {
  const counts = await blobCountsForResource(langCode, resourceId);
  if (counts) return counts.dict;
  return countByResource(langCode, resourceId, isDictRow);
}

/** Count frequency entries for a resource. */
export async function countFrequencyByResource(langCode: string, resourceId: number): Promise<number> {
  const counts = await blobCountsForResource(langCode, resourceId);
  if (counts) return counts.freq;
  return countByResource(langCode, resourceId, isFreqRow);
}

/** Count all rows (any kind) for a resource. */
export async function countEntriesByResource(langCode: string, resourceId: number): Promise<number> {
  const counts = await blobCountsForResource(langCode, resourceId);
  if (counts) return counts.dict + counts.freq;
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
 *  rollback cascade. Chunks run in separate transactions — a mid-delete failure
 *  leaves earlier chunks applied, same atomicity as before across stores
 *  (entries → phraseIndex → resource). */
export async function deleteEntriesByResource(
  langCode: string,
  resourceId: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  await deleteEntryBlobArtifacts(langCode, resourceId);
  const dbs = await entryDBs(langCode);
  const spans = await Promise.all(dbs.map(async (db) => {
    const index = getStore(db, STORES.ENTRY, 'readonly').index(INDEXES.by_resource);
    const probe = (dir: IDBCursorDirection) => new Promise<number>((resolve, reject) => {
      const request = index.openKeyCursor(IDBKeyRange.only(resourceId), dir);
      request.onsuccess = () => {
        const pk = request.result?.primaryKey;
        resolve(typeof pk === 'number' ? pk : NaN);
      };
      request.onerror = () => reject(request.error);
    });
    const [first, last] = await Promise.all([probe('next'), probe('prev')]);
    return Number.isNaN(first) || Number.isNaN(last) ? 0 : last - first + 1;
  }));
  const grand = Math.max(1, spans[0]! + spans[1]!);
  let done = 0;
  for (const db of dbs) {
    await deleteRowsByIndex(db, STORES.ENTRY, INDEXES.by_resource_term, resourceId,
      onProgress && ((d, _t) => onProgress(Math.min(done + d, grand), grand)));
    done += spans[dbs.indexOf(db)]!;
  }
}
