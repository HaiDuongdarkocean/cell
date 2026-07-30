# Kế hoạch thiết kế Design System — Atom Level

> Kế hoạch greenfield cho 79 atom-level components của Cell, tuân thủ `daft.md` (Astryx/Meta convention).
> Mỗi atom có 5 phần: **Props (TS interface)** · **Token mapping** · **Variants** · **States** · **Accessibility**.
> Không có code mẫu — đây là spec để handoff implement.

---

## 0. Mục tiêu · Scope · Ràng buộc

### Mục tiêu
Build design system atom từ đầu (greenfield). Atom là gốc — nếu atom sai, mọi molecule/organism/template/page dùng nó đều sai. 100% effort tránh bỏ sót.

### Scope
- **79 atoms**: 40 generic + 12 extension + 27 domain (video/subtitle/dictionary/learning)
- **Mức chi tiết mỗi atom**: API spec (props) + token mapping + variant + state + accessibility
- **Out of scope**: code mẫu JSX/CSS, test case, implement vào Cell, sửa code hiện có

### Ràng buộc (binding constraints — từ `daft.md`)
1. **Semantic tokens over hardcoded values** — `var(--color-text-primary)`, không `#171717`
2. **Theme-agnostic code** — atom không tham chiếu màu/cỡ cụ thể; light/dark đổi qua `light-dark()`
3. **3-layer token resolution** — Primitive → Semantic → Component
4. **Concentric radius** — inner element dùng `max(0, outerRadius - padding)`
5. **Controlled inputs** — mọi input atom là `value` + `onChange`, không uncontrolled
6. **`useLinkComponent()` cho Link** — atom Link không hardcode `<a>`
7. **Open internals** — primitive của atom được export để compose
8. **Elevation prop** — atom có thể float dùng `elevation: none | low | med | high`
9. **Frame-first** — atom layout neutral, không opinionated (Box=div, không padding cố định)
10. **Touch target** — mobile 44px, desktop 40px (WCAG 2.5.5)
11. **Focus styling** — `:focus-visible`, không `:focus`
12. **Reduced motion** — `prefers-reduced-motion`
13. **Disabled state** — `aria-disabled` + visual
14. **Semantic naming** — `close`, `chevronDown`, `success` (không `x`, `arrow-down`, `green-check`)

### Quy tắc phân loại Atom (đã chốt ở `tri-thuc-design-system.md`)
- Là ATOM: không import component nào khác, chỉ wrapper 1 HTML element native, chia nhỏ hơn → mất chức năng
- KHÔNG phải Atom (Molecule): import 2+ atom, có state/logic phức tạp, compound component

### Convention code (từ `AGENTS.md`)
- Function component + hooks, không class
- Named export, không default export
- Không `any` (ESLint `no-explicit-any`)
- Icon: đọc `ICON_CATALOG` (`src/shared/icons/index.ts`) trước, không inline SVG
- SSOT: token từ `tokens.json` (generated → `tokens.css`/`tokens.ts`), không tự sửa generated files

---

## 1. Phase 0 — Sub-Atomic Tokens (gốc của gốc)

> Brad Frost: "Atoms can also include more abstract elements like color palettes, fonts and animations." → Tokens thuộc tầng Atom. Không có tokens thì atom chỉ là wrapper HTML vô hồn.

### 1.1. Color Tokens (semantic, light/dark qua `light-dark()`)

**Core / Surface / Text:**

| Token | Light | Dark | Dùng cho |
|-------|-------|------|----------|
| `--color-accent` | `#262626` | `#ebebeb` | Accent chính |
| `--color-accent-muted` | `#f1f1f1` | `#262626` | Accent nhạt/bg |
| `--color-on-accent` | `#ffffff` | `#171717` | Nội dung trên accent |
| `--color-neutral` | `#0000000F` | `#FFFFFF1A` | Nền neutral transparent |
| `--color-background-surface` | `#ffffff` | `#262626` | Nền surface chính |
| `--color-background-body` | `#f1f1f1` | `#1b1b1b` | Nền body/page |
| `--color-background-muted` | `#f1f1f1` | `#1b1b1b` | Nền muted |
| `--color-background-card` | `#ffffff` | `#1b1b1b` | Nền card |
| `--color-background-popover` | `#ffffff` | `#1b1b1b` | Nền popover |
| `--color-background-inverted` | `#0A1317` | `#FFFFFF` | Nền inverted |
| `--color-overlay` | `#00000080` | `#000000CC` | Overlay backdrop |
| `--color-overlay-hover` | `#0000000D` | `#FFFFFF0D` | Overlay hover |
| `--color-overlay-pressed` | `#0000001A` | `#FFFFFF1A` | Overlay pressed |
| `--color-text-primary` | `#171717` | `#fafafa` | Text chính |
| `--color-text-secondary` | `#737373` | `#a3a3a3` | Text phụ |
| `--color-text-disabled` | `#a3a3a3` | `#525252` | Text disabled |
| `--color-text-accent` | `#262626` | `#ebebeb` | Text accent |
| `--color-on-dark` | `#ffffff` | - | Nội dung trên nền tối |
| `--color-on-light` | `#171717` | - | Nội dung trên nền sáng |
| `--color-icon-primary` | `#171717` | `#fafafa` | Icon chính |
| `--color-icon-secondary` | `#737373` | `#a3a3a3` | Icon phụ |
| `--color-icon-disabled` | `#a3a3a3` | `#525252` | Icon disabled |
| `--color-icon-accent` | `#262626` | `#ebebeb` | Icon accent |
| `--color-border` | `#00000014` | `#FFFFFF1A` | Border mặc định |
| `--color-border-emphasized` | `#d4d4d4` | `#525252` | Border nhấn mạnh |
| `--color-skeleton` | `#ebebeb` | `#525252` | Skeleton loading |
| `--color-track` | `#CCD3DB` | `#5A5E66` | Track (slider/switch) |
| `--color-shadow` | `#0000001A` | `#0000004D` | Shadow color |
| `--color-tint-hover` | `black` | `white` | Tint hover |

**Status Colors:**

| Token | Light | Dark | Dùng cho |
|-------|-------|------|----------|
| `--color-success` | `#007004` | `#9fe59b` | Success |
| `--color-success-muted` | `#c5e5c0` | `#84c9803D` | Success bg |
| `--color-on-success` | `#ffffff` | `#171717` | Text trên success |
| `--color-error` | `#a50c25` | `#ffc6c1` | Error |
| `--color-error-muted` | `#facecb` | `#ff9e973D` | Error bg |
| `--color-on-error` | `#ffffff` | `#171717` | Text trên error |
| `--color-warning` | `#745b00` | `#fdcf4f` | Warning |
| `--color-warning-muted` | `#f8da9d` | `#deb4333D` | Warning bg |
| `--color-on-warning` | `#171717` | `#171717` | Text trên warning |

**Tint Colors** (Blue, Cyan, Gray, Green, Orange, Pink, Purple, Red, Teal, Yellow): mỗi màu có 4 biến thể `background / border / icon / text` (light/dark).

**Data Viz Colors**: `--color-data-categorical-{blue,orange,purple,green,pink,cyan,red,teal,brown,indigo}` + `--color-data-neutral`.

**Syntax Colors**: `--color-syntax-{keyword,string,comment,number,function,type,variable,operator,constant,tag,attribute,property,punctuation,background}`.

### 1.2. Spacing Tokens (4px base-unit)

| Token | Giá trị | Token | Giá trị |
|-------|---------|-------|---------|
| `--spacing-0` | `0px` | `--spacing-7` | `28px` |
| `--spacing-0-5` | `2px` | `--spacing-8` | `32px` |
| `--spacing-1` | `4px` | `--spacing-9` | `36px` |
| `--spacing-1-5` | `6px` | `--spacing-10` | `40px` |
| `--spacing-2` | `8px` | `--spacing-11` | `44px` |
| `--spacing-3` | `12px` | `--spacing-12` | `48px` |
| `--spacing-4` | `16px` | `--spacing-14` | `56px` |
| `--spacing-5` | `20px` | `--spacing-16` | `64px` |
| `--spacing-6` | `24px` | `--spacing-20` | `80px` |

### 1.3. Typography Tokens (geometric scale, base 14px, ratio 1.2)

**Font Family:**

| Token | Giá trị |
|-------|---------|
| `--font-family-body` | `Figtree` |
| `--font-family-heading` | `Figtree` |
| `--font-family-code` | `"SF Mono"` |

**Font Size:**

| Token | Value | Token | Value |
|-------|-------|-------|-------|
| `--font-size-4xs` | `0.375rem` | `--font-size-xl` | `1.25rem` |
| `--font-size-3xs` | `0.4375rem` | `--font-size-2xl` | `1.5rem` |
| `--font-size-2xs` | `0.5rem` | `--font-size-3xl` | `1.8125rem` |
| `--font-size-xs` | `0.625rem` | `--font-size-4xl` | `2.1875rem` |
| `--font-size-sm` | `0.75rem` | `--font-size-5xl` | `2.625rem` |
| `--font-size-base` | `0.875rem` | | |
| `--font-size-lg` | `1.0625rem` | | |

**Font Weight:**

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--font-weight-normal` | `400` | Body, code |
| `--font-weight-medium` | `500` | Labels, data |
| `--font-weight-semibold` | `600` | Headings, titles |
| `--font-weight-bold` | `700` | Strong emphasis |

**Type Scale Semantics:** H1–H6, Display 1–3, Large, Body, Label, Code, Supporting (xem `daft.md` §3.3 cho size/weight/line-height/gap đầy đủ).

### 1.4. Shape / Radius Tokens

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--radius-none` | `0px` | Sharp |
| `--radius-inner` | `8px` | Inner elements |
| `--radius-element` | `12px` | Buttons, inputs, selectors |
| `--radius-container` | `16px` | Cards, panels, dialogs |
| `--radius-page` | `32px` | Page-level containers |
| `--radius-chat` | `28px` | Chat bubbles |
| `--radius-full` | `9999px` | Pills, badges, tags, avatar status |

**Concentric radius rule:** inner element = `max(0, outerRadius - padding)`.

### 1.5. Elevation / Shadow Tokens

| Token | Ý nghĩa |
|-------|---------|
| `--shadow-low` | Surface in-flow, tách biệt khỏi bg |
| `--shadow-med` | Float trên content gần (popover, FAB) |
| `--shadow-high` | Topmost (modal, fullscreen overlay) |
| `--shadow-inset-hover` | Hover state ring inset |
| `--shadow-inset-selected` | Selected state ring inset |
| `--shadow-inset-success` | Success state ring inset |
| `--shadow-inset-warning` | Warning state ring inset |
| `--shadow-inset-error` | Error state ring inset |

**Elevation usage:** `none` (flat, embedded) · `low` (raised card) · `med` (popover/FAB) · `high` (modal/overlay).

### 1.6. Motion Tokens

