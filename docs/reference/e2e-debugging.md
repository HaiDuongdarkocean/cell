# Knowledge Base — Video Downloader Extension

> Lịch sử các bug đã fix, quyết định kiến trúc, và gotchas.
> Đọc file này đầu tiên sau mỗi context reset.

---

## Cấu trúc mỗi entry

```
### [ID] Tên bug ngắn gọn
- **Symptom**: Người dùng thấy gì
- **Root cause**: Nguyên nhân thực sự
- **Fix**: Đã sửa thế nào (file + dòng chính)
- **Guard**: Test nào ngăn lặp lại
```

---

## BUGS

### [B01] Media tích lũy mỗi lần reload trang
- **Symptom**: Mỗi lần reload kisskh.co, popup thêm media trùng lặp (5 video, 10 video, 20 video...)
- **Root cause**: `detectVideo()` gọi `crypto.randomUUID()` → mỗi request tạo ID mới → `Map.set(id, video)` thêm entry mới dù cùng URL
- **Fix**:
  - `networkInterceptor.ts`: Dedup theo `url + tabId` trước khi `videos.set()`
  - `index.ts`: Thêm `chrome.tabs.onUpdated` (status='loading' → clearTab) và `chrome.tabs.onRemoved` (→ clearTab)
- **Guard**: 6 unit tests trong `networkInterceptor.test.ts` (dedup same URL, different tab OK, clearTab allows re-detect)

### [B02] Popup hiển thị "index" / "en" thay vì tên có nghĩa
- **Symptom**: Video card hiện "index", subtitle card hiện "en" (language code)
- **Root cause**:
  1. `videoDetector.ts` extract title từ URL pathname → `index.m3u8` → "index"
  2. `VideoCard` hiển thị `video.title` trực tiếp, không áp dụng `filenameSource`
  3. `SubtitleCard` hiển thị `subtitle.language` trực tiếp
- **Fix**:
  - `useMediaDisplayTitle.ts` (mới): Hook resolve display title qua `resolveFilenameBase()`
  - `index.ts` `enrichVideo()`: Gọi `chrome.tabs.get(tabId)` → cập nhật `video.title` = page title, `video.tabUrl` = page URL
  - `networkInterceptor.ts`: Thêm `updateVideo()` / `updateSubtitle()` để enrich metadata
  - `VideoCard.tsx` / `SubtitleCard.tsx`: Nhận prop `displayTitle`, fallback về raw title
  - `downloader.ts`: Dùng `video.tabUrl || video.url` thay vì `video.url` (stream URL vô nghĩa)
- **Guard**: 15 unit tests trong `useMediaDisplayTitle.test.ts`
- **E2E**: Video title = "A Good Girl's Guide to Murder - Season 2 Episode 1 | kisskh"

### [B03] Nút "Download All" không hoạt động
- **Symptom**: Click Download All → không có download item nào xuất hiện
- **Root cause**:
  1. Popup gửi `DOWNLOAD_ALL` không kèm `tabId`
  2. Background `getActiveTabId()` dùng `lastFocusedWindow` → trả popup window, không phải browser window
  3. `getMedia(tabId)` trả rỗng vì tabId sai
- **Fix**:
  - `App.redesigned.tsx`: Query tab với `currentWindow: false`, gửi `tabId` trong payload
  - `index.ts` `getActiveTabId()`: Query `currentWindow: false` trước, fallback `lastFocusedWindow`
  - `index.ts` `handleDownloadAll()`: Fallback `getAllVideos()` + `getAllSubtitles()` nếu `getMedia(tabId)` rỗng
  - `message.ts`: `DownloadAllPayload.tabId` thành optional (`number?`)
- **Guard**: E2E test log "Download items appeared: 2"

### [B04] Download All không phân biệt selection
- **Symptom**: Nút luôn tải tất cả bất kể đã chọn gì
- **Root cause**: `handleDownloadAll` luôn gửi `DOWNLOAD_ALL`, không kiểm tra `selectedIds`
- **Fix**:
  - Không chọn / chọn tất cả → `DOWNLOAD_ALL` (tải tất cả)
  - Chọn một phần → `handleDownloadSelected()` (tải từng item riêng)
  - Button text: `Download All` → `Download Selected (N)` khi partial
- **Guard**: E2E test verify button text + download count

