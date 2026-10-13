# Round 4 — discovery findings (1 agent, read-only)

Context: all R1-R3 landed on `perf/round-1-integration` (3976cc1a).
Phone truth (LG V600/Quetta): term-bank ~45s/3-7MB, probe P95
0.6-0.9s during import = IDB commit of 2000-entry txs on SW thread.

## Selected for implementation

### Lane A — F1: offscreen executor for parse+insert (TOP)
- `runImport` (background/handlers/resources.ts:144-169) runs
  `importFile` on the SW thread; `bulkInsertDictionaryEntries`
  (repositories/resourceEntryRepository.ts:49-64) does one tx per
  2000-entry batch = unyieldable clone+index bursts on the SW.
- Feasible TODAY: `chrome.offscreen` permission present; offscreen doc
  exists (`offscreen/ffmpeg.html`, reasons WORKERS+BLOBS); offscreen
  shares extension origin -> same `orca-dict-{hash}-en` IDB; dbHash via
  chrome.storage works there; `onversionchange` already handled;
  `resource-import` is maxRunning:1 -> no tx contention; crash path
  unchanged (reconcileImport rollback).
- Transport: BroadcastChannel ('Tihoka-import') carries `File` as a blob
  handle (cheap structured clone); progress back via sendMessage ->
  registry.setProgress. Fallback: OPFS handoff pattern already proven
  for ffmpeg (`ffmpegRunner.ts`, `opfsStorage.ts`).
- Firefox: `isOffscreenSupported()` false -> keep in-SW path.
- Expected: probe P95 -> near zero during import; wall-clock ~flat.
- Verify: phone probe p95 on EnEn/oald import, word-count parity,
  rollback on kill; unit test with fake-indexeddb.

### Lane B — F2 + F5 + F6 (+F7 if touched): cheap import tail wins
- F2: `decodeText` (fileDetector.ts:109-111) uses fflate `strFromU8`
  (JS) on whole files — EnEn 122MB, oald banks, jsonArray/jsonFrequency.
  Swap to native `TextDecoder` (already used at
  phraseIndexCompiler.ts:22). One-line; tests exist
  (fileDetector.test.ts:100-149). Est. seconds on phone.
- F5: `tx.commit()` never called after queuing adds in
  `bulkInsert*` — add it (Chrome 94+/FF 111+ baseline). NOTE
  `durability:'relaxed'` is already Chrome >=121 default — dead end.
- F6: `phraseIndexBuilder.ts:99-132` does 2 passes, re-normalizes +
  re-splits each term ~4x — fuse into one pass. Byte-identical index
  required (test exists).
- F7 (fold-in only): termBankStrategy flushBatch does two sequential
  commits for mixed dict+freq banks — single-tx insert if file touched.

### Lane C — F3 + F4: UI/content-thread tax
- F3: `onVideoTimeUpdate` (reactSubtitleController.ts:414-418) ->
  `mount.setCurrentTimeMs` every timeupdate (~4Hz) ->
  `SubtitlePanels.tsx:191` useState -> re-renders whole overlay subtree
  (NavCluster, SubtitleBlock, portals) — but only PlayerModeLayer
  (:369) and split-view SubtitlePanel (:471) consume it. In default
  overlay path = pure render churn every second of playback.
  Fix: gate imperative setter on consumer-mounted (playerMode ||
  splitViewOpen && portalTarget && onSeek); keep ref fresh always.
- F4: `handleRemovedNode` (webTokenizeController.ts:709-730) sweeps all
  `blocks` per removed node (O(mutations x blocks x depth), unbatched).
  Fix: `pendingRemovedNodes` queue, one sweep per flush alongside
  existing `pendingAddedNodes`; early-exit on empty blocks / leaf nodes.

## Dead ends confirmed (do NOT re-propose)
- durability:'relaxed' — already Chrome >=121 default.
- Job-event fan-out to content scripts — sendMessage only reaches
  extension contexts; progress already throttled.
- Per-cue render() — already identity-gated (subtitleTokenizeController
  :363-372).
- Smaller BATCH_SIZE alone — only shrinks the in-SW burst; moot if
  Lane A lands (kept as contingency if A rejected).
- Range-chunked delete — same native floor, no speed gain.

## Ranking
1. Lane A (F1) — removes the stall entirely, only fix that does.
2. Lane C (F3) — kills 4Hz render on every playback, trivial diff.
3. Lane B (F2) — seconds off every large import, one line.
4. F4 — real jank, unquantified.
5. F5/F6/F7 — cheap tail wins, fold into Lane B.
