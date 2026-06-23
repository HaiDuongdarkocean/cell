# Implementation Plan: Streaming Download + Transmux (D + F)

## Overview

Replace the current "download-all-to-memory → ffmpeg.wasm convert" pipeline with a
streaming architecture that keeps memory at ~10-20MB regardless of video size.

**Current problem:** A 100MB M3U8 video causes ~500-600MB peak memory (blobs +
buffers + merged + MEMFS input + MEMFS output + readFile copy). Machines with
low RAM fail at 85% with `ErrnoError: FS error`.

**New architecture:**
1. Download each segment → append to OPFS file (1 segment in memory at a time)
2. Offscreen reads .ts from OPFS in chunks → transmux TS→fMP4 with mux.js → write to OPFS
3. Read final .mp4 from OPFS → `chrome.downloads.download` to user folder
4. Fallback: if transmux fails → save .ts from OPFS directly

## Architecture Decisions

### 1. OPFS as staging area (not chrome.runtime.sendMessage)
- **Why:** `chrome.runtime.sendMessage` caps at ~64MB. Sending all segments via
  message causes truncation/silently corrupted data → contributes to FS error.
- **How:** Service worker and offscreen document share the same extension origin,
  so they share the same OPFS. Download writes to OPFS, convert reads from OPFS.
  No large message payloads.

### 2. mux.js instead of ffmpeg.wasm for transmuxing
- **Why:** ffmpeg.wasm loads entire input into MEMFS (memory). mux.js transmuxes
  chunk-by-chunk (streaming). Memory stays at ~1-2 chunks regardless of video size.
- **Library:** `mux.js` (by videojs) — `mp4.Transmuxer` takes MPEG-TS input,
  produces fragmented MP4 output. Pure JS, no WASM, ~100KB bundled.
- **Codec support:** H.264/AVC + AAC (covers ~95% of HLS streams). If codec
  unsupported → fallback to .ts.

### 3. Fragmented MP4 (fMP4) output
- **Why:** mux.js produces fragmented MP4 (fMP4), not progressive MP4. fMP4 is
  playable by VLC, mpv, Chrome, Firefox, Edge. Some older players may not support
  it, but it's the standard for streaming.
- **Alternative:** If progressive MP4 is needed, can post-process with ffmpeg.wasm
  on small files only (<threshold).

### 4. Threshold for ffmpeg.wasm fallback
- Files < 50MB: try ffmpeg.wasm for progressive MP4 (better compatibility)
- Files ≥ 50MB: use mux.js streaming (fMP4) or save .ts

### 5. Origin Private File System (OPFS)
- **Why:** Available in service workers and offscreen documents without user
  gesture. No size limit (beyond disk). Shared within extension origin.
- **API:** `navigator.storage.getDirectory()` → `getDirectoryHandle('downloads', {create:true})`
- **Cleanup:** Delete temp files after `chrome.downloads.download` completes.

## Task List

### Phase 1: Foundation — OPFS helper + mux.js setup

#### Task 1: Add mux.js dependency and OPFS storage helper
**Description:** Install `mux.js`, create `src/lib/storage/opfsStorage.ts` with
helper functions for writing/reading/deleting files in OPFS.

**Acceptance criteria:**
- [ ] `mux.js` installed via `npm install mux.js`
- [ ] `src/lib/storage/opfsStorage.ts` exports: `writeChunk`, `readFile`,
        `deleteFile`, `getFileHandle`, `ensureDownloadDir`
- [ ] `writeChunk` appends to existing file (streaming write)
- [ ] `readFile` returns a `File` object (can be sliced for chunked reading)
- [ ] Unit tests for OPFS helpers (mock `navigator.storage`)

**Verification:**
- [ ] `npm test -- --testPathPattern=opfsStorage` passes
- [ ] `npm run typecheck` passes

**Dependencies:** None

**Files likely touched:**
- `package.json` (add mux.js)
- `src/lib/storage/opfsStorage.ts` (new)
- `tests/unit/lib/storage/opfsStorage.test.ts` (new)

**Estimated scope:** Small (2 files + 1 test)

