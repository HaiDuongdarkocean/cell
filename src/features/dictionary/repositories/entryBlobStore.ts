// entryBlobStore — immutable term-sorted entry chunks per resource (ADR-118).
//
// WAL/LSM pattern translated to IDB: import writes rows to ENTRY (a staging
// target lookups never touch), then compileEntryBlob streams them through the
// by_resource_term index into sorted chunk records. The meta record written
// LAST is the commit point — its presence flips a resource's reads to the
// blob path. Bulk row writes therefore never serialize against lookups; the
// only live-store writes are ~256-entry chunk puts with an interleave gap.

import { getDB, entryDBs, STORES, INDEXES, reverseString, deleteRowsByIndex } from './baseRepository';
import { getAllResources } from './resourceRepository';
import type {
  DictionaryEntry,
  FrequencyEntry,
  StoredResourceEntry,
} from '@/entities/dictionary';

const CHUNK_SIZE = 256;
const TERMS_SEQ = -1;
/** seq layout: dict chunks 1+, TERMS -1, freq chunks -2↓ — 0 is free for a
 *  single-row snapshot of hot freq entries. One ~100ms get covers the common
 *  vocabulary; rare terms still resolve via per-chunk reads. */
const FREQ_SNAPSHOT_SEQ = 0;
const FREQ_HOT_CUTOFF = 20_000;
const GAP_MS = 32;
const CHUNK_CACHE_CAP = 8;
const BLOB_FORMAT_VERSION = 1;

export type EntryKindTag = 'dict' | 'freq';

export interface ChunkRange {
  readonly first: string;
  readonly last: string;
  readonly seq: number;
}

/** langEntryMeta record — exists ⟺ the resource is blob-backed. */
export interface EntryBlobMeta {
  readonly resourceId: number;
  readonly formatVersion: number;
  readonly dictRanges: readonly ChunkRange[];
  readonly freqRanges: readonly ChunkRange[];
  readonly dictCount: number;
  readonly freqCount: number;
}

interface StoredEntryChunk {
  readonly resourceId: number;
  readonly seq: number;
  readonly kind: EntryKindTag;
  readonly entries: ReadonlyArray<DictionaryEntry | FrequencyEntry>;
}

interface StoredTermsRecord {
  readonly resourceId: number;
  readonly seq: typeof TERMS_SEQ;
  readonly dictTerms: readonly string[];
  readonly freqTerms: readonly string[];
}

interface StoredBwdRow {
  readonly resourceId: number;
  readonly bterm: string;
  readonly term: string;
  readonly seq: number;
  readonly kind: EntryKindTag;
}

const gap = () => new Promise((r) => setTimeout(r, GAP_MS));

const isFreq = (v: StoredResourceEntry | DictionaryEntry | FrequencyEntry): v is StoredResourceEntry & { kind: 'freq' } =>
  'kind' in v && (v as { kind?: string }).kind === 'freq';

/* ------------------------------ compile ------------------------------ */

