# Plan: message-validation-thread

Spec: `docs/specs/message-validation-thread.md` — tighten 5 loose payload fields; handlers stop casting validated data.

| # | Task | Parallel | AC traced |
|---|------|----------|-----------|
| 1 | `src/features/detection/logic/trackSchemas.ts` — yt/iq/nf track + track-array schemas (default-strip); barrel export | yes | AC-1 |
| 2 | `detectionDispatch.ts` — `DetectedSubtitlesPayloadSchema.safeParse` envelope + per-branch `*ArraySchema.safeParse`; remove 4 casts | after 1 | AC-1, AC-6 |
| 3 | `entities/message/schema.ts` — add `bilingualCueSchema`, `subtitleDownloadKindSchema`, `subtitleSearchResultSchema`; tighten `SubtitleCuesLoadedPayloadSchema.cues`, `ResolveSubtitleDownloadPayloadSchema.result`, `UpdateSettingsPayloadSchema.settings`→`z.record` | yes | AC-2, AC-3, AC-4 |
| 4 | `subtitle.ts` — drop `as BilingualCue[]`; `subtitleSearch.ts` — drop `as unknown as SubtitleSearchResult` + `as SubtitleApiKeyProvider` | after 3 | AC-2, AC-3, AC-6 |
| 5 | `src/entities/settings/settingsPatch.ts` — `sanitizeSettingsPatch` + `SETTINGS_PATCH_RULES` + `SETTINGS_ENUM_FIELDS` (incl. `defaultQuality`, `activeProfileId` null|string, `subtitleApiKeys` element check, `Number.isFinite` for numerics) | yes | AC-4 |
| 6 | `settings.ts` — envelope `z.record` + merge/eager-setters from sanitized patch only | after 3,5 | AC-4 |
| 7 | `entities/message/dictionarySchemas.ts` — new `lookupRequestSchema` (verbatim interface), replace `z.custom` at :372 | yes | AC-5 |
| 8 | Unit tests: `trackSchemas`, `settingsPatch`, handler-level coverage for all five paths | after all | AC-7 |
| 9 | Gates: typecheck · lint · test:unit · build → arch doc → fresh-context verify → ship | after 8 | AC-8 |
