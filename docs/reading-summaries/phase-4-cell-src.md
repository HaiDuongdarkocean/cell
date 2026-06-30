# Phase 4 — Cell src/ Reading Summary (Vietnamese)

> Đã đọc toàn bộ ~75 file source code + docs của Cell (Chrome Extension MV3 video downloader).
> File này tóm tắt architecture hiện tại, các layer, data flow, và integration points
> cho việc mở rộng thành Orca (dict/vocab/flashcard/subtitle-overlay/video-learning).

---

## Architecture hiện tại

- **Folder structure**: `src/` chia 6 layer — `background/` (service worker MV3), `content/` (content script), `offscreen/` (offscreen document + Web Workers), `popup/` (React UI), `lib/` (pure logic: detectors/parsers/converters/selectors/storage/utils), `constants/` + `types/` (config + type defs). Build bằng Vite + `@crxjs/vite-plugin`.
- **Data flow chính**: Network request → `NetworkInterceptor` (webRequest) → `videoDetector`/`subtitleDetector` → lưu per-tab Map → `onMediaDetected` callback → background enrich (tabUrl, title) → broadcast `DETECTED_MEDIA_UPDATE` → popup `useDetectedMedia` hiển thị. User click download → `DOWNLOAD_VIDEO`/`DOWNLOAD_SUBTITLE` → `Downloader` fetch segments → OPFS `input.ts` → offscreen `CONVERT_TS_TO_MP4_V2` → `output.mp4` → `CREATE_OPFS_BLOB_URL` → `chrome.downloads.download`.
- **MV3 constraints**: Service worker không chạy WASM/WebWorkers → transmux TS→MP4 delegate sang offscreen document. Service worker không tạo Blob URL → Blob URL tạo ở offscreen. OPFS shared trong extension origin nên SW + offscreen đọc/ghi cùng file mà không truyền buffer qua message (cap ~64MB).
- **Tab-scoping**: Media + downloads lưu per-tabId. Popup resolve active content tab qua `getActiveContentTab()` (3 query shapes song song, filter `chrome-extension://` cho Edge app-window). Broadcast `DETECTED_MEDIA_UPDATE`/`DOWNLOAD_PROGRESS_UPDATE` carry `tabId`, popup filter theo tabIdRef.
- **Session restore**: Media + downloads persist vào `chrome.storage.session` để sống sót SW restart. `sessionReady` promise cho GET handlers await trước khi trả data.
- **Auto-download**: Whitelist (origin+pathname, drop last segment) → `tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds)` → `selectBestMedia` → enqueue. Incremental: m3u8 capture trước, subtitle đến sau → re-run với skip set để catch-up subtitle mà không re-download video.
- **Settings**: 12 settings persist `chrome.storage.local` key `settings`. Popup `loadPersistedSettings` + background `loadSettings` apply vào DownloadQueue/Downloader. Migration: `defaultSubtitleLanguage` (string) → `selectedSubtitleLanguages` (string[]).
- **Build**: `npm run build` (vite), `npm test` (jest unit+integration), `npm run test:e2e` (playwright). Jest projects split unit (~3s) vs integration (real m3u8 download + transmux).

---

## Background Service Worker