---

#### Task 2: Create streaming TS→fMP4 transmuxer module
**Description:** Create `src/lib/converters/tsTransmuxer.ts` that uses mux.js
`mp4.Transmuxer` to convert a TS `File` (from OPFS) to fMP4, writing output
chunks to OPFS. Processes in chunks to keep memory low.

**Acceptance criteria:**
- [ ] `transmuxTsToFmp4(inputFile: File, outputDirHandle, outputName)` function
- [ ] Reads input in 1MB chunks, feeds to transmuxer
- [ ] Collects transmuxer output events, writes to OPFS
- [ ] Returns `{ success: boolean, outputName: string, error?: string }`
- [ ] Handles codec errors gracefully (returns error, doesn't crash)
- [ ] Unit tests with mocked mux.js Transmuxer

**Verification:**
- [ ] `npm test -- --testPathPattern=tsTransmuxer` passes
- [ ] `npm run typecheck` passes

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/converters/tsTransmuxer.ts` (new)
- `tests/unit/lib/converters/tsTransmuxer.test.ts` (new)

**Estimated scope:** Small (2 files)

---

### Checkpoint: Foundation
- [ ] All tests pass
- [ ] Build succeeds
- [ ] OPFS helpers and transmuxer are unit-tested in isolation

---

### Phase 2: Streaming download (F) — rewrite downloader

#### Task 3: Add streaming download to OPFS in Downloader
**Description:** Modify `downloadM3u8Video` to stream each segment to OPFS
instead of keeping all blobs in memory. After all segments downloaded, save .ts
to user's downloads folder as backup.

**Acceptance criteria:**
- [ ] `downloadM3u8Video` fetches segments one at a time, appends each to
        `downloads/{downloadId}/input.ts` in OPFS
- [ ] Only 1 segment (~2-5MB) in memory at any time
- [ ] Progress reported per segment (0-80%)
- [ ] After all segments: save .ts via `chrome.downloads.download` (backup)
- [ ] If `convertCallback` is set: call it with OPFS file handle info, not
        ArrayBuffer[] (new contract)
- [ ] Fallback: if conversion fails or is skipped, .ts backup already saved
- [ ] Cleanup OPFS temp files after download completes

**Verification:**
- [ ] `npm test -- --testPathPattern=downloader` passes
- [ ] Existing downloader tests updated for new streaming flow
- [ ] `npm run build` succeeds

**Dependencies:** Task 1

**Files likely touched:**
- `src/background/downloader.ts` (modify)
- `tests/unit/background/downloader.test.ts` (modify)

**Estimated scope:** Medium (2 files, significant rewrite of downloadM3u8Video)

---

#### Task 4: Update ConvertCallback contract for OPFS-based conversion
**Description:** Change `ConvertCallback` from `(segments: ArrayBuffer[])` to
`(inputFile: File, downloadId: string)` — pass the OPFS File object instead of
all segments in memory.

**Acceptance criteria:**
- [ ] `ConvertCallback` type changed to `(inputFile: File, downloadId: string) => Promise<Blob>`
- [ ] `index.ts` convert callback updated to send OPFS file path to offscreen
        via message (small payload: just file name + downloadId)
- [ ] New message type `CONVERT_TS_TO_MP4_V2` with `{ inputFileName, downloadId }`
- [ ] Old `CONVERT_TS_TO_MP4` kept for backward compat but deprecated
- [ ] Background reads conversion result from OPFS (offscreen writes output there)

**Verification:**
- [ ] `npm test -- --testPathPattern=integration` passes
- [ ] `npm run typecheck` passes

**Dependencies:** Task 3

**Files likely touched:**
- `src/background/downloader.ts` (modify ConvertCallback type)
- `src/background/index.ts` (modify convert callback wiring)
- `src/types/message.ts` (add CONVERT_TS_TO_MP4_V2)
- `src/constants/messages.ts` (add message type)

**Estimated scope:** Medium (4 files)

---

### Checkpoint: Streaming Download
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Download phase uses ~5MB memory (1 segment at a time)
- [ ] .ts backup saved before conversion attempt

---

### Phase 3: Streaming transmux (D) — rewrite offscreen converter

#### Task 5: Replace ffmpeg.wasm with mux.js transmuxer in offscreen
**Description:** Rewrite `src/offscreen/ffmpegRunner.ts` to use the new
`tsTransmuxer` module instead of ffmpeg.wasm. Read input from OPFS, write
output to OPFS. No large message payloads.

**Acceptance criteria:**
- [ ] New `convertTsToMp4V2(inputFileName, downloadId)` reads `input.ts` from
        OPFS, transmuxes to `output.mp4` in OPFS
- [ ] Message listener handles `CONVERT_TS_TO_MP4_V2` with small payload
- [ ] Response contains `{ success, outputFileName, error? }` — no ArrayBuffer
- [ ] ffmpeg.wasm code kept as fallback for small files (< threshold) but
        disabled by default
- [ ] Detailed logging at each stage (read input, transmux chunks, write output)
- [ ] Unit tests updated for new V2 flow

**Verification:**
- [ ] `npm test -- --testPathPattern=ffmpegRunner` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

**Dependencies:** Tasks 2, 4

**Files likely touched:**
- `src/offscreen/ffmpegRunner.ts` (rewrite)
- `src/offscreen/ffmpeg.html` (update script loading — mux.js instead of ffmpeg)
- `tests/unit/offscreen/ffmpegRunner.test.ts` (rewrite)

**Estimated scope:** Medium (3 files)

---

#### Task 6: Update background to read conversion result from OPFS
**Description:** After offscreen signals conversion complete, background reads
`output.mp4` from OPFS and saves it via `chrome.downloads.download`. Delete
temp OPFS files after save.

**Acceptance criteria:**
- [ ] Background receives `CONVERT_TS_TO_MP4_V2_RESULT` with output file name
- [ ] Reads `output.mp4` from OPFS as `File` → converts to data URL →
        `chrome.downloads.download`
- [ ] Deletes `input.ts` and `output.mp4` from OPFS after successful save
- [ ] If conversion failed: .ts backup already saved (Task 3), no extra action
- [ ] Progress reported: 85% (converting start) → 98% (saving mp4) → 100% (done)

**Verification:**
- [ ] `npm test -- --testPathPattern=integration` passes
- [ ] Full flow test: download → convert → save mp4 → cleanup

**Dependencies:** Tasks 4, 5

**Files likely touched:**
- `src/background/index.ts` (modify convert callback)
- `src/background/downloader.ts` (modify save logic)
- `tests/unit/background/integration.test.ts` (modify)

**Estimated scope:** Medium (3 files)

---

### Checkpoint: Full D+F Pipeline
- [ ] All tests pass
- [ ] Build succeeds
- [ ] End-to-end: download streams to OPFS → transmux reads/writes OPFS →
      mp4 saved to downloads → temp files cleaned
- [ ] Memory profile: ~10-20MB peak regardless of video size

---

### Phase 4: Polish — threshold, settings, error handling

#### Task 7: Add conversion threshold and settings
**Description:** Add setting `convertToMp4: 'always' | 'small-only' | 'never'`
and threshold `MAX_FFMPEG_WASM_BYTES`. For large files, skip ffmpeg.wasm and
use mux.js streaming. For 'never', save .ts directly.

**Acceptance criteria:**
- [ ] New `Settings.convertToMp4` field with 3 options
- [ ] Popup settings UI updated with toggle/dropdown
- [ ] `DEFAULT_SETTINGS` updated
- [ ] Threshold logic in downloader: if file > 50MB and setting is 'small-only',
        skip conversion, save .ts
- [ ] Unit tests for threshold logic

**Verification:**
- [ ] `npm test` passes (all suites)
- [ ] `npm run build` succeeds

**Dependencies:** Task 6

**Files likely touched:**
- `src/types/media.ts` (Settings interface)
- `src/constants/config.ts` (DEFAULT_SETTINGS, threshold)
- `src/background/downloader.ts` (threshold check)
- `src/popup/components/settings/` (UI)
- `tests/unit/background/downloader.test.ts`

**Estimated scope:** Medium (4-5 files)

---

#### Task 8: Error handling and cleanup robustness
**Description:** Ensure OPFS temp files are cleaned up on cancel, error, or
service worker restart. Add orphaned-file cleanup on extension startup.

**Acceptance criteria:**
- [ ] On download cancel: delete `downloads/{downloadId}/` from OPFS
- [ ] On download error: delete temp files, keep .ts backup if already saved
- [ ] On extension startup: scan OPFS `downloads/` dir, delete files older
        than 24 hours (orphaned from crashed sessions)
- [ ] All OPFS operations wrapped in try/catch with logging
- [ ] Unit tests for cleanup logic

**Verification:**
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Manual: cancel download → verify OPFS cleaned

**Dependencies:** Task 6

**Files likely touched:**
- `src/background/downloader.ts` (cancel cleanup)
- `src/background/index.ts` (startup cleanup)
- `src/lib/storage/opfsStorage.ts` (cleanup helpers)
- `tests/unit/lib/storage/opfsStorage.test.ts`

**Estimated scope:** Medium (4 files)

---

#### Task 9: Update E2E tests for new pipeline
**Description:** Update `e2e/kisskh.spec.ts` and related E2E tests to verify
the new streaming download + transmux flow produces a valid .mp4 file.

**Acceptance criteria:**
- [ ] E2E test downloads a small M3U8 video and verifies .mp4 appears
- [ ] E2E test for fallback: large video or transmux failure → .ts saved
- [ ] E2E test for cancel mid-download → temp files cleaned

**Verification:**
- [ ] `npm run test:e2e` passes (or manual verification)

**Dependencies:** Task 8

**Files likely touched:**
- `e2e/kisskh.spec.ts`
- `e2e/download-duplicate.spec.ts`

**Estimated scope:** Small (2 files)

---

### Checkpoint: Complete
- [ ] All unit tests pass (336+ existing + new)
- [ ] Build succeeds
- [ ] E2E tests pass
- [ ] Memory stays under ~20MB for any video size
- [ ] Fallback to .ts works when transmux fails
- [ ] Settings allow user to control conversion behavior

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| mux.js doesn't support codec in test stream | High | Fallback to .ts. Test with real streams early (Task 5) |
| OPFS not available in some Chrome versions | Medium | Feature-detect `navigator.storage.getDirectory()`. Fallback to old in-memory flow if unavailable. |
| mux.js produces fMP4 not playable by some players | Medium | Document in UI. Offer ffmpeg.wasm for small files. |
| Service worker killed mid-download | Medium | OPFS persists across SW restarts. Resume logic in Task 8. |
| `chrome.downloads.download` with large data URL fails | Medium | Use OPFS → `File` → `URL.createObjectURL` in offscreen, or stream via `chrome.downloads.download` with OPFS URL. Test file size limits. |
| mux.js bundle size | Low | ~100KB gzipped, acceptable for extension |

## Open Questions

1. **fMP4 vs progressive MP4:** Is fMP4 acceptable for users, or do they need
   progressive MP4 (which requires ffmpeg.wasm)? → Test with real streams first,
   decide based on playback compatibility.

2. **OPFS quota:** Chrome may limit OPFS storage. Need to check if ~500MB-1GB
   temp files are OK. If not, may need to clean up more aggressively or use
   `navigator.storage.persist()` to request persistent storage.

3. **Resume after SW restart:** Should we support resuming a partially
   downloaded .ts in OPFS after the service worker was killed? (Nice-to-have,
   not in initial scope.)

## Memory Budget (Target)

| Phase | Current | New (D+F) |
|-------|---------|-----------|
| Download 100MB video | ~100MB (all blobs) | ~5MB (1 segment) |
| Convert 100MB video | ~500MB (buffers + MEMFS) | ~15MB (1 chunk + transmuxer buffer) |
| Save 100MB video | ~200MB (data URL) | ~100MB (File → download) |
| **Total peak** | **~600MB** | **~100MB** |
