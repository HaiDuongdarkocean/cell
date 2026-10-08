# Player Mode performance audit — 2026-10-08

Audit + iterative optimization of Player Mode on a low-memory device (1GB RAM phone,
CPU×6 throttle). All numbers measured on the real Brave debug profile (dictionary,
frequency, status data loaded) with a synthetic 2,400-cue VTT corpus via
`?cueScale=2400` on the mock streaming page.

## Method

- Brave debug session on port 9223, persistent profile `C:\cell-browser-sessions\brave-debug`,
  extension loaded live from `dist/` through the `ext-dist` junction.
- `node script/watch.mjs` captures console to `tmp/debug-brave/console.jsonl`.
- `tmp/perf-trace/brave-trace.mjs <label>` drives the page over CDP: waits for
  `#cell-subtitle-root`, presses `g`, samples PM overlay/tokens/longtasks/heap,
  records `PerformanceObserver` longtasks and `performance.memory`.
- Baseline measured by `git stash`-reverting the perf commits, rebuilding, reloading
  the extension in Brave via `chrome.runtime.reload()`.

## Iteration history

### Iteration 0 — baseline (v0.1.7)

Root causes found by code audit:

| # | Root cause | Cost |
|---|---|---|
| R1 | `TokenizeScheduler.schedule()` sorted insert (`findIndex`+`splice`) — O(n) per task; `setCues` enqueued ~2,400 tasks; `scheduleActive` cleared+re-enqueued the whole file every cue change | O(n²) queue churn, multi-second main-thread block |
| R2 | `CueList` effect tokenized + resolved metadata for the entire corpus in one synchronous pass | multi-second block on subtitle load |
| R3 | No gloss cache — every term re-translated over network per video | 20–60 HTTP calls/video |
| R4 | No virtualization — PM list mode mounted ~2,040 rows × ~21k token spans | DOM bomb, layout/paint proportional to corpus |

### Iteration 1 — commit f0bd11eb

Fixes (industry patterns: React Scheduler lanes, viewport-window processing, SW cache):

1. **Bucketed scheduler** — per-priority FIFO queues, O(1) insert (replaces sorted insert).
2. **Viewport-scoped preload** — idle prefetch capped to ±60 cues around playhead.
3. **Scoped CueList resolve** — only rendered/active cues; list mode chunked 250-cue
   builds, incremental map merge.
4. **SW gloss cache** — in-memory `sl|tl|term` map, 20k FIFO bound.

Measured (Brave real profile, 2,400 cues, CPU×6):

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| 'g' → PM overlay | 4.9s | 0.7s | 6.9× |
| 'g' → PM tokens | 27.8s | 7.2s | 3.8× |
| PM longtasks total | 32.1s | 10.4s | 3.1× |
| Max single longtask | 15.1s | 2.9s | 5.2× |
| Heap end | 88MB | 101MB | — |

Remaining bottleneck exposed by trace: PM still mounted 2,040 rows / 21,240 spans —
DOM render is O(corpus), not O(viewport).

### Iteration 2 — commits e608b3e1 + f274b451

Fixes:

1. **`cueScale` mock param** — synthesizes N-cue VTT on the mock streaming page for
   stress traces (test tooling only).
2. **CueList virtualization** — >80 rows mounts only the scroll window (~viewport +
   480px overscan) between estimated-height spacers; `ResizeObserver`-measured row
   heights → prefix-sum positions + binary-search window lookup; auto-align falls
   back to estimated scroll when the target row is unmounted; chunked resolve ordered
   from current cue outward, first chunk synchronous, rest via `requestIdleCallback`;
   scope-generation guard prevents cue-change races from discarding valid merges.
   **Metadata resolve still covers all cues — comprehension stats unaffected.**

Measured:

| Metric | v0.1.7 | iter 1 | iter 2 | Total vs before |
|---|---:|---:|---:|---:|
| 'g' → PM overlay | 4.9s | 0.7s | 2.4s | ~2× |
| 'g' → PM tokens | 27.8s | 7.2s | 4.9s | **5.6×** |
| Full settle | 43.5s | 21.1s | 9.0s | 4.8× |
| PM longtasks total | 32.1s | 10.4s | 5.6s | **5.7×** |
| Max single longtask | 15.1s | 2.9s | **1.3s** | **11.2×** |
| Heap end | 88MB | 101MB | **25MB** | **3.5× less** |
| Cue rows mounted | 2,040 | 2,040 | **15** | **136×** |
| PM token spans | 21,240 | 21,240 | **149** | **142×** |

DOM dimension reached >100× (142× fewer mounted spans). Heap −75% — the strongest
lever for a 1GB device. Wall-clock to first token 5.6×; worst freeze 11× smaller.

### Iteration 3 — CueList time-budgeted loop + resolve cache + emit throttle

Fixes:

1. **Time-budgeted tokenize loop** (React `workLoop`/`shouldYield` pattern) —
   replaced fixed 250-cue chunks with a per-cue loop that checks
   `performance.now()` against a 24ms deadline (min 8 cues per task). Each
   macrotask is now bounded by wall-clock time, not cue count — on a 6×-throttled
   CPU it automatically shrinks the chunk.
2. **`CueListResolveCache`** — per-scope dedupe of terms across chunks: each
   metadata leg (statuses, frequency, readings, glosses) tracks its own seen-set;
   later chunks only fetch genuinely new terms. Failed legs are not marked seen
   so retries still refetch.
3. **`onTokensResolved` throttle** — emits at most every 250ms while the scope
   streams in (each emit costs O(corpus tokens) in `handleTokensResolved` →
   flatten + `computeStats`), with an immediate emit once all rendered cues are
   covered.

Measured (Brave real profile, 2,400 cues, CPU×6):

| Metric | v0.1.7 | iter 2 | iter 3 | Total vs before |
|---|---:|---:|---:|---:|
| 'g' → PM overlay | 4.9s | 2.4s | 1.2s | **4.0×** |
| 'g' → PM tokens | 27.8s | 4.9s | 4.6s | **6.0×** |
| Full settle | 43.5s | 9.0s | 8.7s | **5.0×** |
| PM longtasks total | 32.1s | 5.6s | **2.3s** | **13.9×** |
| Max single longtask | 15.1s | 1.3s | **0.64s** | **23.4×** |
| Heap end | 88MB | 25MB | 40MB | **2.2× less** |
| Cue rows mounted | 2,040 | 15 | 15 | **136×** |
| PM token spans | 21,240 | 149 | 149 | **142×** |

### Iteration 4+ — pending

Residual bottlenecks:

- PM longtasks still 2.3s total / 0.64s max — likely IDB metadata resolve +
  `computeStats` flatten per emit + React commit. Candidates: worker-side
  tokenize, `scheduler.postTask` priorities.
- `createUnknownCueResolver` bulk-tokenizes the full corpus when `pauseOnUnknown`
  or adaptive subtitles are enabled — lazy-init candidate.
- Gloss cache is SW-memory only — lost on worker termination; IDB persist candidate.

## Test/verify trail

- `tests/unit/entrypoints/sidepanel/CueList.test.tsx` — 50 tests incl. virtualization
  suite (200 cues, <60 mounted rows, window moves on scroll).
- Gates per iteration: `npm run typecheck`, focused Jest suites, `npm run build`.
- Trace artifacts: `tmp/perf-trace/results-*.json` (gitignored).
