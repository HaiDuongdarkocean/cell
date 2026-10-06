# Spec: Player Mode mobile layout (<600px)

> Intent: `docs/intent/player-mode-mobile-layout.md` · ui_surface: yes · Mode: interactive
> Mockup: `docs/mockups/player-mode-mobile-layout.png` (target, 14 vùng đánh số) · current: `docs/mockups/player-mode-mobile-current.png`

## Objective

Trên viewport <600px, Player Mode hiện nhồi ~14 nút vào dock đáy + 3 surface nổi rời → subtitle/cuelist không còn không gian. Spec này định nghĩa layout mobile-first cho PM <600px theo mockup: video top → cueRegion middle (card-style, 2 display modes) → anchorRow (CC + pill + track caption) → bottomBar transport với ⋯ overflow; action rail dọc mép phải cueRegion. Desktop ≥600px, overlay thường, split-view không đổi; handler + `data-cell-id` contract giữ.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Mobile learner (<600px, touch) | `g` / `player-mode-btn`, tap controls, scroll cuelist, chọn display mode trong Subtitle Manager | taps, keys | PM layout, cue cards, ⋯ menu, pill |
| Host page | `<video>` + player container | — | — |
| chrome.storage.local | persist display mode, content pct, cue filter | setting values | — |

## Requirements

### Functional

REQ-1: Mobile PM layout skeleton
- Actor: mobile learner
- Goal: PM chiếm viewport, tối đa vùng đọc
- Preconditions: `playerMode=true`; viewport width <600px
- Basic flow:
  1. actor vào PM
  2. system render stack dọc: `videoStage` (aspect via `resolvePlayerModeLayout`) → `cueRegion` (flex:1) → `anchorRow` → `bottomBar`; `actionRail` absolute mép phải cueRegion
  3. system output PM mobile layout
- Alt flow: ≥600px → desktop branch hiện tại (row split + dock), không đổi. Cross breakpoint trong session → re-render đúng nhánh qua viewport state hiện có.
- Exception: không cues → cueRegion EmptyState (pattern AC-2.3); `practiceMode≠'off'` → cueRegion render `SubtitlePracticeSession` như hiện tại (rail/bar vẫn render).
- Rules: `@media (max-width: 599px)` + existing `viewport` state là nhánh duy nhất; geometry mobile: `bottomBar` height = token-based compact (thay `DOCK_MIN_HEIGHT_PX` 160 bằng bar ~`--touch-target-mobile` + paddings + anchorRow auto), `resolvePlayerModeLayout` nhận dockHeight tương ứng — cueRegion = phần còn lại.
- Postcondition: PM mobile active; player reparent/restore nguyên.
- NFR refs: NFR-1, NFR-3, NFR-4

REQ-2: Bottom transport bar
- Actor: mobile learner
- Goal: transport + exit 1 tay
- Preconditions: PM mobile mounted
- Basic flow:
  1. system render `bottomBar`: [exit `player-mode-exit-btn` tint-gray pill] | [`nav-prev`] [`nav-repeat`] [`nav-play`] [`nav-next`] | [`pm-more-btn` tint-gray pill] — mọi nút cùng box `md` (40px, `--iconbutton-size-md`), transport gap `space-1` thành một cluster ngón cái; grid 3 cột giữ transport căn giữa
  2. actor tap → handler hiện có (`onExit`/`onPrev`/`onRepeat`/`onPlayPause`/`onNext`)
  3. state reflect: `repeatActive`, play/pause icon theo `isPlaying`
- Alt flow: `cues.length===0` → prev/next swap thành [`nav-rewind`/`nav-forward`] gọi `onRewind`/`onForward`; cues load → swap về.
- Exception: handler vắng (vd `onRepeat` không truyền) → nút đó không render, bar reflow.
- Rules: **Button subtle-family** (mở rộng `shared/ui/Button` — đúng cặp `comprehension-pill`: `*-subtle` nền + gốc thuần fg): prev/repeat/next + quick-add = `variant="primarySubtle"`; hero = `variant="warningSubtle"`; edit-card = `variant="errorSubtle"`; filter/generate/CC = `variant="neutralSubtle"`; X/⋯ = `variant="ghost"` (icon trần theo mẫu); icon glyphs bare theo REQ-11 (prev=`chevronLeft`, hero=`play`/`pause`, next=`chevronRight`), size theo REQ-10; hover/press = overlay chuẩn của Button (`::after`), toggle = `active` prop; thứ tự cố định; transport group giữ `data-cell-id="nav-cluster"` trên wrapper; Esc giữ semantics: menu open → đóng menu (escapeLayer) → cueListOpen=false → exit PM.
- Postcondition: parity desktop.
- NFR refs: NFR-1, NFR-2, NFR-5

