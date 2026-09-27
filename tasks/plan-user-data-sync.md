# Implementation Plan: User data sync

## Overview

Provider-adapter sync engine replicating all durable learning data (profiles, global config, SRS + assets, full dictionary content, word statuses, Reader books/progress) to user-owned cloud storage — Google Drive `appDataFolder` via adapter v1 — merged across devices. Layers per spec: `domain` (pure) → `ports` → `app` services → `adapters` → background composition → Settings UI. Spec dependency order: REQ-1/2 → REQ-3 → REQ-7 → REQ-8/10 → REQ-9/11/12 → REQ-4/5/6/15/16 → REQ-13/14/17.

## Architecture Decisions

- Per-device append-only `journal-<seq>.json.gz` + compacted `snapshot-<n>.json.gz` + content-addressed `blobs/<hash>`; merge by per-class policies over HLC. Never last-device-wins.
- `connectionId = "<providerId>:<accountKey>"` deterministic; scopes `global` + `profile:<target>`; profile ids `profile-<target>` (REQ-1/2).
- Capture: IDB outbox/meta written in the same transaction as the mutation (SRS DB v2, dict DB v13, reader DB v2); chrome.storage data via read-only diff vs `syncMetaKV`.
- OAuth implicit flow via `identity.launchWebAuthFlow` (no client secret, `VITE_GOOGLE_OAUTH_CLIENT_ID`); tokens only in `storage.session`.
- Single-flight lock in `storage.session.syncLock` with fencing (REQ-17); journal commit freezes batch in `cell-sync` IDB before upload (REQ-8).
- Domain stays pure — no `chrome.*`/`fetch`/IndexedDB imports (ESLint `no-restricted-imports`); compression via `CompressionStream` in app/adapter layer.
- UI: spec-derived Sync section in Settings from `src/shared/ui` (component-mapping doc).

## Task List

### Phase 1 — Domain foundation (sequential, main/feature worktree)

- [ ] Task 1: Domain core — types + HLC + scope routing
- [ ] Task 2: Field-path flattening + settings field registry + opaque records
- [ ] Task 3: Merge policies per data class

### Phase 2 — Ports, fakes, capture (parallel lanes)

- [ ] Task 4: Port interfaces + in-memory provider + KV/Clock/IdSource fakes + shared adapter contract suite
- [ ] Task 5: IDB schema migrations (SRS v2, dict v13, reader v2) + outbox/meta helper + IDB LocalSources
- [ ] Task 6: KV LocalSources (settings registry, secondary keys, sync directory) + `syncMetaKV` diff
- [ ] Task 7: `cell-sync` IDB DB — sequences, pendingBatches, deferredRecords, opaqueRecords, sweeps

### Phase 3 — Engine (sequential-ish)

- [ ] Task 8: SyncEngine push — commit protocol, journals, snapshots, compaction, blob upload+verify, lock, backoff
- [ ] Task 9: SyncEngine pull — cursors, snapshot/journal consume, deferredRecords, blobs-needed, applyRemote ordering, SYNC_DATA_APPLIED
- [ ] Task 10: Reconciliation + profile-identity migration + REQ-1 validation change
- [ ] Task 11: RebindService (REQ-5/6 freeze/checkpoint/route markers/drain) + disconnect SSOT (REQ-15) + waiting-connection (REQ-16)

### Phase 4 — Provider + composition (parallel)

- [ ] Task 12: Google Drive adapter — OAuth launchWebAuthFlow + silent renewal (REQ-13) + Drive v3 + resumable upload + error mapping; passes contract suite
- [ ] Task 13: Background composition — `handlers/sync.ts`, alarms/startup/online/debounce/`Sync now`, `SYNC_DATA_APPLIED` broadcast, manifest `identity`/`alarms`/`key`
- [ ] Task 14: Sync Settings UI + i18n (en/vi) + nav item
- [ ] Task 15: Property/convergence suite — 3 simulated devices, in-memory provider (NFR-2); Drive adapter contract tests wired

### Checkpoint: after each merge — typecheck + lint + test:unit + build green

## Tasks (detail)

