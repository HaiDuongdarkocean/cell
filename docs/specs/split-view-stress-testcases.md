# Split View (subtitle side panel) — Edge-case Audit & Stress Test Cases

Scope: Split View toggle qua phím `t` / nút "Open subtitle list" trên normal page (không phải Player Mode — ở Player Mode `t` toggle CueList, code path khác). Panel = `[data-cell-split-view]` wrapper trên light DOM: `stage` (chứa playerShell + `#cell-subtitle-root`) + `handle` (resize) + `panel` (shadow root chứa `SubtitlePanel`/CueList).

Test surface: StreamFlix mock (`http://127.0.0.1:4321`) qua Playwright (`e2e/stage2/`, fixture `streamFlixPage`) + **real sites qua Playwright** (`split-view-real.spec.ts`: kisskh.co, youtube.com, themoviebox.xyz — skip-graceful khi site bị anti-bot/network). Browser MCP chỉ cần cho site anti-automation nghiêm ngặt (streamduck).

## Bugs đã xác nhận (code audit + empirical trên StreamFlix mock)

| ID | Bug | Cơ chế | Status |
|---|---|---|---|
| BUG-SV-A | Rapid toggle phá layout / crash page | Cleanup schedule `setTimeout(410ms)` restore `savedPlayerShellStyles` + DOM. Reopen trước khi timeout fire → (1) snapshot mới capture override cũ làm "original" → polluted; (2) timeout cũ fire giữa session mới → strip `width/height:100%!important` của instance mới; (3) khi đóng lần cuối, polluted snapshot giữ overrides → video kẹt `100%×100%!important` sau close. Mỗi toggle = full DOM rebuild → stress gây renderer crash. | **FIXED**: restore được expose qua `splitViewPendingRestoreRef` — effect run mới drain đồng bộ trước khi build → styles restore trước snapshot (không pollution), DOM teardown sạch, timer cũ no-op qua `restoreDone`. SV-03 PASS sau fix (trước đó crash: "Target page, context or browser has been closed"). SV-04 trước đây PASS bị mask bởi aspect-ratio fallback — giờ pass đúng nghĩa. |
| BUG-SV-B | Kéo resize handle tự phá DOM | `splitViewPct` nằm trong effect deps → mỗi `setSplitViewPct` trong `pointermove` → cleanup + rebuild wrapper/stage/panel → handle mất pointer capture → drag chết giữa chừng. | **FIXED**: `splitViewPct` state → `splitViewPctRef` (chỉ đọc trong effect), bỏ khỏi deps. Panel width update trực tiếp `flexBasis`, persist 1 lần trên `pointerup`. SV-10/11 PASS sau fix (trước: panel dừng sau ~19px). |
| BUG-SV-C | Manual toggle bị settle reopen | `fullscreenchange` → auto off + `waitForPlayerSettle` → `setSplitViewOpen(true)`. `cleanupRef` chỉ cancel khi unmount → user nhấn `t` để đóng trong settle window → settle vẫn fire → panel tự mở lại ngược ý định. | **FIXED + verified e2e**: `handleToggleSplitView` + imperative `setSplitViewOpen` cancel `cleanupRef` trước khi set state. SV-23 PASS (mock fs) + SV-20R PASS (YouTube fs thật). |
| BUG-SV-E | PM exit strand player trong detached subtree | `g` trong lúc split-view's 410ms restore còn pending → PM mount effect capture `originalParent = stageCell` (chưa detach) → timer xoá wrapper → PM exit restore player vào stageCell đã chết → video mất khỏi page vĩnh viễn, `findPlayerContainer` trả null, split view stuck open. | **FIXED**: `PlayerModeOverlay` mount ghi `liveAnchorParent/liveAnchorSibling` = parent/sibling của split-view wrapper; exit-restore fallback sang live anchor khi `originalParent` detached. + `handleTogglePlayerMode` drain pending restore trước khi flip state (cover case `t`→`g` <410ms). SV-30/31 PASS. |
| BUG-SV-F | Zombie wrapper sau close-trong-fullscreen | Close trong fs: fs-branch restore remove stage/handle/panel nhưng wrapper+stageCell cũ (chứa fs element) không thể remove lúc fs active → sót `[data-cell-split-view]` trong page mãi mãi sau fs exit. | **FIXED**: `restoreNow` arm 1-shot `fullscreenchange` listener — fs exit → move playerShell ra parent của wrapper + remove wrapper. SV-23 PASS (post-fs-exit count = 0). |
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
| SV-20 | P0 | Open | Enter fullscreen (`f` hoặc nút fs của player) | Split view rebuild trong fs: video + panel cùng hiển thị trong fullscreen element; không exit fs. **PASS** (mock) + **PASS** YouTube thật (SV-20R). | e2e ✅ implemented |
| SV-21 | P0 | Open + fullscreen | Exit fullscreen (Esc) | Split view rebuild về normal layout: wrapper quanh playerShell vị trí cũ; video visible; chỉ 1 wrapper. **PASS** (mock + YouTube SV-20R). | e2e ✅ implemented |
| SV-22 | P1 | Open | Enter rồi exit fullscreen nhanh ×3 | Sau settle: 1 wrapper duy nhất; video rect hợp lý; không ghost stageCell/handle | manual |
| SV-23 | P1 | Open + fullscreen-change đang settle (<2s) | Nhấn `t` để đóng | Panel đóng và KHÔNG tự reopen khi settle fire; panel+handle gone trong fs; sau fs exit không zombie wrapper (BUG-SV-F fix). **PASS.** | e2e ✅ implemented |
| SV-24 | P2 | Open, host requestFullscreen trên chính `<video>` | Trigger fs | Code path re-request parent fs chạy; split view vẫn render | manual (site-specific) |

