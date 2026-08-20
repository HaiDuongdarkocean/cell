# ADR: Subtitle Panels Atom Decomposition

**Date:** 2026-08-20
**Status:** Accepted
**Spec:** `docs/specs/subtitle-panels-atom-decomposition.md`

## Context

`SubtitlePanels.tsx` is a 1651-line god component. It inlines ~100 lines of the right-hand toolbar (ClusterRight), ~75 lines that render `SubtitleManagerPanel` **twice** (mobile Sheet + desktop panelLayer with near-identical props), ~14 lines that render `SubtitleOffsetPanel` twice (target + native), and ~1100 lines of state/effects (fullscreen, iframe bridge, split-view, player-mode, portal setup, toast). Changing one toolbar button today means editing three files (`SubtitlePanels.tsx` + `PlayerModeOverlay.tsx` + `OverlayPreview.module.css`); changing manager sheet height persist logic means editing two files (`SubtitlePanels` lines 1505-1544 + `HostManagerSheet.tsx`).

Four concrete pain points drove this decision:

1. **God component** — `SubtitlePanels.tsx` mixes toolbar JSX, manager render JSX, offset render JSX, type definitions, and 1100 lines of effects in one file. The toolbar and render branches are not independently testable or reusable.

2. **Duplicate manager rendering** — `HostManagerSheet.tsx` (the iframe-child path) renders `SubtitleManagerPanel` inside a `Sheet` with its own backdrop and its own `STORAGE_KEYS.SUBTITLE_MANAGER_SHEET_HEIGHT_VH` persist. This is a near-copy of the mobile Sheet branch inside `SubtitlePanels` (lines 1505-1544): same `Sheet`, same persist key, same `SubtitleManagerPanel` props. Fixing one and forgetting the other causes sheet-height drift and mismatched backdrop styling.

3. **Layered architecture violation** — `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps`, and `AppearanceState` are defined in `SubtitlePanels.tsx` / `SubtitleManagerPanel.tsx` (UI files containing JSX), but consumed by `src/features/subtitle/logic/managerStateSerializer.ts`, `iframeManagerBridgeTypes.ts`, and `iframeManagerBridgeChild.test.ts`. The `logic/` layer imports types from the `ui/` layer — the dependency direction is inverted.

4. **CSS pattern copy, not SSOT** — `OverlayPreview.module.css` carries a comment "Layout matches SubtitlePanels.module.css production patterns" — it duplicates token values instead of importing. `PlayerModeOverlay.tsx` imports `SubtitlePanels.module.css` to use the `.clusterRight` family (`.primaryCol`, `.secondaryCol`, `.toggleWrap`, `.extraCol`, `.expanded`) — a cross-component CSS coupling. The toolbar in Player Mode is near-identical to the normal overlay toolbar, differing only in two buttons (side-panel toggle calls `setCueListOpen` instead of `handleToggleSplitView`; last button is Exit `onExit` instead of a player-mode toggle).

## Decision

Decompose the god component into three molecule components plus a types SSOT and a shared CSS SSOT:

- **`ClusterRightToolbar.tsx`** — the right-hand toolbar as its own molecule, shared by `SubtitlePanels` (`mode: 'overlay'`) and `PlayerModeOverlay` (`mode: 'player'`) via a `mode` prop and flexible callbacks (`onToggleSidePanel`, `onTogglePlayerMode` / `onExit`).
- **`ManagerLayer.tsx`** — the single render path for `SubtitleManagerPanel` (mobile Sheet + desktop panelLayer + backdrop + `SUBTITLE_MANAGER_SHEET_HEIGHT_VH` persist). `HostManagerSheet.tsx` becomes a **thin adapter** that converts `SerializedManagerState + onAction` → `ManagerState` and calls `ManagerLayer`, instead of duplicating the render + persist logic.
- **`OffsetLayer.tsx`** — renders target + native `SubtitleOffsetPanel`, replacing the inline duplicated render.
- **`subtitlePanelsTypes.ts`** — SSOT for `ManagerState`, `OffsetState`, `SubtitlePanelsRef`, `SubtitlePanelsProps`, `AppearanceState`. `logic/` files import from here, not from UI files. `SubtitleManagerPanel.tsx` re-exports `AppearanceState` for backward compatibility.
- **`subtitlePanelsShared.module.css`** — SSOT for `.panelLayer`, `.offsetRow`, and the `.clusterRight` family. `ManagerLayer`, `OffsetLayer`, `ClusterRightToolbar`, and `PlayerModeOverlay` import from here; `OverlayPreview.module.css` stops copying patterns.

