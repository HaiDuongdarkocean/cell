# ADR: POS Dictionary Variants — derived per-POS views of a term

**Date:** 2026-10-04
**Status:** Accepted

## Context

English headwords commonly carry several part-of-speech homographs with independent pronunciation, frequency, senses and learning status (`present` adj/verb/noun). Sources provide this data natively: COCA 60000 ships per-POS rank + genre counts, MacmillanEnEn renders one `.homograph` block per POS (own IPA + audio + stars + senses), and Macmillan 2nd Ed carries dual UK/US pronunciations per block. Tihoka previously stored one undifferentiated `DictionaryEntry`/`FrequencyEntry`/`WordStatus` row per term, so `present·verb` and `present·noun` could not be tracked or rendered independently.

Spec: `docs/specs/pos-dictionary-variants.md`. Design: `docs/intent/pos-dictionary-variants-design-brief.md` (Concept A — chapter links).

## Decision

### 1. Storage: one row per homograph, `pos` columns added, no variant table

- `DictionaryEntry` stays one row per homograph (`term` + `pos`); gains `prons: PronunciationAccent[]` (`accent`, `ipa`, `audioRef` kept verbatim as `sound://…` until `.mdd` extraction lands).
- `FrequencyEntry` gains `pos?`, `total?`, `genres?` (spoken/fiction/magazine/newspaper/academic).
- `WordStatus` gains composite pos rows keyed `term␟pos` (literal `␟` separator, `posStatusKey`/`splitPosKey`). Term-level rows are untouched — pos reads resolve `term␟pos ?? term ?? 'unknown'`.

### 2. `PosVariant` is derived at lookup, never persisted

`lookupOrchestrator` merges dictionary/frequency/status rows into `LookupResult.variants` because component toggles and provider priority affect the merge — a stored variant would go stale on settings change. Variants materialize only when ≥1 real pos exists; an `''`-only (`other`) bucket yields `variants: undefined` so legacy pos-less data keeps the old single-variant render path. Order = first appearance across priority-sorted entries; `other` renders last.

### 3. POS normalization is a shared SSOT

`src/shared/lib/posNormalize.ts` maps source aliases to canonical lowercase labels (`j`→`adjective`, `v`→`verb`, COCA codes + full names + `n.`/`adj.` abbreviations). All consumers (import transform, lookup join, status keys, UI labels) route through `normalizePos` so COCA rows join Macmillan homographs correctly.

### 4. UI: Concept A chapter links + accent toggle

- `PosVariantNav` (feature-scope, new archetype — `InkTabs`/`Link` cannot express inline `a | b | c` text navigation) renders `adjective | verb | noun` pinned above the headword, only when `variants.length > 1`.
- Accent label (`ame`/`bre`, lowercase, `--color-muted-foreground`) sits before the IPA and cycles `variant.prons` on tap; disabled when ≤1 accent; accent index is per-variant (`accentByPos`) so switching POS restores its own accent.
- POS-scoped swap covers IPA, stars, status pill, frequency chips (genre breakdown on `title`), inflections, definitions, image query (`${term} ${pos}` via `useDictionaryToolbar` `imageQuery`), and card prefill (`pos` + accent-selected IPA).
- Status cycling writes `term␟pos` for real pos variants, plain `term` for the `other` bucket; `WORD_STATUS_CHANGED` events carry `pos`.
- Term-level aggregate = least-learned variant wins (`aggregatePosStatus`), so highlighting treats the term as unknown until every learned variant is learned.

### 5. Import path

- New `json-frequency` format (`JsonFrequencyStrategy`) accepts `[{term,pos,rank|frequency,total,genres}]`, dedupes by `(term,pos)`.
- `tihoka-convert-frequency.mjs` converts COCA MDX → `json-frequency`.
- `macmillan.mjs` upgraded to emit one entry per `.homograph` with scoped senses/stars/inflections/`prons` (AmE + `sound://` refs).
- `macmillan2ed.mjs` adapter added for the UK/US dual-pronunciation source.

## Consequences

- `present·verb = learning` while `present·noun = unknown` works end-to-end (store → lookup → popup → events).
- Existing single-POS and pos-less data render unchanged; legacy term-level status rows keep feeding every variant until a pos row exists.
- `.mdd` audio extraction is deferred — `audioRef` strings are stored verbatim, resolution layer comes later.
- Aggregate highlighting is conservative (least-learned) — a partially learned term still highlights.
