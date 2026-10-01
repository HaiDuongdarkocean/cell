# Spec — lookup-hot-path (backlog #15)

Intent: `docs/intent/lookup-hot-path.md` (analyze: APPROVE, `all` mode) · uiSurface: no → no design stage
Review: spec-reviewer round 1 → REJECT (under-specified semantics); all findings applied below.

## Goal

Cut IDB round-trips on the popup lookup hot path without changing a single byte of `LookupResult[]` output: parallel candidate assembly, parallel lemma probing, per-request read memoization, and a cached settings+resource context invalidated through a complete seam.

## Non-goals

- No change to result ordering, content, plugin contract, abort semantics, or `requestRemoteCheck`.
- No new message types, no UI, no persisted schema changes.
- `phraseIndexCache`/`probeCache` (T23) stay as-is — already correct.
- No cross-request memoization of term reads (word status can change between lookups; per-request only).

## Requirements

### REQ-1 — Deterministic-parallel candidate assembly (semantics pinned)

`lookupOrchestratorMulti` currently `await`s `assembleLookupResult` once per candidate inside sequential `for` loops. Rewrite as: build the ordered candidate list, `Promise.all` the assemblies, then apply the **per-source** acceptance predicates in original order.

Candidate list (in order, winner excluded):

1. surface-term candidate — only when `surfaceTerm.toLowerCase() !== winnerResult.term.toLowerCase()` (guarded as today),
2. `plugin.lemmaCandidates(surfaceTerm)` entries (or single `plugin.lemma` fallback — stays sequential, one call),
3. `additionalPhraseMatches` entries.

Acceptance predicates — **must stay per-source, verbatim from the current code**:

- surface + lemma candidates: accept iff `(result.definitions.length > 0 || result.frequencies.length > 0 || result.reading)` AND `!seen.has(result.term.toLowerCase())`.
- remaining phrase matches (step 6 today): **dedupe only** — `!seen.has(result.term.toLowerCase())`. No content filter. (Round-1 review: current code keeps empty phrase candidates; uniform filtering would break byte-identical output.)

`seen` semantics (pinned):

- `seen` is seeded with `winnerResult.term.toLowerCase()` before any candidate is considered.
- For each candidate **in list order**: skip it early if its lowercased **query** term ∈ `seen` (today's pre-check); after resolution, skip if `result.term.toLowerCase()` ∈ `seen` (covers resolved-to-same-term, e.g. "cats"→"cat" collision); on accept, add `result.term.toLowerCase()` to `seen`.
- Because parallel resolution can map a query term to a different `result.term`, the merged filter MUST check both — query-term pre-skip preserves today's pruning, result-term check preserves today's dedupe. Both run in list order over already-resolved results.
- Verbatim nuance: the single-`plugin.lemma` fallback accept path does **not** add to `seen` (current code only adds inside the `lemmaCandidates` loop) — preserve as-is, even though unreachable today.

Output: `[winnerResult (with phraseIndexPending spread), ...accepted in order]` — byte-identical to baseline.

### REQ-2 — Parallel lemma probing (miss path)

Inside `assembleLookupResult`, when `dictEntries.length === 0` and `plugin.lemmaCandidates` exists: replace the sequential `for await` probe with `Promise.all` over all candidates (minus the `candidate === lookupTerm` skip preserved verbatim — the by_term index is case-sensitive, only the exact string is skipped). Then pick the **first candidate in order whose filtered `dictEntries.length > 0`** (post-`allowedResourceIds` filter + `sortByResourcePriority`, same as today) → `effectiveTerm`. `checkAbort(signal)` once between batch and pick.

### REQ-3 — Per-request read memo (ownership + key pinned)

- A fresh memo object is created **inside `lookupOrchestratorMulti` per request** and passed down — never stored on `ResourceContext` (which is now shared across requests) and never module-level.
- Memo caches **in-flight promises**, and each cached promise is retained for the request's lifetime after it resolves — a same-term repeat read returns the cached promise rather than re-hitting IDB (required for "exactly once" under REQ-1's fan-out).
- Key: verbatim `` `${langCode}|${term}` `` exactly as passed to the read functions — **no normalization/lowercasing** (by_term index is case-sensitive; "i take it" and "I take it" are distinct terms).
- Wraps: `findDictionaryByTerm`, `findFrequencyByTerm`, `getWordStatus`.

