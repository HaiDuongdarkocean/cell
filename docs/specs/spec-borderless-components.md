# Spec — Borderless Component System (L-BORDER)

> Nguồn intent: `docs/intent/borderless-components.md` (8-field frame, autonomous elicitation 2026-09-08).
> Luật mới sẽ ghi vào `DESIGN_RATIONALE.md` tên **L-BORDER**: *"Viền là tín hiệu, không phải ranh giới mặc định."*

## 1. Objective

Chuyển Cell sang hệ component **borderless-by-default**: hierarchy do **tonal ladder + spacing + shadow-chỉ-cho-floating** gánh; `border` chỉ tồn tại khi nó *mang thông tin*.

### Công thức màu 3 lớp (trả lời "background thế nào, card ra sao, item thế nào")

| Lớp | Token | Light | Dark | Vai trò |
|---|---|---|---|---|
| Canvas | `--color-background` | `#F9F9F7` | `#0F0F0F` | Nền trang/dialog — trầm nhất |
| Card / panel | `--color-surface` | `#FFFFFF` | `#212121` | Container nội dung — nổi lên bằng bậc sáng, KHÔNG viền |
| **Item / field (MỚI)** | `--color-field` | text@7% → `#EEEDEA`-ish | text@7% → `#2E2E2E`-ish | Control nằm trong card: input, select, tonal row |
| Item hover | `--color-field-hover` | text@11% | text@11% | Hover trên field |
| Item active | `--color-field-active` | text@15% | text@15% | Pressed/trạng thái giữ |
| Floating | `--color-surface-elevated` + `--shadow-floating` | giữ nguyên | giữ nguyên | Popover/menu/dialog — tách bằng shadow, không viền |

`color-field*` dùng `color-mix(in srgb, var(--color-text), transparent X%)` — trung tính, tự đảo theo mode (text lật trắng/đen), không phụ thuộc accent → không phá preset, tuân L-CANVAS.

## 2. Luật ngoại lệ — khi nào viền ĐƯỢC tồn tại

| Loại | Ví dụ | Lý do |
|---|---|---|
| `outline` variant | `Button variant="outline"`, `Input variant="outline"`, `Badge variant="outline"` | Opt-in có chủ đích — viền *là* định nghĩa của variant |
| State signal | `focus` (`--color-border-focus` / `--shadow-focus`), `error`, `success`, `selected` | Border mang thông tin trạng thái |
| Drag affordance | `DragHandle`, resize grip, drop-zone khi đang drag | Viền = affordance vật lý |
| Separator cấu trúc | `SettingsRow divider`, `cardHeader` divider, sidebar edge | "Đường kẻ phân cách", không phải khung bao — dùng `--color-border-subtle` hairline |
| Accessibility mode | `prefers-contrast: more`, `forced-colors` | Trả border/ouline cho control theo WCAG |

Mọi `border` khác = vi phạm → chuyển sang tonal (`--color-field*` / surface ladder) hoặc xóa.

## 3. Thay đổi token (`src/shared/styles/tokens.json`)

### 3.1 Derived mới (cả light + dark, cùng công thức)

```json
"color-field":        "color-mix(in srgb, var(--color-text), transparent 93%)",
"color-field-hover":  "color-mix(in srgb, var(--color-text), transparent 89%)",
"color-field-active": "color-mix(in srgb, var(--color-text), transparent 84%)"
```

Vị trí trong ladder: `surface < field(7%) < surface-hover(10%) < surface-pressed(14%)` (dark) — field là nấc "resting inset" thấp nhất sau surface.

### 3.2 Component token flips

| Token | From | To |
|---|---|---|
| `card.border` | `hairline solid var(--color-border)` | `none` |
| `dialog.border` | `hairline solid var(--color-border)` | `none` |
| `popover.border` | `var(--color-border)` | `none` |
| `panel.border` | `var(--color-border)` | `none` |
| `button.solid-border` | `var(--color-border)` | `transparent` |
| `input.border` | `var(--color-border)` | `transparent` |
| `input.bg` | `var(--color-surface)` | `var(--color-field)` |
| `input.filled-bg` | `var(--color-surface)` | `var(--color-field)` |
| `input.outline-*` | giữ nguyên | giữ nguyên (ngoại lệ) |
| `alert.border` | `var(--color-border)` | `none` — alert đã có status-subtle bg + left accent |

Giữ nguyên: `button.outline-border`, `badge.outline-border`, `input.error/success-border`, `border-focus`, `border-emphasized` (dùng cho outline/hover-outline), mọi `*-divider`/`separator`.

## 4. Thay đổi component (`src/shared/ui/`)