function putInTx(db: IDBDatabase, storeName: string, record: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite', { durability: 'relaxed' });
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function dropStagedRows(langCode: string, resourceId: number): Promise<void> {
  let first = true;
  for (const db of await entryDBs(langCode)) {
    if (!first) await gap();
    first = false;
    await deleteRowsByIndex(db, STORES.ENTRY, INDEXES.by_resource_term, resourceId);
  }
}

interface PendingChunk {
  readonly resourceId: number;
  readonly seq: number;
  readonly kind: EntryKindTag;
  readonly entries: ReadonlyArray<DictionaryEntry | FrequencyEntry>;
}

class ChunkBuilder {
  readonly ranges: ChunkRange[] = [];
  readonly terms: string[] = [];
  readonly bwd: StoredBwdRow[] = [];
  private entries: Array<DictionaryEntry | FrequencyEntry> = [];
  private seq: number;

  /** seq spaces never collide: dict chunks 1..N, freq chunks -2,-3,...
   *  (TERMS_SEQ=-1 is the terms record; key is [resourceId, seq]). */
  constructor(
    private readonly resourceId: number,
    private readonly kind: EntryKindTag,
    seqStart: number,
    private readonly seqStep: number,
  ) {
    this.seq = seqStart;
  }

  /** Push a row (already term-sorted by the cursor). When a chunk fills it is
   *  detached into `pending` — callers drain writes outside the read txn. */
  add(row: StoredResourceEntry, pending: PendingChunk[]): void {
    const { id: _id, backwardTerm: _bt, kind: _k, ...wire } = row as unknown as Record<string, unknown>;
    this.entries.push(wire as unknown as DictionaryEntry | FrequencyEntry);
    this.terms.push(row.term);
    if (this.entries.length >= CHUNK_SIZE) this.detach(pending);
  }

  detach(pending: PendingChunk[]): void {
    if (this.entries.length === 0) return;
    this.seq += this.seqStep;
    const entries = this.entries;
    this.entries = [];
    for (const e of entries) {
      this.bwd.push({
        resourceId: this.resourceId,
        bterm: reverseString(e.term),
        term: e.term,
        seq: this.seq,
        kind: this.kind,
      });
    }
    this.ranges.push({ first: entries[0]!.term, last: entries[entries.length - 1]!.term, seq: this.seq });
    pending.push({ resourceId: this.resourceId, seq: this.seq, kind: this.kind, entries });
  }
}

/** Write backward-term rows in bounded txns. */
async function writeBwdRows(db: IDBDatabase, rows: readonly StoredBwdRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 256) {
    const slice = rows.slice(i, i + 256);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRY_BWD, 'readwrite', { durability: 'relaxed' });
      const store = tx.objectStore(STORES.ENTRY_BWD);
      for (const r of slice) store.add(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    if (i + 256 < rows.length) await gap();
  }
}

/**
 * Compile a resource's staged ENTRY rows into the immutable blob artifacts:
 * chunks → terms record → bwd rows → meta (commit point) → staged-row delete.
 * Safe to re-run: chunks/bwd are fully rewritten before meta lands, and
 * artifact cleanup removes orphans from a crashed prior attempt.
 */