REQ-3: Card rail + band rail pair
- Actor: mobile learner
- Goal: contextual actions 1 chạm, đúng vị trí mockup
- Preconditions: PM mobile mounted
- Basic flow:
  1. **Card rail** (`data-cell-id="pm-card-actions"`): quick-add + edit-card gắn **bên trong** active cue card, absolute top-right trong bounds card, kích thước compact (40px — nhỏ hơn FAB chuẩn), scroll theo card
  2. **Band rail** (`data-cell-id="player-mode-actions"` — reuse C5 id): cue-filter-fab + generate-native xếp **dọc** ở mép phải band — filter nổi trên mép card peek phía trên, generate nằm ngang hàng với CC+pill; đối xứng cân đối với `manager-toggle-btn` trái (vùng 5,6)
  3. actor tap → `onQuickAdd`/`onEditCard`/`onGenerateNative`
- Alt flow: `cue-filter-fab` portal vào slot trong band rail: PM overlay tạo slot `div`, truyền xuống SubtitlePanel qua prop (`fabPortalTarget`); SubtitlePanel `createPortal(cueFilterFab, slot)` — state giữ nguyên trong panel. Fab không render (disabled/không tokenize/active-mode) → slot collapse.
- Exception: handler vắng → nút skip; rail co. Active card vắng → card rail không render.
- Rules: active card `padding-right` ≥ card rail width + gap để text không bị đè; card rail nằm trong card element; band `pointer-events:none` trừ nút.
- Postcondition: vị trí nút match mockup (3,4 trong active card nhỏ gọn; 5,6 pair ngang phải-band đối diện CC).
- NFR refs: NFR-1, NFR-5, NFR-6

REQ-4: Floating anchor band + pill reposition
- Actor: mobile learner
- Goal: status surfaces nổi trên đáy cueRegion như mockup (card kế peek phía sau)
- Preconditions: PM mobile mounted
- Basic flow:
  1. system render `pm-anchor-band` **absolute đè đáy `pm-cue-wrap`** (sibling của `pm-cue-region`, **trong suốt hoàn toàn**; `pm-cue-region` scroll có `mask-image` fade đáy — card tan dần khi vào vùng band): row [CC `manager-toggle-btn` trái | **pill căn giữa tuyệt đối** (`left:50%`) | rail pair phải (REQ-3)]. Không còn caption `Subtitles: <label>` (AC-20) — band chỉ còn một hàng nút, tiết kiệm chiều cao
  2. **Pill mechanism (decided)**: PM mobile set `data-cell-player-mode-mobile="true"` trên `document.documentElement` khi mount (cleanup remove). `ComprehensionPill.module.css` thêm `:host-context([data-cell-player-mode-mobile]) .pill { top:auto; bottom: calc(var(--pm-anchor-bottom, <bottombar+caption px>)); }` — pure CSS: remount-safe (không inline style), tự restore khi attr gỡ, không đụng `mountComprehensionPill` internals. PM set `--pm-anchor-bottom` trên documentElement theo chiều cao bottomBar+caption+band thực tế.
- Alt flow: pill không data → pill host tự unmount (existing store logic), band vẫn giữ CC + rail.
- Exception: PM enter khi pill chưa mount → CSS vẫn đúng khi pill mount sau (host-context match lúc render).
- Rules: cueRegion **không scroll** (REQ-10 — không scrollbar, không user scroll; vị trí card do system điều khiển theo active cue); band `pointer-events:none`, chỉ CC/pill/nút rail `auto` (không nuốt tap card bên dưới); z dưới ⋯ menu/sheets.
- Postcondition: manager reachable; pill căn giữa neo band; card cuối peek/fade dưới band.
- NFR refs: NFR-1, NFR-2