## Task 1: Domain core — types, HLC, scope routing

**Description:** Pure domain foundation every other lane imports.

**Acceptance criteria:**
- [ ] `Hlc { wall, counter, node }` total order + `tick` per spec Terms; context seeds `lastWall` from a `Clock`/storage port
- [ ] `connectionId`, `Scope` (`global` | `profile:<target>`), `profileId = profile-<target>`, `Target()` (ISO-639-1 base, `zh-hant`→`zh`) — SC-32
- [ ] `ChangeRecord`, `DataClass`, `ProviderId` types exported
- [ ] No `chrome.*`/`fetch`/IDB imports (NFR-11)

**Files likely touched:** `src/features/sync/domain/{types,hlc,scope}.ts`, `src/features/sync/domain/*.test.ts`, ESLint restricted-imports config for `features/sync/domain`
**Priority:** P0 · **Parallel:** false (foundation) · **Scope:** M · **Worktree:** no

## Task 2: Flattening + settings registry + opaque records

**Description:** Record keys & flattening wire encoding + the settings field registry (synced paths, never-synced paths, per-element vs whole-array arrays).

**Acceptance criteria:**
- [ ] Leaf-path flatten/unflatten with `~`/`/` escaping; per-element arrays `@<elementId>`; tombstone-on-absent; new lifetime resets `firstHlc`
- [ ] Registry encodes every rule in spec "Settings field registry" (never-global `languageProfiles`, never-synced list, per-element arrays, atomic arrays, maps)
- [ ] Unknown/parent-tombstoned keys → opaque record path (retained, republished, not applied)
- [ ] Unit tests cover registry + round-trip + SC-20 (device-local fields never produce records)

**Files:** `src/features/sync/domain/{flatten,settingsRegistry,opaqueRecords}.ts` + tests
**Depends on:** Task 1 · **Priority:** P0 · **Parallel:** true · **Scope:** M · **Worktree:** lane-2

## Task 3: Merge policies per data class

**Description:** The merge table as pure functions: `(local, remote) -> winner` per data class.

**Acceptance criteria:**
- [ ] LWW per key default; profile-existence rule (put-after-tombstone lifetime, field suppression); cards per-component merge (`lastReview` −∞, `reviewCount`, `studyAgainDue` travels, `exploreCount` max); reviewEvents union; grow-only `readTime/<deviceId>`; dict/book field LWW
- [ ] Apply-order constant exported (configs→collections→notetypes→decks→notes→assets→cards→events; dict content before meta; books before progress)
- [ ] Property tests: merge is commutative/idempotent on random record pairs

**Files:** `src/features/sync/domain/merge/*.ts` + tests
**Depends on:** Task 1 · **Priority:** P0 · **Parallel:** true · **Scope:** M · **Worktree:** lane-3

## Task 4: Ports + in-memory provider + contract suite

**Description:** `StorageProvider`, `LocalSource`, `KeyValueStore`, `Clock`, `IdSource` interfaces; `InMemoryStorageProvider` (multi-connection, duplicate-path semantics per contract); shared adapter contract test suite runnable against any provider.

**Acceptance criteria:**
- [ ] Port interfaces verbatim from spec (authorize/revoke/list/read/write/remove/quota; LocalSource pending/resolve/ack/snapshot/current/applyRemote)
- [ ] In-memory provider models app-folder blob store incl. duplicate paths & `ProviderError` kinds
- [ ] Contract suite asserts: upsert idempotency, dedup-on-write, list-newest, error kinds — passes against in-memory provider

**Files:** `src/features/sync/ports/*.ts`, `src/features/sync/adapters/memory/*.ts`, `src/features/sync/adapters/contract/*.test.ts`
**Depends on:** Task 1 · **Priority:** P0 · **Parallel:** true · **Scope:** M · **Worktree:** lane-4

## Task 5: IDB migrations + outbox helper + IDB LocalSources

**Description:** SRS DB v1→v2, dictionary DB v12→v13, reader DB v1→v2 add `syncOutbox` + `syncMeta` stores (`onversionchange` close handlers); shared capture helper called inside mutation transactions; LocalSource impls for SRS entities, dictionary resources, word status, reader books/progress.

