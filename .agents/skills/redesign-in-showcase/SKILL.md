---
name: redesign-in-showcase
description: Open a Cell showcase page in real Chrome with URL parameters (showcase, mode, viewport) for redesign and visual verification. Use when redesigning a UI component/page in the design-system showcase, when you need to see the current state of a showcase before editing, or when verifying a UI change visually without building the extension. Not for extension browser testing (use testing-extension-browser), performance traces, or headless CI.
---

# Redesign in Showcase

## Overview

Mở showcase page trong Chrome thật (headed) bằng URL trực tiếp với parameter, dùng cho redesign và visual verify. Không cần build extension, không cần MCP stealth — chỉ cần showcase dev server (Vite) đang chạy + `start chrome`.

## When to Use

- Redesign UI component/page trong design-system showcase.
- Cần xem trạng thái hiện tại của showcase trước khi sửa.
- Verify visual sau khi sửa code showcase (HMR tự reload).
- Cần test responsive (viewport param) hoặc theme (mode param).

## When NOT to Use

- Test extension trên host page thật → `testing-extension-browser`.
- Performance trace / a11y audit → `chrome-devtools` MCP.
- Headless CI → Playwright.
- Unit/integration test → `npm run test:unit`.

## URL Pattern

```
localhost:5180/src/entrypoints/design-system-showcase/index.html?showcase=<Title>&mode=<light|dark>&viewport=<px>
```

### Parameters

| Param | Value | Example | Effect |
|-------|-------|---------|--------|
| `showcase` | Showcase title (URL-encoded, `+` cho space) | `Settings+Dialog+Page` | Auto-open fullscreen showcase |
| `mode` | `light` \| `dark` | `light` | Set theme mode |
| `viewport` | Number từ `PAGE_BREAKPOINTS` hoặc `full` | `320` | Set viewport width |

### Showcase aliases

| Alias | Full title |
|-------|-----------|
| `/settings` | Settings Dialog Page |

Alias path: `localhost:5180/settings?mode=light&viewport=320` (SPA rewrite, ngắn hơn).

### Available viewports

`320` · `360` · `390` · `430` · `768` · `1024` · `1280` · `1920` · `full` (100%)

## The Workflow

### Step 1: Verify showcase dev server

**Purpose:** Đảm bảo Vite showcase server chạy ở port 5180.

**Actions:**
```bash
netstat -ano | findstr :5180 | findstr LISTENING
```

**Guard:** Có dòng `LISTENING` cho port 5180.

**Loop back:** Nếu không có → chạy `npx vite --config vite.showcase.config.ts --host 127.0.0.1 --port 5180` (background, `timeout: 0`). Đợi `ready in` trong output.

### Step 2: Open Chrome with URL

**Purpose:** Mở Chrome thật (headed) trực tiếp tới showcase URL.

**Actions:**
```bash
cmd //c 'start chrome "http://localhost:5180/src/entrypoints/design-system-showcase/index.html?showcase=<Title>&mode=<mode>&viewport=<px>"'
```

**Guard:** Chrome mở và hiển thị showcase (user xác nhận hoặc gửi screenshot).

**Loop back:** Nếu Chrome không mở → kiểm tra URL encoding (`+` cho space, `&` không cần escape trong `start chrome` với quote).

### Step 2.5: Load DESIGN.md

**Purpose:** Đảm bảo agent tuân thủ design system trước khi sửa UI.

**Actions:**
- Đọc `docs/design-system/DESIGN.md`.
- Xác nhận token SSOT (`var(--color-*)`, `var(--space-*)`, `var(--radius-*)`) và component map (`src/shared/ui/*`).
- Nếu component cần chưa có → tạo mới vào `src/shared/ui/` trước, rồi dùng.

### Step 3: Redesign

**Purpose:** Sửa code showcase/component. HMR tự reload — không cần build hay reload thủ công.

**Actions:**
- Sửa file `.tsx`/`.css` trong `src/`.
- HMR Vite tự push update vào Chrome đang mở.
- Nếu HMR fail (error overlay) → fix error, HMR tự recover.

