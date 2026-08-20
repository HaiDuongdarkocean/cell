# Todo: Subtitle Panels Atom Decomposition

> Spec: `docs/specs/subtitle-panels-atom-decomposition.md` | Plan: `tasks/plan.md`
> Mỗi task commit riêng. AC = acceptance criteria. Verify = lệnh kiểm tra.

---

## Phase 0: Baseline

### Task 0: Verify baseline pass
**Description**: Chạy typecheck + test + build trên codebase hiện tại để có baseline trước refactor.
**Acceptance criteria:**
- [ ] `npm run typecheck` pass (0 error)
- [ ] `npm run test:unit` pass (0 fail)
- [ ] `npm run build` pass (0 error)
- [ ] Ghi lại số dòng `SubtitlePanels.tsx` hiện tại (baseline = 1651)
**Verification:**
- [ ] `npm run typecheck && npm run test:unit && npm run build` exit 0
- [ ] `wc -l src/features/subtitle/ui/SubtitlePanels.tsx` = 1651
**Dependencies:** None
**Files likely touched:** None (read-only)
**Estimated scope:** XS

---

## Phase 1: Foundation (PARALLEL)

### Task 1: Tạo `subtitlePanelsTypes.ts` — SSOT types
**Description**: Dời `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps` từ `SubtitlePanels.tsx` + `AppearanceState` từ `SubtitleManagerPanel.tsx` sang file `src/features/subtitle/ui/subtitlePanelsTypes.ts`. `SubtitlePanels.tsx` + `SubtitleManagerPanel.tsx` re-export từ đây để backward-compatible. CHƯA sửa import bên `logic/` (Task 11 làm).
**Acceptance criteria:**
- [ ] `src/features/subtitle/ui/subtitlePanelsTypes.ts` tồn tại, chứa 5 type trên (pure type file, no JSX)
- [ ] `SubtitlePanels.tsx` import 4 type từ `subtitlePanelsTypes.ts` + re-export
- [ ] `SubtitleManagerPanel.tsx` import `AppearanceState` từ `subtitlePanelsTypes.ts` + re-export
- [ ] `npm run typecheck` pass (re-export giữ backward-compat)
- [ ] `npm run build` pass
**Verification:**
- [ ] `npm run typecheck` exit 0
- [ ] `npm run build` exit 0
- [ ] grep `subtitlePanelsTypes` trong `SubtitlePanels.tsx` + `SubtitleManagerPanel.tsx`
**Dependencies:** T0
**Files likely touched:**
- `src/features/subtitle/ui/subtitlePanelsTypes.ts` (mới)
- `src/features/subtitle/ui/SubtitlePanels.tsx`
- `src/features/subtitle/ui/SubtitleManagerPanel.tsx`
**Estimated scope:** S

### Task 2: Tạo `subtitlePanelsShared.module.css` — SSOT CSS
**Description**: Dời `.panelLayer`, `.offsetRow`, `.clusterRight` family (`.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded`) + glass token remap + mobile media query từ `SubtitlePanels.module.css` sang `src/features/subtitle/ui/subtitlePanelsShared.module.css`. `SubtitlePanels.module.css` import shared hoặc giữ class alias re-export (CSS Modules không support re-export → giữ class ở shared, `SubtitlePanels.module.css` xóa class đã dời, consumer import trực tiếp shared). CHƯA sửa consumer (Task 6/7/9 làm).
**Acceptance criteria:**
- [ ] `src/features/subtitle/ui/subtitlePanelsShared.module.css` tồn tại, chứa `.panelLayer`, `.offsetRow`, `.clusterRight`, `.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded` + glass token remap + mobile media query
- [ ] `SubtitlePanels.module.css` không còn class đã dời (xóa, không duplicate)
- [ ] Class definition byte-identical với cũ (diff token/value)
- [ ] `npm run build` pass (Vite accept CSS file mới)
**Verification:**
- [ ] `npm run build` exit 0
- [ ] diff class content giữa shared file và git HEAD `SubtitlePanels.module.css` → identical
- [ ] grep `.panelLayer` trong `SubtitlePanels.module.css` → 0 match
**Dependencies:** T0
**Files likely touched:**
- `src/features/subtitle/ui/subtitlePanelsShared.module.css` (mới)
- `src/features/subtitle/ui/SubtitlePanels.module.css`
**Estimated scope:** S

