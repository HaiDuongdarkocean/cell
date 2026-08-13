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
  - [x] Chỉ còn duy nhất một `@keyframes spin` trong `src/`, tại `Spinner.module.css`.
  - [x] Các trạng thái loading vẫn render spinner có kích thước và màu tương đương.
  - [x] `npm run typecheck`, `npm run test:unit` liên quan, `npm run build` đều pass.

## Loop 2 — Card enter/expand animations SSOT
- **Why:** `VideoCard.module.css` và `SubtitleCard.module.css` cùng chứa `@keyframes fade-in` và `@keyframes slide-down`.
- **What:** Tạo `src/shared/ui/CardAnimations.module.css` làm SSOT; `VideoCard` và `SubtitleCard` import class `fadeIn`, `urlPanel`, `copiedBadge` từ đó.
- **Files:**
  - `src/entrypoints/popup/components/media/VideoCard.{tsx,module.css}`
  - `src/entrypoints/popup/components/media/SubtitleCard.{tsx,module.css}`
  - `src/shared/ui/CardAnimations.module.css` (new)
- **AC:**
  - [x] Chỉ còn một nguồn `fade-in` và `slide-down`.
  - [x] Build/test pass, card vẫn fade-in/url panel vẫn slide-down.

## Loop 3 — Empty state SSOT
- **Why:** `DictionaryPanelView`, `ImagePanel`, `TranslatePanel` tự viết markup empty state và CSS riêng; `shared/ui/EmptyState` đã tồn tại.
- **What:** Mở rộng `EmptyState` với `size` prop (`md` / `compact` / `sm`) để hỗ trợ cả empty state lớn (48px) và panel (36px/24px); thay thế empty state tùy chỉnh trong `DictionaryPanelView` và `TranslatePanel`; xóa CSS dư.
- **Files:**
  - `src/shared/ui/EmptyState.tsx`, `EmptyState.module.css`, `EmptyState.test.tsx`
  - `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`
  - `src/features/dictionaryPopup/ui/TranslatePanel.tsx`
- **AC:**
  - [ ] `EmptyState` hỗ trợ `size` prop với ít nhất `sm` và `compact`.
  - [ ] `DictionaryPanelView` và `TranslatePanel` dùng `EmptyState` thay vì markup/CSS riêng.
  - [ ] Không còn `.dictionaryEmpty`, `.cellTranslateEmpty` CSS trùng lặp.
  - [ ] Build/test pass.

## Loop 4 — Synonym/Antonym chip SSOT
- **Why:** `SynonymChip` và `AntonymChip` là hai component gần như giống hệt, chỉ khác màu token (success/error). `shared/ui/Chip` đã tồn tại.
- **What:** Mở rộng `Chip` với `color` prop (`success`/`error`), chuyển `SynonymChip` và `AntonymChip` dùng `Chip`, xóa CSS module riêng.
- **Files:**
  - `src/shared/ui/Chip.{tsx,module.css,test.tsx}`
  - `src/shared/domain/dictionary/atoms/SynonymChip.{tsx,module.css,test.tsx,showcase.tsx}`
  - `src/shared/domain/dictionary/atoms/AntonymChip.{tsx,module.css,test.tsx,showcase.tsx}`
  - `src/shared/domain/dictionary/atoms/index.ts`
  - `docs/2-architechture-system.md`
- **AC:**
  - [ ] `Chip` hỗ trợ `color?: 'default' | 'success' | 'error'`.
  - [ ] `SynonymChip` và `AntonymChip` render `Chip` với màu tương ứng, không còn CSS module riêng.
  - [ ] Tests + build pass.

## Loop 5 — Hidden scrollbar SSOT
- **Why:** Hàng chục `.module.css` có cùng pattern `scrollbar-width: none` + `::-webkit-scrollbar { display: none; }`.
- **What:** Tạo `src/shared/ui/Scrollable.module.css` với class `.hide`; dùng `composes: hide from ...` để thay thế các block trùng.
- **Files:**
  - `src/shared/ui/Scrollable.module.css`
  - `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
  - `src/features/dictionaryPopup/ui/PopupDictionary.module.css`
  - `src/features/settings/ui/SettingsDialog.module.css`
  - `src/entrypoints/popup/App.redesigned.module.css`
- **AC:**
  - [ ] `Scrollable.module.css` chứa `.hide` với đúng 2 rule.
  - [ ] Không còn `scrollbar-width: none` và `::-webkit-scrollbar { display: none; }` trong các `.module.css` khác.
  - [ ] Build pass.

## Loop 6+ (future loops)
- Themed scrollbar CSS dư thừa trong `Dialog`, `Select`, `SearchableSelect`, `MultiSelect`, `QueueSidebar`.
- Domain chip/badge còn lại (`WordChip`, `SourceBadge`, `FrequencyBadge`, `MasteryBadge`, `StatusBadge`).
- Header/actions layout patterns trong popup/subtitle/universal panel.

## Verification pattern
Sau mỗi loop:
1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. Subagent review diff để xác nhận AC và tìm trùng lặp còn sót.
