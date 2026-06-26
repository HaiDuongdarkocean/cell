# Architecture System — Video Downloader Extension

> **Đọc file này đầu tiên** sau mỗi context reset để biết cấu trúc dự án.
> File này là bản đồ: biết sửa file nào, ảnh hưởng file nào.
> **Update mỗi khi thêm/xóa/sửa file cấu trúc.**

---

## Cây thư mục

```
src/
├── background/                    # Service Worker (MV3)
│   ├── index.ts                   # Orchestrator: message handlers, event wiring, enrich, onMediaDetected → maybeAutoDownload → tryAutoDownload
│   ├── networkInterceptor.ts      # webRequest listener, media Map, dedup, clearTab
│   ├── downloader.ts              # Download logic: fetch, convert, save via OPFS, pause/resume/retry, AES-128 decrypt, fMP4 concat, byte-range, ad skip, nested master
│   ├── downloadQueue.ts           # Queue: concurrency, pause/resume/cancel, retry, remove
│   ├── messageBus.ts              # Pub/sub: on() / broadcast() cho message handlers
│   ├── offscreenManager.ts        # Quản lý offscreen document lifecycle
│   ├── autoDownload.ts            # Orchestrator: tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds?) → string[] — whitelist check → settings → selectBestMedia → enqueue (skip already-enqueued ids). Silent no-op when no match
│   └── subtitleService.ts         # findSubtitleForOverlay: validate target language + return matching subtitle
│
├── content/                       # Content script (chạy trong trang web)
│   ├── content-script.ts          # Entry: scan DOM → gửi PAGE_SCAN_RESULT
│   ├── pageScanner.ts             # Scan <video>, <source>, subtitle <track>
│   ├── subtitleParser.ts          # Adapter: parseSubtitle(content, format) → ParseResult (reuse parseSrt/parseVtt)
│   ├── subtitleSync.ts            # Binary search O(log n): findCurrentLine(cues, currentTime) → index
│   ├── subtitleUI.ts              # Overlay UI: createOverlay, updateOverlayText, hideOverlay, removeOverlay
│   ├── subtitleDragDrop.ts        # File read + parse: readFileAsText, handleFileDrop (drag-drop handler)
│   ├── subtitleImport.ts          # Import button: createImportButton, handleFileSelect (file picker)
│   ├── subtitleOverlay.ts         # Orchestrator: SubtitleOverlayController (sync → overlay wiring)
│   ├── subtitleAutoLoad.ts        # Auto-load decision + override validation: shouldAutoLoad, validateOverride
│   └── subtitleTrackDropdown.ts   # Multiple tracks dropdown: createTrackDropdown, updateTrackOptions
│
├── offscreen/                     # Offscreen document (OPFS, Blob URL, Web Workers)
│   ├── ffmpegRunner.ts            # Entry: nhận CONVERT_TS_TO_MP4_V2, CREATE_OPFS_BLOB_URL
│   └── transmuxWorker.ts          # Web Worker: mux.js transmux TS→fMP4
│
├── popup/                         # Popup UI (React)
│   ├── main.tsx                   # Entry → render AppRedesigned
│   ├── App.redesigned.tsx         # UI chính: media list, downloads, settings dialog
│   ├── store/
│   │   └── popupStore.ts          # Zustand store: videos, subtitles, downloads, settings
│   ├── utils/
│   │   ├── format.ts              # formatBytes, formatFileSize, formatDuration, phaseToLabel
│   │   └── getActiveContentTab.ts # getActiveContentTab(): 3 query shapes → filter chrome-extension:// URLs (Edge app-window fix)
│   ├── hooks/
│   │   ├── useDetectedMedia.ts       # Subscribe GET_DETECTED_MEDIA + DETECTED_MEDIA_UPDATE
│   │   ├── useDownloadProgress.ts    # Subscribe DOWNLOAD_PROGRESS_UPDATE
│   │   ├── useExtensionStatus.ts     # Toggle extension on/off
│   │   ├── useMediaDisplayTitle.ts   # Resolve display title từ filenameSource + tabTitle
│   │   └── useSubtitleLanguage.ts    # Detect subtitle language: ISO code from URL (wins) → hybrid content fallback (script + frequency) → push UPDATE_SUBTITLE_LANGUAGE to background
│   └── components/
│       ├── layout/
│       │   └── Header.tsx            # Logo, theme toggle, settings button, extension toggle
│       ├── media/
│       │   ├── VideoCard.tsx         # Card 1 video: title, tags (format/quality/size), expand URL, download
│       │   ├── SubtitleCard.tsx      # Card 1 subtitle: title, tags (language/format/size), expand URL, download
│       │   ├── DownloadCard.tsx      # Card 1 download: two-phase progress, action buttons, phase labels, details
│       │   └── MediaEmpty.tsx        # Empty state khi không có media
│       ├── SelectionBar.tsx          # Fixed bottom bar: selection count, clear, download selected
│       └── settings/
│           ├── SettingsDialog.tsx    # Settings dialog + CustomSelect dropdowns, Auto Select toggle, Preferred format dropdown, MultiSelect subtitle languages, Subtitle overlay settings (target language + auto-load)
│           ├── SettingsDialog.module.css # Styles cho SettingsDialog
│           ├── MultiSelect.tsx       # Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection
│           └── MultiSelect.module.css # Styles cho MultiSelect
│
├── lib/
│   ├── detectors/
│   │   ├── videoDetector.ts          # detectVideo(request) → DetectedVideo | null
│   │   ├── subtitleDetector.ts       # detectSubtitle(request) → DetectedSubtitle | null (extractLanguage từ URL, BCP 47 primary subtag)
│   │   ├── scriptDetector.ts         # detectScript() — Unicode script detection (26 scripts) → candidate languages
│   │   └── languageDetector.ts       # detectLanguage() (hybrid: script + frequency) + isoCodeToLabel() (ISO 639-1/2 → label)
│   ├── selectors/
│   │   └── selectBestMedia.ts        # Pure function: select best video + subtitles matching user prefs (format → quality → subtitle fallback). Returns AutoSelectResult | null
│   ├── parsers/
│   │   ├── m3u8Parser.ts             # Parse M3U8 → segments, variants; resolveUrl carry-over query params; KEY/MAP/BYTERANGE/DISCONTINUITY/ENDLIST
│   │   ├── assParser.ts              # Parse ASS subtitle
│   │   ├── vttParser.ts              # Parse VTT subtitle
│   │   └── srtParser.ts              # Parse SRT subtitle
│   ├── converters/
│   │   ├── assToSrt.ts               # ASS → SRT
│   │   ├── vttToSrt.ts               # VTT → SRT (stripVttInlineTags)
│   │   ├── srtNormalizer.ts          # Normalize SRT format
│   │   ├── tsTransmuxer.ts           # TS → fMP4 (mux.js, sequential)
│   │   ├── parallelTransmuxer.ts     # TS → fMP4 (parallel, Web Workers) — mergePartFiles: strip ftyp+moov parts 1+ + tfdt offset fix + mvhd duration update
│   │   ├── parallelCoordinator.ts    # Điều phối parallel conversion
│   │   ├── parallelPlanner.ts        # Plan segment grouping cho parallel
│   │   ├── parallelProgress.ts       # Track progress parallel conversion
│   │   ├── parallelSafetyAnalyzer.ts # Analyze safety (memory, file size)
│   │   ├── parallelPolicy.ts         # Policy: auto/manual/off
│   │   ├── parallelFallback.ts       # Fallback strategy khi parallel fail
│   │   ├── parallelCancellation.ts   # Cancel parallel conversion
│   │   ├── segmentGrouping.ts        # Group segments cho parallel workers
│   │   ├── segmentMerger.ts          # Merge fMP4 fragments
│   │   ├── mp4Validator.ts           # Validate MP4 output
│   │   ├── conversionTimer.ts        # Measure conversion time
│   │   ├── autoEnablement.ts         # Auto-enable parallel logic
│   │   ├── benchmarkHarness.ts       # Benchmark conversion
│   │   └── workerFactory.ts          # Tạo Web Worker cho transmux
│   ├── storage/
│   │   └── opfsStorage.ts            # OPFS: read/write/delete files
│   └── utils/
│       ├── fileUtils.ts              # Filename: sanitize, beautify, resolve, generate, buildSubtitleFileName
│       ├── timeUtils.ts              # Time formatting
│       ├── urlUtils.ts               # URL parsing helpers
│       └── whitelist.ts              # Whitelist CRUD: normalizeUrl (origin+pathname), getWhitelist, isWhitelisted, addToWhitelist, removeFromWhitelist. Uses chrome.storage.local
│
├── constants/
│   ├── config.ts                     # DEFAULT_SETTINGS, GENERIC_TITLES, STORAGE_KEYS, limits
│   ├── messages.ts                   # MESSAGE_TYPES constants
│   └── urls.ts                       # VIDEO_URL_PATTERNS, SUBTITLE_URL_PATTERNS
│
└── types/
    ├── media.ts                      # DetectedVideo, DetectedSubtitle, Settings, FilenameSource, DownloadItem, ByteRange, HlsEncryption, HlsInitSegment, AutoSelectResult, WhitelistEntry
    ├── message.ts                    # MessageRequest, MessageResponse, payloads (incl. GetSubtitleForOverlayPayload, SubtitleForOverlayResult)
    ├── subtitle.ts                   # SubtitleFormat, SubtitleState, OverlayConfig, ParseResult, SyncStatus
    └── muxjs.d.ts                    # Type declarations cho mux.js
```

