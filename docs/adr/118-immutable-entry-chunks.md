# ADR-118: Immutable entry chunks — WAL/LSM layout for dictionary data

**Date:** 2026-10-15
**Status:** Accepted

## Context

Lookup latency during import is bounded by IndexedDB transaction
serialization: a `readonly` lookup transaction cannot run alongside an
in-flight `readwrite` transaction on the same object store. Import writes
staged rows in batches of 2000 entries; one such write commit costs
~100–580ms on desktop (worse on low-end storage), and a lookup created
just after the write is queued behind the whole commit. Measured during a
real Macmillan re-import: p99 = 199ms, max = 579ms — violating the
"<300ms in every practical condition" budget.

Batching cannot fix this: it is a structural limit, not a parameter
(Yomitan hit the same wall — issue #329 — on the same row-per-entry +
batch-add layout on IndexedDB).

The proven pattern for "read latency bounded while a store absorbs bulk
writes" is WAL/LSM (SQLite WAL, LevelDB): writes go to a target readers
never open; visibility flips via a cheap pointer swap; readers pin
immutable sorted data and fetch only the block they need.

Measured correction: IndexedDB transactions on different object stores
of the **same database** do NOT run in parallel — Chromium serializes
all transaction work on one backend queue per database, including large
`readonly` transactions. A 256-row fat-entry `getAll` or a 48k-key
`getAllKeys` probe on the staging store still stalls a lookup reading a
different store (~500ms observed). The WAL/LSM pattern therefore maps to
separate **databases**, not separate stores.

## Decision

`DB_SCHEMA_VERSION` 14 → 15 adds three stores:

- `langEntryChunk` — key `[resourceId, seq]`. Records:
  - `seq = -1` (TERMS_SEQ): the terms record `{dictTerms, freqTerms}` —
    lets phrase-index rebuild/probe read terms without decoding entries.
  - `seq ≥ 1`: dictionary chunks — `entries[]` sorted by `term`, ≤256 each.
  - `seq ≤ -2`: frequency chunks — negative seqs keep dict/freq key
    spaces collision-free.
- `langEntryMeta` — key `resourceId`. `{formatVersion, dictRanges,
  freqRanges, dictCount, freqCount}` where each range is `{first, last,
  seq}`. The meta record is written **last** during compile — its
  presence is the atomic commit point that flips the resource's reads to
  the blob path.
- `langEntryBwd` — `{resourceId, bterm, term, seq, kind}` +
  `by_resource_bterm` index; carries suffix lookup for blob-backed
  resources (`backwardTerm` is stripped from chunk entries).

New index on `langDictionaryEntry`: `by_resource_term` `[resourceId,
term]` — compile reads staged rows in term order via paged `getAll`
(256 rows per request; `cursor.continue()` costs one macrotask per
row and never finishes under `fake-indexeddb`).

**Ingest database**: `orca-dict-{hash}-{lang}-ingest` (own version
counter, v1) holds only `langDictionaryEntry` + its four indexes. All
new staged-row writes go there; compile page-reads, count probes, and
staged-row delete sweeps run against it — so the entire write pipeline
shares zero backend queue with the lookup database. The main DB keeps
its ENTRY store for rows staged before the split; readers scan
`entryDBs()` = `[ingest, main]` (a resource's rows live in exactly one —
bulk inserts are sequential per import). `deleteDB`/`clearAllStores`/
`closeAllDBs` handle both.

**Bounded deletes** (`deleteRowsByIndex`): `count()` + first/last
primary-key probes decide between a contiguous `IDBKeyRange.bound`
delete (256 keys per `relaxed` txn) and a `getAllKeys` + keyed-delete
fallback — never a second per-round `getAllKeys` (re-querying 48k keys
× ~190 rounds costs far more backend time than one materialization).

**Import flow** (`importOrchestrator`): strategy stages rows →
`compileEntryBlob` builds chunks + terms + bwd rows (each in its own
`durability:'relaxed'` write txn with a 16ms interleave gap) → meta
written last → staged rows dropped in bounded deletes →
`installationFinished=true`. Failure before meta → rollback cleans both
staged rows and any orphaned artifacts.

**Read path** (`resourceEntryRepository`): unchanged signatures. Each
read first checks meta presence — meta → binary-search the range table
(`findRangeIndex`/`exactTermSeqs`), fetch only the 1–2 chunks that can
contain the term; no meta → legacy row path. Cross-resource reads merge
both paths, excluding staged rows of already-blobbed resources
(`notBlobbed`). An 8-chunk LRU bounds repeated chunk materialization.

**Migration**: `migrateEntriesToBlobs` runs once per SW wake (deferred
~3s after init), compiling each finished-but-unmeta'd resource
sequentially — and sweeping staged-row leftovers on already-blobbed
resources (crash between meta commit and row drop). Crash mid-compile is
safe — chunks/bwd rewritten, meta is the commit point.

**Sync seam**: the sync layer reads ENTRY directly (blob export,
contentHash backfill) — those readers now go through
`blobRowsForResource`, which reconstructs staged-row-equivalent records
from chunks (`backwardTerm` re-derived) so exported portable bytes and
contentHashes stay byte-identical to the row path. Sync apply deletes
`langEntryMeta` in-transaction (flips the resource back to row path
instantly) and sweeps chunk/bwd artifacts post-commit; sync-imported
blobs are staged then re-compiled like a normal import.

## Consequences

- During the staging phase (~99% of import time) lookups never even
  share a database backend with import writes — the staging store lives
  in the ingest DB. The only main-DB writes lookups can meet are
  ≤256-entry chunk puts and ≤256-key sweeps, each `relaxed` + gapped.
- Exact-term lookup = 1 meta read + 1–2 chunk `get`s (~256-entry
  structured clones, bounded) instead of an index scan returning full
  rows.
- Duplicate terms can straddle a chunk boundary (`range[i].last ===
  range[i+1].first === term`) — exact lookups walk every range whose
  `first <= term`, not just the first hit.
- Staged rows remain the write target for in-flight imports; reads merge
  blob + row results so mixed states are correct.
- `findDictionaryTermsByResource` on blobbed resources reads the terms
  record — phrase-index rebuild never decodes entry chunks.
- `durability:'relaxed'` accepted for staging + artifact writes: every
  loss is recoverable by re-importing / re-compiling.

## Known limits

- Compile chunk puts still share the main DB with concurrent lookups —
  a lookup meeting a chunk put waits one ~256-entry put (~tens of ms),
  not a staging batch.
- The ingest DB double-opens per renderer context (SW + offscreen +
  tests) — one extra `indexedDB.open` per lang, cached per context.
- `GAP_MS` (16ms per chunk) trades total import wall-time for read
  interleave: ~3s extra per 200 chunks on top of write time.
- Suffix lookup materializes matching bwd rows then decodes the
  referenced chunks — bounded but heavier than exact-term reads.
