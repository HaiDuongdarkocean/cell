# Planning: Solution C Verification + Real M3U8 Hardening (v3 — Distinguished Engineer Review)

## Executive Summary

Mục tiêu là làm downloader M3U8 chạy đúng và mượt với playlist thật ~430MB / 310 segment, không crash RAM, UI phản hồi < 3s, fallback `.ts` an toàn nếu MP4 conversion fail.

Kết luận review:

1. **Parallel segment fetch + single OPFS writer là hướng đúng** cho download phase.
2. **Vấn đề lớn còn lại không nằm ở download speed mà ở save/transmux memory path.**
3. **Không được dùng `data:` URL cho file lớn.** Nó tạo memory spike ~1.4GB cho file 430MB.
4. **Không được collect toàn bộ mux.js output trong `outputChunks[]`.** Nó giữ ~400MB trong RAM.
5. **Không được giả định `URL.createObjectURL` có trong MV3 Service Worker.** Theo MDN, API này không available trong Service Workers.
6. **Offscreen Blob URL path cần thiết kế theo lifecycle rõ ràng:** offscreen là owner của Blob URL, SW chỉ trigger `chrome.downloads.download` ngay lập tức và báo offscreen revoke sau khi download complete/cancel/error.

---

## Distinguished Engineer Review

### Điểm khen

#### 1. Root cause analysis đúng hướng

Plan đã xác định đúng các bottleneck chính:

- Sequential segment fetch chậm.
- OPFS per-segment open/close overhead lớn.
- `blobToDataUrl()` là memory bomb.
- mux.js output collection giữ toàn bộ MP4 trong RAM.

Đây là các vấn đề thật, không phải tối ưu vi mô.

#### 2. Kiến trúc OPFS staging là hợp lý

Dùng OPFS làm staging layer giữa background service worker và offscreen document là lựa chọn đúng trong MV3:

```text
network → OPFS input.ts → offscreen transmux → OPFS output.mp4 → downloads
```

Nó tránh `sendMessage` size limit và tránh giữ toàn bộ video trong RAM.

#### 3. Parallel fetch + ordered write là đúng invariant

Segment fetch có thể song song, nhưng write vào TS phải giữ đúng thứ tự playlist:

```text
fetch concurrently, write sequentially in playlist order
```

Plan đã giữ invariant này. Đây là điểm đúng quan trọng.

#### 4. Local fixture cho E2E là quyết định tốt

Không phụ thuộc URL `tmp.*` bên ngoài là đúng. Test thật cần deterministic.

---

## Lỗ hổng cần sửa

### Critical 1: Không được dùng `URL.createObjectURL` trong Service Worker làm fast path mặc định

Plan v2 vẫn còn giả định SW có thể có `URL.createObjectURL`. Theo MDN, `URL.createObjectURL()` available in Web Workers **except Service Workers** vì rủi ro memory leak.

**Decision sửa:**

- Không dùng SW `URL.createObjectURL` làm fast path trong thiết kế chính.
- Offscreen document là nơi tạo Blob URL.
- SW chỉ dùng `chrome.downloads.download({ url: blobUrl })` ngay sau khi nhận URL.
- Offscreen giữ Blob URL sống cho tới khi SW báo download complete/cancel/error.

### Critical 2: Blob URL tạo ở offscreen có lifecycle gắn với offscreen document

Blob URL lifetime gắn với environment tạo ra nó. Nếu offscreen bị đóng trước khi Chrome download consume xong, URL có thể invalid.

**Decision sửa:**

- Offscreen document phải được giữ alive trong suốt quá trình download local Blob URL.
- SW phải gửi message `REVOKE_BLOB_URL` cho offscreen sau khi `chrome.downloads.onChanged` báo complete/interrupted.
- Không revoke bằng `setTimeout`.
- Không close offscreen trong lúc còn active Blob URL.

### Critical 3: Không được truyền 430MB qua message

Offscreen fallback chỉ hợp lệ nếu offscreen **đọc trực tiếp từ OPFS**. Không truyền Blob/ArrayBuffer lớn từ SW sang offscreen.

**Correct flow:**

```text
SW has downloadId + outputName
  ↓ send small message
Offscreen reads OPFS file directly
  ↓ createObjectURL(file)
Offscreen returns blobUrl string
  ↓
SW calls chrome.downloads.download(blobUrl)
  ↓
SW onChanged complete/interrupted
  ↓
SW tells offscreen revokeBlobUrl(blobUrl)
```