---

## Bảng phụ thuộc — Sửa file X ảnh hưởng file Y

### Background layer

| File | Import từ (depends on) | Được import bởi (depended by) | Sửa file này → ảnh hưởng |
|------|------------------------|-------------------------------|--------------------------|
| `background/index.ts` | networkInterceptor, messageBus, downloadQueue, downloader, offscreenManager, **autoDownload**, config, messages, opfsStorage, videoDetector, subtitleDetector, types | `service-worker-loader.js` (entry) | Toàn bộ background flow; **onMediaDetected** → `maybeAutoDownload` → `tryAutoDownload` (per-tab state `autoDownloadedTabs: Map<tabId, {url, enqueuedIds}>` — catch-up subtitles without re-downloading video); **onTabUpdated** (loading) → clear state + media |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts` | Media detection, dedup, clearTab |
| `background/downloader.ts` | m3u8Parser, assToSrt, vttToSrt, srtNormalizer, conversionTimer, parallelPlanner, **fileUtils**, opfsStorage, types, config | `background/index.ts` | Download + convert + filename, **pause/resume/retry** (cancel flag pattern), **two-phase progress** (downloadProgress + convertProgress), **AES-128 decrypt** (fetchKey, decryptSegment, WebCrypto AES-CBC), **fMP4 concat** (init segment + .m4s → .mp4, no transmux), **byte-range** (Range header, 206/200), **ad skip** (section-based, even=content/odd=ad), **nested master** (max depth 3) |
| `background/downloadQueue.ts` | types | `background/index.ts` | Queue concurrency, pause/resume, **retry** (reset+requeue), **remove** (delete item) |
| `background/messageBus.ts` | — | `background/index.ts` | Message routing |
| `background/offscreenManager.ts` | — | `background/index.ts` | Offscreen document lifecycle |
| `background/autoDownload.ts` | **whitelist**, **selectBestMedia**, config, types, downloadQueue | `background/index.ts` | Auto-download orchestrator: `tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds?)` → returns `string[]` (enqueued media ids; empty = no-op). Whitelist check → load settings → selectBestMedia → enqueue downloads, skipping ids already enqueued (incremental subtitle catch-up). Silent no-op when no match |
| `background/subtitleService.ts` | types (DetectedSubtitle, Settings) | (future overlay) | findSubtitleForOverlay: validate target language + return matching subtitle |

### Content layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `content/content-script.ts` | pageScanner | `content-script-loader.js` (entry) | DOM scan → PAGE_SCAN_RESULT |
| `content/pageScanner.ts` | urls (constants) | `content/content-script.ts` | Scan `<video>`, `<source>`, `<track>` |
| `content/subtitleParser.ts` | srtParser, vttParser, types | (future overlay) | Adapter: parseSubtitle(content, format) → ParseResult |
| `content/subtitleSync.ts` | types (SrtCue) | (future overlay) | Binary search: findCurrentLine(cues, currentTime) → index |
| `content/subtitleUI.ts` | types (OverlayConfig) | (future overlay) | Overlay UI: createOverlay, updateOverlayText, hideOverlay, removeOverlay |
| `content/subtitleDragDrop.ts` | subtitleParser, types | subtitleImport, (future overlay) | File read + parse: readFileAsText, handleFileDrop |
| `content/subtitleImport.ts` | subtitleDragDrop, types | (future overlay) | Import button: createImportButton, handleFileSelect |
| `content/subtitleOverlay.ts` | subtitleUI, subtitleImport, subtitleSync, types | (future overlay) | Orchestrator: SubtitleOverlayController (sync → overlay wiring) |
| `content/subtitleAutoLoad.ts` | — | (future overlay) | Auto-load decision + override validation: shouldAutoLoad, validateOverride |
| `content/subtitleTrackDropdown.ts` | types (SrtCue) | (future overlay) | Multiple tracks dropdown: createTrackDropdown, updateTrackOptions |

### Popup layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `popup/main.tsx` | App.redesigned | `index.html` | Entry point |
| `popup/App.redesigned.tsx` | popupStore, useDetectedMedia, useDownloadProgress, useExtensionStatus, **useMediaDisplayTitle**, **useSubtitleLanguage**, **selectBestMedia**, **whitelist**, Header, VideoCard, SubtitleCard, MediaEmpty, DownloadCard, **SelectionBar**, SettingsDialog, types | `popup/main.tsx` | Toàn bộ popup UI; **whitelist check effect**, **auto-select effect** (calls `selectBestMedia`), `handleToggleAutoDownload`, AD toggle in media section (replacing "Download All" button) |
| `popup/store/popupStore.ts` | zustand, types, config | Tất cả hooks + App | State management; `loadPersistedSettings` migrates `defaultSubtitleLanguage` → `selectedSubtitleLanguages` + fills new fields (`preferredVideoFormat`, `autoSelectEnabled`) with defaults |
| `popup/hooks/useDetectedMedia.ts` | popupStore, types, message types | App.redesigned | Media subscription |
| `popup/hooks/useDownloadProgress.ts` | popupStore, types, message types | App.redesigned | Download progress |
| `popup/hooks/useExtensionStatus.ts` | popupStore, message types | App.redesigned | Extension toggle |
| `popup/hooks/useMediaDisplayTitle.ts` | popupStore, **fileUtils**, types | App.redesigned | Display title resolution |
| `popup/hooks/useSubtitleLanguage.ts` | **languageDetector** (detectLanguage + isoCodeToLabel), **constants/messages** (MESSAGE_TYPES), types | App.redesigned | Subtitle language: ISO code from URL → label, fallback hybrid content detection (script + frequency) → push UPDATE_SUBTITLE_LANGUAGE to background |
| `popup/utils/format.ts` | types (ConversionPhase) | **DownloadCard** | formatBytes, formatFileSize, formatDuration, phaseToLabel — single source of truth |
| `popup/components/layout/Header.tsx` | — | App.redesigned | Header UI; `isAutoDownloadActive` + `onToggleAutoDownload` props, AD icon button (download SVG) |
| `popup/components/media/VideoCard.tsx` | types | App.redesigned | Video card UI: title, tags (format/quality/size), expand URL, download |
| `popup/components/media/SubtitleCard.tsx` | types | App.redesigned | Subtitle card UI: title, tags (language/format/size), expand URL, download |
| `popup/components/media/DownloadCard.tsx` | types, **format.ts** | App.redesigned | Download card UI (two-phase progress, pause/resume/cancel/retry/remove, phase labels, quality badge, detail items) |
| `popup/components/media/MediaEmpty.tsx` | — | App.redesigned | Empty state |
| `popup/components/SelectionBar.tsx` | — | App.redesigned | Selection bar (clear, count, download selected) |
| `popup/components/settings/SettingsDialog.tsx` | types, config, messages, **MultiSelect** | App.redesigned | Settings UI; regrouped fields (chọn media → download → filename), Auto Select toggle (sparkles SVG), Preferred format dropdown, MultiSelect subtitle languages (replaces CustomSelect) |
| `popup/components/settings/MultiSelect.tsx` | — | SettingsDialog | Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection |

### Lib layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `lib/utils/fileUtils.ts` | types (FilenameSource), config (GENERIC_TITLES) | downloader, useMediaDisplayTitle | Filename generation toàn app: sanitize, beautify, resolve, generate, **buildSubtitleFileName** (subtitle: `<base>.<lang>.<ext>`) |
| `lib/utils/whitelist.ts` | — | **autoDownload**, App.redesigned | Whitelist CRUD: `normalizeUrl` (origin+pathname, no query/hash), `getWhitelist`, `isWhitelisted`, `addToWhitelist`, `removeFromWhitelist`. Uses `chrome.storage.local` + `STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST` |
| `lib/selectors/selectBestMedia.ts` | types | **autoDownload**, App.redesigned | Pure function: select best video + subtitles matching user prefs. Fallback order: Preferred Format → Default Quality → Subtitle availability. Returns `AutoSelectResult | null` |
| `lib/detectors/videoDetector.ts` | constants/urls, types | networkInterceptor, index | Video detection |
| `lib/detectors/subtitleDetector.ts` | constants/urls, types | networkInterceptor, index | Subtitle detection + extractLanguage từ URL (BCP 47 primary subtag: en-US → en) |
| `lib/detectors/scriptDetector.ts` | — | **languageDetector** | Unicode script detection (26 scripts từ Scripts.txt) → candidate languages; single-script → direct resolve, multi-script → frequency |
| `lib/detectors/languageDetector.ts` | types, **scriptDetector** | **useSubtitleLanguage** | Hybrid detectLanguage() (script + frequency, 38 profiles) + isoCodeToLabel() (ISO 639-1/2, 365 entries → 183 languages) |
| `lib/parsers/m3u8Parser.ts` | types | downloader | M3U8 parsing; **resolveUrl carry-over query params cho signed URLs**; **parse #EXT-X-KEY** (encryption), **#EXT-X-MAP** (init segment), **#EXT-X-BYTERANGE** (byte range), **#EXT-X-DISCONTINUITY** (ad marker), **#EXT-X-ENDLIST** (VOD flag) |
| `lib/converters/tsTransmuxer.ts` | mux.js, types | ffmpegRunner | TS→fMP4 sequential |
| `lib/converters/parallelTransmuxer.ts` | tsTransmuxer, types | ffmpegRunner, parallelCoordinator | TS→fMP4 parallel; **findFirstMoofOffset** + mergePartFiles: strip ftyp+moov parts 1+ + **tfdt offset fix** (mux.js rebases PTS to 0 per group) + **mvhd duration update** |
| `lib/storage/opfsStorage.ts` | — | downloader, index | OPFS file operations |

### Constants & Types

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `constants/config.ts` | types | index, downloader, popupStore, fileUtils, SettingsDialog, **whitelist**, **autoDownload** | Defaults, limits, keys; **`DEFAULT_PREFERRED_VIDEO_FORMAT`**, **`DEFAULT_SELECTED_SUBTITLE_LANGUAGES`**, **`DEFAULT_AUTO_SELECT_ENABLED`**, **`STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST`** |
| `constants/messages.ts` | — | index, useDetectedMedia, useDownloadProgress, ffmpegRunner | Message type strings |
| `constants/urls.ts` | — | videoDetector, subtitleDetector, pageScanner | URL patterns |
| `types/media.ts` | — | Hầu hết mọi file | Type definitions; **`AutoSelectResult`**, **`WhitelistEntry`** interfaces. Settings gained: `preferredVideoFormat`, `selectedSubtitleLanguages`, `autoSelectEnabled` (`defaultSubtitleLanguage` deprecated) |
| `types/message.ts` | types/media | index, hooks, ffmpegRunner | Message payloads |

---

## Luồng dữ liệu chính

### 1. Media Detection Flow
```
Trang web load
  → webequest (networkInterceptor)
  → detectVRequest.onBeforeRideo() / detectSubtitle()
  → Dedup theo url+tabId
  → videos.set(id, video)
  → notifyListeners(tabId)
  → broadcast DETECTED_MEDIA_UPDATE { videos, subtitles, tabId }  ← tab-scoped payload
  → enrichVideo() (async: chrome.tabs.get → update title+tabUrl)
  → re-broadcast DETECTED_MEDIA_UPDATE { ..., tabId: video.tabId }
  → popup useDetectedMedia:
      - query active tab → tabIdRef
      - GET_DETECTED_MEDIA { tabId } → background trả chỉ media tab đó (KHÔNG fallback all-tab)
      - listener filter: payload.tabId === tabIdRef → setVideos/setSubtitles
      - broadcast từ tab nền (tabId ≠ active) → IGNORE
  → VideoCard/SubtitleCard render với displayTitle