### [B05] aria-label không khớp giữa E2E test và code
- **Symptom**: E2E test treo ở "Opening settings" không click được
- **Root cause**: Test dùng `aria-label="Open settings"` nhưng Header.tsx dùng `aria-label="Settings"`
- **Fix**: Sửa E2E test dùng `aria-label="Settings"` và `aria-label="Toggle theme"`
- **Lesson**: Luôn grep `aria-label` trong source trước khi viết E2E selector

### [B06] Mock thiếu chrome.tabs.get / onUpdated / onRemoved
- **Symptom**: Jest fail `TypeError: chrome.tabs.get is not a function`
- **Root cause**: Mock `chrome.tabs` chỉ có `query`, thiếu methods mới
- **Fix**: Thêm `get`, `onUpdated`, `onRemoved` vào `MockChrome.tabs` interface + implementation
- **Lesson**: Khi thêm chrome API call mới, cập nhật mock ngay

### [B06] Convert TS→MP4 fail: TDZ "Cannot access 'i' before initialization"
- **Symptom**: Download video xong, convert fail ngay sau ~170ms, save .ts fallback. UI không hiện phase Converting
- **Root cause**: Trong `ffmpegRunner.ts` → `convertTsToMp4V2()`, progress callback reference `parallelResult?.workerCount` TRƯỚC khi `parallelResult` được gán (TDZ violation). `parallelResult` là kết quả của `executeParallelConversion()` — chưa return khi callback được gọi
- **Fix**: Thay `parallelResult?.workerCount` bằng `currentWorkerCount` (mutable `let`, gán sau khi `executeParallelConversion` return)
- **File**: `src/offscreen/ffmpegRunner.ts` → `convertTsToMp4V2()`
- **Guard**: E2E `convert-mp4.spec.ts` verify UI reaches "Converting" phase

### [B07] Convert fail: `parallelFallback: 'save-ts'` quá aggressive
- **Symptom**: Khi parallel conversion fail, không fallback sang sequential → save .ts thay vì .mp4
- **Root cause**: Default `parallelFallback: 'save-ts'` → `decideFallback()` return `action: 'fail'` → throw error, không thử sequential
- **Fix**: Đổi default `parallelFallback` từ `'save-ts'` → `'sequential'` trong `config.ts`
- **File**: `src/constants/config.ts` → `DEFAULT_SETTINGS.parallelFallback`
- **Guard**: Unit test `store.test.ts` + `integration.test.ts` verify default

### [B08] Convert fail: `executeWithFallback` không catch `{success: false}` return
- **Symptom**: Parallel conversion return `{success: false}` (không throw) → sequential fallback không được gọi
- **Root cause**: `executeWithFallback` chỉ catch THROWN errors, không check `result.success`. `transmuxTsToFmp4ParallelExperimental` return `{success: false}` thay vì throw
- **Fix**: Trong `parallelCoordinator.ts`, throw error nếu `parallelResult.success === false` trước khi return từ `parallelFn`
- **File**: `src/lib/converters/parallelCoordinator.ts` → `executeParallelConversion()`
- **Guard**: E2E `convert-mp4.spec.ts` verify conversion reaches Done or Converting

### [B09] Two-phase progress không đến popup
- **Symptom**: UI chỉ hiện "downloading" → "done", không hiện phase "Converting"
- **Root cause**:
  1. `handleConversionProgressUpdate` trong `index.ts` không set `downloadProgress`/`convertProgress`
  2. `useDownloadProgress.ts` không destructure/map `downloadProgress`/`convertProgress` vào store
  3. `downloader.reportProgress` set `convertProgress` cho phase 'converting' → conflict với offscreen broadcast (85% → 0%)
- **Fix**:
  1. `handleConversionProgressUpdate`: set `downloadProgress=100, convertProgress=payload.percent`
  2. `useDownloadProgress`: destructure + map `downloadProgress`, `convertProgress` vào patch
  3. `reportProgress`: chỉ set `convertProgress` cho 'done', KHÔNG set cho 'converting' (offscreen broadcast riêng)
- **Files**: `src/background/index.ts`, `src/popup/hooks/useDownloadProgress.ts`, `src/background/downloader.ts`
- **Guard**: E2E `convert-mp4.spec.ts` verify two-phase UI (Download 100% + Converting)

