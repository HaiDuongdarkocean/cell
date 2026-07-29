# Cell Design System Standard

> Canonical standard cho design system của Cell.
> Mọi component, token, icon, layout phải tuân theo document này.
> Source of truth: `tokens.json` (giá trị) + document này (quy ước đặt tên + khi nào dùng).
> Reference: `docs/design-system/daft.md` (Meta/Astryx best practices).

---

## 0. Ngôn ngữ chung (Glossary)

| Thuật ngữ | Định nghĩa | Ví dụ |
|-----------|------------|-------|
| **Design token** | Giá trị thiết kế được đặt tên, tái sử dụng, themeable | `--color-primary`, `--space-4` |
| **Primitive token** | Giá trị thô (hex, px, rem) — layer 1 | `#2563eb`, `16px` |
| **Semantic token** | Token theo vai trò UI — layer 2, tham chiếu primitive | `--color-text-primary`, `--color-background-surface` |
| **Component token** | Token gắn với component cụ thể — layer 3, tham chiếu semantic | `--button-bg`, `--card-radius` |
| **SSOT** | Single Source of Truth — sửa 1 chỗ, mọi nơi đồng bộ | `tokens.json` là nguồn chính |
| **Theme-agnostic** | Code không phụ thuộc theme/mode cụ thể | Dùng `var(--color-text-primary)`, không `#0f172a` |
| **Surface** | Lớp nền UI theo thứ tự depth | body → surface → card → popover → overlay |
| **Accent** | Màu nhấn/brand chính của hệ thống | `--color-primary` |
| **On-color** | Màu nội dung đặt trên một màu nền khác | `--color-on-primary`, `--color-on-success` |
| **Muted** | Biến thể nhạt hơn của accent hoặc status | `--color-primary-subtle`, `--color-success-muted` |
| **Elevation** | Độ nổi của surface qua shadow | `none | low | med | high` |
| **Concentric radius** | Bán kính trong nhỏ hơn ngoài: `max(0, outer - padding)` | Card 16px + padding 8px → inner 8px |
| **Touch target** | Vùng chạm tối thiểu | Mobile 44px, desktop 40px |
| **Frame-first** | Chọn layout frame trước khi viết content | AppShell/Layout/Panel trước, content sau |
| **Cards vs rows** | Widget container vs dense data container | Widget → cards; dense data → rows |
| **Reduced motion** | Tôn trọng `prefers-reduced-motion` | Tắt animation khi OS yêu cầu |

---

## 1. Token layers — 3 lớp bắt buộc

```
Primitive  →  Semantic  →  Component
(#2563eb)     (color-primary)  (button-bg)
```

### 1.1. Primitive (layer 1)

Giá trị thô, không themeable, không dùng trực tiếp trong component CSS.

```json
"core": {
  "light": { "primary": "#2563eb", "background": "#ffffff", ... },
  "dark":  { "primary": "#60a5fa", "background": "#0f172a", ... }
}
```

**Quy tắc:**
- Chỉ tồn tại trong `tokens.json` → sinh ra `tokens.css` dưới dạng `:root` + `[data-theme="dark"]`.
- Component CSS **KHÔNG** dùng primitive trực tiếp. Phải đi qua semantic.

### 1.2. Semantic (layer 2)

Token theo vai trò UI, tham chiếu primitive, tự đổi theo light/dark.

```json
"derived": {
  "light": { "color-text-primary": "var(--core-text)", ... },
  "dark":  { "color-text-primary": "var(--core-text)", ... }
}
```

**Naming convention:**