```

### 2. Download Flow
```
User click Download All
  → App.redesigned: query active tab → send DOWNLOAD_ALL {tabId}
  → background handleDownloadAll
  → getMedia(tabId) — KHÔNG fallback getAllVideos/getAllSubtitles
  → nếu tab trống → return error "No media found for this tab"
  → createDownloadItem() cho mỗi media
  → downloadQueue.addAll(items)
  → queue executor: downloader.downloadVideo() / downloadSubtitle()
  → video: resolveFilenameBase(filenameSource, title, tabUrl) → generateFileName(base, ext)
  → subtitle: lookup video cùng tabId → resolveFilenameBase(filenameSource, videoTitle, videoTabUrl)
    → buildSubtitleFileName(base, language, ext) → "<videoBase>.<lang>.srt"
    → fallback (no video): resolveFilenameBase(filenameSource, undefined, subtitleUrl) → buildSubtitleFileName
  → fetch segments → OPFS → convert TS→MP4 → save
  → broadcast DOWNLOAD_PROGRESS_UPDATE
  → popup useDownloadProgress → addDownload/updateDownload
  → DownloadCard render progress (two-phase: downloadProgress + convertProgress)
```

### 2b. Download Control Flow (pause/resume/cancel/retry/remove)
```
User click Pause trên DownloadCard
  → App.redesigned: send PAUSE_DOWNLOAD {downloadId}
  → background handlePauseDownload
  → downloader.pause(id) → cancelledIds.add(id) → throwIfCancelled aborts current fetch
  → downloadQueue.pause(id) → status='paused', activeCount--
  → popup: useDownloadProgress update → DownloadCard shows Resume button