### [B10] Convert TS→MP4 timeout: `done` event registered AFTER `flush()`
- **Symptom**: Convert fail sau ~108s (timeout), save .ts fallback. CLI benchmark chạy OK (2.5s)
- **Root cause**: mux.js fire `done` event **synchronously** trong `flush()`. Cả `transmuxWorker.ts` và `tsTransmuxer.ts` register `done` listener AFTER `flush()` → event bị miss → worker/promise timeout
- **Verify**: CLI test `scripts/test-transmux-timing.mjs` — `done` BEFORE flush = 2.1s, `done` AFTER flush = timeout 60s
- **Fix**: Register `done` listener BEFORE `flush()`:
  - `transmuxWorker.ts`: Move `transmuxer.on('done', ...)` trước `transmuxer.flush()`
  - `tsTransmuxer.ts`: Tạo `donePromise = waitForDone(transmuxer, totalBytes)` trước `flush()`, rồi `await donePromise` sau
- **Files**: `src/offscreen/transmuxWorker.ts`, `src/lib/converters/tsTransmuxer.ts`
- **Guard**: E2E `convert-mp4.spec.ts` verify conversion completes (1.5m thay vì 5-11m timeout)

### [B11] m3u8 download trả 0KB trên signed URL (streamfree.vip)
- **Symptom**: Download video từ yanhh3d.ee → file 0KB. Hoạt động OK trên kisskh.co
- **Root cause 1**: `m3u8Parser.ts` `resolveUrl()` dùng `new URL(rel, base)` — **không carry-over query params** từ base URL. Signed URLs (streamfree.vip) có auth tokens trong query string của master playlist → segment URLs mất tokens → 403 Forbidden
- **Root cause 2**: Không guard 0 segments. Nếu server return HTML error page (200 OK) thay vì m3u8, parser tìm 0 segments → download proceeds → save 0-byte file
- **Fix 1**: `resolveUrl()` — nếu resolved URL không có query params nhưng base URL có, append base query params
- **Fix 2**: `downloadM3u8Video()` — throw error nếu `playlist.segments.length === 0`
- **Files**: `src/lib/parsers/m3u8Parser.ts` (resolveUrl), `src/background/downloader.ts` (0-segment guard)
- **Guard**: 4 unit tests cho query param carry-over, 1 unit test cho 0-segment guard

### [B12] Subtitle language hiển thị raw code "en" thay vì "english"
- **Symptom**: SubtitleCard hiển thị "en" thay vì "english" khi URL có ISO code
- **Root cause**: `useSubtitleLanguage` chỉ fetch content khi `language === 'unknown'`. Subtitle có code từ URL bị bỏ qua, UI hiển thị raw code
- **Fix**: Thêm `isoCodeToLabel()` trong `languageDetector.ts` — map ISO 639-1 (2-letter) + ISO 639-2 (3-letter) → lowercase label. `useSubtitleLanguage` dùng URL code trước (no fetch), fallback content detection
- **Files**: `src/lib/detectors/languageDetector.ts` (ISO_LANGUAGE_MAP + isoCodeToLabel), `src/popup/hooks/useSubtitleLanguage.ts` (URL code wins)
- **Guard**: 5 unit tests cho isoCodeToLabel (2-letter, 3-letter, case-insensitive, unknown, invalid)
- **Note**: Labels lowercase — `en` → `english` (không phải `English`)

### [B13] Toolbar badge màu đỏ trông như error
- **Symptom**: Badge số media màu đỏ `#ef4444` — trông giống notification lỗi
- **Root cause**: Hardcoded red color, không dùng design system
- **Fix**: Đổi sang `#2563eb` (primary blue) + thêm `setBadgeTextColor({ color: '#ffffff' })` (white text)
- **Files**: `src/background/index.ts` (updateBadgeForTab), `tests/unit/background/integration.test.ts` (mock + assertion)
- **Guard**: Unit test verify badge color + text color