### Critical 4: Task B async event handler race

mux.js `'data'` event handler không được `async await writer.write(...)` trực tiếp. mux.js không await handler. Điều đó có thể làm các write đan xen và corrupt MP4.

**Decision sửa:** dùng `writeChain` hoặc queue để serialize writes.

Simpler than polling queue:

```ts
let writeChain = Promise.resolve();
let initSegmentWritten = false;

transmuxer.on('data', (segment) => {
  const chunks: Uint8Array[] = [];
  if (segment.initSegment?.length) {
    chunks.push(segment.initSegment);
    initSegmentWritten = true;
  }
  if (segment.data?.length) {
    chunks.push(segment.data);
  }

  writeChain = writeChain.then(async () => {
    for (const chunk of chunks) {
      await writer.write(chunk);
    }
  });
});

transmuxer.flush();
await waitForDone(transmuxer, timeoutMs);
await writeChain;
```

Ưu điểm:

- Không polling `setTimeout(10)`.
- Không có race giữa event sync và write async.
- Memory chỉ giữ vài fragment trong promise chain.
- Dễ test hơn queue drain loop.

### Critical 5: Fallback `.ts` path vẫn không được read toàn file thành ArrayBuffer/data URL

Hiện tại fallback save `.ts` đang có pattern nguy hiểm:

```ts
const tsFile = await opfsReadFile(dirHandle, 'input.ts');
savedBlob = new Blob([await tsFile.arrayBuffer()], { type: 'video/mp2t' });
await saveBlob(savedBlob, filename);
```

Với 430MB, `arrayBuffer()` tạo spike lớn. Dù sau đó dùng Blob URL, vẫn không cần copy.

**Decision sửa:** pass `File` trực tiếp vào save path:

```ts
const tsFile = await opfsReadFile(dirHandle, 'input.ts');
await saveBlobLike(tsFile, filename, 'video/mp2t');
```

Hoặc tốt hơn: đổi save API nhận OPFS reference:

```ts
saveOpfsFile(downloadId, filenameInOpfs, downloadFilename, mimeType)
```

Không materialize file content trong SW.

### Major 1: Timeout mux.js không nên là success fallback im lặng

Nếu timeout xảy ra, không được resolve như success. Phải reject/return failure để fallback `.ts`.

Bad:

```ts
setTimeout(() => resolve(), timeoutMs)
```

Correct:

```ts
setTimeout(() => reject(new Error('Transmux timed out')), timeoutMs)
```

MP4 thiếu fragment tệ hơn fallback `.ts` đầy đủ.

### Major 2: E2E fixture phải verify structure, không chỉ size

File lớn hơn 1 segment chưa đủ. Cần verify:

- `.ts` fallback: sync byte `0x47` mỗi 188 bytes tại một số offset.
- `.mp4`: contains `ftyp`, `moov`, `moof`/`mdat` boxes.
- Duration roughly matches playlist duration nếu có thể.

### Major 3: OPFS quota phải cleanup partial file

Nếu quota exceeded mid-write:

- Close writer best-effort.
- Delete partial `input.ts` hoặc `output.mp4`.
- Surface clear error.

Không để orphan corrupt file nằm lại.

---

## Revised Architecture

### Phase 1: Download TS to OPFS

```text
parse media playlist
  ↓
fetch segments in batches of 6
  ↓
write blobs sequentially to single OPFS writer
  ↓
close writer
```

Invariants:

- Fetch concurrency <= `DEFAULT_SEGMENT_CONCURRENCY`.
- Write order == playlist order.
- Progress reported only after write succeeds.
- Writer closes in `finally`.
- No `blob.arrayBuffer()` in hot download path.

### Phase 2: Convert TS to MP4 in offscreen

```text
offscreen reads OPFS input.ts as File
  ↓
inputFile.slice(1MB) → mux.js
  ↓
mux.js data events append to serialized writeChain
  ↓
OPFS output.mp4
  ↓
return outputName only
```

Invariants:

- No `outputChunks[]` full-output collection.
- No async write directly inside mux.js event without serialization.
- Timeout failure falls back to `.ts`, not corrupt MP4.
- `initSegment` written before media data.

