# Ocean Pronunciation Engine — Task Checklist

## Phase 1: Foundation

- [x] **Task 1: Add dependency + types**
  - [x] Install `@jocelyn-stericker/espeak-phonemes` (pin version).
  - [x] Configure Vite to bundle/copy `.wasm` + `.tar`.
  - [x] Create `src/features/pronunciation/types.ts`.
  - [x] Verify `npm run typecheck`.

- [x] **Task 2: IPA segmenter + tests**
  - [x] Implement `src/features/pronunciation/services/ipaSegmenter.ts`.
  - [x] Write `src/features/pronunciation/services/ipaSegmenter.test.ts`.
  - [x] Verify `npm run test:unit -- ipaSegmenter`.

- [x] **Task 3: Phoneme timeline estimator + tests**
  - [x] Implement `src/features/pronunciation/services/phonemeTimelineEstimator.ts`.
  - [x] Write `src/features/pronunciation/services/phonemeTimelineEstimator.test.ts`.
  - [x] Verify `npm run test:unit -- phonemeTimelineEstimator`.

### Checkpoint 1
- [x] `npm run test:unit` pass for Phase 1.
- [x] `npm run typecheck` pass.

## Phase 2: Engine

- [x] **Task 4: eSpeak phoneme engine wrapper**
  - [x] Implement `src/features/pronunciation/services/espeakPhonemeEngine.ts`.
  - [x] Handle Windows ESM path bug via `createESpeak`.
  - [x] Verify `hello` → `həlˈəʊ`.

- [x] **Task 5: Pronunciation engine orchestrator**
  - [x] Implement `src/features/pronunciation/services/pronunciationEngine.ts`.
  - [x] Write `src/features/pronunciation/services/pronunciationEngine.test.ts`.
  - [x] Verify PronunciationResult shape.

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

- [x] **Task 9: PronunciationPanel component**
  - [x] Create `src/features/dictionaryPopup/ui/PronunciationPanel.tsx` + `.module.css`.
  - [x] Display clickable phoneme segments with highlight.

- [x] **Task 10: Integrate PronunciationPanel into popup**
  - [x] Decide placement (Audio tab or new tab).
  - [x] Update `AudioPanel.tsx` / `CandidateView.tsx` / hooks.
  - [x] Fetch `PronunciationResult` on term change.

- [x] **Task 11: Phoneme click play/highlight**
  - [x] Implement `phonemeAudioPlayer.ts` (Web Audio segment playback).
  - [x] Wire click in `PronunciationPanel`.
  - [x] Edge case: no audio → only highlight.

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

- [x] **Task 14: Pre-commit gate**
  - [x] `npm run lint`
  - [x] `npx tsc --noEmit`
  - [x] `npm run test:unit`
  - [x] `npm run build`
  - [x] `design-system-guardian` if UI touched
  - [ ] Update `docs/2-architechture-system.md` if needed

### Checkpoint 5
- [ ] All gates pass.
- [ ] PR ready.
