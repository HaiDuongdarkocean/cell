# Spec — Subtitle Split View: Acceptance Criteria (canonical AC contract)

Scope: Split View = side subtitle panel (`t` key / "Open subtitle list" button) trên
normal page và fullscreen. Implementation: `src/features/subtitle/ui/subtitleSplitView.ts`.

Kiến trúc (sau rewrite): **shell không bao giờ rời cây DOM của host**. Normal mode chỉ
set `width:(100−pct)%` trên `playerShell` (đánh dấu `[data-tihoka-split-shell]`) và mount
panel lên `document.body`, ghim vào strip mà shell giải phóng — sync qua
ResizeObserver + scroll + resize. Panel position đi theo positioning của shell:
in-flow → `absolute` tọa độ document (scroll mang theo cùng paint pass — không lag/float);
pinned (`fixed`/`sticky`) → `fixed` theo viewport. Không wrapper, không reparent, không
slot keeper — mọi mount/unmount là atomic. Fullscreen là ngoại lệ duy nhất: panel phải
nằm trong top-layer element nên children của shell move vào
`[data-tihoka-split-view="stage"]` và shell thành flex row.

DOM: `[data-tihoka-split-shell]` = playerShell được mark (cả 2 nhánh) → `panel`
(shadow root chứa `SubtitlePanel` + `handle` + `sheet-handle`). `handle` là hit-strip
vô hình 14px trong panel shadow tại viền trái (`cursor:col-resize`,
`touch-action:pan-y` để swipe dọc vẫn scroll cue list).

Đây là **AC contract cố định** — mọi PR/chỉnh sửa đụng tới `subtitleSplitView.ts`,
`mountSubtitle.tsx`, `SubtitlePanel*.tsx`, hoặc subtitle auto-load phải re-verify
toàn bộ nhóm AC liên quan. Chi tiết stress-test e2e: `split-view-stress-testcases.md`
(SV-*) — file này là bảng AC tổng, file kia là test mapping.

## AC-1 · Open / close lifecycle

| ID | AC |
|---|---|
| AC-1.1 | `t` mở: shell được mark + thu width in-place; panel slide-in từ phải (sheet mode: từ dưới); `#Tihoka-subtitle-root` ở nguyên vị trí trong shell — overlay phủ đúng video, không phủ panel |
| AC-1.2 | `t` đóng: shell width + attr restore **ngay lập tức** (video mở rộng lại trong lúc panel slide-out ~410ms); panel remove sau animation; mọi inline style trong `shellStyleProps` restore về giá trị cũ |
| AC-1.3 | Rapid toggle (<410ms) không ghost panel, không crash — pending restore (chỉ `panel.remove()`) drain đồng bộ trước khi build mới; mount/unmount atomic nên không có window cho race |
| AC-1.4 | Giữ phím `t` (auto-repeat) chỉ toggle 1 lần; `Ctrl/Shift/Alt+T` không match; focus trong `<input>`/contenteditable không toggle |
| AC-1.5 | Site detach/replace `playerShell` (React re-render, SPA nav) → MutationObserver tự đóng split view, không ghost `[data-tihoka-split-shell]`/`panel` trong DOM |

## AC-2 · Panel content

| ID | AC |
|---|---|
| AC-2.1 | Panel render CueList trong shadow root với đầy đủ cues đã load (bilingual nếu cả hai track có) — số cue-item = số cues merged |
| AC-2.2 | Auto-load và manual select (Subtitle Manager) cho kết quả panel giống nhau — cùng path `loadBilingualCues` → `mount.setCues` |
| AC-2.3 | Panel rỗng khi không có cues phải hiển thị EmptyState, không blank |
| AC-2.4 | Click cue → seek video; highlight theo `currentTime`; scroll cue list không scroll trang |
| AC-2.5 | Subtitle URL có filename URL-encoded (space, `%20`, ký tự đặc biệt) vẫn decrypt/parse được — PhimWar AES key derive từ tên file **decoded** (`decodeURIComponent`), không phải pathname segment thô |

## AC-3 · Normal Split View layout

