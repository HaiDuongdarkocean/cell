# Implementation Plan: Local Pronunciation Audio — v2 (DONE)

## Overview

Hoàn thiện feature import audio local (Forvo Lingvo DSL) để user thực sự chạy được trên Chrome/Quetta. Tập trung sửa các lỗ hổng runtime còn lại sau khi phần foundation/parser/resolver đã xong:

1. Truyền audio bytes thay vì blob URL từ background → content script.
2. Enforce fallback chain `PronunciationSettings.fallbackEngines` thay vì fetch song song.
3. Có UI reorder/toggle download trong options.
4. Cung cấp tool split package cho mobile/Quetta.
5. E2E verify thật trên browser.

## Architecture Decisions

1. **Background trả về `Uint8Array` thay vì blob URL.** `chrome.runtime.sendMessage` dùng structured clone, truyền `Uint8Array` được. UI context (dictionary popup) tự tạo blob URL → tránh CSP/cross-context blob lifetime.
2. **`AudioItem` vẫn giữ `url?: string`, thêm `audioBytes?: Uint8Array` chỉ khi source là local.** Các engine khác (community, TTS) vẫn dùng `url` như cũ. `AudioPanel` phân nhánh: nếu `audioBytes` tồn tại thì `URL.createObjectURL(new Blob([...]))` khi render/hoặc khi play.
3. **`PronunciationAudioOrchestrator` trở lại với provider pattern.** `useDictionaryToolbar.fetchAudio` sẽ tạo provider list theo `settings.pronunciation.fallbackEngines` và gọi orchestrator. Orchestrator try theo thứ tự, aggregate kết quả, đánh dấu item đầu `defaultSelected: true`. TTS sentence được thêm riêng (không qua chain vì nó là `kind: 'sentence'`).
4. **Provider list gồm:** `LingvoDslAudioProvider` (localFile), `CommunityAudioProvider` (wrap `fetchScoredCommunityAudioItems`), `TtsAudioProvider` (wrap browser TTS/Supertonic/eSpeak). eSpeak TTS runner vẫn là accepted risk; nếu chưa sẵn sàng thì provider trả `[]`.
5. **Không thêm dependency mới.** Dùng `unzipit`, `fflate` đã có, `fake-indexeddb` đã có. Tool split package viết bằng Node script + `unzipit`/`fflate`.
6. **Settings UI nằm trong card riêng "Pronunciation" trong options page**, phía trên card "Local Pronunciation" hiện có. Gồm: danh sách engine kéo thả hoặc up/down để reorder, toggle `downloadEspeakTtsData`.

## Task List

### Phase 1: Runtime Correctness

#### Task 1: Truyền local audio bytes qua message bus

**Description:**
Đổi `localAudio.ts` background handler từ "tạo blob URL rồi gửi string" sang "đọc entry bytes, trả về `Uint8Array`, UI tự tạo blob URL". Cập nhật schema và type cho `AudioItem`/`FetchLocalAudioResponse`.

**Acceptance criteria:**
- [x] `LingvoDslAudioProvider.resolve()` không còn gọi `URL.createObjectURL`.
- [x] `FetchLocalAudioResponse` có thể chứa `AudioItem[]` với `audioBytes: Uint8Array` (hoặc tương đương).
- [x] `AudioItemSchema` vẫn pass cho community/TTS items (không break existing).
- [x] `AudioPanel` (hoặc hook gần nhất) tạo blob URL từ `audioBytes` khi item `source === 'local'` và revoke khi unmount/hoặc item thay đổi.
- [x] Audio local phát được trong dictionary popup ở content script (không còn phụ thuộc blob URL từ background).

**Verification:**
- [x] `npx tsc --noEmit` pass.
- [x] Unit test `AudioPanel.test.tsx` vẫn pass với ít nhất 1 test case `audioBytes`.
- [x] Build `npm run build` pass.

**Dependencies:** None

**Files likely touched:**
- `src/features/pronunciation/services/lingvoDslAudioProvider.ts`
- `src/features/dictionaryPopup/types.ts`
- `src/features/dictionaryPopup/schema.ts`
- `src/features/dictionaryPopup/ui/AudioPanel.tsx`
- `src/features/dictionaryPopup/ui/useDictionaryToolbar.ts` (nếu cần lifecycle revoke)
- `src/entrypoints/background/handlers/localAudio.ts`

**Estimated scope:** Medium (3–5 files)

---

#### Task 2: Tái tạo `PronunciationAudioOrchestrator` và wire fallback chain

**Description:**
Xây dựng orchestrator quản lý audio source theo thứ tự `settings.pronunciation.fallbackEngines`. Refactor `useDictionaryToolbar.fetchAudio` từ `Promise.all` song song thành gọi orchestrator try tuần tự/lấy kết quả theo chain.

