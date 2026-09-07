# MIGRATION — Cell Design System

> From / To / Action cho mọi breaking change (DESIGN.md §10.3). Mới nhất ở trên.

## 2026-09-08 — Toggle theo theme + Card Creator pane về surface

**Lý do:** `component.toggle` còn hardcode hex (`#275EFE` xanh dương, `#D1D6EE` xám-xanh) → bypass semantic layer, màu giống nhau ở mọi preset/mode. Card Creator pane trong Universal Panel dùng `surface-elevated`/`background` → ngả màu accent ở light mode trong khi Dictionary pane dùng `surface`.

### From / To

| Token / Rule | From | To |
|---|---|---|
| `toggle.default` | `#D1D6EE` (hardcode) | `var(--color-track)` |
| `toggle.hover` | `#CACFE6` | `color-mix(track + text 10%)` |
| `toggle.active` | `#275EFE` | `var(--color-primary)` — theo accent của preset |
| `toggle.dot` | `#fff` | `var(--color-surface)` — sáng ở light, tối ở dark |
| `toggle.dot-shadow` | `rgba(0,9,61,0.1)` | `var(--color-shadow)` |
| `button.fg` (primary fill) | `rgba(255,255,255,0.92)` — trắng cố định, mất contrast trên accent sáng ở dark | `var(--color-primary-foreground-soft)` |
| `CardCreatorPanel` bg | `var(--color-surface-elevated)` | `var(--color-surface)` |
| `.cc-dialog__body--panel` bg | `var(--color-background)` | `var(--color-surface)` |

## 2026-09-08 — L-BORDER: Borderless component system (spec-borderless-components)

| Token/Component | Cũ | Mới |
|---|---|---|
| `color-field` / `-hover` / `-active` | *(mới)* | `color-mix(text, transparent 93/89/84%)` — resting inset tone cho control trong card |
| `card.border` | `hairline solid --color-border` | `none` |
| `dialog.border` | `hairline solid --color-border` | `none` |
| `panel.border` / `popover.border` | `--color-border` | `transparent` |
| `button.solid-border` | `--color-border` | `transparent` — mọi solid button borderless |
| `input.border` / `alert.border` | `--color-border` | `transparent` |
| `input.bg` / `input.filled-bg` | `--color-surface` | `var(--color-field)` |
| `Select` default variant | `outline` | `filled` (borderless tonal); `variant="outline"` vẫn giữ viền |
| `Card.selected` | `border-color: primary` | `box-shadow: var(--shadow-inset-selected)` (ring, không reflow) |
| `Chip` filled variants | `border-color: <status>` | không border — bg+text đã mang tín hiệu |
| `MultiSelect.field/popChip/suggestions`, `Textarea`, `ShortcutInput`, `ColorInput`, `Checkbox/Radio .box` | `--color-border` outline | `--color-field` fill + transparent border |
| `Drawer` outer/side borders | `--color-border` | `none` + `--shadow-modal` |
| `cardHeader` (settings), `Accordion.item`, `Header`, `Drawer` header/footer hairline | `--color-border` | `--color-border-subtle` (separator) hoặc xóa (cardHeader) |
| `.hintText` tooltip | border + bg | `border: none` + `--shadow-popover` |
| `prefers-contrast: more` | — | thêm block trả `--color-border` cho input/select/checkbox/radio/multiselect |
| Feature sweep (~20 chỗ) | `hairline solid --color-border` | container/pill → `border: none` + tonal (`--color-field`/`--shadow-popover`); control → `--input-border` + `--color-field`; separator `border-top/bottom/left/right` → `--color-border-subtle` |

## 2026-09-08 — Token-dangling & hardcode sweep (audit: scripts/audit-dangling-vars.cjs)

