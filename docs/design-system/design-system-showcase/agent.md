# Agent Guide — Áp dụng Cell Design System vào thiết kế UX-UI

> **File này là cầu nối** giữa `AGENTS.md` (project rules) và `design-system.md` (UI source of truth).
> AI agent đọc file này **mỗi khi thiết kế hoặc sửa giao diện**.

---

## Khi nào đọc file này

Đọc **ngay khi** task thuộc 1 trong các dạng:

- Tạo component / screen / page UI mới
- Sửa styling component hiện có (color, radius, border, spacing, hover/focus state)
- Thêm variant component (vd: thêm btn--success)
- Review UI code (PR có thay đổi CSS/HTML/JSX)
- Trả lời câu hỏi "dùng token nào cho X?", "component này radius bao nhiêu?"
- Mockup / prototype UI

**Không cần đọc** khi: logic thuần, test unit, config build, docs non-UI.

---

## Source of truth — 2 file, không hơn

| File | Vai trò | Đối tượng |
|------|---------|-----------|
| `./design-system.md` | **Nguồn duy nhất** cho token + component spec + usage rules | AI agent (đọc) |
| `./showcase.html` | Visual reference (dark/light, live states) | Human xem + AI verify |

**Quy tắc cứng**:
- Token value → lấy từ `design-system.md` YAML frontmatter, **không đoán, không hardcode**
- Component shape/states → theo `design-system.md` section `## N. Component`
- Screen layout/order/behavior → lấy từ `UI-UX-Contract-*.md` **(không tự sáng tác bố cục)**
- Contract format: **YAML blueprint + HTML skeleton + CSS selector ATs** (KHÔNG dùng ASCII wireframe — ASCII ambiguous, AI phải dịch sang HTML → drift)
- Nếu contract và ảnh tham chiếu xung đột → **contract thắng** trừ khi Anh yêu nói redesign
- Nếu `design-system.md` và code hiện có xung đột → **`design-system.md` thắng**, báo Anh yêu để align code

---

## Workflow áp dụng (5 bước)

### Bước 1 — Đọc design-system.md
Mở `./design-system.md`. Parse YAML frontmatter (tokens + components registry). Đọc Markdown body cho component liên quan.

### Bước 2 — Query token / component
Dùng YAML frontmatter, không parse CSS:

```yaml
# Tìm component theo id/name/category
components:
  - id: button
    tokens: { bg: primary, color: text-inverse, radius: md, border: primary }
    section: "## 1. Button"

# Tìm token theo tên
tokens:
  color:
    primary-subtle:
      dark: "rgba(96,165,250,0.15)"
      light: "rgba(37,99,235,0.1)"
      usage: "selected/active fill (chip, list-item, nav, badge--primary)"
```

**Câu hỏi thường gặp + cách query**:

| Câu hỏi | Query YAML | Đáp |
|---------|-----------|-----|
| "Button primary dùng token nào?" | `components[id=button].tokens` | bg=primary, color=text-inverse, radius=md |
| "Card radius bao nhiêu?" | `components[id=card].tokens.radius` → `tokens.radius.lg` | 10px |
| "Hover fill dùng token gì?" | `tokens.color.surface-hover.usage` | surface-hover (universal) |
| "Selected list item màu gì?" | `tokens.color.primary-subtle.usage` | primary-subtle fill |
| "Dialog radius?" | `components[id=dialog].tokens.radius` → `tokens.radius.xl` | 12px |
| "Khi nào dùng outline vs ghost button?" | `## 1. Button` → Variants + Do/Don't | outline=low-emphasis, ghost=inline |

### Bước 3 — Build theo spec
Đọc section `## N. Component` trong Markdown body. Có đủ:
- **When**: khi nào dùng component này
- **Variants**: danh sách variant + class name
- **States**: default/hover/active/focus/disabled/selected
- **Tokens**: token map (bg, color, radius, border)
- **Do / Don't**: quy tắc dùng
- **Code snippet**: HTML mẫu

### Bước 4 — Áp 3 nguyên lý root (luôn check)

| Nguyên lý | Check |
|-----------|-------|
| P1 Content-first | Flat, no shadow, hairline 1px border? ✓ |
| P2 Alpha states | Hover=surface-hover fill, focus=2px ring offset 2px, selected=primary-subtle? ✓ |
| P3 Shape≠Color | Shape theo YouTube (pill/card/dialog), color theo Cell (slate+blue)? ✓ |

