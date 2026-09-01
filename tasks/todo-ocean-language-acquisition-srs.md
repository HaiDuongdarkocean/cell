# Ocean Language Acquisition SRS — Task Checklist

## Phase 0: T0 & Domain Foundation

- [ ] **Task 1: T0 spike — `ts-fsrs` bundle compat + adapter interface**
  - [ ] Pin `ts-fsrs@5.4.1` in `package.json` and install.
  - [ ] Verify bundle in Vite build / extension page.
  - [ ] Commit `SrsFsrsAdapter` interface in `src/entities/srs/types.ts`.
  - [ ] Skeleton `src/features/srs/services/srsFsrsAdapter.ts` and spike test.
  - [ ] Verify `npm run typecheck`, `npm run test:unit -- srsFsrsAdapter`, `npm run build`.

- [ ] **Task 2: Domain types, Zod schemas, and shared helpers**
  - [ ] Define all SRS types in `src/entities/srs/types.ts`.
  - [ ] Add Zod schemas in `src/entities/srs/schemas.ts`.
  - [ ] Implement helpers in `src/features/srs/lib/helpers.ts`.
  - [ ] Write `src/features/srs/lib/helpers.test.ts`.
  - [ ] Verify `npm run typecheck`, `npm run test:unit -- helpers`.

- [ ] **Task 3: `SrsDatabase` IndexedDB bootstrap**
  - [ ] Create `src/features/srs/repositories/srsDatabase.ts` with all stores/indexes.
  - [ ] Write `src/features/srs/repositories/srsDatabase.test.ts`.
  - [ ] Verify `npm run typecheck`, `npm run test:unit -- srsDatabase`.

### Checkpoint 0: Foundation
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes for `srsFsrsAdapter`, `helpers`, `srsDatabase`.
- [ ] Domain model and adapter interface reviewed.

## Phase 1: Settings & Repository Skeleton

- [ ] **Task 4: Settings v26 → v27 migration + `SrsSettingsSlice`**
  - [ ] Add `SrsSettingsSlice` to `src/entities/settings/types.ts`.
  - [ ] Add defaults to `src/shared/config/config.ts`.
  - [ ] Bump `CURRENT_SCHEMA_VERSION` and add migration in `src/shared/lib/storage/settingsStore.ts`.
  - [ ] Verify migration test passes.

- [ ] **Task 5: Collection / deck / study-config repositories**
  - [ ] `src/features/srs/repositories/collectionRepository.ts`.
  - [ ] `src/features/srs/repositories/deckRepository.ts`.
  - [ ] `src/features/srs/repositories/studyConfigRepository.ts`.
  - [ ] `src/features/srs/repositories/srsMetaRepositories.test.ts`.
  - [ ] Verify `npm run test:unit -- srsMetaRepositories`.

- [ ] **Task 6: Notetype repository**
  - [ ] `src/features/srs/repositories/notetypeRepository.ts`.
  - [ ] `src/features/srs/repositories/notetypeRepository.test.ts`.
  - [ ] Verify `npm run test:unit -- notetypeRepository`.

- [ ] **Task 7: Note / card repositories**
  - [ ] `src/features/srs/repositories/noteRepository.ts`.
  - [ ] `src/features/srs/repositories/cardRepository.ts`.
  - [ ] `src/features/srs/repositories/noteCardRepository.test.ts`.
  - [ ] Verify `npm run test:unit -- noteCardRepository`.

### Checkpoint 1: Repository Skeleton
- [ ] `npm run typecheck` passes.
- [ ] All repository unit tests pass.
- [ ] Manual DevTools check of `cell-srs-{hash}` stores/indexes.

## Phase 2: Asset Repositories & Defaults

- [ ] **Task 8: Audio / image / review-event repositories + delete cascade**
  - [ ] `src/features/srs/repositories/audioAssetRepository.ts`.
  - [ ] `src/features/srs/repositories/imageAssetRepository.ts`.
  - [ ] `src/features/srs/repositories/reviewEventRepository.ts`.
  - [ ] `src/features/srs/repositories/deleteCascade.ts`.
  - [ ] `src/features/srs/repositories/assetReviewRepository.test.ts`.
  - [ ] Verify `npm run test:unit -- assetReviewRepository`.

- [ ] **Task 9: Default notetype seed + first-run bootstrap**
  - [ ] `src/features/srs/lib/defaultNotetype.ts` with 8 front templates.
  - [ ] `src/features/srs/services/firstRunService.ts`.
  - [ ] `src/features/srs/services/firstRunService.test.ts`.
  - [ ] Verify manual first-run creates default collection/deck/notetype.

### Checkpoint 2: Defaults
- [ ] `npm run typecheck` passes.
- [ ] First-run service test passes.
- [ ] Manual first-run default creation works.

