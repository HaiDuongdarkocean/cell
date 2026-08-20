# Spec: Subtitle Panels Atom Decomposition (SSOT)

> **Reviewed by 2 subagents** (BA/PO + Tech Lead). Blockers + majors addressed in sections marked `[REVIEW FIX]`.

> **Mục tiêu**: Tách `SubtitlePanels.tsx` (1651 dòng, god component) thành atom/molecule theo design system, sao cho mỗi phần (toolbar phải, manager layer, offset layer, types) có một nguồn duy nhất — sửa一处 không cần nhớ sửa chỗ kia. Đồng thời gộp `HostManagerSheet` (biến thể iframe-child) vào molecule chung để xóa duplicate logic persist sheet height + backdrop.

## Objective

**Vấn đề hiện tại** (xác định bằng grep + read code):

1. **God component**: `src/features/subtitle/ui/SubtitlePanels.tsx` 1651 dòng chứa inline ~100 dòng toolbar phải (ClusterRight), ~75 dòng render `SubtitleManagerPanel` **2 lần** (mobile Sheet + desktop panelLayer với props gần như identical), ~15 dòng render `SubtitleOffsetPanel` 2 lần (target + native), và ~1100 dòng state/effects (fullscreen, iframe bridge, split-view, player-mode, portal setup, toast).
2. **Duplicate manager rendering**: `HostManagerSheet.tsx` (iframe-child path) render `SubtitleManagerPanel` trong `Sheet` + backdrop riêng — **bản sao logic** của nhánh mobile Sheet trong `SubtitlePanels` (lines 1505-1544): cùng `Sheet`, cùng persist `STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH`, cùng `SubtitleManagerPanel` props. Sửa一处 phải nhớ sửa chỗ kia → vi phạm SSOT.
3. **Type phân tầng sai**: `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps` định nghĩa trong `SubtitlePanels.tsx` (UI file) nhưng dùng ở `src/features/subtitle/logic/managerStateSerializer.ts`, `iframeManagerBridgeTypes.ts`, `iframeManagerBridgeChild.test.ts` → `logic/` phụ thuộc type từ UI file.
4. **CSS SSOT bị copy pattern** `[REVIEW FIX]`: `OverlayPreview.module.css` comment "Layout matches SubtitlePanels.module.css production patterns" — copy pattern, không import → drift risk. `PlayerModeOverlay.tsx` (line 22, 461-508) import `SubtitlePanels.module.css` để dùng `.clusterRight`, `.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded` (toolbar family, **KHÔNG phải `.panelLayer`**) → cross-component CSS coupling. Toolbar Player Mode gần identical overlay thường nhưng khác: nút side panel gọi `setCueListOpen` thay vì `handleToggleSplitView`, nút cuối = Exit (`onExit`) thay vì player-mode toggle.
5. **Showcase bypass mountSubtitle**: `VideoPlayerPage.showcase.tsx`, `SubtitleOverlayPage.showcase.tsx` render `<SubtitlePanels>` trực tiếp, bypass `mountSubtitle` → props contract có thể lệch production.

**User story (primary):**
> **As** a maintainer của Cell subtitle overlay, **I want** toolbar phải, manager layer, offset layer và shared types mỗi thứ là một module riêng, **so that** khi thêm/đổi nút toolbar tôi sửa 1 file (`ClusterRightToolbar.tsx`) thay vì 3 file (`SubtitlePanels.tsx` + `PlayerModeOverlay.tsx` + `OverlayPreview.module.css`), và `logic/` files không phải import type từ UI file. Metric: số file cần sửa khi thay toolbar giảm 3 → 1; `logic/` import type từ `subtitlePanelsTypes.ts` thay vì `SubtitlePanels.tsx`.

