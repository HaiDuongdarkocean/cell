---
name: visual-reference-design
description: "Reconstruct a UI faithfully from an image or verbal reference by decomposing it as a designer before mapping to the design system. Use when user supplies a screenshot/mockup/reference to match. Not for audits without a target or single-icon work."
---

# Visual Reference → Design System Reconstruction

> **Decompose like a designer first. Map to the component system second. Never the other way around.**

Lỗi chết người: nhìn ảnh rồi gán component có sẵn ("nút này = Button lg"). Đúng: phân rã atoms → component → layout → đo → color rule → icon semantics — rồi mới hỏi design system đáp ứng được gì.

## When to Use

- User đưa ảnh/screenshot/mockup và nói "làm giống cái này", "redesign theo hình", "y hệt mẫu"
- User mô tả màn hình/component bằng lời và kỳ vọng output đầy đủ như designer thật
- Render đã chạy nhưng user feedback "không giống mẫu" — audit theo reference

**When NOT to use:** không reference và intent mơ hồ → `pipeline-analyze`/`interview-me`; audit UI không có target → `audit-ui-ux-then-redesign`; icon đơn lẻ → `design-svg`.

## Core Laws

1. **Đo bằng pixel, không đoán bằng mắt.** Mọi dimension phải được đo trên ảnh vật lý rồi chia device scale trước khi chọn token.
2. **Semantics trước syntax.** "Element này là gì" trả lời bằng chức năng + hành vi + ý nghĩa visual — không bằng tag HTML.
3. **DS là lựa chọn cuối.** Biết element cần gì rồi mới quyết reuse / extend / create; DS thiếu thì mở rộng DS, không hack local.
4. **Reference là 1 frame tĩnh — product phải đầy đủ state.** Ảnh chỉ show idle; hover/pressed/focus/disabled/loading/empty/error vẫn phải được thiết kế hoặc ghi vào deviation list. Không có state nào "được miễn" mà không ghi lý do.
5. **Khi buộc lệch, hy sinh theo thứ tự:** decoration → color exact → size absolute. Giữ đến cùng: hierarchy, proportion, semantics.

## Pipeline

```text
0. INGEST → 1. DECOMPOSE → 2. COMPOSE → 3. PLACE → 4. SIZE&TYPE → 5. COLOR → 6. ICON → 7. RECONSTRUCT → 8. VERIFY
```

Mỗi stage có output bắt buộc. Fidelity thất bại gần như luôn do skip stage — debug = quay về stage sở hữu lỗi, không vá chỗ khác.

### 0 — INGEST: input mode

**Ảnh** → đọc trực tiếp. Ghi:
- `scale = px ảnh ÷ logical viewport`. Không biết viewport → calibrate qua element có kích thước chuẩn (cap-height, control 40-44px). Scale không rơi vào DPR chuẩn (1/1.5/2/3) → flag "ảnh có thể bị crop/zoom" trước khi tin mọi đo.
- Platform cues + **fixed vs fluid**: dimension nào viewport-derived, dimension nào cố định.
- Annotation marks (số đỏ, callout) — chúng che glyph; crop vùng khác để đo.
- **Frame có đang ở non-idle state không?** (nút pressed, tooltip mở, focus ring lộ) → ghi lại là *bằng chứng của state đó*, không đọc như idle.

**Lời nói** → suy luận từ intent: entity hiển thị, density (đọc-first? control-first?), hierarchy. Output contract của words-mode = **full variant matrix** (mọi size × variant × state của component class), không phải 1 instance agent tưởng tượng. Mơ hồ sau suy luận → hỏi 1 câu focused.

### 1 — DECOMPOSE: atom inventory

Quét reference trên→dưới, trái→phải. Mỗi vùng → 1 dòng:

| Atom | Loại | Quan sát |
|---|---|---|
| vùng nội dung lớn | surface | bo góc, inset, tỷ lệ khung |
| nút tròn đè mép card | control | glyph trong, floating |

Phân biệt 3 lớp cho mỗi element: **painted surface** (vùng màu thấy được), **hit target** (vùng chạm — lớn hơn, suy ra từ spacing, ≥40px — `--touch-target`), **decoration** (border/shadow/fade). Reference chỉ show painted — hit target phải suy.

Ghi thêm per element: **state ngụ ý** (ảnh không show hover/disabled — nhưng chúng tồn tại), elevation bóng đổ, glyph style (outline/fill/stroke).

**Trap:** element đè nội dung → ghi "đè lên X", không ghi "nằm sau X".

