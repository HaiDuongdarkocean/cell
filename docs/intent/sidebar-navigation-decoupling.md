# Intent — Sidebar & Navigation Decoupling

> Confirmed 8-field frame from elicitation.

## 1. Problem

Component `Sidebar` hiện tại đang bị ôm đồm quá nhiều trách nhiệm (vừa làm layout shell container vừa gánh toàn bộ logic Navigation như scroll-spy, rAF floating water-flow animation, event delegation, activeId management). Điều này khiến việc tái sử dụng `Sidebar` cho các nội dung tùy biến (custom content) hoặc tái sử dụng `Navigation` ở các vị trí khác (header, horizontal tabs, standalone nav) không thực hiện được.

## 2. User

Developer trong dự án Cell và người dùng cuối tương tác với UI trên cả 3 nền tảng (Desktop, Tablet, Mobile/Android).

## 3. Current workflow

`Sidebar` chứa trực tiếp các element `<nav>`, `<button>`, rAF animation logic, IntersectionObserver scroll-spy, collapse button. Để tạo một menu điều hướng hoặc sidebar mới, developer phải sử dụng nguyên khối `Sidebar` gắn liền với `NavItem` và `data-section-id`.

## 4. Pain point

- Thiếu tính module hóa (vi phạm Single Responsibility Principle).
- Không thể tái sử dụng `Navigation` theo 2 chiều (ngang / dọc) độc lập với `Sidebar`.
- `Sidebar` không thể chứa custom content (form, filters, stats, cards...) mà tự co giãn kích thước theo nội dung con.

## 5. Evidence

[Sidebar.tsx](src/shared/ui/Sidebar.tsx) chứa >260 dòng kết hợp cả aside layout, collapse toggle, rAF water-flow animation, click-scrolling lock và scroll-spy observer; các component như [SettingsDialogContent.tsx](src/features/settings/ui/SettingsDialogContent.tsx) và showcases đang bị ràng buộc trực tiếp.

## 6. Desired outcome

1. **`Sidebar` (Template/Shell Container):** Chỉ gồm `container > header + body`, kích thước co giãn theo nội dung con bên trong (`fit-content`), hỗ trợ `collapsible`, `collapsed`, `onCollapsedChange`, render toggle button.
2. **`Navigation` (Organism):** Tách thành organism độc lập sở hữu:
   - Quản lý `activeId` (controlled/uncontrolled), `onActiveChange`.
   - Floating active indicator pill với rAF animation (ease-in-out cubic, water-flow) hỗ trợ cả 2 trục.
   - Scroll-spy qua `sectionRefs` + `contentRef`.
   - Scroll-to-active trong navigation container.
   - Event delegation cho các `NavItem` con qua `data-section-id`.
   - 2 chế độ hiển thị: `orientation="vertical"` (dọc) và `orientation="horizontal"` (ngang).

## 7. Constraint

- Tuân thủ MV3, tokens từ `tokens.css`.
- Response < 3s, animation rAF 60fps mượt mà.
- Responsive cross-browser (Desktop, Tablet, Mobile/Android).
- `no-explicit-any`, named exports, tách pure functions.
- Không phát sinh breaking bug trong các component đang dùng `Sidebar` (như `SettingsDialogContent`).

## 8. Scope (MVP)

**In scope:**
- Tạo mới `src/shared/ui/Navigation.tsx` và `src/shared/ui/Navigation.module.css`.
- Tái cấu trúc `src/shared/ui/Sidebar.tsx` và `src/shared/ui/Sidebar.module.css`.
- Cập nhật export tại `src/shared/ui/index.ts`.
- Cập nhật `src/features/settings/ui/SettingsDialogContent.tsx` sử dụng cấu trúc mới (`<Sidebar><Navigation>...</Navigation></Sidebar>`).
- Cập nhật / tạo mới unit tests: `Navigation.test.tsx` và `Sidebar.test.tsx`.
- Cập nhật showcase `Sidebar.showcase.tsx` & `Navigation.showcase.tsx`.

**Out of scope:**
- Thay đổi logic nghiệp vụ của các tab bên trong `SettingsDialogContent`.

## Chosen method

Áp dụng Atomic Design 5 cấp độ:
- Atom: `Icon`, `IconButton`.
- Molecule: `NavItem`.
- Organism: `Navigation` (hỗ trợ `orientation="vertical" | "horizontal"`).
- Template: `Sidebar` (`container > header + body`).
- Feature Page: `SettingsDialogContent` (lắp ráp `Sidebar` + `Navigation`).

## Elicitation log

| Round | Question / Answer |
|---|---|
| Q1 | Thuộc tính collapse (thu nhỏ/phóng to) và nút toggle thuộc về trách nhiệm của Sidebar hay Navigation? → User: "đúng vậy thuộc sidebar" |
| Q2 | Thống nhất mô hình 5 cấp độ Atomic Design (Atoms, Molecules, Organisms, Templates, Pages) → User: "ok" |