**Duration:**

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--duration-fast-min` | `130ms` | Micro-interactions |
| `--duration-fast` | `175ms` | Hover, small transitions |
| `--duration-fast-max` | `230ms` | Micro max |
| `--duration-medium-min` | `310ms` | Entrance/exit min |
| `--duration-medium` | `410ms` | Panel, dialog, expand |
| `--duration-medium-max` | `550ms` | Entrance/exit max |
| `--duration-slow-min` | `730ms` | Continuous min |
| `--duration-slow` | `975ms` | Continuous |
| `--duration-slow-max` | `1300ms` | Continuous max |

**Easing:** `--ease-standard` = `cubic-bezier(0.24, 1, 0.4, 1)`.

**Motion principles:** animate khi orient user; không animate high-frequency; exit match entrance; direction match action; contextual UI connect to trigger; reduced motion.

### 1.7. Size & Border Tokens

| Token | Giá trị | Ý nghĩa |
|-------|---------|---------|
| `--size-element-sm` | `28px` | Small control height |
| `--size-element-md` | `32px` | Medium control height |
| `--size-element-lg` | `36px` | Large control height |
| `--border-width` | `1px` | Default border width |

---

## 2. Phase 1 — Generic Core Atoms (10)

> Xuất hiện 9/9 nguồn. Nền tảng mọi UI. Build trước tiên.

### 2.1. Button

- **Props:**
  ```ts
  interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'  // default 'primary'
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean
    loading?: boolean
    fullWidth?: boolean
    iconStart?: IconName
    iconEnd?: IconName
    type?: 'button' | 'submit' | 'reset'                                       // default 'button'
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    children?: ReactNode
    elevation?: 'none' | 'low' | 'med' | 'high'                                // default 'none'
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - bg: `--color-accent` (primary) / `--color-accent-muted` (secondary) / transparent (outline/ghost) / `--color-error` (destructive)
  - text: `--color-on-accent` (primary) / `--color-text-primary` (secondary) / `--color-error` (outline) / `--color-text-primary` (ghost)
  - border: `--color-border` (outline) / transparent (others)
  - radius: `--radius-element`
  - height: `--size-element-{sm|md|lg}`
  - padding: `--spacing-3` (sm) / `--spacing-4` (md) / `--spacing-5` (lg)
  - font: `--font-size-sm` (sm) / `--font-size-base` (md/lg) · `--font-weight-medium`
  - shadow: `--shadow-{low|med|high}` khi elevation ≠ none
- **Variants:** primary, secondary, outline, ghost, destructive
- **States:**
  - hover: bg overlay `--color-overlay-hover`
  - active: bg overlay `--color-overlay-pressed` + scale `0.97` (duration `--duration-fast`, ease `--ease-standard`)
  - focus-visible: ring `--color-accent` 2px offset 2px
  - disabled: `--color-text-disabled` + `aria-disabled` + cursor not-allowed
  - loading: Spinner thay iconStart + `aria-busy="true"` + click disabled
- **Accessibility:** touch target ≥ 40px (desktop) / 44px (mobile); `type="button"` default; `aria-disabled` khi loading; focus ring `:focus-visible`; reduced motion bỏ scale

### 2.2. Input

- **Props:**
  ```ts
  interface InputProps {
    value: string                                                              // controlled
    onChange: (value: string) => void                                          // controlled
    type?: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' // default 'text'
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    placeholder?: string
    disabled?: boolean
    readOnly?: boolean
    invalid?: boolean
    iconStart?: IconName
    iconEnd?: IconName
    autoFocus?: boolean
    maxLength?: number
    name?: string
    ariaLabel?: string
    ariaDescribedBy?: string
  }
  ```
- **Token mapping:**
  - bg: `--color-background-surface`
  - text: `--color-text-primary`
  - placeholder: `--color-text-secondary`
  - border: `--color-border` (default) / `--color-error` (invalid) / `--color-border-emphasized` (focus)
  - radius: `--radius-element`
  - height: `--size-element-{sm|md|lg}`
  - padding: `--spacing-3` (sm) / `--spacing-4` (md/lg); +`--spacing-6` khi có icon
  - font: `--font-size-base` · `--font-weight-normal`
  - icon color: `--color-icon-secondary`
- **Variants:** theo `type` (text/email/password/search/url/tel/number)
- **States:**
  - hover: border `--color-border-emphasized`
  - focus: border `--color-border-emphasized` + ring `--color-accent` 2px
  - invalid: border `--color-error` + ring `--color-error` 2px
  - disabled: bg `--color-background-muted` + text `--color-text-disabled` + `aria-disabled`
  - readOnly: giống default nhưng cursor default
- **Accessibility:** controlled (`value`+`onChange`); `aria-invalid` khi invalid; `aria-describedby` link error text; focus ring `:focus-visible`; label liên kết qua `ariaLabel` hoặc `<Label htmlFor>`

### 2.3. Label

- **Props:**
  ```ts
  interface LabelProps {
    htmlFor?: string
    children: ReactNode
    required?: boolean                                                         // hiển thị asterisk
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary` (default) / `--color-text-disabled` (disabled)
  - font: `--font-size-sm` (sm) / `--font-size-base` (md) / `--font-size-lg` (lg) · `--font-weight-medium`
  - margin-bottom: `--spacing-1-5`
  - required asterisk: `--color-error`
- **Variants:** theo size
- **States:** default, disabled
- **Accessibility:** `<label htmlFor>` liên kết input; asterisk có `aria-label="required"`; không dùng `<div>` giả label

### 2.4. Text

- **Props:**
  ```ts
  interface TextProps {
    children: ReactNode
    variant?: 'body' | 'supporting' | 'large' | 'code'                         // default 'body'
    weight?: 'normal' | 'medium' | 'semibold' | 'bold'                         // override variant
    align?: 'start' | 'center' | 'end' | 'justify'
    truncate?: boolean                                                         // 1 line ellipsis
    clamp?: number                                                             // N line clamp
    as?: 'p' | 'span' | 'div'                                                  // default 'p'
    color?: 'primary' | 'secondary' | 'accent' | 'disabled' | 'error' | 'success' | 'warning'  // default 'primary'
  }
  ```
- **Token mapping:**
  - text: `--color-text-{primary|secondary|accent|disabled}` / `--color-{error|success|warning}`
  - font-size + line-height + weight: theo variant (Body `--font-size-base`/`1.4286`/`400`; Supporting `--font-size-sm`/`1.6667`/`400`; Large `--font-size-lg`/`1.4118`/`600`; Code `--font-size-base`/`1.4286`/`400` + `--font-family-code`)
  - font-family: `--font-family-body` (default) / `--font-family-code` (code)
- **Variants:** body, supporting, large, code
- **States:** default (không interactive state)
- **Accessibility:** semantic `as` prop; `truncate`/`clamp` giữ `title` attribute khi truncate để screen reader đọc full; không dùng `<div>` cho text block — dùng `<p>`/`<span>`

### 2.5. Icon

- **Props:**
  ```ts
  interface IconProps {
    name: IconName                                                             // từ ICON_CATALOG
    size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'                            // default 'md'
    color?: 'primary' | 'secondary' | 'accent' | 'disabled' | 'on-accent' | 'success' | 'error' | 'warning' | 'info'  // default 'primary'
    spin?: boolean                                                             // loading icon
    ariaLabel?: string                                                         // decorative nếu omit → aria-hidden
  }
  ```
- **Token mapping:**
  - color: `--color-icon-{primary|secondary|accent|disabled}` / `--color-on-accent` / `--color-{success|error|warning}` / tint `info`
  - size: `--font-size-{2xs|xs|sm|base|lg|xl}` (icon scale theo font-size)
- **Variants:** theo size + color
- **States:** spin (rotate 360° loop, duration `--duration-slow`, ease linear); reduced motion → tắt spin
- **Accessibility:** nếu `ariaLabel` omit → `aria-hidden="true"` (decorative); nếu có → `<svg role="img" aria-label>`; import từ `ICON_CATALOG`, không inline SVG

### 2.6. Badge

- **Props:**
  ```ts
  interface BadgeProps {
    children: ReactNode                                                        // count hoặc enumerated label ("3", "99+", "NEW")
    variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info'  // default 'neutral'
    size?: 'sm' | 'md'                                                         // default 'md'
    max?: number                                                               // "99+" khi vượt max
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted` (neutral) / `--color-accent` (accent) / `--color-{success|warning|error}-muted` / tint `info` bg
  - text: `--color-text-primary` (neutral) / `--color-on-accent` (accent) / `--color-{success|warning|error}` / tint `info` text
  - radius: `--radius-full` (pill)
  - padding: `--spacing-0-5` `--spacing-1-5` (sm) / `--spacing-1` `--spacing-2` (md)
  - font: `--font-size-2xs` (sm) / `--font-size-xs` (md) · `--font-weight-medium`
- **Variants:** neutral, accent, success, warning, error, info
- **States:** default (không interactive)
- **Accessibility:** `<span>`; nếu là count → `aria-label="N unread"` (không chỉ "3"); **chỉ cho count/enumerated states** — status dùng StatusDot/Token (anti-pattern daft.md)

### 2.7. Checkbox

- **Props:**
  ```ts
  interface CheckboxProps {
    checked: boolean                                                           // controlled
    onChange: (checked: boolean) => void                                       // controlled
    disabled?: boolean
    invalid?: boolean
    indeterminate?: boolean
    name?: string
    value?: string
    ariaLabel?: string
    ariaDescribedBy?: string
  }
  ```
- **Token mapping:**
  - box bg: `--color-accent` (checked) / `--color-background-surface` (unchecked)
  - check icon: `--color-on-accent`
  - border: `--color-border` (unchecked) / `--color-border-emphasized` (hover) / `--color-error` (invalid)
  - radius: `--radius-inner`
  - size: `--size-element-sm` (box 16-20px, touch target 40px min via padding)
  - indeterminate: dash icon thay check
- **Variants:** checked, unchecked, indeterminate
- **States:**
  - hover: border `--color-border-emphasized`
  - focus-visible: ring `--color-accent` 2px offset 2px
  - disabled: `--color-text-disabled` + `aria-disabled`
  - invalid: border `--color-error` + `aria-invalid`
- **Accessibility:** controlled; `aria-checked` (true/false/mixed); touch target 40px; `<input type="checkbox">` ẩn + visual overlay; label liên kết qua `ariaLabel` hoặc `<Label htmlFor>`

### 2.8. Switch

