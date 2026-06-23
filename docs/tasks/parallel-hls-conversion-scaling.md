# Task Breakdown: Parallel HLS Segment-Based TS→MP4 Conversion

> See `docs/plan/parallel-hls-conversion-scaling.md` for architecture decisions,
> dependency graph, risks, open questions, and Go/No-Go gates.

---

## Phase 1: Foundation — no parallel behavior yet

---

### Task 1: Add conversion scaling settings model

**Description:**
Add persistent settings for parallel conversion mode and worker count, but do not change conversion behavior yet. This creates the config surface needed for auto/manual/off.

**Acceptance criteria:**

- [ ] Settings include `parallelConversionMode: 'auto' | 'manual' | 'off'`.
- [ ] Settings include `manualWorkerCount`.
- [ ] Settings include `parallelFallback: 'sequential' | 'save-ts'`.
- [ ] Existing default behavior remains unchanged.

**Verification:**

- [ ] Unit tests cover default settings.
- [ ] Unit tests cover loading missing/old settings.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** None

**Files likely touched:**

- `src/constants/config.ts`
- `src/types/settings.ts` or existing settings type file
- existing storage/settings service
- relevant tests

**Estimated scope:** Medium, 3–5 files

---

### Task 2: Add popup controls for auto/manual/off scaling

**Description:**
Expose advanced UI settings for parallel conversion. Initially these controls only save settings; they do not enable parallel conversion yet.

**Acceptance criteria:**

- [ ] User can select: Off, Auto, Manual.
- [ ] Manual mode shows worker count control.
- [ ] Worker count is clamped in UI to safe static bounds, e.g. 1–6.
- [ ] UI labels clearly say feature is experimental or advanced if appropriate.

**Verification:**

- [ ] Unit/component tests if existing popup tests support it.
- [ ] Manual popup check.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** Task 1

**Files likely touched:**

- `src/popup/App.tsx` or redesigned popup files
- popup CSS module(s)
- settings hook/service
- popup tests if present

**Estimated scope:** Medium, 3–5 files

---

### Task 3: Add conversion timing instrumentation

**Description:**
Add structured timing logs/metrics for conversion phases so we can compare sequential vs future parallel reliably.

Track:

- download finished time
- input.ts write complete
- conversion start
- conversion end
- fallback start/end
- save start/end
- total conversion duration

**Acceptance criteria:**

- [ ] Logs include `downloadId`, phase, durationMs.
- [ ] No secrets/URLs logged unless already existing behavior allows it.
- [ ] Timing does not change behavior.
- [ ] Conversion failure logs include phase duration.

**Verification:**

- [ ] Unit tests check timing helper or logged phase events if logger is mockable.
- [ ] Manual run shows phase timings in service worker/offscreen console.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** None

**Files likely touched:**

- `src/background/downloader.ts`
- `src/offscreen/ffmpegRunner.ts`
- maybe shared logger/helper file
- downloader tests

**Estimated scope:** Medium, 3–5 files

---

### Checkpoint 1: Foundation settings + instrumentation

- [ ] All tests pass.
- [ ] Build succeeds.
- [ ] Current sequential conversion still works.
- [ ] Settings persist correctly.
- [ ] No parallel code path active yet.

---

## Phase 2: Segment metadata foundation

---

### Task 4: Record segment byte ranges while building `input.ts`

**Description:**
During HLS download, record byte ranges for each segment appended into `input.ts`.

**Data shape:**

```ts
interface SegmentRange {
  index: number;
  startByte: number;
  endByte: number;
  size: number;
  duration?: number;
}
```

**Acceptance criteria:**

- [ ] Every successfully appended segment records one `SegmentRange`.
- [ ] `startByte` and `endByte` are contiguous and monotonic.
- [ ] Sum of segment sizes equals final `input.ts` size.
- [ ] Segment ranges are available to conversion phase.

**Verification:**

- [ ] Unit test with 3 deterministic segments verifies exact byte ranges.
- [ ] Unit test verifies missing/failed segment does not record invalid range.
- [ ] `npm run typecheck`
- [ ] targeted downloader tests

**Dependencies:** None

**Files likely touched:**

- `src/background/downloader.ts`
- possibly download state type file
- downloader tests

**Estimated scope:** Medium, 3–5 files

---

### Task 5: Persist segment range metadata in OPFS or conversion context

