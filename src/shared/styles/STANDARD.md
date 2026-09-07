# Cell Design System Standard

> Foundation contract cho toàn bộ UI của Cell.
> Mọi component, token, icon, layout phải tuân theo document này.
> Source of truth: `src/shared/styles/tokens.json` (giá trị) + document này (nguyên tắc, vai trò, naming, kiểm tra).

---

## 0. Quiet confidence — bản sắc foundation

Cell hướng đến **quiet confidence**: calm, focused, learnable, điềm đạm, có hứng thú học tập, đơn giản, thanh lịch.

Các nguyên tắc áp dụng cho mọi quyết định UI:

1. **Neutral-first, single accent as punctuation.** Palette trung tính làm chủ đạo; accent (`--color-primary`) chỉ dùng để nhấn hành động chính, focus, brand.
2. **Surface lift tạo hierarchy.** Dùng surface-elevated, subtle border, và shadow nhỏ thay vì nhiều màu.
3. **Content-first.** Thông tin và hành động người dùng cần là trung tâm; UI không chen ngang.
4. **Clarity through restraint.** Ít scale, ít variant, ít tùy chọn hơn; mỗi token phải có vai trò rõ ràng.
5. **Accessible by default.** WCAG 2.2 AA là rào cản tối thiểu, không phải tùy chọn.
6. **Responsive, không re-layout.** Giao diện thích ứng kích thước màn hình và mật độ, không phụ thuộc thiết bị cụ thể.

---

## 1. SSOT map

| Câu hỏi | Đọc | Không đọc giá trị số ở đây |
|---|---|---|
| Tại sao quyết định như vậy | `docs/adr/084-090` | `design-system-from-scratch-loop.md` (tài liệu học tập chung) |
| Giá trị token hiện tại | `src/shared/styles/tokens.json` → `tokens.css` | `DESIGN.md`, `README.md` sau khi rút gọn |
| Cách đặt tên và khi nào dùng | Document này | `DESIGN.md` |
| Checklist triển khai nhanh | `docs/design-system/DESIGN.md` | Document này cho bảng số |
| Cách build/import | `src/shared/styles/README.md` | Document này cho command |

---

## 2. Foundation boundary

Foundation chứa các quyết định toàn cục:
- direction/principles (quiet confidence)
- color (core + semantic)
- typography
- spacing/adaptive density
- shape/elevation
- layout/iconography
- motion
- accessibility

**Không thuộc foundation:**
- component tokens (gắn với component cụ thể)
- domain tokens (token-freq, token-status, nếu dùng trong feature riêng)

> **Glass/liquid tokens đã bị loại (2026-09-08):** `--color-glass-*`, `--color-liquid-blob-*`, `--color-button-liquid-*`, `--shadow-liquid-*`, `backdrop-filter` không còn được dùng cho UI mới. Migration đang chờ — chưa dùng các token này trong code mới. Cơ sở lý thuyết và luật quyết định: `docs/design-system/DESIGN_RATIONALE.md`.
- presets (dawn/forest/ocean/warmth) — là lớp trên foundation, có rationale riêng

Một token chỉ bị xóa khi có bằng chứng nó không còn consumer trực tiếp, gián tiếp, trong Shadow DOM, content script, preset, test, hay generated asset.

---

## 3. Color

### 3.1 Core palette

Có 9 core color keys: `primary`, `background`, `surface`, `text`, `textSecondary`, `border`, `success`, `warning`, `error`. Giá trị cụ thể trong `tokens.json`.

### 3.2 Surface ladder

| Vai trò | Khi nào dùng |
|---|---|
| `--color-background` | Page/window background |
| `--color-surface` | Card, panel, primary container |
| `--color-field` | Control nằm trong card (input/select/tonal row) — resting inset, borderless |
| `--color-field-hover` | Hover trên field |
| `--color-field-active` | Pressed/trạng thái giữ trên field |
| `--color-surface-elevated` | Popover, dropdown, tooltip, elevated card |
| `--color-surface-hover` | Hover state trên surface |
| `--color-surface-pressed` | Active/pressed state trên surface |
| `--color-background-muted` | Subtle section background |
| `--color-background-elevated` | Slightly raised page area (nếu dùng) |