### [B14] Deprecation cleanup — unused deps + dead code + duplicate implementations
- **Symptom**: Codebase tích lũy dead code, unused dependencies, duplicate formatting functions
- **Root cause**: Code is a liability — mọi line có maintenance cost. Không có periodic cleanup
- **Deprecation process** (followed `deprecation-and-migration` skill):
  1. **Audit**: Subagent scan cho unused exports, dead deps, prototype files, undocumented scripts
  2. **Verify**: Manually grep + read để confirm findings (subagent có thể sai)
  3. **Remove unused deps**: `@ffmpeg/ffmpeg` + `@ffmpeg/util` — 0 imports trong src/, transmuxing dùng `mux.js`
  4. **Consolidate duplicates**: `format.ts` (formatBytes, phaseToLabel — 0 importers) + `DownloadCard.tsx` (local formatFileSize, formatDuration, PHASE_LABELS) → merge vào `format.ts`, import trong DownloadCard
  5. **Remove prototype artifacts**: `docs/prototype/app.js`, `index.html`, `styles.css` — superseded by React implementation
  6. **Remove dead export**: `stripInlineTagsOnly` từ `vttToSrt.ts` — 0 importers trong src/, chỉ dùng trong test
  7. **Remove undocumented scripts**: `scripts/test-mp4-quick.mjs`, `scripts/test-subtitle-lang.mjs` — không có docs reference
- **Files**: package.json, src/popup/utils/format.ts, src/popup/components/media/DownloadCard.tsx, src/lib/converters/vttToSrt.ts, tests/utils/format.test.ts, tests/unit/converters/vttToSrt.test.ts
- **Guard**: 18 unit tests cho format.ts (formatBytes + formatFileSize + formatDuration + phaseToLabel)

### [B15] HLS edge cases — AES-128, fMP4, byte-range, ad skip, nested master
- **Symptom**: Extension chỉ download plain HLS (.ts segments, no encryption). Encrypted streams, fMP4/CMAF, byte-range, ad-laden, và nested master playlists không hoạt động
- **Root cause**: Parser chỉ parse `#EXTINF` + `#EXT-X-STREAM-INF`. Downloader chỉ fetch → OPFS → transmux. Không handle encryption, init segments, byte ranges, discontinuity, hoặc nested masters
- **Fix**:
  - **Parser** (`m3u8Parser.ts`): Parse `#EXT-X-KEY` → `HlsEncryption { method, keyUri, iv }`, `#EXT-X-MAP` → `HlsInitSegment { uri, byteRange }`, `#EXT-X-BYTERANGE` → `ByteRange { length, offset }` (attach to next segment), `#EXT-X-DISCONTINUITY` → mark next segment `discontinuity: true`, `#EXT-X-ENDLIST` → `hasEndlist: boolean`. New helper: `parseByteRange(value)`
  - **Types** (`types/media.ts`): New interfaces `ByteRange`, `HlsEncryption`, `HlsInitSegment`. `TsSegment` gained `byteRange?`, `discontinuity?`. `M3u8Playlist` gained `encryption?`, `initSegment?`, `hasEndlist?`
  - **Downloader** (`downloader.ts`):
    - `fetchKey(keyUri, tabUrl, cacheKey)` — fetch AES-128 key, cache per download (keyCache field)
    - `decryptSegment(blob, key, encryption, sequence)` — WebCrypto `crypto.subtle.decrypt` AES-CBC
    - `parseIvFromHex(ivHex)` — hex string → 16-byte Uint8Array
    - `deriveIvFromSequence(sequence)` — RFC 8216 §4.3.2.4 IV derivation (16-byte big-endian)
    - `fetchSegmentWithRange(url, tabUrl, byteRange)` — Range header support (206 vs 200)
    - `downloadM3u8Streaming` now takes `M3u8Playlist` (not just `TsSegment[]`)
    - Ad skip: section-based detection (even sections=content, odd=ad)
    - fMP4 path: fetch init segment → write to OPFS → concat .m4s → save .mp4 (NO transmux)
    - Nested master: loop with `MAX_MASTER_DEPTH=3`
