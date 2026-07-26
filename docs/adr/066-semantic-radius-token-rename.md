# ADR-066: Semantic radius token rename

## Status

Accepted — implemented 2026-07-21.

## Context

Radius tokens `md`, `lg`, `xl` trong `tokens.json` mang ý nghĩa kích thước không rõ ràng: một component có thể dùng `lg` cho card, component khác lại dùng `lg` cho dialog. Điều này gây khó khăn khi quyết định token nào cho component mới và làm nứt SSOT về semantic.

## Decision

1. Đổi tên radius token theo use-case thay vì kích thước tuyệt đối:
   - `--radius-md` → `--radius-pill`
   - `--radius-lg` → `--radius-card`
   - `--radius-xl` → `--radius-dialog`
2. Cập nhật toàn bộ `*.module.css`, CSS string trong content scripts, và generated `tokens.css`/`tokens.ts`.
3. Không giữ alias cũ để tránh drift; dùng `replace_all` script và build/tests để đảm bảo không sót.

## Consequences

- Tên token tự giải thích: `card` dùng cho card, `dialog` cho dialog, `pill` cho pill/button.
- Breaking change rộng; đã chạy build + tests để xác minh không regression.
- Component mới không cần đoán kích thước, chỉ cần chọn đúng use-case.
