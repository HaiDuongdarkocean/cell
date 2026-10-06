# Spec — Subtitle Split View: Acceptance Criteria (canonical AC contract)

Scope: Split View = side subtitle panel (`t` key / "Open subtitle list" button) trên
normal page và fullscreen. Implementation: `src/features/subtitle/ui/subtitleSplitView.ts`.
DOM: `[data-cell-split-view]` = `wrapper` (normal branch only) → `stage` + `handle` + `panel`
(shadow root chứa `SubtitlePanel`).

Đây là **AC contract cố định** — mọi PR/chỉnh sửa đụng tới `subtitleSplitView.ts`,
`mountSubtitle.tsx`, `SubtitlePanel*.tsx`, hoặc subtitle auto-load phải re-verify
toàn bộ nhóm AC liên quan. Chi tiết stress-test e2e: `split-view-stress-testcases.md`
(SV-*) — file này là bảng AC tổng, file kia là test mapping.

## AC-1 · Open / close lifecycle

| ID | AC |
|---|---|
| AC-1.1 | `t` mở: wrapper + stage + handle + panel xuất hiện; panel slide-in từ phải; `#cell-subtitle-root` reparent vào stageCell (overlay phủ đúng video, không phủ panel) |
| AC-1.2 | `t` đóng: panel slide-out về phải (~410ms) rồi DOM teardown; `playerShell` về đúng `originalParent`/`originalNextSibling`; mọi inline style trong `playerShellStyleProperties` restore về giá trị cũ |
| AC-1.3 | Rapid toggle (<410ms) không pollute snapshot style, không ghost wrapper, không crash — pending restore drain đồng bộ trước khi build mới |
| AC-1.4 | Giữ phím `t` (auto-repeat) chỉ toggle 1 lần; `Ctrl/Shift/Alt+T` không match; focus trong `<input>`/contenteditable không toggle |
| AC-1.5 | Site detach/replace `playerShell` (React re-render, SPA nav) → MutationObserver tự đóng split view, không ghost `[data-cell-split-view]` trong DOM |

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
| AC-3.1 | `playerShell` là `display:flex; flex-direction:column; justify-content:center` — video **vertically centered** trong stage khi stage cao hơn content (fluid player recompute sau khi panel lấy width share) — không có dead band đen chỉ ở dưới |
| AC-3.2 | Wrapper height = **content height của shell đo ở full row width** (tạm `panel.style.display='none'` trong cùng frame khi measure — panel ăn width không được làm height co lại): tight shell → shell content height (gồm cả sibling in-shell như subtitle strip của site); broad shell (`playerRect.width > videoRect.width × 1.2`) → video height; viewportBound → `100dvh`; YouTube → `100%` |
| AC-3.3 | Flex-row insert parent có siblings (kisskh `.row`): wrapper basis `0 0 {px}` giữ footprint cột video — cột info/episode KHÔNG collapse về 0 |
| AC-3.4 | `playerShell` overrides: `width/height:100%!important`, `aspect-ratio:auto`, `margin:0`, `box-sizing:border-box`, `overflow:visible` (jwplayer/megaplay clip control bar nếu hidden) |
| AC-3.5 | `#cell-subtitle-root` luôn nằm trong `stageCell` (position:relative), overlay fill video stage — không lọt sang panel, không escape ra viewport khi playerShell position:static |

## AC-4 · Responsive layout (resize / sidebar / zoom)