- **Orchestrator pattern**: `BackgroundService` class tạo 5 building blocks — `NetworkInterceptor`, `MessageBus`, `DownloadQueue`, `Downloader`, `OffscreenManager`. `init()` register handlers sync trước, rồi load settings, wire events, start interceptor, cleanup OPFS orphans, update badge.
- **Handlers** (~20): `GET_DETECTED_MEDIA`, `DOWNLOAD_VIDEO`, `DOWNLOAD_SUBTITLE`, `DOWNLOAD_ALL`, `CANCEL_DOWNLOAD`, `PAUSE_DOWNLOAD`, `RESUME_DOWNLOAD`, `RETRY_DOWNLOAD`, `REMOVE_DOWNLOAD`, `GET_DOWNLOAD_PROGRESS`, `UPDATE_SETTINGS`, `TOGGLE_EXTENSION`, `UPDATE_SUBTITLE_LANGUAGE`, `PAGE_SCAN_RESULT`, `CONVERT_TS_TO_MP4_V2`, `CREATE_OPFS_BLOB_URL`, `REVOKE_OPFS_BLOB_URL`, `OFFSCREEN_PING`. Mỗi handler là method private trên BackgroundService.
- **MessageBus**: Wrap `chrome.runtime.sendMessage`/`onMessage` typed. `on(type, handler)` register, `send(request, timeout)` request-response 30s timeout, `broadcast(payload)` fire-and-forget, `sendNoWait`. `handleMessage` dispatch theo `request.type`, catch error → `{success:false, error}`.
- **Event wiring**: `networkInterceptor.onMediaDetected` → enrich + broadcast `DETECTED_MEDIA_UPDATE` + `maybeAutoDownload`. `downloadQueue.onProgress` → broadcast `DOWNLOAD_PROGRESS_UPDATE`. `downloader.onProgress` → `downloadQueue.updateProgress`. `downloader.setConvertCallback` → offscreen conversion. `downloader.setSaveOpfsFileCallback` → offscreen Blob URL.
- **Downloader**: Class ~1200 dòng. `downloadM3u8Streaming` fetch segments song song (1-12), decrypt AES-128 (key cache, IV từ hex hoặc sequence), ghi OPFS streaming writer, track `segmentRangesMap`. `downloadMp4Direct` single fetch. `downloadSubtitle` fetch + convert (ASS→SRT, VTT→SRT, normalize SRT) + save. Pause=cancel+requeue, retry reset state. `onDeterminingFilename` listener cho Edge data: URL.
- **DownloadQueue**: Map<id, DownloadItem>, `maxConcurrent` (1-10), `processNext` loop while activeCount < max. Executor async, `.then` → done, `.catch` → error + notify listeners. `restore(item)` preserve status cho session restore. `removeByTab` cancel active + delete.
- **NetworkInterceptor**: `webRequest.onBeforeRequest` listener, filter extension requests (tabId=-1 hoặc initiator chrome-extension://). `handleRequest` → detectVideo/detectSubtitle → dedup by URL+tabId → notify listeners. `restoreMedia` cho session restore. `clearTab`/`clearAll`.
- **OffscreenManager**: `ensureOffscreenDocument` (hasDocument guard), `ensureOffscreenReady` ping-pong handshake (20 retries × 100ms), `closeOffscreenDocument`. Reasons: WORKERS + BLOBS.

---

## Content Script

- **content-script.ts**: Entry, chạy `document_idle`. Scan DOM lần đầu → gửi `PAGE_SCAN_RESULT {tabId, videoUrls, subtitleUrls}`. Start `MutationObserver` → khi có URL mới, gửi `PAGE_SCAN_RESULT` update.
- **pageScanner.ts**: `PageScanner` class. `extractUrlsFromDOM` quét `<video>`, `<source>`, `<track>`, `<a[href]>`, filter theo `VIDEO_URL_PATTERNS`/`SUBTITLE_URL_PATTERNS`, dedupe. `startObserving` MutationObserver childList+subtree, diff với `lastScanned`, callback khi có URL mới.
- **Role**: Bổ sung cho network interception — bắt media embed trực tiếp trong DOM mà webRequest không capture (vd. `<video src="...mp4">` local).

---

## Offscreen

- **ffmpeg.html**: HTML tối giản, load `ffmpegRunner.ts` module. Được Vite build thành chrome-extension page qua `rollupOptions.input.offscreen`.
- **ffmpegRunner.ts**: Listener `CONVERT_TS_TO_MP4_V2` → đọc `input.ts` OPFS → nếu parallel mode: `executeParallelConversion` (coordinator) → else sequential `transmuxTsToFmp4` → ghi `output.mp4` OPFS → respond `{outputName, mimeType, success}`. Broadcast `CONVERSION_PROGRESS_UPDATE` (percent, phase, fileSize, processedBytes, workerCount). Cũng handle `CREATE_OPFS_BLOB_URL` (read OPFS → Blob → URL, track activeBlobUrls) + `REVOKE_OPFS_BLOB_URL` + `OFFSCREEN_PING`.
- **transmuxWorker.ts**: Web Worker, nhận `{groupIndex, groupData}` Uint8Array (Transferable zero-copy). Tạo `Transmuxer` mux.js, push 4MB chunks, flush → 'done' event → merge chunks → postMessage `{output, success}` (Transferable). Timeout proportional to input size. Register 'done' BEFORE flush() (mux.js fire sync).
- **Pipeline**: SW download → OPFS input.ts → SW send CONVERT_TS_TO_MP4_V2 → offscreen read OPFS → transmux (sequential 4MB chunks hoặc parallel workers) → OPFS output.mp4 → SW send CREATE_OPFS_BLOB_URL → offscreen Blob URL → SW chrome.downloads.download(blobUrl) → SW send REVOKE_OPFS_BLOB_URL.

---

## lib/ — detectors, parsers, converters, selectors, storage, utils

### detectors/ (4)
- **videoDetector.ts**: `detectVideo(request)` → check `VIDEO_URL_PATTERNS`, extract extension, skip `.ts` (segment không standalone), m3u8 → variants=[], mp4/webm → single variant `auto`. Extract title từ URL pathname.
- **subtitleDetector.ts**: `detectSubtitle(request)` → check `SUBTITLE_URL_PATTERNS`, `detectFormat` (extension hoặc query param format/type/subtype, default vtt), `extractLanguage` (BCP 47 primary subtag từ filename hoặc path segment, fallback 'unknown').
- **scriptDetector.ts**: `detectScript(text)` → dominant Unicode script (26 scripts từ Scripts.txt). `scriptToCandidateLanguages` map script → candidate languages (single-candidate: Hangul→Korean, Hiragana→Japanese... ; multi-candidate: Latin, Cyrillic, Arabic, Devanagari, Han).
- **languageDetector.ts**: `detectLanguage(content, format)` hybrid 2-stage: script detection → frequency disambiguation (38 profiles, top-10 words 3+ chars, threshold 6-8). `isoCodeToLabel` (ISO 639-1/2 → 183 labels), `labelToIsoCode` reverse.

### parsers/ (4)
- **m3u8Parser.ts**: `parseM3u8(content, baseUrl)` → segments (EXTINF + URL), variants (EXT-X-STREAM-INF: bandwidth, resolution, codecs), encryption (EXT-X-KEY: AES-128, keyUri, IV), initSegment (EXT-X-MAP), byteRange, discontinuity, ENDLIST. `resolveUrl` carry-over query params. `assignVariantQualities` map resolution → 1080p/720p/480p/360p.
- **assParser.ts**: `parseAss(content)` → scriptInfo, styles (V4+), dialogues (Format + Dialogue lines, splitFields preserve comma in Text). Parse time H:MM:SS.cc → ms.
- **vttParser.ts**: `parseVtt(content)` → strip BOM, check WEBVTT header, parse cues (timing HH:MM:SS.mmm, optional cue id, optional cue settings ignored), skip malformed.
- **srtParser.ts**: `parseSrt(content)` → strip BOM, normalize CRLF, split by blank line, parse index + timing (HH:MM:SS,mmm) + text, sequential numbering.

### converters/ (19)
- **tsTransmuxer.ts**: Sequential TS→fMP4 via mux.js. Read 4MB chunks, pipeline prefetch (read chunk[i+1] while push chunk[i]). Serialized write chain (mux.js fire 'data' sync, không await). 'done' listener trước flush(). Timeout proportional. Memory ~1-2 fragments.
- **parallelTransmuxer.ts**: Parallel TS→fMP4 via Web Workers. `transmuxTsToFmp4ParallelExperimental` — split by segment groups, each worker transmux group (Transferable zero-copy), merge parts: `findFirstMoofOffset` strip ftyp+moov parts 1+, `offsetTfdtInPlace` cumulative tfdt offset, `updateMvhdDuration`. Fallback inline (Promise.all) khi Workers unavailable. `readSegmentRanges`/`writeSegmentRanges` OPFS JSON.
- **parallelCoordinator.ts**: `executeParallelConversion` — plan (policy+safety) → if parallel viable: try parallel with fallback → validate output → cleanup. Else sequential. Cancellation token registry. Single entry point cho offscreen.
- **parallelPlanner.ts**: `planParallelConversion` — combine `resolveParallelPolicy` + `analyzeParallelSafety` → `ParallelPlan {shouldUseParallel, workerCount, summary}`.
- **parallelPolicy.ts**: `resolveParallelPolicy` — mode off/auto/manual, file size gates (≥150MB), hardware ≥3 cores, worker count clamp (2-6, hardware-1, budget), auto: 2 workers <300MB, 4 workers ≥300MB.
- **parallelSafetyAnalyzer.ts**: `analyzeParallelSafety` — validate segmentRanges contiguous+monotonic, ≥MIN_PARALLEL_WORKERS segments, groupSegmentsByBytes → maxSafeWorkers = group count.
- **parallelFallback.ts**: `decideFallback` (sequential/retry-reduced/fail/save-ts) + `executeWithFallback` (try parallel, catch → decide → retry hoặc sequential).
- **parallelProgress.ts**: `ParallelProgressTracker` — phases planning(85-86%), transmuxing(86-95%), merging(95-98%), validating(98-99%), done(99-100%). `phaseToPercent`, `phaseLabel`.
- **parallelCancellation.ts**: `CancellationToken` + `CancellationTokenRegistry` (per downloadId). `cleanupParallelTempFiles` xóa `part-*.fmp4`.
- **segmentGrouping.ts**: `groupSegmentsByBytes` — balance by total bytes, contiguous segments, actualWorkers ≤ segment count, target bytes/group.
- **segmentMerger.ts**: `mergeTsSegments(Blob[])` → single Blob, preserve order, single = as-is.
- **mp4Validator.ts**: `validateFragmentedMp4` — parse top-level boxes, check ftyp first, moov exists, ≥1 moof+mdat pair, non-empty mdat. Fail closed.
- **assToSrt.ts**: `convertAssToSrt` — parse, sort by start, stripAssStyling (drawing blocks, override tags, \N→newline, \n→space), emit SRT.
- **vttToSrt.ts**: `convertVttToSrt` — parse VTT, stripVttInlineTags ({\...}, <...>), emit SRT comma timestamps.
- **srtNormalizer.ts**: `normalizeSrt` — strip BOM, WEBVTT header, inline tags, dot→comma timestamps, pad MM:SS→HH:MM:SS, strip cue settings, re-number.
- **conversionTimer.ts**: `ConversionTimer` — track phase durations (download, write-input, convert, save, cleanup, fallback), `logSummary`.
- **benchmarkHarness.ts**: `runBenchmark` + `compareBenchmarks` (speedup, verdict parallel-faster/sequential-faster/inconclusive).
- **autoEnablement.ts**: `evaluateGates` (≥1 benchmark, parallel faster ≥1.1x, failure rate ≤20%) → `resolveEffectiveMode` (auto→auto nếu gates pass, else off).
- **workerFactory.ts**: `createTransmuxWorker()` — `new Worker(new URL(...transmuxWorker.ts, import.meta.url), {type:module})`. Isolated để Jest không parse `import.meta.url`.

### selectors/ (1)
- **selectBestMedia.ts**: `selectBestMedia(videos, subtitles, settings)` pure function. 3 steps: format filter (preferredVideoFormat, fallback all), quality pick (highest/auto → top concrete; lowest → bottom; specific → exact hoặc nearest lower/higher), subtitle filter (selectedSubtitleLanguages hoặc 'all'). Returns `AutoSelectResult {videoId, subtitleIds, matchedFormat, matchedQuality, fallbackReason}`.

### storage/ (1)
- **opfsStorage.ts**: OPFS helpers. `ensureDownloadDir`/`ensureDownloadSubdir` (downloads/{id}/). `appendChunk` (seek to end trước write). `createOpfsWriter` (single open stream, write nhiều chunks). `readFile`, `deleteFile`, `writeJsonFile`, `readJsonFile`. `cleanupOrphanedDownloads` scan + remove. `isOpfsAvailable`, `isQuotaExceededError`.

### utils/ (4)
- **fileUtils.ts**: `sanitizeFileName`, `generateFileName`, `extractBaseNameFromUrl` (all meaningful path segments), `beautifyUrlFilename` (decode, smart apostrophe, ---→/, collapse spaces), `isTitleMeaningful` (≥3 chars, không trong GENERIC_TITLES), `resolveFilenameBase` (title-fallback/title-only/url-only), `buildSubtitleFileName` (base.lang.ext, lowercase lang, skip suffix nếu unknown/empty).
- **timeUtils.ts**: `assTimeToMs`, `vttTimeToMs`, `srtTimeToMs`, `msToSrtTime`, `msToAssTime`.
- **urlUtils.ts**: `resolveUrl`, `isAbsoluteUrl`, `getFileExtension`, `normalizeUrl` (collapse duplicate slashes, strip trailing).
- **whitelist.ts**: `normalizeUrl` (origin+pathname, drop last segment → category), `getWhitelist`/`isWhitelisted`/`addToWhitelist`/`removeFromWhitelist` via `chrome.storage.local` key `auto_download_whitelist`.

---

## Popup — store, hooks, components

- **State mgmt**: Zustand `popupStore.ts` — state: videos, subtitles, downloads, settings, extensionActive, isLoading, error, isSettingsLoaded. Actions: setVideos, setSubtitles, addDownload (merge logic: chooseStatus advancement, max progress, prefer metadata có URL), updateDownload, removeDownload, updateSettings (persist chrome.storage.local), loadPersistedSettings (migration defaultSubtitleLanguage→selectedSubtitleLanguages), loadExtensionStatus.
- **UI structure**: `App.redesigned.tsx` — Header (logo, extension toggle, auto-download toggle, theme toggle, settings) + Media section (VideoCard[], SubtitleCard[], MediaEmpty) + Downloads section (DownloadCard[]) + SelectionBar (fixed bottom) + SettingsDialog (modal). 400×600px popup.
- **Hooks**: `useDetectedMedia` (GET_DETECTED_MEDIA + filter DETECTED_MEDIA_UPDATE by tabId, retry 3×500ms), `useDownloadProgress` (GET_DOWNLOAD_PROGRESS + filter DOWNLOAD_PROGRESS_UPDATE by tabId, stub entry nếu chưa có), `useExtensionStatus` (TOGGLE_EXTENSION), `useMediaDisplayTitle` (resolve title theo filenameSource, subtitle dùng video context cùng tab), `useSubtitleLanguage` (URL code wins → content fetch + detectLanguage → writeback ISO code + push UPDATE_SUBTITLE_LANGUAGE).
- **Components**: `Header` (4 icon buttons), `VideoCard` (icon, title, format/quality tags, quality dropdown multi-variant, expand URL, download btn), `SubtitleCard` (icon, title=displayTitle, language tag, format/size, expand URL, download btn), `DownloadCard` (two-phase progress download+convert, phase labels, action buttons pause/resume/cancel/retry/remove, detail items bytes/workers/duration), `MediaEmpty` (3 types: videos/subtitles/downloads, scanning state), `SelectionBar` (count + clear + download), `SettingsDialog` (CustomSelect dropdowns + MultiSelect subtitle languages ~184 ISO codes + toggle switches), `MultiSelect` (search + selected pinned top + iOS toggle).
- **Auto-select**: Khi `autoSelectEnabled` ON + media loaded → `selectBestMedia` → setSelectedIds. Default quality change → reorder variants[0] = matched quality. Auto-download toggle ON → whitelist + immediate download best match.
- **Theme**: `theme.css` — CSS variables, light (Slate palette, Inter font) + dark (`[data-theme="dark"]`). `global.css` — reset, scrollbar, 400×600 #root, focus-visible.
- **getActiveContentTab**: 3 query shapes song song (currentWindow, lastFocusedWindow, all), merge priority, pick first NOT `chrome-extension://`. Fix Edge app-window leak.

---

## Messaging protocol

- **Message types**: 27 types trong `MessageType` union (message.ts) + `MESSAGE_TYPES` const (messages.ts). Groups: media detection (DETECT_MEDIA, GET_DETECTED_MEDIA, DETECTED_MEDIA_UPDATE), download (DOWNLOAD_VIDEO/SUBTITLE/ALL, CANCEL/PAUSE/RESUME/RETRY/REMOVE, GET_DOWNLOAD_PROGRESS, DOWNLOAD_PROGRESS_UPDATE), settings (GET/UPDATE_SETTINGS, GET_EXTENSION_STATUS, TOGGLE_EXTENSION, EXTENSION_STATUS_UPDATE, UPDATE_SUBTITLE_LANGUAGE), conversion (CONVERT_TS_TO_MP4_V2 + RESULT, CONVERSION_PROGRESS_UPDATE, CREATE/REVOKE_OPFS_BLOB_URL, OFFSCREEN_PING), content (PAGE_SCAN_RESULT).
- **Handler structure**: `MessageBus.on(type, handler)` register Map<type, handler>. `handleMessage` lookup handler → await → return `{success, data}` hoặc `{success:false, error}`. Background `registerHandlers()` bind mỗi type → method private.
- **Request-response vs broadcast**: `send()` request-response 30s timeout (popup→background). `broadcast()` fire-and-forget (background→popup, offscreen→background). Popup listener filter by tabId.

---

## Storage

- **OPFS**: Origin Private File System, shared SW + offscreen. Structure `downloads/{downloadId}/` — `input.ts` (merged segments), `output.mp4` (converted), `segment-ranges.json` (byte ranges cho parallel), `part-*.fmp4` (temp parallel parts). `createOpfsWriter` single open stream, `appendChunk` seek-to-end. Cleanup orphans on startup.
- **chrome.storage.local**: `settings` (12 settings), `extension_status` (boolean), `auto_download_whitelist` (WhitelistEntry[]). Persistent across sessions.
- **chrome.storage.session**: `session_media` (per-tab detected media), `session_downloads` (per-tab downloads). Survive SW restart, cleared on browser close. `sessionReady` promise cho GET handlers.

---

## Đã có vs Cần thêm

| Feature | Status |
|---|---|
| Video detection (m3u8/mp4/webm) | built |
| Subtitle detection (ass/vtt/srt) | built |
| M3U8 segment download + OPFS | built |
| MP4 direct download | built |
| TS→MP4 transmux (sequential) | built |
| TS→MP4 parallel (Web Workers) | built (feature flag, auto-enablement gates) |
| AES-128 decryption | built |
| fMP4 init segment (EXT-X-MAP) | built |
| Subtitle conversion (ASS/VTT→SRT, normalize) | built |
| Subtitle language detection (URL + content frequency) | built |
| Subtitle filename matches video + lang suffix | built |
| Download queue (concurrent, pause/resume/cancel/retry/remove) | built |
| Auto-download whitelist | built |
| Auto-select best media | built |
| Settings (12 configurable) | built |
| Popup UI (React + Zustand, 400×600) | built |
| Theme light/dark | built |
| Tab-scoping (Edge app-window fix) | built |
| Session restore (SW restart) | built |
| MP4 validation | built |
| Benchmark harness + auto-enablement | built |
| **Dictionary lookup** | planned (Orca) |
| **Vocabulary tracking (word status)** | planned (Orca) |
| **Flashcard creation + Anki sync** | planned (Orca) |
| **Subtitle overlay on video** | planned (Orca) |
| **Video learning mode (auto-pause, loop, navigation)** | planned (Orca) |
| **Dual subtitle (native + translation)** | planned (Orca) |
| **Whisper subtitle generation** | planned (Orca) |
| **Word popup (hover/click tra từ)** | planned (Orca) |
| **Page difficulty / i+1 detection** | planned (Orca) |
| **Bookmark + flashcard from bookmark** | planned (Orca) |
| **Statistics + review forecast** | planned (Orca) |
| **Google Drive sync** | planned (Orca) |
| **TTS + audio clip** | planned (Orca) |
| **EPUB/PDF reader** | planned (Orca) |
| **Podcast manager** | planned (Orca) |

---

## Architecture Insights for integration

- **Extension điểm chèn dict/vocab**: Content script (`content-script.ts`) hiện chỉ scan media → có thể thêm hover/click word detection + popup. `messageBus` đã typed → thêm `LOOKUP_WORD`, `ADD_VOCAB` message types. Background `registerHandlers()` pattern dễ mở rộng.
- **Subtitle overlay**: `pageScanner.ts` đã quét `<video>` + `<track>` → có thể inject subtitle overlay DOM. Content script chạy `document_idle` → phù hợp overlay. Cần `videoDetector` mở rộng để track video element reference (hiện chỉ URL).
- **Video learning mode**: `Downloader` đã có OPFS `output.mp4` → có thể play local video trong popup/app-window. `transmuxWorker.ts` + offscreen pattern sẵn sàng cho Whisper WASM (cùng offscreen document, thêm reason AUDIO_CAPTURE).
- **Dictionary storage**: `opfsStorage.ts` pattern (OPFS cho file lớn + chrome.storage.local cho metadata) mở rộng cho dictionary DB. Orca v3 dùng IndexedDB → Cell có thể thêm `lib/storage/indexedDb.ts` song song OPFS.
- **Flashcard/Anki**: `messageBus` request-response pattern phù hợp cho AnkiConnect (fetch HTTP localhost). `popupStore` Zustand pattern dễ thêm `flashcards` state + actions.
- **Vocab tracking**: `DetectedSubtitle` đã có `language` field → subtitle cues (parseVtt/parseSrt/parseAss) cho word extraction. `languageDetector` frequency profiles có thể reuse cho i+1 detection.
- **Settings mở rộng**: `Settings` type trong `media.ts` + `DEFAULT_SETTINGS` trong `config.ts` + `SettingsDialog.tsx` — thêm fields (nativeLanguage, uiLanguage, ttsConfig, aiConfig, keyboardShortcuts...) theo pattern hiện có. `loadPersistedSettings` migration pattern sẵn sàng.
- **Multi-page app**: Hiện popup 400×600 → Orca cần app-window (sidepanel/options page). `getActiveContentTab` đã handle app-window → mở sidepanel không break tab-scoping. Vite `rollupOptions.input` đã có offscreen entry → thêm sidepanel/options entry tương tự.
