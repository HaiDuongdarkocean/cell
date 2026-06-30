# Spec: Refactor System Architecture — Worktree cho Orca Platform

> **Giai đoạn**: G1 Requirements/Spec (output spec-driven-development)
> **Status**: Draft — chờ anh review
> **Date**: 2026-06-30
> **Intent source**: `docs/intent/intent-refactor-system-architecture.md`
> **Research base**: 53 nguồn architecture/refactor (Phụ lục A intent) + 9 reading-summaries Orca platform
> **Related**: ADR-001→015 (existing), `docs/2-architechture-system.md` (current map), `docs/reference/software-org-roles.md` (Architect role #4)

## Objective

**Problem**: Cell hiện tại (~99 file source + 85 test) đang hình thành "Big Ball of Mud" — `content/` có **17 `subtitle*.ts`** phẳng, `lib/converters/` có **transmux cluster ~16 file** (8 `parallel*.ts` + segment/merger/validator/timer/...) phẳng. Mở folder thấy technical prefix, không thấy domain intent. Tìm file/function mất >3 bước. Sắp tới thêm **23 feature domain Orca platform** (17 nhóm UC / 130 UC) → nếu không refactor structure trước, flat folder sẽ nổ (>200 file phẳng). Refactor structure giờ rẻ hơn refactor sau khi đã thêm feature.

**Chosen approach** (confirmed Q2:A): refactor cấu trúc toàn bộ `src/` + `tests/` sang **Feature-Sliced Design + Screaming Architecture** worktree — `entrypoints/` + `features/` + `entities/` + `shared/` + `stores/` + `app/`. Domain-named folders. KHÔNG chỉ fix 2 cluster smell, mà thiết kế cho extensibility 23 feature domain Orca platform.

**User**: Anh — solo developer (architect + developer role), muốn worktree gọn gàng, dễ tra cứu file/function, dễ mở rộng khi thêm feature Orca (dict, vocab, flashcard, SRS, Anki, podcast, EPUB, AI, sync...), dễ maintain qua tháng/năm.

**Why now**: flat folder phẳng đang nổ, sắp thêm 23 feature domain → refactor structure trước khi thêm feature rẻ hơn refactor sau.

**Success**:
- Worktree "screams" domain intent — mở `src/features/` thấy ngay subtitle, transmux, download, detection, dict (future), vocab (future), flashcard (future), srs (future)...
- Mỗi feature domain có chỗ sẵn (folder + barrel + port) — thêm feature Orca mới = tạo folder mới, không nhét file phẳng vào folder chung.
- Behavior preservation — refactor structure, KHÔNG đổi behavior. `npm run test:unit` + `npx tsc --noEmit` + `npm run build` pass xuyên suốt.
- Dependency rule enforce — `features/` không import feature khác qua internal path (chỉ qua public `index.ts`). `chrome.*` APIs wrap trong `shared/lib/chrome-apis/` adapters.
- Navigability — dev (hoặc agent) tìm file/function trong ≤3 bước (mở `features/<domain>/` → thấy module theo concern).
- Update `docs/2-architechture-system.md` phản ánh new structure sau mỗi milestone.

## Assumptions (surface trước khi spec nội dung)

1. **Refactor = preserve behavior**. KHÔNG thêm feature, KHÔNG đổi logic, KHÔNG đổi UI. Chỉ move file + update import path + tạo barrel + wrap chrome.* APIs (khi cần cho testability). Nếu 1 module có root-cause bug → fix riêng commit khác, không trộn vào refactor.
2. **Target structure = FSD + Screaming Architecture** (anh confirm Q2:A). 6 layer: `entrypoints/` + `features/` + `entities/` + `shared/` + `stores/` + `app/`. Domain-named folders. FSD import rule: `entrypoints → features → entities → shared`, features không import feature khác qua internal path.
3. **Phạm vi = toàn bộ `src/` + `tests/`** (anh confirm Q1:C). Refactor cả source và test cho đồng bộ cấu trúc. Tests mirror feature folder: `tests/unit/features/subtitle/` ↔ `src/features/subtitle/`.
4. **Cadence = commit nhỏ mỗi cluster** (anh confirm Q3:A). Mỗi feature cluster (subtitle, transmux, download, detection...) = 1 commit. Test pass sau mỗi commit. Dễ rollback, dễ review.
5. **MV3 entrypoint convention**: giữ `@crxjs/vite-plugin` (không migrate WXT — ponytail rung 5: installed dep đã hoạt động, không đổi build framework trong refactor). Manifest entry path update nếu cần (verify build sau mỗi milestone).
6. **No new dependencies** (ponytail rung 5). Dùng stdlib + installed deps (React, Zustand, Vite, crxjs, mux.js, Jest, Playwright). KHÔNG thêm FSD framework, KHÔNG thêm dependency-cruiser (lint manual + tsc enforce trước).
7. **Chrome.* API wrapping**: wrap vào `shared/lib/chrome-apis/` adapters CHO testability + future Orca (OAuth, Drive, AnkiConnect, Forvo, TTS). Nhưng KHÔNG wrap tất cả ngay — wrap theo incremental need khi refactor chạm file nào dùng chrome.* trực tiếp. Tránh over-engineer (Metz P8: duplication > wrong abstraction).
8. **Zustand store refactor**: popup store + sidepanel store hiện tại → slice pattern (pmndrs guide). Mỗi feature domain có slice riêng. Persist middleware sync chrome.storage. Nhưng KHÔNG tách store nếu hiện tại đã work — chỉ tách khi refactor chạm store.
9. **`docs/2-architechture-system.md` update sau mỗi milestone** — không phải 1 lần cuối. Mỗi cluster commit = update architecture map trong cùng commit (rule AGENTS.md).
10. **Future Orca features = placeholder folders KHÔNG tạo trước** (YAGNI — ponytail rung 1). Chỉ thiết kế structure sao cho khi thêm feature Orca, pattern rõ (tạo `features/<domain>/` theo template). KHÔNG tạo `features/dict/` rỗng trước khi implement dict.

→ Correct me now or I'll proceed with these.

## Tech Stack

- **Runtime**: Chrome Extension MV3 (service worker, content script, offscreen, popup, sidepanel)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin (giữ nguyên, không đổi build framework)
- **Transmuxing**: mux.js 6 (TS → fMP4)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell) — no bash heredoc, use temp file + `git commit -F`
- **No new dependency** — ponytail rung 5.