---

## Phase 2: Molecules (PARALLEL, sau Phase 1)

### Task 3: Tạo `ClusterRightToolbar.tsx` + test
**Description**: Tách toolbar phải (lines 1399-1501 `SubtitlePanels.tsx` + lines 461-508 `PlayerModeOverlay.tsx`) thành `src/features/subtitle/ui/ClusterRightToolbar.tsx`. Props: `mode: 'overlay' | 'player'`, `onQuickAdd`, `onEditCard`, `onUpdateCurrentCard`, `onToggleManager`, `onGenerateNative`, `onToggleSidePanel`, `onTogglePlayerMode`/`onExit`, `toolsExpanded`, `onToggleTools`, `generateNativeEnabled`, `splitViewOpen`/`playerMode` (cho label). CSS từ `subtitlePanelsShared.module.css`. Giữ tất cả `data-cell-id` (C5).
**Acceptance criteria:**
- [ ] `src/features/subtitle/ui/ClusterRightToolbar.tsx` tồn tại, named export `ClusterRightToolbar`
- [ ] `mode='overlay'`: render nút player-mode toggle (`data-cell-id="player-mode-btn"`)
- [ ] `mode='player'`: render nút Exit (`data-cell-id="player-mode-exit-btn"`) thay player-mode toggle
- [ ] Tất cả `data-cell-id` giữ nguyên: `quick-add-btn`, `edit-card-btn`, `subtitle-tools-extra`, `panel-toggle-btn`, `generate-native-btn`, `tools-toggle-btn`, `update-current-card-btn`, `manager-toggle-btn`, `nav-cluster-right` (overlay) / `player-mode-actions` (player)
- [ ] `ClusterRightToolbar.test.tsx` tồn tại: verify render cả 2 mode, conditional nút, callback wiring, failure path (undefined callbacks)
- [ ] `npm run typecheck && npm run test:unit` pass
**Verification:**
- [ ] `npm run typecheck` exit 0
- [ ] `npm run test:unit -- --testPathPattern="ClusterRightToolbar"` pass
- [ ] grep `data-cell-id` trong `ClusterRightToolbar.tsx` → đủ C5 selectors
**Dependencies:** T1, T2
**Files likely touched:**
- `src/features/subtitle/ui/ClusterRightToolbar.tsx` (mới)
- `src/features/subtitle/ui/ClusterRightToolbar.test.tsx` (mới)
**Estimated scope:** M

### Task 4: Tạo `ManagerLayer.tsx` + test
**Description**: Tách render `SubtitleManagerPanel` (lines 1503-1581 `SubtitlePanels.tsx` mobile Sheet + desktop panelLayer) thành `src/features/subtitle/ui/ManagerLayer.tsx`. Props: `manager: ManagerState`, `isMobile`, `exiting?`, `onClose`, `sheetHeightVh?`, `onSheetHeightChange?`, `portalTarget?` (in-overlay portal). Một render path duy nhất cho `SubtitleManagerPanel` (mobile/desktop branch bên trong). Persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` logic dời vào đây. Backdrop logic dời vào đây. CSS từ `subtitlePanelsShared.module.css` (`.panelLayer`).
**Acceptance criteria:**
- [ ] `src/features/subtitle/ui/ManagerLayer.tsx` tồn tại, named export `ManagerLayer`
- [ ] `SubtitleManagerPanel` render **1 lần** trong file (mobile/desktop branch, không duplicate props)
- [ ] Mobile: render trong `Sheet` + `data-cell-id="subtitle-manager-layer"`
- [ ] Desktop: render trong `.panelLayer` div + `data-cell-id="subtitle-manager-layer"`
- [ ] Persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` (getStorage/setStorage) ở đây
- [ ] `ManagerLayer.test.tsx` tồn tại: verify mobile/desktop branch, open/close, sheet height persist, callback wiring, failure path (undefined manager)
- [ ] `npm run typecheck && npm run test:unit` pass
**Verification:**
- [ ] `npm run typecheck` exit 0
- [ ] `npm run test:unit -- --testPathPattern="ManagerLayer"` pass
- [ ] grep `SubtitleManagerPanel` trong `ManagerLayer.tsx` → 1 match
**Dependencies:** T1, T2
**Files likely touched:**
- `src/features/subtitle/ui/ManagerLayer.tsx` (mới)
- `src/features/subtitle/ui/ManagerLayer.test.tsx` (mới)
**Estimated scope:** M

