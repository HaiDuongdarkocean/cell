# Foundation — Color

> Luật WHY: `why/philosophy.md` (L-CANVAS, L-SCARCITY, L-STATUS, L-TINTS, L-TEXT, L-HOST).
> Giá trị: `tokens.json`. File này chỉ ghi *vai trò — khi nào dùng — không dùng khi*.

## Surface ladder (hierarchy đi bằng lightness, không bằng màu)

| Token | Vai trò |
|---|---|
| `--color-background` | Page/window background |
| `--color-surface` | Card, panel, container chính |
| `--color-field` | Control nằm trong card — resting inset, borderless |
| `--color-field-hover` / `--color-field-active` | Hover / pressed trên field |
| `--color-field-hover-solid` | **Nền panel nổi** (dropdown) — đục hoàn toàn; token trong suốt làm nền sẽ xuyên thấy content sau |
| `--color-surface-elevated` | Popover, dropdown, tooltip, elevated card (= popup bg) |
| `--color-surface-hover` / `--color-surface-pressed` | Hover / pressed trên surface |
| `--color-background-muted` | Section background nhẹ |

**Hai surface kề nhau không bao giờ cùng giá trị** — card và parent không cùng màu.

## Alpha-wash cheat sheet (bẫy trong suốt)

`field*`, `overlay-*`, `*-subtle`, `*-hover` có formula chứa `transparent` → **alpha washes**, lớp dưới xuyên qua. `surface*`/`*-solid`/`*-elevated` = đục. Check `tokens.json` nếu nghi ngờ.

| Intent | Dùng | Không bao giờ |
|---|---|---|
| Page/dialog base | `background` / `surface-elevated` | `surface-hover`, `muted` |
| Resting control trên surface | `surface` | `surface-elevated` (nhìn như pre-hovered), `field` (trong suốt) |
| Hover/pressed control đó | `surface-hover` / `surface-pressed` | `field-hover`, `overlay-hover` (alpha washes) |
| Translucent input fill | `field` / `field-hover` / `field-active` | làm nền panel **nổi** |
| Floating panel | `surface-elevated`, `field-solid`, `field-hover-solid` | `field`, `field-hover`, `overlay-hover` (xuyên thấy) |
| Quiet fill (skeleton, code, checkbox-off) | `muted` | — |
| Scrim sau modal | `overlay` | `overlay-hover` (là wash, không phải scrim) |
| Border | `border` / `border-subtle` / `border-emphasized` | `input` (alias), `border-inverse` |
| Divider | `divider` | `border-subtle` (biến mất trên elevated) |

## Text ladder

`text` (phải đọc) → `text-secondary` (metadata) → `text-tertiary` (placeholder/disabled, cố ý không đạt AA) · `text-inverse` (nền đậm) · `text-on-primary` (canonical trên accent) · `text-accent` (link/inline accent).
`--color-primary-foreground` = alias cũ của `text-on-primary` → migrate.

## Status bindings (non-negotiable — L-STATUS)

`error` đã hỏng · `destructive`(=error) không hoàn tác · `warning` cứu được · `success` hoàn thành · `info`(=primary) trung lập. Chỉ `-subtle` (nền nhạt) / `-muted` (nền trung) / `on-*` (nội dung trên nền status). Kèm icon+text — màu không bao giờ là kênh duy nhất.

## Tints

9 nhóm `color-tint-*` (background/border/icon/text) — mã hóa **category** (tag, loại từ), quy mô nhỏ. Không mang nghĩa status, không làm surface lớn.

## State recipes (một state = một tín hiệu)

```css
:hover          { background: var(--color-surface-hover); opacity: var(--opacity-hover); }  /* 0.9, sẵn trong Card.interactive */
.selected       { background: var(--color-primary-subtle); color: var(--color-primary); }
:focus-visible  { box-shadow: var(--shadow-focus); }
.disabled       { opacity: 0.5; pointer-events: none; }
/* CẤM: var(--color-accent) cho hover — dùng surface-hover */
```

Control có hover token riêng (`--button-*`, `--input-*`) giữ token đó, không đè opacity.

## Accent budget (L-SCARCITY)

- ≤1 primary action + ≤1 focus ring + ≤1 accent surface cùng lúc.
- Accent chỉ cho state thật (selected/focus/active/destructive) — **không decoration**; chrome trang trí (chevron, divider) không bao giờ mang accent.
- Nested focusable: element sâu nhất giữ ring, parent release.

## Dark theme (L-HOST)

- Canvas dark = charcoal trung tính `#0F0F0F/#212121/#272727/#303030/#F1F1F1/#AAAAAA` — KHÔNG nhuộm accent.
- `text-accent` có thể khác primary ở dark để giữ contrast.
- Shadow light-theme alpha (<10%) vô hình trên dark → dark `shadow-popover/modal/floating` cần ≥30–50% black + optional 1px light inset ring.
- Text dark: body ≥400, control ≥500 (halation).

## Contrast — công thức đo (WCAG 2.x, không "cảm giác")

Relative luminance + contrast ratio:

```
RsRGB = c/255;  R = RsRGB ≤ 0.04045 ? RsRGB/12.92 : ((RsRGB+0.055)/1.055)^2.4
L = 0.2126·R + 0.7152·G + 0.0722·B
Contrast C = (L₁ + 0.05) / (L₂ + 0.05)    (L₁ ≥ L₂)
```

**Ngưỡng (AA):**

| Cặp | Min C | Vì sao |
|---|---|---|
| Text vs nền | 4.5 | WCAG 1.4.3 |
| Large text (≥18px / 14 semibold) | 3.0 | WCAG 1.4.3 |
| Control boundary / state indicator vs kề | 3.0 | WCAG 1.4.11 — selected thumb, focus ring, field edge |
| Icon có nghĩa vs nền | 3.0 | 1.4.11 |

**Alpha washes** (`field`, `*-hover`, `overlay-*`): composite lên nền dưới trước khi đo — `C' = α·fg + (1−α)·bg` per channel. Không bao giờ đo raw `rgba(...0.14)` với nền trắng giả định — đo trên surface thật.

**Harmony ≠ contrast:** controls cùng rail/family phải **cùng lightness bucket** — |ΔL| ≤ ~0.05 sau composite (đo `L` của từng fill). Trộn 0.97-track với 0.86-field trên 1 cột = phối màu lỗi dù cả hai là token. Contrast rules lo *đọc được*; harmony rule lo *cùng loài*.

## Anti-patterns

- Màu làm kênh duy nhất truyền status (thiếu icon/text).
- `surface-elevated` làm nền row trong list (= popup bg, nhìn như pre-hover).
- Border-subtle làm divider trên popover (biến mất — dùng `divider`).
- `warning`/`error` để decorate hoặc "cho nổi".
- Preset đổi canvas — preset chỉ đổi accent family + text hue.