**Description:**
Make `segmentRanges` available to offscreen conversion. Since background/offscreen communication should avoid large payloads, store metadata near the download directory or pass compact metadata if small enough.

Preferred MVP:

```txt
downloads/{downloadId}/segment-ranges.json
```

**Acceptance criteria:**

- [ ] `segment-ranges.json` is written after segment download completes.
- [ ] Offscreen can read metadata by `downloadId`.
- [ ] Corrupt/missing metadata causes sequential fallback, not failure.
- [ ] Cleanup removes metadata with other temp files.

**Verification:**

- [ ] Unit tests for write/read metadata.
- [ ] Unit tests for missing/corrupt metadata fallback.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** Task 4

**Files likely touched:**

- `src/lib/storage/opfsStorage.ts`
- `src/background/downloader.ts`
- `src/offscreen/ffmpegRunner.ts`
- tests for storage/downloader/offscreen

**Estimated scope:** Medium, 3–5 files

---

### Task 6: Implement segment grouping by bytes

**Description:**
Given `segmentRanges` and requested worker count, group contiguous segments into near-equal byte ranges.

Example:

```txt
424MB, 310 segments, 4 workers
→ 4 groups around 106MB each
```

**Acceptance criteria:**

- [ ] Groups are contiguous.
- [ ] Groups preserve segment order.
- [ ] No segment appears in more than one group.
- [ ] Empty groups are not produced.
- [ ] Actual group count <= requested worker count.
- [ ] Groups are balanced by bytes within reasonable tolerance.

**Verification:**

- [ ] Unit tests for even segments.
- [ ] Unit tests for uneven segment sizes.
- [ ] Unit tests for requested workers > segments.
- [ ] Unit tests for one segment / zero segment edge cases.

**Dependencies:** Task 4

**Files likely touched:**

- new helper, e.g. `src/lib/converters/segmentGrouping.ts`
- tests, e.g. `tests/unit/lib/converters/segmentGrouping.test.ts`

**Estimated scope:** Small, 1–2 files

---

### Checkpoint 2: Segment range pipeline

- [ ] Existing sequential conversion still works.
- [ ] Segment metadata recorded for M3U8 downloads.
- [ ] Missing metadata gracefully falls back.
- [ ] Tests pass.
- [ ] Build succeeds.

---

## Phase 3: Safety analyzer and policy

---

### Task 7: Implement parallel scaling policy resolver

**Description:**
Resolve settings + file size + hardware concurrency + active worker budget into an intended worker count. This does not yet inspect media safety.

**Acceptance criteria:**

- [ ] `off` always resolves to sequential.
- [ ] `manual` clamps requested workers to static safe bounds.
- [ ] `auto` selects:
  - small files sequential
  - medium files up to 2 workers
  - large files up to 4 workers
  - never above max cap
- [ ] 2-core/low concurrency devices resolve to sequential.
- [ ] Existing behavior remains sequential if parallel not enabled.

**Verification:**

- [ ] Unit tests for auto thresholds.
- [ ] Unit tests for manual clamp.
- [ ] Unit tests for hardware concurrency missing/undefined.
- [ ] Unit tests for active budget limiting.

**Dependencies:** Task 1

**Files likely touched:**

- new helper, e.g. `src/lib/converters/parallelPolicy.ts`
- settings type files
- tests

**Estimated scope:** Small, 1–2 files

---

### Task 8: Implement basic HLS/TS safety analyzer

**Description:**
Analyze whether an input is eligible for experimental parallel conversion.

MVP safe criteria:

- segment metadata exists
- enough segment ranges for requested worker count
- no known playlist discontinuity metadata if available
- segment grouping possible
- codec unsupported/unknown returns not eligible

Do not attempt deep MP4 merging yet.

**Acceptance criteria:**

- [ ] Analyzer returns `{ eligible, reason, maxSafeWorkers }`.
- [ ] Missing segment metadata => not eligible.
- [ ] Insufficient safe groups => not eligible or lower worker count.
- [ ] Discontinuity flag => not eligible.
- [ ] Unsupported/unknown codec => not eligible.
- [ ] Analyzer never throws for malformed metadata; returns not eligible.

**Verification:**

- [ ] Unit tests for eligible normal case.
- [ ] Unit tests for missing/corrupt metadata.
- [ ] Unit tests for discontinuity.
- [ ] Unit tests for requested workers higher than safe groups.

