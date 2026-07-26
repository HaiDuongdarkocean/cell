# ADR-070: Focus-visible standardization

## Status

Accepted — implemented 2026-07-21.

## Context

Một số component dùng `outline: none` để bỏ viền mặc định nhưng không cung cấp focus replacement, khiến người dùng bàn phím không thấy focus ring. Các component khác có focus ring không đồng nhất (màu, độ dày, offset khác nhau).

## Decision

1. Mọi interactive element phải có `:focus-visible` với focus ring chuẩn:
   - `outline: var(--space-0-5) solid var(--color-primary);`
   - `outline-offset: var(--space-0-5);`
   - Trạng thái lỗi dùng `var(--color-error)` thay vì `var(--color-primary)`.
2. Xóa `outline: none` dư thừa khi đã có `:focus-visible` (Select trigger, Slider, SearchableSelect searchInput, MultiSelect searchInput/option, SubtitleStylePanel slider).
3. Dùng `:focus-visible` thay vì `:focus` để chuột click không hiển thị focus ring, ngoại trừ input/textarea vốn cần focus bất kể phương thức.
4. Các trường hợp cố tình bỏ focus (ví dụ `mountSettingsDialog.ts` host `outline: none !important`) phải có ADR/chú thích riêng và được xem xét kỹ về accessibility.

## Consequences

- Keyboard navigation dễ thấy và đồng nhất trên light/dark mode.
- Giảm rủi ro vi phạm WCAG focus visible.
- Style focus tập trung ở một pattern, dễ bảo trì.