## Phase 3: Offline Media Cache

- [ ] **Task 10: Audio / image asset cache service + LRU / quota**
  - [ ] `src/features/srs/services/audioAssetCache.ts`.
  - [ ] `src/features/srs/services/imageAssetCache.ts`.
  - [ ] `src/features/srs/services/quotaManager.ts`.
  - [ ] `src/features/srs/services/assetCache.test.ts`.
  - [ ] Verify `npm run test:unit -- assetCache`.

- [ ] **Task 11: Audio / image stimulus resolvers + blob URL lifecycle**
  - [ ] `src/features/srs/services/audioStimulusResolver.ts`.
  - [ ] `src/features/srs/services/imageStimulusResolver.ts`.
  - [ ] `src/features/srs/services/stimulusResolverService.test.ts`.
  - [ ] Verify `npm run test:unit -- stimulusResolverService`.

### Checkpoint 3: Media Cache
- [ ] Audio/image cache tests pass.
- [ ] Manual offline audio playback from cached blob works.

## Phase 4: Core Review Logic

- [ ] **Task 12: FSRS adapter implementation**
  - [ ] Complete `src/features/srs/services/srsFsrsAdapter.ts`.
  - [ ] `src/features/srs/services/srsFsrsAdapter.test.ts`.
  - [ ] Verify mapping `forget`→`Rating.Again`, `remember`→`Rating.Good`, `preserveDue`.

- [ ] **Task 13: Progress & learning path logic**
  - [ ] `src/features/srs/logic/progressCalculator.ts`.
  - [ ] `src/features/srs/logic/learningPath.ts`.
  - [ ] `src/features/srs/logic/progressCalculator.test.ts`.
  - [ ] `src/features/srs/logic/learningPath.test.ts`.
  - [ ] Verify `npm run test:unit -- progressCalculator` and `npm run test:unit -- learningPath`.

- [ ] **Task 14: Review engine — `applyReview`, `studyAgain`, `resetComponent`, `resetCard`**
  - [ ] `src/features/srs/logic/reviewEngine.ts`.
  - [ ] `src/features/srs/logic/reviewEngine.test.ts`.
  - [ ] Verify explore/normal/studyAgain modes, reset, and spelling correctness.

### Checkpoint 4: Core Review Logic
- [ ] `npm run test:unit` passes for FSRS adapter, progress/learning path, review engine.
- [ ] Unit test traceability to AC A3–A9 reviewed.

## Phase 5: Scheduler & Review Surface

- [ ] **Task 15: `resolvePool` + `pickHighestPriority`**
  - [ ] `src/features/srs/logic/resolvePool.ts`.
  - [ ] `src/features/srs/logic/pickHighestPriority.ts`.
  - [ ] `src/features/srs/logic/resolvePool.test.ts`.
  - [ ] Verify `npm run test:unit -- resolvePool`.

- [ ] **Task 16: `selectNextReview` with `by_deck_due` cursor**
  - [ ] `src/features/srs/logic/scheduler.ts`.
  - [ ] `src/features/srs/logic/scheduler.test.ts`.
  - [ ] Verify no async fetch inside cursor; manual 1000-card profile.

- [ ] **Task 17: `resolveReviewSurface` + `maskSentence` + stimulus builder**
  - [ ] `src/features/srs/logic/stimulusResolver.ts`.
  - [ ] `src/features/srs/logic/maskSentence.ts`.
  - [ ] `src/features/srs/logic/stimulusResolver.test.ts`.
  - [ ] Verify `npm run test:unit -- stimulusResolver`.

### Checkpoint 5: Scheduler
- [ ] `npm run test:unit` passes for `resolvePool`, `scheduler`, `stimulusResolver`.
- [ ] Manual scheduler returns a review session for a seeded card.

## Phase 6: Study UI Shell

- [ ] **Task 18: `srs-study` entrypoint + build wiring**
  - [ ] `src/entrypoints/srs-study/index.html`.
  - [ ] `src/entrypoints/srs-study/main.tsx`.
  - [ ] `src/entrypoints/srs-study/App.tsx`.
  - [ ] Add `srsStudy` to `vite.config.ts`.
  - [ ] Add to `public/manifest.json` web_accessible_resources.
  - [ ] Verify `npm run build` and manual page open.

- [ ] **Task 19: Study session provider + hooks**
  - [ ] `src/entrypoints/srs-study/providers/SrsStudyProvider.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useStudySession.ts`.
  - [ ] `src/entrypoints/srs-study/hooks/useSrsDashboard.ts`.
  - [ ] `src/entrypoints/srs-study/hooks/useStudySession.test.tsx`.
  - [ ] Verify `npm run test:unit -- useStudySession`.

