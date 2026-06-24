# Architecture System — Video Downloader Extension

> **Đọc file này đầu tiên** sau mỗi context reset để biết cấu trúc dự án.
> File này là bản đồ: biết sửa file nào, ảnh hưởng file nào.
> **Update mỗi khi thêm/xóa/sửa file cấu trúc.**

---

## Cây thư mục

```
src/
├── background/                    # Service Worker (MV3)
│   ├── index.ts                   # Orchestrator: message handlers, event wiring, enrich
│   ├── networkInterceptor.ts      # webRequest listener, media Map, dedup, clearTab
│   ├── downloader.ts              # Download logic: fetch, convert, save via OPFS, pause/resume/retry, AES-128 decrypt, fMP4 concat, byte-range, ad skip, nested master
│   ├── downloadQueue.ts           # Queue: concurrency, pause/resume/cancel, retry, remove
│   ├── messageBus.ts              # Pub/sub: on() / broadcast() cho message handlers
│   └── offscreenManager.ts        # Quản lý offscreen document lifecycle
│
├── content/                       # Content script (chạy trong trang web)
│   ├── content-script.ts          # Entry: scan DOM → gửi PAGE_SCAN_RESULT
│   └── pageScanner.ts             # Scan <video>, <source>, subtitle <track>
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
│   │   └── format.ts              # formatBytes, formatFileSize, formatDuration, phaseToLabel
│   ├── hooks/
│   │   ├── useDetectedMedia.ts       # Subscribe GET_DETECTED_MEDIA + DETECTED_MEDIA_UPDATE
│   │   ├── useDownloadProgress.ts    # Subscribe DOWNLOAD_PROGRESS_UPDATE
│   │   ├── useExtensionStatus.ts     # Toggle extension on/off
│   │   ├── useMediaDisplayTitle.ts   # Resolve display title từ filenameSource + tabTitle
│   │   └── useSubtitleLanguage.ts    # Detect subtitle language: ISO code from URL (wins) → content fallback
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
│           └── SettingsDialog.tsx    # Settings dialog + CustomSelect dropdowns
│
├── lib/
│   ├── detectors/
│   │   ├── videoDetector.ts          # detectVideo(request) → DetectedVideo | null
│   │   ├── subtitleDetector.ts       # detectSubtitle(request) → DetectedSubtitle | null (extractLanguage từ URL)
│   │   └── languageDetector.ts       # detectLanguage() (content-based) + isoCodeToLabel() (URL code → label)
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
│   │   ├── parallelTransmuxer.ts     # TS → fMP4 (parallel, Web Workers)
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
│       ├── fileUtils.ts              # Filename: sanitize, beautify, resolve, generate
│       ├── timeUtils.ts              # Time formatting
│       └── urlUtils.ts               # URL parsing helpers
│
├── constants/
│   ├── config.ts                     # DEFAULT_SETTINGS, GENERIC_TITLES, STORAGE_KEYS, limits
│   ├── messages.ts                   # MESSAGE_TYPES constants
│   └── urls.ts                       # VIDEO_URL_PATTERNS, SUBTITLE_URL_PATTERNS
│
└── types/
    ├── media.ts                      # DetectedVideo, DetectedSubtitle, Settings, FilenameSource, DownloadItem, ByteRange, HlsEncryption, HlsInitSegment
    ├── message.ts                    # MessageRequest, MessageResponse, payloads
    └── muxjs.d.ts                    # Type declarations cho mux.js
```

---

## Bảng phụ thuộc — Sửa file X ảnh hưởng file Y

### Background layer