### Task 5: Tạo `OffsetLayer.tsx` + test
**Description**: Tách render `SubtitleOffsetPanel` target + native (lines 1583-1596 `SubtitlePanels.tsx`) thành `src/features/subtitle/ui/OffsetLayer.tsx`. Props: `offset: OffsetState`. CSS reuse `.offsetRow` từ `subtitlePanelsShared.module.css` (không file CSS riêng — D3). Giữ `data-cell-id="subtitle-offset-layer"`.
**Acceptance criteria:**
- [ ] `src/features/subtitle/ui/OffsetLayer.tsx` tồn tại, named export `OffsetLayer`
- [ ] Render 2 `SubtitleOffsetPanel` (target + native) trong `.offsetRow` div
- [ ] `data-cell-id="subtitle-offset-layer"` giữ nguyên
- [ ] Không tạo `OffsetLayer.module.css` (D3)
- [ ] `OffsetLayer.test.tsx` tồn tại: verify render target + native, callback wiring, failure path (undefined offset)
- [ ] `npm run typecheck && npm run test:unit` pass
**Verification:**
- [ ] `npm run typecheck` exit 0
- [ ] `npm run test:unit -- --testPathPattern="OffsetLayer"` pass
- [ ] grep `SubtitleOffsetPanel` trong `OffsetLayer.tsx` → 2 match
**Dependencies:** T1, T2
**Files likely touched:**
- `src/features/subtitle/ui/OffsetLayer.tsx` (mới)
- `src/features/subtitle/ui/OffsetLayer.test.tsx` (mới)
**Estimated scope:** S

---

## Phase 3: Consumers (PARALLEL, sau Phase 2)

### Task 6: `SubtitlePanels.tsx` compose molecule
**Description**: Thay inline toolbar (lines 1399-1501) bằng `<ClusterRightToolbar mode="overlay" ... />`. Thay inline manager render (lines 1503-1581) bằng `<ManagerLayer ... />`. Thay inline offset (lines 1583-1596) bằng `<OffsetLayer ... />`. Giữ state/effects nguyên (non-goal). Giữ `data-cell-id="subtitle-panels-root"` + root div + NavCluster + SubtitleBlock + toast + hint + split-view portal.
**Acceptance criteria:**
- [ ] `SubtitlePanels.tsx` ≤ 1350 dòng (giảm ≥ 18%)
- [ ] `<ClusterRightToolbar mode="overlay" ... />` thay inline toolbar
- [ ] `<ManagerLayer ... />` thay inline manager render (0 `SubtitleManagerPanel` inline)
- [ ] `<OffsetLayer ... />` thay inline offset (0 `SubtitleOffsetPanel` inline)
- [ ] `data-cell-id="subtitle-panels-root"` giữ nguyên
- [ ] State/effects (fullscreen, iframe bridge, split-view, player-mode, portal, toast) giữ nguyên — không đụng
- [ ] `npm run typecheck && npm run test:unit && npm run build` pass
**Verification:**
- [ ] `wc -l src/features/subtitle/ui/SubtitlePanels.tsx` ≤ 1350
- [ ] `npm run typecheck && npm run test:unit && npm run build` exit 0
- [ ] grep `SubtitleManagerPanel` trong `SubtitlePanels.tsx` → 0 match
- [ ] grep `SubtitleOffsetPanel` trong `SubtitlePanels.tsx` → 0 match
- [ ] grep `ClusterRightToolbar\|ManagerLayer\|OffsetLayer` trong `SubtitlePanels.tsx` → 3 match
**Dependencies:** T3, T4, T5
**Files likely touched:**
- `src/features/subtitle/ui/SubtitlePanels.tsx`
**Estimated scope:** M