**Substories:**
- **Manager**: As maintainer, I want `ManagerLayer` là SSOT render `SubtitleManagerPanel` (mobile Sheet + desktop panelLayer + host-sheet iframe-child), so that persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` + backdrop logic chỉ ở 1 chỗ (hiện duplicate giữa `SubtitlePanels` lines 1505-1544 và `HostManagerSheet.tsx`).
- **Offset**: As maintainer, I want `OffsetLayer` render target + native `SubtitleOffsetPanel`, so that cấu trúc lặp không viết inline.
- **Types**: As maintainer, I want `ManagerState`/`OffsetState`/`SubtitlePanelsRef`/`SubtitlePanelsProps`/`AppearanceState` ở file type riêng, so that `logic/managerStateSerializer.ts` + `iframeManagerBridgeTypes.ts` không phụ thuộc type từ UI file chứa JSX.

**Business value / Why now** `[REVIEW FIX]`:
- **Tech-debt enablement**: `HostManagerSheet` duplicate `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` persist + backdrop + `SubtitleManagerPanel` props với nhánh mobile Sheet trong `SubtitlePanels` — sửa一处 quên chỗ kia gây lệch UI (sheet height không sync, backdrop style khác). `PlayerModeOverlay` copy toolbar `SubtitlePanels` (`.clusterRight` family) — đổi nút overlay thường quên Player Mode gây UI không đồng bộ.
- **End-user benefit (gián tiếp)**: Language learner 10-25 tuổi dùng overlay trên nhiều site — UI đồng bộ giữa overlay thường + Player Mode + host-sheet iframe-child → trải nghiệm nhất quán, ít bug visual khi mở manager trên mobile iframe (AnimeKai/megaplay/vidnest).
- **Baseline**: Hiện tại thay 1 nút toolbar → sửa 3 file; sau refactor → 1 file. `logic/` import 4 types từ UI file → sau refactor → 0.

**Non-goal (KHÔNG làm trong spec này)**:
- Không tách state/effects (fullscreen, iframe bridge, split-view, player-mode) thành hooks riêng — 1100 dòng effect đã chạy ổn, tách hook có thể引入 regression, không thu được SSOT rõ ràng (ponytail: no abstraction unrequested).
- Không đổi behavior overlay/manager/offset/player-mode — refactor thuần, behavior-identical.
- Không thêm feature mới.
- Không đổi `mountSubtitle` API (imperative ref contract giữ nguyên cho `contentScriptController`).

## Assumptions

1. **Behavior-identical refactor**: Mọi thay đổi phải giữ nguyên behavior runtime — vị trí overlay, animation, z-index, shadow DOM portal, fullscreen reparenting, iframe bridge, split-view, player-mode. Verify bằng test hiện có + browser test trên 3 site + mock iframe.

## Constraints `[REVIEW FIX]`

- **C1 (build)**: MV3 + Vite 8 + @crxjs/vite-plugin, React 19, TS strict, Jest 30, CSS Modules shadow DOM. Không thêm dependency.
- **C2 (style)**: Named export, no `any`, no default export, no hardcoded. Icon từ `ICON_CATALOG`, CSS token từ `tokens.css`.
- **C3 (storage)**: `STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH` giữ nguyên key (backward-compatible).
- **C4 (API)**: `mountSubtitle` imperative ref contract giữ nguyên cho `contentScriptController`.
- **C5 (DOM)**: Tất cả `data-cell-id`/test selectors giữ nguyên (`subtitle-panels-root`, `subtitle-manager-layer`, `subtitle-offset-layer`, `quick-add-btn`, `edit-card-btn`, `subtitle-tools-extra`, `panel-toggle-btn`, `generate-native-btn`, `tools-toggle-btn`, `update-current-card-btn`, `manager-toggle-btn`, `player-mode-btn`, `player-mode-exit-btn`, `subtitle-hint-layer`, `nav-cluster-right`, `player-mode-actions`).

## Decisions `[REVIEW FIX]`

> Resolve 5 open questions từ review. Owner: Tech Lead (em).

- **D1 — `ManagerLayer` mode design**: `ManagerLayer` nhận `ManagerState` (normalized). `HostManagerSheet.tsx` giữ làm **thin adapter** — convert `SerializedManagerState + onAction` → `ManagerState` (dùng `buildAppearance` helper đã có) rồi truyền vào `ManagerLayer`. ManagerLayer SSOT cho render (mobile Sheet + desktop panelLayer + backdrop), HostManagerSheet SSOT cho serialization adapter. Không gộp 2 thành 1 component (tránh prop union phức tạp).
- **D2 — CSS ownership**: Tạo `subtitlePanelsShared.module.css` chứa `.panelLayer`, `.offsetRow`, `.clusterRight` family (`.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded`). `ManagerLayer`, `OffsetLayer`, `ClusterRightToolbar`, `PlayerModeOverlay` import từ đó. Không circular import (shared file không import molecule).
- **D3 — `OffsetLayer` CSS**: Không tạo `OffsetLayer.module.css` riêng — reuse `.offsetRow` từ `subtitlePanelsShared.module.css` (ponytail: ít file nhất).
- **D4 — Showcase**: Giữ `<SubtitlePanels>` trực tiếp (showcase cần inspect ngoài shadow DOM). Showcase import types từ `subtitlePanelsTypes.ts`. Ghi chú: showcase `managerShadowCss` khác production — không test shadow CSS qua showcase.
- **D5 — `PlayerModeOverlay` share `ClusterRightToolbar`**: Share với `mode: 'overlay' | 'player'` prop + flexible callbacks (`onToggleSidePanel`, `onTogglePlayerMode`/`onExit`). Toolbar Player Mode gần identical overlay thường (verified lines 461-508), chỉ khác 2 nút → share đáng. `ClusterRightToolbar` CSS từ `subtitlePanelsShared.module.css`.
- **D6 — `AppearanceState`**: Dời luôn vào `subtitlePanelsTypes.ts` (TL phát hiện `managerStateSerializer.ts` vẫn import `AppearanceState` từ `SubtitleManagerPanel.tsx`). `SubtitleManagerPanel.tsx` re-export từ `subtitlePanelsTypes.ts` để backward-compatible.

## Tech Stack

- React 19 + TypeScript (strict, `no-explicit-any` enforced by ESLint)
- CSS Modules (scoped, shadow DOM compatible, camelCase class names)
- Shared UI atoms: `@/shared/ui` (Sheet, IconButton, Button, Tabs, Input, Select)
- Icons: `@/shared/icons` (`ICON_CATALOG`, `Icon`)
- Shadow DOM: `mountReactShadow`, `injectShadowCss`, `ShadowThemeProvider`, `attachFullscreenReparenting`
- Storage: `chrome.storage.local` via `getStorage`/`setStorage` (`@/shared/lib/chrome-apis`)
- Build: Vite 8 + `@crxjs/vite-plugin` (MV3)
- Test: Jest 30 (`test:unit` project) + Testing Library React 16 + Playwright (`test:e2e`)

## Commands

```bash
# Build (chạy prebuild: generate-tokens.js + check-icons.js)
npm run build
npx vite build --mode development   # auto-seed dist/seed/ (dev mode)

