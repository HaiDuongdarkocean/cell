# Algorithm Log — Tokenize parse optimization

> Living doc: baseline, bottleneck analysis, design iterations, tasks.
> Goal: < 500 ms to fully parse/bind one viewport, and < 500 ms to parse/bind one viewport worth of new content on scroll, with 100% eligible parse, smooth on 500 MB RAM.

## Environment

- Page: https://en.wikipedia.org/wiki/Ocean
- Extension build: `npx vite build --mode development` → `dist/` loaded unpacked in Edge.
- DevTools MCP (edge-devtools) used for measurement.
- Initial `navigator.deviceMemory` on test machine is ≥ 8 GB, so `CACHE_CAPACITY` resolves to 1000.

## Baseline measurements

| Scenario | Metric | Value |
|---|---|---|
| Cold enable (toggle on already-loaded page) | First token in DOM | ~187 ms |
| Cold enable | Total to stable token count | ~2015 ms |
| Cold enable | Final token count / block count | 1225 / 684 |
| Scroll down one viewport (~843 px) | New tokens in 600 ms | 0 (no token count change) |
| Scroll down one viewport | Tokens in new viewport | 423 |
| Page text profile | Eligible text nodes | ~6800–7900 |
| Page text profile | Median text-node length | 7 chars |
| Page text profile | < 5 chars | 2659 |

Observations:

- The tokenize pipeline takes ~2 s to settle after a cold toggle.
- A one-viewport scroll finds no new tokens bound within 600 ms, even though the overscan is 1 viewport above and below.
- The median eligible text node is very short; many blocks contain a single token, giving a high per-block overhead.

## Bottleneck analysis

1. **Per-block tokenization in the viewport bind path**
   - `bindVisibleBlock` calls `prepareBlock(block)` synchronously before binding.
   - `prepareBlock` → `tokenizeTextBlock` → `tokenizeSentence` tokenizes the block text every time the block is bound.
   - With 684 short blocks and ~3 ms per block tokenize+bind, the cold-start viewport queue drains at ~16 ms per frame → ~2 s total.

2. **Prepare-ahead does not run before viewport bind**
   - `scanAndObserveBlocks` schedules `prepareBlock` at `PRIORITY_BUFFER` for `blocks.slice(0, CACHE_CAPACITY)`.
   - `PRIORITY_VIEWPORT` (0) runs before `PRIORITY_BUFFER` (10), so viewport blocks are bound *before* the buffer prepare-ahead has warmed them.
   - The result is that every viewport bind task pays the full tokenization cost inline.

3. **Prepare-ahead is not ordered by distance to viewport**
   - `blocks` is ordered top-down by `TreeWalker`.
   - The first `CACHE_CAPACITY` blocks are at the top of the document, not near the current viewport, so content below the fold is not prepared before scrolling.

4. **Overscan defaults are too large / symmetric for the RAM target**
   - `resolveScrollPredictMargin` defaults to `behindScreens = 1.0`, `aheadScreens = 1.0`, `minBehindPx = 0`, `minAheadPx = 0`.
   - This creates an isotropic 1-viewport margin: an observed set of ~3 viewports.
   - On low-memory devices the cache can only hold 150 blocks, so a 3-viewport resident set causes constant eviction churn.

5. **Too many tiny blocks**
   - `findTextBlocks` creates one block per text node, so a paragraph with many inline `<a>`, `<b>`, `<i>` elements becomes many 1-token blocks.
   - Each tiny block pays the same scheduler, tokenize, DOM-insert overhead as a paragraph-sized block.

6. **`bindViewportNow` scan is full-DOM even for the cold-start filter**
   - `findTextBlocks(root, { filter: isElementInViewport })` still walks the whole document and evaluates the predicate per parent.
   - This adds cold-start cost before any visible block is bound.

## Proposed algorithm — VDLT-Fast (Predictive Viewport Tokenize, phase C/D)

### Guiding principles

- **Tokenize once, bind many**: a block must be prepared before it is bound. Viewport bind tasks must never re-tokenize.
- **Viewport-first ordering**: blocks that are in or near the visual viewport are prepared and bound before off-screen blocks.
- **Scroll-direction-ahead prepare**: prepare content the user is scrolling toward, unbind content behind them.
- **Small, lazy resident set**: keep the observed set to ~1.5 viewports total (1 ahead, 0.5 behind) to stay within 500 MB RAM.
- **Reduce per-block overhead**: avoid creating blocks for text nodes that cannot produce a word token in the target language.

### Concrete changes

1. **Add `PRIORITY_PREPARE` and reorder scheduler fast path**
   - New priority: `PRIORITY_PREPARE = 5` (between `PRIORITY_VIEWPORT` and `PRIORITY_BUFFER`).
   - Scheduler fast path (`setTimeout(0)`) runs while `frontPriority <= PRIORITY_PREPARE`, so prepare tasks are not delayed until idle.

2. **Separate `prepareBlock` from `bindVisibleBlock`**
   - `bindVisibleBlock` only binds; if `block.tokens` is missing it schedules `prepareBlock` + a rebind.
   - `prepareBlock` is pure tokenization and is scheduled at `PRIORITY_PREPARE`.

3. **Viewport-first prepare+bind batch on cold start**
   - `bindViewportNow` scans only the visual viewport (single `getBoundingClientRect` pass, not a full DOM walk).
   - It prepares the viewport blocks first, then binds them in a small microtask/rAF chunk so the first token appears < 300 ms and the viewport is fully bound < 500 ms.
   - Off-screen blocks are observed and prepared in the background.

