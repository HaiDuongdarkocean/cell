# Analyze review — lookup-hot-path

Mode: `all` (autonomous — self-interrogation replaces the interactive gate).

## Audit claims re-verified against code

- `handlers/lookup.ts` → `lookupOrchestratorMulti(request, {}, signal)` — confirmed, deps ignored.
- "phrase-index blob đọc lại mỗi hover" — **STALE**: T23 already added module-level `phraseIndexCache` + `probeCache` in `lookupOrchestrator.ts`; indexes deserialize once per resource. Intent rewritten to target the real waste: sequential per-candidate `assembleLookupResult`, sequential lemma probing, per-request `loadSettings`/`buildResourceContext`, no per-request memo.
- Deterministic ordering preserved as a hard requirement — parallel fan-out must not change result order.

## Decision

VERDICT: APPROVE

- Pure perf on the hottest user path; no UI surface (`uiSurface=no` → skips design).
- Spec must lock: identical result ordering/content vs sequential baseline (orchestrator fixture tests are the oracle), per-request memo keyed `langCode|term`, context cache invalidated via existing `subscribeResourceChanges`/settings seams — no second cache invented.

Intent: `docs/intent/lookup-hot-path.md`
