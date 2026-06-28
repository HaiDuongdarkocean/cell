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
│   └── subtitleService.ts         # findSubtitlesForOverlay: validate target + native language → SubtitlesForOverlayResult (target + native, partial load)
│
├── content/                       # Content script (chạy trong trang web)
│   ├── content-script.ts          # Entry: scan DOM → gửi PAGE_SCAN_RESULT; wire subtitle overlay + panel + shortcuts
│   ├── pageScanner.ts             # Scan <video>, <source>, subtitle <track>
│   ├── subtitleParser.ts          # Adapter: parseSubtitle(content, format) → ParseResult (reuse parseSrt/parseVtt)
│   ├── subtitleSync.ts            # Binary search O(log n): findCurrentLine(cues, currentTime) → index
│   ├── subtitleUI.ts              # Overlay UI: createOverlay (appended to video-wrapper), createDragHint (appended to video-wrapper), showToast (appended to video-wrapper), updateOverlayText, updateOverlayBilingual, hideOverlay, removeOverlay
│   ├── subtitleDragDrop.ts        # File read + parse: readFileAsText, handleFileDrop (drag-drop handler)
│   ├── subtitleImport.ts          # Import button: createImportButton (appended to video parent, top-left, avoids toggle overlap), handleFileSelect (file picker)
│   ├── subtitleOverlay.ts         # Orchestrator: SubtitleOverlayController (sync → overlay wiring; init receives video parent; loadBilingualCues: 2 binary searches runtime align)
│   ├── subtitleAutoLoad.ts        # Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL, CORS fallback), handleAutoLoadSubtitles (fetch+parse+load bilingual), formatFromUrl, clearAutoLoadCache
│   ├── subtitleMerge.ts           # mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty)
│   ├── subtitleTrackDropdown.ts   # Multiple tracks dropdown: createTrackDropdown, updateTrackOptions
│   ├── subtitleBilingualParser.ts # Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, reuse parseSrt)
│   ├── subtitlePanel.ts           # Toggle button + seek helper: createToggleButton (opens Side Panel), seekToCue — ADR-008
│   └── subtitleShortcuts.ts       # Keyboard shortcuts: handleShortcutKey (pure, guard input/textarea)
│
├── offscreen/                     # Offscreen document (OPFS, Blob URL, Web Workers)
│   ├── ffmpeg.html                # Offscreen document HTML entry
│   ├── ffmpegRunner.ts            # Entry: nhận CONVERT_TS_TO_MP4_V2, CREATE_OPFS_BLOB_URL
│   └── transmuxWorker.ts          # Web Worker: mux.js transmux TS→fMP4
│
├── popup/                         # Popup UI (React)
│   ├── main.tsx                   # Entry → render AppRedesigned
│   ├── App.redesigned.tsx         # UI chính: media list, downloads, settings dialog
│   ├── App.redesigned.module.css  # Root popup styles
│   ├── store/
│   │   └── popupStore.ts          # Zustand store: videos, subtitles, downloads, settings
│   ├── styles/
│   │   ├── global.css             # Global popup styles
│   │   └── theme.css              # Theme variables (light/dark)
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
│       │   ├── Header.tsx            # Logo, theme toggle, settings button, extension toggle
│       │   └── Header.module.css     # Styles cho Header
│       ├── media/
│       │   ├── VideoCard.tsx         # Card 1 video: title, tags (format/quality/size), expand URL, download
│       │   ├── VideoCard.module.css  # Styles cho VideoCard
│       │   ├── SubtitleCard.tsx      # Card 1 subtitle: title, tags (language/format/size), expand URL, download
│       │   ├── SubtitleCard.module.css # Styles cho SubtitleCard
│       │   ├── DownloadCard.tsx      # Card 1 download: two-phase progress, action buttons, phase labels, details
│       │   ├── DownloadCard.module.css # Styles cho DownloadCard
│       │   ├── MediaEmpty.tsx        # Empty state khi không có media
│       │   └── MediaEmpty.module.css # Styles cho MediaEmpty
│       ├── SelectionBar.tsx          # Fixed bottom bar: selection count, clear, download selected
│       ├── SelectionBar.module.css   # Styles cho SelectionBar
│       └── settings/
│           ├── SettingsDialog.tsx    # Settings dialog + CustomSelect dropdowns, Auto Select toggle, Preferred format dropdown, MultiSelect subtitle languages, Subtitle overlay settings (target language + auto-load), Keyboard shortcuts remap (a/d/s/w/t)
│           ├── SettingsDialog.module.css # Styles cho SettingsDialog
│           ├── MultiSelect.tsx       # Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection
│           └── MultiSelect.module.css # Styles cho MultiSelect
│
├── sidepanel/                     # Side Panel UI (React) — ADR-008
│   ├── index.html                 # HTML shell
│   ├── main.tsx                   # Entry → render App
│   ├── App.tsx                    # Side Panel UI: header + CueList; listen for cues/time/play from background; send SEEK_TO; Spacebar → TOGGLE_PLAY; hotkeys (a/d/s/w/t) → SHORTCUT_ACTION (reuse handleShortcutKey); request cues on mount (REQUEST_SUBTITLE_CUES)
│   ├── store/
│   │   └── sidePanelStore.ts      # Zustand store: cues, currentTimeMs, durationMs, isPlaying; currentCueIndex()
│   └── components/
│       └── CueList.tsx            # Cue list: timestamps, bilingual text, highlight, auto-scroll, click → onSeek
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

