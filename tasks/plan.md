# Implementation Plan: Ocean Pronunciation Engine

## Overview

Tích hợp `@jocelyn-stericker/espeak-phonemes` vào Cell để biến text tiếng Anh thành IPA + phoneme sequence, hiển thị trong dictionary popup, và cho phép user nhấn từng phoneme để play/highlight. Audio cả từ/sentence dùng fallback chain user-selectable: native → Supertonic → browser TTS → eSpeak.

## Architecture Decisions

1. **Phoneme engine chạy trong content/popup**, không offscreen. Vì `@jocelyn-stericker/espeak-phonemes` chỉ ~500 KB (WASM + English data) và không cần audio, nó có thể chạy trực tiếp trong UI context. Điều này giảm độ phức tạp MV3 message và giảm latency IPA.
2. **eSpeak TTS audio (nếu được chọn) chạy trong offscreen document** cùng pattern với Supertonic TTS, vì MV3 service worker không chạy WASM/audio synthesis.
3. **Audio source chain tận dụng `TtsEngine` interface hiện có**. Mỗi audio source implement `TtsEngine`; `PronunciationEngine` chọn source theo user settings + availability.
4. **Phoneme timeline là estimated trong MVP**. Không sample-accurate; chia audio duration theo số phoneme, uniform weighting với accepted risk.
5. **Settings lưu trong `Settings` object**, không tách riêng. Bump schema version từ 24 → 25, thêm `pronunciation` slice (nếu là top-level) hoặc `dictionaryPopup.pronunciation` (nếu là per-profile). Quyết định cụ thể ở Task 6.

## Task List

### Phase 1: Foundation

- [ ] **Task 1: Add dependency + types**
  - Cài `@jocelyn-stericker/espeak-phonemes` (pinned). Cấu hình Vite để bundle/copy `.wasm` + `.tar`.
  - Tạo `src/features/pronunciation/types.ts` với `Phoneme`, `PronunciationResult`, `PronunciationAudio`, `AudioEngineKind`.
  - Files: `package.json`, `vite.config.ts` (assets), `src/features/pronunciation/types.ts`.
  - Verify: `npm install` OK, `npm run typecheck` pass.

- [ ] **Task 2: IPA segmenter + tests**
  - Implement `src/features/pronunciation/services/ipaSegmenter.ts` phân tích IPA string thành mảng `Phoneme`.
  - Xử lý stress marks (`ˈ` `ˌ`) là token riêng; complex phonemes (`tʃ`, `dʒ`, `əʊ`, `aɪ`, `oʊ`, `eə`, `ɪə`, `ʊə`, `ɔɪ`, `aʊ`) là single unit; dùng lookup table.
  - Tests: `src/features/pronunciation/services/ipaSegmenter.test.ts`.
  - Verify: `npm run test:unit -- ipaSegmenter` pass.

- [ ] **Task 3: Phoneme timeline estimator + tests**
  - Implement `src/features/pronunciation/services/phonemeTimelineEstimator.ts`: nhận `Phoneme[]` + audio duration, trả về `Phoneme[]` với `startMs`/`endMs`.
  - Bắt đầu uniform weighting; stress marks không chiếm thời gian audio.
  - Tests: `src/features/pronunciation/services/phonemeTimelineEstimator.test.ts`.
  - Verify: tổng `startMs`/`endMs` bằng audio duration.

### Checkpoint 1

- [ ] `npm run test:unit` pass cho 3 task trên.
- [ ] `npm run typecheck` pass.

### Phase 2: Engine

- [ ] **Task 4: eSpeak phoneme engine wrapper**
  - Implement `src/features/pronunciation/services/espeakPhonemeEngine.ts` gọi `textToIPA` từ `@jocelyn-stericker/espeak-phonemes`.
  - Handle init/lazy singleton; catch Windows ESM path bug (dùng `createESpeak` với `moduleFactory` + `data.archive`).
  - Files: `espeakPhonemeEngine.ts`.
  - Verify: spike-style unit/browser verify: `hello` → `həlˈəʊ`.

- [ ] **Task 5: Pronunciation engine orchestrator**
  - Implement `src/features/pronunciation/services/pronunciationEngine.ts`: gọi `espeakPhonemeEngine` → `ipaSegmenter` → `phonemeTimelineEstimator`, trả về `PronunciationResult`.
  - `PronunciationAudio` được lấy qua audio source chain (Task 7). Trong task này có thể mock audio = null.
  - Tests: `src/features/pronunciation/services/pronunciationEngine.test.ts`.
  - Verify: PronunciationResult shape đúng.

- [ ] **Task 6: Settings schema migration**
  - Thêm `PronunciationSettings` + `AudioEngineKind` vào `src/entities/settings/types.ts`.
  - Thêm defaults vào `src/shared/config/config.ts` (`DEFAULT_SETTINGS` hoặc `DEFAULT_DICTIONARY_POPUP_SETTINGS` nếu là per-profile).
  - Bump `CURRENT_SCHEMA_VERSION` 24 → 25 trong `src/shared/lib/storage/settingsStore.ts`; viết migration v24 → v25.
  - Tests: cập nhật/settings tests hiện có nếu cần.
  - Verify: `loadSettings()` migrate old settings với default pronunciation.

### Checkpoint 2

- [ ] Phoneme engine có thể tạo PronunciationResult từ text.
- [ ] Settings migration pass tests.

### Phase 3: Audio Source Abstraction