export async function compileEntryBlob(langCode: string, resourceId: number): Promise<EntryBlobMeta> {
  const db = await getDB(langCode);
  const dict = new ChunkBuilder(resourceId, 'dict', 0, 1);
  const freq = new ChunkBuilder(resourceId, 'freq', -1, -1);
  const pending: PendingChunk[] = [];

  // Page-wise getAll on the index: one request per PAGE rows (cursor.continue()
  // costs one macrotask per row — ~50k rows never finish under load). Resume by
  // re-entering at the last term inclusively and skipping rows whose pk <= the
  // last emitted pk (rows sharing a term are pk-ordered inside the index).
  // PAGE stays small: fat dictionary rows deserialize on the IDB backend —
  // ~512 rows ≈ 250-580ms, blocking every lookup read on the same database.
  const PAGE = 128;
  const drainBwd = async () => {
    if (dict.bwd.length + freq.bwd.length < 8192) return;
    await writeBwdRows(db, [...dict.bwd.splice(0), ...freq.bwd.splice(0)]);
  };
  // Staged rows can sit in the ingest DB (new imports) or the legacy main
  // DB (pre-split rows awaiting migration) — a resource's rows live in
  // exactly one, so scanning them sequentially preserves global term order.
  for (const srcDb of await entryDBs(langCode)) {
    let lowerBound: IDBValidKey = [resourceId];
    let boundaryTerm: string | null = null;
    let boundaryMaxPk = -1;
    let boundaryEmitted = 0;
    for (;;) {
      const limit = PAGE + boundaryEmitted;
      const rows = await new Promise<StoredResourceEntry[]>((resolve, reject) => {
        const tx = srcDb.transaction(STORES.ENTRY, 'readonly');
        const request = tx.objectStore(STORES.ENTRY)
          .index(INDEXES.by_resource_term)
          .getAll(IDBKeyRange.bound(lowerBound, [resourceId, []]), limit);
        request.onsuccess = () => resolve(request.result as StoredResourceEntry[]);
        request.onerror = () => reject(request.error);
      });
      if (rows.length === 0) break;
      let start = 0;
      if (boundaryTerm !== null) {
        while (
          start < rows.length
          && rows[start]!.term === boundaryTerm
          && (rows[start]!.id as number) <= boundaryMaxPk
        ) start++;
      }
      for (let i = start; i < rows.length; i++) {
        (isFreq(rows[i]!) ? freq : dict).add(rows[i]!, pending);
      }
      const last = rows[rows.length - 1]!;
      let trailing = 0;
      for (let i = rows.length - 1; i >= 0 && rows[i]!.term === last.term; i--) trailing++;
      boundaryTerm = last.term;
      boundaryMaxPk = last.id as number;
      boundaryEmitted = trailing;
      lowerBound = [resourceId, boundaryTerm];
      while (pending.length > 0) {
        const chunk = pending.shift()!;
        await putInTx(db, STORES.ENTRY_CHUNK, chunk);
        await drainBwd();
        await gap();
      }
      if (rows.length < limit) break;
      await gap();
    }
  }

  dict.detach(pending);
  freq.detach(pending);
  while (pending.length > 0) {
    const chunk = pending.shift()!;
    await putInTx(db, STORES.ENTRY_CHUNK, chunk);
    await drainBwd();
    await gap();
  }
  await putInTx(db, STORES.ENTRY_CHUNK, {
    resourceId,
    seq: TERMS_SEQ,
    dictTerms: dict.terms,
    freqTerms: freq.terms,
  } satisfies StoredTermsRecord);
  await gap();
  await writeBwdRows(db, [...dict.bwd.splice(0), ...freq.bwd.splice(0)]);
  const meta: EntryBlobMeta = {
    resourceId,
    formatVersion: BLOB_FORMAT_VERSION,
    dictRanges: dict.ranges,
    freqRanges: freq.ranges,
    dictCount: dict.terms.length,
    freqCount: freq.terms.length,
  };
  await putInTx(db, STORES.ENTRY_META, meta);
  freqTermIndex.delete(`${langCode}:${resourceId}`);
  await dropStagedRows(langCode, resourceId);
  return meta;
}

/** Delete all blob artifacts for a resource (resource delete / replace). */
export async function deleteEntryBlobArtifacts(langCode: string, resourceId: number): Promise<void> {
  const db = await getDB(langCode);
  // Chunk deletes paginate by key window — one txn for ~900 chunks is a
  // ~300ms commit that stalls lookups sharing the backing store.
  const CHUNK_WINDOW = 64;
  const chunkRange = IDBKeyRange.bound([resourceId, -Infinity], [resourceId, []]);
  for (;;) {
    const deleted = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRY_CHUNK, 'readwrite', { durability: 'relaxed' });
      const request = tx.objectStore(STORES.ENTRY_CHUNK).getAllKeys(chunkRange, CHUNK_WINDOW);
      request.onsuccess = () => {
        const keys = request.result;
        const store = tx.objectStore(STORES.ENTRY_CHUNK);
        for (const k of keys) store.delete(k);
      };
      tx.oncomplete = () => resolve(request.result.length);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    if (deleted < CHUNK_WINDOW) break;
    await gap();
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY_META, 'readwrite', { durability: 'relaxed' });
    tx.objectStore(STORES.ENTRY_META).delete(resourceId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  freqTermIndex.delete(`${langCode}:${resourceId}`);
  await deleteRowsByIndex(db, STORES.ENTRY_BWD, INDEXES.by_resource_bterm, resourceId);
}

/* ------------------------------- read -------------------------------- */

const chunkCache = new Map<string, ReadonlyArray<DictionaryEntry | FrequencyEntry>>();
const chunkCacheOrder: string[] = [];

