# ADR-064: Hardcoded px → design tokens (Slice 2)

## Status

Accepted — implemented 2026-07-21.

## Context

Slice 1 (ADR-063) đã cố định type scale toàn hệ thống về 14/12px. Slice 2 tiếp tục dọn drift hardcoded `px` cho sizing/spacing trong `.module.css`, `.css`, content-script CSS strings, và HTML style blocks. Các giá trị như `22px`, `18px`, `140px`, `60px`, `48px`, `880px`, `320px`, `420px`, `260px`, `1.5px`, `2px` xuất hiện rải rác, làm nứt SSOT và khó responsive.

## Decision

1. Sử dụng `var(--space-*)` (và các bước phụ `0.5`, `1.5`, `2.5`, `3.5`, `4.5`) làm giá trị spacing/sizing chính.
2. Dùng `var(--touch-target-mobile)` (44px) / `var(--touch-target-desktop)` (40px) cho `min-height`/`min-width` của control.
3. Dùng `var(--radius-*)` cho `border-radius`.
4. Nếu giá trị không có token tương ứng (ví dụ 120px, 140px, 880px), dùng `calc(var(--space-5) * N)` với `--space-5 = 20px` làm bước cơ sở.
5. Giữ nguyên `1px` cho hairline border/divider và `@media`/`@container` breakpoints.
6. Negative offset/inset phải dùng `calc(var(--token) * -1)`, không dùng `-var(--token)` (invalid CSS).
7. Áp dụng cho tất cả `.module.css` trong `shared/ui/`, `features/*`, `entrypoints/*`, cùng `shared/styles/components.css`, `entrypoints/*/styles/global.css`, `popupDictionary.css`, content-script CSS strings (`subtitleBlockCss.ts`, `navClusterCss.ts`, `tokenBadgeCss.ts`, `orbitalBadgeCss.ts`, `tokenSpanCss.ts`), và HTML style blocks (`cardCreatorTest.html`, `icon-gallery.html`).

## Consequences

- Toàn bộ sizing/spacing UI đồng nhất với `tokens.json`.
- Build vẫn pass; tests pass.
- Một số giá trị lẻ (21px → `calc(var(--space-5) + var(--space-0-5))` = 22px, 1.5px → `var(--space-0-5)` = 2px) có sai lệch 1px, được chấp nhận vì lợi ích SSOT.
- Inline SVG style injections (`subtitleManagerPanel.ts`) vẫn để lại hardcoded px; xử lý trong Slice 3 khi chuyển sang CSS classes.