### Task 7: `PlayerModeOverlay.tsx` share `ClusterRightToolbar`
**Description**: Thay inline toolbar (lines 461-508) bằng `<ClusterRightToolbar mode="player" ... />`. Import CSS từ `subtitlePanelsShared.module.css` thay `SubtitlePanels.module.css`. Giữ `data-cell-id="player-mode-actions"` wrapper. Callback: `onToggleSidePanel` → `setCueListOpen`, nút cuối = `onExit`.
**Acceptance criteria:**
- [ ] `<ClusterRightToolbar mode="player" ... />` thay inline toolbar
- [ ] `import panelStyles from './SubtitlePanels.module.css'` → `import sharedStyles from './subtitlePanelsShared.module.css'`
- [ ] `data-cell-id="player-mode-actions"` giữ nguyên
- [ ] `data-cell-id="player-mode-exit-btn"` giữ nguyên (nút Exit)
- [ ] Behavior Player Mode không đổi (toggle, Esc exit, layout)
- [ ] `npm run typecheck && npm run build` pass
**Verification:**
- [ ] `npm run typecheck && npm run build` exit 0
- [ ] grep `SubtitlePanels.module.css` trong `PlayerModeOverlay.tsx` → 0 match
- [ ] grep `subtitlePanelsShared.module.css` trong `PlayerModeOverlay.tsx` → 1 match
- [ ] grep `ClusterRightToolbar` trong `PlayerModeOverlay.tsx` → 1 match
**Dependencies:** T3
**Files likely touched:**
- `src/features/subtitle/ui/PlayerModeOverlay.tsx`
**Estimated scope:** S

### Task 8: `HostManagerSheet.tsx` thin adapter
**Description**: Refactor `HostManagerSheet.tsx` thành thin adapter — convert `SerializedManagerState + onAction` → `ManagerState` (dùng `buildAppearance` helper đã có) rồi truyền vào `<ManagerLayer mode="host-sheet" ... />` (hoặc ManagerLayer prop cho host-sheet: no portal, render backdrop + Sheet trực tiếp). Xóa duplicate persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` + backdrop (đã ở ManagerLayer). Giữ `HostManagerSheet.module.css` backdrop hoặc dời vào ManagerLayer.
**Acceptance criteria:**
- [ ] `HostManagerSheet.tsx` chỉ chứa: `buildAppearance` adapter + gọi `<ManagerLayer ... />`
- [ ] `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` persist KHÔNG còn ở `HostManagerSheet.tsx` (chỉ ở `ManagerLayer.tsx`)
- [ ] Backdrop logic ở `ManagerLayer` (hoặc `HostManagerSheet` delegate)
- [ ] `HostManagerSheet.test.tsx` pass (adapter wiring)
- [ ] `npm run typecheck && npm run test:unit` pass
**Verification:**
- [ ] `npm run typecheck && npm run test:unit -- --testPathPattern="HostManagerSheet"` pass
- [ ] grep `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` trong `HostManagerSheet.tsx` → 0 match
- [ ] grep `ManagerLayer` trong `HostManagerSheet.tsx` → 1 match
**Dependencies:** T4
**Files likely touched:**
- `src/features/subtitle/ui/HostManagerSheet.tsx`
- `src/features/subtitle/ui/HostManagerSheet.module.css` (có thể xóa backdrop)
**Estimated scope:** S

### Task 9: `OverlayPreview.module.css` dùng shared CSS
**Description**: Thay "copy pattern" (comment "Layout matches SubtitlePanels.module.css production patterns") bằng import `subtitlePanelsShared.module.css` hoặc dùng class chung. Xóa comment "matches ... patterns". Đảm bảo layout preview không đổi.
**Acceptance criteria:**
- [ ] `OverlayPreview.module.css` không có class duplicate token/value với `subtitlePanelsShared.module.css`
- [ ] Không còn comment "matches ... patterns"
- [ ] Layout preview byte-identical (diff computed style trước/sau)
- [ ] `npm run build` pass
**Verification:**
- [ ] `npm run build` exit 0
- [ ] grep "matches.*patterns" trong `OverlayPreview.module.css` → 0 match
- [ ] diff class definition → không duplicate
**Dependencies:** T2
**Files likely touched:**
- `src/features/subtitle/ui/appearance/OverlayPreview.module.css`
**Estimated scope:** XS

---

## Phase 4: Wiring (PARALLEL, sau Phase 3)

### Task 10: CSS manifest — `mountSubtitle.tsx` + `hostManagerSheetShadowCss.ts`
**Description**: Thêm `subtitlePanelsSharedCss` + molecule CSS mới (nếu có CSS riêng — theo D3 chỉ shared) vào 3 manifest array: `mountSubtitle.tsx` `css[]` + `managerShadowCss[]` + `hostManagerSheetShadowCss.ts` array. Import `subtitlePanelsShared.module.css?inline`.
**Acceptance criteria:**
- [ ] `mountSubtitle.tsx` `css[]` chứa `subtitlePanelsSharedCss`
- [ ] `mountSubtitle.tsx` `managerShadowCss[]` chứa `subtitlePanelsSharedCss`
- [ ] `hostManagerSheetShadowCss.ts` array chứa `subtitlePanelsSharedCss`
- [ ] `npm run build` pass (shadow DOM có CSS)
- [ ] `npx vite build --mode development` pass (dev seed)
**Verification:**
- [ ] `npm run build && npx vite build --mode development` exit 0
- [ ] grep `subtitlePanelsShared` trong 3 manifest → 3 match
**Dependencies:** T6, T7, T8, T9
**Files likely touched:**
- `src/features/subtitle/ui/mountSubtitle.tsx`
- `src/features/subtitle/ui/hostManagerSheetShadowCss.ts`
**Estimated scope:** S

### Task 11: `logic/` import types + `index.ts` export
**Description**: Sửa import trong `managerStateSerializer.ts`, `managerStateSerializer.test.ts`, `iframeManagerBridgeTypes.ts` từ `SubtitlePanels.tsx`/`SubtitleManagerPanel.tsx` → `subtitlePanelsTypes.ts`. Export molecule + types mới từ `src/features/subtitle/ui/index.ts`.
**Acceptance criteria:**
- [ ] `managerStateSerializer.ts` import type từ `subtitlePanelsTypes.ts`
- [ ] `managerStateSerializer.test.ts` import type từ `subtitlePanelsTypes.ts`
- [ ] `iframeManagerBridgeTypes.ts` import type từ `subtitlePanelsTypes.ts` (nếu cần)
- [ ] `index.ts` export `ClusterRightToolbar`, `ManagerLayer`, `OffsetLayer`, types từ `subtitlePanelsTypes.ts`
- [ ] `npm run typecheck && npm run test:unit` pass
**Verification:**
- [ ] `npm run typecheck && npm run test:unit` exit 0
- [ ] grep `from.*SubtitlePanels'` trong `logic/managerStateSerializer.ts` → 0 match
- [ ] grep `subtitlePanelsTypes` trong `logic/managerStateSerializer.ts` → 1+ match
- [ ] grep `ClusterRightToolbar\|ManagerLayer\|OffsetLayer` trong `index.ts` → 3 match
**Dependencies:** T1, T6
**Files likely touched:**
- `src/features/subtitle/logic/managerStateSerializer.ts`
- `src/features/subtitle/logic/managerStateSerializer.test.ts`
- `src/features/subtitle/logic/iframeManagerBridgeTypes.ts`
- `src/features/subtitle/ui/index.ts`
**Estimated scope:** S