## Cây thư mục tests

```
tests/
├── setup.ts                          # Jest setup: polyfills, matchers
├── styleMock.ts                      # Mock CSS imports
├── workerMock.ts                     # Mock Web Workers
├── types.d.ts                        # Shared test type declarations
├── browser/                          # Browser test assets
│   ├── test-subtitle-overlay.html    # Standalone HTML page for overlay testing
│   ├── test-subtitle.srt             # Sample subtitle file
│   ├── Scary_Movie.en.srt            # Full sample subtitle
│   └── test-video.mp4                # Sample video file
├── data-test/                        # Data-driven test files
│   ├── English.eng (1).srt
│   └── English.eng (1).vtt
├── fixtures/                         # Shared unit-test fixtures
│   ├── sample.ass
│   ├── sample.m3u8
│   ├── sample.srt
│   └── sample.vtt
├── components/                       # React component tests
│   └── hooks.test.tsx
├── utils/                            # Cross-cutting utility tests
│   └── format.test.ts
├── unit/                             # Unit + integration tests (Jest, no network)
│   ├── background/                   # Background service worker tests
│   ├── content/                      # Content script tests
│   ├── converters/                   # Converter tests
│   ├── detectors/                    # Language/script/video/subtitle detector tests
│   ├── lib/                          # Library tests
│   ├── offscreen/                    # Offscreen document tests
│   ├── parsers/                      # Subtitle/M3U8 parser tests
│   ├── popup/                        # Popup component tests
│   ├── selectors/                    # Media selector tests
│   ├── sidepanel/                    # Side Panel store + CueList tests (ADR-008)
│   ├── subtitleOverlay/              # Subtitle overlay + panel tests
│   └── utils/                        # Utility tests
└── integration/                      # Integration tests (network, real m3u8 download)
    ├── setup/                        # globalSetup + fixtures
    ├── compare.integration.test.ts
    ├── parallel.integration.test.ts
    └── sequential.integration.test.ts
```

---

## Bảng phụ thuộc — Sửa file X ảnh hưởng file Y

### Background layer