**Why molecules and not hooks:** the 1100 lines of state/effects (fullscreen, iframe bridge, split-view, player-mode) are tightly coupled and already run correctly. Extracting them into hooks is a non-goal — it would risk regression without producing a clear SSOT win (ponytail: no abstraction unrequested). The decomposition targets only the parts that are genuinely duplicated or misplaced: toolbar JSX, manager render JSX, offset render JSX, shared types, and shared CSS.

**Why `HostManagerSheet` stays as a thin adapter and is not merged into `ManagerLayer`:** merging would require a prop union (`in-overlay` state vs `host-sheet` serialized state + `onAction` dispatch), making the component's input shape ambiguous. Keeping `HostManagerSheet` as the serialization adapter and `ManagerLayer` as the render SSOT preserves a clean separation: `HostManagerSheet` owns the iframe-child wire protocol, `ManagerLayer` owns the DOM.

## Consequences

**Positive:**
- SSOT for toolbar, manager render, offset render, types, and CSS — changing one toolbar button now touches 1 file (`ClusterRightToolbar.tsx`) instead of 3; changing sheet-height persist touches 1 file (`ManagerLayer.tsx`) instead of 2.
- Layered architecture restored: `logic/` imports types from `subtitlePanelsTypes.ts`, not from UI files containing JSX. Dependency direction is `logic/ → types/`, not `logic/ → ui/`.
- `SubtitlePanels.tsx` drops from 1651 to ~1344 lines (−18%); the remaining ~1100 lines of state/effects stay intact (behavior-identical refactor).
- Each molecule is independently unit-testable (render props, mobile/desktop branch, callback wiring, failure paths) — previously the toolbar and manager render were buried inside the god component and only testable end-to-end.
- `PlayerModeOverlay` and the normal overlay share the same toolbar molecule, so the two-button difference is explicit via props rather than a copy-paste divergence.

**Negative:**
- Five new files are added (`ClusterRightToolbar.tsx`, `ManagerLayer.tsx`, `OffsetLayer.tsx`, `subtitlePanelsTypes.ts`, `subtitlePanelsShared.module.css`). This is the trade-off for removing the god component — fewer lines in one file, more files overall. Accepted because each file has a single, testable responsibility.
- The shadow CSS manifest (`mountSubtitle.tsx` `css[]` + `managerShadowCss[]`, and `hostManagerSheetShadowCss.ts`) must list the new `subtitlePanelsSharedCss` and molecule CSS in three arrays. Forgetting one array causes raw-browser layout in shadow DOM. This is a mechanical sync, verified by grep in Success Criteria #12.

## Alternatives considered

- **Keep the god component + extract hooks for state/effects.** Rejected: extracting 1100 lines of tightly-coupled effects (fullscreen reparenting, iframe bridge, split-view, player-mode, portal setup) into hooks is a non-goal — it risks behavioral regression without producing a clear SSOT, and the effects are not duplicated across files (the duplication is in toolbar/manager/offset JSX, types, and CSS). The ponytail rule (no abstraction unrequested) applies: the requested win is SSOT for the duplicated parts, not a full hook decomposition.

- **Split into more, smaller files (one file per toolbar button, separate CSS per molecule).** Rejected as ponytail — the fewest files that achieve SSOT. `OffsetLayer` reuses `.offsetRow` from `subtitlePanelsShared.module.css` rather than getting its own CSS file. `ManagerLayer` owns both mobile and desktop branches internally rather than splitting into `MobileManagerLayer` + `DesktopManagerLayer`. The three molecules + types + shared CSS is the minimum that removes every duplication identified in the Context.