| Pattern | Ví dụ | Dùng cho |
|---------|-------|----------|
| `--color-{role}` | `--color-primary`, `--color-background`, `--color-border` | Màu cơ bản theo vai trò |
| `--color-{role}-{state}` | `--color-primary-hover`, `--color-primary-active` | Trạng thái hover/active/focus |
| `--color-{role}-{variant}` | `--color-primary-subtle`, `--color-success-muted` | Biến thể nhạt/subtle |
| `--color-on-{role}` | `--color-on-primary`, `--color-on-success` | Nội dung đặt trên nền role |
| `--color-{role}-foreground` | `--color-card-foreground`, `--color-popover-foreground` | Text foreground cho surface cụ thể |
| `--color-{surface}` | `--color-card`, `--color-popover`, `--color-surface` | Nền surface cụ thể |
| `--color-icon-{role}` | `--color-icon-primary`, `--color-icon-secondary` | Icon color |
| `--color-text-{role}` | `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled` | Text color theo role |
| `--color-{status}` | `--color-success`, `--color-warning`, `--color-error` | Status color |
| `--color-{status}-muted` | `--color-success-muted`, `--color-error-muted` | Status background nhạt |
| `--color-overlay` | `--color-overlay`, `--color-overlay-hover` | Overlay backdrop |
| `--color-scrollbar-{part}` | `--color-scrollbar-thumb`, `--color-scrollbar-track` | Scrollbar |

**Quy tắc:**
- Tên theo **vai trò**, không theo màu (`text-primary` không phải `text-dark`).
- Mọi component CSS **phải** dùng semantic token, không primitive.

### 1.3. Component (layer 3)

Token gắn với component cụ thể, tham chiếu semantic.

```json
"component": {
  "button": {
    "bg": "var(--color-primary)",
    "fg": "var(--color-on-primary)",
    "radius": "var(--radius-element)",
    "padding-x": "var(--space-4)"
  }
}
```

**Naming convention:**

| Pattern | Ví dụ |
|---------|-------|
| `{component}-{property}` | `button-bg`, `button-fg`, `button-radius` |
| `{component}-{variant}-{property}` | `button-secondary-bg`, `button-outline-border` |
| `{component}-{state}-{property}` | `button-hover-bg`, `button-active-bg` |
| `{component}-{size}-{property}` | `button-sm-padding-x`, `button-lg-height` |

**Quy tắc:**
- Component token tham chiếu semantic, không primitive.
- Chỉ tạo component token khi giá trị khác default hoặc cần override.
- Component CSS dùng `var(--{component-token})` thay vì hardcode.

---

## 2. Color — khi nào dùng token nào

### 2.1. Surface hierarchy (depth order)

| Token | Dùng cho | Depth |
|-------|----------|-------|
| `--color-background` | Nền page/body | 0 (sâu nhất) |
| `--color-surface` | Nền section/panel | 1 |
| `--color-card` | Nền card/widget | 2 |
| `--color-popover` | Nền popover/dropdown/tooltip | 3 |
| `--color-overlay` | Backdrop modal/dialog | 4 (trên cùng) |

**Quy tắc:** element con phải có surface depth ≥ element cha. Không đặt card background = page background (mất separation).

### 2.2. Text color

| Token | Dùng cho |
|-------|----------|
| `--color-text-primary` (alias `--color-foreground`) | Body text, tiêu đề, label chính |
| `--color-text-secondary` (alias `--color-text-muted`) | Hint, description, metadata, placeholder |
| `--color-text-disabled` | Text trên disabled element |
| `--color-text-inverse` | Text trên nền tối/primary/success/error |
| `--color-on-primary` | Text trên nút primary, badge primary |
| `--color-on-success` / `--color-on-error` / `--color-on-warning` | Text trên status background |

**Quy tắc:** không dùng `--color-text-primary` cho text trên nút primary. Dùng `--color-on-primary`.

### 2.3. Border

| Token | Dùng cho |
|-------|----------|
| `--color-border` | Border mặc định (hairline 1px) |
| `--color-border-subtle` | Border nhẹ hơn (divider trong list) |
| `--color-border-emphasized` | Border nhấn mạnh (selected, focus visible) |
| `--color-border-focus` | Border focus ring (input focus) |

