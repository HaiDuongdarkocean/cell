# Spec: Local Pronunciation Audio

## Assumptions

1. **Primary local package:** `D:\Tools for language\Dictionary\English\New folder\Forvo English` (Lingvo DSL package: `ForvoEnglish.dsl` 38 MB + `ForvoEnglish.dsl.files.zip` 3.4 GB). This is the MVP target.
2. **Access method:** File System Access API (`showOpenFilePicker` / `showDirectoryPicker`) in the extension options page. The user selects the package once; file handles are persisted via IndexedDB. No file copy, no extra storage.
3. **Package format (MVP):** Lingvo DSL single-language package with 2 layout options:
   - `'single'`: one `.dsl` index file + one `.dsl.files.zip` archive (D:\...\Forvo English, 3.4 GB).
   - `'split'`: one `.dsl` index file + nhiều `.zip` nhỏ (e.g. `ForvoEnglish_a.zip` ... `ForvoEnglish_z.zip`), mỗi file chứa audio của từ bắt đầu bằng 1 chữ cái. Dùng cho mobile / Quetta.
4. **Future formats:** The provider interface is designed to also support the `<user-home>\Downloads\Forvo_pronunciations` export layout (`metadata.jsonl` + `export/{mp3,opus}/{lang}.zip`) once those archives are complete.
5. **Audio codec:** MP3 inside the zip. DSL references point to `*.mp3` paths. OPUS support is an accepted risk for the second format.
6. **Phoneme engine:** Reuse existing Ocean Pronunciation Engine (`espeak-phonemes`). Local audio is fed as a `PronunciationAudio` via `decodeAudioUrl`.
7. **Fallback chain:** `localFile` becomes a first-class `AudioEngineKind`. The user can reorder it in `PronunciationSettings.fallbackEngines`.
8. **Mobile / Quetta:** File System Access API is available on Chromium Android. Single 3.4 GB zip is large for mobile; `packageType: 'split'` mitigates this.

## Objective

Cho phép user sử dụng bộ audio phát âm local (Forvo English Lingvo DSL) trong Cell. Khi tra từ:

- Extension tìm file audio trong local package theo từ.
- Local audio xuất hiện trong Audio tab của dictionary popup.
- User click từ / phoneme thì phát local audio.
- Local audio là một nguồn trong fallback chain, có thể reorder trong settings.
- Không copy 3.4 GB audio; chỉ build index từ `.dsl` và stream từng file khi cần.

### User stories

1. **As a learner**, I want my Forvo audio files to play when I click a word so that I hear real native recordings.
2. **As a user**, I want local audio to be one source in the fallback chain so that I can prefer it over community/Supertonic/TTS.
3. **As a user**, I want the extension to remember my selected local package so that I don’t pick it again every session.
4. **As a learner**, I want to see the IPA and click individual phonemes when a local word audio is selected, using the existing PronunciationPanel.

## Tech Stack

- **File access:** File System Access API (`showOpenFilePicker` / `showDirectoryPicker`) in options page.
- **File handle persistence:** IndexedDB (`src/shared/lib/storage/localFileHandleStorage.ts`).
- **DSL parsing:** custom streaming parser for Lingvo `.dsl` text format.
- **Zip reading:** `unzipit` (v2.x, 0 deps) for random-access, lazy entry reading from large `File` objects. `fflate` giữ lại cho trường hợp nén/decompress nếu cần.
- **Audio decode:** existing `decodeAudioUrl` (`src/features/pronunciation/services/audioDecoder.ts`).
- **Phoneme display:** existing `PronunciationPanel` + `AudioPanel`.
- **Message bus:** new `FETCH_LOCAL_AUDIO` MV3 message, background handler.
- **State / settings:** `PronunciationSettings` extension + settings schema migration.
- **Testing:** Jest + jsdom; Playwright E2E (`tmp-playwright-pronunciation-demo.mjs` pattern).

## Commands

```bash
# Dev
npm run dev

# Typecheck
npx tsc --noEmit

# Lint
npm run lint

# Unit tests
npm run test:unit

# Build
npm run build

# Browser verify (reuse existing Playwright script)
node tmp-playwright-pronunciation-demo.mjs
```

## Project Structure

```
src/
├── features/pronunciation/
│   ├── types.ts                          # + AudioEngineKind 'localFile'
│   ├── services/
│   │   ├── audioProvider.ts              # PronunciationAudioProvider interface
│   │   ├── pronunciationAudioOrchestrator.ts # fallback chain resolver
│   │   ├── lingvoDsl/
│   │   │   ├── lingvoDslAudioProvider.ts
│   │   │   ├── lingvoDslParser.ts
│   │   │   ├── lingvoDslIndexStorage.ts
│   │   │   ├── zipAudioResolver.ts       # lazy read via unzipit
│   │   │   └── splitPackageResolver.ts   # select zip by first letter for 'split'
│   │   └── communityAudioProvider.ts     # wrap existing fetchScoredCommunityAudioItems
│   └── ui/
│       └── PronunciationPanel.tsx        # already integrated (user changes)
├── features/dictionaryPopup/
│   ├── types.ts                          # + AudioSourceKind 'local'
│   ├── schema.ts                         # + 'local' source
│   ├── logic/
│   │   └── useDictionaryToolbar.ts       # merge local audio into fetchAudio
│   ├── ui/
│   │   └── AudioPanel.tsx                # map 'local' → 'localFile'
│   └── services/
│       └── audioProviderService.ts       # build provider list from settings
├── entrypoints/background/handlers/
│   └── localAudio.ts                     # FETCH_LOCAL_AUDIO handler
├── features/settings/ui/
│   └── PronunciationSettingsPanel.tsx    # + local package picker + fallback order
├── entities/settings/types.ts            # + LocalFileAudioSettings
└── shared/lib/storage/
    └── localFileHandleStorage.ts         # IndexedDB for file handles
```