**Borderless policy (L-BORDER):** component mặc định không viền — hierarchy do ladder trên + spacing + shadow-chỉ-cho-floating gánh. `border` chỉ khi mang thông tin: variant `outline`, state (focus/error/success/selected), affordance vật lý (drag/kbd/thumb cutout), separator cấu trúc (`--color-border-subtle`), và `prefers-contrast: more`/`forced-colors`. Luật đầy đủ: `docs/design-system/DESIGN_RATIONALE.md` L-BORDER.

### 3.3 Text roles

| Token | Vai trò |
|---|---|
| `--color-text` | Primary text |
| `--color-text-secondary` | Secondary/metadata text |
| `--color-text-tertiary` | Disabled, placeholder |
| `--color-text-inverse` | Text trên nền đậm/inverted |
| `--color-text-on-primary` | **Canonical** text trên primary accent |
| `--color-text-accent` | Accent text trên neutral surface |

`--color-primary-foreground` là alias cũ của `--color-text-on-primary`; cần migrate. `--color-on-primary` không tồn tại.

### 3.4 Status / feedback

| Token | Vai trò |
|---|---|
| `--color-success` / `--color-warning` / `--color-error` | Status color |
| `--color-*-subtle` | Nền nhạt cho badge/tag |
| `--color-*-muted` | Nền trung bình |
| `--color-on-*` | Nội dung trên status background |
| `--color-destructive` | Alias của `--color-error` cho destructive action |

### 3.5 Info

`--color-info` là alias của `--color-primary` dùng cho info surface/badge.
`--color-text-accent` là màu text accent riêng, có thể khác primary ở dark mode để đảm bảo contrast.

### 3.6 Tints

Dùng cho tag, badge, part-of-speech, category. 9 tints: blue, cyan, gray, green, orange, pink, purple, red, teal, yellow. Mỗi tint có `background`, `border`, `icon`, `text`.

---

## 4. Typography

### 4.1 Typeface

- **Primary:** Inter Variable, self-hosted, subset Latin + Vietnamese.
- **Fallback stack:** `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`.
- **System fallback cho CJK/khác:** khi Inter không có glyph, browser xuống system font.
- `font-display: swap` bắt buộc để tránh FOIT.
- Không dùng CDN font trong MV3.

### 4.2 Type scale

SSOT là `tokens.json` `static.font.sizes`. Tên scale (không phải giá trị cố định):

| Token | Vai trò mặc định |
|---|---|
| `--font-size-3xs` | 8px — chỉ dùng cho số cực nhỏ, không dùng cho text đọc |
| `--font-size-2xs` | 10px — rất hiếm |
| `--font-size-xs` | 12px — caption, label nhỏ, metadata |
| `--font-size-sm` | 14px — UI text, control, button |
| `--font-size-base` | 14px — UI text mặc định |
| `--font-size-md` | 16px — long-form body |
| `--font-size-lg` | 18px — title lớn |
| `--font-size-xl` | 20px |
| `--font-size-2xl` | 24px |
| `--font-size-3xl` | 28px |
| `--font-size-4xl` | 32px |
| `--font-size-5xl` | 40px |

### 4.3 Semantic type roles

Các vai trò dùng composite tokens (`--body-md-font-size`, `--title-lg-font-size`, v.v.).

| Role | Kích thước mặc định | Dùng cho |
|---|---|---|
| `body-md` | `--font-size-md` (16px) | Long-form paragraph, description |
| `body-sm` | `--font-size-sm` (14px) | Body ngắn trong UI |
| `body-xs` | `--font-size-xs` (12px) | Caption, helper text — không nhỏ hơn 12px |
| `label-md` | `--font-size-sm` (14px) | Form label, control label |
| `label-sm` | `--font-size-xs` (12px) | Caption label |
| `title-md` | `--font-size-md` (16px) | Card title, section title |
| `title-sm` | `--font-size-sm` (14px) | List item title |
| `headline-md` | `--font-size-lg` hoặc responsive | Larger heading |
| `display-*` | responsive typography | Marketing/empty state (dùng ít) |

**Quy tắc:**
- Long-form body ≥ 16px.
- UI/control text ≥ 14px.
- Caption/metadata ≥ 12px; không dùng 11px/10px cho text cần đọc.

### 4.4 Weights

| Token | Giá trị | Dùng |
|---|---|---|
| `--font-weight-normal` | 400 | Body |
| `--font-weight-medium` | 500 | UI control, label, button |
| `--font-weight-semibold` | 600 | Title, headline, emphasized |
| `--font-weight-bold` | 700 | Rất hiếm |