# Type check
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Unit test
npm run test:unit
npm run test:unit -- --testPathPattern="subtitle"

# E2E (browser)
npm run test:e2e
npm run test:e2e:headed

# Dev (vite serve — isDevMode=true, auto-seed)
npm run dev

# Mock pages (test local)
npm run mock:stream
npm run mock:stream:iframe
npm run mock:youtube
```

## Project Structure

**File mới tạo:**
```
src/features/subtitle/ui/
├── subtitlePanelsTypes.ts            # SSOT types: ManagerState, OffsetState, SubtitlePanelsRef, SubtitlePanelsProps, AppearanceState
├── subtitlePanelsShared.module.css   # SSOT CSS: .panelLayer, .offsetRow, .clusterRight family (.primaryCol, .secondaryCol, .toggleWrap, .extraCol, .expanded)
├── ClusterRightToolbar.tsx           # Molecule: toolbar phải (overlay + player mode via mode prop)
├── ManagerLayer.tsx                  # Molecule: render SubtitleManagerPanel (mobile Sheet OR desktop panelLayer) — SSOT, gộp HostManagerSheet render logic
└── OffsetLayer.tsx                   # Molecule: render SubtitleOffsetPanel target + native (no separate CSS — reuse subtitlePanelsShared.module.css)
```

**File sửa:**
```
src/features/subtitle/ui/SubtitlePanels.tsx              # God component → compose molecule, import types từ subtitlePanelsTypes.ts
src/features/subtitle/ui/SubtitlePanels.module.css       # Dời .clusterRight/.panelLayer/.offsetRow sang subtitlePanelsShared.module.css
src/features/subtitle/ui/HostManagerSheet.tsx            # Thin adapter: convert SerializedManagerState → ManagerState, gọi ManagerLayer
src/features/subtitle/ui/HostManagerSheet.module.css     # Dời backdrop vào ManagerLayer hoặc xóa
src/features/subtitle/ui/PlayerModeOverlay.tsx           # Share ClusterRightToolbar (mode='player'), import CSS từ subtitlePanelsShared.module.css
src/features/subtitle/ui/appearance/OverlayPreview.module.css  # Dùng subtitlePanelsShared.module.css thay vì copy pattern
src/features/subtitle/ui/index.ts                        # Export molecule + types mới
src/features/subtitle/ui/mountSubtitle.tsx               # Import types từ subtitlePanelsTypes.ts + thêm molecule CSS vào css[] và managerShadowCss[]
src/features/subtitle/ui/hostManagerSheetShadowCss.ts    # Thêm subtitlePanelsSharedCss + molecule CSS vào manifest
src/features/subtitle/ui/SubtitleManagerPanel.tsx        # Re-export AppearanceState từ subtitlePanelsTypes.ts
src/features/subtitle/logic/managerStateSerializer.ts    # Import types từ subtitlePanelsTypes.ts
src/features/subtitle/logic/managerStateSerializer.test.ts
src/features/subtitle/logic/iframeManagerBridgeTypes.ts  # Import types từ subtitlePanelsTypes.ts (nếu cần)
src/entrypoints/design-system-showcase/pages/VideoPlayerPage.showcase.tsx      # Import types từ subtitlePanelsTypes.ts
src/entrypoints/design-system-showcase/pages/SubtitleOverlayPage.showcase.tsx  # Import types từ subtitlePanelsTypes.ts
```

**File docs cập nhật (post-code, theo AGENTS.md):**
```
docs/2-architechture-system.md   # Tree + dependency + function index cho subtitle/ui
docs/0-wiki.md                   # Mục lục (nếu thêm spec/ADR mới)
docs/adr/NNN-subtitle-panels-atom-decomposition.md  # WHY: lý do tách (chỉ WHY, không HOW)
```

## Code Style

Theo `AGENTS.md`:
- Function component + hooks, **DON'T** class component (trừ `PlayerModeErrorBoundary` đã có — giữ).
- Named export, **DON'T** default export.
- **MUST NOT** use `any` (ESLint `no-explicit-any`).
- **MUST NOT** hardcoded.
- SSOT: single-source-of-truth.
- Code tự giải thích thay vì comment, chỉ comment khi business phức tạp.
- Algorithm complexity lý tưởng O(1) → O(log n); cấm O(n log n) → O(n²).
- Icon: import từ `ICON_CATALOG`, không inline SVG.
- CSS: dùng token từ `tokens.css` (generated từ `tokens.json`), component pattern từ `src/shared/ui/`.

**Ví dụ molecule (ManagerLayer — pseudo, không phải code cuối):**
```tsx
// ManagerLayer.tsx — SSOT cho render SubtitleManagerPanel
import { SubtitleManagerPanel, type AppearanceState } from './SubtitleManagerPanel';
import { Sheet } from '@/shared/ui/Sheet';
import type { ManagerState } from './subtitlePanelsTypes';
import styles from './ManagerLayer.module.css';