### Phase 3: Save OPFS file to user Downloads

```text
SW determines final OPFS filename: output.mp4 or input.ts
  ↓
SW asks offscreen to create Blob URL from OPFS file
  ↓
offscreen reads OPFS File object, URL.createObjectURL(file)
  ↓
offscreen stores blobUrl in active map
  ↓
SW chrome.downloads.download(blobUrl)
  ↓
SW onChanged complete/interrupted
  ↓
SW asks offscreen revoke blobUrl
  ↓
cleanup OPFS dir
```

Invariants:

- No data URL for large files.
- No large ArrayBuffer transfer through message.
- Blob URL owner is offscreen.
- Offscreen remains alive while Blob URL is active.
- Revoke happens via download lifecycle, not timer.

---

## Revised Decisions

### Decision 1: Offscreen-owned Blob URL is the canonical large-file save path

Do **not** rely on `URL.createObjectURL` in MV3 SW.

Canonical API:

```ts
saveOpfsFile(
  downloadId: string,
  opfsFilename: string,
  downloadFilename: string,
  mimeType: string,
): Promise<void>
```

This avoids the anti-pattern:

```ts
new Blob([await file.arrayBuffer()])
blobToDataUrl(blob)
```

### Decision 2: `saveBlob(blob)` remains only for small non-OPFS files

Use cases:

- Subtitles (`.srt`) small.
- Direct `.mp4` HTTP response if small enough.

Rules:

- If `blob.size < 50MB`: current data URL path is acceptable.
- If `blob.size >= 50MB`: must use Blob URL path, preferably offscreen.

### Decision 3: Transmux writes serialized by `writeChain`

Use a promise chain instead of polling queue:

```ts
let writeChain = Promise.resolve();
transmuxer.on('data', (segment) => {
  const chunks = collectChunks(segment);
  writeChain = writeChain.then(() => writeChunks(writer, chunks));
});
await waitForDone(...);
await writeChain;
```

### Decision 4: Timeout is failure, not silent success

If mux.js does not emit `done` within timeout, return failure and save `.ts`.

### Decision 5: Local deterministic E2E fixture is required

Real external URL can be used for manual smoke test only, not committed CI.

---

## Revised Task List

### Task A: Replace large-file save path with `saveOpfsFile`

**Goal:** Save OPFS `input.ts` / `output.mp4` to user Downloads without reading full file into SW memory and without data URL.

**Files:**

- `src/background/downloader.ts`
- `src/background/index.ts`
- `src/offscreen/ffmpegRunner.ts`
- `src/constants/messages.ts`
- `src/types/message.ts`
- `tests/unit/background/downloader.test.ts`
- `tests/unit/offscreen/ffmpegRunner.test.ts`

**Implementation shape:**

```ts
export type SaveOpfsFileCallback = (
  dirHandle: FileSystemDirectoryHandle,
  downloadId: string,
  opfsFilename: string,
  downloadFilename: string,
  mimeType: string,
) => Promise<void>;
```

But avoid passing handles through message. Background/downloader can call a callback wired in `index.ts`:

```ts
await this.saveOpfsFileCallback?.(
  downloadId,
  'output.mp4',
  generateFileName(video.title, 'mp4'),
  'video/mp4',
);
```

Background callback:

```ts
await offscreen.ensureOffscreenDocument();
const response = await chrome.runtime.sendMessage({
  type: MESSAGE_TYPES.CREATE_OPFS_BLOB_URL,
  payload: { downloadId, opfsFilename, mimeType },
});

const blobUrl = response.data.url;
const chromeDownloadId = await chrome.downloads.download({
  url: blobUrl,
  filename: downloadFilename,
  saveAs: false,
});

revokeOffscreenBlobUrlOnDownloadEnd(chromeDownloadId, blobUrl);
```

Offscreen:

```ts
const activeBlobUrls = new Set<string>();

async function createOpfsBlobUrl(downloadId, opfsFilename, mimeType) {
  const dir = await ensureDownloadSubdir(downloadId);
  const file = await opfsReadFile(dir, opfsFilename);
  const blob = file.type === mimeType ? file : file.slice(0, file.size, mimeType);
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);
  return url;
}

function revokeBlobUrl(url: string) {
  URL.revokeObjectURL(url);
  activeBlobUrls.delete(url);
}
```

