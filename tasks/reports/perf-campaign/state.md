# Perf Campaign — mobile smoothness (coordinator state)

Coordinator: `spectrum-kingfisher` (this session). Started 2026-10-10.
Goal: dictionary import + data transfer + tokenize + UI motion run smoothly on
low-end Android (Quetta, ≥1GB RAM). Loop per user: DISCOVER(≥3) → plan →
implement(subagent) → verify(subagent) → record → next round. Stop: user only.

## Constraints (foreign in-flight work — do NOT touch)

- Pipeline items owned by other agents: `word-status-flags` (deliver,
  devin-iplus1 — active), `sync-on-use` (deliver), `player-mode-mobile-layout`
  (deliver), `design-system-atomic-rebuild` + `split-view-overlay-toggle` (analyze).
- word-status-flags file scope (plan T1–T7): `entities/dictionary/popupTypes.ts`,
  `wordStatusSemantics.ts`, `wordStatusStore.ts`, `wordStatusArbitration.ts`,
  `statusKeyControls.ts`, `webTokenizeController.ts`,
  `subtitleTokenizeController.ts`, `tokenSpanCss.ts`, `StatusRow.tsx`,
  `useCandidate.ts`, `CandidateView.tsx`, `addNoteFromMessage.ts`,
  `statusSyncService.ts`, `vocabularyList.ts`, `vocabularySource.ts`,
  `sessionEventsTap`, `useDictionaryLookup`, `comprehensionScore*`.
- Also off-limits: `src/features/sync/` (sync-on-use), subtitle split-view /
  mobile layout files, `tokens.json`, `src/shared/ui/` primitives.
- Main tree has foreign dirty files (hooks + skill infra). Commits: stage own
  paths only. Implement lanes: worktree per item under `Tihoka-worktrees/perf-*`.

## Baseline (desktop Chrome 154, spectrum-kingfisher Brave session, real pipeline)

`tmp/perf-campaign/baseline-import.json` — delete+re-import 3 tihoka dicts:

| File | Size | Upload | Parse | End-to-end | SW probe p95 during parse |
|---|---|---|---|---|---|
| COCA-60000.freq.json | 8.4MB | 0.73s (3 chunks) | 8.85s | 9.6s | 618ms |
| Macmillan-2Ed.tihoka.json | 64MB | 5.80s (21 chunks) | 10.62s | 16.5s | 1441ms |
| Macmillan-EnEn.tihoka.json | 122MB | 11.05s (39 chunks) | 26.97s | 38.2s | 794ms (max 3731ms) |
| Cascade deletes | — | — | — | 24.1s / 12.0s / 12.0s | — |

Read: per-chunk sendMessage ≈275ms fixed cost (~11MB/s effective); SW main
thread stalls up to 3.7s during parse (blocks ALL extension messaging);
cascade delete ~24s for the big dict.

## Coordinator notes — candidate bottlenecks found by direct reading

1. `resources.ts` chunk assembly: `chunks.join('')` ~162MB string + `atob`
   ~122MB binary string + per-char copy loop → ~3 copies, O(n) JS loop.
   `Uint8Array.fromBase64` exists (Chrome 133+, FF 133+) — one native pass,
   no intermediate string. Per-chunk `setProgress` → JOB_EVENT broadcast.
2. `importOrchestrator.importFile`: `readFileBytes` re-reads whole File →
   `JSON.parse(122MB)` on SW thread (the probe-stall source).
3. `phraseIndexBuilder`: `findDictionaryByResource` = `index.getAll` —
   materializes ALL entries (~300k+ rich objects) for a term-only pass; 2
   passes × `trim/normalize/lower/split×2` per entry. Multiword terms could be
   collected during the parse pass (single pass, terms only).
4. `deleteEntriesByResource`: cursor.delete() per record (~80µs × 300k = 24s).
   Entries of one import have contiguous autoincrement keys →
   `getAllKeys` + contiguous check → `store.delete(IDBKeyRange)` = one
   native bulk delete; fallback cursor when non-contiguous.
5. `decodeText` uses fflate `strFromU8` (JS) vs native `TextDecoder` already
   used at `phraseIndexCompiler.ts:546`.

## Round log