**Dependencies:** Tasks 4, 5, 6, 7

**Files likely touched:**

- new helper, e.g. `src/lib/converters/parallelSafetyAnalyzer.ts`
- downloader playlist parsing if discontinuity metadata is tracked
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 9: Wire analyzer into conversion decision, still fallback sequential

**Description:**
Use the policy resolver + analyzer during conversion planning, but still always run sequential. This logs what would happen without enabling parallel.

This is "dry-run parallel planning."

**Acceptance criteria:**

- [ ] Logs show selected scaling mode.
- [ ] Logs show intended workers or reason not eligible.
- [ ] Actual conversion remains current sequential transmuxer.
- [ ] No user-visible behavior changes except optional diagnostic logs.

**Verification:**

- [ ] Unit tests confirm sequential convert callback still called.
- [ ] Unit tests confirm dry-run logs/planning for eligible and ineligible cases.
- [ ] Manual run verifies diagnostics.
- [ ] `npm test`
- [ ] `npm run build`

**Dependencies:** Tasks 7, 8

**Files likely touched:**

- `src/offscreen/ffmpegRunner.ts`
- `src/lib/converters/tsTransmuxer.ts` or wrapper
- tests

**Estimated scope:** Medium, 3–5 files

---

### Checkpoint 3: Policy and safety dry run

- [ ] User can choose auto/manual/off.
- [ ] System computes intended worker count.
- [ ] System identifies ineligible files safely.
- [ ] Conversion remains sequential.
- [ ] Diagnostics provide enough info for real samples.

---

## Phase 4: Experimental parallel prototype

**Important:** This phase should be behind a feature flag and not default.

---

### Task 10: Add experimental parallel conversion entry point

**Description:**
Add a new function, e.g.:

```ts
transmuxTsToFmp4ParallelExperimental(...)
```

It accepts:

- input file or downloadId
- segment ranges
- worker count
- output name
- progress callback

For first slice, it may use worker count = 2 only.

**Acceptance criteria:**

- [ ] Function is not used by default.
- [ ] Falls back to sequential on any unsupported condition.
- [ ] Worker count max 2 for prototype.
- [ ] Cancellation hooks are designed, even if minimal.

**Verification:**

- [ ] Unit tests confirm default path does not call experimental function.
- [ ] Unit tests confirm unsupported input falls back.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** Tasks 5, 6, 8

**Files likely touched:**

- new file `src/lib/converters/parallelTransmuxer.ts`
- `src/offscreen/ffmpegRunner.ts`
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 11: Add worker script for segment-group transmux

**Description:**
Create a worker that receives one segment group and transmuxes it sequentially internally. It must not receive a whole 100MB ArrayBuffer.

MVP design options:

Preferred memory-safe shape:

```txt
offscreen reads segment/range chunks in <=4MB pieces
→ transfers chunk ArrayBuffer to worker
→ worker pushes into mux.js
→ worker streams output events back
→ offscreen writes temp part file
```

**Acceptance criteria:**

- [ ] Worker uses one mux.js Transmuxer for its assigned group.
- [ ] Worker receives chunks incrementally.
- [ ] Input chunk size stays bounded, e.g. 4MB.
- [ ] Worker reports progress by processed bytes.
- [ ] Worker errors propagate to orchestrator.

**Verification:**

- [ ] Unit tests for worker message protocol if testable.
- [ ] Integration test with small deterministic TS fixture.
- [ ] Manual test behind feature flag.

**Dependencies:** Task 10

**Files likely touched:**

- new worker file, e.g. `src/offscreen/transmuxWorker.ts`
- message types
- worker protocol types
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 12: Write each worker output to temp OPFS part files

**Description:**
Avoid holding all fragments in memory. Each worker's emitted output should be written to:

```txt
downloads/{downloadId}/parts/part-0.fmp4
downloads/{downloadId}/parts/part-1.fmp4
...
```

**Acceptance criteria:**

- [ ] Worker output is streamed to OPFS temp part file.
- [ ] No complete part output is held in RAM.
- [ ] Temp part files are cleaned on failure/cancel/success.
- [ ] Part metadata records size, init segment presence, fragment count.

**Verification:**

- [ ] Unit tests for temp part writer.
- [ ] Unit tests for cleanup on worker error.
- [ ] Forced failure test verifies no orphan temp files.
- [ ] `npm test`

**Dependencies:** Task 11

**Files likely touched:**