| File | Sửa |
|---|---|
| `Card.module.css` | `.card` → `border: none`; `.interactive:hover` bỏ `border-color`, giữ surface-hover + shadow; `.selected` → không border, dùng `box-shadow: 0 0 0 var(--border-width-thick) var(--color-primary)` ring + `primary-subtle` bg (state ring = ngoại lệ hợp lệ, không đổi box-size) |
| `Input.module.css` | `.input` border-color → transparent (giữ width — không reflow); hover → `background: var(--color-field-hover)` thay vì border-emphasized; focus giữ ring + `border-color: var(--input-border-focus)` (state); bỏ `inset inner-highlight` khỏi filled/focus (artefact của kỷ nguyên stroke) |
| `Select.module.css` | `triggerFilled` → `background: var(--color-field)`, `border-color: transparent`; hover → `field-hover`; `.menu` bỏ border (popover = shadow); **default variant** đổi `outline` → `filled` trong `Select.tsx` |
| `SearchableSelect.module.css`, `MultiSelect.module.css`, `Textarea.module.css`, `SearchField.module.css`, `ShortcutInput.module.css`, `ColorInput.module.css` | Cùng công thức: trigger/field = `color-field` + border transparent; menu = shadow-only; state borders giữ |
| `Chip.module.css`, `Kbd.module.css`, `Badge.module.css` (non-outline), `Tabs.module.css`, `Accordion.module.css`, `NavItem.module.css`, `Tree.module.css`, `Avatar.module.css`, `Slider.module.css`, `CopyButton`, `CloseButton`, `PinButton`, `BackButton`, `CollapseButton`, `MaximizeButton`, `MinimizeButton`, `InfoButton`, `HintIcon` | Bỏ default outline; giữ variant outline/state/focus |
| `DragHandle.module.css` | **Giữ** — ngoại lệ affordance |
| `Separator.module.css` | Giữ — bản chất là separator |

### Settings card recipe (reference implementation)

`src/features/settings/ui/SettingsDialog.module.css`:
- `.sectionCard` — Card giờ borderless qua `--card-border: none`; giữ `overflow:hidden` + radius.
- `.cardHeader` — **bỏ** `border-bottom` hairline → title+desc tách body bằng spacing (Gestalt proximity).
- `.childField` — rail `border-left` đổi `border-subtle` → giữ (hierarchy marker, không phải khung bao). Cân nhắc: giữ.
- `SettingsRow.divider` — giữ như separator ngoại lệ; không thêm divider mới.
- Control trong card (Select/Input/Toggle) → tự động `color-field` từ bước component.

## 5. Cơ chế không-reflow

Bỏ viền **không** đổi `border-width` thành `0` ở chỗ đang có `border: <w> solid <c>` → thay `border-color: transparent` hoặc `border: none` tùy context; nơi layout phụ thuộc 1px (hiếm) giữ width + transparent. State borders (focus/error) vẫn cần width sẵn → giữ `border: hairline solid transparent` ở base để state chỉ đổi màu, không reflow.

## 6. Boundaries

- KHÔNG đụng `forced-colors`/`prefers-contrast` blocks (chúng phải giữ/trả viền).
- KHÔNG sweep feature-level hairline ở phase này (universal-panel dividers, dictionary popup header, cardCreator FieldRow, LanguageProfilePanel…). Danh sách follow-up trong §8.
- KHÔNG đổi domain tokens (`token-freq`, `token-status`, `chip-status` theme-invariant).
- KHÔNG glass/blur/backdrop-filter.

## 7. Testing strategy

- `node scripts/generate-tokens.js` → diff `tokens.css` sạch.
- `npx tsc --noEmit` = 0.
- Jest focused: Button, Card, Input, Select, SearchableSelect, MultiSelect, Textarea, Chip, SettingsRow, FieldRow, CardCreatorPanel, DictionaryPanelView.
- Style guards hiện có (Button.style-guard …) phải pass — cập nhật guard nếu nó assert border cũ.
- Visual: showcase `redesign-in-showcase` so sánh light/dark × 4 preset.

## 8. Follow-up sweep (out of MVP)

Danh sách file feature-level còn hairline sau phase này (grep `border.*--color-border`): universalPanel dividers/bottom-nav, dictionaryPopup header/cells, cardCreator FieldRow trigger, LanguageProfilePanel, SubtitleOffsetPanel, tokenize spans… Chuyển dần theo nguyên tắc: pane-separator → `border-subtle` hoặc tonal step; item outline → xóa.

## 9. Success criteria

- [ ] `tokens.css` regenerate: `--card-border: none`, `--input-border: transparent`, `--color-field*` có mặt ở mọi theme block.
- [ ] Settings dialog: card không khung, header không hairline, control trong card hiện tonal field.
- [ ] Select mặc định render không viền (filled tonal); `variant="outline"` vẫn có viền.
- [ ] Focus/error/success vẫn hiển thị rõ (ring/border state).
- [ ] `prefers-contrast: more` trả viền cho control.
- [ ] tsc + focused tests + build xanh.
- [ ] `MIGRATION.md` + `DESIGN_RATIONALE.md` (L-BORDER) + `STANDARD.md` (surface ladder §3.2) cập nhật.

## 10. Open questions → resolved (autonomous)

| Câu hỏi | Quyết định | Cờ rủi ro |
|---|---|---|
| Xóa luôn separator trong list? | Giữ `border-subtle` hairline làm ngoại lệ — mất hẳn sẽ giảm scannability cho user 5–80 tuổi | Nếu user muốn tuyệt đối borderless, sweep tiếp dễ dàng |
| Field tone 7% có đủ thấy trên card trắng? | Đủ cho "resting" (iOS quaternary/systemFill ≈ 8–20%); hover nhảy 11%, active 15% | Nếu showcase cho thấy quá mờ → nâng 93→90 |
| Select default đổi outline→filled có phá call site? | Có chủ đích — đó là migration; site nào cần viền set explicit `variant="outline"` | Review visual settings panel |