export interface ManagerLayerProps {
  manager: ManagerState;
  isMobile: boolean;
  exiting?: boolean;
  onClose: () => void;
  /** Persisted sheet height (% viewport, 20-95). null = not yet loaded. */
  sheetHeightVh?: number | null;
  onSheetHeightChange?: (vh: number) => void;
  /** Host-sheet mode (iframe-child): render backdrop + Sheet, no portal. */
  mode?: 'in-overlay' | 'host-sheet';
}

export function ManagerLayer({ manager, isMobile, exiting, onClose, sheetHeightVh, onSheetHeightChange, mode = 'in-overlay' }: ManagerLayerProps): React.JSX.Element {
  // ... một render path duy nhất cho SubtitleManagerPanel, mobile vs desktop branch bên trong
}
```

## Testing Strategy

- **Unit test (Jest + Testing Library)**: Mỗi molecule mới có file `.test.tsx` — verify render props, branch mobile/desktop, callback wiring, **failure path** (undefined callbacks, closed state, host-sheet mode). Types file không cần test (compile-time).
- **Test hiện có phải pass**: `mountSubtitle.test.tsx`, `SubtitleManagerPanel.test.tsx`, `SubtitleOffsetPanel.test.tsx`, `HostManagerSheet.test.tsx`, `managerStateSerializer.test.ts`, `SubtitleBlock.test.tsx`, `NavCluster.test.tsx`, `SubtitleToast.test.tsx`, `SubtitleHint.test.tsx` — tất cả pass sau refactor.
- **Type check**: `npm run typecheck` pass (verify types dời không break import).
- **Build**: `npm run build` pass (verify Vite/rollup không break CSS import path + shadow CSS manifest đầy đủ).
- **DOM selector preservation** `[REVIEW FIX]`: Test verify tất cả `data-cell-id` ở C5 vẫn tồn tại sau refactor (grep + DOM query trong test).
- **Browser test (skill `browser-testing-with-devtools`)** `[REVIEW FIX]`:
  1. **Text**: `https://www.geeksforgeeks.org/machine-learning/machine-learning-algorithms/` — overlay render, toolbar phải (quick-add/edit/tools/manager/player-mode), manager mở/đóng (desktop + mobile), offset.
  2. **Video**: `https://themoviebox.xyz/movies/oh-boy-was-i-wrong-about-her-KZp0CGxDxI2?id=2281575019673174328&type=/movie/detail&detailSe=&detailEp=&lang=en` — overlay + player mode (toolbar share) + split view.
  3. **Anti-automation (stealth MCP)**: `https://streamduck.site/` — overlay render, manager, iframe bridge (nếu applicable).
  4. **Mock iframe** `[REVIEW FIX]`: `npm run mock:stream:iframe` — verify `HostManagerSheet` adapter (iframe-child manager sheet) render đúng, sheet height persist, backdrop, callbacks wire qua `onAction`.