**Rules (MANDATORY):**
- **Fix logic + UI đồng thời** — không chỉ sửa logic mà quên UI, không chỉ sửa UI mà logic sai. Mỗi round phải fix cả 2 cùng lúc.
- **Token SSOT — reuse color của hệ thống, KHÔNG dùng M3** — tất cả CSS phải dùng `var(--color-*)`, `var(--space-*)`, `var(--radius-*)` từ `tokens.css` (generated từ `tokens.json`). KHÔNG dùng `var(--md-sys-color-*)` (Material Design 3). Token hệ thống tự hỗ trợ dark/light mode — không cần toggle.
- **100% component — reuse trước, tạo mới khi thiếu** — tất cả UI phải dùng `src/shared/ui/*` (Button, Card, IconButton, Toggle, SliderRow, Select, CopyButton, Dialog, Input, etc.). KHÔNG tự tạo component inline. **Nếu component cần chưa có → tạo mới vào `src/shared/ui/`** (theo pattern + token của hệ thống), rồi sử dụng trong prototype. Prototype hoàn thành = giao diện chính thức, không cần build lại.
- **Prototype = giao diện chính thức** — prototype trong showcase không phải bản nháp throwaway. Sau khi user confirm, prototype chính là UI chính thức để integrate vào production. Code phải production-quality: named export, function component, no `any`, token SSOT, component SSOT.
- **Prototype phải product-quality** — không phải bản nháp. UI phải đẹp như product thật:
  - Mock data thực tế, đầy đủ — không phải "lorem ipsum" hay 1-2 sentence test
  - Layout hoàn chỉnh — spacing, padding, border, color đúng token
  - Interactive state đầy đủ — hover, focus, active, disabled, empty
  - Responsive đúng breakpoint — test 320px, 768px, 1280px
- **Mock data phải giống thật** — dùng text thực tế từ domain (game dialog, article excerpt, chat message), đủ dài để test edge case (overflow, pagination, long text)

**Guard:** Code thay đổi, HMR apply (user thấy update trên Chrome).

### Step 4: Verify

**Purpose:** Xác nhận redesign đúng ý.

**Actions:**
- User gửi screenshot hoặc mô tả những gì thấy.
- Nếu chưa đúng → quay Step 3.
- Nếu đúng → tiếp theo (commit, skill khác).

**Guard:** User xác nhận visual đúng.

## Anti-patterns

| Anti-pattern | Why bad | Do instead |
|-------------|---------|-----------|
| Dùng `var(--md-sys-color-*)` (M3) | Không match token hệ thống, dark/light sai | Dùng `var(--color-*)` từ `tokens.css` |
| Tự tạo component inline thay vì dùng `src/shared/ui/*` | Drift, không reuse, không consistent | Dùng component có sẵn; nếu thiếu → thêm vào `src/shared/ui/` trước |
| Dùng MCP stealth-chrome-devtools cho showcase | Loopback bị chặn, navigate fail | `start chrome` trực tiếp |
| Dùng `browser_preview` tool | Proxy IPv4 không match IPv6 server | `start chrome` trực tiếp |
| Build extension trước khi redesign showcase | Không cần, showcase là Vite dev server | Chỉ cần HMR |
| Reload Chrome thủ công sau mỗi sửa | HMR tự reload | Để HMR làm |
| Restart showcase server không cần | Server đã chạy thì giữ nguyên | Chỉ restart khi port conflict |
| Prototype throwaway — code không production-quality | Prototype = giao diện chính thức, phải integrate | Viết code production-quality ngay từ đầu |

## Verification

- [ ] Showcase dev server chạy ở port 5180.
- [ ] Chrome mở URL showcase với parameter đúng.
- [ ] HMR apply khi sửa code.
- [ ] Tất cả CSS dùng `var(--color-*)` — KHÔNG `var(--md-sys-color-*)`.
- [ ] Tất cả UI dùng `src/shared/ui/*` — KHÔNG tự tạo component inline.
- [ ] Dark/light mode hoạt động đúng qua token system.
- [ ] User xác nhận visual đúng.

## Router boomerang

Khi task đổi pha (sang commit, sang test extension, sang build production) → invoke `/using-agent-skills` để re-route.
