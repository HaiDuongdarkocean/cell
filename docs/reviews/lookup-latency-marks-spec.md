# Spec review — lookup-latency-marks

VERDICT: APPROVE_WITH_CHANGES

## Round 1 — REJECT (implementability gaps)

Findings (all verified against source):

1. **Blocker** — e2e fixture loads production `dist/` where `isDevMode=false`; marks would no-op → REQ-6 unverifiable. Fixed: gate = `isDevMode || isTihokaDebug()` (`__Tihoka_DEBUG__` compiled in for E2E builds via `build-e2e.mjs` Tihoka_E2E=1).
2. requestId channel into popup component doesn't exist → render mark now fires from `popupLifecycle` via `requestAnimationFrame` after `setResult` (closure `requestId`).
3. Audio render mark keyed on `items.length > 0 && !loading` — loading stays true until `fetchAudio` `finally`, so the mark reflects rows-visible, not skeleton.
4. `markAudio(point, term)` signature aligned.
5. `start` mark moved after early-return guards; cache-hit gap + cross-surface term collision documented.
6. Deviations recorded: pointer→dispatch dropped (S-size), measures kept vs cleared, isolated-world fallback to console.debug.

## Round 2 — APPROVE_WITH_CHANGES (4 minors)

1. `level.requestId` is nulled before result application → render mark must use closure `requestId` (spec reworded).
2. Added `applied→render` measure (intent AC2); clears ordered after the measure.
3. Dist-grep criterion softened — DCE isn't guaranteed to drop string literals; runtime spy is the real criterion.
4. jsdom `performance.measure` partial → test harness may stub `performance` APIs.

## Applied fixes

All round-2 items applied to REQ-2/REQ-3/REQ-5/Success criteria verbatim.