- R1 DISCOVER: 4 explore lanes + direct reading → ~20 findings in round-1-findings.md
- R1 baseline: DONE (above)
- R1 IMPLEMENT: 5 lanes in `Tihoka-worktrees/perf-*`, verified by fresh-context
  subagents, fixes applied, merged to `perf/round-1-integration` (HEAD 50253690).
  Gates: typecheck clean, 724 suites / 8574 tests, build 28s.
  - delete-fastpath: contiguous-key `IDBKeyRange` bulk delete (acb08487, 63476344)
  - import-transport: decode-on-arrival, cap imports, throttle job events,
    malformed-chunk → fail+reap (48cffed4, 303ed86f)
  - streaming-parse: per-object JSON.parse via envelope-validated scanner
    (bf9ad226, 57239d8c)
  - mp4-opfs: stream response.body → OPFS → blob-URL save; OPFS-less fallback
    (1279e2fe, 894f662c)
  - tokenize-mainthread: score prepared blocks only, signature dedupe,
    band-opts shared promise, prepared-notify (d8eb6da5, 18b80219)
- R1 RE-BENCH (`tmp/perf-campaign/round-1-after.json`, same script):

| Metric | Baseline | After R1 | Verdict |
|---|---|---|---|
| EnEn delete | 24.1s | 8.0s | −67% (residual = native range-delete + 3-index maintenance; JS side optimal) |
| 2Ed delete | 12.0s | 4.0s | −67% |
| COCA delete | 12.0s | 4.0s | −67% |
| EnEn parse | 26.97s | 29.57s | +10% slower — cost of streaming scanner (2-pass) |
| 2Ed parse | 10.62s | 13.55s | +27% slower |
| COCA parse | 8.85s | 10.21s | +15% slower |
| EnEn e2e | 38.2s | 41.4s | +8% |
| SW probe max (EnEn parse) | 3731ms | 3509ms | unchanged — stall moved to insert loop |
| Upload EnEn | 11.05s | 11.65s | flat (~285ms/chunk messaging floor) |

Honest read: peak memory wins are structural (no 122MB→~600MB object graph,
no 163MB joined base64, no whole-MP4 SW buffer) — bench measures wall-clock
only. Parse wall-clock regressed ~10-27% as the price; reclaim in R2 via
single-pass scan and moving parse+insert off the SW thread.

- R2 DISCOVER: 3 explore agents → `round-2-findings.md`; 3 lanes picked
- R2 IMPLEMENT + VERIFY (fresh-context reviews, fixes applied):
  - `perf/r2-import-loop` → merged (1be9c408): yieldToEventLoop + yields in
    scan/parse/phrase-index loops; single-pass range scan (exact total kept);
    in-pass phraseTerms kills the ~300k-row getAll (byte-identical index
    proven); delete drops redundant count scan. Verify: SHIP + 2 one-liners
    applied (typeof yield check, progress-callback try/catch) — 15c1ce0f.
  - `perf/r2-gzip-transport` → merged (0c11f3c1): `encoding:'gzip'` schema
    (backward compat), sender CompressionStream + per-chunk read (kills
    whole-file base64), receiver gunzip before File (signature safe),
    corrupt gzip → job failed + pending reaped. Verify: SHIP, NITs only.
    Measured 84% payload cut on COCA.
  - `perf/r2-ui-motion` → merged (5d96d855): adoptedStyleSheets + sheet cache
    (was ~250-file CSS join+parse per mount); transform progress fills;
    content-visibility queue rows; transform-drag path + transition
    suppression fix (was FIX-BEFORE-SHIP) — dbb24df5.
- R2 RE-BENCH (`tmp/perf-campaign/round-2-after.json`, gzip sender):

| Metric | Baseline | R1 | R2 | Verdict |
|---|---|---|---|---|
| EnEn delete | 24.1s | 8.0s | 4.0s | floor ≈ native index maintenance |
| 2Ed delete | 12.0s | 4.0s | 4.0s | same floor |
| COCA delete | 12.0s | 4.0s | 4.0s | same floor |
| EnEn upload | 11.05s (39 chunks) | 11.65s | 6.38s (6 chunks) | −42% vs base; last chunk pays gunzip |
| 2Ed upload | 5.80s | 6.06s | 6.81s | ≈ — last-chunk gunzip+File dominates |
| COCA upload | 0.73s | 0.81s | 0.39s | −47% vs base |
| **SW probe MAX (parse)** | **3731ms** | 3509ms | **968ms** | **multi-second stall DEAD** |
| EnEn parse | 26.97s | 29.57s | 36.51s | +35% wall vs base — see honest read |
| EnEn e2e | 38.2s | 41.4s | 45.4s | +19% vs base |

