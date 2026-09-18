# Plan — Dense Cue Replay / i+1 Replay (backlog #10)

Spec: `docs/specs/dense-cue-replay.md` (r1 — reviewed). Intent: `docs/intent/dense-cue-replay.md`.

## T1 — Types + preset + persistence [P0, no deps]

- `entities/studyMode/types.ts`: `StepSkipRule = 'non-i1'`; `StudyStep.skip?: StepSkipRule`.
- `entities/studyMode/constants.ts`: preset `i1-replay` sau `adaptive` (icon `repeat`, subtitle `adaptive`, repeat 3, skip `non-i1`).
- `features/studyModes/lib/migrateStudyModeState.ts`: `STEP_SKIP_VALUES` + `isValidStep` clause.
- `features/studyModes/lib/formatStepSummary.ts`: `, skip non-i1` suffix.
- `features/studyModes/ui/StepEditor.tsx`: skip chip group chỉ `index===0`; 'never' ↔ `undefined`.
- `features/studyModes/lib/modeUsesBandProbe.ts` (new): `steps.some(subtitle==='adaptive') || steps[0]?.skip !== undefined`.
- Tests: migrate round-trip `skip:'non-i1'` survives + `skip:'always'` dropped; summary label; editor group only on step 0 + never→undefined write; modeUsesBandProbe matrix (adaptive / skip-on-0 / skip-on-1 dead config / null).

## T2 — Skip core (TDD) [P0, dep: T1]

- `studyModePlaybackController.ts`: `resolveStepSkip` pure export (whitelist easy/dense, bounced-set scan) + `pendingSkipTo`/`bouncedSkipTargets` fields + enterCue consume-first + skip branch + `handleSilence` transit guard + reset semantics (abort: pending only; setCues-boundaries: both; setMode: both).
- Tests trước implementation: resolveStepSkip full matrix (AC1); enterCue skip emits single seek + idle (AC2); eager no-intermediate (AC3); null-probe degrade (AC4); multi-overlap bounce convergence (AC5); handleSilence suppressed while pending (AC6); repeat:3 không re-eval (AC7); bounced set persist qua abort, clear trên setCues boundaries (AC8); user-seek-into-non-i1 re-skips (AC9); live band flip i1→easy re-enter → skip (AC11).

## T3 — Wiring [P0, dep: T2]

- `contentScriptController.ts`: `wantsResolver` → `modeUsesBandProbe(currentMode)` (AC12).
- `StudyModesTab.tsx`: prop rename `modeUsesAdaptive` → `modeUsesBandProbe` + call site.
- Tests: contentScriptController skip-only mode → resolver + bandProbe wired (AC12); StudyModesTab chips visible under `i1-replay` (AC13).

## T4 — Gates + docs + Chrome smoke + commit + backlog shipped [P0, dep: T3]

- `npm run typecheck && npm run lint && npm run test:unit && npm run build`; deep-import + feature-cycle checks.
- Smoke `tmp/dense-cue-replay/smoke.mjs`: mock stream → `i1-replay` → all-known cue skipped (seek forward) → 1–2-unknown cue plays + replays (seek-back to start ×2) → dense cue skipped → `normal` restores → persist reload (AC16).
- `docs/2-architechture-system.md` + `docs/0-wiki.md` + backlog → `shipped`.
- Commit feature rồi commit docs/backlog (convention 2 commits).