**Acceptance:**

- No `blobToDataUrl` for M3U8 video path.
- No `arrayBuffer()` for 430MB save path.
- `.mp4` and `.ts` fallback both saved through OPFS Blob URL path.
- Blob URL revoked on complete/interrupted.
- Offscreen not closed while active blob URLs exist.

---

### Task B: Stream mux.js output with serialized `writeChain`

**Goal:** Eliminate `outputChunks[]` memory accumulation and avoid async event race.

**Files:**

- `src/lib/converters/tsTransmuxer.ts`
- `tests/unit/lib/converters/tsTransmuxer.test.ts`

**Implementation shape:**

```ts
const writer = await createOpfsWriter(dirHandle, outputName);
let initSegmentWritten = false;
let fragmentCount = 0;
let bytesWritten = 0;
let writeChain = Promise.resolve();

transmuxer.on('data', (segment) => {
  const chunks: Uint8Array[] = [];

  if (segment.initSegment?.length) {
    chunks.push(segment.initSegment);
    initSegmentWritten = true;
  }

  if (segment.data?.length) {
    chunks.push(segment.data);
  }

  if (chunks.length > 0) {
    writeChain = writeChain.then(async () => {
      for (const chunk of chunks) {
        await writer.write(chunk);
        bytesWritten += chunk.byteLength;
      }
      fragmentCount += 1;
    });
  }
});

try {
  pushInputChunks();
  transmuxer.flush();
  await waitForDoneOrTimeout(transmuxer, computeTimeout(inputFile.size));
  await writeChain;

  if (!initSegmentWritten || bytesWritten === 0) {
    return failure;
  }

  return success;
} finally {
  await writer.close();
  transmuxer.dispose();
}
```

**Acceptance:**

- `outputChunks[]` removed.
- No async `await writer.write` directly inside event handler.
- Test proves output order: `initSegment`, `data1`, `data2`.
- Timeout rejects and returns failure.
- Failure triggers `.ts` fallback.

---

### Task C: Fix fallback `.ts` path to save OPFS file directly

**Goal:** Conversion failure should save full TS without loading into memory.

**Files:**

- `src/background/downloader.ts`
- `tests/unit/background/downloader.test.ts`

**Current anti-pattern:**

```ts
const tsFile = await opfsReadFile(dirHandle, 'input.ts');
savedBlob = new Blob([await tsFile.arrayBuffer()], { type: 'video/mp2t' });
await this.saveBlob(savedBlob, savedFilename);
```

**Replace with:**

```ts
await this.saveOpfsFile(
  downloadId,
  'input.ts',
  generateFileName(video.title, 'ts'),
  'video/mp2t',
);
```

For conversion success:

```ts
await this.saveOpfsFile(
  downloadId,
  result.outputName,
  generateFileName(video.title, 'mp4'),
  result.mimeType,
);
```

**Acceptance:**

- Neither MP4 nor TS path calls `arrayBuffer()` for large OPFS file.
- Tests verify `readFile().arrayBuffer()` is not called on video save path.
- Fallback `.ts` path remains full-length and low-memory.

---

### Task D: OPFS quota handling and cleanup

**Goal:** Quota errors are explicit and partial files are cleaned.

**Files:**

- `src/background/downloader.ts`
- `src/lib/storage/opfsStorage.ts`
- `tests/unit/background/downloader.test.ts`

**Implementation:**

```ts
function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'QuotaExceededError';
}
```

On quota error during input write:

```ts
await deleteDownloadSubdir(downloadId).catch(...);
throw new Error('Không đủ dung lượng lưu tạm thời. Hãy giải phóng ổ đĩa và thử lại.');
```

On quota error during output write:

```ts
await deleteFile(dirHandle, 'output.mp4').catch(...);
return { success: false, outputName, error: 'Không đủ dung lượng để chuyển đổi MP4...' };
```

**Acceptance:**

- Quota error does not leave partial output as successful.
- User-facing error is clear.
- OPFS cleanup best-effort happens.

---

### Task E: Credentials cleanup

**Goal:** Avoid unnecessary cross-origin credentials on segment fetch.

**Files:**

- `src/background/downloader.ts`
- `tests/unit/background/downloader.test.ts`

**Rules:**

- Playlist fetch: keep `credentials: 'include'`.
- Segment fetch: use `credentials: 'omit'` unless future sites require cookies.