| Điểm | Cũ | Mới |
|---|---|---|
| `components.css` `.btn--sm/.btn--lg` | `--button-padding-sm-x` *(không tồn tại → padding gãy)* | `--button-padding-x-sm/y-sm/x-lg/y-lg` |
| `NavItem .ripple` | `--button-liquid-ripple*` *(token đã xóa → ripple vô hình)* | `--button-ripple`/`--button-ripple-mid` *(token mới: text-mix tonal)* |
| `LanguageProfilePanel` | `--color-danger*`, `--z-index-popover` *(tên cũ)* | `--color-error*`, `--z-popover` |
| `DictionaryPopupSettingsPanel`, `WordBadgeSettingsPanel`, mockup-dict-popup | `--line-height-relaxed` *(không tồn tại)* | `--leading-relaxed` |
| `usePopupPosition`, `OrbitalBadge`, `ViewportFrame` | `--duration-200` *(không tồn tại)* | `--duration-normal` (=200ms) |
| `reader/App`, `TokenizedParagraph` | `var(--x, rgba(0,0,0,…))` fallback literal | token thuần (`--color-surface-hover`, `--color-border-subtle`) |
| `SubtitleText` bg | `rgb(0 0 0 / …)` | `rgb(var(--overlay-background-rgb) / …)` |
| `regionSelector.ts` (OCR overlay) | `#fff`, `rgba(0,0,0,…)`, `rgba(255,255,255,…)` | `STATIC_TOKENS` `--overlay-text(-rgb)`/`--overlay-background-rgb` |
| Showcase pages | `--color-primary-contrast`/`primary-fg`/`surface-2`/`surface-sunken` | `--color-primary-foreground`/`--color-surface`/`--color-field` |

**Giữ nguyên có chủ đích:** crash boundary `SubtitlePanels.tsx` (phải render khi theme hỏng), mock sites mô phỏng nền tảng ngoài, `contrast.ts`/`colorGenerator` (toán màu), `--sb-*`/`--subtitle-*`/`--cell-token-*` (runtime override có fallback), `--radius-m3-medium`/`--text-*`/`--font-sans` (chỉ trong showcase/demo).

### Action

- Component token không được hardcode hex; phải tham chiếu semantic token để resolve theo `[data-preset][data-theme]`.
- Pane ngang hàng trong cùng một tab dùng chung `var(--color-surface)`; `surface-elevated` chỉ dành cho lớp cần nổi lên (popover, card).

## 2026-09-08 — Dark canvas trung tính + loại Liquid Glass

**Lý do:** `docs/design-system/DESIGN_RATIONALE.md` (luật L-CANVAS, L-HOST, L-SCARCITY). Dark mode cũ nhuộm màu accent vào canvas → accent mất figural contrast.

### From / To

| Token | From (dark) | To (dark) |
|---|---|---|
| `core.dark.background` | `#0F1015` (violet cast) | `#0F0F0F` |
| `core.dark.surface` | `#181920` | `#212121` |
| `core.dark.border` | `#2E3038` | `#303030` |
| `core.dark.text` | `#F7F8F8` | `#F1F1F1` |
| `core.dark.textSecondary` | `#A9AFBF` | `#AAAAAA` |
| Preset dark canvas (dawn/forest/ocean/warmth) | bg/surface = primary ramp (`#0F202E`, `#0E241B`, `#0C1C25`, `#2E2218`…) | Canvas dùng chung: `#0F0F0F` / `#212121` / `#303030` / `#F1F1F1` / `#AAAAAA` |
| `color-background-elevated` / `-muted` (dark derived) | `color-mix(background + primary 3–4% + text)` | `color-mix(background + text 6–8%)` — bỏ accent khỏi canvas |
| `color-surface-elevated` / `-hover` / `-pressed` (dark derived) | `color-mix(surface + primary 4–6% + text)` | `color-mix(surface + text 6/10/14%)` |
| `color-border-subtle` / `-emphasized` (dark derived) | trộn primary 3–6% | `border, transparent 35%` / `surface + text 24%` |
| `color-primary-subtle` (dark) | alpha 0.15–0.18 | alpha 0.12 (tokens.json derived, preset derived, runtime `tokens.ts`) |
| `color-primary-foreground` / `-soft` (preset dark) | màu theo bg cũ | `#0F0F0F` / `rgba(15,15,15,0.92)` |

### Action

- Consumer dùng semantic token (`--color-surface`, `--color-background`…) → không cần đổi gì; giá trị tự thay sau regen.
- CSS/TSX hardcode hex dark cũ → thay bằng token; audit command DESIGN.md §7.
- Test snapshot giá trị hex → cập nhật snapshot.

### Trạng thái thực thi

- Đã đổi 4 preset + base sang dark canvas trung tính (`#0F0F0F` / `#212121` / `#303030` / `#F1F1F1` / `#AAAAAA`).
- Đã xóa 229 keys glass/liquid khỏi `tokens.json` và tái sinh `tokens.css`.
- Đã migrate toàn bộ `src/` (Button, Card, Input, Surface, subtitle panels, launcher dashboard, showcase) sang solid surface chuẩn.
- Đã xóa `ButtonGlassFilter.ts` và loại bỏ hoàn toàn `backdrop-filter` khỏi codebase.
- Tất cả production code TS/TSX/CSS: 0 references glass/liquid.
