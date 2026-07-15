# Architecture System — Video Downloader Extension

> **Đọc file này đầu tiên** sau mỗi context reset để biết cấu trúc dự án.
> File này là bản đồ: biết sửa file nào, ảnh hưởng file nào.
> **Update mỗi khi thêm/xóa/sửa file cấu trúc.**

---

## Target structure (refactor in progress — ADR-016, ADR-017)

Đang migrate sang **Feature-Sliced Design (FSD) + Screaming Architecture**. Target structure:

```
src/
├── app/                # App-wide config, providers, global setup
├── stores/             # Global state stores (Zustand)
├── entrypoints/        # Extension entrypoints (manifest-declared)
│   ├── background/     #   Service Worker (MV3) — thin orchestrator (M14: index ≤284 lines)
│   ├── content/        #   Content scripts (ISOLATED + MAIN world) — thin (M20: 178 lines)
│   ├── offscreen/      #   Offscreen document (OPFS, workers, fetch proxy M15)
│   ├── popup/          #   Popup UI (React)
│   ├── sidepanel/      #   Side panel UI (React)
│   └── options/        #   Options page (React) — ADR-023: ResourcesPanel + ThemePanel + settings tabs
├── features/           # Feature domains (screaming — domain name first)
│   ├── detection/      #   Media/subtitle/script/language detection
│   ├── whitelist/      #   Auto-download whitelist
│   ├── transmux/       #   TS→fMP4 transmuxing (planning/execution/merging)
│   ├── subtitle/       #   Subtitle overlay/sync/merge/bilingual (logic/ui/service)
│   │   └── ui/contentScriptController.ts  # M20: subtitle UI orchestration (init → returns cleanup for SPA episode-switch re-init) — ADR-025: wires SubtitleBlockController; ADR-019: wires OffsetController + offset keyboard shortcuts; ADR-027: generate-native subtitle (manual translate active target → native, virtual panel slot)
│   │       └── ui/subtitleBlock*.ts  # ADR-025: subtitleBlockController + subtitleBlockDom + subtitleBlockDrag + subtitleBlockScale + subtitleBlockCss (unified draggable block: target overlay + native overlay + nav cluster merged into single block); ADR-027: subtitleBlockDom adds generate-native button, subtitleBlockController exposes setGenerateNativeEnabled / onGenerateNative callback
│   │       └── ui/subtitleManagerPanel.ts  # ADR-015: unified subtitle manager panel (auto + imported + translated virtual entry) — createSubtitleManagerPanel, updateTarget, updateNative, destroy; overlay icon is host-CSS-resistant and active state changes SVG color only
│   │       └── ui/navCluster*.ts  # ADR-018: navClusterActions + navClusterButton + navClusterKeyboard + navClusterIcons + navClusterCss (navClusterController + navClusterDom DELETED ADR-025 — merged into subtitleBlock*)
│   │       └── ui/offsetController.ts  # ADR-019: OffsetController class — wires subtitleOffsetSection (nested trong manager panel) + subtitleOffsetBadge (floating) + lazy/committed state + wall-clock auto-commit (timeupdate + visibilitychange, no setTimeout) + persist per-URL
│   │       └── ui/subtitleOffsetPanel.ts  # ADR-019: offset section DOM factory (collapsible section trong manager panel, 4 states: disabled/default/lazy-active/committed, 4 steppers ±0.5/±2s, input + apply + reset)
│   │       └── ui/subtitleOffsetBadge.ts  # ADR-019: lazy badge DOM factory (pill top-right, "Xem thử · M:SS" + pulse dot, click=reset, keyboard accessible)
│   │       └── ui/subtitleShortcuts.ts  # Keyboard shortcut handler: handleShortcutKey (pure, guard input/textarea); ADR-027: supports 'generate-native' action
│   │       └── logic/subtitleOffset.ts  # ADR-019: pure offset logic — OffsetState, parseOffsetInput, clampOffsetMs, shouldAutoCommit, formatOffsetDisplay, AUTO_COMMIT_MS=120000
│   ├── download/       #   Download queue/selection
│   ├── settings/       #   Settings UI + validation logic
│   ├── theme/          #   Theme system (ADR-022) — logic/colorGenerator, contrastValidator, themeManager, themeStorage, themeConfig; ui/ThemePanel, ThemeProvider, ModeCards, ColorCustomization, ThemePreview, ContrastBadges, ThemeImportExport
│   └── dictionary/     #   Dictionary import + phrase-template system (ADR-023, ADR-037) — logic/fileDetector, formatDetector, signatureGenerator, importErrors, batchProcessor, normalizationPipeline, phraseTemplateParser, phraseIndexCompiler, phraseIndexBuilder, phraseMatcher, phraseMatchService, phraseMatchBenchmark, importOrchestrator; repositories/baseRepository (v10: +langPhraseIndex), resourceRepository, frequencyRepository, dictionaryRepository, phraseIndexRepository; strategies/baseImportStrategy, txtLineStrategy, jsonArrayStrategy, yomitanStrategy, cambridgeJsonStrategy, sqliteStrategy, strategyFactory; ui/ResourcesPanel, Dropzone, ResourceCard, ImportProgress, DeleteConfirmModal
│   └── dictionaryPopup/  # Popup Dictionary (spec §9, ADR-037) — types, schema; worker/lookupWorker, lookupWorkerHandler, workerFactory, phraseIndexLoader, resourcePriority; logic/lruCache, lookupOrchestrator; plugins/languagePlugin, englishPlugin, chinesePlugin, fallbackPlugin, pluginRegistry
├── entities/           # Domain entities (types/models) — M19: @/types/ fully migrated here
│   ├── video/          #   DetectedVideo, M3u8*, TsSegment
│   ├── subtitle/       #   Subtitle overlay types (canonical SubtitleFormat)
│   ├── settings/       #   Settings, FilenameSource (schemaVersion field M21)
│   ├── theme/          #   ThemeMode, ResolvedMode, CoreColorTokens, ThemeConfig (ADR-022)
│   ├── dictionary/     #   ImportFormat, ResourceType, ResourceInfo, FrequencyEntry, DictionaryEntry, ImportOptions, ImportResult (ADR-023)
│   ├── media/          #   DownloadItem, Ass/Vtt/Srt types (re-exports video+settings)
│   └── message/        #   Message bus types
├── shared/             # Shared infrastructure (cross-feature)
│   ├── lib/            #   parsers/, storage/, chrome-apis/ (adapters), themeTokens
│   │   ├── chrome-apis/  # M17: 9 adapters (tabs/runtime/storage/downloads/webRequest/offscreen/sidePanel/action/windows)
│   │   └── storage/      # M21: settingsStore.ts (schema versioning + migration)
│   ├── ui/             #   Reusable UI atoms (design-system-ui-ux Step 3, Rule of Three)
│   │   ├── index.ts                       # Barrel exports for shared UI
│   │   ├── Button.tsx + .module.css        # Text button: primary/secondary/outline/ghost/destructive/link, sm/md/lg, loading, disabled
│   │   ├── Badge.tsx + .module.css         # Small status label with variants/sizes
│   │   ├── Alert.tsx + .module.css         # Inline message banner with variants
│   │   ├── Badge.tsx + .module.css         # Small status label with variants/sizes
│   │   ├── Button.tsx + .module.css        # Text button: primary/secondary/outline/ghost/destructive/link, sm/md/lg, loading, disabled
│   │   ├── Card.tsx + .module.css          # Surface container: default/interactive/selected variants
│   │   ├── Checkbox.tsx + .module.css      # Checkbox with label, indeterminate, error, disabled states
│   │   ├── CheckboxGroup.tsx + .module.css # Managed list of checkboxes
│   │   ├── Dialog.tsx + .module.css        # Accessible modal overlay + panel (DeleteConfirmModal now uses this)
│   │   ├── Drawer.tsx + .module.css        # Slide-in panel with overlay
│   │   ├── EmptyState.tsx + .module.css    # Empty list/panel placeholder
│   │   ├── FormGroup.tsx + .module.css     # Label + children wrapper with consistent spacing
│   │   ├── Header.tsx + .module.css        # Top chrome with title and actions
│   │   ├── Input.tsx + .module.css         # Text input with error state and size variants
│   │   ├── InputField.tsx + .module.css    # Label + Input + helper/error text
│   │   ├── IconButton.tsx + .module.css    # Icon-only transparent button (Header, SettingsDialog, VideoCard, SubtitleCard, SelectionBar, DownloadCard)
│   │   ├── Label.tsx + .module.css         # Form control label with required/disabled states
│   │   ├── ListItem.tsx + .module.css      # Row with leading/trailing content and active state
│   │   ├── NavItem.tsx + .module.css       # Navigation item (sidebar/horizontal)
│   │   ├── Progress.tsx + .module.css      # Horizontal progress bar
│   │   ├── Radio.tsx + .module.css         # Radio with label, error, disabled states
│   │   ├── RadioGroup.tsx + .module.css    # Managed list of radios
│   │   ├── SearchField.tsx + .module.css   # Input with leading search icon + clear button
│   │   ├── Select.tsx + .module.css        # Plain HTML select wrapper with placeholder/error
│   │   ├── Sidebar.tsx + .module.css       # Vertical nav container with optional collapse
│   │   ├── Skeleton.tsx + .module.css      # Placeholder loading shape
│   │   ├── Spinner.tsx + .module.css       # Animated loading indicator
│   │   ├── Tabs.tsx + .module.css          # Compound tab list/trigger/content
│   │   ├── Textarea.tsx + .module.css      # Multiline input with resize/error/disabled
│   │   ├── Toggle.tsx + .module.css        # Switch pill 32x18px (settings-controls-restyle F1)
│   │   ├── Tooltip.tsx + .module.css       # Accessible hover/focus tooltip
│   │   ├── Accordion.tsx + .module.css     # Collapsible single/multiple sections
│   │   ├── Slider.tsx + .module.css        # Styled range 4px track + 14px thumb (settings-controls-restyle F2)
│   │   ├── ShortcutInput.tsx + .module.css # Uppercase + center single-char input (settings-controls-restyle F3)
│   │   ├── SearchableSelect.tsx + .module.css # Single-select dropdown with embedded search (settings-controls-restyle F5)
│   │   └── HintIcon.tsx + .module.css      # Info-circle button + floating popover with boundary detection (settings-controls-restyle F6)
│   ├── utils/          #   fileUtils, timeUtils, urlUtils
│   └── config/         #   config, messages, urls
└── types/              # Ambient .d.ts (muxjs, vite-env) — M19: media/message/subtitle.ts deprecated
```