User click Resume
  → send RESUME_DOWNLOAD {downloadId}
  → downloader.resume(id) → cancelledIds.delete(id)
  → downloadQueue.resume(id) → status='queued', processNext()
  → executor chạy lại từ đầu (cancel+re-queue strategy)

User click Cancel
  → send CANCEL_DOWNLOAD {downloadId}
  → downloader.cancel(id) → cancelledIds.add(id) + OPFS cleanup
  → downloadQueue.cancel(id) → status='cancelled'
  → popup: removeDownload(id) (optimistic UI)

User click Retry (khi error)
  → send RETRY_DOWNLOAD {downloadId}
  → downloader.retry(id) → cancelledIds.delete(id) + OPFS cleanup
  → downloadQueue.retry(id) → reset: status='queued', progress=0, error=undefined
  → processNext() → executor chạy lại

User click Remove (khi done/error)
  → send REMOVE_DOWNLOAD {downloadId}
  → (nếu đang active) downloader.cancel(id)
  → downloadQueue.remove(id) → items.delete(id)
  → popup: removeDownload(id) (optimistic UI)
```

### 3. Settings Flow
```
User mở SettingsDialog → đổi filenameSource
  → updateSettings() → popupStore + chrome.storage.local.set
  → send UPDATE_SETTINGS {settings}
  → background handleUpdateSettings
  → saveSettings() → chrome.storage.local.set
  → downloader.setFilenameSource()
  → (popup) useMediaDisplayTitle re-render với mode mới
  → VideoCard/SubtitleCard update displayTitle

