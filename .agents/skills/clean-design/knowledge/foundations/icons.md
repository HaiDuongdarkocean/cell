# Foundation — Iconography

> Nguồn: `src/shared/icons/index.ts` (`ICON_CATALOG`), `src/shared/icons/Icon.tsx`.

## Spec hệ thống

- Canvas **24×24**, stroke **1.5px**, round caps/joins, `currentColor`, `fill: none`.
- Render size chuẩn toàn hệ thống: **18px** — `ICON_SIZE_PX`, catalog force `size=18` cho cả React component lẫn raw SVG; size prop chỉ còn tương thích.
- Trong box 40×40 → icon được inset `(40−18)/2 = 11px` tự động center.

## Rules

1. **Query `ICON_CATALOG` trước khi tạo icon mới** — grep theo tag/semantic name; trùng nghĩa → reuse.
2. Tên **semantic**, không phải hình dạng (`"warning"` không phải `"triangle"`).
3. **Không inline `<svg>`** trong component — audit command bắt.
4. Icon mang nghĩa status → kèm text hoặc label (màu+hình không đủ — T8); icon-only button bắt buộc accessible name + Tooltip diễn giải.
5. Icon trong button = atom-internal gap `space-0-5`–`space-1` với label.

## Design icon mới (khi catalog thiếu thật)

Follow `design-svg` skill — Nucleus system: 24×24, stroke 1.5. Sau đó đăng ký vào catalog, không để lẻ.