/* Freq resources are small (tens of thousands of rank rows) — holding the
 * whole term→entries map in SW memory turns every flush lookup into Map hits
 * instead of hundreds of chunk deserializations (~500ms cold on Wikipedia).
 * The promise is cached so concurrent flushes share one build. */
const freqTermIndex = new Map<string, Promise<FreqIndex>>();

interface FreqIndex {
  readonly map: Map<string, FrequencyEntry[]>;
  /** true when the map holds only hot (rank ≤ cutoff) terms — a miss means
   *  "maybe in a chunk", not "absent". */
  readonly partial: boolean;
}

async function buildFreqTermIndex(
  db: IDBDatabase,
  meta: EntryBlobMeta,
): Promise<FreqIndex> {
  const snapshot = await loadChunk(db, meta.resourceId, FREQ_SNAPSHOT_SEQ);
  let entries: ReadonlyArray<DictionaryEntry | FrequencyEntry>;
  let partial = false;
  if (snapshot) {
    entries = snapshot.entries;
    partial = true;
  } else {
    const keys = rangesFor(meta, 'freq').map((r) => ({ resourceId: meta.resourceId, seq: r.seq }));
    const chunks = await loadChunks(db, keys);
    entries = chunks.flatMap((c) => c?.entries ?? []);
    void putInTx(db, STORES.ENTRY_CHUNK, {
      resourceId: meta.resourceId,
      seq: FREQ_SNAPSHOT_SEQ,
      kind: 'freq',
      entries: entries.filter((e) => (e as FrequencyEntry).frequency <= FREQ_HOT_CUTOFF),
    } satisfies StoredEntryChunk).catch(() => {});
  }
  const map = new Map<string, FrequencyEntry[]>();
  for (const e of entries) {
    const entry = e as FrequencyEntry;
    const list = map.get(entry.term) ?? [];
    list.push(entry);
    map.set(entry.term, list);
  }
  return { map, partial };
}

function freqIndexFor(
  langCode: string,
  db: IDBDatabase,
  meta: EntryBlobMeta,
): Promise<FreqIndex> {
  const key = `${langCode}:${meta.resourceId}`;
  let p = freqTermIndex.get(key);
  if (!p) {
    p = buildFreqTermIndex(db, meta);
    p.catch(() => freqTermIndex.delete(key));
    freqTermIndex.set(key, p);
  }
  return p;
}

/** Load every blob-backed freq resource's term index — fired from
 *  TOKENIZE_PING so the index is hot before the first tokenize flush. */
export async function prewarmFreqIndex(langCode: string): Promise<void> {
  const metas = await getEntryBlobMetas(langCode);
  const db = await getDB(langCode);
  await Promise.all(
    [...metas.values()]
      .filter((m) => rangesFor(m, 'freq').length > 0)
      .map((m) => freqIndexFor(langCode, db, m).then(() => undefined)),
  );
}

/** All blob metas for a lang — one small getAll; not cached so the meta
 *  commit point needs no invalidation bookkeeping (cheap: ≤1 row per dict). */
export async function getEntryBlobMetas(langCode: string): Promise<Map<number, EntryBlobMeta>> {
  const db = await getDB(langCode);
  const rows = await new Promise<EntryBlobMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY_META, 'readonly');
    const request = tx.objectStore(STORES.ENTRY_META).getAll();
    request.onsuccess = () => resolve(request.result as EntryBlobMeta[]);
    request.onerror = () => reject(request.error);
  });
  return new Map(rows.map((r) => [r.resourceId, r]));
}

