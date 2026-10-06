# Plan — Player Mode mobile layout (<600px)

> Spec: `docs/specs/player-mode-mobile-layout.md` · Design: `docs/intent/player-mode-mobile-layout-design-brief.md` + `docs/reviews/player-mode-mobile-layout-design.md` (APPROVE)
> Reference implementation: `src/entrypoints/mockup-player-mode-mobile-layout/` (ConceptTarget + mockup.module.css — copy geometry verbatim)

## Approach

Implement the spec'd mobile branch inside `PlayerModeOverlay` gated by `viewport.w < 600`, reusing the mockup's proven layout geometry. All buttons = shared `Button` subtle-family; menu = shared `Menu`; icons bare glyphs per REQ-11. No new shared components — mobile regions are CSS in `PlayerModeOverlay.module.css`; cue-card visuals in `CueList.module.css` scoped under `[data-cell-pm-mobile]`.

## Slices

| # | Task | Files | AC |
|---|---|---|---|
| 1 | Storage key `PLAYER_MODE_CUE_DISPLAY` + i18n en/vi (menu labels, caption, display mode, speed) | `config.ts`, `src/shared/i18n/messages/{en,vi}.json` | AC-10, NFR-5 |
| 2 | Geometry: `PM_MOBILE_BAR_PX` (~76 = touch-target 48 + padding + safe-area) → pass as dockHeight when <600; video stage inset `space-3` + `radius-2xl` | `playerModeGeometry.ts`, overlay CSS | AC-1, REQ-7 |
| 3 | CueList mobile: `mobile` + `displayMode` + `cardActions` props; cards radius-2xl/surface, active 4px primary border + elevated; non-scroll (`overflow:hidden`, system scrollTop follows active) + mask fade; active-only mode (gap → next upcoming dimmed; none → EmptyState compact) | `CueList.tsx`, `CueList.module.css` | AC-7, AC-10, AC-15 |
| 4 | SubtitlePanel `pmMobile` prop: `data-cell-pm-mobile` root, hide header + StudyModeActionBar/PracticeOptions (CSS), `fabPortalTarget` → `createPortal(cueFilterFab, slot)`; pass displayMode | `SubtitlePanel.tsx`, `SubtitlePanel.module.css` | AC-4, AC-7 |
| 5 | ComprehensionPill `:host-context([data-cell-player-mode-mobile])` → bottom-anchored, centered via `--pm-anchor-bottom` runtime var | `ComprehensionPill.module.css` | AC-5 |
| 6 | PlayerModeOverlay mobile branch: `pm-cue-wrap` > `pm-cue-region` + `pm-anchor-band` (CC `manager-toggle-btn` left, pill spacer center, caption `Subtitles: <label>`, rail `player-mode-actions` = fab-slot + generate) + `pm-bottom-bar` (X ghost | prev/repeat/hero/next `primarySubtle`/`warningSubtle` | ⋯ ghost); adaptive rewind/forward when cues=0; ⋯ Menu (list toggle `panel-toggle-btn`, OCR, study modes radio, speed radio, practice) | `PlayerModeOverlay.tsx`, `.module.css` | AC-1,2,3,4,5,6,9 |
| 7 | `data-cell-player-mode-mobile` on documentElement mount/cleanup + `--pm-anchor-bottom` sync; storage subscription `PLAYER_MODE_CUE_DISPLAY` scoped key; session `showAll` override | `PlayerModeOverlay.tsx` | AC-5, AC-10, AC-14 |
| 8 | `trackLabel` prop thread: `SubtitlePanels` → derive `manager.targetItems[targetActiveIndex]?.name`, fallback `subtitleOverlayTargetLanguage`; `SubtitleManagerPanel` display-mode row (Select or Tabs list|active, i18n) | `SubtitlePanels.tsx`, `SubtitleManagerPanel.tsx`, types | AC-5, AC-10 |
| 9 | Tests: adaptive nav (cues=0→rewind/forward), mobile branch renders pm-bottom-bar + no `.dock`, display-mode persistence; unit pass | `PlayerModeOverlay.test.tsx`, maybe `CueList.test.tsx` | AC-14, AC-13 |
| 10 | Gates + verify: typecheck/lint/test/build green; mockup-site `real.tsx` screenshot <600px vs target mockup; verify artifact | all | DoD |

## Order

1 → 2 → 3 → 4 → 6/7 (overlay) → 5 → 8 → 9 → 10. Slices 3+4 are the only ones touching shared panel code — keep `pmMobile` strictly additive so desktop/split-view render identically (AC-12).

## Risks

- `overflow:hidden` + programmatic scrollTop: existing align() logic keeps working (system scroll ≠ user scroll) — REQ-10 satisfied without new listeners.
- Pill `:host-context` only matches when pill shadow host hangs under `documentElement` — mountComprehensionPill reparents on fullscreen; attr on `document.documentElement` covers both.
- Esc: menu already on `pushEscapeLayer`; PM's window keydown stays after pop → one Esc closes menu first (existing stacking order).
- `pm-fab-slot`: fab portal must not render when empty → `slot.hasChildNodes` guard not needed; SubtitlePanel portals only when fab exists.
