# Todo: Predictive Viewport Tokenize (VDLT-Predict)

> Nguồn sự thật gốc: `tasks/plan-predictive-viewport-tokenize.md` + `docs/specs/spec-predictive-viewport-tokenize.md`.
> Orbital Badge Dictionary Trigger milestone: đã xong final checkpoint trừ việc tạo/push PR (chờ anh approve).

## Phase A — Baseline overscan + prepare≠bind + cache bump

- [~] **Task A1: Raise cache capacity tiers + extract overscan constants**
  - Acceptance: `LOW_MEMORY_CACHE_CAPACITY`/`MID_MEMORY_CACHE_CAPACITY`/`BASE_CACHE_CAPACITY` raised per spec table (150/300/500); `VIEWPORT_ROOT_MARGIN` replaced by named near-zone constant (start isotropic large, e.g. `600px` all sides) ready for direction swap in Phase B.
  - Verify: `npm run test:unit -- --testPathPattern=tokenizeCache` green; `npm run typecheck`; existing controller tests still green.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts` (constants only).
  - Scope: S.

- [ ] **Task A2: Schedule BUFFER prepare for overscan-zone blocks; bind reuses prepared tokens**
  - Acceptance: blocks entering the expanded rootMargin but not yet visible schedule `prepareBlock` at `PRIORITY_BUFFER`; `bindVisibleBlock` does not re-tokenize when `block.tokens` already set (verify + add test); viewport bind stays `PRIORITY_VIEWPORT`.
  - Verify: new unit test — prepare sets `tokens`, bind uses them, no double tokenize; `npm run test:unit -- --testPathPattern=tokenize`; `npm run build`.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts`; `src/features/tokenize/controller/webTokenizeController.test.ts`.
  - Scope: M.

- [ ] **Task A3: Soft-unbind preserves tokens — guard test**
  - Acceptance: after `unbindTokenBlock`, `block.tokens` is still populated and `block.isBound === false`; rebind does not re-tokenize. Add explicit test if none exists.
  - Verify: `npm run test:unit -- --testPathPattern=tokenSpanRenderer|tokenize`.
  - Files: `src/features/tokenize/ui/tokenSpanRenderer.test.ts` (test only; no src change unless regression found).
  - Scope: S.

### Checkpoint A
- [ ] `npm run test:unit -- --testPathPattern=tokenize` green
- [ ] `npm run typecheck` + `npm run build` green
- [ ] Manual (DevTools MCP): long English article, scroll 1–2 screens — plain flash count vs baseline

## Phase B — Direction-aware overscan + soft unbind behind

- [ ] **Task B1: Pure `resolveScrollPredictMargin` helper + unit tests**
  - Acceptance: pure function returns `{ rootMargin, direction }`; deep ahead / shallow behind; hysteresis ≥16px; min floors (minAhead 600px, minBehind 150px); `none` direction returns isotropic large margin; rootMargin string valid CSS.
  - Verify: new `scrollDirection.test.ts` covers up/down/none/bounce/min-floor; `npm run test:unit -- --testPathPattern=scrollDirection`.
  - Files: `src/features/tokenize/logic/scrollDirection.ts` (NEW); `src/features/tokenize/logic/scrollDirection.test.ts` (NEW).
  - Scope: S.

