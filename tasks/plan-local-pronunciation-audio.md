# Implementation Plan: Local Pronunciation Audio

## Overview

Tích hợp audio phát âm local (Forvo Lingvo DSL package) vào Cell. User chọn gói Forvo trong options page; extension build index từ `.dsl` và stream audio từ zip theo yêu cầu. Local audio trở thành một source trong fallback chain, hiển thị trong Audio tab, và được dùng bởi `PronunciationPanel` để play segment/phoneme.

## Architecture Decisions

1. **File access dùng File System Access API** — giống `local-video-player.md`, user tự chọn package, không copy 3.4 GB.
2. **File handle persistence qua IndexedDB** — lưu `FileSystemFileHandle`/`FileSystemDirectoryHandle` để tái sử dụng; verify permission trước mỗi lần đọc.
3. **Lingvo DSL là format MVP** — package `D:\...\Forvo English` hoàn chỉnh, dễ parse.
4. **`unzipit` là first choice cho zip** — lazy random access từ `File`/`Blob`, 0 deps, hỗ trợ file lớn. `fflate` giữ lại cho các trường hợp decompress nếu cần.
5. **Provider pattern** — `PronunciationAudioProvider` interface; `LingvoDslAudioProvider`, `CommunityAudioProvider`, `TtsAudioProvider` implement. Orchestrator chạy theo `settings.pronunciation.fallbackEngines`.
6. **Settings migration v25 → v26** — thêm `localFile` subslice vào `PronunciationSettings`; không phá vỡ fallbackEngines hiện tại.
7. **Không bundle audio** — audio đọc từ local zip on demand qua blob URL.
8. **`packageType: 'single' | 'split'`** — `'single'` cho desktop (zip 3.4 GB hiện có), `'split'` cho mobile/Quetta (nhiều zip nhỏ theo chữ cái đầu).

## Task List

### Phase 1: Foundation

- [ ] **Task 1: Extend types and settings schema v26**
  - Thêm `'localFile'` vào `AudioEngineKind` (`src/entities/settings/types.ts`, `src/features/pronunciation/types.ts`).
  - Thêm `'local'` vào `AudioSourceKind` (`src/features/dictionaryPopup/types.ts`) và `AudioSourceKindSchema` (`src/features/dictionaryPopup/schema.ts`).
  - Thêm `LocalFileAudioSettings` vào `PronunciationSettings` (`src/entities/settings/types.ts`):
    - `packageType: 'single' | 'split'`
    - `dslFileHandleId: string | null`
    - `audioArchiveHandleId: string | null`  // single
    - `splitArchiveDirectoryHandleId: string | null`  // split
    - `splitArchivePattern: string`  // e.g. 'ForvoEnglish_{firstLetter}.zip'
    - `lastIndexedAt: number | null`
  - Update `DEFAULT_PRONUNCIATION_SETTINGS` (`src/shared/config/config.ts`).
  - Bump `CURRENT_SCHEMA_VERSION` 25 → 26; viết migration v25 → v26 trong `settingsStore.ts`.
  - Files: 4 files.
  - Verify: `npx tsc --noEmit`, unit tests settings hiện có pass.

- [ ] **Task 2: File handle storage**
  - Implement `src/shared/lib/storage/localFileHandleStorage.ts`:
    - `saveFileHandle(id, handle)` lưu vào IndexedDB.
    - `getFileHandle(id)` trả về handle.
    - `verifyPermission(handle)` gọi `queryPermission`/`requestPermission`.
  - Dùng `fake-indexeddb` cho unit test.
  - Files: 1 file + test.
  - Verify: unit test pass.

### Checkpoint 1

- [ ] Typecheck pass.
- [ ] Settings migration test pass.

### Phase 2: Local Package Parsing

- [ ] **Task 3: Lingvo DSL parser + index storage**
  - Implement `src/features/pronunciation/services/lingvoDsl/lingvoDslParser.ts`:
    - Read `File` (38 MB) as text.
    - Parse headword + `[s]...[/s]` audio paths.
    - Normalize headword: lowercase, trim quotes/punctuation.
    - Return `Map<string, string[]>`.
  - Implement `src/features/pronunciation/services/lingvoDsl/lingvoDslIndexStorage.ts`:
    - Store/retrieve parsed index in IndexedDB.
    - Track `lastIndexedAt`.
  - Tests: `lingvoDslParser.test.ts`, `lingvoDslIndexStorage.test.ts`.
  - Verify: sample DSL entries parse correctly.

- [ ] **Task 4: Zip audio resolver**
  - Implement `src/features/pronunciation/services/lingvoDsl/zipAudioResolver.ts`:
    - Accept `FileSystemFileHandle` của zip + `audioPath` (e.g. `en/username/hello.mp3`).
    - Dùng `unzipit` để đọc lazy, chỉ access entry cần thiết.
    - Return `Blob` của MP3.
  - Implement `src/features/pronunciation/services/lingvoDsl/splitPackageResolver.ts`:
    - Cho `packageType: 'split'`, chọn zip theo `splitArchivePattern` (e.g. chữ cái đầu của term).
    - Mở đúng zip handle từ directory.
  - Test với small sample zip và split mock.
  - Files: 2 files + tests.
  - Verify: resolver returns expected MP3 bytes; split resolver picks correct archive.

