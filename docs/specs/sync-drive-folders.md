# Spec: Drive folder layout + automatic remote GC (v4 — post-review rewrite)

> Slug: `sync-drive-folders` · Intent: `docs/intent/sync-drive-folders.md` (APPROVED) · ui_surface: no
> v1–v3 REJECTED — fixes applied: responsibility split (engine-side fenced file deletes vs provider-internal unfenced metadata hygiene — folder/migration ops cannot hold the fence); self-heal damage = contiguous-coverage check; disconnect sweep at all 3 marker seams incl. obligation drain; dead-account blobs deleted unconditionally; sweep enumerates merged namespace.

## Actor ↔ System Boundary

- **Actors**: SyncEngine push/pull/connect/disconnect paths (own all remote user-data ops), Google Drive API (external), stale-build devices (external producers writing flat-name files).
- **System**: provider-side path→folder mapping, merged dual-namespace listing, engine-side GC sweeps, provider-internal layout hygiene (move migration + empty-folder reap), own-chain self-heal.

## Responsibility split (normative — v3 blocker fix)

| Layer | Ops | Trigger | Fence |
|---|---|---|---|
| **Engine-side sweep** (`features/sync/app/`) | All user-file deletes: superseded files, stale chains, disconnect footprint, orphan blobs — via `provider.remove(logicalPath)` | throttled sweep in pull cycle; disconnect seams | every delete fenced (`deps.fence()`) |
| **Provider-internal** (`googleDriveStorageProvider`) | Move migration (metadata PATCH: rename + reparent + compare-and-delete twin resolution); empty-folder reap (re-verify empty immediately before `files.delete`); folder resolve-or-create | self-triggered inside `list`/`write`/`rootFolderId`, throttled via `this.kv` (`cleanupLegacySpace` precedent, `:495-514`) | **not** fenced — `fence()` is a device-local cycle lock (`cycleLock.ts`, kv `session`) and cannot guard cross-device races regardless; provider ops are idempotent, twin-deletes are guarded by compare-and-delete, and folder reap re-verifies emptiness at delete time |

The `StorageProvider` port is **unchanged** — no folder ops, no move op. `InMemoryStorageProvider` untouched.

## Path → folder mapping (normative)

Logical path grammar in `remotePaths.ts` is **unchanged**. The Drive provider translates each logical path to `(folderChain, leafName)` under `Tihoka Sync/`:

| Logical prefix | Folder chain under `Tihoka Sync/` | Leaf name |
|---|---|---|
| `cell-sync/v1/scopes/global/devices/<id>/` | `global/<id>` | `journal-N.json.gz` / `snapshot-N.json.gz` |
| `cell-sync/v1/scopes/profile:<lang>/devices/<id>/` | `profile-<lang>/<id>` | same |
| `cell-sync/v1/blobs/` | `blobs` | `<sha256>` |
| `cell-sync/v1/meta/routes/` | `meta/routes` | `<scope>.json` (`:`→`-` forward; **first `-` after `profile` → `:`** reverse — `profile-en-US.json` ↔ `profile:en-US.json`) |
| `cell-sync/v1/meta/blobs-needed/` | `meta/blobs-needed` | `<hash>.json` |
| `cell-sync/v1/meta/` (other files) | `meta` | `<name>` |

- `scopes`/`devices`/`v1`/`cell-sync` are grammar nodes, **not** folders — descent passes through them.
- Scope-folder classification: children of root matching `global`/`profile-*`; their children are deviceId folders; `meta`'s children are `routes`/`blobs-needed` subfolders + leaf files. Ancestor-class descent only enters recognized grammar folders — foreign folders a user created under `Tihoka Sync/` are excluded.
- **Unmapped paths** (outside `cell-sync/v1`) stay flat under root. Non-grammar files inside `cell-sync/v1/` (e.g. `cell-sync/v1/nothing/x`) are in-tree-unmapped: never foldered, listed only via flat.
- Reverse mapping reconstructs logical paths. Bound: `Scope` values containing `:` beyond position 1 (e.g. `profile:a:b`) collide with `profile:a-b` — unreachable today (langs are BCP-47); stated bound.
- Reverse mapping of files at non-grammar positions inside a mapped folder (e.g. a stray file dropped into `global/`) → excluded from `list()` results; leaf names must also match the node's grammar (`journal-\d+.json.gz` / `snapshot-\d+.json.gz` under device folders, `*.json` under `meta` subtrees, bare hash under `blobs`) — stray leaves can't produce a valid logical path.

