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
│   ├── background/     #   Service Worker (MV3) — thin orchestrator (M14: index ~321 lines)
│   ├── content/        #   Content scripts (ISOLATED + MAIN world) — thin (M20: ~414 lines)
│   ├── offscreen/      #   Offscreen document (OPFS, workers, fetch proxy M15)
│   ├── popup/          #   Popup UI (React)
│   ├── sidepanel/      #   Side panel UI (React)
│   ├── options/        #   Options page (React) — ADR-023: ResourcesPanel + ThemePanel + settings tabs
│   ├── design-system-showcase/  #   Design system showcase page — App.tsx + autoDiscovery.ts (SSOT taxonomy) + ShowcaseGallery.tsx/.module.css + MissingShowcasePlaceholder + preview components + concept mockups + mock data for offline component demos
│   └── reader/                 #   Reader page (React) — TXT import/read/tokenize/TTS (Day-1 MVP)
├── features/           # Feature domains (screaming — domain name first)
│   ├── detection/      #   Media/subtitle/script/language detection
│   │   └── subtitleDiscovery/  # Generic subtitle-list discovery pipeline (T1-T12 E2E): signals, adapters, schema, pipeline, candidate/identity helpers
│   ├── whitelist/      #   Auto-download whitelist
│   ├── transmux/       #   TS→fMP4 transmuxing (planning/execution/merging)
│   ├── subtitle/       #   Subtitle overlay/sync/merge/bilingual (logic/ui/service)
│   │   └── ui/contentScriptController.ts  # M20 + T046: subtitle UI orchestration (init → returns cleanup for SPA episode-switch re-init) — instantiates ReactSubtitleController and mounts the React shadow-root subtitle UI
│   │       └── ui/subtitleCueEngine.ts  # T046: logic-only cue/offset/video/time/repeat engine shared by ReactSubtitleController
│   │       └── ui/reactSubtitleController.ts + mountSubtitle.tsx + SubtitlePanels.tsx  # T046: React subtitle UI controller, mount helper, and panel composition; Player Mode temporarily top-aligns host video container and publishes document bounds for Dictionary sheet. **T14 (atom decomposition)**: `SubtitlePanels.tsx` (1524→1344 lines) now composes `ClusterRightToolbar` + `ManagerLayer` + `OffsetLayer` molecules instead of inline toolbar/manager/offset render
│   │       └── ui/playerModeHost.ts + .test.ts  # Reversible inline-style adapter for Player Mode host/video positioning; snapshots/restores values and priorities
│   │       └── ui/SubtitleManagerPanel.tsx + .module.css + .test.tsx  # T042: React subtitle manager panel (select/load/import, naming, offset entry) + Appearance view (Block/Target/Native/Cluster style customization, ADR subtitle-appearance-in-manager). **Responsive positioning**: desktop ≥768px → overlay trên video container (`.panelLayer` position:absolute;inset:0; z-index:2147483647, cùng parent `#cell-subtitle-root` — đồng bộ với overlay subtitle, không còn body-level portal + videoRect tracking); mobile <768px → bottom sheet `position:fixed` từ bottom (94% width, drag handle, 75vh max). Panel layer dark translucent trên desktop, opaque popover trên mobile.
│   │       └── ui/SubtitleManagerFooter.tsx + .module.css + .showcase.tsx  # Footer organism: 4 Button atoms (vertical orientation, ZaloPay pattern) — Search/Customize/Hide(toggle)/Generate(primarySubtle). Reusable template for panel footers.
│   │       └── ui/appearance/  # ADR subtitle-appearance-in-manager: SubtitleStylePanel, SubtitlePreview, SubtitleBlockSettingsPanel, NavClusterSettingsPanel moved from settings/ui/ — SSOT for subtitle appearance components + appearanceShadowCss.ts manifest
│   │       └── ui/SubtitleOffsetPanel.tsx + .module.css + .test.tsx  # T043: React time offset panel with slider, steppers, input, reset; uses clampOffsetMs/parseOffsetInput/formatOffsetDisplay
│   │       └── ui/SubtitleToast.tsx + .module.css + .test.tsx  # T044: React toast container with auto-dismiss and prefers-reduced-motion
│   │       └── ui/SubtitleHint.tsx + .module.css + .test.tsx  # T044: React drag/drop hint overlay
│   │       └── ui/SubtitlePanels.tsx + .module.css  # T045/T14: shared shadow-root container composing SubtitleBlock, NavCluster, SubtitleToast, SubtitleHint + **molecules** `ClusterRightToolbar` (mode='overlay'), `ManagerLayer`, `OffsetLayer`; exposes imperative controller via ref; Player Mode toggle and normal-page Split View toggle. **T14**: god-component decomposed (1524→1344 lines) — toolbar/manager/offset render moved to molecules, state/effects giữ nguyên. **Manager portal đồng bộ positioning với overlay**: `#cell-manager-portal` gắn trong video container (cùng parent `#cell-subtitle-root`), `position:absolute;inset:0;z-index:2147483647`, dùng chung `attachFullscreenReparenting` từ `mountReactShadow.ts` — không còn body-level portal + videoRect/ResizeObserver tracking + custom fullscreen polling. Split View wraps the outer player shell so native controls + Cell overlay stay inside the video stage; CueList is rendered through the shared SubtitlePanel SSOT. CSS owns resizing: the CueList keeps its persisted flex percentage, the stage receives the remaining width, and viewport-bound player wrappers use `100dvh`; no descendant pixel-size chain or synthetic resize event is used. Wrapper flex preserves playerShell's original footprint when the INSERTION parent is a flex row with siblings (e.g. kisskh .row = video col + drama info col): wrapper uses `flex:0 0 {width}px` instead of `flex:1 1 100%` to avoid collapsing sibling columns (episode selector disappearing). When transitioning from fullscreen→normal, the wrapper width is taken from the old wrapper (not playerRect, which is constrained by the old wrapper's flex-basis percentage context). FULLSCREEN branch: when playerShell was reassigned to fsEl (a descendant like kisskh .videoplayer), skip unwrap from old wrapper — moving the fullscreen element exits fullscreen; the old wrapper is an invisible ancestor (top-layer rendering) and is cleaned up on the next NORMAL branch. On Split View close, #cell-subtitle-root returns to its pre-Split-View parent (saved before opening), NOT to playerShell — playerShell can be position:static (themoviebox), which lets the overlay's position:absolute+inset:0 escape to the viewport. **Child-iframe Player Mode uses native `document.documentElement.requestFullscreen()`; `fullscreenchange` syncs `playerMode`; `attachFullscreenReparenting` moves the shadow host into `document.fullscreenElement`; body reparenting is skipped for child frames.**
│   │       └── ui/SubtitlePanel.tsx + .module.css  # SSOT subtitle-list panel wrapper used by Player Mode and normal-page Split View; owns panel surface/header/layout around CueList and injects the same design tokens in Split View's nested shadow root.
│   │       └── ui/subtitlePanelsTypes.ts  # **T14**: SSOT types — `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps`, `AppearanceState`; pure type file (no JSX, no logic) breaks `logic/` → UI file dependency. Re-exported by `SubtitlePanels.tsx` + `SubtitleManagerPanel.tsx` for backward-compat
│   │       └── ui/subtitlePanelsShared.module.css  # **T14**: SSOT CSS — `.panelLayer`, `.offsetRow`, `.clusterRight` family (`.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded`) + glass token remap + mobile media query; shared by `ClusterRightToolbar`, `ManagerLayer`, `OffsetLayer`, `PlayerModeOverlay`, `OverlayPreview`
│   │       └── ui/ClusterRightToolbar.tsx + .test.tsx  # **T14**: Molecule — right-side toolbar shared by overlay (mode='overlay') + Player Mode (mode='player'); quick-add/edit-card/update-current-card/manager-toggle/generate-native/side-panel-toggle + tools-expand; overlay adds player-mode toggle, player adds Exit. CSS từ `subtitlePanelsShared.module.css`; giữ tất cả `data-cell-id` (C5)
│   │       └── ui/ManagerLayer.tsx + .test.tsx  # **T14**: Molecule — renders `SubtitleManagerPanel` once (mobile Sheet + desktop `.panelLayer` backdrop); owns persisted `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` (getStorage/setStorage, clamp 20-95vh) + backdrop click-to-close. Forwards `manager.offsetMs` → panel `offsetMs` prop so the Latency stepper initializes from the current persisted offset. Consumers: `SubtitlePanels` (overlay), `HostManagerSheet` (host adapter)
│   │       └── ui/OffsetLayer.tsx + .test.tsx  # **T14**: Molecule — renders 2 `SubtitleOffsetPanel` (target + native) trong `.offsetRow` div; CSS reuse từ `subtitlePanelsShared.module.css` (không file CSS riêng — D3); `data-cell-id="subtitle-offset-layer"`
│   │       └── ui/PlayerModeOverlay.tsx + .module.css  # **ADR-078** Player Mode: fixed full-viewport overlay (VideoStage → ContentOther → PlayerActionDock); host player container is slotted from the shadow host's light DOM into video stage so controls + CSS stay intact; reuses SubtitleBlock + original two-column NavCluster/action cluster composition inside the dock; Escape exits via window listener; dock always visible. **T14**: shares `ClusterRightToolbar` (mode='player') with overlay — toolbar CSS từ `subtitlePanelsShared.module.css` thay `SubtitlePanels.module.css`. **Child-iframe mode (AnimeKai/megaplay/vidnest): the child controller requests the top-frame `iframePlayerModeBridge` via `postMessage`; the top frame walks from the matching iframe to `.player-wrap` (fallback iframe), reparents that host into the top viewport, and the child overlay remains projected inside it.** Both paths size it responsively, and `videoStage ::slotted([slot="cell-video"])` keeps `pointer-events: auto` so native controls remain clickable.
│   │       └── logic/iframePlayerModeBridge.ts  # Cross-origin Player Mode coordinator: child→top enter/exit messages, generic matched-host discovery, native fullscreen when activated, and reversible fixed fallback when postMessage cannot carry user activation.
│   │       └── ui/mountSubtitle.tsx + .test.tsx  # T039/T045/T14: mounts SubtitlePanels into a single shared shadow root; injects manager/search + shared atom CSS + `subtitlePanelsShared.module.css`; returns unmount + panel visibility/toast API. **T14 CSS manifest**: 3 arrays — `css[]` (overlay shadow root), `managerShadowCss[]` (body-level manager portal), `hostManagerSheetShadowCss[]` (`hostManagerSheetShadowCss.ts`) — all include `subtitlePanelsSharedCss`
│   │       └── ui/SubtitleBlock.tsx + .module.css + .test.tsx  # T036: React subtitle block overlay; renders active target + native cues with OverlayStyleConfig. **Inline load status**: reads `targetLoadStatus`/`nativeLoadStatus` from cuesStore; shows "Loading {language}…", "Couldn't load {language} subtitle", or "No subtitles found on this page" in the block area when no active cue (replaces toast); `.statusText` CSS class = italic + muted (0.7 opacity + 0.85em)
│   │       └── ui/NavCluster.tsx + .module.css + .test.tsx  # T037: React nav cluster; prev/repeat/next, rewind/play/forward, collapse, no-sub states
│   │       └── ui/subtitleUI.ts  # Shared subtitle overlay visual helpers: buildTextShadow, hexToRgba, sanitizeFontFamily; createDebouncedToast
│   │       └── ui/navClusterActions.ts + NavCluster.module.css  # ADR-018/T004: pure cue navigation helpers + React NavCluster visual tokens
│   │       └── ui/shortcutActionDispatcher.ts  # Pure cue navigation (navigateCue, toggleOverlayState)
│   │       └── ui/subtitleShortcuts.ts  # Keyboard shortcut handler: handleShortcutKey (pure, guard input/textarea); supports Player Mode ('g'), generate-native ('h'), and play-pause actions
│   │       └── logic/subtitleOffset.ts  # ADR-019: pure offset logic — OffsetState, parseOffsetInput, clampOffsetMs, shouldAutoCommit, formatOffsetDisplay, AUTO_COMMIT_MS=120000
│   │       └── logic/subtitleBlockDrag.ts  # ADR-025: pure drag-to-reposition logic — clampYOffset (0-95), dragDeltaToYOffset (px delta → percent + clamp); O(1). Snap-to-point đã bỏ — release ở đâu giữ nguyên đó
│   │       └── logic/playerModeGeometry.ts  # Player Mode/Split View pure geometry: togglePlayerMode, resolveVideoAspectRatio, resolveSplitViewWrapperHeight (viewport-bound CSS boundary), host/video style maps, clampDockHeight, clampDictionarySheetHeight, resolvePlayerModeLayout (video/content/dock); O(1); unit tested
│   │       └── logic/iframeContext.ts  # **new**: child-iframe detection (`isChildFrame`); single source of truth for Player Mode branching between top-frame (reparent video into video stage) and child-iframe (native fullscreen + project player into video stage within the same child document).
│   │       └── logic/findPlayerContainer.ts + .test.ts  # **ADR-078**: Player container discovery — largest playable <video> → farthest ancestor whose bounding width AND height are each within a per-dimension tolerance (10%) of the video. Per-dimension (not area) comparison rejects same-height-different-width containers (themoviebox .player-container 1635×690 vs video 1226×690, width +33%) while accepting slightly taller containers that own the control bar (kisskh .videoplayer 1103×922 vs video 1103×913, height +1%); Split View moves video + controls + Cell overlay as one shell; PlayerModeOverlay slots the same player container into the shadow DOM video stage while keeping host CSS in light DOM.
│   │       └── logic/subtitleSearchTypes.ts  # **ADR-079**: SubtitleSearchResult, SearchQuery, FetchPlan, SearchError, SubtitleDownloadKind (discriminated union: direct | handshake), KeyLedgerEntry — types for outbound subtitle search
│   │       └── logic/subtitleSearch.ts + .test.ts  # **ADR-079**: Pure provider registry (SubtitleSearchProvider interface), normalizeSearch, buildSearchRequest, buildDownloadRequest, decodeDownload, pickProviderOrder (SubDL-first), key rotation logic (pick oldest lastDownloadAt, O(n) scan); providers/ subfolder for SubDL + OpenSubtitles implementations
│   │       └── logic/providers/  # **ADR-079**: Per-provider implementations of SubtitleSearchProvider — subdlProvider (direct download, unpack=1), openSubtitlesProvider (handshake POST /download, User-Agent via DNR); each pure: normalize + buildFetchPlan + decode
│   │       └── logic/iframeManagerBridgeTypes.ts  # **T14 (planned)**: Bridge protocol types — SerializedManagerState, ManagerAction, message constants for cross-frame subtitle manager communication
│   │       └── logic/managerStateSerializer.ts  # **T14 (planned)**: Serialize ManagerState (with callbacks) to SerializedManagerState (JSON-only) for postMessage transport
│   │       └── logic/iframeManagerBridgeChild.ts  # **T14 (planned)**: Child-side bridge — requestManagerOpenOnHost, sendManagerStateUpdate, onManagerAction
│   │       └── logic/iframeManagerBridgeHost.ts  # **T14 (planned)**: Host-side bridge — installManagerSheetBridge, sendManagerActionToChild
│   │       └── ui/SubtitleSearchPanel.tsx + .module.css + .test.tsx  # **ADR-079**: Search UI (query input + lang select + season/episode + results list + cue preview + role picker Target/Native); debounce 300ms + AbortController; inline ApiKeyManager when no key (moved from Settings)
│   │       └── ui/HostManagerSheet.tsx  # **T14**: React component — thin adapter converting `SerializedManagerState + onAction` → `ManagerState` (via `buildAppearance` helper) then renders `<ManagerLayer ... />`; cross-frame manager projection on host page. Duplicate persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` + backdrop logic removed (owned by `ManagerLayer`)
│   │       └── ui/HostManagerSheet.module.css  # **T14**: Styles for host sheet — 75vh bottom sheet, slide-up animation (backdrop logic dời vào ManagerLayer)
│   ├── settings/       #   Settings UI + validation logic; ui/ responsive redesign (ADR-062) + strict 14/12px type scale
│   │   └── ui/ApiKeyManager.tsx + .module.css + .test.tsx  # **ADR-079**: API key CRUD UI (add/edit/delete + list by provider SubDL/OpenSubtitles + status badge active/rate-limited/invalid/unverified + remaining downloads); masked key display (last 4 chars); delete confirm dialog; now rendered inline in SubtitleSearchPanel (no-keys state), removed from Settings dialog
│   ├── theme/          #   Theme system (ADR-022) — logic/colorGenerator, contrastValidator, themeManager, themeStorage, themeConfig; ui/ThemePanel, ThemeProvider, ModeCards, ColorCustomization, ThemePreview, ContrastBadges, ThemeImportExport, PresetSwitcher; supports dawn/forest/ocean/warmth presets with computed WCAG-AA text-on-primary
│   └── dictionary/     #   Dictionary import + phrase-template system (ADR-023, ADR-037) — logic/fileDetector, formatDetector, signatureGenerator, importErrors, batchProcessor, normalizationPipeline, phraseTemplateParser, phraseIndexCompiler, phraseIndexBuilder, phraseMatcher, phraseMatchService, phraseMatchBenchmark, importOrchestrator, devSeed (auto-seed: default dictionary + frequency on empty DB); repositories/baseRepository (v10: +langPhraseIndex), resourceRepository, frequencyRepository, dictionaryRepository, phraseIndexRepository; strategies/baseImportStrategy, txtLineStrategy, jsonArrayStrategy, yomitanStrategy, cambridgeJsonStrategy, sqliteStrategy, strategyFactory; ui/ResourcesPanel (per-type independent import state), Dropzone, ResourceCard, ImportProgress, DeleteConfirmModal
│   └── dictionaryPopup/  # Popup Dictionary (spec §9, ADR-037, ADR-045, ADR-055) — types, schema; worker/lookupWorker, lookupWorkerHandler, phraseIndexLoader, resourcePriority; logic/lruCache, lookupOrchestrator, lookupOrchestratorBenchmark, englishLemma (ADR-041: unified multi-candidate lemma); log/lookupLogTypes, lookupLogStore, serializeNodes (dev-only lookup logging: capture phrase-match trace — input → tokenization → candidate collection → per-candidate match states + ranking → final output → chrome.storage.local ring buffer 500 entry; gate by isDevMode, export via DevTools console for algorithm analysis); sentence/sentenceModule (SSOT: extractSentenceContext, extractWordAtOffset, createWordRange, resolveWordAtPoint, WORD_CHAR_RE — punctuation-aware sentence split + merge < 3 words + CJK + decimal-safe; resolveWordAtPoint = hybrid lookup algorithm: caret fast-path + nearest-word char-scan fallback + geometry fallback (1.5×line-height proximity gate) for 100% click resolution; consumed by webTriggerController, resolveWordAtTip, webTextDictionaryController); trigger/subtitleTriggerController, subtitleTokenWrap, webTextTriggerController; controller/webTextDictionaryController (per-tab shared lookup + popup + highlight + card-creator wiring for web text and subtitle tokens; `collectCardCreatorMedia` is the SSOT fetch + capture helper used by both Quick Add and Send to Card; manages orbital badge pointer trigger via badgePointerController wiring; React hooks `useOrbitalPointer`/`useOrbitalSnap`/`useOrbitalGesture` and `OrbitalBadge.tsx`; `logic/useDictionaryLookup` (headless search/result hook reused by panel and popup); `logic/useDictionaryToolbar` (headless hook reused by useCandidate for active tab, audio/image/translate media, selection counts, and external dict links); passes `panelController` to `mountOrbitalBadge` for the universal panel; popup dismiss delay 500ms for seamless word-to-word hover); services/wordStatusStore, wordStatusClient, frequencyClient, quickAddAssembler, quickAddHandler, sendToCreator, ttsEngineService; ui/Dictionary.tsx (variant: 'popup'/'integrated' — popup is a compact card with no title bar, no search row, and no search history; integrated is the full panel with search input, history, and chips; both mount DictionaryPanelView), ui/PopupDictionary.tsx (thin wrapper over Dictionary variant='popup'), mountPopupDictionary.ts (shadow-root mount, click-outside, z-index below orbital, fullscreen-aware), usePopupPosition.ts (+popupGeometry.ts: viewport-aware position, drag, resize, bottom-sheet logic), DictionaryPanelView.tsx (search input, history, candidate chips, scrollable CandidateView list), CandidateView.tsx (per-candidate React card: header, toolbar tabs with selection-count badges, lazy media panels, definitions), useCandidate.ts (per-candidate state + actions + lazy fetch), useDictionaryPanel.ts (panel search orchestration, currentResult/candidates), useDictionaryLookup.ts (headless search/result hook reused by panel and popup), useDictionaryToolbar.ts (headless active tab / lazy media / selection counts / external links hook reused by useCandidate), buildCandidatePrefill.ts (shared pure prefill builder), logic/definitionSelection.ts (DefinitionSelection, initDefinitionSelection, getSelectedDefinitions), PopupDictionary.module.css (React popup shell styles, tokens); wordHighlight (visual highlight for looked-up word: DOM mark + overlay fallback, token-aware); plugins/languagePlugin, englishPlugin, chinesePlugin, fallbackPlugin, pluginRegistry; badgePointer/ (ADR-055: orbital dictionary pointer — createOrbitalBadge, pointerPosition geometry, gestureDetector double/triple tap, resolveWordAtTip hit-testing, orbitalBadgeCss (T006: tokenized with --space-0 / --ease-standard))
│   └── universalPanel/  # Universal side panel (ADR-065) — types, UniversalPanelController, mountUniversalPanel, UniversalPanel (React shell), UniversalPanel.module.css, UniversalPanelHeader (+UniversalPanelHeader.module.css) (ADR-061: minimal horizontal header above content with 3 Toggle controls Status/Frequency/Tokenize + close IconButton; tokenize toggle gates Status/Frequency via disabled state; universal across both tabs), tabs/SettingsTab, SettingsTab.module.css, tabs/DictionaryTab (+DictionaryTab.module.css), tabs/CardCreatorPanel (+CardCreatorPanel.module.css), searchHistory.ts (+ bounded session history helpers/tests); tabs/ use shared/ui hooks/patterns; Dictionary left pane uses dictionaryPopup/ui/useDictionaryPanel (search orchestration, currentResult/candidates) and CandidateView (per-candidate header/toolbar/definitions/media with lazy fetch and selection-count badges) inside Dictionary variant='integrated' (+DictionaryPanelView.module.css) (search input, history chips, scrollable candidate list, chip-to-card scroll); right pane CardCreatorPanel renders CardCreatorDialogContent directly with prefill including selected definitions, audio URLs, and image URLs; integrated Card Creator panel header has settings placeholder, queue toggle/slot, and Quick Add shortcut; right-edge slide-in up to 1280px; responsive bottom sheet on mobile; tab persistence via chrome.storage.session; Settings tab reuses SettingsDialogContent (tokenize controls moved to universal header) with initial-focus handoff

