# ADR-068: Automated WCAG AA contrast validation

## Status

Accepted — implemented 2026-07-21.

## Context

Kiểm tra độ tương phản màu thủ công dễ bỏ sót, đặc biệt khi thêm màu mới hoặc chuyển dark mode. Một số cặp foreground/background trong dark mode (ví dụ `color-primary-foreground-soft` trên primary) không đạt WCAG AA 4.5:1.

## Decision

1. Mở rộng `scripts/generate-tokens.js` để tự động kiểm tra ~20 cặp màu quan trọng (text/surface, primary/primary-foreground, error/error-foreground, v.v.) cho cả light và dark mode.
2. Dùng hàm tính độ sáng tương đối (relative luminance) từ hex trong `features/theme/logic/colorGenerator.ts` (hoặc tương đương) để tính tỷ lệ contrast.
3. Build fail nếu bất kỳ cặp nào dưới 4.5:1; in ra cặp lỗi và giá trị contrast.
4. Khi phát hiện fail, điều chỉnh giá trị token (ví dụ `color-primary-foreground-soft` trong dark mode từ `#e2e8f0` sang `#0f172a`) thay vì whitelist.

## Consequences

- Ngăn regression về độ tương phản mỗi khi build.
- Giữ chuẩn WCAG AA cho text readable trên cả light/dark.
- Hành động sửa token rõ ràng (không dùng bypass) duy trì chất lượng accessible.
