# Implementation Plan: Subtitle Panels Atom Decomposition

> Spec: `docs/specs/subtitle-panels-atom-decomposition.md`
> Decisions D1-D6 đã resolve. Refactor thuần, behavior-identical.

## Overview

Tách `SubtitlePanels.tsx` (1651 dòng) thành 3 molecule (`ClusterRightToolbar`, `ManagerLayer`, `OffsetLayer`) + 1 types file (`subtitlePanelsTypes.ts`) + 1 shared CSS (`subtitlePanelsShared.module.css`). Gộp `HostManagerSheet` render logic vào `ManagerLayer` (HostManagerSheet giữ làm thin adapter). Share `ClusterRightToolbar` với `PlayerModeOverlay` (mode prop). Mục tiêu: ≤ 1350 dòng `SubtitlePanels.tsx`, SSOT toolbar/manager/offset/types/CSS.

## Architecture Decisions (từ spec)

- **D1**: `ManagerLayer` nhận `ManagerState`; `HostManagerSheet` = thin adapter convert `SerializedManagerState + onAction` → `ManagerState`.
- **D2**: `subtitlePanelsShared.module.css` chứa `.panelLayer`, `.offsetRow`, `.clusterRight` family. Molecule + PlayerModeOverlay import từ đó.
- **D3**: Không `OffsetLayer.module.css` — reuse `.offsetRow` từ shared CSS.
- **D4**: Showcase giữ `<SubtitlePanels>` direct, import types từ `subtitlePanelsTypes.ts`.
- **D5**: `ClusterRightToolbar` share với `mode: 'overlay' | 'player'` + flexible callbacks.
- **D6**: `AppearanceState` dời vào `subtitlePanelsTypes.ts`, `SubtitleManagerPanel` re-export.

## Dependency Graph

```
Phase 0: Baseline verify (sequential, 1 agent)
    │
Phase 1: Foundation (PARALLEL — 2 agents)
    ├── T1: subtitlePanelsTypes.ts (types SSOT)
    └── T2: subtitlePanelsShared.module.css (CSS SSOT)
    │
Phase 2: Molecules (PARALLEL — 3 agents, sau Phase 1)
    ├── T3: ClusterRightToolbar.tsx + test
    ├── T4: ManagerLayer.tsx + test
    └── T5: OffsetLayer.tsx + test
    │
Phase 3: Consumers (PARALLEL — 4 agents, sau Phase 2)
    ├── T6: SubtitlePanels.tsx compose molecule
    ├── T7: PlayerModeOverlay.tsx share ClusterRightToolbar
    ├── T8: HostManagerSheet.tsx thin adapter
    └── T9: OverlayPreview.module.css dùng shared CSS
    │
Phase 4: Wiring (PARALLEL — 3 agents, sau Phase 3)
    ├── T10: mountSubtitle.tsx + hostManagerSheetShadowCss.ts CSS manifest
    ├── T11: logic/ files import types + index.ts export
    └── T12: showcase pages import types
    │
Checkpoint: Build + test + typecheck (sequential, 1 agent)
    │
Phase 5: Docs (PARALLEL — 2 agents)
    ├── T13: docs/2-architechture-system.md update
    └── T14: ADR + docs/0-wiki.md
    │
Phase 6: Browser verify (sequential, 1 agent)
    │
Phase 7: Final commit (sequential, 1 agent)
```

## Parallelization (max 20 agents)

| Phase | Agents | Tasks |
|-------|--------|-------|
| 0 | 1 | T0 baseline |
| 1 | 2 | T1, T2 (song song) |
| 2 | 3 | T3, T4, T5 (song song, sau Phase 1) |
| 3 | 4 | T6, T7, T8, T9 (song song, sau Phase 2) |
| 4 | 3 | T10, T11, T12 (song song, sau Phase 3) |
| Checkpoint | 1 | Build+test+typecheck |
| 5 | 2 | T13, T14 (song song) |
| 6 | 1 | Browser verify |
| 7 | 1 | Final commit |

**Max concurrent**: 4 (Phase 3). Tổng 15 task + 4 checkpoint/verify/commit = 19 bước. Đặt trong 20 agent budget.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSS move break shadow DOM render | High | T2 giữ cả class cũ (re-export) + T10 verify manifest đầy đủ; build catch |
| PlayerModeOverlay toolbar share lệch behavior | High | T7 giữ `data-cell-id="player-mode-exit-btn"` + test DOM selector |
| HostManagerSheet adapter subtle diff (`onGenerateNative` ternary) | Med | T8 giữ `buildAppearance` helper nguyên, test host-sheet branch |
| iframe bridge state sync break | High | Non-goal giữ effect; T6 chỉ compose molecule, không đụng effect |
| Build fail do circular CSS import | Med | D2: shared file không import molecule |
| Browser regression không phát hiện | High | T15 verify 4 environment + checklist observable |

## Open Questions

Không còn (D1-D6 resolved).