Honest read R2: probe-max collapse (3.7s→0.97s) is THE win — the SW now
serves messages during the entire 122MB import instead of freezing. Part of
the parse wall-clock regression is MEASUREMENT ARTIFACT: probes that used to
queue behind the stall now get served mid-parse (~25 probes × ~600-900ms of
SW time). Residual: p50 probe ~589ms because a 2000-entry batch+flush still
takes ~0.5-1s between yields — R3 can shrink batch cadence to trade a bit of
throughput for sub-500ms responsiveness. Memory wins (no 300k-row getAll,
~85% smaller transport) are structural — same caveat as R1, bench is
wall-clock only.

- PHONE BENCH (real hardware — LG V600 + Quetta, adb forward :9444,
  RELEASE build; bench extended with --cdp/--extra/raw-CDP path since Quetta
  refuses Target.createTarget → eval inside the offscreen ffmpeg doc):

| Op | Size | Phone release |
|---|---|---|
| Delete Migaku | 111k entries | 112.5s |
| Delete COCA | ~60k | 60.3s |
| Delete oald-extra | 132k | 128.6s |
| Delete oald | 132k | 128.7s |
| Delete EnEn | ~122k | 124.6s |
| Delete Cambridge | 1.5k | 4.1s |
| Upload EnEn | 122MB/39 chunks | 24.4s (~633ms/chunk) |
| Parse EnEn | 122k | 44.8s (probe max 1774ms) |
| Parse Migaku | 111k | 32-36s |
| Parse oald.zip | 3.2MB/132k term-bank | 45.6s |
| Parse oald-extra | 7MB/132k term-bank | 46.0s |
| Parse Cambridge | ~40MB | 32.3s |
| Parse COCA | 60k | 16.4s |

Phone read: delete ~1ms/entry = THE worst phone experience (60-130s
blocking) — R1 bulk-delete is the right medicine. Term-bank is absurd
per-byte (3.2MB file → 45.6s) — validates F3.1 double-parse + re-unzip.
122MB EnEn did NOT OOM on this 6GB device; low-RAM still unproven.
Upload is not the bottleneck (~640ms/chunk over adb/CDP is transport, not SW).

PHONE AFTER-BENCH — sideloaded `tmp/perf-campaign/tihoka-r2.crx` (0.1.10 =
R1+R2 build) onto Quetta via DocumentsUI picker; dicts restored afterward:

| Op | Release | R1+R2 build | Δ |
|---|---|---|---|
| Delete Migaku 111k | 112.5s | 8.1s | −93% |
| Delete oald-extra 132k | 128.6s | 4.0s | −97% |
| Delete EnEn ~122k | 124.6s | 12.1s | −90% |
| Upload EnEn | 24.4s/39 chunks | 3.8s/6 chunks | −84% (gzip) |
| Parse EnEn | 44.8s | 61.3s | +37% wall (yield/probe trade) |
| Parse oald.zip | 45.6s | 46.8s | flat — R3-B targets this |
| Parse oald-extra | 46.0s | 48.1s | flat — same |
| Parse Cambridge | 32.3s | ~same class | — |

Honest phone read: delete is the flagship win on real hardware (~10-30×).
Parse wall-clock grew — same intentional trade as desktop (SW serves
messages during import; phone probe p95 ~1.4-2.1s reflects slower per-batch
CPU — R3-A time-budgeted yields target exactly this). Migaku restore showed
a 772ms parse — a reconcile/dedupe artifact, not a real number.

## Round 3 — verify + merge + bench

**Fresh-context verify** (1 agent, sequential, ~18 min): Lane B SHIP
as-is; Lane A + Lane C each 1 MAJOR → fixed before merge:

- A `aadad204`: sender signature tail must match `_${size}_${name}` or
  recompute (forged/stale sig could drive dedupe/replace); + ordering
  comment fix + ByteWriter zero-capacity guard + tail-mismatch test.
- B `4635f631`: hoist readGenres (NIT).
- C `a5725f07`: src watcher reverted to `getFirstVideo()` —
  `lastSeenVideo` pinned polling to ad/preview <video> elements on
  multi-video pages, missing primary src changes.
- MINOR accepted: json-frequency now hard-fails on nested-array elements
  (was silent skip) — malformed input → clearer error, fine.

**Merge**: A+B merged to `perf/round-1-integration` (8f17b908, cf121b92);
only real conflict = importOrchestrator zip-reuse vs signature-reuse
(kept both). Merge-interaction fix `cceb1fa3`: termBankStrategy test
expected first flush at old BATCH_SIZE 5000 → now 2000.

**Lane C merge DEFERRED**: merge aborts — `subtitleCueEngine.ts`
(+4 sibling files) dirty from ANOTHER agent's in-flight icon-catalog
work (files touched <1min ago — agent actively running). Cannot
stash/overwrite foreign work. Lane C stays on `perf/r3-content-tax`
(2 commits) until the file frees.

**Integrated gates**: typecheck ✓, build 31.2s ✓, dictionary suites
110/110 (1888 tests) ✓. One foreign-in-flight suite
(reactSubtitleController, 46 fails — `NAV_CLUSTER_ICONS` undefined,
broken by the OTHER agent's uncommitted edit, not by perf lanes).

**R3 desktop bench** (Brave spectrum-kingfisher, same bench script):
| Metric | R2 | R3 | Δ |
|---|---|---|---|
| EnEn upload | 6.38s | 3.10s | −51% |
| EnEn parse | 36.51s | 31.30s | −14% (pipelined flush) |
| EnEn e2e | 45.4s | 36.0s | −21% |
| EnEn probe p50/p95/max | —/—/0.97s | 0.47/0.79/0.87s | small |
| 2Ed/COCA parse | 13.6/10.2s | 15.5/14.6s | +14/+43% |
| EnEn/2Ed delete | 4.0/4.0s | 8.04/8.03s | +100% ANOMALY |

Honest read: pipelined flush cut parse wall-clock ~14% and upload
halved, but probe latency barely moved — the residual stall is the
2000-entry IDB commit itself (~0.5-0.9s per tx on the SW thread), which
a CPU-side yield budget cannot fix. Next lever = smaller commit
granularity or offscreen executor (both R4 candidates). Delete ~8s for
both dicts is suspicious (4s in R2, same code path) — likely noise or
non-contiguous fallback; watch on phone re-bench.

Phone: `tihoka-r3.crx` (61MB, A+B build) pushed to Downloads —
install pending (needs Anh's picker tap on Quetta).

- R2 candidates seeded by R1 results:
  1. Parse still stalls SW ~3.5s → move parse+IDB insert to worker or yield
     per batch (probe max unchanged — the real "SW unresponsive" bug).
  2. Two-pass object scan → single pass with late/estimated total.
  3. Per-chunk sendMessage ~285ms floor → binary transfer (port/CompressionStream)
     would cut EnEn upload 11s → ~1-2s.
  4. Delete residual 4-8s = native store.delete(range) + index maintenance —
     R2 find: redundant `countEntriesByResource` scan + 4 sequential tx
     commits can still go (S/M effort); native floor remains.
     Correction vs earlier guess: deletePhraseIndex is O(1), no vocab
     cascade exists in deleteResourceCascade.
  5. Deferred from R1: MOT-1 adoptedStyleSheets, XFR-3 cue delta, MOT-5 popup
     double-mount, owner-held TOK-2/4/5, MOT-3/4/6, XFR-5.

**R3 phone bench** (LG V600, Quetta, build 0.1.10.3 = integrated A+B;
installed via the new zero-touch `phone-update.mjs` update channel —
no picker taps):

| Op | Release | R1+R2 | R3 A+B | Δ vs release |
|---|---:|---:|---:|---|
| Delete EnEn 122k | 124.6s | 12.1s | 8.0s | −94% |
| Delete oald-extra 132k | 128.6s | 4.0s | 4.0s | −97% |
| Delete oald 132k | — | — | 4.0s | — |
| Upload EnEn (gzip) | 24.4s | 3.8s | 4.1s | −83% |
| Upload oald pair | — | — | 0.50/0.98s | — |
| Parse EnEn | 44.8s | 61.3s | 47.4s | +6% |
| Parse oald | 45.6s | — | 42.8s | −6% |
| Parse oald-extra | 46.0s | — | 49.1s | +7% |
| Parse probe P95 | ~1.4-2.1s | — | 0.61-0.88s | ~−50% |

Honest read:
- EnEn parse recovered most of R1+R2's wall-clock regression
  (61.3→47.4s, near release's 44.8s) while cutting probe P95 in half —
  deadline-yield + pipelined flush is strictly better than either extreme:
  responsiveness of R2 with near-release wall-clock.
- Term-bank (oald pair) is ~flat vs release (±7%) — Lane B's
  double-parse/double-unzip removal did NOT produce the hoped-for win on
  device; ~45s per 3-7MB term-bank file remains the worst
  parse-per-byte hotspot. Likely masked by IDB commit cost dominating
  (same floor as probe stall: 2000-entry tx on SW thread).
- Delete at floor (4-8s) — native index maintenance, same as R1+R2.
- All 5 dicts restored post-bench with correct word counts.

Phone tooling now stable (`script/phone-update.mjs` + fixed
import-bench/phone-eval): Quetta quirks documented in
`.agents/skills/testing-browser-with-profile/references/phone-quetta.md` —
page-target evals don't work on this build (background tabs frozen,
extension pages zombie after restart); the reliable sender is the
offscreen doc ('other'), created on demand via live-SW
`chrome.offscreen.createDocument`; SW wakes on `am start -d <url>` VIEW
intent (webNavigation). R3 bench used this path end-to-end.

## Lane C merged + on phone (round 3 close-out)

- Lane C (`perf/r3-content-tax`) merged into `perf/round-1-integration`
  at `3976cc1a` — only conflict was `docs/2-architechture-system.md`;
  resolved keeping HEAD as base + splicing Lane C's 3 doc additions
  (subtitle cue-engine identity-gating, ResourcesPanel useJobs
  pre-filter, setCues TARGET-array wording).
- Post-merge gates: typecheck clean, subtitle+content suites 856/856,
  build 17s green.
- Phone updated 0.1.10.3 → 0.1.10.4 via `phone-update.mjs` (staged,
  applied on SW restart; verified via live-SW manifest eval after
  intent wake). Phone now runs full R3 A+B+C + concurrent HEAD work.
- Lane C perf claim is content-script/UI-side (fewer queryAllShadow
  scans, no per-chunk preloader wipe, O(n+m) cue merge) — not measurable
  by the import bench; needs a video-page session to verify on device.

## R4 candidate list (from R3 leftovers + phone truth)

1. IDB commit granularity: 2000-entry tx ≈ 0.5-0.9s SW stall — the
   remaining probe stall AND the term-bank parse floor share this root.
2. Offscreen/worker executor for parse+insert (moves both CPU and IDB
   commit off the SW thread entirely).
3. Import transport: remaining per-chunk overhead after gzip; binary
   frames / port streaming.
4. Delete-path variance (8-12s on EnEn vs 4s oald pair — index shape
   dependent?).
5. XFR-3 cue-delta protocol + Lane C on-device verification.

## R4 merged + phone-verified (build 0.1.10.5)

Three lanes merged into perf/round-1-integration (a6064c0d):
- A `e2d33067`: offscreen import executor — parse+insert moved off SW
  thread via BroadcastChannel('Tihoka-import'); heartbeat keep-alive;
  rollback parity with in-SW path; Firefox falls back in-process.
- B `7da2febc`: native TextDecoder (was fflate strFromU8), explicit
  tx.commit() per bulk batch, phraseIndexBuilder single-pass.
- C `4fcb41e5`: setCurrentTimeMs gated to consumer-mounted (was ~4Hz
  full-overlay re-render every playback second); removed-node mutation
  sweeps batched once per flush with blockElements leaf-skip set.

Phone bench (LG V600, Quetta, build 0.1.10.5 via phone-update.mjs):

| Op | R3 A+B (0.1.10.3) | R4 (0.1.10.5) |
|---|---:|---:|
| Delete EnEn 122k | 8.0s | 12.1s |
| Delete oald / oald-extra | 4.0 / 4.0s | 8.0 / 4.0s |
| Upload EnEn | 4.1s | 6.0s |
| Parse EnEn | 47.4s | 47.2s |
| Parse oald | 42.8s | 44.9s |
| Parse oald-extra | 49.1s | 47.7s |
| SW eval latency during parse | (busy — parse was on SW) | **2-4ms** |
| Offscreen eval during parse | — | 3ms idle, 89-151ms bursts |

**Honest read — the win is real but the old probe lies now:**
- stall-probe.mjs (raw CDP eval on each target) PROVES the executor
  moved: SW eval stays 2-4ms through the whole oald parse while the
  offscreen doc shows 89-151ms work bursts. Before R4 the SW itself
  carried that work.
- bench `probeP95` (760ms EnEn, 1378/1534ms oald) is now a MEASUREMENT
  ARTIFACT: the probe's RESOURCE_LIST is sent FROM the offscreen
  context — the same thread doing the import — so response delivery
  queues behind import bursts. It measures sender busyness, not SW
  responsiveness. Import-bench must probe SW-eval latency (like
  stall-probe) or send from a third context for a true signal.
- Wall-clock parse is flat (47-48s) as predicted — same work, new
  thread. The UX claim "SW responsive during import" is verified by
  direct eval latency, not by the legacy probe.
- Remaining honest unknown: real dictionary LOOKUP latency during
  import (reads `entries` store where offscreen's write txs run) —
  not yet measured; candidate for R5.
- All 5 dicts restored, word counts verified (oald pair 132014,
  EnEn 122051, Cambridge 90237, Migaku 111425).

Tooling: `tmp/perf-campaign/stall-probe.mjs` = per-target eval-latency
probe (SW vs offscreen) — the correct instrument going forward.

## R5 probe — real LOOKUP latency during import (phone, 0.1.10.5)

New instrument `tmp/perf-campaign/lookup-probe.mjs`: sends real
LOOKUP_REQUEST (term 'time') from a dedicated fresh options-page sender
(NOT the offscreen importer — avoids the sender-busyness artifact).

| Phase | Lookup latency |
|---|---|
| Idle (SW warm) | 40-70ms p50 |
| During COCA freq parse tail (~6s window) | **615-3139ms** |
| During Macmillan-2Ed parse (full ~20s) | 30-145ms |

Honest read: IDB contention DOES reach the user but is phase-dependent,
not constant — bursts up to ~3s during part of the COCA freq import,
nearly zero during the 2Ed dict import's steady write stream.
Offscreen move removed SW-thread stalls; storage-level bursts remain.
The old RESOURCE_LIST bench probe conflated this with sender-loop delay.

COCA-60000.freq.json + Macmillan-2Ed.tihoka.json imported during this
test (bench --skip-delete, new resources) — phone now has 7 resources.

## R5 implementation + phone verify (0.1.10.7)

Merged into staging worktree `perf-r5-stage` (3 lanes, integration
merge pending on foreign docs edit in main checkout):
- A `ea3b397b` transport — direct File handoff via BroadcastChannel
  (extension-origin senders skip upload entirely), windowed chunks ×4
  for content-script senders, FIFO runner queue.
- B `2d37123a` write path — defer write-tx creation until previous
  flush commits (F2), filtered unzip + per-bank buffer release (F5),
  positional sqlite get() (F6), rAF-coalesced split-view drag (F7).
- C `52c3b3c3` term-bank profile — honest finding: insert = 92% of
  term-bank wall clock, parse+transform = 6%. Worker skipped as
  predicted by gate; instrumentation kept for phone profiling.

Phone install: **0.1.10.7** via `phone-update.mjs`. Discovered +
fixed a real tooling bug: script resolved `--dist` against the
script's repo root with `path.join` — mangled absolute paths and
silently packed MAIN checkout's stale dist (pre-R4, missing
offscreen page). Earlier "ffmpeg.html failed to load" and the
dynamic-import failure on 0.1.10.6 were this stale CRX, NOT a code
regression — confirmed by ffmpeg.html loading fine on 0.1.10.7.
Script now uses `path.resolve` — absolute --dist works.

### Direct File handoff — VERIFIED on phone
- dict-oald.zip (3.3MB): fetch→File→RESOURCE_IMPORT_BEGIN
  (direct:true)→BroadcastChannel post = 525ms total kick.
  Zero upload phase (was ~4-6s + ~160MB SW buffering).
  Parse done, 132014 words, job recorded `done`.
- SW eval latency during whole import: 2-4ms (one 78ms spike at
  offscreen setup).

### F2 write-tx ordering — MEASURED, honest result: bounded, not fixed
Real LOOKUP_REQUEST probes during oald-extra term-bank import
(0.1.10.7, post-F2):

| Phase | Lookup latency |
|---|---|
| Idle (warm) | 15-17ms |
| During term-bank import (sustained) | **828-3208ms, p50 ~1.1s** |

F2 prevents read txs queueing behind TWO write batches (was the
3139ms burst source) but the floor is now ONE batch commit — and a
2000-entry write tx still takes ~1s to commit on this phone's
LevelDB. Sustained ~1s lookup stall for the whole term-bank import.
Read-tx preemption doesn't exist in IDB; options for next round:
micro-gap between write batches (let queued reads interleave, cost
= ~10% wall clock), smaller batches (more commits = more wall
clock), or accept + surface "importing" state in lookup UI.

- dict-oald-extra direct import first failed "Failed to unzip" —
  was a test-setup error (file missing on serve dir → fetch 404),
  not an F5 regression. Probe now checks response.ok.
- 7 resources intact, all word counts verified.

## R6 candidates (discovery, ≥3)
1. Interleave-gap between write-tx batches — trade ~10% wall clock
   for lookup responsiveness during import (measure both sides).
2. Lookup-during-import UX: "importing…" affordance or SW-side
   short-term cache for hot terms (bounded LRU) to bypass store.
3. Term-bank insert cost (92% of wall clock): batch size / tx
   durability tuning, or OPFS staging — needs phone profile data
   from Lane C instrumentation.
4. Animation/UI tax on phone — Lane C (R4) not yet verified on a
   real video page; measure frame drops during playback + overlay.

## R6 lane 1 — read-interleave gap, phone-verified (0.1.10.8)

Commit `5881f3b5` (stage worktree): batchProcessor waits 16ms after
each flush before creating the next write tx, so SW read txs can
queue into IDB's FIFO before write N+1 exists.

LOOKUP_REQUEST during dict-oald term-bank replace-import:

| Phase | Before gap (0.1.10.7) | With gap (0.1.10.8) |
|---|---|---|
| Steady write stream | 828-3208ms, p50 ~1.1s | **147-577ms, p50 ~400ms** |
| t=0 (replace-delete + unzip) | 3208ms | 3174ms |
| Tail (job→done transition) | 7186ms | 8033ms |

Honest read: ~3x better during the write stream — the gap works as
designed. Remaining stalls are NOT write-batch contention: the t=0
spike is the replace-delete of 132k old entries + zip inflate, and
the tail spike is post-import finalize (resource record + phrase
index commits) — different tx phases the batch gap doesn't cover.
Wall-clock cost unmeasured separately (import includes delete).
Next candidates: same interleave inside the delete loop + finalize
path, or accept tail (import-end one-shot).

## R6 lane 2 — chunked resource delete, phone-verified (0.1.10.9)

Commit `52d1ce78` (stage worktree): deleteEntriesByResource chunks
keys ≤8192/tx with 16ms interleave gaps (range delete for contiguous
chunks, per-key for interleaved). Progress now per-chunk (was
512-step on cursor path — test updated).

LOOKUP_REQUEST during dict-oald replace-import (delete+import):

| Phase | 0.1.10.8 | 0.1.10.9 |
|---|---|---|
| Head (replace-delete 132k + unzip) | 3174ms | **1555ms → 82ms next probe** |
| Steady write stream | p50 ~400ms | p50 ~460ms (range 56-864) |
| Tail (job→done) | 8033ms | ~9972ms — unchanged |

Honest read: head stall mostly gone (chunked delete interleaves
reads as designed). Tail ~10s at job completion is a DIFFERENT
mechanism — term-bank has no phrase index and updateResource is one
tiny write, so the stall is likely DICTIONARY_CHANGED fan-out to
~40 open tabs or SW post-job bookkeeping queueing the response,
not entry-store write contention. Needs a SW-eval-vs-lookup split
probe at the tail to confirm before any fix.

## R6 tail diagnosis — split probe (0.1.10.9)

tailsplit probe (SW-eval + LOOKUP alternating during same import):

- Whole run: swEval 6-25ms — SW completely free at every phase,
  including the ~10s tail. Broadcast fan-out hypothesis REJECTED
  (SW is not busy).
- Tail job→done: lookup=10265ms while swEval=25ms → storage-layer
  stall on the `entries` store, not SW queueing. Term-bank finalize
  has no phrase index and updateResource touches a different store,
  so the remaining suspects are: LevelDB post-write compaction
  holding the store, or a read herd from ~40 content-script tabs
  reacting to DICTIONARY_CHANGED. Not worth chasing further — it is
  a one-shot stall at the exact moment the import completes, after
  which lookups return to ~15ms.

## R6 lane 3 probe — term-bank insert profile ON PHONE (0.1.10.9)

Lane C instrumentation captured via offscreen console (3 runs,
dict-oald replace-imports):

| Run | total | parse | transform | insert | wait |
|---|---:|---:|---:|---:|---:|
| 1 | 54.7s | 0.4s | 1.9s | 53.5s | 0 |
| 2 | 54.6s | 0.4s | 1.7s | 53.5s | 0 |
| 3 | 62.1s | 0.4s | 1.9s | 60.9s | 0 |

insert = **97-98% of wall clock on phone** (desktop agent measured
92%) — LevelDB write commits dominate completely; parse+transform
already negligible. To cut wall clock the only lever is fewer/cheaper
write txs: larger BATCH_SIZE (fewer commits but longer per-tx read
stalls — directly trades against the R6 interleave win), or
durability/index reduction (already default durability; backwardTerm
index write is per-row cost). A batch-size bump to 8-16k is a
measurable A/B — pending decision on the speed-vs-responsiveness
tradeoff.

## R7 implementation shipped (stage `1e99ce30`) — PHONE OFFLINE

Implemented on `perf/r5-stage`, gates green (typecheck, 204 focused
tests + 3 new for visibility gate, build 21s):
- F1 `sendMessageToAllFramesInTab` → single tabs.sendMessage
  (~160→~40 IPCs per broadcast on 40 tabs).
- F4 requestRemoteCheck skipped while resource import/delete active.
- F5 washSentence sentenceKey dedupe + isConnected guard.
- F2 onDictionaryChangedVisible — hidden tabs defer re-resolve to
  visibilitychange (applied to preloader, CueList, PreviewBlock).

Phone install prepared: CRX 0.1.10.10 packed with correct key,
updates.xml updated. **Phone is physically broken/disconnected —
all R7 phone measurements PENDING.** When back: trigger update,
re-run tailsplit probe to see whether tail ~10s shrinks (F1+F2).

Blocked: merge into perf/round-1-integration still waits on foreign
docs edits (dirty 3h+, agent active as of 19:09).

## TDZ cold-start bug found + fixed (desktop-verified) — `2f366fd0`

Real-browser Lane C verification (Playwright Chromium + stage build,
mock-streaming-page) surfaced a real bug: `bindViewportNow()` runs
synchronously during `createWebTokenizeController` when initialEnabled +
readyState==='complete', BEFORE `let preparedNotifyTimer` executed →
ReferenceError inside the cold-start try/catch → every viewport block
skipped at cold-start (tokens arrived late via stability path).

Fix: hoisted the `let` into the top state block. Re-verified on real
Chromium: 335 tokens at cold-start, probe node tokenized (28), removed
node cleaned, zero extension errors. Gates: typecheck clean, 320 tests
green, build green.

Tooling incident: node_modules was found mid-broken-install (foreign
agent switched typescript→tsc6, install died). `npm install` repaired it;
binaries + .bin restored.

NOTE: TDZ bug predates perf work (in `preparedNotifyTimer` cold-start
path) — phone-visible as delayed/duplicate tokenization on fast-loading
pages. Phone verification still pending (device offline).