| File | Import từ (depends on) | Được import bởi (depended by) | Sửa file này → ảnh hưởng |
|------|------------------------|-------------------------------|--------------------------|
| `background/index.ts` | networkInterceptor, messageBus, downloadQueue, downloader, offscreenManager, **autoDownload**, config, messages, opfsStorage, videoDetector, subtitleDetector, types | `service-worker-loader.js` (entry) | Toàn bộ background flow; **onMediaDetected** → `maybeAutoDownload` → `tryAutoDownload` (per-tab state `autoDownloadedTabs: Map<tabId, {url, enqueuedIds}>` — catch-up subtitles without re-downloading video); **onTabUpdated** (loading) → clear state + **media clear** (clearTab + clearSessionMedia + lastCuesByTab.delete + updateBadgeForTab — ADR-009 D3); **ADR-008: 5 Side Panel handlers** — handleOpenSidePanel, handleSubtitleCuesLoaded, handleVideoTimeUpdate, handleVideoPlayState, handleSeekTo; **ADR-009: 2 video control handlers** — handleTogglePlay (relay TOGGLE_PLAY → content-script), handleShortcutAction (relay SHORTCUT_ACTION → content-script), handleRequestSubtitleCues (re-send cached cues) |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts` | Media detection, dedup, clearTab |
| `background/downloader.ts` | m3u8Parser, assToSrt, vttToSrt, srtNormalizer, conversionTimer, parallelPlanner, **fileUtils**, opfsStorage, types, config | `background/index.ts` | Download + convert + filename, **pause/resume/retry** (cancel flag pattern), **two-phase progress** (downloadProgress + convertProgress), **AES-128 decrypt** (fetchKey, decryptSegment, WebCrypto AES-CBC), **fMP4 concat** (init segment + .m4s → .mp4, no transmux), **byte-range** (Range header, 206/200), **ad skip** (section-based, even=content/odd=ad), **nested master** (max depth 3) |
| `background/downloadQueue.ts` | types | `background/index.ts` | Queue concurrency, pause/resume, **retry** (reset+requeue), **remove** (delete item) |
| `background/messageBus.ts` | — | `background/index.ts` | Message routing |
| `background/offscreenManager.ts` | — | `background/index.ts` | Offscreen document lifecycle |
| `background/autoDownload.ts` | **whitelist**, **selectBestMedia**, config, types, downloadQueue | `background/index.ts` | Auto-download orchestrator: `tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds?)` → returns `string[]` (enqueued media ids; empty = no-op). Whitelist check → load settings → selectBestMedia → enqueue downloads, skipping ids already enqueued (incremental subtitle catch-up). Silent no-op when no match |
| `background/subtitleService.ts` | types (DetectedSubtitle, Settings, SubtitlesForOverlayResult) | `background/index.ts` | findSubtitlesForOverlay: validate target + native language → return both matches (partial load when only one matches) |

### Content layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `content/content-script.ts` | pageScanner, subtitleOverlay, subtitleDragDrop, subtitleImport, subtitleUI, subtitleBilingualParser, subtitlePanel, subtitleShortcuts, subtitleAutoLoad, subtitleMerge, config, messages | `content-script-loader.js` (entry) | DOM scan → PAGE_SCAN_RESULT; wire overlay + toggle + shortcuts + drag-drop + import; **MutationObserver** for SPA late-mount `<video>`; send cues/timeupdate/play-state to Side Panel via background relay; receive SEEK_TO from Side Panel (ADR-008) |
| `content/pageScanner.ts` | urls (constants) | `content/content-script.ts` | Scan `<video>`, `<source>`, `<track>` |
| `content/subtitleParser.ts` | srtParser, vttParser, types | subtitleDragDrop, subtitleImport | Adapter: parseSubtitle(content, format) → ParseResult |
| `content/subtitleSync.ts` | types (SrtCue) | subtitleOverlay | Binary search: findCurrentLine(cues, currentTime) → index |
| `content/subtitleUI.ts` | types (OverlayConfig) | subtitleOverlay, subtitleImport | Overlay UI: createOverlay (appended to video parent), createDragHint, showToast, updateOverlayText, hideOverlay, removeOverlay |
| `content/subtitleDragDrop.ts` | subtitleParser, types | subtitleImport | File read + parse: readFileAsText, handleFileDrop |
| `content/subtitleImport.ts` | subtitleDragDrop, types | subtitleOverlay, content-script.ts | Import button: createImportButton (appended to video parent, top-left, avoids toggle overlap), handleFileSelect |
| `content/subtitleOverlay.ts` | subtitleUI, subtitleImport, subtitleSync, types | content-script.ts | Orchestrator: SubtitleOverlayController (sync → overlay wiring) |
| `content/subtitleAutoLoad.ts` | subtitleParser, subtitleMerge, subtitleOverlay, types (MessageRequest, BilingualCue), config | content-script.ts | Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL + CORS fallback via FETCH_SUBTITLE_CONTENT), handleAutoLoadSubtitles (fetch+parse+load bilingual), formatFromUrl, clearAutoLoadCache — **wired Task 7+8** |
| `content/subtitleMerge.ts` | types (BilingualCue, SrtCue) | subtitleAutoLoad.ts | mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty) — **implemented Task 5** |
| `content/subtitleTrackDropdown.ts` | types (SrtCue) | (implemented, not wired) | Multiple tracks dropdown: createTrackDropdown, updateTrackOptions |
| `content/subtitleBilingualParser.ts` | srtParser, types (BilingualCue) | content-script.ts | Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, fallback single-language) — **implemented Task 2** |
| `content/subtitlePanel.ts` | — | content-script.ts | Toggle button + seek helper: createToggleButton (opens Side Panel via OPEN_SIDE_PANEL message), seekToCue — **ADR-008: panel UI moved to Side Panel** |
| `content/subtitleShortcuts.ts` | types (KeyboardShortcut) | content-script.ts | Keyboard handler: handleShortcutKey (pure, guard input/textarea) — **implemented Task 3** |

### Side Panel layer (ADR-008)

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `sidepanel/index.html` | — | Vite (sidepanel entry) | HTML shell for Side Panel |
| `sidepanel/main.tsx` | App | `index.html` | React entry point |
| `sidepanel/App.tsx` | useSidePanelStore, CueList, getActiveContentTab, **handleShortcutKey** (content/subtitleShortcuts), **DEFAULT_KEYBOARD_SHORTCUTS** (config), types | `main.tsx` | Side Panel UI: header (title + cue count + play state), CueList; listens for SUBTITLE_CUES_LOADED/VIDEO_TIME_UPDATE/VIDEO_PLAY_STATE from background; sends SEEK_TO on cue click; **ADR-009: Spacebar → TOGGLE_PLAY, hotkeys (a/d/s/w/t) → SHORTCUT_ACTION** (reuse handleShortcutKey, load shortcuts from storage); REQUEST_SUBTITLE_CUES on mount (race condition fix) |
| `sidepanel/store/sidePanelStore.ts` | zustand, types (BilingualCue) | App, CueList | State: cues, currentTimeMs, durationMs, isPlaying; actions: setCues, setCurrentTime, setPlaying, currentCueIndex (binary search) |
| `sidepanel/components/CueList.tsx` | types (BilingualCue) | App | Cue list with timestamps, bilingual text, highlight current cue, auto-scroll, click → onSeek(cue.start) |

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
| `tests/unit/sidepanel/sidePanelStore.test.ts` | `sidepanel/store/sidePanelStore.ts` | 8 | setCues, setCurrentTime, setPlaying, currentCueIndex (binary search) |
| `tests/unit/sidepanel/CueList.test.tsx` | `sidepanel/components/CueList.tsx` | 7 | Render cues, timestamps, onSeek, highlight, auto-scroll, empty nativeText |
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
| `parseSubtitle` | `content/subtitleParser.ts` | (string, format) → ParseResult | subtitleDragDrop, subtitleImport | Adapter: auto-detect format, parseSrt/parseVtt |
| `findCurrentLine` | `content/subtitleSync.ts` | (SrtCue[], number) → number | subtitleOverlay | Binary search O(log n) for current subtitle line by video time |
| `createOverlay` | `content/subtitleUI.ts` | (HTMLElement, OverlayConfig) → HTMLDivElement | subtitleOverlay | Create subtitle overlay div appended to video wrapper |
| `updateOverlayText` | `content/subtitleUI.ts` | (HTMLDivElement, string) → void | subtitleOverlay | Set text and show overlay |
| `hideOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Clear text and hide overlay |
| `removeOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Remove overlay from DOM |
| `createDragHint` | `content/subtitleUI.ts` | HTMLElement → HTMLDivElement | content-script.ts | Create drag-drop hint overlay appended to video parent |
| `showToast` | `content/subtitleUI.ts` | (string, HTMLElement) → void | content-script.ts | Show temporary toast message inside video parent |
| `readFileAsText` | `content/subtitleDragDrop.ts` | File → Promise<string> | subtitleImport | Read File content as text via FileReader |
| `handleFileDrop` | `content/subtitleDragDrop.ts` | File → Promise<ParseResult> | subtitleImport | Validate extension + read + parse subtitle file |
| `createImportButton` | `content/subtitleImport.ts` | (HTMLElement, OverlayConfig) → HTMLButtonElement | subtitleOverlay | Create import button at top-left of video parent (avoids toggle overlap) |
| `handleFileSelect` | `content/subtitleImport.ts` | File → Promise<ParseResult> | content-script.ts | Handle file from picker (reuses handleFileDrop) |
| `createToggleButton` | `content/subtitlePanel.ts` | HTMLElement → HTMLButtonElement | content-script.ts | Create toggle button (opens Side Panel via OPEN_SIDE_PANEL) — **ADR-008** |
| `seekToCue` | `content/subtitlePanel.ts` | (HTMLVideoElement, {start: number}) → void | content-script.ts | Seek video to cue.start / 1000 — **ADR-008** |
| `SubtitleOverlayController.init` | `content/subtitleOverlay.ts` | (videoWrapper?: HTMLElement) → void | content-script.ts | Create overlay + import button inside video parent; attach timeupdate listener — **Task 6** |
| `createBilingualSubtitleController` | `content/subtitleOverlay.ts` | (deps) → BilingualSubtitleController | subtitleAutoLoad.ts | Factory: create overlay with 2 spans (target + native), loadBilingualCues, updateBilingual, destroy — **implemented Task 6** |
| `shouldAutoLoad` | `content/subtitleAutoLoad.ts` | AutoLoadConfig → boolean | content-script.ts | Auto-load decision: autoLoad enabled + target language set — **wired Task 7** |
| `validateOverride` | `content/subtitleAutoLoad.ts` | OverrideConfig → OverrideResult | content-script.ts | Override validation: file language must match target (case-insensitive) — **wired Task 7** |
| `fetchAndParseSubtitle` | `content/subtitleAutoLoad.ts` | (url, format, tabUrl?) → Promise<ParseResult> | subtitleAutoLoad.ts | Fetch + parse subtitle; cache by URL; CORS fallback via FETCH_SUBTITLE_CONTENT (background SW fetch) — **implemented Task 8** |
| `handleAutoLoadSubtitles` | `content/subtitleAutoLoad.ts` | (AutoLoadPayload, deps) → Promise<void> | content-script.ts | Auto-load handler: fetch target + native → mergeCuesForPanel → loadBilingualCues — **wired Task 7** |
| `clearAutoLoadCache` | `content/subtitleAutoLoad.ts` | () → void | content-script.ts | Clear per-URL cache on re-injection — **implemented Task 7** |
| `mergeCuesForPanel` | `content/subtitleMerge.ts` | (SrtCue[], SrtCue[]) → BilingualCue[] | subtitleAutoLoad.ts | Merge target + native cues: target skeleton, native best-effort overlap; fallback native skeleton when target empty — **implemented Task 5** |
| `createTrackDropdown` | `content/subtitleTrackDropdown.ts` | HTMLElement → HTMLSelectElement | (implemented, not wired) | Create track dropdown for multiple subtitle tracks |
| `updateTrackOptions` | `content/subtitleTrackDropdown.ts` | (HTMLSelectElement, TrackOption[]) → void | (implemented, not wired) | Populate dropdown + show/hide |
| `findSubtitlesForOverlay` | `background/subtitleService.ts` | (DetectedSubtitle[], Settings) → SubtitlesForOverlayResult \| null | `background/index.ts` | Validate target + native language → return both matches (partial load when only one matches) — **wired Task 3** |
| `parseTimestamp` | `lib/utils/timeUtils.ts` | string → number (ms) | (implemented, not wired) | Unified timestamp parser (comma/dot separator) |
| `tryAutoDownload` | `background/autoDownload.ts` | (tabId, tabUrl, deps, alreadyEnqueuedIds?) → string[] | background/index.ts | Orchestrator: whitelist → selectBestMedia → enqueue |
| `getActiveContentTab` | `popup/utils/getActiveContentTab.ts` | void → Promise<Tab> | useDetectedMedia, useDownloadProgress | Resolve active tab (handles Edge app-windows) |
| `selectBestMedia` | `lib/selectors/selectBestMedia.ts` | DetectedMedia[] → AutoSelectResult \| null | autoDownload.ts | Pure: select best video + subtitles by prefs |
| `buildSubtitleFileName` | `lib/utils/fileUtils.ts` | (base, language, ext) → string | downloader.ts | Build `<base>.<lang>.<ext>` filename |
| `addToWhitelist` | `lib/utils/whitelist.ts` | (url, tabId) → void | App.redesigned.tsx | Add URL to whitelist (origin + first pathname segment) |
| `isWhitelisted` | `lib/utils/whitelist.ts` | (url, tabId) → boolean | background/autoDownload.ts | Check if URL is whitelisted for auto-download |
| `transmux` | `lib/converters/tsTransmuxer.ts` | (tsData, options) → fMP4Blob | ffmpegRunner.ts | Sequential TS→fMP4 via mux.js |
| `mergePartFiles` | `lib/converters/parallelTransmuxer.ts` | (parts[]) → fMP4Blob | parallelTransmuxer.ts | Merge parallel fMP4 parts (ftyp+moov strip + tfdt offset fix) |
| `parseBilingualSrt` | `content/subtitleBilingualParser.ts` | string → BilingualParseResult | content-script.ts | Parse bilingual SRT (target lẻ/native chẵn, fallback single-language) — **implemented Task 2** |
| `createPanel` | `content/subtitlePanel.ts` | HTMLVideoElement → HTMLDivElement | content-script.ts | Create floating panel appended to video parent (draggable, inline DOM) — **implemented Task 4** |
| `renderCueList` | `content/subtitlePanel.ts` | (HTMLDivElement, BilingualCue[]) → void | (implemented, not wired) | Render cue list items (timestamp + bilingual text) — **implemented Task 4** |
| `createToggleButton` | `content/subtitlePanel.ts` | HTMLElement → HTMLButtonElement | content-script.ts | Create toggle button inside video wrapper to show/hide panel — **implemented Task 4** |
| `switchPanelPosition` | `content/subtitlePanel.ts` | (HTMLDivElement, 'left' \| 'right') → void | content-script.ts | Switch panel position between left and right — **implemented Task 4** |
| `renderCueListLazy` | `content/subtitlePanel.ts` | (HTMLDivElement, BilingualCue[]) → IntersectionObserver \| null | content-script.ts | Lazy render: fallback render all if < 50 cues, else placeholders + observer — **implemented Task 6** |
| `highlightCue` | `content/subtitlePanel.ts` | (HTMLDivElement, number) → void | content-script.ts | Highlight current cue background — **implemented Task 5** |
| `scrollToCue` | `content/subtitlePanel.ts` | (HTMLDivElement, number) → void | content-script.ts | Auto-scroll current cue into view — **implemented Task 5** |
| `seekToCue` | `content/subtitlePanel.ts` | (HTMLVideoElement, { start: number }) → void | content-script.ts | Seek video to cue start (ms → seconds) — **implemented Task 5** |
| `handleShortcutKey` | `content/subtitleShortcuts.ts` | (string, KeyboardShortcut[], EventTarget) → ShortcutAction \| null | content-script.ts, **sidepanel/App.tsx** | Pure: map key → action, guard input/textarea focus — **implemented Task 3, reused ADR-009** |
| `isEditableTarget` | `content/subtitleShortcuts.ts` | EventTarget \| null → boolean | subtitleShortcuts.ts | Check if target is input/textarea/select/contenteditable — **implemented Task 3** |
| `handleTogglePlay` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Relay TOGGLE_PLAY → active tab content-script (resolves active tab when tabId missing) — **ADR-009 D1** |
| `handleShortcutAction` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Relay SHORTCUT_ACTION (prev-cue/next-cue/replay-cue/toggle-overlay) → active tab content-script — **ADR-009 D4** |
| `handleRequestSubtitleCues` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Re-send cached cues per tab (race condition fix: panel opens after cues sent) — **ADR-008** |

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
