# ADR-059: Tokenize Gold Performance (< 500 ms viewport, 500 MB RAM)

**Status:** Accepted  
**Date:** 2025-09-11  
**Supersedes:** none (refines ADR-058 and earlier VDLT work)

## Context

ADR-058 introduced VDLT-Predict: cold-start viewport bind, direction-aware overscan, and prepare-ahead at `PRIORITY_BUFFER`. Profiling on https://en.wikipedia.org/wiki/Ocean showed the work landed close to the target but had two remaining gaps:

1. **Viewport/prepare tasks ran through `setTimeout(0)`**, which can starve other timers (and the main thread) when a large cold-start queue is drained. This produced multi-second stalls on the test machine and risked jank on low-end devices.
2. **Prepare-ahead at `PRIORITY_BUFFER` was gated on `requestIdleCallback`**, which can be delayed for seconds on a busy page. Viewport binds therefore still paid the full tokenization cost inline.

The goal is to reach **< 500 ms for the first viewport to be fully tokenized and bound**, **< 500 ms for each viewport worth of new content on scroll**, and to keep the algorithm smooth on devices with **~500 MB available RAM**.

## Decision

Refine VDLT-Predict into VDLT-Fast with four targeted changes:

### 1. `PRIORITY_PREPARE` + `requestAnimationFrame` fast path

- Add `PRIORITY_PREPARE = 5` between `PRIORITY_VIEWPORT` (0) and `PRIORITY_BUFFER` (10).
- Scheduler `start()` now uses `requestAnimationFrame` for any task with `priority < PRIORITY_BUFFER`, processing one chunk per display frame with a 16 ms budget.
- `requestIdleCallback` is reserved for `PRIORITY_BUFFER` and `PRIORITY_IDLE` work.

**Why:** `setTimeout(0)` loops can starve other timers because each `setTimeout(0)` callback is the earliest due task and keeps rescheduling. `requestAnimationFrame` is frame-aligned, yields between frames, and still keeps viewport/prepare work ahead of idle tasks.

### 2. Prepare-ahead at `PRIORITY_PREPARE`

- `scanAndObserveBlocks` schedules `prepareBlock` (pure tokenization, no DOM insert) at `PRIORITY_PREPARE`.
- `bindVisibleBlock` still calls `prepareBlock` on demand as a defensive no-op when the cached tokens already exist.

**Why:** Tokens are computed before the block enters the viewport, but the fast path no longer waits for browser idle. This removes the plain-text flash on scroll and shortens the cold-start bind chain.

### 3. Smaller initial overscan and tighter viewport filter

- `resolveViewportRootMargin` is reduced from a 1-viewport to a 0.5-viewport isotropic overscan (`vh / 2`).
- `isElementInViewport` (used by `bindViewportNow`) uses a 50 px margin instead of 300 px.
- `resolveScrollPredictMargin` defaults remain asymmetric: 1 viewport ahead (min 600 px), 0.25 viewport behind (min 150 px).

**Why:** The initial resident set is now ~2 viewports instead of 3, lowering memory pressure on 500 MB devices while still covering the visible area and a small ahead buffer.

### 4. Version-based status race guard

- `localStatusOverrides` stores `{ status, version }` where `version` comes from a monotonic `statusVersionCounter`.
- `scheduleMetadataResolve` captures `nextFlushVersion = statusVersionCounter` when the flush timer is set.
- `flushMetadataQueue` uses `flushVersion` from scheduling time and re-applies any override whose `version` is newer.

**Why:** The previous `performance.now()` timestamp guard could lose a user change when the scheduler timing shifted. Capturing the version at flush-schedule time makes the race guard independent of when the flush callback actually runs.

## Consequences

- **+** Cold enable on Wikipedia Ocean: first token at ~156 ms, full eligible token count (1,778 tokens) bound by ~253 ms.
- **+** Scroll one viewport: new viewport content stabilizes in ~100 ms.
- **+** No timer starvation; the UI remains responsive while the tokenize queue drains.
- **+** 100% eligible parse is reachable; on the test page the full article is parsed within the cold-start budget.
- **−** `requestAnimationFrame` fast path pauses in background tabs; this is acceptable because tokenize is a foreground viewport feature and the existing `setTimeout` fallback would still work if `requestAnimationFrame` were unavailable.

## Measured on https://en.wikipedia.org/wiki/Ocean

Production build, Edge DevTools MCP, 993 px viewport.

| Scenario | Metric | Result | Budget |
|---|---|---|---|
| Cold enable | First token in DOM | ~156 ms | < 300 ms |
| Cold enable | Full eligible token count bound | 1,778 tokens in ~253 ms | < 500 ms |
| Scroll 1 viewport | Stable visible tokens in new viewport | 755 tokens in ~105 ms | < 500 ms |
| Scroll 2 viewports | Stable visible tokens in new viewport | 84 tokens in ~100 ms | < 500 ms |
| Scroll to bottom | Total eligible parse | 1,778 tokens (100%) | 100% |

## Quality gates

- `npm run typecheck` pass.
- `npx jest --selectProjects unit --testPathPatterns=tokenize` pass (93/93 tests).
- `npm run build` pass.
- Runtime verification via `chrome-devtools` MCP.

## References

- `docs/memory/algorithm-tokenize.md`
- ADR-047, ADR-050, ADR-055, ADR-058
- `src/features/tokenize/logic/tokenizeScheduler.ts`
- `src/features/tokenize/controller/webTokenizeController.ts`
- `src/features/tokenize/logic/scrollDirection.ts`