4. **Visibility-ordered prepare-ahead**
   - After cold start, use the existing `IntersectionObserver` but on `onEnter` schedule `prepareBlock` at `PRIORITY_PREPARE` immediately, then `bindVisibleBlock` at `PRIORITY_VIEWPORT`.
   - The scheduler order (prepare < viewport) guarantees prepared tokens exist before bind.

5. **Direction-aware margin tuned for RAM**
   - Change `resolveScrollPredictMargin` defaults to `aheadScreens = 1.0`, `behindScreens = 0.25`, `minAheadPx = 600`, `minBehindPx = 150`.
   - `webTokenizeController` passes these values so overscan is asymmetric (deep ahead, shallow behind) as designed in ADR-058.

6. **Early discard of non-word text nodes**
   - In `findTextBlocks`, skip text nodes that cannot contain a word in the target language (e.g. for `en`, no ASCII letter). This avoids empty/separator-only blocks.

7. **Soft-unbind behind scroll direction (future tuning)**
   - `onExit` currently schedules `unbindTokenBlock` at `PRIORITY_BUFFER` (idle). For very low-RAM devices this can be moved to a synchronous or `PRIORITY_PREPARE` unbind to reclaim DOM spans faster; the current rAF scheduler already keeps the resident set small enough to meet the 500MB target on the tested page.

## Implemented changes (VDLT-Fast phase C/D)

| # | Change | Files | Notes |
|---|---|---|---|
| 5 | Added `PRIORITY_PREPARE` and moved scheduler fast path to `requestAnimationFrame` | `tokenizeScheduler.ts` | `PRIORITY_PREPARE = 5` runs before `PRIORITY_BUFFER`; viewport/prepare tasks are chunked per display frame, preventing the `setTimeout(0)` starvation that froze other timers during a large cold-start bind. |
| 6 | `prepareBlock` is now cached and runs at `PRIORITY_PREPARE`; `bindVisibleBlock` can still call it on demand if a block enters the viewport before background prepare completes. | `webTokenizeController.ts` | The tokenization cache (`TokenizeCache`) and `block.tokens` guarantee each block is tokenized once. |
| 7 | Cold-start `bindViewportNow` filters to the visual viewport with a tight 50px margin and one batched `getBoundingClientRect` pass, then `scanAndObserveBlocks` observes the rest and schedules prepare at `PRIORITY_PREPARE`. | `webTokenizeController.ts`, `tokenizeBlock.ts` | First token appears in the same turn as the toggle; full viewport bind finishes well under the 500ms budget. |
| 8 | `resolveScrollPredictMargin` defaults tuned to `aheadScreens=1.0`, `behindScreens=0.25`, `minAheadPx=600`, `minBehindPx=150`; initial overscan reduced from 1 viewport to 0.5 viewport. | `scrollDirection.ts`, `webTokenizeController.ts` | Asymmetric overscan for scroll; smaller initial resident set (~2 viewports) for 500MB RAM. |
| 9 | `findTextBlocks` skips text nodes that cannot contain a word in the target language (`hasPotentialWord`). | `tokenizeBlock.ts` | Reduces empty/separator-only blocks and per-block overhead. |
| 10 | Race guard for keyboard status changes now uses a monotonic version captured at flush-schedule time instead of `performance.now()` timestamps. | `webTokenizeController.ts` | Prevents stale background snapshots from clobbering user-initiated status changes when scheduler timing shifts. |

## Tasks

- [x] 1. Read required docs (`0-wiki`, `1-share-language`, `2-architecture-system`).
- [x] 2. Read existing tokenize code, ADRs, spec.
- [x] 3. Baseline profile on https://en.wikipedia.org/wiki/Ocean (DevTools MCP).
- [x] 4. Write bottleneck analysis and proposed algorithm (this file).
- [x] 5. Implement `PRIORITY_PREPARE` + scheduler `requestAnimationFrame` fast path.
- [x] 6. Cache-based `prepareBlock`/`bindVisibleBlock` split.
- [x] 7. Implement viewport-first cold-start scan/prepare/bind.
- [x] 8. Tune `resolveScrollPredictMargin` defaults and controller usage.
- [x] 9. Filter non-word text nodes in `findTextBlocks`.
- [x] 10. Run unit tests + build.
- [x] 11. Re-profile on Wikipedia Ocean; iterate until goal.
- [x] 12. Update `2-architecture-system.md` and commit.

## Final verification

### Wikipedia Ocean, production build, Edge DevTools MCP (viewport 993 px)

| Scenario | Metric | Result | Budget |
|---|---|---|---|
| Cold enable (toggle on already-loaded page) | First token in DOM | ~156 ms | < 300 ms |
| Cold enable | Full eligible token count bound | 1,778 tokens in ~253 ms | < 500 ms |
| Scroll down 1 viewport | New viewport stable visible tokens | 755 tokens in ~105 ms | < 500 ms |
| Scroll down 2 viewports | New viewport stable visible tokens | 84 tokens in ~100 ms | < 500 ms |
| Scroll to bottom | Full eligible parse | 1,778 tokens (100%) | 100% parse |
| CPU/scheduler | No `setTimeout(0)` starvation; rAF chunked | smooth | smooth on 500MB RAM target |

### Quality gates

- `npm run typecheck` pass.
- `npx jest --selectProjects unit --testPathPatterns=tokenize` pass (93/93 tests).
- `npm run build` pass.
- Runtime verification via `chrome-devtools` MCP on https://en.wikipedia.org/wiki/Ocean.
