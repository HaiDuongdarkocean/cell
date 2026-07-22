# Implementation Plan: Predictive Viewport Tokenize (VDLT-Predict)

## Overview

Extend the existing VDLT-Hybrid tokenize pipeline so users feel tokenization is already done in the viewport: prepare tokens ahead of scroll direction, bind viewport blocks immediately on enable, and scale cache up. No Worker, no rewrite — surgical additions that preserve the ADR-049/050 mutation fast path.

Spec: `docs/specs/spec-predictive-viewport-tokenize.md`. Idea: `docs/ideas/predictive-viewport-tokenize.md`.

## Architecture Decisions

- **Prepare ≠ bind**: `prepareTokenBlock` already exists and only sets `block.tokens` (no DOM). Slice A makes the controller actually schedule it at `PRIORITY_BUFFER` for blocks in the expanded overscan zone, and ensures `bindVisibleBlock` reuses prepared tokens (it already does — verify + test).
- **Soft unbind preserves tokens**: today `unbindTokenBlock` only restores the source node and flips `isBound`; it does NOT clear `block.tokens`. Slice B relies on this — confirm with a test, no change unless regression.
- **Direction via rAF-coalesced scroll listener** on `window`, not IO entry-delta math (simpler, deterministic, no extra IO callbacks). Listener is passive + rAF-throttled; never does sync layout reads beyond `scrollY`.
- **Dynamic rootMargin**: `ViewportTracker` is recreated when direction changes (current API has no setter). Recreate preserves ADR-055 already-intersecting onEnter semantics via the synchronous onEnter path. Re-observe all `blocks` whose element is still connected.
- **Cold-start viewport-first**: split `setActive(true)` into "bind viewport now" + "hydrate offscreen via scheduler". The `window.load` + `HYDRATION_QUIET_MS` gate stays for the *offscreen* bulk scan only; viewport bind fires as soon as blocks are scanned.
- **Cache tiers raised**: SSOT constants in controller; tune after measure.

## Task List

### Phase A — Baseline overscan + prepare≠bind + cache bump (FR1, FR2, FR5)

- [ ] Task A1: Raise cache capacity tiers + extract overscan constants
- [ ] Task A2: Schedule BUFFER prepare for overscan-zone blocks; verify bind reuses prepared tokens
- [ ] Task A3: Soft-unbind preserves tokens — guard test

### Checkpoint A
- [ ] `npm run test:unit -- --testPathPattern=tokenize` green
- [ ] `npm run typecheck` + `npm run build` green
- [ ] Manual: long article scroll — fewer plain flashes than baseline

### Phase B — Direction-aware overscan + soft unbind behind (FR3, FR2 unbind)

- [ ] Task B1: Pure `resolveScrollPredictMargin` helper + unit tests
- [ ] Task B2: rAF-coalesced scroll direction tracker in controller
- [ ] Task B3: Recreate `ViewportTracker` with asymmetric margin on direction change; re-observe blocks

### Checkpoint B
- [ ] Unit: margin helper branches covered; controller applies new margin without dropping visible set
- [ ] Manual: scroll down → ahead zone deeper; reverse scroll → rebind cheap (tokens still cached)

### Phase C — Cold-start viewport-first (FR4)

- [ ] Task C1: Split activate into viewport-bind-now + offscreen-hydrate
- [ ] Task C2: Persisted-enable path binds viewport before hydration quiet window

### Checkpoint C
- [ ] Unit: cold-start binds in-viewport blocks without waiting quiet timer
- [ ] Manual: toggle on interactive page → viewport tokens <300ms feel; SPA mutation path still green

### Phase D — Verify + docs

- [ ] Task D1: Non-regression sweep (mutation, cache eviction, viewportTracker already-intersecting)
- [ ] Task D2: Update `docs/2-architechture-system.md` + `docs/0-wiki.md` if behavior changed
- [ ] Task D3: ADR-058 (WHY only) after measured decision sticks

### Checkpoint D
- [ ] All success criteria SC1–SC6 verified
- [ ] Ready for code review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Recreating ViewportTracker drops visible set briefly → flash | Med | Re-observe synchronously; ADR-055 onEnter fires for already-intersecting; test the transition |
| Larger overscan + cache → DOM span count → layout cost on 1GB | Med | Soft unbind behind direction; measure span count; tune tiers in Task A1 |
| rAF scroll listener adds main-thread work | Low | Passive + coalesced; only updates direction state, no layout read beyond scrollY |
| Cold-start viewport bind fights SPA hydration | Med | Keep `window.load` gate for offscreen; viewport bind only touches already-rendered text nodes |
| Direction thrash on bounce | Low | Hysteresis (≥16px delta) in pure helper |

## Open Questions (defer to measure)

- Ahead depth final value (start 1.0× height / 0.25 behind, minAhead 600px, minBehind 150px)
- Metadata prefetch on prepare vs post-bind (start post-bind only)
- Nested scroll containers (defer)

## Parallelization

- A1, B1 (pure helper) can be written in parallel once Phase A starts (B1 has no dependency on A).
- A2, A3 must be sequential (A3 guards A2's soft-unbind assumption).
- B2, B3 sequential. C1, C2 sequential. D after all.