│   └── tokenize/       # Tokenize on Media (ADR-047, ADR-050, ADR-051, ADR-052, ADR-053, ADR-054, ADR-058) — VDLT-Predict: types; logic/textTokenizer (+prepareTokenBlock synchronous tokenization), logic/tokenizeBlock (boundary detection + findTextBlocks with optional element filter for viewport-only cold-start + findTextBlocksInNodes for incremental SPA re-scans), logic/viewportTracker (IntersectionObserver wrapper), logic/tokenizeCache (LRU + touch + domMap cleanup on evict/delete; capacity tiered by navigator.deviceMemory — 150/300/500 blocks), logic/tokenizeScheduler (viewport/prepare fast path via requestAnimationFrame with real 16ms budget + idle chunk + task error isolation; clear() drops pending tasks on disable), logic/scrollDirection (pure resolveScrollPredictMargin: asymmetric rootMargin with 1 viewport ahead (min 600px) and 0.25 viewport behind (min 150px), scroll-delta hysteresis; VDLT-Predict Phase B); controller/webTokenizeController (lazy scan/observe only while enabled; VDLT-Predict: isotropic 600px near-zone overscan at start (above + below) before direction-aware asymmetric rootMargin, prepare at PRIORITY_PREPARE, bind at PRIORITY_VIEWPORT, direction-aware asymmetric rootMargin recreated on scroll direction change with rAF-coalesced passive scroll listener, cold-start viewport-first bind via bindViewportNow on enable + after window.load before hydration quiet gate (findTextBlocks filtered to viewport, parent-rect cache, one layout pass), incremental MutationObserver re-scan with queueMicrotask fast path + removedNodes/characterData handling, batched status/frequency metadata with statusOverrides race guard (keyboard 1/2/3/4 status change applied while a metadata flush is mid-await is re-applied after resolveTokenMetadata so the stale background snapshot cannot clobber the authoritative value), selective eager tryBindVisible, stale-block eviction, early-bind then async rebind, full scheduler/cache/metadata cleanup + orphan token sweep on disable; orchestrates scheduler, cache, renderer, TokenizeFab + Popup Dictionary wiring), controller/subtitleTokenizeController; services/tokenizeSettingsStore (per-domain enable state), services/tokenizeStateStore (selected terms + toggles); utils/frequencyBand (re-exports rankToBand/entriesToBand from shared/lib/frequencyBand; rank → core/common/general/advanced/rare/none, with rare for all remaining positive ranks); utils/selectionTerms (extractTermsFromSelection: collect unique data-cell-term from .js-cell-token spans intersecting a native text Selection, scoped to the selection's common ancestor with document fallback; used by keyboard status shortcuts 1/2/3/4 to batch-change every token inside a selected passage); ui/tokenSpanRenderer (defensive bind/unbind token spans for SPA re-render; soft-unbind preserves tokens for cheap reverse-scroll rebind; showFrequency toggle controls frequency layer for all token statuses; exports TOKEN_CLASS and orphan-sweep helper for disable cleanup), ui/tokenSpanCss (T007: host-page token styles; Soft Tonal frequency band pills use --color-success-muted / --color-warning-muted / --color-error-muted tokens, 2px inset status bar with --overlay-text-rgb highlight; no padding/margin/line-height so host box model is preserved, box-decoration-break: clone for multi-line tokens, light/dark via :root + @media + [data-theme], colors via tokens.json SSOT), ui/useTokenize.ts (T077: state hook for TokenizeFab), ui/TokenizeFab.tsx + TokenizeFab.module.css + TokenizeFab.test.tsx (T077: React settings FAB + panel, single-source-of-truth for the tokenize UI; mounted by mountTokenizeFab), ui/mountTokenizeFab.ts (T077: shadow-root mount with `ShadowThemeProvider`, fullscreen re-parenting, bridges `TokenizeStateStore` to `TokenizeFab`)
├── entities/           # Domain entities (types/models) — M19: @/types/ fully migrated here
│   ├── video/          #   DetectedVideo, M3u8*, TsSegment
│   ├── subtitle/       #   Subtitle overlay types (canonical SubtitleFormat)
│   ├── settings/       #   Settings, FilenameSource (schemaVersion field M21)
│   ├── theme/          #   ThemeMode, ResolvedMode, CoreColorTokens, ThemeConfig (ADR-022)
│   ├── dictionary/     #   ImportFormat, ResourceType, ResourceInfo, FrequencyEntry, DictionaryEntry, ImportOptions, ImportResult (ADR-023)
│   ├── media/          #   DownloadItem, Ass/Vtt/Srt types (re-exports video+settings)
│   └── message/        #   Message bus types
├── shared/             # Shared infrastructure (cross-feature)
│   ├── lib/            #   parsers/, storage/, chrome-apis/ (adapters), themeTokens, tokens, frequencyBand, shadowRoot
│   │   ├── chrome-apis/  # M17: 9 adapters (tabs/runtime/storage/downloads/webRequest/offscreen/sidePanel/action/windows)
│   │   ├── storage/      # M21: settingsStore.ts (schema versioning + migration)
│   │   ├── shadowRoot/   # ADR-075/ADR-076: Shadow DOM React mounting helpers — mountReactShadow, injectShadowCss (ADR-076: :host font-size reset isolates shadow UI from host <html> font-size), ShadowThemeProvider, useShadowFocusTrap
│   │   ├── tokens.ts     # Design-token runtime helpers (SSOT: shared/styles/tokens.json); exports defaults + getColorTokens/buildColorTokenCSS/formatStaticTokens/formatComponentTokens
│   │   │                   # **ADR-077 (responsive typography)**: Font sizes chuẩn hóa theo frontend-ui-engineering standard — base 16px, sm 14px, xs 12px, ratio 1.25 (px không rem — ADR-076 shadow DOM isolation). Breakpoints: 320/480/768/1024/1280px. Responsive typography tokens: --responsive-{mobile,tablet,desktop}-{base-font,ratio,line-height,max-line,min-line}. Leading: --leading-{body-mobile:1.5, body-tablet:1.6, body-desktop:1.625, relaxed:1.625}.
│   │   └── frequencyBand.ts  # SSOT: rank → TokenFrequencyBand (core/common/general/advanced/rare/none); used by tokenize + dictionaryPopup
│   ├── config/         #   Cross-feature constants and registries
│   │   ├── config.ts   # Canonical config keys and STORAGE_KEYS
│   │   ├── featureFlags.ts  # Compile-time feature flags (e.g. USE_LEGACY_POPUP_DICTIONARY)
│   │   ├── languageRegistry.ts  # Language codes, names, and icon mapping
│   │   └── urls.ts     # External service URLs
│   ├── styles/         #   Global design-system styles
│   │   ├── tokens.json   # Canonical design-token source (core/derived/static/component tokens); component tokens now include `button` Liquid Glass (caustic surface/rim/ripple/text shadows, reflex multipliers, press/release/ripple motion)
│   │   ├── tokens.css    # Generated from tokens.json; imported by popup/sidepanel/options + Shadow DOM popup
│   │   ├── components.css # Global non-hashed component classes (icon-btn, btn)
│   │   └── README.md     # Design-system usage guide for AI agents
│   ├── ui/             #   Reusable UI atoms (design-system-ui-ux Step 3, Rule of Three)
│   │   ├── index.ts                       # Barrel exports for shared UI
│   │   ├── Button.tsx + .module.css + .showcase.tsx + .style-guard.test.ts # Button atom: liquid-glass fill with caustic rim, ripple enabled by default, press/release scale tokens, sm/md/lg/xl, horizontal/vertical, active/loading/disabled
│   │   ├── Badge.tsx + .module.css         # Small status label with variants/sizes
│   │   ├── Alert.tsx + .module.css         # Inline message banner with variants
│   │   ├── Badge.tsx + .module.css         # Small status label with variants/sizes
│   │   ├── Card.tsx + .module.css          # Surface container: default/interactive/selected/glass variants
│   │   ├── CardAnimations.module.css       # Shared card keyframe animations (fade-in, slide-down) used by VideoCard/SubtitleCard
│   │   ├── Checkbox.tsx + .module.css      # Checkbox with label, indeterminate, error, disabled states
│   │   ├── CheckboxGroup.tsx + .module.css # Managed list of checkboxes
│   │   ├── Dialog.tsx + .module.css        # Accessible modal overlay + panel (DeleteConfirmModal now uses this)
│   │   ├── Drawer.tsx + .module.css        # Slide-in panel with overlay
│   │   ├── EmptyState.tsx + .module.css    # Empty list/panel placeholder with md/compact/sm sizes and data-* passthrough
│   │   ├── ErrorBoundary.tsx + .module.css # React error boundary (class component — React requirement) with reload fallback
│   │   ├── FormGroup.tsx + .module.css     # Label + children wrapper with consistent spacing
│   │   ├── Header.tsx + .module.css        # Top chrome with title and actions
│   │   ├── Input.tsx + .module.css         # Text input with error state and size variants
│   │   ├── InputField.tsx + .module.css    # Label + Input + helper/error text
│   │   ├── IconButton.tsx + .module.css    # Icon-only transparent button (Header, SettingsDialog, VideoCard, SubtitleCard, SelectionBar, DownloadCard, UniversalPanel)
│   │   ├── Label.tsx + .module.css         # Form control label with required/disabled states
│   │   ├── ListItem.tsx + .module.css      # Row with leading/trailing content and active state
│   │   ├── NavItem.tsx + .module.css       # Navigation item (sidebar/horizontal)
│   │   ├── FooterBar.tsx + .module.css     # Generic bottom navigation bar (ZaloPay/iOS tab bar/M3 pattern): slots prop, equal-width, flat, soft shadow separator, height=content
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
│   │   ├── Toggle.tsx + .module.css        # Switch pill; default sm, md/lg override (touch-target via size="md") (settings-controls-restyle F1)
│   │   ├── Tooltip.tsx + .module.css       # Accessible hover/focus tooltip
│   │   ├── Accordion.tsx + .module.css     # Collapsible single/multiple sections
│   │   ├── Slider.tsx + .module.css        # Styled range; touch-target aware 40/44px (settings-controls-restyle F2)
│   │   ├── ShortcutInput.tsx + .module.css # Uppercase + center single-char input (settings-controls-restyle F3)
│   │   ├── SearchableSelect.tsx + .module.css # Single-select dropdown with embedded search (settings-controls-restyle F5)
│   │   └── HintIcon.tsx + .module.css      # Info-circle button + floating popover with boundary detection (settings-controls-restyle F6)
│   ├── utils/          #   fileUtils, timeUtils, urlUtils
│   ├── config/         #   config, messages, urls
│   └── domain/         #   Domain atoms grouped by bounded context
│       ├── video/atoms/       # Playback, timeline, volume, fullscreen, PiP
│       ├── subtitle/atoms/    # Subtitle text, tracks, language, offset
│       ├── dictionary/atoms/  # Word, phonetic, definition, pronunciation, source
│       └── learning/atoms/    # Word status, frequency, CEFR, mastery
└── types/              # Ambient .d.ts (muxjs, vite-env) — M19: media/message/subtitle.ts deprecated
```

**Design-system showcase contract (ADR-074):** `src/entrypoints/design-system-showcase/` renders the auto-discovered library across all atomic-design levels. `autoDiscovery.ts` is the single source of truth for showcase taxonomy: it applies canonical `level`/`category` overrides (`CANONICAL_META`), normalizes legacy category aliases, detects `src/shared/ui/` components missing a `.showcase.tsx` file, and renders them as `MissingShowcasePlaceholder` entries so documentation gaps stay visible. `ShowcaseGallery` owns level/category grouping, persistent search, status badges (missing/deprecated/experimental), responsive sidebar, and token-based glass layout. `LibraryLevelInfo` carries an `icon` (ICON_CATALOG key) for the collapsed rail — 6 custom atomic-design icons: `layers` (Foundations), `atom` (Atoms), `molecule` (Molecules), `organism` (Organisms), `wireframe` (Templates), `windowPage` (Pages). Foundation previews use flat sections; radius is rendered as an independent specimen list rather than nested cards.

New files: `MissingShowcasePlaceholder.tsx/.module.css`, `vite.showcase.config.ts` build target outputs `docs/design-system/design-system-showcase.html`, `package.json` adds `build:design-system`.

**Refactor status**: M0-M13 COMPLETE (FSD migration). M14-M21 COMPLETE (architecture debt refactor, ADR-017):
- M14: SW god-file split (2203→321 lines, 8 handler files)
- M15: fetch() moved to offscreen document
- M16: onStartup/onInstalled lifecycle rehydration
- M17: 9 chrome.* adapters, ~129 entrypoint calls routed
- M18: 32 deep imports → barrel-only (0 deep imports in entrypoints)
- M19: 94 @/types/ imports → @/entities/* (Strangler Fig complete)
- M20: content-script 787→414 lines (orchestration → contentScriptController.ts)
- M21: settingsStore.ts with schema versioning + migration (CURRENT_SCHEMA_VERSION=19)

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
│   ├── handlers/                  # Message handlers (registered via registerXxxHandlers in index.ts)
│   │   └── subtitleSearch.ts      # **ADR-079**: 2 subtitle search handlers: SEARCH_SUBTITLES (pick provider SubDL→OS, pick search key, offscreenFetch, normalizeSearch → results), RESOLVE_SUBTITLE_DOWNLOAD (pick download key, handshake if needed, offscreenFetch bytes, decodeDownload → text, update key ledger). Runtime Zod validation for payloads
│   ├── helpers/                   # Background-only helpers (not exported to content-script)
│   │   └── subtitleKeyLedger.ts   # **ADR-079**: Per-key quota ledger in chrome.storage.session — remainingDownloads, resetAt, lastDownloadAt; serialized mutations in SW event loop; pickDownloadKey (filter active + remaining > 0 + not rate-limited → oldest lastDownloadAt, O(n) scan); pickSearchKey (search quota riêng)
│
├── entrypoints/content/           # Content script (chạy trong trang web)
│   ├── content-script.ts          # Entry: scan DOM → gửi PAGE_SCAN_RESULT; wires `initContentScriptController`, `WebTextDictionaryController`, `WebTokenizeController`, `mountTokenizeFab` (T077), universal panel (ADR-065); ADR-010 episode-switch watcher (VIDEO_EPISODE_CHANGED); ADR-012 isVideoReady gate (blob: OR readyState>=2); **overlay re-init on SPA episode switch** (track `lastSeenVideo` + `currentOverlayCleanup`, `reportEpisodeChangedIfReplacement` re-injects overlay for new <video>); `videoSrcWatcher` polls `video.src` for sub→dub switches; **PageScanner runs in top frame AND in any iframe that hosts a `<video>` (e.g. moviepire.ru → vidnest.fun) so `<track>` elements inside cross-origin players are captured; **ADR-020: YouTube MAIN↔ISOLATED postMessage bridge** — listener for `__YT_DETECTED_SUBTITLES` / `__IQ_CS_READY` / `__NF_CS_READY`; **ADR-065: mounts universal panel and passes its controller to the orbital badge**
│   ├── fetchInterceptor.iife.ts   # MAIN world (ADR-011): patch window.fetch, postMessage `__DETECTED_SUBTITLE_FETCH` → ISOLATED listener → DETECTED_SUBTITLE_URL (catches cached subtitle fetches webRequest misses)
│   ├── youtube-main-world.iife.ts # MAIN world (ADR-020, scoped *://*.youtube.com/*): read window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks → postMessage `__YT_DETECTED_SUBTITLES` (tracks+videoId); SPA re-detect via yt-navigate-finish + popstate + pushState hook + videoId dedup poll; InnerTube fallback request when DOM parse empty
│   ├── netflix-main-world.iife.ts # MAIN world (ADR-029, scoped *://*.netflix.com/*): DFS/BFS traverse `cadmiumPlayerRepository.playersById[sessionId]` for `type==='timedtext'` nodes with `urls[0].url` → pair with `getTimedTextTrackList()` metadata → postMessage `__NF_DETECTED_SUBTITLES` (tracks+movieId); poll for player 2-30s; SPA re-detect via pushState/replaceState/popstate + movieId dedup; **pivoted from JSON.parse/stringify hooks** (cadmium 6.0059+ uses schema-based custom parser, not JSON.parse). **ADR-030**: 3 CustomEvent listeners `__NF_SEEK|PLAY|PAUSE` → `getPlayer().seek/play/pause` (M7375 fix — route playback qua Netflix player API, không set video.currentTime trực tiếp)
│   ├── pageScanner.ts             # Scan <video>, <source>, subtitle <track>
│   ├── subtitleParser.ts          # Adapter: parseSubtitle(content, format) → ParseResult (reuse parseSrt/parseVtt/parseTtml)
│   ├── subtitleSync.ts            # Binary search O(log n): findCurrentLine(cues, currentTime) → index
│   ├── subtitleUI.ts              # Overlay UI: createOverlay (appended to video-wrapper), createDragHint (appended to video-wrapper), showToast (appended to video-wrapper), updateOverlayText, updateOverlayBilingual, hideOverlay, removeOverlay — **planned ADR-013**: refactor createOverlay → createOverlayLayer(role, config) 2 div độc lập + applyStyle + buildTextShadow + sanitizeFontFamily + hexToRgba
│   ├── subtitleDragDrop.ts        # File read + parse: readFileAsText, handleFileDrop (drag-drop handler)
│   ├── subtitleImport.ts          # Import helpers: assignImportRole, parseAndDetectFiles; **DELETED** createImportButton (legacy DOM import button)
│   ├── subtitleOverlay.ts         # **DELETED** — legacy vanilla SubtitleOverlayController replaced by React SubtitleBlock + mountSubtitle
│   ├── subtitleAutoLoad.ts        # Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL, CORS fallback), handleAutoLoadSubtitles (fetch+parse+load bilingual, inline onLoadStatus replaces toast), formatFromUrl, clearAutoLoadCache, resolveLanguageLabel
│   ├── subtitleMerge.ts           # mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty)
│   ├── subtitleBilingualParser.ts # Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, reuse parseSrt)
│   ├── subtitlePanel.ts           # **DELETED** — seekToCue moved to netflixPlayback.ts; createToggleButton removed
│   ├── netflixPlayback.ts         # ADR-030: seekVideo/playVideo/pauseVideo — isNetflixPage() → dispatch __NF_SEEK|PLAY|PAUSE CustomEvent → MAIN-world player API; fallback video.currentTime/play/pause cho site thường. **ADR-031**: mountToWatchVideo(el, container) — move Cell UI vào .watch-video + z-index max + copy data-theme, fix Netflix overlay che nút; **T046**: seekToCue moved here from subtitlePanel.ts
│   ├── subtitleShortcuts.ts       # Keyboard shortcuts: handleShortcutKey (pure, guard input/textarea)
│   └── subtitleControllerHelpers.ts # Pure helpers extracted from contentScriptController: createTranslateFunction (4× dedup), broadcastCues (6× dedup), loadSettingsOrToast (3× dedup)
│   └── shortcutActionDispatcher.ts # Pure helpers: navigateCue (2× dedup cue nav), toggleOverlayState (2× dedup overlay toggle)
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
│           ├── SettingsDialog.tsx    # Overlay + popover shell + close button + Escape handling; renders SettingsDialogContent
│           ├── SettingsDialogContent.tsx # Reusable settings body: sidebar navigation + all settings sections (Media, Block, Target/Native subtitles, Shortcuts, Cluster, Download, Card Creator, Dictionary Popup, Theme, TTS, Resources) — tokenize section moved to universal panel header (ADR-061)
│           ├── SettingsDialog.module.css # Styles cho SettingsDialog (480px popover + sidebar 120px + 5 section cards + pill active)
│           ├── SubtitlePreview.tsx   # Black bg + white text + apply OverlayStyleConfig realtime incl. fontWeight (settings-controls-restyle F4)
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
│   ├── OptionsApp.tsx             # Sidebar nav (4 items) + 4 tabpanels + skip link + arrow key nav + mobile hamburger drawer
│   ├── OptionsApp.module.css      # BEM shell: sidebar 200px desktop / 56px tablet icon-only / fixed drawer mobile, gap 64px
│   ├── SidebarItem.tsx            # Atom: sidebar nav button (role=tab, aria-controls, aria-selected, tabIndex)
│   ├── SidebarItem.module.css     # BEM: active primary left border + primary text; tablet label hidden, icon-only
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
│   ├── messages.ts                   # MESSAGE_TYPES constants (includes OCR region command)
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
| `background/index.ts` | networkInterceptor, messageBus, downloadQueue, downloader, offscreenManager, context, helpers, wireEvents, handlers/* | `service-worker-loader.js` (entry) | **Thin orchestrator (M14 refactor: 2203→321 lines)** — init/stop/registerHandlers only. Shared state (mediaMap, autoDownloadedTabs, lastCuesByTab, activeTabIdForPanel, extensionActive, sessionReady). Delegates to handlers/* + wireEvents + helpers |
| `background/context.ts` | types | `background/index.ts`, `helpers.ts`, `wireEvents.ts`, `handlers/*` | `BackgroundContext` interface — shared state + building blocks + helpers contract |
| `background/helpers.ts` | config, messages, opfsStorage, autoDownload, subtitleService, languageDetector, m3u8Parser, types | `background/index.ts`, `wireEvents.ts`, `handlers/*` | Helper functions: generateId, extractBaseName, buildDetails (ADR-035: optional `initiator` param from scanned frame URL), getActiveTabId, reloadActiveTab, badge helpers, enrichVideo, enrichM3u8Variants, findVideoById, findSubtitleById, createDownloadItem, settings helpers, session persistence helpers, pushAutoLoadSubtitles, resolveUnknownSubtitleLanguages, **ADR-036: resolveStremioSubtitleListing** (fetch Stremio addon JSON listing → extract subtitles[].url → re-inject via handleRequest), extractOrigin, maybeAutoDownload |
| `background/wireEvents.ts` | messages, helpers, types | `background/index.ts` | Event wiring: networkInterceptor.onMediaDetected → broadcast, **ADR-036: networkInterceptor.onListingDetected → resolveStremioSubtitleListing**, downloadQueue.onProgress → broadcast, downloader callbacks (convert, saveOpfs, executor), chrome.tabs.onUpdated/onRemoved/onActivated, chrome.windows.onFocusChanged, chrome.downloads.onDeterminingFilename |
| `background/handlers/download.ts` | messages, **message/schema**, helpers, types | `background/index.ts` (via registerDownloadHandlers) | 10 download handlers: DOWNLOAD_VIDEO, DOWNLOAD_SUBTITLE, DOWNLOAD_ALL, CANCEL, PAUSE, RESUME, RETRY, REMOVE, GET_DOWNLOAD_PROGRESS, CONVERSION_PROGRESS_UPDATE. **Runtime Zod validation** for payload shapes |
| `background/handlers/mediaDetection.ts` | messages, **message/schema**, videoDetector, subtitleDetector, helpers, types | `background/index.ts` (via registerMediaDetectionHandlers) | 3 media detection handlers: GET_DETECTED_MEDIA, PAGE_SCAN_RESULT (ADR-035: pass `payload.pageUrl` as `initiator` → `DetectedSubtitle.initiator` → DNR Origin for origin-checking CDNs like prox.anicore.tv), DETECTED_SUBTITLE_URL. **Runtime Zod validation** for payloads |
| `background/handlers/subtitle.ts` | messages, **message/schema**, config, helpers, types | `background/index.ts` (via registerSubtitleHandlers) | 5 subtitle handlers: UPDATE_SUBTITLE_LANGUAGE, REQUEST_AUTO_LOAD_SUBTITLES, FETCH_SUBTITLE_CONTENT (sends `initiator` as Referer via offscreenFetch for CDN hotlink protection), SUBTITLE_CUES_LOADED, REQUEST_SUBTITLE_CUES. **Runtime Zod validation** for payloads |
| `background/handlers/subtitleSearch.ts` | messages, **message/schema**, subtitleSearch (providers, normalize, buildFetchPlan), subtitleKeyLedger, offscreenFetch, types | `background/index.ts` (via registerSubtitleSearchHandlers) | **ADR-079**: 2 subtitle search handlers: SEARCH_SUBTITLES (pick provider SubDL→OS, pick search key round-robin, offscreenFetch FetchPlan, normalizeSearch → results), RESOLVE_SUBTITLE_DOWNLOAD (pick download key, handshake if OS, offscreenFetch bytes, decodeDownload → text, update key ledger remaining/resetAt). **Runtime Zod validation** for payloads |
| `background/helpers/subtitleKeyLedger.ts` | chrome.storage.session, types | `background/handlers/subtitleSearch.ts` | **ADR-079**: Per-key quota ledger in chrome.storage.session — remainingDownloads, resetAt, lastDownloadAt; serialized mutations in SW single-threaded event loop (concurrent tabs don't clobber); pickDownloadKey (filter active + remaining > 0 + not rate-limited → oldest lastDownloadAt, O(n) scan); pickSearchKey (search quota riêng) |
| `background/handlers/settings.ts` | messages, **message/schema**, helpers, types | `background/index.ts` (via registerSettingsHandlers) | 4 settings handlers: GET_SETTINGS, UPDATE_SETTINGS, GET_EXTENSION_STATUS, TOGGLE_EXTENSION. **Runtime Zod validation** for UPDATE_SETTINGS payload |
| `background/offscreenFetch.ts` | messages, offscreenManager, types | `background/helpers.ts`, `background/handlers/subtitle.ts` | **M15 fetch adapter**: `offscreenFetch(url, options)` → delegates fetch() to offscreen document via FETCH_REQUEST message. SW idle eviction safety — offscreen persists for fetch duration. Used by: enrichM3u8Variants, resolveUnknownSubtitleLanguages, handleFetchSubtitleContent |
| `background/handlers/sidePanelRelay.ts` | messages, **message/schema**, **chrome-apis/tabs**, helpers, types | `background/index.ts` (via registerSidePanelRelayHandlers) | 9 side panel relay handlers: OPEN_SIDE_PANEL, **CLOSE_SIDE_PANEL** (Chrome 141+ `chrome.sidePanel.close` via windowId resolved from tabId via `getTab()` adapter), VIDEO_TIME_UPDATE, VIDEO_PLAY_STATE, SEEK_TO, TOGGLE_PLAY, SHORTCUT_ACTION, VIDEO_EPISODE_CHANGED (ADR-008/009/010/011). **Runtime Zod validation** for payloads |
| `background/handlers/youtubeDetection.ts` | messages, **message/schema**, detection (mapYouTubeCaptionTracks, fetchCaptionTracksViaInnerTube), helpers, types | `background/index.ts` (via registerYouTubeDetectionHandlers) | **ADR-020**: 1 YouTube handler: INNERTUBE_FALLBACK_REQUEST (background SW fetch InnerTube WEB client — content script cannot set User-Agent). **Runtime Zod validation** for payload |
| `background/handlers/detectionDispatch.ts` | messages, **message/schema**, detection (mapYouTubeCaptionTracks, mapIqiyiSubtitleTracks, mapNetflixSubtitleTracks), helpers, types | `background/index.ts` (via registerDetectionDispatchHandlers) | **ADR-028/029**: unified `DETECTED_SUBTITLES` handler dispatches by `source` (youtube/iqiyi/netflix). **Runtime Zod validation** for payload |
| `background/handlers/translate.ts` | messages, translateService, types | `background/index.ts` (via registerTranslateHandlers) | **ADR-021**: 1 translate handler: TRANSLATE (content-script → background SW fetch Google Translate unofficial endpoint, CORS bypass, return parsed string[]) |
| `background/handlers/cardCreator.ts` | messages, **message/schema**, ankiConnectClient, types | `background/index.ts` (via registerCardCreatorHandlers) | **ADR-026**: 1 Card Creator handler: CARD_CREATOR_REQUEST (content-script → background SW fetch AnkiConnect HTTP, CORS bypass, return `{ result }` or `{ error }`). Single generic action; action name + params in payload. **Runtime Zod validation** for payload |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts`, `background/wireEvents.ts` | Media detection, dedup, clearTab; **ADR-036: onListingDetected callback** — fires when Stremio addon listing URL captured → async resolveStremioSubtitleListing extracts real subtitle URLs from JSON |
| `background/downloader.ts` | m3u8Parser, assToSrt, vttToSrt, srtNormalizer, **fileUtils**, opfsStorage, types, config | `background/index.ts` | Download + convert + filename, **pause/resume/retry** (cancel flag pattern), **two-phase progress** (downloadProgress + convertProgress), **AES-128 decrypt** (fetchKey, decryptSegment, WebCrypto AES-CBC), **fMP4 concat** (init segment + .m4s → .mp4, no transmux), **byte-range** (Range header, 206/200), **ad skip** (section-based, even=content/odd=ad), **nested master** (max depth 3) |
| `background/downloadQueue.ts` | types | `background/index.ts` | Queue concurrency, pause/resume, **retry** (reset+requeue), **remove** (delete item) |
| `background/messageBus.ts` | — | `background/index.ts` | Message routing |
| `background/offscreenManager.ts` | — | `background/index.ts` | Offscreen document lifecycle |
| `background/autoDownload.ts` | **whitelist**, **selectBestMedia**, config, types, downloadQueue | `background/index.ts` | Auto-download orchestrator: `tryAutoDownload(tabId, tabUrl, deps, alreadyEnqueuedIds?)` → returns `string[]` (enqueued media ids; empty = no-op). Whitelist check → load settings → selectBestMedia → enqueue downloads, skipping ids already enqueued (incremental subtitle catch-up). Silent no-op when no match |
| `background/subtitleService.ts` | types (DetectedSubtitle, Settings, SubtitlesForOverlayResult) | `background/index.ts` | findSubtitlesForOverlay: validate target + native language (BCP 47 subtag-aware, e.g. `zh` matches `zh-hans`/`zh-hant`) → return both matches (partial load when only one matches) |

### Shared / Entities layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `entities/message/schema.ts` | `zod` | background handlers (`download`, `mediaDetection`, `settings`, `youtubeDetection`, `cardCreator`) | Zod schemas for MV3 message payloads — runtime validation at trust boundaries |
| `shared/lib/fetchWithTimeout.ts` | — | `background/handlers/translate.ts`, `features/dictionaryPopup/services/communityAudioService.ts`, `features/dictionaryPopup/services/quickAddHandler.ts`, `entrypoints/offscreen/ffmpegRunner.ts` | AbortController-based fetch wrapper with timeout — prevents hung network requests in SW/offscreen |
| `shared/lib/dom/videoReady.ts` | — | `entrypoints/content/content-script.ts`, `entrypoints/content/ocrContentScript.ts` | **ADR-012 + ADR-081 SSOT**: `isVideoReady(v)` / `hasRealChildSrc(v)` — gate "SPA framework finished rendering this video" (blob src, currentSrc, readyState>=2, child source/track src). Moved out of content-script.ts so the OCR layer shares the same two-phase gate as the subtitle overlay |
| `shared/lib/chrome-apis/runtime.ts` | `chrome` | broad MV3 messaging | Thin `chrome.runtime.sendMessage` wrapper; supports optional dev override via `globalThis.__cellSendMessage` (used by design-system showcase mocks) |
| `shared/config/featureFlags.ts` | — | `features/dictionaryPopup/ui/mountPopupDictionary.ts` | Compile-time feature flags; `USE_LEGACY_POPUP_DICTIONARY` toggles the React popup path; legacy vanilla popup files removed in T069 |

### Content layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `entrypoints/content/content-script.ts` | pageScanner, initContentScriptController, clearAutoLoadCache, createWebTextDictionaryController, createWebTokenizeController, mountTokenizeFab, mountUniversalPanel, messages, config, settingsStore | `content-script-loader.js` (entry) | DOM scan → PAGE_SCAN_RESULT (**ADR-035: send `pageUrl: window.location.href`** as frame origin for DNR Origin); **PageScanner guard: top frame OR iframe with `<video>`** — scans cross-origin player iframes (e.g. moviepire.ru → vidnest.fun) while skipping ad/empty iframes; wire overlay + toggle + shortcuts + drag-drop + import; **MutationObserver** for SPA late-mount `<video>`; send cues/timeupdate/play-state to Side Panel via background relay; receive SEEK_TO from Side Panel (ADR-008); **ADR-010: module-level `initEpisodeChangeWatcher`** — MutationObserver persist observe `<video>` replacement → send VIDEO_EPISODE_CHANGED (episode switch clear, quality switch preserved); **ADR-012: `isVideoReady` gate** — `findAndInitOverlay` waits until `video.src` is `blob:` OR `readyState>=2` before init (Angular two-phase render on kisskh.co wipes foreign elements appended during phase 1; observer uses `attributeFilter:['src']` to catch phase-2 src assignment); **overlay re-init on SPA episode switch** — `reportEpisodeChangedIfReplacement` calls `findAndInitOverlay()` for new `<video>`; `currentVideo`/`lastSeenVideo` guards prevent duplicate init (Angular may mount/unmount same element during phase render); `currentOverlayCleanup` tears down old controller before re-init; **ADR-020: YouTube MAIN↔ISOLATED postMessage bridge** — listener for `__YT_DETECTED_SUBTITLES` → sendMessage(DETECTED_SUBTITLES), `__YT_INNERTUBE_FALLBACK` → sendMessage(INNERTUBE_FALLBACK_REQUEST); **T077: mounts `TokenizeFab` in a shadow root below the orbital badge** |
| `entrypoints/content/fetchInterceptor.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start) | **ADR-011**: patch `window.fetch`, postMessage `__DETECTED_SUBTITLE_FETCH` → ISOLATED listener → DETECTED_SUBTITLE_URL (catches cached subtitle fetches webRequest misses) |
| `entrypoints/content/youtube-main-world.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start, *://*.youtube.com/*) | **ADR-020**: read `window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks` → postMessage `__YT_DETECTED_SUBTITLES` (tracks+videoId); SPA re-detect via `yt-navigate-finish` + `popstate` + `pushState` hook + videoId dedup poll (2s timeout); InnerTube fallback request when DOM parse empty |
| `entrypoints/content/netflix-main-world.iife.ts` | — (self-contained IIFE) | `manifest.json` (world: MAIN, document_start, *://*.netflix.com/*) | **ADR-029**: DFS/BFS traverse `cadmiumPlayerRepository.playersById[sessionId]` for `type==='timedtext'` nodes with `urls[0].url` → pair with `getTimedTextTrackList()` metadata → postMessage `__NF_DETECTED_SUBTITLES` (tracks+movieId); poll 2-30s; SPA re-detect via pushState/replaceState/popstate; **pivoted from JSON hooks** (cadmium 6.0059+ uses schema parser) |
| `entrypoints/content/pageScanner.ts` | urls (constants) | `entrypoints/content/content-script.ts` | Scan `<video>`, `<source>`, `<track>`; **ADR-034: `<track>` URL bypass pattern filter** (element IS classifier, anikage.cc extension-less URL) |
| `content/subtitleParser.ts` | srtParser, vttParser, ttmlParser, types | subtitleDragDrop, subtitleImport | Adapter: parseSubtitle(content, format) → ParseResult (auto-detect: WEBVTT→vtt, <?xml/<tt→ttml, else srt) |
| `content/subtitleSync.ts` | types (SrtCue) | subtitleOverlay | Binary search: findCurrentLine(cues, currentTime) → index |
| `content/subtitleUI.ts` | types (OverlayConfig, OverlayStyleConfig, TextShadowConfig) | subtitleBlockController, SubtitlePreview | Pure style helpers: buildTextShadow (none/soft/cinema/custom), sanitizeFontFamily, hexToRgba — OverlayStyleConfig includes fontWeight (default 600) |
| `content/subtitleDragDrop.ts` | subtitleParser, types | subtitleImport | File read + parse: readFileAsText, handleFileDrop |
| `content/subtitleImport.ts` | subtitleDragDrop, types | subtitleOverlay, content-script.ts | Import button: createImportButton (appended to video parent, top-left, avoids toggle overlap), handleFileSelect |
| `content/subtitleOverlay.ts` | subtitleUI, subtitleImport, subtitleSync, types | content-script.ts | Orchestrator: SubtitleOverlayController (sync → overlay wiring) — **ADR-013**: 2 ref targetOverlay + nativeOverlay, onTimeUpdate 2 updateOverlayText, chrome.storage.onChanged listener |
| `content/subtitleAutoLoad.ts` | subtitleParser, subtitleMerge, subtitleOverlay, types (MessageRequest, BilingualCue), config | content-script.ts | Auto-load: shouldAutoLoad, validateOverride, fetchAndParseSubtitle (cache by URL + CORS fallback via FETCH_SUBTITLE_CONTENT), handleAutoLoadSubtitles (fetch+parse+load bilingual), formatFromUrl, clearAutoLoadCache — **wired Task 7+8** |
| `content/subtitleMerge.ts` | types (BilingualCue, SrtCue) | subtitleAutoLoad.ts | mergeCuesForPanel(targetCues, nativeCues) → BilingualCue[] (target skeleton, native best-effort overlap; fallback native skeleton when target empty) — **implemented Task 5** |
| `content/subtitleBilingualParser.ts` | srtParser, types (BilingualCue) | content-script.ts | Bilingual SRT parser: parseBilingualSrt (target lẻ/native chẵn, fallback single-language) — **implemented Task 2** |
| `features/subtitle/ui/netflixPlayback.ts` | — | reactSubtitleController.ts, navClusterActions, shortcutActionDispatcher.ts, contentScriptController.ts | **ADR-030**: seekVideo/playVideo/pauseVideo — Netflix M7375-safe; **ADR-031**: mountToWatchVideo; **T046**: seekToCue moved here from subtitlePanel.ts |
| `features/subtitle/ui/subtitleShortcuts.ts` | types (KeyboardShortcut) | contentScriptController.ts | Keyboard handler: handleShortcutKey (pure, guard input/textarea). **ADR-027**: default `generate-native` action (key `g`); default `play-pause` action (key ` ` — spacebar) |
| `features/subtitle/ui/contentScriptController.ts` | reactSubtitleController, mountSubtitle, subtitleShortcuts, shortcutActionDispatcher, subtitleAutoLoad, subtitleMerge, subtitleControllerHelpers, translatePrefill, settingsStore, tokenizeSettingsStore, cuesStore, types (SrtCue, BilingualCue, SubtitlePanelItem, Settings, TokenizeSettings) | content-script.ts | **M20 + T046**: Main subtitle UI orchestration. init returns cleanup; wires AUTO_LOAD_SUBTITLES, manager panel selection, generate-native flow, keyboard shortcuts (incl. `play-pause`), offset. **T046**: always instantiates `ReactSubtitleController` and mounts the React shadow-root subtitle UI (legacy DOM path removed in T046). **ADR-046**: shares `WebTextDictionaryController` for popup + highlight + card creator on subtitle tokens. **ADR-027**: `translatedNativeSlot` virtual replacement in manager panel; redesign — `createToggleButton()` returns element (no container append), `createSubtitleManagerPanel(container, opts)` (no importButton arg), `blockController.attachOverflowButtons({panelToggle, importButton, managerIcon})` moves overflow buttons into subtitle block slots, removes top-left toolbar + top-right panel-toggle from video surface. Real-time tokenize enable/disable via `syncSubtitleTokenize` reacting to `tokenizeSettings` storage changes. **Inline load status**: `onLoadStatus` dep wires `useCuesStore.setLoadStatus` — auto-load errors + "no subtitles" show inline in SubtitleBlock instead of toast; SPA nav resets status to idle. **SPA nav panel clear**: `onSpaNav` (yt-navigate-finish/popstate) + AUTO_LOAD null handler clear `autoTargetItems`/`autoNativeItems`/`targetMatches`/`nativeMatches`/`activeTargetIndex`/`activeNativeIndex` + `refreshPanel('target'|'native')` + `useCuesStore.setLoadStatus('none'/'idle')` — prevents stale tracks from previous video persisting in SubtitleManagerPanel after SPA nav to a video with no subtitles |
| `features/subtitle/ui/reactSubtitleController.ts` | subtitleCueEngine, mountSubtitle, subtitleUI, settingsStore, types | contentScriptController.ts | **T046**: React subtitle UI controller — wraps `SubtitleCueEngine` and `mountSubtitle`, owns offset persistence, play/pause, manager/offset panels, card-creator actions, side-panel toggle, generate-native. **Per-site offset persistence (ADR-019 amendment)**: `offsetKey` = `location.origin` (not full URL) so latency persists across episodes on SPAs like kisskh where each episode has a different URL but the same origin; `loadPersistedOffset` applies the loaded offset to mount/engine/manager after the async read (guarded by `destroyed`); `persistOffset` read-modify-writes the `subtitleOffset` map (shallow `saveSettings` would otherwise wipe other sites); `buildManagerState` exposes `offsetMs` so the panel's Latency stepper initializes from the current offset instead of 0; `setOffsetMs` refreshes manager state so reopening after a change shows the live value |
| `content/subtitleBlockController.ts` | subtitleBlockDom, subtitleBlockDrag, subtitleBlockScale, navClusterActions, navClusterIcons, themeTokens (syncElementTheme), types (SrtCue, NavClusterSettings, SubtitleBlockSettings, OverlayStyleConfig) | contentScriptController.ts | **ADR-025**: SubtitleBlockController class — unified block merging target overlay + native overlay + nav cluster into single draggable block. Constructor: (video, container, blockSettings, targetStyle, nativeStyle, clusterSettings, offsetProvider?, onPersist?). Lifecycle: init/updateSettings/loadBilingualCues/updateCues/destroy. `applyLineStyles` sets color, bg+alpha, textShadow, fontFamily, **fontWeight**, textAlign, opacity. Wires drag (subtitleBlockDrag), auto-scale (subtitleBlockScale), fullscreen re-parent, theme sync (syncElementTheme). **ADR-046**: `enableDictionaryPopup`/`disableDictionaryPopup`/`setDictionaryPopupTriggerMode` wire `SubtitleTriggerController`; `enableDictionaryPopup` live-updates the existing controller's mode instead of leaving the first-selected mode stuck |
| `content/subtitleBlockDom.ts` | navClusterIcons | subtitleBlockController.ts | **ADR-025**: createSubtitleBlockDOM() pure factory — builds block > body > (clusterColumns + subtitleColumn + rightColumn) |
| `content/subtitleBlockDrag.ts` | types (SubtitleBlockSettings) | subtitleBlockController.ts | **ADR-025**: wireBlockDrag() pure function — Pointer Events drag for block Y position |
| `content/subtitleBlockScale.ts` | — | subtitleBlockController.ts | **ADR-025**: createBlockScaleObserver() + computeScaleSnapshot() — auto-scale block to fit container width |
| `content/subtitleBlockCss.ts` | — | subtitleBlockController.ts | **ADR-025**: Block CSS injection |
| `content/navClusterActions.ts` | subtitleSync (findCurrentLine), types (SrtCue) | subtitleBlockController.ts | **ADR-018**: Pure action helpers — findActiveCueIndex (target-primary native-fallback), prevSentence/nextSentence (gap fallback), seekBy ([0,duration] clamp + NaN/Infinity live-stream) |
| `content/navClusterButton.ts` | navClusterIcons | subtitleBlockController.ts | **ADR-018**: Atom — createNavClusterButton DOM factory (inline SVG icons via navClusterIcons, click/hold handlers + aria-pressed toggle) |
| `content/navClusterKeyboard.ts` | subtitleShortcuts (isEditableTarget) | subtitleBlockController.ts | **ADR-018**: Pure keyboard state machine — handleClusterKeydown/up (ArrowLeft/Right, R hold with e.repeat ignore + repeatHolding guard, </, >/), cancelRepeatHold (blur/visibilitychange) |
| `content/navClusterIcons.ts` | — | subtitleBlockDom.ts, navClusterButton.ts, subtitleBlockController.ts | **ADR-018**: Pure SVG icon string map (NAV_CLUSTER_ICONS: prev/next/repeat/rewind/forward — currentColor stroke, aria-hidden, 24x24 viewBox). Source: docs/mockups/icon-svg/ (svgrepo, recolored to currentColor) — **note: icon-svg/ đã xóa, thay bằng docs/design-system/icon/ (Lucide reference catalog)** |
| `content/navClusterCss.ts` | — | themeTokens (injectThemeTokens), design-system-showcase/NavClusterPreview | **ADR-018 T004**: Layout-only cluster CSS (positioning, display, transform, cursor, pointer-events). Injected as a string into content-script `<style>` and the design-system `NavClusterPreview` shadow root. Visual/themable styles (color, spacing, radius, transitions, effects) now live in `NavCluster.module.css` and are concatenated with this string at runtime |
| `content/NavCluster.module.css` | tokens.css, tokens.json | themeTokens (injectThemeTokens), design-system-showcase/NavClusterPreview | **T004**: Nav cluster visual/themable styles via `var(--*)` tokens. Imported as `?inline` string so it can be injected alongside `navClusterCss.ts` into content-script or design-system shadow root |
| `content/offsetController.ts` | subtitleOffsetPanel (createOffsetSection), subtitleOffsetBadge, subtitleOffset (logic), settingsStore (saveSettings/loadSettings), types (Settings) | contentScriptController.ts | **ADR-019**: OffsetController class — subtitle time offset orchestrator. Lifecycle: init (idempotent, builds section nested trong manager panel + floating badge) → loadCues (hasSubtitle bool, reset on unload) → destroy. State machine: committed (persisted, badge hidden) ↔ lazy (apply all ngay, badge visible, timer 2 phút). Wall-clock auto-commit via timeupdate + visibilitychange (no setTimeout — MV3 throttle safe). Persist per-URL vào settings.subtitleOffset (value=0 → remove key). Public stepBy/reset cho keyboard |
| `content/subtitleOffsetPanel.ts` | subtitleOffset (logic: OffsetState, formatOffsetDisplay) | offsetController.ts | **ADR-019**: Offset section DOM factory — collapsible section nested trong Subtitle Manager Panel (mimic createSection pattern). Header (chevron + "OFFSET" + value display) + body (4 states: disabled/default/lazy-active/committed, 4 steppers ±0.5s/±2s, input + apply + reset full-width, flashSaved "✓ Đã lưu" 1.5s). Inversion of control: nhận handlers callback |
| `content/subtitleOffsetBadge.ts` | subtitleOffset (logic: AUTO_COMMIT_MS) | offsetController.ts | **ADR-019**: Lazy badge DOM factory — pill top-right overlay, "Xem thử · M:SS" + pulse dot, click=reset, keyboard accessible (Enter/Space), tabIndex=0, role=status, aria-label dynamic. Idempotent keyframes injection |
| `content/subtitleOffset.ts` (logic) | — | subtitleOffsetPanel, subtitleOffsetBadge, offsetController, subtitleSync (findCurrentLine offsetMs) | **ADR-019**: Pure offset logic — OffsetState (valueMs/mode/lastActionAt), INITIAL_OFFSET_STATE, parseOffsetInput (string→ms|null), clampOffsetMs (±60s), shouldAutoCommit (wall-clock > 2 phút), formatOffsetDisplay (+0.500s/-2.000s), AUTO_COMMIT_MS=120000 |
| `entrypoints/content/ocrContentScript.ts` | OcrController, OcrOverlay (createHitboxes, wireOcrHitboxesToTrigger), ocrPipeline (runPipelineStep, OcrPipelineState, DEFAULT_PIPELINE_CONFIG), frameCapture (captureFrame, scheduleNextFrame), ocrStateStore (isOcrEnabledForUrl, loadOcrSettings, extractOriginFromUrl), ocrStateTypes (OcrOriginState), SubtitleTriggerController (type) | content-script.ts (init call) | **Orca OCR layer (spec §AD1-§AD7)**: OcrSession class — manages full pipeline for one video (controller + overlay + pipelineState). `start(video, originState)` → init engine + attach overlay + rVFC loop. `loop()` skips paused/ended frames. `processFrame()` calls `runPipelineStep` → on `ocr` status creates per-script-run hitboxes + wires to SubtitleTriggerController (T16). `stop()` disposes engine + detaches overlay. **T19**: `initOcrContentScript()` sets up chrome.storage.onChanged listener → toggle ON/OFF re-inits session. **T20**: auto-start on page load + SPA nav (`yt-navigate-finish`, `popstate`) re-checks origin via `initOcrForCurrentUrl`. `stopOcrSession()` for toggle OFF. `setTriggerController(tc)` wires dictionary popup **ADR-081**: SPA video watcher — MutationObserver (childList+subtree+attributeFilter src) waits for a READY video then retries `initOcrForCurrentUrl()` once; auto-restores the saved custom region after reload on SPA sites; disconnects on session start/disable/origin change |
| `entrypoints/content/ocrController.ts` | ocrRunner (sendMessage OCR_INIT/OCR_RECOGNIZE/OCR_DISPOSE), ocrEngine types | ocrContentScript.ts | **Orca T9**: OcrController — proxy to offscreen OCR engine via chrome.runtime messaging. `init(languageMode, backend)` → OCR_INIT message → background creates offscreen document + forwards to ocrRunner. `recognize(image, minScore)` → OCR_RECOGNIZE → returns OcrResult[]. `dispose()` → OCR_DISPOSE. State machine: UNINIT → INITIALIZING → READY → DISPOSED |
| `entrypoints/offscreen/ocrRunner.ts` | paddleOcrEngine (PaddleOcrEngine), ocrEngine types | background/handlers/ocr.ts | **Orca T9**: Offscreen document OCR runner — owns PaddleOcrEngine instance. Receives OCR_INIT/OCR_RECOGNIZE/OCR_DISPOSE messages from background. PaddleOcrEngine lazy-loads @paddleocr/paddleocr-js (WebGPU preferred, WASM fallback). **T21**: WebGPU shader JIT warmup — runs dummy predict() on 64×32 black canvas after init to trigger shader compilation (hides 5s first-run stall) |
| `entrypoints/background/handlers/ocr.ts` | offscreen (createOffscreenDocument, closeOffscreenDocument), messages (OCR_INIT/OCR_RECOGNIZE/OCR_DISPOSE) | background/index.ts | **Orca T9**: Background OCR handler — bridges content-script ↔ offscreen document. Creates offscreen document on first OCR_INIT, forwards messages, closes on OCR_DISPOSE |
| `entrypoints/background/handlers/reader.ts` | MESSAGE_TYPES.OPEN_READER, OpenReaderPayloadSchema, chrome.tabs.create | background/index.ts | Reader background handler — opens reader page via chrome.tabs.create with optional bookId |
| `features/ocr/engine/paddleOcrEngine.ts` | @paddleocr/paddleocr-js, ocrEngine (OcrEngine), ocrEngine types | offscreen/ocrRunner.ts | **Orca T1-T3**: PaddleOcrEngine — wraps PaddleOCR.js PP-OCRv5 mobile. `initialize(config)` → PaddleOCR.create({lang, ocrVersion, ortOptions}). `recognize(image, options)` → OffscreenCanvas + predict() → adaptResult → OcrResult[]. `dispose()` releases instance. **T21**: `warmupShaderJit()` private method — dummy predict on 64×32 black canvas. LANG_MAP: auto/zh/en/ja → 'ch' (PP-OCRv5 'ch' model covers CN+EN+JA mixed) |
| `features/ocr/engine/ocrEngine.ts` | ocrEngine types | paddleOcrEngine.ts | **Orca T1**: OcrEngine interface — initialize(config), recognize(image, options), dispose(), getBackend() |
| `features/ocr/engine/types.ts` | — | paddleOcrEngine, ocrPipeline, ocrOverlay, ocrController | **Orca T1**: OCR type definitions — ImageSource (RGBA Uint8ClampedArray), OcrResult, OcrResultItem (poly + text + score), OcrConfig, OcrOptions, OcrBackend, Quad |
| `features/ocr/pipeline/frameCapture.ts` | ocrEngine types (ImageSource) | ocrContentScript.ts | **Orca T8**: `captureFrame(video, canvas?)` → rVFC + OffscreenCanvas.drawImage + getImageData → ImageSource. `scheduleNextFrame(video, callback)` → requestVideoFrameCallback (rAF fallback). Reuses canvas to avoid allocation |
| `features/ocr/pipeline/drmGuard.ts` | ocrEngine types (ImageSource) | ocrPipeline.ts | **Orca T5**: `checkDrmGuard(image)` → meanLuma < 16 → isDrm=true. Detects black DRM frames |
| `features/ocr/pipeline/lumaDiff.ts` | ocrEngine types (ImageSource) | ocrPipeline.ts | **Orca T6**: `regionMeanLuma(image, region)` → average luma of subtitle region. `shouldRunOcr(current, previous, threshold)` → luma diff check. `subtitleRegionHash(image, region)` → 8×8 pHash for dedup |
| `features/ocr/pipeline/cropRegion.ts` | ocrEngine types (ImageSource) | ocrPipeline.ts | **Orca T7**: `computeSubtitleRegion(width, height, pct)` → bottom pct% region. `cropImage(image, region)` → cropped ImageSource |
| `features/ocr/pipeline/regionMapping.ts` | ocrStateTypes (CustomRegion) | regionSelector.ts | **Region scan-fix**: `mapShellToIntrinsic` / `mapIntrinsicToShell` — O(1) affine transform between SHELL-space (% of overlay container) and INTRINSIC-space (% of videoWidth/Height). Accounts for video offset within shell + object-fit (contain/fill/cover/none/scale-down) letterboxing + object-position. `computeContentRect(box, intrinsic, fit, pos)` → displayed content rect in box-space. `parseObjectPosition(css)` → {x,y} fractions. `readVideoGeometry(video, shell)` → live DOM geometry reader (shellRect, videoRect, intrinsic, objectFit, objectPosition). `clampRegion` → [0,100] bounds. Fixes "OCR scan sai vùng" when shell ≠ video content (control bar, pillarbox, letterbox). 42 unit tests in regionMapping.test.ts |
| `features/ocr/pipeline/ocrPipeline.ts` | drmGuard, lumaDiff, cropRegion, scriptRunSegmenter, ocrEngine types | ocrContentScript.ts | **Orca T12 + T10 + T22**: `runPipelineStep(image, recognizeFn, state, config, frameTimeMs)` → PipelineStepResult. Order: (1) time gate 3fps `shouldRunByTimeGate` (T10, default 333ms), (2) DRM guard, (3) luma-diff, (4) pHash dedup, (5) crop, (6) OCR with retry `maxRetries` (T22, default 3), (7) script-run segment, (8) text dedup `textMatchesPrevious` (T10), (9) update state. `OcrPipelineState` tracks previousLuma/Hash/Text/lastOcrTimeMs/drmDetected. `DEFAULT_PIPELINE_CONFIG`: subtitleRegionPct=15, lumaDiffThreshold=3, minScore=0.5, minFrameIntervalMs=333, maxRetries=3 |
| `features/ocr/language/scriptRunSegmenter.ts` | — | ocrPipeline.ts, ocrOverlay.ts | **Orca T14**: `scriptRunSegmenter(text)` → ScriptRun[] (text + script: 'zh'|'en'|'ja'|'unknown'). Unicode range detection: CJK → zh, Hiragana/Katakana → ja, Latin → en |
| `features/ocr/language/languageRouter.ts` | scriptRunSegmenter (ScriptRun) | ocrOverlay.ts | **Orca T15**: `routeScriptRunToLangCode(scriptRun)` → langCode ('zh'|'en'|'ja'). Maps script → language plugin code. `routeScriptRunsToLangCodes(runs)` → batch |
| `features/ocr/overlay/ocrOverlay.ts` | ocrEngine types, scriptRunSegmenter, languageRouter, subtitleTriggerController (type) | ocrContentScript.ts | **Orca T13 + T16 + T17**: `createHitboxes(items, scriptRuns)` → OcrHitbox[] (per-script-run, widthFraction + offsetFraction). `quadToCssRect(poly, vw, vh, dw, dh, widthFrac?, offsetFrac?)` → bounding box rect with scaling. `createHitboxElement(hitbox, rect)` → span.cell-ocr-hitbox (data-cell-term, data-cell-lang). `OcrOverlay` class: attach(video), updateHitboxes(hitboxes, vw, vh), clear(), detach(), getHitboxElements(). `wireOcrHitboxesToTrigger(overlay, triggerController)` → groups hitboxes by langCode → triggerController.attach(spans, sentence, langCode) per group (T16) |
| `features/ocr/persistence/ocrStateStore.ts` | ocrStateTypes (OcrSettings, OcrOriginState), chrome.storage.local | ocrContentScript.ts, OcrSettingsPanel.tsx | **Orca T17**: `loadOcrSettings()` → OcrSettings from chrome.storage.local. `saveOcrSettings(settings)`. `isOcrEnabledForUrl(settings, url)` → origin check. `setOcrPreference(settings, origin, state)`, `clearOcrPreference(settings, origin)`, `extractOriginFromUrl(url)` |
| `features/ocr/persistence/ocrStateTypes.ts` | — | ocrStateStore.ts, ocrContentScript.ts, OcrSettingsPanel.tsx | **Orca T17**: OcrOriginState (ocrEnabled, languageMode, subtitleRegionPct). OcrSettings (schemaVersion, origins: Record<origin, OcrOriginState>). DEFAULT_OCR_ORIGIN_STATE, DEFAULT_OCR_SETTINGS, OCR_SETTINGS_SCHEMA_VERSION=1 |
| `features/ocr/overlay/regionSelector.ts` | tokens (STATIC_TOKENS), icons (checkIcon, xIcon), ocrStateTypes (CustomRegion), regionMapping (mapShellToIntrinsic, mapIntrinsicToShell, readVideoGeometry) | ocrContentScript.ts (OcrSession), OcrSettingsPanel.tsx (formatPct) | **ADR-081 + region scan-fix**: RegionSelector class — view/select/edit overlay on video parent. **Public API (attach/updateRegion/getRegion/onRegionChange) = INTRINSIC-space** (% of videoWidth/Height, SSOT for crop); **internal storage + CSS = SHELL-space** (% of overlay container). `toShellRegion`/`toIntrinsicRegion` convert at boundaries via regionMapping — fixes "OCR scan sai vùng" when shell ≠ video content (letterbox, control bar). `render()` uses internal shell-space region for CSS positioning + shows intrinsic-space dims in label. `render()` UPDATES nodes (handles created once per edit entry with mousedown bound at creation, %-anchored CSS tracks resizes; toolbar rebuilt only on view↔interactive boundary) — never recreates interactive nodes, fixing dead resize handles after the first move drag. Styling via one injected `#cell-ocr-region-style` class sheet driven by `--overlay-ocr-region-*` tokens + `--radius-pill`; `data-mode` on rect drives cursor/fill; `formatPct()` rounds displayed %. `defaultBottomRegion(pct, widthPct)` centered-bottom region. Tests in regionSelector.test.ts (16 tests: 11 regression + 5 intrinsic-space contract with letterbox) |
| `features/ocr/cache/ocrCache.ts` | — | ocrContentScript.ts | **Orca T11**: OcrCache class — LRU cache keyed by (videoId, timestampBucket). `get(videoId, timestampMs)` → cached OcrResult[] | null. `set(videoId, timestampMs, results)`. Bucket size 1s. Max 500 entries. `clear(videoId?)` |
| `features/ocr/ui/OcrSettingsPanel.tsx` | Toggle, Select, SliderRow, Button (shared/ui), ocrStateStore, ocrStateTypes | SubtitleManagerPanel.tsx (OCR tab) | **Orca T17-T20 + ADR-081 + 4-card redesign**: Manager Panel OCR tab UI — 4 tách biệt card: (1) Toggle per-origin (icon scanText), (2) Languages — stacked label+select full-width (108-lang PaddleOCR), (3) Split dual-stream toggle + segment buttons + ratio slider, (4) Capture region — 4 sliders (X/Y/W/H %) + region action buttons (vertical ghost fullWidth: Select/Edit/Reset). Section headers uppercase+tracking (iOS Settings group label). Select bg muted+border emphasized. Toggle sm 28px (matches button-height-sm). Region buttons vertical (icon top, label bottom, border-radius 0). Persists to chrome.storage.local on change |
| `features/dictionaryPopup/logic/lookupOrchestrator.ts` (T23 update) | getAllResources, findDictionaryByResource, pluginRegistry, languagePlugin | ocrContentScript (via trigger) | **T23**: Module-level `probeCache: Map<langCode, TermProbe>` — `createDictionaryProbeAsync(langCode)` returns cached probe if available, else loads + caches. `clearDictionaryProbeCache()` invalidates (call after dictionary import). Avoids reloading 120k CEDICT terms per lookup — essential for OCR high-frequency lookups |

### Side Panel layer (ADR-008)

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `sidepanel/index.html` | — | Vite (sidepanel entry) | HTML shell for Side Panel |
| `sidepanel/main.tsx` | App | `index.html` | React entry point |
| `sidepanel/App.tsx` | useSidePanelStore, CueList, getActiveContentTab, **handleShortcutKey** (content/subtitleShortcuts), **DEFAULT_KEYBOARD_SHORTCUTS** (config), **loadSettings** (storage/settingsStore), **onStorageChanged/removeOnStorageChangedListener** (chrome-apis), types | `main.tsx` | Side Panel UI: header (title + cue count + play state), CueList; listens for SUBTITLE_CUES_LOADED/VIDEO_TIME_UPDATE/VIDEO_PLAY_STATE from background (**two-layer filter ADR-011 v3**: Layer 2 defense-in-depth — drop `tabId === undefined` (raw content-script broadcast, bypass background) + drop `tabId !== activeTabIdRef`); sends SEEK_TO on cue click; **ADR-009: Spacebar → TOGGLE_PLAY, hotkeys (a/d/s/w/t/pause) → SHORTCUT_ACTION / TOGGLE_PLAY** (reuse handleShortcutKey, load shortcuts from storage); REQUEST_SUBTITLE_CUES on mount + **on tab switch** (syncActiveTab resets store + re-fetches cached cues); **ADR-011: activeTabIdRef + chrome.tabs.onActivated (re-fetch on tab switch) + chrome.tabs.onUpdated loading (clear store on same-tab navigate, mirror background lastCuesByTab.delete)**; **theme sync: loadSettings → set `document.documentElement.dataset.theme` + onStorageChanged listener for realtime toggle from popup** (theme.css uses `[data-theme="dark"]` selector, not prefers-color-scheme) |
| `sidepanel/store/sidePanelStore.ts` | zustand, types (BilingualCue) | App, CueList | State: cues, currentTimeMs, durationMs, isPlaying; actions: setCues, setCurrentTime, setPlaying, currentCueIndex — **half-open [start,end)** (boundary overlap fix) |
| `sidepanel/components/CueList.tsx` | types (BilingualCue) | App | Cue list with **human-friendly timestamps** (adaptive `M:SS`/`H:MM:SS`, no leading zeros/millis), bilingual text, highlight current cue (primary-subtle bg + 3px accent bar), auto-scroll (**instant `behavior:'auto'`** — smooth scroll across long list caused motion sickness), **timestamp `user-select:none` + `data-no-lookup`** (seek-only, không tra dictionary), click → onSeek(cue.start); **half-open [start,end)** findIndex |

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
| `features/settings/ui/SettingsDialog.tsx` | Settings, Icon, IconButton, **SettingsDialogContent**, styles | mountSettingsDialog, popup App, OptionsApp | Dialog wrapper: overlay + popover shell + close button + Escape handling; renders `SettingsDialogContent` |
| `features/settings/ui/SettingsDialogContent.tsx` | Settings, types, config, languageRegistry, MultiSelect, CardCreatorSettingsPanel, DictionaryPopupSettingsPanel, ThemePanel, TtsVoiceManagerPanel, ResourcesPanel, Toggle, ShortcutInput, SearchableSelect, Select, HintIcon, styles | SettingsDialog, SettingsTab | Reusable settings body: sidebar + all settings sections (tokenize section removed — moved to universal panel header ADR-061; Target/Native/Cluster appearance sections removed — moved to Subtitle Manager Panel ADR subtitle-appearance-in-manager); accepts `className` for embedding in the universal panel |
| `popup/components/settings/MultiSelect.tsx` | — | SettingsDialogContent | Reusable searchable multi-select (search input + checkbox list + footer). Used cho subtitle language selection |
| `shared/ui/Toggle.tsx` | — | SettingsDialogContent, NavClusterSettingsPanel, OcrSettingsPanel | Switch pill; sm=28px (matches button-height-sm), md=touch-target 40/44px, lg=48px |
| `shared/ui/Slider.tsx` | — | NavClusterSettingsPanel | Styled range; touch-target aware 40/44px (settings-controls-restyle F2) |
| `shared/ui/ShortcutInput.tsx` | — | SettingsDialogContent | **ADR-021 D7**: Pill-style input (radius-full, min-width 140px) — single-char pill (uppercase center) + combo pill (Ctrl+Shift+T kbd chips, modifier subtle bg, key solid primary). Captures keydown, supports combo modifiers. Backward compat 5 old shortcuts. |
| `shared/ui/SearchableSelect.tsx` | — | SettingsDialogContent | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `shared/ui/HintIcon.tsx` | — | SettingsDialogContent, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |

### Universal Panel layer (ADR-065)

|| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
||------|-----------|-----------------|--------------------------|
|| `features/universalPanel/types.ts` | — | UniversalPanel, UniversalPanelController, mountUniversalPanel | `UniversalPanelTab`, `DictionaryPanelPrefill`, `UniversalPanelController` interface (includes `sendToCard`) |
|| `features/universalPanel/UniversalPanelController.ts` | types, chrome storage | mountUniversalPanel | `createUniversalPanelController`: imperative open/close/switchTab + `sendToCard` + session persistence |
|| `features/universalPanel/UniversalPanel.tsx` | types, Icon, IconButton, useFocusTrap, UniversalPanelHeader, TokenizePanelState | mountUniversalPanel | React shell: vertical tab bar, backdrop, universal header (tokenize toggles + close), Escape, focus trap, responsive bottom sheet |
|| `features/universalPanel/UniversalPanel.module.css` | tokens | UniversalPanel | Slide-in panel styles: 1280px max-width, mobile bottom sheet, animations; `.body` wraps header + content |
|| `features/universalPanel/UniversalPanelHeader.tsx` | IconButton, Toggle, Icon, TokenizePanelState | UniversalPanel | ADR-061: minimal horizontal header — 3 Toggle (Status/Frequency/Tokenize) cluster + close IconButton; Status/Frequency disabled while tokenize off |
|| `features/universalPanel/UniversalPanelHeader.module.css` | tokens | UniversalPanelHeader | Header flex layout: space-between cluster + close, mobile hides toggle labels |
|| `features/universalPanel/mountUniversalPanel.ts` | UniversalPanel, UniversalPanelController, themeTokens, chrome-apis, config, settingsStore, TokenizePanelState | content-script.ts | Mount fixed host + React root + theme sync + fullscreen reparenting; subscribes tokenize state at mount level and forwards to UniversalPanel header (ADR-061); handles `controller.sendToCard` by storing a persistent `pendingPrefill` and a one-shot `pendingSearchTerm`, then rendering `DictionaryTab` with `initialTerm` + `prefill`; returns controller |
|| `features/universalPanel/tabs/SettingsTab.tsx` | SettingsDialogContent, settingsStore, chrome-apis, config, entities/media | mountUniversalPanel | Loads/saves settings, syncs via `chrome.storage.onChanged`, auto-focuses first non-sidebar control (tokenize bridge removed — moved to universal header) |
|| `features/universalPanel/tabs/SettingsTab.module.css` | tokens | SettingsTab | Constrains settings body to `max-width: 75rem` so it is not stretched by the 1280px panel; flex layout with single scrollbar |
|| `features/universalPanel/tabs/DictionaryTab.tsx` | Dictionary, CardCreatorPanel, dictionaryPopup types | mountUniversalPanel | Two-pane layout (left dictionary / right card creator); uses `Dictionary variant='integrated'` as the panel core; accepts external `initialTerm` + `prefill` props, syncs `prefill` into local state, and passes `sourceLang`/`targetLang` to `CardCreatorPanel` |
|| `features/universalPanel/tabs/DictionaryTab.module.css` | tokens | DictionaryTab | Two-pane flex; mobile stack |
|| `features/universalPanel/tabs/CardCreatorPanel.tsx` | settingsStore, chrome-apis, config, CardCreatorDialogContent, useCardCreatorState, webTextDictionaryController/formatDefinitions | DictionaryTab | Loads Card Creator settings; builds `OpenContext` from prefill; renders `CardCreatorDialogContent` directly inside the panel with `className` for panel padding |
|| `features/universalPanel/tabs/CardCreatorPanel.module.css` | tokens | CardCreatorPanel | Right pane flex layout: full height, overflow scrolling, subtle left border; `.panelBody` applies `padding: var(--space-4)` to the integrated card-creator body |
|| `features/universalPanel/UniversalPanel.test.tsx` | UniversalPanel, UniversalPanelController, testing-library, TokenizePanelState | — | Unit tests: open/close, tab switch, persistence, backdrop/Escape close, header toggles + disabled gating |
|| `features/universalPanel/UniversalPanelController.test.ts` | createUniversalPanelController, testing-library | — | Unit tests: open/close/switchTab, sendToCard, session persistence, unmount/rapid-call edge cases |
|| `features/universalPanel/tabs/SettingsTab.test.tsx` | SettingsTab, mocks for SettingsDialogContent/settingsStore/chrome-apis | — | Unit tests: load/save/sync, initial focus (tokenize bridge + onOpenDictionary removed — moved to universal header) |
|| `features/universalPanel/mountUniversalPanel.test.tsx` | mountUniversalPanel, UniversalPanelController, mocks for SettingsDialogContent/settingsStore/chrome-apis | — | Integration test: tab switch, sendToCard prefill + one-shot term clear, prefill survives tab switches |
|| `features/universalPanel/tabs/DictionaryTab.test.tsx` | DictionaryTab, mocks for runtime sendMessage/translation/CardCreatorPanel | — | Unit tests: left/right panes, initial search, Send to Card prefill, Quick Add prefill, status cycle, all 4 media tabs |
|| `features/universalPanel/tabs/CardCreatorPanel.test.tsx` | CardCreatorPanel, mocks for settingsStore/chrome-apis/useCardCreatorState/CardCreatorDialogContent | — | Unit tests: settings load, prefill mapping, storage change re-sync |
|| `features/dictionaryPopup/logic/useDictionaryLookup.ts` | runtime, messages, wordStatusStore, definitionSelection | useDictionaryPanel, PopupDictionary | Headless hook: LOOKUP_REQUEST/LOOKUP_CANCEL, search/loading/error, currentResult/candidates, status cycle, definition selection |
|| `features/dictionaryPopup/logic/useDictionaryToolbar.ts` | runtime, messages, translation, settingsStore | useCandidate | Headless hook: active tab, lazy audio/image/translate fetch, selection maps/counts, external dict links; reused by useCandidate (per-candidate media) |
||| `features/dictionaryPopup/logic/useDictionaryToolbar.test.ts` | useDictionaryToolbar, mocks | — | Unit tests: links, audio/image/translate fetch, selection toggles, result reset |
||| `features/dictionaryPopup/logic/useDictionaryLookup.test.ts` | useDictionaryLookup, mocks | — | Unit tests: search, cancel, candidates, status cycle, definition selection, reset |
|| `features/dictionaryPopup/ui/useDictionaryPanel.ts` | useDictionaryLookup | DictionaryPanelView | Hook: search input, LOOKUP_REQUEST/CANCEL, loading/error, currentResult + candidates, context sentence, getTokenStatus/syncStatus plumbing |
|| `features/dictionaryPopup/ui/useDictionaryPanel.test.ts` | useDictionaryPanel, mocks | — | Unit tests: search, cancel, candidates, context sentence, getTokenStatus fallback, syncStatus |
|| `features/dictionaryPopup/ui/useCandidate.ts` | useDictionaryToolbar, runtime, wordStatusStore, wordStatusClient, buildCandidatePrefill, definitionSelection | CandidateView | Hook: composes useDictionaryToolbar; adds definition selection, status cycle, play TTS, selection counts, external dict links, and card-creator prefill |
|| `features/dictionaryPopup/ui/AudioPanel.tsx` | shared/ui, icons, DictionaryPanelView.module.css | CandidateView | React panel: word/sentence audio, TTS fallback, selection |
|| `features/dictionaryPopup/ui/AudioPanel.test.tsx` | AudioPanel | — | Unit tests: skeleton, error, word/sentence group, selection toggle, TTS fallback |
|| `features/dictionaryPopup/ui/ImagePanel.tsx` | shared/ui, icons, DictionaryPanelView.module.css | CandidateView | React panel: image strip, selection, Google Images fallback, image-error handling |
|| `features/dictionaryPopup/ui/ImagePanel.test.tsx` | ImagePanel | — | Unit tests: skeleton, error, fallback link, selection, selected state |
|| `features/dictionaryPopup/ui/TranslatePanel.tsx` | shared/ui, icons, DictionaryPanelView.module.css | CandidateView | React panel: source/translation display, loading, error, toggle selection |
|| `features/dictionaryPopup/ui/TranslatePanel.test.tsx` | TranslatePanel | — | Unit tests: skeleton, error, empty trigger, translation display, toggle selection |
|| `features/dictionaryPopup/ui/LinksPanel.tsx` | shared/ui, icons, DictionaryPanelView.module.css | CandidateView | React panel: external dictionary links with safe target/rel |
|| `features/dictionaryPopup/ui/LinksPanel.test.tsx` | LinksPanel | — | Unit tests: empty state, external links with rel=noopener noreferrer |
|| `features/dictionaryPopup/ui/DictionaryToolbar.tsx` | shared/icons, DictionaryPanelView.module.css | CandidateView | React tab bar: 4 tab buttons with icons and selection-count badges |
|| `features/dictionaryPopup/ui/DictionaryToolbar.test.tsx` | DictionaryToolbar | — | Unit tests: 4 tabs, onSelect callback, active state, count badges |
|| `features/dictionaryPopup/ui/CandidateView.tsx` | shared/ui, icons, rankToBand, config, useCandidate, AudioPanel, ImagePanel, TranslatePanel, LinksPanel, DictionaryToolbar, DictionaryPanelView.module.css | DictionaryPanelView | React card: candidate header, DictionaryToolbar, lazy media panels, definitions; uses useCandidate (per-candidate hook) |
|| `features/dictionaryPopup/ui/CandidateView.test.tsx` | CandidateView, mocks for sendMessage/translateSentence | — | Unit tests: header, status cycle, audio/image/translate/links panels, selection badges, sendToCard, quickAdd |
|| `features/dictionaryPopup/ui/buildCandidatePrefill.ts` | types | useCandidate | Pure function: build PopupCardCreatorPrefill from candidate + selections |
|| `features/dictionaryPopup/ui/buildCandidatePrefill.test.ts` | buildPrefill, types | — | Unit tests: definition selection, audio/image selection carry-over, fallback to first item per kind |
|| `features/dictionaryPopup/controller/webTextDictionaryController.test.ts` | createWebTextDictionaryController, mountPopupDictionary mocks, PopupDictionary mocks, sendMessage mocks, screenshot/sentenceAudio mocks | — | Unit tests: lookup, popup show/hide, Send to Card routing to universal panel vs standalone dialog, subtitle video Send to Card captures screenshot + sentence audio, highlight |
||| `features/dictionaryPopup/ui/usePopupPosition.ts` | popupGeometry (constants, types, computePopupPosition, clampPopupSize, finalizePosition), React | Dictionary | React hook: viewport-aware position, drag, resize, and bottom-sheet logic reused from popupGeometry pure helpers. In Player Mode, reads document bounds and anchors sheet between video bottom and dock top. Sheet handle: 1:1 drag = height (no translate, no tier snap), stop position = sheet height; click on handle (≤4px move) = close; drag past 20% vh (raw projected height) = close |
||| `features/dictionaryPopup/ui/usePopupPosition.test.ts` | usePopupPosition, React | — | Unit tests: initial position, viewport resize, drag, resize, sheet handle 1:1 drag, handle click-to-close, 20%-vh dismiss, no-tier-snap, content-swipe dismiss |
|| `features/dictionaryPopup/ui/Dictionary.tsx` | shared/ui, icons, DictionaryPanelView, usePopupPosition, PopupDictionary.module.css | PopupDictionary, DictionaryTab | React dictionary shell with `variant: 'popup' | 'integrated'` — popup is a compact card (no title bar, no search row/history, keeps resize/sheet handle and mounts DictionaryPanelView); integrated renders DictionaryPanelView directly |
|| `features/dictionaryPopup/ui/PopupDictionary.tsx` | Dictionary | mountPopupDictionary | Thin wrapper over `Dictionary variant='popup'`; kept for backwards-compatible imports |
|| `features/dictionaryPopup/ui/PopupDictionary.test.tsx` | PopupDictionary, mock for DictionaryPanelView | — | Unit tests: dialog shell, props passed to DictionaryPanelView, inline style, anchor-derived position, sheet mode; popup has no header/close drag |
|| `features/dictionaryPopup/ui/PopupDictionary.module.css` | tokens | PopupDictionary | Popup shell layout, header, content, resize handle, sheet handle, isSheet bottom-sheet styles |
|| `features/dictionaryPopup/ui/mountPopupDictionary.ts` | mountReactShadow, ShadowThemeProvider, PopupDictionary, popupGeometry.getMountParent, per-component inline CSS modules | webTextDictionaryController (T070) | Mount PopupDictionary into shadow root, click-outside via composedPath (skipped when `dismissOnOutsideClick: false` — sheet mode keeps popup open across lookups), z-index below orbital, fullscreen-aware; `setOptions` updates sourceLang/targetLang/size/sheetHeight/term/context/cursor without re-mounting |
|| `features/dictionaryPopup/ui/mountPopupDictionary.test.ts` | mountPopupDictionary, mock for PopupDictionary | — | Unit tests: shadow host, click-outside close, ignore orbital badge, sheet-mode no-dismiss, setOptions term/context, destroy |
|| `features/dictionaryPopup/ui/DictionaryPanelView.tsx` | shared/ui (Skeleton), useDictionaryPanel, searchHistory, CandidateView | Dictionary | React view: search input, bounded history, candidate chip bar with jump-scroll (containerRef.querySelector via data-cell-id — works in Shadow DOM popup + integrated panel), scrollable CandidateView list (no global tab state); CandidateSkeleton shows header with term + skeleton content during loading (instant feedback); hides search row and history when `variant='popup'` |
|| `features/dictionaryPopup/ui/DictionaryPanelView.test.tsx` | DictionaryPanelView, mocks for sendMessage/translateSentence/CandidateView | — | Unit tests: loading, skeleton with term in header, error, empty, search, history, chip jump-scroll, chip jump-scroll in Shadow DOM |
|| `features/dictionaryPopup/ui/DictionaryPanelView.module.css` | tokens | DictionaryPanelView, CandidateView | Panel layout, candidate list, header, definitions, tabs, footer styles |

### Shared UI layer

| File | Import từ | Được import bởi | Sửa file này → ảnh hưởng |
|------|-----------|-----------------|--------------------------|
| `shared/ui/Alert.tsx` | — | ThemeImportExport | Inline message banner with variants |
| `shared/ui/Badge.tsx` | — | — | Small status label with variants/sizes |
| `shared/ui/Button.tsx` + `.module.css` + `.style-guard.test.ts` + `.showcase.tsx` + `.showcase.module.css` | — | App.redesigned, ResourceCard, Dropzone, ImportProgress, DeleteConfirmModal, ResourcesPanel, ThemePanel, ThemeImportExport, SelectionBar, SubtitleManagerFooter, OcrSettingsPanel | **Liquid Glass button atom (v4)**: 6 action variants (primary/glass/outline/ghost/success/destructive) + aliases (secondary/primarySubtle/link), all sharing the same smoked-blue liquid-glass material with caustic rim highlights. 4 sizes (sm/md/lg/xl), horizontal/vertical orientations, 8 states incl. active toggle/loading/error, pill shape. Pointer-down spawns a water ripple from the touch point and scales the surface; release uses a spring easing for a water-surface rebound. Style guard enforces token contracts. |
| `shared/ui/EmptyState.tsx` | — | MediaEmpty | Empty list/panel placeholder |
| `shared/ui/ErrorBoundary.tsx` | — | popup/main.tsx, sidepanel/main.tsx, options/main.tsx | React error boundary (class component — React platform requirement) with reload fallback |
| `shared/ui/Tooltip.tsx` | — | — | Accessible hover/focus tooltip |
| `shared/ui/Card.tsx` | — | ResourceCard, ResourcesPanel, ThemePanel | Surface container: default/interactive/selected variants |
| `shared/ui/Checkbox.tsx` | — | CheckboxGroup | Checkbox with label, indeterminate, error, disabled states |
| `shared/ui/CheckboxGroup.tsx` | — | — | Managed list of checkboxes |
| `shared/ui/Dialog.tsx` | — | DeleteConfirmModal | Accessible modal overlay + panel |
| `shared/ui/Drawer.tsx` | — | — | Slide-in panel with overlay |
| `shared/ui/BottomSheet.tsx` | — | CardCreatorBottomSheet | **ADR-026**: Mobile bottom-anchored sheet (slide-up, drag handle, 75vh max height). Mirrors Dialog API |
| `shared/ui/FormGroup.tsx` | — | — | Label + children wrapper with consistent spacing |
| `shared/ui/Header.tsx` | — | App.redesigned | Top chrome with title and actions |
| `shared/ui/IconButton.tsx` | — | Header, SettingsDialog, VideoCard, SubtitleCard, SelectionBar, DownloadCard, OptionsApp, UniversalPanel | Icon-only transparent button (22 call sites) |
| `shared/ui/Sidebar.tsx` | — | — | Vertical nav container with optional collapse |
| `shared/ui/useFocusTrap.ts` | — | OptionsApp, Drawer, BottomSheet, UniversalPanel | WCAG focus trap for modal drawers/dialogs |
| `shared/ui/Input.tsx` + `.module.css` + `.test.tsx` + `.showcase.tsx` + `.showcase.module.css` | — | InputField, SearchField, design-system showcase | Liquid-glass text input: glass/filled/outline/ghost variants; sm/md/lg sizes; default/hover/focus/filled/error/loading/disabled/read-only/success states; prefix/suffix slots with icons; inline nature-palette focus override via CSS custom properties |
| `shared/ui/InputField.tsx` + `.module.css` + `.test.tsx` + `.showcase.tsx` + `.showcase.module.css` | Label | SettingsDialog, forms | Label + Input + helper/error text; uses `Input` + `Label` |
| `shared/ui/Label.tsx` | — | InputField, Checkbox, Radio, FormGroup | Form control label with required/disabled states |
| `shared/ui/ListItem.tsx` | — | — | Row with leading/trailing content and active state |
| `shared/ui/NavItem.tsx` | — | — | Navigation item (sidebar/horizontal) |
| `shared/ui/FooterBar.tsx` | — | SubtitleManagerFooter | Generic bottom navigation bar (ZaloPay/iOS tab bar/M3 pattern): slots prop, equal-width, flat (border-radius 0 now in Button.vertical SSOT), soft shadow separator, height=content |
| `shared/ui/Progress.tsx` | — | DownloadCard, ImportProgress | Horizontal progress bar |
| `shared/ui/Radio.tsx` | — | RadioGroup | Radio with label, error, disabled states |
| `shared/ui/RadioGroup.tsx` | — | — | Managed list of radios |
| `shared/ui/SearchField.tsx` + `.module.css` + `.test.tsx` + `.showcase.tsx` + `.showcase.module.css` | Input | search surfaces, design-system showcase | Input with leading search icon + clear button; uses `Input` |
| `shared/ui/Select.tsx` | — | SettingsDialog (planned) | Plain HTML select wrapper with placeholder/error |
| `shared/ui/Tabs.tsx` | — | ColorCustomization, SettingsDialog | Compound tab list/trigger/content |
| `shared/ui/Accordion.tsx` | — | — | Collapsible single/multiple sections |
| `shared/ui/Skeleton.tsx` | — | — | Placeholder loading shape |
| `shared/ui/Spinner.tsx` | — | Button, Loading surfaces | Animated loading indicator |
| `shared/ui/Textarea.tsx` | — | ThemeImportExport | Multiline input with resize/error/disabled |
| `shared/ui/Toggle.tsx` | — | SettingsDialogContent, NavClusterSettingsPanel, OcrSettingsPanel | Switch pill; sm=28px (matches button-height-sm), md=touch-target 40/44px, lg=48px |
| `shared/ui/Slider.tsx` | — | NavClusterSettingsPanel | Styled range; touch-target aware 40/44px (settings-controls-restyle F2) |
| `shared/ui/ShortcutInput.tsx` | — | SettingsDialogContent | **ADR-021 D7**: Pill-style input (radius-full, min-width 140px) — single-char pill (uppercase center) + combo pill (Ctrl+Shift+T kbd chips, modifier subtle bg, key solid primary). Captures keydown, supports combo modifiers. Backward compat 5 old shortcuts. |
| `shared/ui/SearchableSelect.tsx` | — | SettingsDialogContent | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `shared/ui/HintIcon.tsx` | — | SettingsDialogContent, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |

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
| `constants/config.ts` | types | index, downloader, popupStore, fileUtils, SettingsDialogContent, **whitelist**, **autoDownload** | Defaults, limits, keys; **`DEFAULT_PREFERRED_VIDEO_FORMAT`**, **`DEFAULT_SELECTED_SUBTITLE_LANGUAGES`**, **`DEFAULT_AUTO_SELECT_ENABLED`**, **`STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST`** |
| `constants/messages.ts` | — | index, useDetectedMedia, useDownloadProgress, ffmpegRunner | Message type strings |
| `constants/urls.ts` | — | videoDetector, subtitleDetector, pageScanner | URL patterns |
| `types/media.ts` | — | (deprecated barrel — M19 Strangler Fig) | **DEPRECATED** barrel re-export from `entities/*`. No callers import `@/types/media` directly anymore (M19 complete). New code SHOULD import from `@/entities/video`, `@/entities/settings`, `@/entities/media`. Kept for backward compat only |
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

### 8. OCR Hard-Sub Pipeline Flow (Orca — spec §AD1-§AD7)

```
Content-script load (T20)
  → initOcrContentScript()
    → initOcrForCurrentUrl(window.location.href)
      → extractOriginFromUrl(url) → origin
      → shouldEnableOcr(url) → loadOcrSettings() → isOcrEnabledForUrl
      → IF enabled + video found + originState.ocrEnabled:
          → new OcrSession() → start(video, originState)
            → OcrController.init(languageMode, 'webgpu')
              → sendMessage(OCR_INIT) → background
                → createOffscreenDocument('offscreen/ffmpeg.html')
                → forward to ocrRunner → PaddleOcrEngine.initialize(config)
                  → import @paddleocr/paddleocr-js
                  → PaddleOCR.create({lang:'ch', ocrVersion:'PP-OCRv5', ortOptions:{backend:'webgpu', wasmPaths, numThreads:1, simd:true}})
                  → T21: warmupShaderJit() — dummy predict(64×32 black canvas) → trigger WebGPU shader JIT
            → OcrOverlay.attach(video) — create .cell-ocr-overlay container
            → loop() — rVFC scheduleNextFrame
              → IF paused/ended: skip, reschedule
              → captureFrame(video, canvas) → ImageSource (RGBA)
              → processFrame(frame)
                → runPipelineStep(frame, recognizeFn, state, config, frameTimeMs)
                  → (1) T10 time gate 3fps: shouldRunByTimeGate(frameTimeMs, lastOcrTimeMs, 333) → skip_time_gate
                  → (2) DRM guard: checkDrmGuard(frame) → meanLuma < 16 → drm_detected → stop()
                  → (3) luma-diff: regionMeanLuma + shouldRunOcr → skip_unchanged
                  → (4) pHash dedup: subtitleRegionHash → skip_duplicate
                  → (5) crop: cropImage(frame, subtitleRegion)
                  → (6) T22 retry: recognizeFn(cropped, minScore) × maxRetries=3 → error if all fail
                  → (7) script-run segment: scriptRunSegmenter(item.text) per OCR item
                  → (8) T10 text dedup: textMatchesPrevious → skip_text_duplicate
                  → (9) update state (luma, hash, text, lastOcrTimeMs)
                → IF status='ocr':
                  → createHitboxes(items, scriptRuns) → per-script-run OcrHitbox[]
                  → OcrOverlay.updateHitboxes(hitboxes, videoWidth, videoHeight)
                  → T16: wireOcrHitboxesToTrigger(overlay, triggerController)
                    → group hitboxes by langCode (routeScriptRunToLangCode)
                    → triggerController.attach(spans, sentence, langCode) per group
                    → click hitbox → dictionary lookup → popup

Settings change (T19):
  → chrome.storage.onChanged listener
    → initOcrForCurrentUrl(window.location.href) — re-check (toggle ON → start, OFF → stop)

SPA navigation (T20):
  → yt-navigate-finish / popstate event
    → initOcrForCurrentUrl(window.location.href) — origin changed → stop old + start new

Dictionary probe cache (T23):
  → createDictionaryProbeAsync(langCode) → probeCache.get(langCode) ?? load+cache
  → clearDictionaryProbeCache() on dictionary import
```

---

## Test files (auto-select / auto-download feature)

| Test file | SUT | Số test | Covers |
|-----------|-----|---------|--------|
| `tests/unit/selectors/selectBestMedia.test.ts` | `lib/selectors/selectBestMedia.ts` | 13 | Format → quality → subtitle fallback, no-match cases |
| `tests/unit/utils/whitelist.test.ts` | `lib/utils/whitelist.ts` | 13 | normalizeUrl, getWhitelist, isWhitelisted, addToWhitelist, removeFromWhitelist |
| `tests/unit/popup/MultiSelect.test.tsx` | `popup/components/settings/MultiSelect.tsx` | 14 | Search input, checkbox list, selection toggle, footer |
| `tests/unit/sidepanel/sidePanelStore.test.ts` | `sidepanel/store/sidePanelStore.ts` | 8 | setCues, setCurrentTime, setPlaying, currentCueIndex (binary search) |
| `tests/unit/sidepanel/CueList.test.tsx` | `sidepanel/components/CueList.tsx` | 16 | Render cues, **adaptive timestamp format**, onSeek, highlight, auto-scroll, empty nativeText, **boundary overlap (half-open [start,end))**, **scroll behavior (instant)** |
| `tests/unit/features/subtitle/ui/PlayerModeOverlay.styles.test.ts` | `features/subtitle/ui/PlayerModeOverlay.module.css` | 2 | Player Mode overlay/content pointer-events: auto; CueList wrapper overflow-y: auto + overscroll-behavior: contain (regression guard for player-mode scroll) |
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
| `invokeAnkiConnect` | `features/cardCreator/service/ankiConnectClient.ts` | (FetchFn, url, action, params?, timeoutMs?) → Promise<unknown> | quickAddHandler.ts, tests | **ADR-026**: Pure AnkiConnect HTTP client (transport-agnostic FetchFn injected for testability). Builds `{ version: 6, action, params }`, parses `{ result, error }` |
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
| `useCardCreatorStore` | `src/stores/cardCreatorStore.ts` | — | useCardCreatorState | **T079**: Zustand store owns `draft`, `decks`, `noteTypes`, `availableFields`, `queue`, `toasts`, plus queue/toast actions. UI-agnostic, no React hook required. |
| `useCardCreatorState` | `features/cardCreator/ui/useCardCreatorState.ts` | (settings, openContext) → CardCreatorState | CardCreatorDialog, CardCreatorBottomSheet, CardCreatorPanel | **ADR-026**: State management hook — load decks/models/fields, auto-map, find recent note, draft autosave, media add/remove/reorder/drop, Add/Update actions, toasts. **T079**: thins to `useCardCreatorStore` consumer. |
| `mountCardCreatorDialog` | `features/cardCreator/ui/mountCardCreatorDialog.ts` | (settings) → CardCreatorMountController | contentScriptController.ts | **T082/T083**: Mount Card Creator into full-viewport fixed shadow host via `mountReactShadow`. Chooses desktop `Dialog` or mobile `BottomSheet` based on viewport width. Legacy light-DOM path removed |
| `CardCreatorDialog` | `features/cardCreator/ui/CardCreatorDialog.tsx` | (open, onOpenChange, settings, openContext, initialAction?) → ReactElement | mountCardCreatorDialog | **ADR-026**: Desktop modal shell around `CardCreatorDialogContent` |
| `CardCreatorBottomSheet` | `features/cardCreator/ui/CardCreatorBottomSheet.tsx` | (open, onOpenChange, settings, openContext, initialAction?) → ReactElement | mountCardCreatorDialog | **ADR-026**: Mobile bottom-sheet shell around `CardCreatorDialogContent` |
| `CardCreatorDialogContent` | `features/cardCreator/ui/CardCreatorDialogContent.tsx` | (state, variant, onCancel, className?) → ReactElement | CardCreatorDialog, CardCreatorBottomSheet, CardCreatorPanel | **ADR-026**: Main body — left-bordered alert icons, section titles (no bordered cards), preview block, fields, footer; wires `MediaList` add/remove/drop/reorder to `useCardCreatorState`; accepts `className` for panel embedding |
|| `QueueSidebar` | `features/cardCreator/ui/QueueSidebar.tsx` | (queueItems, queueActiveIndex, onSelectQueueItem, onDeleteQueueItem, onUndoDeleteQueueItem, toasts, onDismissToast) → ReactElement | CardCreatorDialogContent | I+N review queue sidebar; mount-agnostic, does not depend on `useCardCreatorState` return type |
|| `CardCreator types` | `features/cardCreator/types.ts` | — | mountCardCreatorDialog, useCardCreatorState, CardCreatorDialog, CardCreatorBottomSheet, QueueSidebar, universalPanel/types | Shared mount-agnostic types: `CardCreatorOpenContext`, `CardCreatorQueueItem`, `CardCreatorPrefill`, `CardCreatorAction`, `Toast` |
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
| `Toggle` | `shared/ui/Toggle.tsx` | checked, onChange, ariaLabel → ReactElement | SettingsDialogContent, NavClusterSettingsPanel, OcrSettingsPanel | Switch pill; sm=28px (matches button-height-sm), md=touch-target 40/44px, lg=48px |
| `hexToRgb` | `features/theme/logic/colorGenerator.ts` | string → {r,g,b} | contrastValidator, tokens | **ADR-022**: Parse hex → RGB (3/6 digit, case-insensitive) |
| `getLuminance` | `features/theme/logic/colorGenerator.ts` | string → number | contrastValidator | **ADR-022**: WCAG 2.1 relative luminance (0-1) |
| `generateShade` | `features/theme/logic/colorGenerator.ts` | (hex, percent) → hex | tokens | **ADR-022**: Darken hex by percent (0-100) |
| `generateHoverColor` | `features/theme/logic/colorGenerator.ts` | hex → hex | tokens | **ADR-022**: Hover = shade 10% |
| `getContrastRatio` | `features/theme/logic/contrastValidator.ts` | (fg, bg) → number | contrastValidator | **ADR-022**: WCAG contrast ratio (1-21) |
| `validateTheme` | `features/theme/logic/contrastValidator.ts` | CoreColorTokens → ValidationResult | ThemePanel | **ADR-022**: Validate 3 pairs (text/canvas, textSecondary/canvas, white/primary) |
| `applyTheme` | `features/theme/logic/themeManager.ts` | (ResolvedMode, ThemeConfig, target?: HTMLElement) → void | ThemeProvider, ThemePanel, ShadowThemeProvider | **ADR-022**: Set all color (core + derived) CSS vars on target (default :root) via shared/lib/tokens + data-theme attr |
| `resolveMode` | `features/theme/logic/themeManager.ts` | ThemeMode → ResolvedMode | ThemeProvider, ThemePanel, popup App | **ADR-022**: system → light/dark via prefers-color-scheme |
| `useThemeStore` | `stores/themeStore.ts` | Zustand store | ThemeProvider, ThemePanel, popup App | **ADR-022**: mode + config + init/switchMode/updateColor/setConfig/resetTheme |
| `injectThemeTokens` | `shared/lib/themeTokens.ts` | HTMLElement → cleanup | contentScriptController | **ADR-022 + ADR-024**: Content-script `<style>` injection from themeConfig + storage.onChanged. Static + component tokens on `:root`, color tokens on `[data-theme]` via shared/lib/tokens |
| `syncElementTheme` | `shared/lib/themeTokens.ts` | (element: HTMLElement, container: HTMLElement) → cleanup | subtitleBlockController.ts | **ADR-024**: Sync `data-theme` attribute from container to a portable element; uses MutationObserver to keep the element self-themed when re-parented |
| `tokens.ts` | `shared/lib/tokens.ts` | — | themeTokens, themeManager, themeConfig | **ADR-022 SSOT**: Reads `shared/styles/tokens.json`; exports default palettes, getColorTokens(), buildColorTokenCSS(), formatStaticTokens(), formatComponentTokens() |
| `isVideoReady` | `shared/lib/dom/videoReady.ts` | (v: HTMLVideoElement) => boolean | content-script.ts (findAndInitOverlay), ocrContentScript.ts (video watcher) | **ADR-012 + ADR-081**: True when video passed the SPA template phase (blob src / currentSrc / readyState>=2 / child source-track src) — safe to attach foreign overlay UI |
| `formatPct` | `features/ocr/overlay/regionSelector.ts` | (pct: number) => number | regionSelector (label), OcrSettingsPanel (custom region readout) | **ADR-081**: Round drag-decimal percentages (29.7222…→30) so overlay label and panel always display the same integers |
| `generate-tokens.js` | `scripts/generate-tokens.js` | — | package.json predev/prebuild | Generates `shared/styles/tokens.css` from `shared/styles/tokens.json` |
| `ThemeProvider` | `features/theme/ui/ThemeProvider.tsx` | children / container → JSX | popup/sidepanel/options main.tsx, ShadowThemeProvider | **ADR-022**: Boot themeStore + applyTheme + system listener + storage.onChanged sync; optional `container` target for Shadow DOM |
| `ShadowThemeProvider` | `shared/lib/shadowRoot/ShadowThemeProvider.tsx` | container, children → JSX | mountReactShadow | **ADR-075/T032**: ThemeProvider wrapper for shadow roots — applies tokens + `data-theme` to the inner container so `[data-theme]` selectors match inside the shadow boundary |
| `mountReactShadow` | `shared/lib/shadowRoot/mountReactShadow.ts` | ReactElement, options → {host, rootEl, shadow, root, unmount} | ShadowThemeProvider, card creator, popup, orbital, tokenize, subtitle | **T082/ADR-075/T032**: Generic open-shadow root React mount; injects tokens + per-component CSS; `rootEl` is the inner container; optional `reparentOnFullscreen` keeps overlay visible in video fullscreen |
| `injectShadowCss` | `shared/lib/shadowRoot/injectShadowCss.ts` | ShadowRoot, {css?} → cleanup | mountReactShadow | **ADR-075/T032 + ADR-076**: Injects tokens.css (with `:root` → `:host` rewrite) + components.css (includes `:host { font-size: var(--font-size-base) }` reset — isolates shadow UI from host `<html>` font-size) + per-module CSS into shadow root; `[data-theme]` selectors match the inner container |
| `useShadowFocusTrap` | `shared/lib/shadowRoot/useShadowFocusTrap.ts` | panelRef → void | shadow panels | **ADR-075**: Focus-trap inside shadow root using `getRootNode().activeElement` |
| `useCuesStore` | `stores/cuesStore.ts` | Zustand store | subtitle components | **ADR-075**: Bilingual cues + active index; slice subscription. **Inline load status**: `targetLoadStatus`/`nativeLoadStatus` (LoadStatus: idle/loading/error/none + languageLabel) replaces toast for auto-load notifications; `setLoadStatus(role, status)` action; `setCues` auto-clears status for roles with non-empty cues (subtitle appearing = success) |
| `importFile` | `features/dictionary/logic/importOrchestrator.ts` | (file, resourceType, options) → ImportResult | ResourcesPanel, autoSeed | **ADR-023**: validate → detect → signature → dedupe → create resource → strategy.execute() → finalize; error → rollbackImport |
| `seedDevDataIfEmpty` | `features/dictionary/logic/devSeed.ts` | (langCode?) → Promise<void> | background onInstalled (gated by `isDevMode`) | Auto-seed: if DB empty, fetch Cambridge + frequency from extension bundle (dist/seed/), importFile in parallel; fire-and-forget; production builds do not ship seed files, so callers must gate with `isDevMode` |
| `isDevMode` | `shared/lib/env/devMode.ts` | — | background, OptionsApp | Vite `import.meta.env.DEV` isolated (Jest CJS-safe; mocked in tests) |
| `rollbackImport` | `features/dictionary/logic/importOrchestrator.ts` | (langCode, resourceId) → void | importOrchestrator | **ADR-023 D6**: Delete dictionary + frequency + resource (cascade); rollback-during-rollback → RollbackError |
| `detectFormat` | `features/dictionary/logic/formatDetector.ts` | (name, head) → ImportFormat | importOrchestrator | **ADR-023 D4**: Hybrid magic+ext+zip sniff (gzip→sqlite, zip→yomitan/json-array/txt, sqlite magic, JSON content) |
| `computeSignature` | `features/dictionary/logic/signatureGenerator.ts` | (file) → string | importOrchestrator | **ADR-023 D7**: SHA-256(first1MB)_size_nameWithoutExt — dedupe key |
| `parsePhraseTemplate` | `features/dictionary/logic/phraseTemplateParser.ts` | (term, options?) → ParsedPhraseTemplate | phrase-index compiler | **ADR-037**: Cambridge optional/alternative/slot AST; multi-slash alternatives with a shared trailing suffix (`be/come/arrive late to the party`) are balanced into `alternative([be],[come],[arrive]) + [late, to, the, party]` so no degenerate single-word branch can match; rejects open/malformed/over-limit templates |
| `compilePhraseIndex` | `features/dictionary/logic/phraseIndexCompiler.ts` | (PhraseIndexInput[]) → PhraseIndex | phrase matcher worker | **ADR-037 §7**: anchor inverted index + compact binary blob (≤8MB); auto-generates separable phrasal-verb variants (`put down sth` → `put sth down`) so object-between-particle sentences match; serialize/deserialize round-trip for worker transfer |
| `tokenizeSentence` | `features/dictionary/logic/phraseMatcher.ts` | (sentence) → SentenceToken[] | matchPhrase, textTokenizer | **ADR-037 §8.1**: NFC + lowercase + UTF-16 cursor offsets; also normalizes U+2019 curly apostrophe to U+0027 so contractions / possessives keep a single token and can be expanded by lookup |
| `matchPhrase` | `features/dictionary/logic/phraseMatcher.ts` | (PhraseMatchRequest, PhraseIndex) → PhraseMatch \| null | phraseMatchService | **ADR-037 §8-9 + §15**: bounded DP over tokens + deterministic ranking tuple; span must contain hovered token; object-slot-final templates require ≥2 fixed literals matched to avoid swallowing arbitrary objects (e.g. "is the body" → "be (really) something") |
| `matchPhraseAll` | `features/dictionary/logic/phraseMatcher.ts` | (PhraseMatchRequest, PhraseIndex, resourceId?, traceSink?) → PhraseMatch[] | lookupOrchestrator | **ADR-037 §8-9**: multi-candidate version of matchPhrase — returns ALL matches sorted by ranking tuple, deduplicated by dictionaryTerm; optional `traceSink` callback receives MatchTraceData (candidate IDs, anchor hits, per-candidate match states + ranking tuple, ranked list) for dev-only lookup logging |
| `saveLookupLog` | `features/dictionaryPopup/log/lookupLogStore.ts` | (LookupLogEntry) → Promise<void> | lookupOrchestrator (dev-only) | Dev-only lookup log persistence via chrome.storage.local ring buffer (500 entry cap); gate by isDevMode — production tree-shake; export/clear via DevTools console |
| `matchPhraseRequest` | `features/dictionary/logic/phraseMatchService.ts` | (PhraseMatchServiceRequest, deps, AbortSignal) → Promise<PhraseMatchResult> | lookup orchestrator | **ADR-037 §8.3 10-11**: phrase match → definition lookup → word fallback; AbortSignal cancellation; `quality` enum, no confidence score |
| `buildPhraseIndexForResource` | `features/dictionary/logic/phraseIndexBuilder.ts` | (langCode, resourceId) → Promise<PhraseIndexBuildResult> | importOrchestrator | **ADR-037 §7.2**: collect multiword terms from stored Cambridge entries → parse → compile → serialize → putPhraseIndex; unsupported terms counted + excluded; failure rolls back import |
| `loadPhraseIndexBlob` | `features/dictionaryPopup/worker/phraseIndexLoader.ts` | (resourceId, blob) → PhraseIndexLoadResult | lookupWorkerHandler | **ADR-037 §7**: validate magic/version/termCount/anchor bounds; hydrate into ResidentPhraseIndex with anchor→templateIDs map; malformed blobs fail closed |
| `handleWorkerMessage` | `features/dictionaryPopup/worker/lookupWorkerHandler.ts` | (LookupWorkerState, WorkerRequestMessage) → WorkerLookupResultMessage[] | lookupWorker entry | **ADR-037 §8 + spec §9.4/§9.5**: HYDRATE_CHUNK stores resident index; PUSH_DEFINITION inserts into 10k-capped LRU; LOOKUP runs matchPhrase + word fallback (LRU hit → definitions); LOOKUP_CANCEL drops by requestId |
| `LruCache` | `features/dictionaryPopup/logic/lruCache.ts` | class\<K, V\> with cap | lookupWorkerHandler | **spec §9.5**: O(1) get/set/evict via Map insertion order; hard cap 10k for definitions; deterministic eviction |
| `sortResidentIndexesByPriority` | `features/dictionaryPopup/worker/resourcePriority.ts` | (Iterable\<ResidentPhraseIndex\>, priorityMap?) → ResidentPhraseIndex[] | lookupWorkerHandler | **ADR-037 Task 1.4**: deterministic multi-resource ordering — newest resourceId first by default; explicit priorityMap overrides; unmapped resources sort after mapped ones |
| `comparePhraseMatches` | `features/dictionary/logic/phraseMatcher.ts` | (PhraseMatch, PhraseMatch) → number | lookupWorkerHandler, phraseMatchService | **ADR-037 §9**: cross-resource tie-break — quality desc → fixedTokenCount desc → fixedMatched desc → span length desc → slotUsed asc → freq asc → templateId asc (stable) |
| `createEnglishPlugin` | `features/dictionaryPopup/plugins/englishPlugin.ts` | (PhraseIndex, resourceId?) → LanguagePlugin | lookupOrchestrator | **spec §4.6.3**: EN plugin — whitespace tokenize, lemma (irregular verbs + comparative/superlative), possessive normalize, matchPhrase delegates to phraseMatcher |
| `createFallbackPlugin` | `features/dictionaryPopup/plugins/fallbackPlugin.ts` | (langCode) → LanguagePlugin | pluginRegistry | **spec §4.6.3**: minimal plugin for unknown languages — whitespace tokenize only, no lemma/possessive/phraseMatch |
| `createChinesePlugin` | `features/dictionaryPopup/plugins/chinesePlugin.ts` | () → LanguagePlugin | lookupOrchestrator | **spec §4.6.4**: ZH plugin — FMM segmentation (dict-driven, O(n·maxLen)), readingKind=pinyin, chengyu via FMM (4-char idioms match naturally) |
| `segmentFMM` | `features/dictionaryPopup/plugins/chinesePlugin.ts` | (text, TermProbe) → Token[] | chinesePlugin.segment | **spec §D-alternatives**: forward maximum matching — longest dict term at each position, single-char fallback; ponytail: no ambiguity handling (upgrade: DAG + freq) |
| `PluginRegistry` | `features/dictionaryPopup/plugins/pluginRegistry.ts` | class with register/get/has/listLangs | lookupOrchestrator | **spec §4.6.3**: registry + fallback dispatch — get(langCode) returns registered plugin or fallback |
| `lookupOrchestrator` | `features/dictionaryPopup/logic/lookupOrchestrator.ts` | (LookupRequest, deps?, signal?) → Promise<LookupResult> | lookupWorkerHandler | **spec §4.6.3/§9.4**: EN phrase match (ADR-037) → dict query; ZH FMM segment → dict query; fallback token → dict query; surface word wins with origin lemma fallback (displayTerm support in assembleLookupResult; e.g. hover "is" shows "is" with definitions from "be"); `lookupOrchestratorMulti` returns ordered candidates: phrase → surface → origin → other matched phrases; reads persisted `WordStatus` via `getWordStatus(surfaceTerm)`; lemma fallback (ADR-041: multi-candidate inflectional morphology) |
| `splitSenses` | `features/dictionaryPopup/logic/lookupOrchestrator.ts` | (definition: string) → { pos: string; text: string }[] | lookupOrchestrator | **ADR-039**: splits Cambridge `definition` string into individual senses; boundary is any numeric marker at a sense boundary, with or without POS; extracts POS from next line for idioms like `17.bring/call...`; strips numbers from rendered text |
| `englishLemma` | `features/dictionaryPopup/logic/englishLemma.ts` | (word: string) → string | englishPlugin.lemma, lookupOrchestrator (fallback) | **ADR-041 + contractions + derivation**: single-candidate wrapper for `englishLookupCandidates()[0]`; handles negative contractions + clitics |
| `englishLemmaCandidates` | `features/dictionaryPopup/logic/englishLemma.ts` | (word: string) → string[] | phraseMatcher.candidateLemmas | **ADR-041**: unified multi-candidate lemma — ALL 8 English inflectional suffixes + irregular verbs (~250), irregular comparison (better→good), irregular plural nouns (children→child), -ves plural (knives→knife), possessive -'s (cat's→cat); CVC doubling (bigger→big), silent-e (nicest→nice), ie→ying (lying→lie), sibilant -es (boxes→watch); false positives harmless — orchestrator tries raw term first |
|| `englishLookupCandidates` | `features/dictionaryPopup/logic/englishLemma.ts` | (word: string) → string[] | englishPlugin.lemmaCandidates | Lookup-oriented lemma: `englishLemmaCandidates` + contraction expansion (don't→do, can't→can, won't→will, it's→be/have, I'm→be, etc.) + derivational suffixes (happiness→happy, quickly→quick, beautiful→beauty, action→act) + hyphenated compound splitting (well-known→well/known/well known). Keeps `englishLemmaCandidates` contraction/derivation-free so phrase matching does not false-match `do sth` from `I don't do it` or `happy birthday` from `happiness` |
| `createDictionaryProbeAsync` | `features/dictionaryPopup/logic/lookupOrchestrator.ts` | (langCode) → Promise<TermProbe> | lookupOrchestrator (ZH path) | **spec §4.6.4**: pre-loads all dict terms into a Set for synchronous FMM hasTerm() calls; ponytail: loads per-lookup, upgrade: cache in worker |
| `SubtitleTriggerController` | `features/dictionaryPopup/trigger/subtitleTriggerController.ts` | class: attach/detach/setTriggerMode/cancelInFlight | contentScriptController | **spec §4.6.3 A2, §9.4, D9**: debounce 80ms hover (cursor must stay on the token for 80ms); click is instant (no debounce), LOOKUP_CANCEL on new trigger, requestId routing; onLookup callback receives the token span for highlight; `onClear` callback fires when the cursor leaves a token for empty/popup/orbital-badge so the consumer can dismiss the popup; token-to-token movement does not clear; wraps subtitle text span into per-token spans (EN per-word, ZH per-segment); hover/click only fire when pointer is over the token geometry |
| `wrapTokenSpans` | `features/dictionaryPopup/trigger/subtitleTriggerController.ts` | (HTMLSpanElement, text, langCode) → HTMLSpanElement[] | SubtitleTriggerController.attach | **spec §4.6.3**: token-wrap subtitle text into per-word (EN) / per-segment (ZH) spans with data-dp-term/start/end attributes |
| `detectLangCode` | `features/dictionaryPopup/trigger/subtitleTriggerController.ts` | (text) → 'en' \| 'zh' | contentScriptController | **spec §4.6.3**: CJK ratio > 50% → 'zh', else 'en' |
| `WebTriggerController` | `features/dictionaryPopup/trigger/webTriggerController.ts` | class: attach/detach/setTriggerMode/cancelInFlight/processPoint | webTextDictionaryController | **spec §5.2 P1**: web text lookup — `mouseup` requires matching modifier for `hover-ctrl`/`hover-shift`/`hover-alt`; selection → dispatch LookupRequest; empty selection delegates to `resolveWordAtPoint` (caret fast-path, word-char only) then gates on `isPointOverRange` so only a click directly on the word's visual rect triggers lookup — `caretRangeFromPoint` snaps to the nearest word char even when clicking whitespace/punctuation nearby, so the geometry gate is required to reject near-miss clicks; hover+modifier → immediate dismiss if `resolveWordAtPoint` returns null; word extraction deferred to an 80ms stop-debounce (cursor still within 6px); hover (non-lenient) also gates on `isPointOverRange` so a caret quirk doesn't pop a word the cursor isn't over, while `processPoint` (orbital badge tap, lenient) trusts the resolution for 100% success; `onClear` callback fires on empty/modifier-mismatch to dismiss the popup; builds a non-collapsed Range covering the word for highlight; skips `.js-cell-popup-host` and `.js-cell-token`; blocks lookup inside `#cell-universal-panel-host` except when the pointer/selection is inside `[data-allow-lookup]` (dictionary definitions and card creator preview); the caret resolver disables `pointer-events` on popup and orbital-badge hosts (and recursively on their Shadow DOM children) but keeps the universal panel enabled so allowed text can be resolved; forwards pointer tip + badge center + badge radius + pointer radius to `onLookup` so the popup can position away from the pointer and badge; re-dispatches when the same term appears at a different offset/position so the popup follows the pointer across multi-line text |
| `WebTextDictionaryController` | `features/dictionaryPopup/controller/webTextDictionaryController.ts` | createWebTextDictionaryController(deps) → controller | entrypoints/content/content-script.ts, features/subtitle/ui/contentScriptController.ts | **ADR-046**: per-tab shared controller for web-text + subtitle dictionary popup. Owns `WordHighlight`, wires `WebTriggerController` and `mountOrbitalBadge` when `triggerMode === 'orbital'`, sends LOOKUP_REQUEST, keeps a bounded in-memory LRU lookup cache (capacity scaled by `navigator.deviceMemory`) for instant repeat-hover, prefetches adjacent words from the context sentence, renders popup via `mountPopupDictionary` with stateful `setLoading`/`setResult`/`setStatus`/`setOptions` and `onStatusChange` applied to the source token; highlight uses a `highlightAnchor` (parent element + word offset) captured before the single-word DOM wrap so multi-word phrase expansion (`detectedPhrase.surface` or `result.term`) can re-search the parent text and re-wrap across split text nodes, passes pointer tip + badge center + badge radius + pointer radius into `showPopup` so the popup repositions away from the orbital pointer and badge; temporarily hides the popup via `onTipMoving` while the pointer is being dragged so the target line stays readable; exposes `dismissLookup()` (hide popup + clear highlight + cancel in-flight + ignore stale response); exposes `syncStatus(term, status)` to update the popup when `webTokenizeController` changes status via keyboard shortcut; falls back to `deps.getTokenStatus` when the background DB read races or returns 'unknown'; handles Quick Add / Send to Card: shared `collectCardCreatorMedia(prefill, sourceLang, fromSubtitle, warnings?)` fetches missing word/sentence audio + image URLs and, when `fromSubtitle` and a ready video exists, captures the screenshot + sentence audio and returns a `BilingualCue`; when `deps.panelController` is present, `handlePopupCardCreatorAction` asynchronously builds a full `CardCreatorOpenContext` (video + cue + initialMedia + prefill) and routes it through `sendToCard`, returning `{ stayOpen: true }` so the popup stays open; otherwise falls back to standalone Card Creator dialog; late-binds video/cues via `configureVideo`; **sheet mode** (`innerWidth < POPUP_SHEET_BREAKPOINT_PX`): popup stays open across lookups — `dismissOnOutsideClick: false`, reuse popup via `setResult`/`setOptions`/`setLoading` instead of destroy+remount so chaining word lookups is flicker-free |
|| `createOrbitalBadge` | `features/dictionaryPopup/badgePointer/createOrbitalBadge.ts` | (options) → OrbitalBadge | webTextDictionaryController | **ADR-055**: floating half-moon badge centered on the right content edge (`clientWidth` fallback to `innerWidth`) so a vertical scrollbar does not hide it; dragging pulls it inward and reveals the full circle; releasing near any edge snaps it to a crescent on that edge and it can slide along the edge; pointer is centered inside the visible half-moon when collapsed (inset `badge_size/4`) and orbits the badge once expanded at the user-selected preset (no auto-rotation toward the viewport center); the inward preset used for the collapsed crescent is temporary and the user-selected preset is restored the next time the badge expands; double-tap cycles top/bottom/center, triple-tap cycles left/right/center; `onTipReady`/`onTipHover` pass the badge center to `WebTriggerController.processPoint` so popup positioning can avoid the badge; `onTipMoving` fires on every pointer move while expanded so `webTextDictionaryController` can hide the popup if it covers the pointer; optional `panelController` toggles the universal panel on single-click and closes it on outside click; fullscreen-aware host re-parenting; theme-aware Shadow DOM |
|| `UniversalPanel` | `features/universalPanel/UniversalPanel.tsx` | (props) → ReactElement | mountUniversalPanel | **ADR-065**: slide-in side panel shell with Dictionary / Settings tabs, vertical tab bar (desktop) / bottom tab bar (mobile), backdrop, X close, Escape to close, focus trap |
|| `mountUniversalPanel` | `features/universalPanel/mountUniversalPanel.ts` | (options) → UniversalPanelMountController | entrypoints/content/content-script.ts | **ADR-065**: fixed full-viewport host, createRoot, theme token injection, fullscreen re-parenting; wires `UniversalPanelController` to React; handles `sendToCard` by rendering `DictionaryTab` with `initialTerm` + `prefill`; returns controller consumed by the orbital badge |
|| `createUniversalPanelController` | `features/universalPanel/UniversalPanelController.ts` | (options) → { controller, unmount } | mountUniversalPanel | **ADR-065**: imperative open/close/switchTab, `sendToCard` (calls `onSendToCard` then opens Dictionary tab), session tab persistence, `getHosts` for click-outside handling |
|| `resolveWordAtPoint` | `features/dictionaryPopup/sentence/sentenceModule.ts` | (x, y, opts?) → {ctx, range} \| null | webTriggerController (onMouseUp, processHoverMove), resolveWordAtTip | **fix "click lúc được lúc không"**: SSOT hybrid word-lookup algorithm. (1) Fast path — `caretRangeFromPoint`/`caretPositionFromPoint` → if the caret lands on a word char, `extractSentenceContext` + `createWordRange` return the word directly. (2) Char-scan fallback — if the caret lands on a non-word char (whitespace/punctuation), scan left/right in the block's text for the nearest word char (tie → left) and resolve that word; this is the fix for clicks on spaces/punctuation between words that previously dismissed the popup. (3) Geometry fallback — if the caret is null/non-text, `elementsFromPoint` finds the text-bearing block, `TreeWalker` collects word spans, and the nearest word by Euclidean distance to the click point is returned, gated by `MAX_LOOKUP_DISTANCE_PX` = 1.5× the block's line-height (default 40px) so a click in genuine empty space (page margin) returns null. The `getCaretRange` option lets callers disable pointer-events on floating UI before resolving so a popup/badge covering the text does not block the lookup. |
|| `resolveWordAtTip` | `features/dictionaryPopup/badgePointer/resolveWordAtTip.ts` | ({x,y}) → {request, range} | null | *unused* | **ADR-055**: legacy helper; now a thin wrapper over `resolveWordAtPoint` (SSOT). Orbital lookup itself reuses `WebTriggerController.processPoint`; this wrapper is kept for tests and any external caller. |
|| `angleToPreset` / `getPointerTip` | `features/dictionaryPopup/badgePointer/pointerPosition.ts` | (angle) → PointerPreset; (center, preset) → tip point | createOrbitalBadge | **ADR-055**: `getPointerTip` computes pointer center from badge center + preset offset for `top`/`bottom`/`left`/`right`/`center`; `angleToPreset` maps an angle to the nearest preset; pointer tip offset = badge_radius + pointer_radius + 4px gap; badge size (24–96 px) and pointer scale are configurable |
|| `createGestureDetector` | `features/dictionaryPopup/badgePointer/gestureDetector.ts` | (deps) → GestureDetector | createOrbitalBadge | **ADR-055**: 300 ms double/triple tap detector for the expanded badge |
||| `badgeCollapse` | `features/dictionaryPopup/badgePointer/badgeCollapse.ts` | getNearestEdge, getEdgeCenter, getCollapsedCenter | createOrbitalBadge | **SSOT**: shared pure helpers for edge-collapse behavior (half-moon on viewport edge). Extracted from createOrbitalBadge so the token FAB reuses the same snap/collapse logic. Pure functions over a viewport rect — no DOM reads. |
|| `useOrbitalPointer` | `features/dictionaryPopup/badgePointer/useOrbitalPointer.ts` | (options) → { preset, pointerCenter, pointerTip } | OrbitalBadge | React hook wrapping `pointerPosition` geometry; returns pointer center + tip for the badge center and viewport. |
|| `useOrbitalSnap` | `features/dictionaryPopup/badgePointer/useOrbitalSnap.ts` | (options) → { edge, collapsedCenter, expandedCenter } | OrbitalBadge | React hook wrapping `badgeCollapse`; computes nearest edge and collapsed/expanded badge centers. |
|| `useOrbitalGesture` | `features/dictionaryPopup/badgePointer/useOrbitalGesture.ts` | (options) → { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } | OrbitalBadge | React hook wrapping `gestureDetector`; handles drag, double-tap, triple-tap pointer events. Uses `setPointerCapture` / `releasePointerCapture` so drag keeps tracking after the pointer leaves the badge, and `onPointerCancel` cleans up active drags. |
|| `OrbitalBadge` | `features/dictionaryPopup/ui/OrbitalBadge.tsx` | (props) → ReactElement | design-system-showcase, webTextDictionaryController (planned) | React orbital badge component: drag-to-snap, preset cycling, `onTipReady`, `onClick`, optional `viewport`/`persistPosition` props. Uses `transform: translate3d` for smooth drag and re-snaps to the nearest viewport edge on window resize/orientation change; CSS clip-path + `data-edge` adapts the collapsed half-moon to left/right/top/bottom edges. |
| `orbitalBadgeStore` | `src/stores/orbitalBadgeStore.ts` | load/save OrbitalBadgePosition | OrbitalBadge | Persists collapsed badge position + preset to `chrome.storage.local`.
| `WordHighlight` | `features/dictionaryPopup/ui/wordHighlight.ts` | createWordHighlight() → controller | webTextDictionaryController | **ADR-046**: visual highlight for looked-up word. DOM `span` wrap for continuous ranges; overlay `div` fallback for ranges crossing element boundaries or empty wrappers; CSS injected from `tokens.json`; `show(target)` clears previous highlight; expansion to a multi-word phrase is driven by the controller using a `highlightAnchor` so it can re-wrap after the initial single-word `surroundContents` splits the text node |
|| `DefinitionSelection` | `features/dictionaryPopup/logic/definitionSelection.ts` | `Map<string, boolean>` selection state for definitions | `useDictionaryLookup`, `useCandidate`, `buildCandidatePrefill` | Selection map keyed by definition id |
|| `initDefinitionSelection` | `features/dictionaryPopup/logic/definitionSelection.ts` | (LookupResult) → DefinitionSelection | `useDictionaryLookup` | Initialize selection map from `defaultSelected` flags |
|| `getSelectedDefinitions` | `features/dictionaryPopup/logic/definitionSelection.ts` | (LookupResult, DefinitionSelection) → DefinitionEntry[] | `buildCandidatePrefill`, `quickAddAssembler` | Return explicitly/default selected senses (no fallback) |
| `getWordStatus` | `features/dictionaryPopup/services/wordStatusStore.ts` | (langCode, term) → Promise<WordStatus> | lookupOrchestrator, wordStatus.ts handler | **spec §D1**: IndexedDB read, returns 'unknown' if not stored |
| `setWordStatus` | `features/dictionaryPopup/services/wordStatusStore.ts` | (langCode, term, status) → Promise<void> | cycleWordStatus, wordStatus.ts handler | **spec §D1**: upsert word status entry |
| `cycleWordStatus` | `features/dictionaryPopup/services/wordStatusStore.ts` | (langCode, term) → Promise<WordStatus> | PopupFooter | **spec §D1**: get current → nextStatus → set; cycle: unknown→tracking→known→ignore→unknown |
| `nextStatus` | `features/dictionaryPopup/services/wordStatusStore.ts` | (WordStatus) → WordStatus | cycleWordStatus | **spec §D1**: cycle order unknown→tracking→known→ignore→unknown |
| `getWordStatuses` | `features/dictionaryPopup/services/wordStatusClient.ts` | (langCode, terms) → Promise<Map<string, WordStatus>> | webTokenizeController, subtitleTokenizeController | Content-script proxy: sends WORD_STATUSES_GET to background; converts response record to Map |
| `setWordStatus` | `features/dictionaryPopup/services/wordStatusClient.ts` | (langCode, term, status) → Promise<void> | webTokenizeController, subtitleTokenizeController | Content-script proxy: sends WORD_STATUS_SET to background; throws on failure |
| `getFrequencyEntries` | `features/dictionaryPopup/services/frequencyClient.ts` | (langCode, terms) → Promise<Map<string, FrequencyEntry[]>> | webTokenizeController, subtitleTokenizeController | Content-script proxy: sends FREQUENCY_GET to background; converts response record to Map |
| `registerWordStatusHandlers` | `entrypoints/background/handlers/wordStatus.ts` | (ctx) → void | background/index.ts | Registers WORD_STATUS_GET, WORD_STATUSES_GET, WORD_STATUS_SET handlers; background is source of truth for word status IDB |
| `registerFrequencyHandlers` | `entrypoints/background/handlers/frequency.ts` | (ctx) → void | background/index.ts | Registers FREQUENCY_GET handler; background reads IDB frequency store and returns Record<term, FrequencyEntry[]> |
| `createStrategy` | `features/dictionary/strategies/strategyFactory.ts` | (format, resourceType, options, fileData) → Strategy | importOrchestrator | **ADR-023 D3**: Route format → strategy (txt/json-array/yomitan/sqlite/cambridge-json) |
| `TxtLineStrategy` | `features/dictionary/strategies/txtLineStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: TXT line-by-line, auto-unzip, order-based frequency |
| `JsonArrayStrategy` | `features/dictionary/strategies/jsonArrayStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: JSON array of strings, streaming regex + JSON.parse unescape |
| `YomitanStrategy` | `features/dictionary/strategies/yomitanStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D3**: unzip + index.json + term_meta_bank sort, freq type filter |
| `CambridgeJsonStrategy` | `features/dictionary/strategies/cambridgeJsonStrategy.ts` | extends BaseDictionaryStrategy | strategyFactory | **ADR-023 D3**: JSON array of {term, definition, ...} rich fields |
| `SqliteStrategy` | `features/dictionary/strategies/sqliteStrategy.ts` | extends BaseFrequencyStrategy | strategyFactory | **ADR-023 D5**: gunzip + sql.js lazy-load + exec SQL, DatabaseError on wasm fail |
| `ResourcesPanel` | `features/dictionary/ui/ResourcesPanel.tsx` | { langCode } → JSX | OptionsApp | **ADR-023 F11**: 2 sections (dictionary + frequency) with independent import state per resourceType (parallel import, 2 progress bars, no cross-block) + list + delete confirm |
| `Dropzone` | `features/dictionary/ui/Dropzone.tsx` | { label, accept, disabled, onFiles } → JSX | ResourcesPanel | **ADR-023 F11**: Drag-drop + click file picker |
| `Slider` | `shared/ui/Slider.tsx` | value, min, max, step, onChange, ariaLabel → ReactElement | NavClusterSettingsPanel | Styled range; touch-target aware 40/44px (settings-controls-restyle F2) |
| `ShortcutInput` | `shared/ui/ShortcutInput.tsx` | value: ShortcutValue, onChange: (ShortcutValue) => void, ariaLabel → ReactElement | SettingsDialogContent | **ADR-021 D7**: Pill-style input — single-char + combo (Ctrl+Shift+T). Captures keydown, supports modifiers. |
| `SearchableSelect` | `shared/ui/SearchableSelect.tsx` | options, value, onChange, ariaLabel → ReactElement | SettingsDialogContent | Single-select dropdown with embedded search (settings-controls-restyle F5) |
| `HintIcon` | `shared/ui/HintIcon.tsx` | hint, ariaLabel → ReactElement | SettingsDialogContent, SubtitleStylePanel | Info-circle button + floating popover with boundary detection (settings-controls-restyle F6) |
| `SettingsDialog` | `features/settings/ui/SettingsDialog.tsx` | { isOpen, settings, onChange, onClose, tokenizeState?, onToggleTokenize?, onOpenDictionary? } → JSX | mountSettingsDialog, popup App, OptionsApp | Dialog wrapper: overlay + popover shell + close button + Escape handling; renders `SettingsDialogContent` |
| `SettingsDialogContent` | `features/settings/ui/SettingsDialogContent.tsx` | { settings, onChange, tokenizeState?, onToggleTokenize?, onOpenDictionary?, className? } → JSX | SettingsDialog, SettingsTab (planned), UniversalPanel (planned) | Reusable settings body: sidebar + all settings sections; accepts `className` for embedding in the universal panel |
| `parseSubtitle` | `content/subtitleParser.ts` | (string, format) → ParseResult | subtitleDragDrop, subtitleImport | Adapter: auto-detect format (WEBVTT→vtt, <?xml/<tt→ttml, else srt), parseSrt/parseVtt/parseTtml |
| `createSubtitleManagerPanel` | `features/subtitle/ui/subtitleManagerPanel.legacy.ts` | (container, options?) → SubtitleManagerPanel | contentScriptController.ts | **ADR-015/ADR-027**: Legacy vanilla manager panel. `SubtitlePanelItem` model and pure helpers (`formatBytes`, `extractLanguageName`) moved to `subtitlePanelModel.ts` for reuse by React `SubtitleManagerPanel`. |
| `SubtitleManagerPanel` | `features/subtitle/ui/SubtitleManagerPanel.tsx` | (props) → ReactElement | ManagerLayer | React manager panel; consumes `SubtitlePanelItem[]` from `subtitlePanelModel`. **ADR subtitle-appearance-in-manager**: now has 2 views ('tracks' | 'appearance'); appearance view renders Block/Target/Native/Cluster sections using `SubtitleStylePanel`, `SubtitleBlockSettingsPanel`, `NavClusterSettingsPanel` from `./appearance/`. **Latency redesign**: `OffsetStepper` redesigned per `latency-control-redesign.html` mockup — label "Latency" + `[-0.5s][value][+0.5s]` row + `Reset` full-width; no clamp limit (user can set any offset); `formatSigned` helper for số trần display (no "s" suffix); `SectionState.lastValid` tracks last valid offset for invalid-input restore. **Latency persistence**: `offsetMs` prop (ms) initializes `targetState`/`nativeState` so reopening the manager reflects the persisted per-site offset instead of 0 (panel mounts fresh on each open via `managerOpen` gate). **Footer redesign**: footer extracted to `SubtitleManagerFooter` organism (ZaloPay pattern — 4 Button vertical slots). **T14**: rendered once via `ManagerLayer` molecule (no longer inline in `SubtitlePanels`). |
| `SubtitleManagerFooter` | `features/subtitle/ui/SubtitleManagerFooter.tsx` | (props) → ReactElement | SubtitleManagerPanel | Thin wrapper over `FooterBar` atom — maps subtitle-specific props (onSearch/onCustomize/onHideBoth/onGenerateNative) to `FooterBarSlot[]`. Footer organism: 4 slots — Search/Customize/Hide(toggle, active state)/Generate(primarySubtle variant). |
| `subtitlePanelModel` | `features/subtitle/ui/subtitlePanelModel.ts` | SubtitlePanelItem, formatBytes, extractLanguageName | SubtitleManagerPanel, createSubtitleManagerPanel | Shared model + pure helpers for the manager panel (React + legacy). |
| `iframeManagerBridgeTypes` | `features/subtitle/logic/iframeManagerBridgeTypes.ts` | — | iframeManagerBridgeChild, iframeManagerBridgeHost, managerStateSerializer | **T14 (planned)**: Bridge protocol types — SerializedManagerState, ManagerAction, message constants for cross-frame subtitle manager communication |
| `serializeManagerState` | `features/subtitle/logic/managerStateSerializer.ts` | ManagerState → SerializedManagerState | iframeManagerBridgeChild | **T14 (planned)**: Serialize ManagerState (with callbacks) to SerializedManagerState (JSON-only) for postMessage transport |
| `requestManagerOpenOnHost` / `sendManagerStateUpdate` / `onManagerAction` | `features/subtitle/logic/iframeManagerBridgeChild.ts` | (iframe, state) → void / (action) → void | contentScriptController (child frame) | **T14 (planned)**: Child-side bridge — request host to open manager sheet, push state updates, receive host actions |
| `installManagerSheetBridge` / `sendManagerActionToChild` | `features/subtitle/logic/iframeManagerBridgeHost.ts` | (iframe) → cleanup / (iframe, action) → void | HostManagerSheet | **T14 (planned)**: Host-side bridge — install message listener for child requests, dispatch actions back to child iframe |
| `HostManagerSheet` | `features/subtitle/ui/HostManagerSheet.tsx` | (props) → ReactElement | installManagerSheetBridge | **T14**: Thin adapter — converts `SerializedManagerState + onAction` → `ManagerState` (via `buildAppearance` helper) then renders `<ManagerLayer ... />`; cross-frame manager projection on host page. Duplicate persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` + backdrop logic removed (owned by `ManagerLayer`). **Latency persistence**: forwards `state.targetOffsetMs` → `ManagerState.offsetMs` so the mobile host-sheet panel also initializes its Latency stepper from the persisted offset |
| `init` | `features/subtitle/ui/contentScriptController.ts` | (video, webTextCtrl?) → cleanup | content-script.ts | **M20**: Subtitle overlay UI orchestration — loads settings, wires block controller, manager panel, offset controller, shortcuts, drag-drop, import. **ADR-046**: accepts shared `WebTextDictionaryController` to wire subtitle token lookup + popup + highlight + card creator. **ADR-027**: registers `handleGenerateNative` for `generate-native` button/shortcut |
| `handleGenerateNative` | `features/subtitle/ui/contentScriptController.ts` | () → void | init (button/shortcut) | **ADR-027**: Translates active target cues into configured native language via `BackgroundPrefillController`, creates a virtual `translated` native slot in the manager panel, feeds overlay as chunks arrive, clears/restarts on re-trigger. **Refactored**: core translation logic extracted to `features/subtitle/actions/generateNativeAction.ts` (`startGenerateNative`); content-script keeps state management wrapper |
| `handleCardCreatorAction` | `features/subtitle/actions/cardActions.ts` | (SubtitleActionContext, CardCreatorAction) → Promise<void> | contentScriptController, local-player useSubtitleActions | **SSOT**: Shared card/dictionary orchestration. quick-update → batch quick-add to Anki; edit-card → open Card Creator dialog; update-current → open dialog focus Update. Extracted from contentScriptController.ts |
| `handleClusterQuickAdd` | `features/subtitle/actions/cardActions.ts` | (SubtitleActionContext) → Promise<void> | handleCardCreatorAction | **SSOT**: Batch quick-add — tokenize subtitle → filter unknown/tracking → lookup → add cards to Anki. Media captured once, shared across cards |
| `tokenizeSubtitleWords` | `features/subtitle/actions/cardActions.ts` | (text) → string[] | handleClusterQuickAdd, buildSubtitleQueue | **SSOT**: Split subtitle line into unique lowercase word terms (letters only, length ≥ 2) |
| `buildSubtitleQueue` | `features/subtitle/actions/cardActions.ts` | (targetText, sourceLang) → Promise<CardCreatorQueueItem[]> | handleCardCreatorAction | **SSOT**: Tokenize → filter unknown/tracking → lookup each in dictionary → return queue items |
| `waitForVideoReady` | `features/subtitle/actions/cardActions.ts` | (HTMLVideoElement, timeoutMs?) → Promise<void> | handleCardCreatorAction, handleClusterQuickAdd | **SSOT**: Wait for readyState ≥ 2 + videoWidth > 0 with timeout |
| `startGenerateNative` | `features/subtitle/actions/generateNativeAction.ts` | (targetCues, callbacks) → Promise<GenerateNativeResult \| null> | contentScriptController, local-player useSubtitleActions | **SSOT**: Core generate-native — load settings, validate, create BackgroundPrefillController. Returns null if validation fails |
| `validateGenerateNative` | `features/subtitle/actions/generateNativeAction.ts` | (sourceLang, targetLang, targetCueCount) → string \| null | startGenerateNative | **SSOT**: Validate languages differ + target cues exist |
| `SubtitleActionContext` | `features/subtitle/actions/subtitleActionContext.ts` | interface | cardActions, generateNativeAction, contentScriptController, local-player useSubtitleActions | **SSOT contract**: video, container, webTextCtrl, getTargetCues, getNativeCues, getCurrentTargetText, getCurrentNativeText, getOffsetMs, showToast, loadSettingsOrToast |
| `buildPanelItemsFromSubtitles` | `entrypoints/local-player/logic/subtitlePanelItems.ts` | (SubtitlesState) → BuiltPanelItems | local-player main.tsx | Build SubtitlePanelItem[] from SubtitlesState for manager track switching |
| `scanFolder` | `features/local-player/logic/folderScan.ts` | (FileSystemDirectoryHandle) → Promise<FolderScanResult> | local-player main.tsx handleOpenFolder | **Folder flow**: Scan top-level directory for video + subtitle files (no recursion — ponytail ceiling: avoids scanning entire drive). Returns `{ videos: VideoScanResult[], subtitleFiles: Map, subtitleFilenames: string[] }` |
| `matchVideosWithSubtitles` | `features/local-player/logic/folderScan.ts` | (VideoScanResult[], string[], targetLang, nativeLang) → VideoWithSubtitles[] | local-player main.tsx handleOpenFolder | Match each video with subtitles using existing `matchSubtitles` logic. Videos without match get `target: null` |
| `isVideoFile` / `isSubtitleFile` | `features/local-player/logic/folderScan.ts` | (filename) → boolean | scanFolder | Extension check: video (mp4/webm/ogg/ogv/mov), subtitle (srt/vtt/ass/ssa/ttml/dfxp/sbv/smi/sami) |
| `openFolder` | `entrypoints/local-player/hooks/useFileSystemAccess.ts` | () → Promise<FileSystemDirectoryHandle \| null> | local-player main.tsx handleOpenFolder | **Folder flow**: `window.showDirectoryPicker({ id: 'local-player-folder' })`. Returns null on AbortError (user cancel), re-throws SecurityError |
| `handleOpenFolder` | `entrypoints/local-player/main.tsx` | () → Promise<void> | PlayerView onOpenFolder → EmptyState "Open folder" button | **Folder flow**: openFolder → scanFolder → matchVideosWithSubtitles → saveVideo (with fallback if fileHandle not cloneable) → setLibrary → toggleLibrary. Caches dirHandle + subtitleFileMap for subsequent video clicks |
| `handleFilesDrop` | `entrypoints/local-player/main.tsx` | (files: File[]) → void | PlayerView video stage (useDropzone) → onFilesDrop | **Drag-drop flow**: split video/sub by extension (reuse `isVideoFile`/`isSubtitleFile` from folderScan SSOT) → stash subs in `pendingSubsRef` + `subtitleFileMapRef` → sort videos via `sortVideosByNumericSuffix` (numeric suffix 1→N then alphabetical) → cache all video File objects in `videoFileCacheRef` (key=videoId, for prev/next navigation without fileHandle) → play first video via `loadVideoWithPendingSubs` → save rest to library + toggleLibrary. Sub-only drop: if video loaded → match now; else pending until video arrives. No-match subs stay in `subtitleFileMapRef` for TrackSelector manual pick |
| `loadVideoWithPendingSubs` | `entrypoints/local-player/main.tsx` | (file: File) → Promise<void> | handleFilesDrop | Build record → setVideo → saveVideo → addHistoryEntry → refresh library → create throttled saver → `matchPendingSubsForVideo` |
| `matchPendingSubsForVideo` | `entrypoints/local-player/main.tsx` | (videoFile: File) → Promise<void> | loadVideoWithPendingSubs, matchPendingSubsForCurrentVideo | Match pending subs (from `pendingSubsRef`) against video filename via `matchSubtitlesForVideo`. Target+native → loadAndParseSubtitle. 1 sub no match → auto-pair. Multiple no match → not-found (subs stay in subtitleFileMapRef for manual TrackSelector) |
| `sortVideosByNumericSuffix` | `features/local-player/logic/videoSort.ts` | (filenames: readonly string[]) → string[] | handleFilesDrop | Sort by trailing numeric suffix (1→N), fallback alphabetical. O(n log n) — ponytail: acceptable for drag-drop (n ≤ ~50) |
| `useSubtitleActions` | `entrypoints/local-player/hooks/useSubtitleActions.ts` | (deps) → SubtitleActionHandlers | local-player main.tsx, PlayerView | **Local-player**: Creates WebTextDictionaryController, builds SubtitleActionContext, exposes onQuickAdd/onEditCard/onUpdateCurrentCard/onGenerateNative/generateNativeEnabled |
| `useLocalVideo` | `entrypoints/local-player/hooks/useLocalVideo.ts` | (videoRef, containerRef, options) → LocalVideoControls | PlayerView | **Local-player playback hook**: media event listeners (play/pause/loadedmetadata/volumechange/ratechange/timeupdate throttled 250ms) + keyboard shortcuts on **window** (bubble phase, fires regardless of focus since `<video>` is not focusable). Shortcuts: Space (play/pause + preventDefault), ArrowLeft/Right (seek ∓5s, Shift=∓10s), m (mute), f (fullscreen), 0-9 (seek 0-90%). **autoPlay option**: when true, `loadedmetadata` handler calls `video.play()` (browser allows after file-picker gesture; rejection swallowed if policy blocks). Editable guard via `isEditableEvent` (composedPath crosses shadow DOM) so typing in inputs isn't blocked |
| `useSubtitleEngine` | `entrypoints/local-player/hooks/useSubtitleEngine.ts` | (videoRef, videoFile) → SubtitleEngineControls | local-player main.tsx, PlayerView | **Local-player subtitle engine hook**: creates SubtitleCueEngine with persisted style/block/cluster settings (loaded on mount via loadSettings), binds timeupdate → engine.onTimeUpdate, exposes NavCluster actions (prev/next/repeat/rewind/forward/playPause), offset control, + **appearance setters** (updateStyle/updateBlockSettings/updateClusterSettings) for SubtitleManagerPanel Customize tab. Also exposes getTargetCues/getNativeCues for track download. Style changes re-render SubtitleBlock via cuesStore + React state |
| `PlayerView` | `entrypoints/local-player/components/PlayerView.tsx` | (PlayerViewProps) → JSX | local-player main.tsx | **Local-player top-level layout**: PlayerMenuBar → video stage → PlayerControls. **Click-to-pause**: `onClick` on `<video>` toggles play/pause (clicks pass through `.subtitleOverlay` via `pointer-events:none`). **Play/pause flash**: `PlayPauseOverlay` centered icon (pop+fade, 410ms `ease-spring`) triggered by `isPlaying` change effect — covers click + Space + any toggle source. **Subtitle shortcuts**: window keydown listener calls `handleShortcutKey(DEFAULT_KEYBOARD_SHORTCUTS)` → dispatches to subtitleEngine (prev/next/repeat), subtitlePanelsRef (toggleSplitView), subtitleActions (onQuickAdd/onEditCard/onGenerateNative), local `overlayVisible` state (toggle-overlay via `w`). Loads user shortcuts from `loadSettings()` async. Skips `play-pause` (useLocalVideo handles Space — no double-toggle), `toggle-player-mode` + `toggle-translate` (host-page-only, ponytail ceiling). Editable guard skips when focus in input/textarea. **Subtitle manager**: passes `managerShadowCss={hostManagerSheetShadowCss}` to `SubtitlePanels` so the manager portal shadow root (`#cell-manager-portal`) gets design tokens + component CSS — without it `managerPortalTarget` stays null and `ManagerLayer` never renders. **Prev/next video**: passes `hasPrevVideo`/`hasNextVideo`/`onPrevVideo`/`onNextVideo` to PlayerControls (chevron-left/right flanking play/pause) |
| `PlayerControls` | `entrypoints/local-player/components/PlayerControls.tsx` | (PlayerControlsProps) → JSX | PlayerView | **Bottom control bar**: two-row layout (Timeline full-width + controls row). Left pill: prev-video (chevron-left, disabled at index 0) → play/pause → next-video (chevron-right, disabled at last) → skip ±10s → volume (hover→slider) → time. Right pill: captions + settings popover (speed, track selector) + PiP + fullscreen. Prev/next video buttons only render when `onPrevVideo`/`onNextVideo` provided; disabled state from `hasPrevVideo`/`hasNextVideo` |
| `PlayPauseOverlay` | `entrypoints/local-player/components/PlayPauseOverlay.tsx` | ({ icon, pulseKey }) → JSX | PlayerView | Centered play/pause icon flash. `pulseKey` remounts node to replay CSS animation (pop-in scale 0.6→1.1→1 + fade-out, `duration-medium` `ease-spring`). `pointer-events:none` so clicks pass through. `prefers-reduced-motion` shortens to `duration-fast` + no scale |
| `useDropzone` | `entrypoints/local-player/hooks/useDropzone.ts` | (onFilesDrop) → { dragging, handlers } | PlayerView video stage | **Drag-drop logic hook** (pure, testable). Counter pattern: dragenter/dragleave fire on every child boundary — a depth counter keeps `dragging` stable until cursor fully exits the container (prevents flicker over nested children). File filter reuses `isVideoFile`/`isSubtitleFile` from folderScan (SSOT). Decoupled from EmptyState so drop works whether stage shows EmptyState or an active video |
| `DropOverlay` | `entrypoints/local-player/components/DropOverlay.tsx` | () → JSX | PlayerView (renders when `dragging`) | **Drag-over visual feedback layer** — absolute inset:0, `pointer-events:none` (never blocks the stage drop target), dashed border + primary-subtle backdrop + blur + icon badge + hint "Drop to add video & subtitles". Follows PlayPauseOverlay pattern. Renders identically over EmptyState or active video |
| `findCurrentLine` | `content/subtitleSync.ts` | (SrtCue[], number, offsetMs=0) → number | subtitleOverlay, navClusterActions | Binary search O(log n) for current subtitle line by video time. ADR-019: optional offsetMs shifts search window (apply offset globally, no per-cue mutation) |
| `createOverlay` | `content/subtitleUI.ts` | (HTMLElement, OverlayConfig) → HTMLDivElement | subtitleOverlay | Create subtitle overlay div appended to video wrapper |
| `updateOverlayText` | `content/subtitleUI.ts` | (HTMLDivElement, string) → void | subtitleOverlay | Set text and show overlay |
| `hideOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Clear text and hide overlay |
| `removeOverlay` | `content/subtitleUI.ts` | (HTMLDivElement) → void | subtitleOverlay | Remove overlay from DOM |
| `createDragHint` | `content/subtitleUI.ts` | HTMLElement → HTMLDivElement | content-script.ts | Create drag-drop hint overlay appended to video parent |
| `showToast` | `content/subtitleUI.ts` | (string, HTMLElement) → void | content-script.ts | Show temporary toast message inside video parent |
| `createOverlayLayer` | `content/subtitleUI.ts` | (role, OverlayStyleConfig, HTMLElement) → {overlay, textSpan} | subtitleOverlay | **ADR-013 → ADR-015**: Create 1 overlay div độc lập (target OR native) + text span. ADR-015 xóa drag handle button, overlay = drag target (pointer-events: auto, cursor ns-resize, role=slider ARIA on overlay div) |
| `applyStyle` | `content/subtitleUI.ts` | (OverlayStyleConfig, HTMLDivElement) → void | subtitleOverlay, content-script.ts | **ADR-013 → ADR-015**: Set inline style (fontSize, fontWeight, color, bg+alpha, opacity, textShadow, fontFamily, yOffset%, align, visible). ADR-015: aria-valuenow set directly on overlay (bỏ querySelector('[role="slider"]') trap) |
| `buildTextShadow` | `content/subtitleUI.ts` | (TextShadowConfig) → string | applyStyle | Pure — build CSS text-shadow string (none/soft/cinema/custom preset) |
| `sanitizeFontFamily` | `content/subtitleUI.ts` | (string) → string | applyStyle | **NEW (planned ADR-013)**: Pure — block url()/@import/expression(), fallback 'sans-serif' |
| `hexToRgba` | `content/subtitleUI.ts` | (hex, alpha 0-1) → string | applyStyle | **NEW (planned ADR-013)**: Pure — convert hex + alpha → rgba string (bg color tách alpha rời) |
| `readFileAsText` | `content/subtitleDragDrop.ts` | File → Promise<string> | subtitleImport | Read File content as text via FileReader |
| `handleFileDrop` | `content/subtitleDragDrop.ts` | File → Promise<ParseResult> | subtitleImport | Validate extension + read + parse subtitle file |
| `createImportButton` | `content/subtitleImport.ts` | (HTMLElement, OverlayConfig) → HTMLButtonElement | subtitleOverlay | Create import button at top-left of video parent (avoids toggle overlap) |
| `handleFileSelect` | `content/subtitleImport.ts` | File → Promise<ParseResult> | content-script.ts | Handle file from picker (reuses handleFileDrop) |
| `createToggleButton` | `content/subtitlePanel.ts` | () → HTMLButtonElement | contentScriptController.ts | Create toggle button (toggles Side Panel via OPEN/CLOSE_SIDE_PANEL, state tracked in contentScriptController `sidePanelOpen`) — **ADR-008**. **ADR-027**: returns element without appending to container; caller appends to subtitle block more-popover slot via `attachOverflowButtons` |
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
| `handleAutoLoadSubtitles` | `content/subtitleAutoLoad.ts` | (AutoLoadPayload, deps) → Promise<void> | content-script.ts | Auto-load handler: fetch target + native → mergeCuesForPanel → loadBilingualCues. **Inline status**: `deps.onLoadStatus(role, LoadStatus)` replaces `onToast` — reports loading/error per role with language label (via `isoCodeToLabel`); success needs no notification (subtitle appearing = success) |
| `clearAutoLoadCache` | `content/subtitleAutoLoad.ts` | () → void | content-script.ts | Clear per-URL cache on re-injection — **implemented Task 7** |
| `mergeCuesForPanel` | `content/subtitleMerge.ts` | (SrtCue[], SrtCue[]) → BilingualCue[] | subtitleAutoLoad.ts | Merge target + native cues: target skeleton, native best-effort overlap; fallback native skeleton when target empty — **implemented Task 5** |
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
| `handleShortcutKey` | `features/subtitle/ui/subtitleShortcuts.ts` | (string, KeyboardShortcut[], EventTarget) → ShortcutAction \| null | content-script.ts, **sidepanel/App.tsx** | Pure: map key → action, guard input/textarea focus. **ADR-027**: default `DEFAULT_KEYBOARD_SHORTCUTS` includes `generate-native` (key `g`) and `play-pause` (key ` ` — spacebar) |
| `createTranslateFunction` | `features/subtitle/ui/subtitleControllerHelpers.ts` | (sl, tl) → (text) => Promise<string[]> | contentScriptController.ts | Pure factory — creates `translate` callback for `BackgroundPrefillController`. Extracted from 4 identical inline closures (dedup) |
| `broadcastCues` | `features/subtitle/ui/subtitleControllerHelpers.ts` | (BilingualCue[]) → void | contentScriptController.ts | Pure — sends `SUBTITLE_CUES_LOADED` message to Side Panel. Extracted from 6 identical `sendMessage` calls (dedup) |
| `loadSettingsOrToast` | `features/subtitle/ui/subtitleControllerHelpers.ts` | (HTMLElement) => Promise<Settings \| undefined> | contentScriptController.ts | Pure — loads settings, shows error toast on failure. Extracted from 3 identical try/catch blocks (dedup) |
| `navigateCue` | `features/subtitle/ui/shortcutActionDispatcher.ts` | (action, video, cues, effectiveMs, offsetMs) → void | contentScriptController.ts | Pure (except seekToCue side effect) — navigate to prev/next/replay cue. Extracted from 2 identical switch blocks (dedup) |
| `toggleOverlayState` | `features/subtitle/ui/shortcutActionDispatcher.ts` | (overlayVisible, targetStyle, nativeStyle) → { new state } | contentScriptController.ts | Pure — returns new overlay state after toggle. Extracted from 2 identical blocks (dedup) |
| `isEditableTarget` | `features/subtitle/ui/subtitleShortcuts.ts` | EventTarget \| null → boolean | subtitleShortcuts.ts | Check if target is input/textarea/select/contenteditable — **implemented Task 3** |
| `SubtitleCueEngine` | `features/subtitle/ui/subtitleCueEngine.ts` | class (video, blockSettings, targetStyle, nativeStyle, clusterSettings, offsetProvider?, callbacks?) → engine | reactSubtitleController.ts | **T046**: Logic-only cue/offset/video/time/repeat state. Owns cue lists, active indices, AB loop, styles, generate-native/tokenize/dictionary state. Fires `onCuesUpdated`, `onStyleUpdated`, `onPlayPause`, `onGenerateNativeEnabled`. Dispatches `cell:cues:updated` so `useCuesStore` updates React components. Exports `CardCreatorAction` and `NavClusterIconName` types. |
| `SubtitleBlockController` | ~~`features/subtitle/ui/subtitleBlockController.ts` (DELETED in T046)~~ | — | — | Legacy vanilla DOM wrapper around `SubtitleCueEngine`. Removed in T046; `ReactSubtitleController` now owns the React shadow-root UI. |
| `ReactSubtitleController` | `features/subtitle/ui/reactSubtitleController.ts` | class (video, container, blockSettings, targetStyle, nativeStyle, clusterSettings, onGenerateNative?) → controller | contentScriptController.ts | **T046**: React UI wrapper around `SubtitleCueEngine`. Mounts `SubtitlePanels` into the shared shadow root via `mountSubtitle`. Implements manager items, offset, play/pause, repeat, card-creator actions, side-panel toggle, generate-native callbacks, and reversible Player Mode host/video layout with resize/restore. Replaces the legacy vanilla DOM path. |
| `mountSubtitle` | `features/subtitle/ui/mountSubtitle.tsx` | (MountSubtitleOptions) → MountSubtitleResult | reactSubtitleController.ts, tests | **T046**: Mount `SubtitlePanels` into an open shadow root with design-system CSS, including manager/search styles and shared Button/Input/Select/Skeleton/Tabs atom styles. Returns an imperative ref with `setStyles`, `setManager`, `setOffset`, `setManagerOpen`, `setIsPlaying`, `setRepeatActive`, `addToast`, etc. **T14 CSS manifest**: 3 arrays — `css[]` (overlay shadow root: subtitleBlock + navCluster + manager + search + offset + atoms + toast/hint + subtitlePanels + **subtitlePanelsShared** + playerModeOverlay + cueList + icon + iconButton + tokenSpan + appearance), `managerShadowCss[]` (body-level manager portal: sheet + manager + search + apiKey + offset + atoms + subtitlePanels + **subtitlePanelsShared** + icon + iconButton + tokenSpan + appearance), `hostManagerSheetShadowCss[]` (in `hostManagerSheetShadowCss.ts`: hostManagerSheet + sheet + manager + search + apiKey + offset + atoms + subtitlePanels + **subtitlePanelsShared** + icon + iconButton + tokenSpan + appearance) — all 3 include `subtitlePanelsSharedCss` |
| `createSubtitleBlockDOM` | `features/subtitle/ui/subtitleBlockDom.ts` | () → SubtitleBlockDOM | subtitleBlockController.ts | **ADR-025**: Pure DOM factory — builds block > body > (clusterColumns + subtitleColumn + rightColumn). **ADR-027**: rightColumn now contains `generateNativeBtn` (cluster-btn with SVG icon, `aria-label="Generate native subtitle"`, title `G`). **ADR-027 redesign**: rightColumn = `rightColPrimary` (quickUpdateBtn + editCardBtn + moreBtn) + `morePopover` (panelToggleSlot + importButtonSlot) + `rightColSecondary` (updateCurrentCardBtn + generateNativeBtn + managerIconSlot) |
| `wireBlockDrag` | ~~`content/subtitleBlockDrag.ts` (DELETED in T046)~~ | — | — | Legacy vanilla DOM drag. Removed in T046; React UI now owns drag via `SubtitlePanels` pointer handlers + `subtitleBlockDrag` logic. |
| `clampYOffset` / `dragDeltaToYOffset` | `features/subtitle/logic/subtitleBlockDrag.ts` | (value) → number / (startOffset, deltaY, containerHeight) → number | SubtitlePanels.tsx | **ADR-025 (React)**: Pure drag-to-reposition logic — clamp 0-95, px delta → percent. O(1). Unit tested. Snap-to-point (25/50/75) đã bỏ theo yêu cầu — release ở đâu giữ nguyên đó, chỉ clamp. |
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
| `initEpisodeChangeWatcher` | `entrypoints/content/content-script.ts` | () → void | content-script.ts (module-level) | MutationObserver persist observe `<video>` element replacement → send VIDEO_EPISODE_CHANGED when 2nd+ video appears (episode switch). Quality switch keeps same element → no clear. — **ADR-010** |
| `reportEpisodeChangedIfReplacement` | `entrypoints/content/content-script.ts` | () → void | initEpisodeChangeWatcher | Send VIDEO_EPISODE_CHANGED if `hasSeenFirstVideo` already true (replacement); else baseline first mount — **ADR-010** |
| `isVideoReady` | `entrypoints/content/content-script.ts` | (HTMLVideoElement) → boolean | findAndInitOverlay | Gate: true if `video.src` is `blob:` OR `readyState>=2`. Prevents init during Angular two-phase render (phase 1: src="" → foreign elements wiped; phase 2: blob: assigned → safe). — **ADR-012** |
| `findAndInitOverlay` | `entrypoints/content/content-script.ts` | () → void | content-script.ts (module-level) | Find ready `<video>` → initSubtitleOverlay. MutationObserver with `attributeFilter:['src']` catches phase-2 src assignment. Disconnects after init. — **ADR-012** |
| `tokenizeTextBlock` | `features/tokenize/logic/textTokenizer.ts` | (text, langCode?) → Token[] | webTokenizeController, subtitleTokenizeController | Split text into word/punctuation tokens with UTF-16 offsets; EN uses phraseMatcher tokenizeSentence and drops non-ASCII tokens to avoid Vietnamese/French/etc. lookups, ZH uses FMM fallback; BCP-47 subtags handled via languageMatches |
| `prepareTokenBlock` | `features/tokenize/logic/textTokenizer.ts` | (TokenBlock, langCode?) → void | webTokenizeController | Synchronous tokenization stored on block; metadata resolution happens separately so binding can be immediate |
| `resolveTokenMetadata` | `features/tokenize/logic/textTokenizer.ts` | (Token[], getStatus, getFrequencyBand) → Promise<void> | webTokenizeController, subtitleTokenizeController | Fill `status`/`frequencyBand` for non-separator tokens in-place; dedups terms |
| `findTextBlocks` | `features/tokenize/logic/tokenizeBlock.ts` | (root, options?) → TokenBlock[] | webTokenizeController | Walk text nodes, skip forbidden tags/roles and `.subtitle-line.native` (native translation is not tokenized), build TokenBlock list; explicit `role="link"` remains readable/tokenizable; skips text inside extension UI hosts including `#cell-universal-panel-host` unless an ancestor has `[data-allow-tokenize]` (card creator preview) (ponytail: does not merge adjacent inline text nodes) |
| `findTextBlocksInNodes` | `features/tokenize/logic/tokenizeBlock.ts` | (nodes, options?) → TokenBlock[] | webTokenizeController | Incremental scan of MutationObserver `addedNodes`; skips disconnected nodes, nodes inside existing token spans, and `.subtitle-line.native` |
| `TokenizeScheduler` | `features/tokenize/logic/tokenizeScheduler.ts` | class (priority queue + idle fallback) | webTokenizeController, subtitleTokenizeController | Viewport tasks use next-tick fast path with a real `performance.now()` budget (~16ms) so long queues yield to the browser; buffer/idle tasks use idle budget; per-task try/catch so one failing bind/unbind cannot hang the queue; `flush()` drains all priorities for tests |
| `ViewportTracker` | `features/tokenize/logic/viewportTracker.ts` | class (IntersectionObserver wrapper) | webTokenizeController | observe/unobserve with onEnter/onExit handlers; no-op when IntersectionObserver missing (jsdom/tests). ADR-055: `observe` fires `onEnter` synchronously for new handler sets on already-intersecting elements (SPA re-render reuses parent → IO won't fire new callback). VDLT-Predict (ADR-058): recreated by controller on scroll direction change with asymmetric rootMargin from resolveScrollPredictMargin |
| `resolveScrollPredictMargin` | `features/tokenize/logic/scrollDirection.ts` | (input) → { rootMargin, direction } | webTokenizeController | Pure: map scrollY delta to asymmetric IntersectionObserver rootMargin (deep ahead 1.0× height min 600px, shallow behind 0.25× min 150px, 16px hysteresis); direction up/down/none; valid CSS "top right bottom left" string. VDLT-Predict Phase B (ADR-058) |
| `TokenizeCache` | `features/tokenize/logic/tokenizeCache.ts` | class (LRU + WeakMap<Element, TokenBlock>) | webTokenizeController | Bounded block cache; capacity tuned by `navigator.deviceMemory`; `onEvict` unbinds DOM and removes the block from `domMap`; `touch(block)` refreshes recency for visible/bound blocks; `getByElement` reverse lookup |
| `createWebTokenizeController` | `features/tokenize/controller/webTokenizeController.ts` | (options) → Promise<WebTokenizeController> | content-script.ts | VDLT-Predict (ADR-058): lazy scan/observe only while enabled; cold-start viewport-first bind via `bindViewportNow` on enable + after `window.load` (before hydration quiet gate) so viewport tokens appear in the same turn; persisted enable waits for `window.load` + 500ms child-list DOM quiescence (HYDRATION_QUIET_MS) capped by MAX_ACTIVATION_DELAY_MS=3000ms hard deadline (ADR-055: heavy SPA never goes quiet) — but viewport bind fires immediately after load, quiet gate only delays offscreen hydrate; direction-aware asymmetric rootMargin recreated on scroll direction change (rAF-coalesced passive scroll listener, 16px hysteresis, deep ahead 1.0× height min 600px / shallow behind 0.25× min 150px); prepare-ahead at PRIORITY_PREPARE so tokens are ready before bind; mutation re-scan accumulates `addedNodes` and uses `findTextBlocksInNodes` for incremental scans; fast path schedules `queueMicrotask` to bind new nodes immediately, with a 300ms trailing-debounce fallback capped by MAX_MUTATION_SCAN_DELAY_MS=1500ms; also observes `characterData` and `removedNodes` to re-tokenize or clean up re-rendered text; eager `tryBindVisible` only for small mutation batches (<=50 nodes), avoiding forced reflow on large batches; cache capacity is dynamic by `navigator.deviceMemory` (150/300/500); stale blocks whose source node is detached are evicted so text is not left untokenized; visible blocks are bound immediately after synchronous tokenization, then status/frequency metadata is fetched in one batched background request and rebound; soft-unbind preserves tokens for cheap reverse-scroll rebind; `blocks` array is pruned when cache evicts; cancels pending observer/listener on disable/destroy; disable disconnects observer, unbinds and clears blocks; setting changes rebind visible blocks; keyboard shortcuts 1-4 set word status and trigger `options.onStatusChange` so the popup stays in sync; exposes `getStatusForTerm` for `webTextDictionaryController` local-status fallback; Popup Dictionary wiring |
| `createSubtitleTokenizeController` | `features/tokenize/controller/subtitleTokenizeController.ts` | (options) → SubtitleTokenizeController | subtitleBlockController.ts | Tokenize active + windowed target subtitle cues; native line is left plain because it is the learner's native translation; status/frequency classes; keyboard shortcuts; Popup Dictionary wiring via `onOpenDictionary` |
| `getStatusForTerm` | `features/tokenize/controller/webTokenizeController.ts` | (term) → WordStatus | webTextDictionaryController | Returns the locally cached word status for a term; used to seed the popup status when the background read is 'unknown' |
| `rankToBand` | `shared/lib/frequencyBand.ts` | (rank) → TokenFrequencyBand | features/tokenize/utils/frequencyBand.ts (re-export), webTokenizeController, subtitleTokenizeController, features/dictionaryPopup/ui/CandidateView.tsx | Rank thresholds: ≤3000 core, ≤5000 common, ≤10000 general, ≤20000 advanced; all remaining positive finite ranks become rare; only invalid data returns none (ADR-052) |
| `entriesToBand` | `shared/lib/frequencyBand.ts` | (FrequencyEntry[]) → TokenFrequencyBand | features/tokenize/utils/frequencyBand.ts (re-export), webTokenizeController, subtitleTokenizeController | Pick best (lowest) rank across resources; falls back to 'rare' when there are no entries so every token gets a band (ADR-052) |
| `extractTermsFromSelection` | `features/tokenize/utils/selectionTerms.ts` | (Selection \| null) → string[] | webTokenizeController, subtitleTokenizeController | Collect unique `data-cell-term` values from `.js-cell-token` spans intersecting a native text selection; scoped to the selection's common ancestor with document fallback; powers batch status change via 1/2/3/4 keys on a selected passage |
| `bindTokenBlock` | `features/tokenize/ui/tokenSpanRenderer.ts` | (TokenBlock, displayOptions) → void | webTokenizeController, subtitleTokenizeController | Wrap tokens in spans, apply status/frequency classes, attach hover/click/Ctrl+click handlers; skips if source node is detached or spans already present; restores/re-creates text on unbind |
| `unbindTokenBlock` | `features/tokenize/ui/tokenSpanRenderer.ts` | (TokenBlock) → void | webTokenizeController, subtitleTokenizeController | Remove injected spans and restore the original source text node; if SPA re-render removed the source node, a fresh text node is created and `block.sourceNodes` is updated |
| `injectTokenSpanStyle` | `features/tokenize/ui/tokenSpanCss.ts` | () → void | tokenSpanRenderer | Inject the token span stylesheet (buildTokenSpanCss) into the page head once. CSS uses `white-space: inherit !important` (not `normal`) so token spans respect the host page's white-space (e.g. nowrap nav links) instead of forcing wrapping; `overflow-wrap: break-word` only breaks long words that overflow. Status bar via inset box-shadow + box-decoration-break:clone for multi-line fragments. T007: frequency bands use --color-success-muted / --color-warning-muted / --color-error-muted with --color-success / --color-warning / --color-error foregrounds; status-ignore uses --color-text-secondary. T076: `--overlay-text-rgb` fallback removed; highlight now maps through `--cell-token-overlay-text-rgb` to `--overlay-text-rgb` from `tokens.json`, leaving no raw colors in the generated token CSS. T078: `buildVariables()` now injects 5 static design tokens (`--space-0-5`, `--shadow-sm`, `--border-width-hairline`, `--radius-xs`, `--duration-100`) from `STATIC_TOKENS` (exported from `tokens.ts`) alongside color tokens — without these, the status bar `box-shadow: inset 0 calc(var(--space-0-5) * -1) ...` is an invalid declaration on host pages (tokens.css never loads there) and silently drops, making the status underline invisible while frequency bands (which only use `--cell-token-*` color vars) still render. Static tokens are theme-independent → single `:root` block suffices (also duplicated into `[data-theme]`/`@media dark` for cascade consistency). |
| `useTokenize` | `features/tokenize/ui/useTokenize.ts` | (options?) → { state, onToggle } | TokenizeFab, panel header | Encapsulates tokenize panel state and toggle callbacks. Optional external `TokenizeStateStore` sync: subscribes to store changes and dispatches `setEnabled`/`setShowStatus`/`setShowFrequency`. Falls back to internal `useState` when no store is provided. |
| `mountTokenizeFab` | `features/tokenize/ui/mountTokenizeFab.ts` | (options) → { destroy } | content-script.ts | T077: Mount `TokenizeFab` into a shadow root host on `document.body`, re-render with `ShadowThemeProvider` for host `data-theme`, bridge a `TokenizeStateStore` (or adapter) to `TokenizeFab`, and re-parent the host on `fullscreenchange` so it survives video fullscreen. |
| `TokenizeFab` | `features/tokenize/ui/TokenizeFab.tsx` | (props) → JSX | mountTokenizeFab (T077), design-system showcase | React settings FAB, right-edge position offset below orbital badge, click opens a panel with `Toggle` controls for `enabled`/`showStatus`/`showFrequency` and a `Button` to open the dictionary. Uses `useTokenize` for state. Click-outside closes the panel. |
| `TokenizeFabPreview` | `entrypoints/design-system-showcase/App.tsx` | () → JSX | design-system showcase | Previews `TokenizeFab` with interactive `TokenizePanelState` inside a transformed containing block. |
| `CardCreatorPreview` | `entrypoints/design-system-showcase/CardCreatorPreview.tsx` | () → JSX | design-system showcase | **T081**: Previews `CardCreatorDialogContent` (panel layout) with a self-contained mock `CardCreatorState` — queue, media, editable fields; no chrome.runtime/Anki calls. |
| `loadTokenizeSettings` | `features/tokenize/services/tokenizeSettingsStore.ts` | () → Promise<TokenizeSettings> | webTokenizeController, contentScriptController.ts | chrome.storage.local per-origin/URL enable state |
| `createTokenizeStateStore` | `features/tokenize/services/tokenizeStateStore.ts` | (options) → TokenizeStateStore | webTokenizeController, subtitleTokenizeController | In-memory reactive store: enabled, showStatus, showFrequency, hoveredTerm, selectedTerms |
| `findFrequencyByTerms` | `features/dictionary/repositories/frequencyRepository.ts` | (langCode, terms) → Promise<Map<string, FrequencyEntry[]>> | registerFrequencyHandlers | Batch fetch frequency entries for many terms in one IDB transaction |
| `dispatchCuesUpdated` | `features/subtitle/events.ts` | (target, detail) → void | subtitleBlockController.ts, mountSubtitle | Fires `cell:cues:updated` CustomEvent; detail carries target/native cue arrays + active indices |
| `useCuesStore` | `stores/cuesStore.ts` | Zustand store | SubtitleBlock, NavCluster | Holds target/native cues and active indices; listens to `cell:cues:updated` and supports `subscribeWithSelector` |
| `SubtitleBlock` | `features/subtitle/ui/SubtitleBlock.tsx` | (props) → JSX | mountSubtitle, design-system showcase | Renders active target + native cue lines with `OverlayStyleConfig`; uses `useCuesStore` selectors |
| `NavCluster` | `features/subtitle/ui/NavCluster.tsx` | (props) → JSX | mountSubtitle, design-system showcase | React nav cluster with prev/repeat/next, rewind/play/forward, collapse and no-sub states |
| `mountSubtitle` | `features/subtitle/ui/mountSubtitle.tsx` | (options) → { unmount } | content-script entrypoints | Mounts shared shadow host on video container; renders `SubtitleBlock` + `NavCluster`; injects tokens + module CSS |
| `ShadowOverlayPoC` | `entrypoints/design-system-showcase/ShadowOverlayPoC.tsx` | () → JSX | design-system showcase | PoC fixed shadow host (`position: fixed; inset: 0`) covering viewport and surviving fullscreen |
| `PopupDictionaryPreview` | `entrypoints/design-system-showcase/App.tsx` | () → JSX | design-system showcase | Previews `PopupDictionary` with mock `LookupResult` and functional audio/image/translate/links tabs |
| `mockDictionary` | `entrypoints/design-system-showcase/mockDictionary.ts` | `installMockDictionarySendMessage()` + mock data | `App.tsx` | Installs a global `sendMessage` override for the showcase so `PopupDictionary` runs offline |
| `SubtitleBlockPreview` | `entrypoints/design-system-showcase/SubtitleBlockPreview.tsx` | () → JSX | design-system showcase | Previews `SubtitleBlock` with mock target/native cues; sets `useCuesStore` |
| `NavClusterPreview` | `entrypoints/design-system-showcase/NavClusterPreview.tsx` | () → JSX | design-system showcase | Previews `NavCluster` with interactive state toggles |
| `normalizeSearch` | `features/subtitle/logic/subtitleSearch.ts` | (providerId, raw, query) → SubtitleSearchResult[] | background/handlers/subtitleSearch.ts | **ADR-079**: Pure — delegate to provider registry, normalize raw API JSON → SubtitleSearchResult[] |
| `buildSearchRequest` | `features/subtitle/logic/subtitleSearch.ts` | (providerId, query, apiKey) → FetchPlan | background/handlers/subtitleSearch.ts | **ADR-079**: Pure — delegate to provider registry, build fetch params (method/url/headers/body) for search |
| `buildDownloadRequest` | `features/subtitle/logic/subtitleSearch.ts` | (providerId, result, apiKey) → FetchPlan | background/handlers/subtitleSearch.ts | **ADR-079**: Pure — delegate to provider registry, build fetch params for download (SubDL direct GET / OS POST handshake) |
| `decodeDownload` | `features/subtitle/logic/subtitleSearch.ts` | (providerId, bytes, result) → { content, format } | background/handlers/subtitleSearch.ts | **ADR-079**: Pure — delegate to provider registry, decode response bytes (UTF-8/CP1251/Big5/gzip/zip) → text + format |
| `pickProviderOrder` | `features/subtitle/logic/subtitleSearch.ts` | () → string[] | background/handlers/subtitleSearch.ts | **ADR-079**: Returns ['subdl', 'opensubtitles'] — SubDL-first, OS fallback |
| `pickDownloadKey` | `background/helpers/subtitleKeyLedger.ts` | (ledger, provider) → KeyLedgerEntry \| undefined | background/handlers/subtitleSearch.ts | **ADR-079**: O(n) scan — filter active + remaining > 0 + not rate-limited → oldest lastDownloadAt. Returns undefined when all exhausted |
| `pickSearchKey` | `background/helpers/subtitleKeyLedger.ts` | (ledger, provider) → KeyLedgerEntry \| undefined | background/handlers/subtitleSearch.ts | **ADR-079**: Search quota riêng — pick oldest lastDownloadAt for search (search is cheap, separate cursor) |
| `SubtitleSearchPanel` | `features/subtitle/ui/SubtitleSearchPanel.tsx` | (props) → JSX | SubtitleManagerPanel | **ADR-079**: Search UI — query input + lang select + season/episode + results list + cue preview + role picker (Target/Native); debounce 300ms + AbortController; inline ApiKeyManager when no key (moved from Settings) |
| `ApiKeyManager` | `features/settings/ui/ApiKeyManager.tsx` | (props) → JSX | SubtitleSearchPanel (no-keys state) | **ADR-079**: API key CRUD UI — add/edit/delete + list by provider + status badge (active/rate-limited/invalid/unverified) + remaining downloads; masked key (last 4 chars); delete confirm dialog; moved from SettingsDialogContent to SubtitleSearchPanel |
| `subtitlePanelsTypes` | `features/subtitle/ui/subtitlePanelsTypes.ts` | ManagerState, OffsetState, SubtitlePanelsRef, SubtitlePanelsProps, AppearanceState | SubtitlePanels, SubtitleManagerPanel, ManagerLayer, OffsetLayer, ClusterRightToolbar, managerStateSerializer, iframeManagerBridgeTypes | **T14**: SSOT types — pure type file (no JSX, no logic) breaks `logic/` → UI file dependency. Re-exported by `SubtitlePanels.tsx` + `SubtitleManagerPanel.tsx` for backward-compat. Spec: docs/specs/subtitle-panels-atom-decomposition.md (D6) |
| `ClusterRightToolbar` | `features/subtitle/ui/ClusterRightToolbar.tsx` | (ClusterRightToolbarProps) → JSX | SubtitlePanels (mode='overlay'), PlayerModeOverlay (mode='player') | **T14**: Molecule — right-side toolbar shared by overlay + Player Mode; quick-add/edit-card/update-current-card/manager-toggle/generate-native/side-panel-toggle + tools-expand; overlay adds player-mode toggle, player adds Exit. CSS từ `subtitlePanelsShared.module.css`; giữ tất cả `data-cell-id` (C5). Spec: D5 |
| `ManagerLayer` | `features/subtitle/ui/ManagerLayer.tsx` | (ManagerLayerProps) → JSX \| null | SubtitlePanels (overlay), HostManagerSheet (host adapter) | **T14**: Molecule — renders `SubtitleManagerPanel` once (mobile Sheet + desktop `.panelLayer` backdrop); owns persisted `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` (getStorage/setStorage, clamp 20-95vh) + backdrop click-to-close. Spec: D1, Task 4 |
| `OffsetLayer` | `features/subtitle/ui/OffsetLayer.tsx` | (OffsetLayerProps) → JSX | SubtitlePanels | **T14**: Molecule — renders 2 `SubtitleOffsetPanel` (target + native) trong `.offsetRow` div; CSS reuse từ `subtitlePanelsShared.module.css` (không file CSS riêng — D3); `data-cell-id="subtitle-offset-layer"`. Spec: D3, Task 5 |

---

## Design-system showcase index

| Symbol | Path | Signature | Used by | Description |
|--------|------|-----------|---------|-------------|
| `autoDiscovery` | `entrypoints/design-system-showcase/autoDiscovery.ts` | `discoverShowcases()` + `discoverMissingShowcases()` -> `DiscoveredShowcase[]` | `ShowcaseGallery` | SSOT canonical taxonomy (`CANONICAL_META`), category aliases, detects missing `shared/ui` showcases |
| `ShowcaseGallery` | `entrypoints/design-system-showcase/ShowcaseGallery.tsx` | `() -> JSX` | `App.tsx` | Level/category tree, live search, status badges, responsive glass preview card |
| `MockProviders` | `entrypoints/design-system-showcase/mockProviders.tsx` | `(children) -> JSX` | `ShowcaseGallery` | Provides mock cues, dictionary result, and card creator draft via context |
| `MissingShowcasePlaceholder` | `entrypoints/design-system-showcase/MissingShowcasePlaceholder.tsx` | `{ title } -> JSX` | `autoDiscovery` | Placeholder preview for `shared/ui/` components without a showcase |
| `*.showcase.tsx` | `shared/ui/` and `features/*/ui/` | `Showcase` + `showcaseMeta` | `ShowcaseGallery` | Per-component design-system examples auto-rendered by the gallery |

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

---

## T1-T12 Generic subtitle-list discovery (E2E)

Mục tiêu: nhận diện danh sách phụ đề từ 9 site families (cinesrc, kisskh, lookmovie, broodingmovies, lunastream, MyAsianTV, noxx, moviepire/videasy, onflix) qua một pipeline chung, protocol-oriented, không branch site-specific trong `NetworkInterceptor`.

### Files (cần thêm vào bảng phụ thuộc chính)

| File | Import từ | Được import bở | Mô tả |
|---|---|---|---|
| `background/handlers/subtitleDiscovery.ts` | messages, message/schema, subtitleDiscovery, types | `background/index.ts` (registerSubtitleDiscoveryHandlers) | Handler `SUBTITLE_DISCOVERY_SIGNAL`: validate, inject tabId/frameId, gọi `SubtitleDiscoveryService.processSignal` |
| `background/subtitleDiscoveryService.ts` | subtitleDiscovery, offscreenFetch, declarativeNetRequest, helpers, types | `background/context.ts`, `background/index.ts`, `background/handlers/subtitleDiscovery.ts`, `background/wireEvents.ts` | Service nối pipeline với offscreen fetch, DNR referer rewrite, `networkInterceptor` inventory |
| `background/networkInterceptor.ts` | videoDetector, subtitleDetector, types | `background/index.ts`, `background/wireEvents.ts` | `onListingDetected` ngoài Stremio còn route các listing URL của generic discovery |
| `content/content-script.ts` | messages, pageScanner, subtitle features | `manifest.json` (ISOLATED) | Relay `__CELL_SUBTITLE_DISCOVERY` từ MAIN-world; scan iframe `src*="subs="` và biến HTML `playerjsSubtitle` |
| `content/fetchInterceptor.iife.ts` | — | `manifest.json` (MAIN) | Patch `fetch` gửi subtitle URL và response body listing/HLS qua `__CELL_SUBTITLE_DISCOVERY` |
| `content/subtitleDiscovery-main-world.iife.ts` | — | `manifest.json` (MAIN, document_idle) | Poll các player globals (`the_subtitles`, `playerjsSubtitle`) trong mọi frame |
| `features/detection/subtitleDiscovery/*` | detection, languageRegistry, message/schema | `background/subtitleDiscoveryService.ts`, `features/detection/index.ts` | Pipeline: signals, schemas, adapters (JSON listing, iframe hash, HTML variable, player state, HLS, videasy encrypted decoder), candidate/identity helpers |

### Nguồn tín hiệu (7 loại signal)

- `network-response`: response body từ `webRequest` hoặc fetch interceptor (JSON listing, HLS, encrypted).
- `hls-playlist`: master playlist `.m3u8` đã có body (khi cần trigger trực tiếp).
- `frame-source`: URL iframe chứa hash/query `subs=` (lunastream/moviesapi).
- `document-html`: HTML chứa biến `playerjsSubtitle` (MyAsianTV/kisscloud fallback).
- `player-state`: giá trị global từ player (noxx `the_subtitles`, MyAsianTV `playerjsSubtitle`).

### Adapter registry (default)

1. `cinesrc-listing` — JSON array.
2. `kisskh-listing` — JSON array.
3. `lookmovie-listing` — JSON object, split `subtitles[]` (string/uple).
4. `broodingmovies-listing` — JSON object, `default_subs[]`.
5. `lunastream-iframe-hash` — decode hash `subs=`.
6. `myasiantv-html-variable` — parse `[label]url,…` từ HTML hoặc player-state.
7. `noxx-player-state` — parse `[label]url` array.
8. `onflix-hls` — parse `EXT-X-MEDIA:TYPE=SUBTITLES`.
9. `videasy-encrypted` — decrypt captured `sources-with-title` response using seed + tmdbId from URL, emit ready candidates.

### Chú ý kỹ thuật

- `resolveRelativeUrl` dùng `new URL(relative, base)`; adapter tự cung cấp `baseUrl` cho từng nguồn.
- `fetchText` dùng `offscreenFetch` để tránh SW idle eviction (M15); kèm DNR referer rewrite.
- Bảo mật: content script gửi `signal.origin`, background validate qua Zod; `MessageBus` inject `tabId`/`frameId` từ sender.
- Giới hạn: onflix cần test HLS server-variant thực tế.

## Language Profile (schema v23)

Tính năng cho phép người dùng tạo nhiều cặp target/native language, mỗi profile có bộ overlay style, auto-load, dictionary popup và resource allow-list riêng. Active profile quyết định cấu hình flat subtitle/dictionary hiện hành.

### Model & resolution (`@/entities/settings`)

| File | Vai trò | Public API |
|------|---------|------------|
| `src/entities/settings/types.ts` | `LanguageProfile`, `ResolvedProfile`, `Settings` v23 fields | `universalNativeLanguage`, `languageProfiles`, `activeProfileId` |
| `src/entities/settings/lib/profileResolution.ts` | Resolve active profile; migrate flat settings to v23 profile | `getActiveProfileSettings`, `resolveProfile`, `buildProfileName`, `validateLanguageProfile`, `generateProfileId`, `resolveSettingsFlatFields` |
| `src/entities/settings/lib/profileResolution.test.ts` | Unit tests cho resolution + validation | — |

### Storage migration

| File | Vai trò |
|------|---------|
| `src/shared/lib/storage/settingsStore.ts` | `CURRENT_SCHEMA_VERSION = 23`; migration v22→v23 tạo default profile từ `subtitleOverlayTargetLanguage`/`subtitleOverlayNativeLanguage`; `validateLocalPlayerSettings` + `validateNavClusterFields` chạy sau mọi migration; `resolveSettingsFlatFields` trong `loadSettings` |
| `tests/unit/shared/lib/storage/settingsMigration.test.ts` | V23 schema assertions |
| `tests/unit/shared/lib/storage/settingsStore*.test.ts` | v23 schema version tests |

### UI

| File | Vai trò | Dependencies |
|------|---------|--------------|
| `src/features/settings/ui/LanguageProfilePanel.tsx` | Quản lý profiles (add/edit/delete/reorder, universal native, duplicate from active) | `SettingsRow`, `SearchableSelect`, `Dialog`, `Toggle`, `Alert`, `Button`, `IconButton`, `HStack`, `VStack`, `Icon` |
| `src/features/settings/ui/SettingsDialogContent.tsx` | Nhúng `LanguageProfilePanel` section + truyền `resourceIds` active profile cho `ResourcesPanel` | `getActiveProfileSettings` |
| `src/features/settings/ui/SettingsDialog.module.css` | `.profileList`, `.profileItem`, `.profileDialogBody`, `.rowLabel`, … | — |

### Universal panel quick switch

| File | Vai trò |
|------|---------|
| `src/features/universalPanel/UniversalPanelHeader.tsx` | Dropdown `Select` chuyển active profile |
| `src/features/universalPanel/UniversalPanel.tsx` | Truyền `languageProfiles`, `activeProfileId`, `onProfileChange` xuống header |
| `src/features/universalPanel/mountUniversalPanel.ts` | `loadSettings` lấy profiles; `saveSettings({ activeProfileId })` khi chuyển |

### Dictionary resource filter

- `src/features/dictionary/ui/ResourcesPanel.tsx` nhận `resourceIds?: readonly number[]`; chỉ hiển thị resource có `id` trong allow-list.
- `SettingsDialogContent` truyền `getActiveProfileSettings(settings)?.resourceIds`.