## Code Style

- Function components + named export. Không default export.
- Pure provider functions; side effects (file picker) isolated in UI layer.
- Types tường minh; validate message payloads bằng Zod.
- Error handling: provider returns `[]` khi không tìm thấy, không throw.
- `ponytail:` comment nếu dùng giải pháp tạm (ví dụ đọc toàn bộ `.dsl` vào string thay vì streaming).

### Example: provider interface

```ts
export interface PronunciationAudioProvider {
  readonly kind: AudioEngineKind;
  /** Return AudioItem[] for the term, or empty if unavailable. */
  resolve(term: string, langCode: string): Promise<readonly AudioItem[]>;
}
```

### Example: DSL index entry

```ts
export interface LingvoDslIndexEntry {
  readonly headword: string;
  readonly audioPaths: readonly string[];
}
```

### Example: local file audio settings

```ts
export type LocalPackageType = 'single' | 'split';

export interface LocalFileAudioSettings {
  readonly packageType: LocalPackageType;
  readonly dslFileHandleId: string | null;
  // single
  readonly audioArchiveHandleId: string | null;
  // split
  readonly splitArchiveDirectoryHandleId: string | null;
  readonly splitArchivePattern: string; // e.g. 'ForvoEnglish_{firstLetter}.zip'
  readonly lastIndexedAt: number | null;
}
```

## Testing Strategy

- **Unit:**
  - `lingvoDslParser.test.ts`: parse sample `.dsl` lines → correct headword + audio paths.
  - `lingvoDslIndexStorage.test.ts`: store/retrieve index with fake-indexeddb.
  - `zipAudioResolver.test.ts`: mock `unzipit` / `File` → extract expected MP3 bytes; test split resolver picks correct archive.
  - `pronunciationAudioOrchestrator.test.ts`: mock providers, verify fallback order.
- **Integration:**
  - `localAudio.test.ts` (background handler): mock message + mock provider → verify `AudioItem[]` response.
- **E2E/Browser:**
  - Cài đặt local package trong options page.
  - Mở popup trên example.com, click từ có trong index, verify local audio item hiển thị và phát.

## Boundaries

### Always do
- Validate payload Zod tại message boundary.
- Persist file handle permission query/request trước khi đọc.
- Map `AudioSourceKind` mới `'local'` sang `AudioEngineKind 'localFile'` trong `AudioPanel`.
- Bump settings schema version khi thêm `localFile` slice.
- Chạy `npm run typecheck` và `npm run test:unit` sau mỗi task.

### Ask first
- Thêm dependency mới (ngoài `fflate` đã có).
- Thay đổi `manifest.json` (permission, host).
- Bundle/ship 3.4 GB audio (không bundle — user picks local file).

### Never do
- Tự động quét ổ đĩa hoặc đọc `D:\` mà không qua File System Access API.
- Copy toàn bộ 3.4 GB audio vào extension storage.
- Commit local file paths hoặc secrets.

## Success Criteria

- [ ] User có thể chọn `ForvoEnglish.dsl` + `ForvoEnglish.dsl.files.zip` trong options page.
- [ ] `.dsl` được parse thành index và lưu vào IndexedDB (hoặc OPFS).
- [ ] Khi tra từ có trong index, Audio tab hiển thị item `Forvo · {username}` với blob URL.
- [ ] Click item / play phát local audio.
- [ ] `PronunciationPanel` decode local audio và cho phép click phoneme phát segment.
- [ ] `localFile` xuất hiện trong `PronunciationSettings.fallbackEngines` và có thể reorder.
- [ ] Khi local không có, fallback sang community / TTS theo chain.
- [ ] `npm run build`, `npx tsc --noEmit`, `npm run test:unit` pass.
- [ ] E2E Playwright verify trên example.com với local package.

## Open Questions

1. **DSL parsing ceiling:** 38 MB `.dsl` có thể đọc toàn bộ vào string hay cần streaming? Accepted risk: đọc toàn bộ trong MVP; đánh dấu `ponytail: O(n) memory`.
2. **Zip reading strategy:** dùng `unzipit` (lazy, random access) cho cả `single` và `split`. Spike trong Task 4.
3. **Split package tooling:** user phải tự split gói hay em cung cấp script tiện ích (Python/Node)? Accepted risk: P1 hỗ trợ pattern, cung cấp script P2.
4. **Multiple local packages:** Có cần hỗ trợ nhiều package/ngôn ngữ cùng lúc? Out of scope for MVP; design interface allows it.