## Commands

```
Build:            npm run build
Typecheck:        npm run typecheck
Test unit only:   npm run test:unit         # ~3s, alias test:fast
Test integration: npm run test:integration
Test watch:       npm run test:watch
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` deprecated in jest 30; dùng `--testPathPatterns=`.

## Scope — Orca Platform Feature Domains (23 feature domains across 17 UC groups)

> **Lưu ý**: đây là **target feature domain map** cho worktree — **23 feature domains** mapped across **17 UC groups** (130 UC). Cell hiện tại implement subset (UC04 video download + subtitle overlay). Orca tương lai implement toàn bộ. Worktree phải có chỗ cho tất cả, KHÔNG tạo folder rỗng trước (YAGNI) — chỉ thiết kế pattern.

| # | Feature domain | UC group | Cell hiện tại | Orca tương lai | Folder target |
|---|---|---|---|---|---|
| 1 | **subtitle** | UC04.1-04.6, 04.8-04.9 | ✅ ~20 file content/subtitle*.ts | + Whisper STT, auto-translate, learning mode | `features/subtitle/` |
| 2 | **transmux** | (infra UC04) | ✅ ~15 file lib/converters/parallel*.ts | giữ | `features/transmux/` |
| 3 | **download** | UC04.10-04.17 | ✅ background/downloader, queue, auto-download | + bulk create, export | `features/download/` |
| 4 | **detection** | UC04.1-04.2 | ✅ lib/detectors/ (video, subtitle, language, script) | + site adapters (YouTube/Netflix/iQIYI) | `features/detection/` |
| 5 | **whitelist** | UC16.10 | ✅ lib/utils/whitelist.ts | + blacklist merge | `features/whitelist/` |
| 6 | **dict** | UC02 | ❌ | import Yomitan/Migaku/SQLite, FTS5 lookup, multi-dict | `features/dict/` (future) |
| 7 | **reading** | UC03 | ❌ | tokenize, highlight, page difficulty, i+1, word popup | `features/reading/` (future) |
| 8 | **video-learning** | UC04.10-04.13 | ❌ | learning mode, auto-pause, loop, transcript filter | `features/video-learning/` (future) |
| 9 | **podcast** | UC05 | ❌ | Whisper STT, transcript, library | `features/podcast/` (future) |
| 10 | **epub-pdf** | UC06 | ❌ | PDF.js, EPUB parse, per-book vocab | `features/epub-pdf/` (future) |
| 11 | **clipboard** | UC07 | ❌ | session, TTS, auto-detect | `features/clipboard/` (future) |
| 12 | **vocabulary** | UC08 | ❌ | 5 status, bulk, import, history, auto-update | `features/vocabulary/` (future) |
| 13 | **flashcard** | UC09-10 | ❌ | Card Creator, auto-fill, bulk, manager | `features/flashcard/` (future) |
| 14 | **deck** | UC11 | ❌ | tree, sub-deck, merge, split, reset | `features/deck/` (future) |
| 15 | **srs** | UC12 | ❌ | FSRS, Ocean Memory, review session, streak | `features/srs/` (future) |
| 16 | **anki** | UC13 | ❌ | AnkiConnect, 2-way sync, field mapping | `features/anki/` (future) |
| 17 | **bookmark** | UC14 | ❌ | multi-source, email, flashcard from bookmark | `features/bookmark/` (future) |
| 18 | **sync** | UC15 | ❌ | Google Drive, per-record merge, sync log | `features/sync/` (future) |
| 19 | **settings** | UC16 | ✅ partial (popup settings) | 12 categories, per-profile, i18n | `features/settings/` |
| 20 | **statistics** | UC17 | ❌ | heatmap, growth, retention, CEFR, forecast | `features/statistics/` (future) |
| 21 | **ai** | UC04.7, UC16.7-8 | ❌ | WebLLM, Ollama, Gemini, prompts | `features/ai/` (future) |
| 22 | **auth** | UC01 | ❌ | Google OAuth, tier, language profile | `features/auth/` (future) |
| 23 | **tts** | UC07.4, UC16.6 | ❌ | Web Speech, Edge TTS, Google Cloud TTS | `features/tts/` (future) |

**Cross-cutting** (shared, không phải feature):
- `shared/lib/chrome-apis/` — adapters cho chrome.runtime, chrome.storage, chrome.tabs, chrome.identity, chrome.downloads, chrome.webRequest, chrome.offscreen, chrome.tts, chrome.notifications
- `shared/lib/messaging/` — MessageBus, message-types (sender-based routing cho Orca multi-context)
- `shared/lib/parsers/` — m3u8, ass, vtt, srt, assToSrt, vttToSrt, srtNormalizer (subtitle format parsers, reuse)
- `shared/utils/` — file, time, url (pure)
- `shared/config/` — constants, urls, feature-flags
- `entities/` — domain models: subtitle, video, settings, (future: word, card, deck, bookmark, podcast, book)

## Target Structure