- **Key learnings**:
  - AES-128 decryption via WebCrypto `crypto.subtle.decrypt` with AES-CBC — key fetched as ArrayBuffer, imported via `crypto.subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['decrypt'])`
  - IV derivation from sequence number (RFC 8216 §4.3.2.4): 16-byte big-endian, sequence in last 8 bytes, first 8 bytes zero
  - fMP4 concat: init segment (ftyp+moov) + .m4s fragments (moof+mdat) = valid MP4, no transmux needed — faster than TS→fMP4 via mux.js
  - Ad skip: section-based detection — even sections (0, 2, 4...) = content, odd sections (1, 3, 5...) = ad. DISCONTINUITY tags delimit sections
  - Byte-range: `Range: bytes={offset}-{offset+length-1}` header. Server returns 206 (Partial Content) or 200 (ignored Range, full content). Both accepted
  - Nested master: some CDNs nest master playlists (master → master → media). Loop with `MAX_MASTER_DEPTH=3` to prevent infinite recursion
  - `crypto.subtle` polyfill needed in jsdom tests — Node's `globalThis.crypto.webcrypto` provides `crypto.subtle` in test environment
- **Files**: `src/lib/parsers/m3u8Parser.ts`, `src/types/media.ts`, `src/background/downloader.ts`, `tests/unit/parsers/m3u8Parser.test.ts`, `tests/unit/background/downloader.test.ts`
- **Guard**: +14 unit tests (m3u8Parser: +6 KEY/MAP/BYTERANGE/DISCONTINUITY/ENDLIST, downloader: +14 AES decrypt/fMP4/byte-range/ad skip/nested master). Total: 690 → 704

### [B16] `credentials: 'include'` causes CORS block on CDNs with `Access-Control-Allow-Origin: *`
- **Symptom**: Extension reports "Failed to fetch video: 403" when downloading from sites like themoviebox.org, even though Referer header is correctly set via `buildFetchHeaders()`.
- **Root cause**:
  - CDN (e.g., `bcdnxw.hakunaymatata.com`) returns `Access-Control-Allow-Origin: *` in response headers
  - Extension's `fetch()` used `credentials: 'include'` for MP4/M3U8/subtitle/key fetches
  - Browser CORS policy: when `credentials: 'include'`, `Access-Control-Allow-Origin` must be a specific origin (not `*`) — otherwise the response is BLOCKED
  - This is NOT a 403 from the server — it's a CORS block by the browser. The error message "Failed to fetch video: 403" was misleading because the fetch threw before the response could be read.
- **Discovery method**: Used Playwright MCP browser to test themoviebox.org in real browser context:
  1. Fetch with no credentials → 200 OK
  2. Fetch with `credentials: 'include'` → "Failed to fetch" (CORS block)
  3. Fetch with `credentials: 'same-origin'` → 200 OK
  4. Fetch with `credentials: 'omit'` → 200 OK
  5. Console error: "The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'"
- **Fix**: Changed all `credentials: 'include'` → `credentials: 'same-origin'` in `downloader.ts` for:
  - `downloadMp4Video` (line 581)
  - `downloadM3u8Video` playlist fetch (line 612)
  - `downloadM3u8Video` variant fetch (line 632)
  - `fetchAllSegments` playlist fetch (line 536)
  - `fetchKey` AES key fetch (line 427)
  - `downloadSubtitle` (line 278)
  - Segment fetches already used `credentials: 'same-origin'` (line 385, 506).
- **Key learnings**:
  - `credentials: 'include'` + `Access-Control-Allow-Origin: *` = CORS BLOCK (browser-level, not server)
  - Most streaming CDNs return `Access-Control-Allow-Origin: *` (wildcard) — they don't need cookies
  - CDN auth is typically via Referer header + signed URL (query params), NOT cookies
  - `credentials: 'same-origin'` is the correct mode for cross-origin CDN fetches from extension SW
  - The "403" error message was misleading — the actual failure was a CORS TypeError, not an HTTP 403
- **Guard**: Always use `credentials: 'same-origin'` for cross-origin CDN fetches. Only use `credentials: 'include'` for same-origin API calls that need session cookies.

---

## ARCHITECTURE DECISIONS

### [A01] Filename Source — 3 modes
- `title-fallback` (default): Title nếu meaningful, else beautified URL
- `title-only`: Title nếu meaningful, else "untitled"
- `url-only`: Luôn beautified URL, bỏ qua title
- Áp dụng cho cả video và subtitle
- Subtitle luôn dùng URL (language code không phải filename)
- File: `fileUtils.ts` → `resolveFilenameBase()`

### [A02] URL Beautification pipeline
1. `decodeURIComponent` (graceful fallback)
2. Strip query/hash
3. Smart apostrophe: `Girl-s` → `Girl's`
4. `---` → ` - ` (separator)
5. `--` → ` - `
6. `[-_.+]` → space
7. `/` → ` - ` (path separator)
8. Collapse spaces, trim
- File: `fileUtils.ts` → `beautifyUrlFilename()`