Không dùng weight 510. Nếu cần optical size lớn, dùng `--font-weight-semibold` hoặc tăng font-size.

### 4.5 Line-height / tracking

| Token | Ý nghĩa |
|---|---|
| `--leading-tight` | 1.2 — headline, title |
| `--leading-snug` | 1.3 — compact UI |
| `--leading-normal` | 1.5 — body |
| `--leading-relaxed` | 1.6 — long-form |
| `--tracking-tight` | -0.03em — display/headline lớn |
| `--tracking-snug` | -0.015em — title |
| `--tracking-normal` | 0 |
| `--tracking-wide` | 0.03em — caption/uppercase |

---

## 5. Spacing và adaptive density

### 5.1 Spacing scale

Base unit 4px. Scale names: `0`, `0-5`, `1`, `1-5`, `2`, `2-5`, `3`, `3-5`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `14`, `16`, `20`, `24`. Giá trị cụ thể trong `tokens.json`.

### 5.2 Density

Cell dùng **một adaptive density duy nhất**, không có density selector.
- Mặc định là `comfortable`.
- Context compact (list dài, data dày đặc) có thể giảm padding/gap qua component token hoặc lớp wrapper, không tạo token density mới.

---

## 6. Shape và elevation

### 6.1 Radius scale

| Token | Vai trò |
|---|---|
| `--radius-none` | 0 |
| `--radius-xs` | 2px — chip, tag, micro element |
| `--radius-sm` | 4px — small control |
| `--radius-md` | 6px — input, small card |
| `--radius-lg` | 8px — card |
| `--radius-xl` | 12px — dialog, panel |
| `--radius-2xl` | 16px — large card |
| `--radius-3xl` | 24px — hero |
| `--radius-pill` | 9999px — button, input, badge |
| `--radius-full` | 9999px — same as pill, deprecated alias |

### 6.2 Elevation

| Token | Vai trò |
|---|---|
| `--shadow-0` | none — default flat |
| `--shadow-sm` | hairline — card hover, small lift |
| `--shadow-md` | mid — popover |
| `--shadow-lg` | high — modal |
| `--shadow-floating` | subtle floating element |
| `--shadow-popover` | popover |
| `--shadow-modal` | modal |
| `--shadow-focus` | focus ring |

---

## 7. Motion

### 7.1 Duration

| Token | Ý nghĩa |
|---|---|
| `--duration-instant` | 0ms |
| `--duration-100` | 100ms — micro feedback |
| `--duration-fast` | 120ms |
| `--duration-normal` | 200ms |
| `--duration-slow` | 300ms |
| `--duration-slower` | 500ms — large transition |

### 7.2 Easing

