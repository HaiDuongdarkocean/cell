# Spec: Predictive Viewport Tokenize (VDLT-Predict)

> PRD — improve tokenize parse so it feels infinite (0 plain in viewport) via predictive prepare ahead of scroll + faster cold enable.
> Input: `docs/ideas/predictive-viewport-tokenize.md` + ADR-047/048/049/050 + existing `features/tokenize/*`.
> Extends (does not replace) `docs/specs/spec-tokenize-on-media.md`.

## Assumptions

1. Change is **web text + SPA** only in this slice. Subtitle time-window predict is a follow-up reusing the same prepare/bind priorities.
2. Stack stays Chrome MV3 content-script TypeScript; no new dependencies; no Worker in MVP.
3. Existing VDLT pieces remain SSOT: `TokenizeScheduler`, `ViewportTracker`, `TokenizeCache`, `webTokenizeController`, mutation microtask fast path (ADR-050).
4. “0 plain in viewport” means every **scanned, eligible** text block whose element intersects the **visual viewport** (not the overscan zone) is `isBound === true` under normal scroll (≤ ~1 viewport/s). Fast fling may lag at the leading edge until decelerate.
5. Metadata (status/frequency) may still resolve after bind (ADR-049 early-bind). Success does **not** require colored bands before plain→token morph.
6. Higher RAM is accepted: scale cache tiers up from current 100/150/250 if needed for UX.
7. Direction is primarily **vertical document scroll** (`window` / scrolling element). Nested scroll roots are best-effort (same observer root as today unless already parameterized).
8. No hardcoded magic without named constants near the controller/tracker (SSOT constants module or top of controller).

→ Correct me now or I'll proceed with these.

## Objective

Cải thiện pipeline tokenize trang web/SPA để:

1. **Parse ahead** nội dung user sắp scroll tới → cảm giác infinite tokenize.
2. **Bind viewport nhanh** khi bật tokenize (cold start) → không chờ full-page quiet window trước token đầu.
3. **Không jank** main thread: keep ~16ms viewport budget; prepare chạy BUFFER/IDLE.
4. **Soft cleanup** phía sau hướng scroll để “infinite feel ≠ infinite DOM”.

**User story**: Là learner đọc article hoặc lướt feed SPA, khi em bật tokenize và scroll bình thường, em không bao giờ thấy đoạn text trong màn hình còn nguyên (chưa tách token); token xuất hiện như đã có sẵn.

**Non-goals (this spec)**: Worker tokenizer, mouse trajectory prefetch, dual-sentinel virtual list rewrite, subtitle predict, eager full-page bind.

## Tech Stack

- Chrome Extension MV3, TypeScript strict, Vite + crxjs
- Jest unit tests co-located under `src/features/tokenize/**/*.test.ts`
- Existing pure logic + controller pattern (named exports, no `any`)

## Commands

```
Dev:              npm run dev
Build:            npm run build
Typecheck:        npm run typecheck
Test unit:        npm run test:unit
Test tokenize:    npm run test:unit -- --testPathPattern=tokenize
Lint:             npm run lint
```

Post-code gate (AGENTS.md): `npm run typecheck` + `npm run test:unit` + `npm run build`.

## Project Structure

Touch primarily:

```
src/features/tokenize/
├── logic/
│   ├── viewportTracker.ts          # optional: dynamic rootMargin / multi-zone
│   ├── scrollDirection.ts          # NEW pure: delta → direction + rootMargin string
│   ├── tokenizeScheduler.ts        # ensure BUFFER path used for prepare
│   └── tokenizeCache.ts            # capacity remaining SSOT; optional resize API
├── controller/
│   └── webTokenizeController.ts    # orchestration: overscan, prepare-ahead, cold-start
├── types.ts                        # only if block flags needed (e.g. preparedAt)
docs/
├── ideas/predictive-viewport-tokenize.md
├── specs/spec-predictive-viewport-tokenize.md
├── adr/058-predictive-viewport-tokenize.md   # AFTER measure + ship decision (WHY only)
└── 0-wiki.md / 2-architechture-system.md    # update when src/ changes
```

## Functional Requirements

### FR1 — Expanded baseline overscan (slice A)