## D. Player Mode interplay

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-30 | P0 | Split view open | Nhấn `g` vào Player Mode | Split view DOM teardown (wrapper cleanup chạy); PM overlay mount; video hiển thị trong video stage PM. **PASS** sau fix BUG-SV-E. | e2e ✅ implemented |
| SV-31 | P1 | PM active (splitViewOpen=true ngầm) | Exit PM | Split view tự reopen qua fs-exit settle; player restore về live anchor (không detached stageCell). **PASS** sau fix BUG-SV-E. | e2e ✅ implemented |
| SV-32 | P1 | PM active | Nhấn `t` | `handleToggleSplitView` blocked (`playerMode` guard); không wrapper nào được tạo. **PASS.** | e2e ✅ implemented |

## E. Page lifecycle

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-40 | P0 | StreamFlix open split view | Click episode khác (React re-render, cùng DOM nodes) | Wrapper + panel vẫn gắn playerShell; video mới render; cue list vẫn hoạt động. **PASS.** | e2e ✅ implemented |
| SV-41 | P0 | StreamFlix open split view | Switch tab `playerDisplay`: Same-origin → Cross-origin iframe | MutationObserver tự đóng split view → không còn `[data-cell-split-view]` nào trong DOM. **PASS.** Residual: host React root unmount (page blank) — known ceiling, ghi nhận qua test annotation. | e2e ✅ implemented |
| SV-42 | P1 | Open | `history.back()`/SPA nav → video mới mount | Không ghost wrapper trên page mới; overlay re-init sạch | manual (site SPA: kisskh episode → next ep) |
| SV-43 | P1 | Open | Reload page | Split view đóng (state không persist — by design); không wrapper sót trong DOM sau reload; `t` mở lại bình thường. **PASS.** | e2e ✅ implemented |
| SV-44 | P2 | Open | `<video>` bị site detach/replace (MutationObserver-less) | Wrapper không giữ shell chết vô hạn — AC hiện tại: panel vẫn hiển thị (cue list vẫn dùng được) dù stage rỗng | manual |

## F. Input guards

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-50 | P0 | Closed, focus trong `<input>`/textarea/contenteditable | Gõ `t` | Không toggle; ký tự `t` vào input. **PASS** (edge spec injects `<input>` — không cần mock có sẵn input). | e2e ✅ implemented |
| SV-51 | P1 | Closed | `Ctrl+T` / `Shift+T` / `Alt+T` | Không match shortcut (modifier mismatch) → không toggle. **PASS.** | e2e ✅ implemented |
| SV-52 | P1 | Closed | `e.repeat` (giữ `t`) | Guard `e.repeat` → chỉ 1 toggle | e2e (trùng SV-05) |
| SV-53 | P1 | Open, focus trong panel (click vào cue) | Nhấn `t` | `t` vẫn toggle split view khi focus trong panel — AC: đóng bình thường. **PASS.** | e2e ✅ implemented |

## G. Layout integrity

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-60 | P0 | Page scroll ở giữa | `t` open | Scroll position không nhảy (≤4px); content dưới không bị đẩy. **PASS.** | e2e ✅ implemented |
| SV-61 | P0 | Open | Quan sát `Episodes` sidebar + serverCard | Sibling content vẫn render đúng vị trí; không bị wrapper nuốt. **PASS** (mock) + **PASS** themoviebox thật (SV-61R). | e2e ✅ implemented |
| SV-62 | P1 | kisskh flex-row parent (video col + info col) | `t` open | Wrapper `flex:0 0 {px}` giữ footprint cột video; cột info KHÔNG collapse. **PASS** trên kisskh.co thật (SV-62R): wrapper ≤ cột gốc +20px. | e2e ✅ implemented (real site) |
| SV-63 | P1 | Iframe mode (cross-origin child doc) | `t` trong iframe | Split view render trong iframe doc; video + panel trong bounds iframe; không vỡ host page | manual (StreamFlix iframe mode port 4323/4324) |
| SV-64 | P1 | Viewport hẹp (390px) | `t` open | Panel 190–253px; stage > 0; split view không TĂNG page overflow (≤ baseline +2px). **PASS.** | e2e ✅ implemented |
| SV-65 | P2 | Page zoom 150% | `t` open | Layout vẫn đúng tỉ lệ; handle draggable | manual |
| SV-66 | P2 | Site có `position:fixed` playerShell | `t` open | playerShell → `position:absolute; inset:0` trong stageCell; viewportBound → height `100dvh` path | manual |