| ID | AC |
|---|---|
| AC-3.1 | Shell giữ nguyên vị trí — `width:(100−pct)%` + `height:<natural>px` (`!important`). Height anchor = chiều cao tự nhiên full-width của shell, đo lúc mount + re-đo trên viewport resize (khi đo phải gỡ marker — fill chain làm `%`-height của `.player-size` vòng tròn về 0 nếu đo lúc CSS đang áp). Video letterbox BÊN TRONG shell qua fill chain — video giữ chiều cao, drag panel chỉ co ngang, video không bao giờ bị che |
| AC-3.2 | Panel trên `document.body`: `top/left/height` = shell rect sau-khi-shrink (+`scrollX/Y` khi doc-space); `width` = `cbRect.right − shell.right` (cb = containing block của shell — cùng box mà width% của shell resolve). `position` theo shell: in-flow → `absolute` (doc-space), `fixed`/`sticky` → `fixed` (viewport). Shell `position:fixed` → cb = `document.documentElement` (offsetParent null) |
| AC-3.3 | Strip hẹp → `effectivePct` clamp để strip ≥ `min(200px, 50% cbW)`; pct lưu vẫn ghi intent của user — display clamp không ghi đè stored value |
| AC-3.4 | Panel `visibility:hidden` khi shell rect < 2px (host giấu subtree — engagement panel, re-render) — co lại theo host thay vì nổi trên takeover; hiện lại khi shell quay về |
| AC-3.5 | `#Tihoka-subtitle-root` không bao giờ được reparent — overlay fill shell theo anchor sẵn có của nó |
| AC-3.6 | `playerShell` = ancestor trong cùng còn thuộc player: walk `findPlayerShell` chọn **nearest same-size ancestor đầu tiên** (tightest player box) + **upgrade lên ancestor sở hữu chrome** (positioned child absolute\|fixed ngoài candidate phủ ≥5% video box — m.youtube: `.player-controls-background`/`#player-control-overlay`; kisskh: `.controls`/`.header`). Wrapper neutral same-size được traverse nhưng không bao giờ được chọn (`.col-12` grid cell thay box theo breakpoint → strip sập 0). Ancestor `display:inline` (Angular `mat-video`/`app-watch`) không thể resize → traverse nhưng không pick; shell inline được promote `display:block` khi mark. Chrome-owner chỉ upgrade khi ≤1.5× video per-dim — page scrim (`.mat-drawer-backdrop` cả trang) bị loại |
| AC-3.7 | Shell out-of-flow (`fixed`/`absolute`/`sticky`) ở nguyên chỗ — host tự quản slot (m.youtube `.player-placeholder`, sticky pin, engagement-panel states). Panel bám theo rect sống của shell nên pin/scroll/reposition đều đúng. z-index hai lớp: doc-space dock → `var(--z-overlay-content, 1)` — trên in-flow content (kisskh `.mat-drawer-content` z1, hòa z thắng bằng DOM order) nhưng dưới host chrome (toolbar z2, m.youtube topbar z4) để panel trôi dưới khi scroll; sheet/pinned → `var(--z-overlay-video, 10000)` — trên host UI, dưới mọi Tihoka system surface |

## AC-4 · Responsive layout (resize / sidebar / zoom / rotate)

| ID | AC |
|---|---|
| AC-4.1 | Resize/viewport đổi → `syncLayout` recompute qua RO trên shell + video + `resize`/`scroll(capture)` listener — panel luôn dock đúng strip sống, shell % tự theo cb mới |
| AC-4.4 | Sync debounced qua `requestAnimationFrame`; observer disconnect + cancel rAF + remove listener trong cleanup — không leak |
| AC-4.5 | Re-open sau resize: geometry đo live từ đầu — không cache rect session trước |
| AC-4.6 | Mọi kích thước browser: panel dock trong vùng strip shell giải phóng; video letterbox qua `object-fit:contain` (shell-scoped CSS bridge) — không crop |
| AC-4.8 | Scroll trang (nested scroller — listener `capture:true`): shell in-flow → panel `absolute` doc-space nên cuộn cùng paint pass (không lag trễ frame, không float); shell `fixed`+`scrollY>8` = host takeover (pin/miniplayer) → disengage: restore width/height + gỡ marker + panel `visibility:hidden`, re-engage khi shell về flow; shell `fixed`/`sticky` ở scrollY≈0 → panel `fixed` viewport follow rect |
| AC-4.9 | **Mở panel / drag không đổi shell height** — height anchored px, chỉ width% đổi theo pct — video re-letterbox trong shell, không bao giờ bị panel che |
| AC-4.11 | **Sheet mode = `window.innerWidth < 600`** (viewport mobile): shell restore width tự nhiên, panel `fixed` bottom edge-to-edge (`left/right/bottom:0`) theo convention `Sheet` atom (`radius-element` bo 2 góc trên, `surface-popover`, `z-overlay-video` — trên host UI, dưới Tihoka system surface), height `min(50dvh, 460px)` qua `splitViewSheetHeightPx`, enter/exit `translateY`. Handle `display:none`, drag tắt (`isSheetMode` guard). Round-trip sheet↔docked: shell width + panel geometry + radius/background reset đúng |

## AC-5 · Fullscreen Split View

