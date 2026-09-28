# Intent: Organize Tihoka Sync into real Drive folders + automatic cleanup

> Slug: `sync-drive-folders` · Mode: all · Source: user statement ("sắp xếp lại file — global ở ngoài, profile chia riêng ở folder con" + "cần cơ chế tự động xóa, user không rảnh xóa tay") + `docs/audits/20260928_sync-drive-efficiency.md` F5
> ui_surface: no
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | The `Tihoka Sync` Drive folder is a flat wall of files whose names embed fake paths (`cell-sync/v1/scopes/profile:en/devices/<id>/journal-8.json.gz`) — the user cannot see which scope/device a file belongs to, cannot inspect or verify sync state, and cannot tidy it | `googleDriveStorageProvider.ts:265-285` — every `path` becomes a flat file **name** under one root folder; `list()` is `name contains '<prefix>'` + client-side `startsWith` | high |
| Change | Fake-path filenames → real Drive folder tree: global-scope files at the sync root, each profile scope in its own subfolder, blobs/meta in dedicated folders | `remotePaths.ts:29-81` — all path shapes live in one module; provider resolves/creates only the root folder today (`googleDriveStorageProvider.ts:466-484`) | high |
| Solution | Provider maps each remote path segment to a real folder (resolve-or-create + cached id, same pattern as `Tihoka Sync` root); `remotePaths.ts` grammar stays the app-facing contract; legacy flat files migrate into folders once per account | root-folder resolve/cache/`self-heal` precedent `googleDriveStorageProvider.ts:455-505`; legacy `appDataFolder` one-shot cleanup precedent `:507` | medium |
| Value | User can open Drive and see `Tihoka Sync/<scope>/devices/<id>/journal-N.json.gz` as real folders — verify sync works, spot orphan devices, delete confidently | user statement + screenshot review | high |
| Stakeholder | Sync users who inspect their Drive (Anh first); secondary: support/debugging | user statement | high |
| Context | Google Drive provider; `drive.file` scope already granted (can create folders/files app owns); mixed-version devices share one account; flat layout is load-bearing for `list()` (all listing is prefix-in-name queries) | `googleDriveStorageProvider.ts:265-285`; ADR-107 | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Em (agent) + Anh | Correct folder mapping + one-time migration without losing or duplicating sync state | folder create/resolve pattern exists for root; migration precedent exists (`cleanupLegacySpace`) |
| Customer | Sync users browsing Drive | Readable, organized sync folder; nothing silently re-uploads or desyncs | [assumption] most users never open the folder — cosmetic need is real but niche |
| Supplier/Dependency | Google Drive API | Folder ops (`files.create` mimeType folder, `files.update` add/remove parents) under existing `drive.file` scope | no new OAuth scope needed |
| Organization | Future maintainers | Path grammar stays centralized in `remotePaths.ts`; folder mapping logic testable | provider seam is the only Drive-touching layer |
| Regulator | none | none — same data, same scopes, same account | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Sync files must be grouped into real Drive folders so the scope/device a file belongs to is visible at a glance — global scope at top level, each `profile:<lang>` in its own subfolder | U | user statement; `remotePaths.ts` scope grammar | high |
| N2 | The change must not lose or duplicate sync state — existing flat files must remain readable (read-compat) or be migrated, and devices mid-migration must not see a phantom "empty account" | R | old builds list only flat names under root (`googleDriveStorageProvider.ts:271`); a migrated account looks empty to them → re-push wedge | high |
| N3 | List/read/write semantics must stay correct: `list(prefix)` on a folder layout must return the same logical paths the app expects, without blowing up query count vs today | P/R | `listPullScopes`/`pullScope`/`compactScopeIfNeeded` all rely on prefix listing (`pullCycle.ts`, `pushCycle.ts:304-318`); F4 N+1 risk if folder traversal is naive | high |
| N4 | Folder resolution must be cached/self-healing like the root folder — no per-write folder lookups | P | `rootFolderId` cache + 404 re-create precedent `googleDriveStorageProvider.ts:466-505` | high |
| N5 | Deterministic reversible mapping from logical path/scope to Drive names — `:` appears in folder names AND leaf filenames (`routes/profile:en.json`); sanitize consistently | F | `remotePaths.ts:10-18` (`routeMarkerPath` embeds `profile:<lang>` in a filename); Drive name rules | medium |
| N6 | The system must garbage-collect provably-dead remote artifacts without user action — users manage sync by ignoring it | F/R | user statement ("không ai rảnh xóa tay"); observed anomalies: 3 deviceId chains in one screenshot, superseded `snapshot-4` surviving `snapshot-5` — `compactScopeIfNeeded`'s sequential `removeRemote`+`fence` loop (`pushCycle.ts:347-356`) leaves stragglers on any mid-loop failure until the next >50 compaction (possibly never); precedent: `sweep` obligation already deletes vacated remote subtrees with a 24h grace (`obligations.ts:153-190`, `syncService.ts:388`) | high |
| N7 | GC safety invariant — never delete data a live device still needs: superseded files (journal seq ≤ coversSeq, snapshot n < latest) always safe; disconnect marker is **per-connection** (`meta/disconnect.json`, `disconnect.ts:62-65` — deviceId is only the writer) and authoritative (written only after `finalFlush` drained in-flight pushes, `disconnect.ts:203-225`) ⇒ sweep the whole account's chains **at detection time, inside `SyncEngine`'s disconnect branch before `completeDisconnectLocally` revokes the token** (`SyncEngine.ts:255-273` — any marker-age grace is unreachable: every online device detects a fresh marker within minutes, tears down, and retains no token/connection to re-check later); quiet-but-alive chains need a conservative TTL AND own-chain self-heal (N9) | R | `compactScopeIfNeeded` coversSeq rule `pushCycle.ts:323,347-356`; cursors are local-only (`cursors.ts`) — "all peers pulled" is unprovable remotely, so TTL is the only staleness signal | high |
| N8 | Orphan `blobs/<hash>` must be collectable — content-addressed blobs accumulate forever today; a blob unreferenced by every live record across scopes AND unreferenced by `blobs-needed` markers AND older than a grace period is garbage | F/+resource | audit F5; `blobs-needed/<hash>` marker = a peer needs that blob (`pullCycle.ts:425-441,561-585`) — deleting it wedges deferred records; blob upload precedes the referencing journal (ordering window → grace required) | high |
| N9 | A device whose own remote chain was swept must detect the missing chain and republish a full snapshot **with `coversSeq` = its last committed seq** (a coversSeq below peers' cursors still wedges them at "awaiting snapshot" — `pullCycle.ts:282,297-315`) | R | own chain skipped by pull (`pullCycle.ts:202`); seq is a local counter (`syncDb.ts`); peers gap → `pullCycle.ts:297-315` waits forever; only reconnect republishes (`syncService.ts:264`→`reconciliation.ts:80`) — self-heal on the push path is **new work**, not existing | high |

## Scope

- **In:** provider-side folder mapping (resolve-or-create + id cache + recursive descent for internal-node prefixes — `in parents` is direct-children only), path grammar review in `remotePaths.ts` (incl. `:` sanitization in folder AND file names), one-time per-account move migration of legacy flat files (`files.update` add/remove parents — `cleanupLegacySpace` KV-flag precedent) + permanent dual-read listing (folder + flat, dedupe by logical path) so stale-build pushes stay visible, `list()`/`read()`/`write()`/`remove()` adapted, **automatic GC**: superseded stragglers, disconnect-marked accounts (swept at detection — marker is authoritative post-finalFlush; any marker-age grace is unreachable because teardown revokes the token), TTL-stale device chains, orphan blobs (unreferenced + `blobs-needed`-free + grace), **own-chain self-heal republish on push** (new mechanism, N9), FakeDrive extensions (metadata PATCH/move + multi-parent), tests.
- **Out:** F1/F3/F4 findings, journal/snapshot contents, blob bytes, any UI, manual "clean now" button (GC must be silent).
- **Non-goals:** redesigning the wire format or record model; renaming scopes; multi-provider abstraction; per-peer remote cursor tracking (GC rules must work without it — there is none).

## Workflow

System↔system. On connect/push/pull the provider resolves the target folder for each path (lazy, cached per session) → creates missing folder segments → writes the file **by name** inside that folder. `list(prefix)`: leaf-prefixes resolve the parent folder + `<folderId> in parents`; internal-node prefixes (`scopes/`, `scopes/<scope>/devices/`) require bounded recursive descent (folders are few). **Listing always merges two namespaces**: foldered files + legacy flat names under root, deduped by logical path — so files a stale build pushes flat remain visible (no split-brain). First run per account (KV flag, `cleanupLegacySpace` precedent): a one-time pass moves every legacy flat file into its folder via `files.update` parents-swap — metadata-only, no re-upload; journals/snapshots/blobs are write-once so no lazy-touch migration is possible, dead chains are instead removed by GC. GC runs inside normal cycles: superseded stragglers with each compaction; disconnect-marked accounts + TTL-stale chains swept on a bounded schedule; own-chain-empty detection on push triggers `publishScopeSnapshot` self-heal. Milestones: folder mapping → list/read/write/remove → move migration + dual-read → GC rules → self-heal → mixed-version documented.

## Journey

### AS-IS

1. User opens `Tihoka Sync` on Drive and sees a flat list of files named `cell-sync/v1/scopes/<scope>/devices/<id>/journal-N.json.gz` — screenshot shows 3 device IDs and 2 scopes indistinguishable at a glance.
2. User cannot tell which files are global vs profile data, or which device wrote what, without decoding names.
3. Dead devices' files accumulate forever — no UI grouping exposes them.
4. Sync works correctly under the hood; only the storage presentation is hostile.

### TO-BE

1. User opens `Tihoka Sync` and sees folders: global-scope files at/near root (or a `global` folder), one folder per profile, `blobs/` and `meta/` folders.
2. Inside a scope folder, `devices/<deviceId>/` chains are grouped per device — and dead chains disappear on their own: superseded files swept with each compaction, disconnect-marked accounts' chains swept at marker sighting (no reachable grace), chains silent past a conservative TTL swept.
3. A device returning after its chain was GC'd detects its own empty chain on the next push and republishes a full snapshot — peers converge to its current state instead of waiting forever at the gap.
4. Existing sync state survives the transition — files are moved, not re-uploaded; sync continues across all devices on the new build.
5. Mixed-version edge: a stale build on the account sees the migrated layout as empty → dual-read listing keeps both namespaces visible until it auto-updates (preferred) or documented accepted-risk wedge.

## Stories

- S1: As a sync user, I want the Drive folder organized by scope so that I can see which files belong to global vs each profile — done when `Tihoka Sync` shows real folders and sync keeps working.
- S2: As a sync user with existing synced data, I want my flat files moved into the new layout — done when after one sync cycle on the new build, legacy files live in folders and sync state (cursors, hashes) is untouched.
- S3: As a maintainer, I want the provider's folder logic tested — done when FakeDrive covers resolve/create/list/read/write/remove/migration and all existing sync tests pass.
- S4: As a sync user, I want dead devices' files and orphaned dictionary blobs to disappear by themselves — done when nothing I can see in Drive is provably dead and no live device's unpulled data is ever deleted.
- S5: As a returning user whose chain was swept, I want sync to heal itself — done when the device detects its own empty chain on push, publishes a fresh snapshot, and peers converge without manual repair.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Stale build on migrated account sees no files → treats remote as empty, **pushes fresh flat files under root** — resurrects the flat layout + duplicate chains (worse than F2's read-only break; verified: `META_FORMAT_PATH` is exported but never read at runtime, no account-level format gate exists) | external/operational | Split-brain layouts until the stale device auto-updates | options for spec: (a) new build keeps `list()` covering BOTH flat root names and folders — stale pushes stay visible/mergeable, folders just accumulate beside them; (b) accept version-gate risk like F2 and document; (c) don't auto-migrate — only new files use folders, flat legacy files stay until compaction removes them |
| Folder resolution adds Drive API calls per write/list | operational/performance | More quota + latency | per-session folder-id cache; folders are few (~scopes+fixed) so resolve cost is bounded |
| `list(prefix)` semantics break pull/compaction (`startsWith` filtering relied on names) | internal | Pull misses files → sync stall | keep logical `path` grammar inside the app; only the provider's mapping changes; full sync suite is the gate |
| `profile:` `:` in folder AND file names (`routes/profile:en.json` — Windows-unfriendly if user downloads) | external/usability | Cosmetic | sanitize consistently (`profile-en`); mapping must be reversible/deterministic |
| Migration race: two devices move the same flat file simultaneously → duplicate copies in folder | operational | `newestCopy` dedupe exists but keys on `file.name` — flat twin and foldered twin share logical path but different names → `list()` must dedupe by **logical path** to keep the contract guarantee | dedupe fix in `list()` merge (`googleDriveStorageProvider.ts:275-280`) + contract test |
| Internal-node `list(prefix)` needs recursive descent (`in parents` = direct children only) — `listPullScopes`/`pullScope` list mid-tree | internal/performance | 1 + S + D queries vs today's 1 for a full-scope listing | shallow bounded descent + folder-id cache; still lands on F4 query-count concern — spec must bound it |
| TTL-GC deletes a chain whose device comes back | operational | Peers' cursors gap on the missing chain — today a **permanent** wedge: pull skips own chain (`pullCycle.ts:202`), gap branch waits forever (`pullCycle.ts:297-315`) | N9 self-heal is required build: on push, own `devices/<id>/` listing empty while local seq > 1 → `publishScopeSnapshot`; TTL conservative (e.g. ≥30d); precedent: `VACATED_SWEEP_MS = 24h` sweep (`obligations.ts:153-190`) |
| TTL-GC deletes unpulled changes of a permanently-dead device | hidden/data-loss | Those specific deltas lost — but the device is dead, peers can never get them anyway past TTL | grace period ≫ pull cadence (5min cycles); risk accepted only at long TTL |
| Orphan-blob GC deletes a blob referenced by a journal not yet uploaded, or needed by a `blobs-needed` marker | internal | Pending install wedges | grace period on unreferenced age (e.g. 7d) + `blobs-needed` markers are keep-signals + re-list before delete |

## Decision

go — real user-facing need (drive hygiene + silent self-cleaning) and audit F5; bounded to the provider seam + push-cycle self-heal. **Resolved strategy**: (a) one-time per-account move migration of legacy flat files into folders via `files.update` parents-swap (KV flag, `cleanupLegacySpace` precedent) — lazy per-file migration is impossible because journals/snapshots/blobs are write-once and dead chains are never touched; (b) permanent dual-read listing merging flat + foldered names, deduped by logical path — stale builds keep pushing flat files that stay visible; (c) GC categories per N6–N8 with the safety rules in N7; (d) own-chain-empty self-heal republish (N9) is **required** for TTL-GC to be safe. **Verified constraint**: no `meta/format.json` runtime gate exists — stale builds see migrated files as gone; dual-read + continued flat pushes means they just keep operating in the flat namespace until auto-update.

## Draft Acceptance Criteria

- [ ] `Tihoka Sync` contains real folders: global scope at top level, one folder per `profile:<lang>`, `blobs/`, `meta/` (incl. decided mapping for `meta/routes`/`meta/blobs-needed` children)
- [ ] `:` sanitized in folder AND file names; mapping reversible/deterministic
- [ ] `list`/`read`/`write`/`remove` preserve logical-path semantics; `list` merges flat+foldered namespaces deduped by logical path — stale-build flat pushes stay visible; internal-node prefixes recurse with bounded query count
- [ ] Full existing sync suite green against the foldered FakeDrive (extended with metadata-PATCH move + multi-parent model)
- [ ] One-time per-account `files.update` move migration; idempotent; KV-flagged
- [ ] Folder ids cached per session + self-heal on 404 (same pattern as root folder)
- [ ] GC sweeps superseded stragglers, disconnect-marked accounts (at marker sighting — before teardown/revoke), TTL-stale chains — never a live chain; superseded straggler sweep also runs outside the >50-journal path (today's stragglers prove it can stall forever)
- [ ] Orphan `blobs/<hash>` deleted only when unreferenced by live records AND no `blobs-needed` marker AND past grace period
- [ ] Own-chain self-heal: push detects `devices/<myId>/` empty while local seq > 1 → publishes full snapshot; peers converge
- [ ] Gates: typecheck, lint, test:unit, build