- `src/lib/storage/opfsStorage.ts`
- `src/lib/converters/parallelTransmuxer.ts`
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 13: Implement streaming merge skeleton

**Description:**
Merge part files into final `output.mp4` without loading all data into memory.

MVP may initially only support strict compatible parts and fail otherwise.

**Acceptance criteria:**

- [ ] Writes init segment once.
- [ ] Streams media fragments from part files in order.
- [ ] Does not buffer whole output in memory.
- [ ] Fails closed if part metadata is incomplete.

**Verification:**

- [ ] Unit tests with synthetic MP4 part boxes.
- [ ] Test merge skips duplicate init segments.
- [ ] Test merge preserves order.
- [ ] `npm run typecheck`
- [ ] `npm test`

**Dependencies:** Task 12

**Files likely touched:**

- new file, e.g. `src/lib/converters/mp4PartMerger.ts`
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 14: Add minimal MP4 validation

**Description:**
Validate final/part MP4 structure enough to fail closed on likely corruption.

Minimum checks:

- one final init segment
- compatible codec metadata if detectable
- consistent track IDs
- monotonic `tfdt.baseMediaDecodeTime`
- non-empty `mdat`
- expected part count present

**Acceptance criteria:**

- [ ] Validator rejects missing/empty parts.
- [ ] Validator rejects duplicate/incompatible init metadata.
- [ ] Validator rejects timestamp reset/overlap.
- [ ] Validator result includes reason string.
- [ ] Parallel output is saved only after validator passes.

**Verification:**

- [ ] Unit tests with synthetic valid/invalid MP4 boxes.
- [ ] Unit tests for timestamp reset.
- [ ] Unit tests for missing mdat/moof.
- [ ] `npm test`

**Dependencies:** Task 13

**Files likely touched:**

- new file, e.g. `src/lib/converters/mp4Validator.ts`
- parallel transmuxer
- tests

**Estimated scope:** Medium, 3–5 files

---

### Checkpoint 4: Experimental parallel behind flag

- [ ] Parallel path only runs with explicit experimental setting.
- [ ] Max 2 workers.
- [ ] Failure never emits corrupt MP4.
- [ ] Temp files are cleaned.
- [ ] Sequential fallback works.
- [ ] Real sample benchmark collected.

---

## Phase 5: UX and fallback hardening

---

### Task 15: Add conversion progress phases

**Description:**
Replace fixed 85% converting stall with sub-phases:

```txt
80–83% safety scan
83–95% transmux
95–98% merge/validate
98–100% save
```

**Acceptance criteria:**

- [ ] Progress updates during scan/parallel/sequential convert.
- [ ] UI message says whether mode is sequential, parallel, fallback, or saving TS.
- [ ] Worker progress aggregates by byte weight.
- [ ] No progress jump backward unless explicitly indicating fallback.

**Verification:**

- [ ] Unit tests for progress aggregation.
- [ ] Manual popup check.
- [ ] E2E/local fixture if feasible.
- [ ] `npm test`

**Dependencies:** Tasks 3, 11

**Files likely touched:**

- `src/background/downloader.ts`
- `src/offscreen/ffmpegRunner.ts`
- message types
- popup progress UI
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 16: Implement fallback policy

**Description:**
Implement explicit fallback behavior:

```ts
parallelFallback:
  | 'sequential'
  | 'save-ts'
```

For large files, default should lean toward `save-ts` after late parallel failure to avoid worse-than-current total time.

**Acceptance criteria:**

- [ ] Early failure can fallback sequential if configured.
- [ ] Late failure can save `.ts` if configured.
- [ ] User-facing progress/status explains fallback.
- [ ] Partial output cleanup occurs before fallback.

**Verification:**

- [ ] Unit tests for fallback sequential.
- [ ] Unit tests for fallback save-ts.
- [ ] Unit tests for worker failure after partial output.
- [ ] `npm test`

**Dependencies:** Tasks 12, 15

**Files likely touched:**

- `src/background/downloader.ts`
- `src/offscreen/ffmpegRunner.ts`
- `src/lib/converters/parallelTransmuxer.ts`
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 17: Add cancellation and cleanup for parallel jobs

**Description:**
Ensure cancel/close/failure terminates workers and deletes temp files.

**Acceptance criteria:**