**Acceptance criteria:**
- [ ] Every synced-store mutation path writes outbox+meta atomically (REQ-7 steps 1–5): scope resolved before write via parent chain → `Target(collection.targetLanguage)`; dict/word-status → `Target(DB lang)`; reader → `Target(languageCode)`; studyConfigs emitted into every referencing scope
- [ ] Dict import bulk rows create no per-row records; completion writes `resource:<contentHash>` put + field keys
- [ ] `applyRemote` stamps remote HLC meta in same tx (no echo, SC-22); `current()` includes tombstone meta
- [ ] Migrations idempotent; tests prove mutation w/o capture aborts

**Files:** `src/entities/**` DB defs (srs/dict/reader), `src/features/srs/repositories/*` mutation paths, `src/features/sync/adapters/local/idb/*`, tests
**Depends on:** Tasks 1–3 · **Priority:** P0 · **Parallel:** false (touches shared repositories) · **Scope:** L → split 5a schema+helper, 5b sources if needed · **Worktree:** no

## Task 6: KV LocalSources + syncMetaKV

**Description:** chrome.storage sources: `settings` (registry-synced paths), secondary keys (`themeMode`, `themeConfig`, `tokenizeSettings`, `ocrSettings`, `studyModes`, `auto_download_whitelist`), sync directory (`syncState`).

**Acceptance criteria:**
- [ ] `pending()` = read-only diff vs `storage.local.syncMetaKV` (hash mismatch or missing meta); `resolve()` mints without stamping; commit stamps from durable batch (REQ-7 flow, SC-33)
- [ ] `applyRemote` drift check → local HLC mint + policy merge + conflict-log entry (SC-36); normalizers (`coerceDefaultTypes` etc.) applied before write
- [ ] `storage.onChanged` only schedules debounce — no capture listener

**Files:** `src/features/sync/adapters/local/kv/*`, `src/entities/settings/settingsStore.ts` (registry seam only), tests
**Depends on:** Tasks 1–3 · **Priority:** P0 · **Parallel:** true · **Scope:** M · **Worktree:** lane-6

## Task 7: cell-sync IDB DB

**Description:** New DB `cell-sync`: `sequences` ((conn,scope)→nextSeq/nextSnapshotN), `pendingBatches` (frozen records+cycleId), `deferredRecords`, `opaqueRecords` stores.

**Acceptance criteria:**
- [ ] Sequence allocation inside the same tx that stores a frozen batch; counters never reset (SC-28, SC-37)
- [ ] Deferred record persists full ChangeRecord + required blob hashes; opaque store round-trips

**Files:** `src/features/sync/adapters/local/syncDb.ts` + tests
**Depends on:** Task 1 · **Priority:** P0 · **Parallel:** true · **Scope:** S-M · **Worktree:** lane-7

## Task 8: SyncEngine push + cycle lock

**Description:** REQ-8 + REQ-17 + compaction + blob upload/verify orchestration. `app/SyncEngine.ts` + `app/pushCycle.ts` + `app/cycleLock.ts`.

**Acceptance criteria:**
- [ ] Lock `{cycleId, expiresAt}` in `storage.session.syncLock`; heartbeat 30s; stealable when expired; fencing re-read before every remote write and before every ack (SC-29)
- [ ] Commit protocol per spec steps 1–5; pending batches re-uploaded first; compaction only when no pending batch and journals > 50; snapshot `coversSeq`; delete own ≤ coversSeq (SC-28, SC-37)
- [ ] Blobs uploaded + `list`-re-verified before journal publish; `local`-bound scopes acked locally; frozen scopes held (REQ-8 step 3)
- [ ] Backoff 30s→30min via alarm; errors → `needs-reauth`/`storage-full`/`offline` states
- [ ] Engine test suite on in-memory provider green

**Files:** `src/features/sync/app/*` + tests
**Depends on:** Tasks 4–7 · **Priority:** P0 · **Parallel:** false · **Scope:** L · **Worktree:** no

## Task 9: SyncEngine pull