### Checkpoint 2

- [ ] Parser and resolver unit tests pass.
- [ ] Đã quyết định strategy đọc zip 3.4 GB.

### Phase 3: Provider + Orchestrator

- [ ] **Task 5: LingvoDslAudioProvider**
  - Implement `src/features/pronunciation/services/lingvoDsl/lingvoDslAudioProvider.ts`:
    - `kind: 'localFile'`.
    - `resolve(term, langCode)`:
      - Load handles from storage.
      - Verify permissions.
      - Lookup index.
      - For each audio path, resolve zip entry, create `Blob` URL.
      - Return `AudioItem[]` with `source: 'local'`, `label: 'Forvo · {username}'`.
  - Files: 1 file + test.
  - Verify: provider returns AudioItems for known words; `[]` for missing words.

- [ ] **Task 6: PronunciationAudioOrchestrator**
  - Implement `src/features/pronunciation/services/pronunciationAudioOrchestrator.ts`:
    - Accept list of providers ordered by `PronunciationSettings.fallbackEngines`.
    - Try each provider in order; aggregate first non-empty result or all results.
    - Mark first result `defaultSelected: true`.
  - Refactor `CommunityAudioProvider` (wrap `fetchScoredCommunityAudioItems`) and `TtsAudioProvider`.
  - Files: 1 file + refactor.
  - Verify: fallback order test pass.

### Checkpoint 3

- [ ] Orchestrator returns correct provider chain.

### Phase 4: Message + Integration

- [ ] **Task 7: Background handler `FETCH_LOCAL_AUDIO`**
  - Add `MESSAGE_TYPES.FETCH_LOCAL_AUDIO` (`src/shared/config/messages.ts`, `src/entities/message/types.ts`).
  - Add Zod schema (`src/features/dictionaryPopup/schema.ts`).
  - Implement `src/entrypoints/background/handlers/localAudio.ts`.
  - Register in `src/entrypoints/background/index.ts`.
  - Files: 3-4 files.
  - Verify: message handler unit test pass.

- [ ] **Task 8: Wire `useDictionaryToolbar` + `AudioPanel`**
  - In `useDictionaryToolbar.fetchAudio`:
    - Call `FETCH_LOCAL_AUDIO` alongside `FETCH_COMMUNITY_AUDIO`.
    - Merge local items at top (or use orchestrator).
  - Update `AudioPanel` mapping `toAudioEngineKind`:
    - Add `case 'local': return 'localFile'`.
    - Add `case 'tts': return 'browserTts'` (already present).
  - Files: 2 files.
  - Verify: popup audio tab shows local items when available.

### Checkpoint 4

- [ ] Background message flow works.
- [ ] AudioPanel plays local audio and `PronunciationPanel` decodes it.

### Phase 5: Settings UI

- [ ] **Task 9: Local package picker in options**
  - Implement/extend `src/features/settings/ui/PronunciationSettingsPanel.tsx`:
    - Button "Select Forvo package" dùng `showOpenFilePicker` (chọn cả 2 file `.dsl` và `.dsl.files.zip`).
    - Hoặc dùng `showDirectoryPicker` nếu package nằm chung folder.
    - Hiển thị package đã chọn + index status.
    - Fallback engine reorder UI (nếu chưa có).
  - Files: 1 file.
  - Verify: settings persist, permission re-request on reload.

### Checkpoint 5

- [ ] Options page user can select and index package.

### Phase 6: Verify

- [ ] **Task 10: Tests + E2E**
  - Unit tests for all new modules.
  - Playwright E2E: select package in options, open popup on example.com, click word, play local audio.
  - Files: tests.
  - Verify: `npm run test:unit`, `npm run build`, `npx tsc --noEmit`, `npm run lint` pass.

### Checkpoint 6

- [ ] All checks green.
- [ ] Browser E2E confirms local audio playback.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 3.4 GB zip không đọc được trong browser do memory | High | Slice reader hoặc `@zip.js/zip.js`; test ngay Task 4. |
| File System Access API permission không persist | Medium | Lưu handle, gọi `requestPermission` trước read; fallback import to OPFS nếu cần. |
| DSL parsing 38 MB chậm/đủ RAM | Medium | Parse một lần, cache index; streaming parser nếu phát hiện vấn đề. |
| Quetta Android không support full File System Access | Medium | Phạm vi P1 desktop; mobile là accepted risk. |
| User’s 2nd package (Downloads) audio archives incomplete | Low | Không dùng cho MVP; thiết kế provider hỗ trợ sau. |

## Open Questions

1. Slice reader cho 3.4 GB zip dùng `fflate` hay `@zip.js/zip.js`? — Spike Task 4.
2. `PronunciationSettingsPanel` đã tồn tại chưa? Nếu chưa, tạo mới; nếu có, extend.
3. AudioPanel hiện đã map `source → AudioEngineKind` (user changes). Cần đảm bảo `'local'` được xử lý.
