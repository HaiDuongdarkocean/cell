# Plan — Adaptive Subtitles (backlog #9)

Spec: `docs/specs/adaptive-subtitles.md` (r1 — reviewed). Intent: `docs/intent/adaptive-subtitles.md`.

## T1 — Types + persistence foundation [P0, no deps]

- `entities/studyMode/types.ts`: `AdaptiveCueBand`, `CueBandProbe`, `StudyStep.subtitle` union += `'adaptive'`.
- `entities/studyMode/constants.ts`: preset `adaptive` (icon `gauge`, sau `normal`).
- `features/studyModes/lib/migrateStudyModeState.ts`: `SUBTITLE_VALUES += 'adaptive'` (**B1**).
- `features/studyModes/lib/formatStepSummary.ts`: `SUBTITLE_LABELS.adaptive`.
- `features/studyModes/ui/StepEditor.tsx`: `SUBTITLE_OPTIONS += 'adaptive'`.
- Tests: migrate round-trip custom mode adaptive step; formatStepSummary label.

## T2 — Resolution core (TDD) [P0, dep: T1]

- `studyModePlaybackController.ts`: `bandProbe` field + `setBandProbe` + `resolveStepSubtitle` pure export + wire 2 emit sites (`applyStepEntry`, `reapplyStep`).
- `subtitleStudyModeController.ts`: cached field + `setBandProbe` + forward trong `applyStudyMode`.
- `unknownCueMap.ts`: `bandProbe` trên resolver — `rankByTerm` materialized Map + `cueDifficultyMap` + `cueHeatBand`; rebuild trong `applyStatus`; clear trong `destroy`.
- Tests trước implementation: resolveStepSubtitle matrix; playback adaptive sequence; controller forward-on-mode-switch; resolver bandProbe/applyStatus/destroy/unfiltered.

## T3 — Wiring [P0, dep: T2]

- `reactSubtitleController.ts`: `setBandProbe` pass-through.
- `contentScriptController.ts`: `currentMode` tracking + `wantsResolver` mở rộng + 3 wire sites (`:181/:186/:202` pattern).
- `StudyModesTab.tsx`: `modeUsesAdaptive` → `AdvancedSection` show level chips.
- Tests: contentScriptController adaptive-only resolver creation + wire sites; react pass-through; StudyModesTab chips visible.

## T4 — Gates + docs + Chrome smoke + ship [P0, dep: T3]

- `npm run typecheck && npm run lint && npm run test:unit && npm run build`; deep-import + feature-cycle checks.
- Smoke `tmp/adaptive-subtitles/smoke.mjs`: mock stream → bật adaptive → mark-all-known cue easy sub ẩn → unknowns dense both → switch normal baseline restore.
- `docs/2-architechture-system.md` + `docs/0-wiki.md` + backlog → `shipped`.
- Commit feature rồi commit docs/backlog (convention 2 commits).