### 2.4. Status colors

| Token | Background | Foreground | Dùng cho |
|-------|------------|------------|----------|
| `--color-success` | Alert success, badge success | `--color-on-success` | Operation completed |
| `--color-warning` | Alert warning, badge warning | `--color-on-warning` | Caution, check input |
| `--color-error` | Alert error, badge error, input error | `--color-on-error` | Failure, validation |
| `--color-success-muted` | Subtle success background | — | Tokenize badge core freq |
| `--color-warning-muted` | Subtle warning background | — | Tokenize badge general |
| `--color-error-muted` | Subtle error background | — | Tokenize badge advanced |

### 2.5. Interactive states (UNIVERSAL)

```css
:hover  { background: var(--color-surface-hover); }
:active { background: var(--color-primary-subtle); color: var(--color-primary); }
:focus  { box-shadow: 0 0 0 var(--space-0-5) var(--color-border-focus); }
.selected { background: var(--color-primary-subtle); color: var(--color-primary); }
.disabled { opacity: 0.5; pointer-events: none; }
```

**Cấm:** dùng `--color-accent` cho hover. Dùng `--color-surface-hover`.

---

## 3. Spacing — khi nào dùng scale nào

4px base unit. Token: `--space-{step}`.

| Step | Value | Dùng cho |
|------|-------|----------|
| `0` | 0 | Reset |
| `0-5` | 2px | Tight gap giữa icon + text trong badge/tag |
| `1` | 4px | Tight internal padding, gap giữa icon + label nhỏ |
| `1-5` | 6px | Padding sm control, gap giữa related items |
| `2` | 8px | Default gap giữa related elements, padding input sm |
| `3` | 12px | Padding input/button default, gap giữa field rows |
| `4` | 16px | Padding card default, gap giữa sections |
| `5` | 20px | Padding lg, gap giữa major sections |
| `6` | 24px | Padding dialog, gap giữa panels |
| `8` | 32px | Gap giữa top-level sections, padding page |
| `12` | 48px | Section vertical gap lớn |
| `16` | 64px | Page-level vertical rhythm |
| `20` | 80px | Hero spacing |
| `24` | 96px | Max section gap |

**Quy tắc:**
- Step nhỏ (0.5–2): tight internal spacing trong component.
- Step trung (3–6): padding component, gap giữa field rows.
- Step lớn (8–24): gap giữa sections, page rhythm.
- **Cấm:** raw px ngoài scale. Nếu cần giá trị giữa, thêm step `x-5` vào tokens.json.

---

## 4. Typography — semantic type scale

### 4.1. Font family

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--font-family` | `'Inter', -apple-system, ...` | Body, heading, UI |
| `--font-family-mono` | `ui-monospace, 'SF Mono', ...` | Code, mono content |

### 4.2. Font size

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--font-size-2xs` | `var(--font-size-xs)` | Micro label, overline |
| `--font-size-xs` | 12px | Caption, badge, small label |
| `--font-size-sm` | 14px | Supporting text, secondary label |
| `--font-size-base` | 14px | Body text, default UI |
| `--font-size-md` | `var(--font-size-base)` | Medium body |
| `--font-size-lg` | `var(--font-size-base)` | Section title |
| `--font-size-xl` | `var(--font-size-base)` | Panel title |
| `--font-size-2xl` | `var(--font-size-base)` | Page title |
| `--font-size-3xl` | `var(--font-size-base)` | Display |
| `--font-size-4xl` | `var(--font-size-base)` | Hero |

**Quy tắc:** dùng semantic name khi có (`--text-body`, `--text-label`, `--text-heading-1`). Nếu chưa có, dùng `--font-size-{scale}`.