| ID | AC |
|---|---|
| AC-4.1 | **Thu nhỏ/phóng to cửa sổ browser**: wrapper height recompute theo content mới — video không bị crop, không dead space. Đo bằng `playerShell.scrollHeight` sau khi flip `height:auto` trong cùng frame (scrollHeight khi `height:100%!important` = clientHeight → circular, cấm dùng trực tiếp) |
| AC-4.2 | **Toggle browser sidebar** (dải bookmark/history/Side Panel làm đổi layout viewport): giống AC-4.1 — ResizeObserver trên `insertParent` + `video` phải bắt được |
| AC-4.3 | Flex-row parent (`hasFlexSiblings`): basis px recompute = `insertParent` content width − tổng sibling widths — cột video không overflow, siblings không bị đè |
| AC-4.4 | Recalc debounced qua `requestAnimationFrame`; observer disconnect + cancel rAF + remove scroll listener trong cleanup — không leak listener sau khi đóng split view |
| AC-4.5 | Re-open sau resize: sizing recalc từ đầu (measure lúc mở) — không dùng giá trị cache từ session trước |
| AC-4.6 | **Viewport-bound rule**: ở mọi kích thước browser, video và panel đều nằm trong vùng content hiển thị — wrapper height = `min(content height, innerHeight − wrapper.top − margin)` với floor 160px. Window thấp → split view co theo viewport, video không bị che dưới fold |
| AC-4.7 | **Horizontal floor**: stage `min-width:min(200px,55%)`, panel `min-width:min(200px,45%)` + `max-width:min(60%, 100% − 200px)` — panel không bao giờ nuốt hết stage; cả hai luôn visible kể cả viewport hẹp |
| AC-4.8 | Scroll trang (nested scroller cũng tính — listener `capture:true`): wrapper `top` đổi → height cap recompute ngay, split view luôn bám vùng nhìn thấy |
| AC-4.9 | **Mở panel / panel drag không đổi wrapper height**: nhấn `t` giữ chiều cao video đang có trước khi panel ăn width; kéo handle (kể cả tới max 60%) chỉ làm video co ngang + centered dọc (đệm trên/dưới qua `justify-content:center`). Height chỉ re-measure khi browser viewport đổi (wrapper width / `innerHeight`) — scroll chỉ re-cap theo `top` (AC-4.8), KHÔNG re-measure. Đo lại ở full row width bằng `visibility+position` (CẤM `display:none` — restart transition → panel nháy đóng/mở) |
| AC-4.10 | Viewport cap kích hoạt (`cappedH < contentH`): constrain `playerShell` **width** theo aspect video (`width = cappedH × videoW/videoH`, `margin:0 auto`, `justify-content:flex-start`) — **chỉ khi `targetW` nằm trong (200px, stage width)**; targetW ≥ stage width → giữ `width:100%` + centered (cấm constrain vượt stage = video tràn ngang bị panel che); cấm zero `padding-top` của `.vjs-fluid` (collapse video về ~0) |
| AC-4.11 | **Narrow slot — sheet khi viewport mobile, column khi slot hẹp**: `sheetMode = window.innerWidth < 600`, `narrow = sheetMode || insertParent.clientWidth < 600`. **Sheet mode** (viewport <600, mobile): panel reparent lên `document.body` thành **bottom sheet** theo convention `Sheet` atom (`position:fixed`, inset `space-2` left/right/bottom, `radius-element`, `surface-popover`, `z-overlay-top`, height `min(50dvh, 460px)`, enter/exit slide `translateY`) — video giữ slot tự nhiên (`wrapper height = stageH` đúng `slotW / videoAspect`), sheet nổi trên content không che/bóp video, cue list được height thực. **Column mode** (slot <600 trên viewport rộng): wrapper `flex-direction:column`, video trên, panel inline dưới fill phần còn lại — panel ở trong page flow khi vẫn có không gian dọc. Slot width đo từ `insertParent.clientWidth`, KHÔNG từ wrapper rect (wrapper có thể còn basis px stale tràn viewport). Narrow flex-basis = `0 0 100%` CHỈ cho flex-row `insertParent`; non-row parent → `0 0 auto` (% basis trên column parent rơi vào trục **height**, ghi đè `height` property → toàn bộ split view collapse về content height). Site responsive CSS biến `playerShell` thành `position:fixed` (kisskh `.portrait` phủ viewport) phải bị pin lại `position:absolute;inset:0` vào stage mỗi recalc — kiểm tra computed position hiện tại, không chỉ lúc mở. Handle `display:none` ở sheet mode / divider ngang ở column mode, drag tắt (`isNarrowLayout` guard). Round-trip sheet↔row restore đúng: panel về lại wrapper, position/inset/z-index/radius/background reset về giá trị mở (`PANEL_INNER_BASE_BG`) |

## AC-5 · Fullscreen Split View

| ID | AC |
|---|---|
| AC-5.1 | Mở panel khi ĐANG fullscreen (đúng thứ tự: fullscreen trước → `t`): `playerShell` (fullscreen element, top layer) transform thành `display:flex; flex-direction:row`; children move vào stageCell; video + panel cùng render trong vùng fullscreen — **không exit fullscreen** |
| AC-5.2 | **`padding: 0 !important` trên fullscreen shell** — bắt buộc. `.vjs-fluid` (video.js) và mọi aspect-ratio-padding player đặt `padding-top` ∝ width trên chính shell; nếu không triệt, flex children chỉ chiếm content box → video + panel bị đẩy xuống dưới, đen phía trên |
| AC-5.3 | `'padding'` + `'justify-content'` phải nằm trong `playerShellStyleProperties` — mọi style split-view set phải restore được |
| AC-5.4 | fsEl là ANCESTOR của playerShell (document.documentElement): unwrap playerShell khỏi wrapper cũ trước khi transform — playerShell được phép fill viewport |
| AC-5.5 | Enter/exit fullscreen khi split view open: rebuild qua fullscreenchange off→on settle; đóng trong fs → 1-shot `fullscreenchange` listener unwrap zombie wrapper sau fs exit |

## AC-6 · Resize handle & Player Mode

| ID | AC |
|---|---|
| AC-6.1 | Drag handle: panel flex-basis update trực tiếp (không rebuild DOM giữa drag — `splitViewPctRef` không nằm trong effect deps); clamp [20%, 60%]; persist `SPLIT_VIEW_PCT` 1 lần trên `pointerup` |
| AC-6.2 | Panel min-width 200px, max-width 60% — không bao giờ nuốt stage hoặc overflow viewport |
| AC-6.3 | `g` vào Player Mode khi split view open: teardown sạch qua live anchor (`liveAnchorParent/liveAnchorSibling`), exit PM restore đúng — không strand player trong detached subtree |
| AC-6.4 | `t` trong Player Mode bị block (PM dùng `t` cho CueList) — không tạo wrapper |

## Regression notes (đã fix — giữ AC phòng regress)

| Bug | Root cause | AC cover |
|---|---|---|
| PhimWar panel trống lúc auto-load | AES key derive từ filename `%20`-encoded thay vì decoded | AC-2.5 |
| Fullscreen video thu nhỏ + đen trên | `.vjs-fluid` `padding-top` nằm ngoài flex content box | AC-5.2 |
| Normal mode video dính top | Stage cao hơn content, child top-aligned | AC-3.1 |
| Resize/sidebar không reflow | Wrapper height + flex basis freeze px lúc mở | AC-4.1–4.4 |
| Short viewport video crop trên/dưới | Fluid `padding-top` giữ nguyên khi wrapper bị cap | AC-4.6, AC-4.10 |
| Zero fluid padding → video collapse 24px | `.vjs-fluid` box = chính padding; phải constrain width theo aspect | AC-4.10 |
| Panel max làm wrapper co theo video | Height recompute theo stage width → shrink; phải freeze theo viewport key | AC-4.9 |