```
src/
├── entrypoints/                    # MV3 surfaces (CRXJS manifest entry)
│   ├── background/
│   │   ├── index.ts                # SW entry — orchestrator init
│   │   └── handlers/               # Message handlers per feature
│   │       ├── download.ts         # DOWNLOAD_VIDEO, CANCEL, PAUSE, RESUME...
│   │       ├── subtitle.ts         # SUBTITLE_CUES, VIDEO_TIME_UPDATE...
│   │       ├── media-detection.ts  # GET_DETECTED_MEDIA, PAGE_SCAN_RESULT
│   │       └── offscreen.ts        # CONVERT_TS_TO_MP4_V2, CREATE_OPFS_BLOB_URL
│   ├── content/
│   │   ├── index.ts                # Content script entry (ISOLATED world, document_idle) — scan + wire (← content-script.ts)
│   │   ├── fetchInterceptor.iife.ts # MAIN world content script (document_start) — intercept fetch/XHR (manifest content_scripts[1])
│   │   ├── themeTokens.ts          # Theme token injection (used by fetchInterceptor)
│   │   └── video/                  # Video-page content modules
│   │       └── overlay-wiring.ts   # Wire subtitle overlay + panel + shortcuts (← pageScanner.ts)
│   ├── offscreen/
│   │   ├── index.html              # Offscreen HTML entry
│   │   ├── runner.ts               # Entry: nhận CONVERT_TS_TO_MP4_V2
│   │   └── transmux-worker.ts      # Web Worker: mux.js transmux
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx                # Entry → render App
│   │   ├── App.tsx                 # UI chính
│   │   ├── App.module.css
│   │   ├── store/                  # Popup Zustand (slice pattern)
│   │   │   └── popupStore.ts
│   │   ├── styles/
│   │   │   ├── global.css
│   │   │   └── theme.css
│   │   ├── utils/
│   │   │   ├── format.ts
│   │   │   └── getActiveContentTab.ts
│   │   ├── hooks/
│   │   │   ├── useDetectedMedia.ts
│   │   │   ├── useDownloadProgress.ts
│   │   │   ├── useExtensionStatus.ts
│   │   │   ├── useMediaDisplayTitle.ts
│   │   │   └── useSubtitleLanguage.ts
│   │   └── components/
│   │       ├── layout/             # Header, footer
│   │       ├── media/              # VideoCard, SubtitleCard, DownloadCard, MediaEmpty
│   │       ├── SelectionBar.tsx
│   │       └── settings/           # SettingsDialog, MultiSelect
│   └── sidepanel/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── store/
│       │   └── sidePanelStore.ts
│       └── components/
│           └── CueList.tsx
│
├── features/                       # Business features (Screaming Architecture)
│   ├── subtitle/                   # ← group 17 subtitle*.ts (UC04.1-04.9)
│   │   ├── ui/                     # overlay, drag handle, selector, panel toggle, import button, track dropdown, panel, toast
│   │   │   ├── overlayLayer.ts     # createOverlayLayer, applyStyle, buildTextShadow, hexToRgba (← subtitleUI.ts)
│   │   │   ├── dragPosition.ts     # calcYOffsetPercent, createDragHandle (← subtitleDragPosition.ts)
│   │   │   ├── selector.ts         # createSubtitleDropdown (← subtitleSelector.ts)
│   │   │   ├── panelToggle.ts      # createToggleButton (← subtitlePanel.ts)
│   │   │   ├── importButton.ts     # createImportButton, handleFileSelect (← subtitleImport.ts)
│   │   │   ├── trackDropdown.ts    # createTrackDropdown, updateTrackOptions (← subtitleTrackDropdown.ts)
│   │   │   ├── dragHint.ts         # createDragHint
│   │   │   ├── managerPanel.ts     # SubtitleManagerPanel (← subtitleManagerPanel.ts)
│   │   │   └── toast.ts            # toast notification (← subtitleToast.ts)
│   │   ├── logic/                  # pure logic (testable, no DOM)
│   │   │   ├── sync.ts             # findCurrentLine (binary search) (← subtitleSync.ts)
│   │   │   ├── merge.ts            # mergeCuesForPanel (← subtitleMerge.ts)
│   │   │   ├── bilingualParser.ts # parseBilingualSrt (← subtitleBilingualParser.ts)
│   │   │   ├── naming.ts           # filename helpers (← subtitleNaming.ts)
│   │   │   └── parserAdapter.ts    # parseSubtitle (reuse shared/lib/parsers) (← subtitleParser.ts)
│   │   ├── service/                # side-effect orchestration
│   │   │   ├── overlay.ts          # SubtitleOverlayController (← subtitleOverlay.ts)
│   │   │   ├── autoLoad.ts         # shouldAutoLoad, fetchAndParseSubtitle, handleAutoLoadSubtitles (← subtitleAutoLoad.ts)
│   │   │   ├── dragDrop.ts         # readFileAsText, handleFileDrop (← subtitleDragDrop.ts)
│   │   │   └── shortcuts.ts        # handleShortcutKey (← subtitleShortcuts.ts)
│   │   ├── ports/                  # interfaces cho external deps (future Orca)
│   │   │   ├── ISubtitleStorage.ts # port cho chrome.storage / future SQLite
│   │   │   └── ISubtitleOverlay.ts # port cho overlay DOM manipulation
│   │   ├── types.ts                # SubtitleFormat, OverlayConfig, ParseResult, SyncStatus, BilingualCue
│   │   └── index.ts                # Public API (barrel) — export chỉ public
│   ├── transmux/                   # ← group 15 parallel*.ts (infra UC04)
│   │   ├── planning/               # pure planning
│   │   │   ├── planner.ts          # parallelPlanner
│   │   │   ├── grouping.ts         # segmentGrouping
│   │   │   └── policy.ts           # parallelPolicy
│   │   ├── execution/              # side-effect orchestration
│   │   │   ├── coordinator.ts      # parallelCoordinator
│   │   │   ├── progress.ts         # parallelProgress
│   │   │   ├── cancellation.ts     # parallelCancellation
│   │   │   ├── fallback.ts         # parallelFallback
│   │   │   ├── safetyAnalyzer.ts   # parallelSafetyAnalyzer
│   │   │   ├── autoEnablement.ts   # autoEnablement
│   │   │   └── benchmarkHarness.ts # benchmarkHarness
│   │   ├── merging/                # fMP4 merge + validate
│   │   │   ├── merger.ts           # segmentMerger, mergePartFiles
│   │   │   ├── validator.ts        # mp4Validator
│   │   │   ├── timer.ts            # conversionTimer
│   │   │   └── transmuxer.ts       # tsTransmuxer (sequential)
│   │   ├── ports/
│   │   │   ├── ITransmuxWorker.ts  # port cho Web Worker
│   │   │   └── IOPFSStorage.ts     # port cho OPFS
│   │   ├── types.ts
│   │   └── index.ts
│   ├── download/                   # ← background/downloader, queue, auto-download (UC04.10-17)
│   │   ├── logic/                  # pure
│   │   │   └── selectBestMedia.ts  # (move từ lib/selectors/)
│   │   ├── service/                # side-effect
│   │   │   ├── downloader.ts       # Download logic
│   │   │   ├── queue.ts            # DownloadQueue
│   │   │   ├── autoDownload.ts     # tryAutoDownload
│   │   │   └── networkInterceptor.ts # webRequest listener
│   │   ├── ports/
│   │   │   ├── IChromeDownloads.ts # port cho chrome.downloads
│   │   │   └── IOPFS.ts            # port cho OPFS
│   │   ├── types.ts
│   │   └── index.ts
│   ├── detection/                  # ← lib/detectors/ (UC04.1-04.2)
│   │   ├── logic/                  # pure
│   │   │   ├── videoDetector.ts
│   │   │   ├── subtitleDetector.ts
│   │   │   ├── scriptDetector.ts
│   │   │   └── languageDetector.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── whitelist/                  # ← lib/utils/whitelist.ts (UC16.10)
│   │   ├── logic/
│   │   │   └── whitelist.ts        # normalizeUrl, isWhitelisted
│   │   ├── service/
│   │   │   └── whitelistStore.ts   # chrome.storage CRUD
│   │   ├── ports/
│   │   │   └── IChromeStorage.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── settings/                   # ← popup settings (UC16 partial)
│       ├── ui/                     # SettingsDialog, MultiSelect, CustomSelect
│       ├── logic/                  # settings validation, migration
│       ├── service/                # settings persistence
│       ├── ports/
│       │   └── ISettingsStorage.ts
│       ├── types.ts
│       └── index.ts
│   # FUTURE Orca features (KHÔNG tạo folder rỗng — tạo khi implement):
│   # dict/, reading/, video-learning/, podcast/, epub-pdf/, clipboard/,
│   # vocabulary/, flashcard/, deck/, srs/, anki/, bookmark/, sync/,
│   # statistics/, ai/, auth/, tts/
│
├── entities/                       # Domain models (FSD Entities layer)
│   ├── subtitle/                   # SubtitleFormat, Cue, ParseResult, BilingualCue
│   │   ├── subtitle.types.ts
│   │   └── index.ts
│   ├── video/                      # DetectedVideo, ByteRange, HlsEncryption, HlsInitSegment, AutoSelectResult
│   │   ├── video.types.ts
│   │   └── index.ts
│   ├── settings/                   # Settings, FilenameSource, WhitelistEntry
│   │   ├── settings.types.ts
│   │   └── index.ts
│   ├── message/                    # MessageRequest, MessageResponse, payloads
│   │   ├── message.types.ts
│   │   └── index.ts
│   └── media/                      # DetectedSubtitle, DownloadItem
│       ├── media.types.ts
│       └── index.ts
│   # FUTURE: word/, card/, deck/, bookmark/, podcast/, book/, user/, languageProfile/
│
├── shared/                         # Cross-cutting (FSD Shared layer)
│   ├── lib/
│   │   ├── chrome-apis/            # Adapters cho chrome.* (Ports & Adapters)
│   │   │   ├── runtime.ts          # chrome.runtime.sendMessage wrapper
│   │   │   ├── storage.ts          # chrome.storage.local/session wrapper
│   │   │   ├── tabs.ts             # chrome.tabs.query, onActivated, onUpdated
│   │   │   ├── downloads.ts        # chrome.downloads.download, onDeterminingFilename
│   │   │   ├── webRequest.ts       # chrome.webRequest.onBeforeRequest
│   │   │   ├── offscreen.ts        # chrome.offscreen.createDocument
│   │   │   ├── identity.ts         # chrome.identity.launchWebAuthFlow (future OAuth)
│   │   │   ├── tts.ts              # chrome.tts.speak (future)
│   │   │   ├── notifications.ts    # chrome.notifications.create (future)
│   │   │   └── index.ts
│   │   ├── messaging/              # MessageBus + message-types
│   │   │   ├── messageBus.ts       # on() / broadcast() / send()
│   │   │   ├── messageTypes.ts     # MESSAGE_TYPES constants
│   │   │   └── index.ts
│   │   ├── parsers/                # Subtitle format parsers (reuse)
│   │   │   ├── m3u8Parser.ts
│   │   │   ├── assParser.ts
│   │   │   ├── vttParser.ts
│   │   │   ├── srtParser.ts
│   │   │   ├── assToSrt.ts
│   │   │   ├── vttToSrt.ts
│   │   │   ├── srtNormalizer.ts
│   │   │   └── index.ts
│   │   ├── storage/                # OPFS storage adapter
│   │   │   ├── opfsStorage.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── utils/                      # Pure utilities
│   │   ├── fileUtils.ts            # sanitize, beautify, resolve, generate
│   │   ├── timeUtils.ts
│   │   ├── urlUtils.ts
│   │   └── index.ts
│   ├── config/                     # Constants + feature flags
│   │   ├── config.ts               # DEFAULT_SETTINGS, GENERIC_TITLES, STORAGE_KEYS, limits
│   │   ├── urls.ts                 # VIDEO_URL_PATTERNS, SUBTITLE_URL_PATTERNS
│   │   ├── featureFlags.ts         # future Orca feature toggles
│   │   └── index.ts
│   └── index.ts
│
├── app/                            # App wiring (FSD App layer)
│   ├── providers/
│   │   └── StoreProvider.tsx       # (future — khi tách store)
│   ├── styles/
│   │   └── global.css
│   └── index.ts
│
└── types/                          # Global type declarations
    ├── chrome.d.ts                 # chrome.* type augmentations
    ├── muxjs.d.ts                  # mux.js type declarations
    └── global.d.ts
```

