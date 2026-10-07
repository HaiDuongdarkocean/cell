# Analyze review — reading-annotation

VERDICT: APPROVE

Fresh-context subagent returned APPROVE_WITH_CHANGES; all required fixes were applied to `docs/intent/reading-annotation.md` before transition.

## Corrections absorbed

1. **ja furigana blocked by missing segmentation** — `tokenizeTextBlock` special-cases `'zh'` only (`textTokenizer.ts:46`); ja falls to letter-run regex → clause-level tokens → furigana impossible. v1 scoped to zh + IPA-covered langs; ja segmenter named as follow-up dependency (N7).
2. **Source-priority fixed to orchestrator parity** — `pronunciation || reading` with `reading !== term` dedupe (`lookupOrchestrator.ts:809-816`), not the intent's original reading-first order.
3. **Empty-marker corrected** — importers fall back `reading = term` (`baseImportStrategy.ts:202`), so "empty" means `reading === term`, not `''`.
4. **IPA coverage narrowed** — `pronunciation`/`prons` only populated by `json-entries` imports (`baseImportStrategy.ts:204,214`); term-bank/sqlite hardcode `''`.
5. **Espeak description corrected** — in-context WASM singleton (not offscreen), voices hardwired English-only (`pronunciationEngine.ts:60`) — still excluded from hydration.
6. **Toggle precedent corrected** — `tokenizeSettingsStore` is per-origin/session-only `show*` flags; per-language persistence precedent is `LanguageProfile` + `FLAT_FIELD_KEYS` (`profileResolution.ts:73-80`). Spec must decide scope.
7. **Ruby-vs-::before rationale corrected** — real tradeoff is copy-pollution (`<rt>`) vs host-page reflow (in-flow annotation on web-tokenize surfaces), not span-model restructuring.
8. **Render twins named** — `CueTokenText` (React), `restyleTokenBlock` (class-only path needs attr updates), both `tokenSpanCss` builders, `PreviewBlock`.
9. **Store schema noted** — `reading` is non-indexed; terms→readings deserializes full rows (acceptable, same shape as `findFrequencyByTerms`).
10. **Invalidation named** — mid-session dict import/disable/reorder; `onWordStatusesReload` listener precedent.

## Open questions deferred to spec

- `READINGS_GET` contract vs extended metadata response; freq-row reading participation/precedence.
- `Token.reading` field + signature changes across 4 hydration paths.
- Per-surface render primitive + layout budget; `disabledComponents`/`resourcePriority` semantics for readings.
- Toggle storage/defaults per surface; i18n keys.
