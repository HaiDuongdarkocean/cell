# Split View (subtitle side panel) — Edge-case Audit & Stress Test Cases

Scope: Split View toggle qua phím `t` / nút "Open subtitle list" trên normal page (không phải Player Mode — ở Player Mode `t` toggle CueList, code path khác). Panel = `[data-cell-split-view]` wrapper trên light DOM: `stage` (chứa playerShell + `#cell-subtitle-root`) + `handle` (resize) + `panel` (shadow root chứa `SubtitlePanel`/CueList).

Test surface chính: StreamFlix mock (`http://127.0.0.1:4321`) qua Playwright (`e2e/stage2/`, fixture `streamFlixPage`). Các case site-specific (kisskh, themoviebox, YouTube) đánh dấu **manual**.

## Bugs đã xác nhận (code audit + empirical trên StreamFlix mock)

| ID | Bug | Cơ chế | Status |
|---|---|---|---|
| BUG-SV-A | Rapid toggle phá layout / crash page | Cleanup schedule `setTimeout(410ms)` restore `savedPlayerShellStyles` + DOM. Reopen trước khi timeout fire → (1) snapshot mới capture override cũ làm "original" → polluted; (2) timeout cũ fire giữa session mới → strip `width/height:100%!important` của instance mới; (3) khi đóng lần cuối, polluted snapshot giữ overrides → video kẹt `100%×100%!important` sau close. Mỗi toggle = full DOM rebuild → stress gây renderer crash. | **FIXED**: restore được expose qua `splitViewPendingRestoreRef` — effect run mới drain đồng bộ trước khi build → styles restore trước snapshot (không pollution), DOM teardown sạch, timer cũ no-op qua `restoreDone`. SV-03 PASS sau fix (trước đó crash: "Target page, context or browser has been closed"). SV-04 trước đây PASS bị mask bởi aspect-ratio fallback — giờ pass đúng nghĩa. |
| BUG-SV-B | Kéo resize handle tự phá DOM | `splitViewPct` nằm trong effect deps → mỗi `setSplitViewPct` trong `pointermove` → cleanup + rebuild wrapper/stage/panel → handle mất pointer capture → drag chết giữa chừng. | **FIXED**: `splitViewPct` state → `splitViewPctRef` (chỉ đọc trong effect), bỏ khỏi deps. Panel width update trực tiếp `flexBasis`, persist 1 lần trên `pointerup`. SV-10/11 PASS sau fix (trước: panel dừng sau ~19px). |
| BUG-SV-C | Manual toggle bị settle reopen | `fullscreenchange` → auto off + `waitForPlayerSettle` → `setSplitViewOpen(true)`. `cleanupRef` chỉ cancel khi unmount → user nhấn `t` để đóng trong settle window → settle vẫn fire → panel tự mở lại ngược ý định. | **FIXED**: `handleToggleSplitView` + imperative `setSplitViewOpen` cancel `cleanupRef` trước khi set state. Chưa verify trên fullscreen thật (manual). |
| BUG-SV-D | Switch `playerDisplay` (same↔iframe) khi Split View mở | StreamFlix unmount `VideoPlayer` → React remove `.playerContainer` đã bị move vào stageCell → `removeChild` trên parent React-expect → `NotFoundError` → host root unmount (empirically: iframe tab click xoá cả page, không iframe nào mount). | **MITIGATED + residual confirmed**: MutationObserver trên `document.body` — `playerShell.isConnected` false → tự `setSplitViewOpen(false)` → không ghost `[data-cell-split-view]` (SV-41 PASS). Residual ceiling đã verify: host React crash → page blank — **không chặn được từ content script** (isolated world không patch được main-world `removeChild`); fix triệt để = không reparent playerShell (panel overlay bên cạnh thay vì flex row) — cần architecture change, tách task riêng. |

---

