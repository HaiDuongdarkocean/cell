# ADR-071: Motion standardization and reduced motion support

## Status

Accepted — implemented 2026-07-21.

## Context

Các transition rải rác dùng `transition: all`, raw `ease`, hoặc `cubic-bezier` tùy tiện, gây unexpected animation (ví dụ width/height thay đổi khi không cần) và khó tôn trọng `prefers-reduced-motion`.

## Decision

1. Cấm `transition: all`; mọi `transition` phải liệt kê rõ properties (ví dụ `background`, `color`, `border-color`, `transform`).
2. Dùng token duration/easing từ `tokens.json`:
   - `var(--transition)` hoặc `var(--duration-fast) var(--ease-in-out)` / `var(--ease-out)`.
3. Thêm `@media (prefers-reduced-motion: reduce)` vào `tokens.css` để giảm mọi `transition-duration` và `animation-duration` xuống 0.01ms và `animation-iteration-count: 1`.
4. Sửa `VideoCard`, `SubtitleCard`, `SettingsDialog.sidebarItem` thay `transition: all` bằng transition cụ thể.
5. Giữ lại `cubic-bezier` chỉ khi có lý do UX cụ thể (bounce hint popover) và document trong component.

## Consequences

- Hiệu ứng chỉ xảy ra trên properties mong muốn, hiệu suất tốt hơn.
- Người dùng chọn reduced motion được tôn trọng toàn hệ thống.
- Dễ dàng điều chỉnh tốc độ/rhythm toàn bộ UI bằng token.