### Task 12: Showcase pages import types
**Description**: Sửa import types trong `VideoPlayerPage.showcase.tsx` + `SubtitleOverlayPage.showcase.tsx` từ `SubtitlePanels.tsx` → `subtitlePanelsTypes.ts`. Giữ `<SubtitlePanels>` direct (D4).
**Acceptance criteria:**
- [ ] 2 showcase file import types từ `subtitlePanelsTypes.ts`
- [ ] `<SubtitlePanels>` vẫn render direct (không qua mountSubtitle)
- [ ] `npm run typecheck && npm run build` pass
**Verification:**
- [ ] `npm run typecheck && npm run build` exit 0
- [ ] grep `subtitlePanelsTypes` trong 2 showcase → 2 match
**Dependencies:** T1
**Files likely touched:**
- `src/entrypoints/design-system-showcase/pages/VideoPlayerPage.showcase.tsx`
- `src/entrypoints/design-system-showcase/pages/SubtitleOverlayPage.showcase.tsx`
**Estimated scope:** XS

---

## Checkpoint: Build + test + typecheck (sau Phase 4)

### Task 13: Full verify checkpoint
**Description**: Chạy full verify sau khi tất cả Phase 1-4 merge. Nếu fail → revert task gây fail + fix.
**Acceptance criteria:**
- [ ] `npm run typecheck` pass
- [ ] `npm run test:unit` pass (tất cả test hiện có + test mới)
- [ ] `npm run build` pass
- [ ] `npx vite build --mode development` pass
- [ ] `wc -l SubtitlePanels.tsx` ≤ 1350
- [ ] grep `data-cell-id` selectors C5 tất cả tồn tại
**Verification:**
- [ ] `npm run typecheck && npm run test:unit && npm run build && npx vite build --mode development` exit 0
**Dependencies:** T10, T11, T12
**Files likely touched:** None (verify-only, fix nếu cần)
**Estimated scope:** XS

