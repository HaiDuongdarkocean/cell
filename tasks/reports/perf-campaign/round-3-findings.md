# Perf campaign — Round 3 findings

3 explore agents + real-phone bench (LG V600 + Quetta, release build).
Phone numbers in state.md — they re-rank priorities below.

## Lane A — import throughput + responsiveness (`perf/r3-import-throughput`)

- **F1 time-budgeted yields + pipelined flush (S-M, HIGH)** — count-based
  yield can't bound ms/entry variance; deadline yield (`performance.now() ≥
  last+40ms`) bounds every burst. `baseImportStrategy.ts:87,118`,
  `jsonEntriesStrategy.ts:111,123`, `phraseIndexBuilder.ts:101,110`.
  Plus: don't await flush inside `BatchProcessor.add` (`batchProcessor.ts:31`)
  — let inflight promise fly, await at next batch/drain; IDB serializes
  same-store txs so ordering/autoincrement preserved. `BATCH_SIZE` 5000→2000
  bounds the un-yieldable add-queue burst. Expected: probe p50 589→~50-150ms;
  hides ~60 commit waits inside 36s parse.
- **F4 streaming receiver gunzip (S, MED)** — `resources.ts:444` last-chunk
  `gunzipSync(concat)` = 0.5-1s one-task (1-3s phone). fflate `Gunzip(cb)`
  streaming: push each decoded chunk on arrival → inflate spreads across
  chunk tasks; kills concat copy too. Errors surface per-push → existing
  markFailed path.
- **F6 micro-wins (S)** — signature computed twice (client `resourceClient.ts:203`
  + SW `importOrchestrator.ts:55`; head read twice — `computeSignatureFromHead`
  exists :37; job params already carry signature `resources.ts:379` → skip SW
  compute). `serializePhraseIndex` per-byte `chunks:number[]` push
  (`phraseIndexCompiler.ts:228-267`) + `new TextEncoder()` per token (:541) —
  R2-A3 logged but never shipped: ~5MB → ~20-40MB array churn. Growable
  Uint8Array + module encoder.

## Lane B — term-bank + sqlite + jsonFrequency (`perf/r3-format-hotspots`)

Phone: 3.2MB oald.zip → 45.6s = worst per-byte import.

- **F3.1 termBankStrategy (S-M, HIGH on phone)** — `countBankEntries` (:87-105)
  full `JSON.parse(decodeText())` per bank file just to count; then
  `parseTermBanks`/`parseTermMetaBanks` (:116,145) parse each bank AGAIN → 2×
  whole-graph materialization, each an uninterruptible task. Also
  `unzipAll(this.data)` (:56) re-inflates the zip the orchestrator already
  unzipped for sniffing (`importOrchestrator.ts:88`). Fixes: drop count pass →
  cumulative `setTotal` per bank (supported, `batchProcessor.ts:26`); pass
  sniffed files map through `strategyFactory.ts:23` (one inflate saved).
- **F3.2 sqliteStrategy (S, MED)** — `db.exec('SELECT …')` (:138,161)
  materializes whole result set in one sync call → `db.prepare`+`stmt.step()`
  yields row-by-row into the existing generator. Drop `dbData` ref after
  `new SQL.Database` (:85) — frees ~file-size.
- **F3.3 jsonFrequencyStrategy (S, MED)** — `:55` whole-file JSON.parse +
  dedupe Set; elements are `{…}` → `scanTopLevelJsonObjectRanges` applies
  verbatim (cheapest scanner adoption). COCA 8.4MB → kills ~150-300ms task +
  graph.

## Lane C — content-script recurring tax (`perf/r3-content-tax`)

- **C1 queryAllShadow O(DOM) TreeWalker on permanent loops (S-M, HIGH)** —
  `videoFinder.ts:20-29` walks every element per call. Hot callers:
  `episodeWatcher.ts:122` every 500ms for page lifetime; `videoOverlay.ts:101`
  `hasVideo` every 100ms; `findVideoObserver` per mutation; `pageScanner.ts:127`
  = 4 doc-level walks per debounced mutation. Fixes: `hasVideo`→`isConnected`;
  watcher fast-path on `lastSeenVideo?.isConnected`; iterate `mutations`
  addedNodes; one TreeWalker pass collecting all selectors.
- **C2 translate-chunk compound redo (S, HIGH)** — every ~1.5s translate chunk:
  engine copies both cue arrays (`subtitleCueEngine.ts:231`) → ref churn →
  `preloader.setCues` full wipe (`videoTokenPreloader.ts:251`) → re-tokenize
  61 cues + re-resolve ~1-2k terms × per chunk (~50×/movie). Fix A: element-
  compare before `[...]` copy (keeps target ref stable); Fix B: split gate at
  `contentScriptController.ts:327-342` — `setCues` only when target changed
  (native arg literally named `_nextNativeCues`, ignored).
- **C3 mergeCuesForPanel O(n²) (S, MED-HIGH)** — `subtitleMerge.ts:52-66`
  linear-scan per cue, 2×/chunk, n=1500 → ~2.25M ops. Both arrays start-sorted
  → two-pointer "live set" pass, O(n+m), identical semantics.
- **C4 small (S)** — `ResourcesPanel.tsx:433` `useJobs()` unfiltered →
  `useJobs(['resource-import','resource-delete'])` (siblings already filter).
  `OrbitalBadge.tsx:265` body RO → skip reposition when vp unchanged.
  MOT-5: `provider?: ComponentType` option on `mountReactShadow`
  (`mountReactShadow.ts:7-34`, mirrors toast host) → opt in popup + orbital
  badge; deletes double-mount workaround.
- `bookScore.ts:25` dup-term array → Set in the same pass (5 lines).

## Deferred / owner-blocked / needs Anh

- **XFR-3 cue-delta protocol (M)** — full design in agent report: auto-diff at
  `broadcastCues` chokepoint; `{from,deleteCount,updated}` + seq/frameId;
  O(n)→O(span) all hops. R4 candidate — protocol change, needs care.
- **Offscreen import executor (M)** — now feasible cheap via OPFS handoff
  (ffmpeg precedent `opfsStorage.ts`); value = probe→~0 + survives MV3 SW
  kill on phone-length parses. Recommend landing A first, revisit.
- **F2 byte-scanner** — ~244MB UTF-16 kill, M effort; do after A+B measure.
- **OWNER-BLOCKED**: `subtitleTokenizeController` internal ref-guard (handoff
  note); SRS media ArrayBuffer dies on wire (sync-on-use owner — correctness
  bug, flag); sync/export wins.
- **Needs Anh confirm**: `useDismissOnScroll` passive + toast keep-alive
  mount (`shared/ui` files).