REQ-5: ⋯ overflow menu
- Actor: mobile learner
- Goal: mọi PM action còn lại reachable
- Preconditions: PM mobile mounted
- Basic flow:
  1. actor tap `pm-more-btn` → **`Sheet`** (SSOT bottom sheet, `data-cell-id="pm-more-menu"`) mở — không còn popup `Menu` (AC-22); bottom bar không có speed chip riêng (AC-23)
  2. items (có icon + label i18n, `data-cell-id` reuse khi có):
     - `panel-toggle-btn` behavior: "Ẩn/hiện danh sách cue" (tương đương `t` — session toggle)
     - `ocr-toggle-btn` (MenuItem selected state khi `ocrEnabled`)
     - study modes: MenuItem radio per mode (active mode checked) — vì mobile cueRegion không render StudyModeActionBar (REQ-7)
  3. footer sheet (ghim, không scroll) = **speed stepper** `Stepper` (`pm-speed-stepper`) `[-] [N×] [+]` đi qua ladder `PLAYBACK_SPEEDS` 0.25×–10×; `pm-speed-dec`/`pm-speed-inc` gọi `onPlaybackSpeedChange`; không có list radio tốc độ (AC-23)
  4. chọn → handler chạy, sheet đóng
- Alt flow: item không applicable → disabled/omitted nhất quán desktop.
- Exception: Esc/drag-handle/backdrop → Sheet tự đóng (có sẵn: escapeLayer + useSheet).
- Rules: chỉ `Sheet` + `MenuItem`/`MenuSeparator` + `Stepper` (shared SSOT); hai item list-toggle phân biệt rõ: "Ẩn danh sách cue" (session UI) vs active-mode "Hiện toàn bộ cue" (REQ-6 override) — label riêng; nhóm practice `off/dictation/cloze` **đã xoá** (duplicate study modes — AC-22); `toolsExpanded` prop không còn UI trên mobile (group bị giải thể — giữ trên desktop).
- Postcondition: 0 action mất.
- NFR refs: NFR-2, NFR-5

REQ-6: Cue display modes (list | active)
- Actor: mobile learner
- Goal: chọn mật độ đọc
- Preconditions: manager reachable từ PM
- Basic flow:
  1. actor chọn mode trong Subtitle Manager (row/select mới, i18n)
  2. system persist `PLAYER_MODE_CUE_DISPLAY` (`'list'|'active'`, default `'list'`) trong `chrome.storage.local`
  3. PM mobile đọc khi mount + subscribe `chrome.storage.onChanged` (scope key) → đổi live; `active` = chỉ current cue card auto-follow; `list` = CueList đầy đủ
- Alt flow: ⋯ item "Hiện toàn bộ cue" là session override (không ghi storage) — từ `active` xem tạm full list.
- Exception: không cues → EmptyState cả hai mode; `active` mode khi không có current cue (gap) → render next upcoming cue với style `upcoming` mờ; không có next → EmptyState compact.
- Rules: setting chỉ ảnh hưởng PM <600px; desktop/split-view đọc chung key nhưng không áp (hoặc design quyết áp cho split-view — non-goal); fab ẩn trong `active` mode (filter 1 card vô nghĩa).
- Postcondition: mode tôn trọng, live-update.
- NFR refs: NFR-4, NFR-5

REQ-7: Cue card visual + cueRegion chrome (mobile PM)
- Actor: mobile learner (view)
- Goal: cue = card theo mockup
- Preconditions: cueRegion render
- Basic flow: system render cue item card-style: `radius-2xl` + `surface`, `padding space-5/space-4`, target text prominent (`font-size-xl`/`semibold` active, `font-size-lg`/`medium` muted), native `font-size-base` secondary, footer **chỉ còn timestamp** `font-size-xs` (icons pin/layers trang trí đã xoá — AC-21); current cue emphasized **trong bounds** (AC-19): border giữ `hairline` + `--shadow-inset-selected` (vòng primary inset) + `surface-elevated` + `shadow-floating` — outer box không đổi; card kế sau peek nguyên opacity (fade chỉ do `mask-image` đáy scroll region). Video stage inset `space-3` + `radius-2xl` (mockup bo góc, không full-bleed).
- Alt flow: tokenize → token spans trong card giữ status colors.
- Exception: cue dài wrap, không clip.
- Rules: scoped variant (vd `SubtitlePanel` prop `barebones`/`data-cell-pm-mobile` trên `.panel`): mobile PM **không render** panel header (`subtitle-panel-header`) và `StudyModeActionBar`/`PracticeOptions` — chức năng chuyển vào ⋯ (REQ-5); split-view/desktop giữ chrome. Kích thước/cỡ chữ/radius bám mockup bằng tokens. Cue region **không scroll** (REQ-10).
- Postcondition: visual khớp `docs/mockups/player-mode-mobile-layout.png`.
- NFR refs: NFR-1, NFR-3