**Output:** atom inventory — mọi pixel thuộc về một atom.

### 2 — COMPOSE: atoms → components

Group theo: khoảng cách, alignment, containment, hành vi chung (scroll cùng? nổi cố định?). Per component trả lời:

- **Chức năng + hành vi** (điều hướng? toggle? action phụ? status?)
- **Loại UI** (bar / FAB / card / chip / segmented / menu trigger)
- **Quan hệ sibling** (đối xứng với cái gì? cùng visual weight → cùng variant; khác weight = có chủ đích, đừng ép đồng nhất)
- **DS có chưa?** → grep shared UI + showcase (repo này: `src/shared/ui/`) trước khi kết luận tạo mới.

**Output:** component tree, mỗi node = loại + DS candidate.

### 3 — PLACE: layout tree

Per vùng quyết định:

- **Flow vs absolute/floating** — đè lên content → floating sibling, không nằm trong flow scroll container.
- **Z-order** — cái gì trên cái gì.
- **Alignment thật** — "giữa" = giữa container (`left:50%`) hay giữa khoảng trống giữa 2 sibling bất đối xứng (flex)?
- **Che khuất — 3 cơ chế khác nhau:** `mask-image` trên scroll content (fade theo vùng viewport) · gradient overlay trên band (che vùng cố định) · `opacity` trên item (mờ cả item). Chọn sai = che sai chỗ.
- **Scroll intent** — region scroll không? "Không scrollbar" ≠ "không scroll": scroll-ẩn-bar = `overflow:auto` + `scrollbar-width:none` + `::-webkit-scrollbar{display:none}`; không scroll = `overflow:hidden` + vị trí do system điều khiển.

**Output:** layout tree ghi flow/absolute/z-index/mask/scroll.

### 4 — SIZE & TYPE: đo → snap

1. **Crop** vùng bằng canvas sub-rect (`page.evaluate` + `drawImage` → PNG phóng 2×), lưu vào dir đọc được (repo này: `tmp/<task>/`; nếu `read` từ chối path ignored → `docs/mockups/`). KHÔNG scan 1 dòng pixel — annotation/border làm nhiễu.
2. Đo **painted surface** trên px vật lý → chia scale → logical px.
3. **Snap vào thang DS** (size/spacing/radius/border-width/zIndex/blur — repo này: `iconbutton-size-*`, `button-height-*`, `space-*`, `radius-*`): lệch ≤2px → token gần nhất; lệch lớn → snap gần nhất **và** ghi deviation list. Thêm bậc token mới = cần lý do reuse + user-visible note — không lặng expand thang.
4. **Icon-in-button:** icon ≈ 45–55% container, ramp theo size. DS giữ 1 icon px cho mọi size = bug DS — sửa token gốc, không override local.
5. **Type:** đo cap-height → font-size; line-height như ratio của size; weight, letter-spacing, truncation — snap vào type ramp, không px rời.
6. **Proportion > absolute:** khi token buộc lệch, giữ *tỷ lệ giữa elements* và *nhịp spacing lặp lại* (cùng gap xuất hiện nhiều lần = một nhịp). Màn giữ đúng rhythm đọc là khớp dù size snap lệch.
7. **Hit target** ≥40px (`--touch-target`) — tách khỏi visible size trong bảng.

**Output:** bảng `element → px đo → logical → token → hit target` + type table + elevation map (`shadow-*`/`elevation=`; floating không có shadow spec = defect).

### 5 — COLOR: sample → rule → semantic

1. Sample pixel tại tâm element (tránh edge AA): RGB của bg + fg.
2. Xác định **hue family** của pair (cùng hue khác sáng? 2 hue khác? fg neutral?)
3. Suy ra **rule phát biểu được** — vd "bg = tint của semantic gốc, fg = gốc nguyên màu". Rule không nói được bằng token pair → chưa đủ DS.
4. Map theo **semantics** (primary/destructive/neutral/status), không theo "màu nhìn giống" — violet trong ảnh ≠ token purple nếu semantic là primary.
5. **Contrast** fg/bg ≥4.5:1 text, ≥3:1 icon — check cả light theme bằng render, không giả định.
6. Alpha vs opaque: token `*-subtle`/`tint-*` là alpha (đổi theo nền dưới) — trên gradient/mask phải tính layer dưới.

**Trap:** control nặng hơn mẫu → re-check painted-vs-hit (stage 1) — reference ghost trần, đừng default filled. Màu "muddy" → đang mix opaque khi cần alpha tint.

**Output:** color map `component → bg+fg token → rule → contrast` + 1 câu rule tổng.

