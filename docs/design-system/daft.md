# Design System Reference — Meta/Facebook Best Practices — Draft

> Bản tổng hợp từ hệ thống thiết kế của Meta/Facebook để xem xét áp dụng vào Cell.  
> **Nguồn chính:** [Astryx](https://astryx.atmeta.com) — bộ design system open-source gần nhất với cách Meta xây dựng FDS/IGDS/MDS/WADS nội bộ. Bổ sung từ StyleX, Design Systems @ Scale, Origami, Meta Design, Meta Horizon OS guidelines.

---

## 1. Tóm tắt nguồn tham khảo (10+ nguồn đáng tin cậy)

| # | Nguồn | URL | Cung cấp |
|---|-------|-----|----------|
| 1 | Astryx Docs | https://astryx.atmeta.com/docs | Toàn bộ tokens, components, principles, layout |
| 2 | Astryx GitHub | https://github.com/facebook/astryx | Source, packages, themes, examples |
| 3 | StyleX at Meta | https://engineering.fb.com/2025/11/11/web/stylex-a-styling-library-for-css-at-scale/ | Cách Meta viết CSS ở quy mô lớn, atomic CSS, design tokens |
| 4 | Astryx Tokens | https://astryx.atmeta.com/docs/tokens | Full token reference |
| 5 | Astryx Color | https://astryx.atmeta.com/docs/color | Semantic color tokens |
| 6 | Astryx Spacing | https://astryx.atmeta.com/docs/spacing | 4px base spacing scale |
| 7 | Astryx Typography | https://astryx.atmeta.com/docs/typography | Geometric type scale, font family, weights, line-height |
| 8 | Astryx Icons | https://astryx.atmeta.com/docs/icons | Semantic icon names, icon registry |
| 9 | Astryx Shape | https://astryx.atmeta.com/docs/shape | Radius tokens, concentric radius |
| 10 | Astryx Elevation | https://astryx.atmeta.com/docs/elevation | Shadow/elevation levels |
| 11 | Astryx Motion | https://astryx.atmeta.com/docs/motion | Duration/easing, reduced motion |
| 12 | Astryx Principles | https://astryx.atmeta.com/docs/principles | Core philosophy, rules, anti-patterns |
| 13 | Astryx Layout | https://astryx.atmeta.com/docs/layout | Frame-first layout, app archetypes, cards vs rows |
| 14 | Meta Design | https://design.facebook.com | Resources, teams, tools, design culture |
| 15 | Origami Studio | https://origami.design | Prototyping tool dùng trong Meta |
| 16 | Meta Accessibility | https://www.meta.com/design-at-meta/blog/accessibility-and-design-systems | DS gắn với accessibility, ~30% issues sửa được qua DS |
| 17 | Meta Horizon Fonts & Icons | https://latest.developers.meta.com/horizon/design/fonts-icons | Icon grid, typography, icon sizes |
| 18 | Design Systems @ Scale | https://atscaleconference.com/design-systems-scale | FDS, IGDS, MDS, WADS, DSP, >20 hệ thống tại Meta |
| 19 | Facebook Design Systems overview | https://www.timrosenberg.com/facebook-design-systems | Atomic → primitives → patterns → surfaces |
| 20 | Figma Design Tokens | https://www.figma.com/resource-library/design-tokens | Token layers: primitive, semantic, component |

---

## 2. Triết lý & nguyên tắc từ Meta/Astryx

### 2.1. Triết lý thiết kế

- **Components over primitives:** dùng component có sẵn trước khi viết raw HTML.
- **Semantic tokens over hardcoded values:** tên token theo mục đích (`--color-text-primary`), không theo màu sắc (`#171717`).
- **Theme-agnostic code:** code không bao giờ tham chiếu màu/cỡ cụ thể; light/dark/theme đổi tự động.
- **Open internals:** mọi primitive đều được export để compose khi cần.

### 2.2. Cấu trúc token 3 lớp (theo Figma + Meta @ Scale)

```
Primitive tokens  →  Semantic tokens  →  Component tokens
(#0171E3)            (color-text-primary)  (button-primary-bg)
```

- **Primitive:** giá trị thô (hex, px, rem).
- **Semantic:** giá trị theo vai trò trong UI (text, surface, border, accent).
- **Component:** giá trị cụ thể cho từng phần tử component (button bg, card radius, input padding).

### 2.3. Quy tắc Astryx

1. Dùng component cho mọi thứ component có thể cover.
2. **Layout là frame-first:** chọn shell và budget vùng trước khi viết content.
3. Dense data render bằng rows (Table/List/Item), edge-to-edge với divider; Card chỉ dùng cho widget, gallery, settings group.
4. StyleX hoặc Tailwind cho custom styling; cả hai đều resolve về cùng design tokens.
5. Dùng semantic tokens, không hardcode.
6. CSS custom properties cho màu, không dùng hex inline.
7. Form inputs là controlled (`value` + `onChange`).
8. `useLinkComponent()` cho navigation để consumer có thể plug router framework.

### 2.4. Anti-patterns

| Don't | Why |
|-------|-----|
| Inline styles trên raw element | Dùng `xstyle` trên component |
| Hardcoded colors (`#fff`) | Dùng `var(--color-*)` |
| Hardcoded spacing (`16px`) | Dùng spacing tokens |
| Hardcoded `<a>` element | Dùng `useLinkComponent()` |
| Wrap mọi list item/page section trong Card | Quyết định frame trước; dense data → rows |
| Dùng Badge như decoration | Badge chỉ cho count/enumerated states; status dùng StatusDot/Token |
| Invent props | Đọc component docs trước |

---

## 3. Design Tokens (Astryx)

### 3.1. Color Tokens

Astryx dùng **semantic color tokens**, tự động chuyển light/dark qua `light-dark()`. Giá trị dưới đây là `light / dark`.

#### Core / Surface / Text

| Token | Light | Dark | Ý nghĩa |
|-------|-------|------|---------|
| `--color-accent` | `#262626` | `#ebebeb` | Màu accent chính |
| `--color-accent-muted` | `#f1f1f1` | `#262626` | Accent nhạt/background |
| `--color-on-accent` | `#ffffff` | `#171717` | Nội dung trên accent |
| `--color-neutral` | `#0000000F` | `#FFFFFF1A` | Nền neutral transparent |
| `--color-background-surface` | `#ffffff` | `#262626` | Nền surface chính |
| `--color-background-body` | `#f1f1f1` | `#1b1b1b` | Nền body/page |
| `--color-background-muted` | `#f1f1f1` | `#1b1b1b` | Nền muted |
| `--color-background-card` | `#ffffff` | `#1b1b1b` | Nền card |
| `--color-background-popover` | `#ffffff` | `#1b1b1b` | Nền popover |
| `--color-background-inverted` | `#0A1317` | `#FFFFFF` | Nền inverted |
| `--color-background-error-inverted` | `#AA071E` | `#E3193B` | Error inverted |
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
| `--color-skeleton` | `#ebebeb` | `#525252` | Skeleton |
| `--color-track` | `#CCD3DB` | `#5A5E66` | Track (slider/switch) |
| `--color-shadow` | `#0000001A` | `#0000004D` | Shadow color |
| `--color-tint-hover` | `black` | `white` | Tint hover |

#### Status Colors

| Token | Light | Dark | Ý nghĩa |
|-------|-------|------|---------|
| `--color-success` | `#007004` | `#9fe59b` | Success |
| `--color-success-muted` | `#c5e5c0` | `#84c9803D` | Success background |
| `--color-on-success` | `#ffffff` | `#171717` | Text trên success |
| `--color-error` | `#a50c25` | `#ffc6c1` | Error |
| `--color-error-muted` | `#facecb` | `#ff9e973D` | Error background |
| `--color-on-error` | `#ffffff` | `#171717` | Text trên error |
| `--color-warning` | `#745b00` | `#fdcf4f` | Warning |
| `--color-warning-muted` | `#f8da9d` | `#deb4333D` | Warning background |
| `--color-on-warning` | `#171717` | `#171717` | Text trên warning |

#### Tint Colors (background/border/icon/text)

| Màu | Background | Border | Icon | Text |
|-----|------------|--------|------|------|
| Blue | `#c4ddfb` / `#9eb7ff3D` | `#b1c9e7` / `#6d9cfe` | `#00458c` / `#9eb7ff` | `#00458c` / `#c7d3ff` |
| Cyan | `#a3e0ef` / `#83c2d43D` | `#91d3e3` / `#67a7b8` | `#00505f` / `#83c2d4` | `#00505f` / `#9edef0` |
| Gray | `#e5e5e5` / `var(--color-neutral)` | `#d4d4d4` / `#262626` | `#525252` / `#a3a3a3` | `#262626` / `#e5e5e5` |
| Green | `#c5e5c0` / `#84c9803D` | `#b2d1ac` / `#69ad67` | `#0c5700` / `#84c980` | `#0c5700` / `#9fe59b` |
| Orange | `#fad0b5` / `#ffa2583D` | `#e6bda2` / `#e2883e` | `#6e3500` / `#ffa258` | `#6e3500` / `#ffc9a2` |
| Pink | `#fccadc` / `#ff99c33D` | `#e7b7c8` / `#f273aa` | `#83004b` / `#ff99c3` | `#83004b` / `#ffc3da` |
| Purple | `#eccef3` / `#f297ff3D` | `#d8bbdf` / `#dd74f0` | `#700084` / `#f297ff` | `#700084` / `#fac1ff` |
| Red | `#facecb` / `#ff9e973D` | `#e6bab8` / `#ff6f6c` | `#89001a` / `#ff9e97` | `#89001a` / `#ffc6c1` |
| Teal | `#a5e3d6` / `#7ec6b83D` | `#94d6c8` / `#63ab9d` | `#005348` / `#7ec6b8` | `#005348` / `#99e2d3` |
| Yellow | `#f8da9d` / `#deb4333D` | `#e4c279` / `#c0990e` | `#584400` / `#deb433` | `#584400` / `#fdcf4f` |

#### Data Visualization Colors

| Token | Giá trị |
|-------|---------|
| `--color-data-categorical-blue` | `#0171E3` |
| `--color-data-categorical-orange` | `#EB6E00` |
| `--color-data-categorical-purple` | `#6B1EFD` |
| `--color-data-categorical-green` | `#0B991F` |
| `--color-data-categorical-pink` | `#F351C0` |
| `--color-data-categorical-cyan` | `#0171A4` |
| `--color-data-categorical-red` | `#F5394F` |
| `--color-data-categorical-teal` | `#08A3A3` |
| `--color-data-categorical-brown` | `#965E03` |
| `--color-data-categorical-indigo` | `#6F8AFF` |
| `--color-data-neutral` | `#8494A3` / `#8C939B` |

#### Syntax Colors

| Token | Light | Dark |
|-------|-------|------|
| `--color-syntax-keyword` | `#700084` | `#efa8ff` |
| `--color-syntax-string` | `#005600` | `#a6d2a2` |
| `--color-syntax-comment` | `#737373` | `#a3a3a3` |
| `--color-syntax-number` | `#6e3500` | `#ffb37f` |
| `--color-syntax-function` | `#00458c` | `#a0caff` |
| `--color-syntax-type` | `#700084` | `#efa8ff` |
| `--color-syntax-variable` | `#171717` | `#e5e5e5` |
| `--color-syntax-operator` | `#737373` | `#a3a3a3` |
| `--color-syntax-constant` | `#6e3500` | `#ffb37f` |
| `--color-syntax-tag` | `#89001a` | `#ffaeaa` |
| `--color-syntax-attribute` | `#584400` | `#eec12f` |
| `--color-syntax-property` | `#005348` | `#83dac9` |
| `--color-syntax-punctuation` | `#a3a3a3` | `#525252` |
| `--color-syntax-background` | `#fafafa` | `#0a0a0a` |

### 3.2. Spacing Scale

Astryx dùng **4px base-unit scale**. Giá trị dưới là pixel.

| Token | Giá trị | Token | Giá trị |
|-------|---------|-------|---------|
| `--spacing-0` | `0px` | `--spacing-7` | `28px` |
| `--spacing-0-5` | `2px` | `--spacing-8` | `32px` |
| `--spacing-1` | `4px` | `--spacing-9` | `36px` |
| `--spacing-1-5` | `6px` | `--spacing-10` | `40px` |
| `--spacing-2` | `8px` | `--spacing-11` | `44px` |
| `--spacing-3` | `12px` | `--spacing-12` | `48px` |
| `--spacing-4` | `16px` | | |
| `--spacing-5` | `20px` | | |
| `--spacing-6` | `24px` | | |

**Best practice:**

- Do: dùng gap prop của component khi có; dùng token cho custom layout; dùng step nhỏ (0.5–2) cho tight internal spacing, step lớn (4–8) cho section gaps.
- Don't: dùng giá trị px tùy tiện ngoài scale; mix token với raw px/rem trong cùng component.

### 3.3. Typography

Astryx dùng **geometric type scale**: `round(base × ratio^step)`, với `base = 14px`, `ratio = 1.2`. Tất cả font sizes dưới là rem.

#### Font Family

| Token | Giá trị |
|-------|---------|
| `--font-family-body` | `Figtree` |
| `--font-family-heading` | `Figtree` |
| `--font-family-code` | `"SF Mono"` |

#### Font Size Tokens

| Token | Value | Token | Value |
|-------|-------|-------|-------|
| `--font-size-4xs` | `0.375rem` (~6px) | `--font-size-xl` | `1.25rem` (~20px) |
| `--font-size-3xs` | `0.4375rem` (~7px) | `--font-size-2xl` | `1.5rem` (~24px) |
| `--font-size-2xs` | `0.5rem` (~8px) | `--font-size-3xl` | `1.8125rem` (~29px) |
| `--font-size-xs` | `0.625rem` (~10px) | `--font-size-4xl` | `2.1875rem` (~35px) |
| `--font-size-sm` | `0.75rem` (~12px) | `--font-size-5xl` | `2.625rem` (~42px) |
| `--font-size-base` | `0.875rem` (~14px) | | |
| `--font-size-lg` | `1.0625rem` (~17px) | | |

#### Font Weight Tokens

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--font-weight-normal` | `400` | Body, code |
| `--font-weight-medium` | `500` | Labels, data |
| `--font-weight-semibold` | `600` | Headings, titles |
| `--font-weight-bold` | `700` | Strong emphasis |

#### Type Scale Semantics

| Style | Size | Weight | Line-height | Gap |
|-------|------|--------|-------------|-----|
| H1 | `1.5rem` | `600` | `1.3333` | `2px` |
| H2 | `1.25rem` | `600` | `1.4` | `2px` |
| H3 | `1.0625rem` | `600` | `1.4118` | `2px` |
| H4 | `0.875rem` | `600` | `1.4286` | `1px` |
| H5 | `0.75rem` | `600` | `1.6667` | `1px` |
| H6 | `0.625rem` | `600` | `1.6` | `1px` |
| Display 1 | `2.625rem` | `600` | `1.2381` | `3px` |
| Display 2 | `2.1875rem` | `600` | `1.2571` | `3px` |
| Display 3 | `1.8125rem` | `600` | `1.2414` | `2px` |
| Large | `1.0625rem` | `600` | `1.4118` | `2px` |
| Body | `0.875rem` | `400` | `1.4286` | `1px` |
| Label | `0.875rem` | `500` | `1.4286` | `1px` |
| Code | `0.875rem` | `400` | `1.4286` | `1px` |
| Supporting | `0.75rem` | `400` | `1.6667` | `1px` |

**Line-height logic:** small text (<20px) target `1.5`, medium (20–31px) target `1.4`, large (≥32px) target `1.25`; sau đó snap về 4px grid.

### 3.4. Shape / Radius

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--radius-none` | `0px` | Sharp |
| `--radius-inner` | `8px` | Inner elements |
| `--radius-element` | `12px` | Buttons, inputs, selectors |
| `--radius-container` | `16px` | Cards, panels, dialogs |
| `--radius-page` | `32px` | Page-level containers |
| `--radius-chat` | `28px` | Chat bubbles |
| `--radius-full` | `9999px` | Pills, badges, tags, avatar status |

**Concentric radius:** khi container bo góc có padding, inner element nên dùng `max(0, outerRadius - padding)`.

### 3.5. Elevation / Shadow

| Token | Ý nghĩa |
|-------|---------|
| `--shadow-low` | Surface in-flow nhưng tách biệt khỏi background |
| `--shadow-med` | Float trên content gần (popover, floating banner, FAB) |
| `--shadow-high` | Topmost layer (modal dialog, fullscreen overlay) |
| `--shadow-inset-hover` | Hover state ring inset |
| `--shadow-inset-selected` | Selected state ring inset |
| `--shadow-inset-success` | Success state ring inset |
| `--shadow-inset-warning` | Warning state ring inset |
| `--shadow-inset-error` | Error state ring inset |

**Elevation usage:**

| Level | Khi nào dùng | Ví dụ |
|-------|--------------|-------|
| `none` | Flat, embedded trong surface | Card trong grid, Banner, Button |
| `low` | In-flow nhưng cần tách biệt | Raised Card, ChatComposer |
| `med` | Float trên content gần | Popover, floating Banner, FAB |
| `high` | Trên toàn bộ UI | Modal Dialog, overlay |

### 3.6. Motion

#### Duration Tokens

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--duration-fast-min` | `130ms` | Micro-interactions |
| `--duration-fast` | `175ms` | Hover, small transitions |
| `--duration-fast-max` | `230ms` | Micro max |
| `--duration-medium-min` | `310ms` | Entrance/exit min |
| `--duration-medium` | `410ms` | Panel, dialog, expand |
| `--duration-medium-max` | `550ms` | Entrance/exit max |
| `--duration-slow-min` | `730ms` | Continuous motion min |
| `--duration-slow` | `975ms` | Continuous |
| `--duration-slow-max` | `1300ms` | Continuous max |

#### Easing

| Token | Giá trị |
|-------|---------|
| `--ease-standard` | `cubic-bezier(0.24, 1, 0.4, 1)` |

**Motion principles:**

- **Animate khi cần orient user:** panel/dialog mở, content expand, element enter screen.
- **Không animate high-frequency:** table row hover, list item highlight, keyboard shortcuts.
- **Exit match entrance:** panel trượt từ phải vào thì trượt ra phải.
- **Direction match action:** navigate sâu hơn → tiến; back → quay lại.
- **Contextual UI connect to trigger:** dropdown mở từ button, popover gần element.
- **Reduced motion:** tôn trọng `prefers-reduced-motion`.

### 3.7. Size & Border

| Token | Giá trị | Ý nghĩa |
|-------|---------|---------|
| `--size-element-sm` | `28px` | Small control height |
| `--size-element-md` | `32px` | Medium control height |
| `--size-element-lg` | `36px` | Large control height |
| `--border-width` | `1px` | Default border width |

---

## 4. Icons

### 4.1. Semantic Icon Names (Astryx)

Astryx quy định tên icon theo ngữ nghĩa, không theo hình dạng. Theme có thể swap SVG bằng `registerIcons()`.

| Tên | Dùng cho |
|-----|----------|
| `close` | Dismiss, close dialogs/panels |
| `chevronDown` | Dropdown trigger, expand/collapse |
| `chevronLeft` | Navigate back |
| `chevronRight` | Navigate forward |
| `check` | Checkbox checked, confirm |
| `success` | Success status indicator |
| `error` | Error status indicator |
| `warning` | Warning status indicator |
| `info` | Info status, tooltips |
| `calendar` | Date pickers, scheduling |
| `clock` | Time pickers, timestamps |
| `externalLink` | Links opening in new tab |
| `menu` | Hamburger menu, nav toggle |
| `moreHorizontal` | Overflow menu |
| `search` | Search input, find |
| `arrowUp` | Sort ascending, move up |
| `arrowDown` | Sort descending, move down |
| `arrowsUpDown` | Sortable column |
| `funnel` | Filter controls |
| `eyeSlash` | Hidden/visibility toggle |
| `viewColumns` | Column visibility settings |
| `copy` | Copy to clipboard |
| `checkDouble` | Copied confirmation |
| `wrench` | Settings, configuration |
| `stop` | Stop/cancel action |
| `microphone` | Voice input, audio recording |

### 4.2. Meta Horizon OS Icon Guidelines

- **Grid:** 24×24 dp artboard, vẽ trên 192×192 px grid để future-proof.
- **Live area:** 20×20 dp bên trong padding 2×2 dp.
- **Angles:** 45° increments khi có thể.
- **Keyline shapes:** square, rectangle (H/V), circle.
- **Sizes:**
  - 24dp: system icon phổ biến nhất.
  - 12/16dp: status icons.
  - 48dp: spot illustrations, ít dùng.
- **Filled vs outlined:** filled cho immersive (VR); outlined cho mobile/web.
- **Opacity:** 30% opacity cho trạng thái (battery, Wi-Fi), không apply toàn icon.

---

## 5. Components

### 5.1. Categories (Astryx component inventory)

Astryx có **150+ components** chia theo category:

| Category | Components chính |
|----------|------------------|
| **Action** | Button, ButtonGroup, IconButton, ToggleButton, ToggleButtonGroup, Toolbar, Link, MoreMenu |
| **Chat** | ChatComposer, ChatLayout, ChatMessage, ChatMessageMetadata, ChatSystemMessage, ChatToolCalls |
| **Container** | Card, ClickableCard, SelectableCard, Carousel, Collapsible |
| **Content** | Avatar, AvatarGroup, Blockquote, Citation, Code, CodeBlock, EmptyState, Heading, Icon, Kbd, Markdown, Text, Thumbnail, Timestamp, Token |
| **Data Input** | Calendar, CheckboxInput, DateInput, DateRangeInput, DateTimeInput, Field, FileInput, MultiSelector, NumberInput, PowerSearch, RadioList, Selector, Slider, Switch, TextArea, TextInput, TimeInput, Tokenizer, Typeahead |
| **Feedback & Status** | Badge, Banner, ProgressBar, Skeleton, Spinner, StatusDot |
| **Layout** | AppShell, AspectRatio, Divider, FormLayout, Grid, Layout, ResizeHandle, Section, Center, HStack, VStack, LayoutContent, LayoutFooter, LayoutHeader, LayoutPanel |
| **Navigation** | Breadcrumbs, Outline, Pagination, SideNav, TabList, TopNav, TopNavMegaMenu |
| **Overlay** | CommandPalette, Dialog, AlertDialog, HoverCard, Lightbox, Overlay, Popover, Toast, Tooltip |
| **Table & List** | List, ListItem, MetadataList, OverflowList, Table, TableCell, TableHeaderCell, TableRow, TreeList |
| **Utility** | VisuallyHidden, Theme, useTheme, useMediaQuery, useFocusTrap, useScrollLock, v.v. |

### 5.2. Best practice component (theo Astryx)

#### Button
- Variants: `primary`, `secondary`, `outline`, `ghost`, `destructive`.
- Sizes: `sm | md | lg` map với `--size-element-*`.
- Luôn dùng `<button>` hoặc component có focus, disabled, aria.
- `:active` nên có scale nhỏ (`transform: scale(0.97)`) để phản hồi.

#### Card
- Là **widget container**, không phải wrapper cho mọi list item.
- Dùng `elevation` prop: `none | low | med | high`.
- Không nest Card trong Card.

#### Dialog
- Compound component: `Dialog` + `Layout` + `LayoutHeader` + `LayoutContent` + `LayoutFooter`.
- Focus trap, close on Esc, click overlay.
- Max-width: `sm 384px | default 512px | lg 640px`.

#### TextInput
- Controlled: `value` + `onChange`.
- Field composition: `Field` + `FieldLabel` + `FieldStatus`.
- Error state: border và text dùng `--color-error`.

#### Table/List
- Dense data render dạng rows edge-to-edge, không wrap trong Card.
- Row height: `32–40px`.
- Dùng `List/Item` cho single-line records; `Table` cho columnar data.

---

## 6. Layout & Frame-First Standards

### 6.1. Frame-first workflow

1. **Pick the frame:** AppShell (top/side nav), Layout + LayoutPanel (multi-pane), hoặc plain content column.
2. **Budget regions:** side nav `240–280px`, icon rail `64–72px`, detail panel `340–420px`, filter rail `220–260px`.
3. **Container policy:** dense data → rows; widget/gallery → card grids.
4. **Responsive contract:** định nghĩa breakpoint behavior trước khi build.

### 6.2. App Archetypes

| Archetype | Frame | Container policy |
|-----------|-------|------------------|
| Tracker / work tool | AppShell + SideNav + inspector panel | Rows only, grouped edge-to-edge |
| Console / observability | AppShell + SideNav/TopNav + TabList | Card grid dashboard; Table còn lại |
| Messaging / feed | Column frame: rail + sidebar + stream | Rows + bubbles, no cards |
| Media library / gallery | AppShell + TopNav, grid content | Card grid, dense metadata rows |
| Settings / forms | AppShell + SideNav hoặc settings template | Sections với FormLayout; Card cho dangerous/billing actions |

### 6.3. Cards vs Rows

- **Dùng Table** cho columnar records (hosts, deployments, users).
- **Dùng List/Item** cho single-line records (issues, files, conversations).
- **Dùng Card** cho self-contained widgets (KPI, chart panels, gallery entries, settings groups).
- **Không** wrap mỗi list item trong Card, nest Card, hoặc dùng Card thay page structure.

### 6.4. Responsive Contract mẫu

```
// > 1024px  nav 256 | content | inspector 380
// <= 1024px inspector overlays content
// <= 768px  nav collapses into MobileNav drawer; toolbar actions wrap
```

---

## 7. Ngôn ngữ chung (Shared Language)

| Thuật ngữ | Định nghĩa | Ví dụ trong Cell |
|-----------|------------|------------------|
| **Design token** | Giá trị thiết kế được đặt tên, có thể tái sử dụng và themeable | `--color-primary`, `--spacing-4` trong `tokens.json` |
| **Primitive token** | Giá trị thô (hex, px, rem) | `#2563eb`, `16px` |
| **Semantic token** | Token theo vai trò UI | `--color-text-primary`, `--color-background-surface` |
| **Component token** | Token gắn với component cụ thể | `--button-bg`, `--card-radius` |
| **SSOT** | Single Source of Truth — sửa 1 chỗ, mọi nơi đồng bộ | `tokens.json` là nguồn chính cho Cell |
| **Theme-agnostic** | Code không phụ thuộc theme/mode cụ thể | Dùng `var(--color-text-primary)` thay vì `#0f172a` |
| **Elevation** | Độ nổi của surface qua shadow | `none | low | med | high` |
| **Touch target** | Vùng chạm tối thiểu | Mobile 44px, desktop 40px |
| **On-color** | Màu nội dung đặt trên một màu nền khác | `--color-on-accent`, `--color-on-success` |
| **Surface** | Lớp nền UI | `body → surface → card → popover` |
| **Accent** | Màu nhấn/brand | `--color-accent` |
| **Muted** | Biến thể nhạt hơn của accent hoặc status | `--color-accent-muted` |
| **Concentric radius** | Bán kính trong nhỏ hơn bán kính ngoài để trông đồng tâm | `max(0, outer - padding)` |
| **Reduced motion** | Tôn trọng `prefers-reduced-motion` | Tắt animation khi OS yêu cầu |
| **Frame-first** | Chọn layout frame trước khi viết content | AppShell/Layout/Panel trước, content sau |
| **Cards vs rows** | Phân biệt widget container với dense data container | Dense data → rows; widget → cards |

---

## 8. Áp dụng vào Cell — Khuyến nghị

### 8.1. Vị trí hiện tại của Cell

Cell đã có:
- `src/shared/styles/tokens.json` là canonical source.
- `tokens.css` và `tokens.ts` được generate bằng `scripts/generate-tokens.js`.
- `src/shared/ui/` component inventory (~25 components).
- `src/shared/icons/index.ts` (ICON_CATALOG).
- `src/shared/styles/README.md` là nguồn tham khảo DS hiện tại.

### 8.2. Những điểm có thể học từ Meta/Astryx

1. **Tách rõ 3 lớp token:**
   - `core` (primitive) → `derived` (semantic) → `component` (component-specific).
   - Hiện tại Cell đã có 3 lớp này trong `tokens.json`, nhưng có thể mở rộng semantic token theo hướng Astryx (`--color-text-primary`, `--color-background-surface`, `--color-border`).

2. **Chuyển từ color theo tên màu → color theo ngữ nghĩa:**
   - Thay vì `color: #475569`, dùng `var(--color-text-secondary)`.
   - Thay vì `background: #f8fafc`, dùng `var(--color-background-surface)`.

3. **Bổ sung token hệ thống:**
   - `--color-icon-*` (primary/secondary/disabled/accent).
   - `--color-on-primary`, `--color-on-success`, `--color-on-error`, `--color-on-warning`.
   - `--color-overlay`, `--color-overlay-hover`, `--color-overlay-pressed`.
   - `--radius-inner`, `--radius-element`, `--radius-container`, `--radius-page`.
   - `--duration-fast-min/max`, `--duration-medium-min/max`, `--duration-slow-min/max`.
   - `--ease-standard` (cubic-bezier cụ thể).
   - `--shadow-low`, `--shadow-med`, `--shadow-high`.

4. **Typography theo semantic type scale:**
   - Thay vì `font-size-xs/sm/base/md/lg/xl` chỉ là size, thêm `--text-body`, `--text-label`, `--text-heading-1`, `--text-heading-2`, `--text-supporting`.
   - Mỗi style bao gồm size + weight + line-height + letter-spacing.

5. **Spacing scale mở rộng:**
   - Cell hiện có spacing 0–24 + xs–3xl. Có thể chuẩn hóa theo Astryx: 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12.

6. **Radius semantic:**
   - Cell hiện có `none, xs, 2xs, sm, md, pill, card, dialog, 2xl, full`.
   - Có thể map: `card → radius-container`, `dialog → radius-container`, `pill → radius-full`.
   - Bổ sung `radius-inner`, `radius-element`, `radius-page`.

7. **Elevation/Shadow:**
   - Cell hiện set `shadow-sm/md/lg = none`. Có thể tái xem xét nếu cần elevation cho popover/dialog.

8. **Icons:**
   - Cell đã có `ICON_CATALOG` — nên thêm semantic names tương tự Astryx (`close`, `chevronDown`, `check`, `success`, `warning`, `info`, `search`, `externalLink`, `menu`, `wrench`) thay vì đặt tên theo hình dạng (`x`, `down`, `checkmark`).

### 8.3. Mapping token nhanh từ Meta → Cell

| Meta/Astryx token | Cell token tương đương hiện tại | Ghi chú |
|-------------------|--------------------------------|---------|
| `--color-background-surface` | `--color-background` / `--color-card` | Cần tách surface/card |
| `--color-background-body` | chưa có | Nên thêm |
| `--color-text-primary` | `--color-foreground` | Có thể rename |
| `--color-text-secondary` | `--color-text-muted` | Có thể rename |
| `--color-text-disabled` | chưa có | Thêm |
| `--color-border` | `--color-border` | Đã có |
| `--color-accent` | `--color-primary` | Astryx accent là neutral; Cell dùng blue |
| `--color-on-accent` | `--color-primary-foreground` | Đã có |
| `--color-success` | `--color-success` | Đã có |
| `--color-error` | `--color-error` | Đã có |
| `--color-warning` | `--color-warning` | Đã có |
| `--color-icon-primary` | chưa có | Thêm |
| `--color-icon-secondary` | chưa có | Thêm |
| `--color-overlay` | chưa có | Thêm |
| `--spacing-4` | `--space-4` | Đã có |
| `--radius-element` | `--radius-pill` / `--radius-md` | Cần semantic hơn |
| `--radius-container` | `--radius-card` / `--radius-dialog` | Có thể unify |
| `--duration-fast` | `--duration-150` | Cell dùng 150ms |
| `--duration-medium` | `--duration-300` | Cell dùng 300ms |
| `--ease-standard` | `--ease-in-out` / `--ease-standard` | Có thể thay bằng cubic-bezier cụ thể |

### 8.4. Quy trình áp dụng khuyến nghị

1. **Phase 1 — Token alignment:** bổ sung semantic tokens vào `tokens.json`, regenerate `tokens.css`/`tokens.ts`.
2. **Phase 2 — Component refactor:** dùng token mới trong `src/shared/ui/*.module.css`, bắt đầu từ Button/Card/Input/Dialog.
3. **Phase 3 — Layout standards:** viết thêm guidance về frame-first, cards vs rows, responsive contract.
4. **Phase 4 — Icon registry:** thêm semantic icon names vào `ICON_CATALOG`.
5. **Phase 5 — Audit:** chạy grep hardcoded color/spacing, đảm bảo 0 hardcoded ngoài `tokens.json` + `SubtitlePreview`.

---

## 9. Audit Checklist (trước khi merge)

```bash
# 1. Hardcoded colors (should be 0 outside tokens.css + SubtitlePreview)
grep -rn '#[0-9a-fA-F]\{3,8\}' src/ --include="*.css" | grep -v tokens.css | grep -v SubtitlePreview

# 2. Wrong hover token (should be 0)
grep -rn 'color-accent' src/ --include="*.css" | grep hover

# 3. Missing token import (options/popup/sidepanel must import tokens.css)
grep -rn 'tokens.css' src/entrypoints/

# 4. Mix raw px with tokens
grep -rn 'px' src/shared/ui/ --include="*.module.css" | grep -v 'var(' | grep -v '0px'

# 5. Semantic icon naming in ICON_CATALOG
grep -rn "name: '" src/shared/icons/index.ts | grep -v "semantic"
```

---

## 10. Liên kết tham khảo nhanh

- Astryx docs: https://astryx.atmeta.com/docs
- Astryx components: https://astryx.atmeta.com/components
- Astryx GitHub: https://github.com/facebook/astryx
- StyleX: https://stylexjs.com
- Meta Design: https://design.facebook.com
- Origami: https://origami.design
- Meta Accessibility: https://www.meta.com/design-at-meta/blog/accessibility-and-design-systems
- Meta Horizon OS Fonts & Icons: https://latest.developers.meta.com/horizon/design/fonts-icons
- Design Systems @ Scale: https://atscaleconference.com/design-systems-scale
- Cell design system README: `src/shared/styles/README.md`
- Cell tokens: `src/shared/styles/tokens.json`