REQ-8: Orbital badge coexistence
- Actor: mobile learner
- Goal: orbital lookup dùng được trong PM mobile
- Preconditions: dictionaryPopup.enabled
- Basic flow: badge mount/render như ngoài PM; rail không che dead zone — cueRegion `padding-bottom` cho anchorRow + rail kết thúc trên anchorRow → badge vùng dưới tự do; snap preset hiện có.
- Exception: child iframe — badge chỉ tồn tại khi child fullscreen (`orbitalBadgeSync.ts:85`): REQ-8 no-op ở non-fullscreen child (badge vốn không mount); khi PM chạy fullscreen top-frame, badge top-frame cover viewport → OK.
- Rules: không sửa badge internals; rail chừa ≥ badge size + `--space-2` tính từ mép phải khi badge preset `right`.
- NFR refs: NFR-1

REQ-9: Dock removal on mobile
- Actor: mobile learner
- Goal: không dư thừa running text + nút
- Preconditions: <600px
- Basic flow: system không render `.dock` (navArea/subtitleArea/actionArea) trên mobile — thay bằng bottomBar+anchorRow+rail.
- Alt flow: ≥600px dock giữ nguyên.
- Exception: `practiceMode` short-height hide rule hiện có (`@media max-height:568px` hide dock) → mobile branch hide `bottomBar`+`anchorRow` tương đương.
- Rules: `overlay-player-action` id chuyển thành `pm-bottom-bar` (mobile) — C5 table bên dưới.
- Postcondition: bottomBar là transport surface duy nhất.
- NFR refs: NFR-1

REQ-10: Cue region no-scroll + icon system scale
- Actor: mobile learner (view)
- Goal: cueRegion không phải scroll surface; mọi icon-in-button theo thang kích cỡ hệ thống
- Preconditions: PM mobile mounted
- Basic flow:
  1. `pm-cue-region` = **non-scroll container**: `overflow-y:hidden`, `scrollbar-width:none`, `::-webkit-scrollbar{display:none}` — không scrollbar, không user scroll (wheel/touch/drag). Vị trí card do **system điều khiển** (active cue luôn trong vùng nhìn thấy — `active` mode 1 card, `list` mode render window quanh active + context; chuyển cue = re-render/translate, không phải scroll event của user).
  2. Icon-in-button scale (DS redesign — `iconbutton` tokens): icon = **~50–57% container**, ramp theo size — xs 28→16, sm 32→18, md 40→20, lg 48→24, xl 56→28 (M3/HIG alignment: M3 standard 24@40, FAB 56/24; HIG 44pt touch; DS trước flat 18px ở mọi size → sửa lại cho đúng thang).
- Alt flow: cue list cần duyệt dài → Subtitle Manager (full cue list) thay vì scroll trong PM.
- Exception: `list` mode render N context cards tràn vùng → clip bởi `overflow:hidden` + `mask-image` fade (peek giữ nguyên, không scroll được).
- Rules: nút icon dùng `iconbutton-size-md` (40px, hệ thống — ≥ WCAG 2.2 AA 24px); nút có chữ giữ `min-height: var(--touch-target)` (44px mobile); không còn hero `size xl` 64px.
- Postcondition: không scroll surface trong PM mobile; icon tỷ lệ đúng với container trên toàn hệ thống.
- NFR refs: NFR-1, NFR-3

REQ-11: Transport/manager icon glyphs — bare forms (user-approved cross-screen)
- Actor: mobile learner
- Goal: glyph trong nút tròn là bare icon (không vòng-tròn-trong-vòng-tròn), khớp mẫu
- Preconditions: REQ-10 icon scale live
- Basic flow: prev = `chevronLeft`, repeat = `rotateCcw` (↺ đơn — khớp mẫu, thay `navRepeat` double-arrow loop), hero = `play`/`pause` (thay `navPlay`/`navPause` circle-*), next = `chevronRight`, CC = `captions` (thay `subtitleManager`/library — khớp glyph CC trong mẫu).
- Rules: đổi **icon name tại call site**, không đổi `ICON_CATALOG` entry; user approved phạm vi cross-screen — screens khác dùng chung icon được phép đổi theo (deliver quyết định swap global hay chỉ PM call sites).
- Postcondition: mọi glyph bare, tỷ lệ theo REQ-10.