**Description:** REQ-10 + REQ-12 tombstone apply + REQ-18 conflict log.

**Acceptance criteria:**
- [ ] Per-scope device listing minus own; cursor (snapshot n, seq) ordering; cursor-predates-compaction recovery; corrupt/formatVersion skip → `warning`
- [ ] Apply in dependency order via policies; tombstones cascade via existing `deleteCascade`; opaque retention
- [ ] Blob-missing → `deferredRecords` + `meta/blobs-needed/<h>` + later records continue + warning after 3 cycles (SC-34); blobs-needed answered by holders
- [ ] Routing-drain obligation persisted before applying any routing change (SC-35); SSOT disconnect detection every cycle (REQ-10 step 7)
- [ ] `SYNC_DATA_APPLIED` broadcast + `syncAppliedAt`; conflict log ring 500 without values (SC-27); idempotent re-apply

**Files:** `src/features/sync/app/pull*.ts`, `src/features/sync/app/conflictLog.ts`, tests
**Depends on:** Task 8 · **Priority:** P0 · **Parallel:** false · **Scope:** L · **Worktree:** no

## Task 10: Reconciliation + profile identity migration + REQ-1

**Description:** REQ-9 first-connect merge + REQ-2 startup migration + REQ-1 validation rewrite.

**Acceptance criteria:**
- [ ] REQ-2: group-by-target, survivor lowest (order,id), collection `languageProfileId` rewrite, deterministic rename `profile-<target>`, idempotent retry, runs before engine start; SC-16
- [ ] REQ-1: `validateLanguageProfile` target-duplicate rejection (localized), target immutable on edit; SC-15
- [ ] REQ-9: pull all → skip empty auto-created collections when remote has one → upload/verify blobs → publish full snapshot → ack subsumed; SC-4
- [ ] Fresh-install restore sets `activeProfileId` = first restored by (order, target); SC-1 path

**Files:** `src/features/sync/app/{reconciliation,profileIdentityMigration}.ts`, `src/entities/settings/lib/profileResolution.ts`, tests
**Depends on:** Task 9 · **Priority:** P0 · **Parallel:** false · **Scope:** M · **Worktree:** no

## Task 11: Rebind + disconnect + waiting-connection

**Description:** REQ-5/6 routing freeze + checkpoint + route markers + drain obligations + old-copy sweep; REQ-15 SSOT disconnect incl. `disconnect-pending`; REQ-16.

**Acceptance criteria:**
- [ ] Rebind: freeze→pull→snapshot+blobs to B→verify paths→route markers A+B→binding write→push held→final snapshot→ask delete; failure → stays A + checkpoint resume; cancel lifts freeze and pushes held to A (SC-8)
- [ ] REQ-6 global variant via `systemConnection` LWW; convergence to one (SC-7)
- [ ] Disconnect steps 1–6 incl. unreachable→`disconnect-pending` flag + completion on next reachable cycle; reconnect clears `meta/disconnect.json` (SC-25, SC-31)
- [ ] `waiting-connection` state when bound connection lacks token (SC-24)
- [ ] Old-copy delete sweeps for 24h; keep default (SC-26)

**Files:** `src/features/sync/app/{rebindService,bindingService,connectionService}.ts`, tests
**Depends on:** Task 9 · **Priority:** P0 · **Parallel:** false · **Scope:** L · **Worktree:** no

## Task 12: Google Drive adapter

**Description:** `adapters/google-drive/`: OAuth via `launchWebAuthFlow` (`response_type=token`, scopes `drive.appdata openid email`), silent renewal (`prompt=none`, `login_hint`, `abortOnLoadForNonInteractive`/`timeoutMsForNonInteractive` spike first), userinfo sub/email, Drive v3 list/read/write/remove/quota on `appDataFolder`, resumable uploads with persisted session URI, duplicate-path dedup, error mapping + internal retry (3, exp).

**Acceptance criteria:**
- [ ] Contract suite (Task 4) passes with mocked HTTP; token refresh path unit-tested (SC-13)
- [ ] `accountKey=sub`, `displayName=email`; tokens only `storage.session`; no secret anywhere (SC-12)
- [ ] Firefox redirect asserted against `identity.getRedirectURL()`; mismatch reported (Open Questions)
- [ ] Provider registered in `providerRegistry` (only `google-drive` exposed)