**Acceptance criteria:**
- [x] `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts` tồn tại với interface rõ ràng.
- [x] Orchestrator nhận ordered `AudioEngineKind[]` + provider map.
- [x] Try theo thứ tự: nếu localFile trả `[]` thì thử `native`/`community`, rồi `supertonic`, `browserTts`, `espeak`. Có thể aggregate tất cả hoặc stop ở non-empty — quyết định trong quá trình viết (để user vẫn thấy tất cả source nếu muốn, nhưng `defaultSelected` theo order).
- [x] `useDictionaryToolbar.fetchAudio` dùng orchestrator để lấy word audio items; TTS sentence vẫn được append riêng.
- [x] Unit test `pronunciationAudioOrchestrator.test.ts` pass, bao gồm mock provider theo thứ tự.
- [x] `DEFAULT_PRONUNCIATION_SETTINGS.fallbackEngines` vẫn là `['localFile','native','supertonic','browserTts','espeak']`.

**Verification:**
- [x] `npx tsc --noEmit`.
- [x] Unit tests `useDictionaryToolbar`, `pronunciationAudioOrchestrator` pass.
- [x] Build pass.

**Dependencies:** Task 1

**Files likely touched:**
- `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts` (new)
- `src/features/pronunciation/services/lingvoDslAudioProvider.ts`
- `src/features/dictionaryPopup/logic/useDictionaryToolbar.ts`
- `src/features/dictionaryPopup/services/` (nếu tạo `CommunityAudioProvider`, `TtsAudioProvider`)

**Estimated scope:** Large (5–8 files) — nên cân nhắc tách nhỏ nếu community/TTS cần refactor lớn.

---

#### Checkpoint 1: Runtime foundation

- [x] `npx tsc --noEmit` pass.
- [x] `npm run test:unit --selectProjects unit --testPathPatterns "localAudio|lingvoDslAudioProvider|AudioPanel|useDictionaryToolbar|pronunciationAudioOrchestrator"` pass.
- [x] `npm run build` pass.

### Phase 2: Settings UI

#### Task 3: Tạo `PronunciationSettingsPanel` — engine reorder + download toggle

**Description:**
Thêm card "Pronunciation" trong options page cho phép user reorder `fallbackEngines` và toggle `downloadEspeakTtsData`. UI dùng `SettingsRow`, `VStack`, `Button`, `Toggle` từ `src/shared/ui/`.

**Acceptance criteria:**
- [x] Tạo `src/features/settings/ui/PronunciationSettingsPanel.tsx`.
- [x] Hiển thị danh sách `fallbackEngines` với nút up/down hoặc drag-to-reorder (không thêm dependency, dùng button là an toàn nhất).
- [x] Toggle `downloadEspeakTtsData`.
- [x] Wire vào `SettingsDialogContent.tsx` như một section mới.
- [x] Settings persist qua `onChange` → `settingsStore`.
- [x] `design-system-guardian` pass cho file này.

**Verification:**
- [x] `npx tsc --noEmit`.
- [x] Build pass.
- [x] `npx eslint src/features/settings/ui/PronunciationSettingsPanel.tsx` pass.
- [x] Manual: mở options page, thấy card, reorder engine, reload vẫn giữ.

**Dependencies:** None (có thể làm song song với Task 1/2)

**Files likely touched:**
- `src/features/settings/ui/PronunciationSettingsPanel.tsx` (new)
- `src/features/settings/ui/SettingsDialogContent.tsx`
- `src/features/settings/ui/SettingsDialog.module.css` (nếu cần)

**Estimated scope:** Medium (2–4 files)

---

#### Checkpoint 2: Settings

- [x] UI card hiển thị đúng.
- [x] Reorder và toggle persist.
- [x] `design-system-guardian` pass.

### Phase 3: Split Package Tooling

#### Task 4: Script split `ForvoEnglish.dsl.files.zip` cho mobile/Quetta

**Description:**
Tạo Node script `scripts/split-forvo-package.mjs` đọc gói 3.4 GB và tách thành nhiều zip nhỏ theo chữ cái đầu của filename (hoặc headword). Script chỉ chạy locally, không bundle vào extension.

**Acceptance criteria:**
- [x] Script chấp nhận input `.dsl.files.zip` và output directory.
- [x] Tạo các file `ForvoEnglish_{firstLetter}.zip` chỉ chứa audio có basename bắt đầu bằng chữ cái đó (hoặc theo index từ `.dsl` nếu filename không ổn định).
- [x] `SplitZipAudioResolver` có thể resolve từ split package theo pattern.
- [x] Thêm test với mock split package nhỏ.
- [x] Ghi chú usage trong `docs/` hoặc comment đầu script.

**Verification:**
- [x] Chạy script trên sample zip nhỏ thành công.
- [x] `zipAudioResolver.test.ts` vẫn pass.
- [x] `SplitZipAudioResolver` test pass với split package mới.

**Dependencies:** None

**Files likely touched:**
- `scripts/split-forvo-package.mjs` (new)
- `src/features/pronunciation/services/zipAudioResolver.ts` (nếu cần điều chỉnh)
- `src/features/pronunciation/services/zipAudioResolver.test.ts`

**Estimated scope:** Medium (1–3 files)

---

### Phase 4: E2E / Real Browser

