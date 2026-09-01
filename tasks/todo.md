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

- [x] **Task 6: Settings schema migration**
  - [x] Add `PronunciationSettings` + `AudioEngineKind` to `src/entities/settings/types.ts`.
  - [x] Add defaults to `src/shared/config/config.ts`.
  - [x] Bump `CURRENT_SCHEMA_VERSION` 24 → 26 + migration in `src/shared/lib/storage/settingsStore.ts`.
  - [x] Update tests.
  - [x] Verify migration.

### Checkpoint 2
- [x] Phoneme engine creates PronunciationResult from text.
- [x] Settings migration tests pass.

## Phase 3: Audio Source Abstraction

- [x] **Task 7: Refactor TtsEngine / audio source chain**
  - [x] Define `PronunciationAudioOrchestrator` with provider chain.
  - [x] Implement providers: `LocalAudioProvider`, `CommunityAudioProvider`, `TtsAudioProvider`, `SupertonicAudioProvider`, `EspeakAudioProvider`.
  - [x] Support `audioBytes` (local audio) in AudioPanel/PronunciationPanel.
  - [x] Verify no TTS regression.

- [x] **Task 8: eSpeak TTS audio runner (offscreen)**
  - [x] Create `src/entrypoints/offscreen/pronunciationRunner.ts`.
  - [x] Add background handler `PRONUNCIATION_ESPEAK_TTS`.
  - [x] Load eSpeak TTS data on-demand from jsDelivr CDN.
  - [x] Encode eSpeak samples to WAV in offscreen document.

### Checkpoint 3
- [x] Word/sentence audio plays through chain.
- [x] eSpeak audio source works when selected.

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

- [x] **Task 12: Pronunciation settings UI**
  - [x] Create `src/features/settings/ui/PronunciationSettingsPanel.tsx`.
  - [x] Allow reorder fallback engines + toggle eSpeak download.
  - [x] Wire into options page.

### Checkpoint 4
- [ ] Phoneme click play/highlight works.
- [ ] Settings UI persists and migrates.

## Phase 5: Verify & Polish

- [x] **Task 13: E2E / browser verify**
  - [x] Fix and run `e2e/showcase-pronunciation.spec.ts`.
  - [x] E2E passes for pronunciation panel.

- [x] **Task 14: Pre-commit gate**
  - [x] `npm run lint`
  - [x] `npx tsc --noEmit`
  - [x] `npm run test:unit`
  - [x] `npm run build`
  - [x] `design-system-guardian` if UI touched

### Checkpoint 5
- [x] All gates pass.
- [x] PR ready.
