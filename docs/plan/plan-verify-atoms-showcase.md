# Plan to Fix — Atom Showcase Verification

> Tổng hợp từ 7 subagent review theo Bloom's Evaluate level.
> Scope: 68 atom + Token SSOT vs daft.md.
> Source: `docs/design-system/daft.md`, `docs/design-system/atom-design-plan.md`, `src/shared/styles/tokens.json`.

---

## 0. Thống kê tổng quan

| Nhóm | Số atom | Token PASS | Visual PASS | Showcase PASS | A11y PASS |
|------|---------|-------------|-------------|---------------|-----------|
| Generic Core | 10 | 9/10 | 8/10 | 0/10 | 9/10 |
| Layout + Utility | 12 | 10/12 | 5/12 | 0/12 | 8/12 |
| Display (Astryx) | 7 | 7/7 | 7/7 | 0/7 | 7/7 |
| Extension | 12 | 12/12 | 5/12 | 0/12 | 12/12 |
| Domain Video+Sub | 14 | 14/14 | 11/14 | 14/14 | 14/14 |
| Domain Dict+Learn | 13 | 13/13 | 13/13 | 13/13 | 13/13 |
| **Tổng** | **68** | **65/68** | **49/68** | **27/68** | **63/68** |

**Showcase readability 0/68 (non-domain)**: Tất cả showcase generic/layout/display/extension thiếu description text — chỉ có title trong `showcaseMeta.title`, không có mô tả component là gì, dùng khi nào.

---

## 1. CRITICAL — Token SSOT vs daft.md (Phase 0)

### 1.1. Color tokens sai giá trị

| Token | daft.md Light | daft.md Dark | tokens.json hiện tại | Hành động |
|-------|---------------|-------------|---------------------|-----------|
| `--color-text-secondary` | `#737373` | `#a3a3a3` | `#525252` / `#a3a3a3` | Sửa light → `#737373` |
| `--color-border` | `#00000014` | `#FFFFFF1A` | `#d4d4d4` / `#525252` | Sửa → transparent hex |
| `--color-accent` | `#262626` | `#ebebeb` | `#f1f5f9` / `#334155` | Sửa giá trị |
| `--color-success-muted` | `#c5e5c0` | `#84c9803D` | `#e2f3e7` / `#1a202c` | Sửa giá trị |
| `--color-error-muted` | `#facecb` | `#ff9e973D` | `#fff5f3` / `#1a202c` | Sửa giá trị |
| `--color-warning-muted` | `#f8da9d` | `#deb4333D` | `#fdf9e6` / `#1a202c` | Sửa giá trị |
| `--color-on-warning` | `#171717` | `#171717` | `var(--color-text-inverse)` | Sửa → `#171717` |
| `--color-overlay` | `#00000080` | `#000000CC` | `color-mix(...)` | Sửa → exact hex |
| `--color-overlay-hover` | `#0000000D` | `#FFFFFF0D` | `color-mix(...)` | Sửa → exact hex |
| `--color-overlay-pressed` | `#0000001A` | `#FFFFFF1A` | `color-mix(...)` | Sửa → exact hex |
| `--color-background-card` | `#ffffff` / `#1b1b1b` | — | `var(--color-surface)` | Sửa: light=surface, dark=background |
| `--color-background-popover` | `#ffffff` / `#1b1b1b` | — | `var(--color-background)` | Sửa: light=surface, dark=background |

### 1.2. Color tokens thiếu hoàn toàn (12 tokens)

- `--color-accent-muted` → `#f1f1f1` / `#262626`
- `--color-on-accent` → `#ffffff` / `#171717`
- `--color-neutral` → `#0000000F` / `#FFFFFF1A`
- `--color-background-inverted` → `#0A1317` / `#FFFFFF`
- `--color-background-error-inverted` → `#AA071E` / `#E3193B`
- `--color-text-accent` → `#262626` / `#ebebeb`
- `--color-on-dark` → `#ffffff`
- `--color-on-light` → `#171717`
- `--color-icon-accent` → `#262626` / `#ebebeb`
- `--color-track` → `#CCD3DB` / `#5A5E66`
- `--color-shadow` → `#0000001A` / `#0000004D`
- `--color-tint-hover` → `black` / `white`

### 1.3. Tint/Data/Syntax colors thiếu (65 tokens)

- **Tint colors (40)**: Blue, Cyan, Gray, Green, Orange, Pink, Purple, Red, Teal, Yellow × 4 variants (bg/border/icon/text)
- **Data viz (11)**: `--color-data-categorical-{blue,orange,purple,green,pink,cyan,red,teal,brown,indigo}` + `--color-data-neutral`
- **Syntax (14)**: `--color-syntax-{keyword,string,comment,number,function,type,variable,operator,constant,tag,attribute,property,punctuation,background}`