### Tests mirror structure

```
tests/
├── setup.ts
├── styleMock.ts
├── workerMock.ts
├── types.d.ts
├── browser/                        # Browser test assets (giữ nguyên)
├── data-test/                      # Data-driven test files (giữ nguyên)
├── fixtures/                       # Shared fixtures (giữ nguyên)
├── unit/
│   ├── features/                   # ← mirror src/features/
│   │   ├── subtitle/
│   │   │   ├── ui/
│   │   │   ├── logic/
│   │   │   └── service/
│   │   ├── transmux/
│   │   │   ├── planning/
│   │   │   ├── execution/
│   │   │   └── merging/
│   │   ├── download/
│   │   ├── detection/
│   │   ├── whitelist/
│   │   └── settings/
│   ├── entrypoints/                # ← mirror src/entrypoints/
│   │   ├── background/
│   │   ├── content/
│   │   ├── offscreen/
│   │   ├── popup/
│   │   └── sidepanel/
│   ├── entities/                   # ← mirror src/entities/
│   ├── shared/                     # ← mirror src/shared/
│   │   ├── lib/
│   │   │   ├── chrome-apis/
│   │   │   ├── messaging/
│   │   │   ├── parsers/
│   │   │   └── storage/
│   │   ├── utils/
│   │   └── config/
│   └── components/                 # React component tests (giữ nếu có)
│       └── hooks.test.tsx
└── integration/                    # Integration tests (giữ nguyên — network)
    ├── setup/
    ├── compare.integration.test.ts
    ├── parallel.integration.test.ts
    └── sequential.integration.test.ts
```