- Replace fixed isotropic `VIEWPORT_ROOT_MARGIN = '200px'` with named constants:
  - **Near zone** (bind): at least ~0.5–1× `innerHeight` equivalent via rootMargin (mobile min floor e.g. 400px).
  - Implementation may start isotropic (same value all sides) for A/B measurement.
- Blocks entering near zone schedule **bind** at `PRIORITY_VIEWPORT`.
- Blocks in expanded zone but not yet bound schedule **prepare only** at `PRIORITY_BUFFER` (tokens on block, no DOM).

### FR2 — True prepare ≠ bind (slice A/B)

- `prepareBlock` must be callable without binding.
- `bindVisibleBlock` must prefer already-prepared `block.tokens` (no re-tokenize).
- Scheduler:
  - `PRIORITY_VIEWPORT` (0): bind / rebind visible
  - `PRIORITY_BUFFER` (10): prepare ahead + soft unbind behind
  - `PRIORITY_IDLE` (20): optional deep prepare / cache warm far ahead
- Unbind must **not** clear `block.tokens` (soft cleanup) so reverse scroll rebinds cheaply. Hard clear only on cache eviction / removedNodes / disable.

### FR3 — Direction-aware overscan (slice B)

- Pure helper (e.g. `resolveScrollPredictMargin`):
  - Input: lastScrollY, scrollY, innerHeight, optional velocity, config.
  - Output: CSS `rootMargin` string, asymmetric: **deep ahead, shallow behind**.
- Hysteresis: ignore |delta| below threshold (e.g. 8–16px) to avoid thrash.
- Apply updated margin without leaking observers: destroy+recreate tracker **or** supported update path; must re-observe existing blocks and preserve `visibleElements` semantics (incl. ADR-055 already-intersecting onEnter).
- Default when direction unknown (first paint / no scroll yet): favor **down** (common reading) or isotropic large margin.

### FR4 — Cold-start viewport-first (slice C)

- On `setActive(true)` / enable:
  1. Scan blocks (existing `findTextBlocks`).
  2. **Immediately** bind blocks intersecting visual viewport (+ small near margin) via sync/`queueMicrotask`/`rAF` — do not wait solely for IntersectionObserver first callback.
  3. Offscreen blocks: observe + BUFFER prepare; idle deep prepare capped by cache capacity.
- Persisted enable path may still wait `window.load` for safety, but **must not** wait full `HYDRATION_QUIET_MS` before first viewport bind. Prefer:
  - Viewport bind ASAP after load (or immediately if `readyState === 'complete'`),
  - Keep `MAX_ACTIVATION_DELAY_MS` hard cap for remainder,
  - Quiet window optional for offscreen bulk only.
- Manual toggle while page already interactive: viewport bind in the same turn / next microtask.

### FR5 — Cache capacity scale-up

- Raise tiers (SSOT in controller or shared constant), example target (tune after measure):

  | deviceMemory | old | new (start) |
  |--------------|-----|-------------|
  | ≤0.5         | 100 | 150         |
  | <2           | 150 | 300         |
  | ≥2 / unknown | 250 | 500         |

- Eviction still end-to-end: unbind + prune `blocks[]` + `domMap` (ADR-050).
- `touch` on bind/visible remains.

### FR6 — Mutation / SPA compatibility (non-regression)

- Keep ADR-050: `queueMicrotask` mutation flush, eager bind for small batches (≤50), characterData + removedNodes, stale bind eviction.
- Predictive prepare must not starve viewport bind during continuous mutations.
- Facebook-like feeds: new nodes still tokenize without multi-second plain flash in viewport.

### FR7 — Disable / destroy

- Disable: disconnect observers, unbind all, clear queues/timers, clear tokens/cache as today.
- No leaked scroll listeners.

## Code Style

Follow existing tokenize modules:

```ts
/** Pure: map scroll delta to asymmetric IntersectionObserver rootMargin. */
export function resolveScrollPredictMargin(input: {
  readonly scrollY: number;
  readonly lastScrollY: number;
  readonly viewportHeight: number;
  readonly aheadScreens?: number;
  readonly behindScreens?: number;
  readonly minAheadPx?: number;
  readonly minBehindPx?: number;
  readonly hysteresisPx?: number;
  readonly lastDirection?: 'up' | 'down' | 'none';
}): {
  readonly rootMargin: string;
  readonly direction: 'up' | 'down' | 'none';
} {
  // deep ahead, shallow behind; floor mins for short mobile viewports
}
```