## A. Toggle lifecycle

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-01 | P0 | StreamFlix loaded, overlay mounted, split view closed | Nhấn `t` 1 lần | `[data-cell-split-view="wrapper"]` visible; `stage`,`handle`,`panel` tồn tại; `video` height > 50% height gốc; panel chứa `data-cell-id="subtitle-panel"` trong shadow | e2e (đã có: `split-view.spec.ts`) |
| SV-02 | P0 | Split view open | Nhấn `t` 1 lần | Wrapper removed khỏi DOM sau ≤600ms; `video` rect = rect gốc (±2px); `#cell-subtitle-root` về parent ban đầu; playerShell không còn inline `height/width:100%!important` | e2e (đã có) |
| SV-03 | P0 | Split view closed | Nhấn `t` 10 lần nhanh (interval ~80ms, xen kẽ open/close) | Kết thúc ở trạng thái closed (even count): wrapper absent; `video` rect = gốc; computed style playerShell không còn `!important` overrides nào của split view. **FAIL trước fix (page closed) → PASS sau fix BUG-SV-A.** | e2e ✅ implemented |
| SV-04 | P0 | Split view closed | `t` open, đợi 50ms, `t` close, đợi 50ms, `t` open (reopen trong 410ms cleanup window) | Wrapper mới stable sau 600ms: `video` height ≥ 50% gốc; panel visible; không có 2 wrapper tồn tại đồng thời. **PASS sau fix** (trước đây pass bị mask bởi aspect-ratio fallback). | e2e ✅ implemented |
| SV-05 | P1 | Closed | Giữ phím `t` 2 giây (auto-repeat) | Chỉ 1 lần toggle (e.repeat guard) — wrapper open, không nhấp nháy. **PASS.** | e2e ✅ implemented |
| SV-06 | P1 | Closed | Click nút "Open subtitle list" trên toolbar overlay | Giống SV-01 (cùng code path `handleToggleSplitView`) | e2e |
| SV-07 | P1 | Open | Click nút `data-cell-id="subtitle-panel-close"` trong panel header | Giống SV-02 | e2e |
| SV-08 | P2 | Open (vừa mở, panel đang slide-in ~100ms) | Nhấn `t` đóng ngay giữa animation | Panel slide-out về phải (cùng hướng entry); wrapper removed; không kẹt `translateX` | e2e |

## B. Resize handle

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-10 | P0 | Open | Drag handle sang trái ~150px rồi thả | `panel` flex-basis tăng; `video` width giảm tương ứng; **không** rebuild DOM giữa drag (wrapper element identity giữ nguyên suốt gesture). **FAIL trước fix → PASS sau fix BUG-SV-B.** | e2e ✅ implemented |
| SV-11 | P0 | Open | Drag 1 nét liên tục 300px | `pointermove` events liên tục tới `pointerup`; drag không bị hủy giữa chừng (`pointercancel` không fire). **PASS sau fix** (trước: panel dừng sau ~19px do mất pointer capture). | e2e ✅ implemented |
| SV-12 | P1 | Open | Drag ra ngoài bound (kéo hết trái/phải) | Panel width clamp trong [20%, 60%] wrapper; stage không < 0 | e2e |
| SV-13 | P1 | Sau SV-10 | `pointerup` → reload page → `t` mở lại | Panel mở ở width đã persist (`SPLIT_VIEW_PCT` storage); clamp [20,60] nếu stored ngoài range | e2e |
| SV-14 | P1 | Open | Resize browser window (nhỏ lại 50%) | Wrapper + panel không vỡ (video vẫn render, panel không overflow viewport). Known ceiling: px height frozen đến lần mở sau — AC chỉ yêu cầu không crash/ghost | e2e |
| SV-15 | P2 | Open + drag đang diễn ra | Nhấn `t` giữa drag | Toggle xử lý sạch: wrapper removed, không exception, không ghost handle | manual |
| SV-16 | P2 | Open | Double-click handle | Không reset về default (hiện chưa có feature) — AC: không exception, không rebuild | manual |

## C. Fullscreen interplay

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-20 | P0 | Open | Enter fullscreen (`f` hoặc nút fs của player) | Split view rebuild trong fs: video + panel cùng hiển thị trong fullscreen element; không exit fs | manual (Playwright fs trên extension page phức tạp) |
| SV-21 | P0 | Open + fullscreen | Exit fullscreen (Esc) | Split view rebuild về normal layout: wrapper quanh playerShell vị trí cũ; video visible; chỉ 1 wrapper | manual |
| SV-22 | P1 | Open | Enter rồi exit fullscreen nhanh ×3 | Sau settle: 1 wrapper duy nhất; video rect hợp lý; không ghost stageCell/handle | manual |
| SV-23 | P1 | Open + fullscreen-change đang settle (<2s) | Nhấn `t` để đóng | Panel đóng và KHÔNG tự reopen khi settle fire. **Fixed (BUG-SV-C) — cần verify manual trên fullscreen thật.** | manual |
| SV-24 | P2 | Open, host requestFullscreen trên chính `<video>` | Trigger fs | Code path re-request parent fs chạy; split view vẫn render | manual (site-specific) |