**Refactor status**: M0-M13 COMPLETE (FSD migration). M14-M21 COMPLETE (architecture debt refactor, ADR-017):
- M14: SW god-file split (2203→284 lines, 8 handler files)
- M15: fetch() moved to offscreen document
- M16: onStartup/onInstalled lifecycle rehydration
- M17: 9 chrome.* adapters, ~129 entrypoint calls routed
- M18: 32 deep imports → barrel-only (0 deep imports in entrypoints)
- M19: 94 @/types/ imports → @/entities/* (Strangler Fig complete)
- M20: content-script 787→178 lines (orchestration → contentScriptController.ts)
- M21: settingsStore.ts with schema versioning + migration (CURRENT_SCHEMA_VERSION=1)

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
│   └── subtitleService.ts         # findSubtitlesForOverlay: validate target + native language → SubtitlesForOverlayResult (target + native, partial load) — **planned ADR-014**: findPreferredMatch (preference-aware, fallback first-match) thay findFirstMatch
│
├── content/                       # Content script (chạy trong trang web)
│   ├── content-script.ts          # Entry: scan DOM → gửi PAGE_SCAN_RESULT; wire subtitle overlay + panel + shortcuts; ADR-010 episode-switch watcher (VIDEO_EPISODE_CHANGED); ADR-012 isVideoReady gate (blob: OR readyState>=2); **overlay re-init on SPA episode switch** (track currentVideo + currentOverlayCleanup, reportEpisodeChangedIfReplacement re-injects overlay for new <video>); **ADR-020: YouTube MAIN↔ISOLATED postMessage bridge** — listener for `__YT_DETECTED_SUBTITLES` / `__YT_INNERTUBE_FALLBACK` → sendMessage(DETECTED_SUBTITLES / INNERTUBE_FALLBACK_REQUEST)
│   ├── fetchInterceptor.iife.ts   # MAIN world (ADR-011): patch window.fetch, postMessage `__DETECTED_SUBTITLE_FETCH` → ISOLATED listener → DETECTED_SUBTITLE_URL (catches cached subtitle fetches webRequest misses)
│   ├── youtube-main-world.iife.ts # MAIN world (ADR-020, scoped *://*.youtube.com/*): read window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks → postMessage `__YT_DETECTED_SUBTITLES` (tracks+videoId); SPA re-detect via yt-navigate-finish + popstate + pushState hook + videoId dedup poll; InnerTube fallback request when DOM parse empty
│   ├── netflix-main-world.iife.ts # MAIN world (ADR-029, scoped *://*.netflix.com/*): DFS/BFS traverse `cadmiumPlayerRepository.playersById[sessionId]` for `type==='timedtext'` nodes with `urls[0].url` → pair with `getTimedTextTrackList()` metadata → postMessage `__NF_DETECTED_SUBTITLES` (tracks+movieId); poll for player 2-30s; SPA re-detect via pushState/replaceState/popstate + movieId dedup; **pivoted from JSON.parse/stringify hooks** (cadmium 6.0059+ uses schema-based custom parser, not JSON.parse). **ADR-030**: 3 CustomEvent listeners `__NF_SEEK|PLAY|PAUSE` → `getPlayer().seek/play/pause` (M7375 fix — route playback qua Netflix player API, không set video.currentTime trực tiếp)
│   ├── pageScanner.ts             # Scan <video>, <source>, subtitle <track>
│   ├── subtitleParser.ts          # Adapter: parseSubtitle(content, format) → ParseResult (reuse parseSrt/parseVtt/parseTtml)
│   ├── subtitleSync.ts            # Binary search O(log n): findCurrentLine(cues, currentTime) → index
│   ├── subtitleUI.ts              # Overlay UI: createOverlay (appended to video-wrapper), createDragHint (appended to video-wrapper), showToast (appended to video-wrapper), updateOverlayText, updateOverlayBilingual, hideOverlay, removeOverlay — **planned ADR-013**: refactor createOverlay → createOverlayLayer(role, config) 2 div độc lập + applyStyle + buildTextShadow + sanitizeFontFamily + hexToRgba
│   ├── subtitleDragDrop.ts        # File read + parse: readFileAsText, handleFileDrop (drag-drop handler)
│   ├── subtitleImport.ts          # Import button: createImportButton (appended to video parent, top-left, host-CSS-resistant crisp SVG), handleFileSelect (file picker)
│   ├── subtitleOverlay.ts         # Orchestrator: SubtitleOverlayController (sync → overlay wiring; init receives video parent; loadBilingualCues: 2 binary searches runtime align) — **ADR-013**: 2 ref targetOverlay + nativeOverlay, onTimeUpdate 2 updateOverlayText — **planned ADR-014**: loadBilingualCues merge (bug A fix, giữ cues cũ khi side mới rỗng)
│   ├── subtitleDragPosition.ts    # calcYOffsetPercent (pure, clamp 0-95) + createDragHandle (pointer events, icon move-vertical, role=slider aria). Bug fix: second drag uses currentOffset, not initialOffset
│   ├── subtitleAutoLoad.ts        # Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL, CORS fallback), handleAutoLoadSubtitles (fetch+parse+load bilingual), formatFromUrl, clearAutoLoadCache
│   ├── subtitleMerge.ts           # mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty)
│   ├── subtitleTrackDropdown.ts   # Multiple tracks dropdown: createTrackDropdown, updateTrackOptions
│   ├── subtitleSelector.ts        # NEW (planned ADR-014): createSubtitleDropdown (overlay dropdown góc phải container, icon chevron-down, popover list sub cùng lang + cue count + format, click outside/Esc/chọn đóng) — V2 ADR-007 D3
│   ├── subtitleBilingualParser.ts # Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, reuse parseSrt)
│   ├── subtitlePanel.ts           # Toggle button + seek helper: createToggleButton (opens Side Panel; host CSS cannot restore its border), seekToCue — ADR-008. **ADR-030**: seekToCue routes qua seekVideo (Netflix M7375 fix)
│   ├── netflixPlayback.ts         # ADR-030: seekVideo/playVideo/pauseVideo — isNetflixPage() → dispatch __NF_SEEK|PLAY|PAUSE CustomEvent → MAIN-world player API; fallback video.currentTime/play/pause cho site thường. **ADR-031**: mountToWatchVideo(el, container) — move Cell UI vào .watch-video + z-index max + copy data-theme, fix Netflix overlay che nút
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
│           ├── SettingsDialog.tsx    # Settings dialog + CustomSelect dropdowns, Auto Select toggle (Toggle atom), Preferred format dropdown, MultiSelect subtitle languages, Subtitle overlay settings (target language + auto-load Toggle atom), Subtitle appearance (Target/Native tabs + SubtitlePreview + SubtitleStylePanel), Keyboard shortcuts remap (ShortcutInput atom, a/d/s/w/t), Nav cluster panel, Download settings
│           ├── SettingsDialog.module.css # Styles cho SettingsDialog (480px popover + sidebar 120px + 5 section cards + pill active)
│           ├── SubtitlePreview.tsx   # Black bg + white text + apply OverlayStyleConfig realtime (settings-controls-restyle F4)
│           ├── SubtitlePreview.module.css # Styles cho SubtitlePreview
│           ├── NavClusterSettingsPanel.tsx # Nav cluster controls (Toggle enable + 3 Slider atoms: button size/bg opacity/button opacity)
│           ├── NavClusterSettingsPanel.module.css # Styles cho NavClusterSettingsPanel
│           ├── MultiSelect.tsx       # Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection
│           └── MultiSelect.module.css # Styles cho MultiSelect
│
├── sidepanel/                     # Side Panel UI (React) — ADR-008
│   ├── index.html                 # HTML shell
│   ├── main.tsx                   # Entry → render App
│   ├── App.tsx                    # Side Panel UI: header + CueList; listen for cues/time/play from background (filter by activeTabId); send SEEK_TO; Spacebar → TOGGLE_PLAY; hotkeys (a/d/s/w/t) → SHORTCUT_ACTION (reuse handleShortcutKey); request cues on mount + on tab switch (REQUEST_SUBTITLE_CUES); ADR-011 active tab tracking (onActivated + onUpdated listeners)
│   ├── store/
│   │   └── sidePanelStore.ts      # Zustand store: cues, currentTimeMs, durationMs, isPlaying; currentCueIndex()
│   └── components/
│       └── CueList.tsx            # Cue list: timestamps, bilingual text, highlight, auto-scroll, click → onSeek
│
├── options/                       # Options page (React) — ADR-023, redesign sidebar nav (UI-UX-Contract)
│   ├── index.html                 # HTML shell — Mona Sans font, responsive #root
│   ├── main.tsx                   # Entry → render OptionsApp (ThemeProvider wrap)
│   ├── OptionsApp.tsx             # Sidebar nav (3 items) + 3 tabpanels + skip link + arrow key nav + mobile drawer
│   ├── OptionsApp.module.css      # Sidebar 200px desktop / 56px tablet icon-only / drawer mobile, gap 64px
│   ├── SidebarItem.tsx            # Atom: sidebar nav button (role=tab, aria-controls, aria-selected)
│   ├── SidebarItem.module.css     # Active: terminal-green left border + snow text; tablet: label hidden
│   ├── types.ts                   # Data contract types — ResourcesPanelState, ThemePanelState, Tab, SidebarItem
│   └── schema.ts                  # Zod schemas — ResourceInfoSchema, ResourcesPanelStateSchema, TabSchema (runtime validation)
│
├── lib/
│   ├── detectors/
│   │   ├── videoDetector.ts          # detectVideo(request) → DetectedVideo | null
│   │   ├── subtitleDetector.ts       # detectSubtitle(request, opts?) → DetectedSubtitle | null (extractLanguage từ URL, BCP 47 primary subtag + **ISO 639 validation** — reject folder-name false positives like "sub", "vid", "api"; **ADR-034: opts.trustAsSubtitle** bypass URL pattern cho `<track>`-origin URL — anikage.cc extension-less subtitle URL; **ADR-036: isStremioSubtitleListing** reject Stremio addon listing JSON URL)
│   │   ├── youtubeSubtitleDetector.ts # ADR-020: mapYouTubeCaptionTracks(tracks, tabId) → DetectedSubtitle[] (append &fmt=vtt, strip xosf, skip PO Token, isAsr+displayName); extractCaptionTracks(playerResponse) (defensive); buildVttUrl, requiresPoToken
│   │   ├── youtubeInnertube.ts       # ADR-020: fetchCaptionTracksViaInnerTube(videoId, apiKey) → YouTubeCaptionTrack[] (WEB client, background SW fetch — content script cannot set User-Agent); extractInnertubeApiKey, extractClientVersion
│   │   ├── scriptDetector.ts         # detectScript() — Unicode script detection (26 scripts) → candidate languages
│   │   └── languageDetector.ts       # detectLanguage() (hybrid: script + frequency) + isoCodeToLabel() (ISO 639-1/2 → label) + **isValidIsoCode()** (validate candidate against ISO 639-1/2 set)
│   ├── selectors/
│   │   └── selectBestMedia.ts        # Pure function: select best video + subtitles matching user prefs (format → quality → subtitle fallback). Returns AutoSelectResult | null
│   ├── parsers/
│   │   ├── m3u8Parser.ts             # Parse M3U8 → segments, variants; resolveUrl carry-over query params; KEY/MAP/BYTERANGE/DISCONTINUITY/ENDLIST
│   │   ├── assParser.ts              # Parse ASS subtitle
│   │   ├── vttParser.ts              # Parse VTT subtitle
│   │   ├── ttmlParser.ts             # Parse TTML (IMSC1.1) subtitle — DOMParser-based, tick/clock/seconds time formats, <br>→newline (ADR-029 Netflix)
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

## Cây thư mục docs/design-system/icon (Lucide reference — chỉ tham khảo phong cách)

```
docs/design-system/icon/               # Lucide reference catalog (KHÔNG bundled, chỉ tham khảo style)
├── README.md                          # Workflow: find icon → copy to src/ → import ?raw → use
├── LICENSE                            # ISC license from Lucide (redistribution obligation)
├── catalog.md                         # Auto-generated index of 1995 icons with tags (do not edit by hand)
├── index.html                         # Visual overview page (search + click-to-copy, self-contained, open in browser)
└── svg/                               # 1995 raw .svg files from lucide-static (stroke 2.0, 24x24, round caps, currentColor)
```

## Cây thư mục docs/design-system/icon-system (cell icon system — tự vẽ, 322 SVG)

```
docs/design-system/icon-system/        # Tự vẽ 322 icon (KHÔNG bundled, docs-only)
├── README.md                          # Workflow: tìm icon → copy to src/ → import ?raw → use
├── STYLE-GUIDE.md                     # Phong cách thiết kế (24x24, stroke 2, round caps, currentColor)
├── catalog.md                         # Auto-generated index of 322 icons (do not edit by hand)
├── index.html                         # Visual overview page (search + filter by category + click-to-copy, self-contained)
├── icon-list.txt                      # Danh sách icon gốc (reference)
└── svg/                               # 322 SVG files
    ├── media/                         # 43 SVG (play/pause/skip/rewind/volume/...)
    ├── subtitle/                      # 28 SVG (captions/translate/align/...)
    ├── dictionary/                    # 30 SVG (book-open/search/mic/character/...)
    ├── flashcard/                     # 26 SVG (layers/card/deck/graduation-cap/...)
    ├── mediatype/                     # 25 SVG (film/music/book/newspaper/...)
    ├── download/                      # 25 SVG (download/file/folder/save/...)
    ├── nav/                           # 30 SVG (arrow/chevron/home/menu/...)
    ├── edit/                          # 29 SVG (pencil/scissors/trash/bold/...)
    ├── settings/                      # 29 SVG (gear/toggle/sun/moon/lock/...)
    ├── time/                          # 20 SVG (clock/timer/calendar/history/...)
    ├── status/                        # 26 SVG (check/x/alert/loader/star/...)
    └── comm/                          # 11 SVG (message/share/send/bell/...)
```

## Cây thư mục docs/design-system/icon-system_v2 (cell icon system v2 — minimalism V1, 322 SVG)

```
docs/design-system/icon-system_v2/     # Tự vẽ 322 icon variant V1 minimalism (KHÔNG bundled, docs-only)
├── README.md                          # Workflow: tìm icon v2 → copy to src/ → import ?raw → use
├── STYLE-GUIDE.md                     # Phong cách thiết kế (24x24, stroke 2, round caps, currentColor)
├── catalog.md                         # Auto-generated index of 322 icons (do not edit by hand)
├── index.html                         # Visual overview page (search + filter by category + click-to-copy, self-contained)
├── icon-list.txt                      # Danh sách icon gốc (reference)
└── svg/                               # 322 SVG files (variant V1 minimalism, fallback V1 cho 42 synced)
```

## Cây thư mục scripts

```
scripts/
├── sync-icons.mjs                     # Sync lucide-static SVG → docs/design-system/icon/ + generate catalog.md + copy LICENSE. Re-run after `npm update lucide-static`.
└── icon-system/                       # Cell icon system generator (tự vẽ, không copy)
    ├── gen.mjs                        # Generator: đọc categories/*.mjs → xuất 322 SVG V1 + catalog.md + index.html
    ├── gen-v2.mjs                     # Generator: đọc categories/*.mjs → xuất 322 SVG V1 minimalism + catalog.md + index.html
    ├── variants.mjs                   # SVG wrapper (24x24, stroke 2, round caps, currentColor, fill none)
    └── categories/                    # 12 category files (media/subtitle/dictionary/flashcard/mediatype/download/nav/edit/settings/time/status/comm)
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
└── integration/                      # Integration tests (network, real m3u8 download, dictionary import smoke ADR-023)
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
| `background/index.ts` | networkInterceptor, messageBus, downloadQueue, downloader, offscreenManager, context, helpers, wireEvents, handlers/* | `service-worker-loader.js` (entry) | **Thin orchestrator (M14 refactor: 2203→284 lines)** — init/stop/registerHandlers only. Shared state (mediaMap, autoDownloadedTabs, lastCuesByTab, activeTabIdForPanel, extensionActive, sessionReady). Delegates to handlers/* + wireEvents + helpers |
| `background/context.ts` | types | `background/index.ts`, `helpers.ts`, `wireEvents.ts`, `handlers/*` | `BackgroundContext` interface — shared state + building blocks + helpers contract |
| `background/helpers.ts` | config, messages, opfsStorage, autoDownload, subtitleService, languageDetector, m3u8Parser, types | `background/index.ts`, `wireEvents.ts`, `handlers/*` | Helper functions: generateId, extractBaseName, buildDetails (ADR-035: optional `initiator` param from scanned frame URL), getActiveTabId, reloadActiveTab, badge helpers, enrichVideo, enrichM3u8Variants, findVideoById, findSubtitleById, createDownloadItem, settings helpers, session persistence helpers, pushAutoLoadSubtitles, resolveUnknownSubtitleLanguages, **ADR-036: resolveStremioSubtitleListing** (fetch Stremio addon JSON listing → extract subtitles[].url → re-inject via handleRequest), extractOrigin, maybeAutoDownload |
| `background/wireEvents.ts` | messages, helpers, types | `background/index.ts` | Event wiring: networkInterceptor.onMediaDetected → broadcast, **ADR-036: networkInterceptor.onListingDetected → resolveStremioSubtitleListing**, downloadQueue.onProgress → broadcast, downloader callbacks (convert, saveOpfs, executor), chrome.tabs.onUpdated/onRemoved/onActivated, chrome.windows.onFocusChanged, chrome.downloads.onDeterminingFilename |
| `background/handlers/download.ts` | messages, helpers, types | `background/index.ts` (via registerDownloadHandlers) | 10 download handlers: DOWNLOAD_VIDEO, DOWNLOAD_SUBTITLE, DOWNLOAD_ALL, CANCEL, PAUSE, RESUME, RETRY, REMOVE, GET_DOWNLOAD_PROGRESS, CONVERSION_PROGRESS_UPDATE |
| `background/handlers/mediaDetection.ts` | messages, videoDetector, subtitleDetector, helpers, types | `background/index.ts` (via registerMediaDetectionHandlers) | 3 media detection handlers: GET_DETECTED_MEDIA, PAGE_SCAN_RESULT (ADR-035: pass `payload.pageUrl` as `initiator` → `DetectedSubtitle.initiator` → DNR Origin for origin-checking CDNs like prox.anicore.tv), DETECTED_SUBTITLE_URL |
| `background/handlers/subtitle.ts` | messages, config, helpers, types | `background/index.ts` (via registerSubtitleHandlers) | 5 subtitle handlers: UPDATE_SUBTITLE_LANGUAGE, REQUEST_AUTO_LOAD_SUBTITLES, FETCH_SUBTITLE_CONTENT (sends `initiator` as Referer via offscreenFetch for CDN hotlink protection), SUBTITLE_CUES_LOADED, REQUEST_SUBTITLE_CUES |
| `background/handlers/settings.ts` | messages, helpers, types | `background/index.ts` (via registerSettingsHandlers) | 4 settings handlers: GET_SETTINGS, UPDATE_SETTINGS, GET_EXTENSION_STATUS, TOGGLE_EXTENSION |
| `background/offscreenFetch.ts` | messages, offscreenManager, types | `background/helpers.ts`, `background/handlers/subtitle.ts` | **M15 fetch adapter**: `offscreenFetch(url, options)` → delegates fetch() to offscreen document via FETCH_REQUEST message. SW idle eviction safety — offscreen persists for fetch duration. Used by: enrichM3u8Variants, resolveUnknownSubtitleLanguages, handleFetchSubtitleContent |
| `background/handlers/sidePanelRelay.ts` | messages, helpers, types | `background/index.ts` (via registerSidePanelRelayHandlers) | 9 side panel relay handlers: OPEN_SIDE_PANEL, **CLOSE_SIDE_PANEL** (Chrome 141+ `chrome.sidePanel.close` via windowId resolved from tabId), VIDEO_TIME_UPDATE, VIDEO_PLAY_STATE, SEEK_TO, TOGGLE_PLAY, SHORTCUT_ACTION, VIDEO_EPISODE_CHANGED (ADR-008/009/010/011) |
| `background/handlers/youtubeDetection.ts` | messages, detection (mapYouTubeCaptionTracks, fetchCaptionTracksViaInnerTube), helpers, types | `background/index.ts` (via registerYouTubeDetectionHandlers) | **ADR-020**: 2 YouTube handlers: DETECTED_SUBTITLES (map tracks → DetectedSubtitle[] → addDetectedSubtitles → broadcast + pushAutoLoadSubtitles), INNERTUBE_FALLBACK_REQUEST (background SW fetch InnerTube WEB client — content script cannot set User-Agent) |
| `background/handlers/translate.ts` | messages, translateService, types | `background/index.ts` (via registerTranslateHandlers) | **ADR-021**: 1 translate handler: TRANSLATE (content-script → background SW fetch Google Translate unofficial endpoint, CORS bypass, return parsed string[]) |
| `background/handlers/cardCreator.ts` | messages, ankiConnectClient, types | `background/index.ts` (via registerCardCreatorHandlers) | **ADR-026**: 1 Card Creator handler: CARD_CREATOR_REQUEST (content-script → background SW fetch AnkiConnect HTTP, CORS bypass, return `{ result }` or `{ error }`). Single generic action; action name + params in payload |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts`, `background/wireEvents.ts` | Media detection, dedup, clearTab; **ADR-036: onListingDetected callback** — fires when Stremio addon listing URL captured → async resolveStremioSubtitleListing extracts real subtitle URLs from JSON |
| `background/downloader.ts` | m3u8Parser, assToSrt, vttToSrt, srtNormalizer, conversionTimer, parallelPlanner, **fileUtils**, opfsStorage, types, config | `background/index.ts` | Download + convert + filename, **pause/resume/retry** (cancel flag pattern), **two-phase progress** (downloadProgress + convertProgress), **AES-128 decrypt** (fetchKey, decryptSegment, WebCrypto AES-CBC), **fMP4 concat** (init segment + .m4s → .mp4, no transmux), **byte-range** (Range header, 206/200), **ad skip** (section-based, even=content/odd=ad), **nested master** (max depth 3) |
| `background/downloadQueue.ts` | types | `background/index.ts` | Queue concurrency, pause/resume, **retry** (reset+requeue), **remove** (delete item) |
| `background/messageBus.ts` | — | `background/index.ts` | Message routing |
| `background/offscreenManager.ts` | — | `background/index.ts` | Offscreen document lifecycle |
| `background/autoDownload.ts` | **whitelist**, **selectBestMedia**, config, types, downloadQueue | `background/index.ts` | Auto-download orchestrator: `tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds?)` → returns `string[]` (enqueued media ids; empty = no-op). Whitelist check → load settings → selectBestMedia → enqueue downloads, skipping ids already enqueued (incremental subtitle catch-up). Silent no-op when no match |
| `background/subtitleService.ts` | types (DetectedSubtitle, Settings, SubtitlesForOverlayResult) | `background/index.ts` | findSubtitlesForOverlay: validate target + native language (BCP 47 subtag-aware, e.g. `zh` matches `zh-hans`/`zh-hant`) → return both matches (partial load when only one matches) |

### Content layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `content/content-script.ts` | pageScanner, subtitleOverlay, subtitleDragDrop, subtitleImport, subtitleUI, subtitleBilingualParser, subtitlePanel, subtitleShortcuts, subtitleAutoLoad, subtitleMerge, config, messages | `content-script-loader.js` (entry) | DOM scan → PAGE_SCAN_RESULT (**ADR-035: send `pageUrl: window.location.href`** as frame origin for DNR Origin); wire overlay + toggle + shortcuts + drag-drop + import; **MutationObserver** for SPA late-mount `<video>`; send cues/timeupdate/play-state to Side Panel via background relay; receive SEEK_TO from Side Panel (ADR-008); **ADR-010: module-level `initEpisodeChangeWatcher`** — MutationObserver persist observe `<video>` replacement → send VIDEO_EPISODE_CHANGED (episode switch clear, quality switch preserved); **ADR-012: `isVideoReady` gate** — `findAndInitOverlay` waits until `video.src` is `blob:` OR `readyState>=2` before init (Angular two-phase render on kisskh.co wipes foreign elements appended during phase 1; observer uses `attributeFilter:['src']` to catch phase-2 src assignment); **overlay re-init on SPA episode switch** — `reportEpisodeChangedIfReplacement` calls `findAndInitOverlay()` for new `<video>`; `currentVideo`/`lastSeenVideo` guards prevent duplicate init (Angular may mount/unmount same element during phase render); `currentOverlayCleanup` tears down old controller before re-init; **ADR-020: YouTube MAIN↔ISOLATED postMessage bridge** — listener for `__YT_DETECTED_SUBTITLES` → sendMessage(DETECTED_SUBTITLES), `__YT_INNERTUBE_FALLBACK` → sendMessage(INNERTUBE_FALLBACK_REQUEST) |
| `content/fetchInterceptor.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start) | **ADR-011**: patch `window.fetch`, postMessage `__DETECTED_SUBTITLE_FETCH` → ISOLATED listener → DETECTED_SUBTITLE_URL (catches cached subtitle fetches webRequest misses) |
| `content/youtube-main-world.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start, *://*.youtube.com/*) | **ADR-020**: read `window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` → postMessage `__YT_DETECTED_SUBTITLES` (tracks+videoId); SPA re-detect via `yt-navigate-finish` + `popstate` + `pushState` hook + videoId dedup poll (2s timeout); InnerTube fallback request when DOM parse empty |
| `content/netflix-main-world.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start, *://*.netflix.com/*) | **ADR-029**: DFS/BFS traverse `cadmiumPlayerRepository.playersById[sessionId]` for `type==='timedtext'` nodes with `urls[0].url` → pair with `getTimedTextTrackList()` metadata → postMessage `__NF_DETECTED_SUBTITLES` (tracks+movieId); poll 2-30s; SPA re-detect via pushState/replaceState/popstate; **pivoted from JSON hooks** (cadmium 6.0059+ uses schema parser) |
| `content/pageScanner.ts` | urls (constants) | `content/content-script.ts` | Scan `<video>`, `<source>`, `<track>`; **ADR-034: `<track>` URL bypass pattern filter** (element IS classifier, anikage.cc extension-less URL) |
| `content/subtitleParser.ts` | srtParser, vttParser, ttmlParser, types | subtitleDragDrop, subtitleImport | Adapter: parseSubtitle(content, format) → ParseResult (auto-detect: WEBVTT→vtt, <?xml/<tt→ttml, else srt) |
| `content/subtitleSync.ts` | types (SrtCue) | subtitleOverlay | Binary search: findCurrentLine(cues, currentTime) → index |
| `content/subtitleUI.ts` | types (OverlayConfig, **planned ADR-013**: OverlayStyleConfig, TextShadowConfig) | subtitleOverlay, subtitleImport | Overlay UI: createOverlay (appended to video parent), createDragHint, showToast, updateOverlayText, hideOverlay, removeOverlay — **planned ADR-013**: createOverlayLayer(role) 2 div độc lập + applyStyle + buildTextShadow + sanitizeFontFamily + hexToRgba |
| `content/subtitleDragPosition.ts` | types (OverlayStyleConfig) | subtitleOverlay, content-script.ts | calcYOffsetPercent (pure, clamp 0-95) + createDragHandle (Pointer Events, icon move-vertical, role=slider aria, debounce 50ms). Bug fix: second drag uses currentOffset, not initialOffset |
| `content/subtitleDragDrop.ts` | subtitleParser, types | subtitleImport | File read + parse: readFileAsText, handleFileDrop |
| `content/subtitleImport.ts` | subtitleDragDrop, types | subtitleOverlay, content-script.ts | Import button: createImportButton (appended to video parent, top-left, avoids toggle overlap), handleFileSelect |
| `content/subtitleOverlay.ts` | subtitleUI, subtitleImport, subtitleSync, types, **planned ADR-013**: subtitleDragPosition | content-script.ts | Orchestrator: SubtitleOverlayController (sync → overlay wiring) — **planned ADR-013**: 2 ref targetOverlay + nativeOverlay, onTimeUpdate 2 updateOverlayText, chrome.storage.onChanged listener |
| `content/subtitleAutoLoad.ts` | subtitleParser, subtitleMerge, subtitleOverlay, types (MessageRequest, BilingualCue), config | content-script.ts | Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL + CORS fallback via FETCH_SUBTITLE_CONTENT), handleAutoLoadSubtitles (fetch+parse+load bilingual), formatFromUrl, clearAutoLoadCache — **wired Task 7+8** |
| `content/subtitleMerge.ts` | types (BilingualCue, SrtCue) | subtitleAutoLoad.ts | mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty) — **implemented Task 5** |
| `content/subtitleTrackDropdown.ts` | types (SrtCue) | (implemented, not wired) | Multiple tracks dropdown: createTrackDropdown, updateTrackOptions |
| `content/subtitleBilingualParser.ts` | srtParser, types (BilingualCue) | content-script.ts | Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, fallback single-language) — **implemented Task 2** |
| `content/subtitlePanel.ts` | — | content-script.ts | Toggle button + seek helper: createToggleButton (toggles Side Panel via OPEN/CLOSE_SIDE_PANEL message), seekToCue — **ADR-008: panel UI moved to Side Panel** |
| `features/subtitle/ui/subtitleShortcuts.ts` | types (KeyboardShortcut) | contentScriptController.ts | Keyboard handler: handleShortcutKey (pure, guard input/textarea). **ADR-027**: default `generate-native` action (key `g`) |
| `features/subtitle/ui/contentScriptController.ts` | subtitleBlockController, subtitleManagerPanel, offsetController, subtitleShortcuts, subtitleAutoLoad, subtitleMerge, cardCreator mount, translatePrefill, settingsStore, types (SrtCue, BilingualCue, SubtitlePanelItem, Settings) | content-script.ts | **M20**: Main subtitle UI orchestration. init returns cleanup; wires AUTO_LOAD_SUBTITLES, manager panel selection, generate-native flow, keyboard shortcuts, offset, card creator. **ADR-027**: `translatedNativeSlot` virtual replacement in manager panel |
| `features/subtitle/ui/subtitleManagerPanel.ts` | types (SubtitlePanelItem) | contentScriptController.ts | **ADR-015**: Unified manager panel rendering auto/imported/translated entries with source badges. updateTarget, updateNative, open/close/destroy, onSelect callback |
| `content/subtitleBlockController.ts` | subtitleBlockDom, subtitleBlockDrag, subtitleBlockScale, navClusterActions, navClusterIcons, themeTokens (syncElementTheme), types (SrtCue, NavClusterSettings, SubtitleBlockSettings, OverlayStyleConfig) | contentScriptController.ts | **ADR-025**: SubtitleBlockController class — unified block merging target overlay + native overlay + nav cluster into single draggable block. Constructor: (video, container, blockSettings, targetStyle, nativeStyle, clusterSettings, offsetProvider?, onPersist?). Lifecycle: init/updateSettings/loadBilingualCues/updateCues/destroy. Wires drag (subtitleBlockDrag), auto-scale (subtitleBlockScale), fullscreen re-parent, theme sync (syncElementTheme) |
| `content/subtitleBlockDom.ts` | navClusterIcons | subtitleBlockController.ts | **ADR-025**: createSubtitleBlockDOM() pure factory — builds block > body > (clusterColumns + subtitleColumn + rightColumn) |
| `content/subtitleBlockDrag.ts` | types (SubtitleBlockSettings) | subtitleBlockController.ts | **ADR-025**: wireBlockDrag() pure function — Pointer Events drag for block Y position |
| `content/subtitleBlockScale.ts` | — | subtitleBlockController.ts | **ADR-025**: createBlockScaleObserver() + computeScaleSnapshot() — auto-scale block to fit container width |
| `content/subtitleBlockCss.ts` | — | subtitleBlockController.ts | **ADR-025**: Block CSS injection |
| `content/navClusterActions.ts` | subtitleSync (findCurrentLine), types (SrtCue) | subtitleBlockController.ts | **ADR-018**: Pure action helpers — findActiveCueIndex (target-primary native-fallback), prevSentence/nextSentence (gap fallback), seekBy ([0,duration] clamp + NaN/Infinity live-stream) |
| `content/navClusterButton.ts` | navClusterIcons | subtitleBlockController.ts | **ADR-018**: Atom — createNavClusterButton DOM factory (inline SVG icons via navClusterIcons, click/hold handlers + aria-pressed toggle), setButtonPressed helper |
| `content/navClusterKeyboard.ts` | subtitleShortcuts (isEditableTarget) | subtitleBlockController.ts | **ADR-018**: Pure keyboard state machine — handleClusterKeydown/up (ArrowLeft/Right, R hold with e.repeat ignore + repeatHolding guard, </, >/), cancelRepeatHold (blur/visibilitychange) |
| `content/navClusterIcons.ts` | — | subtitleBlockDom.ts, navClusterButton.ts, subtitleBlockController.ts | **ADR-018**: Pure SVG icon string map (NAV_CLUSTER_ICONS: prev/next/repeat/rewind/forward — currentColor stroke, aria-hidden, 24x24 viewBox). Source: docs/mockups/icon-svg/ (svgrepo, recolored to currentColor) — **note: icon-svg/ đã xóa, thay bằng docs/design-system/icon/ (Lucide reference catalog)** |
| `content/navClusterCss.ts` | — | themeTokens (injectThemeTokens) | **ADR-018**: Cluster CSS injected into content-script isolated world — no button background default (transparent), hover=color primary, repeat-active=color primary + spin animation, SVG 60% of button, drag on cluster background (ADR-015 pattern, no drag handle button), `transform: translate(-50%, -50%)` so `left/top` represent the cluster center |
| `content/offsetController.ts` | subtitleOffsetPanel (createOffsetSection), subtitleOffsetBadge, subtitleOffset (logic), settingsStore (saveSettings/loadSettings), types (Settings) | contentScriptController.ts | **ADR-019**: OffsetController class — subtitle time offset orchestrator. Lifecycle: init (idempotent, builds section nested trong manager panel + floating badge) → loadCues (hasSubtitle bool, reset on unload) → destroy. State machine: committed (persisted, badge hidden) ↔ lazy (apply all ngay, badge visible, timer 2 phút). Wall-clock auto-commit via timeupdate + visibilitychange (no setTimeout — MV3 throttle safe). Persist per-URL vào settings.subtitleOffset (value=0 → remove key). Public stepBy/reset cho keyboard |
| `content/subtitleOffsetPanel.ts` | subtitleOffset (logic: OffsetState, formatOffsetDisplay) | offsetController.ts | **ADR-019**: Offset section DOM factory — collapsible section nested trong Subtitle Manager Panel (mimic createSection pattern). Header (chevron + "OFFSET" + value display) + body (4 states: disabled/default/lazy-active/committed, 4 steppers ±0.5s/±2s, input + apply + reset full-width, flashSaved "✓ Đã lưu" 1.5s). Inversion of control: nhận handlers callback |
| `content/subtitleOffsetBadge.ts` | subtitleOffset (logic: AUTO_COMMIT_MS) | offsetController.ts | **ADR-019**: Lazy badge DOM factory — pill top-right overlay, "Xem thử · M:SS" + pulse dot, click=reset, keyboard accessible (Enter/Space), tabIndex=0, role=status, aria-label dynamic. Idempotent keyframes injection |
| `content/subtitleOffset.ts` (logic) | — | subtitleOffsetPanel, subtitleOffsetBadge, offsetController, subtitleSync (findCurrentLine offsetMs) | **ADR-019**: Pure offset logic — OffsetState (valueMs/mode/lastActionAt), INITIAL_OFFSET_STATE, parseOffsetInput (string→ms|null), clampOffsetMs (±60s), shouldAutoCommit (wall-clock > 2 phút), formatOffsetDisplay (+0.500s/-2.000s), AUTO_COMMIT_MS=120000 |

### Side Panel layer (ADR-008)

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `sidepanel/index.html` | — | Vite (sidepanel entry) | HTML shell for Side Panel |
| `sidepanel/main.tsx` | App | `index.html` | React entry point |
| `sidepanel/App.tsx` | useSidePanelStore, CueList, getActiveContentTab, **handleShortcutKey** (content/subtitleShortcuts), **DEFAULT_KEYBOARD_SHORTCUTS** (config), **loadSettings** (storage/settingsStore), **onStorageChanged/removeOnStorageChangedListener** (chrome-apis), types | `main.tsx` | Side Panel UI: header (title + cue count + play state), CueList; listens for SUBTITLE_CUES_LOADED/VIDEO_TIME_UPDATE/VIDEO_PLAY_STATE from background (**two-layer filter ADR-011 v3**: Layer 2 defense-in-depth — drop `tabId === undefined` (raw content-script broadcast, bypass background) + drop `tabId !== activeTabIdRef`); sends SEEK_TO on cue click; **ADR-009: Spacebar → TOGGLE_PLAY, hotkeys (a/d/s/w/t) → SHORTCUT_ACTION** (reuse handleShortcutKey, load shortcuts from storage); REQUEST_SUBTITLE_CUES on mount + **on tab switch** (syncActiveTab resets store + re-fetches cached cues); **ADR-011: activeTabIdRef + chrome.tabs.onActivated (re-fetch on tab switch) + chrome.tabs.onUpdated loading (clear store on same-tab navigate, mirror background lastCuesByTab.delete)**; **theme sync: loadSettings → set `document.documentElement.dataset.theme` + onStorageChanged listener for realtime toggle from popup** (theme.css uses `[data-theme="dark"]` selector, not prefers-color-scheme) |
| `sidepanel/store/sidePanelStore.ts` | zustand, types (BilingualCue) | App, CueList | State: cues, currentTimeMs, durationMs, isPlaying; actions: setCues, setCurrentTime, setPlaying, currentCueIndex — **half-open [start,end)** (boundary overlap fix) |
| `sidepanel/components/CueList.tsx` | types (BilingualCue) | App | Cue list with timestamps, bilingual text, highlight current cue, auto-scroll (**instant `behavior:'auto'`** — smooth scroll across long list caused motion sickness), click → onSeek(cue.start); **half-open [start,end)** findIndex |

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
| `popup/components/settings/SettingsDialog.tsx` | types, config, messages, **MultiSelect**, **Toggle**, **Slider**, **ShortcutInput**, **SearchableSelect**, **HintIcon** | App.redesigned | Settings UI; regrouped fields (chọn media → download → filename), Auto Select toggle (sparkles SVG), Preferred format dropdown, MultiSelect subtitle languages (replaces CustomSelect), SearchableSelect cho overlay target/native languages, HintIcon cho hints |
| `popup/components/settings/MultiSelect.tsx` | — | SettingsDialog | Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection |
| `shared/ui/Toggle.tsx` | — | SettingsDialog, NavClusterSettingsPanel | Switch pill 32x18px (settings-controls-restyle F1) |
| `shared/ui/Slider.tsx` | — | NavClusterSettingsPanel | Styled range 4px track + 14px thumb (settings-controls-restyle F2) |
| `shared/ui/ShortcutInput.tsx` | — | SettingsDialog | **ADR-021 D7**: Pill-style input (radius-full, min-width 140px) — single-char pill (uppercase center) + combo pill (Ctrl+Shift+T kbd chips, modifier subtle bg, key solid primary). Captures keydown, supports combo modifiers. Backward compat 5 old shortcuts. |
| `shared/ui/SearchableSelect.tsx` | — | SettingsDialog | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `shared/ui/HintIcon.tsx` | — | SettingsDialog, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |

### Shared UI layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `shared/ui/Alert.tsx` | — | ThemeImportExport | Inline message banner with variants |
| `shared/ui/Badge.tsx` | — | — | Small status label with variants/sizes |
| `shared/ui/Button.tsx` | — | App.redesigned, OptionsApp, ResourceCard, Dropzone, ImportProgress, DeleteConfirmModal, ResourcesPanel, ThemePanel, ThemeImportExport, SelectionBar | Text button: primary/secondary/outline/ghost/destructive/link, sm/md/lg, loading, disabled |
| `shared/ui/EmptyState.tsx` | — | MediaEmpty | Empty list/panel placeholder |
| `shared/ui/Tooltip.tsx` | — | — | Accessible hover/focus tooltip |
| `shared/ui/Card.tsx` | — | ResourceCard, ResourcesPanel, ThemePanel | Surface container: default/interactive/selected variants |
| `shared/ui/Checkbox.tsx` | — | CheckboxGroup | Checkbox with label, indeterminate, error, disabled states |
| `shared/ui/CheckboxGroup.tsx` | — | — | Managed list of checkboxes |
| `shared/ui/Dialog.tsx` | — | DeleteConfirmModal | Accessible modal overlay + panel |
| `shared/ui/Drawer.tsx` | — | — | Slide-in panel with overlay |
| `shared/ui/BottomSheet.tsx` | — | CardCreatorBottomSheet | **ADR-026**: Mobile bottom-anchored sheet (slide-up, drag handle, 75vh max height). Mirrors Dialog API |
| `shared/ui/FormGroup.tsx` | — | — | Label + children wrapper with consistent spacing |
| `shared/ui/Header.tsx` | — | App.redesigned, OptionsApp | Top chrome with title and actions |
| `shared/ui/IconButton.tsx` | — | Header, SettingsDialog, VideoCard, SubtitleCard, SelectionBar, DownloadCard | Icon-only transparent button (11 call sites) |
| `shared/ui/Sidebar.tsx` | — | OptionsApp | Vertical nav container with optional collapse |
| `shared/ui/Input.tsx` | — | InputField, SearchField | Text input with error state and size variants |
| `shared/ui/InputField.tsx` | — | SettingsDialog (planned) | Label + Input + helper/error text |
| `shared/ui/Label.tsx` | — | InputField, Checkbox, Radio, FormGroup | Form control label with required/disabled states |
| `shared/ui/ListItem.tsx` | — | — | Row with leading/trailing content and active state |
| `shared/ui/NavItem.tsx` | — | Sidebar (planned), OptionsApp | Navigation item (sidebar/horizontal) |
| `shared/ui/Progress.tsx` | — | DownloadCard, ImportProgress | Horizontal progress bar |
| `shared/ui/Radio.tsx` | — | RadioGroup | Radio with label, error, disabled states |
| `shared/ui/RadioGroup.tsx` | — | — | Managed list of radios |
| `shared/ui/SearchField.tsx` | — | — | Input with leading search icon + clear button |
| `shared/ui/Select.tsx` | — | SettingsDialog (planned) | Plain HTML select wrapper with placeholder/error |
| `shared/ui/Tabs.tsx` | — | ColorCustomization, SettingsDialog | Compound tab list/trigger/content |
| `shared/ui/Accordion.tsx` | — | — | Collapsible single/multiple sections |
| `shared/ui/Skeleton.tsx` | — | — | Placeholder loading shape |
| `shared/ui/Spinner.tsx` | — | Button, Loading surfaces | Animated loading indicator |
| `shared/ui/Textarea.tsx` | — | ThemeImportExport | Multiline input with resize/error/disabled |
| `shared/ui/Toggle.tsx` | — | SettingsDialog, NavClusterSettingsPanel | Switch pill 32x18px (settings-controls-restyle F1) |
| `shared/ui/Slider.tsx` | — | NavClusterSettingsPanel | Styled range 4px track + 14px thumb (settings-controls-restyle F2) |
| `shared/ui/ShortcutInput.tsx` | — | SettingsDialog | **ADR-021 D7**: Pill-style input (radius-full, min-width 140px) — single-char pill (uppercase center) + combo pill (Ctrl+Shift+T kbd chips, modifier subtle bg, key solid primary). Captures keydown, supports combo modifiers. Backward compat 5 old shortcuts. |
| `shared/ui/SearchableSelect.tsx` | — | SettingsDialog | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `shared/ui/HintIcon.tsx` | — | SettingsDialog, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |

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
  → subtitleDetector.extractLanguage(url) → "en" | "ko" | "unknown" (ISO 639 validated — folder names like "sub" → "unknown" → resolveUnknownSubtitleLanguages fires)
  → popup useSubtitleLanguage(subtitles)
    → Phase 1: URL code wins
      - subtitle.language !== 'unknown' → isoCodeToLabel(language)
      - Found → set label immediately (NO fetch)
      - Not found → add to needFetch list
    → Phase 2: Content fallback (chỉ cho unknown/unmapped)
      - Fetch subtitle content → detectLanguage(content, format)
      - Frequency-based: LANGUAGE_PROFILES unique signature words + scoring (highest match count wins, not first-match) — see docs/knowledge/language-unique-signature-words.md
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
| `tests/unit/sidepanel/CueList.test.tsx` | `sidepanel/components/CueList.tsx` | 11 | Render cues, timestamps, onSeek, highlight, auto-scroll, empty nativeText, **boundary overlap (half-open [start,end))**, **scroll behavior (instant)** |
| `tests/unit/background/autoDownload.test.ts` | `background/autoDownload.ts` | 15 | tryAutoDownload: whitelist miss → no-op, whitelist hit → enqueue, no media → no-op, return value (enqueued ids array), incremental subtitle catch-up with alreadyEnqueuedIds |
| `tests/unit/background/integration.test.ts` | `background/index.ts` (messageBus handlers) | 100+ | SUBTITLE_CUES_LOADED cache + relay (**ADR-011 v3: relay chỉ khi tabId === activeTabIdForPanel**), REQUEST_SUBTITLE_CUES re-send, VIDEO_TIME_UPDATE/VIDEO_PLAY_STATE relay + drop non-active (ADR-011 v3), VIDEO_EPISODE_CHANGED clear (ADR-010), auto-download, navigation media clear (ADR-009 D3) |

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
| `detectSubtitle` | `lib/detectors/subtitleDetector.ts` | Request + opts? → DetectedSubtitle \| null | background/index.ts | Detect subtitle from request (URL, MIME); passes `request.initiator` (iframe player origin) into `DetectedSubtitle.initiator` for CDN hotlink-protection Referer; **ADR-034: opts.trustAsSubtitle** bypass URL pattern cho `<track>`-origin URL; **ADR-036: isStremioSubtitleListing** reject Stremio addon listing JSON URL (returns null) |
| `mapYouTubeCaptionTracks` | `features/detection/logic/youtubeSubtitleDetector.ts` | (YouTubeCaptionTrack[], tabId) → DetectedSubtitle[] | background/handlers/youtubeDetection.ts | **ADR-020**: Map YouTube captionTracks → DetectedSubtitle[] (append &fmt=vtt, strip xosf, skip PO Token, isAsr+displayName) |
| `mapNetflixSubtitleTracks` | `features/detection/logic/netflixSubtitleDetector.ts` | (NetflixSubtitleTrack[], tabId) → DetectedSubtitle[] | background/handlers/detectionDispatch.ts | **ADR-029**: Map Netflix player tracks (trackId+bcp47+url from graph traversal) → DetectedSubtitle[] (format='ttml', CC suffix, forced suffix, skip lazy/none/image) |
| `extractCaptionTracks` | `features/detection/logic/youtubeSubtitleDetector.ts` | unknown → YouTubeCaptionTrack[] | youtube-main-world.iife.ts, youtubeInnertube.ts | **ADR-020**: Defensive extract captionTracks from ytInitialPlayerResponse |
| `buildVttUrl` | `features/detection/logic/youtubeSubtitleDetector.ts` | string → string | mapYouTubeCaptionTracks | Append &fmt=vtt + strip xosf param (yt-dlp #13654) |
| `requiresPoToken` | `features/detection/logic/youtubeSubtitleDetector.ts` | string → boolean | mapYouTubeCaptionTracks | Detect PO Token requirement (exp contains xpe/xpv) |
| `fetchCaptionTracksViaInnerTube` | `features/detection/logic/youtubeInnertube.ts` | (videoId, apiKey, clientVersion?) → Promise<YouTubeCaptionTrack[]> | background/handlers/youtubeDetection.ts | **ADR-020**: InnerTube fallback (WEB client, background SW fetch — content script cannot set User-Agent) |
| `extractInnertubeApiKey` | `features/detection/logic/youtubeInnertube.ts` | string → string \| null | youtube-main-world.iife.ts | Regex extract INNERTUBE_API_KEY from page HTML |
| `addDetectedSubtitles` | `background/networkInterceptor.ts` | DetectedSubtitle[] → number | background/handlers/youtubeDetection.ts | **ADR-020**: Insert pre-detected subtitles (YouTube path) bypassing handleRequest, dedup by URL+tabId, notify listeners |
| `buildTranslateUrl` | `features/translate/service/translateService.ts` | (text, sl, tl) → string | background/handlers/translate.ts | **ADR-021 D2**: Build Google Translate unofficial endpoint URL (client=gtx, dt=t) |
| `parseGoogleResponse` | `features/translate/service/translateService.ts` | unknown → string[] | background/handlers/translate.ts | **ADR-021 D2**: Parse Google Translate response → translated segments (never throws) |
| `joinCueTexts` | `features/translate/service/translateService.ts` | SrtCue[] → string | translatePrefill.ts | **ADR-021 D2**: Wrap each cue in `⟦C{idx}⟧...⟦/C{idx}⟧` markers (newline→space) for one Google request. Punctuation sent verbatim — markers alone maintain alignment |
| `alignTranslatedSegments` | `features/translate/service/translateService.ts` | (string[], n) → string[] | translatePrefill.ts | **ADR-021 D2**: Join all Google segments, extract per-cue text via marker regex (dotall), pad missing cues with '' |
| `chunkCuesByCharBudget` | `features/translate/logic/translateChunker.ts` | (SrtCue[], number[], budget) → number[][] | translatePrefill.ts | **ADR-021 D3**: Chunk cue indices by char budget (default 1500) |
| `buildSequentialIndices` | `features/translate/logic/translateChunker.ts` | (total, start) → number[] | translatePrefill.ts | Build [start..n-1] index range for prefill |
| `BackgroundPrefillController` | `features/translate/logic/translatePrefill.ts` | PrefillOptions → controller | contentScriptController.ts | **ADR-021 D1**: Sequential prefill queue + cache + guards (play, tab hidden, SPA nav) + backoff. **ADR-027**: optional `onComplete` callback fires when all chunks finish |
| `sendAction` | `features/cardCreator/service/ankiConnectClient.ts` | (FetchFn, url, action, params?, timeoutMs?) → Promise<Result<unknown>> | cardCreatorService.ts | **ADR-026**: Pure AnkiConnect HTTP client (transport-agnostic FetchFn injected for testability). Builds `{ version: 6, action, params }`, parses `{ result, error }` |
| `testConnection` | `features/cardCreator/service/cardCreatorService.ts` | (url) → Promise<Result<number>> | CardCreatorSettingsPanel | **ADR-026**: AnkiConnect `version` action → connection test. Returns API version or error |
| `listDecks` / `listModels` / `listModelFields` | `features/cardCreator/service/cardCreatorService.ts` | (url, ...) → Promise<Result<...>> | useCardCreatorState | **ADR-026**: AnkiConnect deckNames / modelNames / modelFieldNames → populate Card Creator selects |
| `findRecentNote` | `features/cardCreator/service/cardCreatorService.ts` | (url, deck, model) → Promise<Result<number \| null>> | useCardCreatorState | **ADR-026**: AnkiConnect findNotes (NOT findCards — Android compat). Quote deck/model only when spaces. Sort by id desc → newest. 10-min window check in UI |
| `getNoteInfo` | `features/cardCreator/service/cardCreatorService.ts` | (url, noteId) → Promise<Result<NoteInfo \| null>> | useCardCreatorState | **ADR-026**: AnkiConnect notesInfo → flattened fields + tags for update mode |
| `storeMedia` | `features/cardCreator/service/cardCreatorService.ts` | (url, filename, base64) → Promise<Result<string>> | useCardCreatorState | **ADR-026**: AnkiConnect storeMediaFile. **Android appends random number to filename** → MUST use returned filename in field refs. Desktop may return null → fall back to input |
| `addNote` / `updateNote` | `features/cardCreator/service/cardCreatorService.ts` | (url, ...) → Promise<Result<...>> | useCardCreatorState | **ADR-026**: AnkiConnect addNote / updateNoteFields. Update mode (overwrite/append/skip) applied in service |
| `addNoteTags` | `features/cardCreator/service/cardCreatorService.ts` | (url, noteId, tags[]) → Promise<Result<void>> | useCardCreatorState | **ADR-026**: AnkiConnect addTags. **Android silent no-op detection**: desktop success → result null; Android default → result "AnkiConnect v.6" (string) → detect via `result !== null` |
| `ensureDefaultModel` | `features/cardCreator/service/cardCreatorService.ts` | (url) → Promise<Result<void>> | useCardCreatorState | **ADR-026**: AnkiConnect createModel. **Android silent no-op detection**: re-check modelNames after call — if model still missing, hit default handler → helpful error |
| `autoMapFields` | `features/cardCreator/service/fieldMapping.ts` | (string[]) → FieldMapping | useCardCreatorState | **ADR-026**: Auto-map Cell source fields → Anki fields by canonical name (exact case-insensitive → fuzzy Levenshtein ≤ 2 → substring). Each Anki field used at most once |
| `captureScreenshot` | `features/cardCreator/media/screenshot.ts` | (HTMLVideoElement) → Promise<MediaFile> | useCardCreatorState | **ADR-026**: canvas.drawImage(video) → PNG ArrayBuffer. Throws ScreenshotError if video not ready / canvas tainted |
| `captureSentenceAudio` | `features/cardCreator/media/sentenceAudio.ts` | (HTMLVideoElement, cue) → Promise<SentenceAudioResult> | useCardCreatorState | **ADR-026**: MediaRecorder on video.captureStream() audio tracks. Cap 15s (4GB mobile), skip if tab hidden, fall back gracefully if unsupported. Never throws |
| `translateSentence` | `features/cardCreator/media/translation.ts` | (text, sl, tl) → Promise<string> | useCardCreatorState | **ADR-026**: Reuse ADR-021 TRANSLATE message + encode/decode punctuation. Returns '' on any failure (never throws) |
| `DraftAutosaver` | `features/cardCreator/state/cardDraft.ts` | — → controller | useCardCreatorState | **ADR-026**: Debounced (500ms) autosave to chrome.storage.local `cardCreatorDraft`. Media ArrayBuffers NOT persisted. Cleared on successful Add/Update |
| `useCardCreatorState` | `features/cardCreator/ui/useCardCreatorState.ts` | (settings, openContext) → CardCreatorState | CardCreatorDialog, CardCreatorBottomSheet | **ADR-026**: State management hook — load decks/models/fields, auto-map, find recent note, draft autosave, media add/remove/reorder/drop, Add/Update actions, toasts |
| `mountCardCreatorDialog` | `features/cardCreator/ui/mountCardCreatorDialog.ts` | (settings, themeSource?) → CardCreatorMountController | contentScriptController.ts | **ADR-026**: Mount Card Creator into a full-viewport fixed host; chooses desktop `Dialog` or mobile `BottomSheet` based on viewport width |
| `CardCreatorDialog` | `features/cardCreator/ui/CardCreatorDialog.tsx` | (open, onOpenChange, settings, openContext, initialAction?) → ReactElement | mountCardCreatorDialog | **ADR-026**: Desktop modal shell around `CardCreatorDialogContent` |
| `CardCreatorBottomSheet` | `features/cardCreator/ui/CardCreatorBottomSheet.tsx` | (open, onOpenChange, settings, openContext, initialAction?) → ReactElement | mountCardCreatorDialog | **ADR-026**: Mobile bottom-sheet shell around `CardCreatorDialogContent` |
| `CardCreatorDialogContent` | `features/cardCreator/ui/CardCreatorDialogContent.tsx` | (state, variant, onCancel) → ReactElement | CardCreatorDialog, CardCreatorBottomSheet | **ADR-026**: Main body — left-bordered alert icons, section titles (no bordered cards), preview block, fields, footer; wires `MediaList` add/remove/drop/reorder to `useCardCreatorState` |
| `PreviewBlock` | `features/cardCreator/ui/PreviewBlock.tsx` | (targetWord, sentence, testId?) → ReactElement | CardCreatorDialogContent | Yomitan-scanable preview block; highlights all occurrences of target word in sentence |
| `FieldRow` | `features/cardCreator/ui/FieldRow.tsx` | (label, mappedField, availableFields, onMapChange, children, testId?) → ReactElement | CardCreatorDialogContent | ADR-026 UI redesign: label-style field-map selector (subtle text + small chevron, no border/background) plus child input/textarea |
| `FieldInput` | `features/cardCreator/ui/FieldRow.tsx` | (props) → ReactElement | CardCreatorDialogContent | Styled single-line input for use inside FieldRow |
| `FieldTextarea` | `features/cardCreator/ui/FieldRow.tsx` | (props) → ReactElement | CardCreatorDialogContent | Styled multiline textarea for use inside FieldRow |
| `MediaList` | `features/cardCreator/ui/MediaList.tsx` | (files, kind, addLabel, onAdd, onRemove, onFilesDrop?, onReorder?, addDisabled?, testId?) → ReactElement | CardCreatorDialogContent | Image gallery (horizontal 120px thumbnails + add button + preview overlay) or audio list (vertical rows + play/remove + empty dropzone); supports drag-and-drop file add and drag-to-reorder |
| `handleCardCreatorKeydown` | `features/subtitle/ui/cardCreatorKeyboard.ts` | (KeyboardEvent, dialogOpen) → { action } | subtitleUI.ts | **ADR-026 §9**: q → quick-update, e → edit-card. Guards: not typing, dialog not open, no auto-repeat |
| `detectScript` | `lib/detectors/scriptDetector.ts` | string → Script \| null | languageDetector.ts | Detect Unicode script (26 scripts) |
| `detectLanguage` | `lib/detectors/languageDetector.ts` | string → string (ISO 639-1) | subtitleDetector.ts | Hybrid: script + frequency → language |
| `selectBestMedia` | `lib/selectors/selectBestMedia.ts` | DetectedMedia[] → AutoSelectResult \| null | autoDownload.ts | Pure: select best video + subtitles by prefs |
| `parseSrt` | `lib/parsers/srtParser.ts` | string → SrtSubtitle | subtitleParser.ts | Parse SRT format to SrtCue[]; **strips inline tags** (`<i>`, `<b>`, `{\an8}`) via stripSubtitleTags |
| `parseVtt` | `lib/parsers/vttParser.ts` | string → VttSubtitle | subtitleParser.ts | Parse VTT format to VttCue[]; **strips inline tags** via stripSubtitleTags |
| `parseTtml` | `lib/parsers/ttmlParser.ts` | string → SrtSubtitle | subtitleParser.ts | **ADR-029**: Parse TTML (IMSC1.1) via DOMParser — tick/clock/seconds time formats, `<br>`→newline, nested `<span>` stripped; Netflix serves IMSC1.1 not WebVTT |
| `convertTtmlToSrt` | `lib/parsers/ttmlToSrt.ts` | string → string | (download path) | **ADR-029**: Convert TTML content to SRT format (parseTtml → msToSrtTime per cue) |
| `stripSubtitleTags` | `lib/parsers/srtNormalizer.ts` | string → string | srtParser, vttParser, srtNormalizer | Strip `<i>`/`<b>`/`<c>`/`<v>`/`{\an8}` tags, preserve newlines (display path) |
| `Toggle` | `shared/ui/Toggle.tsx` | checked, onChange, ariaLabel → ReactElement | SettingsDialog, NavClusterSettingsPanel | Switch pill 32x18px (settings-controls-restyle F1) |
| `hexToRgb` | `features/theme/logic/colorGenerator.ts` | string → {r,g,b} | themeManager, contrastValidator | **ADR-022**: Parse hex → RGB (3/6 digit, case-insensitive) |
| `getLuminance` | `features/theme/logic/colorGenerator.ts` | string → number | contrastValidator | **ADR-022**: WCAG 2.1 relative luminance (0-1) |
| `generateShade` | `features/theme/logic/colorGenerator.ts` | (hex, percent) → hex | themeManager | **ADR-022**: Darken hex by percent (0-100) |
| `generateHoverColor` | `features/theme/logic/colorGenerator.ts` | hex → hex | themeManager | **ADR-022**: Hover = shade 10% |
| `getContrastRatio` | `features/theme/logic/contrastValidator.ts` | (fg, bg) → number | contrastValidator | **ADR-022**: WCAG contrast ratio (1-21) |
| `validateTheme` | `features/theme/logic/contrastValidator.ts` | CoreColorTokens → ValidationResult | ThemePanel | **ADR-022**: Validate 3 pairs (text/canvas, textSecondary/canvas, white/primary) |
| `applyTheme` | `features/theme/logic/themeManager.ts` | (ResolvedMode, ThemeConfig) → void | ThemeProvider, ThemePanel | **ADR-022**: Set 9 core + derived CSS vars on :root + data-theme attr |
| `resolveMode` | `features/theme/logic/themeManager.ts` | ThemeMode → ResolvedMode | ThemeProvider, ThemePanel, popup App | **ADR-022**: system → light/dark via prefers-color-scheme |
| `useThemeStore` | `stores/themeStore.ts` | Zustand store | ThemeProvider, ThemePanel, popup App | **ADR-022**: mode + config + init/switchMode/updateColor/setConfig/resetTheme |
| `injectThemeTokens` | `shared/lib/themeTokens.ts` | HTMLElement → cleanup | contentScriptController | **ADR-022 + ADR-024**: Content-script `<style>` injection from themeConfig + storage.onChanged. Static tokens on `:root`, color tokens on `[data-theme]` |
| `syncElementTheme` | `shared/lib/themeTokens.ts` | (element: HTMLElement, container: HTMLElement) → cleanup | subtitleBlockController.ts | **ADR-024**: Sync `data-theme` attribute from container to a portable element; uses MutationObserver to keep the element self-themed when re-parented |
| `ThemeProvider` | `features/theme/ui/ThemeProvider.tsx` | children → JSX | popup/sidepanel/options main.tsx | **ADR-022**: Boot themeStore + applyTheme + system listener + storage.onChanged sync |
| `importFile` | `features/dictionary/logic/importOrchestrator.ts` | (file, resourceType, options) → ImportResult | ResourcesPanel | **ADR-023**: validate → detect → signature → dedupe → create resource → strategy.execute() → finalize; error → rollbackImport |
| `rollbackImport` | `features/dictionary/logic/importOrchestrator.ts` | (langCode, resourceId) → void | importOrchestrator | **ADR-023 D6**: Delete dictionary + frequency + resource (cascade); rollback-during-rollback → RollbackError |
| `detectFormat` | `features/dictionary/logic/formatDetector.ts` | (name, head) → ImportFormat | importOrchestrator | **ADR-023 D4**: Hybrid magic+ext+zip sniff (gzip→sqlite, zip→yomitan/json-array/txt, sqlite magic, JSON content) |
| `computeSignature` | `features/dictionary/logic/signatureGenerator.ts` | (file) → string | importOrchestrator | **ADR-023 D7**: SHA-256(first1MB)_size_nameWithoutExt — dedupe key |
| `parsePhraseTemplate` | `features/dictionary/logic/phraseTemplateParser.ts` | (term, options?) → ParsedPhraseTemplate | phrase-index compiler | **ADR-037**: Cambridge optional/alternative/slot AST; rejects open/malformed/over-limit templates |
| `compilePhraseIndex` | `features/dictionary/logic/phraseIndexCompiler.ts` | (PhraseIndexInput[]) → PhraseIndex | phrase matcher worker | **ADR-037 §7**: anchor inverted index + compact binary blob (≤8MB); serialize/deserialize round-trip for worker transfer |
| `tokenizeSentence` | `features/dictionary/logic/phraseMatcher.ts` | (sentence) → SentenceToken[] | matchPhrase | **ADR-037 §8.1**: NFC + lowercase + UTF-16 cursor offsets for hovered-token routing |
| `matchPhrase` | `features/dictionary/logic/phraseMatcher.ts` | (PhraseMatchRequest, PhraseIndex) → PhraseMatch \| null | phraseMatchService | **ADR-037 §8-9**: bounded DP over tokens + deterministic ranking tuple; span must contain hovered token |
| `matchPhraseRequest` | `features/dictionary/logic/phraseMatchService.ts` | (PhraseMatchServiceRequest, deps, AbortSignal) → Promise<PhraseMatchResult> | lookup orchestrator | **ADR-037 §8.3 10-11**: phrase match → definition lookup → word fallback; AbortSignal cancellation; `quality` enum, no confidence score |
| `buildPhraseIndexForResource` | `features/dictionary/logic/phraseIndexBuilder.ts` | (langCode, resourceId) → Promise<PhraseIndexBuildResult> | importOrchestrator | **ADR-037 §7.2**: collect multiword terms from stored Cambridge entries → parse → compile → serialize → putPhraseIndex; unsupported terms counted + excluded; failure rolls back import |
| `loadPhraseIndexBlob` | `features/dictionaryPopup/worker/phraseIndexLoader.ts` | (resourceId, blob) → PhraseIndexLoadResult | lookupWorkerHandler | **ADR-037 §7**: validate magic/version/termCount/anchor bounds; hydrate into ResidentPhraseIndex with anchor→templateIDs map; malformed blobs fail closed |
| `handleWorkerMessage` | `features/dictionaryPopup/worker/lookupWorkerHandler.ts` | (LookupWorkerState, WorkerRequestMessage) → WorkerLookupResultMessage[] | lookupWorker entry | **ADR-037 §8 + spec §9.4/§9.5**: HYDRATE_CHUNK stores resident index; PUSH_DEFINITION inserts into 10k-capped LRU; LOOKUP runs matchPhrase + word fallback (LRU hit → definitions); LOOKUP_CANCEL drops by requestId |
| `LruCache` | `features/dictionaryPopup/logic/lruCache.ts` | class\<K, V\> with cap | lookupWorkerHandler | **spec §9.5**: O(1) get/set/evict via Map insertion order; hard cap 10k for definitions; deterministic eviction |
| `sortResidentIndexesByPriority` | `features/dictionaryPopup/worker/resourcePriority.ts` | (Iterable\<ResidentPhraseIndex\>, priorityMap?) → ResidentPhraseIndex[] | lookupWorkerHandler | **ADR-037 Task 1.4**: deterministic multi-resource ordering — newest resourceId first by default; explicit priorityMap overrides; unmapped resources sort after mapped ones |
| `comparePhraseMatches` | `features/dictionary/logic/phraseMatcher.ts` | (PhraseMatch, PhraseMatch) → number | lookupWorkerHandler, phraseMatchService | **ADR-037 §9**: cross-resource tie-break — quality desc → span length desc → dictionaryTerm ascending (stable) |
| `createEnglishPlugin` | `features/dictionaryPopup/plugins/englishPlugin.ts` | (PhraseIndex, resourceId?) → LanguagePlugin | lookupOrchestrator | **spec §4.6.3**: EN plugin — whitespace tokenize, lemma (irregular + regular), possessive normalize, matchPhrase delegates to phraseMatcher |
| `createFallbackPlugin` | `features/dictionaryPopup/plugins/fallbackPlugin.ts` | (langCode) → LanguagePlugin | pluginRegistry | **spec §4.6.3**: minimal plugin for unknown languages — whitespace tokenize only, no lemma/possessive/phraseMatch |
| `createChinesePlugin` | `features/dictionaryPopup/plugins/chinesePlugin.ts` | () → LanguagePlugin | lookupOrchestrator | **spec §4.6.4**: ZH plugin — FMM segmentation (dict-driven, O(n·maxLen)), readingKind=pinyin, chengyu via FMM (4-char idioms match naturally) |
| `segmentFMM` | `features/dictionaryPopup/plugins/chinesePlugin.ts` | (text, TermProbe) → Token[] | chinesePlugin.segment | **spec §D-alternatives**: forward maximum matching — longest dict term at each position, single-char fallback; ponytail: no ambiguity handling (upgrade: DAG + freq) |
| `PluginRegistry` | `features/dictionaryPopup/plugins/pluginRegistry.ts` | class with register/get/has/listLangs | lookupOrchestrator | **spec §4.6.3**: registry + fallback dispatch — get(langCode) returns registered plugin or fallback |
| `lookupOrchestrator` | `features/dictionaryPopup/logic/lookupOrchestrator.ts` | (LookupRequest, deps?, signal?) → Promise<LookupResult> | lookupWorkerHandler | **spec §4.6.3/§9.4**: EN phrase match (ADR-037) → dict query; ZH FMM segment → dict query; fallback token → dict query; assembles LookupResult (definitions, reading, frequency, status, detectedPhrase, matchSource) |
| `createDictionaryProbeAsync` | `features/dictionaryPopup/logic/lookupOrchestrator.ts` | (langCode) → Promise<TermProbe> | lookupOrchestrator (ZH path) | **spec §4.6.4**: pre-loads all dict terms into a Set for synchronous FMM hasTerm() calls; ponytail: loads per-lookup, upgrade: cache in worker |
| `createStrategy` | `features/dictionary/strategies/strategyFactory.ts` | (format, resourceType, options, fileData) → Strategy | importOrchestrator | **ADR-023 D3**: Route format → strategy (txt/json-array/yomitan/sqlite/cambridge-json) |
| `TxtLineStrategy` | `features/dictionary/strategies/txtLineStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: TXT line-by-line, auto-unzip, order-based frequency |
| `JsonArrayStrategy` | `features/dictionary/strategies/jsonArrayStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: JSON array of strings, streaming regex + JSON.parse unescape |
| `YomitanStrategy` | `features/dictionary/strategies/yomitanStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: unzip + index.json + term_meta_bank sort, freq type filter |
| `CambridgeJsonStrategy` | `features/dictionary/strategies/cambridgeJsonStrategy.ts` | extends BaseDictionaryStrategy | strategyFactory | **ADR-023 D3**: JSON array of {term, definition, ...} rich fields |
| `SqliteStrategy` | `features/dictionary/strategies/sqliteStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D5**: gunzip + sql.js lazy-load + exec SQL, DatabaseError on wasm fail |
| `ResourcesPanel` | `features/dictionary/ui/ResourcesPanel.tsx` | { langCode } → JSX | OptionsApp | **ADR-023 F11**: 2 sections (dictionary + frequency) + list + import flow + delete confirm |
| `Dropzone` | `features/dictionary/ui/Dropzone.tsx` | { label, accept, disabled, onFiles } → JSX | ResourcesPanel | **ADR-023 F11**: Drag-drop + click file picker |
| `Slider` | `shared/ui/Slider.tsx` | value, min, max, step, onChange, ariaLabel → ReactElement | NavClusterSettingsPanel | Styled range 4px track + 14px thumb (settings-controls-restyle F2) |
| `ShortcutInput` | `shared/ui/ShortcutInput.tsx` | value: ShortcutValue, onChange: (ShortcutValue) => void, ariaLabel → ReactElement | SettingsDialog | **ADR-021 D7**: Pill-style input — single-char + combo (Ctrl+Shift+T). Captures keydown, supports modifiers. |
| `SearchableSelect` | `shared/ui/SearchableSelect.tsx` | options, value, onChange, ariaLabel → ReactElement | SettingsDialog | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `HintIcon` | `shared/ui/HintIcon.tsx` | hint, ariaLabel → ReactElement | SettingsDialog, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |
| `parseSubtitle` | `content/subtitleParser.ts` | (string, format) → ParseResult | subtitleDragDrop, subtitleImport | Adapter: auto-detect format (WEBVTT→vtt, <?xml/<tt→ttml, else srt), parseSrt/parseVtt/parseTtml |
| `createSubtitleManagerPanel` | `features/subtitle/ui/subtitleManagerPanel.ts` | (container, importButton, options?) → SubtitleManagerPanel | contentScriptController.ts | **ADR-015**: Unified subtitle manager panel with auto/imported/translated `source` badges; `updateTarget`, `updateNative`, `open`, `close`, `destroy`. `onSelect(role, index)` routes to controller |
| `init` | `features/subtitle/ui/contentScriptController.ts` | (video, container) → cleanup | content-script.ts | **M20**: Subtitle overlay UI orchestration — loads settings, wires block controller, manager panel, offset controller, shortcuts, drag-drop, import. **ADR-027**: registers `handleGenerateNative` for `generate-native` button/shortcut |
| `handleGenerateNative` | `features/subtitle/ui/contentScriptController.ts` | () → void | init (button/shortcut) | **ADR-027**: Translates active target cues into configured native language via `BackgroundPrefillController`, creates a virtual `translated` native slot in the manager panel, feeds overlay as chunks arrive, clears/restarts on re-trigger |
| `findCurrentLine` | `content/subtitleSync.ts` | (SrtCue[], number, offsetMs=0) → number | subtitleOverlay, navClusterActions | Binary search O(log n) for current subtitle line by video time. ADR-019: optional offsetMs shifts search window (apply offset globally, no per-cue mutation) |
| `createOverlay` | `content/subtitleUI.ts` | (HTMLElement, OverlayConfig) → HTMLDivElement | subtitleOverlay | Create subtitle overlay div appended to video wrapper |
| `updateOverlayText` | `content/subtitleUI.ts` | (HTMLDivElement, string) → void | subtitleOverlay | Set text and show overlay |
| `hideOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Clear text and hide overlay |
| `removeOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Remove overlay from DOM |
| `createDragHint` | `content/subtitleUI.ts` | HTMLElement → HTMLDivElement | content-script.ts | Create drag-drop hint overlay appended to video parent |
| `showToast` | `content/subtitleUI.ts` | (string, HTMLElement) → void | content-script.ts | Show temporary toast message inside video parent |
| `createOverlayLayer` | `content/subtitleUI.ts` | (role, OverlayStyleConfig, HTMLElement) → {overlay, textSpan} | subtitleOverlay | **ADR-013 → ADR-015**: Create 1 overlay div độc lập (target OR native) + text span. ADR-015 xóa drag handle button, overlay = drag target (pointer-events: auto, cursor ns-resize, role=slider ARIA on overlay div) |
| `applyStyle` | `content/subtitleUI.ts` | (OverlayStyleConfig, HTMLDivElement) → void | subtitleOverlay, content-script.ts | **ADR-013 → ADR-015**: Set inline style (fontSize, color, bg+alpha, opacity, textShadow, fontFamily, yOffset%, align, visible). ADR-015: aria-valuenow set directly on overlay (bỏ querySelector('[role="slider"]') trap) |
| `buildTextShadow` | `content/subtitleUI.ts` | (TextShadowConfig) → string | applyStyle | **NEW (planned ADR-013)**: Pure — build CSS text-shadow string (none/soft/cinema/custom preset) |
| `sanitizeFontFamily` | `content/subtitleUI.ts` | (string) → string | applyStyle | **NEW (planned ADR-013)**: Pure — block url()/@import/expression(), fallback 'sans-serif' |
| `hexToRgba` | `content/subtitleUI.ts` | (hex, alpha 0-1) → string | applyStyle | **NEW (planned ADR-013)**: Pure — convert hex + alpha → rgba string (bg color tách alpha rời) |
| `calcYOffsetPercent` | `content/subtitleDragPosition.ts` | (pointerDeltaY, containerHeight, currentOffset) → number | createDragHandle | **NEW (planned ADR-013)**: Pure — calc Y-offset % from pointer delta, clamp 0-95 |
| `createDragHandle` | `content/subtitleDragPosition.ts` | (overlay, container, initialOffset, onDrag) → HTMLDivElement | subtitleOverlay | **ADR-013 → ADR-015**: Pointer Events drag wired directly on overlay background (xóa handle button). e.target===textSpan check skips drag (select text preserved). cursor ns-resize→grabbing. Math calcYOffsetPercent giữ nguyên |
| `createSubtitleDropdown` | `content/subtitleSelector.ts` | (role, container, subtitles, language, activeIndex, onSelect) → {icon, destroy} | content-script.ts | **NEW (planned ADR-014)**: Overlay dropdown góc phải container — icon chevron-down, popover list sub cùng lang + cue count + format, click outside/Esc/chọn đóng. Chỉ render khi ≥2 sub cùng lang |
| `readFileAsText` | `content/subtitleDragDrop.ts` | File → Promise<string> | subtitleImport | Read File content as text via FileReader |
| `handleFileDrop` | `content/subtitleDragDrop.ts` | File → Promise<ParseResult> | subtitleImport | Validate extension + read + parse subtitle file |
| `createImportButton` | `content/subtitleImport.ts` | (HTMLElement, OverlayConfig) → HTMLButtonElement | subtitleOverlay | Create import button at top-left of video parent (avoids toggle overlap) |
| `handleFileSelect` | `content/subtitleImport.ts` | File → Promise<ParseResult> | content-script.ts | Handle file from picker (reuses handleFileDrop) |
| `createToggleButton` | `content/subtitlePanel.ts` | HTMLElement → HTMLButtonElement | content-script.ts | Create toggle button (toggles Side Panel via OPEN/CLOSE_SIDE_PANEL, state tracked in contentScriptController `sidePanelOpen`) — **ADR-008** |
| `seekToCue` | `content/subtitlePanel.ts` | (HTMLVideoElement, {start: number}) → void | content-script.ts | Seek video to cue.start / 1000 — **ADR-008**. **ADR-030**: routes qua `seekVideo` (Netflix M7375 fix) |
| `seekVideo` | `features/subtitle/ui/netflixPlayback.ts` | (HTMLVideoElement, seconds) → void | seekToCue, navClusterActions, contentScriptController | **ADR-030**: isNetflixPage() → dispatch `__NF_SEEK` CustomEvent → MAIN-world `player.seek(ms)`; fallback `video.currentTime` cho site thường |
| `playVideo` | `features/subtitle/ui/netflixPlayback.ts` | (HTMLVideoElement) → Promise<void> | contentScriptController (TOGGLE_PLAY) | **ADR-030**: isNetflixPage() → dispatch `__NF_PLAY` → MAIN-world `player.play()`; fallback `video.play()` |
| `pauseVideo` | `features/subtitle/ui/netflixPlayback.ts` | (HTMLVideoElement) → void | contentScriptController (TOGGLE_PLAY) | **ADR-030**: isNetflixPage() → dispatch `__NF_PAUSE` → MAIN-world `player.pause()`; fallback `video.pause()` |
| `isNetflixPage` | `features/subtitle/ui/netflixPlayback.ts` | () → boolean | seekVideo, playVideo, pauseVideo, mountToWatchVideo | **ADR-030**: `location.hostname.includes('netflix.com')` — true trên www.netflix.com (where netflix-main-world.iife.ts injects) |
| `mountToWatchVideo` | `features/subtitle/ui/netflixPlayback.ts` | (HTMLElement, HTMLElement) → void | subtitleBlockController, subtitleManagerPanel (×2), subtitlePanel, subtitleUI | **ADR-031**: isNetflixPage() → move el vào `.watch-video` + z-index 2147483647 + copy `data-theme` từ container; no-op off-Netflix. Fix Netflix `active`/`inactive` wrappers che Cell UI |
| `SubtitleOverlayController.init` | `content/subtitleOverlay.ts` | (videoWrapper?: HTMLElement) → void | content-script.ts | Create overlay + import button inside video parent; attach timeupdate listener — **Task 6** |
| `createBilingualSubtitleController` | `content/subtitleOverlay.ts` | (deps) → BilingualSubtitleController | subtitleAutoLoad.ts | Factory: create overlay with 2 spans (target + native), loadBilingualCues, updateBilingual, destroy — **implemented Task 6** |
| `shouldAutoLoad` | `content/subtitleAutoLoad.ts` | AutoLoadConfig → boolean | content-script.ts | Auto-load decision: autoLoad enabled + target language set — **wired Task 7** |
| `validateOverride` | `content/subtitleAutoLoad.ts` | OverrideConfig → OverrideResult | content-script.ts | Override validation: file language must match target (case-insensitive) — **wired Task 7** |
| `fetchAndParseSubtitle` | `content/subtitleAutoLoad.ts` | (url, format, tabUrl?, initiator?) → Promise<ParseResult> | subtitleAutoLoad.ts | Fetch + parse subtitle; cache by URL; CORS fallback via FETCH_SUBTITLE_CONTENT (background SW fetch, sends `initiator` as Referer for CDN hotlink protection) — **implemented Task 8** |
| `handleAutoLoadSubtitles` | `content/subtitleAutoLoad.ts` | (AutoLoadPayload, deps) → Promise<void> | content-script.ts | Auto-load handler: fetch target + native → mergeCuesForPanel → loadBilingualCues — **wired Task 7** |
| `clearAutoLoadCache` | `content/subtitleAutoLoad.ts` | () → void | content-script.ts | Clear per-URL cache on re-injection — **implemented Task 7** |
| `mergeCuesForPanel` | `content/subtitleMerge.ts` | (SrtCue[], SrtCue[]) → BilingualCue[] | subtitleAutoLoad.ts | Merge target + native cues: target skeleton, native best-effort overlap; fallback native skeleton when target empty — **implemented Task 5** |
| `createTrackDropdown` | `content/subtitleTrackDropdown.ts` | HTMLElement → HTMLSelectElement | (implemented, not wired) | Create track dropdown for multiple subtitle tracks |
| `updateTrackOptions` | `content/subtitleTrackDropdown.ts` | (HTMLSelectElement, TrackOption[]) → void | (implemented, not wired) | Populate dropdown + show/hide |
| `findSubtitlesForOverlay` | `background/subtitleService.ts` | (DetectedSubtitle[], Settings) → SubtitlesForOverlayResult \| null | `background/index.ts` | Validate target + native language → return both matches (partial load when only one matches) — BCP 47 subtag-aware (e.g. `zh` matches `zh-hans`/`zh-hant`) — **wired Task 3** — **planned ADR-014**: dùng findPreferredMatch (preference-aware) |
| `findPreferredMatch` | `background/subtitleService.ts` | (DetectedSubtitle[], language, preferredIndex?) → SubtitleForOverlayResult \| null | `findSubtitlesForOverlay` | **NEW (planned ADR-014)**: Pure — filter sub cùng lang (BCP 47 subtag-aware), trả sub theo preference index, fallback first-match (index 0) khi out of range |
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
| `handleShortcutKey` | `features/subtitle/ui/subtitleShortcuts.ts` | (string, KeyboardShortcut[], EventTarget) → ShortcutAction \| null | content-script.ts, **sidepanel/App.tsx** | Pure: map key → action, guard input/textarea focus. **ADR-027**: default `DEFAULT_KEYBOARD_SHORTCUTS` includes `generate-native` (key `g`) |
| `isEditableTarget` | `content/subtitleShortcuts.ts` | EventTarget \| null → boolean | subtitleShortcuts.ts | Check if target is input/textarea/select/contenteditable — **implemented Task 3** |
| `SubtitleBlockController` | `features/subtitle/ui/subtitleBlockController.ts` | class (video, container, blockSettings, targetStyle, nativeStyle, clusterSettings, onGenerateNative?, offsetProvider?, onPersist?) → controller | contentScriptController.ts | **ADR-025**: Unified block merging target overlay + native overlay + nav cluster into single draggable block. init/updateSettings/loadBilingualCues/updateCues/destroy. Wires drag (subtitleBlockDrag) + auto-scale (subtitleBlockScale) + fullscreen re-parent + theme sync (syncElementTheme). **ADR-027**: `setGenerateNativeEnabled(enabled)` toggles generate-native button; `onGenerateNative` callback fires on button click / shortcut |
| `createSubtitleBlockDOM` | `features/subtitle/ui/subtitleBlockDom.ts` | () → SubtitleBlockDOM | subtitleBlockController.ts | **ADR-025**: Pure DOM factory — builds block > body > (clusterColumns + subtitleColumn + rightColumn). **ADR-027**: rightColumn now contains `generateNativeBtn` (cluster-btn with SVG icon, `aria-label="Generate native subtitle"`, title `G`) |
| `wireBlockDrag` | `content/subtitleBlockDrag.ts` | (block, settings, onPersist?) → void | subtitleBlockController.ts | **ADR-025**: Pure function — Pointer Events drag for block Y position |
| `createBlockScaleObserver` | `content/subtitleBlockScale.ts` | (block, container) → ResizeObserver | subtitleBlockController.ts | **ADR-025**: Auto-scale block to fit container width |
| `computeScaleSnapshot` | `content/subtitleBlockScale.ts` | (block, container) → number | subtitleBlockController.ts | **ADR-025**: Compute scale factor snapshot for block auto-scale |
| `findActiveCueIndex` | `content/navClusterActions.ts` | (SrtCue[], SrtCue[], number) → { cues, index } | subtitleBlockController.ts | **ADR-018**: Find active cue (target-primary, native-fallback) via findCurrentLine |
| `prevSentence` | `content/navClusterActions.ts` | (HTMLVideoElement, SrtCue[], SrtCue[]) → void | subtitleBlockController.ts | **ADR-018**: Seek to previous subtitle sentence (gap fallback) |
| `nextSentence` | `content/navClusterActions.ts` | (HTMLVideoElement, SrtCue[], SrtCue[]) → void | subtitleBlockController.ts | **ADR-018**: Seek to next subtitle sentence (gap fallback) |
| `seekBy` | `content/navClusterActions.ts` | (HTMLVideoElement, number) → void | subtitleBlockController.ts | **ADR-018**: Seek by fixed seconds ([0,duration] clamp, NaN/Infinity live-stream) |
| `createNavClusterButton` | `content/navClusterButton.ts` | (NavClusterButtonProps) → HTMLButtonElement | subtitleBlockController.ts | **ADR-018**: Atom — DOM factory for cluster button (inline SVG icons, click/hold + aria-pressed) |
| `NAV_CLUSTER_ICONS` | `content/navClusterIcons.ts` | Record<NavClusterIconName, string> | subtitleBlockDom.ts, navClusterButton.ts, subtitleBlockController.ts | **ADR-018**: Pure SVG icon string map (prev/next/repeat/rewind/forward — currentColor stroke, aria-hidden, 24x24 viewBox) |
| `NAV_CLUSTER_DRAG_GLYPH` | ~~`content/navClusterIcons.ts`~~ | — | — | **Removed (ADR-015 drag pattern)**: Drag handle button xóa — drag trực tiếp cluster background |
| `handleClusterKeydown` | `content/navClusterKeyboard.ts` | (KeyboardEvent, NavClusterKeyboardState) → { action, state } | subtitleBlockController.ts | **ADR-018**: Pure keydown state machine (ArrowLeft/Right, R hold, </, >/) |
| `handleClusterKeyup` | `content/navClusterKeyboard.ts` | (KeyboardEvent, NavClusterKeyboardState) → { action, state } | subtitleBlockController.ts | **ADR-018**: Pure keyup state machine (R keyup → repeat-stop) |
| `cancelRepeatHold` | `content/navClusterKeyboard.ts` | (NavClusterKeyboardState) → { action, state } | subtitleBlockController.ts | **ADR-018**: Cancel repeat hold (blur/visibilitychange — keyup may be lost) |
| `OffsetController` | `content/offsetController.ts` | class (video, container, url, snapshot?) → controller | contentScriptController.ts | **ADR-019**: Subtitle time offset orchestrator. init/loadCues/getOffsetMs/stepBy/reset/destroy. State machine committed↔lazy + wall-clock auto-commit (timeupdate + visibilitychange) + persist per-URL |
| `createOffsetSection` | `content/subtitleOffsetPanel.ts` | (parentPanel, handlers) → OffsetSectionApi | offsetController.ts | **ADR-019**: Offset section DOM factory — collapsible section nested trong manager panel (header chevron + "OFFSET" + value, body 4 states, 4 steppers, input+apply+reset, flashSaved) |
| `createOffsetBadge` | `content/subtitleOffsetBadge.ts` | (container, onReset) → OffsetBadgeApi | offsetController.ts | **ADR-019**: Lazy badge DOM factory (pill, "Xem thử · M:SS", pulse dot, click=reset, keyboard accessible) |
| `formatBadgeTimer` | `content/subtitleOffsetBadge.ts` | (remainingMs) → string | subtitleOffsetBadge.ts | **ADR-019**: Format remaining ms → "M:SS" (clamp negative → "0:00") |
| `parseOffsetInput` | `content/subtitleOffset.ts` (logic) | (string) → number \| null | offsetController, subtitleOffsetPanel | **ADR-019**: Parse user input → ms (null if invalid) |
| `clampOffsetMs` | `content/subtitleOffset.ts` (logic) | (number) → number | offsetController | **ADR-019**: Clamp offset to ±60s |
| `shouldAutoCommit` | `content/subtitleOffset.ts` (logic) | (OffsetState, now) → boolean | offsetController | **ADR-019**: Wall-clock check — lazy + > 2 phút since lastActionAt → true |
| `formatOffsetDisplay` | `content/subtitleOffset.ts` (logic) | (number) → string | subtitleOffsetPanel | **ADR-019**: Format offset → "+0.500s"/"-2.000s" |
| `AUTO_COMMIT_MS` | `content/subtitleOffset.ts` (logic) | constant = 120000 | offsetController, subtitleOffsetBadge | **ADR-019**: Auto-commit threshold (2 phút wall-clock) |
| `handleTogglePlay` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Relay TOGGLE_PLAY → active tab content-script (resolves active tab when tabId missing) — **ADR-009 D1** |
| `handleShortcutAction` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Relay SHORTCUT_ACTION (prev-cue/next-cue/replay-cue/toggle-overlay) → active tab content-script — **ADR-009 D4** |
| `handleRequestSubtitleCues` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Re-send cached cues per tab (race condition fix: panel opens after cues sent) — **ADR-008** |
| `handleVideoEpisodeChanged` | `background/index.ts` | MessageRequest → Promise<MessageResponse> | messageBus | Clear tab media on in-page episode switch (reuse clearTab + clearSessionMedia + lastCuesByTab.delete + autoDownloadedTabs.delete + updateBadgeForTab; downloads NOT cleared) — **ADR-010** |
| `initEpisodeChangeWatcher` | `content/content-script.ts` | () → void | content-script.ts (module-level) | MutationObserver persist observe `<video>` element replacement → send VIDEO_EPISODE_CHANGED when 2nd+ video appears (episode switch). Quality switch keeps same element → no clear. — **ADR-010** |
| `reportEpisodeChangedIfReplacement` | `content/content-script.ts` | () → void | initEpisodeChangeWatcher | Send VIDEO_EPISODE_CHANGED if `hasSeenFirstVideo` already true (replacement); else baseline first mount — **ADR-010** |
| `isVideoReady` | `content/content-script.ts` | (HTMLVideoElement) → boolean | findAndInitOverlay | Gate: true if `video.src` is `blob:` OR `readyState>=2`. Prevents init during Angular two-phase render (phase 1: src="" → foreign elements wiped; phase 2: blob: assigned → safe). — **ADR-012** |
| `findAndInitOverlay` | `content/content-script.ts` | () → void | content-script.ts (module-level) | Find ready `<video>` → initSubtitleOverlay. MutationObserver with `attributeFilter:['src']` catches phase-2 src assignment. Disconnects after init. — **ADR-012** |

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
