# Implementation Plan: Subtitle Navigation Control Cluster

> **Giai đoạn**: G2 Implementation Plan (output `planning-and-task-breakdown` high-level)
> **Status**: Draft — chờ anh review
> **Date**: 2026-07-02
> **Spec source**: `docs/specs/spec-subtitle-navigation-control.md` (mọi mục cite spec §)
> **Review source**: `docs/reviews/review-subtitle-navigation-control.md` (APPROVED post-patch, 1 LOW non-blocking)
> **Intent source**: `docs/intent/intent-subtitle-navigation-control.md`
> **Lưu ý**: File này là plan HIGH-LEVEL (approach, risk, milestones). Task list chi tiết chạy ở G4 đầu (sau Spec G1 + Plan G2 + ADR G3).

## Overview

Build a **floating 6-button control cluster** (⋯/◀/🔁/▶ main + ⏪/⏩ secondary) injected into `video.parentElement`, giving mouse + touch users subtitle sentence navigation, hold-to-loop repeat, and 5s/10s seek — without keyboard, without obscuring the bilingual subtitle overlay. Cluster is drag-to-move (Pointer Events + `setPointerCapture`, reuse ADR-015 pattern), collapse-to-edge on drag-to-edge, position persisted to `chrome.storage.local` via `settingsStore` (schema v1→v2 migration). No-subtitle adaptive: 4-nút 1-cột, ◀▶ time mode, 🔁 hold-loops last-3s window. Keyboard parallel shortcuts (ArrowLeft/Right/R hold/`<`/`>`) fixed, NOT added to existing `keyboardShortcuts` array. Cue source = target cues primary via `findCurrentLine`, native fallback — divergence from existing kbd shortcuts (which use `bilingualCues` linear search).

## Open Questions Resolved (G2 decisions)

| OQ (spec §374-380) | Decision | Rationale |
|---|---|---|
| Host page kbd conflict (`<` `>` captured by lordflix/kisskh?) | **Defer audit to G4** (implementation-time, requires loading real page). Fallback J/L ready. | Cannot audit without real page load; G4 browser verify covers it. |
| No-sub repeat window length (hardcode 3s vs setting?) | **Hardcode 3s v1**. Setting `noSubtitleLoopSeconds` ceiling v2. | Ponytail rung 1 (YAGNI) — 3s is sensible default, avoid settings bloat v1. |
| Half-circle visual (SVG vs CSS?) | **CSS `border-radius: 50% 0 0 50%` (or mirror)**. No SVG asset. | Ponytail rung 4 (native platform) — CSS border-radius + transform scaleX(-1) for mirror, no asset pipeline. |
| Settings panel placement (new "Navigation" tab vs gộp "Subtitle" tab?) | **New "Navigation" tab** in SettingsDialog. | Cluster is distinct feature from subtitle styling; gộp muddies both. Tab count +1 acceptable. |
| Cluster initial render timing (init vs đợi subtitle load?) | **Render at `contentScriptController.init`**, not wait for subtitle. | User can seek 5s/10s before subtitle load; no-sub adaptive handles 4-nút state. |
| Settings naming (`enabled` vs `navClusterEnabled`?) — LOW review risk | **Flat `navCluster*` keys** at `Settings` top-level. | Consistent with existing flat keys (`subtitleOverlayAutoLoad`, `autoSelectEnabled`). No nested object. |

## Architecture Decisions (build-vs-buy có cơ sở — cite spec)

### AD1: Cluster file = `src/features/subtitle/ui/navClusterController.ts` (new file)
- **Decision**: New file `navClusterController.ts` exports `createNavCluster(video, container, settings, cuesAccessor)` → returns `{ updateCues, updateSettings, setVisible, destroy }`. Sibling to `subtitlePanel.ts`, `subtitleShortcuts.ts`.
- **Rationale** (spec §Project Structure, FSD target): Cluster is a feature-domain UI controller, belongs in `features/subtitle/ui/`. Sibling pattern matches existing `subtitlePanel.ts` (toggle button + seek helper), `subtitleShortcuts.ts` (kbd handler). Not a separate feature — shares subtitle cue source.
- **Build-vs-buy**: Ponytail rung 2 (reuse codebase pattern) + rung 4 (native DOM). No lib.
- **Alternatives rejected**:
  - New feature `features/nav-cluster/` — over-scoped, cluster depends on subtitle cues, belongs with subtitle.
  - Inline in `contentScriptController.ts` — controller already 670+ lines, cluster adds ~300 lines → too big.

