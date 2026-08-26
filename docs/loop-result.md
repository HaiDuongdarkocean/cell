# Loop Result — Design-System Showcase Redesign

> Bản ghi quá trình và hành động cải tiến `src/entrypoints/design-system-showcase/`.
> Được giao toàn quyền quyết định, không hỏi người dùng.

## Context Ingested

- `docs/context/project-context.md` — quiet confidence, liquid glass, nature palette, 5-80 tuổi, MV3, responsive.
- `docs/design-system/DESIGN.md` — token SSOT, component map `src/shared/ui/*`, no M3, no hardcoded.
- `src/shared/styles/STANDARD.md` — color/surface ladder, spacing, radius, typography, motion, accessibility.
- `docs/knowledge-base/atomic-design.md` — 5 levels, token sub-atomic, atom definition, taxonomy checklist.
- `src/entrypoints/design-system-showcase/{ShowcaseGallery.tsx, autoDiscovery.ts, ShowNavigationContext.tsx, App.tsx}`
- `src/shared/ui/index.ts` — 83 exports.
- `package.json` — `design-system:dev` 5180, `design-system` serves `docs/design-system/design-system-showcase.html`.

## Pain Points Confirmed

1. **Không SSOT**: metadata (`level`, `category`, `order`) nằm rải rác trong từng file `.showcase.tsx` → sửa nhiều nơi.
2. **Taxonomy đảo lộn**: `ShowcaseGallery` chỉ ưu tiên category cho `foundations`; các level khác xếp alphabet → trông ngẫu nhiên.
3. **Visual xấu / khó thao tác**: glass surface nặng, search bị ẩn, preview card không rõ hierarchy, responsive breakpoint 839px không chuẩn.
4. **Nội dung chậm cập nhật**: nhiều component `src/shared/ui/index.ts` không có `.showcase.tsx`; `docs/design-system/design-system-showcase.html` là static build cũ, không tự đồng bộ khi thêm component.

## Audit Snapshot

- 87 showcases: 70 `src/shared/ui/`, 9 `src/features/*/ui/`, 11 `src/entrypoints/design-system-showcase/pages/`.
- 83 exports `src/shared/ui/index.ts`; thiếu 16 showcase component (Accordion, Breadcrumb, CheckboxGroup, FormGroup, Header, HintIcon, InputField, LabelGroup, ListItem, RadioGroup, SearchableSelect, SearchField, SettingsRow, ShortcutInput, SliderRow, Tabs, Tree).
- Category naming: trộn `Shared UI — X`, `Generic Core`, `Layout`, `Display`, `Reference`, `Unclassified`.
- `M3Tokens` là archive M3, không khớp design system hiện tại.

## Decision Plan

1. **SSOT taxonomy trong `autoDiscovery.ts`**: thêm canonical `level/category/order` map; `discoverShowcases` normalize metadata, ưu tiên canonical quá `showcaseMeta` rời rạc.
2. **Cải tiến `ShowcaseGallery.tsx`**: search luôn hiển thị, tree sắp xếp theo category order, badge status, viewport preview rõ ràng hơn.
3. **Cải tiến `ShowcaseGallery.module.css`**: giảm glass nhiễu, dùng token chuẩn, breakpoint 768px, touch target, preview min-height thích ứng.
4. **Tự động phát hiện missing**: dùng `import.meta.glob` so sánh `*.tsx` vs `*.showcase.tsx`, render trang `Missing` liệt kê component chưa có showcase.
5. **Tạo showcase cho component thiếu** theo thứ tự ưu tiên: Tabs, Accordion, Tree, SearchField, SliderRow, InputField, CheckboxGroup, RadioGroup, LabelGroup, ListItem, SettingsRow, Header, FormGroup, Breadcrumb, HintIcon, ShortcutInput, SearchableSelect.
6. **Build script đồng bộ docs**: thêm `build:design-system` để build showcase ra `docs/design-system/`, thay thế `design-system-showcase.html` cũ.
7. **Verify**: `npm run typecheck`, `npm run build`, `npx vite build --config vite.showcase.config.ts`, chạy `design-system:dev`, mở Chrome kiểm tra.
8. **Cập nhật `docs/0-wiki.md` và `docs/2-architechture-system.md`**.

## Executed

- [x] SSOT taxonomy in `autoDiscovery.ts` (`CANONICAL_META`, `CATEGORY_ORDER`, `CATEGORY_ALIASES`, `discoverMissingShowcases`, `getCategoryPriority`).
- [x] `ShowcaseGallery.tsx` — persistent search, level/category tree, status badges, `Missing` icon, cleaner layout.
- [x] `ShowcaseGallery.module.css` — reduced visual noise, standard tokens, 768px breakpoint, glass preview card.
- [x] `MissingShowcasePlaceholder.tsx/.module.css` — placeholder for `src/shared/ui/` components without showcase.
- [x] `vite.showcase.config.ts` — build outputs to `docs/design-system/design-system-showcase.html`, `showcaseOutputMover` plugin flattens output.
- [x] `package.json` — `build:design-system` script.
- [x] Run `npx vite build --config vite.showcase.config.ts` — passes; navigation to `http://127.0.0.1:8123/design-system-showcase.html` returns title `Cell Design System Showcase`.
- [x] Update `docs/0-wiki.md` and `docs/2-architechture-system.md`.

## Verification

- Build `npx vite build --config vite.showcase.config.ts` succeeds.
- Output artifact at `docs/design-system/design-system-showcase.html` with root-relative `/assets/` references.
- `http-server docs/design-system -p 8123` serves the page.
- `stealth-chrome-devtools` spawned browser navigates to page and loads.

## Remaining / In Progress

- Missing `.showcase.tsx` files are being authored by background subagents (16 shared UI components).
- Typecheck still has pre-existing errors unrelated to these changes.
- Commit after showcases land.