- [ ] **Task 7: Refactor `TtsEngine` / `ttsEngineService` cho audio source chain**
  - Định nghĩa `TtsEngine` interface: `{ speak(text, lang): Promise<PronunciationAudio | null>; isAvailable(): boolean; kind: AudioEngineKind }`.
  - Tạo các engines: `NativeAudioEngine`, `SupertonicAudioEngine`, `BrowserTtsEngine`, `EspeakAudioEngine`.
  - `ttsEngineService.ts` chọn engine theo settings fallback chain; trả về `PronunciationAudio` (Float32Array + sampleRate + kind + maybe sourceUrl).
  - Files: `src/features/dictionaryPopup/services/ttsEngineService.ts`, mới `src/features/dictionaryPopup/services/*AudioEngine.ts`.
  - Verify: unit tests pass; không phá vỡ TTS hiện tại.

- [ ] **Task 8: eSpeak TTS audio runner (offscreen)**
  - Tạo `src/entrypoints/offscreen/pronunciationRunner.ts` load `espeakng.js-cdn`, synthesize audio.
  - Thêm message handler background: `PRONUNCIATION_ESPEAK_TTS`.
  - Download eSpeak TTS data on-demand, lưu OPFS/Cache.
  - Files: `src/entrypoints/offscreen/pronunciationRunner.ts`, `src/entrypoints/background/handlers/pronunciation.ts`, `src/entities/message/types.ts`.
  - Verify: eSpeak audio synthesis trong offscreen document.

### Checkpoint 3

- [ ] Audio cả từ có thể phát qua chain.
- [ ] eSpeak audio source hoạt động (nếu được chọn).

### Phase 4: UI

- [ ] **Task 9: PronunciationPanel component**
  - Tạo `src/features/dictionaryPopup/ui/PronunciationPanel.tsx` + `.module.css`.
  - Hiển thị `PronunciationResult.phonemes` dạng các segment có thể click. Highlight segment đang active.
  - Props: `result: PronunciationResult`, `onPlay(phoneme)`, `activePhoneme`.
  - Files: 2 files.
  - Verify: design-system showcase hoặc storybook.

- [ ] **Task 10: Integrate PronunciationPanel into popup**
  - Quyết định vị trí: tích hợp vào `AudioPanel` dưới audio list (MVP) hoặc tab riêng.
  - Cập nhật `CandidateView` để truyền `PronunciationResult` xuống `AudioPanel`.
  - Cập nhật `useCandidate`/`useDictionaryToolbar` để fetch `PronunciationResult` khi term thay đổi.
  - Files: `AudioPanel.tsx`, `CandidateView.tsx`, `useCandidate.ts` hoặc `useDictionaryToolbar.ts`, `types.ts`.
  - Verify: popup hiển thị phoneme list.

- [ ] **Task 11: Phoneme click play/highlight**
  - Implement logic trong `PronunciationPanel` hoặc hook: khi click phoneme, play contextual segment từ `PronunciationAudio`.
  - Dùng `AudioBufferSourceNode` hoặc `<audio>` với `mediaFragment`? Vì audio là Float32Array, dùng Web Audio API.
  - Edge case: audio null → chỉ highlight.
  - Files: `PronunciationPanel.tsx`, helper `src/features/pronunciation/services/phonemeAudioPlayer.ts`.
  - Verify: click phoneme play/highlight; no audio → only highlight.

- [ ] **Task 12: Pronunciation settings UI**
  - Tạo `src/features/settings/ui/PronunciationSettingsPanel.tsx` cho phép reorder `AudioEngineKind[]` và toggle download eSpeak TTS.
  - Wire vào options page (tìm nơi settings panel được đăng ký).
  - Files: 2-3 files.
  - Verify: settings persist + migrate.

### Checkpoint 4

- [ ] Phoneme click play/highlight hoạt động.
- [ ] Settings UI cho phép chọn/reorder audio engines.

### Phase 5: Verify & Polish

- [ ] **Task 13: E2E / browser verify**
  - Viết Playwright test hoặc dùng `testing-extension-browser` skill: mở mock page, mở popup, tra từ, thấy phoneme list, click phoneme, nghe audio.
  - Files: `e2e/pronunciation.spec.ts` hoặc tương đương.
  - Verify: test pass.

- [ ] **Task 14: Pre-commit gate**
  - `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`, `npm run build`.
  - `design-system-guardian` nếu UI thay đổi.
  - Update `docs/2-architechture-system.md` nếu cần.

### Checkpoint 5

- [ ] All gates pass.
- [ ] PR ready.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `@jocelyn-stericker/espeak-phonemes` ESM path bug trên Windows dev | High | Dùng `createESpeak` với `moduleFactory` + `data.archive` thay vì `textToIPA`. |
| Vite không bundle `.wasm`/`.tar` đúng | High | Test build dev + production, dùng `?url` hoặc copy plugin nếu cần. |
| eSpeak TTS data download lớn/lỗi | Med | Download on-demand; fallback lên browser TTS; không bundle. |
| Estimated timeline không chính xác, user cảm thấy click phoneme không khớp audio | Med | Document accepted risk; để user feedback trước khi cải tiến. |
| Offscreen document conflict với existing runners | Med | Add runner vào `ffmpeg.html` và queue messages; test cùng TTS/ocr/ffmpeg. |
| Settings schema migration lỗi trên users cũ | Med | Unit test migration v24→v25; forward-compat via `mergeNestedObjectDefaults`. |

## Open Questions (to resolve in Task 6 or Task 10)

1. **Pronunciation settings nằm top-level (`settings.pronunciation`) hay trong `dictionaryPopup` (`settings.dictionaryPopup.pronunciation`)?** — Gợi ý: nếu pronunciation là global, top-level; nếu per-language-profile, lồng trong `LanguageProfile.dictionaryPopup`. Do MVP English-only, top-level đơn giản hơn.
2. **PronunciationPanel hiển thị trong tab Audio hay tab mới?** — Task 10 quyết định khi có prototype; gợi ý trong Audio tab trước.