### Bước 5 — Verify
- Mở `./showcase.html` xem component tương tự render đúng không
- Token audit: grep `--color-*` dùng trong code mới, so với `design-system.md` tokens → MISSING phải = 0
- Dark + light đều đúng (alpha scale 0.15 dark / 0.1 light)
- Nếu task là một screen cụ thể (vd: popup-dictionary, card-creator): đọc `docs/specs/design/UI-UX-Contract-*.md` → chạy acceptance criteria (AT) bằng Playwright → TẤT CẢ PASS mới được coi là xong

---

## Do / Don't (toàn cục)

### DO
- **Lấy token từ YAML** `design-system.md`, không đoán
- **Dùng radius đúng category**: pill 18px (button/input) / 10px (card) / 12px (dialog) / full (icon-btn, badge)
- **Hover = surface-hover fill** (alpha, theme-agnostic)
- **Focus = 2px solid primary ring, offset 2px** (WCAG 2.4.7)
- **Selected = primary-subtle fill + primary text**
- **Flat, no shadow** ở mọi component
- **Hairline 1px border** định nghĩa shape
- **Custom dropdown** (không native `<select>`)
- **Icon-only button phải có `aria-label`**
- **Pill button**: 18px radius, 8px 16px padding, 14px font medium

### DON'T
- **Không hardcode color** (`#60a5fa`, `rgb(...)`) — luôn `var(--color-...)`
- **Không dùng shadow** cho elevation — `--shadow-md: none`
- **Không solid color flash** cho hover — luôn alpha/subtle
- **Không native `<select>`** — option list OS-styled, break design system
- **Không square avatar** — luôn `--radius-full`
- **Không zebra striping table** — hover fill đủ
- **Không truncate < 20 chars** — không có lợi
- **Không stack > 1 toast**
- **Không nest card > 2 level**
- **Không dùng primary button cho body text link** — dùng `.link`
- **Không dùng destructive button cho action không irreversible**

---

## Thêm component mới — checklist

Khi cần component chưa có trong 36 component hiện tại:

1. **Check YAGNI**: component có trong giao tập {universal} ∩ {YouTube} ∩ {GitHub Primer} không? Nếu niche → không thêm.
2. **Thêm CSS** vào `./showcase.css` (theo 3 nguyên lý root)
3. **Thêm HTML section** vào `./showcase.html` (show đủ variants + states)
4. **Thêm JS interactive** nếu cần (inline trong `<script>`)
5. **Thêm entry** vào `components:` registry trong `./design-system.md` YAML (id, name, category, variants, states, tokens, section)
6. **Thêm `## N. Component` section** trong `./design-system.md` Markdown body (when/variants/states/tokens/do-don't/snippet)
7. **Token audit**: chạy script trong `./README.md` → MISSING = 0
8. **Verify browser**: dark + light, interactive, console sạch
9. **Update README.md** mục lục + bảng component nếu cần

---

## Thêm token mới — checklist

1. **Thêm vào `:root` + `[data-theme=light]`** trong `./showcase.html` `<style>`
2. **Thêm vào `tokens:`** trong `./design-system.md` YAML (có `dark`, `light`, `usage` field)
3. **Token audit**: chạy script → MISSING = 0
4. **Update README.md** bảng token nếu cần

---

## Áp vào project thật (popup-dictionary, extension, v.v.)

1. **Copy tokens** (color + radius + shadow + spacing + font) từ `design-system.md` YAML vào CSS project (`tokens.css` hoặc `:root`)
2. **Copy component CSS** từ `./showcase.css` vào project (hoặc import file)
3. **Tham chiếu `design-system.md`** cho usage rules (khi nào dùng variant nào, do/don't)
4. **Giữ 3 nguyên lý root**: content-first, alpha states, shape≠color
5. **Không thêm token mới** trong project mà không thêm vào `design-system.md` (single source of truth)

---

## Chain discovery (cách AI tự tìm file này)

```
AI mở phiên mới
  → đọc AGENTS.md (root, entry point)
    → thấy section "Design System UI" chỉ đến docs/design-system/design-system-showcase/agent.md
      → đọc agent.md (file này)
        → sau 
          → verify bằng accepđó đọc design-system.md YAML + Markdown
          → build component chính xáctance criteria trong contract
```

**Nếu AI bỏ qua chain này** → hallucinate token, lệch tông, sai radius. Anh yêu review PR sẽ catch.

---

## Tóm tắt 1 câu

> Mỗi khi thiết kế/sửa UI: đọc `design-system.md` (YAML query token + Markdown đọc spec) → build theo 3 nguyên lý root (content-first, alpha states, shape≠color) → verify với `showcase.html` → token audit MISSING = 0.