### 4.3. Font weight

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--font-weight-regular` | 400 | Body, code |
| `--font-weight-medium` | 500 | Label, data, metadata |
| `--font-weight-semibold` | 600 | Heading, title, button label |
| `--font-weight-bold` | 700 | Strong emphasis |

### 4.4. Line height

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--leading-none` | 1 | Icon, single line |
| `--leading-tight` | 1.25 | Heading |
| `--leading-snug` | 1.375 | Subtitle, subtitle block |
| `--leading-normal` | 1.5 | Body, paragraph |

---

## 5. Shape / Radius — khi nào dùng

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--radius-none` | 0 | Sharp edge (divider, table cell edge) |
| `--radius-xs` | 2px | Tiny element (status dot, micro badge) |
| `--radius-2xs` | 4px | Small inline element (tag inner) |
| `--radius-sm` | 6px | Small control (checkbox, radio) |
| `--radius-md` | 8px | Inner element trong card |
| `--radius-pill` | 18px | Button, input, select (element-level) |
| `--radius-card` | 10px | Card, panel (container-level) |
| `--radius-dialog` | 12px | Dialog, modal (container-level) |
| `--radius-2xl` | 24px | Large container, sheet |
| `--radius-full` | 9999px | Avatar, icon button, pill badge |

**Concentric radius:** khi container bo góc có padding, inner element dùng `max(0, outerRadius - padding)`.

**Semantic mapping (đề xuất bổ sung):**

| Semantic token | Alias cho | Dùng cho |
|----------------|-----------|----------|
| `--radius-inner` | `--radius-md` (8px) | Inner element trong container |
| `--radius-element` | `--radius-pill` (18px) | Button, input, select |
| `--radius-container` | `--radius-card` (10px) | Card, panel |
| `--radius-page` | `--radius-2xl` (24px) | Page-level container |

---

## 6. Elevation / Shadow — khi nào dùng

| Token | Level | Dùng cho |
|-------|-------|----------|
| `--shadow-sm` | none | Flat, embedded trong surface (card trong grid, button) |
| `--shadow-md` | none | In-flow nhưng tách biệt (raised card) |
| `--shadow-lg` | none | Reserved cho dialog/modal (hiện none) |
| `--shadow-floating` | low | Float trên content gần (popover, FAB) |
| `--shadow-popover` | med | Popover, dropdown, floating banner |
| `--shadow-modal` | high | Modal dialog, fullscreen overlay |
| `--shadow-focus` | — | Focus ring (input focus) |

**Quy tắc:**
- Default: flat (no shadow). Shadow chỉ khi cần tách biệt khỏi background.
- Dialog/modal: `--shadow-modal`.
- Popover/dropdown: `--shadow-popover`.
- Card: `--shadow-sm` (none) + border hairline. Dùng `--shadow-md` chỉ khi raised.

**Cell principle P1 (Content-first):** flat, no shadow, hairline 1px border. Shadow chỉ cho overlay/floating.

---

## 7. Motion — khi nào dùng

### 7.1. Duration

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--duration-75` | 75ms | Micro feedback (ripple, tap) |
| `--duration-100` | 100ms | Quick toggle |
| `--duration-150` (`--duration-fast`) | 150ms | Hover, small transition |
| `--duration-200` (`--duration-normal`) | 200ms | Default transition |
| `--duration-300` (`--duration-slow`) | 300ms | Panel, dialog, expand |
| `--duration-1000`+ | 1000ms+ | Continuous motion, long animation |

### 7.2. Easing

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--ease-standard` | ease | Default |
| `--ease-out` | ease-out | Enter (element xuất hiện) |
| `--ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Enter + exit |
| `--ease-bounce` | cubic-bezier(0.175, 0.885, 0.32, 1.275) | Bouncy feedback |
| `--ease-spring` | cubic-bezier(0.34, 1.56, 0.64, 1) | Spring enter |

### 7.3. Nguyên tắc

