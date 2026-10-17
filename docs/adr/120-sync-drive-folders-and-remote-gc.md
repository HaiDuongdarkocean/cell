# ADR-120: Foldered Google Drive layout with dual-read migration and automatic remote GC

## Status

Accepted — shipped with pipeline item `sync-drive-folders` (spec `docs/specs/sync-drive-folders.md`).

## Context

The sync remote state lived in one flat `Tihoka Sync/` Drive folder where the whole
`cell-sync/v1/...` path was embedded in the file name. Consequences:

- Chains of dead devices (reinstalls mint a fresh `deviceId`) accumulated forever —
  per-device compaction only runs while that device still pushes.
- Journals superseded by a snapshot were only pruned above the 50-file compaction
  threshold; blobs were never garbage-collected.
- No human-readable grouping: scope/device/blob files all sat in one flat listing.

Stale extension builds keep writing flat names, so a hard cut-over would corrupt
their view of remote state — they would see an empty namespace and re-push flat
files, resurrecting the mess.

## Decision

1. **Canonical folder hierarchy** (`driveLayout.ts`): `scopes/<scope>/devices/<id>/`
   becomes `global|<scopeId>/`, i.e. `global/<deviceId>/` and `profile-<lang>/<deviceId>/`;
   `blobs/<hash>` and `meta/{routes,blobs-needed}/<leaf>` map to real folders. Route
   marker leaves rename `profile:en.json` → `profile-en.json`. Out-of-grammar paths
   stay flat.
2. **Permanent dual namespace**: every read/list merges foldered + flat results
   (newest `modifiedTime` wins, exact ties favor foldered); writes always target
   the foldered location and delete competing copies; `remove` deletes both.
3. **Repeatable flat migration** (provider-internal, hourly via KV flag): flat files
   under `cell-sync/v1/` are metadata-PATCHed (rename + `addParents`/`removeParents`)
   into their chain folder — never re-uploaded. Twin conflicts compare `modifiedTime`;
   every twin deletion is compare-and-delete (re-fetch `id`+`modifiedTime` first).
4. **Engine-side fenced GC** (`remoteSweep.ts`, throttled ≥24h per connection):
   - superseded journals (`seq <= coversSeq` of the newest snapshot) and older
     snapshots per device chain, foreign chains included;
   - whole chains where every file is older than 30 days (own device excluded);
   - blob files unreferenced by all live journals/snapshots (both namespaces),
     `listAllDeferred` rows, and `blobs-needed` markers, once past a 7-day grace.
     Any listing or decode failure yields zero blob deletions for that sweep.
   - Folder reaping and migration stay provider-internal and unfenced — the cycle
     fence is device-local and cannot arbitrate cross-device races; idempotence
     and compare-and-delete carry the safety instead.
5. **Disconnect footprint sweep** at all three marker seams (writer, obligation
   drain, engine detector) — blobs included unconditionally, the disconnect marker
   itself is kept. A reconnect-before-drain clears the stale marker obligation
   instead of nuking the live account.
6. **Own-chain self-heal** (`chainHealth.ts`): before each journal write the device
   verifies its remote chain provides contiguous coverage through `seq - 1`
   (snapshot `coversSeq` plus every later journal). Missing history, undecodable
   newest snapshot, or any remote sequence/coverage `>= seq` (counter reset after
   an IndexedDB wipe) triggers a full-snapshot republish covering
   `max(remoteTip, seq - 1)` so peers' cursors converge instead of wedging at
   "awaiting snapshot". `healCheck: false` opts the disconnect `finalFlush` out.

## Consequences

- `Tihoka Sync/` is human-browsable; dead devices and superseded artifacts
  disappear without user action.
- Old builds degrade gracefully: they keep reading/writing flat files; new builds
  dual-read them and migrate on the next sweep.
- `SyncStore` gains a read-only `nextSeqFor` port; `ConnectionPushDeps` gains
  `healCheck`.
- Residual risks (accepted in spec): scope-folder name collisions for exotic
  multi-colon scope ids, and dormant scopes that never push stay unhealed until
  their next write.