| Token | Curve |
|---|---|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` |

### 7.3 Reduced motion

Tôn trọng `prefers-reduced-motion: reduce`. CSS global reset đã trong `tokens.css` chuyển mọi transition về `0.01ms`.

---

## 8. Iconography

- Canvas 24×24, stroke 1.5px, round caps/joins.
- Dùng `currentColor` và `fill: none`.
- Kích thước icon dùng `--space-*` hoặc `--icon-size-*` (nếu có).
- Không inline SVG trong component; import từ `ICON_CATALOG`.

---

## 9. Grid và breakpoints

### 9.1 Breakpoint set

| Name | Giá trị | Khoảng |
|---|---|---|
| `compact` | 0 | < 600px |
| `medium` | 600px | 600px – 839px |
| `expanded` | 840px | 840px – 1199px |
| `large` | 1200px | 1200px – 1599px |
| `extra-large` | 1600px | ≥ 1600px |

### 9.2 Usage

- **CSS media query** phải hardcode giá trị px. **Không dùng `var(--breakpoint-*)`** trong `@media` vì CSS custom property không hợp lệ trong media query.
- **JS** dùng `BREAKPOINTS` export từ `src/shared/lib/tokens.ts`.
- Feature-local content thresholds có thể dùng giá trị khác với lý do; không bắt buộc thay thế mọi `min-width` về breakpoint foundation.

---

## 10. Accessibility (WCAG 2.2 AA)

### 10.1 Contrast

- Normal text (< 18pt hoặc < 14pt bold): 4.5:1 tối thiểu.
- Large text (≥ 18pt hoặc ≥ 14pt bold): 3:1.
- Non-text UI / focus indicator: 3:1.
- Không dùng threshold 3:1 cho normal text.

### 10.2 Motion, color, zoom

- `prefers-reduced-motion`: giảm hoặc tắt animation.
- Không dùng color là cách duy nhất truyền thông tin (thêm icon/text).
- 200% zoom/reflow: layout không bị cut, không cần horizontal scroll.
- `prefers-contrast: more` / forced colors: cung cấp visible border/outline.

### 10.3 Pointer target

- Coarse pointer: ≥ 44px.
- Fine pointer: ≥ 40px.
- Dùng `--touch-target-mobile` / `--touch-target-desktop` (theme-independent).

### 10.4 Focus

- Focus ring dùng `--shadow-focus` hoặc `outline` với `--color-border-focus`.
- Focus visible, không ẩn khi keyboard navigation.

---

## 11. Token layers và naming

### 11.1 Layer

```
Primitive → Semantic → Component
(core)      (derived)  (component)
```

- **Primitive/core:** giá trị thô, themeable (light/dark/preset).
- **Semantic:** vai trò UI, tham chiếu primitive (`--color-text`, `--color-surface-hover`).
- **Component:** gắn component (`--button-bg`, `--card-radius`).

### 11.2 Naming rules

| Pattern | Ví dụ |
|---|---|
| `--color-{role}` | `--color-primary` |
| `--color-{role}-{state}` | `--color-primary-hover` |
| `--color-{role}-{variant}` | `--color-primary-subtle` |
| `--color-on-{role}` | `--color-on-success` |
| `--color-text-{role}` | `--color-text-secondary` |
| `--color-{surface}` | `--color-surface-elevated` |
| `--space-{n}` | `--space-4` |
| `--radius-{n}` | `--radius-lg` |
| `--shadow-{n}` | `--shadow-md` |
| `--duration-{name}` | `--duration-fast` |
| `--ease-{name}` | `--ease-out` |
| `--font-size-{n}` | `--font-size-base` |
| `--font-weight-{n}` | `--font-weight-medium` |
| `--{component}-{property}` | `--button-bg` |
| `--{component}-{variant}-{property}` | `--button-secondary-bg` |
| `--{component}-{state}-{property}` | `--button-hover-bg` |

### 11.3 CSS usage

```css
/* GOOD */
padding: var(--space-4);
color: var(--color-text);
background: var(--color-surface-hover);

/* BAD */
padding: 16px;
color: #2a2a2b;
```

---

## 12. Build, import, regenerate

Sửa `tokens.json` → chạy:

```bash
node scripts/generate-tokens.js
```

Hoặc `npm run dev` / `npm run build` tự chạy qua `predev`/`prebuild`.

Import trong React entrypoint:

```ts
import '@/shared/styles/tokens.css';
```

Shadow DOM:

```ts
import tokensCss from '@/shared/styles/tokens.css?raw';
const hostCss = tokensCss.replace(/:root\b/g, ':host');
```

Content script / host page:

```ts
import { STATIC_TOKENS, DEFAULT_LIGHT_TOKENS, DEFAULT_DARK_TOKENS } from '@/shared/lib/tokens';
// inject resolved values cho mọi token CSS string tham chiếu.
```

`tokens.css` và `src/shared/lib/tokens.ts` là generated/derived artifacts; không sửa tay.

---

## 13. Audit checklist (trước merge)

```bash
# 1. Hardcoded colors trong CSS (ngoại trừ tokens.css)
rg -t css '#[0-9a-fA-F]{3,8}' src/ -g '!tokens.css' -g '!*.showcase.module.css'

# 2. Hardcoded px spacing/font-size (cần review)
rg -t css '[0-9]+px' src/shared/ui/ --type-add 'css:*.module.css'

# 3. Breakpoint CSS custom property trong media query
rg -t css '@media.*var\(--breakpoint'

# 4. Token không xác định trong tokens.css
node scripts/check-undefined-tokens.js  # nếu tồn tại
```

---

## 14. Migration notes

- `--color-primary-foreground` → `--color-text-on-primary`.
- `--radius-full` → `--radius-pill`.
- `--font-weight-regular` → `--font-weight-normal`.
- `--size-touch-target-*` → `--touch-target-*`.
- Các `--breakpoint-*` CSS custom property sẽ bị xóa; dùng hardcode px trong CSS hoặc `BREAKPOINTS` trong JS.
