# Task List: Subtitle Navigation Control Cluster

> **Giai đoạn**: G4 Implementation (task breakdown chi tiết đầu G4)
> **Date**: 2026-07-02
> **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
> **Plan**: `docs/plan/plan-subtitle-navigation-control.md` (M1-M6 milestones)
> **ADR**: `docs/adr/018-subtitle-navigation-control-cluster.md`
> **Design system**: `docs/reviews/design-system-inventory-2026-07-02-nav-cluster.md`
> **Frontend**: `docs/design-system/nav-cluster-frontend-design.md`
> **Methodology**: `incremental-implementation` (vertical slices, test-commit cycle) + `test-driven-development` (RED → GREEN → REFACTOR)

## Slicing strategy

**Vertical slices per file** (M2 pure helpers first, then atom, then controller, then wire, then UI). M1 (settings schema) = foundation slice. Each slice = 1 file + 1 test file, TDD, commit per slice.

## Task List

### M1: Foundation — Settings Schema v2

#### Task 1: Add NavClusterSettings types + DEFAULT_NAV_CLUSTER_SETTINGS
**Description**: Add `NavClusterPosition` + `NavClusterSettings` interfaces to `src/entities/settings/types.ts`. Add 6 flat `navCluster*` fields to `Settings`. Add `DEFAULT_NAV_CLUSTER_SETTINGS` + merge into `DEFAULT_SETTINGS` in `src/shared/config/config.ts`.

**Acceptance criteria**:
- [ ] `NavClusterPosition` interface `{ x: number; y: number }` exported
- [ ] `NavClusterSettings` interface exported with 6 fields (enabled, position, buttonSize, bgOpacity, buttonOpacity, collapsed)
- [ ] `Settings` interface has 6 new `navCluster*` flat fields
- [ ] `DEFAULT_NAV_CLUSTER_SETTINGS` constant in config.ts
- [ ] `DEFAULT_SETTINGS` includes nav cluster defaults