### data-cell-id contract (C5 branch-scoped)

| id | ≥600px PM | <600px PM |
|---|---|---|
| `player-mode-overlay`, `player-mode-split`, `player-mode-video-stage`, `player-mode-content` | giữ | giữ (content = cueRegion) |
| `nav-cluster`/`nav-main`/`nav-secondary` | giữ | `nav-cluster` trên transport group; main/secondary merge → 1 nhóm |
| `nav-prev/repeat/play/next/rewind/forward` | giữ | giữ (trên bar) |
| `overlay-player-action` (dock) | giữ | đổi → `pm-bottom-bar` |
| `player-mode-actions` | giữ | reuse cho floating rail (filter+generate) |
| `quick-add-btn`, `edit-card-btn` | giữ | giữ — trong active cue card (`pm-card-actions`) |
| `manager-toggle-btn`, `player-mode-exit-btn`, `generate-native-btn`, `panel-toggle-btn`, `ocr-toggle-btn`, `cue-filter-fab` | giữ | giữ (floating rail / anchorRow / ⋯ item) |
| `tools-toggle-btn`, `subtitle-tools-extra` | giữ | **dropped trên mobile** (group giải thể; items → card rail/rail/⋯) |
| `subtitle-panel-header`, `study-mode-bar`… | n/a | hidden trên PM mobile (component vẫn render ở split-view) |
| mới | — | `pm-bottom-bar`, `pm-anchor-band`, `pm-card-actions`, `pm-more-btn`, `pm-more-menu` (Sheet), `pm-fab-slot`, `pm-cue-active-card`, `pm-speed-stepper`, `pm-speed-value`, `pm-speed-dec`, `pm-speed-inc` |

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Nút icon = `--iconbutton-size-md` (40px, ≥ WCAG 2.2 AA 24px); nút chữ giữ `--touch-target-mobile` (44px); `env(safe-area-inset-bottom)` trên bottomBar | U | visual verify |
| NFR-2 | Contrast ≥4.5:1 cho text/icon trên `surface`/`overlay` bg; mọi nút dùng Button subtle-family — `*-subtle` nền + gốc thuần fg (primarySubtle/warningSubtle/errorSubtle/neutralSubtle) | U | token map |
| NFR-3 | Kích thước/radius/typography bám `docs/mockups/player-mode-mobile-layout.png`, dùng tokens | U | screenshot diff |
| NFR-4 | Không thêm listener layout/resize ngoài rAF hiện có; `chrome.storage.onChanged` subscription cho display mode được phép (scope key, cleanup on unmount) | P | audit |
| NFR-5 | i18n en+vi cho label mới; roles (menu/toolbar/separator) đúng | S | messages + a11y |
| NFR-6 | C5 ids preserved theo bảng branch-scoped trên | S | e2e/unit pass |

## Flows / States