## Dependency Rules (FSD Import Rule)

```
entrypoints → features → entities → shared
features → entities, shared (KHÔNG → entrypoints, KHÔNG → features khác qua internal path)
entities → shared (KHÔNG → features, KHÔNG → entrypoints)
shared → shared (chỉ internal, KHÔNG → features/entities/entrypoints)
app → tất cả (wiring)
```

**Enforce**:
- `npx tsc --noEmit` catch type error nhưng KHÔNG catch circular/layer violation → manual review + ESLint rule (future ADR).
- Barrel `index.ts` per feature = public API. Feature A import feature B chỉ qua `features/B/index.ts`, KHÔNG qua `features/B/ui/overlayLayer.ts` trực tiếp.
- `chrome.*` calls chỉ出现在 `shared/lib/chrome-apis/` + `entrypoints/` (SW init). Features/entities dùng port interface.

## Project Structure (files touched — high-level, chi tiết ở G2 Plan)

**Move (refactor structure, preserve content)**:
- `src/content/subtitle*.ts` (20 file) → `src/features/subtitle/{ui,logic,service}/`
- `src/lib/converters/parallel*.ts` + `segment*.ts` + `mp4Validator.ts` + `conversionTimer.ts` + `autoEnablement.ts` + `benchmarkHarness.ts` + `workerFactory.ts` + `tsTransmuxer.ts` (15 file) → `src/features/transmux/{planning,execution,merging}/`
- `src/background/{downloader,downloadQueue,autoDownload,networkInterceptor}.ts` → `src/features/download/service/`
- `src/background/{index,messageBus,offscreenManager}.ts` → `src/entrypoints/background/`
- `src/background/subtitleService.ts` → `src/features/subtitle/service/`
- `src/lib/detectors/` → `src/features/detection/logic/`
- `src/lib/selectors/selectBestMedia.ts` → `src/features/download/logic/`
- `src/lib/utils/whitelist.ts` → `src/features/whitelist/`
- `src/lib/parsers/` → `src/shared/lib/parsers/`
- `src/lib/storage/opfsStorage.ts` → `src/shared/lib/storage/`
- `src/lib/utils/{fileUtils,timeUtils,urlUtils}.ts` → `src/shared/utils/`
- `src/constants/` → `src/shared/config/`
- `src/types/` → `src/entities/{subtitle,video,settings,message,media}/`
- `src/popup/` → `src/entrypoints/popup/`
- `src/sidepanel/` → `src/entrypoints/sidepanel/`
- `src/offscreen/` → `src/entrypoints/offscreen/`
- `src/content/{content-script,pageScanner}.ts` → `src/entrypoints/content/`
- `tests/unit/` → mirror new structure

**Wrap (chrome.* → adapter, incremental)**:
- `chrome.runtime.sendMessage` → `shared/lib/chrome-apis/runtime.ts`
- `chrome.storage.local/session` → `shared/lib/chrome-apis/storage.ts`
- `chrome.tabs.query/onActivated/onUpdated` → `shared/lib/chrome-apis/tabs.ts`
- `chrome.downloads.download` → `shared/lib/chrome-apis/downloads.ts`
- `chrome.webRequest.onBeforeRequest` → `shared/lib/chrome-apis/webRequest.ts`
- `chrome.offscreen.createDocument` → `shared/lib/chrome-apis/offscreen.ts`
- Wrap khi refactor chạm file nào dùng trực tiếp — KHÔNG wrap tất cả trước (incremental, Metz P8).

**Create (new)**:
- `src/features/*/index.ts` barrel (public API per feature)
- `src/features/*/ports/*.ts` port interface (khi cần testability)
- `src/shared/lib/chrome-apis/index.ts` barrel
- `src/app/` wiring (minimal — chỉ khi cần)

**NOT touched** (intentionally):
- `manifest.json` content — giữ nguyên trừ entry path update ở M9 (service_worker, content_scripts[0/1].js, action.default_popup, side_panel.default_path). Verify build + browser sau mỗi M9 sub-commit.
- `vite.config.ts` — giữ nguyên trừ `rollupOptions.input.{offscreen,sidepanel}` path update ở M9.3 + M9.5.
- `package.json` — KHÔNG thêm dep.
- Behavior logic bên trong file — KHÔNG đổi khi move.

## Code Style

Functional components + hooks, named exports (no default), colocate tests (`overlayLayer.ts` → `overlayLayer.test.ts`), pure functions for logic (testable, no side effects), TypeScript strict (no `any` without justification). Ponytail: shortest working diff, no unrequested abstractions, mark simplifications with `ponytail:` comment.

**Barrel pattern** (public API per feature):
```typescript
// src/features/subtitle/index.ts
export * from './ui/overlayLayer';
export * from './ui/dragPosition';
export * from './logic/sync';
export * from './logic/merge';
export * from './service/overlay';
// KHÔNG export internal helpers (private)
```

**Port pattern** (testability + future Orca):
```typescript
// src/features/subtitle/ports/ISubtitleStorage.ts
export interface ISubtitleStorage {
  getOverlayConfig(): Promise<OverlayConfig>;
  setOverlayConfig(config: OverlayConfig): Promise<void>;
}
// Adapter ở shared/lib/chrome-apis/storage.ts implement interface này
```

## Testing Strategy