- [ ] **Task B2: rAF-coalesced scroll direction tracker in controller**
  - Acceptance: passive `scroll` listener on `window` updates `lastScrollY`/`scrollY` via `requestAnimationFrame` coalescing; no sync layout read beyond `scrollY`; listener added on `setActive(true)`, removed on disable/destroy.
  - Verify: unit test (jsdom) — scroll event updates direction state; destroy removes listener; `npm run test:unit -- --testPathPattern=tokenize`.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts`; `src/features/tokenize/controller/webTokenizeController.test.ts`.
  - Scope: M.

- [ ] **Task B3: Recreate `ViewportTracker` with asymmetric margin on direction change; re-observe blocks**
  - Acceptance: when direction changes (up↔down↔none), controller recreates `ViewportTracker` with `resolveScrollPredictMargin` output, re-observes all connected `blocks`, preserves `visibleElements` semantics (ADR-055 onEnter fires synchronously for already-intersecting); no token flash on direction flip.
  - Verify: unit test — flip direction → tracker recreated, blocks re-observed, visible set intact; `npm run test:unit -- --testPathPattern=tokenize`; `npm run build`.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts`; `src/features/tokenize/controller/webTokenizeController.test.ts`.
  - Scope: M.

### Checkpoint B
- [ ] Unit: margin helper + direction tracker + tracker recreation green
- [ ] Manual: scroll down → ahead zone visibly deeper; reverse → rebind cheap (no re-tokenize)

## Phase C — Cold-start viewport-first

- [ ] **Task C1: Split activate into viewport-bind-now + offscreen-hydrate**
  - Acceptance: `setActive(true)` scans blocks, immediately binds blocks intersecting visual viewport (+ small near margin) via `queueMicrotask`/`rAF`, then schedules offscreen prepare/observe via scheduler. Does NOT wait `HYDRATION_QUIET_MS` before first viewport bind.
  - Verify: unit test — activate with in-viewport blocks → bound within one microtask without quiet timer; `npm run test:unit -- --testPathPattern=tokenize`.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts`; `src/features/tokenize/controller/webTokenizeController.test.ts`.
  - Scope: M.

- [ ] **Task C2: Persisted-enable path binds viewport before hydration quiet window**
  - Acceptance: `initialEnabled` path still waits `window.load` for safety, but binds viewport blocks immediately after load (or immediately if `readyState === 'complete'`); `HYDRATION_QUIET_MS` + `MAX_ACTIVATION_DELAY_MS` cap only the offscreen bulk scan.
  - Verify: unit test — `readyState === 'complete'` → viewport bind fires without quiet wait; `npm run test:unit -- --testPathPattern=tokenize`; `npm run build`.
  - Files: `src/features/tokenize/controller/webTokenizeController.ts`; `src/features/tokenize/controller/webTokenizeController.test.ts`.
  - Scope: M.

### Checkpoint C
- [ ] Unit: cold-start path green
- [ ] Manual (DevTools MCP): toggle on interactive page → viewport tokens <300ms; SPA feed mutation path still no multi-second plain flash

## Phase D — Verify + docs

- [ ] **Task D1: Non-regression sweep**
  - Acceptance: mutation microtask fast path (ADR-050), cache eviction end-to-end, viewportTracker already-intersecting (ADR-055), characterData/removedNodes — all tests green; no new console errors.
  - Verify: `npm run test:unit` (full suite); `npm run typecheck`; `npm run build`; manual SPA smoke.
  - Files: tests only (fix if regression).
  - Scope: S.

- [ ] **Task D2: Update architecture docs**
  - Acceptance: `docs/2-architechture-system.md` tokenize section reflects prepare-ahead + direction margin + cold-start; `docs/0-wiki.md` ADR list updated if ADR-058 added.
  - Verify: `ls docs/adr/058*` if shipped; grep tokenize section current.
  - Files: `docs/2-architechture-system.md`; `docs/0-wiki.md` (if ADR-058).
  - Scope: S.

- [ ] **Task D3: ADR-058 (WHY only) after measured decision sticks**
  - Acceptance: ADR records WHY for direction-aware overscan + cold-start viewport-first + cache tier bump; cites measured before/after.
  - Verify: ADR file exists; wiki ADR list updated.
  - Files: `docs/adr/058-predictive-viewport-tokenize.md`; `docs/0-wiki.md`.
  - Scope: S.

### Checkpoint D
- [ ] SC1–SC6 verified
- [ ] Ready for `code-review-and-quality`
