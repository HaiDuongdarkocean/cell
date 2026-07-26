# ADR-069: Touch target standardization (WCAG 2.5.5)

## Status

Accepted — implemented 2026-07-21.

## Context

Nhiều interactive element (IconButton xs/sm, Toggle, Slider thumb, Select trigger, SearchField, Tabs, Accordion, HintIcon, ShortcutInput) có vùng chạm nhỏ hơn khuyến nghị 44px trên mobile/overlay và 40px trên desktop. Điều này gây khó khăn cho người dùng trên màn hình cảm ứng và vi phạm WCAG 2.5.5.

## Decision

1. Thêm token `--touch-target` vào `tokens.css` (sinh từ `generate-tokens.js`):
   - Desktop (`pointer: fine` mặc định): `--touch-target-desktop` = 40px.
   - Mobile/touch (`pointer: coarse`): `--touch-target-mobile` = 44px.
2. Áp dụng `min-width: var(--touch-target); min-height: var(--touch-target);` cho các interactive atom:
   Button, IconButton, NavItem, ListItem, Checkbox root, Radio root, Toggle, Slider, Select trigger, SearchableSelect trigger, SearchField input, Tabs trigger, Accordion trigger, HintIcon button, ShortcutInput pill.
3. Không áp dụng lên container không tương tác (Alert, Tooltip, EmptyState, v.v.).
4. Toggle được rework: track mở rộng theo `--touch-target`, thumb giữ căn giữa và di chuyển từ cạnh trái sang cạnh phải bằng `calc(var(--touch-target) - var(--space-3-5) - 2 * var(--space-0-5))`.
5. Slider giữ thumb 14px nhưng `min-height` track bằng `--touch-target`; vùng click trên track đủ lớn, thumb vẫn căn giữa.

## Consequences

- Tất cả control đạt chuẩn chạm tối thiểu.
- Giao diện settings có thể rộng hơn một chút nhưng cải thiện khả năng sử dụng trên mobile/tablet.
- Touch target tự động thích ứng desktop/mobile qua `@media (pointer: coarse)`.
