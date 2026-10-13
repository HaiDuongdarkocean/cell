# Plan — `cue-difficulty-map`

> Spec: `docs/specs/cue-difficulty-map.md` (r1, APPROVE WITH CHANGES applied) · Backlog: #5 · Cost: S
> Strategy: thin verified slices — pure logic → CueList render → panel wiring → gates+smoke+ship

## T1 — Band semantics (pure, TDD)

- [x] `src/features/subtitle/logic/cueDifficulty.ts`: add `CueHeatBand = 'easy'|'i1'|'dense'` + `cueHeatBand(d: CueDifficulty): CueHeatBand` (`0→easy`, `1–2→i1`, `≥3→dense`).
- [x] `cueDifficulty.test.ts`: boundary cases 0/1/2/3/10.
- Verify: `npx jest src/features/subtitle/logic/cueDifficulty.test.ts` ✅ 23 pass

## T2 — CueList render + CSS + i18n (TDD)

- [x] `CueList.tsx`: `cueDifficulty?: ReadonlyMap<number, CueDifficulty>` prop; per cue `heat = cueDifficulty?.get(cue.index)`; when defined → `data-heat={band}` on cue item + `<span class="heat heat_{band}" data-tihoka-id="cue-heat" title aria-hidden>` first child + `<VisuallyHidden id="cue-heat-sr-{cue.index}">` immediately after + timestamp button `aria-describedby`.
- [x] `CueList.module.css`: `.heat` (absolute left, `var(--cue-list-indicator-width)`), `.heat::after` 10px hit-slop, `.heat_easy/.heat_i1/.heat_dense` (status colors, opacity 0.45/0.7/1).
- [x] `messages/en.json` + `vi.json`: `cueHeat.tooltip.easy|i1|dense` + `cueHeat.srLabel` (plural-safe copy).
- [x] `tests/unit/entrypoints/sidepanel/CueList.test.tsx`: data-heat per band on cue item (once per row), missing-entry → no data-heat/bar, aria-hidden bar, sr text, tooltip title, `aria-describedby` wiring.
- Verify: `npx jest tests/unit/entrypoints/sidepanel/CueList.test.tsx` ✅ 39 pass

## T3 — SubtitlePanel wiring

- [x] `SubtitlePanel.tsx`: `cueDifficulty={cueFilterEnabled ? difficulties : undefined}` on the `practiceMode === 'off'` CueList.
- [x] `SubtitlePanel.cueFilter.test.tsx`: extend — `data-heat` present when eligible, absent under gate-off (practiceMode), re-bands after `emitWordStatusChanged`.
- Verify: `npx jest src/features/subtitle/ui/SubtitlePanel.cueFilter.test.tsx` ✅ 18 pass

## T4 — Gates + docs + smoke + ship

- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` + deep-import/feature-cycle guards.
- [ ] `docs/2-architechture-system.md` (CueList row + cueDifficulty row + test row), `docs/0-wiki.md` (spec/intent index + changelog).
- [ ] Real-Chrome smoke `tmp/cue-difficulty-map/smoke.mjs` (testing-extension-browser workflow): bars render, `[data-tihoka-id="cue-item"][data-heat="dense"]` count == FAB dense count, live status change re-bands a cue, filter+heat coexist.
- [ ] Backlog → `shipped` + commit hash; commit(s) grouped by subsystem.

Dependencies: T2→T1 (imports type+fn), T3→T2, T4→all.
Parallel: T1 + T2 test scaffolding; T3 wiring after T2 green.