**Acceptance:**

- Tests updated to expect segment fetch `credentials: 'omit'`.
- Playlist tests still expect `include`.

---

### Task F: Deterministic E2E with local fixture

**Goal:** Prove full path without external URL flakiness.

**Files:**

- `e2e/m3u8-download.spec.ts`
- fixture generation helper inside test or `e2e/fixtures/m3u8/`

**Fixture strategy:**

Do not hand-write valid H264 TS. For regression coverage, two levels:

1. **TS fallback path fixture:** generate MPEG-TS-like packets with sync byte `0x47` every 188 bytes. This verifies download merge/save path.
2. **MP4 conversion fixture:** use a small known-good TS sample checked into fixture directory, or generate via ffmpeg in test setup only if available. Do not make CI depend on external URL.

**Assertions:**

- Downloaded `.ts` size equals sum(segment sizes), not one segment.
- TS sync byte check passes at sampled 188-byte boundaries.
- If MP4 path enabled, MP4 contains `ftyp`, `moov`, and media boxes (`moof`/`mdat`).
- Progress UI appears within 3s.

---

## Updated Performance Budget

| Metric | Target | Notes |
|---|---|---|
| UI first response | < 3s | Progress after first batch/write |
| Memory during segment download | < 100MB | 6 in-flight Blob segments + writer overhead |
| Memory during transmux | < 50MB target, < 100MB hard ceiling | Serialized fragment writes, no full output array |
| Memory during save | < 100MB | OPFS File → Blob URL, no data URL |
| Real 310-segment download time | < 60s target | CDN dependent |
| MP4 conversion time | no strict <30s; must not freeze UI | 430MB can take >30s on low-end machines |
| Fallback TS save | must succeed if conversion fails | No large ArrayBuffer/data URL |

---

## Updated Risk Matrix

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| data URL memory bomb | Critical | High | `saveOpfsFile`, Blob URL path |
| fallback `.ts` memory bomb | Critical | High | save OPFS file directly, no `arrayBuffer()` |
| `URL.createObjectURL` unavailable in SW | Critical | High | offscreen-owned Blob URL |
| Blob URL lifetime tied to offscreen | Critical | Medium | keep offscreen alive until revoke |
| mux.js sync event / async write race | Critical | High | serialized `writeChain` |
| transmux timeout produces corrupt MP4 | Critical | Medium | timeout rejects → fallback TS |
| OPFS quota exceeded | High | Medium | cleanup partial + user error |
| local fixture not representative | Medium | Medium | TS fallback fixture + small valid TS sample |
| CDN throttling with concurrency=6 | Medium | Low | retry, future adaptive concurrency |
| SW killed mid-download | Medium | Medium | OPFS cleanup; future resume |
| encrypted HLS `#EXT-X-KEY` | Medium | Unknown | explicit unsupported error/future |
| discontinuity playlists | Low | Unknown | future support |

---

## Revised Implementation Order

1. **Task C first:** remove large `arrayBuffer()` from MP4/TS save paths by introducing `saveOpfsFile` contract.
2. **Task A:** implement offscreen-owned Blob URL save + revoke lifecycle.
3. **Task B:** stream mux.js output with serialized `writeChain`.
4. **Task D:** quota handling and partial cleanup.
5. **Task E:** credentials cleanup.
6. Run: `npm run typecheck`, `npm test`, `npm run build`.
7. **Task F:** deterministic E2E local fixture.
8. Manual smoke test with real 310-segment URL.

Reason for order:

- Save path memory bug affects both MP4 success and TS fallback, so it must be fixed before optimizing transmux output.
- Blob URL lifecycle must be correct before relying on large-file save.
- Transmux streaming can then be verified end-to-end.

---

## Distinguished Engineer Final Verdict

The previous plan was directionally good but still had critical lifecycle and memory assumptions. This v3 plan is acceptable to implement incrementally because it now makes the key invariants explicit:

- No large video data through `sendMessage`.
- No large video data through `data:` URLs.
- No full-output MP4 accumulation in RAM.
- Blob URL owner and revoke lifecycle are explicit.
- mux.js sync event boundary is handled with serialized writes.
- TS fallback path is first-class and low-memory, not an afterthought.

Implementation must proceed in small increments with tests after each slice.