/** Meta for one resource — undefined means row-backed. */
export async function getEntryBlobMeta(langCode: string, resourceId: number): Promise<EntryBlobMeta | undefined> {
  const db = await getDB(langCode);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY_META, 'readonly');
    const request = tx.objectStore(STORES.ENTRY_META).get(resourceId);
    request.onsuccess = () => resolve(request.result as EntryBlobMeta | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Sample the first `limit` entries of one kind — decodes chunks in order
 *  only until the limit is reached. */
export async function blobSampleForResource(
  langCode: string,
  resourceId: number,
  kind: EntryKindTag,
  limit: number,
): Promise<Array<DictionaryEntry | FrequencyEntry> | undefined> {
  const meta = await getEntryBlobMeta(langCode, resourceId);
  if (!meta) return undefined;
  const db = await getDB(langCode);
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const range of rangesFor(meta, kind)) {
    out.push(...await chunkEntries(db, resourceId, range.seq));
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

function loadChunk(db: IDBDatabase, resourceId: number, seq: number): Promise<StoredEntryChunk | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY_CHUNK, 'readonly');
    const request = tx.objectStore(STORES.ENTRY_CHUNK).get([resourceId, seq]);
    request.onsuccess = () => resolve(request.result as StoredEntryChunk | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Many chunk gets, batched — one readonly transaction per ≤64 keys pipelines
 *  the gets without transaction setup per row, and the macrotask yield between
 *  batches lets a queued TOKENIZE_META_GET cut into the SW thread instead of
 *  waiting behind ~200 serialized onsuccess callbacks (~2s on Wikipedia). */
const LOAD_CHUNKS_BATCH = 64;

async function loadChunks(
  db: IDBDatabase,
  keys: readonly { resourceId: number; seq: number }[],
): Promise<Array<StoredEntryChunk | undefined>> {
  const out: Array<StoredEntryChunk | undefined> = new Array(keys.length);
  for (let start = 0; start < keys.length; start += LOAD_CHUNKS_BATCH) {
    const slice = keys.slice(start, start + LOAD_CHUNKS_BATCH);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRY_CHUNK, 'readonly');
      const store = tx.objectStore(STORES.ENTRY_CHUNK);
      let pending = slice.length;
      slice.forEach(({ resourceId, seq }, i) => {
        const request = store.get([resourceId, seq]);
        request.onsuccess = () => {
          out[start + i] = request.result as StoredEntryChunk | undefined;
          if (--pending === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
    if (start + LOAD_CHUNKS_BATCH < keys.length) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return out;
}

async function chunkEntries(db: IDBDatabase, resourceId: number, seq: number): Promise<ReadonlyArray<DictionaryEntry | FrequencyEntry>> {
  const key = `${resourceId}:${seq}`;
  const cached = chunkCache.get(key);
  if (cached) return cached;
  const chunk = await loadChunk(db, resourceId, seq);
  const entries = chunk?.entries ?? [];
  chunkCache.set(key, entries);
  chunkCacheOrder.push(key);
  if (chunkCacheOrder.length > CHUNK_CACHE_CAP) {
    const evict = chunkCacheOrder.shift()!;
    chunkCache.delete(evict);
  }
  return entries;
}

const rangesFor = (meta: EntryBlobMeta, kind: EntryKindTag): readonly ChunkRange[] =>
  kind === 'dict' ? meta.dictRanges : meta.freqRanges;

/** First range index whose last >= term, or -1 when term sorts past the end. */
function findRangeIndex(ranges: readonly ChunkRange[], term: string): number {
  let lo = 0;
  let hi = ranges.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid]!;
    if (r.last >= term) { found = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return found;
}

/** Indexes of every range that can contain `term`. A run of equal terms can
 *  straddle a chunk boundary — the term appears as range[i].last AND
 *  range[i+1].first — so exact lookup must keep walking while first <= term. */
function exactTermSeqs(ranges: readonly ChunkRange[], term: string): number[] {
  const first = findRangeIndex(ranges, term);
  if (first < 0) return [];
  const seqs: number[] = [];
  for (let i = first; i < ranges.length && ranges[i]!.first <= term; i++) {
    seqs.push(ranges[i]!.seq);
  }
  return seqs;
}

const termOf = (e: DictionaryEntry | FrequencyEntry): string => e.term;

/** Entries whose term matches exactly, across all blob-backed resources. */
export async function blobFindByTerm(
  langCode: string,
  term: string,
  kind: EntryKindTag,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const metas = await getEntryBlobMetas(langCode);
  const db = await getDB(langCode);
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const meta of metas.values()) {
    for (const seq of exactTermSeqs(rangesFor(meta, kind), term)) {
      const entries = await chunkEntries(db, meta.resourceId, seq);
      for (const e of entries) {
        if (termOf(e) === term) out.push(e);
      }
    }
  }
  return out;
}

/** Entries for one blob-backed resource matching an exact term. */
export async function blobFindEntry(
  langCode: string,
  meta: EntryBlobMeta,
  term: string,
  kind: EntryKindTag,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const db = await getDB(langCode);
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const seq of exactTermSeqs(rangesFor(meta, kind), term)) {
    const entries = await chunkEntries(db, meta.resourceId, seq);
    for (const e of entries) {
      if (termOf(e) === term) out.push(e);
    }
  }
  return out;
}

/** Entries for many terms across blob-backed resources — one chunk fetch per
 *  (resource, chunk) pair regardless of how many terms share it. */
export async function blobFindByTerms(
  langCode: string,
  terms: readonly string[],
  kind: EntryKindTag,
  resourceIds?: ReadonlySet<number>,
): Promise<Map<string, Array<DictionaryEntry | FrequencyEntry>>> {
  const result = new Map<string, Array<DictionaryEntry | FrequencyEntry>>();
  for (const t of terms) result.set(t, []);
  if (terms.length === 0) return result;
  const metas = await getEntryBlobMetas(langCode);
  const db = await getDB(langCode);
  const wanted = new Set(terms);
  const chunksToFetch = new Map<string, { resourceId: number; seq: number }>();
  for (const meta of metas.values()) {
    if (resourceIds && !resourceIds.has(meta.resourceId)) continue;
    if (kind === 'freq') {
      if (meta.freqRanges.length === 0) continue;
      const index = await freqIndexFor(langCode, db, meta);
      const missing: string[] = [];
      for (const t of terms) {
        const entries = index.map.get(t);
        if (entries) result.get(t)!.push(...entries);
        else missing.push(t);
      }
      if (!index.partial || missing.length === 0) continue;
      const seqs = new Set<number>();
      for (const t of missing) {
        for (const seq of exactTermSeqs(rangesFor(meta, 'freq'), t)) seqs.add(seq);
      }
      const chunks = await loadChunks(db, [...seqs].map((seq) => ({ resourceId: meta.resourceId, seq })));
      const missSet = new Set(missing);
      for (const chunk of chunks) {
        for (const e of chunk?.entries ?? []) {
          const t = termOf(e);
          if (missSet.has(t)) result.get(t)!.push(e);
        }
      }
      continue;
    }
    const ranges = rangesFor(meta, kind);
    const seen = new Set<number>();
    for (const t of terms) {
      for (const seq of exactTermSeqs(ranges, t)) {
        if (!seen.has(seq)) {
          seen.add(seq);
          chunksToFetch.set(`${meta.resourceId}:${seq}`, { resourceId: meta.resourceId, seq });
        }
      }
    }
  }
  // Serve cached chunks first, then fetch the rest in one batched readonly
  // transaction — hundreds of single-get transactions serialize at ~1-3ms
  // each (a 500-term tokenize flush paid ~2s on Wikipedia).
  const wantedChunks = [...chunksToFetch.values()];
  const missKeys: Array<{ resourceId: number; seq: number }> = [];
  const missIdx: number[] = [];
  const chunkRows: Array<ReadonlyArray<DictionaryEntry | FrequencyEntry> | undefined> =
    new Array(wantedChunks.length);
  wantedChunks.forEach(({ resourceId, seq }, i) => {
    const cached = chunkCache.get(`${resourceId}:${seq}`);
    if (cached !== undefined) {
      chunkRows[i] = cached;
    } else {
      missKeys.push({ resourceId, seq });
      missIdx.push(i);
    }
  });
  const fetched = await loadChunks(db, missKeys);
  fetched.forEach((chunk, i) => {
    const { resourceId, seq } = missKeys[i]!;
    const key = `${resourceId}:${seq}`;
    const entries = chunk?.entries ?? [];
    chunkCache.set(key, entries);
    chunkCacheOrder.push(key);
    if (chunkCacheOrder.length > CHUNK_CACHE_CAP) {
      const evict = chunkCacheOrder.shift()!;
      chunkCache.delete(evict);
    }
    chunkRows[missIdx[i]!] = entries;
  });
  for (const entries of chunkRows) {
    for (const e of entries ?? []) {
      const t = termOf(e);
      if (wanted.has(t)) result.get(t)!.push(e);
    }
  }
  return result;
}

/** Entries with a term starting with `prefix` across blob-backed resources. */
export async function blobFindByPrefix(
  langCode: string,
  prefix: string,
  kind: EntryKindTag,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const metas = await getEntryBlobMetas(langCode);
  const db = await getDB(langCode);
  const upper = prefix + '￿';
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const meta of metas.values()) {
    const ranges = rangesFor(meta, kind);
    const start = findRangeIndex(ranges, prefix);
    if (start < 0) continue;
    for (let i = start; i < ranges.length; i++) {
      const range = ranges[i]!;
      if (range.first >= upper) break;
      const entries = await chunkEntries(db, meta.resourceId, range.seq);
      for (const e of entries) {
        if (termOf(e).startsWith(prefix)) out.push(e);
      }
      if (range.last < upper) continue;
      break;
    }
  }
  return out;
}

/** Entries with a term ending with `suffix` — via the backward-term rows. */
export async function blobFindBySuffix(
  langCode: string,
  suffix: string,
  kind: EntryKindTag,
): Promise<Array<DictionaryEntry | FrequencyEntry>> {
  const metas = await getEntryBlobMetas(langCode);
  const db = await getDB(langCode);
  const reversed = reverseString(suffix);
  const upper = reversed + '￿';
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const meta of metas.values()) {
    const rows = await new Promise<StoredBwdRow[]>((resolve, reject) => {
      const tx = db.transaction(STORES.ENTRY_BWD, 'readonly');
      const request = tx.objectStore(STORES.ENTRY_BWD)
        .index(INDEXES.by_resource_bterm)
        .getAll(IDBKeyRange.bound([meta.resourceId, reversed], [meta.resourceId, upper]));
      request.onsuccess = () => resolve(request.result as StoredBwdRow[]);
      request.onerror = () => reject(request.error);
    });
    const seqs = [...new Set(rows.filter((r) => r.kind === kind).map((r) => r.seq))];
    for (const seq of seqs) {
      const entries = await chunkEntries(db, meta.resourceId, seq);
      for (const e of entries) {
        if (termOf(e).endsWith(suffix)) out.push(e);
      }
    }
  }
  return out;
}

/** All terms of one kind for a blob-backed resource (probe / phrase rebuild). */
export async function blobTermsForResource(
  langCode: string,
  resourceId: number,
  kind: EntryKindTag,
): Promise<string[] | undefined> {
  const metas = await getEntryBlobMetas(langCode);
  if (!metas.has(resourceId)) return undefined;
  const db = await getDB(langCode);
  const record = await new Promise<StoredTermsRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORES.ENTRY_CHUNK, 'readonly');
    const request = tx.objectStore(STORES.ENTRY_CHUNK).get([resourceId, TERMS_SEQ]);
    request.onsuccess = () => resolve(request.result as StoredTermsRecord | undefined);
    request.onerror = () => reject(request.error);
  });
  return [...(kind === 'dict' ? record?.dictTerms : record?.freqTerms) ?? []];
}