### [A03] Video metadata enrichment
- `videoDetector.ts` chỉ có stream URL (e.g. `cdn.example.com/index.m3u8`)
- Background `enrichVideo()` gọi `chrome.tabs.get(tabId)` → cập nhật:
  - `tabUrl` = page URL (e.g. `kisskh.co/Drama/.../Episode-1`)
  - `title` = page title (e.g. "A Good Girl's Guide to Murder S2 EP1")
- Re-broadcast `DETECTED_MEDIA_UPDATE` sau khi enrich
- File: `index.ts` → `enrichVideo()`

### [A04] Tab cleanup listeners
- `chrome.tabs.onUpdated` (status='loading') → `clearTab(tabId)` — clear khi navigate/reload
- `chrome.tabs.onRemoved` → `clearTab(tabId)` — clear khi đóng tab
- Đăng ký trong `wireEvents()`, cleanup trong `unsubscribers`
- File: `index.ts` → `wireEvents()`

### [A05] Pause/Resume = cancel + re-queue (không phải abort+resume)
- **Decision**: Pause dùng cùng pattern với cancel — `cancelledIds.add(id)` → `throwIfCancelled` abort fetch
- **Resume**: `cancelledIds.delete(id)` + queue re-queue → download chạy lại từ segment 0
- **Lý do**: AbortController + OPFS streaming resume phức tạp. Re-queue đơn giản, tái sử dụng cancel pattern
- **Trade-off**: Mất progress download, phải tải lại từ đầu. Hiện "Waiting…" khi resume
- **Files**: `downloader.ts` → `pause()/resume()`, `downloadQueue.ts` → `pause()/resume()`

### [A06] Two-phase progress (downloadProgress + convertProgress)
- **Vấn đề**: `progress` field là overall (download + convert gộp), không đủ để vẽ 2 bar riêng
- **Fix**: Thêm `downloadProgress` + `convertProgress` vào `DownloadItem` + `DownloadProgress`
- `reportProgress()` set cả 3:
  - `downloading`: `downloadProgress = progress`, `convertProgress = undefined`
  - `converting`: `downloadProgress = 100`, `convertProgress = progress`
  - `done`: cả 2 = 100
- DownloadCard render 2 bar khi `converting && downloadProgress >= 100`
- **Files**: `types/media.ts`, `downloader.ts` → `reportProgress()`, `downloadQueue.ts` → `updateProgress()`

### [A07] Retry = reset item + clear cancel flag + OPFS cleanup
- `downloader.retry(id)`: `cancelledIds.delete(id)` + `deleteDownloadSubdir(id)` (cleanup partial files)
- `downloadQueue.retry(id)`: reset `status='queued'`, `progress=0`, `error=undefined`, `downloadProgress=undefined`, `convertProgress=undefined`
- Chỉ retry khi `status === 'error'` hoặc `'cancelled'`
- **Files**: `downloader.ts` → `retry()`, `downloadQueue.ts` → `retry()`

### [A08] Default quality auto-apply = reorder variants
- Khi user đổi `defaultQuality` (không phải auto/highest) → `useEffect` reorder `video.variants`
- Variant có quality match đưa lên đầu → `variants[0]` = selected (VideoCard dùng `variants[0]`)
- Không thêm field `selectedVariantId` — dùng thứ tự variants
- **File**: `App.redesigned.tsx` → `useEffect[settings.defaultQuality]`

### [A09] Subtitle language: URL code wins, content fallback
- **Resolution order**: (1) ISO code từ URL → `isoCodeToLabel()` → label ngay (no fetch); (2) `unknown` hoặc code không trong map → fetch content → `detectLanguage()`
- **Lý do**: URL code đáng tin hơn (server đặt tên file theo ngôn ngữ), nhanh hơn (no network), tiết kiệm bandwidth
- **ISO map**: ~184 mã ISO 639-1 (2-letter) + ~184 mã ISO 639-2 (3-letter) → lowercase labels
- **Files**: `languageDetector.ts` (ISO_LANGUAGE_MAP + isoCodeToLabel), `useSubtitleLanguage.ts` (2-phase logic)