User đổi defaultQuality (không phải auto/highest)
  → updateSettings() + send UPDATE_SETTINGS
  → (popup) useEffect[settings.defaultQuality] → reorder video.variants
    → variant có quality match đưa lên đầu (variants[0] = selected)
  → VideoCard re-render với quality mới
```

### 4. Tab Cleanup Flow
```
Tab navigate (reload/link) → chrome.tabs.onUpdated (status='loading')
  → networkInterceptor.clearTab(tabId)
  → videos.delete + subtitles.delete cho tabId

Tab close → chrome.tabs.onRemoved
  → networkInterceptor.clearTab(tabId)
```

### 4b. Auto-Download Flow (whitelist + selectBestMedia)
```
[Trigger 1: Revisit whitelisted page]
Media detected (networkInterceptor.onMediaDetected) — fires INCREMENTALLY:
  m3u8 captured first → subtitles discovered later.
  → maybeAutoDownload(tabId)
      → chrome.tabs.get(tabId) → tabUrl
      → state = autoDownloadedTabs.get(tabId)
      → state && state.url === tabUrl?  → SAME page load (catch-up branch)
          → tryAutoDownload(tabId, tabUrl, deps, state.enqueuedIds)
              → selectBestMedia → skip ids already in enqueuedIds
              → enqueue only NEW items (e.g. subtitles discovered after video)
          → add returned ids to state.enqueuedIds
      → else → FRESH page load (first detection or navigated)
          → tryAutoDownload(tabId, tabUrl, deps)
              → isWhitelisted(tabUrl)?  ← normalizeUrl (origin+pathname, no query/hash)
                  → NO  → silent no-op (return [])
                  → YES → load settings (chrome.storage.local)
                      → selectBestMedia(videos, subtitles, settings)
                          → Fallback order: Preferred Format → Default Quality → Subtitle availability
                          → Returns AutoSelectResult | null
                      → null → silent no-op (return [])
                      → result → enqueue download items (downloadQueue.addAll) → return enqueuedIds
          → newIds.length > 0? → autoDownloadedTabs.set(tabId, { url, enqueuedIds })
      → state cleared on tabs.onUpdated loading + onTabRemoved