/** Full enumeration of one resource's entries — decodes every chunk of that
 *  kind. Only for callers that truly need all entries (never the hot path). */
export async function blobEntriesForResource(
  langCode: string,
  resourceId: number,
  kind: EntryKindTag,
): Promise<Array<DictionaryEntry | FrequencyEntry> | undefined> {
  const metas = await getEntryBlobMetas(langCode);
  const meta = metas.get(resourceId);
  if (!meta) return undefined;
  const db = await getDB(langCode);
  const out: Array<DictionaryEntry | FrequencyEntry> = [];
  for (const range of rangesFor(meta, kind)) {
    out.push(...await chunkEntries(db, resourceId, range.seq));
  }
  return out;
}

/** Staged-row-equivalent records for a blob-backed resource — same shape as
 *  the ENTRY rows the compiler consumed (backwardTerm re-derived, `kind` set
 *  on freq rows). Sync serializers read this instead of the live store so a
 *  compiled resource exports identical bytes and keeps its contentHash. */
export async function blobRowsForResource(
  langCode: string,
  resourceId: number,
): Promise<Record<string, unknown>[] | undefined> {
  const meta = await getEntryBlobMeta(langCode, resourceId);
  if (!meta) return undefined;
  const db = await getDB(langCode);
  const rows: Record<string, unknown>[] = [];
  for (const range of meta.dictRanges) {
    for (const e of await chunkEntries(db, resourceId, range.seq)) {
      rows.push({ ...(e as DictionaryEntry), resourceId, backwardTerm: reverseString(e.term) });
    }
  }
  for (const range of meta.freqRanges) {
    for (const e of await chunkEntries(db, resourceId, range.seq)) {
      rows.push({ ...(e as FrequencyEntry), resourceId, kind: 'freq', backwardTerm: reverseString(e.term) });
    }
  }
  return rows;
}

