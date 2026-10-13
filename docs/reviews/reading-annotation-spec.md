# Spec review — reading-annotation

VERDICT: APPROVE

Fresh-context `spec-reviewer` returned APPROVE_WITH_CHANGES (6 majors, 6 minors); all applied to `docs/specs/reading-annotation.md` before transition.

## Majors applied

1. **REQ-1 rule corrected to exact find-semantics** — an entry whose only reading equals the term does NOT win the scan; lower-priority entries still get a chance (`lookupOrchestrator.ts:809-816`). Winning `pronunciation` equal to term → omit.
2. **REQ-4 lists all four sync touchpoints** — `FLAT_FIELD_KEYS` + `syncFlatFieldsToActiveProfile` hardcoded list + `ACTIVE_PROFILE_MIRROR_EXCLUSIONS` + settings migration; required `boolean` convention (not `?`); `resolveProfile` has no per-field default → migration writes concrete values.
3. **Toggle home moved** — `SettingsDialogContent.tsx` Subtitle card (same as `subtitleOverlayAutoLoad`), not `ProfileForm` (identity-only).
4. **`PreviewBlock.TokenSpan` added** to the render-twin list (SC-6 would fail otherwise).
5. **`videoTokenMap` ripples added** — `changed` flag must include reading; `termReadingCache` required for `prepare()` rebuilds.
6. **REQ-5 names the mechanism** — dictionary import/disable/reorder does NOT emit `emitWordStatusesReload` today (verified: only `wordStatusCrossTab.ts:17` on `SYNC_DATA_APPLIED`); delivery must add a runtime broadcast + content-script relay (`wordStatusCrossTab` pattern or `DICTIONARY_CHANGED`).

## Minors applied

- `frequencyAllowedIds` is an unordered `Set` — ordering via `ResourceInfo.priority` + resourceId-desc; `buildResourcePriority` is module-private → extract/reimplement.
- `data-reading` pinned to inner `.js-Tihoka-token-word` (`attr()` reads own element only).
- `cueListTokens` per-request chunk 1000, list unbounded.
- Cite fixes: `dictionarySchemas.ts:321-325`, `buildTokenSpanCss` name.
- Toggle-ON requires explicit `resolvedTerms` reset (`videoTokenPreloader.ts:130-135`).
- Reading-only fetch failure marks `resolvedTerms` anyway — accepted, documented.
- SC-9 added for the fetch-failure path.

## Accepted risks

- Full-row deserialization in `findDictionaryByTerms` — same cost shape as `findFrequencyByTerms`.
- `prons[]` accent variants deferred to v2 — popup parity kept via flat `pronunciation`.