| File | Import từ (depends on) | Được import bởi (depended by) | Sửa file này → ảnh hưởng |
|------|------------------------|-------------------------------|--------------------------|
| `background/index.ts` | networkInterceptor, messageBus, downloadQueue, downloader, offscreenManager, config, messages, opfsStorage, videoDetector, subtitleDetector, types | `service-worker-loader.js` (entry) | Toàn bộ background flow |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts` | Media detection, dedup, clearTab |
| `background/downloader.ts` | m3u8Parser, assToSrt, vttToSrt, srtNormalizer, conversionTimer, parallelPlanner, **fileUtils**, opfsStorage, types, config | `background/index.ts` | Download + convert + filename, **pause/resume/retry** (cancel flag pattern), **two-phase progress** (downloadProgress + convertProgress), **AES-128 decrypt** (fetchKey, decryptSegment, WebCrypto AES-CBC), **fMP4 concat** (init segment + .m4s → .mp4, no transmux), **byte-range** (Range header, 206/200), **ad skip** (section-based, even=content/odd=ad), **nested master** (max depth 3) |
| `background/downloadQueue.ts` | types | `background/index.ts` | Queue concurrency, pause/resume, **retry** (reset+requeue), **remove** (delete item) |
| `background/messageBus.ts` | — | `background/index.ts` | Message routing |
| `background/offscreenManager.ts` | — | `background/index.ts` | Offscreen document lifecycle |

### Popup layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `popup/main.tsx` | App.redesigned | `index.html` | Entry point |
| `popup/App.redesigned.tsx` | popupStore, useDetectedMedia, useDownloadProgress, useExtensionStatus, **useMediaDisplayTitle**, **useSubtitleLanguage**, Header, VideoCard, SubtitleCard, MediaEmpty, DownloadCard, **SelectionBar**, SettingsDialog, types | `popup/main.tsx` | Toàn bộ popup UI |
| `popup/store/popupStore.ts` | zustand, types, config | Tất cả hooks + App | State management |
| `popup/hooks/useDetectedMedia.ts` | popupStore, types, message types | App.redesigned | Media subscription |
| `popup/hooks/useDownloadProgress.ts` | popupStore, types, message types | App.redesigned | Download progress |
| `popup/hooks/useExtensionStatus.ts` | popupStore, message types | App.redesigned | Extension toggle |
| `popup/hooks/useMediaDisplayTitle.ts` | popupStore, **fileUtils**, types | App.redesigned | Display title resolution |
| `popup/hooks/useSubtitleLanguage.ts` | **languageDetector** (detectLanguage + isoCodeToLabel), types | App.redesigned | Subtitle language: ISO code from URL → label, fallback content detection |
| `popup/utils/format.ts` | types (ConversionPhase) | **DownloadCard** | formatBytes, formatFileSize, formatDuration, phaseToLabel — single source of truth |
| `popup/components/layout/Header.tsx` | — | App.redesigned | Header UI |
| `popup/components/media/VideoCard.tsx` | types | App.redesigned | Video card UI: title, tags (format/quality/size), expand URL, download |
| `popup/components/media/SubtitleCard.tsx` | types | App.redesigned | Subtitle card UI: title, tags (language/format/size), expand URL, download |
| `popup/components/media/DownloadCard.tsx` | types, **format.ts** | App.redesigned | Download card UI (two-phase progress, pause/resume/cancel/retry/remove, phase labels, quality badge, detail items) |
| `popup/components/media/MediaEmpty.tsx` | — | App.redesigned | Empty state |
| `popup/components/SelectionBar.tsx` | — | App.redesigned | Selection bar (clear, count, download selected) |
| `popup/components/settings/SettingsDialog.tsx` | types, config, messages | App.redesigned | Settings UI |

### Lib layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `lib/utils/fileUtils.ts` | types (FilenameSource), config (GENERIC_TITLES) | downloader, useMediaDisplayTitle | Filename generation toàn app |
| `lib/detectors/videoDetector.ts` | constants/urls, types | networkInterceptor, index | Video detection |
| `lib/detectors/subtitleDetector.ts` | constants/urls, types | networkInterceptor, index | Subtitle detection + extractLanguage từ URL |
| `lib/detectors/languageDetector.ts` | types | **useSubtitleLanguage** | Content-based detectLanguage() + ISO code → label mapping (isoCodeToLabel) |
| `lib/parsers/m3u8Parser.ts` | types | downloader | M3U8 parsing; **resolveUrl carry-over query params cho signed URLs**; **parse #EXT-X-KEY** (encryption), **#EXT-X-MAP** (init segment), **#EXT-X-BYTERANGE** (byte range), **#EXT-X-DISCONTINUITY** (ad marker), **#EXT-X-ENDLIST** (VOD flag) |
| `lib/converters/tsTransmuxer.ts` | mux.js, types | ffmpegRunner | TS→fMP4 sequential |
| `lib/converters/parallelTransmuxer.ts` | tsTransmuxer, types | ffmpegRunner, parallelCoordinator | TS→fMP4 parallel |
| `lib/storage/opfsStorage.ts` | — | downloader, index | OPFS file operations |

### Constants & Types

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `constants/config.ts` | types | index, downloader, popupStore, fileUtils, SettingsDialog | Defaults, limits, keys |
| `constants/messages.ts` | — | index, useDetectedMedia, useDownloadProgress, ffmpegRunner | Message type strings |
| `constants/urls.ts` | — | videoDetector, subtitleDetector, pageScanner | URL patterns |
| `types/media.ts` | — | Hầu hết mọi file | Type definitions |
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
  → resolveFilenameBase(filenameSource, title, tabUrl)
  → generateFileName(base, ext)
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

| File | Impact radius | Cẩn thận khi |
|------|---------------|--------------|
| `types/media.ts` | **TOÀN APP** | Thêm/xóa field → cập nhật tất cả mocks, tests |
| `constants/config.ts` | **TOÀN APP** | Đổi default → ảnh hưởng behavior mới user |
| `lib/utils/fileUtils.ts` | downloader + popup | Đổi logic filename → test fileUtils + E2E |
| `background/index.ts` | **TOÀN BACKGROUND** | Đổi handler → test integration |
| `popup/App.redesigned.tsx` | **TOÀN POPUP** | Đổi handler → test E2E |
| `popup/store/popupStore.ts` | **TOÀN POPUP** | Đổi state → tất cả hooks + components |

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