/** Entry counts for a blob-backed resource, or undefined when row-backed. */
export async function blobCountsForResource(
  langCode: string,
  resourceId: number,
): Promise<{ dict: number; freq: number } | undefined> {
  const metas = await getEntryBlobMetas(langCode);
  const meta = metas.get(resourceId);
  if (!meta) return undefined;
  return { dict: meta.dictCount, freq: meta.freqCount };
}

/** Test hook — drop the in-memory chunk cache. */
export function clearEntryChunkCache(): void {
  chunkCache.clear();
  chunkCacheOrder.length = 0;
  freqTermIndex.clear();
}

/* ---------------------------- migration ------------------------------ */

/** One-shot upgrade pass: every finished resource that still lacks a meta
 *  record gets its staged ENTRY rows compiled into blob artifacts. Resources
 *  already blobbed may hold staged-row leftovers from a crash between the
 *  meta commit and dropStagedRows — those are swept too (rows are dead to
 *  reads but still cost storage). Runs sequentially so a weak device never
 *  compiles two dictionaries at once; per-resource failures are skipped,
 *  not fatal. */
export async function migrateEntriesToBlobs(langCode: string): Promise<number> {
  const [resources, metas] = await Promise.all([
    getAllResources(langCode),
    getEntryBlobMetas(langCode),
  ]);
  const dbs = await entryDBs(langCode);
  let migrated = 0;
  for (const r of resources) {
    if (r.id === undefined || r.installationFinished === false) continue;
    if (metas.has(r.id)) {
      for (const db of dbs) {
        const staged = await new Promise<boolean>((resolve, reject) => {
          const request = db.transaction(STORES.ENTRY, 'readonly')
            .objectStore(STORES.ENTRY).index(INDEXES.by_resource).openKeyCursor(r.id!);
          request.onsuccess = () => resolve(request.result !== null);
          request.onerror = () => reject(request.error);
        });
        if (staged) await deleteRowsByIndex(db, STORES.ENTRY, INDEXES.by_resource_term, r.id).catch(() => undefined);
      }
      continue;
    }
    try {
      await compileEntryBlob(langCode, r.id);
      migrated += 1;
    } catch {
      // leave row-backed — reads keep working, next wake retries
    }
  }
  return migrated;
}
