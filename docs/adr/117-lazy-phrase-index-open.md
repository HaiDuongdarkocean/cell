# ADR-117: Lazy phrase index open — decode on demand from the blob

**Date:** 2026-10-14
**Status:** Accepted

## Context

ADR-037 compiles phrase templates into a compact binary blob (≤8MB) persisted
in IndexedDB. On every service-worker cold start the lookup path ran
`deserializePhraseIndex`, which materialized the ENTIRE index — ~43k–53k
templates, node trees, token strings, and posting Maps — into SW memory before
the first lookup could return. Measured cost: the deserialized structures cost
tens of MB resident RAM and hundreds of ms of parse time on a desktop; on
low-RAM devices both are worse. This is the classic reparse-per-lookup debt
(see `learning-and-apply` experience `zip-central-directory-reparse-per-lookup`):
the whole archive is rebuilt to serve a handful of records.

A lookup touches at most a few dozen candidate templates selected by anchor
postings. Paying full materialization is waste on both axes the user cares
about: first-lookup latency and steady memory.

## Decision

`openLazyPhraseIndex(buffer)` opens the same blob **without materializing it**:

- Header + token table are decoded eagerly (tokens are needed anyway —
  anchor keys and template literals reference them).
- The template table is walked once recording each record's byte offset into
  a `Uint32Array` — no objects are built.
- The anchor table is walked once recording each anchor's posting byte
  offset/count into `Uint32Array`s keyed by tokenId.
- `templates` is a lazily-decoded array facade (Proxy over a sparse array):
  `templates[id]` decodes that one record on first access and memoizes.
- `lookupByAnchor(token)` resolves token → tokenId → posting range and reads
  the IDs straight from the blob bytes, memoized per anchor.

Consumers that only index `templates[id]` (the matcher hot path) need no
changes. Code that must iterate every template — validation
(`phraseIndexLoader`), serialization, tests — keeps using
`deserializePhraseIndex` / `compilePhraseIndex`.

## Consequences

- Cold lookup after SW wake drops from ~250–580ms to ~30–90ms (measured on the
  real Macmillan-EnEn index, 43k templates): the blob read + directory walk
  replace full deserialization.
- Resident memory per open index ≈ blob size + token table + directories
  (~5–6MB for the largest resource) instead of the fully materialized object
  graph.
- Repeated `lookupByAnchor`/template hits are memoized, so warm lookup cost
  is unchanged (~5–15ms).
- `templates` iteration on a lazy index is correct but decodes everything —
  new consumers needing a full scan should use `deserializePhraseIndex`
  instead (documented on the function).
- Blob format is unchanged (compilerVersion stays 7): no re-import, no IDB
  migration.

## Also in this change

- `compilePhraseIndexAsync` / `serializePhraseIndexAsync` — byte-identical
  async twins used by `buildPhraseIndexForResource`, yielding via the shared
  `createYieldChecker` budget (≤40ms bursts) so a post-import build no longer
  monopolizes the SW event loop.
- `schedulePhraseIndexRebuild` defers the build by 1s so the lookup that
  detected the missing blob completes before the rebuild's IDB churn starts.
- `prewarmPhraseIndexes()` runs at the end of SW init — opens the active
  profile's lazy indexes in the background so the first real lookup pays only
  warm cost. Trade-off accepted: the blob bytes are held in SW memory even if
  no lookup happens this wake (bounded — one blob per dictionary resource of
  the active profile).

## Known limit

A rebuild still shares the SW's IndexedDB with lookups — the initial
`findDictionaryByResource` getAll (self-heal path) and import-time entry writes
can still add tens of ms to concurrent lookups. The multi-second compile/serialize
stall is gone; remaining contention is at IDB level, not CPU.