```
PM mount ──► viewportW?
  ├─ ≥600 → desktop layout (unchanged)
  └─ <600 → mobile layout
        cues=0            → bar: exit | rewind | repeat | play | forward | ⋯ ; cueRegion EmptyState
        cues>0            → bar: exit | prev | repeat | play | next | ⋯
        cueDisplayMode    → list: CueList cards | active: single card (current|next-upcoming|empty)
        cueListOpen=false → cueRegion collapsed, videoStage flex:1 (video fills trừ anchorRow+bar)
        practiceMode≠off  → cueRegion = SubtitlePracticeSession (chrome hiện có, không CueList)
        Esc               → menu? close : cueListOpen? hide : exit PM
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| PM layout theo viewport | `<600px` branch trong `PlayerModeOverlay` + `playerModeGeometry` mobile constants |
| Transport/điều hướng cue | `pm-bottom-bar` (adaptive prev/next↔rewind/forward, hero play) |
| Contextual study actions | `pm-action-rail` (+ portal slot cho `cue-filter-fab`) |
| Truy cập action phụ | ⋯ `Menu` (shared/ui) |
| Mật độ cuelist | `PLAYER_MODE_CUE_DISPLAY` + toggle row trong `SubtitleManagerPanel` + render branch |
| Status surfaces | `pm-anchor-row` + pill `:host-context` reposition + `trackLabel` prop |
| Word lookup | orbital coexistence (layout guard, zero badge code) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `PLAYER_MODE_CUE_DISPLAY` | `'list' \| 'active'` default `'list'` | `chrome.storage.local` | persist |
| `playerModeContentPct` | number 20-60 | existing key | ≥600px only |
| `trackLabel` | string prop | derive từ manager state / `subtitleOverlayTargetLanguage` | session |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 | REQ-1, REQ-7 | AC-1, AC-7 |
| N2 | REQ-2 | AC-2, AC-3 |
| N3 | REQ-3 | AC-4 |
| N4 | REQ-4 | AC-5 |
| N5 | REQ-8 | AC-8 |
| N6 | REQ-5 | AC-6 |
| N6b | REQ-9 | AC-9 |
| N6c | REQ-6 | AC-10 |
| N7 | REQ-7 | AC-7, AC-11 |
| N8 | REQ-1 alt | AC-12 |
| N9 | C5 table | AC-13 |
| N10 | NFR-4 | AC-14 |
| N11 | REQ-10 | AC-15 |
| N12 | REQ-11 | AC-16 |
| N4 | REQ-4 | AC-17 |
| N3 | REQ-3 | AC-18 |
| N7 | REQ-7 | AC-19 |

| Journey step | REQ |
|---|---|
| TO-BE 1 | REQ-1 |
| TO-BE 2 | REQ-7 |
| TO-BE 3 | REQ-3/4/8 |
| TO-BE 4 | REQ-2/5 |
| TO-BE 5 | REQ-6 |
| TO-BE 6 | REQ-1 |

## Boundaries

- Always: tokens; `Menu` shared; shadow rules (composedPath, pushEscapeLayer); re-verify AC-6.3/6.4 (`subtitle-split-view-ac.md`).
- Ask first: đụng `subtitleSplitView.ts` logic; contract id đổi ngoài bảng C5 ở trên; dependency mới.
- Never: sửa `manifest.json`/extension key; hardcode px khi có token; comment code.

## Success Criteria

- [ ] AC-1: <600px PM render stack videoStage→cueRegion(flex:1)→anchorRow→bottomBar + actionRail mép phải; `player-mode-*` ids giữ.
- [ ] AC-2: bottomBar đúng thứ tự X|prev|repeat|play|next|speed-chip|⋯; mọi nút cùng box `md` (40px, `--iconbutton-size-md`); handler đúng; play = `primarySubtle` như các nút transport khác (không còn hero `warningSubtle` 64px).
- [ ] AC-3: cues=0 → prev/next render rewind/forward (`nav-rewind`/`nav-forward`); cues>0 → cue-nav.
- [ ] AC-4: quick-add + edit-card nằm **trong** active cue card (`pm-card-actions`, compact, không đè text); `player-mode-actions` = cột dọc cue-filter-fab + generate-native ở mép phải anchor band (filter trên, generate ngang hàng CC), đối xứng với CC trái; ordering khớp mockup vùng 3–6.
- [ ] AC-5: `pm-anchor-band` nổi đè đáy cueRegion (card cuối peek dưới band): `manager-toggle-btn` trái, pill **căn giữa** cả khi pill mount trễ; pill cao `--iconbutton-size-md` (40px) khớp hai nút đối xứng.
- [ ] AC-6: ⋯ (hoặc speed chip) mở `Sheet` (`pm-more-menu`); chứa toggle cuelist, OCR, study modes; rewind/forward KHÔNG nằm trong sheet; Esc/drag/backdrop đóng; đủ items = desktop action parity.
- [ ] AC-7: cue card mobile: radius/spacing/cỡ chữ match mockup; current emphasized; tokenize status colors hoạt động; panel header + action bar ẩn.
- [ ] AC-8: orbital badge hiển thị + drag/snap OK trong PM mobile (desktop+child-fs nuance giữ).
- [ ] AC-9: <600px không render `.dock`; ≥600px dock giữ nguyên.
- [ ] AC-10: display-mode trong Subtitle Manager persist + PM mobile live-update; `active` chỉ current cue (gap → next-upcoming dimmed; hết → EmptyState); fab ẩn trong active.
- [ ] AC-11: contrast AA; safe-area bottom; reduced-motion không animation mới.
- [ ] AC-12: ≥600px PM + overlay + split-view pixel/behavior giữ; AC-6.3/6.4 re-verify pass.
- [ ] AC-13: bảng C5 branch-scoped trên đúng 100% (giữ/dropped/reuse đúng cột).
- [ ] AC-14: không listener resize/layout mới; storage subscription cleanup on unmount; unit tests cho adaptive nav + display mode pass.
- [ ] AC-15: `pm-cue-region` không scroll (overflow hidden + no scrollbar + no user scroll); active cue luôn trong vùng nhìn thấy; peek clip dưới mask.
- [ ] AC-16: icon-in-button scale đúng token `iconbutton-icon-{xs,sm,md,lg,xl}` = 16/18/20/24/28; transport/CC glyphs bare (`chevronLeft`/`rotateCcw`/`play`/`pause`/`chevronRight`/`captions`).
- [ ] AC-17: `manager-toggle-btn` trong `pm-anchor-row` mở `subtitle-manager-layer` (ManagerLayer — Sheet mobile / panelLayer desktop) **khi PM đang active** — cả <600px và ≥600px; sheet render trên PM overlay (z cao hơn), `onClose`/backdrop/Esc đóng sheet mà không thoát PM.
- [ ] AC-18: mọi nút icon trong `pm-anchor-band` + `pm-bottom-bar` (`manager-toggle-btn`, `cue-filter-fab`, `generate-native-btn`, `player-mode-exit-btn`, transport, `pm-more-btn`) cùng box `--iconbutton-size-md` (40×40 — size hệ thống; ≥ WCAG 2.2 AA 24px); nút đáy của rail phải ngang trục giữa (vertical-center) với `manager-toggle-btn`, sai khác ≤1px; cột rail mép phải thẳng (right edges flush); badge `99+` của fab không làm đổi box nút (badge absolute); trục dọc (horizontal-center) của `manager-toggle-btn` trùng `player-mode-exit-btn` và trục dọc của cột rail (`generate-native-btn`/`cue-filter-fab`) trùng `pm-more-btn`, sai khác ≤1px.
- [ ] AC-20: `pm-anchor-band` **không render caption** `Subtitles: <label>` — không còn `pm-caption` trong DOM; `--pm-anchor-bottom` = bottomBar + band/2; prop `trackLabel` + fallback `subtitleOverlayTargetLanguage` gỡ khỏi overlay.
- [ ] AC-21: cue card mobile footer **chỉ có timestamp** — không render icon pin/layers (không còn `cardFooterIcons`).
- [ ] AC-22: `pm-more-btn` mở **`Sheet`** (`pm-more-menu`) chứ không phải popup `Menu`; sheet chứa panel-toggle/OCR/show-all/study modes; **không** còn nhóm practice `off/dictation/cloze` (`pm-practice-*` không tồn tại trong DOM).
- [ ] AC-23: bottom bar **không render** speed chip (`pm-speed-btn` không tồn tại trong DOM — tối giản); `pm-more-btn` mở `Sheet` có footer ghim `Stepper` (`pm-speed-stepper`) `[-] [N×] [+]` đi qua ladder `PLAYBACK_SPEEDS` (0.25×–10×), `pm-speed-dec`/`pm-speed-inc` gọi `onPlaybackSpeedChange`, disable ở hai đầu ladder; **không** có list radio tốc độ.
- [ ] AC-19: `pm-cue-active-card` giữ **cùng outer box** với context cue cards cùng content — emphasis render **bên trong** border box: border-width giữ `--border-width-hairline` (không tăng), stroke primary = `--shadow-inset-selected` (inset), nền `surface-elevated`, `shadow-floating` ngoài (không ảnh hưởng layout), typography đậm/lớn hơn. Verify: `getBoundingClientRect()` của active card vs card kề cùng nội dung → width/height bằng nhau; không card nào "phóng to" so với hàng xóm.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] design-system-guardian clean
- [ ] Real-browser verify <600px + screenshot vs `docs/mockups/player-mode-mobile-layout.png`
- [ ] AC-6.3/6.4 re-verify; `docs/2-architechture-system.md` updated

## Open Questions / Accepted Risks

- Vị trí display-mode toggle trong Manager UI (header row vs footer) → DESIGN.
- `trackLabel` format exact (track label vs "Target: en") → DESIGN.
- Landscape phone >600w giữ desktop branch — accepted (intent).
- Mockup gradient cam/tím → map `--color-primary` + tokens; contrast plan ở DESIGN.
