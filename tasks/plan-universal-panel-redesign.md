# Plan: Universal Panel Redesign (A2)

> Spec: `docs/specs/universal-panel-redesign.md`
> Mockup: `src/entrypoints/design-system-showcase/mockups/universal-panel-redesign-a2.html`

## Dependency Graph

- Task 1 → Task 2 + Task 4
- Task 2 → Task 3
- Task 3 + Task 4 → Task 5
- Task 5 → Task 6

---

## Tasks

### Task 1: Tokens sidebar
- **Mục tiêu**: Đảm bảo mọi giá trị CSS của sidebar/header/content dùng token.
- **Files**: `tokens.json` → `src/styles/tokens.css`.
- **AC**: `check-design-system-css` pass trên mockup CSS; không còn giá trị hardcoded.
- **Verification**: `npm run check-design-system-css`
- **Scope**: S
- **Dependencies**: none

### Task 2: `CollapsibleSidebar` (generic)
- **Mục tiêu**: Tạo component sidebar gấp/mở generic ở `src/shared/ui`: header, sections, footer, toggle.
- **Files**: `src/shared/ui/CollapsibleSidebar.tsx`, `.module.css`, `.test.tsx`.
- **AC2–AC4, AC6**: 8 nút đúng thứ tự, collapse 180↔64, header/label cập nhật, tools action.
- **Verification**: `npm run test:unit -- CollapsibleSidebar`, `npm run typecheck`
- **Scope**: M
- **Dependencies**: Task 1

### Task 3: Desktop L-shape shell
- **Mục tiêu**: Ghép `CollapsibleSidebar` + `UniversalPanelHeader` + content trong `UniversalPanel.tsx`.
- **Files**: `UniversalPanel.tsx`, `.module.css`, `UniversalPanelHeader.*`.
- **AC1, AC5, AC10–AC14**: L-shape không border, tokenize stretch, open/close, persistence, tokens, a11y.
- **Verification**: `npm run test:unit`, `npm run typecheck`, build showcase.
- **Scope**: M
- **Dependencies**: Task 2

### Task 4: Mobile bottom nav + sheet
- **Mục tiêu**: Bottom bar 4 mục và `UniversalPanelToolsSheet`.
- **Files**: `UniversalPanelBottomNav.tsx`, `.module.css`, `UniversalPanelToolsSheet.tsx`, `.module.css`.
- **AC7–AC9**: bottom bar có nhãn, tab switch, sheet mở/đóng/action.
- **Verification**: unit + Playwright E2E.
- **Scope**: M
- **Dependencies**: Task 1

### Task 5: A11y + token audit
- **Mục tiêu**: `aria-label`, focus, keyboard, `axe` pass; `check-design-system-css` xanh.
- **AC12–AC13**.
- **Verification**: `npm run check-design-system-css`, `npx jest --testPathPattern a11y`.
- **Scope**: S
- **Dependencies**: Task 3, Task 4

### Task 6: E2E + showcase + ADR
- **Mục tiêu**: `e2e/universal-panel-redesign.spec.ts`, showcase `UniversalPanelPage`, ADR-065.
- **AC14–AC15, DoD**.
- **Verification**: `npm run test:e2e -- --project=showcase --grep universal-panel-redesign`.
- **Scope**: M
- **Dependencies**: Task 3, Task 4, Task 5

---

## Checkpoints

- **Checkpoint 1** (sau Task 3): desktop slice xanh typecheck/test/build.
- **Checkpoint 2** (sau Task 5): AC1–AC13 verified.
- **Checkpoint 3** (sau Task 6): AC1–AC15 + DoD → **100%**.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Test cũ `UniversalPanel.test.tsx` fail do selector cũ | Update selectors theo `data-cell-id` mới trong Task 3. |
| `TokenizeControls` layout cũ bị ảnh hưởng | Thay CSS module, không đổi props. |
| CSS token thiếu | Task 1 sinh token trước; `check-design-system-css` fail fast. |
| Collapse persistence chưa rõ | Mặc định không persist; có thể thêm `chrome.storage.session` sau nếu cần. |
