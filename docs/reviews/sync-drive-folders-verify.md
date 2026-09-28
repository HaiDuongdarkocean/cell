# Verify — sync-drive-folders

Fresh-context review of the shipped implementation (commits `7990ded4`, `4ff4f5d3` + hardening fixes) against `docs/specs/sync-drive-folders.md` (v4 approved) and `docs/adr/110-sync-drive-folders-and-remote-gc.md`.

## Verdict: PASS

All eight REQs verified in code, not just spec claims:

- **REQ-1** `driveLayout.ts` — scopes→`global|profile-<id>/<deviceId>/`, blobs→`blobs/`, meta→`meta/{routes,blobs-needed}/`; route-leaf `:`↔`-` round-trip; resolve-or-create picks canonical folder (oldest `createdTime`), trashed-aware root verify + 404 invalidate.
- **REQ-2** merged dual-namespace `list` — flat query + grammar-classed foldered descent (chunked ≤100 parents), newest-wins dedupe tie→foldered, folders never surfaced, invalid chains dropped.
- **REQ-3** lazy flat→foldered PATCH migration (rename + `addParents`+`removeParents`, never multi-parented), hourly KV throttle, compare-and-delete twins, unfenced provider-internal.
- **REQ-4/5/7** `remoteSweep.ts` — 24h per-connection throttle; superseded journals/snapshots via `coversSeq`; foreign chains stale >30d; orphan blobs referenced-set (live decode + `listAllDeferred` + `blobs-needed`) with 7d grace; decode failure → zero blob deletes; all deletes fenced.
- **REQ-6** disconnect sweep at all 3 seams (writer, obligation drain, engine detector); blobs unconditional; marker kept; reconnect clears obligation without sweeping; sweep failure doesn't block teardown.
- **REQ-8** `chainHealth.ts` — contiguous coverage through `beforeSeq-1`, corrupt-snapshot/counter-reset/mid-gap detection, heal publishes `coversSeq = max(remoteTip, beforeSeq-1)`; `healCheck:false` on finalFlush; `SyncStore.nextSeqFor` port.

## Findings (fresh-context) → disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | minor | `sweepDisconnectedFootprint` enumerated `list(conn, '')` — wider than `cell-sync/v1/` bound, could touch foreign files at `Tihoka Sync/` root | **Fixed** — enumerates `${REMOTE_ROOT}/` |
| 2 | minor | migration triggers only in `list()`, not `rootFolderId` | accepted — every pull cycle lists; spec-text divergence only |
| 3 | minor | `read`/`remove` resolve canonical folder only; file in a non-canonical dup is listed but unreachable | accepted — dup folders are only minted by concurrent creation (rare), migration deletes the losing twin's canonical copy anyway; residue self-corrects |
| 4 | minor | `reapIfEmpty` didn't evict `folderIds` session cache → stale id could shadow a concurrently recreated folder for the session | **Fixed** — cache eviction on successful reap |
| 5 | nit | superseded journals decoded into `referenced` (over-retains blobs one sweep) | accepted — conservative, self-correcting |
| 6 | nit | migration compare-and-deletes newest foldered twin only | accepted — residue only |
| 7 | nit | `chainCacheKey` joins without separator | unreachable (deviceIds are uuids) |
| 8 | nit | `remove` reaps leaf folder only, emptied ancestors survive | accepted — cosmetic |
| 9 | nit | KV throttle key names differ from spec draft | functionally equivalent |
| 10 | test gap | no test for reconnect-clearing-obligation seam (b) deleting non-marker files | accepted — seam-(a)+(c) asserted in `rebind.test.ts`/`SyncEngine.test.ts`; clear-path logic covered by review |

## Gates

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run test:unit` — **626 suites / 7524 tests pass** (sync: 44 suites / 553 tests)
- `npm run build` — ✓ 19.2s (pre-existing toolchain warnings only)