- **Characterization tests FIRST** (Feathers P1): trước khi move cluster nào, verify test hiện tại cover behavior cluster đó. Nếu thiếu → viết characterization test pin behavior hiện tại (test "code ACTUALLY does", không "should do"). Chạy `npm run test:unit` trước + sau mỗi move.
- **Unit** (`tests/unit/`): Jest 30 + jsdom. Mirror feature folder. Move test cùng lúc move source (colocate). Test pass sau mỗi cluster commit.
- **Integration** (`tests/integration/`): giữ nguyên (network, real m3u8). Path import update theo new structure.
- **Typecheck**: `npx tsc --noEmit` → exit 0 sau mỗi commit.
- **Build**: `npm run build` → success sau mỗi milestone (verify crxjs manifest path resolve).
- **Browser verify** (rule stop-the-line AGENTS.md): sau milestone chạm content-script/popup/sidepanel runtime → Edge DevTools MCP verify extension load + basic flow (detect media, download, subtitle overlay). KHÔNG commit milestone đó nếu browser check fail.
- **E2E** (Playwright): chạy cuối G4 (full regression) trước G5.

## Boundaries

- **Always**: Run `npm run test:unit` + `npx tsc --noEmit` before commit. Build verify sau mỗi milestone. Browser verify (MCP) cho content-script/popup/sidepanel change. Update `docs/2-architechture-system.md` trong cùng commit với structure change.
- **Ask first**: Đổi `manifest.json` entry path. Đổi `vite.config.ts` input. Đổi `createDragHandle` signature (callers affected). Wrap chrome.* API mới (scope creep risk).
- **Never**: Commit secrets. Thêm dependency. Đổi behavior logic khi move (refactor = preserve behavior). Đổi build framework (WXT migration — outside scope). Tạo future Orca feature folder rỗng (YAGNI). Force abstraction khi chưa thấy pattern rõ (Metz P8).

## Success Criteria

### Functional (behavior preservation)
1. **F1. Unit tests pass**: `npm run test:unit` → all pass (sau mỗi cluster commit + cuối G4).
2. **F2. Integration tests pass**: `npm run test:integration` → all pass (cuối G4).
3. **F3. Typecheck pass**: `npx tsc --noEmit` → exit 0 (sau mỗi commit).
4. **F4. Build pass**: `npm run build` → success, extension load trong Chrome (cuối mỗi milestone + cuối G4).
5. **F5. Browser verify**: Edge DevTools MCP — extension install, detect media trên video page, download 1 video, subtitle overlay hiển thị + drag hoạt động (sau milestone content/popup).
6. **F6. No behavior change**: git diff chỉ chứa move + import update + barrel + port (khi cần). KHÔNG có logic diff. Review bằng `git diff --stat` per commit.

### Non-functional (structure quality)
7. **NF1. Screaming Architecture**: mở `src/features/` thấy domain folders (subtitle, transmux, download, detection, whitelist, settings) — không thấy technical prefix (`subtitle*.ts` phẳng).
8. **NF2. Navigability**: tìm file/function trong ≤3 bước (mở `features/<domain>/` → thấy module theo concern ui/logic/service/ports).
9. **NF3. Dependency rule**: `features/` không import feature khác qua internal path (chỉ qua `index.ts`). `chrome.*` chỉ trong `shared/lib/chrome-apis/` + `entrypoints/`. Verify bằng grep + tsc.
10. **NF4. Colocation**: test colocate với source (`features/subtitle/ui/overlayLayer.ts` ↔ `tests/unit/features/subtitle/ui/overlayLayer.test.ts`).
11. **NF5. Extensibility**: thêm feature Orca mới = tạo `features/<domain>/` theo template (ui/logic/service/ports/types/index.ts) — pattern rõ, không nhét file phẳng.
12. **NF6. Architecture map updated**: `docs/2-architechture-system.md` phản ánh new structure sau mỗi milestone commit.

### Process
13. **P1. Commit per cluster**: mỗi feature cluster = 1 commit (`refactor: move subtitle cluster to features/subtitle/`). Test pass sau mỗi commit.
14. **P2. No new deps**: `package.json` diff = 0 (trừ khi anh approve).
15. **P3. ADR chain**: ADR-016 (folder structure decision) + ADR con nếu cần (port pattern, chrome-apis adapter) ở G3 trước G4.

## Open Questions (resolved at spec review — anh confirm 2026-06-30)

1. **Chrome.* wrapping scope**: wrap tất cả chrome.* calls trong adapter ngay G4, hay incremental (wrap khi chạm file)? **RESOLVED — incremental** (Metz P8: tránh over-engineer, wrap khi cần testability). Gate M11 only, không block M1-M10.
2. **Zustand store tách slice**: popup store hiện tại 1 file monolithic → tách slice per feature ngay G4, hay giữ nguyên + tách khi thêm Orca feature? **RESOLVED — giữ nguyên + tách khi Orca feature cần** (YAGNI).
3. **`app/` layer scope**: tạo `app/` ngay G4 (cho providers/styles wiring), hay skip + tạo khi cần (future Orca OAuth provider)? **RESOLVED — skip G4, tạo khi cần** (YAGNI).
4. **ESLint layer-rule enforcement**: thêm eslint-plugin-boundaries (or similar) để enforce FSD import rule ngay G4, hay manual review + tsc? **RESOLVED — manual + tsc G4, thêm lint rule ở ADR riêng sau** (tránh new dep + scope creep).
5. **`entities/` vs `features/*/types.ts`**: domain types (Subtitle, Video, Settings) đặt ở `entities/` (FSD) hay `features/*/types.ts` (Bulletproof React)? **RESOLVED — `entities/` cho shared domain models, `features/*/types.ts` cho feature-specific types** (FSD hybrid).
6. **`fetchInterceptor.iife.ts` target** (CRITICAL from spec review): move đi đâu? **RESOLVED — `src/entrypoints/content/fetchInterceptor.iife.ts`**, manifest `content_scripts[1].js` update trong M9.2.
7. **3 stray converter files** (HIGH from spec review): `assToSrt/vttToSrt/srtNormalizer` move khi nào? **RESOLVED — move ở M2** (→ `shared/lib/parsers/`).
8. **Coverage baseline** (HIGH from spec review): thêm Milestone 0 pre-flight? **RESOLVED — yes**, M0 chạy `npm run test:coverage` + characterization gap close trước M6/M7.