NOTE: trigger is onMediaDetected, NOT tabs.onUpdated 'complete' — the latter fires
before network interception captures m3u8/subtitle requests, so media is always empty there.

[Trigger 2: AD toggle ON in popup]
User toggles AD (Header icon button)
  → handleToggleAutoDownload
  → isWhitelisted(currentTabUrl)?
      → YES → removeFromWhitelist → AD icon inactive
      → NO  → addToWhitelist → AD icon active (.adActive)
            → if media detected + settings loaded:
                → selectBestMedia(videos, subtitles, settings)
                → result → handleVideoDownload(videoId) + handleSubtitleDownload(subId) for each
                → setSelectedIds (UI reflects what's being downloaded)
            (AD implies auto-select for download, runs regardless of autoSelectEnabled)
```

### 5. Subtitle Language Detection Flow
```
Subtitle detected (networkInterceptor)
  → subtitleDetector.extractLanguage(url) → "en" | "ko" | "unknown"
  → popup useSubtitleLanguage(subtitles)
    → Phase 1: URL code wins
      - subtitle.language !== 'unknown' → isoCodeToLabel(language)
      - Found → set label immediately (NO fetch)
      - Not found → add to needFetch list
    → Phase 2: Content fallback (chỉ cho unknown/unmapped)
      - Fetch subtitle content → detectLanguage(content, format)
      - Frequency-based: LANGUAGE_PROFILES top words match
      - labelToIsoCode(label) → ISO 639-1 code
      - setSubtitles() update popup store
      - send UPDATE_SUBTITLE_LANGUAGE { subtitleId, language } → background
        → background handleUpdateSubtitleLanguage
        → networkInterceptor.updateSubtitle(id, {...sub, language})
        → mediaMap.set(id, {...sub, language})
  → SubtitleCard renders languageLabel ?? subtitle.language
```

### 6. Toolbar Badge Flow
```
Media detected / tab activated / extension toggled
  → background updateBadgeForTab(tabId)
  → count = videos.length + subtitles.length
  → chrome.action.setBadgeText({ text: count, tabId })
  → chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId })  ← primary blue
  → chrome.action.setBadgeTextColor({ color: '#ffffff', tabId })        ← white

Extension disabled / tab cleared
  → clearBadge() → setBadgeText({ text: '' })
