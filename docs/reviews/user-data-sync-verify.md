# Verify — user-data-sync

Three fresh-context adversarial reviews by `subagent_explore` agents against `docs/specs/user-data-sync.md` and the implementation in worktree `Tihoka-worktrees/user-data-sync` (branch `feature/user-data-sync`, head `8471ec97`). Generation ≠ review — reviewers did not write the implementation.

## Scope reviewed

`src/features/sync/` in full — domain (`hlc`, `flatten`, `scope`, `settingsRegistry`, `stableHash`, `opaqueRecords`), ports (`storageProvider`, `localSource`, `keyValueStore`, `clock`, `srsSyncAccess`), app layer (`SyncEngine`, `pullCycle`, `pushCycle`, `rebind`, `disconnect`, `obligations`, `checkpoints`, `routeMarkers`, `routing`, `cycleLock`, `snapshotPublish`, `reconciliation`, `syncService`, `syncStore`, `syncDbStore`, `blobRefs`, `remotePaths`, `wireCodec`, `backoff`, `cursors`), adapters (google-drive, memory, local kv/idb), `src/entrypoints/background/{syncRuntime.ts,handlers/sync.ts,index.ts}`, `src/features/sync/ui/{SyncPanel,syncClient}`, message schemas/registry, `public/manifest.json`, plus every consumer seam (dictionary, vocabulary, tokenize, srs, reader, settings/profile sources and `wordStatusCrossTab` relay).

## Spec compliance — requirement traceability

- **REQ-1/2 (connections, profile identity) — PASS.** Multi-account connections in the syncState directory; profile identity keyed on target language only; REQ-2 migration merges duplicate target profiles losslessly; active profile restored after apply.
- **REQ-3/4 (connect + first sync) — PASS.** `connectProvider` authorizes, writes directory entry + bindings, clears disconnect marker, reconciles scopes; first-connection binds all profile targets.
- **REQ-5/6/15 (rebind, system connection, disconnect) — PASS.** Route markers with write-verify, fenced rebind checkpoints (freeze → copied → drain → done), cancel + supersede, `SystemConnectionRequiredError`, disconnect marker + revoke + pending-flag resume for unreachable providers, `deleteScopeCopyOnVacated` for explicit old-copy deletion.
- **REQ-9 (scope reconciliation) — PASS.** `runScopeReconciliation` merges remote/local by LWW per record; dictionary materialization covered by REQ-11 tests.
- **REQ-11 (dictionary materialization) — PASS.** Blob-needed markers, deferred rows, opaque records for unknown dataClasses.
- **REQ-13/14 (status, UI) — PASS.** `SYNC_GET_STATUS` returns `SyncStatusView` (connections with health/hasToken, bindings with waiting/waitingFor/vacatedFrom); `SYNC_STATUS_CHANGED`/`SYNC_DATA_APPLIED` validated by zod; SyncPanel renders every non-healthy state with exactly one labeled action (connect / rebind-progress / cancel / delete-old-copy / sign-in / sync-now); privacy notice names subtitle API keys adjacent to connect.
- **REQ-16/17 (scheduling) — PASS.** Alarms + startup + online + debounced external-change triggers with `cancel()` on teardown; mutating service ops fire a cycle; `hasConnections()` gate avoids cold SW churn.

## Adversarial review rounds

