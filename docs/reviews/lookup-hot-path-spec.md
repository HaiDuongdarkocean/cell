# Spec review — lookup-hot-path

VERDICT: APPROVE_WITH_CHANGES

## Round 1 — VERDICT: REJECT (under-specified semantics)

Findings (all verified against source):

1. REQ-1 filter predicate misdescribed — step-6 phrase matches are dedupe-only, not content-filtered (lookupOrchestrator.ts:397-407).
2. `RESOURCE_RENAME` + `RESOURCE_SET_COMPONENTS` mutate context-served fields without invalidation.
3. Settings seam incomplete — `saveSettings` has direct callers outside `UPDATE_SETTINGS` (content scripts, reconciliation, migration, sync).
4. `seen` semantics under-pinned (query-term vs resolved-term pre-check).
5. Memo ownership would collide with shared cached ResourceContext.
6. Memo key ambiguous — by_term index is case-sensitive, no lowercasing.
7. Success criterion contradicted non-goal (zero IDB reads vs per-request memo).
8. Sync-applied settings uncovered.

## Round 2 — VERDICT: APPROVE_WITH_CHANGES

All round-1 findings verified applied. Two minors remained.

## Applied fixes

- REQ-1: per-source acceptance predicates pinned verbatim (surface/lemma = content filter + dedupe; phrase matches = dedupe only); `seen` seeded by winner, dual check (query-term pre-skip + resolved-term post-check), grows by accepted `result.term`; single-`plugin.lemma` fallback documented as not adding to `seen` (round-2 minor 1).
- REQ-2: parallel lemma probe preserves `candidate === lookupTerm` skip; first non-empty in order after allowedResources filter + priority sort.
- REQ-3: memo = per-request object inside `lookupOrchestratorMulti`; in-flight promises retained for request lifetime; verbatim case-sensitive `langCode|term` key (round-2 minor 2 clarified).
- REQ-4: `lookupContextCache` keyed by langCode caching in-flight context promise with reject-eviction; invalidation = `clearDictionaryProbeCache` extension (resources import/delete/toggle + syncRuntime) + new calls on `RESOURCE_RENAME`/`RESOURCE_SET_COMPONENTS` + `chrome.storage.onChanged` on settings key (covers all writers incl. sync).
- REQ-6: added per-source predicate test, rename/set-components invalidation, same-term parallel dedupe.
- Alternatives section added; contradictory success criterion rephrased to settings/resource-list reads.