## Edge Cases

1. **CRXJS manifest entry path**: `public/manifest.json` reference `src/background/index.ts`, `src/content/content-script.ts`, `src/content/fetchInterceptor.iife.ts` (MAIN world), `src/sidepanel/index.html`, `src/popup/index.html`. Sau move → path đổi → build break. **Mitigation**: M9 tách 5 sub-commit, mỗi sub-commit = 1 entrypoint group + manifest path update trong cùng commit. Verify `npm run build` + browser load sau mỗi sub-commit.
2. **Vite config input**: `vite.config.ts` `rollupOptions.input` reference `src/offscreen/ffmpeg.html` AND `src/sidepanel/index.html`. Sau move → update cả 2 path. **Mitigation**: update trong M9.3 (offscreen) + M9.5 (sidepanel).
3. **Import path hàng loạt**: move 1 file → N file import nó phải update. **Mitigation**: Parallel Change — tạo new path + barrel trước, update import từng file, test sau mỗi file, xóa old path cuối. Hoặc dùng IDE rename (PowerShell không có, manual edit).
4. **Circular dependency**: feature A import feature B, feature B import feature A (risky khi tách). **Mitigation**: tsc catch circular type error. Nếu runtime circular → extract shared vào `entities/` hoặc `shared/`.
5. **Test path mismatch**: move source nhưng quên move test → test fail (import path cũ). **Mitigation**: move test cùng lúc source, colocate rule.
6. **Behavior drift**: move file + vô tình sửa logic (typo, formatting). **Mitigation**: `git diff` review per commit — chỉ move + import update, KHÔNG logic diff. Characterization test catch.
7. **Chrome.* wrap introduce bug**: wrap chrome.tabs.query trong adapter nhưng adapter có bug. **Mitigation**: characterization test pin behavior trước wrap. Adapter test với mock chrome.* (jsdom).
8. **Future Orca feature folder tạo sớm**: YAGNI violation — tạo `features/dict/` rỗng trước khi implement dict. **Mitigation**: KHÔNG tạo folder rỗng. Pattern rõ trong spec + ADR → khi implement dict, tạo folder theo pattern.
9. **Big refactor fatigue**: 23 cluster move → fatigue → skip test. **Mitigation**: commit nhỏ mỗi cluster, test pass mỗi commit, nghỉ giữa milestone. Ponytail: shortest working diff per commit.
10. **MV3 SW restart session restore**: move background files có thể break session restore logic (chrome.storage.session key path). **Mitigation**: giữ session restore key stable (không đổi key khi move file). Integration test verify.

## Out of Scope

- **Behavior change** — refactor = preserve behavior. Bug fix riêng commit.
- **New dependencies** — ponytail rung 5. FSD framework, dependency-cruiser, eslint-plugin-boundaries: outside scope (ADR riêng sau).
- **Build framework migration** (CRXJS → WXT) — outside scope. CRXJS đang work.
- **Future Orca feature implementation** — dict, vocab, flashcard, SRS, Anki... KHÔNG implement trong refactor này. Chỉ thiết kế structure cho extensibility.
- **Chrome.* wrap tất cả** — wrap incremental khi chạm file, không wrap tất cả trước.
- **Zustand store tách slice** — giữ nguyên, tách khi Orca feature cần.
- **`app/` layer wiring** — skip G4, tạo khi cần (future OAuth provider).
- **ESLint layer-rule** — manual review + tsc G4, lint rule ADR riêng sau.
- **Performance optimization** — outside scope (refactor structure, không perf).
- **i18n / localization** — outside scope (future Orca UC16.4).
- **Mobile / Flutter** — outside scope (Orca Phase sau).

## Risks + Mitigation (từ intent + spec-specific)

| Risk | Mitigation |
|---|---|
| Move file break import path hàng loạt | Parallel Change: expand (new + barrel) → migrate (import update từng file, test sau mỗi) → contract (xóa old) |
| CRXJS manifest path break build | Update manifest entry path trong cùng commit move entrypoint. Verify `npm run build` sau mỗi entrypoint move. |
| Behavior thay đổi vô tình | Characterization tests pin behavior trước. `git diff` review per commit — chỉ move + import, KHÔNG logic diff. |
| Chrome.* wrap introduce bug | Characterization test pin behavior trước wrap. Adapter test với mock chrome.* |
| Over-engineer (premature abstraction) | Ponytail + Metz P8: tolerate duplicate, extract shared chỉ khi pattern rõ ≥3 lần. KHÔNG wrap chrome.* tất cả trước. KHÔNG tạo future folder rỗng. |
| Browser runtime bug không catch bằng unit test | Browser verify (Edge DevTools MCP) sau milestone content/popup/sidepanel — rule stop-the-line AGENTS.md. |
| Big refactor fatigue (23 cluster) | Commit nhỏ mỗi cluster, test pass mỗi commit, nghỉ giữa milestone. Ponytail: shortest working diff per commit. |
| Circular dependency sau tách feature | tsc catch circular type error. Extract shared vào `entities/` hoặc `shared/` nếu runtime circular. |
| Bus factor = 1 (solo refactor) | ADR ghi reasoning mỗi quyết định + update `2-architechture-system.md` sau mỗi milestone. |
| Future Orca feature folder tạo sớm (YAGNI) | KHÔNG tạo folder rỗng. Pattern rõ trong spec + ADR → tạo khi implement. |

## Migration Strategy (high-level — chi tiết G2 Plan)

> **Pattern**: Strangler Fig + Parallel Change (Expand-Contract). Incremental, behavior-preserving, test pass mỗi bước.

**Milestone 0 — Coverage baseline + characterization gap** (1 commit, pre-flight):
- Run `npm run test:coverage`, record per-cluster coverage cho `subtitle` (M7) + `transmux` (M6) + `download` (M8).
- List behaviors chưa cover (untested) → viết characterization test pin behavior hiện tại (test "code ACTUALLY does", không "should do") TRƯỚC khi move.
- **Exit gate**: characterization gap closed cho cluster sắp move. KHÔNG move cluster nếu coverage gap chưa close.
- Save coverage report vào `docs/test-reports/coverage-baseline-pre-refactor.md`.