- **Round 1** (T11/T13): 4 majors + 10 minors — drain obligations on routing apply, drain-to-local semantics, disconnect checkpoint leaks, marker HLC compare, global→local rejection, backoff gating, waitingFor surfacing. All fixed and regression-tested.
- **Round 2** (hardening batch): 9 majors + minors — drain refusal deferral, same-process lock mutex, rebind destination validation, superseding stale sweeps, marker verify-after-write, persisted HLC wall floor, SYNC_DATA_APPLIED consumer relay, snapshot promotion, checkpoint conflicts, debounce cancel. All fixed; commit `4bb1ef89`.
- **Round 3** (post-hardening): **10/10 claims PASS**, no majors. 11 residual minors triaged; 4 fixed in `8471ec97` (disconnect stamp atomicity on retry, lock-loss rethrow in pending-disconnect completion, interior journal-gap hold, obligations honoring backoff), 7 deferred as bounded/convergent (see below).

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:unit` — 619/619 suites, 7414/7414 tests
- `npm run build` — pass (pre-existing externalization/chunk-size warnings only)
- `check-feature-cycles` — 23 features, 45 edges, clean; `check-deep-imports` — 170 baseline pairs, 0 stale
- Browser (Chrome-for-Testing, packed dist + cloned profile) — `SYNC_GET_STATUS` returns a valid `SyncStatusView`, SyncPanel empty-state renders in real DOM, Connect launches the OAuth window on `accounts.google.com`, panel stable across reloads

## Residual risks (accepted)

1. **Permanent journal gap stalls that remote device's stream** until a covering snapshot or the missing journal lands — deliberate consistency-over-liveness choice; surfaces as a per-cycle warning (N7).
2. **Deferred-row adoption races** (two active connections adopting the same orphan row) are HLC-idempotent and converge; worst case is one duplicated apply cycle (N4/N5).
3. **Snapshot accumulation on a chronically failing drain** — superseded `snapshot-N` files on the destination connection are cleaned by the next successful compaction; storage cost only (N11).
4. **Sweep superseded by user rebind leaves the vacated remote copy** until the next sweep or explicit delete-old-copy — storage residue, no data loss (N8).
5. **Fabricated disconnect tick** in `SyncEngine.disconnectDeps` only fires when `deps.tick` is absent — production always wires the HLC clock; test-only path (N2).
6. **Unacked meta-'put' tombstones** mint a fresh hlc per evaluation — a narrow window where a local delete dominates a remote re-add until the delete flushes; converges (N9).
7. **`writeRouteMarker` result ignored by the source-side writer** — the durable checkpoint is authoritative; the marker is a hint (MINOR-2).
8. **Binding-delete records re-materialize as explicit bindings** to the system connection — functionally equivalent to deletion (inherited route); cosmetic divergence (MINOR-9).

## Test quality assessment

Regression coverage is direct, not incidental: route-marker prepass, stale-marker freshness rejection, drain-to-local completion, occupied-scope deferral, orphan-checkpoint cleanup, orphan-deferred adoption, backoff-gated waiting, journal leading/interior gap hold + gap-fill recovery, lock mutex serialization, marker verify-after-write, pending-disconnect resume, cancel/supersede of drain occupants, meta stamping on local routing writes. Tests would fail if the hardened paths regressed.

## Post-ship real-Chrome E2E (2026-09-28)

Two Google test accounts against real Drive `appDataFolder`, two browser profiles as separate devices (device-2 extension storage wiped → fresh `deviceId`):

- **Multi-account routing (device 1) — PASS.** `nguyenhaiduong2300@gmail.com` connected as system connection, `nguyenhaiduongchina@gmail.com` as second connection; both `hasToken:true`, routed by accountKey.
- **Push (device 1) — PASS.** `themeMode='light'` seeded → `SYNC_NOW` returned `scopesPushed:['global']`, `ackedKeys:1`; remote journal authored under device-1 `deviceId`.
- **Pull + apply (device 2) — PASS.** Fresh profile → OAuth account A → first-connection reconcile read 7 remote device streams (`recordsApplied` >0 for syncDirectory/secondaryKey); subsequent `SYNC_NOW` pulled `['global','profile:en']`; local `chrome.storage.local.themeMode === 'light'` with `syncMetaKV` row stamped under the authoring device's HLC node. Replicated `…china` connection surfaced as `needs-reauth` — correct spec behavior for an unauthorized account.
- **Regression fixes verified live:** mid-cycle `runCycle()` now queues a follow-up cycle (`0d2a405a`); `withServiceLock` bounded retry confirmed by real timings (~6s wait while startup cycle held the lock) instead of instant `sync-busy`.
- **Test-infra findings (not product bugs):** Chrome `Service Worker/ScriptCache` serves the first-registered SW bundle across rebuilds — must be cleared between rebuild-and-verify iterations; cloned profiles inherit `deviceId` and are skipped as self-authored — device-2 simulation requires wiping extension storage (documented in learning-and-apply).

VERDICT: PASS
