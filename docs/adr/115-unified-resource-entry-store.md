# ADR-115: Unified resource entry store — frequency rows as dictionary components

**Date:** 2026-10-04
**Status:** Accepted

## Context

Dictionary and frequency-list resources grew as two parallel systems: two
IndexedDB entry stores (`langDictionaryEntry` + `langFrequencyEntry`) with
identical keyPath/indexes, two mirror repositories, two import dropzones, and
a user-declared `resourceType` discriminant. The portable sync format had
already drifted to the unified model — `serializeResourcePortable` emits one
resource as `{dictRows, freqRows}` — while storage stayed split. Consequences:
users had to answer "dictionary or frequency?" for files that answer it
themselves, mixed files (term-bank zip containing both `term_bank_*` and
`term_meta_bank_*`, dual-table sqlite) silently lost half their content when
dropped on the wrong side, and every storage/read path duplicated.

## Decision

A resource is a container of **components**, not a type. `ResourceInfo.type`
becomes a derived compatibility label (`deriveResourceType(components)`,
`FREQUENCY` only when the sole component is `frequency`); business logic
branches on `components`/`disabledComponents` via the shared
`resourceOffersComponent` predicate.

1. **One entry store** — `STORES.ENTRY` keeps the physical name
   `langDictionaryEntry` (renaming the store would migrate ~500k rows for no
   benefit). Frequency rows are entries stamped `kind:'freq'`; dict rows have
   no `kind`. `resourceEntryRepository` replaces the two mirror repositories.

2. **v14 migration** — inside the versionchange transaction: copy
   `langFrequencyEntry` rows into the entry store **stripping `id`** (the two
   stores shared an auto-increment keyspace, so raw ids can collide — new ids
   are minted and entry ids are not referenced by other stores), stamp
   `kind:'freq'`, backfill `components:['frequency']` on FREQUENCY resources
   lacking the field, drop the legacy store. Abort mid-upgrade rolls back the
   whole copy; a retry replays idempotently.

3. **Content-derived detection, strategy-authoritative** —
   `detectComponents(name, head)` is advisory for the job badge/picker (head
   is capped at 1MB); strategies re-derive truth while parsing and emit every
   family present. `importFile`/`createStrategy` carry no `resourceType`; the
   optional `components` payload is a **user-narrowed exclusion subset only**
   — sent solely when the user deselects a detected chip, never inferred from
   detection (a head-limited subset would silently drop families beyond the
   1MB window).

4. **Single priority axis** — `RESOURCE_REORDER` is type-free; priority 0..n
   spans all resources of a language. `disabledComponents` removes a
   component's contribution at lookup-merge and at `FREQUENCY_GET`
   (`frequencyAllowedIds`), so mixed resources degrade gracefully per part.

## Consequences

- One dropzone, one flat list; mixed files import both families in one pass
  with `wordCount` = total rows.
- Freq lookup paths unchanged shape (`findFrequencyByTerms` returns
  `Map<term, FrequencyEntry[]>`), now gated by component rather than type.
- Legacy rows without `components` keep contributing frequency via the
  `type === 'FREQUENCY'` fallback until the lazy store scan backfills.
- Wire formats untouched: portable `{d,f}` NDJSON rows partitioned by `kind`,
  `contentHash`/`signature` formulas unchanged — old blobs import cleanly.
- `type ===` branches are confined to derived-label/display sites, the v14
  migration read itself, and the legacy fallback inside
  `resourceOffersComponent`.