- **Browser checklist (observable per site)** `[REVIEW FIX]`:
  - Overlay render đúng vị trí (yOffsetPercent), drag reposition hoạt động.
  - Toolbar phải: tất cả nút hiển thị đúng conditional (`onQuickAdd`/`onEditCard`/...), click trigger callback, icon đúng.
  - Manager: mở → render `SubtitleManagerPanel` (desktop panelLayer + mobile Sheet), chọn track → callback, đóng → animation exit, sheet height persist reload.
  - Offset: mở → render 2 `SubtitleOffsetPanel`, change → callback.
  - Player Mode: toggle → overlay chuyển layout, toolbar share (Exit button thay player-mode toggle), Esc exit.
  - No console error, no visual regression (z-index, backdrop, animation).

## Boundaries

**Always do:**
- Chạy `npm run typecheck && npm run test:unit && npm run build` sau mỗi task sửa code.
- Giữ behavior-identical — không đổi vị trí overlay, animation, z-index, shadow DOM portal.
- Named export, no `any`, no default export, no hardcoded.
- Import icon từ `ICON_CATALOG`, CSS token từ `tokens.css`.
- Cập nhật `docs/2-architechture-system.md` sau khi đổi/sửa/xóa file `src/`.
- Cập nhật `docs/0-wiki.md` nếu thêm spec/ADR.
- Verify browser trên 4 environment (text + video + anti-automation + mock iframe) trước khi commit.

**Ask first:**
- Đổi `mountSubtitle` API (imperative ref contract) — giữ nguyên trừ khi anh yêu xác nhận.
- Thêm dependency mới.
- Đổi `manifest.json`.
- Tách state/effects thành hooks (out of scope theo spec, nhưng nếu phát hiện cần thì hỏi).
- Đổi `STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH` key (giữ nguyên để backward-compatible).

**Never do:**
- Đổi behavior runtime (vị trí, animation, z-index, portal strategy).
- Commit secret/key.
- Sửa `tokens.css`/`tokens.ts` trực tiếp (generated files — sửa `tokens.json`).
- Inline SVG trong component (import từ `ICON_CATALOG`).
- Default export.
- Dùng `any`.
- Skip verification (build + test + browser).

