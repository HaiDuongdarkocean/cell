# ADR-058: Predictive Viewport Tokenize (VDLT-Predict)

## Context

Tokenize on Media (VDLT-Hybrid) already scans text blocks and binds tokens only when an IntersectionObserver reports them in the viewport. On long articles and SPA feeds this creates two UX problems:

1. **Plain text flashes when scrolling**: blocks enter the visual viewport before the scheduler can tokenize + bind them.
2. **Slow cold-start on toggle**: enabling tokenize on an already-interactive page would wait for the hydration quiet window before binding the first visible blocks.

The goal is to make tokenization feel already done in the viewport without a Worker rewrite or full-page eager bind.

## Decision

Add a predictive pipeline on top of VDLT-Hybrid with three coordinated mechanisms.

### D1 — Tiered cache capacity

Use fixed capacity tiers keyed to `navigator.deviceMemory`:

- `< 2 GiB`: 150 blocks
- `2–3 GiB` or unknown: 300 blocks
- `≥ 4 GiB`: 500 blocks

A fixed tier is simpler than the previous 1/8-RAM formula and caps the resident set so low-end devices (per AGENTS.md: ≥1 GB RAM, ≥200 k benchmark) are not swamped. Soft-unbind behind scroll direction + LRU eviction keep DOM spans bounded regardless of tier. We may raise the tiers after real RAM profiling, but the current values give enough headroom for ~1 viewport of overscan.

### D2 — Isotropic near-zone overscan before direction-aware margin

Start with a 600 px isotropic rootMargin above and below the viewport. This covers the near zone so a one-viewport scroll in either direction shows no plain text.

When the user scrolls, a rAF-coalesced passive `scroll` listener tracks `scrollY` delta with 16 px hysteresis. On a clear up/down change, the `ViewportTracker` is recreated with an asymmetric margin from `resolveScrollPredictMargin`:

- ahead: `max(1.0 × viewportHeight, 600 px)`
- behind: `max(0.25 × viewportHeight, 150 px)`
- top/right/bottom/left arranged so the deep side is in the scroll direction.

Re-observing all connected blocks synchronously preserves the already-intersecting onEnter path in `ViewportTracker`, so no token flash occurs during the margin swap.

### D3 — Prepare before bind

When a block enters the overscan rootMargin, `prepareBlock` is scheduled at `PRIORITY_PREPARE` (5) and `bindVisibleBlock` at `PRIORITY_VIEWPORT` (0). The scheduler runs viewport/prepare tasks in the next `requestAnimationFrame` frame, so tokenization happens before binding and the UI stays responsive. `prepareTokenBlock` is a no-op if `block.tokens` is already set, so scroll re-entry and rebind do not re-tokenize.

### D4 — Cold-start viewport-first

`setActive(true)` first scans and binds only blocks in the visual viewport (filtered by `getBoundingClientRect`) via `bindViewportNow`. The heavy offscreen scan, IntersectionObserver wiring, and mutation listener are deferred behind the existing `HYDRATION_QUIET_MS` / `MAX_ACTIVATION_DELAY_MS` gates. On persisted enable, the same `bindViewportNow` runs immediately after `window.load` (or instantly if `readyState === 'complete'`) so the user sees viewport tokens without waiting for the full-page quiet window.

### D5 — Soft unbind preserves tokens

`unbindTokenBlock` restores the original text node but leaves `block.tokens` intact. When the block re-enters the overscan, `prepareTokenBlock` returns early and `bindTokenBlock` reuses the cached tokens. This makes reverse-scroll rebind cheap and keeps the cache useful.

## Consequences

- **Learner**: scrolling long articles and SPA feeds feels like tokens are already present; enabling tokenize on a page shows immediate viewport results.
- **Main-thread cost**: tokenize is still synchronous and runs on the content-script main thread, but the scheduler chunks work into ~16 ms rAF slices and offscreen preparation is idle-gated. No Worker is introduced in this slice.
- **RAM trade-off**: larger cache tiers accept more resident blocks in exchange for fewer re-tokenizations. The tiers are intentionally conservative and can be tuned after real-world measurement.
- **Direction thrash**: the 16 px hysteresis and stable `lastDirection` through sub-threshold deltas prevent rapid tracker recreation on bounce.

## Alternatives considered

- **Full-page eager bind on enable**: rejected — it would block the main thread for seconds on large pages and conflict with SPA hydration.
- **Worker tokenizer**: rejected for this slice — adds message-passing complexity and does not improve the DOM bind/paint bottleneck.
- **Dual IntersectionObserver (one for overscan, one for viewport)**: rejected for the initial implementation — the single 600 px near-zone plus `bindVisibleBlock` provides the required "0 plain in viewport" feel with less state. We can revisit if the near-zone becomes too large on small viewports.
- **Keep dynamic 1/8-RAM cache capacity**: rejected — the formula produced high variance and could exceed the intended resident set on 8+ GiB devices. Fixed tiers are simpler and safer.
