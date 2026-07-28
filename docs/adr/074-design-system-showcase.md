# ADR-074: Design System Showcase HTML

## Status
Accepted

## Context
Cell có 30+ components trong `src/shared/ui/`, hệ thống token ở `src/shared/styles/tokens.json`, và nhiều panel/screen phức tạp (`UniversalPanel`, popup dictionary, subtitle panel...). Khi làm việc, Anh yêu nhận thấy drift: "nút không theo nút, spacing đảo lộn". Cần một nơi nhìn tổng quan toàn bộ design system để review và sửa.

## Decision
Tạo một Vite sub-entry `src/entrypoints/design-system-showcase` render toàn bộ:
- Tokens (colors, spacing, typography, radius, shadow)
- Icons (`ICON_CATALOG`)
- Shared UI components với variants
- Real panel preview (trước mắt là `UniversalPanel`)

Hook vào `npm run build` qua Vite plugin `designSystemShowcase()` trong `vite.config.ts`, tự động copy output vào `docs/design-system/design-system-showcase.html` + `docs/design-system/assets/`.

## Why
- **Render thật:** Chỉ có render thật mới kiểm tra được CSS modules, tokens, dark mode, hover state.
- **Tự động:** Hook vào `npm run build` nên mỗi lần build là có file mới.
- **Không tạo component mới:** Showcase chỉ import và hiển thị components/panel có sẵn.
- **Đơn giản:** Dùng chính Vite build flow, không thêm dependency mới.

## Tradeoffs
- File HTML sau build dùng ES modules (`type="module"`), nên không mở được bằng double-click trên `file://`. Cần serve qua HTTP. Giải pháp tạm: `npm run design-system` chạy `http-server` và mở trang.
- Phase 1 chỉ có `UniversalPanel` preview. Các screen khác (popup dictionary, subtitle panel...) cần mock data/zustand stores và sẽ làm ở phase sau.

## Consequences
- `docs/design-system/design-system-showcase.html` là artifact có thể review bất cứ lúc nào.
- `npm run build` lâu hơn một chút do thêm entry point, nhưng không đáng kể.
- Cần giữ `src/entrypoints/design-system-showcase/App.tsx` cập nhật khi thêm component mới hoặc thay đổi variants.

## Related
- `docs/intent/design-system-showcase.md`
- `docs/knowledge/design-system.md`
- `src/entrypoints/design-system-showcase/`