### AD2: Settings schema v1→v2 — flat `navCluster*` keys
- **Decision**: Add flat keys to `Settings` interface: `navClusterEnabled: boolean`, `navClusterPosition: { x: number; y: number }` (percent 0-100), `navClusterButtonSize: 40 | 48 | 56`, `navClusterBgOpacity: number` (0-1), `navClusterButtonOpacity: number` (0-1), `navClusterCollapsed: boolean`. Bump `CURRENT_SCHEMA_VERSION = 2`. Migration v1→v2: `{ ...DEFAULT_SETTINGS, ...s, schemaVersion: 2 }` (merge `DEFAULT_NAV_CLUSTER_SETTINGS`).
- **Rationale** (spec §Settings Schema, review Risk #1 LOW): Existing `Settings` uses flat keys (`subtitleOverlayAutoLoad`, `autoSelectEnabled`, `keyboardShortcuts`). Flat is consistent. Nested `navCluster: NavClusterSettings` would diverge + complicate migration.
- **Build-vs-buy**: N/A — reuse `settingsStore.ts` migration pattern (v0→v1 template).
- **Alternatives rejected**:
  - Nested `navCluster: NavClusterSettings` — diverges from flat convention, complicates `loadSettings` merge.
  - Separate storage key `navClusterSettings` — fragments storage, loses atomic migration.

### AD3: Cue source = target cues primary via `findCurrentLine`, native fallback
- **Decision**: Cluster prev/next/repeat uses `findCurrentLine(controller.cues, video.currentTime * 1000)` → index ± 1. If `controller.cues` empty, fallback `findCurrentLine(controller.nativeCues, ...)`. NOT `bilingualCues` (panel display merge).
- **Rationale** (spec §Cue Source Decision, review Risk #9): `findCurrentLine` is binary search O(log n), already in `subtitleSync.ts`. `bilingualCues` is panel display merge (target skeleton + native best-effort overlap) — not clean timing source. Existing kbd shortcuts use `bilingualCues` linear search (lines 219-235 of `contentScriptController.ts`) — cluster diverges for accurate timing.
- **Build-vs-buy**: Ponytail rung 2 (reuse `findCurrentLine`).
- **Alternatives rejected**:
  - Reuse `bilingualCues` linear search — inaccurate timing (merged cues), conflicts with spec Cue Source Decision.
  - Merge target+native then `findCurrentLine` — merged cues are panel display, not timing.

### AD4: Keyboard state machine — fixed parallel shortcuts, NOT in `ShortcutAction` union
- **Decision**: Cluster kbd shortcuts (ArrowLeft/ArrowRight/R hold/`<`/`>`) are **fixed parallel**, handled in a separate `keydown`/`keyup` listener in `navClusterController.ts`. NOT added to `keyboardShortcuts` settings array, NOT added to `ShortcutAction` union. R hold uses keydown/keyup state machine (ignore `e.repeat`, cancel on `blur`/`visibilitychange`).
- **Rationale** (spec §Keyboard State Machine, review Risk #8): Existing `ShortcutAction` union (`prev-cue`/`next-cue`/`replay-cue`/`toggle-overlay`/`toggle-panel`) is for configurable panel shortcuts. Cluster shortcuts are gesture-equivalent for touch users, fixed for discoverability. Expanding union = config UI bloat v1.
- **Build-vs-buy**: N/A — native KeyboardEvent.
- **Alternatives rejected**:
  - Expand `ShortcutAction` + `keyboardShortcuts` — config UI bloat, conflicts with spec "fixed parallel" decision.
  - Reuse existing `handleShortcutKey` — single keydown → action, no hold state machine.

### AD5: Drag — native Pointer Events + `setPointerCapture` (reuse ADR-015)
- **Decision**: Drag handle ⋯ uses `pointerdown` → `setPointerCapture(e.pointerId)` → `pointermove` (transform cluster, clamp to video bounds) → `pointerup` (drop, persist debounced 300ms). Double-click ⋯ → reset to {x:0%, y:75%}. Drag to within 20px edge → collapse to half-circle.
- **Rationale** (spec §F2-F4, ADR-015): ADR-015 already established Pointer Events + `setPointerCapture` pattern for subtitle overlay drag. Cluster reuses same pattern.
- **Build-vs-buy**: Ponytail rung 4 (native Pointer Events).
- **Alternatives rejected**:
  - Mouse Events + Touch Events separately — 2 code paths, ADR-015 already chose Pointer Events.
  - Library (interact.js, draggable) — overkill, native suffices.

### AD6: Collapse visual — CSS `border-radius` half-circle, mirror via `transform: scaleX(-1)`
- **Decision**: Collapsed cluster = 32px half-circle, `border-radius: 50% 0 0 50%` (left-stuck) or `0 50% 50% 0` (right-stuck). Mirror via CSS class `mirror-left`/`mirror-right`. No SVG asset.
- **Rationale** (spec §F4, OQ resolved): Ponytail rung 4 (native CSS). SVG asset adds asset pipeline + bundle size for a 32px shape.
- **Build-vs-buy**: N/A.
- **Alternatives rejected**:
  - SVG half-circle — asset pipeline, bundle size, no benefit at 32px.
  - Image asset — same + raster scaling.

### AD7: Settings UI — new "Navigation" tab in SettingsDialog
- **Decision**: Add "Navigation" tab to `SettingsDialog.tsx` with: size slider (small/medium/large → 40/48/56), bg opacity slider, button opacity slider, off toggle + confirm dialog. Persist realtime via `saveSettings` (reuse ADR-013 D3 `onStorageChanged` pattern in `contentScriptController`).
- **Rationale** (spec §F10-F11, OQ resolved): Cluster is distinct from subtitle styling. New tab keeps concerns separate. Tab count +1 acceptable (current tabs: General, Subtitle, Downloads, About → +Navigation).
- **Build-vs-buy**: N/A — reuse existing `SettingsDialog` tab pattern.
- **Alternatives rejected**:
  - Gộp vào "Subtitle" tab — muddies subtitle styling + cluster config.
  - Separate dialog — extra click, fragments settings.

### AD8: Cluster initial render at `contentScriptController.init`, not wait for subtitle
- **Decision**: `createNavCluster` called inside `init()` after `loadOverlayStyles().then()` block (or parallel). Renders 4-nút no-sub state immediately. `updateCues(cues, nativeCues)` called when subtitle loads → expands to 6-nút.
- **Rationale** (spec §F9, OQ resolved): User can seek 5s/10s before subtitle load. No-sub adaptive handles 4-nút → 6-nút transition via CSS class toggle (no DOM recreate).
- **Build-vs-buy**: N/A.
- **Alternatives rejected**:
  - Wait for subtitle load — blocks seek 5s/10s before subtitle, bad UX.

### AD9: No-sub repeat window — hardcode 3s v1
- **Decision**: No-sub repeat hold loops `[holdStartTime - 3s, holdStartTime]` (clamp to 0). Hardcoded constant `NO_SUB_REPEAT_WINDOW_MS = 3000`. Setting `noSubtitleLoopSeconds` ceiling v2.
- **Rationale** (spec §F9, OQ resolved): Ponytail rung 1 (YAGNI). 3s is sensible default for sentence-length shadowing.
- **Build-vs-buy**: N/A.
- **Alternatives rejected**:
  - Setting `noSubtitleLoopSeconds` v1 — settings bloat, no user research yet on ideal default.

### AD10: Persistence — `chrome.storage.local` via `saveSettings` debounced 300ms
- **Decision**: Position + settings persist via `saveSettings` debounced 300ms (reuse ADR-013 `yOffset` persist pattern). `onStorageChanged` in `contentScriptController` → `navCluster.updateSettings(newSettings)`.
- **Rationale** (spec §F2, NF4): ADR-013 D3 established debounced persist + `onStorageChanged` realtime update pattern.
- **Build-vs-buy**: Ponytail rung 2 (reuse `settingsStore` + ADR-013 pattern).
- **Alternatives rejected**:
  - Separate storage key — fragments storage, loses atomic migration.
  - Persist on every pointermove — storage write storm.

## Approach per Requirement (cite spec §)

| Spec Req | Approach | Cite |
|---|---|---|
| 6-nút 2 cột layout | `navClusterController.createNavCluster`: build DOM div tree (main column ⋯/◀/🔁/▶ + secondary column ⏪/⏩), CSS grid/flex, `data-testid` per button. | §F1, A1 |
| Drag handle move | ⋯ `pointerdown` → `setPointerCapture` → `pointermove` transform clamp → `pointerup` persist debounced. | §F2, A2 |
| Double-click reset | ⋯ `dblclick` → position = {x:0%, y:75%}, persist. | §F3, A3 |
| Drag-to-edge collapse | `pointermove` check distance to nearest edge ≤20px → collapse (CSS half-circle, mirror class). Tap → expand at pre-collapse pos. | §F4, A4 |
| Prev/Next sentence | `findCurrentLine(cues, t*1000)` → index ±1, seek `cues[idx].start/1000`. Fallback 5s/10s khi gap >5s. | §F5-F6, A5 |
| Repeat hold-to-loop | 🔁 `pointerdown` start timer 500ms → loop cue start→end (timeupdate check). `pointerup`/`pointercancel` → stop. | §F7, A6 |
| Seek 5s/10s | ⏪ `click` → `video.currentTime -= 5`. ⏩ `click` → `+= 10`. Clamp [0, duration]. | §F8, A7 |
| No-sub adaptive | `updateCues(cues, nativeCues)`: both empty → CSS class `no-sub` (⏪⏩ hidden, ◀▶ time mode, 🔁 3s window). Load → remove class. | §F9, A8 |
| Settings panel | New "Navigation" tab in `SettingsDialog.tsx`: size slider, bg opacity, btn opacity, off toggle + confirm dialog. | §F10-F11, A9 |
| Keyboard parallel | Separate `keydown`/`keyup` listener in `navClusterController`: ArrowLeft/Right/R hold/`<`/`>`. Guard `isEditableTarget`. R hold state machine. | §F12, A10 |
| Dark/light mode | CSS vars `--nav-cluster-bg`, `--nav-cluster-btn` per theme. `prefers-color-scheme` + settings theme. | §F13, A11 |
| Fullscreen re-parent | `fullscreenchange` listener → re-parent cluster into `document.fullscreenElement` (reuse ADR-013 pattern). | §F14, A12 |
| Secondary column mirror | Cluster at right edge → secondary column class `mirror-left`. Left edge → `mirror-right` (default). | §F15, A13 |
| Subtitle overlay coexist | Cluster `z-index: 1000001`, `pointer-events: auto` only on cluster. Subtitle overlay drag (ADR-015) works in non-overlap region. | §NF2, A14 |
| ARIA | Cluster `role="toolbar"` + `aria-label="Subtitle navigation"`, each button `aria-label` + `aria-pressed` for repeat. | §NF8 |
| Schema migration v1→v2 | `settingsStore.ts`: bump `CURRENT_SCHEMA_VERSION = 2`, add migration v1→v2 merge `DEFAULT_NAV_CLUSTER_SETTINGS`. | §NF9, Rollback § |

## Milestones (high-level — task chi tiết ở G4)

### M1: Settings schema v2 + types + defaults
- `src/entities/settings/types.ts`: add 6 flat `navCluster*` fields to `Settings`.
- `src/shared/config/config.ts`: add `DEFAULT_NAV_CLUSTER_SETTINGS` + merge into `DEFAULT_SETTINGS`.
- `src/shared/lib/storage/settingsStore.ts`: bump `CURRENT_SCHEMA_VERSION = 2`, add migration v1→v2.
- Unit test: migration v1→v2 (existing settings + new fields merge).

### Checkpoint M1: typecheck + migration test pass
- `npx tsc --noEmit` exit 0.
- `npm run test:unit -- --testPathPatterns=settingsStore` pass (migration test).

### M2: `navClusterController.ts` — DOM + drag + collapse + actions
- New file `src/features/subtitle/ui/navClusterController.ts`.
- `createNavCluster(video, container, settings, cuesAccessor)`: build DOM, wire drag (Pointer Events), double-click reset, drag-to-edge collapse, button click handlers (prev/next/repeat/seek), ARIA.
- Pure helpers: `clampPosition`, `findNearestEdge`, `buildClusterDOM`.
- Unit tests: DOM structure, drag clamp, collapse threshold, button click → action.

### Checkpoint M2: cluster unit tests pass
- `npm run test:unit -- --testPathPatterns=navCluster` pass.
- `npx tsc --noEmit` exit 0.

### M3: Wire into `contentScriptController.ts`
- Import `createNavCluster`, call after `loadOverlayStyles().then()` (or parallel).
- `updateCues(cues, nativeCues)` on subtitle load.
- `onStorageChanged` → `navCluster.updateSettings(newSettings)`.
- Fullscreen re-parent listener.
- Unit test: init wires cluster, updateCues transitions 4→6 nút.

### Checkpoint M3: integration unit tests pass
- `npm run test:unit -- --testPathPatterns=contentScriptController` pass.
- `npx tsc --noEmit` exit 0.

### M4: Keyboard state machine — parallel shortcuts
- In `navClusterController.ts`: `keydown`/`keyup` listener for ArrowLeft/Right/R/`<`/`>`.
- R hold state machine (ignore `e.repeat`, cancel on `blur`/`visibilitychange`).
- Guard `isEditableTarget` (reuse from `subtitleShortcuts.ts`).
- Unit tests: keydown → action, R hold state, editable guard, e.repeat ignore.

### Checkpoint M4: kbd unit tests pass
- `npm run test:unit -- --testPathPatterns=navCluster.*keyboard` pass.

### M5: Settings UI — "Navigation" tab in `SettingsDialog.tsx`
- New tab "Navigation" with size slider, bg opacity slider, btn opacity slider, off toggle + confirm dialog.
- Persist realtime via `saveSettings` (debounced if needed).
- Unit test: tab renders, slider → saveSettings, off toggle → confirm dialog.

### Checkpoint M5: settings UI unit tests pass
- `npm run test:unit -- --testPathPatterns=SettingsDialog` pass.
- `npx tsc --noEmit` exit 0.
- `npm run lint` clean.

### M6: Browser verify (Edge DevTools MCP)
- Install unpacked extension → navigate lordflix/kisskh video page.
- Run A1-A15 acceptance criteria (spec §Acceptance table).
- Fallback: local HTML fixture + Playwright if site unavailable.
- Save browser test report `docs/test-reports/`.

### Checkpoint M6: all acceptance criteria pass
- A1-A15 verified.
- Browser test report saved.
- Update `docs/2-architechture-system.md` (3 chỗ: tree, dependency table, function index) + `docs/0-wiki.md`.

## Risks and Mitigations

| Risk | Severity | Impact | Mitigation |
|---|---|---|---|
| Cue source divergence (cluster uses `findCurrentLine` + target cues, existing kbd uses `bilingualCues` linear) | HIGH | Prev/next behavior differs between cluster click + kbd shortcut for same action | AD3: documented divergence, spec §Cue Source Decision. G4 verify A5 + A10 give consistent results. Ceiling v2: migrate existing kbd to `findCurrentLine` too. |
| Host page captures `<` `>` (lordflix/kisskh) | MEDIUM | Seek 5s/10s kbd shortcut broken on some sites | AD4: defer audit to G4, fallback J/L ready. A10 verify on real page. |
| `setPointerCapture` on div in fullscreen | MEDIUM | Drag đứt trong fullscreen | AD5: ADR-015 đã verify cho overlay. A12 browser verify fullscreen drag. |
| Settings schema v1→v2 migration fails on edge cases (corrupted storage, partial save) | MEDIUM | User loses nav settings | AD2 + spec §Rollback: atomic migration, no-retry, clamp invalid, forward-compat. M1 migration test covers. |
| Cluster overlap với subtitle overlay drag (ADR-015) | MEDIUM | Subtitle drag blocked ở vùng cluster che | NF2: cluster `pointer-events: auto` chỉ trên cluster. A14 verify non-overlap drag. |
| Half-circle CSS mirror sai hướng ở corner (top-left vs bottom-left) | LOW | Collapse visual sai hướng 1 corner | AD6: `findNearestEdge` returns {edge, mirror class}. A4 verify 4 edges + 4 corners. |
| Cluster z-index conflict với host video controls | LOW | Cluster che host controls hoặc ngược lại | NF2: z-index 1000001 (above host). A1 verify cluster visible, A14 verify host controls still clickable. |

## Open Questions

Không còn open question — 6 OQ spec đã resolved ở G2 (xem bảng trên). Host kbd conflict audit defer G4 (implementation-time).

## Parallelization

- **M1 → M2 → M3**: sequential (M2 depends on M1 types, M3 depends on M2 controller).
- **M4 (kbd) parallel với M5 (settings UI)**: sau M3, M4 + M5 independent (cùng touch `navClusterController` / `SettingsDialog` khác file) → có thể parallel 2 subagent.
- **M6 (browser verify)**: sau M1-M5, sequential (cần tất cả feature done).

## Related

- **Spec**: `docs/specs/spec-subtitle-navigation-control.md`
- **Review**: `docs/reviews/review-subtitle-navigation-control.md` (APPROVED)
- **Intent**: `docs/intent/intent-subtitle-navigation-control.md`
- **Builds on**: ADR-013 (overlay layer + persist pattern), ADR-015 (Pointer Events drag), `subtitleSync.ts` (`findCurrentLine`), `subtitleShortcuts.ts` (`isEditableTarget`), `subtitlePanel.ts` (`seekToCue`), `settingsStore.ts` (schema migration pattern).
- **Does NOT break**: existing kbd shortcuts (a/d/s/w/t), subtitle overlay drag (ADR-015), bilingual subtitle auto-load (ADR-007), subtitle manager panel (ADR-015 T11).
- **Next phase**: G3 Design/ADR — `api-and-interface-design` (cluster controller contract) + `design-system-ui-ux` (cluster visual tokens + atoms) + `frontend-ui-engineering` (build HOW).