- Named exports only; pure functions unit-tested without DOM when possible.
- No `any`. No new abstractions beyond one pure margin helper + controller wiring.
- Ponytail comments only for deliberate ceilings.

## Testing Strategy

| Level | What |
|-------|------|
| Unit | `resolveScrollPredictMargin` directions, hysteresis, min floors, rootMargin format |
| Unit | Scheduler: BUFFER prepare runs after VIEWPORT; flush order |
| Unit | Controller (jsdom): prepare does not set `isBound`; bind uses tokens; cold-start binds in-viewport blocks without waiting quiet timer |
| Unit | Existing tests green: mutation path, cache eviction, viewportTracker already-intersecting |
| Manual / DevTools MCP | Article long scroll + SPA feed: 0 plain in viewport at normal speed; toggle enable felt instant |

Coverage expectation: new pure helper 100% branches; controller paths for prepare/bind/cold-start covered by focused tests (not full browser matrix in CI).

## Boundaries

**Always**

- Measure-oriented slices A→B→C; keep mutation fast path.
- `npm run typecheck` + `test:unit` + `build` after src changes.
- Update `docs/2-architechture-system.md` + `docs/0-wiki.md` when structure/behavior docs need it.
- ADR-058 only after shipping decision / measured WHY.

**Ask first**

- Adding dependencies or Web Worker.
- Changing default enable/activation UX beyond viewport-first timing.
- Subtitle controller changes.
- Cache caps beyond the table above by >2×.

**Never**

- Eager tokenize entire document DOM bind on activate.
- Clear `tokens` on every soft unbind (kills reverse-scroll UX).
- Block scroll handler with heavy sync work (scroll listener must be rAF-coalesced if used).
- Hardcoded colors/PX for token chrome (unrelated UI); predictive distances are named layout constants, not design tokens.

## Success Criteria

- [ ] SC1: Normal scroll (≤1 screen/s) on long English article → **0** eligible plain text blocks fully inside visual viewport remain unbound for >1 frame after entering.
- [ ] SC2: Toggle tokenize on interactive page → viewport tokens bound **<300ms** p95 on mid device (metadata may lag).
- [ ] SC3: SPA mutation path regressions = 0 vs ADR-049/050 tests + manual smoke.
- [ ] SC4: Viewport scheduler budget still yields (~16ms); no unbounded sync prepare loop.
- [ ] SC5: Unit tests for margin helper + prepare/bind separation + cold-start path pass; full unit suite green; build pass.
- [ ] SC6: Docs: idea + this spec committed; arch wiki updated when code lands; ADR-058 if architecture sticks.

## Implementation Phases (for plan/tasks)

| Phase | Name | Deliverable |
|-------|------|-------------|
| A | Baseline overscan + prepare≠bind + cache bump | FR1, FR2, FR5 |
| B | Direction-aware margin + soft unbind behind | FR3, FR2 unbind |
| C | Cold-start viewport-first | FR4 |
| D | Verify + docs/ADR | SC*, non-regression FR6/FR7 |

## Open Questions

1. Ahead depth default: `1.0 × innerHeight` vs `1.5`? (Propose **1.0** ahead / **0.25** behind, minAhead 600px, minBehind 150px.)
2. Metadata prefetch on prepare vs post-bind only? (Propose **post-bind only** in A/B; optional prepare-prefetch flag later.)
3. Scroll listener vs IO-only direction (infer from entry boundingClientRect deltas)? (Propose **rAF-coalesced scroll on window** for direction; IO stays for enter/exit.)
4. Nested scroll containers: defer?

## References

- ADR-047 Viewport-Driven Lazy Tokenization
- ADR-048 SPA activation starvation
- ADR-049 Early bind + batched metadata + incremental scan
- ADR-050 Mutation microtask fast path + real viewport budget
- Experience: `raf-mutation-fast-path-incremental-tokenize`
- Idea: `docs/ideas/predictive-viewport-tokenize.md`
