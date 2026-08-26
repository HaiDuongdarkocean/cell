# Implementation Plan: Cell Design System Enforcement

> Vấn đề: Agent tạo UI xấu, mất thời gian sửa. Mất cả tuần chỉ để chỉnh design.
> Mục tiêu: SSOT, reuse component, agent biết cách tạo pages đẹp.
> Pattern tham khảo: gstack `DESIGN.md` + `design-consultation` / `design-review` skills.

## Overview

Xây dựng hệ thống thiết kế **agent-enforceable** cho Cell:
1. `DESIGN.md` tập trung — agent-facing source of truth, rút gọn từ `STANDARD.md` + `tokens.json`.
2. `design-system-guardian` skill — kiểm tra tự động trước khi agent merge UI change.
3. Refactor `ClipboardPage.showcase.tsx` — dùng 100% `src/shared/ui/*` + token SSOT, làm mẫu pages đẹp.

Mỗi task có acceptance criteria + verification. Mỗi task ≤5 files.

---

## Architecture Decisions

1. **DESIGN.md ở `docs/design-system/DESIGN.md`** — SSOT design system cho toàn project. Agent phải đọc đầu mỗi session UI task. Không đè `src/shared/styles/STANDARD.md` (nó vẫn là canonical). `DESIGN.md` là quick-reference + gstack-style source of truth.
2. **Skill `design-system-guardian` ở `.agents/skills/`** — tương tự gstack `design-review`, dùng ripgrep + prompt-based audit. Không cần AI model mới, dùng prompt template + command check.
3. **Refactor prototype trước** — ClipboardPage làm mẫu. Sau khi đẹp, trích xuất pattern thành DESIGN.md rule.
4. **Không thêm dependency** — dùng grep, `tokens.json`, `src/shared/ui/` sẵn có.

---

## Task List

### Phase 1: Audit tình trạng hiện tại

- [ ] **Task 1: Audit token M3 trong prototype**
  - Description: Liệt kê tất cả `var(--md-sys-color-*)` trong `ClipboardPage.module.css` (và toàn `src/` nếu cần).
  - Acceptance:
    - [ ] Có danh sách file + dòng dùng `var(--md-sys-color-*)`
    - [ ] Có mapping từ M3 token sang Cell token tương đương
  - Verify: `grep -rn 'md-sys-color' src/ --include="*.css"`
  - Files: `ClipboardPage.module.css`
  - Scope: S

- [ ] **Task 2: Audit component tự tạo trong prototype**
  - Description: Liệt kê các element tự style (button, input, menu, pagination, badge) không dùng `src/shared/ui/*`.
  - Acceptance:
    - [ ] Danh sách các inline / custom component cần thay
    - [ ] Gợi ý component thay thế từ `src/shared/ui/`
  - Verify: Đọc `ClipboardPage.showcase.tsx`, so sánh với `src/shared/ui/index.ts`
  - Files: `ClipboardPage.showcase.tsx`
  - Scope: S

### Checkpoint: Audit xong
- [ ] Biết chính xác M3 tokens và custom components cần fix

---

### Phase 2: Tạo DESIGN.md SSOT

- [ ] **Task 3: Viết `docs/design-system/DESIGN.md`**
  - Description: Tạo agent-facing design reference — rút gọn từ `STANDARD.md` + `tokens.json`. Gồm: color tokens, spacing, radius, typography, component map, layout rules, audit commands.
  - Acceptance:
    - [ ] File tồn tại ở `docs/design-system/DESIGN.md`
    - [ ] Có bảng mapping `--md-sys-color-*` → Cell token
    - [ ] Có bảng `prototype element → src/shared/ui/* component`
    - [ ] Có 5 lệnh audit cuối section
  - Verify: `cat docs/design-system/DESIGN.md | head -50`
  - Files: `docs/design-system/DESIGN.md`
  - Scope: M

### Checkpoint: DESIGN.md ready
- [ ] Agent có thể đọc 1 file để biết quy tắc UI

---

### Phase 3: Tạo design-system-guardian skill

- [ ] **Task 4: Viết `.agents/skills/design-system-guardian/SKILL.md`**
  - Description: Skill kiểm tra UI change trước khi merge. Gọi khi agent xong 1 UI task. Chạy grep commands + checklist. Output pass/fail với lý do.
  - Acceptance:
    - [ ] Skill có trigger rõ: trước merge UI, khi agent nói "xong UI", hoặc khi user yêu cầu review design
    - [ ] Có 5 lệnh audit: hardcoded color, M3 token, custom component, inline SVG, z-index
    - [ ] Có prompt hướng dẫn agent fix khi fail
  - Verify: Đọc skill, chạy test command
  - Files: `.agents/skills/design-system-guardian/SKILL.md`
  - Scope: M