```

### 7. HLS Edge Cases Flow (AES-128, fMP4, byte-range, ad skip, nested master)
```
m3u8Parser parse playlist
  → detect #EXT-X-KEY → playlist.encryption { method, keyUri, iv }
  → detect #EXT-X-MAP → playlist.initSegment { uri, byteRange }
  → detect #EXT-X-BYTERANGE → segment.byteRange { length, offset }
  → detect #EXT-X-DISCONTINUITY → segment.discontinuity = true
  → detect #EXT-X-ENDLIST → playlist.hasEndlist = true

downloader.downloadM3u8Streaming(playlist)
  → IF playlist.encryption:
      → fetchKey(keyUri, tabUrl, cacheKey) → cache per download
      → decryptSegment(blob, key, encryption, sequence) via WebCrypto AES-CBC
      → IV: playlist.iv (hex → Uint8Array) OR deriveIvFromSequence (RFC 8216 §4.3.2.4)
  → IF playlist.initSegment (fMP4 path):
      → fetch init segment → write to OPFS → concat .m4s segments → save .mp4 (NO transmux)
  → IF segment.byteRange:
      → fetchSegmentWithRange(url, tabUrl, byteRange) → Range: bytes=start-end header
      → accept 206 (Partial Content) or 200 (full response)
  → IF segment.discontinuity (ad skip):
      → section-based detection: even sections = content, odd sections = ad
      → skip ad segments (not fetched, not written)
  → IF nested master (variant is also master):
      → loop with MAX_MASTER_DEPTH=3 → recurse into nested master
      → if depth exceeded → throw error