### 6 — ICON: glyph → semantics → collision

Per icon trong reference:

1. **Đọc glyph** (crop phóng to nếu bị che): shape thật + **style** (outline/fill/stroke-width) — reference fill mà map sang outline = fail âm thầm.
2. **Semantics từ glyph + vị trí** — glyph nói khác vị trí thì theo glyph (↺ = repeat chứ không phải prev); vị trí transport cluster → previous/replay/captions…
3. **Catalog lookup** — grep icon catalog (repo này: `ICON_CATALOG` ở `src/shared/icons/index.ts`) theo name + tags; ưu tiên glyph đã có.
4. **Collision check — bắt buộc:** glyph định dùng đã gắn function khác trong app chưa? Hai function không share một glyph gây nhầm → chọn khác hoặc đổi call-site-scoped, ghi quyết định.
5. **Circle-in-circle:** glyph có viền tròn trong nút tròn = double ring → bare variant.
6. **Paired states:** toggle icon cần cặp (play↔pause, eye↔eyeOff, pin↔pinOff) — enumerate cả hai.
7. Thiếu glyph → `design-svg` tạo theo convention + đăng catalog — không inline SVG path. Đổi glyph dùng chung toàn app = cần user approve; call-site swap = không.

**Output:** icon table `position → glyph+style → semantics → catalog name → collision → quyết định`.

### 7 — RECONSTRUCT: dựng bằng DS

- Shared component trước; variant thiếu → thêm vào component + showcase + guard test — không CSS màu local. CSS local chỉ chứa layout.
- **Choice list/menu → component Menu có sẵn** (repo này: `<Menu>`/`<MenuItem>`); shadow-mounted surface → theo shadow-DOM rules của repo (composedPath, getRootNode, escapeLayer).
- Giữ DOM contract: test hooks (`data-*`), handlers, a11y labels. Icon-only control → label decision bắt buộc.
- Label-bearing component → note hành vi locale dài (wrap/truncate/collapse) — i18n +30% không vỡ.
- Data-bearing region → map empty + loading + error (`EmptyState`/`Skeleton`/`Spinner` + Alert).

### 8 — VERIFY: pixel-compare + state sweep

1. Render đúng viewport + scale tương đương reference.
2. **Crop cùng vùng trên cả reference lẫn render** (bar, band, card…) — so cặp, không eyeball full shot.
3. Checklist: số element · thứ tự · vị trí tương đối · **tỷ lệ size giữa elements trong tolerance ≤2px token** · glyph shape+style · hue+độ đậm · spacing nhịp. "Trông proportional" không phải pass — pass = nằm trong tolerance của size table.
4. **State sweep — bắt buộc:** screenshot mỗi interactive element ở hover / `:focus-visible` / `:active` / disabled / loading. Words-mode (không có ảnh gốc) → render full variant×state matrix, so với showcase + canonical in-app instance.
5. Theme sweep: dark + light; nếu dùng `*-subtle`/`tint-*` → thêm 1 preset theme.
6. DOM rect/computed style **không đủ** — đúng box vẫn có thể không paint. Luôn nhìn ảnh.

Lệch → quay về stage sở hữu (size→4, icon→6, fade→3, state→RECONSTRUCT).

**Trap:** spec/doc mâu thuẫn với đo được → flag deviation + hỏi, đừng âm thầm theo doc cũ.

## Output contract

Trước khi code/approval:

- Atom inventory · component tree + layout annotations · size table (px→token→hit target) · type table · elevation map
- **State matrix** — mỗi component: idle/hover/pressed/focus/disabled/loading/active-toggle/error → variant/token, hoặc "N/A + lý do"
- **Motion spec** — per interactive element: transition = `duration-*` + `ease-*` hoặc "component default"; focus order + Escape layer cho overlay
- Color map + icon table (collision verdict)
- **Viewport behavior**: fixed | fluid | breakpoint X | explicitly out-of-scope — non-goal phải declared, silence không được
- **Deviation list** — mọi lệch có lý do + mức (token snap ≤2px | DS gap | user choice)
- Evidence: render + crops đối chiếu + state sweep shots

## Relationship to pipeline

Feed `pipeline-design` (component-mapping doc) → `pipeline-deliver`. Icon mới → `design-svg`; audit không có target → `audit-ui-ux-then-redesign`; post-reconstruct audit → `design-system-guardian`; model không đọc được ảnh → `vision-reader` subagent.

*Task đổi hoặc không rõ skill nào phù hợp? Re-route qua `using-agent-skills`.*
