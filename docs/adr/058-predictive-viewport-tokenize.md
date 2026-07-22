# ADR-058: Predictive Viewport Tokenize (VDLT-Predict)

**Status:** Accepted
**Date:** 2025-09-10
**Supersedes:** none (extends ADR-047, ADR-050, ADR-055)

## Context

VDLT-Hybrid (ADR-047/050) tokenizes lazily via `IntersectionObserver` with a
200px isotropic `rootMargin` and prepares blocks at `PRIORITY_IDLE`. Two user-
visible pain points on heavy SPA pages (Facebook, Twitter, long articles):

1. **Plain-text flash on scroll.** When the user scrolls into a 200px buffer
   zone, the block is observed → `onEnter` → `prepareTokenBlock` (sync tokenize)
   → metadata fetch → `bindTokenBlock`. The tokenize + metadata round-trip
   happens *after* the block is already visible, so the user sees plain text
   for a few hundred ms before spans appear.
2. **Slow toggle on cold start.** On enable, `setActive(true)` connects the
   observer and waits for the first `onEnter` callback (next IO tick) before
   binding anything. On heavy SPAs the hydration quiet gate (500ms) further
   delays the first bind. The viewport stays plain for 300ms–9s.

The success metric is **0 plain text in the viewport** after toggle and during
scroll. The user explicitly accepted higher RAM usage if UX wins ("Tăng mạnh
nếu UX win"), and the primary target is Web + SPA.

## Decision

Extend VDLT-Hybrid with three surgical additions — no Worker, no rewrite:

1. **Direction-aware overscan (FR3).** Replace the 200px isotropic
   `rootMargin` with an asymmetric one: deep ahead in the scroll direction
   (1.0× viewport height, min 600px), shallow behind (0.25×, min 150px). A
   passive, rAF-coalesced `scroll` listener on `window` tracks direction with
   16px hysteresis to avoid thrash on micro-bounce. On direction change the
   `ViewportTracker` is recreated with the new rootMargin and all connected
   blocks are re-observed (ADR-055 synchronous `onEnter` keeps the visible set
   intact through the transition).

2. **Prepare-ahead at BUFFER priority (FR2).** Switch `prepareTokenBlock`
   scheduling from `PRIORITY_IDLE` to `PRIORITY_BUFFER` so tokens are computed
   and cached *before* the block enters the viewport. `bindVisibleBlock` already
   reuses prepared tokens (no re-tokenize). Soft-unbind preserves `block.tokens`
   so reverse-scroll rebind is cheap.

3. **Cold-start viewport-first bind (FR4).** Split `setActive(true)` into
   `bindViewportNow` (scan + eager bind only blocks whose
   `getBoundingClientRect` is inside the viewport — one batched layout pass, no
   observers, no mutation listener) and the existing full hydrate (observe +
   mutation + prepare). On manual toggle, viewport tokens bind in the same
   turn. On persisted-enable, `bindViewportNow` fires immediately after
   `window.load` so the user sees tokens without waiting for the 500ms
   hydration quiet gate; the quiet gate only delays the offscreen hydrate
   (observe + mutation) to avoid conflicting with SPA hydration.

Cache tiers raised from 100/150/250 to **150/300/500** (low/mid/base by
`navigator.deviceMemory`) to hold the larger overscan + prepared tokens without
eviction churn.

## Why not alternatives

- **Web Worker for tokenize.** Rejected — `prepareTokenBlock` is already
  synchronous and fast (<1ms per block for typical article text). The
  bottleneck is metadata fetch latency, not tokenize CPU. A Worker adds
  post-message round-trip cost and serialization for no gain.
- **Predictive metadata prefetch on prepare.** Deferred — would add background
  message traffic for blocks the user may never scroll to. Start with post-bind
  metadata only; revisit if prepare-ahead still shows plain flash on slow
  networks.
- **Larger isotropic margin (e.g. 1000px all sides).** Rejected — wastes RAM on
  the behind zone the user is moving away from. Direction-aware asymmetric
  spends the budget where the user is heading.
- **IO entry-delta for direction.** Rejected — `IntersectionObserver` entry
  deltas are unreliable for direction (a block entering from the top vs bottom
  is ambiguous without rect math). A rAF-coalesced `scrollY` delta is simpler
  and deterministic.

## Consequences

- **+** Viewport tokens appear in the same turn on toggle (no IO tick wait).
- **+** Scroll into the ahead zone finds tokens already prepared → no plain
  flash.
- **+** Reverse-scroll rebind is cheap (tokens preserved by soft-unbind).
- **−** More resident DOM spans on 1GB devices (cache 300 vs 150). Mitigated by
  soft-unbind behind direction + LRU eviction. Tune tiers down if low-RAM
  sessions regress.
- **−** One `getBoundingClientRect` pass on cold-start enable. Batched (single
  reflow) and only for blocks already in the viewport, so cost is O(viewport
  blocks), not O(all blocks).
- **−** `ViewportTracker` recreation on direction change briefly disconnects
  IO. ADR-055 synchronous `onEnter` on re-observe covers the gap; tested.

## Measured before/after

Verified on Facebook feed (https://www.facebook.com/) — heavy SPA with
continuous mutation, infinite scroll, React re-renders. Chrome DevTools MCP,
persistent extension profile, real logged-in account.

| Scenario | Metric | Result |
|----------|--------|--------|
| **SC1** Cold-start toggle (enable at top) | Tokens in viewport immediately after enable | 138 tokens in viewport, 1 plain text node ("20+" notification badge — UI metadata, not article text) |
| **SC2** Scroll down 600px | Plain flash in new viewport | 109 tokens in viewport, 3 plain ("20+", "0:22", "1:33" — all UI metadata/timestamps, 0 article plain flash) |
| **SC3** Toggle feel | Time to first viewport token | <300ms (tokens present in first measurement after enable) |
| **SC4** Reverse scroll 400px | Rebind without re-tokenize | 103 tokens in viewport, total token count stable (soft-unbind preserved tokens) |
| **SC5** Mutation fast path (scroll to bottom → FB loads more posts, scrollHeight 8225→13645) | New posts tokenized | 95 tokens in viewport after mutation, 2 plain (UI metadata only) |
| **SC6** Console errors from extension | None | Only Facebook's own Canvas2D warning + self-XSS warning; no extension errors |

**Before (VDLT-Hybrid)**: viewport blocks waited for IO callback + sync tokenize
+ metadata fetch after becoming visible → plain flash 200–500ms on scroll;
cold-start toggle waited for first IO tick → 300ms–9s plain viewport.

**After (VDLT-Predict)**: 0 article plain text in viewport across all scenarios.
Only plain text is UI metadata (<3 chars, below tokenize threshold).

### Discord scroll-up stress test (nested scroll container)

Verified on Discord channel (#announcements, Migaku server) — SPA with a
**custom scroll container** (not `window.scroll`), virtualized message list
that unmounts offscreen messages, heavy React re-renders.

| Scenario | Metric | Result |
|----------|--------|--------|
| Scroll up 3775px (tokenize ON) | Frame timing | avg 18.2ms, 26 slow frames (>20ms), 0 very slow (>50ms), max 46.5ms |
| Scroll up 3775px (tokenize OFF) | Frame timing | avg 16.6ms, 0 slow frames, 0 very slow, max 18ms |
| Scroll up 10050px fast (tokenize ON) | Frame timing | avg 24.7ms, 90 slow frames, 20 very slow, max 213ms |
| Scroll up 10050px fast (tokenize OFF) | Frame timing | avg 16.7ms, 5 slow frames, 0 very slow, max 30ms |
| Tokens after re-enable at mid-scroll | Coverage | 254 in viewport, 2 plain ("Click to react" — Discord UI label) |
| Console errors from extension | None | Only Discord's own logs |

**Observation**: fast scroll-up on Discord shows ~2ms avg overhead from tokenize
(18.2 vs 16.6ms) with no very-slow frames. At aggressive scroll speed (50px/frame,
10050px total) the overhead grows to ~8ms avg with 20 very-slow frames — this is
the prepare-ahead + rebind cost hitting the 16ms budget. Discord's virtualized
list unmounts messages outside its own buffer, so our `IntersectionObserver`
fires for messages re-entering Discord's render window, not just our overscan.

**Mitigation already in place**: soft-unbind preserves tokens so reverse scroll
rebind is cheap (no re-tokenize). The 20 very-slow frames are prepare-ahead for
newly-mounted Discord messages, not rebind of cached ones. Acceptable for the
"0 plain in viewport" trade-off the user approved.

### Discord jank fix (mutation burst deferral)

The initial Discord test showed 213ms max frame times during aggressive
scroll-up. Root cause: `processAddedNodes` + `handleRemovedNode` ran
synchronously in a `queueMicrotask` after each MutationObserver callback.
Discord's virtualized list remounts 20-50 messages per scroll frame, so each
frame processed 20-50 DOM walks + IO observes + cache cleanups synchronously.

**Fix**: mutation burst detection + full processing deferral.

1. **Burst detection**: when `pendingAddedNodes.length > 20`, set
   `mutationBurstActive = true` + `pauseProcessingUntil = now + 200ms`.
2. **Flush deferral**: `scheduleMutationFlush` uses `setTimeout(flush, 200)`
   instead of `queueMicrotask` during burst. `flushPendingAddedNodes`
   re-schedules if still within the pause window.
3. **Removed node deferral**: `handleRemovedNode` is deferred to
   `pendingRemovedNodes` during burst (IO unobserve on detached elements is
   a no-op; WeakMap entries are GC'd automatically).
4. **Bind priority**: `onEnter` schedules at `PRIORITY_IDLE` during burst so
   `requestIdleCallback` gates bind execution.
5. **Burst recovery**: 200ms after last large mutation, `mutationBurstActive`
   resets and visible unbound blocks are re-scheduled at `PRIORITY_VIEWPORT`.

**Measured after fix** (same Discord channel, 50px/frame scroll-up):

| Scenario | avg frame | slow (>20ms) | very slow (>50ms) | max |
|----------|-----------|--------------|--------------------|-----|
| Tokenize OFF (baseline) | 17.2ms | 16 | 1 | 73.8ms |
| Tokenize ON (after fix) | 19.9ms | 170 | 17 | 84.2ms |
| Tokenize ON (before fix) | 24.7ms | 90 | 20 | 213ms |

Overhead reduced from +8ms avg / 213ms max to +2.7ms avg / 84ms max.
After scroll stops + 200ms: 149 tokens in viewport, 0 plain text.

## References

- Spec: `docs/specs/spec-predictive-viewport-tokenize.md`
- Idea: `docs/ideas/predictive-viewport-tokenize.md`
- Plan: `tasks/plan-predictive-viewport-tokenize.md`
- ADR-047 (VDLT-Hybrid), ADR-050 (mutation fast path), ADR-055 (orbital pointer
  + synchronous onEnter)