---

## Phase 5: Docs (PARALLEL, sau checkpoint)

### Task 14: Update `docs/2-architechture-system.md`
**Description**: Cập nhật tree + dependency + CSS manifest + function index cho `subtitle/ui` phản ánh molecule mới (`ClusterRightToolbar`, `ManagerLayer`, `OffsetLayer`, `subtitlePanelsTypes.ts`, `subtitlePanelsShared.module.css`). Cập nhật entry T045/T046.
**Acceptance criteria:**
- [ ] Tree `subtitle/ui` liệt kê 5 file mới
- [ ] Dependency graph phản ánh molecule → consumer
- [ ] CSS manifest ghi `subtitlePanelsShared.module.css` + 3 manifest array
- [ ] Function index có entry molecule mới
**Verification:**
- [ ] grep `ClusterRightToolbar\|ManagerLayer\|OffsetLayer\|subtitlePanelsTypes\|subtitlePanelsShared` trong `docs/2-architechture-system.md` → 5 match
**Dependencies:** T13
**Files likely touched:**
- `docs/2-architechture-system.md`
**Estimated scope:** S

### Task 15: Tạo ADR + update `docs/0-wiki.md`
**Description**: Tạo `docs/adr/080-subtitle-panels-atom-decomposition.md` (số tiếp theo sau 079) ghi WHY tách (chỉ WHY, không HOW). Update `docs/0-wiki.md` mục lục nếu thêm spec/ADR.
**Acceptance criteria:**
- [ ] `docs/adr/080-subtitle-panels-atom-decomposition.md` tồn tại, ghi WHY (god component pain, duplicate HostManagerSheet, CSS coupling, type phân tầng)
- [ ] `docs/0-wiki.md` có entry cho spec + ADR mới
**Verification:**
- [ ] ls `docs/adr/080-*.md` tồn tại
- [ ] grep `subtitle-panels-atom-decomposition` trong `docs/0-wiki.md` → 1+ match
**Dependencies:** T13
**Files likely touched:**
- `docs/adr/080-subtitle-panels-atom-decomposition.md` (mới)
- `docs/0-wiki.md`
**Estimated scope:** S

---

## Phase 6: Browser verify (sau docs)

### Task 16: Browser verify 4 environment
**Description**: Dùng skill `browser-testing-with-devtools` verify trên 4 environment (text + video + anti-automation + mock iframe) theo checklist observable ở spec Testing Strategy. Nếu fail → revert + bug task.
**Acceptance criteria:**
- [ ] Text site: overlay render, toolbar, manager mở/đóng (desktop + mobile), offset
- [ ] Video site: overlay + player mode (toolbar share) + split view
- [ ] Anti-automation site: overlay render, manager, iframe bridge
- [ ] Mock iframe (`npm run mock:stream:iframe`): HostManagerSheet adapter, sheet height persist, backdrop, callbacks
- [ ] No console error, no visual regression
**Verification:**
- [ ] Manual check 4 environment pass checklist
- [ ] Screenshot/video evidence (nếu có)
**Dependencies:** T13, T14, T15
**Files likely touched:** None (verify-only)
**Estimated scope:** M

---

## Phase 7: Final commit

### Task 17: Final commit + PR
**Description**: Commit tất cả task (nếu chưa commit từng task) + tạo PR. Dùng skill `git-workflow-and-versioning`.
**Acceptance criteria:**
- [ ] Build + test + typecheck + browser verify pass
- [ ] Commit message theo convention repo
- [ ] PR body link spec + plan + ADR
**Verification:**
- [ ] `git status` clean
- [ ] PR created via `gh pr create`
**Dependencies:** T16
**Files likely touched:** None
**Estimated scope:** XS
