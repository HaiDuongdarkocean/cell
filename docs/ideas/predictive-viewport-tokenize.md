# Predictive Viewport Tokenize (VDLT-Predict)

## Problem Statement

How might we make web + SPA tokenization feel already done in the viewport (0 plain text flash, fast enable) without janking the main thread — while accepting higher RAM if UX wins on ~1GB devices?

## Recommended Direction

Ship **VDLT-Predict** in three layers, measured against baseline after each slice:

1. **MVP baseline (simplest win)**
   - Expand overscan + raise cache capacity (direction-agnostic first).
   - Use real `PRIORITY_BUFFER` for **prepare ahead** (tokens only, no DOM).
   - Measure: plain-text flash rate when scrolling 1–2 screens on article + Facebook-like SPA.

2. **Direction-aware overscan + true prepare≠bind**
   - Track scroll delta → asymmetric `rootMargin` (deep ahead, shallow behind).
   - `prepare`: sync tokenize + optional batched metadata prefetch.
   - `bind`: DOM wrap only when block enters near-viewport / already-prepared set.
   - Soft-unbind behind scroll direction; hard-evict via LRU when over capacity.

3. **Cold-start viewport-first**
   - On enable: scan+bind **viewport only** immediately (rAF/microtask).
   - Offscreen hydrate via idle/buffer queue; keep hard max-delay cap so SPA never starves.
   - Goal: toggle → tokens in viewport feel instant; rest fills without blocking scroll.

**Not the core bet yet:** Web Worker tokenizer, full sentinel-window rewrite, mouse-trajectory prefetch (Foresight-style). Those only if measurement still shows main-thread or coverage gaps.

## Key Assumptions to Validate

- [ ] **A1:** Flash plain text today is mostly “bind starts too late / buffer too small”, not tokenizer CPU — test by increasing overscan alone.
- [ ] **A2:** Prepare-without-bind is cheap enough that 1–2 viewports ahead stays under jank budget on 1GB.
- [ ] **A3:** Direction hysteresis won’t thrash prepare/unbind on small scroll bounce.
- [ ] **A4:** Cold-start viewport-first doesn’t fight SPA hydration worse than current 500ms quiet + 3s cap.
- [ ] **A5:** Higher cache capacity improves UX more than it hurts low-RAM sessions (watch eviction + DOM span count).

## MVP Scope

**In**

- `ViewportTracker` / controller: larger + then direction-aware rootMargin
- `TokenizeScheduler`: BUFFER = prepare ahead; VIEWPORT = bind only
- `webTokenizeController`: prepare path before bind; cold-start viewport bind
- Cache capacity bump (deviceMemory tiers scaled up)
- Unit tests for scheduler priorities + direction margin math
- Metric hooks or manual DevTools checklist (token count vs scroll position)

**Out (this MVP)**

- Worker offload
- Subtitle time-window predict (same pattern later)
- Mouse/hover intent prefetch
- Rewriting scan to pure dual-sentinel virtual list

## Not Doing (and Why)

- **Worker tokenize first** — prior ADRs show bottlenecks were mutation delay + metadata batching; worker adds serialize cost before we prove CPU is the wall.
- **Isotropic huge margin only forever** — good as A/B baseline, bad long-term (wastes RAM behind user).
- **Unbind never / keep all spans** — “infinite” feel ≠ infinite DOM; soft cleanup behind direction is required.
- **Rewrite whole VDLT** — extend ADR-047 lifecycle; don’t replace working mutation fast path (ADR-050).

## Open Questions

- Exact ahead buffer: `1 × innerHeight` vs fixed `800–1200px` on short mobile viewports?
- Should metadata prefetch ride prepare (may delay first paint of color bands) or stay post-bind?
- Soft-unbind delay when user reverses scroll (keep last viewport bound how long)?
- Persist decisions as ADR-058 after MVP measures?

## Success criteria (acceptance)

| Metric | Target |
|--------|--------|
| Plain text in viewport during normal scroll | **0** (scroll ≤ ~1 screen/s) |
| Toggle enable → first viewport tokens | **felt instant** (prefer <300ms bind, metadata may lag) |
| Fast fling | May show plain at edge; catch-up ≤ ~1–2 frames after decelerate |
| Low-end | No multi-frame long tasks from prepare queue (keep ~16ms viewport budget) |

## Confirmed product inputs (idea-refine 2026-07-22)

- Pain: flash plain text khi scroll **và** chậm khi bật tokenize
- Surface: web text + SPA (cùng path); subtitle later
- Infinite feel = **0 plain trong viewport**
- RAM: tăng mạnh nếu UX win