## D. Player Mode interplay

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-30 | P0 | Split view open | Nhấn `g` vào Player Mode | Split view DOM teardown (wrapper cleanup chạy); PM overlay mount; video hiển thị trong video stage PM | manual |
| SV-31 | P1 | PM active (splitViewOpen=true ngầm) | Exit PM | Split view tự reopen (state vẫn true → effect rebuild) — hành vi hiện tại; AC: reopen sạch, 1 wrapper, video visible | manual |
| SV-32 | P1 | PM active | Nhấn `t` | `handleToggleSplitView` blocked (`playerMode` guard) — PlayerModeOverlay nhận `t` → toggle CueList, KHÔNG phải split view; không wrapper nào được tạo | manual |

## E. Page lifecycle

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-40 | P0 | StreamFlix open split view | Click episode khác (React re-render, cùng DOM nodes) | Wrapper + panel vẫn gắn playerShell; video mới render; cue list vẫn hoạt động. **PASS.** | e2e ✅ implemented |
| SV-41 | P0 | StreamFlix open split view | Switch tab `playerDisplay`: Same-origin → Cross-origin iframe | MutationObserver tự đóng split view → không còn `[data-cell-split-view]` nào trong DOM. **PASS.** Residual: host React root unmount (page blank) — known ceiling, ghi nhận qua test annotation. | e2e ✅ implemented |
| SV-42 | P1 | Open | `history.back()`/SPA nav → video mới mount | Không ghost wrapper trên page mới; overlay re-init sạch | manual (site SPA: kisskh episode → next ep) |
| SV-43 | P1 | Open | Reload page | Split view đóng (state không persist — by design); không wrapper sót trong DOM sau reload; `t` mở lại bình thường | e2e |
| SV-44 | P2 | Open | `<video>` bị site detach/replace (MutationObserver-less) | Wrapper không giữ shell chết vô hạn — AC hiện tại: panel vẫn hiển thị (cue list vẫn dùng được) dù stage rỗng | manual |

## F. Input guards

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-50 | P0 | Closed, focus trong `<input>`/textarea/contenteditable | Gõ `t` | Không toggle; ký tự `t` vào input. **Skipped** — StreamFlix mock chưa có input trên trang; cần thêm input vào mock hoặc test trên site có search box. | e2e ✅ implemented (skip) |
| SV-51 | P1 | Closed | `Ctrl+T` / `Shift+T` / `Alt+T` | Không match shortcut (modifier mismatch) → không toggle (chú ý Ctrl+T mở tab mới — test Shift+T/Alt+T) | e2e |
| SV-52 | P1 | Closed | `e.repeat` (giữ `t`) | Guard `e.repeat` → chỉ 1 toggle | e2e (trùng SV-05) |
| SV-53 | P1 | Open, focus trong panel (click vào cue) | Nhấn `t` | Focus inside Cell UI → host shortcuts blocked, nhưng `t` vẫn toggle split view (Cell shortcut xử lý trước guard) — AC: đóng bình thường | e2e |

## G. Layout integrity

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-60 | P0 | Page scroll ở giữa | `t` open | Scroll position không nhảy (wrapper height = player height trên StreamFlix); content dưới không bị đẩy | e2e |
| SV-61 | P0 | Open | Quan sát `Episodes` sidebar + serverCard | Sibling content vẫn render đúng vị trí; không bị wrapper nuốt | e2e |
| SV-62 | P1 | kisskh-like flex-row parent (video col + info col) | `t` open | Wrapper `flex:0 0 {px}` giữ footprint cột video; cột info KHÔNG collapse 0 width (regression của atom `flex-wrapper-inherit-original-footprint`) | manual (kisskh.co) |
| SV-63 | P1 | Iframe mode (cross-origin child doc) | `t` trong iframe | Split view render trong iframe doc; video + panel trong bounds iframe; không vỡ host page | manual (StreamFlix iframe mode port 4323/4324) |
| SV-64 | P1 | Viewport hẹp (390px) | `t` open | Panel min-width 200px / max 60%; stage > 0; không horizontal overflow của page | e2e |
| SV-65 | P2 | Page zoom 150% | `t` open | Layout vẫn đúng tỉ lệ; handle draggable | manual |
| SV-66 | P2 | Site có `position:fixed` playerShell | `t` open | playerShell → `position:absolute; inset:0` trong stageCell; viewportBound → height `100dvh` path | manual |

