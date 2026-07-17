# Principles — Engineering Lessons Index

> **Layer 1 (this file)**: abstract principles — scan nhanh, cross-project, không coupled codebase.
> **Layer 2 (case study files)**: technical detail — problem, fix, verification. Link từ "Cases" bên dưới.
> Khi gặp bug mới: grep file này → đọc tên nguyên lý → biết liên quan không → click case study nếu cần detail.

## Khái niệm hóa template (sau khi test pass + debug pass)

Khi fix bug → test pass → khái niệm hóa thành nguyên lý (abstract principle) để apply cho nhiều trường hợp.
Invoke `/conceptualization` skill cho full workflow.

### Layer 1 — Principle entry (thêm vào file này)
```markdown
## <Tên nguyên lý> (ngắn, abstract)

### Nguyên lý
<1-2 câu mô tả nguyên lý, không cụ thể case>

### Cases đã gặp
- [case-study-file.md](case-study-file.md) — <1 câu tóm tắt case>

### Apply cho
- <Tình huống khác nguyên lý này đúng>
- <Framework/library khác có pattern tương tự>
```

### Layer 2 — Case study file (`docs/knowledge/<case-name>.md`)
```markdown
# <Case name> (specific, codebase-coupled)

> **Principle**: [<principle name>](principles.md#<anchor>)

## Problem
<What happened, symptoms>

## Root causes
<Why it happened, code paths>

## Fix
<What changed, which files>

## Key insight
<1-2 sentences abstract — why the fix works>

## Verification
<Evidence the fix works: test results, live debug output>
```

### Bidirectional links (bắt buộc)
- Case study top: `> **Principle**: [link to principles.md#anchor]`
- Principle "Cases": `[link to case-study.md] — summary`

### Khi nào khái niệm hóa (5 triggers)
1. **Bug fix verified** — test pass + root cause understood (GĐ 7)
2. **Feature implementation insight** — code pass + pattern reusable (GĐ 4)
3. **Architecture decision** — ADR written or design decision made (GĐ 3)
4. **Refactor discovery** — code pass + simplification pattern found (GĐ 4)
5. **Cross-cutting pattern** — same logic appears 2+ times in codebase (GĐ 4-7)

### Khi nào KHÔNG khái niệm hóa
- Bug là 1-off (không tái sử dụng được)
- Bug là business logic (không phải pattern framework)
- Code chưa verified (test fail)
- Trivial one-liner (ponytail: no insight to abstract)
- No insight beyond "I implemented the spec" (spec-driven, no surprise)

---

## Broadcasts fan out → scope by identifier

### Nguyên lý
Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.

### Cases đã gặp
- [tab-scoping-popup-leak.md](tab-scoping-popup-leak.md) — chrome.runtime.sendMessage broadcasts to all tabs → pass tabId in payload, popup filters by tabId

### Apply cho
- chrome.runtime.sendMessage (Chrome extension)
- WebSocket rooms (server broadcasts to all rooms, client filters by roomId)
- Event emitters (EventEmitter emits to all listeners, filter by event type)
- Database queries (query returns all rows, filter by WHERE clause)

---

## Separate dedup from catch-up

### Nguyên lý
Separate "don't redo" (dedup) from "allow new items" (catch-up). Use id-level dedup for items already processed, allow re-run for new items.

### Cases đã gặp
- [auto-download-subtitle-catchup.md](auto-download-subtitle-catchup.md) — URL guard (coarse) blocked subtitle catch-up → id-level dedup (fine) allows catch-up without re-downloading video

### Apply cho
- Incremental processing (polling with diff)
- Caching with invalidation (cache by id, invalidate by key)
- Data synchronization (sync by id, allow new items)

---

## Gather candidates + filter by explicit criteria

### Nguyên lý
Don't assume query results match intent. Gather candidates from several query shapes, then filter by explicit criteria.

### Cases đã gặp
- [edge-app-window-leak.md](edge-app-window-leak.md) — chrome.tabs.query({ active: true, currentWindow: false }) returned app-window tab → gather 3 query shapes + filter chrome-extension:// URLs

### Apply cho
- chrome.tabs.query (Chrome extension)
- Database queries with complex WHERE (gather rows, filter by criteria)
- API responses with mixed data types (gather all, filter by type)

---

## Hybrid detection: fast single-candidate first, disambiguation second

### Nguyên lý
When detecting from noisy input, use fast deterministic stage first (single-candidate resolves immediately), expensive probabilistic stage second (only for ambiguous multi-candidate cases).

### Cases đã gặp
- [subtitle-language-detection.md](subtitle-language-detection.md) — script detection (26 scripts, single-candidate resolves immediately) → frequency disambiguation (38 profiles, only for Latin/Cyrillic/Arabic/Devanagari/Han)

### Apply cho
- Language detection (script → frequency, charset → n-gram)
- Spam filtering (rule-based first, ML second)
- Type inference (literal type first, flow analysis second)
- Any detection pipeline with cheap-then-expensive stages

---

## Dead field → link by co-occurrence, not by dead reference

### Nguyên lý
When a foreign key field is never populated by the producer, don't try to fix the producer. Link by co-occurrence (same scope/context) instead — it's robust to producer bugs.

