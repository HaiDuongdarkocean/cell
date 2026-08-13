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
  - [x] `Scrollable.module.css` chứa `.hide` với đúng 2 rule.
  - [x] Không còn `scrollbar-width: none` và `::-webkit-scrollbar { display: none; }` trong các `.module.css` khác.
  - [x] Build pass.

## Loop 6 — Themed scrollbar (module) SSOT
- **Why:** Các `.module.css` lặp lại pattern themed scrollbar (`scrollbar-width: thin` + `scrollbar-color` + `::-webkit-scrollbar` track/thumb/hover).
- **What:** Mở rộng `Scrollable.module.css` thêm `.themed` (width 1.5) và `.themedWide` (width 2); dùng `composes` thay thế.
- **Files:**
  - `src/shared/ui/Scrollable.module.css`
  - `src/shared/ui/Dialog.module.css`
  - `src/shared/ui/Select.module.css`
  - `src/shared/ui/SearchableSelect.module.css`
  - `src/features/settings/ui/MultiSelect.module.css`
  - `src/features/cardCreator/ui/QueueSidebar.module.css`
  - `src/features/settings/ui/SettingsDialog.module.css`
- **AC:**
  - [x] `Scrollable.module.css` chứa `.themed` và `.themedWide`.
  - [x] Không còn `scrollbar-width: thin`, `scrollbar-color`, `::-webkit-scrollbar` track/thumb/hover trong các `.module.css` khác.
  - [x] Build + tests pass.

## Loop 7 — Global / shadow scrollbar SSOT
- **Why:** `popup/styles/global.css`, `sidepanel/styles/global.css`, và `shared/styles/components.css` (shadow DOM) cùng chứa một block themed scrollbar gần như giống nhau.
- **What:** Tách thành `scrollbars-document.css` (dùng `*`) và `scrollbars-shadow.css` (dùng `:where(:host *)`); inject qua `@import` / `injectShadowCss.ts`.
- **Files:**
  - `src/shared/styles/scrollbars-document.css` (new)
  - `src/shared/styles/scrollbars-shadow.css` (new)
  - `src/entrypoints/popup/styles/global.css`
  - `src/entrypoints/sidepanel/styles/global.css`
  - `src/entrypoints/sidepanel/index.html`
  - `src/shared/styles/components.css`
  - `src/shared/lib/shadowRoot/injectShadowCss.ts`
  - `src/entrypoints/design-system-showcase/ShadowButtonPoC.tsx`
- **AC:**
  - [x] `scrollbars-document.css` và `scrollbars-shadow.css` là SSOT.
  - [x] `popup/global.css` và `sidepanel/global.css` chỉ còn `@import`.
  - [x] `components.css` không còn block scrollbar.
  - [x] Build + tests pass.