### 1.4. Typography line-height sai

| Style | daft.md line-height | tokens.json hiện tại | Hành động |
|-------|--------------------|--------------------|-----------|
| H1 | `1.3333` | `--leading-tight` (1.25) | Thêm `--leading-h1: 1.3333` |
| H2 | `1.4` | `--leading-tight` (1.25) | Thêm `--leading-h2: 1.4` |
| H3 | `1.4118` | `--leading-snug` (1.375) | Thêm `--leading-h3: 1.4118` |
| Body | `1.4286` | `--leading-normal` (1.5) | Thêm `--leading-body: 1.4286` |
| Label | `1.4286` | `--leading-normal` (1.5) | Thêm `--leading-label: 1.4286` |
| Supporting | `1.6667` | `--leading-normal` (1.5) | Thêm `--leading-supporting: 1.6667` |

**Thiếu semantic type tokens (8)**: `--text-heading-4`, `--text-heading-5`, `--text-heading-6`, `--text-display-1`, `--text-display-2`, `--text-display-3`, `--text-large`, `--text-code`

### 1.5. Motion tokens sai hoàn toàn

| Token | daft.md | tokens.json hiện tại | Hành động |
|-------|---------|---------------------|-----------|
| `--duration-fast-min` | `130ms` | MISSING | Thêm |
| `--duration-fast` | `175ms` | `var(--duration-150)` (150ms) | Sửa |
| `--duration-fast-max` | `230ms` | MISSING | Thêm |
| `--duration-medium-min` | `310ms` | MISSING | Thêm |
| `--duration-medium` | `410ms` | MISSING | Thêm |
| `--duration-medium-max` | `550ms` | MISSING | Thêm |
| `--duration-slow-min` | `730ms` | MISSING | Thêm |
| `--duration-slow` | `975ms` | MISSING | Thêm |
| `--duration-slow-max` | `1300ms` | MISSING | Thêm |
| `--ease-standard` | `cubic-bezier(0.24, 1, 0.4, 1)` | `ease` | Sửa |

### 1.6. Shadow/Elevation sai naming + thiếu

- daft.md: `--shadow-low`, `--shadow-med`, `--shadow-high`
- tokens.json: `--shadow-sm/md/lg = none` (sai tên + sai giá trị)
- Thiếu: `--shadow-inset-hover`, `--shadow-inset-selected`, `--shadow-inset-success`, `--shadow-inset-warning`, `--shadow-inset-error`

### 1.7. Size & Border thiếu

- `--size-element-sm`: `28px` — MISSING
- `--size-element-md`: `32px` — MISSING
- `--size-element-lg`: `36px` — MISSING
- `--spacing-14`: `56px` — MISSING

### 1.8. Radius circular references

- `--radius-element` (derived) → `var(--radius-pill)` — circular
- `--radius-container` (derived) → `var(--radius-card)` — circular
- `--radius-page` (derived) → `var(--radius-2xl)` — circular
- **Fix**: Dùng direct values từ static, không reference chéo

---

## 2. CRITICAL — Atom issues (hardcoded values)

### 2.1. Avatar — hardcoded pixel values

**File**: `src/shared/ui/Avatar.module.css`
**Severity**: CRITICAL

```
Line 26-27: width: 24px; height: 24px;  (xs)
Line 32-33: width: 32px; height: 32px;  (sm)
Line 38-39: width: 40px; height: 40px;  (md)
Line 44-45: width: 56px; height: 56px;  (lg)
Line 71-72: width: 10px; height: 10px;  (status dot)
```

**Fix**: Thêm `--avatar-size-xs/sm/md/lg` tokens vào tokens.json, thay hardcoded values bằng tokens. Status dot dùng `--space-2-5` (10px).

### 2.2. Container — hardcoded maxWidth

**File**: `src/shared/ui/Container.module.css` lines 12-16
**Severity**: MINOR (layout constants acceptable)

```
480px, 640px, 800px, 1024px
```

**Fix**: Thêm `--container-max-width-sm/md/lg/xl` tokens hoặc document as acceptable.

### 2.3. Box — uses missing token

**File**: `src/shared/ui/Box.module.css` line 12
**Severity**: MAJOR

```
--color-background-inverted  ← MISSING from tokens.json
```

**Fix**: Thêm token vào tokens.json (section 1.2) hoặc bỏ variant.

---

## 3. MAJOR — Visual quality issues (known + new)

### 3.1. VolumeControl — Slider quá to

**File**: `src/shared/domain/video/atoms/VolumeControl.module.css`
**Severity**: MAJOR (anh đã báo)