## H. Panel content

| ID | Pri | Given | When | Then (AC) | Auto |
|---|---|---|---|---|---|
| SV-70 | P0 | Open, cues loaded | Quan sát panel | CueList render trong panel shadow (>1 cue). **PASS.** | e2e ✅ implemented |
| SV-71 | P0 | Open | Click 1 cue (trên `[data-cell-id="cue-timestamp"]`) | `onSeek` → `video.currentTime` > 0. **PASS.** | e2e ✅ implemented |
| SV-72 | P1 | Open, cues rỗng | Quan sát | `EmptyState "No subtitles loaded"` hiển thị (không phải blank) | e2e |
| SV-73 | P1 | Open | Seek video (currentTime=5) | Cue highlight update theo `currentTimeMs`. **PASS.** | e2e ✅ implemented |
| SV-74 | P2 | Open | Scroll trong cue list | List scroll nội bộ; `window.scrollY` không đổi. **PASS.** | e2e ✅ implemented |

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

1. **e2e mock (StreamFlix)**: `split-view.spec.ts` — SV-01/02. `split-view-stress.spec.ts` — SV-03/04/05, SV-10/11, SV-40, SV-41, SV-50(skip). `split-view-edge.spec.ts` — SV-20/21, SV-23, SV-30/31, SV-32, SV-43, SV-50, SV-51, SV-53, SV-60, SV-61, SV-64, SV-70/71, SV-73, SV-74. **Kết quả: 21 passed / 1 skipped** (SV-50 trong stress spec skip vì mock không có sẵn input — case tương đương PASS ở edge spec với injected `<input>`).
2. **e2e real sites**: `split-view-real.spec.ts` — SV-62R (kisskh siblings), SV-20R (YouTube fs enter/exit), SV-61R (themoviebox broad shell). **3 passed** trên Chrome thật (Playwright persistent context + `--load-extension`; skip-graceful khi site bị block).
3. **Unit-testable** (jsdom — pure logic nếu extract): clamp [20,60] của drag delta; `resolveSplitViewWrapperHeight`; axis-aware flex decision (nếu tách thành pure function).
4. **Còn lại chưa cover**: SV-12/13 (persist width qua reload — đã cover 1 phần qua SV-43 nhưng chưa assert %), SV-15/16, SV-22, SV-24, SV-42, SV-44, SV-63 (iframe child doc), SV-65/66, SV-72, SV-80–84. Phần lớn là P1/P2 edge hoặc cần fixture đặc thù; SV-63 cần StreamFlix iframe mode (port 4323/4324).

## Ghi chú thực thi (đã implement)

- **BUG-SV-A fixed**: deferred restore được expose qua `splitViewPendingRestoreRef`; effect run mới drain đồng bộ trước khi snapshot/build → stale timer thành no-op qua `restoreDone`; `splitViewWrapperRef` null guard theo identity.
- **BUG-SV-B fixed**: `splitViewPct` state → `splitViewPctRef`; panel width qua `flexBasis` trực tiếp; persist 1 lần trên `pointerup`; bỏ khỏi effect deps.
- **BUG-SV-C fixed**: `handleToggleSplitView` + imperative `setSplitViewOpen` cancel `cleanupRef` (pending settle) trước khi set state. Verified SV-23 + SV-20R.
- **BUG-SV-D mitigated**: MutationObserver `document.body` subtree → `playerShell.isConnected === false` → `setSplitViewOpen(false)` → cleanup tự dọn. Residual host-React crash = ceiling (cần no-reparent architecture).
- **BUG-SV-E fixed**: PM mount snapshot `liveAnchorParent/liveAnchorSibling` từ wrapper's live parent → exit-restore fallback khi `originalParent` detached; `handleTogglePlayerMode` drain pending restore trước khi flip. Verified SV-30/31.
- **BUG-SV-F fixed**: fs-branch restore arm 1-shot `fullscreenchange` unwrap listener — close-trong-fs không để zombie wrapper/stage sau fs exit. Verified SV-23.