- **Animate khi cần orient user:** panel/dialog mở, content expand, element enter screen.
- **Không animate high-frequency:** table row hover, list item highlight, keyboard shortcuts.
- **Exit match entrance:** panel trượt từ phải vào thì trượt ra phải.
- **Direction match action:** navigate sâu hơn → tiến; back → quay lại.
- **Contextual UI connect to trigger:** dropdown mở từ button, popover gần element.
- **Reduced motion:** tôn trọng `prefers-reduced-motion` — tắt animation khi OS yêu cầu.

---

## 8. Icons — naming convention

### 8.1. Semantic naming (bắt buộc)

Tên icon theo **ngữ nghĩa**, không theo hình dạng.

| Semantic name | Dùng cho | Cell hiện tại |
|---------------|----------|---------------|
| `close` | Dismiss, close | `x` |
| `chevronDown` | Dropdown, expand | `chevronDown` ✓ |
| `chevronLeft` | Navigate back | `chevronLeft` ✓ |
| `chevronRight` | Navigate forward | `chevronRight` ✓ |
| `check` | Checkbox checked, confirm | `check` ✓ |
| `search` | Search input | `search` ✓ |
| `menu` | Hamburger menu | `menu` ✓ |
| `settings` | Settings, config | `settings` ✓ |
| `download` | Download action | `download` ✓ |
| `trash` | Delete | `trash` ✓ |
| `copy` | Copy to clipboard | `copy` ✓ |
| `info` | Info, tooltip | `info` ✓ |
| `alertCircle` | Warning, caution | `alertCircle` ✓ |
| `play` / `pause` | Media control | `play` / `pause` ✓ |

**Quy tắc:**
- Trước khi tạo icon mới: query `ICON_CATALOG` bằng tag/keyword → reuse.
- Nếu tạo mới: thêm vào `ICON_CATALOG` với semantic name + tags.
- **Cấm** inline SVG trong component. Phải import từ `ICON_CATALOG`.

### 8.2. Icon size

| Size | Value | Dùng cho |
|------|-------|----------|
| `xs` | 16px | Inline icon trong text, badge |
| `sm` | 20px | Icon trong button sm, nav item |
| `md` | 24px | Default icon button, nav cluster |
| `lg` | 32px | Large icon button, empty state |

---

## 9. Z-index — layer order

| Token | Value | Dùng cho |
|-------|-------|----------|
| `--z-dropdown` | 1000 | Dropdown, select menu |
| `--z-sticky` | 1100 | Sticky header, sticky nav |
| `--z-modal` | 1200 | Modal dialog |
| `--z-popover` | 1300 | Popover, hover card |
| `--z-tooltip` | 1400 | Tooltip |
| `--z-popup-base` | 9999 | Popup dictionary base |
| `--z-popup-top` | 10000 | Popup dictionary top |
| `--z-subtitle-native` | 999998 | Subtitle native overlay |
| `--z-subtitle-target` | 999999 | Subtitle target overlay |
| `--z-overlay-video` | 2147483640 | Overlay trên video player |
| `--z-overlay-video-popover` | 2147483641 | Popover trên video overlay |
| `--z-overlay-settings` | 2147483645 | Settings dialog trên video |
| `--z-overlay-secondary` | 2147483646 | Universal panel |
| `--z-overlay-top` | 2147483647 | Orbital badge (topmost) |

**Quy tắc:** không hardcode z-index. Luôn dùng token. Nếu cần layer mới, thêm vào tokens.json.

---

## 10. Component token — khi nào tạo

**Tạo component token khi:**
- Component có giá trị khác default (button radius = pill, không phải card radius).
- Component có nhiều variant cần override (button primary/secondary/outline).
- Component dùng ở nhiều context và cần consistent (input padding).

**KHÔNG tạo component token khi:**
- Giá trị = default semantic token (card bg = `--color-card` → không cần `card-bg`).
- Chỉ dùng 1 lần.
- Có thể dùng utility token (`--space-4`, `--color-border`).

---

## 11. Audit checklist (chạy trước merge)