**Files:** `src/features/sync/adapters/google-drive/*`, `src/features/sync/providers/providerRegistry.ts`, tests with mocked fetch
**Depends on:** Task 4 · **Priority:** P0 · **Parallel:** true · **Scope:** L · **Worktree:** lane-12

## Task 13: Background composition + manifest

**Description:** `entrypoints/background/handlers/sync.ts` runtime messages (`SYNC_NOW`, connect/bind/rebind/disconnect/systemConnection/status), alarm `cell-sync` 5min + debounce 30s + startup + `online`, `SYNC_DATA_APPLIED` + `syncAppliedAt`, manifest `identity`+`alarms`+`key` (dev-id alignment per Open Questions), `data_collection_permissions` update in `build-firefox.mjs` (NFR-12).

**Acceptance criteria:**
- [ ] Cycle triggers wired; Sync now joins running cycle
- [ ] Manifest adds only `identity`, `alarms`, `key`; real Chrome load verified
- [ ] No dynamic import in SW-reachable modules (learning: no-dynamic-import-shared-sw-chunk)
- [ ] NFR-12 declarations updated

**Files:** `src/entrypoints/background/**`, `public/manifest.json`, `scripts/build-firefox.mjs`, `src/entities/message/schema.ts` (new message types)
**Depends on:** Tasks 8–12 · **Priority:** P0 · **Parallel:** false (manifest = shared state) · **Scope:** M · **Worktree:** no

## Task 14: Sync Settings UI + i18n

**Description:** `features/sync/ui/SyncSettingsSection` per component-mapping + Settings nav item + `sync.*` strings en/vi.

**Acceptance criteria:**
- [ ] All mapping elements present; every non-healthy state = exactly one labeled action; privacy notice names subtitle API keys; Google branding per guidelines
- [ ] Empty/no-profiles + overflow (6 accounts/12 profiles) render clean at 320px–desktop light/dark; keyboard + aria correct (dialog trap/restore lesson applied)
- [ ] Runtime messages per Task-13 contract (mock during lane, real at integrate)

**Files:** `src/features/sync/ui/*`, settings nav/section registry, `public/_locales/{en,vi}/messages.json` or `en.json`/`vi.json` (repo convention), styles via tokens
**Depends on:** Task 13 (mock-contract on message surface) · **Priority:** P0 · **Parallel:** true · **Scope:** M · **Worktree:** lane-14

## Task 15: Convergence property suite + adapter contract wiring

**Description:** NFR-2 property tests — random interleavings of puts/deletes/binding changes on 3 simulated devices (in-memory provider + fake KV) converge to policy-equal state, zero lost review events; Drive contract suite already covered in Task 12.

**Acceptance criteria:**
- [ ] Convergence suite green incl. rebind+disconnect scenarios; SC-3/SC-10/SC-21/SC-22/SC-30 covered as properties
- [ ] Written blind from spec (contract-level), no implementation internals

**Files:** `tests/unit/features/sync/convergence*.test.ts`, harness `src/features/sync/testkit/*`
**Depends on:** Tasks 1–11 (engine real) — dispatched after Phase 3 merges · **Priority:** P0 · **Parallel:** false · **Scope:** M · **Worktree:** no

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope huge — 18 REQs | High | Strict lanes, verify per merge, escalate after 2 failed cycles |
| `launchWebAuthFlow` silent renewal differs Chrome/Firefox | Med | Task 12 spikes first on both browsers; worst case more `needs-reauth` |
| IDB migrations touch live repositories | High | Task 5 sequential, characterization tests first |
| Drive Testing-mode consent quirks | Low | Test users already configured; docs'd |
| Lane file collisions on `settingsStore`/`profileResolution` | Med | Tasks 5/6/10 non-parallel vs each other |

## Open Questions

- None blocking; spec Open Questions accepted as DELIVER spikes (silent renewal, Firefox redirect URI, unpacked `key`).
