# Implementation Plan: UI DRY → SSOT Refactor

## Goal
Loại bỏ code UI trùng lặp trong `src/` bằng cách tận dụng `src/shared/ui/` và `src/shared/styles/` làm single source of truth, thay vì mỗi component tự tái tạo cùng một pattern (chip, badge, spinner, empty state, scrollbar, animations).

## Approach
Chạy theo vòng lặp **discover → plan → do → verify (AC + subagent) → loop**.
Mỗi loop tập trung một nhóm trùng lặp liên quan, có acceptance criteria rõ ràng.

## Loop 1 — Loading spinner SSOT
- **Why:** `@keyframes spin` và `.spinner` CSS bị nhân bản ở `Button`, `IconButton`, `VideoCard`, `SubtitleCard`, `MasteryBadge`. `shared/ui/Spinner` đã tồn tại.
- **What:** Thay `Icon name="loader"` + animation cục bộ bằng `Spinner`; xóa `@keyframes spin` và `.spinner` CSS dư thừa.
- **Files:**
  - `src/shared/ui/Button.tsx`, `Button.module.css`
  - `src/shared/ui/IconButton.tsx`, `IconButton.module.css`
  - `src/entrypoints/popup/components/media/VideoCard.tsx`, `VideoCard.module.css`
  - `src/entrypoints/popup/components/media/SubtitleCard.tsx`, `SubtitleCard.module.css`
  - `src/shared/domain/learning/atoms/MasteryBadge.tsx`, `MasteryBadge.module.css`
- **AC:**
  - [ ] Chỉ còn duy nhất một `@keyframes spin` trong `src/`, tại `Spinner.module.css`.
  - [ ] Các trạng thái loading vẫn render spinner có kích thước và màu tương đương.
  - [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` đều pass.

## Loop 2 — Card enter/expand animations SSOT
- **Why:** `VideoCard.module.css` và `SubtitleCard.module.css` cùng chứa `@keyframes fade-in` và `@keyframes slide-down`.
- **What:** Tách keyframes ra shared style và dùng `composes`/global class; card vẫn giữ animation.
- **Files:**
  - `src/entrypoints/popup/components/media/VideoCard.module.css`
  - `src/entrypoints/popup/components/media/SubtitleCard.module.css`
  - `src/shared/styles/` (nếu cần thêm file SSOT)
- **AC:**
  - [ ] Chỉ còn một nguồn `fade-in` và `slide-down`.
  - [ ] Build/test pass, card vẫn fade-in/url panel vẫn slide-down.

## Loop 3 — Empty state SSOT
- **Why:** `DictionaryPanelView`, `ImagePanel`, `TranslatePanel` tự viết markup empty state và CSS riêng; `shared/ui/EmptyState` đã tồn tại.
- **What:** Mở rộng `EmptyState` với variant nhỏ gọn (`size="sm"` hoặc `compact`), thay thế empty state tùy chỉnh, xóa CSS dư.
- **Files:**
  - `src/shared/ui/EmptyState.tsx`, `EmptyState.module.css`
  - `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`
  - `src/features/dictionaryPopup/ui/ImagePanel.tsx`
  - `src/features/dictionaryPopup/ui/TranslatePanel.tsx`
- **AC:**
  - [ ] Không còn `.dictionaryEmpty`, `.cellImageEmpty`, `.cellTranslateEmpty` CSS trùng lặp.
  - [ ] `EmptyState` vẫn hiển thị đúng icon/title/description/action ở cả hai kích thước.
  - [ ] Build/test pass.

## Loop 4+ (future loops)
- Scrollbar CSS dư thừa trong `Dialog`, `Select`, `SearchableSelect`, `MultiSelect`, `SettingsDialog`, `QueueSidebar`.
- Domain chip/badge (`SynonymChip`, `AntonymChip`, `WordChip`, `SourceBadge`, `FrequencyBadge`, `MasteryBadge`, `StatusBadge`) soạn lại qua `Chip`/`Badge` variants.
- Header/actions layout patterns trong popup/subtitle/universal panel.

## Verification pattern
Sau mỗi loop:
1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. Subagent review diff để xác nhận AC và tìm trùng lặp còn sót.
