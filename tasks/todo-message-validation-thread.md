# Todo: message-validation-thread

- [x] `features/detection/logic/trackSchemas.ts` — yt/iq/nf track + array schemas (default-strip) + barrel export (AC-1)
- [x] `detectionDispatch.ts` — envelope `safeParse` + per-branch track-array `safeParse`; 4 casts removed (AC-1, AC-6)
- [x] `entities/message/schema.ts` — `bilingualCueSchema`, `subtitleDownloadKindSchema`, `subtitleSearchResultSchema`; tightened `cues`/`result`/`settings` fields (AC-2/3/4)
- [x] `subtitle.ts` + `subtitleSearch.ts` — casts removed (`cues`, `result`, `result.source`) (AC-2/3/6)
- [x] `entities/settings/settingsPatch.ts` — `sanitizeSettingsPatch` + rules table + enum fields (AC-4)
- [x] `settings.ts` — merge + eager setters read sanitized patch only (AC-4)
- [x] `dictionarySchemas.ts` — `lookupRequestSchema` replaces `z.custom<LookupRequest>` (AC-5)
- [x] Tests — `trackSchemas.test.ts`, `settingsPatch.test.ts`, `detectionDispatch.test.ts`, `settings.test.ts`; schema cases appended to `schema.test.ts`/`dictionarySchemas.test.ts`; integration.test.ts cue fixtures updated to real `BilingualCue` shape (AC-7)
- [x] Gates — typecheck ✓ · lint ✓ · test:unit 6619 ✓ · build ✓ (AC-8)
- [x] `docs/2-architechture-system.md` — schema.ts row + settingsPatch row + trackSchemas row
- [ ] Fresh-context verify → `docs/reviews/message-validation-thread-verify.md`
- [ ] Ship — backlog row + wiki changelog + commits