### [A10] VideoCard/SubtitleCard layout — minimal flat tags
- **Layout**: mainRow (icon | body | actions) + optional urlPanel (expand)
- **Tags**: text xám nhạt (`--color-text-muted`), không nền/border/màu — cùng style như `.meta`
- **Tag row**: dưới title, chứa format + quality + size (video) hoặc language + format + size (subtitle)
- **URL panel**: expand chevron → slide-down panel với copy button (clipboard icon + URL text)
- **Copied badge**: nền `--color-success` (xanh lá), text "Copied"
- **Files**: `VideoCard.tsx`, `VideoCard.module.css`, `SubtitleCard.tsx`, `SubtitleCard.module.css`

### [A11] Toolbar badge — primary blue + white text
- **Color**: `#2563eb` (primary blue) thay vì `#ef4444` (red/error)
- **Text color**: `#ffffff` (white) — explicit set via `setBadgeTextColor`
- **Lý do**: Red implies error/urgent. Blue matches design system primary, neutral + informative
- **File**: `background/index.ts` → `updateBadgeForTab()`

### [A12] m3u8 resolveUrl — query param carry-over
- **Vấn đề**: `new URL(rel, base)` không carry-over query params từ base URL
- **Fix**: Nếu resolved URL không có query params nhưng base URL có → append base query
- **Lý do**: Signed HLS URLs (streamfree.vip, etc.) đặt auth tokens trong query string của master playlist → segment/variant URLs cần tokens để fetch
- **Điều kiện**: Chỉ carry-over khi resolved URL **không có** query params (không override segment's own params)
- **File**: `m3u8Parser.ts` → `resolveUrl()`

---

## GOTCHAS

### [G01] Popup window vs Browser window
- `chrome.tabs.query({ currentWindow: true })` trong popup → trả popup window, KHÔNG phải browser
- Dùng `currentWindow: false` hoặc `lastFocusedWindow` để lấy browser tab
- Áp dụng cho: `getActiveTabId()`, `handleDownloadAll()`, `useActiveTabTitle()`

### [G02] webRequest tabId ≠ content script tabId
- `webRequest.onBeforeRequest` có thể gắn tabId của iframe/redirect
- Content script `chrome.tabs.query` gắn tabId của trang chính
- `getMedia(tabId)` có thể trả rỗng dù media tồn tại
- **Fix**: Fallback `getAllVideos()` + `getAllSubtitles()` khi `getMedia(tabId)` rỗng

### [G03] Service Worker có thể bị kill giữa các message
- MV3 SW bị terminate sau ~30s idle
- `sendMessage` có thể fail "Receiving end does not exist"
- `useDetectedMedia` đã có retry 3 lần với delay 500ms

### [G04] crypto.randomUUID() tạo ID mới mỗi lần
- Không dùng UUID làm Map key cho dedup — dùng `url + tabId` thay thế
- UUID chỉ cho download item ID (mỗi download là unique)

### [G05] E2E test cần navigate trang web trước
- Popup mở trên trang trắng → không có media để test
- Luôn `page.goto(VIDEO_URL)` + `waitForTimeout(15000)` trước `openPopup()`

### [G06] Reload extension sau khi build
- `npm run build` → `dist/` cập nhật
- Nhưng Chrome cache extension cũ → cần reload trong `chrome://extensions`
- E2E Playwright tự load `dist/` mới mỗi lần

---

## FILE MAP — Key files

| File | Vai trò |
|------|---------|
| `src/background/index.ts` | Background SW: message handlers, event wiring, enrichment, **toolbar badge** |
| `src/background/networkInterceptor.ts` | webRequest listener, media storage (Map), dedup |
| `src/background/downloader.ts` | Download logic: fetch, convert, save, **pause/resume/retry**, **0-segment guard**, **AES-128 decrypt**, **fMP4 concat**, **byte-range**, **ad skip**, **nested master** |
| `src/background/downloadQueue.ts` | Queue: concurrency, **pause/resume/cancel/retry/remove** |
| `src/lib/detectors/languageDetector.ts` | **detectLanguage()** (content-based) + **isoCodeToLabel()** (ISO 639-1/639-2 → lowercase label) |
| `src/lib/parsers/m3u8Parser.ts` | M3U8 parsing + **resolveUrl carry-over query params** + **KEY/MAP/BYTERANGE/DISCONTINUITY/ENDLIST parsing** |
| `src/lib/utils/fileUtils.ts` | Filename utils: sanitize, beautify, resolve |
| `src/popup/utils/format.ts` | **Format utils: formatBytes, formatFileSize, formatDuration, phaseToLabel** (single source of truth) |
| `src/popup/App.redesigned.tsx` | Popup UI: media list, downloads, settings, **download controls** |
| `src/popup/hooks/useMediaDisplayTitle.ts` | Resolve display title từ filenameSource |
| `src/popup/hooks/useSubtitleLanguage.ts` | **Subtitle language: ISO code from URL (wins) → content fallback** |
| `src/popup/hooks/useDetectedMedia.ts` | Subscribe media từ background |
| `src/popup/hooks/useDownloadProgress.ts` | Subscribe download progress |
| `src/popup/store/popupStore.ts` | Zustand store: videos, subtitles, downloads, settings |
| `src/popup/components/media/VideoCard.tsx` | **Video card: title, tags (format/quality/size), expand URL, download** |
| `src/popup/components/media/SubtitleCard.tsx` | **Subtitle card: title, tags (language/format/size), expand URL, download** |
| `src/popup/components/media/DownloadCard.tsx` | Download card: **two-phase progress, action buttons, phase labels, details** |
| `src/popup/components/SelectionBar.tsx` | **Selection bar: clear, count, download selected** |
| `src/popup/components/settings/SettingsDialog.tsx` | Settings dialog + CustomSelect |
| `src/constants/config.ts` | Defaults, GENERIC_TITLES, STORAGE_KEYS |
| `src/constants/messages.ts` | Message type constants (incl. **RETRY_DOWNLOAD, REMOVE_DOWNLOAD**) |
| `src/types/media.ts` | Types: DetectedVideo, DownloadItem (+**quality, downloadProgress, convertProgress**), Settings, **ByteRange, HlsEncryption, HlsInitSegment** |
| `src/types/message.ts` | Message types: payloads cho background ↔ popup (+**RETRY/REMOVE**) |

---

## TEST MAP

| File | Số test | Nội dung |
|------|---------|----------|
| `tests/unit/utils/fileUtils.test.ts` | 68 | sanitize, beautify, resolve, generate |
| `tests/utils/format.test.ts` | 18 | **formatBytes, formatFileSize, formatDuration, phaseToLabel** |
| `tests/unit/popup/useMediaDisplayTitle.test.ts` | 15 | display title resolution |
| `tests/unit/background/networkInterceptor.test.ts` | 22 | detection, dedup, clearTab |
| `tests/unit/background/integration.test.ts` | ~30 | background message handlers, **toolbar badge** |
| `tests/unit/detectors/languageDetector.test.ts` | 35 | LANGUAGE_PROFILES, detectLanguage, **isoCodeToLabel** |
| `tests/unit/parsers/m3u8Parser.test.ts` | 32 | parse, resolveUrl, **query param carry-over**, **KEY/MAP/BYTERANGE/DISCONTINUITY/ENDLIST** |
| `tests/unit/background/downloader.test.ts` | 36 | download flow, **0-segment guard**, **AES-128 decrypt**, **fMP4 concat**, **byte-range**, **ad skip**, **nested master** |
| `e2e/filename-source.spec.ts` | 2 | kisskh.co real URL, settings persist |
| `e2e/redesigned-popup.spec.ts` | 3 | popup UI, theme, settings dialog |
| `e2e/kisskh.spec.ts` | 2 | kisskh detection, download |
| `e2e/subtitle-language.spec.ts` | 6 | subtitle language detection (english, chinese, vietnamese, korean, japanese, russian) |
| **Total Jest** | **712** | |
| **Total E2E** | **13** | |

---

## BUILD & TEST COMMANDS

```bash
# Typecheck
npx tsc --noEmit

# Build extension → dist/
npm run build

# Run all Jest tests
npx jest --silent

# Run specific test file
npx jest tests/unit/utils/fileUtils.test.ts --verbose

# Run E2E (needs Chrome)
npx playwright test e2e/filename-source.spec.ts --reporter=line --timeout 120000

# CLI stress test for filename logic
node scripts/test-filename.mjs
```