- **Props:**
  ```ts
  interface SwitchProps {
    checked: boolean                                                           // controlled
    onChange: (checked: boolean) => void                                       // controlled
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    name?: string
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - track bg: `--color-accent` (on) / `--color-track` (off)
  - thumb bg: `--color-on-accent` (on) / `--color-background-surface` (off)
  - radius: `--radius-full` (track + thumb)
  - track size: `--size-element-sm` height × 1.6 width (sm) / `--size-element-md` × 1.6 (md) / `--size-element-lg` × 1.6 (lg)
  - thumb translate: `--duration-fast` `--ease-standard`
- **Variants:** theo size
- **States:**
  - hover: track overlay `--color-overlay-hover`
  - focus-visible: ring `--color-accent` 2px
  - disabled: `--color-text-disabled` + `aria-disabled` + thumb `--color-text-disabled`
- **Accessibility:** controlled; `role="switch"` + `aria-checked`; `<input type="checkbox">` ẩn + visual; touch target 40px; reduced motion bỏ translate animation

### 2.9. Avatar

- **Props:**
  ```ts
  interface AvatarProps {
    src?: string
    alt?: string
    fallback?: string                                                          // initials hoặc text
    size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'                    // default 'md'
    shape?: 'circle' | 'square'                                                // default 'circle'
    status?: 'online' | 'offline' | 'busy' | 'away'                            // status dot overlay
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted` (fallback)
  - text: `--color-text-secondary` (fallback initials)
  - radius: `--radius-full` (circle) / `--radius-inner` (square)
  - size: `--font-size-{2xs..2xl}` × 2 (avatar scale)
  - status dot: `--color-success` (online) / `--color-text-secondary` (offline) / `--color-error` (busy) / `--color-warning` (away)
- **Variants:** theo size + shape + status
- **States:**
  - image error: hiển thị fallback (initials hoặc icon)
  - loading: Skeleton shimmer `--color-skeleton`
- **Accessibility:** `<img alt>` bắt buộc khi có src (không để empty); fallback có `aria-label`; status dot có `aria-label="status: online"`; decorative avatar (icon) → `aria-hidden`

### 2.10. Separator

- **Props:**
  ```ts
  interface SeparatorProps {
    orientation?: 'horizontal' | 'vertical'                                    // default 'horizontal'
    variant?: 'solid' | 'dashed' | 'dotted'                                    // default 'solid'
    decorative?: boolean                                                       // default true → aria-hidden
  }
  ```
- **Token mapping:**
  - color: `--color-border`
  - thickness: `--border-width`
  - length: 100% (horizontal) / 100% parent height (vertical)
- **Variants:** solid, dashed, dotted
- **States:** default (không interactive)
- **Accessibility:** `<hr>` (horizontal) / `<div role="separator">` (vertical); `decorative=true` → `aria-hidden="true"`; `decorative=false` → `role="separator" aria-orientation`

---

## 3. Phase 2 — Layout + Utility Atoms (12)

> Layout primitives neutral (frame-first), không opinionated. Utility atoms hỗ trợ composition.

### 3.1. Box

- **Props:**
  ```ts
  interface BoxProps {
    children?: ReactNode
    as?: 'div' | 'section' | 'article' | 'main' | 'aside' | 'header' | 'footer' | 'nav'  // default 'div'
    padding?: SpacingToken                                                     // --spacing-* (không default — neutral)
    bg?: 'surface' | 'body' | 'muted' | 'card' | 'popover' | 'inverted' | 'transparent'  // default 'transparent'
    radius?: RadiusToken                                                       // --radius-*
    elevation?: 'none' | 'low' | 'med' | 'high'                                // default 'none'
    border?: boolean                                                           // --color-border
    id?: string
    className?: string
  }
  ```
- **Token mapping:**
  - bg: `--color-background-{surface|body|muted|card|popover|inverted}` / transparent
  - border: `--color-border` `--border-width`
  - radius: `--radius-{none|inner|element|container|page|full}`
  - padding: `--spacing-*` (chỉ khi prop truyền)
  - shadow: `--shadow-{low|med|high}` khi elevation ≠ none
- **Variants:** theo `as` + bg + radius + elevation
- **States:** default (không interactive)
- **Accessibility:** `as` prop quyết định semantic role; không tự thêm ARIA; neutral — không padding/gap cố định (frame-first)

### 3.2. Flex

- **Props:**
  ```ts
  interface FlexProps {
    children?: ReactNode
    direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'           // default 'row'
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'     // default 'start'
    align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'                // default 'stretch'
    wrap?: 'nowrap' | 'wrap' | 'wrap-reverse'                                  // default 'nowrap'
    gap?: SpacingToken                                                         // --spacing-* (không default)
    inline?: boolean                                                           // display: inline-flex
  }
  ```
- **Token mapping:**
  - gap: `--spacing-*` (chỉ khi prop truyền)
  - không color/radius/padding (neutral)
- **Variants:** theo direction + justify + align + wrap
- **States:** default
- **Accessibility:** `<div>` neutral; không semantic role — dùng `as` qua Box nếu cần semantic

### 3.3. Grid

- **Props:**
  ```ts
  interface GridProps {
    children?: ReactNode
    columns?: number | string                                                  // số cột hoặc grid-template-columns
    rows?: number | string
    gap?: SpacingToken
    columnGap?: SpacingToken
    rowGap?: SpacingToken
    areas?: string                                                             // grid-template-areas
    inline?: boolean
  }
  ```
- **Token mapping:**
  - gap/columnGap/rowGap: `--spacing-*`
- **Variants:** theo columns/rows/areas
- **States:** default
- **Accessibility:** `<div>` neutral; responsive grid qua `columns` (object `{ base, sm, md, lg }`)

### 3.4. Stack (VStack / HStack)

- **Props:**
  ```ts
  interface StackProps {
    children?: ReactNode
    direction?: 'vertical' | 'horizontal'                                      // default 'vertical' (VStack)
    gap?: SpacingToken                                                         // --spacing-* (không default — neutral)
    align?: 'start' | 'center' | 'end' | 'stretch'                             // default 'stretch'
    justify?: 'start' | 'center' | 'end' | 'between'
    divider?: boolean                                                          // render Separator giữa children
  }
  ```
- **Token mapping:**
  - gap: `--spacing-*`
  - divider: Separator (color `--color-border`)
- **Variants:** VStack (vertical), HStack (horizontal)
- **States:** default
- **Accessibility:** `<div>` neutral; divider dùng Separator với `decorative=true`

### 3.5. Container

- **Props:**
  ```ts
  interface ContainerProps {
    children?: ReactNode
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | number                     // default 'lg'
    padding?: SpacingToken                                                     // default --spacing-4
    center?: boolean                                                           // margin auto, default true
  }
  ```
- **Token mapping:**
  - maxWidth: `sm=480px` / `md=640px` / `lg=800px` / `xl=1024px` / `full=100%`
  - padding: `--spacing-*`
- **Variants:** theo maxWidth
- **States:** default
- **Accessibility:** `<div>` neutral; dùng cho page content wrapper

### 3.6. AspectRatio

- **Props:**
  ```ts
  interface AspectRatioProps {
    children?: ReactNode
    ratio?: number                                                             // width/height, default 16/9
    maxWidth?: number                                                          // optional cap
  }
  ```
- **Token mapping:**
  - không color/spacing (pure ratio)
- **Variants:** theo ratio (1, 16/9, 4/3, 3/2, 1/2...)
- **States:** default
- **Accessibility:** `<div style="aspect-ratio">` (CSS native); child fill 100% × 100%

### 3.7. Spinner

- **Props:**
  ```ts
  interface SpinnerProps {
    size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'                            // default 'md'
    color?: 'primary' | 'secondary' | 'accent' | 'on-accent' | 'current'       // default 'primary'
    ariaLabel?: string                                                         // default "Loading"
  }
  ```
- **Token mapping:**
  - color: `--color-icon-{primary|secondary|accent}` / `--color-on-accent` / `currentColor`
  - size: `--font-size-{2xs..xl}`
- **Variants:** theo size + color
- **States:** spinning (rotate 360° loop, duration `--duration-slow`, ease linear); reduced motion → tắt spin, hiển thị static
- **Accessibility:** `<svg role="status" aria-label="Loading">`; decorative → `aria-hidden`; `prefers-reduced-motion` tắt animation

### 3.8. Progress

- **Props:**
  ```ts
  interface ProgressProps {
    value: number                                                              // 0-100 (controlled)
    max?: number                                                               // default 100
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    variant?: 'linear' | 'circular'                                            // default 'linear'
    color?: 'accent' | 'success' | 'warning' | 'error'                         // default 'accent'
    indeterminate?: boolean
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - track: `--color-track`
  - fill: `--color-accent` (accent) / `--color-{success|warning|error}`
  - height: `--spacing-1` (sm) / `--spacing-1-5` (md) / `--spacing-2` (lg) (linear)
  - radius: `--radius-full` (track + fill)
  - circular stroke width: 4px (sm) / 6px (md) / 8px (lg)
- **Variants:** linear, circular
- **States:** indeterminate (animation loop); reduced motion → static fill
- **Accessibility:** `<progress value max>` (linear) hoặc `<svg role="progressbar">` (circular); `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-label`

### 3.9. Link

- **Props:**
  ```ts
  interface LinkProps {
    children: ReactNode
    href: string
    external?: boolean                                                         // target=_blank + rel=noopener + externalLink icon
    variant?: 'inline' | 'standalone'                                          // default 'inline'
    disabled?: boolean
    onClick?: (e: MouseEvent) => void
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - text: `--color-text-accent` (default) / `--color-text-disabled` (disabled)
  - underline: inline (underline always) / standalone (no underline, hover underline)
  - external icon: `--color-icon-accent`, size `--font-size-xs`
- **Variants:** inline, standalone
- **States:**
  - hover: underline + overlay `--color-overlay-hover`
  - focus-visible: ring `--color-accent` 2px
  - disabled: `--color-text-disabled` + `aria-disabled`
- **Accessibility:** dùng `useLinkComponent()` (không hardcode `<a>`) — consumer plug router; external → `rel="noopener noreferrer"` + `aria-label` có "opens in new tab"; focus ring `:focus-visible`

### 3.10. Kbd

- **Props:**
  ```ts
  interface KbdProps {
    children: ReactNode                                                        // key name: "Ctrl", "Enter", "⌘"
    size?: 'sm' | 'md'                                                         // default 'md'
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted`
  - text: `--color-text-primary`
  - border: `--color-border` `--border-width`
  - radius: `--radius-inner`
  - padding: `--spacing-0-5` `--spacing-1` (sm) / `--spacing-1` `--spacing-1-5` (md)
  - font: `--font-family-code` · `--font-size-xs` (sm) / `--font-size-sm` (md) · `--font-weight-medium`
  - shadow: `--shadow-inset-hover` (subtle inset cho key depth)
- **Variants:** theo size
- **States:** default
- **Accessibility:** `<kbd>` semantic; group keys bằng `<kbd>Ctrl</kbd>+<kbd>K</kbd>` (dấu + ngoài)

### 3.11. Overlay

- **Props:**
  ```ts
  interface OverlayProps {
    children?: ReactNode
    visible: boolean                                                           // controlled
    onClick?: () => void                                                       // click backdrop dismiss
    elevation?: 'low' | 'med' | 'high'                                         // default 'med'
    blur?: boolean                                                             // backdrop-filter blur
  }
  ```
- **Token mapping:**
  - bg: `--color-overlay`
  - blur: `backdrop-filter: blur(4px)` (khi blur=true)
  - z-index: theo elevation (low=10, med=100, high=1000)
- **Variants:** theo elevation
- **States:**
  - enter: opacity 0→1, duration `--duration-medium-min` `--ease-standard`
  - exit: opacity 1→0, duration `--duration-fast-max`
  - reduced motion: instant
- **Accessibility:** `<div role="presentation">` hoặc `role="dialog"` (khi chứa modal); click dismiss cần `onKeyDown Escape` handler; không trap focus (FocusTrap atom riêng)

### 3.12. Section

- **Props:**
  ```ts
  interface SectionProps {
    children?: ReactNode
    as?: 'section' | 'article' | 'main' | 'aside' | 'header' | 'footer' | 'nav'  // default 'section'
    padding?: SpacingToken                                                     // default --spacing-6
    gap?: SpacingToken                                                         // gap giữa children
    ariaLabel?: string
    ariaLabelledBy?: string                                                    // id của heading bên trong
  }
  ```
- **Token mapping:**
  - padding: `--spacing-*`
  - gap: `--spacing-*`
  - không bg/border (neutral — content quyết định)
- **Variants:** theo `as`
- **States:** default
- **Accessibility:** `<section aria-label>` hoặc `aria-labelledby` link heading; semantic landmark role; không dùng `<div>` giả section

---

## 4. Phase 3 — Display Atoms từ Astryx (7)

> Chỉ ATOM thật từ Astryx Content category. 11 component khác (CodeBlock, Markdown, EmptyState, Item, Token, Banner, MoreMenu, FileInput, NumberInput, TimeInput, DateInput) là MOLECULE → không nằm đây.

### 4.1. Heading

- **Props:**
  ```ts
  interface HeadingProps {
    children: ReactNode
    level?: 1 | 2 | 3 | 4 | 5 | 6                                              // default 2 → <h2>
    size?: 'display3' | 'display2' | 'display1' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'  // override level default
    align?: 'start' | 'center' | 'end'
    truncate?: boolean
    id?: string                                                                // cho aria-labelledby
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary`
  - font: theo size (Display 1 `--font-size-5xl`/`600`/`1.2381`; H1 `--font-size-2xl`/`600`/`1.3333`; H2 `--font-size-xl`/`600`/`1.4`; H3 `--font-size-lg`/`600`/`1.4118`; H4 `--font-size-base`/`600`/`1.4286`; H5 `--font-size-sm`/`600`/`1.6667`; H6 `--font-size-xs`/`600`/`1.6`)
  - font-family: `--font-family-heading`
  - margin: 0 (consumer quyết định spacing)
- **Variants:** theo level + size
- **States:** default
- **Accessibility:** `<h1>`–`<h6>` semantic; `level` quyết định tag, `size` chỉ visual (có thể decouple); 1 `<h1>` duy nhất/page; `id` cho `aria-labelledby`

### 4.2. Thumbnail

- **Props:**
  ```ts
  interface ThumbnailProps {
    src?: string
    alt?: string
    fallback?: ReactNode                                                       // icon hoặc placeholder khi no src/error
    ratio?: number                                                             // default 16/9
    size?: 'sm' | 'md' | 'lg' | 'xl'                                           // fixed size override (bỏ ratio)
    fit?: 'cover' | 'contain' | 'fill'                                         // default 'cover'
    rounded?: boolean                                                          // default true (--radius-inner)
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted` (fallback)
  - radius: `--radius-inner` (rounded) / `--radius-none`
  - fallback icon: `--color-icon-secondary`
- **Variants:** theo ratio + size + fit
- **States:**
  - loading: Skeleton `--color-skeleton`
  - error: hiển thị fallback
- **Accessibility:** `<img alt>` bắt buộc khi có src; decorative thumbnail → `alt=""` + `aria-hidden`; fallback có `aria-label`

### 4.3. Timestamp

- **Props:**
  ```ts
  interface TimestampProps {
    value: number | string | Date                                              // timestamp hoặc Date
    format?: 'relative' | 'absolute' | 'time' | 'datetime'                     // default 'relative'
    locale?: string                                                            // default từ i18n
    showSeconds?: boolean
    ariaLabel?: string                                                         // full datetime cho SR
  }
  ```
- **Token mapping:**
  - text: `--color-text-secondary`
  - font: `--font-size-sm` · `--font-weight-normal` · `--font-family-body`
- **Variants:** relative ("2 phút trước"), absolute ("30/07/2026"), time ("14:30"), datetime ("30/07/2026 14:30")
- **States:** default
- **Accessibility:** `<time datetime={isoValue}>`; `aria-label` full datetime (relative text khó hiểu với SR); format = pure function (testable)

### 4.4. Blockquote

- **Props:**
  ```ts
  interface BlockquoteProps {
    children: ReactNode
    cite?: string                                                              // URL source
    variant?: 'default' | 'bordered'                                           // default 'default'
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary`
  - font: `--font-size-lg` · `--font-weight-normal` · italic
  - border-left: `--color-border-emphasized` `--spacing-1` (bordered variant)
  - padding: `--spacing-4` `--spacing-5` (bordered)
  - radius: `--radius-inner` (bordered)
- **Variants:** default (italic only), bordered (left border + padding)
- **States:** default
- **Accessibility:** `<blockquote cite={url}>`; `<cite>` bên trong qua Citation atom; không dùng `<div>` giả blockquote

### 4.5. Citation

- **Props:**
  ```ts
  interface CitationProps {
    children: ReactNode                                                        // source name
    href?: string                                                              // link to source
  }
  ```
- **Token mapping:**
  - text: `--color-text-secondary`
  - font: `--font-size-sm` · `--font-weight-normal`
  - link (khi href): `--color-text-accent` underline
- **Variants:** text, link
- **States:**
  - hover (link): `--color-overlay-hover`
  - focus-visible (link): ring `--color-accent`
- **Accessibility:** `<cite>` semantic; khi có href → Link atom bên trong; dùng trong Blockquote

### 4.6. Code

- **Props:**
  ```ts
  interface CodeProps {
    children: ReactNode                                                        // inline code (không phải block — CodeBlock là molecule)
    language?: string                                                          // hint cho color (không parse)
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted`
  - text: `--color-text-primary` (default) / `--color-syntax-{keyword|string|...}` (khi language + syntax highlight molecule wrap)
  - font: `--font-family-code` · `--font-size-sm` (inline) · `--font-weight-normal`
  - padding: `--spacing-0-5` `--spacing-1`
  - radius: `--radius-inner`
  - border: `--color-border` `--border-width`
- **Variants:** inline (default)
- **States:** default
- **Accessibility:** `<code>` semantic; inline only — block code dùng CodeBlock (molecule, syntax highlight); `language` prop chỉ metadata

### 4.7. StatusDot

- **Props:**
  ```ts
  interface StatusDotProps {
    status?: 'success' | 'warning' | 'error' | 'info' | 'neutral'              // default 'neutral'
    size?: 'sm' | 'md'                                                         // default 'sm' (8px/10px)
    pulse?: boolean                                                            // pulse animation cho "live" status
    ariaLabel?: string                                                         // bắt buộc — dot không có text
  }
  ```
- **Token mapping:**
  - bg: `--color-{success|warning|error}` / tint `info` / `--color-text-secondary` (neutral)
  - size: 8px (sm) / 10px (md)
  - radius: `--radius-full`
  - pulse ring: cùng color, opacity animate 1→0, scale 1→1.5, duration `--duration-slow`
- **Variants:** theo status + size
- **States:** pulse (live indicator); reduced motion → tắt pulse
- **Accessibility:** `<span role="img" aria-label>` — **bắt buộc** `ariaLabel` vì dot không có text; không dùng cho decoration; phân biệt với Badge (Badge = count, StatusDot = dot không text)

---

## 5. Phase 4 — Extension Atoms (12)

> Đặc thù Chrome extension: popup, side panel, floating/overlay UI. Space-constrained, cần positioning/resize controls. Mỗi atom chỉ wrapper 1 HTML element (Button hoặc span/div) — không import atom khác.

### 5.1. IconButton

- **Props:**
  ```ts
  interface IconButtonProps {
    icon: IconName                                                             // bắt buộc — từ ICON_CATALOG
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    variant?: 'solid' | 'outline' | 'ghost' | 'transparent'                    // default 'ghost'
    disabled?: boolean
    loading?: boolean
    active?: boolean                                                           // toggle state (pressed)
    ariaLabel: string                                                          // BẮT BUỘC — không có text
    ariaPressed?: boolean                                                      // toggle button
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  }
  ```
- **Token mapping:**
  - bg: `--color-accent` (solid) / transparent (outline/ghost/transparent)
  - icon: `--color-on-accent` (solid) / `--color-icon-primary` (ghost) / `--color-icon-secondary` (transparent)
  - border: `--color-border` (outline)
  - radius: `--radius-element`
  - size: `--size-element-{sm|md|lg}` (square)
  - icon size: `--font-size-{sm|base|lg}`
  - active: bg `--color-accent-muted` + icon `--color-icon-accent`
- **Variants:** solid, outline, ghost, transparent
- **States:**
  - hover: overlay `--color-overlay-hover`
  - active (press): overlay `--color-overlay-pressed` + scale 0.95
  - focus-visible: ring `--color-accent` 2px
  - disabled: `--color-icon-disabled` + `aria-disabled`
  - loading: Spinner thay icon + `aria-busy`
- **Accessibility:** `aria-label` **bắt buộc** (không text); `aria-pressed` khi toggle; touch target 40px; `type="button"` default; focus `:focus-visible`

### 5.2. Chip

- **Props:**
  ```ts
  interface ChipProps {
    children: ReactNode                                                        // label text
    selected?: boolean                                                         // controlled selection state
    disabled?: boolean
    size?: 'sm' | 'md'                                                         // default 'md'
    iconStart?: IconName
    onClick?: () => void                                                       // selectable chip
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted` (default) / `--color-accent` (selected)
  - text: `--color-text-primary` (default) / `--color-on-accent` (selected)
  - icon: `--color-icon-secondary` (default) / `--color-on-accent` (selected)
  - border: `--color-border` (default) / transparent (selected)
  - radius: `--radius-full` (pill)
  - padding: `--spacing-1` `--spacing-2` (sm) / `--spacing-1-5` `--spacing-3` (md)
  - font: `--font-size-xs` (sm) / `--font-size-sm` (md) · `--font-weight-medium`
- **Variants:** default, selected
- **States:**
  - hover: overlay `--color-overlay-hover`
  - focus-visible: ring `--color-accent` 2px
  - disabled: `--color-text-disabled` + `aria-disabled`
- **Accessibility:** `<button>` khi onClick (selectable) / `<span>` khi display only; `aria-pressed` khi selected; touch target 40px; phân biệt Badge (count) / Token (removable, molecule) / StatusDot (dot)

### 5.3. CloseButton

- **Props:**
  ```ts
  interface CloseButtonProps {
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    variant?: 'ghost' | 'solid'                                                // default 'ghost'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Close"
    onClick?: () => void
  }
  ```
- **Token mapping:**
  - như IconButton variant ghost/solid
  - icon: `close` (từ ICON_CATALOG)
- **Variants:** ghost, solid
- **States:** như IconButton
- **Accessibility:** `aria-label="Close"` default; dùng trong dialog/popover/banner (molecule) — bản thân là atom; `type="button"`

### 5.4. CopyButton

- **Props:**
  ```ts
  interface CopyButtonProps {
    value: string                                                              // text to copy
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    variant?: 'ghost' | 'outline'                                              // default 'ghost'
    copiedDuration?: number                                                    // ms hiển thị "copied" state, default 2000
    ariaLabel?: string                                                         // default "Copy to clipboard"
    onCopy?: (value: string, success: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon default: `copy`; icon copied: `checkDouble`
  - copied state: icon `--color-success`
- **Variants:** ghost, outline
- **States:**
  - default: icon `copy`
  - copied: icon `checkDouble` + `--color-success`, duration `copiedDuration` rồi revert
  - hover/focus/disabled: như IconButton
- **Accessibility:** `aria-label="Copy to clipboard"`; `aria-live="polite"` khi copied ("Copied"); dùng `navigator.clipboard.writeText`; `type="button"`

### 5.5. DragHandle

- **Props:**
  ```ts
  interface DragHandleProps {
    orientation?: 'horizontal' | 'vertical'                                    // default 'horizontal'
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Drag to move"
    onDragStart?: (e: DragEvent) => void
    onDragMove?: (e: DragEvent) => void
    onDragEnd?: (e: DragEvent) => void
  }
  ```
- **Token mapping:**
  - bg: transparent
  - handle grip: `--color-icon-secondary` (default) / `--color-icon-primary` (hover) / `--color-icon-disabled` (disabled)
  - size: `--size-element-{sm|md|lg}` (touch target)
  - grip icon: 6 dots (2×3) hoặc 4 dots (2×2)
- **Variants:** theo orientation + size
- **States:**
  - hover: grip `--color-icon-primary`
  - active (dragging): grip `--color-icon-accent` + cursor grabbing
  - disabled: `--color-icon-disabled` + `aria-disabled`
- **Accessibility:** `role="button"` + `aria-label`; `tabindex=0` + keyboard arrow handler; `draggable=true`; touch target 40px; cursor grab/grabbing

### 5.6. ResizeHandle

- **Props:**
  ```ts
  interface ResizeHandleProps {
    direction?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'              // default 'se'
    size?: 'sm' | 'md'                                                         // default 'sm'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Drag to resize"
    onResizeStart?: (e: PointerEvent) => void
    onResize?: (width: number, height: number) => void
    onResizeEnd?: () => void
    minSize?: { width: number; height: number }
    maxSize?: { width: number; height: number }
  }
  ```
- **Token mapping:**
  - bg: transparent
  - handle grip: `--color-icon-secondary` (default) / `--color-icon-primary` (hover)
  - size: 8px (sm) / 12px (md) grip area; touch target 20px (padding mở rộng)
- **Variants:** theo direction
- **States:**
  - hover: grip `--color-icon-primary` + cursor theo direction (nwse/nesw)
  - active (resizing): grip `--color-icon-accent`
  - disabled: `--color-icon-disabled` + `aria-disabled`
- **Accessibility:** `role="separator" aria-orientation` + `aria-label`; `tabindex=0` + keyboard arrow (Shift+Arrow = 10px); touch target 20px min; pointer events

### 5.7. PinButton

- **Props:**
  ```ts
  interface PinButtonProps {
    pinned: boolean                                                            // controlled
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Pin" / "Unpin"
    onPinChange?: (pinned: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `pin` (pinned) / `pinOff` (unpinned) — từ ICON_CATALOG
  - pinned state: icon `--color-icon-accent` + bg `--color-accent-muted`
- **Variants:** unpinned, pinned
- **States:** như IconButton + pinned visual
- **Accessibility:** `aria-pressed={pinned}`; `aria-label` động ("Pin"/"Unpin"); `type="button"`; touch target 40px

### 5.8. BackButton

- **Props:**
  ```ts
  interface BackButtonProps {
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    variant?: 'ghost' | 'outline'                                              // default 'ghost'
    showLabel?: boolean                                                        // default false (icon only)
    children?: ReactNode                                                       // label khi showLabel
    disabled?: boolean
    ariaLabel?: string                                                         // default "Go back"
    onClick?: () => void
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon: `chevronLeft`
  - label font: `--font-size-sm` `--font-weight-medium`
- **Variants:** icon-only, icon+label
- **States:** như IconButton
- **Accessibility:** `aria-label="Go back"` khi icon-only; `type="button"`; dùng trong popup navigation (molecule) — bản thân là atom

### 5.9. InfoButton

- **Props:**
  ```ts
  interface InfoButtonProps {
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    variant?: 'ghost' | 'outline'                                              // default 'ghost'
    disabled?: boolean
    ariaLabel?: string                                                         // default "More information"
    onClick?: () => void                                                       // mở popover (molecule) hoặc link
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon: `info`
- **Variants:** ghost, outline
- **States:** như IconButton
- **Accessibility:** `aria-label="More information"`; `type="button"`; bản thân chỉ trigger — popover content là molecule

### 5.10. CollapseButton

- **Props:**
  ```ts
  interface CollapseButtonProps {
    collapsed: boolean                                                         // controlled
    direction?: 'up' | 'down' | 'left' | 'right'                               // default 'down' (chevron rotate)
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    showLabel?: boolean
    children?: ReactNode                                                       // "Collapse"/"Expand" label
    disabled?: boolean
    ariaLabel?: string
    onCollapseChange?: (collapsed: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon: `chevronDown` (rotate 0° khi expanded, -90°/180° khi collapsed theo direction)
  - rotation: duration `--duration-fast` `--ease-standard`
- **Variants:** theo direction + showLabel
- **States:** như IconButton + collapsed visual (icon rotate)
- **Accessibility:** `aria-expanded={!collapsed}`; `aria-controls={panelId}` link panel; `type="button"`; reduced motion → instant rotate

### 5.11. MinimizeButton

- **Props:**
  ```ts
  interface MinimizeButtonProps {
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    variant?: 'ghost' | 'outline'                                              // default 'ghost'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Minimize"
    onMinimize?: () => void
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon: `minimize` (hoặc dash icon)
- **Variants:** ghost, outline
- **States:** như IconButton
- **Accessibility:** `aria-label="Minimize"`; `type="button"`; dùng cho floating window (molecule) — bản thân là atom

### 5.12. MaximizeButton

- **Props:**
  ```ts
  interface MaximizeButtonProps {
    maximized: boolean                                                         // controlled (maximize/restore toggle)
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    variant?: 'ghost' | 'outline'                                              // default 'ghost'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Maximize" / "Restore"
    onMaximizeChange?: (maximized: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton
  - icon: `maximize` (maximized=false) / `restore` (maximized=true)
- **Variants:** maximize, restore
- **States:** như IconButton
- **Accessibility:** `aria-pressed={maximized}`; `aria-label` động; `type="button"`; dùng cho floating panel (molecule) — bản thân là atom

---

## 6. Phase 5 — Domain Atoms (27)

> Đặc thù domain Cell: video, subtitle, dictionary, language learning. Không phải generic Button/Slider vì có state sync với media + icon logic + ARIA động. Mỗi atom chỉ wrapper 1 HTML element, có thể import generic atom (Icon, Text) nhưng không import atom domain khác.

### 6.A. Video Domain (9 atoms)

#### 6.A.1. PlayPauseButton

- **Props:**
  ```ts
  interface PlayPauseButtonProps {
    playing: boolean                                                           // controlled — sync video state
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean
    loading?: boolean                                                          // buffering
    ariaLabel?: string                                                         // default động "Play"/"Pause"
    onPlayPauseChange?: (playing: boolean) => void
  }
  ```
- **Token mapping:**
  - như Button variant primary (solid accent) hoặc ghost (overlay trên video)
  - icon: `play` (playing=false) / `pause` (playing=true)
  - icon color: `--color-on-accent` (solid) / `--color-on-dark` (overlay trên video)
- **Variants:** play, pause
- **States:**
  - hover: overlay `--color-overlay-hover`
  - focus-visible: ring `--color-accent` 2px
  - loading (buffering): Spinner thay icon + `aria-busy`
  - disabled: `--color-icon-disabled`
- **Accessibility:** `aria-label` động ("Play"/"Pause") theo `playing`; `aria-pressed` không dùng (play/pause là action, không toggle state); touch target 40px; `type="button"`

#### 6.A.2. Timeline

- **Props:**
  ```ts
  interface TimelineProps {
    currentTime: number                                                        // seconds, controlled — sync video
    duration: number                                                           // seconds
    buffered: number                                                           // seconds buffered
    onSeek?: (time: number) => void                                            // click/drag to seek
    onSeekStart?: () => void
    onSeekEnd?: (time: number) => void
    ariaLabel?: string                                                         // default "Video timeline"
  }
  ```
- **Token mapping:**
  - track: `--color-track` (height `--spacing-1`)
  - buffered: `--color-background-muted`
  - played: `--color-accent`
  - thumb: `--color-accent` (size `--spacing-3`, radius `--radius-full`)
  - hover: thumb scale 1.25, duration `--duration-fast`
- **Variants:** default
- **States:**
  - hover: thumb visible + scale
  - dragging (seeking): thumb `--color-accent` + scale 1.5
  - focus-visible: ring `--color-accent` 2px
- **Accessibility:** `role="slider"` + `aria-valuenow={currentTime}` + `aria-valuemin={0}` + `aria-valuemax={duration}` + `aria-label`; keyboard Left/Right = seek 5s, Shift+Arrow = 10s; touch target 20px height (padding mở rộng)

#### 6.A.3. TimeDisplay

- **Props:**
  ```ts
  interface TimeDisplayProps {
    currentTime: number                                                        // seconds, sync video
    duration: number                                                           // seconds
    format?: 'current' | 'remaining' | 'both'                                  // default 'both' "1:23 / 4:56"
    showHours?: boolean                                                        // auto khi duration > 3600
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - text: `--color-on-dark` (overlay trên video) / `--color-text-secondary` (panel)
  - font: `--font-family-code` · `--font-size-sm` · `--font-weight-medium`
  - tabular-nums: `font-variant-numeric: tabular-nums` (không jitter)
- **Variants:** current, remaining ("−1:23"), both
- **States:** default
- **Accessibility:** `<time>` hoặc `<span role="text">`; `aria-label` full "Current time 1 minute 23 seconds of 4 minutes 56 seconds"; format = pure function (mm:ss / h:mm:ss)

#### 6.A.4. VolumeControl

- **Props:**
  ```ts
  interface VolumeControlProps {
    volume: number                                                             // 0-1, controlled — sync video
    muted: boolean                                                             // controlled
    onVolumeChange?: (volume: number) => void
    onMuteChange?: (muted: boolean) => void
    size?: 'sm' | 'md'                                                         // default 'md'
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - track: `--color-track`
  - fill: `--color-accent`
  - thumb: `--color-accent`
  - mute button icon: `volumeHigh` (volume>0.5) / `volumeLow` (0<volume≤0.5) / `volumeMute` (muted/volume=0)
  - icon color: `--color-on-dark` (overlay) / `--color-icon-primary`
- **Variants:** theo volume level
- **States:**
  - hover slider: thumb scale
  - focus-visible: ring `--color-accent`
  - dragging: thumb scale 1.5
- **Accessibility:** `role="slider"` cho volume + `aria-valuenow` (0-100) + `aria-valuemin=0` + `aria-valuemax=100`; mute button `aria-pressed={muted}` + `aria-label` động; keyboard Up/Down = volume ±5%

#### 6.A.5. MuteButton

- **Props:**
  ```ts
  interface MuteButtonProps {
    muted: boolean                                                             // controlled
    volume?: number                                                            // để chọn icon (volumeHigh/Low/Mute)
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean
    ariaLabel?: string                                                         // default động "Mute"/"Unmute"
    onMuteChange?: (muted: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost (overlay trên video)
  - icon: `volumeMute` (muted) / `volumeHigh` (volume>0.5) / `volumeLow` (0<volume≤0.5)
  - icon color: `--color-on-dark` (overlay) / `--color-icon-primary`
- **Variants:** muted, unmuted
- **States:** như IconButton
- **Accessibility:** `aria-pressed={muted}`; `aria-label` động; `type="button"`; touch target 40px

#### 6.A.6. CaptionsButton

- **Props:**
  ```ts
  interface CaptionsButtonProps {
    captionsOn: boolean                                                        // controlled — sync text track mode
    available: boolean                                                         // có text track không
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean                                                         // disabled khi available=false
    ariaLabel?: string                                                         // default động "Show captions"/"Hide captions"
    onCaptionsChange?: (on: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `captions` (từ ICON_CATALOG)
  - active (captionsOn): icon `--color-on-accent` + bg `--color-accent`
  - disabled (no track): `--color-icon-disabled`
- **Variants:** on, off, unavailable
- **States:** như IconButton + active visual
- **Accessibility:** `aria-pressed={captionsOn}`; `aria-label` động; `aria-disabled` khi `available=false`; `type="button"`

#### 6.A.7. FullscreenButton

- **Props:**
  ```ts
  interface FullscreenButtonProps {
    fullscreen: boolean                                                        // controlled — sync Fullscreen API
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean                                                         // disabled khi API không available
    ariaLabel?: string                                                         // default động "Enter fullscreen"/"Exit fullscreen"
    onFullscreenChange?: (fullscreen: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `maximize` (fullscreen=false) / `minimize` (fullscreen=true)
  - icon color: `--color-on-dark` (overlay) / `--color-icon-primary`
- **Variants:** enter, exit
- **States:** như IconButton
- **Accessibility:** `aria-pressed={fullscreen}`; `aria-label` động; `type="button"`; capability detection (`document.fullscreenEnabled`)

#### 6.A.8. PiPButton

- **Props:**
  ```ts
  interface PiPButtonProps {
    pip: boolean                                                               // controlled — sync PiP API
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean                                                         // disabled khi PiP không supported
    ariaLabel?: string                                                         // default động "Enter picture in picture"/"Exit"
    onPipChange?: (pip: boolean) => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `pip` (từ ICON_CATALOG)
  - icon color: `--color-on-dark` (overlay) / `--color-icon-primary`
- **Variants:** enter, exit
- **States:** như IconButton
- **Accessibility:** `aria-pressed={pip}`; `aria-label` động; `type="button"`; capability detection (`document.pictureInPictureEnabled`)

#### 6.A.9. SkipButton

- **Props:**
  ```ts
  interface SkipButtonProps {
    direction?: 'forward' | 'backward'                                         // default 'forward'
    seconds?: number                                                           // skip time, default 10
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Skip forward 10 seconds"
    onSkip?: (seconds: number) => void                                         // seekBy logic
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `skipForward` / `skipBackward` (từ ICON_CATALOG)
  - label (khi show): `--font-size-xs` `--font-weight-medium`
  - icon color: `--color-on-dark` (overlay) / `--color-icon-primary`
- **Variants:** forward, backward
- **States:** như IconButton
- **Accessibility:** `aria-label` động ("Skip forward 10 seconds"/"Skip backward 10 seconds"); `type="button"`; touch target 40px

---

### 6.B. Subtitle Domain (5 atoms)

#### 6.B.1. SubtitleText

- **Props:**
  ```ts
  interface SubtitleTextProps {
    children: ReactNode                                                        // subtitle line(s)
    align?: 'start' | 'center' | 'end'                                        // default 'center'
    size?: 'sm' | 'md' | 'lg' | 'xl'                                           // default 'lg'
    background?: boolean                                                       // default true (readability over video)
    backgroundOpacity?: number                                                 // 0-1, default 0.7
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - text: `--color-on-dark` (white trên video)
  - text-shadow: `0 0 4px rgba(0,0,0,0.8)` (readability khi no background)
  - bg: `--color-background-inverted` opacity `backgroundOpacity`
  - padding: `--spacing-1` `--spacing-2`
  - radius: `--radius-inner`
  - font: `--font-size-{lg|xl|2xl|3xl}` · `--font-weight-medium` · `--font-family-body`
- **Variants:** theo size + background
- **States:** default
- **Accessibility:** absolute positioning over video; `aria-label` hoặc `role="text"`; không cản trở keyboard nav; text-shadow đảm bảo contrast AAA

#### 6.B.2. CaptionToggle

- **Props:**
  ```ts
  interface CaptionToggleProps {
    enabled: boolean                                                           // controlled — sync text track mode (showing/hidden)
    trackLabel?: string                                                        // "English", "Vietnamese"
    size?: 'sm' | 'md'                                                         // default 'md'
    disabled?: boolean
    ariaLabel?: string
    onToggle?: (enabled: boolean) => void
  }
  ```
- **Token mapping:**
  - như Switch atom + track label
  - label text: `--color-text-primary` · `--font-size-sm`
- **Variants:** theo trackLabel
- **States:** như Switch
- **Accessibility:** `role="switch"` + `aria-checked={enabled}`; `aria-label` động ("Captions: English — On"); touch target 40px

#### 6.B.3. LanguageSelector

- **Props:**
  ```ts
  interface LanguageSelectorProps {
    languages: Array<{ srclang: string; label: string }>                       // từ <track> list
    value: string                                                              // srclang selected, controlled
    onChange: (srclang: string) => void
    size?: 'sm' | 'md'                                                         // default 'md'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Subtitle language"
  }
  ```
- **Token mapping:**
  - như Select (molecule) nhưng bản thân atom wrapper `<select>`
  - bg: `--color-background-surface`
  - text: `--color-text-primary`
  - border: `--color-border`
  - radius: `--radius-element`
- **Variants:** theo size
- **States:** như native `<select>` + focus-visible ring
- **Accessibility:** `<select>` native + `aria-label`; `value`+`onChange` controlled; mỗi `<option>` có `value={srclang}` + label; keyboard native

#### 6.B.4. TimeOffset

- **Props:**
  ```ts
  interface TimeOffsetProps {
    offset: number                                                             // seconds, sync video timing
    format?: 'absolute' | 'relative'                                           // default 'absolute'
    showSign?: boolean                                                         // "+0.5s" / "−0.3s"
    ariaLabel?: string
  }
  ```
- **Token mapping:**
  - text: `--color-text-secondary`
  - font: `--font-family-code` · `--font-size-sm` · tabular-nums
  - sign: `--color-accent` (+) / `--color-error` (−)
- **Variants:** absolute, relative
- **States:** default
- **Accessibility:** `<time>` hoặc `<span role="text">`; `aria-label` full "Offset plus 0.5 seconds"; dùng cho subtitle sync adjustment

#### 6.B.5. TrackLabel

- **Props:**
  ```ts
  interface TrackLabelProps {
    label: string                                                              // "English", "Vietnamese"
    srclang: string                                                            // "en", "vi"
    active?: boolean                                                           // current track
    size?: 'sm' | 'md'                                                         // default 'sm'
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary` (active) / `--color-text-secondary` (inactive)
  - font: `--font-size-sm` · `--font-weight-medium` (active) / `--font-weight-normal`
  - active indicator: dot `--color-accent` `--spacing-1` radius `--radius-full`
- **Variants:** active, inactive
- **States:** default
- **Accessibility:** `<span>` display; `aria-current="true"` khi active; lấy từ track metadata (`track.label`, `track.srclang`)

---

### 6.C. Dictionary Domain (9 atoms)

#### 6.C.1. WordTitle

- **Props:**
  ```ts
  interface WordTitleProps {
    children: ReactNode                                                        // word string
    level?: 1 | 2 | 3                                                          // default 2 → <h2>
    phonetic?: string                                                          // IPA bên cạnh (optional)
    id?: string                                                                // cho aria-labelledby
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary`
  - font: theo Heading level (H2 `--font-size-xl`/`600`/`1.4` hoặc H1 `--font-size-2xl`)
  - font-family: `--font-family-heading`
  - phonetic: `--color-text-secondary` · `--font-family-code` · `--font-size-sm`
- **Variants:** theo level
- **States:** default
- **Accessibility:** `<h2>` semantic (header cho dictionary entry); `id` cho `aria-labelledby`; phonetic là `<span>` bên trong

#### 6.C.2. PhoneticText

- **Props:**
  ```ts
  interface PhoneticTextProps {
    children: ReactNode                                                        // IPA notation "/ˈwɜːrd/"
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
  }
  ```
- **Token mapping:**
  - text: `--color-text-secondary`
  - font: `--font-family-code` · `--font-size-{sm|base|lg}` · `--font-weight-normal`
- **Variants:** theo size
- **States:** default
- **Accessibility:** `<span>` (inline) hoặc `<p>` (block); IPA notation styling; không cần ARIA đặc biệt

#### 6.C.3. PronunciationButton

- **Props:**
  ```ts
  interface PronunciationButtonProps {
    audioUrl?: string                                                          // play audio URL
    word?: string                                                              // fallback: dùng TTS API
    size?: 'sm' | 'md' | 'lg'                                                  // default 'sm'
    disabled?: boolean
    loading?: boolean                                                          // đang load audio
    ariaLabel?: string                                                         // default "Pronounce word"
    onPlay?: () => void
  }
  ```
- **Token mapping:**
  - như IconButton ghost
  - icon: `volumeHigh` (default) / `volumeMute` (no audio) / Spinner (loading)
  - icon color: `--color-icon-accent` (highlight) / `--color-icon-secondary`
- **Variants:** audio-url, tts-fallback
- **States:**
  - playing: icon pulse hoặc `--color-icon-accent`
  - loading: Spinner
  - disabled: `--color-icon-disabled` (no audio + no TTS)
- **Accessibility:** `aria-label="Pronounce {word}"`; `type="button"`; dùng `Audio.play()` hoặc `speechSynthesis.speak()`; `aria-busy` khi loading

#### 6.C.4. PartOfSpeechTag

- **Props:**
  ```ts
  interface PartOfSpeechTagProps {
    type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction' | 'pronoun' | 'interjection'
    size?: 'sm' | 'md'                                                         // default 'sm'
  }
  ```
- **Token mapping:**
  - bg: tint color theo type (noun=blue, verb=green, adjective=orange, adverb=purple, preposition=cyan, conjunction=teal, pronoun=pink, interjection=red)
  - text: tint text color tương ứng
  - radius: `--radius-full` (pill)
  - padding: `--spacing-0-5` `--spacing-1-5`
  - font: `--font-size-2xs` (sm) / `--font-size-xs` (md) · `--font-weight-medium`
- **Variants:** theo type (8 loại)
- **States:** default
- **Accessibility:** `<span>` display; `aria-label="Part of speech: {type}"`; semantic tag + color coding cho nhận diện nhanh

#### 6.C.5. DefinitionText

- **Props:**
  ```ts
  interface DefinitionTextProps {
    children: ReactNode                                                        // definition text
    index?: number                                                             // số thứ tự definition (1, 2, 3...)
    format?: 'plain' | 'numbered'                                              // default 'numbered' khi có index
  }
  ```
- **Token mapping:**
  - text: `--color-text-primary`
  - font: `--font-size-base` · `--font-weight-normal` · line-height `1.4286`
  - index: `--color-text-secondary` · `--font-weight-medium` · `--font-size-sm`
- **Variants:** plain, numbered
- **States:** default
- **Accessibility:** `<p>` hoặc `<li>` (numbered); `aria-label` không cần — text tự semantic; structured formatting (numbered list cho nhiều definitions)

#### 6.C.6. ExampleSentence

- **Props:**
  ```ts
  interface ExampleSentenceProps {
    children: ReactNode                                                        // example sentence
    highlight?: string                                                         // word to highlight trong sentence
    translation?: string                                                       // bản dịch (optional)
  }
  ```
- **Token mapping:**
  - text: `--color-text-secondary` (italic)
  - highlight: `--color-text-accent` · `--font-weight-semibold`
  - translation: `--color-text-disabled` · `--font-size-sm`
  - font: `--font-size-base` · italic · line-height `1.4286`
- **Variants:** default, with-translation
- **States:** default
- **Accessibility:** `<blockquote>` hoặc `<p>`; italic phân biệt với definition; highlight word `<mark>` hoặc `<strong>`; translation `<span>` sub

#### 6.C.7. SynonymChip

- **Props:**
  ```ts
  interface SynonymChipProps {
    children: ReactNode                                                        // synonym word
    size?: 'sm' | 'md'                                                         // default 'sm'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Look up synonym: {word}"
    onLookup?: (word: string) => void                                          // click → dictionary lookup
  }
  ```
- **Token mapping:**
  - như Chip atom + tint green (synonym)
  - bg: tint green background
  - text: tint green text
  - radius: `--radius-full`
- **Variants:** default
- **States:**
  - hover: overlay + cursor pointer
  - focus-visible: ring `--color-accent`
  - disabled: `--color-text-disabled`
- **Accessibility:** `<button>` (interactive lookup); `aria-label="Look up synonym: {word}"`; touch target 40px; phân biệt với AntonymChip (color)

#### 6.C.8. AntonymChip

- **Props:**
  ```ts
  interface AntonymChipProps {
    children: ReactNode                                                        // antonym word
    size?: 'sm' | 'md'                                                         // default 'sm'
    disabled?: boolean
    ariaLabel?: string                                                         // default "Look up antonym: {word}"
    onLookup?: (word: string) => void
  }
  ```
- **Token mapping:**
  - như Chip atom + tint red (antonym)
  - bg: tint red background
  - text: tint red text
  - radius: `--radius-full`
- **Variants:** default
- **States:** như SynonymChip
- **Accessibility:** `<button>`; `aria-label="Look up antonym: {word}"`; touch target 40px; phân biệt với SynonymChip (color red vs green)

#### 6.C.9. SourceBadge

- **Props:**
  ```ts
  interface SourceBadgeProps {
    source: 'cambridge' | 'oxford' | 'merriam-webster' | 'collins' | 'longman' | string
    size?: 'sm' | 'md'                                                         // default 'sm'
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted`
  - text: `--color-text-secondary`
  - radius: `--radius-inner`
  - padding: `--spacing-0-5` `--spacing-1-5`
  - font: `--font-size-2xs` (sm) / `--font-size-xs` (md) · `--font-weight-medium`
- **Variants:** theo source
- **States:** default
- **Accessibility:** `<span>` display; `aria-label="Source: {source}"`; identify dictionary source (Cambridge/Oxford); không interactive

---

### 6.D. Language Learning Domain (4 atoms)

#### 6.D.1. WordChip

- **Props:**
  ```ts
  interface WordChipProps {
    children: ReactNode                                                        // word
    status?: 'new' | 'learning' | 'mastered' | 'unknown'                       // default 'unknown'
    size?: 'sm' | 'md'                                                         // default 'md'
    disabled?: boolean
    ariaLabel?: string
    onLookup?: (word: string) => void                                          // click → dictionary lookup
  }
  ```
- **Token mapping:**
  - bg: `--color-background-muted` (unknown) / tint blue (new) / tint orange (learning) / tint green (mastered)
  - text: `--color-text-primary` (unknown) / tint text color
  - border: `--color-border` (unknown) / transparent
  - radius: `--radius-element`
  - padding: `--spacing-1` `--spacing-2`
  - font: `--font-size-sm` · `--font-weight-medium`
- **Variants:** theo status (new/learning/mastered/unknown)
- **States:**
  - hover: overlay `--color-overlay-hover` + cursor pointer
  - focus-visible: ring `--color-accent` 2px
  - disabled: `--color-text-disabled`
- **Accessibility:** `<button>` (interactive); `aria-label="Look up {word}, status: {status}"`; touch target 40px; clickable word + lookup action

#### 6.D.2. FrequencyBadge

- **Props:**
  ```ts
  interface FrequencyBadgeProps {
    level: 'common' | 'frequent' | 'rare' | 'academic' | 'archaic'
    count?: number                                                             // frequency count (optional)
    size?: 'sm' | 'md'                                                         // default 'sm'
  }
  ```
- **Token mapping:**
  - bg: tint green (common) / tint blue (frequent) / tint orange (rare) / tint purple (academic) / tint gray (archaic)
  - text: tint text color
  - radius: `--radius-full`
  - padding: `--spacing-0-5` `--spacing-1-5`
  - font: `--font-size-2xs` (sm) / `--font-size-xs` (md) · `--font-weight-medium`
- **Variants:** theo level (5 loại)
- **States:** default
- **Accessibility:** `<span>` display; `aria-label="Frequency: {level}"`; color-coded by frequency; không interactive

#### 6.D.3. LevelIndicator

- **Props:**
  ```ts
  interface LevelIndicatorProps {
    level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'                             // CEFR
    size?: 'sm' | 'md' | 'lg'                                                  // default 'md'
    showLabel?: boolean                                                        // default true
  }
  ```
- **Token mapping:**
  - bg: gradient theo level (A1=green → C2=red) hoặc tint theo level
  - text: `--color-on-accent` hoặc tint text
  - radius: `--radius-inner`
  - padding: `--spacing-1` `--spacing-2`
  - font: `--font-size-xs` (sm) / `--font-size-sm` (md) / `--font-size-base` (lg) · `--font-weight-semibold`
- **Variants:** theo level (6 CEFR)
- **States:** default
- **Accessibility:** `<span>` display; `aria-label="CEFR level: {level}"`; CEFR level (A1-C2); không interactive

#### 6.D.4. MasteryBadge

- **Props:**
  ```ts
  interface MasteryBadgeProps {
    progress: number                                                           // 0-100, mastery percentage
    level?: 'beginner' | 'intermediate' | 'advanced' | 'master'                // derived from progress
    size?: 'sm' | 'md'                                                         // default 'sm'
    showProgress?: boolean                                                     // default false (chỉ level)
  }
  ```
- **Token mapping:**
  - bg: `--color-success-muted` (master) / `--color-warning-muted` (intermediate) / `--color-background-muted` (beginner)
  - text: `--color-on-success` (master) / `--color-on-warning` (intermediate) / `--color-text-primary`
  - icon: `check` (master) / `checkDouble` (advanced) / Spinner partial (learning)
  - radius: `--radius-full`
  - progress ring: `--color-accent` (circular variant)
- **Variants:** theo level (derived from progress: 0-25=beginner, 26-50=intermediate, 51-75=advanced, 76-100=master)
- **States:** default
- **Accessibility:** `<span>` display; `aria-label="Mastery: {progress}%, level: {level}"`; visual feedback learning progress; không interactive

---

## 7. Folder Structure

```
src/
├── shared/
│   ├── ui/
│   │   ├── atoms/                       # Generic atoms (40)
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.css           # hoặc styles.ts nếu StyleX
│   │   │   │   ├── Button.test.tsx
│   │   │   │   └── index.ts             # named export
│   │   │   ├── Input/
│   │   │   ├── Label/
│   │   │   ├── Text/
│   │   │   ├── Icon/
│   │   │   ├── Badge/
│   │   │   ├── Checkbox/
│   │   │   ├── Switch/
│   │   │   ├── Avatar/
│   │   │   ├── Separator/
│   │   │   ├── Box/
│   │   │   ├── Flex/
│   │   │   ├── Grid/
│   │   │   ├── Stack/                   # VStack + HStack
│   │   │   ├── Container/
│   │   │   ├── AspectRatio/
│   │   │   ├── Spinner/
│   │   │   ├── Progress/
│   │   │   ├── Link/
│   │   │   ├── Kbd/
│   │   │   ├── Overlay/
│   │   │   ├── Section/
│   │   │   ├── Heading/
│   │   │   ├── Thumbnail/
│   │   │   ├── Timestamp/
│   │   │   ├── Blockquote/
│   │   │   ├── Citation/
│   │   │   ├── Code/
│   │   │   ├── StatusDot/
│   │   │   ├── IconButton/
│   │   │   ├── Chip/
│   │   │   ├── CloseButton/
│   │   │   ├── CopyButton/
│   │   │   ├── DragHandle/
│   │   │   ├── ResizeHandle/
│   │   │   ├── PinButton/
│   │   │   ├── BackButton/
│   │   │   ├── InfoButton/
│   │   │   ├── CollapseButton/
│   │   │   ├── MinimizeButton/
│   │   │   └── MaximizeButton/
│   │   ├── molecules/                   # Bước 2 (out of scope kế hoạch này)
│   │   └── organisms/                   # Bước 3
│   └── domain/
│       ├── video/
│       │   └── atoms/                   # Video domain atoms (9)
│       │       ├── PlayPauseButton/
│       │       ├── Timeline/
│       │       ├── TimeDisplay/
│       │       ├── VolumeControl/
│       │       ├── MuteButton/
│       │       ├── CaptionsButton/
│       │       ├── FullscreenButton/
│       │       ├── PiPButton/
│       │       └── SkipButton/
│       ├── subtitle/
│       │   └── atoms/                   # Subtitle domain atoms (5)
│       │       ├── SubtitleText/
│       │       ├── CaptionToggle/
│       │       ├── LanguageSelector/
│       │       ├── TimeOffset/
│       │       └── TrackLabel/
│       ├── dictionary/
│       │   └── atoms/                   # Dictionary domain atoms (9)
│       │       ├── WordTitle/
│       │       ├── PhoneticText/
│       │       ├── PronunciationButton/
│       │       ├── PartOfSpeechTag/
│       │       ├── DefinitionText/
│       │       ├── ExampleSentence/
│       │       ├── SynonymChip/
│       │       ├── AntonymChip/
│       │       └── SourceBadge/
│       └── learning/
│           └── atoms/                   # Learning domain atoms (4)
│               ├── WordChip/
│               ├── FrequencyBadge/
│               ├── LevelIndicator/
│               └── MasteryBadge/
```

### Dependency rules

| Atom type | Có thể import | Không được import |
|-----------|---------------|-------------------|
| Generic atom (`shared/ui/atoms`) | Tokens, Icon (generic), hooks (`useLinkComponent`) | Domain atoms, Molecules, Organisms |
| Domain atom (`shared/domain/*/atoms`) | Generic atoms (Icon, Text, Spinner...), Tokens | Atom từ domain khác, Molecules |
| Domain atom video | Generic + video atoms | subtitle/dictionary/learning atoms |
| Domain atom subtitle | Generic + subtitle atoms | video/dictionary/learning atoms |
| Domain atom dictionary | Generic + dictionary atoms | video/subtitle/learning atoms |
| Domain atom learning | Generic + learning atoms | video/subtitle/dictionary atoms |

> **Quy tắc vàng:** Dependency chỉ đi theo 1 chiều: Generic → Domain. Không bao giờ ngược. Domain không cross-import.

---

## 8. Quy tắc thiết kế Atom (Design Rules)

> Nguồn: `daft.md` §2 (triết lý + quy tắc + anti-patterns) + Astryx principles. Atom không chỉ là "wrapper HTML" — atom phải tuân convention để compose được.

### 8.1. 14 quy tắc binding (ràng buộc cứng)

| # | Quy tắc | Giải thích |
|---|---------|------------|
| 1 | **Semantic tokens over hardcoded values** | `var(--color-text-primary)`, không `#171717`. Tên token theo mục đích, không theo màu sắc. |
| 2 | **Theme-agnostic code** | Atom không tham chiếu màu/cỡ cụ thể; light/dark đổi qua `light-dark()`. |
| 3 | **3-layer token resolution** | Primitive → Semantic → Component. Atom dùng component token, resolve về semantic, resolve về primitive. |
| 4 | **Concentric radius** | Khi atom có padding, inner element dùng `max(0, outerRadius - padding)`. |
| 5 | **Controlled inputs** | Mọi input atom là `value` + `onChange`, không uncontrolled. |
| 6 | **`useLinkComponent()` cho Link** | Atom Link không hardcode `<a>`, để consumer plug router framework. |
| 7 | **Open internals** | Mọi primitive của atom được export để compose khi cần. |
| 8 | **Elevation prop** | Atom có thể float dùng `elevation: none \| low \| med \| high`. |
| 9 | **Frame-first** | Atom layout neutral, không opinionated (Box=div, không padding cố định). |
| 10 | **Touch target** | Mobile 44px, desktop 40px (WCAG 2.5.5). |
| 11 | **Focus styling** | `:focus-visible`, không `:focus` (break keyboard nav khi click). |
| 12 | **Reduced motion** | `prefers-reduced-motion` — tắt animation khi user prefer. |
| 13 | **Disabled state** | `aria-disabled` + visual (không chỉ `disabled` attribute). |
| 14 | **Semantic naming** | `close`, `chevronDown`, `success` (không `x`, `arrow-down`, `green-check`). |

### 8.2. Anti-patterns (ranh giới đỏ)

| Don't | Why | Do |
|-------|-----|----|
| Inline styles trên raw element | Break token system | Dùng `xstyle`/className trên component |
| Hardcoded colors (`#fff`) trong atom | Không themeable | Dùng `var(--color-*)` |
| Hardcoded spacing (`16px`) trong atom | Không scale | Dùng spacing tokens (`--spacing-*`) |
| Hardcoded `<a>` element trong Link atom | Không plug router | Dùng `useLinkComponent()` |
| Wrap mọi list item/page section trong Card | Dense data bị che | Dense data → rows; Card chỉ cho widget |
| Dùng Badge như decoration | Sai ngữ nghĩa | Badge chỉ cho count; status dùng StatusDot/Token |
| Invent props cho atom | Break API contract | Đọc spec (file này) trước khi thêm prop |
| Nest Card trong Card | Card là widget container | Không nest |
| Mix token với raw px/rem trong cùng atom | Inconsistent | Chỉ dùng token |
| Inline SVG trong component | Break ICON_CATALOG | Import từ `src/shared/icons/index.ts` |
| Default export | Break convention | Named export |
| Class component | Break convention | Function component + hooks |
| `any` type | Break type safety | Type cụ thể (ESLint `no-explicit-any`) |
| Uncontrolled input | Break controlled rule | `value` + `onChange` |
| `:focus` styling | Break keyboard nav | `:focus-visible` |
| Atom import atom khác (trừ generic) | Break atomic rule | Atom chỉ wrapper 1 HTML element |
| Domain atom cross-import | Break dependency rule | Domain chỉ import generic + cùng domain |

### 8.3. Phân biệt 4 atom dễ nhầm (Badge / Token / Chip / StatusDot)

| Atom/Molecule | HTML | Cấp độ | Ngữ nghĩa | Ví dụ |
|---------------|------|--------|-----------|-------|
| **Badge** | `<span>` | ATOM | Count/enumerated states (có số) | "3", "99+", "NEW" |
| **Token** | `<span>` + IconButton | MOLECULE | Enumerated label có thể remove | language tag "EN ×" |
| **Chip** | `<span>`/`<button>` | ATOM | Compact filter/selection element | filter "Active", tag "noun" |
| **StatusDot** | `<span>` | ATOM | Small dot không có text | online indicator, sync status |

### 8.4. Semantic naming convention

| Loại | Đúng (semantic) | Sai (hình dạng) |
|------|------------------|------------------|
| Icon | `close`, `chevronDown`, `check`, `success`, `warning`, `info`, `search`, `externalLink`, `menu`, `wrench` | `x`, `arrow-down`, `green-check` |
| Token | `--color-text-primary`, `--color-background-surface` | `--color-dark-gray`, `--color-white` |
| Component | `StatusDot`, `Banner`, `Token` | `GreenDot`, `YellowBar`, `RemovableTag` |

### 8.5. Motion principles (cho atom có animation)

- **Animate khi cần orient user:** panel/dialog mở, content expand, element enter screen.
- **Không animate high-frequency:** table row hover, list item highlight, keyboard shortcuts.
- **Exit match entrance:** panel trượt từ phải vào thì trượt ra phải.
- **Direction match action:** navigate sâu hơn → tiến; back → quay lại.
- **Contextual UI connect to trigger:** dropdown mở từ button, popover gần element.
- **Reduced motion:** tôn trọng `prefers-reduced-motion` — tắt animation, instant transition.

### 8.6. Accessibility checklist (cho mọi interactive atom)

| Quy tắc | Giá trị | Lý do |
|---------|---------|-------|
| Touch target tối thiểu | Mobile 44px, desktop 40px | WCAG 2.5.5 |
| Focus styling | `:focus-visible`, không `:focus` | `:focus` break keyboard nav khi click |
| ARIA label cho IconButton | `aria-label` (không có text) | Screen reader |
| Reduced motion | `prefers-reduced-motion` | OS preference |
| Disabled state | `aria-disabled` + visual | Accessibility |
| Controlled input | `value` + `onChange` | Predictable state |
| Semantic HTML | `<button>`, `<input>`, `<label>`, `<h1-6>` | Screen reader + SEO |
| Keyboard nav | Tab, Enter, Space, Arrow | WCAG 2.1.1 |
| Color contrast | AAA cho text (7:1), AA cho UI (3:1) | WCAG 2.1.3 |

---

## 9. Thứ tự xây dựng (Build Order)

| Phase | Atoms | Số lượng | Mục tiêu |
|-------|-------|----------|----------|
| **0** | Tokens (color, spacing, typography, shape, elevation, motion, size) | 7 nhóm | Gốc của gốc — không có tokens thì atom vô hồn |
| **1** | Button, Input, Label, Text, Icon, Badge, Checkbox, Switch, Avatar, Separator | 10 | Core — xuất hiện 9/9 nguồn, nền tảng mọi UI |
| **2** | Box, Flex, Grid, Stack, Container, AspectRatio, Spinner, Progress, Link, Kbd, Overlay, Section | 12 | Layout + utility — composition primitives |
| **3** | Heading, Thumbnail, Timestamp, Blockquote, Citation, Code, StatusDot | 7 | Display atoms từ Astryx (chỉ ATOM thật) |
| **4** | IconButton, Chip, CloseButton, CopyButton, DragHandle, ResizeHandle, PinButton, BackButton, InfoButton, CollapseButton, MinimizeButton, MaximizeButton | 12 | Extension atoms — popup/overlay/floating UI |
| **5** | Video (9) + Subtitle (5) + Dictionary (9) + Learning (4) | 27 | Domain atoms — đặc thù Cell |
| **Tổng** | | **79 atoms** | |

> **Lý do thứ tự:** Tokens (0) → Core (1) vì mọi atom đều cần tokens + core atoms. Layout (2) vì molecule cần layout primitive. Display (3) bổ sung content atoms. Extension (4) cần cho popup UI. Domain (5) cuối cùng vì cần generic + extension đã sẵn sàng.

---

## 10. Tóm tắt số lượng

| Nhóm | Số lượng | Phase |
|------|----------|-------|
| Sub-Atomic (Tokens) | 7 nhóm | 0 |
| Generic Atoms — Core | 10 | 1 |
| Generic Atoms — Layout + Utility | 12 | 2 |
| Generic Atoms — Display (Astryx) | 7 | 3 |
| Extension Atoms | 12 | 4 |
| Domain Atoms — Video | 9 | 5 |
| Domain Atoms — Subtitle | 5 | 5 |
| Domain Atoms — Dictionary | 9 | 5 |
| Domain Atoms — Learning | 4 | 5 |
| **Tổng atoms** | **79** | |

> 11 component từ Astryx (CodeBlock, Markdown, EmptyState, Item, Token, Banner, MoreMenu, FileInput, NumberInput, TimeInput, DateInput) là **MOLECULE**, không phải ATOM → sẽ nằm ở kế hoạch Molecule (Bước 2).

---

## 11. Nguồn tham khảo

- `docs/design-system/tri-thuc-design-system.md` — Tri thức Atomic Design + danh sách 79 atom
- `docs/design-system/daft.md` — Meta/Astryx best practices (tokens, principles, layout, anti-patterns)
- `AGENTS.md` — Convention code Cell
- Astryx Docs: https://astryx.atmeta.com/docs
- Astryx Components: https://astryx.atmeta.com/components
- Brad Frost Atomic Design: https://bradfrost.com/blog/post/atomic-web-design/

---

> **Kế hoạch này là spec, không phải code.** Mỗi atom có 5 phần (Props · Token mapping · Variants · States · Accessibility) đủ để team implement đúng convention Astryx. Build theo Phase 0→5. Tuân thủ 14 binding rules + anti-patterns. Không bỏ sót — 79 atoms đã được verify là ATOM thật (không phải molecule).
