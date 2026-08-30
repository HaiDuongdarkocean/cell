# Ocean Pronunciation Engine — Task Checklist

## Phase 1: Foundation

- [ ] **Task 1: Add dependency + types**
  - [ ] Install `@jocelyn-stericker/espeak-phonemes` (pin version).
  - [ ] Configure Vite to bundle/copy `.wasm` + `.tar`.
  - [ ] Create `src/features/pronunciation/types.ts`.
  - [ ] Verify `npm run typecheck`.

- [ ] **Task 2: IPA segmenter + tests**
  - [ ] Implement `src/features/pronunciation/services/ipaSegmenter.ts`.
  - [ ] Write `src/features/pronunciation/services/ipaSegmenter.test.ts`.
  - [ ] Verify `npm run test:unit -- ipaSegmenter`.

- [ ] **Task 3: Phoneme timeline estimator + tests**
  - [ ] Implement `src/features/pronunciation/services/phonemeTimelineEstimator.ts`.
  - [ ] Write `src/features/pronunciation/services/phonemeTimelineEstimator.test.ts`.
  - [ ] Verify `npm run test:unit -- phonemeTimelineEstimator`.

### Checkpoint 1
- [ ] `npm run test:unit` pass for Phase 1.
- [ ] `npm run typecheck` pass.

## Phase 2: Engine

- [ ] **Task 4: eSpeak phoneme engine wrapper**
  - [ ] Implement `src/features/pronunciation/services/espeakPhonemeEngine.ts`.
  - [ ] Handle Windows ESM path bug via `createESpeak`.
  - [ ] Verify `hello` → `həlˈəʊ`.

- [ ] **Task 5: Pronunciation engine orchestrator**
  - [ ] Implement `src/features/pronunciation/services/pronunciationEngine.ts`.
  - [ ] Write `src/features/pronunciation/services/pronunciationEngine.test.ts`.
  - [ ] Verify PronunciationResult shape.

- [ ] **Task 6: Settings schema migration**
  - [ ] Add `PronunciationSettings` + `AudioEngineKind` to `src/entities/settings/types.ts`.
  - [ ] Add defaults to `src/shared/config/config.ts`.
  - [ ] Bump `CURRENT_SCHEMA_VERSION` 24 → 25 + migration in `src/shared/lib/storage/settingsStore.ts`.
  - [ ] Update tests.
  - [ ] Verify migration.

### Checkpoint 2
- [ ] Phoneme engine creates PronunciationResult from text.
- [ ] Settings migration tests pass.

## Phase 3: Audio Source Abstraction

- [ ] **Task 7: Refactor TtsEngine / audio source chain**
  - [ ] Define `TtsEngine` interface with `PronunciationAudio`.
  - [ ] Implement engines: `NativeAudioEngine`, `SupertonicAudioEngine`, `BrowserTtsEngine`, `EspeakAudioEngine`.
  - [ ] Update `ttsEngineService.ts`.
  - [ ] Verify no TTS regression.

- [ ] **Task 8: eSpeak TTS audio runner (offscreen)**
  - [ ] Create `src/entrypoints/offscreen/pronunciationRunner.ts`.
  - [ ] Add background handler `PRONUNCIATION_ESPEAK_TTS`.
  - [ ] Download eSpeak TTS data on-demand.
  - [ ] Verify eSpeak audio synthesis in offscreen.

### Checkpoint 3
- [ ] Word/sentence audio plays through chain.
- [ ] eSpeak audio source works when selected.

## Phase 4: UI

- [ ] **Task 9: PronunciationPanel component**
  - [ ] Create `src/features/dictionaryPopup/ui/PronunciationPanel.tsx` + `.module.css`.
  - [ ] Display clickable phoneme segments with highlight.

- [ ] **Task 10: Integrate PronunciationPanel into popup**
  - [ ] Decide placement (Audio tab or new tab).
  - [ ] Update `AudioPanel.tsx` / `CandidateView.tsx` / hooks.
  - [ ] Fetch `PronunciationResult` on term change.

- [ ] **Task 11: Phoneme click play/highlight**
  - [ ] Implement `phonemeAudioPlayer.ts` (Web Audio segment playback).
  - [ ] Wire click in `PronunciationPanel`.
  - [ ] Edge case: no audio → only highlight.

- [ ] **Task 12: Pronunciation settings UI**
  - [ ] Create `src/features/settings/ui/PronunciationSettingsPanel.tsx`.
  - [ ] Allow reorder fallback engines + toggle eSpeak download.
  - [ ] Wire into options page.

### Checkpoint 4
- [ ] Phoneme click play/highlight works.
- [ ] Settings UI persists and migrates.

## Phase 5: Verify & Polish

- [ ] **Task 13: E2E / browser verify**
  - [ ] Write `e2e/pronunciation.spec.ts`.
  - [ ] Run with `testing-extension-browser` skill.

- [ ] **Task 14: Pre-commit gate**
  - [ ] `npm run lint`
  - [ ] `npx tsc --noEmit`
  - [ ] `npm run test:unit`
  - [ ] `npm run build`
  - [ ] `design-system-guardian` if UI touched
  - [ ] Update `docs/2-architechture-system.md` if needed

### Checkpoint 5
- [ ] All gates pass.
- [ ] PR ready.
