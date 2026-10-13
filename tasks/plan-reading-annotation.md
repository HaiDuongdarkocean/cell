# Plan — reading-annotation

Spec: `docs/specs/reading-annotation.md` · Design: `docs/intent/reading-annotation-design-brief.md`

## Slices

1. **Settings plumbing** — `Settings.showReadings` + `LanguageProfile.showReadings` (required booleans); `FLAT_FIELD_KEYS` + `syncFlatFieldsToActiveProfile` + `ACTIVE_PROFILE_MIRROR_EXCLUSIONS`; migration 35→36 (zh profiles → true, else false); `LanguageProfilePanel` creation default (zh→true); `DEFAULT_SETTINGS.showReadings=false`; Subtitle-card Toggle in `SettingsDialogContent`; i18n en+vi.
2. **Message + repo + handler + client** — `READINGS_GET` (schema mirror `FrequencyGetPayloadSchema`, direction `any`); `findDictionaryByTerms` bounded cursor (`by_term`, `isDictRow`, `resourceIds` filter); `handlers/readings.ts` — enabled+installed resources, priority sort (reimplement `buildResourcePriority` 6-line sort — it is dictionaryPopup-private, importing it would add a bad edge), exact find-semantics per entry order by resource priority, `disabledComponents['pronunciation']` gate, `pronunciation || reading`, omit when result === term (case-insensitive); `readingsClient.getReadings` (500-chunks + `normalizeLangCode`); register handler; dictionary barrel export.
3. **Token hydration** — `Token.reading?: string`; `resolveTokenListMetadata(tokens, langCode, {showReadings})` gains readings leg + freq-reading fallback (first `FrequencyEntry.reading ≠ term`); `videoTokenMap.resolveMetadata(…, readings)` + `termReadingCache` + `changed` on reading; `videoTokenPreloader` — `getShowReadings` option + readings leg + `invalidateResolution()`; `resolveCueListTokenMetadata(…, {showReadings})` + `CueListTokenize.showReadings` + effect dep.
4. **Render** — `TokenSpanBindOptions.showReadings`; `data-reading` on `.js-Tihoka-token-word` in `createTokenSpan` + `restyleTokenBlock` attr sync; `reading-off` modifier via `applyTokenClasses`; CSS cap rule in both builders; `CueTokenText` + `PreviewBlock.TokenSpan` twins.
5. **Wiring** — `subtitleTokenizeController` (`showReadings` option + `setShowReadings` rebind + `onReadingsReload` re-resolve); `contentScriptController` passes flag + re-sync; `reactSubtitleController.enableTokenize` passes `showReadings` into `setTokenize`; `SubtitleCueEngineTokenizeOptions.showReadings`; `useSubtitleActions` flag into controller + `CueListTokenize`; `PreviewBlock` reads `loadSettings().showReadings` in its resolve effect.
6. **Invalidation** — `DICTIONARY_RESOURCES_CHANGED` broadcast (`bg->cs`/`any`) emitted in `resources.ts` after `runImport`/`runDelete` markDone + REORDER/SET_ENABLED/SET_PROFILES/SET_COMPONENTS; relay case in `wordStatusCrossTab` → `emitReadingsReload` (new `readingEvents.ts`); controller + `CueList` subscribe (reload epoch).
7. **Tests** — readings rule logic, `findDictionaryByTerms`, `getReadings` client, `resolveTokenListMetadata` merge/fallback/flag-off, `videoTokenMap` reading path, `tokenSpanRenderer` attr/class, migration zh/en, handler eligibility.
8. **Gates + verify** — typecheck/lint/unit/build, browser screenshot evidence (subtitle overlay + cue list, on/off), verify review, ship.

## Notes

- Web-tokenize surface: no hydration, no render (spec REQ-3).
- ja: clause-level tokens → no annotations (honest scope).
- `reading === term` (case-insensitive) = no annotation, at both dict-row rule and freq fallback.