**Rollback plan** `[REVIEW FIX]`:
- Nếu `npm run typecheck`/`test:unit`/`build` fail → fix trong cùng task, không merge.
- Nếu browser verify fail trên bất kỳ environment → **revert commit** (`git revert`), tạo bug task trong `tasks/`, không merge. Không "fix-forward" trong cùng PR.
- Mỗi task commit riêng → revert từng task độc lập nếu cần.

## Success Criteria

1. **`SubtitlePanels.tsx` giảm ≥ 18%** `[REVIEW FIX]` — từ 1651 → ≤ 1350 dòng (dời ~300 dòng: toolbar ~100, manager render ~75, offset ~14, types/props ~140, error boundary giữ). Non-goal giữ state/effects (~1100 dòng) → không thể < 800. Metric: `wc -l SubtitlePanels.tsx` ≤ 1350.
2. **`ClusterRightToolbar.tsx` tồn tại** — toolbar phải là component riêng, `SubtitlePanels` (mode='overlay') + `PlayerModeOverlay` (mode='player') import từ đó. Metric: grep `ClusterRightToolbar` trong 2 file.
3. **`ManagerLayer.tsx` tồn tại** — render `SubtitleManagerPanel` **một render path** (mobile/desktop branch bên trong), `HostManagerSheet` là thin adapter gọi `ManagerLayer`. Metric: `SubtitleManagerPanel` xuất hiện 1 lần trong `ManagerLayer.tsx`, 0 lần inline trong `SubtitlePanels.tsx`.
4. **`OffsetLayer.tsx` tồn tại** — render `SubtitleOffsetPanel` target + native. Metric: grep `OffsetLayer` trong `SubtitlePanels.tsx`.
5. **`subtitlePanelsTypes.ts` tồn tại** — `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps`, `AppearanceState` dời sang đây; `logic/` files import từ đây, không từ `SubtitlePanels.tsx`/`SubtitleManagerPanel.tsx`. Metric: grep import path trong `managerStateSerializer.ts` + `iframeManagerBridgeTypes.ts`.
6. **`HostManagerSheet` duplicate bị xóa** — persist `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` + backdrop logic chỉ ở `ManagerLayer`. Metric: grep `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` → 1 file (`ManagerLayer.tsx`), 0 trong `HostManagerSheet.tsx`.
7. **`subtitlePanelsShared.module.css` tồn tại** — `.panelLayer`, `.offsetRow`, `.clusterRight` family SSOT. `PlayerModeOverlay` import từ đó, không từ `SubtitlePanels.module.css`. Metric: grep import path.
8. **`OverlayPreview.module.css` không copy pattern** `[REVIEW FIX]` — định nghĩa: không có class duplicate token/value với `subtitlePanelsShared.module.css`/`SubtitlePanels.module.css`. Metric: diff class definition, không có comment "matches ... patterns".
9. **`npm run typecheck` pass** — không break import type.
10. **`npm run test:unit` pass** — tất cả test hiện có pass + test mới cho molecule pass (covering branch chính + failure path).
11. **`npm run build` pass** — Vite/rollup không break CSS import path.
12. **Shadow CSS manifest đầy đủ** `[REVIEW FIX]` — `mountSubtitle.tsx` (`css[]` + `managerShadowCss[]`) + `hostManagerSheetShadowCss.ts` đều chứa `subtitlePanelsSharedCss` + molecule CSS mới. Metric: grep 3 manifest array.
13. **DOM selector preservation** `[REVIEW FIX]` — tất cả `data-cell-id` ở C5 vẫn tồn tại sau refactor. Metric: grep + DOM query trong test.
14. **Browser verify pass** `[REVIEW FIX]` — 4 environment (text + video + anti-automation + mock iframe) pass checklist observable ở Testing Strategy. No console error, no visual regression.
15. **`docs/2-architechture-system.md` cập nhật** — tree + dependency + CSS manifest + function index cho `subtitle/ui` phản ánh molecule mới.
16. **ADR tạo** — `docs/adr/NNN-subtitle-panels-atom-decomposition.md` ghi WHY tách (chỉ WHY).
17. **No new dependency** — `package.json` không thêm package.
18. **Negative AC** `[REVIEW FIX]` — Nếu bất kỳ criterion 9-14 fail → không merge, revert + bug task (xem Rollback plan).

## Open Questions

Tất cả đã resolve trong **Decisions** section (D1-D6). Không còn open question trước implement.