```bash
# 1. Hardcoded colors (should be 0 outside tokens.css + SubtitlePreview)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" | grep -v tokens.css | grep -v SubtitlePreview

# 2. Wrong hover token (should be 0)
grep -rn 'color-accent' src/ --include="*.css" | grep hover

# 3. Missing token import (entrypoints must import tokens.css)
grep -rn 'tokens.css' src/entrypoints/

# 4. Raw px outside scale (should be 0)
grep -rn 'px' src/shared/ui/ --include="*.module.css" | grep -v 'var(' | grep -v '0px'

# 5. Inline SVG in component (should be 0)
grep -rn '<svg' src/ --include="*.tsx" | grep -v Icon.tsx | grep -v icons/

# 6. Hardcoded z-index (should be 0)
grep -rn 'z-index:' src/ --include="*.css" | grep -v 'var(--z-' | grep -v tokens
```

---

## 12. Migration plan — tokens.json

### 12.1. Rename (break, có alias ngược)

| Hiện tại | Mới | Alias |
|----------|-----|-------|
| `--color-foreground` | `--color-text-primary` | giữ `--color-foreground` = `var(--color-text-primary)` |
| `--color-text-muted` | `--color-text-secondary` | giữ `--color-text-muted` = `var(--color-text-secondary)` |
| `--color-card` | `--color-surface-card` | giữ `--color-card` = `var(--color-surface-card)` |
| `--color-popover` | `--color-surface-popover` | giữ `--color-popover` = `var(--color-surface-popover)` |

### 12.2. Add (semantic layer mới)

| Token | Tham chiếu | Dùng cho |
|-------|------------|----------|
| `--color-text-disabled` | primitive | Text disabled |
| `--color-icon-primary` | `var(--color-text-primary)` | Icon chính |
| `--color-icon-secondary` | `var(--color-text-secondary)` | Icon phụ |
| `--color-icon-disabled` | `var(--color-text-disabled)` | Icon disabled |
| `--color-on-success` | primitive | Text trên success bg |
| `--color-on-warning` | primitive | Text trên warning bg |
| `--color-on-error` | primitive | Text trên error bg |
| `--color-overlay` | primitive | Modal backdrop |
| `--color-overlay-hover` | primitive | Hover overlay |
| `--color-overlay-pressed` | primitive | Pressed overlay |
| `--color-border-emphasized` | primitive | Border nhấn mạnh |
| `--color-skeleton` | primitive | Skeleton background |

### 12.3. Add (semantic radius)

| Token | Alias | Dùng cho |
|-------|-------|----------|
| `--radius-inner` | `--radius-md` (8px) | Inner element |
| `--radius-element` | `--radius-pill` (18px) | Button, input |
| `--radius-container` | `--radius-card` (10px) | Card, panel |
| `--radius-page` | `--radius-2xl` (24px) | Page container |

### 12.4. Add (semantic typography)

| Token | Composition | Dùng cho |
|-------|-------------|----------|
| `--text-body` | size base + weight regular + leading normal | Body paragraph |
| `--text-label` | size base + weight medium + leading normal | Form label |
| `--text-heading-1` | size 2xl + weight semibold + leading tight | Page title |
| `--text-heading-2` | size xl + weight semibold + leading tight | Section title |
| `--text-heading-3` | size lg + weight semibold + leading snug | Panel title |
| `--text-supporting` | size sm + weight regular + leading normal | Hint, description |

---

## 13. Khi đọc gì

| Tình huống | Đọc file |
|------------|----------|
| Thêm/sửa token | `tokens.json` + document này |
| Thêm component mới | `src/shared/ui/` component gần nhất + document này |
| Không rõ dùng variant nào | component `.tsx` + `.module.css` trong `src/shared/ui/` |
| Tham khảo best practice | `docs/design-system/daft.md` |
| Audit trước merge | Section 11 audit checklist |