## H. Panel content

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-70 | P0 | Open, cues loaded | Quan sát panel | CueList render trong panel shadow; cue đang active được highlight theo `currentTimeMs` | e2e |
| SV-71 | P0 | Open | Click 1 cue | `onSeek` → `video.currentTime` = cue.start − offsetMs (±0.5s); video seek | e2e |
| SV-72 | P1 | Open, cues rỗng | Quan sát | `EmptyState "No subtitles loaded"` hiển thị (không phải blank) | e2e |
| SV-73 | P1 | Open | Seek video bằng progress bar | Cue highlight follow `currentTimeMs` update trong panel | e2e |
| SV-74 | P2 | Open | Scroll trong cue list | Chỉ list scroll (`.list` là sole scroll container); không scroll page | e2e |

## Stress combos (predicted failure hotspots)

| ID | Pri | Scenario | AC |
|---|---|---|---|
| SV-80 | P0 | `t` ×20 alternating ~100ms, kết thúc open | Wrapper ổn định: `video` ≥50% height gốc; playerShell styles không lẫn overrides cũ. **Covered bởi SV-03 (đã PASS sau fix).** |
| SV-81 | P0 | Open → drag handle 5 lần liên tiếp nhanh | Width cuối cùng = nét drag cuối; không flicker/rebuild; persist đúng 1 giá trị. **Covered bởi SV-10/11 (đã PASS sau fix).** |
| SV-82 | P1 | `t` open → `g` PM → `t` (CueList) → `g` exit → `t` close → `t` open | Mỗi transition sạch; cuối cùng split view open ổn định |
| SV-83 | P1 | Open → seek spam (prev/next cue ×20) → `t` close → `t` open | Cue engine không lệch; panel reopen sync đúng active cue |
| SV-84 | P2 | Open → episode switch (SV-40) → `t` close | Cleanup đúng playerShell MỚI (không phải node detached) |

---

## Coverage plan

1. **e2e hiện có**: `e2e/stage2/split-view.spec.ts` — cover SV-01/02. `e2e/stage2/split-view-stress.spec.ts` — cover SV-03, SV-04, SV-05, SV-10/11, SV-40, SV-41, SV-50 (sau fix: 6 passed / 1 skipped — SV-50 chờ mock có input).
2. **e2e bổ sung đề xuất** (automatable trên StreamFlix): SV-12, SV-13, SV-43, SV-51, SV-53, SV-60, SV-61, SV-64, SV-70–74.
3. **Unit-testable** (jsdom — pure logic nếu extract): clamp [20,60] của drag delta; `resolveSplitViewWrapperHeight`; axis-aware flex decision (nếu tách thành pure function).
4. **Manual trên site thật**: SV-20–24 (fullscreen), SV-30–32 (Player Mode), SV-42, SV-44, SV-62, SV-63, SV-65, SV-66 — cần stealth-chrome-devtools MCP hoặc test tay trên kisskh/themoviebox/YouTube.

## Ghi chú thực thi (đã implement)

- **BUG-SV-A fixed**: deferred restore được expose qua `splitViewPendingRestoreRef`; effect run mới drain đồng bộ trước khi snapshot/build → stale timer thành no-op qua `restoreDone`; `splitViewWrapperRef` null guard theo identity.
- **BUG-SV-B fixed**: `splitViewPct` state → `splitViewPctRef`; panel width qua `flexBasis` trực tiếp; persist 1 lần trên `pointerup`; bỏ khỏi effect deps.
- **BUG-SV-C fixed**: `handleToggleSplitView` + imperative `setSplitViewOpen` cancel `cleanupRef` (pending settle) trước khi set state.
- **BUG-SV-D mitigated**: MutationObserver `document.body` subtree → `playerShell.isConnected === false` → `setSplitViewOpen(false)` → cleanup tự dọn. Residual host-React crash = ceiling (cần no-reparent architecture).
- SV-50 skip: mock StreamFlix chưa có input field → thêm search input vào mock hoặc cover trên site thật.