- Thumb: 12px (`var(--space-3)`) — quá to
- Width: 80px (`var(--space-20)`) — quá rộng cho video controls

**Fix**: Thumb → 8px (`var(--space-2)`), Width → 48-56px (`var(--space-12)` hoặc `var(--space-14)`)

### 3.2. CaptionToggle — size quá to

**File**: `src/shared/domain/subtitle/atoms/CaptionToggle.module.css`
**Severity**: MAJOR (anh đã báo)

- Width: `calc(var(--touch-target) * 1.8)` = 72px — quá to

**Fix**: Width → `calc(var(--touch-target) * 1.2)` = 48px

### 3.3. LanguageSelector — options không design

**File**: `src/shared/domain/subtitle/atoms/LanguageSelector.tsx`
**Severity**: MAJOR (anh đã báo)

- Dùng native `<select>` với browser-default dropdown
- Options không styled theo Astryx

**Fix**: Refactor dùng generic `Select` từ `@/shared/ui` (đã có), hoặc custom dropdown với styled options.

### 3.4. EmptyState — thiết kế lại

**Severity**: MAJOR (anh yêu cầu redesign)

**Fix**: Tham khảo Astryx EmptyState component. Cần:
- Icon lớn (48px) với `--color-text-secondary`
- Title (heading-3 scale)
- Description (body text, `--color-text-secondary`)
- Optional action button
- Centered layout
- `role="status"` cho screen readers

### 3.5. SubtitleText — NOT broken (verified)

**File**: `src/shared/domain/subtitle/atoms/SubtitleText.tsx`
**Severity**: INFO

Subagent xác nhận: implementation đúng, all tokens tồn tại, styling correct per spec. **Không cần fix.**

### 3.6. WordChip — wrong hover token

**File**: `src/shared/domain/learning/atoms/WordChip.module.css` line 42
**Severity**: MAJOR

```css
/* SAI */ background: var(--color-accent);
/* ĐÚNG */ background: var(--color-surface-hover);
```

**Fix**: Đổi `--color-accent` → `--color-surface-hover`

### 3.7. Toggle — wrong ARIA role

**File**: `src/shared/ui/Toggle.tsx` line 45
**Severity**: MAJOR

```tsx
/* SAI */ aria-pressed={checked}
/* ĐÚNG */ role="switch" aria-checked={checked}
```

### 3.8. Button — active scale sai

**File**: `src/shared/ui/Button.module.css` lines 64, 79, 96, 111, 126
**Severity**: MINOR

```css
/* SAI */ transform: scale(0.98);
/* ĐÚNG */ transform: scale(0.97);
```

### 3.9. Progress — wrong tokens + missing circular

**File**: `src/shared/ui/Progress.module.css`
**Severity**: MAJOR

- Track: `--color-muted` → nên `--color-track`
- Fill: `--color-primary` → nên `--color-accent` (accent variant)
- Missing: circular variant

### 3.10. Spinner — missing sizes + wrong ARIA

**File**: `src/shared/ui/Spinner.tsx`
**Severity**: MAJOR

- Missing sizes: 2xs, xs, xl (spec requires 6, has 3)
- Size mapping: `--space-*` → should `--font-size-*`
- Missing `ariaLabel` prop
- `aria-hidden="true"` → should `role="status"` + `aria-label`

### 3.11. Link — variant mismatch + missing features

**File**: `src/shared/ui/Link.tsx`
**Severity**: MAJOR

- Variants: `default|subtle|destructive` → spec: `inline|standalone`
- Missing: underline behavior, disabled prop, external icon
- Color: `--color-primary` → should `--color-text-accent`

### 3.12. Kbd — missing size + wrong tokens

**File**: `src/shared/ui/Kbd.tsx`
**Severity**: MAJOR

- Missing: `size?: 'sm' | 'md'` prop
- bg: `--color-surface` → should `--color-background-muted`
- radius: `--radius-sm` → should `--radius-inner`
- font-size: `--font-size-base` → should `--font-size-xs`/`--font-size-sm`
- shadow: custom rgba → should `--shadow-inset-hover` (token missing)

### 3.13. Overlay — missing props

**File**: `src/shared/ui/Overlay.tsx`
**Severity**: MAJOR

- Missing: `elevation`, `blur` props
- Missing: enter/exit animations
- Prop name: `open` → should `visible`

### 3.14. Section — missing props

**File**: `src/shared/ui/Section.tsx`
**Severity**: MAJOR

- Missing: `as`, `gap`, `ariaLabel`, `ariaLabelledBy` props
- `size` prop → should `padding` (SpacingToken)

---

## 4. MAJOR — Missing size props (pattern lặp)

Nhiều atom thiếu `size` prop theo spec:

| Atom | Spec sizes | Hiện tại |
|------|-----------|----------|
| Spinner | 2xs, xs, sm, md, lg, xl (6) | sm, md, lg (3) |
| Kbd | sm, md | none |
| PhoneticText | sm, md, lg | none |
| PartOfSpeechTag | sm, md | none |
| SynonymChip | sm, md | none |
| AntonymChip | sm, md | none |
| SourceBadge | sm, md | none |
| WordChip | sm, md | none |
| StatusDot | sm, md | none |
| IconButton | (has xs, sm, md, lg) | OK |
| PinButton | sm, md, lg | none |
| BackButton | sm, md, lg | none |
| InfoButton | sm, md, lg | none |
| MinimizeButton | sm, md, lg | none |
| MaximizeButton | sm, md, lg | none |
| DragHandle | sm, md, lg | none |
| CollapseButton | (needs direction + showLabel) | none |

---

## 5. MAJOR — Missing variants

| Atom | Missing variants |
|------|-----------------|
| IconButton | solid, outline, transparent |
| CloseButton | solid |
| InfoButton | outline |
| MinimizeButton | outline |
| DragHandle | orientation (horizontal/vertical) |
| CollapseButton | direction, showLabel |
| Heading | Display 1-3 |
| Progress | circular |
| Link | inline, standalone (rename) |

---

## 6. MINOR — Showcase readability (tất cả 55 non-domain showcases)

**Pattern chung**: Tất cả showcase có `showcaseMeta.title` nhưng thiếu:

1. **Description text** — không có mô tả component là gì, dùng khi nào (55/68 showcases)
2. **Hover state** — không demo hover state (Button, Input, Checkbox, Toggle, etc.)
3. **Disabled state** — một số showcase thiếu disabled demo
4. **Missing variants** — một số showcase không show hết variants từ spec

**Fix chung**: Thêm `description` field vào `showcaseMeta` cho tất cả showcases.

---

## 7. Thứ tự ưu tiên fix

### Phase 1: Token SSOT (CRITICAL — nền tảng)
1. Sửa `tokens.json` color values theo daft.md (section 1.1)
2. Thêm 12 missing core color tokens (section 1.2)
3. Thêm tint/data/syntax colors (section 1.3) — có thể defer nếu chưa dùng
4. Sửa typography line-heights + thêm 8 semantic type tokens (section 1.4)
5. Sửa motion duration scale + ease-standard (section 1.5)
6. Thêm shadow-low/med/high + inset shadows (section 1.6)
7. Thêm size-element-sm/md/lg + spacing-14 (section 1.7)
8. Fix radius circular references (section 1.8)
9. Regenerate `tokens.css` + `tokens.ts`

### Phase 2: Critical atom fixes (CRITICAL)
1. Avatar — replace hardcoded sizes với tokens (section 2.1)
2. Box — add `--color-background-inverted` token (section 2.3)
3. WordChip — fix hover token (section 3.6)
4. Toggle — fix ARIA role (section 3.7)

### Phase 3: Known visual issues (MAJOR — anh đã báo)
1. VolumeControl — reduce slider size (section 3.1)
2. CaptionToggle — reduce width (section 3.2)
3. LanguageSelector — use Select component (section 3.3)
4. EmptyState — redesign per Astryx (section 3.4)

### Phase 4: Missing size props (MAJOR — pattern)
1. Thêm `size` prop cho 16 atoms (section 4)
2. Thêm missing variants cho 9 atoms (section 5)

### Phase 5: Token compliance fixes (MAJOR)
1. Progress — fix track/fill tokens (section 3.9)
2. Spinner — fix sizes + ARIA (section 3.10)
3. Link — fix variants + features (section 3.11)
4. Kbd — fix tokens + size (section 3.12)
5. Overlay — add props (section 3.13)
6. Section — add props (section 3.14)
7. Button — fix active scale 0.97 (section 3.8)

### Phase 6: Showcase readability (MINOR — efficiency)
1. Thêm `description` vào `showcaseMeta` cho 55 showcases
2. Thêm hover/disabled state demos
3. Thêm missing variant demos

---

## 8. Estimation

| Phase | Số file chạm | Complexity |
|-------|-------------|------------|
| Phase 1: Token SSOT | 1 (tokens.json) + regenerate | High — cần verify contrast |
| Phase 2: Critical atoms | 4 files | Low |
| Phase 3: Known visual | 4 files | Medium |
| Phase 4: Size props | 16 atoms × 2-3 files | Medium-High |
| Phase 5: Token compliance | 7 atoms × 2-3 files | Medium |
| Phase 6: Showcase descriptions | 55 files | Low (repetitive) |

**Tổng**: ~100+ file changes, ưu tiên Phase 1-3 trước.
