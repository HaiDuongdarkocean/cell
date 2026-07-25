# ADR-062: Settings dialog responsive redesign + strict 14/12px type scale

> Date: 2026-07-21
> Status: Accepted

## Context

`SettingsDialog` và các panel con (`SubtitleStylePanel`, `NavClusterSettingsPanel`, `DictionaryPopupSettingsPanel`, `CardCreatorSettingsPanel`, `TokenizeSettingsPanel`, `MultiSelect`, `SubtitlePreview`, v.v.) đang có các vấn đề UI/UX:

- Font-size rời rạc: dùng `13px` (`--font-size-sm`), `10px`/`11px` (`--font-size-2xs`) trong các module CSS, vi phạm yêu cầu setting panel chỉ dùng `14px` và `12px`.
- Layout không responsive: `pairRow`, `fieldRow`, `radioRow`, custom shadow fields, shortcut grid không xếp chồng trên màn hình hẹp, gây vỡ giao diện.
- Các icon (close, hint) dùng kích thước hardcoded `18px`/`14px`, không theo token.
- Một số input/label dùng `gap: 4px` quá nhỏ, field không có `min-width: 0`, dễ overflow.
- Các shared atom (`Select`, `Button`) dùng `--font-size-sm` (`13px`) mặc định; khi embed trong settings cũng bị ảnh hưởng.

## Decision

1. **Khóa type scale trong settings về 14px / 12px.**
   - `14px` = `--font-size-base` dùng cho primary text, label, input, button, option, tiêu đề section/card.
   - `12px` = `--font-size-xs` dùng cho hint, badge, section count, caption.
   - Không sửa toàn cục `tokens.json`; remap cục bộ trên `.popover` của `SettingsDialog` qua CSS custom properties:
     ```css
     --font-size-sm: var(--font-size-base);
     --font-size-2xs: var(--font-size-xs);
     --font-size-md: var(--font-size-base);
     --font-size-lg: var(--font-size-base);
     --font-size-xl: var(--font-size-base);
     --button-font-size: var(--font-size-base);
     --input-font-size: var(--font-size-base);
     ```
   - Đồng thời thay explicit `var(--font-size-sm)` → `var(--font-size-base)` và `var(--font-size-2xs, ...)` → `var(--font-size-xs, 12px)` trong các module CSS chỉ dùng cho settings (`MultiSelect`, `SubtitlePreview`, `SubtitleStylePanel`, `NavClusterSettingsPanel`, `DictionaryPopupSettingsPanel`, `CardCreatorSettingsPanel`, `SubtitleBlockSettingsPanel`, `TokenizeSettingsPanel`, `SearchableSelect`, `ShortcutInput`).

2. **Responsive mobile-first cho layout.**
   - `pairRow`: mặc định 1 cột; từ `480px` trở lên thành 2 cột.
   - `fieldRow`: mặc định 1 cột; từ `520px` trở lên thành 2 cột.
   - Custom shadow row (`customShadowRow`): mặc định 2×2; từ `768px` trở lên thành 4 cột.
   - Shortcut grid: mặc định 1 cột; từ `480px` trở lên thành 2 cột.
   - `radioRow`: `flex-wrap: wrap`, label `flex: 1 1 auto` để tự xuống dòng khi không đủ chỗ.
   - Dialog popover `max-width: min(480px, calc(100vw - 16px))` để không vượt viewport.

3. **Icon/hint dùng token size.**
   - Close icon `16px` trên mobile, `20px` từ `480px+` (dùng `--space-4` / `--space-5`).
   - Hint button `20px` + icon `16px` (dùng `--space-5` / `--space-4`), bỏ `size={14}` hardcoded trong `HintIcon.tsx`.

4. **Spacing & overflow guards.**
   - Field gap chuẩn hóa thành `--space-2` (8px).
   - Thêm `min-width: 0` cho field, input, status detail để ellipsis/flex-shrink hoạt động đúng.
   - `connectionStatus` và `toggleRow` cho `flex-wrap: wrap`.

5. **Không thay đổi behavior, data-testid, hay global tokens.**
   - Chỉ thay layout/typography/color/spacing; không đụng logic/settings schema.

## Alternatives Considered

- **Sửa `tokens.json` `font-size-sm` thành `14px`:** ảnh hưởng toàn bộ popup/options/sidepanel ngoài settings, có thể phá vỡ các UI khác đã thiết kế quanh `13px`. Từ chối.
- **Sửa từng shared atom (`Select`, `Button`) trực tiếp:** các atom còn dùng ở Card Creator, popup dictionary, v.v.; từ chối để tránh side effect. Thay vào đó remap cục bộ trong `.popover`.
- **Để nguyên và override class-by-class trong settings:** nhiều boilerplate, khó maintain. Dùng CSS variable cascade để một chỗ remap ảnh hưởng descendants.

## Consequences

- Positive: settings dialog đồng nhất 14/12px, responsive từ 320px đến 1280px, không còn hardcoded size.
- Positive: shared atoms vẫn giữ `13px` mặc định ở các context khác.
- Positive: build vẫn pass; không thêm dependency.
- Negative: remap `--font-size-sm` trong `.popover` có thể gây bất ngờ nếu tương lai có component settings muốn dùng `13px`; cần ghi chú rõ trong code.