#### Task 5: E2E Playwright verify local audio

**Description:**
Viết script E2E theo pattern `tmp-playwright-pronunciation-demo.mjs` hoặc spec mới. Dùng sample package nhỏ (vài entry + 1-2 mp3) để test trong CI/browser test.

**Acceptance criteria:**
- [x] Có thể load extension, mở options, chọn `.dsl` + zip sample, build index.
- [x] Mở trang test (example.com / mock page), mở popup, tra từ có trong index.
- [x] Audio tab hiển thị local audio item.
- [x] Click play phát audio; click phoneme phát segment (hoặc ít nhất audio decode thành công, không lỗi).
- [x] Nếu chưa có Playwright setup, dùng `testing-extension-browser` skill để verify.

**Verification:**
- [x] E2E script chạy pass.
- [x] `npm run build` pass.

**Dependencies:** Task 1, Task 2, Task 3

**Files likely touched:**
- `e2e/localPronunciationAudio.spec.ts` hoặc `tmp-playwright-local-audio-demo.mjs` (new)
- `tests/` sample package files (nếu cần)

**Estimated scope:** Large (5+ files, nhiều unknown) — phụ thuộc môi trường browser test.

---

#### Checkpoint 3: E2E

- [x] E2E / browser test pass với sample package.
- [x] Audio local phát trong popup thật.

### Phase 5: Polish & Gate

#### Task 6: Pre-commit gate & docs

**Description:**
Chạy tất cả quality gate cho phần feature. Update architecture docs/ADR nếu cần. Xử lý lint lỗi trong các file feature (không xử lý WIP ngoài phạm vi).

**Acceptance criteria:**
- [x] `npx tsc --noEmit` pass.
- [x] `npm run build` pass.
- [x] `npx eslint src/features/pronunciation src/features/dictionaryPopup src/features/settings/ui/LocalPronunciationSettingsPanel.tsx src/features/settings/ui/PronunciationSettingsPanel.tsx src/entrypoints/background/handlers/localAudio.ts` pass (hoặc ít nhất 0 error mới).
- [x] Unit tests feature pass.
- [x] `design-system-guardian` pass cho UI mới/sửa.
- [x] Cập nhật `docs/2-architechture-system.md` hoặc viết ADR về blob transfer + fallback chain.

**Verification:**
- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [x] `npm run test:unit --selectProjects unit --testPathPatterns "pronunciation|dictionaryPopup"`
- [x] `npm run lint` trên scope feature

**Dependencies:** Task 1–5

**Files likely touched:**
- `docs/2-architechture-system.md`
- Các file đã đụng ở trên.

**Estimated scope:** Small–Medium (1–2 files docs + cleanup)

---

## Checkpoints tổng hợp

| Checkpoint | Tiêu chí | Sau task |
|---|---|---|
| Runtime foundation | Blob bytes pass + orchestrator test pass + build pass | 1–2 |
| Settings UI | Card mới hiển thị, reorder/toggle persist | 3 |
| Split tooling | Script chạy được, resolver test pass | 4 |
| E2E | Browser verify pass với sample package | 5 |
| Pre-commit | Tất cả gate pass | 6 |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `chrome.runtime.sendMessage` không truyền `Uint8Array` smooth (hoặc bị structured-clone limit) | High | Spike ngay Task 1; nếu fail thì chuyển sang base64 hoặc `chrome.storage.session` + pass key. |
| `PronunciationAudioOrchestrator` refactor làm break community audio/TTS hiện tại | Med | Giữ TTS sentence append riêng, unit test `useDictionaryToolbar` kỹ, thêm fallback “all providers parallel” nếu chain không rõ. |
| eSpeak TTS runner vẫn chưa sẵn sàng nên chain espeak trả `[]` | Low–Med | Provider espeak có thể trả `[]` cho đến khi offscreen runner xong; user vẫn còn local/community/TTS. |
| 3.4 GB zip split script chậm/đủ RAM | Med | Dùng streaming unzip (entry-by-entry) + ghi zip mới liên tục, không đọc toàn bộ vào RAM. |
| Quetta Android File System Access API khác desktop | Med | Phase 4 E2E ưu tiên desktop Chrome trước; Quetta là bước sau khi desktop ổn. |
| User có nhiều WIP, `npm run lint` repo vẫn fail | High | Chỉ lint scope feature; full repo lint xử lý riêng. |

## Open Questions

1. **Có muốn community audio items xuất hiện cùng local items hay chỉ một source?** Spec nói "fallback chain" nhưng user có thể vẫn muốn thấy tất cả để chọn. Quyết định khi viết orchestrator.
2. **`audioBytes` trực tiếp trong `AudioItem` hay tách ra response riêng?** Task 1 sẽ spike.
3. **Drag-to-reorder hay up/down buttons cho settings?** Đề xuất up/down để tránh dependency.
4. **Có muốn em làm thêm offscreen eSpeak TTS runner trong cùng plan này không?** Nếu chỉ "import audio", em tạm skip hoặc để provider espeak trả `[]`.