- [ ] **Task 20: Dashboard header + empty / first-run states**
  - [ ] `src/entrypoints/srs-study/pages/SrsDashboard.tsx`.
  - [ ] `src/entrypoints/srs-study/components/LanguageProfileSelector.tsx`.
  - [ ] `src/entrypoints/srs-study/components/SrsHeader.tsx`.
  - [ ] `src/entrypoints/srs-study/pages/SrsDashboard.module.css`.
  - [ ] `src/entrypoints/srs-study/pages/SrsDashboard.test.tsx`.
  - [ ] Verify `npm run test:unit -- SrsDashboard`.

### Checkpoint 6: Study UI Shell
- [ ] Dashboard renders with real due counts.
- [ ] Study session provider can start and advance a review.
- [ ] Build passes and the entrypoint is reachable.

## Phase 7: Management UI

- [ ] **Task 21: Deck manager UI**
  - [ ] `src/entrypoints/srs-study/pages/DeckManager.tsx`.
  - [ ] `src/entrypoints/srs-study/components/DeckList.tsx`.
  - [ ] `src/entrypoints/srs-study/components/DeckForm.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useDeckManager.ts`.
  - [ ] `src/entrypoints/srs-study/pages/DeckManager.module.css`.
  - [ ] Verify `npm run test:unit -- DeckManager`.

- [ ] **Task 22: Notetype manager UI**
  - [ ] `src/entrypoints/srs-study/pages/NotetypeManager.tsx`.
  - [ ] `src/entrypoints/srs-study/components/NotetypeList.tsx`.
  - [ ] `src/entrypoints/srs-study/components/NotetypeForm.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useNotetypeManager.ts`.
  - [ ] `src/entrypoints/srs-study/pages/NotetypeManager.module.css`.
  - [ ] Verify `npm run test:unit -- NotetypeManager`.

- [ ] **Task 23: SRS settings UI**
  - [ ] `src/entrypoints/srs-study/pages/SrsSettingsPanel.tsx`.
  - [ ] `src/entrypoints/srs-study/components/SrsSettingsForm.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useSrsSettings.ts`.
  - [ ] `src/entrypoints/srs-study/pages/SrsSettingsPanel.module.css`.
  - [ ] `src/entrypoints/srs-study/pages/SrsSettingsPanel.test.tsx`.
  - [ ] Verify `npm run test:unit -- SrsSettingsPanel`.

### Checkpoint 7: Management
- [ ] Deck, notetype, and settings UIs can create/edit/persist data.
- [ ] All management tests pass.

## Phase 8: Review Card UI

- [ ] **Task 24: Review front shell + non-audio stimuli**
  - [ ] `src/entrypoints/srs-study/components/ReviewFront.tsx`.
  - [ ] `src/entrypoints/srs-study/components/StimulusText.tsx`.
  - [ ] `src/entrypoints/srs-study/components/StimulusImage.tsx`.
  - [ ] `src/entrypoints/srs-study/components/ReviewFront.module.css`.
  - [ ] `src/entrypoints/srs-study/components/ReviewFront.test.tsx`.
  - [ ] Verify `npm run test:unit -- ReviewFront`.

- [ ] **Task 25: Audio stimulus playback**
  - [ ] `src/entrypoints/srs-study/components/StimulusAudio.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useAudioStimulus.ts`.
  - [ ] `src/entrypoints/srs-study/components/StimulusAudio.test.tsx`.
  - [ ] Verify `npm run test:unit -- StimulusAudio`.

- [ ] **Task 26: Back surface renderer**
  - [ ] `src/entrypoints/srs-study/components/ReviewBack.tsx`.
  - [ ] `src/entrypoints/srs-study/components/FieldRenderer.tsx`.
  - [ ] `src/entrypoints/srs-study/components/ReviewBack.module.css`.
  - [ ] `src/entrypoints/srs-study/components/ReviewBack.test.tsx`.
  - [ ] Verify `npm run test:unit -- ReviewBack`.

- [ ] **Task 27: Progress bars + component status**
  - [ ] `src/entrypoints/srs-study/components/ProgressBars.tsx`.
  - [ ] `src/entrypoints/srs-study/components/ComponentProgress.tsx`.
  - [ ] `src/entrypoints/srs-study/components/ProgressBars.module.css`.
  - [ ] `src/entrypoints/srs-study/components/ProgressBars.test.tsx`.
  - [ ] Verify `npm run test:unit -- ProgressBars`.

