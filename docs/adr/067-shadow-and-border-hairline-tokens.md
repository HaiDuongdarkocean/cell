# ADR-067: Shadow and border hairline tokens

## Status

Accepted — implemented 2026-07-21.

## Context

Các component nổi (popover, dialog, card hover) và divider/border đang dùng giá trị shadow/border tùy tiện: `box-shadow` raw rgba, `border: 1px solid ...`. Điều này khó đồng bộ giữa light/dark và khó duy trì khi thay đổi theme.

## Decision

1. Thêm các token bóng đổ (shadow) vào `tokens.json`:
   - `--shadow-floating`: nhẹ, cho card/tooltip nổi.
   - `--shadow-popover`: vừa, cho dropdown/popover.
   - `--shadow-modal`: đậm, cho dialog/modal overlay.
2. Thêm token độ dày viền tóc (hairline):
   - `--border-width-hairline`: 1px, dùng cho border/divider/outline trong mọi theme.
3. `generate-tokens.js` sinh các token này vào `:root` và `[data-theme="dark"]` để Shadow DOM resolve đúng.
4. Áp dụng thay thế các giá trị hardcoded trong `shared/ui/` và `features/settings/ui/`.

## Consequences

- Elevation và đường viền đồng nhất toàn hệ thống.
- Dark/light mode tự động điều chỉnh shadow màu sáng/tối phù hợp.
- Giảm drift khi thiết kế component mới.