- [ ] **Task 5: Update `using-agent-skills` router**
  - Description: Thêm route đến `design-system-guardian` khi task liên quan UI review/audit.
  - Acceptance:
    - [ ] `using-agent-skills/SKILL.md` liệt kê `design-system-guardian`
  - Verify: Grep `design-system-guardian` trong `using-agent-skills/SKILL.md`
  - Files: `.agents/skills/using-agent-skills/SKILL.md`
  - Scope: S

### Checkpoint: Guardian skill ready
- [ ] Agent có thể invoke `/design-system-guardian` để tự kiểm tra

---

### Phase 4: Refactor ClipboardPage prototype

- [ ] **Task 6: Thay M3 tokens thành Cell tokens trong `ClipboardPage.module.css`**
  - Description: Thay tất cả `var(--md-sys-color-*)` thành `var(--color-*)` tương đương. Dùng token SSOT từ `tokens.json`.
  - Acceptance:
    - [ ] `grep 'md-sys-color' src/.../ClipboardPage.module.css` trả về 0
    - [ ] Visual vẫn giống (hoặc đẹp hơn) khi test dark/light
  - Verify: `npm run typecheck`, reload showcase, xem dark + light
  - Files: `ClipboardPage.module.css`
  - Scope: M

- [ ] **Task 7: Tạo/identify components thiếu cho prototype**
  - Description: Kiểm tra các UI element trong prototype (pagination, search input, kebab menu, sidebar item). Nếu thiếu → tạo component trong `src/shared/ui/*` trước, rồi dùng.
  - Acceptance:
    - [ ] Tất cả UI element dùng `src/shared/ui/*` component
    - [ ] `Pagination` component mới trong `src/shared/ui/Pagination.tsx` với test + showcase + CSS module
  - Verify: `grep -n '<[A-Z]' ClipboardPage.showcase.tsx` xem import từ `@/shared/ui`
  - Files: `ClipboardPage.showcase.tsx`, `src/shared/ui/Pagination.tsx`
  - Scope: L

- [ ] **Task 8: Refactor `ClipboardPage.showcase.tsx` dùng 100% `src/shared/ui/*`**
  - Description: Sử dụng các component đã có/tạo. Bỏ inline elements. Named export, function component, no `any`.
  - Acceptance:
    - [ ] Không còn `<button>`, `<input>`, `<div className>` tự style inline
    - [ ] Tất cả components import từ `@/shared/ui`
    - [ ] Typecheck pass
  - Verify: `npm run typecheck`, browser verify dark/light + responsive
  - Files: `ClipboardPage.showcase.tsx`
  - Scope: M

### Checkpoint: Prototype đẹp
- [ ] Prototype hiển thị đúng ở 320, 768, 1280, dark, light
- [ ] User confirm "đẹp như product thật"

---

### Phase 5: Verify + skill feedback

- [ ] **Task 9: Chạy `design-system-guardian` trên ClipboardPage**
  - Description: Dùng skill mới audit prototype. Fix nếu fail.
  - Acceptance:
    - [ ] Guardian pass 100%
  - Verify: Invoke skill, xem output
  - Files: `ClipboardPage.module.css`, `ClipboardPage.showcase.tsx`
  - Scope: S

- [ ] **Task 10: Update `redesign-in-showcase` skill thêm DESIGN.md reference**
  - Description: Bổ sung `redesign-in-showcase` phải đọc `docs/design-system/DESIGN.md` trước khi sửa prototype.
  - Acceptance:
    - [ ] `redesign-in-showcase/SKILL.md` có bước "Read docs/design-system/DESIGN.md" trong workflow
  - Verify: Grep `DESIGN.md` trong skill
  - Files: `.agents/skills/redesign-in-showcase/SKILL.md`
  - Scope: S

### Checkpoint: Complete
- [ ] DESIGN.md + guardian skill + prototype refactor + skill integration xong
- [ ] Build pass, typecheck 0 lỗi

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cell tokens chưa đủ cho tất cả M3 use case (vd `--md-sys-color-secondary-container`) | Medium | Thêm semantic token vào `tokens.json`, regenerate `tokens.css` |
| Component cần cho pagination chưa có, tạo mới tốn thời gian | High | Tái sử dụng `Button` + `IconButton` + `Input` + `Dialog` thay vì tạo mới `Pagination` component |
| Refactor prototype break HMR hoặc typecheck | Medium | Refactor từng phần: token trước, component sau, test sau mỗi bước |
| DESIGN.md bị agent bỏ qua | High | Tích hợp vào skill `redesign-in-showcase` và `using-agent-skills` router |

---

## Open Questions

1. ~~Anh muốn DESIGN.md ở đâu?~~ → **Resolved**: `docs/design-system/DESIGN.md`
2. ~~**Pagination component** — tạo mới `src/shared/ui/Pagination.tsx` hay dùng `Button` + `Input` + `Icon` inline?~~ → **Resolved**: tạo mới `src/shared/ui/Pagination.tsx` component riêng.
3. **Bắt đầu từ Task nào?** → Open. Em đề xuất Task 1 audit trước.