**Milestone 1 — Scaffolding** (1 commit):
- Tạo `src/entrypoints/`, `src/features/`, `src/entities/`, `src/shared/`, `src/app/` folder rỗng + `.gitkeep`.
- Update `docs/2-architechture-system.md` note new target structure.
- Test pass (không có gì move).

**Milestone 2 — shared/ layer** (1-2 commit):
- Move `src/lib/parsers/` → `src/shared/lib/parsers/`.
- Move 3 stray converter files `src/lib/converters/{assToSrt,vttToSrt,srtNormalizer}.ts` → `src/shared/lib/parsers/` (target tree đã place ở đây, move khỏi converters).
- Move `src/lib/storage/` → `src/shared/lib/storage/`.
- Move `src/lib/utils/` → `src/shared/utils/`.
- Move `src/constants/` → `src/shared/config/`.
- Update imports. Test pass.

**Milestone 3 — entities/ layer** (1 commit):
- Move `src/types/` → `src/entities/{subtitle,video,settings,message,media}/`.
- Update imports. Test pass.

**Milestone 4 — detection/ feature** (1 commit):
- Move `src/lib/detectors/` → `src/features/detection/logic/`.
- Tạo `features/detection/index.ts` barrel.
- Update imports. Test pass.

**Milestone 5 — whitelist/ feature** (1 commit):
- Move `src/lib/utils/whitelist.ts` → `src/features/whitelist/`.
- Tạo barrel. Update imports. Test pass.

**Milestone 6 — transmux/ feature** (1 commit):
- Move ~16 file transmux cluster: `src/lib/converters/{parallel*,segment*,mp4Validator,conversionTimer,autoEnablement,benchmarkHarness,workerFactory,tsTransmuxer}.ts` → `src/features/transmux/{planning,execution,merging}/`. (8 `parallel*.ts` + 8 file kia = ~16; assToSrt/vttToSrt/srtNormalizer đã move ở M2.)
- Tạo barrel. Update imports. Test pass + integration test (parallel/sequential).

**Milestone 7 — subtitle/ feature** (1 commit — largest):
- Move 17 `src/content/subtitle*.ts` → `src/features/subtitle/{ui,logic,service}/` (mapping đầy đủ trong Target Structure).
- Tạo barrel. Update imports. Test pass + browser verify (overlay + drag).

**Milestone 8 — download/ feature** (1 commit):
- Move `src/background/{downloader,downloadQueue,autoDownload,networkInterceptor}.ts` → `src/features/download/service/`.
- Move `src/lib/selectors/selectBestMedia.ts` → `src/features/download/logic/`.
- Tạo barrel. Update imports. Test pass.

**Milestone 9 — entrypoints/ migration** (5 commit — 1 entrypoint group + manifest/vite path update per commit, `npm run build` pass per commit):
- **M9.1**: Move `src/background/{index,messageBus,offscreenManager}.ts` → `src/entrypoints/background/`. Update `manifest.json` `service_worker` path. Build pass.
- **M9.2**: Move `src/content/{content-script,pageScanner,fetchInterceptor.iife,themeTokens}.ts` → `src/entrypoints/content/`. Update `manifest.json` `content_scripts[0].js` (content-script) + `content_scripts[1].js` (fetchInterceptor.iife). Build pass + browser verify (MAIN world inject).
- **M9.3**: Move `src/offscreen/` → `src/entrypoints/offscreen/`. Update `vite.config.ts` `rollupOptions.input.offscreen`. Build pass.
- **M9.4**: Move `src/popup/` → `src/entrypoints/popup/`. Update `manifest.json` `action.default_popup`. Build pass + browser verify (popup load).
- **M9.5**: Move `src/sidepanel/` → `src/entrypoints/sidepanel/`. Update `manifest.json` `side_panel.default_path` + `vite.config.ts` `rollupOptions.input.sidepanel`. Build pass + browser verify (sidepanel load).

**Milestone 10 — settings/ feature** (1 commit):
- Extract settings UI + logic từ `src/entrypoints/popup/components/settings/` → `src/features/settings/`.
- Tạo barrel. Update imports. Test pass.

**Milestone 11 — chrome-apis/ adapters** (incremental, 2-3 commit):
- Wrap chrome.runtime, chrome.storage, chrome.tabs, chrome.downloads, chrome.webRequest, chrome.offscreen vào `src/shared/lib/chrome-apis/`.
- Update callers dùng adapter. Characterization test pin behavior trước wrap.
- Test pass + browser verify.

**Milestone 12 — tests/ mirror** (1-2 commit):
- Move `tests/unit/` mirror new `src/features/` + `src/entrypoints/` + `src/entities/` + `src/shared/` structure.
- Colocate rule. Test pass.

**Milestone 13 — Final cleanup + docs** (1 commit):
- Xóa old empty folders.
- Update `docs/2-architechture-system.md` full new structure.
- Update `docs/0-wiki.md` mục lục.
- Full regression: `npm run test:unit` + `npm run test:integration` + `npx tsc --noEmit` + `npm run build` + browser verify + E2E.

**Total**: ~17-20 commit (M0 + M1-M13, M9 tách 5 sub-commit). Commit nhỏ mỗi cluster, test pass mỗi commit (anh confirm Q3:A).

## References

- **Intent**: `docs/intent/intent-refactor-system-architecture.md` (G0 research 53 nguồn + 7 nguyên lý + cơ chế refactor)
- **Architecture map**: `docs/2-architechture-system.md` (current structure)
- **Architect role**: `docs/reference/software-org-roles.md` mục #4 (line 245-290)
- **Orca platform scope**: `docs/reading-summaries/phase-1-wiki-chapters.md` → `phase-7-theocean-dict.md` (17 UC groups / 130 UC)
- **Reference projects**: asbplayer (monorepo common/ pure domain), import-dict (Repository + Strategy pattern), theocean-dict (OCEAN engine + AnkiConnect)
- **Existing ADRs**: ADR-001→015 (current architecture decisions)
- **Research synthesis**: 7 nguyên lý high-confidence (P1-P7) + 5 phụ (P8-P12) từ 53 nguồn — xem intent Phụ lục A
