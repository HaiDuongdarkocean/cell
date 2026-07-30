# Tri thức Design System — Atomic Design (Brad Frost)

> Nguồn sự thật về phương pháp thiết kế component. Tổng hợp từ 7 nguồn:
> 1. Brad Frost gốc (định nghĩa chính thức)
> 2. 4 design system lớn (Material, Fluent, Carbon, Polaris)
> 3. 5 React library (Radix, shadcn, Headless, Chakra, Mantine)
> 4. Extension/popup/overlay UI
> 5. Video/subtitle/dictionary/language-learning UI
> 6. `daft.md` — Meta/Astryx best practices (tokens, principles, layout, anti-patterns)
> 7. Astryx component inventory (https://astryx.atmeta.com/components — 150+ components)

---

## 1. Atomic Design — 5 cấp độ (Brad Frost, 2013)

> "Atomic design is not a linear process, but rather a mental model to help us think of our user interfaces as both a cohesive whole and a collection of parts at the same time." — Brad Frost

Phương pháp luận lấy cảm hứng từ hóa học: atom → molecule → organism → template → page. Assembling, không deconstructing.

### Bảng tổng quan

| Cấp | Name | Định nghĩa (Brad Frost) | Nguyên lý | Rules | Ví dụ |
|-----|------|-------------------------|-----------|-------|-------|
| 1 | **Atoms** | "Basic building blocks of matter. Applied to web interfaces, atoms are our HTML tags, such as a form label, an input or a button." | Nhỏ nhất, không chia nhỏ được mà không mất chức năng. Có thể là HTML tag HOẶC abstract (color, font, animation). | Không import component khác. Chỉ wrapper 1 HTML element. Dùng tokens. | 1. Form label `<label>` 2. Input `<input>` 3. Button `<button>` |
| 2 | **Molecules** | "Groups of atoms bonded together and are the smallest fundamental units of a compound." | 2+ atom kết hợp, có chức năng riêng, tangible hơn atom. "Do one thing and do it well." | Phải có 2+ atom. Relatively simple. Built for reuse. 1 chức năng rõ ràng. | 1. Search form (label + input + button) 2. Form field (label + input + error) 3. Nav item (icon + text link) |
| 3 | **Organisms** | "Groups of molecules joined together to form a relatively complex, distinct section of an interface." | 2+ molecule thành section độc lập. Có thể gồm molecule giống nhau (lặp) hoặc khác nhau. | Phải có 2+ molecule. Distinct section. Standalone, portable, reusable. | 1. Header (logo + nav + search + social) 2. Product grid (product molecule lặp) 3. Registration form (nhiều form field + submit) |
| 4 | **Templates** | "Consist mostly of groups of organisms stitched together to form pages." | Break chemistry analogy. Stitch organism thành layout. Cung cấp context cho molecule/organism. | Stitch organisms (không tạo mới). Định nghĩa layout. Placeholder content, không real content. | 1. Homepage template 2. Article template 3. Settings template |
| 5 | **Pages** | "Specific instances of templates. Placeholder content is replaced with real representative content." | Highest fidelity. Nơi TEST effectiveness của design system. Loop back sửa molecule/organism/template. | Thay placeholder bằng real content. Test variations (dài/ngắn, ít/nhiều). Loop back — không sửa tại page. | 1. Homepage (real hero + real products) 2. Article page (real title + real body) 3. Cart 10 items + discount code |

### Ranh giới cấp độ (quy tắc phân loại)

| Cấp | Quy tắc phân loại |
|-----|-------------------|
| **Atom** | Không import component nào khác. Chỉ wrapper 1 HTML element native. Dùng tokens. Chia nhỏ hơn → mất chức năng. |
| **Molecule** | Import 2+ atom. Có 1 chức năng rõ ràng. Relatively simple. |
| **Organism** | Import 2+ molecule. Tạo thành khu vực độc lập trên trang. |
| **Template** | Chỉ layout. Stitch organisms. Không có nội dung thật. |
| **Page** | Template + data thật. Nơi test, không nơi sửa. |

> Brad Frost: "Atoms can also include more abstract elements like color palettes, fonts and even more invisible aspects of an interface like animations." → Tokens (color, spacing, typography, shape, elevation, motion) thuộc tầng Atom theo định nghĩa gốc.

---

## 2. Định nghĩa nguyên văn của Brad Frost về Atom

> "Atoms are the basic building blocks of matter. Applied to web interfaces, atoms are our HTML tags, such as a form label, an input or a button."
> — https://bradfrost.com/blog/post/atomic-web-design/

> "Atoms can also include more abstract elements like color palettes, fonts and even more invisible aspects of an interface like animations."

> "Atoms are the basic building blocks of all matter. Each chemical element has distinct properties, and they can't be broken down further without losing their meaning."
> — https://github.com/bradfrost/atomic-design/blob/master/chapter-2.md

> "Atoms are UI elements that can't be broken down any further and serve as the elemental building blocks of an interface."

### Tiêu chí nhận diện Atom

1. Là basic building block (khối xây dựng cơ bản nhất)
2. Không thể broken down further mà không mất chức năng
3. Là HTML tags cơ bản (form label, input, button)
4. Có thể là abstract elements (color palettes, fonts, animations)
5. Serve as foundational building blocks cho toàn bộ UI

### Cái gì KHÔNG phải Atom

- **Molecule**: "Molecules are groups of atoms bonded together and are the smallest fundamental units of a compound."
- **Organism**: "Organisms are groups of molecules joined together to form a relatively complex, distinct section of an interface."

---

## 3. Sub-Atomic Layer — Tokens (nguyên tử của nguyên tử)

> Brad Frost: "Atoms can also include more abstract elements like color palettes, fonts and even more invisible aspects of an interface like animations."
> Nguồn: `daft.md` section 3 (Astryx tokens) + Figma Design Tokens (token layers: primitive, semantic, component).

Tokens không render ra UI nhưng cấu thành mọi atom. Atom tốt = atom được cấu thành từ tokens chuẩn. Không có tokens thì atom chỉ là wrapper HTML vô hồn.

### 3.1. Cấu trúc token 3 lớp

```
Primitive tokens  →  Semantic tokens  →  Component tokens
(#0171E3)            (color-text-primary)  (button-primary-bg)
```

- **Primitive**: giá trị thô (hex, px, rem).
- **Semantic**: giá trị theo vai trò UI (text, surface, border, accent).
- **Component**: giá trị cụ thể cho từng phần tử component (button bg, card radius, input padding).

### 3.2. Color Tokens (semantic, light/dark tự động qua `light-dark()`)

**Core / Surface / Text:**

| Token | Ý nghĩa |
|-------|---------|
| `--color-accent` / `--color-accent-muted` / `--color-on-accent` | Accent chính + nhạt + nội dung trên accent |
| `--color-neutral` | Nền neutral transparent |
| `--color-background-surface` / `--color-background-body` / `--color-background-muted` / `--color-background-card` / `--color-background-popover` / `--color-background-inverted` | Nền các tầng surface |
| `--color-overlay` / `--color-overlay-hover` / `--color-overlay-pressed` | Overlay backdrop |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-disabled` / `--color-text-accent` | Text theo vai trò |
| `--color-on-dark` / `--color-on-light` | Nội dung trên nền tối/sáng |
| `--color-icon-primary` / `--color-icon-secondary` / `--color-icon-disabled` / `--color-icon-accent` | Icon theo vai trò |
| `--color-border` / `--color-border-emphasized` | Border mặc định + nhấn mạnh |
| `--color-skeleton` / `--color-track` / `--color-shadow` / `--color-tint-hover` | Utility colors |

**Status Colors:**

| Token | Ý nghĩa |
|-------|---------|
| `--color-success` / `--color-success-muted` / `--color-on-success` | Success + background + text trên success |
| `--color-error` / `--color-error-muted` / `--color-on-error` | Error + background + text trên error |
| `--color-warning` / `--color-warning-muted` / `--color-on-warning` | Warning + background + text trên warning |

**Tint Colors** (Blue, Cyan, Gray, Green, Orange, Pink, Purple, Red, Teal, Yellow): mỗi màu có 4 biến thể `background / border / icon / text`.

**Data Visualization Colors**: `--color-data-categorical-{blue,orange,purple,green,pink,cyan,red,teal,brown,indigo}` + `--color-data-neutral`.

**Syntax Colors**: `--color-syntax-{keyword,string,comment,number,function,type,variable,operator,constant,tag,attribute,property,punctuation,background}`.

### 3.3. Spacing Scale (4px base-unit)

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

**Best practice:** step nhỏ (0.5–2) cho tight internal spacing, step lớn (4–8) cho section gaps. Không mix token với raw px/rem trong cùng component.

### 3.4. Typography (geometric type scale: base 14px, ratio 1.2)

**Font Family:** `--font-family-body` (Figtree), `--font-family-heading` (Figtree), `--font-family-code` (SF Mono).

**Font Size Tokens:** `--font-size-4xs` → `--font-size-5xl` (11 bước: 4xs, 3xs, 2xs, xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl).

**Font Weight Tokens:** `--font-weight-normal` (400, body/code), `--font-weight-medium` (500, labels/data), `--font-weight-semibold` (600, headings/titles), `--font-weight-bold` (700, strong emphasis).

**Type Scale Semantics** (size + weight + line-height + gap):

| Style | Size | Weight | Line-height |
|-------|------|--------|-------------|
| H1–H6 | 1.5rem → 0.625rem | 600 | 1.3333 → 1.6 |
| Display 1–3 | 2.625rem → 1.8125rem | 600 | 1.2381 → 1.2414 |
| Large | 1.0625rem | 600 | 1.4118 |
| Body | 0.875rem | 400 | 1.4286 |
| Label | 0.875rem | 500 | 1.4286 |
| Code | 0.875rem | 400 | 1.4286 |
| Supporting | 0.75rem | 400 | 1.6667 |

**Line-height logic:** small text (<20px) target 1.5, medium (20–31px) target 1.4, large (≥32px) target 1.25; snap về 4px grid.

### 3.5. Shape / Radius

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--radius-none` | `0px` | Sharp |
| `--radius-inner` | `8px` | Inner elements |
| `--radius-element` | `12px` | Buttons, inputs, selectors |
| `--radius-container` | `16px` | Cards, panels, dialogs |
| `--radius-page` | `32px` | Page-level containers |
| `--radius-chat` | `28px` | Chat bubbles |
| `--radius-full` | `9999px` | Pills, badges, tags, avatar status |

**Concentric radius:** khi container bo góc có padding, inner element dùng `max(0, outerRadius - padding)`.

### 3.6. Elevation / Shadow

| Token | Ý nghĩa |
|-------|---------|
| `--shadow-low` | Surface in-flow nhưng tách biệt khỏi background |
| `--shadow-med` | Float trên content gần (popover, floating banner, FAB) |
| `--shadow-high` | Topmost layer (modal dialog, fullscreen overlay) |
| `--shadow-inset-hover` / `--shadow-inset-selected` / `--shadow-inset-success` / `--shadow-inset-warning` / `--shadow-inset-error` | State ring inset |

**Elevation usage:** `none` (flat, embedded) → `low` (in-flow, tách biệt) → `med` (float gần) → `high` (trên toàn UI).

### 3.7. Motion

**Duration Tokens:** `--duration-fast-min` (130ms) / `--duration-fast` (175ms) / `--duration-fast-max` (230ms) → `--duration-medium-*` (310/410/550ms) → `--duration-slow-*` (730/975/1300ms).

**Easing:** `--ease-standard` = `cubic-bezier(0.24, 1, 0.4, 1)`.

**Motion principles:**
- Animate khi cần orient user (panel/dialog mở, content expand, element enter screen).
- Không animate high-frequency (table row hover, list item highlight, keyboard shortcuts).
- Exit match entrance (panel trượt từ phải vào → trượt ra phải).
- Direction match action (navigate sâu hơn → tiến; back → quay lại).
- Contextual UI connect to trigger (dropdown mở từ button, popover gần element).
- **Reduced motion:** tôn trọng `prefers-reduced-motion`.

### 3.8. Size & Border

| Token | Giá trị | Ý nghĩa |
|-------|---------|---------|
| `--size-element-sm` | `28px` | Small control height |
| `--size-element-md` | `32px` | Medium control height |
| `--size-element-lg` | `36px` | Large control height |
| `--border-width` | `1px` | Default border width |

---

## 4. Phân loại component theo Brad Frost (3 tầng nơi đặt component)

Nguồn: https://bradfrost.com/blog/post/design-system-components-recipes-and-snowflakes/

| Tầng | Đặc điểm | Ví dụ |
|------|----------|-------|
| **Design System component** | Shared, content-agnostic, context-agnostic, tái sử dụng tối đa | Accordion, Button, Card, Select, Table |
| **Recipe** | Composition cụ thể của design system component, dùng nhất quán trong 1 product nhưng không agnostic đủ để vào design system | ProductCard, ContactCard, NameField, AddressField |
| **Snowflake** | One-off component, chỉ dùng 1 lần, không tái sử dụng ngoài use case đầu | Seat component cho "Select your seat" |

> "Everything is a component. But where each component lives matters."

---

## 5. Danh sách đầy đủ Atom-level Components

Tổng hợp từ 9 nguồn: Brad Frost + Material + Fluent + Carbon + Polaris + Radix + shadcn + Headless + Chakra + Mantine + extension/popup/overlay + video/subtitle/dictionary/learning.

### Quy tắc phân loại

- **Là ATOM**: Không import component nào khác từ library, chỉ wrapper HTML element native, chia nhỏ hơn → mất chức năng.
- **KHÔNG phải Atom (Molecule)**: Import 2+ atom, có state/logic phức tạp, compound component (Trigger + Content + Item).

---

### Nhóm 1 — Generic Atoms (chung mọi web)

#### Core Atoms (xuất hiện 9/9 nguồn)

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 1 | **Button** | `<button>` | 9/9 nguồn |
| 2 | **Input** | `<input>` | 9/9 nguồn |
| 3 | **Checkbox** | `<input type="checkbox">` | 9/9 nguồn |
| 4 | **Radio** | `<input type="radio">` | 9/9 nguồn |
| 5 | **Label** | `<label>` | 9/9 nguồn |
| 6 | **Icon** | `<svg>` | 9/9 nguồn |

#### Phổ biến (7-8/9 nguồn)

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 7 | **Text/Typography** | `<p>/<h1-6>` | 8/9 (Heading, Body, Caption) |
| 8 | **Switch/Toggle** | `<input type="checkbox">` | 8/9 (toggle styling) |
| 9 | **Badge** | `<span>` | 7/9 — **count/enumerated states** (số "3", "99+") |
| 10 | **Avatar** | `<img>` | 7/9 (user/entity icon) |
| 11 | **Separator/Divider** | `<hr>` | 7/9 |
| 12 | **Slider** | `<input type="range">` | 7/9 |
| 13 | **Progress** | `<progress>` | 7/9 |
| 14 | **Textarea** | `<textarea>` | 5/5 React lib |
| 15 | **Link** | `<a>` | 6/9 |
| 16 | **AspectRatio** | `<div>` | 6/9 |

#### Phân biệt 4 atom dễ nhầm (Badge / Token / Chip / StatusDot)

> Nguồn: daft.md anti-pattern — "Badge chỉ cho count/enumerated states; status dùng StatusDot/Token".
> Lưu ý: **Token là MOLECULE** (removable label + IconButton), không phải ATOM. Bảng này phân biệt ngữ nghĩa, không phân biệt cấp độ.

| Atom/Molecule | HTML | Cấp độ | Ngữ nghĩa | Ví dụ |
|---------------|------|--------|-----------|-------|
| **Badge** | `<span>` | ATOM | Count/enumerated states (có số) | "3", "99+", "NEW" |
| **Token** | `<span>` + IconButton | MOLECULE | Enumerated label có thể remove | language tag "EN ×" |
| **Chip** | `<span>` | ATOM | Compact filter/selection element | filter "Active", tag "noun" |
| **StatusDot** | `<span>` | ATOM | Small dot không có text | online indicator, sync status |

#### Ít phổ biến hơn (4-5/9 nguồn)

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 17 | **Spinner** | `<svg>` | 5/9 (loading indicator) |
| 18 | **Skeleton** | `<div>` | 5/9 (loading placeholder) |
| 19 | **Kbd** | `<kbd>` | 4/9 (keyboard key) |
| 20 | **CloseButton** | `<button>` | 4/9 (X button) |
| 21 | **StatusDot** | `<span>` | Astryx (dot status, không text, không import component) |

#### Display Atoms (từ Astryx Content category — chỉ ATOM thật)

> Đã kiểm tra: mỗi component chỉ wrapper 1 HTML element native, không import component khác. CodeBlock, Markdown, EmptyState, Item, Token, Banner, MoreMenu, FileInput, NumberInput, TimeInput, DateInput là **MOLECULE** (import 2+ atom hoặc có composition) → không nằm ở đây.

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 22 | **Heading** | `<h1-6>` | Astryx (tách riêng khỏi Text — semantic role) |
| 23 | **Thumbnail** | `<img>` | Astryx (image + onError fallback + CSS ratio, không import component) |
| 24 | **Timestamp** | `<time>` | Astryx (formatted time, format = pure function) |
| 25 | **Blockquote** | `<blockquote>` | Astryx (quote block) |
| 26 | **Citation** | `<cite>` | Astryx (citation reference) |
| 27 | **Code** | `<code>` | Astryx (inline code) |

#### Layout Primitives (atom)

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 28 | **Box** | `<div>` | Chakra, Mantine |
| 29 | **Flex** | `<div>` | Chakra, Mantine |
| 30 | **Grid** | `<div>` | Chakra, Mantine |
| 31 | **Stack/VStack/HStack** | `<div>` | Chakra, Mantine |
| 32 | **Container** | `<div>` | Chakra, Mantine |
| 33 | **Center** | `<div>` | Chakra, Mantine |
| 34 | **Overlay** | `<div>` | Astryx (backdrop overlay, chỉ div + background) |
| 35 | **Section** | `<section>` | Astryx (semantic section wrapper) |

#### Utility Atoms

| # | Atom | HTML gốc | Xuất hiện ở |
|---|------|----------|-------------|
| 36 | **Portal** | React Portal | Radix, Headless, Mantine |
| 37 | **FocusTrap** | `<div>` | Radix, Headless, Chakra, Mantine |
| 38 | **VisuallyHidden** | `<span>` | Radix, Mantine |
| 39 | **Transition** | CSS | Headless, Chakra, Mantine |
| 40 | **Collapsible** | `<div>` | Radix, shadcn, Mantine |

#### MOLECULE từ Astryx (KHÔNG phải atom — ghi chú để tránh nhầm)

> Những component này em đã từng nhầm là atom. Ghi lại để không lặp lỗi. Sẽ nằm ở section Molecule (Bước 2).

| Component | HTML | Tại sao là MOLECULE |
|-----------|------|---------------------|
| CodeBlock | `<pre><code>` | Syntax highlight → import SyntaxTheme |
| Markdown | renderer | Parse → render nhiều component (Heading, Text, Code, Link) |
| EmptyState | `<div>` | Icon + Text + (action Button) = 2+ atom |
| Item | `<li>` | Composition slots (avatar + text + meta) = 2+ atom |
| Token | `<span>` + IconButton | Removable label → có IconButton remove |
| Banner | `<div>` | Icon + Text + action + close = 3+ atom |
| MoreMenu | `<button>` | IconButton + DropdownMenu |
| FileInput | `<input type="file">` | Drop zone + preview = 2+ atom |
| NumberInput | `<input type="number">` | Step buttons (2 IconButton) |
| TimeInput | `<input type="time">` | Picker dropdown |
| DateInput | `<input type="date">` | Calendar dropdown |

---

### Nhóm 2 — Atoms đặc thù Extension/Popup/Overlay

Đặc thù cho Chrome extension, popup UI, side panel, floating/overlay UI. Khác với web thông thường vì space-constrained và cần positioning/resize controls.

| # | Atom | Mô tả | Context |
|---|------|-------|---------|
| 32 | **IconButton** | Button chỉ icon, không text | Popup, toolbar (space-constrained) |
| 33 | **Chip/Tag** | Compact removable tag | Filter, language selection |
| 34 | **DragHandle** | Vùng drag để di chuyển panel | Floating panel |
| 35 | **ResizeHandle** | Handle resize panel | Floating panel |
| 36 | **PinButton** | Pin/Unpin floating element | Floating toolbar |
| 37 | **SelectionChip** | Chip xuất hiện khi select text | Dictionary lookup trigger |
| 38 | **BackButton** | Button quay lại | Popup navigation |
| 39 | **CopyButton** | Button copy clipboard | Dictionary, text tools |
| 40 | **InfoButton** | Button ⓘ hiển thị info | Popup, attribution |
| 41 | **CollapseButton** | Collapse/expand panel | Floating panel |
| 42 | **MinimizeButton** | Minimize floating window | Multi-panel |
| 43 | **MaximizeButton** | Maximize floating panel | Dictionary popup |

---

### Nhóm 3 — Atoms đặc thù Domain

#### Video domain (9 atoms)

Không phải generic Button/Slider vì có state sync với video + icon logic + ARIA động.

| # | Atom | Tại sao không phải generic |
|---|------|----------------------------|
| 44 | **PlayPauseButton** | State (playing/paused) + icon logic + ARIA label động |
| 45 | **Timeline** | Sync video.currentTime, duration, buffered ranges |
| 46 | **TimeDisplay** | Format time + sync real-time với video |
| 47 | **VolumeControl** | Sync video.volume + muted state |
| 48 | **MuteButton** | State (muted/unmuted) + icon logic |
| 49 | **CaptionsButton** | Kiểm tra text track availability |
| 50 | **FullscreenButton** | Gọi Fullscreen API + icon logic |
| 51 | **PiPButton** | Gọi PiP API + capability detection |
| 52 | **SkipButton** | seekBy logic + customizable skip time |

#### Subtitle domain (5 atoms)

| # | Atom | Tại sao đặc thù |
|---|------|-----------------|
| 53 | **SubtitleText** | Absolute positioning over video + text-shadow + background for readability |
| 54 | **CaptionToggle** | Sync text track mode (showing/hidden) |
| 55 | **LanguageSelector** | Render từ `<track>` list với srclang, label |
| 56 | **TimeOffset** | Sync với video timing |
| 57 | **TrackLabel** | Lấy từ track metadata |

#### Dictionary domain (9 atoms)

| # | Atom | Tại sao đặc thù |
|---|------|-----------------|
| 58 | **WordTitle** | Semantic header cho dictionary entry |
| 59 | **PhoneticText** | IPA notation styling (monospace hoặc styling IPA) |
| 60 | **PronunciationButton** | Gọi TTS API hoặc play audio URL |
| 61 | **PartOfSpeechTag** | Semantic tag + color coding (noun/verb/adj) |
| 62 | **DefinitionText** | Structured formatting (numbered list) |
| 63 | **ExampleSentence** | Italic/quote styling, phân biệt với definition |
| 64 | **SynonymChip** | Interactive chip lookup synonym |
| 65 | **AntonymChip** | Interactive chip lookup antonym |
| 66 | **SourceBadge** | Identify dictionary source (Cambridge/Oxford) |

#### Language learning domain (4 atoms)

| # | Atom | Tại sao đặc thù |
|---|------|-----------------|
| 67 | **WordChip** | Clickable word + lookup action |
| 68 | **FrequencyBadge** | Color-coded by frequency (Common/Rare/Academic) |
| 69 | **LevelIndicator** | CEFR level (A1-C2) |
| 70 | **MasteryBadge** | Visual feedback learning progress |

---

## 6. Tóm tắt số lượng

| Nhóm | Số lượng | Ưu tiên |
|------|----------|---------|
| Sub-Atomic (Tokens) | 7 nhóm | Bắt buộc — "nguyên tử của nguyên tử" |
| Generic Atoms | 40 | Bắt buộc — nền tảng (31 cũ + 9 ATOM thật từ Astryx) |
| Extension Atoms | 12 | Cần cho popup/overlay |
| Domain Atoms | 27 | Cần cho video/subtitle/dictionary |
| **Tổng atoms** | **79 atoms** | |

> Lưu ý: 11 component từ Astryx (CodeBlock, Markdown, EmptyState, Item, Token, Banner, MoreMenu, FileInput, NumberInput, TimeInput, DateInput) là **MOLECULE**, không phải ATOM — sẽ nằm ở section Molecule (Bước 2).

---

## 7. Đề xuất thứ tự xây dựng

### Phase 0 — Sub-Atomic (tokens) — gốc của gốc
Color (semantic), Spacing (4px base), Typography (geometric scale), Shape/Radius, Elevation/Shadow, Motion, Size/Border

### Phase 1 — Generic core (10 atoms)
Button, Input, Label, Text, Icon, Badge, Checkbox, Switch, Avatar, Separator

### Phase 2 — Layout + utility (12 atoms)
Box, Flex, Grid, Stack, Container, AspectRatio, Spinner, Progress, Link, Kbd, Overlay, Section

### Phase 3 — Display atoms bổ sung từ Astryx (7 atoms — chỉ ATOM thật)
Heading, Thumbnail, Timestamp, Blockquote, Citation, Code, StatusDot

> 11 component khác từ Astryx (CodeBlock, Markdown, EmptyState, Item, Token, Banner, MoreMenu, FileInput, NumberInput, TimeInput, DateInput) là MOLECULE → Phase Molecule (Bước 2).

### Phase 4 — Extension atoms (12 atoms)
IconButton, Chip, CloseButton, CopyButton, DragHandle, ResizeHandle, PinButton, BackButton, InfoButton, CollapseButton, MinimizeButton, MaximizeButton

### Phase 5 — Domain atoms (27 atoms)
Video (9) + Subtitle (5) + Dictionary (9) + Learning (4)

---

## 8. Kiến trúc thư mục đề xuất

```
src/
├── shared/
│   ├── ui/
│   │   ├── atoms/           # Generic atoms (Button, Input, Icon, Text, Badge, Chip, Slider, Select, Card, Progress)
│   │   ├── molecules/       # Generic molecules (FormField, SearchBar, etc.)
│   │   └── organisms/       # Generic organisms (Navbar, Sidebar, etc.)
│   └── domain/
│       ├── video/
│       │   └── atoms/       # Video-specific atoms (PlayPauseButton, Timeline, TimeDisplay, etc.)
│       ├── subtitle/
│       │   └── atoms/       # Subtitle-specific atoms (SubtitleText, CaptionToggle, etc.)
│       ├── dictionary/
│       │   └── atoms/       # Dictionary-specific atoms (PhoneticText, PartOfSpeechTag, etc.)
│       └── learning/
│           └── atoms/       # Learning-specific atoms (WordChip, FrequencyBadge, etc.)
```

### Quy tắc dependency

- **Generic atoms** (`shared/ui/atoms`) → Không import từ domain
- **Domain atoms** (`shared/domain/*/atoms`) → Có thể import từ generic atoms
- **Domain atoms** → KHÔNG import từ domain khác (video atoms không import dictionary atoms)

---

## 9. Quy tắc thiết kế Atom (Design Rules)

> Nguồn: `daft.md` section 2 (triết lý + quy tắc + anti-patterns) + Astryx principles. Atom không chỉ là "wrapper HTML" — atom phải tuân convention để compose được. Không có rule → mỗi dev viết atom theo style riêng → không tái sử dụng được.

### 9.1. 8 quy tắc thiết kế atom

| # | Quy tắc | Giải thích |
|---|---------|------------|
| 1 | **Semantic tokens over hardcoded values** | Atom phải dùng `var(--color-text-primary)`, không `#171717`. Tên token theo mục đích, không theo màu sắc. |
| 2 | **Theme-agnostic code** | Atom không bao giờ tham chiếu màu/cỡ cụ thể; light/dark đổi tự động qua `light-dark()`. |
| 3 | **3-layer token resolution** | Primitive → Semantic → Component. Atom dùng component token, component token resolve về semantic, semantic resolve về primitive. |
| 4 | **Concentric radius** | Khi atom có padding, inner element dùng `max(0, outerRadius - padding)` để trông đồng tâm. |
| 5 | **Controlled inputs** | Mọi input atom là `value` + `onChange`, không uncontrolled. |
| 6 | **`useLinkComponent()` cho Link** | Atom Link không hardcode `<a>`, để consumer plug router framework. |
| 7 | **Open internals** | Mọi primitive của atom được export để compose khi cần. |
| 8 | **Elevation prop** | Atom có thể float dùng `elevation: none | low | med | high`. |

### 9.2. Anti-patterns cho atom

> Nguồn: daft.md section 2.4. Anti-pattern là "ranh giới đỏ" — biết cái KHÔNG làm quan trọng ngang biết cái CẦN làm.

| Don't | Why | Do |
|-------|-----|----|
| Inline styles trên raw element | Break token system | Dùng `xstyle` trên component |
| Hardcoded colors (`#fff`) trong atom | Không themeable | Dùng `var(--color-*)` |
| Hardcoded spacing (`16px`) trong atom | Không scale | Dùng spacing tokens |
| Hardcoded `<a>` element trong Link atom | Không plug router | Dùng `useLinkComponent()` |
| Wrap mọi list item/page section trong Card | Dense data bị che | Dense data → rows; Card chỉ cho widget |
| Dùng Badge như decoration | Sai ngữ nghĩa | Badge chỉ cho count; status dùng StatusDot/Token |
| Invent props cho atom | Break API contract | Đọc component docs trước |
| Nest Card trong Card | Card là widget container | Không nest |
| Mix token với raw px/rem trong cùng atom | Inconsistent | Chỉ dùng token |

### 9.3. Semantic naming convention

> Nguồn: daft.md + Astryx. Semantic naming cho phép theme swap mà code không đổi.

**Nguyên tắc:** Đặt tên theo ngữ nghĩa, không theo hình dạng.

| Loại | Đúng (semantic) | Sai (hình dạng) |
|------|------------------|------------------|
| Icon | `close`, `chevronDown`, `check`, `success`, `warning`, `info`, `search`, `externalLink`, `menu`, `wrench` | `x`, `arrow-down`, `green-check` |
| Token | `--color-text-primary`, `--color-background-surface` | `--color-dark-gray`, `--color-white` |
| Component | `StatusDot`, `Banner`, `Token` | `GreenDot`, `YellowBar`, `RemovableTag` |

### 9.4. Frame-first layout rule cho atom

> Nguồn: daft.md rule #2 + section 6. Layout là frame-first.

**Nguyên tắc:** Atom layout (Box, Flex, Grid, Stack, Section) phải neutral — không opinionated.

- Atom không quyết định layout — chỉ cung cấp primitive.
- Composition (molecule/organism) quyết định frame.
- Atom layout phải neutral: Box = div, Flex = flex container, không padding cố định, không gap cố định.
- Nếu atom layout có opinion → không compose được → phải override → phá tái sử dụng.

### 9.5. Touch target + accessibility rule cho atom

> Nguồn: daft.md nguồn #16 — "DS gắn với accessibility, ~30% issues sửa được qua DS". Atom là gốc — nếu atom không accessible, mọi component dùng nó đều không accessible.

Mọi interactive atom (Button, IconButton, Checkbox, Switch, Radio, Link) phải:

| Quy tắc | Giá trị | Lý do |
|---------|---------|-------|
| Touch target tối thiểu | Mobile 44px, desktop 40px | WCAG 2.5.5 |
| Focus styling | `:focus-visible`, không `:focus` | `:focus` break keyboard nav khi click |
| ARIA label cho IconButton | `aria-label` (không có text) | Screen reader |
| Reduced motion | `prefers-reduced-motion` | OS preference |
| Disabled state | `aria-disabled` + visual | Accessibility |

---

## 10. Nguồn tham khảo

### Atomic Design gốc
- https://bradfrost.com/blog/post/atomic-web-design/ — Blog post gốc 2013
- https://github.com/bradfrost/atomic-design/blob/master/chapter-2.md — Chapter 2 sách
- https://atomicdesign.brad.frost/ — Website chính thức
- https://bradfrost.com/blog/post/design-system-components-recipes-and-snowflakes/ — Components, Recipes, Snowflakes
- https://bradfrost.com/blog/post/the-design-system-ecosystem/ — Design System Ecosystem
- https://bradfrost.com/blog/post/css-architecture-for-design-systems/ — CSS Architecture

### Meta/Astryx (nguồn tokens + principles + component inventory)
- `docs/design-system/daft.md` — Bản tổng hợp Meta/Astryx best practices cho Cell
- Astryx Docs: https://astryx.atmeta.com/docs
- Astryx Components: https://astryx.atmeta.com/components (150+ components)
- Astryx GitHub: https://github.com/facebook/astryx
- StyleX at Meta: https://engineering.fb.com/2025/11/11/web/stylex-a-styling-library-for-css-at-scale/
- Astryx Tokens: https://astryx.atmeta.com/docs/tokens
- Astryx Color: https://astryx.atmeta.com/docs/color
- Astryx Spacing: https://astryx.atmeta.com/docs/spacing
- Astryx Typography: https://astryx.atmeta.com/docs/typography
- Astryx Icons: https://astryx.atmeta.com/docs/icons
- Astryx Shape: https://astryx.atmeta.com/docs/shape
- Astryx Elevation: https://astryx.atmeta.com/docs/elevation
- Astryx Motion: https://astryx.atmeta.com/docs/motion
- Astryx Principles: https://astryx.atmeta.com/docs/principles
- Astryx Layout: https://astryx.atmeta.com/docs/layout
- Meta Design: https://design.facebook.com
- Meta Accessibility: https://www.meta.com/design-at-meta/blog/accessibility-and-design-systems
- Meta Horizon Fonts & Icons: https://latest.developers.meta.com/horizon/design/fonts-icons
- Design Systems @ Scale: https://atscaleconference.com/design-systems-scale

### Design system lớn
- Material Design (Google): https://m3.material.io/components
- Fluent Design (Microsoft): https://fluent2.microsoft.design/components
- Carbon Design (IBM): https://carbondesignsystem.com/components/
- Polaris (Shopify): https://polaris.shopify.com/components

### React component library
- Radix UI Primitives: https://www.radix-ui.com/primitives
- shadcn/ui: https://ui.shadcn.com/
- Headless UI: https://headlessui.com/
- Chakra UI: https://chakra-ui.com/docs/components
- Mantine: https://mantine.dev/core/

### Domain-specific
- Mantine Video: https://github.com/gfazioli/mantine-video
- Media Chrome: https://www.media-chrome.org
- Video.js: https://videojs.com
- PairTranslate: https://github.com/Cookee24/PairTranslate
- ClueLens: https://github.com/cppakko/cluelens
- better-markdown-anki: https://github.com/alexthillen/better-markdown-anki
- flashcard.abs.moe: https://flashcard.abs.moe/docs/flashcard
- anki-material-flashcard: https://github.com/cdmoro/anki-material-flashcard
- LingoKit UI: https://github.laiyagushi.com/shade-solutions/lingokit-ui
