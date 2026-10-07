# Verify review — phrase-pump

VERDICT: PASS (round 2, after fixes)

## Round 1 — FAIL (fresh-context subagent, spec ↔ code)

| # | Finding | Evidence | Severity |
|---|---------|----------|----------|
| V1 | Error state unreachable — `rebuild().then(items => pump.start(items))` always calls `start`; `start([])` emits `empty`, overwriting the `error` phase set by `build` | `PumpView.tsx` startSession; `usePumpPlayer` build; `pumpPlayer.start` | major |
| V2 | Pause during the inter-item gap after an asset item auto-resumes — `active`/`activeIsTts` never cleared after `await settled` resolves, so `pause()` took the resumable-handle branch and skipped the generation bump; the pending `advance()` sleep then passed the gen check | `pumpPlayer.ts` runCurrent/advance | major |
| V3 | `repeatsDone` leaks across a skipped item — catch path called `advance` without resetting, so the next item got fewer repeats | `pumpPlayer.ts` catch path | minor |

## Fixes applied

- `PumpView.tsx`: `startSession` only calls `pump.start` when items are non-empty — error/empty phases survive.
- `pumpPlayer.ts`: `this.active = null` after `await settled` in the asset branch → gap-pause bumps generation and the pending advance is discarded; resume replays the pending item.
- `pumpPlayer.ts`: `repeatsDone = 0` in the skip path.
- New tests: pause-during-post-asset-gap stays paused (would fail pre-fix); mid-repeat failure gives the next item the full repeat count (would fail pre-fix).

## Round 2 — re-verify

- 36/36 phrasePump tests green (field detection, dedupe/sort/cap, source assembly + lang fallback + audio resolution, player controls incl. both new regression tests, prefetch-1).
- Spec spot-check: reads-only (no SRS/queue writes anywhere in `features/phrasePump`), `TTS_FETCH_AUDIO` not used, additive `view`/`deckId` on `SRS_OPEN_STUDY_PAGE` only, launcher rendered outside the playlist empty branch, i18n en+vi parity, `--touch-target` on transport/launcher.
- Browser evidence (real Chromium, dev server): `tmp/phrase-pump-prod/prod-setup.png`, `prod-after-start.png` — setup view and empty state render correctly, no console errors.

VERDICT: PASS