- [ ] **Task 28: Review controls — Forget / Remember, Study Again, Reset**
  - [ ] `src/entrypoints/srs-study/components/ReviewControls.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useReviewActions.ts`.
  - [ ] `src/entrypoints/srs-study/components/ReviewControls.module.css`.
  - [ ] `src/entrypoints/srs-study/components/ReviewControls.test.tsx`.
  - [ ] Verify `npm run test:unit -- ReviewControls`.

### Checkpoint 8: Review Card
- [ ] Review front, back, audio, progress, and controls render and wire correctly.
- [ ] Forget/Remember/Reset/Study Again behave correctly in smoke.

## Phase 9: Spelling Input

- [ ] **Task 29: Spelling input + live validation + auto-submit**
  - [ ] `src/entrypoints/srs-study/components/SpellingInput.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useSpelling.ts`.
  - [ ] `src/entrypoints/srs-study/components/SpellingInput.module.css`.
  - [ ] `src/entrypoints/srs-study/components/SpellingInput.test.tsx`.
  - [ ] Verify `npm run test:unit -- SpellingInput`.

- [ ] **Task 30: Spelling auto-advance + reveal feedback**
  - [ ] `src/entrypoints/srs-study/components/SpellingFeedback.tsx`.
  - [ ] `src/entrypoints/srs-study/hooks/useSpellingAutoAdvance.ts`.
  - [ ] `src/entrypoints/srs-study/components/SpellingFeedback.test.tsx`.
  - [ ] Verify `npm run test:unit -- SpellingFeedback`.

### Checkpoint 9: Spelling
- [ ] Spelling auto-submit, feedback, and auto-advance work end-to-end.
- [ ] AC A5 and A6 pass in tests.

## Phase 10: Cross-context Add

- [ ] **Task 31: MV3 message types + Zod schemas**
  - [ ] Update `src/entities/message/types.ts` with SRS message payloads.
  - [ ] `src/features/srs/messageSchemas.ts`.
  - [ ] `src/features/srs/messageSchemas.test.ts`.
  - [ ] Verify `npm run test:unit -- messageSchemas`.

- [ ] **Task 32: Background SRS message handlers**
  - [ ] `src/entrypoints/background/handlers/srs.ts`.
  - [ ] Register in `src/entrypoints/background/index.ts`.
  - [ ] `src/entrypoints/background/handlers/srs.test.ts`.
  - [ ] Verify `npm run test:unit -- srsHandler`.

- [ ] **Task 33: Card Creator `'ocean-srs'` destination**
  - [ ] Update `src/features/cardCreator/types.ts`.
  - [ ] `src/features/cardCreator/service/srsAddNote.ts`.
  - [ ] `src/features/cardCreator/service/srsAddNote.test.ts`.
  - [ ] Update `CardCreatorDialog.tsx` / `CardCreatorDialogContent.tsx` for SRS selectors.
  - [ ] Verify `npm run test:unit -- srsAddNote`.

- [ ] **Task 34: Dictionary popup SRS destination selector + flow**
  - [ ] Update `src/entities/settings/types.ts` and `src/shared/config/config.ts` for `srsDestination`.
  - [ ] Update `src/features/settings/ui/DictionaryPopupSettingsPanel.tsx`.
  - [ ] Update `src/features/dictionaryPopup/ui/CandidateView.tsx` or `DictionaryToolbar.tsx`.
  - [ ] Update `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`.
  - [ ] Verify manual Add to Ocean SRS works.

### Checkpoint 10: Cross-context Add
- [ ] `SRS_ADD_NOTE` creates a card from dictionary/Card Creator.
- [ ] `SRS_GET_DECKS_NOTETYPES` returns correct defaults.
- [ ] Manual end-to-end: dictionary → Add to Ocean SRS → study page shows word.

## Phase 11: Verify & Polish

- [ ] **Task 35: E2E browser test**
  - [ ] `e2e/ocean-srs.spec.ts`.
  - [ ] Cover first-run, add word, review Sound/Meaning/Spelling, switch language, offline audio.
  - [ ] Verify `npm run test:e2e -- ocean-srs`.

- [ ] **Task 36: Pre-commit gate + docs / ADR updates**
  - [ ] `npm run lint`.
  - [ ] `npx tsc --noEmit`.
  - [ ] `npm run test:unit`.
  - [ ] `npm run build`.
  - [ ] `design-system-guardian` if UI touched.
  - [ ] Update `docs/intent/ocean-language-acquisition-srs.md`.
  - [ ] Update `docs/specs/ocean-language-acquisition-srs.md`.
  - [ ] Update `docs/2-architechture-system.md` if needed.
  - [ ] Add `docs/ADRs/adr-srs-fsrs-adapter.md`.

### Checkpoint 11: Complete
- [ ] All quality gates pass.
- [ ] All AC A1–A20 traceable to tests.
- [ ] Docs and ADRs updated.
- [ ] PR ready for review.
