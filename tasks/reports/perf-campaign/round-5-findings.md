# Round 5 — discovery findings (1 agent) + phone lookup probe

New phone measurement (lookup-probe.mjs, dedicated options-page sender):
- lookup idle ~40-70ms; during COCA parse tail 615-3139ms; during 2Ed
  parse 30-145ms → IDB write bursts DO reach user lookups, phase-bound.

## Lane A — transport (F1 + F4)
- F1: direct File handoff sender→offscreen via BroadcastChannel for
  chrome-extension:-origin senders (popup). Skips base64+gzip+chunk
  decode+SW buffering entirely: upload ~6s→~0, kills SW peak-memory
  (~160MB+ on EnEn) + upload-stall false-interrupt + popup-close-kills-
  upload. Fallback: chunk path for page-origin senders (BC is
  origin-scoped — verified dead end for content scripts).
  Impl: new RESOURCE_IMPORT_BEGIN (SW registers job + ensures offscreen +
  attaches listener, replies {direct:true}); sender posts import-run on
  'Tihoka-import' channel. Gate: location.protocol + BroadcastChannel.
- F4: windowed chunk upload (2-4 in-flight) — receiver already buffers
  out-of-order (resources.ts:416-424). Fixes content-script sender path.

## Lane B — write path + memory (F2 + F5 + F6 + F7)
- F2: BatchProcessor.add creates tx N+1 BEFORE awaiting tx N
  (batchProcessor.ts:40-47 → startFlush inside bulkInsert). IDB FIFO →
  a lookup read tx queues behind BOTH. Fix: await inflight THEN
  startFlush (+optional yield). Bounds lookup stall to one batch.
  Directly addresses the measured 1.3-3.1s lookup bursts.
- F5: unzipSync filter — skip non-bank/binary entries (kanji/tag banks,
  images); delete per-bank buffer after JSON.parse. Cuts peak offscreen
  RAM on fat zips — kill-risk on 1GB phones.
- F6: sqlite stmt.getAsObject() per row → positional get() —
  column-name resolution per row is the known slow path.
- F7: split-view drag forced sync layout per pointermove
  (subtitleSplitView.ts:941-949) — derive width, rAF-coalesce.

## Lane C — term-bank wall-clock (F3)
- Add timing probes first (parse vs insert split) then, if parse
  dominates: worker inside offscreen doc does unzip+decode+JSON.parse+
  transformEntry, streams StoredRow batches to main thread which only
  inserts. Precedent: transmuxWorker via workerFactory.ts:12.
  Decision gated on probe: if insert dominates, worker is pointless.

## Dead ends (do not re-propose)
- BC/OPFS for page-origin senders — origin-scoped, unreachable.
- Polling loops — all bounded windows, not a standing tax.
- JOB_EVENT fan-out — already coalesced (broadcastThrottled).
- gzipUpload full-buffer compress — subsumed by F1.
- Read-tx preemption — impossible; only queue ordering (F2).
