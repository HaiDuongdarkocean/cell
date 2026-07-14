# Cell Design System — Bài học & Hướng dẫn

> Folder chứa design system của Cell: shape/effect theo YouTube DS, color giữ Cell semantic tokens.
> File này ghi lại toàn bộ bài học để anh yêu (và AI agent sau này) học lại khi cần.

---

## Mục lục

1. [Tổng quan folder](#tổng-quan-folder)
2. [3 nguyên lý root](#3-nguyên-lý-root)
3. [Quá trình Socratic — cách tìm ra nguyên lý](#quá-trình-socratic--cách-tìm-ra-nguyên-lý)
4. [YouTube DS research — nguồn + con số](#youtube-ds-research--nguồn--con-số)
5. [Token system](#token-system)
6. [36 component universal](#36-component-universal)
7. [Bài học về định dạng cho AI](#bài-học-về-định-dạng-cho-ai)
8. [Bài học về lệch tông màu](#bài-học-về-lệch-tông-màu)
9. [Bài học về self-contained HTML](#bài-học-về-self-contained-html)
10. [Cách dùng](#cách-dùng)

---

## Tổng quan folder

```
docs/mockups/design-system-showcase/
├── showcase.html       # Visual reference — human xem (dark/light, interactive, 36 component + đủ states)
├── showcase.css        # CSS cho showcase (link cùng folder, file:// chạy được)
├── design-system.md    # AI source of truth — YAML frontmatter (tokens + component registry) + Markdown (usage rules)
└── README.md           # File này — bài học + hướng dẫn
```

**2 đối tượng, 2 file:**
- `showcase.html` → **human** xem visual
- `design-system.md` → **AI agent** đọc để build component chính xác

---

## 3 nguyên lý root

Mọi quyết định design đều trace về 1 trong 3 nguyên lý này:

### P1 — Content-first
Flat, zero elevation, hairline 1px border, whitespace separation. UI chrome **không bao giờ cạnh tranh** với content.

- Không shadow ở đâu (`--shadow-md: none`, `--shadow-lg: none`)
- Border 1px hairline định nghĩa shape, không dùng shadow
- Whitespace tách section, không divider dày

**Nguồn**: YouTube blog "Decoding YouTube's new design language" — YouTube là video-first product, mọi chrome phải "biến mất" để nhường chỗ cho thumbnail/video.

### P2 — Alpha-based states
Hover/active dùng `--color-surface-hover` fill (theme-agnostic). Focus = 2px solid ring offset 2px (WCAG 2.4.7). Không solid color flash.

- Hover/active: alpha fill → tự thích ứng dark/light
- Focus: `outline: 2px solid var(--color-primary); outline-offset: 2px`
- Selected: `--color-primary-subtle` (alpha 0.15 dark / 0.1 light)

**Tại sao alpha, không solid**: Alpha fill subtle enough để không cạnh tranh content, và tự work cả 2 theme (cùng rule, khác lightness).

### P3 — Shape ≠ Color
Shape/effect tokens theo **YouTube DS**. Color tokens giữ **Cell** (slate + blue, KHÔNG phải YouTube red). 2 lớp độc lập, swap được.

- Shape: pill 18px (button/input/dropdown) / 10px (card) / 12px (dialog) / full (icon-btn, badge, toggle)
- Color: `--color-primary` = blue (#60a5fa dark / #2563eb light), slate surface
- Đổi color theme → không động shape. Đổi shape → không động color.

---

## Quá trình Socratic — cách tìm ra nguyên lý

Anh yêu yêu cầu: *"đặt câu hỏi → trả lời → theo manh mối → đặt thêm câu hỏi → lặp lại đến khi tìm được nguyên lý root → hành động"*.

### Pattern chung

```
Vòng 1: Câu hỏi gốc (WHAT)
  Q: Vấn đề là gì? Định nghĩa lại bằng data thật.
  A: Đọc code/research → trả lời dựa trên evidence, không đoán.

Vòng 2: Manh mối sâu hơn (WHY)
  Q: Tại sao vấn đề tồn tại? Nguyên lý sâu hơn là gì?
  A: Theo manh mối từ Vòng 1 → đặt câu hỏi WHY.

Vòng 3: Root check (CONFIDENCE)
  Q: Em có tự tin đã tìm root chưa? Còn gap nào không?
  A: Nếu còn gap → vòng mới. Nếu không → hành động.
```

### Ví dụ áp dụng (lần tìm design system format cho AI)

**Vòng 1:**
- Q: AI đọc showcase.html hiệu quả không? → A: Không, HTML render-oriented, không semantic
- Q: Format nào tốt hơn? → A: Research → JSON tokens / DESIGN.md / RAG
- Q: DESIGN.md là gì? → A: YAML + Markdown, thiết kế cho AI

**Vòng 2:**
- Q: Root principle — AI cần gì? → A: 2 lớp: tokens (structured) + usage rules (semantic)
- Q: Tại sao không chỉ JSON? → A: JSON chỉ tokens, không có WHY
- Q: Tại sao không chỉ Markdown? → A: Markdown thuần không machine-parseable

**Vòng 3:**
- Q: Tự tin root chưa? → A: Có. Root = structured + semantic. HTML thiếu cả 2.
- Q: Còn gap? → A: Cấu trúc cụ thể. Quyết định: 1 file md + giữ html.
- → Hành động: tạo design-system.md

### Bài học về phương pháp

- **Không đoán, verify bằng data**: grep CSS, browser evaluate, web research
- **Mỗi câu hỏi phải có evidence**: không trả lời "có vẻ như", phải "grep thấy 4 token thiếu"
- **Dừng khi tự tin root**: không lặp vô tận, khi 3 nguyên lý rõ + không còn gap → hành động
- **Ponytail**: root rõ rồi, implement = minimum code hoạt động, không over-engineer

---

## YouTube DS research — nguồn + con số

### Nguồn

1. **Refero Styles — YouTube design system**: https://styles.refero.design/style/8fc58a26-47be-406e-8429-37925551c0ec
   - "near-monochrome white canvas, pill-shaped buttons, hairline borders, zero elevation"
   - "#0f0f0f for primary text, never pure #000000"
   - "18px border-radius for all buttons and search inputs (pill shape)"
   - "1px borders in #c6c6c6 or #d3d3d3 for card definition, never shadows"

2. **YouTube UI framework (ntim.me)**: http://ntim.me/youtube-ui-framework/
   - Dropdown pattern: button trigger + `<ul>` menu (không native select)
   - Button groups, dropdowns, submenus

3. **YouTube blog — Ambient color mode redesign**: https://blog.youtube/inside-youtube/youtube-ambient-color-mode-visual-language-redesign/
   - "friendly, inviting, comfortable to tap" (về pill 18px)
   - Content-first philosophy

### Con số chuẩn YouTube

| Element | Radius | Shadow | Border |
|---------|--------|--------|--------|
| Button / Input / Select / Dropdown trigger | 18px (pill) | none | hairline 1px |
| Card / Panel / Thumbnail | 10px | none | hairline 1px |
| Dialog / Popup / Workspace | 12px | none | hairline 1px |
| Icon button / Badge / Toggle / Avatar | 9999px (full) | none | no border at rest |
| Nav item / List item | 10px | none | hover fill only |
| Dropdown menu / Popover / Action menu | 12px | none | hairline 1px |

**Quy tắc states YouTube:**
- Icon button: 40×40, no border, no bg at rest, circular hover fill (alpha)
- Pill button: 18px radius, 8px 16px padding, 14px font medium
- Focus: 2px solid ring offset 2px
- Selected: primary subtle fill (alpha 0.15 dark / 0.1 light)

---

## Token system

### Color tokens (27)

Mỗi token có: `dark` value, `light` value, `usage` field (AI đọc để biết khi nào dùng).

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--color-primary` | #60a5fa | #2563eb | CTA, links, active, focus ring |
| `--color-primary-hover` | #3b82f6 | #1d4ed8 | primary button hover |
| `--color-primary-active` | #2563eb | #1e40af | primary button pressed |
| `--color-primary-subtle` | rgba(96,165,250,0.15) | rgba(37,99,235,0.1) | selected/active fill |
| `--color-secondary` | #334155 | #e2e8f0 | secondary button bg |
| `--color-secondary-hover` | #475569 | #cbd5e1 | secondary button hover |
| `--color-secondary-foreground` | #f1f5f9 | #0f172a | text on secondary |
| `--color-destructive` | #dc2626 | #dc2626 | destructive button, error border |
| `--color-destructive-hover` | #b91c1c | #b91c1c | destructive hover |
| `--color-destructive-foreground` | #ffffff | #ffffff | text on destructive |
| `--color-background` | #0f172a | #ffffff | page bg, dialog bg |
| `--color-surface` | #1e293b | #f8fafc | card bg, input bg |
| `--color-surface-hover` | #334155 | #f1f5f9 | **hover fill universal** |
| `--color-muted` | #334155 | #f1f5f9 | disabled input bg (alias surface-hover) |
| `--color-text` | #f1f5f9 | #0f172a | primary text |
| `--color-text-secondary` | #cbd5e1 | #475569 | secondary text |
| `--color-text-muted` | #64748b | #94a3b8 | muted, placeholder, chevron |
| `--color-text-inverse` | #0f172a | #ffffff | text on primary/destructive |
| `--color-border` | #334155 | #e2e8f0 | hairline border |
| `--color-border-subtle` | #1e293b | #f1f5f9 | divider |
| `--color-border-focus` | #60a5fa | #2563eb | border on hover/focus |
| `--color-success` | #10b981 | #059669 | success badge/state |
| `--color-success-subtle` | rgba(16,185,129,0.15) | rgba(5,150,105,0.1) | success fill |
| `--color-warning` | #f59e0b | #d97706 | warning badge |
| `--color-warning-subtle` | rgba(245,158,11,0.15) | rgba(217,119,6,0.1) | warning fill |
| `--color-error` | #ef4444 | #dc2626 | error badge/input error |
| `--color-error-subtle` | rgba(239,68,68,0.15) | rgba(220,38,38,0.1) | error fill |

### Alpha scale (quan trọng — tránh lệch tông)

| Category | Dark | Light | Rule |
|----------|------|-------|------|
| Semantic subtle fill | 0.15 | 0.1 | Tất cả semantic (primary/success/warning/error) cùng alpha trong 1 theme |
| Scrim (dialog overlay) | 0.5 | 0.5 | Fixed, theme-agnostic |
| Knob shadow (toggle) | 0.2 | 0.2 | Fixed |

**Bài học**: Alpha 0.15 dark vs 0.1 light **không phải lỗi** — dark cần alpha cao hơn vì nền tối. Pattern chuẩn (Tailwind, Radix làm vậy). Nhưng phải **nhất quán**: mọi semantic subtle cùng alpha trong cùng theme.

### Radius tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | tooltip, kbd |
| `--radius-md` | 18px | **BUTTON, INPUT, SELECT, DROPDOWN TRIGGER, TABS, PAGINATION, TOKEN-INPUT** (pill — YouTube) |
| `--radius-lg` | 10px | **CARD, LIST-ITEM, NAV-ITEM, DROPDOWN-ITEM, ACCORDION, BANNER, ALERT** (card — YouTube) |
| `--radius-xl` | 12px | **DIALOG, POPOVER, ACTION-MENU, DROPDOWN-MENU** (dialog — YouTube) |
| `--radius-full` | 9999px | **ICON-BUTTON, BADGE, CHIP, TOGGLE, AVATAR, COUNTER, PROGRESS** (circular) |

---

## 36 component universal

Lấy giao tập: {universal web} ∩ {YouTube} ∩ {GitHub Primer}. Loại niche (BranchName, CircleBadge), loại layout helper (PageLayout, Stack), loại đã có variant (ConfirmationDialog = dialog).

| # | Component | Category | Interactive |
|---|-----------|----------|-------------|
| 1 | Button | action | states: default/hover/active/focus/disabled/loading |
| 2 | Icon Button | action | 40×40, no border, circular hover |
| 3 | Input / Textarea / Search | form | pill 18px, focus ring |
| 4 | Dropdown / Select | form | custom (no native), pill trigger + 12px menu |
| 5–6 | Checkbox / Radio | form | accent-color, focus ring |
| 7 | Toggle / Switch | form | pill track, circular knob |
| 8 | Card | container | 10px, hairline, flat |
| 9 | Badge / Chip / Tag | display | pill, removable chip |
| 10 | Dialog / Modal | overlay | 12px, overlay 0.5, Esc close |
| 11 | Tooltip | overlay | hover, inverted bg |
| 12 | Toast / Alert | feedback | 4 variants, auto-dismiss toast |
| 13 | Progress / Spinner | feedback | linear + circular + skeleton |
| 14 | Avatar | display | circular, fallback initials, group |
| 15 | Tabs / Segmented | navigation | active primary fill |
| 16 | List Item | display | 40px, hover fill, selected |
| 17 | Breadcrumbs | navigation | hierarchy, current semibold |
| 18 | Pagination | navigation | pill 32px, active, ellipsis |
| 19 | Skeleton | feedback | shimmer, text/avatar/rect |
| 20 | Empty State | feedback | icon + title + desc + action |
| 21 | Banner | feedback | 4 variants, dismissible |
| 22 | Popover | overlay | click trigger, arrow, 12px |
| 23 | Action Menu | overlay | ⋮ trigger, danger item, divider |
| 24 | Accordion | container | collapsible, chevron rotate |
| 25 | Nav List / Sidebar | navigation | 40px items, active, group labels |
| 26 | Link | typography | primary, muted, hover underline |
| 27 | Counter Label | display | pill, neutral/primary/inverse |
| 28 | Relative Time | typography | "2h ago", muted, nowrap |
| 29 | Truncate | typography | 1-line + 2-line clamp |
| 30 | Button Group | action | joined, hairline separators |
| 31 | Timeline | display | dot + line, muted variant |
| 32 | Tree View | navigation | nested, chevron rotate, selected |
| 33 | Data Table | display | hairline rows, hover, selected |
| 34 | State Label | display | open/closed/merged/draft |
| 35 | Token / Tag Input | form | chips + input, Enter add, × remove |
| 36 | Keybinding Hint | typography | kbd glyph, ⌘K, Ctrl+S |

**Nguồn inventory**:
- GitHub Primer: https://primer.style/components/ (60+ component)
- YouTube: research pattern (~30)
- Cell lọc giao tập → 36 component universal

---

## Bài học về định dạng cho AI

### Vấn đề
HTML là **render-oriented**, không semantic. AI agent phải parse DOM + CSS để hiểu token usage. Khi RAG chunk HTML, cấu trúc bị mất.

### Root cause
AI agent cần **2 lớp thông tin**:
1. **Tokens** (machine-readable: giá trị + tên + type) — biết CÓ gì
2. **Usage rules** (semantic intent: khi nào dùng, dùng cho cái gì) — biết DÙNG thế nào

HTML chỉ có visual, **thiếu cả 2** → AI phải đoán → hallucinate.

### Giải pháp: DESIGN.md pattern
- **YAML frontmatter**: tokens (parse chính xác) + component registry (id, variants, states, token-usage map)
- **Markdown body**: principles + per-component spec (when/variants/states/do-don't/snippet)
- **RAG-friendly**: Markdown header hierarchy → MarkdownHeaderTextSplitter giữ header với content

### So sánh

| | showcase.html | design-system.md |
|---|---------------|-------------------|
| Audience | Human (visual) | AI agent (source of truth) |
| Token info | Ẩn trong CSS, phải parse | YAML, query trực tiếp + usage field |
| Usage intent | Không có | Có (When/Do/Don't) |
| Component registry | Không | 36 entry với id/category/tokens |
| Query "button primary token?" | Parse CSS 3 bước | `components[id=button].tokens.bg` = `primary` (1 bước) |

### Nguồn research
- W3C DTCG design tokens: https://www.designtokens.org/tr/drafts/format/
- DESIGN.md vs tokens: https://designmd.app/blog/design-tokens-vs-design-md/
- Context engineering (Anthropic): https://geodocs.dev/technical/what-is-context-window-engineering
- RAG chunking: https://hld.handbook.academy/curriculum/ai-ml-system-design/rag-pipelines/

---

## Bài học về lệch tông màu

### Vấn đề
Component có màu hỏng (transparent fallback) → lệch tông.

### Root cause
**4 token thiếu** trong `:root` nhưng dùng trong CSS:
- `--color-primary-active` (btn--primary:active)
- `--color-secondary`, `--color-secondary-foreground`, `--color-secondary-hover` (btn--secondary)
- `--color-destructive`, `--color-destructive-hover`, `--color-destructive-foreground` (btn--destructive)
- `--color-muted` (input:disabled)

Khi token không tồn tại, browser fallback `unset` → background transparent → màu hỏng.

### Tại sao thiếu
Copy tokens.css từ popup-dictionary (chỉ có btn + btn--primary), showcase thêm secondary/destructive nhưng **quên thêm token**.

### Fix
Thêm 4 token vào `:root` + `[data-theme=light]`, đúng tông Cell:
- `--color-primary-active`: blue đậm hơn hover (#2563eb dark / #1e40af light)
- `--color-secondary`: slate neutral (#334155 dark / #e2e8f0 light)
- `--color-destructive`: red-600 (#dc2626 cả 2 theme)
- `--color-muted`: alias surface-hover (disabled bg)

### Bài học
- **Token audit**: grep tất cả `--color-*` dùng trong CSS, so với defined trong `:root`. MISSING phải = 0.
- **Mỗi variant mới = thêm token ngay**, không quên
- **Verify bằng browser**: `getComputedStyle` xem background có `rgba(0,0,0,0)` không (fallback hỏng)

### Script audit (dùng lại được)

```powershell
$content = Get-Content "showcase.css" -Raw
$used = [regex]::Matches($content, '--color-[a-z-]+') | ForEach-Object { $_.Value } | Sort-Object -Unique
$rootContent = Get-Content "showcase.html" -Raw
$defined = [regex]::Matches($rootContent, '--color-[a-z-]+:') | ForEach-Object { ($_.Value -replace ':$','') } | Sort-Object -Unique
$missing = $used | Where-Object { $_ -notin $defined }
Write-Output "MISSING: $($missing.Count)"; if ($missing.Count) { $missing }
```

---

## Bài học về self-contained HTML

### Vấn đề
`<script type="module">` + `import` cần HTTP server. Mở `file://` bị chặn (CORS).

### Root cause
ES modules có CORS policy — `file://` protocol không được phép fetch module.

### Fix
- Gộp `tokens.css` inline vào `<style>` trong HTML
- Gộp `dropdown.js` + `showcase.js` + `icons.js` inline vào 1 `<script>` (không `import`, không `type="module"`)
- Xóa file phụ (tokens.css, showcase.js, dropdown.js, icons.js)
- Còn 2 file: `showcase.html` + `showcase.css` (CSS link cùng folder OK với file://)

### Bài học
- Mockup/docs muốn mở trực tiếp → **không dùng ES module**
- Inline JS + CSS nếu cần self-contained
- Ponytail: 1 file HTML + 1 file CSS = đủ, không cần build step

---

## Cách dùng

### Anh muốn xem visual
Mở `showcase.html` bằng browser (double-click). Toggle dark/light góc trên phải. Tất cả 36 component + states hiển thị.

### AI agent muốn build component
1. Đọc `design-system.md` YAML frontmatter → query `components` registry by id/name/category
2. Đọc section `## N. Component` tương ứng → when/variants/states/do-don't/snippet
3. Query `tokens` để biết token nào dùng cho component đó
4. Verify visual: mở `showcase.html`

### Anh muốn thêm component mới
1. Thêm CSS vào `showcase.css` (theo 3 nguyên lý root)
2. Thêm HTML section vào `showcase.html` (show đủ variants + states)
3. Thêm JS interactive nếu cần (inline trong `<script>`)
4. Thêm entry vào `components:` registry trong `design-system.md` YAML
5. Thêm `## N. Component` section trong `design-system.md` Markdown body
6. **Token audit**: chạy script kiểm tra không token thiếu
7. **Verify browser**: dark + light, interactive, console sạch

### Anh muốn thêm token mới
1. Thêm vào `:root` + `[data-theme=light]` trong `showcase.html` `<style>`
2. Thêm vào `tokens:` trong `design-system.md` YAML (có `usage` field)
3. **Token audit**: chạy script

### Anh muốn áp design system vào project thật
1. Copy tokens (color + radius + shadow + spacing + font) vào project CSS
2. Copy component CSS từ `showcase.css` vào project
3. Tham chiếu `design-system.md` cho usage rules (khi nào dùng variant nào)
4. Giữ nguyên 3 nguyên lý root: content-first, alpha states, shape≠color

---

## Tóm tắt 1 câu

> Cell Design System = YouTube shape (pill 18px / card 10px / dialog 12px, flat, hairline) + Cell color (slate + blue) + 36 universal component + 3 nguyên lý root (content-first, alpha states, shape≠color) + 2 file (showcase.html cho human, design-system.md cho AI).
