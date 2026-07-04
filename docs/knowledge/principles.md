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


### Apply cho
- Chrome extension `onTabUpdated` / `onTabRemoved` lifecycle handlers
- SPA route change cleanup (clear state khi URL change, không đợi close)
- Any per-page state that must reset on navigation (media, cache, badge, session storage)

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
