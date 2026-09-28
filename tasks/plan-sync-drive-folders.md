# Plan: sync-drive-folders

Spec: `docs/specs/sync-drive-folders.md` (approved, 4 review rounds) · mode: all · uiSurface: no
Build order chosen for dependency: FakeDrive first (test substrate), then mapping, provider ops, hygiene, engine sweeps, self-heal.

| # | Slice | Delivers | AC |
|---|---|---|---|
| S1 | FakeDrive extensions — `parents[]`, `mimeType`/`createdTime`/`trashed` fields, metadata PATCH (name + addParents/removeParents), OR'd `'id' in parents`, `trashed=false` clause, seedable modifiedTime, folder accessor, request log bodies, `seedFolder` | test substrate | AC-1,2,7,14,15 infra |
| S2 | `driveLayout.ts` — logical path → (folderChain, leaf) + reverse + sanitize + `list` prefix grammar classification + leaf validation | mapping | AC-6 |
| S3 | Provider foldered write/read/remove — resolve-or-create (write) vs resolve-only (read/remove), deterministic dup winner, `trashed`-aware root check, dual-namespace newest-wins/tie→foldered | REQ-1 | AC-1,7 (partial),3 |
| S4 | Merged `list(prefix)` — flat query + grammar-classed level-batched descent + logical-path dedupe | REQ-2 | AC-3,4,5 |
| S5 | Provider-internal move migration (throttled, compare-and-delete twins) + empty-folder reap | REQ-3 | AC-2,14,15 |
| S6 | Engine-side `remoteGc.ts` — KV-throttled sweep: REQ-4 superseded (foreign-chain decode w/o deviceId check), REQ-5 stale chains 30d, REQ-7 orphan blobs (full live decode + deferred + blobs-needed) | REQ-4,5,7 | AC-8,9,10 |
| S7 | REQ-6 disconnect sweep — `sweepRemoteFootprint` at 3 seams (writer / obligation drain / detector) + obligation-oblivion fix (`connected.has` skip+clear) | REQ-6 | AC-12,13 |
| S8 | REQ-8 self-heal — `SyncStore.nextSeqFor` port + `syncDbStore` impl; pre-write contiguous-coverage check (snapshot decode, counter-reset rule, decode-fail=damage); `healCheck?: false` on ConnectionPushDeps + `pushDepsFor` gate for finalFlush | REQ-8 | AC-11 |
| S9 | Docs — `2-architechture-system.md`, `0-wiki.md`, ADR-110; gates; fresh-context verify; ship | — | all |

Per-slice loop: failing test → implement → suite green → next. Gates at end: typecheck · lint · test:unit · build.
