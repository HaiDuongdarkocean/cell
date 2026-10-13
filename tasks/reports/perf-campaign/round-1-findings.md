# Round 1 — Discovery findings (4 lanes, 2026-10-10)

Baseline: `tmp/perf-campaign/baseline-import.json` — EnEn 122MB dict =
11.0s upload + 27.0s parse (38s e2e), SW probe stalls up to 3.7s,
cascade delete 24s. All ms below are desktop; expect ~2-4× on phone.

## Picked for Round 1 (5 lanes, disjoint, no owned-file conflicts)

| Lane | Findings | Why now |
|---|---|---|
| `perf-import-transport` | IMP-2/XFR-2/MOT-7 decode-on-arrival + `File(parts)`; IMP-4 cap import 2→1; IMP-5/MOT-2 progress-broadcast throttle + `useJobs` same-array | kills ~570MB SW transient + stacked-peak OOM + ~80-100 JOB_EVENT fan-outs per import |
| `perf-streaming-parse` | IMP-1 byte-level top-level-array scanner (no 122MB text / ~600MB graph); IMP-3 collect multiword terms in-pass → `buildPhraseIndexForResource(terms?)` (no getAll re-read); IMP-6 `serializePhraseIndex` growable Uint8Array (stretch) | the ~1GB parse peak → ~150-200MB; second ~0.4-0.8GB phrase-index peak gone on import path |
| `perf-delete-fastpath` | deleteEntriesByResource cursor-per-record → `getAllKeys` + contiguous `IDBKeyRange` bulk delete | 24s→~1s delete; rollback after failed import also benefits |
| `perf-mp4-opfs` | XFR-1 direct-MP4 `blob→arrayBuffer→btoa→data:URL` → stream `response.body` to OPFS → `saveOpfsFile` | ~1GB transient for 200MB mp4 → bounded; fixes data: URL truncation failures |
| `perf-tokenize-mainthread` | TOK-1 score source tokenizes whole page per mutation wave → prepared-blocks only + stride-sampled signature; TOK-3 hover → full UniversalPanel re-render → skip render on no-op state; TOK-6 bandOpts reload per cue chunk → memoize in resolve cache | sustained main-thread burn during playback/scroll → near zero |

## Deferred (recorded for later rounds)

- **Owned by other agents** (flag for owner / revisit after ship): TOK-2 removed-node sweep, TOK-4 term→cue index + TOK-5 bulk status messages (both controllers), TOK-10 metadata flush allocs, MOT-3 split-view layout/backdrop, MOT-4 layout-prop transitions (shared/ui + SubtitlePanel CSS), MOT-6 playback-clock re-renders (CueList/SubtitlePanel), XFR-5 sync dict-blob re-serialize (features/sync), MOT-8 vocab/candidate mounts (vocabularyList/useCandidate).
- **Next-round candidates (unowned)**: MOT-1 adoptedStyleSheets (~250 module.css + 4.3k-line tokens re-parsed per shadow mount); MOT-5 popup double-mount (`mountPopupDictionary.ts` mounts tree twice; mountSubtitle owned); MOT-8 QueueTab row windowing + vocab `content-visibility`; XFR-3 SUBTITLE_CUES_LOADED full-array-per-chunk → delta message; XFR-4 OCR base64→structured-clone (needs Quetta spike); XFR-6 condensed-audio binary slices; true windowed `readFileBytes` streaming (post streaming-parse); `decodeText` fflate `strFromU8`→native TextDecoder on hot paths; `reorderResources` N sequential txs; `jsonArrayStrategy` throwaway count pass; `termBankStrategy` double unzip+parse.
- **Spike needed**: `Uint8Array` structured-clone over sendMessage/Port on Quetta (governs XFR-4/XFR-6 design); real-device CPU-throttle trace for MOT-1/MOT-6 ranking.

## Lane reports (raw)

4 explore subagents: import (IMP-1..6), export/transfer (XFR-1..6),
tokenize (TOK-1..10), ui-motion (MOT-1..8). Coordinator verified import +
delete + score-source claims by direct read before picking.