- [ ] Cancellation terminates active workers.
- [ ] Cancellation closes writers.
- [ ] Partial `output.mp4` and `parts/` are deleted.
- [ ] No unresolved promises hang offscreen conversion.
- [ ] Existing cancel behavior for sequential path remains working.

**Verification:**

- [ ] Unit tests for cancellation.
- [ ] Forced worker hang test if feasible.
- [ ] Manual cancel during conversion.
- [ ] `npm test`

**Dependencies:** Tasks 10–12

**Files likely touched:**

- parallel transmuxer
- offscreen runner
- opfs storage helpers
- tests

**Estimated scope:** Medium, 3–5 files

---

### Checkpoint 5: UX/fallback stable

- [ ] User sees clear status.
- [ ] Cancel works.
- [ ] Parallel failure never leaves orphan temp files.
- [ ] Fallback policy is predictable.
- [ ] Tests and build pass.

---

## Phase 6: Auto enablement and performance gates

---

### Task 18: Benchmark real sample and local fixtures

**Description:**
Benchmark sequential vs experimental parallel on:

- local deterministic fixture
- user's 424MB real-world sample
- smaller 50–150MB sample if available

**Acceptance criteria:**

- [ ] Benchmark logs include all phases.
- [ ] Sequential baseline recorded.
- [ ] Parallel 2 and 4 worker timings recorded where safe.
- [ ] Memory observations recorded manually or via available browser tools.
- [ ] Results decide whether auto can be enabled.

**Verification:**

- [ ] Manual benchmark notes.
- [ ] Existing unit tests still pass.
- [ ] E2E local fixture remains deterministic.

**Dependencies:** Checkpoint 4/5

**Files likely touched:**

- Possibly benchmark notes in existing project rules/docs only if desired
- No production code required unless adding benchmark helper

**Estimated scope:** Small

---

### Task 19: Expand worker cap from 2 to auto/manual safe limits

**Description:**
After correctness proof, allow more workers according to policy.

**Acceptance criteria:**

- [ ] Auto can select 2/4 workers.
- [ ] Manual can request up to max cap.
- [ ] Actual workers clamp to safe groups and global budget.
- [ ] Low-core devices stay sequential or low worker count.
- [ ] Concurrent downloads do not oversubscribe workers.

**Verification:**

- [ ] Unit tests for global worker budget.
- [ ] Unit tests for concurrent conversion planning.
- [ ] Manual test two large downloads if feasible.
- [ ] `npm test`

**Dependencies:** Task 18

**Files likely touched:**

- parallel policy helper
- offscreen job manager
- tests

**Estimated scope:** Medium, 3–5 files

---

### Task 20: Enable auto mode by default only after gates pass

**Description:**
If correctness/performance/memory gates pass, enable safe auto mode. Otherwise keep feature manual/experimental.

**Acceptance criteria:**

- [ ] Auto default only runs parallel for eligible files.
- [ ] Ineligible files continue sequential or `.ts` fallback.
- [ ] User can disable parallel.
- [ ] Release notes/internal comments document limitations.

**Verification:**

- [ ] Full test suite.
- [ ] Build.
- [ ] Manual real-world sample.
- [ ] Check all Go/No-Go gates.

**Dependencies:** Task 19

**Files likely touched:**

- config defaults
- settings UI
- tests

**Estimated scope:** Small to Medium

---

## Implementation Order Summary

```txt
Phase 1:
  Task 1 settings model
  Task 2 UI controls
  Task 3 timing instrumentation

Phase 2:
  Task 4 segment ranges
  Task 5 persist metadata
  Task 6 grouping logic

Phase 3:
  Task 7 scaling policy
  Task 8 safety analyzer
  Task 9 dry-run planning

Phase 4:
  Task 10 experimental parallel entry
  Task 11 worker protocol
  Task 12 temp part output
  Task 13 streaming merge
  Task 14 MP4 validation

Phase 5:
  Task 15 progress UX
  Task 16 fallback policy
  Task 17 cancellation cleanup

Phase 6:
  Task 18 benchmark
  Task 19 expand worker caps
  Task 20 enable safe auto
```

---

## Recommended Next Step

Nếu bạn muốn bắt đầu implement, mình khuyên làm **Phase 1 + Phase 2** trước:

```txt
Settings + timing + segmentRanges metadata
```

Lý do: ít rủi ro, không ảnh hưởng correctness, nhưng tạo nền bắt buộc cho mọi hướng parallel sau này.