```

---

## Test files (auto-select / auto-download feature)

| Test file | SUT | Số test | Covers |
|-----------|-----|---------|--------|
| `tests/unit/selectors/selectBestMedia.test.ts` | `lib/selectors/selectBestMedia.ts` | 13 | Format → quality → subtitle fallback, no-match cases |
| `tests/unit/utils/whitelist.test.ts` | `lib/utils/whitelist.ts` | 13 | normalizeUrl, getWhitelist, isWhitelisted, addToWhitelist, removeFromWhitelist |
| `tests/unit/popup/MultiSelect.test.tsx` | `popup/components/settings/MultiSelect.tsx` | 14 | Search input, checkbox list, selection toggle, footer |
| `tests/unit/background/autoDownload.test.ts` | `background/autoDownload.ts` | 15 | tryAutoDownload: whitelist miss → no-op, whitelist hit → enqueue, no media → no-op, return value (enqueued ids array), incremental subtitle catch-up with alreadyEnqueuedIds |

---

| File | Impact radius | Cẩn thận khi |
|------|---------------|--------------|
| `types/media.ts` | **TOÀN APP** | Thêm/xóa field → cập nhật tất cả mocks, tests |
| `constants/config.ts` | **TOÀN APP** | Đổi default → ảnh hưởng behavior mới user |
| `lib/utils/fileUtils.ts` | downloader + popup | Đổi logic filename → test fileUtils + E2E |
| `background/index.ts` | **TOÀN BACKGROUND** | Đổi handler → test integration |
| `popup/App.redesigned.tsx` | **TOÀN POPUP** | Đổi handler → test E2E |
| `popup/store/popupStore.ts` | **TOÀN POPUP** | Đổi state → tất cả hooks + components |

---

## Function Index (grep-friendly)

| Function | File | Input → Output | Used by | Description |
|---|---|---|---|---|
| `detectVideo` | `lib/detectors/videoDetector.ts` | Request → DetectedVideo \| null | background/index.ts | Detect video from request (URL, MIME) |
| `detectSubtitle` | `lib/detectors/subtitleDetector.ts` | Request → DetectedSubtitle \| null | background/index.ts | Detect subtitle from request (URL, MIME) |
| `detectScript` | `lib/detectors/scriptDetector.ts` | string → Script \| null | languageDetector.ts | Detect Unicode script (26 scripts) |
| `detectLanguage` | `lib/detectors/languageDetector.ts` | string → string (ISO 639-1) | subtitleDetector.ts | Hybrid: script + frequency → language |
| `selectBestMedia` | `lib/selectors/selectBestMedia.ts` | DetectedMedia[] → AutoSelectResult \| null | autoDownload.ts | Pure: select best video + subtitles by prefs |
| `parseSrt` | `lib/parsers/srtParser.ts` | string → SrtSubtitle | subtitleParser.ts | Parse SRT format to SrtCue[] |
| `parseVtt` | `lib/parsers/vttParser.ts` | string → VttSubtitle | subtitleParser.ts | Parse VTT format to VttCue[] |
| `parseSubtitle` | `content/subtitleParser.ts` | (string, format) → ParseResult | (future overlay) | Adapter: auto-detect format, parseSrt/parseVtt |
| `findCurrentLine` | `content/subtitleSync.ts` | (SrtCue[], number) → number | (future overlay) | Binary search O(log n) for current subtitle line by video time |
| `createOverlay` | `content/subtitleUI.ts` | (HTMLVideoElement, OverlayConfig) → HTMLDivElement | (future overlay) | Create subtitle overlay div appended to video parent |
| `updateOverlayText` | `content/subtitleUI.ts` | (HTMLDivElement, string) → void | (future overlay) | Set text and show overlay |
| `hideOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | (future overlay) | Clear text and hide overlay |
| `removeOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | (future overlay) | Remove overlay from DOM |
| `readFileAsText` | `content/subtitleDragDrop.ts` | File → Promise<string> | subtitleImport, (future overlay) | Read File content as text via FileReader |
| `handleFileDrop` | `content/subtitleDragDrop.ts` | File → Promise<ParseResult> | subtitleImport, (future overlay) | Validate extension + read + parse subtitle file |
| `createImportButton` | `content/subtitleImport.ts` | (HTMLVideoElement, OverlayConfig) → HTMLButtonElement | (future overlay) | Create import button at top-right of video |
| `handleFileSelect` | `content/subtitleImport.ts` | File → Promise<ParseResult> | (future overlay) | Handle file from picker (reuses handleFileDrop) |
| `SubtitleOverlayController` | `content/subtitleOverlay.ts` | class (HTMLVideoElement, OverlayConfig) | (future overlay) | Orchestrator: init/loadCues/clearCues/destroy, timeupdate → binary search → overlay |
| `shouldAutoLoad` | `content/subtitleAutoLoad.ts` | AutoLoadConfig → boolean | (future overlay) | Auto-load decision: autoLoad enabled + target language set |
| `validateOverride` | `content/subtitleAutoLoad.ts` | OverrideConfig → OverrideResult | (future overlay) | Override validation: file language must match target (case-insensitive) |
| `createTrackDropdown` | `content/subtitleTrackDropdown.ts` | HTMLElement → HTMLSelectElement | (future overlay) | Create track dropdown for multiple subtitle tracks |
| `updateTrackOptions` | `content/subtitleTrackDropdown.ts` | (HTMLSelectElement, TrackOption[]) → void | (future overlay) | Populate dropdown + show/hide |
| `findSubtitleForOverlay` | `background/subtitleService.ts` | (DetectedSubtitle[], Settings) → SubtitleForOverlayResult \| null | (future overlay) | Validate target language + return matching subtitle |
| `parseTimestamp` | `lib/utils/timeUtils.ts` | string → number (ms) | (future) | Unified timestamp parser (comma/dot separator) |
| `tryAutoDownload` | `background/autoDownload.ts` | (tabId, tabUrl, deps, alreadyEnqueuedIds?) → string[] | background/index.ts | Orchestrator: whitelist → selectBestMedia → enqueue |
| `getActiveContentTab` | `popup/utils/getActiveContentTab.ts` | void → Promise<Tab> | useDetectedMedia, useDownloadProgress | Resolve active tab (handles Edge app-windows) |
| `selectBestMedia` | `lib/selectors/selectBestMedia.ts` | DetectedMedia[] → AutoSelectResult \| null | autoDownload.ts | Pure: select best video + subtitles by prefs |
| `buildSubtitleFileName` | `lib/utils/fileUtils.ts` | (base, language, ext) → string | downloader.ts | Build `<base>.<lang>.<ext>` filename |
| `addToWhitelist` | `lib/utils/whitelist.ts` | (url, tabId) → void | App.redesigned.tsx | Add URL to whitelist (origin + first pathname segment) |
| `isWhitelisted` | `lib/utils/whitelist.ts` | (url, tabId) → boolean | background/autoDownload.ts | Check if URL is whitelisted for auto-download |
| `transmux` | `lib/converters/tsTransmuxer.ts` | (tsData, options) → fMP4Blob | ffmpegRunner.ts | Sequential TS→fMP4 via mux.js |
| `mergePartFiles` | `lib/converters/parallelTransmuxer.ts` | (parts[]) → fMP4Blob | parallelTransmuxer.ts | Merge parallel fMP4 parts (ftyp+moov strip + tfdt offset fix) |

---

## Update protocol

**Khi nào update file này:**
1. Thêm file mới → thêm vào cây thư mục + bảng phụ thuộc
2. Xóa file → xóa khỏi cây thư mục + bảng phụ thuộc
3. Đổi tên file → cập nhật tất cả reference
4. Thêm/xóa import → cập nhật cột "Import từ" / "Được import bởi"
5. Đổi luồng dữ liệu → cập nhật section "Luồng dữ liệu chính"

**Cách update:**
- Đọc file này → tìm entry cần sửa → edit
- Không cần rewrite toàn bộ, chỉ edit phần liên quan
- Giữ format nhất quán (table, code block)
