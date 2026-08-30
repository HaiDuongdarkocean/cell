# TODO: Local Pronunciation Audio — v2 (DONE)

## Phase 1: Runtime Correctness

- [x] **Task 1: Truyền local audio bytes qua message bus**
  - [x] Đổi `LingvoDslAudioProvider.resolve()` từ tạo `URL.createObjectURL` sang trả `Uint8Array` / `ArrayBuffer`.
  - [x] Cập nhật `AudioItem` type + `AudioItemSchema` cho `audioBytes` (hoặc tách response mới).
  - [x] Cập nhật `FetchLocalAudioResponseSchema`.
  - [x] `AudioPanel` tạo blob URL từ `audioBytes` khi `source === 'local'`, revoke đúng lifecycle.
  - [x] Cập nhật `localAudio.ts` background handler trả bytes thay vì blob URL.
  - [x] Viết/thêm unit test cho `AudioPanel` với `audioBytes`.
  - [x] Verify: `npx tsc --noEmit`, `npm run build`, unit tests pass.

- [x] **Task 2: Tái tạo `PronunciationAudioOrchestrator` và wire fallback chain**
  - [x] Tạo `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts`.
  - [x] Định nghĩa provider interface / wrap `LingvoDslAudioProvider`, community audio, TTS.
  - [x] Orchestrator try theo `settings.pronunciation.fallbackEngines`, aggregate / mark `defaultSelected`.
  - [x] Refactor `useDictionaryToolbar.fetchAudio` dùng orchestrator thay vì `Promise.all` song song.
  - [x] Giữ TTS sentence append riêng.
  - [x] Viết `pronunciationAudioOrchestrator.test.ts`.
  - [x] Verify: `npx tsc --noEmit`, unit tests pass, build pass.

### Checkpoint 1
- [x] `npx tsc --noEmit` pass.
- [x] `npm run test:unit --selectProjects unit --testPathPatterns "localAudio|lingvoDslAudioProvider|AudioPanel|useDictionaryToolbar|pronunciationAudioOrchestrator"` pass.
- [x] `npm run build` pass.

## Phase 2: Settings UI

- [x] **Task 3: Tạo `PronunciationSettingsPanel` — engine reorder + download toggle**
  - [x] Tạo `src/features/settings/ui/PronunciationSettingsPanel.tsx`.
  - [x] Hiển thị `fallbackEngines` với up/down buttons (hoặc drag nếu quyết định).
  - [x] Toggle `downloadEspeakTtsData`.
  - [x] Wire vào `SettingsDialogContent.tsx` thành card "Pronunciation".
  - [x] Persist settings qua `onChange`.
  - [x] Run `design-system-guardian`.
  - [x] Verify: tsc, build, eslint, manual settings reload.

### Checkpoint 2
- [x] Card hiển thị đúng.
- [x] Reorder + toggle persist.
- [x] `design-system-guardian` pass.

## Phase 3: Split Package Tooling

- [x] **Task 4: Script split `ForvoEnglish.dsl.files.zip` cho mobile/Quetta**
  - [x] Tạo `scripts/split-forvo-package.mjs`.
  - [x] Đọc zip gốc và ghi các `ForvoEnglish_{firstLetter}.zip`.
  - [x] Đảm bảo `SplitZipAudioResolver` vẫn khớp pattern.
  - [x] Thêm test với mock split package.
  - [x] Verify: script chạy trên sample, resolver tests pass.

### Checkpoint 3
- [x] Script chạy được.
- [x] `SplitZipAudioResolver` test pass.

## Phase 4: E2E / Real Browser

- [x] **Task 5: E2E Playwright verify local audio**
  - [x] Tạo `e2e/localPronunciationAudio.spec.ts` hoặc `tmp-playwright-local-audio-demo.mjs`.
  - [x] Dùng sample package nhỏ.
  - [x] Load extension, options, build index.
  - [x] Open mock page, tra từ, kiểm tra local audio item xuất hiện.
  - [x] Click play audio và click phoneme (nếu có thể).
  - [x] Verify: E2E script pass.

### Checkpoint 4
- [x] Browser test pass.
- [x] Audio phát trong popup thật.

## Phase 5: Polish & Gate

- [x] **Task 6: Pre-commit gate & docs**
  - [x] Chạy `npx tsc --noEmit`.
  - [x] Chạy `npm run build`.
  - [x] Lint scope feature: `npx eslint src/features/pronunciation src/features/dictionaryPopup src/features/settings/ui/LocalPronunciationSettingsPanel.tsx src/features/settings/ui/PronunciationSettingsPanel.tsx src/entrypoints/background/handlers/localAudio.ts`.
  - [x] Unit tests scope feature pass.
  - [x] `design-system-guardian` pass.
  - [x] Cập nhật `docs/2-architechture-system.md` hoặc viết ADR về blob transfer + fallback chain.

### Checkpoint 5
- [x] All gates pass.
- [x] Docs updated.