### `list(prefix)` classification by grammar position (normative)

| Rule | Condition | Foldered side |
|---|---|---|
| ancestor | `cell-sync/v1`.startsWith(`p`) — `''`, `cell-sync`, `cell-sync/`, `cell-sync/v1` | whole-tree descent, entering only recognized grammar folders |
| in-tree | `p`.startsWith(`cell-sync/v1/`) AND the remaining segments land on a grammar node — `…/scopes/` (root scope folders), `…/scopes/<scope>/` or `…/scopes/<scope>/devices/` (that scope's device folders), `…/devices/<id>/…` (leaf folder + residual leaf-name prefix), `…/blobs/`, `…/meta/`, `…/meta/routes/`… | resolve deepest mapped folder, descend children, filter leaf names by residual prefix |
| in-tree-unmapped | `p`.startsWith(`cell-sync/v1/`) but remainder matches no grammar node | foldered side `[]`; flat query still runs |
| unmapped | none of the above | flat query only |

Every class always runs the legacy flat query and merges.

## Requirements

### Functional

REQ-1: Foldered write/read/remove with dual-namespace resolution
- Actor: SyncEngine push/pull cycle (via `StorageProvider` port)
- Goal: every remote op lands in / resolves from the foldered location; flat files left by stale builds stay reachable
- Basic flow:
  1. `write(path, blob)`: resolve-**or-create** folder chain (session id cache; 404 → invalidate + recreate — `rootFolderId` pattern), upsert by leaf name
  2. `read`/`remove`: resolve-**only** (never mint folders as a read side-effect); unresolvable → no foldered copy exists
  3. `read`: locate file in BOTH locations (foldered leaf + legacy flat name), return **newest by `modifiedTime`**, tie → foldered — stale builds may rewrite a newer flat twin (`writeRouteMarker` read-check-write)
  4. `remove`: delete from BOTH locations
- Alt: unmapped/in-tree-unmapped path → flat behavior identical to today
- Exception: folder-resolution failure → `ProviderError`; read/remove lack write's 404 retry — accepted
- Rules: verification fetches `trashed` — trashed folder/file counts as missing (`files.get` returns 200 on trashed; listings filter `trashed=false`) → recreate, never write into trash; resolve-or-create picks the **deterministic winner** among same-name sibling folders (oldest `createdTime`, tie by `id`) — concurrent creates can mint dups; descent enumerates ALL name-matching folders so files in a non-canonical dup remain listed, while writes converge on the canonical one (empty dups reaped)
- NFR refs: NFR-1, NFR-2

REQ-2: Merged dual-namespace `list(prefix)`
- Actor: pullCycle/pushCycle/snapshotPublish/obligations callers
- Goal: identical logical-path result regardless of physical location
- Basic flow:
  1. classify `p` per the grammar table
  2. **flat query**: `name contains '<p>' and <rootId> in parents`, existing `startsWith` client guard, `mimeType` in fields (root-level folders excluded)
  3. **foldered descent** (ancestor/in-tree): level-batched, `'id1' in parents or …` chunked ≤100 ids/query, `mimeType` in fields; leaf names filtered by residual prefix; logical paths reconstructed
  4. merge, dedupe by logical path — newest `modifiedTime` wins; **tie → foldered copy wins** (write is foldered-first, so equal-mtime ties favor the canonical location)
- Alt: unmapped/in-tree-unmapped → flat only
- Exception: descent failure → `ProviderError` (never silently drop the foldered namespace)
- Rules: entries sorted by path; folders never returned; `list('cell-sync/v1/scopes/<scope>/')` must descend device folders — `sweepObligation` (`obligations.ts:174`) must not see `[]` while files persist
- NFR refs: NFR-1, NFR-3

REQ-3: Legacy flat-file move migration — **provider-internal**
- Actor: provider housekeeping — triggered inside `list()` when the flat query returns `cell-sync/v1/` names, and inside `rootFolderId` post-resolution; throttled via `this.kv` `flatMigrateAt:<accountKey>` (≥1h between passes)
- Goal: relocate flat `cell-sync/v1/...` files into mapped folders — metadata-only
- Basic flow:
  1. flat listing is authoritative (merged `list()` dedupe makes twins invisible — cannot drive this)
  2. per file, compare pre-move `modifiedTime` with the foldered twin if any:
     - twin absent → `files.update` PATCH: `name=<leafName>` + `addParents=<folderId>` + `removeParents=<rootId>`
     - flat strictly newer → same PATCH, then remove the displaced foldered twin via **compare-and-delete** (below)
     - twin newer-or-equal → remove the flat twin via **compare-and-delete** (moving it would resurrect stale content via newest-wins)
  3. **compare-and-delete rule** for every twin delete: immediately before `files.delete`, re-`files.get` the victim and confirm `id` + `modifiedTime` still match the values compared in step 2 — a stale build may have updated the flat file in-place (`mediaUpdate`) between listing and delete; changed → skip delete, next pass re-decides
- Alt: no flat names → no-op; repeatable by design (stale-build stragglers swept on subsequent passes)
- Exception: 404 mid-move → skip; concurrent mover → idempotent PATCHes
- Rules: unfenced (provider-internal — fence is a **device-local** cycle lock and cannot guard cross-device races anyway; safety comes from compare-and-delete + the canonical copy always surviving by construction); never a user-visible behavior change
- Note: move bumps `modifiedTime` → TTL clocks restart for moved chains; harmless. Residual TOCTOU (flat write lands between list and PATCH) is bounded by repeat passes.

REQ-4: GC superseded files — **engine-side**
- Actor: throttled sweep inside pull cycle (KV `lastGcAt`, ≥24h)
- Goal: delete journals/snapshots a newer snapshot provably covers — every chain, not just self
- Basic flow:
  1. group merged listing per (scope, deviceId)
  2. per chain: **decode newest snapshot** (`coversSeq` lives in the snapshot body — one read/chain)
  3. delete journals `seq ≤ coversSeq` + snapshots `n < latestN` via fenced `provider.remove`
  4. provider-internal reap removes emptied folders
- Alt: snapshot-less chain → skip cover rule (fully decoded for REQ-7 instead)
- Exception: delete-not-found → ignore; decode failure → skip chain; lock loss mid-sweep → `CycleLockLostError` aborts pass
- Rules: same cover rules as `compactScopeIfNeeded` — closes the straggler hole; enumeration base = **merged REQ-2 namespace** (flat + foldered); foreign-chain decode must **not** apply the own-deviceId check — `decodeCompactionFile` (`pushCycle.ts:370-385`) rejects `file.deviceId !== deps.deviceId`, so the sweep needs a decode path without that validation or it silently no-ops on every foreign chain
- NFR refs: NFR-4

REQ-5: GC TTL-stale device chains — **engine-side**
- Actor: same sweep pass, **before REQ-7**
- Goal: delete chains whose device went silent
- Basic flow:
  1. chain ≠ own device AND newest file `modifiedTime` older than `STALE_CHAIN_TTL` (30d) → delete all files via fenced `remove` (merged-namespace paths — flat files deleted flat, foldered via leaf resolve)
  2. emptied folders reaped provider-internally
- Exception: any file younger than TTL → keep whole chain; listing gaps → skip
- Rules: never deletes own chain; sweeps only cover scopes routed to this connection (accepted bound)
- NFR refs: NFR-4

REQ-6: GC disconnect-marked account — **sweep at every marker seam, unconditionally**
- Actor/Seams — three places a marker becomes live, all with a live token:
  - **(a) writer** — `disconnect.ts` `runConnectionDisconnect` after marker write (`:163-167`), before `completeDisconnectLocally` (`:176`)
  - **(b) obligation drain** — `completePendingDisconnects` marker loop after marker write and **before the obligation's `kv.del`** (`disconnect.ts:403-413`) — covers `disconnectLocallyNow` (`:334-357`, defers the marker); `markPending` retries re-enter via the pending loop → `runConnectionDisconnect` → seam (a). The obligation's stored `connection` is a pre-revoke snapshot — ops rely on the provider's silent `tokenFor` re-auth (`:369-384`); auth failure → sweep skipped, detector seam covers
  - **(c) detector** — `SyncEngine` disconnect branch (`:256→259`, before `completeDisconnectLocally` revokes the token at `disconnect.ts:188`) — the sweep is wrapped in its own try/catch (log-only) so a throw cannot reach the `:263-270` catch and defer marker handling; covers writer/drain failure
- Goal: a dead connection's remote footprint is removed while an executor exists
- Basic flow:
  1. at any seam → **unconditionally** delete every remote file except `meta/disconnect.json` — scopes chains (merged namespace), `blobs/` **unconditionally** (no grace, no `blobs-needed` honor — the account is dead: markers are never answered, and the grace exists only for the upload→journal window `finalFlush` already closed; reconnect recovers via `reconciliation.ts:80` republish + `blobs-needed` re-issue, `pullCycle.ts:594-604`), `meta/routes/`, `meta/blobs-needed/`
  2. proceed to teardown **even if the sweep throws** — GC never blocks disconnect
- Rules: enumeration = merged REQ-2 namespace (`list('cell-sync/v1/')` covers flat+foldered); marker clock never consulted; sweeps are idempotent across concurrent executors
- **Obligation-oblivion fix** (pre-existing wedge REQ-6 would amplify into live-data deletion): the marker drain must skip + clear an obligation whose `connId` is currently connected — `connected.has(connId)` in the drain loop (`disconnect.ts:361,390-396`); today a reconnect-before-drain writes a fresh marker on a live account, which after this spec would trigger peer-side account sweeps
- Exception: writer unreachable during flush/marker write → `markPending` → sweep happens when the obligation later drains (seam b)
- NFR refs: NFR-4

REQ-7: GC orphan blobs — **engine-side**
- Actor: same sweep pass (after REQ-4/5)
- Goal: delete `blobs/<hash>` no live state references
- Basic flow:
  1. referenced set = decode all non-superseded files: per chain `coversSeq := newestSnapshot?.coversSeq ?? 0`, then newest snapshot + journals `seq > coversSeq` (snapshot-less chains decode ALL journals)
  2. union local deferred `requiredBlobHashes` via `listAllDeferred` (`syncStore.ts:62`)
  3. merged-namespace list of `blobs/` + `meta/blobs-needed/`
  4. delete iff unreferenced AND no `blobs-needed/<hash>` marker AND `modifiedTime` > `ORPHAN_BLOB_GRACE` (7d) — fenced `remove`
- Exception: **any** enumeration/decode gap → skip blob GC entirely; frozen in-flight batch refs outside the set — bounded by 7d grace; `listOpaque` rows' blob refs are not unioned (opaque rows re-defer and re-issue `blobs-needed` markers on the next pull — bounded by grace, acknowledged)
- NFR refs: NFR-4

REQ-8: Own-chain self-heal
- Actor: push cycle — scopes in `pendingBatches ∪ pendingByScope`, evaluated **before any journal write** (frozen-batch replay `pushCycle.ts:148-164` bypasses `freezeBatch`)
- Goal: republish full state when the remote chain can't deliver contiguous coverage
- Preconditions: evaluated with `beforeSeq` = the seq of the journal about to be written (for frozen-batch replay the batch's own seq, for fresh work the seq `freezeBatch` just allocated) — the seq being committed cannot already exist remotely, so coverage is required only through `beforeSeq - 1`; `SyncStore` gains a read-only `nextSeqFor` (`syncDb.ts:145`) used to surface the invariant to diagnostics
- Basic flow:
  1. per active scope, list `devices/<myId>/`; if a snapshot exists, decode it for `coversSeq` (1 list + ≤1 read per active scope per push)
  2. **damage = chain cannot deliver contiguous coverage to `beforeSeq-1`** — any of:
     - no snapshot → all journals `1..beforeSeq-1` must be present
     - snapshot `coversSeq=c` → all journals `c+1..beforeSeq-1` must be present
     - **counter-reset**: remote chain contains journal seq or snapshot coverage ≥ `beforeSeq` (IndexedDB wiped while kv `deviceId` survived — local counter restarted below remote tip; writing journal-`beforeSeq` would upsert-overwrite a historical journal → corruption)
     - newest snapshot fails to decode → damaged
     Damaged → `publishScopeSnapshot(scope, collectScopeSnapshot(scope), coversSeq = max(remoteTipSeq, beforeSeq-1))`; adoption `max(coversSeq, cursor.seq)` (`pullCycle.ts:282`) lands contiguous; a replayed journal `seq ≤ coversSeq` is skipped by peers — safe, its records are inside the republished snapshot
  3. write phase proceeds unchanged
- Alt: contiguous chain → normal path; `beforeSeq = 1` AND remote chain empty → normal path
- Exception: publish fails → journal push proceeds (peers wedge — no worse than today)
- Rules: heal check runs before the write phase; seq counter untouched; after a counter-reset heal (`coversSeq = remoteTipSeq > beforeSeq-1`), journals allocated `≤ coversSeq` are inert — peers skip them and compaction sweeps them as superseded (accepted residue, no counter-rebase surgery); `runConnectionDisconnect`'s `finalFlush` invokes `runConnectionPush` — the heal check is gated off for that call site via a new `healCheck?: boolean` flag on `ConnectionPushDeps` (wired through `pushDepsFor`), since a republished snapshot is swept seconds later by REQ-6
- NFR refs: NFR-4

### Non-functional

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | No new deps. Touch set: `googleDriveStorageProvider` + new mapping/hygiene module, `features/sync/app/` sweep module + `pullCycle`/`pushCycle`/`SyncEngine`/`disconnect` insertion points, `SyncStore` port + `syncDbStore` (`nextSeqFor`), `fakeDrive` | +resource | zero package.json delta |
| NFR-2 | Folder-id session cache, 404 self-heal, `trashed`-aware | P/R | `rootFolderId` pattern |
| NFR-3 | `list` = flat(1) + ≤1 query per descent level (chunked ≤100 parents); `listPullScopes` ≈ 4 queries typical | P | bounded by depth |
| NFR-4 | Every engine-side file delete fenced + idempotent; provider-internal ops unfenced but side-effect-free on user payloads; partial knowledge → skip | R | |

## Flows / States

```
push(scope ∈ pendingBatches ∪ pendingByScope):
  beforeSeq (seq of journal to write) → list own chain (+ decode snapshot if present)
    → contiguous coverage to beforeSeq-1? no → publishScopeSnapshot(coversSeq = max(remoteTip, beforeSeq-1))  [REQ-8]
  → frozen-batch replay → freeze → write journal (foldered) → compaction (unchanged)

pull(scope):
  merged list (flat + grammar-classed descent) [REQ-2] → decode post-cursor → apply
  → throttled sweep (≥24h): REQ-4 superseded → REQ-5 stale chains (30d) → REQ-7 orphan blobs (7d, full live decode)
    (provider-internal: move pass + folder reap inside the same list calls)

disconnect paths — REQ-6 (unconditional account sweep, keep only meta/disconnect.json):
  writer:   finalFlush → marker write → sweep → completeDisconnectLocally
  drain:    marker obligation write → sweep  (skip+clear obligation if connId reconnected)
  detector: isConnectionDisconnected → sweep → completeDisconnectLocally
```

## Function ↔ Feature

| Function | Feature(s) |
|---|---|
| Locate remote files in a folder tree | mapping module; folder resolve-or-create + session cache + `trashed` + resolve-only |
| One logical namespace over two layouts | grammar-classed dual `list` + newest-wins dedupe (tie→foldered); dual read/remove |
| Keep only live state | engine sweep (REQ-4/5/7, fenced) + disconnect sweep (REQ-6, 3 seams) |
| Keep the layout clean | provider-internal move migration + empty-folder reap (unfenced hygiene) |
| Survive chain deletion | contiguous-coverage check + `coversSeq = max(remoteTip, beforeSeq-1)` republish (REQ-8); `SyncStore.nextSeqFor` |

## Data

- Remote: same logical paths; physical layout per mapping table. Folder ids: session cache only.
- Local KV (provider namespace): `flatMigrateAt:<accountKey>` throttle; (engine namespace): `lastGcAt:<connId>`.
- Constants: `STALE_CHAIN_TTL` 30d · `ORPHAN_BLOB_GRACE` 7d · `GC_INTERVAL` 24h · `MIGRATE_INTERVAL` 1h · `PARENT_OR_CHUNK` 100.
- FakeDrive extensions: `mimeType` in `fileJson`, `parents[]` model, metadata PATCH (`name` + `addParents`/`removeParents`), OR'd `'id' in parents` parsing, `trashed` field + helper + `trashed=false` clause, seedable `modifiedTime` (TTL/grace tests), folder accessor for assertions (`filesFor` hides folders), `seedFile` into a folder, request log with PATCH bodies, `files.get` honoring `fields`.

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 foldered layout | REQ-1 | AC-1 |
| N2 no phantom-empty | REQ-1/2/3 | AC-2, AC-3 |
| N3 list semantics preserved | REQ-2 | AC-4, AC-5 |
| N4 cached/self-healing folders | REQ-1 rules | AC-7 |
| N5 deterministic `:` mapping | mapping table | AC-6 |
| N6 auto-GC exists | REQ-4..7 | AC-8 |
| N7 never delete live data + reachable disconnect sweep | REQ-4..6 | AC-8, AC-9, AC-12, AC-13 |
| N8 orphan blobs | REQ-7 | AC-10 |
| N9 self-heal republish | REQ-8 | AC-11 |

## Boundaries

- Always: logical path grammar unchanged; every **file** delete via fenced `provider.remove`; dedupe by logical path (newest, tie→foldered); skip sweep on partial enumeration; disconnect sweep never blocks teardown; provider-internal ops never touch user payload; full sync suite + contract test green on foldered FakeDrive.
- Ask first: changing TTL/grace constants; deleting `meta/disconnect.json`; new per-peer remote state.
- Never: rewrite journal/snapshot/blob payloads; persist folder ids beyond session; delete a chain with any file younger than TTL; write new flat-name files; delete blobs on incomplete referenced-set; mint folders on read/remove; leave a `blobs-needed` marker blocking the disconnect sweep.

## Success Criteria

- [ ] AC-1: `Tihoka Sync` on FakeDrive shows `global/<dev>/`, `profile-<lang>/<dev>/`, `blobs/`, `meta/` trees after normal push (folder accessor)
- [ ] AC-2: legacy flat file readable pre-move; post-move renamed to leaf in its folder (PATCH `name`+parents in request log); flat-newer move deletes displaced foldered twin; foldered-newer deletes flat twin; cursors untouched
- [ ] AC-3: stale-build flat write appears in `list()` and merges newest-wins — **Drive-adapter test** (in-memory provider is single-namespace)
- [ ] AC-4: all `list` call sites return identical logical paths on foldered FakeDrive — incl. `scopes/<scope>/` (sweepObligation), `cell-sync/v1/`, in-tree-unmapped, ancestor classes; sync suite + contract test green
- [ ] AC-5: `list('cell-sync/v1/scopes/')` ≤4 Drive queries at ≤100 folders/level
- [ ] AC-6: `profile:en` ↔ `profile-en` incl. `en-US`; `routes/profile:en.json` ↔ `meta/routes/profile-en.json` (first-dash reverse)
- [ ] AC-7: trashed folder/file → missing → recreated
- [ ] AC-8: sweep removes only rule-matching files; live fixture chain intact; concurrent sweepers clean
- [ ] AC-9: forced enumeration/decode failure → zero blob deletes; snapshot-less chain's journal blob refs counted
- [ ] AC-10: orphan-blob delete only on unreferenced + no marker + age>7d — each keep-condition tested
- [ ] AC-11: `beforeSeq>1` + non-contiguous chain (empty / lone tip journal / mid-gap wreckage / decode-failing snapshot / counter-reset with remote seq ≥ beforeSeq) → snapshot `coversSeq = max(remoteTipSeq, beforeSeq-1)` before any journal incl. frozen-batch replay; mid-cursor peer converges
- [ ] AC-12: all three REQ-6 seams sweep the footprint before teardown (marker, chains, blobs incl. unconditional delete); sweep failure still tears down; `disconnectLocallyNow` footprint swept at drain
- [ ] AC-13: marker obligation for a reconnected connId is cleared without writing the marker (no live-account sweep)
- [ ] AC-14: folder reap re-verifies emptiness immediately before `files.delete`; a file appearing mid-window is never deleted unseen (FakeDrive can force the race)
- [ ] AC-15: REQ-3 twin delete uses compare-and-delete — a flat file updated between list and delete (mtime changed) is never removed
- [ ] Gates: typecheck, lint, test:unit, build

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` + ADR for layout + GC model

## Alternatives considered

- **Port extension for folder ops** — rejected: layout is Drive-internal; `InMemoryStorageProvider` parity would leak layout into the port contract. Provider-internal hygiene + port-level file ops covers everything.
- **Lazy per-touch migration** — rejected: write-once files are never touched.
- **Marker-age grace on disconnect sweep** — rejected (v2): unreachable — every online device detects the fresh marker within minutes and tears down.
- **Keep-signals inside disconnect sweep** — rejected (v3): dead accounts never answer `blobs-needed`; grace existed only for the upload→journal window `finalFlush` closed.
- **Per-peer remote cursors** — rejected: new remote state; TTL+grace suffices.
- **Account-level format gate** — impossible: `meta/format.json` is never read at runtime.

## Open Questions / Accepted Risks

- Stale builds push flat files indefinitely; repeat move pass re-folders them — self-correcting.
- TTL-GC of a permanently-dead device discards unpulled deltas — accepted at 30d.
- Frozen in-flight batch blob refs outside REQ-7's referenced set — bounded by 7d grace.
- **Dormant-scope wedge**: heal runs only on scopes with push activity — a scope whose chain is swept while the device stays silent leaves peers at "awaiting snapshot" for that chain until the device next writes to the scope (or reconnects → reconciliation republishes). Bounded: peers' other scopes unaffected; data loss none.
- **Folder-reap TOCTOU**: a remote device's write landing in a folder between empty-check and `files.delete` would carry the file away — mitigated by immediate re-verify; residual window is sub-request-scale and self-heals via REQ-8 on the affected device.
- **Counter-reset residue**: journals allocated `≤ coversSeq` after a counter-reset heal are inert — skipped by peers, swept by compaction; no counter-rebase surgery.
- `listOpaque` blob refs not unioned into REQ-7's set — opaque rows re-defer + re-issue `blobs-needed`; bounded by grace.
- Sweep cost: full live-chain decode per scope/day — ≤~50 KB-scale gzip files/chain.
- Move migration bumps `modifiedTime` → refreshes staleness; TOCTOU between list and PATCH bounded by repeat passes.
- `profile:a:b`-style scopes collide under first-dash reverse mapping — unreachable today (BCP-47); bound stated.