### REQ-4 — Cached lookup context + complete invalidation

- Module-level `lookupContextCache: Map<langCode, Promise<ResourceContext>>` inside the orchestrator covering `loadSettings()` + `buildResourceContext(langCode, settings)`. Cache the in-flight promise (self-deduping cold start); **on rejection, evict the entry** before rethrow/fallback — never serve a poisoned cache.
- `handlers/lookup.ts` keeps `lookupOrchestratorMulti(request, {}, signal)` — cache lives inside the orchestrator; test deps injection unchanged. (Deviation from intent's handler-side injection recorded: in-orchestrator is the smaller diff and automatically benefits every caller.)
- Invalidation — all writers must be covered:
  - `clearDictionaryProbeCache()` (called by resources handler on import/delete/enable toggles, and `syncRuntime` on remote dictResource mutations) → extend to also drop the context cache.
  - **Add `clearDictionaryProbeCache()` calls to `RESOURCE_RENAME` and `RESOURCE_SET_COMPONENTS` handlers** — both mutate context-served fields (`name` → `DefinitionEntry.source`; `disabledComponents` → `disabledOf` filtering). (Audit `SET_PROFILES`-style handlers for context-read fields during build; `profileIds` is unused by lookup today.)
  - Settings: subscribe to `chrome.storage.onChanged` on the settings storage key **in the background context** (covers `UPDATE_SETTINGS` handler, direct `settingsStore.saveSettings` from content scripts e.g. `mountUniversalPanel` `activeProfileId` writes, background-internal writers `reconciliation`/`profileIdentityMigration`, and sync-applied settings — one seam for all). Drop the whole context cache on change.

### REQ-5 — Abort preserved

`checkAbort(signal)` at every batch boundary; aborted request rejects identically; no partial results returned.

### REQ-6 — Tests

- Oracle: `lookupOrchestrator.test.ts`, `phraseMatcher.fixture.test.ts`, `chinesePlugin.fixture.test.ts` pass **unchanged**.
- New unit tests:
  - instrumented `findDictionaryByTerm` spy: N-candidate lookup → each distinct term read exactly once per request (in-flight dedupe); assemblies overlap (REQ-1/REQ-3).
  - per-source predicates: an empty phrase-match candidate survives (dedupe-only) while an empty surface/lemma candidate is dropped — byte-identical fixture (REQ-1).
  - lemma miss: first non-empty candidate in order wins under parallel probe (REQ-2).
  - invalidation: `clearDictionaryProbeCache()`, a settings write via the storage.onChanged seam, and `RESOURCE_RENAME`/`RESOURCE_SET_COMPONENTS` each drop the cached context (REQ-4).
  - abort mid-batch rejects (REQ-5).

## Interfaces touched

- `src/features/dictionaryPopup/logic/lookupOrchestrator.ts` — candidate loops, lemma probe, memo, context cache, `clearDictionaryProbeCache` extension.
- `src/entrypoints/background/handlers/resources.ts` — add invalidation to rename + set-components.
- `src/entrypoints/background/` (init/wire location per convention) — storage.onChanged settings subscription.
- No public API shape changes.

## Alternatives considered

- Context cache via handler-injected deps (intent's phrasing) vs in-orchestrator cache: in-orchestrator chosen — smaller diff, benefits all callers, handler contract untouched.
- `chrome.storage.onChanged` vs per-writer message broadcast: storage event chosen — covers every writer including sync-applied settings with one seam.
- Memo of resolved values vs in-flight promises: promises chosen — required to dedupe concurrent reads (REQ-1 fan-out).

## Success criteria (measurable)

- Instrumented test: 6-candidate English lookup → each distinct term's dict read issued exactly once, reads concurrent (latency = max, not sum).
- Real-Chromium verify: hover lookup returns identical popup content; repeated hover performs zero additional **settings/resource-list** IDB reads (term reads are per-request by design).
- All gates: typecheck, lint, `test:unit`, build, feature-cycles/deep-imports clean.
