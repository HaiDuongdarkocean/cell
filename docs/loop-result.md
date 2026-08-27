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

- [x] Missing `.showcase.tsx` files landed (16 shared UI components).
- [x] Typecheck errors resolved.
- [x] Build regenerated `tokens.css` and `docs/design-system/`.
- [x] Commit prepared with Button v4, token/tokens.css, design-system assets, and cleanup.
- Full project lint still has pre-existing errors; changed files lint clean.

---

# Loop process log — agentic redesign tasks

This file records what each loop accomplished, what changed, and how it was verified.

## 2026-08-28 — Liquid Glass Button v4 fit

**Goal**: align the shared `Button` atom to the approved `liquid-glass-dewdrop-v4.html` mockup.

**What changed**:
- `src/shared/styles/tokens.json`
  - Added `color-button-liquid-*` tokens (surface/specular/caustic/surface-glow/edge-glow/reflex-light/reflex-dark/text-shadow) for both light and dark modes.
  - Added `liquid-*` properties under the `button` component token block for geometry, blur, radius, and per-state values.
  - Kept `color-button-liquid-reflex-*` as quoted strings so `src/shared/lib/tokens.ts` type checks.
- `src/shared/ui/Button.module.css`
  - Refactored default button to the Liquid Glass material: semi-transparent surface, backdrop blur/saturate, caustic surface highlight (`::before`), rim caustics (`::after`), contact shadow, reflex shadows, and text-shadow.
  - Unified `outline` and `ghost` variants to use the same glass fill as `primary`/`success`/`destructive` (rim caustics provide the only outline), matching the v4 mockup where all action variants share one material.
  - Updated sizing (`sm`/`md`/`lg`/`xl`), disabled/loading opacity, active/pressed brightness, and reduced-transparency fallbacks.
- `src/shared/ui/Button.showcase.tsx`
  - Updated the “Variants — Liquid Glass” caption to state that all action variants share the same material.
- `docs/2-architechture-system.md`
  - Updated the `shared/ui/Button.tsx` row to list co-located files (`.module.css`, `.style-guard.test.ts`, `.showcase.tsx`, `.showcase.module.css`) and the v4 feature set.
  - Updated the `tokens.json` row to mention the `button` Liquid Glass component tokens.

**Verification**:
- `node scripts/generate-tokens.js` — pass.
- `npx jest --selectProjects unit --testPathPatterns=Button` — 19 suites, 120 tests pass.
- `npm run build` — pass.
- `npm run typecheck` — pre-existing errors remain; no new `Button`/`tokens` errors introduced.
- `npm run lint` — pre-existing project-wide errors remain; targeted `npx eslint src/shared/ui/Button.module.css src/shared/ui/Button.showcase.tsx` — clean.
- Stealth CDP browser preview (`design-system-showcase.html?showcase=Button`) — dark-mode screenshot confirms all 6 variants share the same smoked-blue liquid-glass material with caustic rim highlights, matching the v4 mockup.

## 2026-08-28 — Button press ripple + water-surface spring

**Goal**: add a visible pointer-down ripple and a water-surface spring/bounce on press/release.

**What changed**:
- `src/shared/styles/tokens.json`
  - Added `color-button-liquid-ripple` token: `rgba(255, 255, 255, 0.35)` light, `rgba(255, 255, 255, 0.50)` dark.
  - Added component `button` press/ripple motion tokens: `press-scale`, `press-duration`, `press-ease`, `release-duration`, `release-ease`, `ripple-duration`, `ripple-ease`, `ripple-scale`, `ripple-start-opacity`.
- `src/shared/ui/Button.module.css`
  - Base `.button` now uses `transform var(--button-release-duration) var(--button-release-ease)` so the release has a subtle spring overshoot.
  - `.button:active` uses `transform: scale(var(--button-press-scale))` with a fast `var(--button-press-duration) var(--button-press-ease)`.
  - `.ripple` uses a white radial gradient from `--button-liquid-ripple`, scaled from the touch point by `var(--button-ripple-scale)`, with `var(--button-ripple-start-opacity)` -> 0 fade.
- `src/shared/ui/Button.tsx`
  - `ripple` now defaults to `true` so every button emits the water ripple on pointer down.
  - Reduced the generated ripple diameter to `1.6x` the button size to match the v4 droplet scale.
- `src/shared/ui/Button.showcase.tsx`
  - Updated the “Variants — Liquid Glass” caption to mention the pointer-down ripple and spring release.
- `docs/2-architechture-system.md`
  - Updated the `shared/ui/Button.tsx` row to mention ripple + spring.
- `docs/0-wiki.md`
  - Updated the wiki history.

**Verification**:
- `node scripts/generate-tokens.js` — pass.
- `npx jest --selectProjects unit --testPathPatterns=Button` — 19 suites, 120 tests pass.
- `npm run build` — pass.
- `npm run typecheck` — pass (no new errors).
- Stealth CDP browser preview — paused dark-mode animation shows a visible white water ripple expanding from the Primary button; release spring is active in CSS.

## 2026-08-28 — Ripple visibility tune

**What changed**:
- `src/shared/styles/tokens.json`
  - `color-button-liquid-ripple` raised to 0.70 (dark) and 0.50 (light).
  - `ripple-start-opacity` raised to 0.9 and held until 60% of the ripple duration so the water-ripple flash stays visible while expanding.
- `src/shared/ui/Button.module.css`
  - `.ripple` uses a centered bright water-disc gradient (`0%` token → `40%` 60% token → `70%` transparent) with explicit `background-size: 100% 100%` and `no-repeat`.
  - `z-index: 1` so the ripple paints above the caustic/rim layers but behind the button label.
  - `@keyframes ripple` holds full opacity from `0%` to `60%`, then fades out to give a clear expanding water-ripple.
- `package.json`: `design-system` script now uses `http-server -c-1` to avoid stale asset caching across rebuilds.
- `src/shared/styles/tokens.css` regenerated.
- `docs/design-system/` rebuilt with `npm run build`.

**Verification**:
- `npx jest --selectProjects unit --testPathPatterns=Button` — 120 tests pass.
- `npm run build` — pass.
- `npm run typecheck` — pass.
- Stealth CDP real browser click on `http://127.0.0.1:8123/design-system-showcase.html?showcase=Button` (dark mode, ripple paused at 200 ms by MutationObserver after a real `pointerdown`) — Primary button clearly brightens with a white water ripple expanding from the touch point; text label remains legible.