### Cases đã gặp
- [subtitle-filename-matches-video.md](subtitle-filename-matches-video.md) — subtitle.videoId never set by detector → link by tabId (all subtitles on a video page belong to that page's video)

### Apply cho
- Orphaned foreign keys (field exists but never set)
- Event correlation (link events by timestamp window, not by correlationId)
- Log enrichment (link log lines by request scope, not by traceId if missing)

---

## Same codec config → share init segment, patch timeline offsets

### Nguyên lý
When merging fMP4 fragments from the same source stream, they share codec configuration. Strip duplicate init segments (keep only first), patch tfdt offsets cumulatively, update mvhd duration.

### Cases đã gặp
- [parallel-fmp4-merge.md](parallel-fmp4-merge.md) — parallel transmux splits TS into N groups, each emits own ftyp+moov + rebased tfdt → strip parts 1+ ftyp+moov, patch tfdt with cumulative offset, update mvhd duration

### Apply cho
- fMP4 concatenation (mux.js, ffmpeg wasm)
- HLS segment merging (same codec → share init)
- Any fragmented media merge where fragments share codec config but have independent timeline baselines

## State init must match DOM init

### Nguyên lý
Khi có 2 nguồn truth (state variable + DOM property), chúng phải sync ban đầu. Nếu không, toggle đầu tiên sẽ đi sai hướng — state flip nhưng DOM không thay đổi (hoặc ngược lại). Rule: nếu DOM `display: none`, state phải `false`; nếu DOM `display: flex`, state phải `true`.

### Cases đã gặp
- [state-dom-init-mismatch.md](state-dom-init-mismatch.md) — subtitle panel: 3/4 blocking bugs có cùng root cause (overlayVisible=true vs display:none, panel không auto-show, toggle ẩn) + storage migration thiếu keyboardShortcuts → popup crash

### Apply cho
- Content script state (closure variables + DOM style) — Chrome extension, userscript
- React state vs DOM ref (useState + useRef + imperative DOM mutation)
- Storage migration (old settings thiếu field mới → fill defaults ở migration, không guard mỗi consumer)
- Any UI với 2 nguồn truth: state variable + DOM property phải sync init

---

## Fullscreen target shared container

### Nguyên lý
When multiple UI pieces must remain visible together in fullscreen, the fullscreen element must be their common ancestor, not the media element. Fullscreening only the media element leaves sibling UI floating outside the fullscreen layer or overlaying the video.

### Cases đã gặp
- [fullscreen-target-shared-container.md](fullscreen-target-shared-container.md) — art-player fullscreen button targeted the video element, so the subtitle panel disappeared. Direct interception failed because content scripts run in an isolated world and page CSP blocks injected scripts; reactive redirect failed because `requestFullscreen()` requires a user gesture that is consumed before the `fullscreenchange` handler runs. Fix: let the player's chosen element become `document.fullscreenElement`, then move the subtitle panel **into** that element as a fixed-position overlay (30vw right side, max z-index) so it stays visible; restore parent and styles on exit.

### Apply cho
- Video players with side panels (subtitle, playlist, chat, annotations)
- Media players where controls/overlays must stay beside the video in fullscreen
- Content scripts that inject sibling UI into a site's native player
- Any fullscreen transition where the browser API targets a child, but a sibling must remain visible

---

## Measure after clearing transition styles

### Nguyên lý
When switching between layout modes that set conflicting inline styles, clear the previous mode's styles and force a reflow before measuring the "natural" size for the next mode. Measuring while old styles are still applied locks the transition/collapsed value and breaks the next mode.

### Cases đã gặp
- [measure-after-clearing-transition-styles.md](measure-after-clearing-transition-styles.md) — after exiting F0 fullscreen, `showPanelDocked` captured `f0.getBoundingClientRect().height` while fullscreen styles were still applied, locking a collapsed ~48px height. Fix: clear fullscreen styles, `void f0.offsetHeight`, then measure.

### Apply cho
- Content script mode switches (floating → docked → fullscreen)
- Imperative DOM transitions that rely on inline style snapshots (e.g., lock height before flex resize)
- Browser fullscreen API transitions where the element must return to natural flow
- Any "capture natural size" step that follows a state with strong inline styles

---

## Out-of-flow element needs explicit containing block → fill 100% of original box

### Nguyên lý
Khi di chuyển element `position: absolute/fixed` (out-of-flow) vào wrapper mới, wrapper KHÔNG kế thừa size của element — absolute elements contribute no height to containing block. Wrapper phải có explicit `width: 100%; height: 100%` để match original box. Container gốc phải thành positioned containing block (`position: relative`) để absolute wrapper fill đúng box, không phải ancestor rộng hơn. Apply cho cả initial setup VÀ restore path — reset wrapper về `static` = collapse lại.

### Cases đã gặp
- [out-of-flow-wrapper-collapse.md](out-of-flow-wrapper-collapse.md) — `createDockingWrapper` di chuyển video absolute vào `videoWrapper` không có width/height → wrapper collapse height 0 → video invisible trên page load. Fix: set `outerWrapper` + `videoWrapper` `width: 100%; height: 100%`, set F0 `position: relative`.

### Apply cho
- Content script DOM restructuring (move element into new wrapper)
- Art-player / video.js / any player với absolute-positioned video
- Drag-and-drop containers (element removed from flow → wrapper collapses)
- Portal/modal patterns (element moved to body → original container collapses)

---

## Flex items need explicit min-width: 0 / min-height: 0 to shrink below content

### Nguyên lý
A flex item with `flex: 0 0 <percentage>` only starts at that percentage. The browser's default `min-width: auto` / `min-height: auto` prevents the item from shrinking below its content size. To make a percentage flex item strictly obey its flex-basis, explicitly set `min-width: 0` (row) or `min-height: 0` (column) and clip or wrap overflow content.

### Cases đã gặp
- [flex-min-width-auto-overflow.md](flex-min-width-auto-overflow.md) — subtitle panel docked at 30% width, but cue text made `min-width: auto` push panel + video past F0. Fix: set `panel.style.minWidth = '0'` and `panel.style.overflow = 'hidden'`.

### Apply cho
- CSS flex layouts with percentage-based flex items that contain text or other intrinsic-width content
- Side panels, sidebars, split-panes, docked panels
- Horizontal scroll containers that must shrink below content width
- Mobile stacked flex columns where items should shrink below content height

---

## Preserve cross-axis size when aspect-ratio conflicts with layout change

### Nguyên lý
Changing an element's main-axis size can trigger its intrinsic `aspect-ratio` to automatically resize the cross-axis. If you want the cross-axis to stay the same (e.g., keep video height while narrowing its width), preserve the container's cross-axis size and override the element's aspect-ratio for the new mode. Otherwise, the element will shrink proportionally in both dimensions.

### Cases đã gặp
- [aspect-ratio-cross-size-preservation.md](aspect-ratio-cross-size-preservation.md) — subtitle panel docked beside video, playerContainer width reduced to 70%, aspect-ratio forced height to shrink too. Fix: record F0 height, set `f0.style.height` and `playerContainer.style.height = '100%'` with `aspect-ratio: auto !important`.

### Apply cho
- Video players, image carousels, map widgets — any component with `aspect-ratio` that must be resized in one dimension
- Responsive layouts that switch from full-width to split-pane
- Content scripts that override a site's intrinsic sizing to add a docked panel

---

## Inline style leak across state transitions → every set must have matching remove

### Nguyên lý
Khi show/apply path set inline style với `!important`, hide/restore path PHẢI `removeProperty` (hoặc reset) từng property đó. `!important` styles survive across state transitions — browser không auto-clean. MutationObserver guard phải stop TRƯỚC khi remove, nếu không nó re-apply ngay lập tức.

### Cases đã gặp
- [inline-style-leak-toggle-cycle.md](inline-style-leak-toggle-cycle.md) — `applyAbsoluteDockedLayout` set `transform: translate(-50%,-50%) !important` + `object-fit: contain !important`, `hidePanelDocked` không remove → video jump ra ngoài sau toggle close. Fix: thêm `removeProperty('transform')` + set `object-fit: contain` trong restore path.
- [panel-body-mode-max-height.md](panel-body-mode-max-height.md) — floating panel body `max-height: 400px` persisted into docked mode, capping the cue list. Fix: set `maxHeight: 'none'` in `showPanelDocked` and restore `400px` in `hidePanelDocked`.

### Apply cho
- Content script toggle cycles (show/hide panel, overlay, dock)
- React imperative DOM mutation (useState + ref.style.setProperty)
- Any show/hide pattern using `!important` to override site CSS
- MutationObserver guard patterns (stop observer before removing styles)

---

## Clear per-navigation state in shared lifecycle handler

### Nguyên lý
Navigation lifecycle handler (onTabUpdated loading) là shared function cho mọi navigation. Clear per-page state ở đây = root cause fix, không patch symptom. Reuse methods đã có trong close handler (onTabRemoved) — không code mới.

### Cases đã gặp
- [media-accumulation-navigation.md](media-accumulation-navigation.md) — `onTabUpdated` loading chỉ reset auto-download guard, không clear media → media accumulate across episodes (11 → 22). Fix: thêm `clearTab` + `clearSessionMedia` + `lastCuesByTab.delete` + `updateBadgeForTab` (reuse từ `onTabRemoved`).

### Apply cho
- Chrome extension `onTabUpdated` / `onTabRemoved` lifecycle handlers
- SPA route change cleanup (clear state khi URL change, không đợi close)
- Any per-page state that must reset on navigation (media, cache, badge, session storage)

---

## Avoid dynamic import in code reachable from the service worker chunk

### Nguyên lý
Trong MV3 extension có nhiều entry point (SW, content-script, popup, sidepanel, offscreen), một module có thể nằm trong shared chunk được import bởi cả DOM context (popup/content) lẫn non-DOM context (SW). Vite inject `modulepreload-polyfill` (dùng `document`) vào bất kỳ chunk nào có dynamic `import()`. Nếu chunk đó reachable từ SW → SW load polyfill → `ReferenceError: document is not defined` → SW registration fail. Rule: với module shared với SW bundle, luôn static import. Dynamic import chỉ an toàn khi module KHÔNG reachable từ SW (UI-only module chỉ popup/sidepanel dùng).

### Cases đã gặp
- [no-dynamic-import-shared-sw-chunk.md](no-dynamic-import-shared-sw-chunk.md) — `offsetController.ts` thêm `await import('@/shared/lib/storage/settingsStore')` → Vite inject `modulepreload-polyfill` vào shared `settingsStore` chunk (cũng import bởi SW via helpers) → SW crash "Service worker registration failed. Status code: 15" → content-script `PAGE_SCAN_RESULT` fail "Receiving end does not exist" → popup không detect media trên themoviebox. Fix: đổi dynamic → static import (`saveSettings` đã static import sẵn, dynamic import vô nghĩa).

### Apply cho
- MV3 extension với Vite/`@crxjs/vite-plugin` (hoặc bất kỳ bundler auto-inject polyfill theo dynamic import)
- Module shared giữa SW và content-script/popup (settings store, message bus, chrome API wrappers)
- Code splitting decisions — khi nào dynamic import an toàn vs khi nào bắt buộc static

---

## Partial save must read-modify-write, not merge with defaults

### Nguyên lý
API nhận `Partial<T>` ngầm định merge với state hiện tại. Nếu implementation merge với `DEFAULT` thay vì stored state → bất kỳ field nào không có trong partial reset về default. Partial save bắt buộc read-modify-write (load current → merge partial → write). DEFAULT chỉ là fallback cho field thiếu trong stored, không phải base cho mọi save. Caller truyền full settings merge với full = full (idempotent, không bị ảnh hưởng).

### Cases đã gặp
- [save-settings-partial-wipe.md](save-settings-partial-wipe.md) — `saveSettings(partial)` merge với `DEFAULT_SETTINGS` thay vì stored settings → nav cluster drag `saveSettings({navClusterPosition})` wipe buttonSize/bgOpacity/buttonOpacity về default; `offsetController.saveSettings({subtitleOffset})` wipe TẤT CẢ settings khác. Fix: `saveSettings` read-modify-write (loadSettings → merge partial → setStorage); migration persist-back đổi sang `setStorage` trực tiếp để tránh recursion (loadSettings → saveSettings → loadSettings).

### Apply cho
- Settings/kv store với API `save(Partial<T>)` — phải read-modify-write
- Bất kỳ partial update API ngầm định merge (Redux dispatch partial, Zustand partial set)
- Migration persist-back path — tránh recursion khi save gọi load

## Wait for framework render completion before injecting foreign elements

### Nguyên lý
SPA frameworks (Angular, React, Vue) render dynamic elements trong nhiều phase. Content-script append foreign elements (không thuộc framework template) **during render cycle** → framework wipe chúng trong re-render tiếp theo. Signal "render done" = element có data thực (blob URL cho streaming, readyState>=2 cho direct source). `setTimeout` không đủ — Zone.js/React Concurrent mode wrap timer callbacks.

### Cases đã gặp
- [spa-two-phase-render-wipe.md](spa-two-phase-render-wipe.md) — Angular trên kisskh.co render `<video>` 2 phase: phase 1 mount element src="", phase 2 gán blob: URL. Content-script init overlay during phase 1 → Angular wipe foreign elements. Fix: `isVideoReady` gate (blob: OR readyState>=2) + observer `attributeFilter:['src']` catch phase-2. — **ADR-012**

### Apply cho
- Content-script inject vào SPA (Angular, React, Vue, Svelte)
- Browser extension overlay UI trên dynamic pages
- Any foreign element injection vào framework-managed DOM (MutationObserver timing)
- Zone.js / React Concurrent mode timer wrap (setTimeout không thoát render zone)

## Order-dependent side effects → sequence explicitly

### Nguyên lý
Khi 2+ observers/reactors react cùng event (DOM mutation, message, lifecycle) và effect của chúng xung đột trên shared state (A add, B clear), KHÔNG dựa vào registration/dispatch order để guarantee sequence. Browser dispatch theo registration order, nhưng message bus / async handler xử lý tuần tự và order có thể đúng cho 1 effect nhưng sai cho effect ngược (add-then-clear = clear wipe add). Phải **explicitly sequence**: await effect phải-trước (clear) response, rồi re-run effect phải-sau (add). Re-run idempotent nếu dedup by key.

### Cases đã gặp
- [mutation-observer-race-clear-wipes-add.md](mutation-observer-race-clear-wipes-add.md) — lordflix.org (SvelteKit SPA): PageScanner observer fire trước → PAGE_SCAN_RESULT add 27 subtitles, EpisodeChangeWatcher fire sau → VIDEO_EPISODE_CHANGED clearTab wipe 27. Fix: await VIDEO_EPISODE_CHANGED response, re-scan + re-send PAGE_SCAN_RESULT sau clear.

### Apply cho
- Multiple MutationObservers trên cùng DOM subtree (content script, browser extension)
- Multiple message handlers trên cùng event (chrome.runtime.onMessage, EventEmitter)
- Lifecycle handler race (onTabUpdated vs onBeforeRequest, beforeunload vs unload)
- Any "clear then re-add" pattern where clear và add react to same trigger — await clear, then re-add
- React useEffect cleanup race (cleanup of effect A wipes state set by effect B trong same render cycle)

---

## Half-open intervals [start, end) for time-based matching

### Nguyên lý
Time-based matching với boundary liền nhau (cue end = cue next start) phải dùng half-open interval `[start, end)` — boundary thuộc về item tiếp theo, không thuộc về item hiện tại. Closed interval `[start, end]` tạo overlap tại boundary → `findIndex` trả index sai (earlier match) → flash/correction.

### Cases đã gặp
- [half-open-interval-cue-matching.md](half-open-interval-cue-matching.md) — 4 callsites dùng `c.end >= currentTimeMs` (closed) → tại boundary `cue[i].end = cue[i+1].start`, cả 2 cue match → `findIndex` trả cue cũ → replay-cue "jump back" flash. Fix: `c.end > currentTimeMs` (half-open) tại 4 callsites (CueList, sidePanelStore, content-script ×2).

### Apply cho
- Time-range matching (cue, segment, chapter, bookmark)
- Interval overlap detection (calendar, scheduling, Gantt)
- Bucket assignment (timestamp → bucket, boundary thuộc bucket tiếp theo)
- Any `findIndex` with `start <= t && end >= t` when boundaries are contiguous

## Instant scroll for long lists, smooth only for short distances

### Nguyên lý
`scrollIntoView({ behavior: 'smooth' })` phù hợp cho short distance (scroll vài item, user thấy context movement). Trên long list (hundreds/thousands items), smooth scroll animate qua toàn bộ list → motion sickness + disorientation. Default instant (`behavior: 'auto'`) khi không biết beforehand distance (panel open, seek far).

### Cases đã gặp
- [instant-scroll-long-lists.md](instant-scroll-long-lists.md) — Side panel cue list `scrollIntoView({ behavior: 'smooth' })` animate từ top đến middle của list dài → motion sickness. Fix: `behavior: 'auto'` (instant). User không bị disorient vì list jump thẳng đến highlighted cue.

### Apply cho
- Long list scroll (cue list, log viewer, chat history, file tree)
- Seek-to-position (jump far → instant, not animate)
- Panel open with pre-selected item (jump to item, not animate from top)
- Any `scrollIntoView` trên list > 50 items where distance is unknown beforehand

---

## Set active identity synchronously before filtering events

### Nguyên lý
Khi một event được relay/filter dựa trên một mutable identity (active tab, focused window, selected item), identity đó phải được cập nhật **đồng bộ** với trigger đổi active scope. Nếu update bất đồng bộ, event từ scope mới sẽ đến trước khi filter identity kịp đổi → bị lọc nhầm sang scope cũ.

### Cases đã gặp
- [sidepanel-active-tab-race.md](sidepanel-active-tab-race.md) — `activeTabIdForPanel` cập nhật async trong `getTab()` → `SUBTITLE_CUES_LOADED` từ tab mới bị drop vì so sánh với tab cũ → sidepanel stuck "No subtitles loaded" đến khi đóng/mở lại

### Apply cho
- Chrome extension active tab / window focus tracking (sidepanel relay, popup state, badge)
- Event bus filtering by `currentUser`, `selectedItem`, `activeRoom`
- WebSocket/WebRTC message routing dựa trên "active session"
- Any filter/render that reads `activeX` state khi vừa đổi active scope

---

## Parser tolerance — skip noise lines, don't reject whole block

### Nguyên lý
Parser phải tolerant với non-standard format — skip noise lines thay vì reject cả block khi 1 line không match format kỳ vọng. Real-world data (subtitle sources, log files, CSV exports) có format variant: literal placeholder thay vì số index, missing field, extra metadata lines. Reject cả block = mất toàn bộ record; skip noise line = giữ được record. Structural anchor (regex match timing/format) là anchor, text/index là noise-tolerant — advance lineIndex cho đến khi tìm thấy anchor, chỉ reject khi hết dòng mà không có anchor.

### Cases đã gặp
- [srt-parser-none-literal-index.md](srt-parser-none-literal-index.md) — kisskh.buzz/angkortv SRT dùng literal `None` thay vì số index cho mỗi cue. `parseSrt` cũ: `lines[0]="None"` → không match `/^\d+$/` → `timingLine="None"` → `parseTimingLine` null → `continue` (skip cả cue) → 0 cues → auto-load fail "No cues found in SRT content". Fix: while-loop skip non-timing lines cho đến khi tìm thấy timing line, chỉ reject block khi hết dòng không có anchor.

### Apply cho
- Subtitle parser (SRT, VTT, ASS — fansub sites có format variant)
- Log parser (log lines có extra metadata, missing fields)
- CSV/TSV parser (rows có extra columns, missing delimiters)
- Any line-based parser với structural anchor (regex match) — advance past noise lines, don't reject block on first non-match

---

## Multi-separator extraction — try multiple separators, validate with domain guard

### Nguyên lý
Khi extract structured data (language code, version, episode number) từ URL/filename, thử nhiều separator convention (`.`, `-`, `_`) — các site khác nhau dùng convention khác nhau. Validate candidate với domain guard (`isValidIsoCode` cho language, regex cho version pattern) để tránh false positives từ word fragments. Order: most-specific convention first (dot-split cho lang suffix), broader convention second (kebab-split), structural fallback last (folder segment). Domain guard là bắt buộc — không validate = false positives (`"memories"`, `"episode"` match BCP47 shape 2-3 letters nhưng không phải language code).

### Cases đã gặp
- [url-lang-multi-separator-extraction.md](url-lang-multi-separator-extraction.md) — kisskh.buzz URL `a-hundred-memories-episode-1-en.srt` dùng kebab-case (`-en`) thay vì dot-separated (`episode-1.en.srt`). `extractLanguage` cũ chỉ split theo `.` → `parts.length=1` → `'unknown'` → `findSubtitlesForOverlay` không match target lang `'en'` → auto-load không trigger. Fix: thêm kebab-case fallback (split theo `-`, check last segment là BCP47 + `isValidIsoCode`) giữa dot-split và folder segment fallback.
- [url-lang-index-pattern.md](url-lang-index-pattern.md) — aniwatch/lostproject URL `eng-2.vtt` dùng `<lang>-<index>` pattern. Kebab-split path miss vì last segment = index (`2`), không phải language code. Fix: thêm regex `^([a-z]{2,3})-\d+$` match toàn bộ filename base, extract primary subtag, validate bằng `isValidIsoCode`.

### Apply cho
- URL/filename language extraction (subtitle, media, document)
- Version parsing từ filename (`file-1-2-3.txt` vs `file.1.2.3.txt` vs `file_1_2_3.txt`)
- Episode/season number extraction (`show-s01-e02` vs `show.s01e02` vs `show_01_02`)
- Any structured data extraction từ URL/filename nơi các site dùng separator convention khác nhau

---

## Ephemeral runtime auth token → alternative client without token

### Nguyên lý
Khi một service yêu cầu auth token ephemeral (single-use, short-lived, chỉ generate được từ runtime context của service — browser player, native app), không thể fetch out-of-context (extension SW, server, headless). Thay vì cố lấy token (ephemeral = không reuse được), dùng alternative client/context mà service không yêu cầu token đó. Thường các service có nhiều client type (WEB, ANDROID, IOS, TV) với auth requirement khác nhau — client ít protected hơn (mobile/TV) thường skip token requirement.

### Cases đã gặp
- [youtube-po-token-sw-403-main-world.md](youtube-po-token-sw-403-main-world.md) — YouTube WEB InnerTube client yêu cầu PO Token (`exp=xpe`, ephemeral single-use, chỉ có từ player runtime) cho caption tracks → fetch từ extension trả empty. ANDROID InnerTube client (`clientName: 'ANDROID'`) trả tracks với `exp=null` (không cần PO Token). Fix: đổi WEB→ANDROID client — không cần lấy PO Token.

### Apply cho
- YouTube InnerTube API (WEB requires PO Token, ANDROID/IOS không)
- Google APIs với multiple client contexts (WEB vs MOBILE vs TV)
- Any service với ephemeral runtime-only auth (anti-bot token, session token từ player/app)
- Scraping protected APIs — thử alternative client type trước khi cố reverse-engineer token generation

---

## Extension SW lacks page context → MAIN world fetch

### Nguyên lý
MV3 service worker `fetch()` chạy trong extension origin (`chrome-extension://...`), KHÔNG có page context (cookies của site, origin header, referer). Site yêu cầu cookies + origin (YouTube, Google, login-gated sites) → SW fetch 403/401. MAIN world content script (`"world": "MAIN"` trong manifest) chạy trong page origin (`https://site.com`) → có đầy đủ cookies + origin → fetch thành công. Khi SW fetch bị 403 do thiếu page context, chuyển fetch sang MAIN world script, relay kết quả về SW qua `window.postMessage` → ISOLATED content-script → `chrome.runtime.sendMessage`.

### Cases đã gặp
- [youtube-po-token-sw-403-main-world.md](youtube-po-token-sw-403-main-world.md) — YouTube InnerTube API fetch từ background SW trả 403 (no YouTube cookies, no page origin). MAIN world content script (`youtube-main-world.iife.ts`, `run_at: document_start`, `world: MAIN`) fetch thành công (có cookies + origin) → postMessage `__YT_DETECTED_SUBTITLES` → ISOLATED content-script relay → background → auto-load.

### Apply cho
- Chrome MV3 extension fetch tới cookie/origin-gated sites (YouTube, Google, login-gated)
- Any SW fetch returning 403 where the page itself can fetch successfully (diagnose: page DevTools fetch works, SW fetch 403s)
- Cross-origin requests needing session cookies (SAPISID, HSID, session cookies)
- Alternative: `chrome.cookies.getAll()` + manual cookie header (works but misses origin/referer — MAIN world is cleaner when page context is available)

---

## Register listeners at earliest lifecycle before producers post

### Nguyên lý
`window.postMessage` (và fire-and-forget events nói chung) không buffer — message posted khi không có listener = lost forever (no replay, no retry). Khi producer post async (sau `document_start`, ~3-4s) và consumer listen, consumer MUST register listener tại earliest lifecycle point (`document_start`), KHÔNG phải `document_idle` (fires sau DOM parse ~3-4s — producer có thể đã post trước đó). Tách logic theo DOM dependency: DOM-independent listeners (chỉ đọc `event.data`) register tại `document_start`; DOM-dependent logic (querySelector, body access) defer đến `DOMContentLoaded`. Không tách = hoặc listener trễ (miss message) hoặc logic sớm (crash trên null DOM). **Khi `document_start` không đủ** (bundler async loader delays listener — xem [Receiver-announces-readiness handshake](#receiver-announces-readiness-handshake-for-fire-and-forget-messages)), dùng handshake pattern: receiver posts ready signal, sender re-posts last message on receipt.

### Cases đã gặp
- [content-script-listener-race.md](content-script-listener-race.md) — YouTube MAIN world script (`document_start`) fetch InnerTube async ~3-4s → postMessage `__YT_DETECTED_SUBTITLES`. ISOLATED content-script `document_idle` register listener sau ~3-4s → message đã post trước khi listener register → lost. Fix: content-script `run_at: document_start` (listener register ngay), page scan defer đến `DOMContentLoaded` (cần DOM).
- [crxjs-async-loader-handshake.md](crxjs-async-loader-handshake.md) — `document_start` fix không đủ: CRXJS async dynamic-import loader delays ISOLATED listener past MAIN-world post on SPA navigation (MAIN world persistent, content-script re-injected). Fix: handshake `__YT_CS_READY` — content-script posts ready signal khi listener register, MAIN world re-posts last tracks on receipt. Dedup by videoId.

### Apply cho
- `window.postMessage` giữa MAIN world và ISOLATED content script (Chrome extension)
- `BroadcastChannel` (fire-and-forget, no buffering)
- Any fire-and-forget event bus where producer posts async after lifecycle start
- Content script `run_at` decision: `document_start` cho listeners, `document_idle` cho DOM logic — tách theo dependency, không dùng 1 timing cho cả 2
- Bundler-wrapped content-scripts (CRXJS, WXT) nơi async loader delays listener registration — `document_start` là necessary but not sufficient, cần handshake

---

## Receiver-announces-readiness handshake for fire-and-forget messages

### Nguyên lý
Khi producer persistent (survives navigation) post fire-and-forget message và consumer re-injected per-navigation với listener registration delayed (bundler async loader), `document_start` registration không đủ — producer có thể post trước khi consumer listener register. Handshake giải quyết deterministic: consumer posts "ready" signal khi listener register, producer re-posts last message trên receipt. Timing-independent — không guess loader delay. Consumer dedup by id (videoId, requestId) để tránh double-process khi cả original post lẫn re-post đều đến.

### Cases đã gặp
- [crxjs-async-loader-handshake.md](crxjs-async-loader-handshake.md) — YouTube SPA navigation: MAIN world script persistent post `__YT_DETECTED_SUBTITLES` ~450-930ms, ISOLATED content-script re-injected với CRXJS async loader register listener ~6000ms+. Fix: content-script posts `__YT_CS_READY` khi listener register, MAIN world re-posts last tracks on receipt. Content-script dedup by `videoId` (`__YT_LAST_RELAYED_VIDEO_ID`).

### Apply cho
- MAIN world ↔ ISOLATED content-script messaging trên SPA navigation (Chrome extension)
- Persistent producer + per-navigation consumer (service worker ↔ re-injected content script)
- Any fire-and-forget message bus nơi consumer registration timing không guaranteed (bundler async loader, lazy module load)
- WebSocket reconnect (client announces ready, server replays last message)
- Event sourcing replay (consumer announces position, producer replays from position)

---

## Commit state only after precondition confirmed (gate retry)

### Nguyên lý
Khi function có precondition (e.g., "API key must be available") và retry mechanism key off state (e.g., "only re-run if videoId changed"), commit state (cache `lastVideoId`) CHỈ SAU khi precondition confirmed. Commit trước precondition check blocks retry — retry condition (`videoId !== lastVideoId`) trở thành permanently false, precondition failure không bao giờ re-evaluate dù precondition trở thành true sau đó. Đây là "early commit" anti-pattern: function claim đã "processed" videoId (cache nó) khi thực tế fail, blocking future attempts. Gate cả trigger (poll) trên precondition nữa — không waste attempt khi precondition chưa ready.

### Cases đã gặp
- [detect-precondition-gating.md](detect-precondition-gating.md) — YouTube MAIN world `detect()` cache `lastVideoId = videoId` trước check `apiKey` → fail "no API key" (HTML chưa render full) → `lastVideoId` committed → poll `currentVideoId !== lastVideoId` false → no retry dù API key available sau. Fix: move `lastVideoId = videoId` SAU `apiKey` check; gate `pollForVideoIdChange` trên cả videoId change AND apiKey availability; extend poll timeout 5s → 10s.

### Apply cho
- Polling với retry condition key off cached state (videoId, requestId, sessionId)
- Precondition chậm available (API key injected after paint, config loaded async, token refreshed)
- Any "detect once, cache, never retry" pattern nơi precondition fail blocks future attempts
- Idempotent operations với precondition gate (don't claim done before precondition met)

---

## Format detection — check query params, not just file extension

### Nguyên lý
Format detection bằng file extension alone fails cho URLs không có extension — phổ biến với API endpoints encode format trong query params (`?fmt=vtt`, `?format=srt`, `?output=ass`, `?type=json3`). Extension check là fast path (no URL parsing, unambiguous cho `.vtt`/`.ass` files), nhưng cần query-param fallback cho extension-less URLs. Order: extension (fast, unambiguous) → query param (fallback cho APIs) → default. Cùng pattern với multi-separator extraction (thử nhiều convention), áp dụng cho format detection thay vì language extraction.

### Cases đã gặp
- [format-from-url-query-param.md](format-from-url-query-param.md) — YouTube `timedtext` URL không có extension (`/api/timedtext?v=...&fmt=vtt`). `formatFromUrl` cũ chỉ check `.vtt` extension → trả `'srt'` → `parseSrt` trên WebVTT content → 0 cues → "No cues found in SRT content". Fix: thêm `fmt=vtt` query param check (via `new URL(url).searchParams.get('fmt')`) giữa extension check và srt default.

### Apply cho
- Subtitle format detection (YouTube `fmt=`, other APIs `format=`/`output=`)
- Media type detection từ API URLs (no extension, format in query)
- Any format/type inference từ URL nơi extension-only check fails
- API endpoints that encode output format in query params instead of file extension

---

## Prefer freshest source for identity, not richest

### Nguyên lý
`??` (nullish coalescing) picks the left operand whenever it is non-null/undefined — even if that value is stale. When two sources can provide an *identity* (which entity is this?), pick the **freshest** source, not the richest. Richness (more metadata) and freshness (how recently mutated) are orthogonal — for identity, freshness wins. A stale-but-rich cache will short-circuit `??` and hide the fresher signal. Reserve the rich source for *attributes* of the already-identified entity; resolve identity from the source the platform mutates first.

### Cases đã gặp
- [url-first-spa-nav-stale-player-response.md](url-first-spa-nav-stale-player-response.md) — YouTube SPA navigation (radio mix) updates `location.href` immediately but `ytInitialPlayerResponse` stays stale (old videoId) indefinitely. Detector used `getVideoIdFromPlayerResponse(...) ?? getVideoIdFromUrl()` → stale playerResponse (non-null) short-circuited `??` → `currentVideoId === lastVideoId` → poll never re-triggered detect → no subtitle autoload. Fix: swap to URL-first `getVideoIdFromUrl() ?? getVideoIdFromPlayerResponse(...)`.

### Apply cho
- SPA navigation identity (URL vs cached player response / app state)
- `??` / `||` chains where the left operand can be stale-but-non-null
- Polling/retry keyed off identity (re-run only when identity changes) — read identity from the freshest source
- Any "two sources of truth for identity" situation (URL vs cache, route param vs store, prop vs state)

---

## Signal absence is not absence of signal

### Nguyên lý
"0 items" is not "no information" — it is the positive signal "this entity has no items". When a pipeline has multiple guards that each treat empty as a no-op (early return on empty, skip post on empty, skip push on empty), the empty case becomes a silent dead path: every layer optimises for "don't do redundant work on empty" and collectively they ensure nothing ever happens on empty. For stateful UI showing the previous entity's data, the empty case MUST be handled as an explicit clear signal — post the empty result, clear the store, broadcast the empty update, clear the view. Empty is a value, not the absence of a value. Distinguish "no data yet" (transient, retry) from "confirmed empty" (terminal, clear).

### Cases đã gặp
- [clear-subtitle-on-no-subtitle-video.md](clear-subtitle-on-no-subtitle-video.md) — SPA nav from a YouTube video WITH subtitles to one WITHOUT left the previous video's overlay visible. 3 layers each skipped the clear on empty: MAIN world gated post on `tracks.length > 0`, background returned early on 0 tracks, overlay only toasted on null target+native. Composed, they formed a silent dead path. Fix: post on every detect (incl. 0), clear tab + broadcast + send null AUTO_LOAD_SUBTITLES on 0 tracks, clearCues on null payload.

### Apply cho
- Stateful UI keyed off a previous entity's data (overlay, panel, cache) — empty new entity must clear, not be ignored
- Multi-layer pipelines where each layer guards on empty — verify the empty case reaches the final consumer
- "Don't store empty" / "don't push empty" guards — compose into dead paths; replace with "store empty + clear downstream"
- Detection pipelines (0 results is a result — surface it, don't swallow it)

---

## Conditional stopPropagation — only swallow when inner actually handled

### Nguyên lý
`stopPropagation` là "swallow event" — chỉ gọi khi handler thực sự tiêu thụ event. Khi inner handler return early vì không match case của nó (external drop khi inner chỉ xử lý internal reorder, click ngoài khi inner chỉ xử lý click-in), event phải được phép bubble lên outer handler. Unconditional `stopPropagation` ở đầu hàm = silent dead path cho mọi case inner không handle — outer handler không bao giờ chạy cho những case đó. Pattern: check điều kiện handle trước, `stopPropagation` sau (và chỉ khi match).

### Cases đã gặp
- [drag-drop-stop-propagation-blocks-outer.md](drag-drop-stop-propagation-blocks-outer.md) — Card Creator `MediaList` inner `handleDrop` gọi `e.stopPropagation()` unconditionally → external file drop trên non-empty area bị swallow, `onFilesDrop` không gọi. Fix: chỉ `stopPropagation` khi `draggingIndex !== null` (internal reorder), để bubble khi external drop.

### Apply cho
- Nested drop handlers (internal reorder + external file add) — stopPropagation chỉ khi internal drag active
- Nested click handlers (popover inside dialog — stopPropagation chỉ khi click inside popover, let outside-click close dialog)
- Event delegation layers (inner listener + outer listener cùng event type) — inner chỉ swallow khi nó handle, không swallow khi return early
- React synthetic event bubbling nơi outer container cần nhận event cho một số case

---

## Dropdown width follows content, alignment configurable by trigger position

### Nguyên lý
Dropdown menu width phải theo content (`width: max-content` + `min-width: 100%` + `max-width` guard), không theo trigger — trigger width là UI constraint, content width là readability constraint. Alignment phải configurable theo vị trí trigger trong container: trigger bên trái → menu mở phải (`left: 0`), trigger bên phải → menu mở trái (`right: 0; left: auto`) để không tràn container. Hardcode `left: 0; right: 0` assume trigger luôn bên trái + content luôn ngắn hơn trigger — sai cho cả 2 assumption. `min-width: 100%` đảm bảo menu không ngắn hơn trigger (không bị "bé hơn select"), `max-width` guard item quá dài không blow out layout.

### Cases đã gặp
- [dropdown-menu-width-follows-content.md](dropdown-menu-width-follows-content.md) — Card Creator field-map `Select` (bên phải row) dùng `left: 0; right: 0` → menu width = trigger width (~40-80px) → options dài ("SentenceTranslation") bị clip. Menu mở phải tràn card. Fix: `width: max-content; min-width: 100%; max-width: 320px` + prop `menuAlign: 'left' | 'right'`, FieldRow truyền `menuAlign="right"`.

### Apply cho
- Custom dropdown/select components (Radix, custom listbox) nơi trigger hẹp + options dài
- Popover/tooltip positioning theo trigger position trong container (right-aligned trigger → popover mở trái)
- Menus trong constrained containers (dialog, sidebar, card) — menu không được tràn container boundary
- Any floating UI element cần width theo content + alignment theo anchor position

---

## Persist selections, clear content — scope autosave to intent

### Nguyên lý
Autosave scope phải match intent, không match shape. "Chống mất work" (crash recovery) ≠ "giữ content qua session" (persistence). Selections (config, preferences, tags, last-used values) là **stable + retry-friendly** — persist. Content (text input, media, work product gắn với entity cụ thể) là **ephemeral + confusion-causing** — clear khi đóng entity. Persist selections + clear content = giữ cái ổn định, xóa cái nhầm-lẫn-gây-rối. Persist toàn bộ confuse 2 intent — cố cứu content nhưng content cũ lại là noise khi tạo entity mới. Phân biệt: cái gì user **chọn** (selection, ổn định) vs cái gì user **nhập/làm** (content, gắn entity).

### Cases đã gặp
- [persist-config-clear-content.md](persist-config-clear-content.md) — Card Creator autosave persist toàn bộ text fields → reopen restore content cũ gây nhầm lẫn. Fix: `SerializedDraft` bỏ `fields`, chỉ persist `noteType`/`deck`/`fieldMapping`/`tags`/`mediaUpdateMode`. `deserializeDraft` trả text fields = `''`. Đóng dialog = clear content, giữ tags + config.

### Apply cho
- Form/dialog autosave (draft restore) — persist selections (dropdowns, checkboxes, tags), clear free-text content
- Multi-step wizards (persist step selections, clear step input khi wizard close)
- Editor drafts (persist settings/mode, clear document content khi close — hoặc ngược lại tùy intent, nhưng phải conscious choice)
- Any "remember user's work" feature — tách selections (remember) vs content (don't remember unless explicit "save draft")

## Proactive clear on native event > cross-context round-trip

### Nguyên lý
A cross-context round-trip (content → MAIN → content → SW → content) is a request, not a guarantee. Each hop has its own failure mode (poll timeout, fetch error, SW eviction, message drop) and every failure is a silent skip — no error, no retry, no log on the consumer side. When the consequence of a missed signal is stale state visible to the user, the consumer MUST also listen for the native event that triggered the round-trip (`yt-navigate-finish`, `popstate`, `visibilitychange`, `fullscreenchange`) and clear its own state locally. The round-trip becomes the refill path (load new data), not the clear path. Clear is cheap, local, synchronous on the native event; refill is expensive, async, cross-context — they should not share a dependency chain. This is the dual of "signal absence is not absence of signal" (which fixed the content of the round-trip — send 0, not nothing); this fixes the transport — even when the content is correct, the transport can drop it.

### Cases đã gặp
- [proactive-native-event-clear-vs-round-trip.md](proactive-native-event-clear-vs-round-trip.md) — YouTube SPA nav subtitle overlay persisted with video #1's cues on video #2 (no subtitles). Previous fix routed 0-track signal through MAIN→content→SW→content round-trip, but the round-trip is fragile (poll timeout 2s, InnerTube fetch error, SW restart, message drop). Fix: content-script registers `yt-navigate-finish` + `popstate` listeners and clears overlay locally on URL change — does not wait for background. Round-trip becomes refill path, not clear path.

### Apply cho
- Cross-context state sync where the consumer shows stale state (overlay, panel, badge) — consumer needs local clear on the native event, not just a message from the producer
- MV3 service-worker message chains (SW eviction mid-round-trip drops messages silently) — consumer-side native event listener as fallback
- SPA frameworks with native nav events (`yt-navigate-finish`, `popstate`, framework-specific route-change events) — listen directly, don't rely on a re-broadcast through background
- Any "clear on X" path that currently only runs inside a message handler — verify the message always arrives; if not, add a local listener for X

---

## Forbidden headers in extension fetch → DNR modify at network stack

### Nguyên lý
`fetch()` từ extension context (service worker, offscreen document) không thể set **forbidden headers** (`Referer`, `Cookie`, `User-Agent`...) — browser strip hoặc override trước khi gửi (Chrome 72+). Khi server yêu cầu forbidden header (e.g. CDN hotlink protection kiểm tra `Referer`), `fetch()` trả 403 dù code set header đúng. `declarativeNetRequest` (DNR) chạy ở **network stack layer**, sau khi browser chuẩn bị headers, nên CAN rewrite forbidden headers. Rule scoped bằng `initiatorDomains: [chrome.runtime.id]` + exact URL → chỉ affect extension's own fetch, không break page requests. Rule phải remove sau fetch (try/finally) để tránh accumulation (DNR cap 30,000 dynamic rules).

Khác với principle "Extension SW lacks page context → MAIN world fetch": đó là thiếu cookies/origin (page context không có), fix bằng MAIN world content script. Principle này là: có đủ context nhưng browser cấm set header qua API → fix bằng DNR (network stack level, không cần page context).

### Cases đã gặp
- [forbidden-header-referer-dnr.md](forbidden-header-referer-dnr.md) — aniwatch/megaplay subtitle CDN (`1oe.lostproject.club`) yêu cầu `Referer` từ `megaplay.buzz` (iframe player origin). `fetch()` từ extension SW set `Referer` qua `headers` option nhưng browser strip → 403. Fix: `declarativeNetRequest` dynamic rule scoped to exact URL + extension origin, set `Referer` = `subtitle.initiator` (iframe player origin). 3 fetch paths (download, auto-load overlay, resolve unknown language) đều cần DNR rule. `initiator` field thêm vào `DetectedSubtitle` + `NetworkRequest` + `SubtitleForOverlayResult` + `FetchSubtitleContentPayload`, pass qua toàn bộ detection chain.

### Apply cho
- CDN hotlink protection yêu cầu `Referer` từ specific domain (subtitle CDN, image CDN, video CDN)
- Any extension fetch bị 403 dù set headers đúng — kiểm tra xem header có phải forbidden
- `fetch()` từ service worker hoặc offscreen document cần set `Referer`/`Cookie`/`User-Agent`
- Alternative: route fetch qua content script trong iframe (browser set Referer tự) — phức tạp hơn, cần frame routing

## Host page CSS overrides unstyled properties on injected elements

### Nguyên lý

Content-script injected elements live in host page DOM — host CSS cascade applies to ANY property not explicitly set in inline style. Generic host rules like `button { padding: 1px 6px }` hoặc `svg { fill: white }` silently override defaults. Two defenses: (1) explicit reset on every property affecting sizing/visibility (`padding: 0`, `box-sizing: border-box`, `margin: 0`), (2) `!important` on critical visual properties (`fill: none`, `width/height` percentage). Bug invisible trên site A (YouTube) vì CSS không có generic rule, visible trên site B (themoviebox) vì có — testing trên multiple hosts là bắt buộc để catch host-CSS collisions.

### Cases đã gặp
- [host-css-overrides-injected-buttons.md](host-css-overrides-injected-buttons.md) — 3 overlay icon buttons (panel toggle, manager, upload) rendered at ~50% size trên themoviebox vì `button { padding: 1px 6px }` shrank content-box. SVG `fill="none"` bị override thành white fill → invisible on light backgrounds. Fix: `padding: 0; box-sizing: border-box` + `fill:none !important` inline.

### Apply cho
- Content-script injects `<button>`, `<svg>`, `<div>` vào host page DOM
- Overlay UI trên video player (Netflix, YouTube, themoviebox, aniwatch)
- Any extension injects elements vào third-party site — luôn explicit reset + `!important` trên critical properties
- Shadow DOM alternative: Shadow DOM isolates host CSS, nhưng không phải lúc nào cũng feasible (z-index, fullscreen)

## Percentage sizing calculates against content-box, not border-box

### Nguyên lý

Percentage `width`/`height` trên child resolves against parent's **content-box**, không phải border-box. Nếu parent có padding (đặc biệt horizontal padding như `1px 6px`), percentage children shrink unexpectedly — 12px padding trên 25px button cắt SVG gần một nửa (65% của 10.94px = 7.11px thay vì 65% của 25px = 16.25px). Invisible khi parent `padding: 0` (cluster buttons CSS class), visible khi parent không set padding (overlay buttons inline style). Always set `padding: 0` explicitly trên percentage-sized containers, hoặc dùng absolute units cho child.

### Cases đã gặp
- [percentage-sizing-content-box-vs-border-box.md](percentage-sizing-content-box-vs-border-box.md) — SVG `width: 65%` inside 25px button rendered at 7.66px thay vì 16.25px. Root cause: button `padding: 1px 6px` (host CSS) + `box-sizing: border-box` → content-box = 10.94px → 65% = 7.11px. Fix: `padding: 0; box-sizing: border-box` → content-box = 22.94px → 65% = 14.9px (matches cluster).

### Apply cho
- Percentage-sized children inside padded containers (SVG icons, flex items, grid items)
- Flex layout với `box-sizing: border-box` + padding — percentage children resolve against content-box
- Any `width: X%` / `height: X%` element inside a container có non-zero padding
- Alternative: dùng `calc(var(--btn-size) * 0.65)` (absolute) thay vì `65%` (relative) để tránh content-box dependency

## Mock mapper ordering — specific suffix before generic alias

### Nguyên lý

Jest `moduleNameMapper` thử patterns theo declaration order — first match wins. Generic alias (`^@/(.*)$`) match MỌI path kể cả những path có Vite suffix (`?raw`, `?worker`, `?url`, `?inline`). Specific suffix mappers phải declared TRƯỚC generic alias, hoặc chúng unreachable → ENOENT vì file system lookup bao gồm suffix trong filename.

### Cases đã gặp
- [jest-modnamemapper-raw-before-alias.md](jest-modnamemapper-raw-before-alias.md) — `?raw` imports fail ENOENT vì `^@/(.*)$` match trước `\\?raw$` → reorder: `\\?raw$` trước `^@/(.*)$`

### Apply cho
- Jest + Vite projects dùng `?raw`, `?worker`, `?url`, `?inline` imports
- Bất kỳ moduleNameMapper nào có generic alias + specific suffix mappers — luôn specific trước generic
- Webpack `resolveLoader` alias ordering (same first-match-wins semantics)

## Rendering boundary → explicit token injection

### Nguyên lý

Rendering boundary (Shadow DOM, iframe, Web Worker, React Native vs Web) cô lập CSS — stylesheets của parent không apply vào boundary bên trong. Shared design tokens phải được explicit inject dưới dạng CSS string vào boundary. Vite `?raw` import biến file `.css` thành string — inject vào `<style>` trong Shadow DOM, remap `:root` → `:host`, và cả React + Vanilla DOM share cùng source file. Không duplication, không drift.

### Cases đã gặp
- [shadow-dom-shared-tokens-raw-injection.md](shadow-dom-shared-tokens-raw-injection.md) — Dictionary Popup Shadow DOM dùng `--dp-*` riêng, duplicate `tokens.css` → `?raw` import + `:root`→`:host` remap → single source, xóa 120 dòng `--dp-*`

### Apply cho
- Shadow DOM components (custom elements, popup dialogs, overlays)
- iframe-embedded widgets (inject tokens vào iframe `<head>`)
- Web Worker canvas rendering (pass token values as messages)
- React Native + Web sharing design tokens (different runtime, same source file)
- Bất kỳ rendering boundary nào cần shared design system — inject tokens explicitly

## Isolated DOM needs explicit theme propagation

### Nguyên lý

Shadow DOM blocks attribute inheritance — `data-theme` trên `<html>` không propagate vào shadow boundary. `data-theme` là attribute selector match, KHÔNG phải inherited property (như `color`, `font-family`). Theme-aware Shadow DOM components phải detect theme từ source of truth (chrome.storage / media query) và set `data-theme` trên element BÊN TRONG shadow tree. CSS selector `[data-theme="dark"]` match element inner đó → tokens cascade xuống shadow children.

### Cases đã gặp
- [shadow-dom-theme-attribute-propagation.md](shadow-dom-theme-attribute-propagation.md) — Dictionary Popup Shadow DOM luôn light mode dù user chọn dark — `data-theme` trên `<html>` không truyền vào shadow → detect từ `chrome.storage.local.themeMode` + `prefers-color-scheme`, set trên container bên trong, listen `storage.onChanged` + `matchMedia` change

### Apply cho
- Shadow DOM components cần dark/light mode (popups, dialogs, overlays, custom elements)
- iframe widgets cần theme awareness (postMessage theme từ parent → set trên iframe root)
- Web Components dùng `data-theme` attribute selectors (must set attribute inside shadow, not rely on host)
- Bất kỳ isolated DOM boundary nào cần theme — detect from source + set attribute inside boundary + listen for changes