| ID | AC |
|---|---|
| AC-5.1 | Mở panel khi ĐANG fullscreen (đúng thứ tự: fullscreen trước → `t`): `playerShell` (fullscreen element, top layer) transform thành `display:flex; flex-direction:row`; children move vào stageTihoka; panel trong shell (`position:relative`, `flex:0 0 pct%`) — **không exit fullscreen** |
| AC-5.2 | **`padding: 0 !important` trên fullscreen shell** — bắt buộc. `.vjs-fluid` (video.js) và mọi aspect-ratio-padding player đặt `padding-top` ∝ width trên chính shell; nếu không triệt, flex children chỉ chiếm content box → video + panel bị đẩy xuống dưới, đen phía trên |
| AC-5.3 | `'display'` + `'flex-direction'` + `'padding'` trong `shellStyleProps` của fs branch — mọi style set phải restore được |
| AC-5.5 | Enter/exit fullscreen khi split view open: rebuild qua fullscreenchange off→on settle; normal→fs teardown restore children về shell + `stageTihoka.remove()` — không zombie stage |
| AC-5.6 | Shell được mark `data-tihoka-split-shell` trong cả fs branch → stage-scoped fill rules (`[stage] .player-size`/`#movie_player`/`.html5-video-container`/`video`) + shell-scoped rules (object-fit, chrome widths) đều áp được qua MAIN-world bridge |

## AC-6 · Resize handle & Player Mode

| ID | AC |
|---|---|
| AC-6.1 | Drag handle: edge-strip vô hình 14px trong panel shadow (`data-tihoka-split-view="handle"`, left:0, `touch-action:pan-y`). pct update trực tiếp (không rebuild DOM — `splitViewPctRef` không nằm trong effect deps): normal → `shell.style.width=(100−pct)%` + panel dock sync; fs → `panel.style.flexBasis`. Clamp [20%, 60%]; persist `SPLIT_VIEW_PCT` 1 lần trên `pointerup` |
| AC-6.6 | Body-level floating chrome (comprehension pill) phải né panel: split view set `--Tihoka-split-panel-w` trên `:root` = panel width (0 ở sheet), update khi sync + khi drag, xóa khi teardown — pill anchor về góc phải video stage, không đè header panel |
| AC-6.2 | Panel strip ≥ `min(200px, 50% cbW)` (effectivePct clamp), pct ≤60% — panel không nuốt shell, không overflow viewport |
| AC-6.3 | `g` vào Player Mode khi split view open: teardown sạch qua live anchor (`liveAnchorParent/liveAnchorSibling`), exit PM restore đúng — không strand player trong detached subtree |
| AC-6.4 | `t` trong Player Mode bị block (PM dùng `t` cho CueList) — không mark shell |
| AC-6.5 | PM cue list là state riêng (`pmCueListOpen` trong `SubtitlePanels`), độc lập với `splitViewOpen`: `g` vào/ra PM không đụng `splitViewOpen`/`onSplitViewChange` — exit PM khi normal-mode split view đang đóng KHÔNG mark shell; nếu split view đã mở trước PM thì exit PM restore nguyên (AC-6.3) |

## Regression notes (đã fix — giữ AC phòng regress)

| Bug | Root cause | AC cover |
|---|---|---|
| PhimWar panel trống lúc auto-load | AES key derive từ filename `%20`-encoded thay vì decoded | AC-2.5 |
| Fullscreen video thu nhỏ + đen trên | `.vjs-fluid` `padding-top` nằm ngoài flex content box | AC-5.2 |
| m.youtube landscape click metadata → trắng màn hình | YouTube `[engagement-panel-open] ytm-watch{display:none}` giấu cả wrapper của ta đặt trong watch | AC-3.7 (shell+panel ngoài watch subtree) |
| Spam `t` → wrapper lên body-top, khoảng trắng trước title | m.youtube đo `.player-placeholder` TỪ shell — shell trong stage → keeper sập 0×0 → mọi probe miss → fallback DOM spot | AC-1.3 (không còn reparent → không còn race) |
| Panel zombie sau chuỗi toggle | Sheet mode reparent panel lên body ngoài wrapper → `wrapper.remove()` sót lại | AC-1.2/1.3 |
| m.youtube: host overlay (controls/scrim) phủ cả stage + panel, chặn tap panel | Same-size walk trả inner shell `#player` — overlay siblings ở ngoài; lift-to-overlay-owner wrap shared parent | AC-3.6 |
| Video co chiều cao, lộ khoảng trắng khi mở | `.player-size` lấy height từ padding-bottom:% của width — width co thì height co; zero padding thì shell sập vì height:auto vòng tròn | AC-3.1 (anchored px phá vòng tròn) |
| Sheet mode shell sập 0 | `removeProperty(height)` trong khi marker+fill-chain còn → vòng tròn | AC-3.1 (anchor trong cả sheet mode) |
| kisskh thu nhỏ trang → panel mất | farthest-same-size pick `mat-video`/`col-12` — `display:inline` (width% vô hiệu) hoặc grid cell bung full-width → `shell.right` chạm cbRect.right → strip=0 | AC-3.6 (nearest-box + chrome-own + inline-skip; promote block khi mark) |