## Loop 8 — Remaining empty states SSOT
- **Why:** `ImagePanel.tsx` và `CandidateView.tsx` vẫn dùng markup + CSS thủ công cho empty state thay vì `EmptyState` component đã có từ Loop 3.
- **What:** Thay thế bằng `<EmptyState size="sm" ...>`; xóa `.cellImageEmpty`, `.cellImageEmptyIcon`, `.cellImageEmptyTitle`, `.cellDefEmpty` trong `DictionaryPanelView.module.css`.
- **Files:**
  - `src/features/dictionaryPopup/ui/ImagePanel.tsx`
  - `src/features/dictionaryPopup/ui/CandidateView.tsx`
  - `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
- **AC:**
  - [x] `ImagePanel.tsx` dùng `EmptyState`.
  - [x] `CandidateView.tsx` dùng `EmptyState`.
  - [x] Không còn `.cellImageEmpty`, `.cellImageEmptyIcon`, `.cellImageEmptyTitle`, `.cellDefEmpty`.
  - [x] Build + tests pass.

## Loop 9 — Header / action layout SSOT
- **Why:** `Header`, `SelectionBar`, `UniversalPanelHeader` và nhiều component khác tự định nghĩa lại `display: flex; align-items: center; justify-content: space-between; gap: ...` thay vì dùng `HStack`/`Flex` đã có.
- **What:** Mở rộng `HStack`/`VStack` để hỗ trợ `role`, `aria-*`, `data-*`; chuyển các header row / action bar / toggle cluster sang `HStack`; xóa CSS flex trùng lặp.
- **Files:**
  - `src/shared/ui/Stack.tsx`, `Stack.test.tsx`
  - `src/entrypoints/popup/components/layout/Header.{tsx,module.css}`
  - `src/entrypoints/popup/components/SelectionBar.{tsx,module.css}`
  - `src/features/universalPanel/UniversalPanelHeader.{tsx,module.css}`
- **AC:**
  - [x] `HStack`/`VStack` accept div HTML attributes.
  - [x] Các header row / action bar trong scope dùng `HStack`/`Flex`.
  - [x] Không còn `display: flex; align-items: center; justify-content: space-between` CSS dư thừa trong các inner class đã refactor.
  - [x] Build + tests pass.

## Loop 10 — DictionaryPanelView alert/loading SSOT
- **Why:** `DictionaryPanelView.module.css` vẫn có `.error` banner và `.loading` card tự định nghĩa, trong khi `shared/ui/Alert` đã tồn tại và `HStack` đã có từ Loop 9.
- **What:** Mở rộng `Alert` với `icon` prop để hỗ trợ error banner; dùng `Alert` cho `panel.error`; dùng `HStack` cho loading state; xóa CSS dư thừa.
- **Files:**
  - `src/shared/ui/Alert.{tsx,module.css,test.tsx}`
  - `src/features/dictionaryPopup/ui/DictionaryPanelView.{tsx,module.css}`
- **AC:**
  - [x] `Alert` hỗ trợ `icon?: ReactNode`.
  - [x] `DictionaryPanelView` dùng `Alert` cho `panel.error` thay vì `.error` CSS riêng.
  - [x] `DictionaryPanelView` dùng `HStack` cho loading state thay vì `.loading` CSS có `display: flex`.
  - [x] Không còn `.error` CSS; `.loading` chỉ còn color/background/padding.
  - [x] Build + tests pass.

## Loop 11 — Error/success pill SSOT
- **Why:** `ResourcesPanel`, `ImportProgress`, `TtsVoiceManagerPanel` có `.error`/`.success` pill gần giống nhau; đã có `Alert` từ Loop 10.
- **What:** Thay thế các `.error`/`.success`/`.status` thủ công bằng `Alert` component; xóa CSS dư thừa.
- **Files:**
  - `src/features/dictionary/ui/ResourcesPanel.{tsx,module.css}`
  - `src/features/dictionary/ui/ImportProgress.{tsx,module.css}`
  - `src/features/tts/ui/TtsVoiceManagerPanel.{tsx,module.css}`
  - `src/shared/ui/Alert.module.css`
- **AC:**
  - [x] `ResourcesPanel` dùng `Alert` cho error/success.
  - [x] `ImportProgress` dùng `Alert` cho error.
  - [x] `TtsVoiceManagerPanel` dùng `Alert` cho error/status.
  - [x] Không còn `.error`/`.success`/`.status` alert blocks trong các CSS module trên.
  - [x] `Alert.module.css` root có `width: 100%`.
  - [x] Build + tests pass.

## Loop 12 — Dialog header + DownloadCard layout SSOT
- **Why:** `Dialog.headerRightGroup` và `DownloadCard` header/titleRow/actions/phaseRow/progressLabel/queuedIndicator/detailRow tự định nghĩa `display: flex` trong khi `HStack`/`VStack` đã có.
- **What:** Dùng `HStack` cho các layout row trong `Dialog` và `DownloadCard`; dùng `VStack` cho body `DownloadCard`; xóa CSS flex dư thừa.
- **Files:**
  - `src/shared/ui/Dialog.{tsx,module.css}`
  - `src/entrypoints/popup/components/media/DownloadCard.{tsx,module.css}`
- **AC:**
  - [x] `Dialog.headerRightGroup` dùng `HStack`.
  - [x] `DownloadCard` dùng `HStack` cho header, titleRow, actions, phaseRow, progressLabel, queuedIndicator, detailRow.
  - [x] `DownloadCard` dùng `VStack` cho card body.
  - [x] Không còn `display: flex` dư thừa trong các class trên.
  - [x] Build + tests pass.

## Loop 13 — Dialog header/footer + VideoCard/SubtitleCard layout SSOT
- **Why:** `Dialog` `.header`/`.footer` và `VideoCard`/`SubtitleCard` `mainRow`/`tagRow`/`icon`/`.body` còn tự định nghĩa flex trong khi `HStack`/`VStack` đã có.
- **What:** Dùng `HStack`/`VStack` cho `Dialog` header/footer và media card layouts; xóa CSS flex dư.
- **Files:**
  - `src/shared/ui/Dialog.{tsx,module.css}`
  - `src/entrypoints/popup/components/media/VideoCard.{tsx,module.css}`
  - `src/entrypoints/popup/components/media/SubtitleCard.{tsx,module.css}`
- **AC:**
  - [x] `Dialog.header` dùng `HStack`.
  - [x] `Dialog.footer` dùng `HStack` (hoặc `Flex`).
  - [x] `VideoCard`/`SubtitleCard` dùng `HStack` cho `mainRow`, `tagRow`; `VStack` cho card body.
  - [x] Không còn `display: flex` dư thừa trong các class trên.
  - [x] Build + tests pass.

## Loop 14 — WordChip → Chip SSOT
- **Why:** `WordChip` tự định nghĩa toàn bộ chip CSS trong khi `Chip` đã có; cần mở rộng `Chip` thêm màu `primary`, `warning`, `muted` để hỗ trợ `new`/`learning`/`mastered`/`unknown`.
- **What:** Mở rộng `Chip` color variants; chuyển `WordChip` thành wrapper của `Chip`; xóa `WordChip.module.css`.
- **Files:**
  - `src/shared/ui/Chip.{tsx,module.css,test.tsx,showcase.tsx}`
  - `src/shared/domain/learning/atoms/WordChip.{tsx,module.css,test.tsx,showcase.tsx}`
- **AC:**
  - [x] `Chip` hỗ trợ `color: 'primary' | 'warning' | 'muted'` (giữ `success`/`error`).
  - [x] `WordChip` dùng `Chip as="button"` với `color` mapping từ `status`.
  - [x] Xóa `WordChip.module.css` hoặc chỉ còn CSS cần thiết (nếu có).
  - [x] Tests + build pass.

## Loop 15 — Design-system-showcase scrollbar SSOT
- **Why:** `src/entrypoints/design-system-showcase/index.html` nhúng CSS `::-webkit-scrollbar` trực tiếp, trùng với `src/shared/styles/scrollbars-document.css`.
- **What:** Bỏ scrollbar CSS inline; import `scrollbars-document.css` trong `main.tsx` (hoặc `global.css`) để dùng SSOT.
- **Files:**
  - `src/entrypoints/design-system-showcase/index.html`
  - `src/entrypoints/design-system-showcase/main.tsx`
- **AC:**
  - [x] Xóa `::-webkit-scrollbar` và `scrollbar-*` inline trong `index.html`.
  - [x] `main.tsx` import `scrollbars-document.css`.
  - [x] Showcase vẫn hiển thị đúng, scrollbar theming hoạt động.
  - [x] Build pass.

## Loop 16 — BottomSheet layout HStack/VStack/Flex SSOT
- **Why:** `BottomSheet` `.overlay`/`.sheet`/`.header`/`.footer`/`content` còn tự định nghĩa flex trong khi `HStack`/`VStack`/`Flex` đã có.
- **What:** Dùng `Flex` cho `.overlay`, `VStack` cho `.sheet` và `.content`, `HStack` cho `.header` và `.footer`; xóa CSS flex dư.
- **Files:**
  - `src/shared/ui/BottomSheet.{tsx,module.css}`
- **AC:**
  - [x] `BottomSheet.overlay` dùng `Flex` với `align="end"` `justify="center"`.
  - [x] `BottomSheet.sheet` dùng `VStack`.
  - [x] `BottomSheet.content` dùng `VStack`.
  - [x] `BottomSheet.header` và `.footer` dùng `HStack`.
  - [x] Không còn `display: flex` dư thừa trong các class trên.
  - [x] Build + `BottomSheet` tests pass.

## Loop 17 — SourceBadge → Badge SSOT
- **Why:** `SourceBadge` tự định nghĩa toàn bộ pill CSS trong khi `Badge` đã có.
- **What:** Thêm `muted` variant và `xs` size vào `Badge`; chuyển `SourceBadge` thành wrapper của `Badge`; xóa `SourceBadge.module.css`.
- **Files:**
  - `src/shared/ui/Badge.{tsx,module.css}`
  - `src/shared/domain/dictionary/atoms/SourceBadge.tsx`
  - `src/shared/domain/dictionary/atoms/SourceBadge.module.css` (delete)
  - `src/shared/styles/tokens.json` (optional: badge-muted tokens)
- **AC:**
  - [x] `Badge` hỗ trợ `variant="muted"` (nền muted, chữ secondary) và `size="xs"` (`font-size-2xs`).
  - [x] `SourceBadge` là wrapper của `Badge` với `aria-label` từ `source`.
  - [x] Xóa `SourceBadge.module.css`.
  - [x] Build + `SourceBadge` / `Badge` tests pass.

## Loop 18+ (future loops)
- Domain badge còn lại (`StatusBadge`, `FrequencyBadge`, `MasteryBadge`) consolidate với `Badge`/`Chip`.
- Toast / notice patterns (`SubtitleToast`, `CardCreatorDialog` notice, `SubtitleSearchPanel` error, `DownloadCard` error, `QueueSidebar` status, `SubtitleManagerPanel` error).

## Verification pattern
Sau mỗi loop:
1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. Subagent review diff để xác nhận AC và tìm trùng lặp còn sót.