**Verification**:
- [ ] RED: test `DEFAULT_SETTINGS.navClusterEnabled === true` fails (field doesn't exist)
- [ ] GREEN: add types + defaults → test passes
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=settings` pass

**Dependencies**: None
**Files likely touched**:
- `src/entities/settings/types.ts`
- `src/shared/config/config.ts`
- `tests/unit/entities/settings/types.test.ts` (new or existing)

**Estimated scope**: S (2 files + 1 test)

---

#### Task 2: Bump CURRENT_SCHEMA_VERSION=2 + migration v1→v2
**Description**: In `src/shared/lib/storage/settingsStore.ts`, bump `CURRENT_SCHEMA_VERSION = 2`, add migration v1→v2 that merges `DEFAULT_NAV_CLUSTER_SETTINGS`. Add boundary validation (clamp position 0-100, opacity 0-1, buttonSize snap to {40,48,56}, boolean coerce).

**Acceptance criteria**:
- [ ] `CURRENT_SCHEMA_VERSION = 2`
- [ ] Migration v1→v2 merges `DEFAULT_NAV_CLUSTER_SETTINGS` + stamps `schemaVersion: 2`
- [ ] Invalid `navClusterPosition.x = 150` → clamp to 100
- [ ] Invalid `navClusterBgOpacity = 1.5` → clamp to 1
- [ ] Invalid `navClusterButtonSize = 33` → snap to 40 (nearest preset)
- [ ] Existing v1 settings (no nav fields) → merge defaults, no data loss

**Verification**:
- [ ] RED: test migration v1→v2 fails (CURRENT_SCHEMA_VERSION still 1)
- [ ] GREEN: bump + migration → test passes
- [ ] RED: test invalid clamp fails → GREEN: add validation → passes
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=settingsStore` pass

**Dependencies**: Task 1
**Files likely touched**:
- `src/shared/lib/storage/settingsStore.ts`
- `tests/unit/shared/lib/storage/settingsStore.test.ts` (existing or new)

**Estimated scope**: S (1 file + 1 test)

---

#### Task 3: Add nav-cluster tokens to theme.css + themeTokens.ts mirror
**Description**: Add 10 nav-cluster tokens to `src/entrypoints/popup/styles/theme.css` (`:root` + `[data-theme="dark"]`) + `src/shared/lib/themeTokens.ts` (`LIGHT_TOKENS` + `DARK_TOKENS`). Add sync test asserting mirror matches.

**Acceptance criteria**:
- [ ] 10 tokens in `theme.css` `:root`: `--nav-cluster-size-sm/md/lg`, `--nav-cluster-bg/btn-opacity-default`, `--nav-cluster-collapse-size`, `--nav-cluster-edge-threshold`, `--nav-cluster-z-index`, `--nav-cluster-repeat-hold-ms`, `--nav-cluster-no-sub-window-ms`
- [ ] Same 10 tokens in `themeTokens.ts` `LIGHT_TOKENS` (dark inherits same values — no dark override needed for non-color tokens)
- [ ] Sync test: parse both files, assert token names + values match

**Verification**:
- [ ] RED: sync test fails (tokens not added to mirror)
- [ ] GREEN: add to both → test passes
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=themeTokens` pass

**Dependencies**: None (parallel with Task 1-2)
**Files likely touched**:
- `src/entrypoints/popup/styles/theme.css`
- `src/shared/lib/themeTokens.ts`
- `tests/unit/shared/lib/themeTokens.test.ts` (new)

**Estimated scope**: S (2 files + 1 test)

---

### Checkpoint M1: Foundation
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit` pass (no regressions)
- [ ] `npm run lint` clean
- [ ] Commit M1

---

### M2: NavClusterController + pure helpers

#### Task 4: navClusterDom.ts — pure DOM helpers
**Description**: New file `src/features/subtitle/ui/navClusterDom.ts` with pure helpers: `buildClusterDOM()` (returns `{ cluster, dragHandle, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn }`), `clampPosition(pos, containerRect, clusterRect)`, `findNearestEdge(pos, containerRect)`.

**Acceptance criteria**:
- [ ] `buildClusterDOM()` returns 7 elements with correct `data-testid` + `aria-label` + `role="toolbar"`
- [ ] `clampPosition({x:150,y:200}, ...)` → clamped to valid range
- [ ] `findNearestEdge({x:5,y:50}, ...)` → 'left'
- [ ] `findNearestEdge({x:95,y:50}, ...)` → 'right'
- [ ] All pure functions, no side effects

**Verification**:
- [ ] RED: test `buildClusterDOM` fails (file doesn't exist)
- [ ] GREEN: implement → test passes
- [ ] RED: test `clampPosition` + `findNearestEdge` → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navClusterDom` pass

**Dependencies**: None (parallel with Task 5)
**Files likely touched**:
- `src/features/subtitle/ui/navClusterDom.ts` (new)
- `tests/unit/features/subtitle/ui/navClusterDom.test.ts` (new)

**Estimated scope**: S (1 file + 1 test)

---

#### Task 5: navClusterActions.ts — pure action helpers
**Description**: New file `src/features/subtitle/ui/navClusterActions.ts` with pure helpers: `prevSentence(video, cues, nativeCues)`, `nextSentence(video, cues, nativeCues)`, `seekBy(video, seconds)`, `findActiveCueIndex(cues, nativeCues, currentTimeMs)`. Uses `findCurrentLine` from `subtitleSync.ts`.

**Acceptance criteria**:
- [ ] `prevSentence` seeks to `cues[index-1].start/1000` when index > 0
- [ ] `prevSentence` no-op when index === 0 (first cue)
- [ ] `prevSentence` fallback to nearest previous cue when index === -1 (in gap)
- [ ] `nextSentence` seeks to `cues[index+1].start/1000` when index < length-1
- [ ] `seekBy(video, -5)` clamps to 0
- [ ] `seekBy(video, 10)` clamps to duration when finite
- [ ] Cue source: target cues primary, native fallback when target empty

**Verification**:
- [ ] RED: test `prevSentence` + `nextSentence` fail
- [ ] GREEN: implement with `findCurrentLine` → pass
- [ ] RED: test `seekBy` clamp → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navClusterActions` pass

**Dependencies**: None (parallel with Task 4)
**Files likely touched**:
- `src/features/subtitle/ui/navClusterActions.ts` (new)
- `tests/unit/features/subtitle/ui/navClusterActions.test.ts` (new)

**Estimated scope**: S (1 file + 1 test)

---

#### Task 6: navClusterButton.ts — atom (DOM factory)
**Description**: New file `src/features/subtitle/ui/navClusterButton.ts` with `createNavClusterButton(props)` returning `HTMLButtonElement`. Handles click + hold (pointerdown/up) + ARIA + data-testid.

**Acceptance criteria**:
- [ ] Returns `<button>` with `data-testid`, `aria-label`, `class="nav-cluster-btn"`
- [ ] `onClick` fires on click
- [ ] `onHoldStart` fires after pointerdown (no timer — controller manages hold threshold)
- [ ] `onHoldEnd` fires on pointerup/pointercancel
- [ ] `pressed` prop sets `aria-pressed`
- [ ] Touch target via CSS token `--nav-cluster-size-md` (default)

**Verification**:
- [ ] RED: test `createNavClusterButton` fails
- [ ] GREEN: implement → pass
- [ ] RED: test hold handlers → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navClusterButton` pass

**Dependencies**: Task 3 (tokens)
**Files likely touched**:
- `src/features/subtitle/ui/navClusterButton.ts` (new)
- `tests/unit/features/subtitle/ui/navClusterButton.test.ts` (new)

**Estimated scope**: S (1 file + 1 test)

---

#### Task 7: navClusterKeyboard.ts — pure keyboard state machine
**Description**: New file `src/features/subtitle/ui/navClusterKeyboard.ts` with `handleClusterKeydown(e, state)` + `handleClusterKeyup(e, state)` returning updated state + action. State machine for R hold. Guard `isEditableTarget`.

**Acceptance criteria**:
- [ ] `ArrowLeft` → action `prev-sentence`
- [ ] `ArrowRight` → action `next-sentence`
- [ ] `r`/`R` keydown (not `e.repeat`) → action `repeat-start` + state `repeatHolding: true`
- [ ] `r`/`R` keyup when `repeatHolding` → action `repeat-stop` + state `repeatHolding: false`
- [ ] `<`/`,` → action `seek-rewind-5`
- [ ] `>`/`.` → action `seek-forward-10`
- [ ] Editable target → no action
- [ ] `e.repeat === true` → no action (ignore auto-repeat)

**Verification**:
- [ ] RED: test keydown mapping fails
- [ ] GREEN: implement → pass
- [ ] RED: test R hold state machine → GREEN
- [ ] RED: test editable guard + e.repeat → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navClusterKeyboard` pass

**Dependencies**: None (parallel with Task 4-6)
**Files likely touched**:
- `src/features/subtitle/ui/navClusterKeyboard.ts` (new)
- `tests/unit/features/subtitle/ui/navClusterKeyboard.test.ts` (new)

**Estimated scope**: S (1 file + 1 test)

---

#### Task 8: navClusterController.ts — controller class
**Description**: New file `src/features/subtitle/ui/navClusterController.ts` with `NavClusterController` class. Wires DOM (Task 4) + actions (Task 5) + buttons (Task 6) + keyboard (Task 7) + drag (Pointer Events) + repeat hold state machine + persist debounced + fullscreen re-parent + destroy.

**Acceptance criteria**:
- [ ] `init()` builds DOM, wires all listeners, renders 4-nút no-sub state
- [ ] `updateCues(target, native)` transitions 4↔6 nút via CSS class toggle
- [ ] `updateSettings(partial)` applies realtime (size, opacity, position, visibility)
- [ ] `setVisible(false)` hides + moves focus to body if focus was on cluster
- [ ] `destroy()` removes DOM + all listeners (no leaks)
- [ ] Drag: pointerdown → setPointerCapture → pointermove transform clamp → pointerup persist debounced 300ms
- [ ] Double-click ⋯ → reset to {x:0, y:75}
- [ ] Drag to edge ≤20px → collapse (CSS half-circle + mirror class)
- [ ] Repeat hold: pointerdown/keydown-R → 500ms timer → loop via timeupdate → pointerup/keyup/blur/visibilitychange stop
- [ ] Fullscreen: `fullscreenchange` → re-parent cluster
- [ ] Controller ≤200 lines (split if exceeded)

**Verification**:
- [ ] RED: test `init` builds DOM with correct testids fails
- [ ] GREEN: implement → pass
- [ ] RED: test `updateCues` 4↔6 transition → GREEN
- [ ] RED: test drag clamp + collapse → GREEN
- [ ] RED: test repeat hold state machine → GREEN
- [ ] RED: test `destroy` cleanup → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navClusterController` pass

**Dependencies**: Task 4, 5, 6, 7, 3
**Files likely touched**:
- `src/features/subtitle/ui/navClusterController.ts` (new)
- `tests/unit/features/subtitle/ui/navClusterController.test.ts` (new)

**Estimated scope**: M (1 file + 1 test, but complex)

---

### Checkpoint M2: Controller + helpers
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=navCluster` pass
- [ ] `npm run lint` clean
- [ ] Commit M2

---

### M3: Wire into contentScriptController

#### Task 9: Wire NavClusterController into contentScriptController.ts
**Description**: Import `NavClusterController`, instantiate after `loadOverlayStyles().then()`, call `updateCues` on subtitle load, `updateSettings` on `onStorageChanged`, `destroy` in cleanup.

**Acceptance criteria**:
- [ ] `NavClusterController` instantiated with video, container, settings, cueSource
- [ ] `updateCues(controller.cues, controller.nativeCues)` called on subtitle load
- [ ] `onStorageChanged` → `navCluster.updateSettings(newSettings)`
- [ ] Cleanup function calls `navCluster.destroy()`
- [ ] Existing tests still pass (no regression)

**Verification**:
- [ ] RED: test cluster init in contentScriptController fails
- [ ] GREEN: wire → pass
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=contentScriptController` pass

**Dependencies**: Task 8, Task 1-2 (settings)
**Files likely touched**:
- `src/features/subtitle/ui/contentScriptController.ts`
- `tests/unit/features/subtitle/ui/contentScriptController.test.ts` (existing)

**Estimated scope**: S (1 file + 1 test update)

---

### Checkpoint M3: Integration
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit` pass (no regressions)
- [ ] Commit M3

---

### M5: Settings UI (parallel with M4 kbd — already in Task 7-8)

#### Task 10: NavClusterSettingsPanel.tsx + Navigation tab in SettingsDialog
**Description**: New file `src/features/settings/ui/NavClusterSettingsPanel.tsx` with size slider, bg opacity slider, btn opacity slider, off toggle + confirm dialog. Add "Navigation" tab to `SettingsDialog.tsx`.

**Acceptance criteria**:
- [ ] `NavClusterSettingsPanel` renders 3 sliders + off toggle
- [ ] Slider change → `onChange(partial)` → `saveSettings` debounced
- [ ] Off toggle → confirm dialog → Yes = `onChange({ enabled: false })`
- [ ] "Navigation" tab in `SettingsDialog` renders panel
- [ ] `data-testid` per spec A9

**Verification**:
- [ ] RED: test panel render fails
- [ ] GREEN: implement → pass
- [ ] RED: test slider → onChange → GREEN
- [ ] RED: test off toggle → confirm dialog → GREEN
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit -- --testPathPatterns=SettingsDialog` pass
- [ ] `npm run lint` clean

**Dependencies**: Task 1-2 (settings types)
**Files likely touched**:
- `src/features/settings/ui/NavClusterSettingsPanel.tsx` (new)
- `src/features/settings/ui/NavClusterSettingsPanel.module.css` (new)
- `src/features/settings/ui/SettingsDialog.tsx` (add tab)
- `tests/unit/features/settings/ui/NavClusterSettingsPanel.test.tsx` (new)

**Estimated scope**: M (3 files + 1 test)

---

### Checkpoint M5: Settings UI
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run test:unit` pass
- [ ] `npm run lint` clean
- [ ] Commit M5

---

### M6: Browser verify

#### Task 11: Browser verify A1-A15 + update architecture map
**Description**: Install unpacked extension, navigate lordflix/kisskh video page, run A1-A15 acceptance criteria via Edge MCP. Update `docs/2-architechture-system.md` (3 chỗ: tree, dependency table, function index) + `docs/0-wiki.md`.

**Acceptance criteria**:
- [ ] A1-A15 verified per spec §Acceptance table
- [ ] Browser test report saved `docs/test-reports/2026-07-02-nav-cluster-mcp.md`
- [ ] `docs/2-architechture-system.md` updated (navClusterController.ts + 5 helper files in tree, dependency table, function index)
- [ ] `docs/0-wiki.md` updated

**Verification**:
- [ ] Edge MCP `Runtime.evaluate` + DOM click for A1-A15
- [ ] Fallback: local HTML fixture + Playwright if site unavailable
- [ ] All A1-A15 pass

**Dependencies**: Task 9, Task 10
**Files likely touched**:
- `docs/test-reports/2026-07-02-nav-cluster-mcp.md` (new)
- `docs/2-architechture-system.md` (update)
- `docs/0-wiki.md` (update)

**Estimated scope**: M (verification + docs)

---

## Parallelization

- **Task 1, 2, 3** (M1): Task 1 → Task 2 sequential (types before migration). Task 3 parallel.
- **Task 4, 5, 7** (M2 pure helpers): all parallel (independent files).
- **Task 6** (atom): after Task 3 (tokens).
- **Task 8** (controller): after Task 4, 5, 6, 7 (depends on all helpers).
- **Task 9** (wire): after Task 8.
- **Task 10** (settings UI): after Task 1-2, parallel with Task 8-9.
- **Task 11** (browser): after Task 9, 10.

## Risks (reiterate from plan)

| Risk | Mitigation |
|---|---|
| Cue source divergence (cluster vs existing kbd) | A5 + A10 verify consistent; ceiling v2 migrate |
| Host page captures `<` `>` | Defer audit G4, fallback J/L ready |
| `setPointerCapture` in fullscreen | A12 browser verify |
| Schema migration edge cases | Task 2 boundary validation tests |
| Cluster overlap subtitle overlay drag | NF2 pointer-events auto only on cluster, A14 verify |
