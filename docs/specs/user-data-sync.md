# Spec: User data sync — provider-adapter sync engine (Google Drive first)

> Intent: `docs/intent/user-data-sync.md` · ui_surface: yes · Mode: interactive · Final specification

## Objective

Replicate every durable piece of user learning data — language profiles, global config, SRS study data + assets, installed dictionaries (full content), word statuses and Reader books/progress — from local storage to user-owned cloud storage, and merge it back on every connected device, so switching devices, reinstalling or studying on several machines in parallel never loses progress (intent Need; N1–N6, N20). The engine is provider-agnostic: storage services plug in as adapters behind one port (N19); this item ships the Google Drive `appDataFolder` adapter only. Each profile (= one target language, N14) is bound to one storage connection or kept local-only; global config lives on one system connection (N11–N13, N18). Connection lifecycle decisions (connect, disconnect, bindings) are a single source of truth shared by all devices (N21).

## Terms

| Term | Meaning |
|---|---|
| Provider | A storage service type implemented by one adapter (`google-drive` now; `onedrive`, `dropbox` later) |
| Connection | One authorized account on one provider. `connectionId = "<providerId>:<accountKey>"` (deterministic, identical on every device); `accountKey` = provider-stable account id (Google `sub`); `displayName` = account email |
| System connection | The connection holding global scope; stored as the single global key `systemConnection` |
| Target | ISO-639-1 base of any language value: `toIso6391(value.split('-')[0])`. Every scope derivation (profile, collection `targetLanguage`, book `languageCode`, dictionary DB lang) applies this rule — e.g. `zh-hant` → `zh` |
| Profile id | Deterministic `profile-<target>` (one profile per target) |
| Scope | Unit of remote replication: `global`, or `profile:<target>` |
| Binding | `binding:<target>` → `connectionId` \| `local` |
| Device | One browser-profile install; `deviceId` = random UUID, device-local |
| HLC | Hybrid logical clock `{ wall: integer ms, counter: uint32, node: string }`, total order (wall, counter, node); `node = <deviceId>:<contextId>` (`contextId` random per JS context, so stamps are unique even when a page and the background mint in the same ms). Tick: `wall' = max(Date.now(), lastWall)`; `counter' = wall' === lastWall ? counter + 1 : 0`. Every context seeds `lastWall` from `storage.session.syncClockWall` at start and on its change; the background advances `syncClockWall` past every observed remote HLC |
| Record key | Stable string identifying one mergeable unit inside a data class (see Record keys & flattening) |
| Change record | `{ scope, dataClass, key, op: 'put' \| 'delete', value?, hlc, firstHlc? }` — `value` present for puts in journals/snapshots; `firstHlc` = HLC of the unit's first put (drives element order) |
| Tombstone | A `delete` change record; retained forever in snapshots (never expires) |
| Outbox | IDB-backed local queue of unsynced keys (`{ scope, dataClass, key, op }`) written in the same transaction as the mutation. chrome.storage data has no outbox: it is captured by state diff (REQ-7) |
| Record meta | Per record key: `{ hlc, firstHlc, op, valueHash }` — `syncMeta` store (IDB sources) / `storage.local.syncMetaKV` (chrome.storage sources); tombstone rows are kept |
| Opaque record | Full `ChangeRecord` retained in `cell-sync.opaqueRecords` when this app version cannot materialize the key or its parent is tombstoned; it remains mergeable and republishable |
| Journal | Remote file `journal-<seq>.json.gz` holding one device's records for one scope; `seq` comes from a persisted monotonic counter; content frozen before first upload |
| Snapshot | Remote file `snapshot-<n>.json.gz` holding one device's compacted view of a scope (latest record per key incl. tombstones, original HLCs) with header `{ n, coversSeq }` |
| Cursor | Per (connection, scope, remote device): last consumed snapshot n + journal seq |
| Content hash | sha256 of the portable serialized content of a dictionary resource, book or SRS asset; names remote blobs and matches resources across devices |
| Signature | Existing local import dedupe key `SHA-256(first1MB)_size_name` (`src/entities/dictionary/types.ts:46-47`) — local only, never used for cross-device matching |

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | Connect/disconnect, bind/rebind a profile, choose system connection, "Sync now", "Sign in again", answer "delete old cloud copy?", create/edit/delete profiles, study, mark words, import dictionaries, read books | Provider choice, consent on provider page, binding choice, delete/keep answer | Connections, per-profile binding + status, progress, errors with actions, privacy notice, restored data |
| Storage provider (Google Drive API v3) | — | List/read/write/delete in app folder | Remote files |
| Identity provider (Google OAuth 2.0 via `identity.launchWebAuthFlow`) | Consent page, redirect | Access token + expiry; userinfo `sub`, `email` | Authorization request |
| Browser runtime | Alarms, startup, `storage.onChanged`, `online` | Wake-up events | — |

System steps never contain learner behavior; learner decisions enter only as inputs above.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| `chrome.storage.sync` | ~100 KB total quota — cannot hold SRS, dictionaries, books (intent Context) |
| Whole-state snapshot overwrite per device ("last device wins") | Loses concurrent multi-device edits (violates N6) |
| Shared remote manifest updated with compare-and-swap | Drive v3 has no conditional update; would force provider-specific locking and break the port's portability |
| `identity.getAuthToken` | Chrome-only and bound to the Chrome-signed-in account → no Firefox, no multi-account (N10, N11) |
| Per-entity remote files | Thousands of files per scope → Drive rate limits (≈10 req/s/user) and slow listing |

Chosen: per-device append-only journals + compacted snapshots + content-addressed blobs, merged with per-data-class policies over HLC.

## Architecture (clean layers — N19)

```
UI (features/sync/ui)            ──runtime messages──▶  Background composition (entrypoints/background/handlers/sync.ts)
                                                              │
Application  (features/sync/app):   SyncEngine · ConnectionService · BindingService · RebindService · ProfileIdentityMigration
                                                              │ depends only on ports ▼
Domain       (features/sync/domain): HLC · ChangeRecord · field-path flattening · merge policies · scope routing · wire format v1   ← pure: no chrome.*, no fetch, no IndexedDB
                                                              │
Ports        (features/sync/ports):  StorageProvider · LocalSource · KeyValueStore (session/local) · Clock · IdSource
                                                              │
Adapters     (features/sync/adapters): google-drive (auth + REST + resumable upload) · settings/storageKeys/srs/dict/wordStatus/reader LocalSources
Registry:    providerRegistry — UI offers only registered providers
```

Dependency rule enforced by the existing `check-deep-imports`/`check-feature-cycles` gates plus an ESLint `no-restricted-imports` rule for `features/sync/domain`. Adding OneDrive/Dropbox = one adapter + registry entry + OAuth client config; no domain/app/UI-flow change.

### Port: `StorageProvider`

```ts
interface StorageProvider {
  readonly providerId: ProviderId;
  readonly displayName: string;
  authorize(opts: { interactive: boolean; accountHint?: string }): Promise<AuthorizedAccount>;
  revoke(connection: Connection): Promise<void>;
  list(connection: Connection, prefix: string): Promise<RemoteEntry[]>;
  read(connection: Connection, path: string): Promise<Blob>;
  write(connection: Connection, path: string, body: Blob): Promise<RemoteEntry>;
  remove(connection: Connection, path: string): Promise<void>;
  quota(connection: Connection): Promise<{ usedBytes: number; totalBytes: number | null }>;
}
interface AuthorizedAccount { accountKey: string; displayName: string; accessToken: string; expiresAt: number }
interface RemoteEntry { path: string; size: number; modifiedAt: number; providerChecksum?: string }
```

Contract (verified by a shared adapter contract test suite run against a fake in-memory provider and the Drive adapter with mocked HTTP):
- Flat path-addressed blob store inside the provider's app-scoped folder.
- `write` is upsert-by-path and idempotent for identical `(path, bytes)`: retrying after a crash never creates a second file. If the provider holds duplicates for a path (Drive allows same-name files), `list` returns one entry (newest `modifiedAt`) and the adapter deletes the others on the next `write` to that path.
- Large bodies: the adapter uploads resumably; it persists its own resume state (Drive resumable session URI) under a device-local key `syncAdapter:<providerId>:<path>:<contentHash>` and resumes when `write` is called again with the same bytes; the engine never sees session handles.
- Errors: `ProviderError { kind: 'auth' | 'quota' | 'network' | 'rate-limit' | 'not-found' | 'unknown' }`; the adapter retries `rate-limit`/5xx internally (3 tries, exponential backoff) before surfacing.
- Fit check: OneDrive (`/special/approot`, upload sessions, `If-Match` not required) and Dropbox (App folder, upload sessions, `mode: overwrite`) both provide these operations → port sufficient.

### Port: `LocalSource` (one per data class)

```ts
interface LocalSource {
  readonly dataClass: DataClass;
  pending(limit: number): Promise<PendingKey[]>;                   // IDB: outbox rows; KV: state diff vs record meta
  resolve(keys: PendingKey[]): Promise<ChangeRecord[]>;            // one record per key (coalesced), value = current local value or tombstone, hlc/firstHlc = record meta
  ack(keys: PendingKey[]): Promise<void>;
  snapshot(scope: Scope): AsyncIterable<ChangeRecord>;            // full local state of the scope with stored meta HLCs
  current(keys: RecordKey[]): Promise<Map<RecordKey, ChangeRecord | null>>;  // incl. tombstone meta
  applyRemote(records: ChangeRecord[]): Promise<ApplyResult>;      // writes winners + stamps record meta with the record's hlc/firstHlc in the same transaction; never creates outbox rows
}
```

- IDB sources keep a `syncMeta` store keyed by record key; the outbox helper writes meta (new `hlc`, `firstHlc` carried over or = `hlc` on first put, `op`) in the same transaction as the mutation; `applyRemote` stamps meta with the remote record's HLC in the same transaction as the write, so `current()` never returns a stale local HLC.
- KV sources (chrome.storage keys) keep `storage.local.syncMetaKV` `{ recordKey → { hlc, firstHlc, op, valueHash } }`. `pending()` is read-only: it flattens current synced values and returns keys whose current hash differs from meta. `resolve()` mints each candidate HLC without changing meta. The commit protocol first persists the frozen batch in `cell-sync`, then stamps `syncMetaKV` with those frozen records; a crash before the stamp leaves a durable batch and may cause only a benign duplicate record.
- Before a KV `applyRemote`, the source compares the current value hash with `syncMetaKV`. A mismatch is an unpushed local edit: it mints a local HLC, merges local and remote by the data-class policy and logs the conflict. If local wins, the value and old meta remain so the next `pending()` republishes it; if remote wins, the source writes the remote value and meta. With no drift, it writes the remote value then meta; a crash between those writes causes only a value-identical republish.

## Remote layout (wire format v1, per connection)

```
cell-sync/v1/
  meta/format.json                                              { formatVersion: 1 }
  meta/disconnect.json                                          { hlc, deviceId } — written on every SSOT disconnect of this connection (REQ-15)
  meta/routes/<scope>.json                                      { hlc, destinationConnectionId | "local" } — durable routing marker (REQ-5/6/10)
  meta/blobs-needed/<contentHash>                               repair request written by a puller that cannot find a blob
  scopes/<scope>/devices/<deviceId>/snapshot-<n>.json.gz        header { n, coversSeq }
  scopes/<scope>/devices/<deviceId>/journal-<seq>.json.gz
  blobs/<contentHash>
```

- Record-writing files live only under the writer's own `devices/<deviceId>/`; blobs are content-addressed; the shared `meta/` files are single-value LWW markers (by their HLC) whose concurrent overwrite is benign → no harmful write–write conflict on any provider. Every cycle reads the disconnect marker and route markers on each connected connection before pushing.
- Sequence allocator: `nextSeq` and `nextSnapshotN` per (connectionId, scope) live in the `cell-sync` IDB DB and are incremented in the same IDB transaction that stores the frozen pending batch. They never reset (compaction does not touch them), so a `seq` or `n` is never reused.
- Journal commit protocol (loss-free): (1) resolve records, then in one `cell-sync` transaction allocate `seq` and store the frozen batch with the current `cycleId`; (2) stamp KV meta from the durable batch (IDB meta was already atomic with its mutation); (3) upload referenced blobs and re-verify each by `list` immediately before step 4; (4) `write` the journal; (5) verify the cycle still owns the lock, then ack the pending keys and delete the batch. Retries always re-upload pending batches (same bytes, same path — idempotent) before draining new keys.
- Compaction: only when no pending batch exists for that (connection, scope), and own journals for the scope > 50, write `snapshot-<n>` with `coversSeq` = highest committed seq, then delete own older snapshot and journals `≤ coversSeq`. Snapshot publication follows the same upload-and-re-verify rule for every referenced blob. A reader whose cursor points at a deleted journal re-lists and restarts from the newest snapshot, then continues with journals `> coversSeq`.
- Blob GC: delete `blobs/<h>` only when no current snapshot/journal of any device in any scope of that connection references `h` and the blob is older than 30 days. Repair path: a puller missing a blob writes `meta/blobs-needed/<h>`; any device holding the content (hash recomputed from local data) re-uploads it and removes the marker.
- Device folders are never garbage-collected (their snapshots may hold the only copy of records).

## Record keys & flattening (wire encoding)

| Data class | Record keys |
|---|---|
| Global settings / secondary keys | `kv:<storageKey>/<path>` |
| Profile config | `profile` (existence), `profile/<path>` (fields) |
| Sync directory | `connection:<connectionId>`, `binding:<target>`, `systemConnection` |
| SRS entity | `<store>:<id>` (cards additionally carry per-component merge, see table) |
| Dictionary resource | `resource:<contentHash>` (existence + blob ref), `resource:<contentHash>/name`, `/enabled`, `/priority`, `/disabledComponents` |
| Word status | `word:<term>` |
| Reader | `book:<id>` (existence + blob ref), `book:<id>/title`, `/filename`, `/languageCode`, `progress:<bookId>/position` (`paragraphIndex`, `tokenIndex`, `updatedAt` as one unit), `progress:<bookId>/readTime/<deviceId>` |

Path encoding (JSON-pointer style): segments joined by `/`; `~` → `~0`, `/` → `~1` inside keys. Flattening walks plain objects recursively down to leaves (primitive, `null`, or atomic array). Arrays declared "per element" in the registry encode each element as `<arrayPath>/@<elementId>` whose value is the whole element object (element-level atomic LWW; no leaves inside an element); removing an element = tombstone on its element key; element order = element `order` field when present, else the element record's `firstHlc`. A put after a tombstone starts a new lifetime and resets `firstHlc` to that put's HLC. All other arrays are one leaf (whole-array LWW). A leaf that becomes absent → tombstone on its key. The reverse (unflatten) rebuilds the object from live (non-tombstone) records; unknown keys (from newer versions) and suppressed child puts are stored as full opaque records and republished unchanged in snapshots, but are not applied until supported or a newer parent existence put allows materialization.

## Data classes, keys & merge policy

| Data class | Local source | Scope | Record key | Merge |
|---|---|---|---|---|
| Global settings | `settings` (registry-synced paths) | global | `kv:settings/<path>` | LWW per key |
| Profile config | `settings.languageProfiles` element of that target | profile:<target> | `profile`, `profile/<path>` | LWW per key. Profile exists iff the latest `profile` record is a put. Create/re-create writes the `profile` put + every field put; delete writes tombstones for `profile` and every field key. Field puts older than the latest `profile` tombstone are discarded; a field put newer than a `profile` tombstone (edited offline after delete) is stored in meta but not materialized unless a newer `profile` put exists |
| Sync directory | `storage.local.syncState` | global | see Record keys | LWW per key |
| Secondary keys | `themeMode`, `themeConfig`, `tokenizeSettings`, `ocrSettings`, `studyModes`, `auto_download_whitelist` | global | `kv:<storageKey>/<path>` | LWW per key |
| SRS study configs | `studyConfigs` | every profile scope whose collection `defaultStudyConfigId` or deck `studyConfigId` references it (written into each) | `studyConfigs:<id>` | LWW per key (a device holding several scopes merges the copies by HLC) |
| SRS collections, decks, notetypes, notes | `Tihoka-srs-*` | profile of Target(`collection.targetLanguage`) | `<store>:<id>` | LWW per key |
| SRS cards | `cards` | profile | `cards:<id>` | Put vs put: `noteId`, `createdAt` immutable; `deckId` from the record with the higher HLC; per component winner = greater (`fsrsState.lastReview` absent = −∞, `reviewCount`), then record HLC; the winner's `studyAgainDue[component]` travels with it; `exploreCount` = max of both sides; `nextDue`/`maintenanceMode` recomputed via the existing card write path. Put vs tombstone: record HLC |
| SRS review events | `reviewEvents` | profile | `reviewEvents:<id>` | Immutable union by id (tombstone only via cascade delete) |
| SRS assets | `audioAssets`, `imageAssets` | profile | `<store>:<id>` | LWW per key by record HLC; bytes in `blobs/<contentHash>` |
| Dictionary resource | `langResourceInfo` + entries/frequency (`orca-dict-*-<target>`) | profile:<target> | `resource:<contentHash>` + field keys | Content immutable (blob); each metadata field LWW per key |
| Word status | `langWordStatus` | profile:<target> | `word:<term>` | LWW per key; setting `unknown` = tombstone |
| Reader book | `Tihoka-reader.books` | profile:Target(`languageCode`) | `book:<id>` + field keys | Each field LWW per key; `paragraphs` in `blobs/<contentHash>` |
| Reader progress | `Tihoka-reader.progress` | same as its book | `progress:<bookId>/position`, `progress:<bookId>/readTime/<deviceId>` | Position LWW per key. Read time: each device only writes its own `readTime/<ownDeviceId>` key (grow-only; merge = max); local `readTimeMs` = Σ of all devices' values. Local storage adds optional `readTimeByDevice` to `ReaderProgressRecord`; the reader write path adds its delta to the own-device entry; migration moves existing `readTimeMs` into the own-device entry |

Cascade on apply: applying a tombstone for a collection/deck/note/card runs the existing cascade locally (`deleteCascade.ts`) through the apply path (no outbox rows — every device performs the same cascade). A book tombstone also deletes/tombstones all `progress:<bookId>/*` keys. An incoming child put whose parent's latest meta is a tombstone is retained as an opaque record but not materialized.

Apply order within a batch (referential integrity): study configs → collections → notetypes → decks → notes → assets → cards → review events; dictionary content before its metadata; books before progress. Repositories do not enforce foreign keys, so a record whose parent arrives in a later batch is still stored and becomes consistent when the parent lands.

### Settings field registry (resolves granularity)

Settings objects are flattened to leaf paths; the registry declares what syncs and how arrays merge. Paths not in the synced list are device-local (and unknown remote paths are ignored for forward compatibility).

- **Never in global scope:** `languageProfiles` (each profile syncs in its own `profile:<target>` scope).
- **Never synced (device-local):** `schemaVersion`; `activeProfileId`; `studyModes.version`, `studyModes.activeModeId`; `*.tts.savedVoices`, `*.tts.hiddenLanguages`, `*.tts.localTtsEnabled`, `*.tts.localTtsLanguage` (reference OS/device voices and downloads); `auto_download_whitelist[].tabId` (stripped at capture); `srs.activeCollectionId`, `srs.activeDeckId`, `srs.activeNotetypeId`, `srs.activeLanguageProfileId`; `localPlayerSettings.lastDirectoryId`; `pronunciation.localFile.*`; `pronunciation.downloadEspeakTtsData`; `*.tts.voices`, `*.tts.downloadedLanguages`; the active-profile mirror fields (`subtitleOverlayTargetLanguage`, `subtitleOverlayNativeLanguage`, `subtitleOverlayAutoLoad`, `subtitleOverlayAutoLoadAsr`, `subtitleOverlayAutoTranslate`, `subtitleOverlayTargetStyle`, `subtitleOverlayNativeStyle`, top-level `dictionaryPopup`) — re-derived by `resolveSettingsFlatFields` after apply; `subtitleApiKeys[].status`, `subtitleApiKeys[].rateLimitedUntil` (runtime state).
- **Arrays merged per element:** `subtitleApiKeys` by `id` (synced plaintext — owner decision); `*.dictionaryPopup.externalDictLinks` by `id`; `keyboardShortcuts` by `action`; `studyModes` custom modes by `id`; `studyModes.advanced.cleanupRules.custom` by `id`; `auto_download_whitelist` by normalized `url`. Element order per Record keys & flattening.
- **Arrays merged atomically (whole-array LWW):** everything else, e.g. `pronunciation.fallbackEngines`, `selectedSubtitleLanguages`.
- **Maps** (`subtitlePreference`, `subtitleOffset`, `cardCreator.fieldMappings`, `dictionaryPopup.defaultActiveTabPerLang`, `tokenizeSettings`, `ocrSettings.origins`) merge per inner key automatically through leaf-path flattening.
- Incoming values pass through the existing normalizers (`coerceDefaultTypes`, `validateNavClusterFields`, `validateLocalPlayerSettings`, `normalizeOverlayStyle`) before apply.

Device-local by design (not in any data class): `orca-local-player` library/history and immersion stats derived from it, `Tihoka-local-audio-index`, `Tihoka-local-file-handles`, `langWordTrash` (24 h soft-delete window; the delete itself syncs as a tombstone), UI layout prefs (`cueFilterMode`, `playerModeContentPct`, `splitViewPct`, `orbitalBadgePosition`, `localPlayerSubtitlePanelOpen`, `dictionarySearchHistory`, `subtitleManagerSheetHeightVh`, `universalPanelTab`), session keys, `lookupLog`, `ankiSchemaCache`, and every `sync*` key except `syncState` (the sync directory, which is a synced data class).

## Requirements

Dependency order for slicing: REQ-1/2 → REQ-3 → REQ-7 → REQ-8/10 → REQ-9/11/12 → REQ-4/5/6/15/16 → REQ-13/14/17.

### Functional

REQ-1: One profile per target language
- Actor: Learner
- Goal: Each target has exactly one profile; native is only the translation language
- Preconditions: settings loaded
- Basic flow:
  1. actor submits a new profile (target, native) or edits an existing profile's native/settings
  2. system rejects a new profile whose target already has a profile (any native), else assigns id `profile-<target>` and saves
  3. system returns the localized validation message or the saved profile
- Alt flow: edit of an existing profile never changes its target (target is immutable after creation; DELIVER removes any target-edit affordance)
- Exception: none beyond validation
- Rules: replaces the target+native duplicate rule in `validateLanguageProfile` (`src/entities/settings/lib/profileResolution.ts:54-79`); deterministic ids make the same target converge to the same profile on every device without remapping
- Postcondition: no two profiles share a target
- NFR refs: NFR-8

REQ-2: Profile identity migration (one-time, before sync)
- Actor: Browser runtime (background `onInstalled`/`onStartup`)
- Goal: Existing installs converge to one profile per target with deterministic ids and zero data loss
- Preconditions: `syncMigrations.profileIdentity` ≠ `done`
- Basic flow:
  1. system groups profiles by target; survivor = lowest (`order`, `id`) — deterministic, independent of the device-local active profile; survivor's fields kept
  2. system rewrites `languageProfileId` of every SRS collection pointing to any profile of the group to `profile-<target>` (IDB transaction)
  3. system saves settings with survivor ids renamed to `profile-<target>`, losers dropped, `activeProfileId` and `srs.activeLanguageProfileId` remapped, `order` recomputed (sort by (order, target))
  4. system sets `syncMigrations.profileIdentity = done` and logs `{ oldId → newId }`
- Alt flow: no duplicates → ids renamed only
- Exception: step 2 fails → steps 3–4 not run; retried next startup (idempotent: already-renamed collections are no-ops)
- Rules: runs as a dedicated async step outside the synchronous `loadSettings` migrations map (`settingsStore.ts`); the sync engine does not start until it is `done`; no SRS row is deleted; resource `profileIds` is ignored (profile scoping of resources already removed — `ResourcesPanel.test.tsx:280`)
- Postcondition: every profile id = `profile-<target>`; every collection points to an existing profile id or to a target without profile (kept, synced in that target's scope)
- NFR refs: NFR-2

REQ-3: Connect a storage account
- Actor: Learner
- Goal: Authorize an account on a provider as a connection
- Preconditions: provider registered; REQ-2 done
- Basic flow:
  1. actor chooses a provider from the registry list and presses its connect button
  2. system runs `authorize({ interactive: true })` (Drive: `launchWebAuthFlow`, `response_type=token`, scopes `drive.appdata openid email`, `prompt=select_account`)
  3. actor completes consent on the provider page
  4. system resolves `accountKey` (`sub`) + `displayName` (email) via the userinfo endpoint, stores the token in `storage.session`, and writes `connection:<id>` into the sync directory (global scope)
  5. if it is the first connection: system writes `systemConnection = <id>` and `binding:<target> = <id>` for every profile; capture (REQ-7) is enabled
  6. if the connection holds `meta/disconnect.json`: system deletes it (reconnect overrides a prior SSOT disconnect)
  7. system runs reconciliation (REQ-9) for global and every scope bound to it, and reports status
- Alt flow: `connection:<id>` already in the directory (connected on another device) → this device just stores its token; bindings from the directory apply (REQ-16 resolves)
- Exception: consent cancelled → no state change, neutral message; network failure → connect error message with "Try again" action; account denies a scope → message naming the missing permission with "Try again"
- Rules: no client secret anywhere; client id from `import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID`; connect button + copy follow Google sign-in branding guidelines (https://developers.google.com/identity/branding-guidelines)
- Postcondition: connection listed as connected
- NFR refs: NFR-3, NFR-5, NFR-7

REQ-4: Bind a profile
- Actor: Learner
- Goal: Choose where one profile's data lives
- Preconditions: ≥1 connection
- Basic flow:
  1. actor selects a connection or "Don't sync" for a profile
  2. if the scope has never been synced: system writes `binding:<target>` and runs REQ-9 for it on the new connection (nothing runs for `local`)
  3. system shows the new binding and status
- Alt flow: the scope already has synced data on its current connection → REQ-5
- Exception: target connection `needs-reauth` → refused with "Sign in again" action
- Rules: scopes of targets without a profile are routed to `systemConnection`; a newly created profile's binding defaults to the connection its scope is currently routed to (`systemConnection`), so creating a profile never re-routes existing remote data — moving it is always REQ-5; `local` → no records of that scope are written remotely, its pending keys are acked locally; bindings replicate via global scope
- Postcondition: binding persisted and replicated
- NFR refs: NFR-7

REQ-5: Rebind with migration
- Actor: Learner
- Goal: Move a synced scope to another connection (or to local) without loss
- Preconditions: scope bound to A with remote data; destination B connected (or `local`)
- Basic flow:
  1. actor confirms rebind A → B; system freezes push routing for the scope (its pending keys are held, not pushed to A) until step 5 completes or the rebind aborts
  2. system pulls the scope from A (REQ-10) so local state includes every device's records
  3. system writes a full snapshot of the scope (original HLCs) and referenced blobs to B, recording written paths in `syncCheckpoints`
  4. system verifies each written path lists on B with expected size (and `providerChecksum` when available)
  5. system persists a routing-drain obligation, writes the same LWW `meta/routes/<scope>.json` marker to A and B, then writes `binding:<target> = B` (global scope)
  6. system pushes held pending keys to B, publishes and verifies its final full snapshot there, then clears the routing freeze/checkpoint
  7. system asks the actor whether to delete the scope's files on A; default keep
  8. if actor chooses delete: system removes `scopes/<scope>/` on A (never the route marker; blobs follow blob GC), then re-lists and sweeps leftovers on each cycle for 24 h
- Alt flow: B = `local` → steps 3–5 become "write binding = local"; step 6 still asks
- Exception: failure or termination during 2–4 → binding stays A; checkpoint (incl. the routing freeze) resumes on next cycle or manual retry; the learner can cancel the rebind, which lifts the freeze and pushes held keys to A; B quota → `storage-full` on B, binding stays A
- Rules: A's scope files are never modified unless the actor chooses delete; route markers are control metadata, not scope data. Every device that observes a newer route marker or directory routing key persists a drain obligation before applying that routing change, stops pushing to the vacated connection, and publishes its own full scope snapshot to B before clearing the obligation (REQ-10 step 6). A device without B's token keeps its pending keys and shows `waiting-connection`; it never resumes writing to A. A later move back to A writes a newer active marker there, so stale markers cannot win.
- Postcondition: B holds the complete scope; binding = B
- NFR refs: NFR-2, NFR-4

REQ-6: Change the system connection
- Actor: Learner
- Goal: Move global scope to another connection
- Preconditions: ≥2 connections
- Basic flow: REQ-5 applied to scope `global`, using `systemConnection = <new id>` as its routing record; the delete-old-copy question is asked the same way
- Exception: as REQ-5
- Rules: `systemConnection` is a single LWW key → concurrent changes converge to exactly one system connection
- Postcondition: exactly one system connection
- NFR refs: NFR-2

REQ-7: Capture local changes
- Actor: Browser runtime
- Goal: Every sync-relevant mutation is captured with its scope and HLC, atomically, with no echo of remote applies
- Preconditions: ≥1 connection exists (before the first connection nothing is captured; REQ-9's snapshot covers prior state)
- Basic flow (IndexedDB data classes):
  1. mutations in the synced stores (SRS DB, `langResourceInfo`, `langWordStatus`, `Tihoka-reader`) call a shared helper inside the same transaction; repositories open that transaction over the mutated store plus the parent stores needed for scope resolution and `syncOutbox`/`syncMeta` (SRS DB v2, dictionary DB v13, reader DB v2)
  2. the helper resolves scope before the write/delete executes: card/note/deck/asset/review event → parent chain → Target(`collection.targetLanguage`); cascades delete children before parents (`src/features/srs/repositories/deleteCascade.ts`) so the chain exists at every step; study configs → every referencing profile scope; dictionary/word status → Target(DB lang); books/progress → Target(`languageCode`) rule
  3. the helper mints an HLC (context clock), writes `{ scope, dataClass, key, op }` to `syncOutbox` and record meta to `syncMeta`; per-field record keys (dictionary metadata, book fields) are derived by diffing the previous row against the new row inside the transaction
  4. dictionary entry/frequency bulk writes during import create no per-row records; import completion writes the `resource:<contentHash>` put and its field keys
  5. creating/updating a collection or deck also emits its referenced `studyConfigs:<id>` record into that profile scope when the scope does not already hold an equal-or-newer copy
- Basic flow (chrome.storage data classes — settings, secondary keys, sync directory):
  6. there is no change listener capture; `storage.onChanged` for synced keys only schedules the debounced cycle
  7. at each push and at every background startup, the KV source read-only diffs current values against `syncMetaKV` (REQ-8 `pending()`), which also captures writes that landed while the background was not running
  8. sync directory mutations performed by the engine itself (connect, bind, disconnect) are ordinary writes to `syncState` and are captured by the same diff
- Echo freedom: `applyRemote` stamps record meta with the remote HLC and value hash (IDB: same transaction; KV: after checking for local drift), so a remote-only apply is not re-published
- Exception: outbox/meta write fails → the whole IDB transaction aborts, so a mutation never lands without its capture; quota → existing quota handling (e.g. `WordStatusQuotaError`) plus scope state `local-storage-full`
- Postcondition: every unsynced mutation is represented by an outbox row (IDB) or a meta difference (KV)
- NFR refs: NFR-1, NFR-2, NFR-6

REQ-8: Push
- Actor: Browser runtime (debounce 300 ms trailing / 1500 ms hard deadline after a committed outbox capture or synced-key change — push-only fast pass; alarm every 15 min, startup, `online`, "Sync now" run the full cycle; extended by spec `sync-on-use` / ADR-111)
- Goal: Upload own changes per scope
- Preconditions: sync lock acquired (REQ-17)
- Basic flow:
  1. system reads and applies newer disconnect and route markers on the connection before selecting any destination
  2. system first re-uploads any pending batches left by earlier cycles (commit protocol); compaction is forbidden for that (connection, scope) until all its pending batches commit
  3. system collects pending keys from every source (`pending()`), groups by scope, acks keys of `local` scopes, holds keys of scopes frozen by a rebind or routing-drain obligation (REQ-5/10)
  4. system resolves one record per key (value + meta HLC) and freezes one batch per scope with an allocated `seq` (commit protocol step 1)
  5. system uploads and re-verifies referenced blobs, writes the journal, re-checks lock ownership, acks, deletes the pending batch, compacts when needed
- Exception: provider error → pending batch kept, retried with exponential backoff (30 s → 30 min, scheduled by alarm, lock released); `auth` → connection `needs-reauth`; `quota` → `storage-full`; `network` → `offline`; lock lost (fencing) → cycle aborts without acking; the pending batch is re-uploaded by the next owner
- Rules: no journal or snapshot is published until every referenced blob is verified present; duplicate records across two files (e.g. after an aborted cycle) are harmless because apply is idempotent per (key, hlc)
- Postcondition: remote journal contains the records; pending keys acked
- NFR refs: NFR-1, NFR-4, NFR-6

REQ-9: Reconciliation (first connect, new binding, restore)
- Actor: Browser runtime
- Goal: Merge local and remote without overwriting either side
- Basic flow:
  1. system pulls every remote record of the scope (REQ-10)
  2. system skips publishing any local SRS collection that has zero notes in all its decks when remote already has a collection for that target (auto-created defaults are not duplicated); non-empty collections are all kept
  3. system uploads and verifies every referenced blob, then publishes a full local snapshot of the scope under its deviceId (allocated `n`, `coversSeq` = that device's highest committed journal seq) and acks pending keys it subsumes
  4. fresh install (no local profile before restore): restored profiles appear; `activeProfileId` = first restored profile by (order, target)
- Exception: as REQ-8 / REQ-10
- Rules: the merge policy table is the only conflict rule; no side wins wholesale
- Postcondition: local = merge(local, remote); remote has this device's snapshot
- NFR refs: NFR-2, NFR-4

REQ-10: Pull and merge
- Actor: Browser runtime (startup, alarm every 15 min, "Sync now", after connect, and qualifying user actions via the `sync-on-use` bell probe — ADR-111)
- Goal: Apply other devices' changes
- Basic flow:
  1. per scope routed to a connected connection, system lists `devices/*/` excluding its own deviceId
  2. system reads snapshot/journal files newer than the stored cursor, in (snapshot, seq) order
  3. for each record, system compares with `current()` using the data-class policy; winners go to `applyRemote` in dependency order (tombstones of parents cascade, children of tombstoned parents are retained as opaque records — see Data classes); the background clock and `storage.session.syncClockWall` advance past each observed HLC
  4. system downloads blobs needed by winners
  5. system applies winners whose blobs are available; records awaiting blobs are persisted in `cell-sync.deferredRecords`, after which the source-file cursor may advance. It then broadcasts `SYNC_DATA_APPLIED { dataClasses, scopes }` and bumps `storage.session.syncAppliedAt`; SRS, dictionary, word-status, Reader and settings surfaces re-read on it
  6. before applying any routing change (`binding:<target>` put/tombstone, `systemConnection`, or a newer route marker), system persists a routing-drain obligation and does not advance that control record's cursor until the obligation exists. It applies the route, stops writes to the vacated connection, publishes and verifies its own full snapshot on the destination when connected, then clears the obligation. Route to `local` stops remote writes and retains local state; an unavailable destination yields `waiting-connection` with pending keys retained
  7. SSOT disconnect detection: if a connection holds `meta/disconnect.json` whose HLC is newer than this device's latest `connection:<id>` put, or the directory's latest `connection:<id>` record is a tombstone, system applies the disconnect locally (REQ-15 step 5); every cycle reads `meta/disconnect.json` of each connected connection (one small read), so devices that never pull global scope still observe it
  8. system answers `meta/blobs-needed/<h>` markers for content it holds (re-upload, remove marker), then drains matching deferred records and deletes them only after successful apply
- Alt flow: a device's newer snapshot exists → cursor jumps to it and continues with journals `> coversSeq`
- Exception: cursor points to a journal deleted by compaction → re-list, restart from newest snapshot; corrupt or unknown `formatVersion` file → skipped, logged, scope `warning`; blob missing → its full change record is persisted in `deferredRecords`, `meta/blobs-needed/<h>` is written, later records continue, and `warning` appears after 3 cycles; provider errors mapped as in REQ-8
- Rules: apply is idempotent; conflicts (REQ-18 definition) are appended to the conflict log
- Postcondition: local reflects winners; open surfaces refreshed
- NFR refs: NFR-2, NFR-4, NFR-6

REQ-11: Dictionary content sync
- Actor: Browser runtime (within REQ-8/10)
- Goal: A dictionary installed on one device is usable on another without the source file
- Basic flow:
  1. push: system serializes the resource's entries + frequency rows in portable form (no local numeric ids), computes `contentHash`, stores it on the resource (`ResourceInfo.contentHash`, new optional field), gzips and uploads `blobs/<contentHash>`
  2. pull: if a local resource with the same `contentHash` exists, system maps to it and applies metadata only; otherwise it downloads the blob (status shows "restoring dictionary" with progress), imports rows through the existing repositories with new local ids, writes `langResourceInfo` with synced metadata, and rebuilds the phrase index via the existing builder (`src/features/dictionary/logic/phraseIndexBuilder.ts`)
- Exception: import interrupted → partial resource removed, retried next cycle; local quota → `local-storage-full`
- Rules: resources match by `contentHash`, never by numeric id or `signature`; metadata edits never re-upload content
- Postcondition: lookups on the receiving device equal the source device's for that resource
- NFR refs: NFR-4, NFR-9

REQ-12: Deletion propagation
- Actor: Browser runtime
- Goal: Deleted data never resurrects
- Basic flow: deletes produce tombstones (REQ-7); merge applies a tombstone when its HLC is newer than the local record's
- Rules: tombstones never expire (compaction keeps the latest record per key, tombstones included), so a device offline for any length of time cannot resurrect deleted data; deleting a profile follows the profile existence rule (Data classes), tombstones `binding:<target>`, and triggers the persisted routing-drain flow in REQ-10; the scope's SRS/dictionary/book data stays local and remains routed to `systemConnection` (profile-less target rule, REQ-4) — re-creating the profile for that target writes a newer `profile` put under the same deterministic id and re-links it with no data move
- Postcondition: deleted entity absent on every device after sync
- NFR refs: NFR-2

REQ-13: Token lifecycle
- Actor: Browser runtime
- Goal: Keep syncing without learner action while the provider session lives
- Basic flow:
  1. missing token (browser restart clears `storage.session`), ≤5 min to expiry, or HTTP 401 → adapter calls `authorize({ interactive: false, accountHint: email })` (Drive: `prompt=none`, `login_hint`)
  2. success → token replaced in `storage.session`
- Exception: silent failure → connection `needs-reauth`; only scopes routed to it pause; outbox and pending journals retained; status offers "Sign in again" (interactive REQ-3 for that account)
- Rules: tokens never in `storage.local`, never logged
- Postcondition: valid token or visible `needs-reauth`
- NFR refs: NFR-3, NFR-5

REQ-14: Sync status, manual sync, privacy notice
- Actor: Learner
- Goal: See whether data is safe, force a sync, understand where data goes
- Basic flow:
  1. actor opens the Sync section in Settings
  2. system shows connections (provider, email, system badge, connection state) and each profile (binding, scope state, last synced relative time, restore progress) plus the privacy notice (what is stored, where, how to disconnect)
  3. actor presses "Sync now" → system runs a cycle (joins the running cycle if one is active) and updates status live
- Alt flow: offline → "Sync now" shows the offline state without starting a cycle
- Rules: states are the enums in Flows/States; every non-healthy state shows exactly one labeled action button; all copy in `en.json` + `vi.json`
- NFR refs: NFR-7, NFR-8

REQ-15: Disconnect (SSOT)
- Actor: Learner
- Goal: Stop syncing an account on every device
- Preconditions: connection exists
- Basic flow:
  1. actor opens disconnect; system lists the profiles that will stop syncing; actor confirms
  2. system pushes pending keys of scopes routed to that connection (final flush)
  3. system writes `meta/disconnect.json { hlc, deviceId }` into that connection (always)
  4. system writes into the directory a tombstone for `connection:<id>` and `binding:<target> = local` for its bound scopes, and pushes global scope (if the disconnected connection is itself the last connection, step 3 is the only propagation path)
  5. system (and every device on observing step 3 or 4 via REQ-10 step 7) drops its token, revokes it best-effort, and stops all requests to that account
  6. system reports: local data intact on all devices, cloud files kept
- Alt flow: connection unreachable (offline / `needs-reauth`) → system persists `syncDisconnectPending:<connectionId>` and state `disconnect-pending`; token is kept and steps 2–5 run on the next cycle where the connection is reachable, then the flag is removed; the learner can "Sign in again" to complete it
- Exception: disconnecting `systemConnection` while others exist → actor must pick the new system connection first (REQ-6); crash between steps 3 and 4 → the next cycle observes its own marker and completes step 4 (idempotent)
- Rules: reconnecting the account later (any device) creates a newer `connection:<id>` put and removes `meta/disconnect.json`
- Postcondition: no device sends requests to that account until reconnected
- NFR refs: NFR-3

REQ-16: Missing connection on a device
- Actor: Browser runtime
- Goal: Tell the learner which account a profile needs on this device
- Basic flow: after pulling global scope, a scope bound to a `connection:<id>` without a token on this device is shown in state `waiting-connection` with action "Connect <provider> <email>"
- Postcondition: nothing of that scope is pulled or pushed until connected
- NFR refs: NFR-7

REQ-17: Single-flight cycle lock
- Actor: Browser runtime
- Goal: At most one sync cycle at a time, never a dead lock
- Basic flow: lock = `{ cycleId, expiresAt }` in `storage.session`; acquire if absent or expired; heartbeat renews `expiresAt = Date.now() + 2 min` every 30 s while running; release at end
- Rules: an expired lock is stealable (covers service-worker/event-page termination); fencing — before every remote write and before every ack the cycle re-reads the lock and aborts if `cycleId` changed (a stalled-but-alive former owner can never ack or write after a steal); `seq` allocation is serialized by the `cell-sync` IDB transaction, so two cycles can never obtain the same `seq`; backoff waits are scheduled with `chrome.alarms`, never while holding the lock
- NFR refs: NFR-4

REQ-18: Conflict log
- Actor: Browser runtime
- Goal: Diagnose merges
- Basic flow: a conflict is a remote record applied (or rejected) for a key that still has an unpushed local change (pending key); each conflict appends `{ at, scope, dataClass, key, localHlc, remoteHlc, winner }` to `storage.local.syncConflictLog` (ring buffer, 500 entries, no values stored)
- Rules: exposed through the existing debug seam only, not in the learner UI
- NFR refs: NFR-2

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Capture overhead | P | ≤2 extra puts (outbox + meta) per mutation, same transaction |
| NFR-2 | No silent data loss / convergence | R | Property tests: random interleavings of puts/deletes/binding changes on 3 simulated devices with the in-memory provider converge to identical state equal to the policy result; zero lost review events |
| NFR-3 | Credential handling | +security | Tokens only in `storage.session`; no client secret in repo/bundle; client id only via env |
| NFR-4 | Resilience | R | Every step survives background termination and network loss; resume produces no duplicate/corrupt remote files |
| NFR-5 | Least privilege | +privacy | Drive scopes exactly `drive.appdata openid email`; manifest adds `identity`, `alarms` and the public `key` field only |
| NFR-6 | Sync cost | P | Idle cycle: ≤1 list request per routed scope; per-cycle work O(changed records + new remote files) |
| NFR-7 | Usability | U | Connect = one button + provider consent; each non-healthy state has one labeled action button; responsive, keyboard- and screen-reader-accessible |
| NFR-8 | i18n | U | All new strings in `en.json` + `vi.json` |
| NFR-9 | Large content | P/R | 100 MB dictionary first sync completes across background restarts |
| NFR-10 | Cross-browser | S | Same engine/adapter on Chrome (service worker) and Firefox desktop ≥128 (event page; the existing Firefox floor, which also provides `storage.session` and `identity.launchWebAuthFlow`) |
| NFR-11 | Architecture | S | Domain imports no `chrome.*`/`fetch`/IndexedDB/adapter modules (lint-enforced); a provider is added without domain/app changes |
| NFR-12 | Store compliance | +legal | Firefox `data_collection_permissions` in `scripts/build-firefox.mjs` updated per Mozilla's current categories to declare user data transmitted to the user's chosen storage provider; Chrome Web Store privacy practices draft prepared (submission is owner's later production step) |

## Flows / States

Connection state (per device):
```
connected --silent re-auth fails→ needs-reauth --interactive sign-in ok→ connected
connected --quota error→ storage-full --retry ok→ connected
connected --network error→ offline --online / retry ok→ connected
connected | needs-reauth | offline --learner disconnects while unreachable→ disconnect-pending --reachable next cycle→ disconnected
any --SSOT disconnect completed (own or observed)→ disconnected
```

Scope state (per profile / global):
```
local-only                         (binding = local)
waiting-connection                 (bound connection has no token here)
idle --cycle starts→ syncing --ok→ synced(at) --next cycle→ syncing
syncing --blob missing ×3 / corrupt file→ warning (keeps syncing other records)
warning --deferred records repaired / bad file removed→ syncing
syncing --provider error→ follows connection state
syncing --local quota→ local-storage-full --space freed + retry→ syncing
```

Sync cycle:
```
wake (alarm | startup | online | debounce | Sync now)
 → acquire lock (REQ-17)
 → for each connected connection: push (REQ-8) → pull (REQ-10)
 → release lock → publish status
```

Rebind:
```
bound(A) --confirm B→ frozen+pulling(A) → copying(B, checkpoint) --all verified→ bound(B) → push held keys to B → ask delete A? (keep | delete → delete + 24 h sweep)
pulling/copying --failure/termination→ bound(A) + checkpoint (still frozen) --retry→ copying
pulling/copying --learner cancels→ bound(A), freeze lifted, held keys pushed to A
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Enforce one profile per target | Target-duplicate validation message; target immutable in profile editor; REQ-2 migration |
| Authorize storage accounts | Provider list (registry-driven), branded connect button, "Sign in again" action |
| Keep tokens valid | Silent renewal; `needs-reauth` state with action |
| Route scopes to connections | Per-profile binding selector (connections + "Don't sync"), system-connection selector, rebind confirmation with progress, delete-old-copy prompt |
| Capture changes | IDB outbox helper (same transaction); chrome.storage state diff against record meta |
| Replicate + merge | Background cycle, alarms, debounce, "Sync now" |
| Propagate deletions | Tombstones in outbox/journals/snapshots |
| Transfer large content | Resumable blob transfer; "restoring dictionary" progress |
| Communicate sync health | Sync section: connection rows, profile rows, states + actions, waiting-connection notice, privacy notice |
| Stop syncing everywhere | Disconnect with affected-profile list + confirmation; `disconnect-pending` state |
| Diagnose merges | Conflict log via debug seam |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Sync directory | `connection:<id>` {providerId, accountKey, displayName}, `binding:<target>`, `systemConnection` | `storage.local.syncState` (synced, global scope) | persistent |
| Token | connectionId, accessToken, expiresAt | `storage.session` | browser session |
| Device | deviceId | `storage.local.syncDevice` | persistent |
| Clock | background lastHlc (persisted); `syncClockWall` shared wall floor | `storage.local.syncDevice`, `storage.session.syncClockWall` | persistent / session |
| Cursors | (connectionId, scope, deviceId) → {snapshot n, seq} | `storage.local.syncCursors` | persistent |
| Outbox (IDB) | autoinc, scope, dataClass, key, op | `syncOutbox` store in SRS DB v2, dictionary DB v13, reader DB v2 | until acked |
| Record meta (IDB) | recordKey → {hlc, firstHlc, op, valueHash} (tombstones kept) | `syncMeta` store in the same DBs | persistent |
| Record meta (KV) | recordKey → {hlc, firstHlc, op, valueHash} (tombstones kept) | `storage.local.syncMetaKV` | persistent |
| Sequence counters | (connectionId, scope) → nextSeq, nextSnapshotN | IDB `cell-sync` DB | persistent, never reset |
| Pending journals | connectionId, scope, seq, cycleId, frozen records | IDB `cell-sync` DB | until committed |
| Routing freeze + checkpoints | scope, from, to, routeHlc, written paths, held/drain state | `storage.local.syncCheckpoints` | until destination verified/cancelled |
| Deferred records | connectionId, scope, source path, record key, full record, required blob hashes, attempts | IDB `cell-sync.deferredRecords` | until applied |
| Opaque records | scope, record key, full winning record | IDB `cell-sync.opaqueRecords` | until superseded/materialized |
| Sweep list | scope, connection, until | `storage.local.syncSweeps` | 24 h |
| Pending disconnects | connectionId, requestedAt | `storage.local.syncDisconnectPending:<connectionId>` | until completed |
| Adapter resume state | provider session URI | `storage.local.syncAdapter:*` | until upload done |
| Lock | cycleId, expiresAt | `storage.session.syncLock` | cycle |
| Conflict log | see REQ-18 | `storage.local.syncConflictLog` | ring 500 |
| Migrations | `profileIdentity` | `storage.local.syncMigrations` | persistent |
| New field | `ResourceInfo.contentHash?` | `langResourceInfo` | with resource |
| New field | profile ids `profile-<target>` | `settings.languageProfiles` | persistent |
| New field | `ReaderProgressRecord.readTimeByDevice?` | `Tihoka-reader.progress` | with progress |

SRS DB v1→v2, dictionary DB v12→v13 and Reader DB v1→v2 upgrades install `onversionchange` close handlers (mirroring `baseRepository.ts:48-51`) so open connections in other contexts do not block an upgrade.

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 | REQ-8, REQ-9, REQ-10 | SC-1, SC-3, SC-4 |
| N2 | REQ-11 | SC-5 |
| N3 | REQ-8, REQ-10, settings registry | SC-2, SC-20 |
| N4 | REQ-7, REQ-8 | SC-2 |
| N5 | REQ-7, REQ-8, REQ-10 | SC-2, SC-21, SC-33 |
| N6 | REQ-10, merge table | SC-3, SC-4, SC-22, SC-36 |
| N7 | REQ-3, REQ-13 | SC-12, SC-13 |
| N8 | REQ-14, REQ-16 | SC-11, SC-19, SC-24 |
| N9 | REQ-8, REQ-11, REQ-17, NFR-4, NFR-9 | SC-9, SC-28, SC-29, SC-34, SC-35, SC-37 |
| N10 | NFR-10 | SC-14 |
| N11 | REQ-4, REQ-16, REQ-7 (Target rule) | SC-6, SC-24, SC-32 |
| N12 | REQ-3, REQ-6 | SC-7 |
| N13 | REQ-5 | SC-8, SC-35 |
| N14 | REQ-1 | SC-15 |
| N15 | REQ-2 | SC-16 |
| N16 | REQ-12 | SC-10, SC-30 |
| N17 | REQ-9 | SC-4 |
| N18 | REQ-4 | SC-17 |
| N19 | Architecture, NFR-11 | SC-18 |
| N20 | Merge table (Reader), REQ-7, REQ-10 | SC-23 |
| N21 | REQ-15 | SC-25, SC-31 |
| N22 | REQ-5, REQ-6 | SC-26 |
| N23 | REQ-18 | SC-27 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1. Connect once, snapshot, background sync, visible status | REQ-3, REQ-7, REQ-8, REQ-9, REQ-14 |
| 2. New device connects, full restore incl. dictionaries | REQ-3, REQ-9, REQ-10, REQ-11, REQ-16 |
| 3. Alternate A↔B, merge without loss | REQ-10, REQ-12, REQ-18 |
| 4. Split a profile to a second account | REQ-3, REQ-4, REQ-5 |
| 5. Edges: offline, revoke, full, partial connections | REQ-8, REQ-13, REQ-14, REQ-16, REQ-17 |

## Boundaries

- Always: domain pure and unit-tested; every write to synced IDB stores goes through the outbox helper; tokens only in `storage.session`; strings via i18n; UI from `src/shared/ui` + tokens; icons from `ICON_CATALOG`.
- Ask first: any new dependency (target: none — `CompressionStream`, `crypto.subtle`, `fetch` suffice); manifest changes beyond `identity`, `alarms`, `key`.
- Never: read/print/commit `.env.local` values or the client secret; modify or delete data under a connection being migrated away from unless the learner chose delete; overwrite local or remote state wholesale.

## Success Criteria

- [ ] SC-1: Fresh install + connect the system account restores profiles, synced global settings, secondary keys, SRS collections/decks/notes/cards/review events/assets, word statuses and Reader books/progress for every scope bound to that account
- [ ] SC-2: A change on device A (synced global setting leaf, profile field, secondary key, SRS review, word status, dictionary import or metadata) appears on device B after one cycle on each device, with no learner action beyond waiting or "Sync now"
- [ ] SC-3: Same card reviewed on A and B between syncs → both devices hold every review event; each component equals the component with the later `lastReview`, with its `studyAgainDue`
- [ ] SC-4: Device with local data connects to an account with remote data → union of both per policy table; an empty auto-created collection is not duplicated
- [ ] SC-5: Dictionary imported on A (any filename) is usable on B without the source file; a fixed 50-term sample returns identical lookups; the same dictionary imported on both devices under different filenames ends as one resource on each
- [ ] SC-6: Profiles bound to different connections → a scope's files exist only under its connection; a `local` scope has no remote files written after the switch
- [ ] SC-7: Global scope files are written only to `systemConnection`; changing it copies global scope and keeps every synced setting; concurrent changes on two devices converge to one system connection
- [ ] SC-8: Rebind A→B → B holds the complete scope before the binding switches; A unchanged when "keep" is chosen; terminating the background mid-copy leaves binding = A and a retry completes
- [ ] SC-9: Terminating the background during a 100 MB blob upload or between journal upload and outbox ack resumes with no duplicate or corrupt remote files and no lost records
- [ ] SC-10: Deleting a profile/dictionary/card/word on A removes it on B; a third device offline for the whole period does not resurrect it after reconnecting
- [ ] SC-11: Sync section shows connection rows and profile rows with state + last synced time; each non-healthy state (`needs-reauth`, `storage-full`, `local-storage-full`, `offline`, `waiting-connection`, `disconnect-pending`, `warning`) shows one labeled action; "Sync now" runs or joins a cycle
- [ ] SC-12: Access tokens absent from `storage.local`, logs and build output; client secret absent from repo and bundle
- [ ] SC-13: Missing/expiring token renews silently; forced silent failure moves only that connection to `needs-reauth` and keeps its pending keys and pending journals
- [ ] SC-14: SC-1, SC-2, SC-5 pass on Chrome and Firefox desktop with the OAuth app in Testing mode and a test-user account
- [ ] SC-15: Creating a profile for an existing target (any native) is rejected with a localized message; an existing profile's target cannot be edited
- [ ] SC-16: Settings with two same-target profiles migrate to one `profile-<target>`; all SRS collections/cards/review events of both remain and point to it; re-running the migration changes nothing
- [ ] SC-17: "Don't sync" stops all remote writes for that scope; its pending keys are acked locally
- [ ] SC-18: `features/sync/domain` imports no `chrome.*`/`fetch`/IndexedDB/adapter module (lint fails otherwise); the engine test suite passes against the in-memory provider and the adapter contract suite passes for the Drive adapter
- [ ] SC-19: Connect button follows https://developers.google.com/identity/branding-guidelines (logo, label, colors); the Sync section shows the privacy notice
- [ ] SC-20: `activeProfileId`, `srs.active*`, local-file handle ids, `tts.voices`/`downloadedLanguages` and runtime API-key status never leave the device; switching profile on A does not change B
- [ ] SC-21: Edits made while offline sync after connectivity returns without learner action
- [ ] SC-22: Remote-applied data is not re-published: after a pull with no local edits, the next push uploads nothing (settings, secondary keys, directory, SRS, dictionary, word status, Reader)
- [ ] SC-23: Book added on A appears on B with its content; reading position follows the latest device; `readTimeMs` equals the sum of reading time on all devices
- [ ] SC-24: A profile bound to an account not connected on this device shows `waiting-connection` with a connect action and transfers nothing until connected
- [ ] SC-25: Disconnecting an account on A stops requests to it on B after B's next cycle — for the system connection's peers and for a non-system connection used by a device that never connected the system account; local data intact on both; reconnecting on either device resumes sync
- [ ] SC-26: After rebind or switch to "Don't sync" the learner is asked whether to delete the old cloud copy; "keep" deletes nothing, "delete" removes only that scope's files
- [ ] SC-27: A conflicting edit on two devices produces one conflict-log entry readable via the debug seam, without values
- [ ] SC-28: After compaction, new journals continue with higher `seq` values (never reused); a reader whose cursor predates the compaction resumes from the snapshot's `coversSeq` without skipping or double-applying records
- [ ] SC-29: Forcing a lock steal while the former cycle is stalled mid-push: the former cycle neither writes nor acks after the steal; remote state converges with no lost records
- [ ] SC-30: Delete a profile on A, edit it offline on B, sync both → the profile stays deleted on both; re-create it on either → it reappears on both with its SRS/dictionary data re-linked
- [ ] SC-31: Disconnect while offline → state `disconnect-pending`; on reconnecting to the network the disconnect completes and propagates (SC-25)
- [ ] SC-32: Collection/book language values with a region/script subtag (e.g. `zh-hant`) route to the same scope and connection as the `zh` profile
- [ ] SC-33: Settings changed while the background was not running (e.g. just before browser shutdown) are captured and pushed after the next startup
- [ ] SC-34: If a blob is absent while its journal is pulled, later records still apply, the cursor advances only after the full blocked record is persisted, and providing the blob later materializes that record without replaying or losing it
- [ ] SC-35: After A→B rebind, a device connected only to A reads the route marker before pushing, stops writing A, retains its pending edits, and drains a full snapshot to B after B is connected; restart at every step preserves this obligation
- [ ] SC-36: A KV setting edited locally between push-diff and remote apply participates in the HLC merge and creates a conflict-log entry; the winning value is not silently overwritten or suppressed
- [ ] SC-37: A stalled frozen journal cannot be hidden by compaction: compaction does not run while a pending batch exists, and after retry every reader consumes the record

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green; `npm run build:firefox` green
- [ ] Domain property/convergence tests (NFR-2); engine tests on the in-memory provider; Drive adapter contract tests on mocked HTTP
- [ ] Real-browser verification on Chrome + Firefox with a test-user account (SC-14)
- [ ] Design-system check for the Sync UI
- [ ] `docs/2-architechture-system.md`, `docs/0-wiki.md` updated; ADR for sync architecture (ports/adapters, wire format, merge policies, deterministic profile ids)
- [ ] NFR-12 store declarations updated

## Open Questions / Accepted Risks

- Silent renewal via `launchWebAuthFlow` + `prompt=none` depends on the provider session cookie inside the auth web view (Chrome: may need `abortOnLoadForNonInteractive: false` + `timeoutMsForNonInteractive`). DELIVER spikes this first on both browsers; worst case is more frequent `needs-reauth`, never data loss.
- Firefox redirect URI (`https://32cdbde6…extensions.allizom.org/`) is derived; DELIVER asserts it equals `identity.getRedirectURL()` before auth work; mismatch → owner updates the Google console.
- Unpacked dev builds: the public `key` (derived from `tihoka-key.pem`) is pinned in `public/manifest.json` so dev, CRX and store-less Chromium installs (Quetta/Edge/forks) all share id `ifceodogdeeaacmdigljgmafnhkbfnia` (manifest change → real Chrome test). Enforced by `tests/unit/manifest.test.ts` (2026-10-06: the key had drifted, so only the dev id `acaplphe…` was whitelisted while every CRX user hit `redirect_uri_mismatch`).
- Firefox for Android `identity` support unverified; if absent, the Sync section shows "not available on this browser". Not a Success Criterion.
- Clock skew: a device whose clock runs ahead wins LWW for fields it edits, and HLC propagation lifts other devices' clocks to its wall time until real time catches up — accepted (no loss; only "which concurrent edit wins" is affected).
- Card merge keeps the component with the later review; an explore-only bump on the losing side keeps only its `exploreCount` (max) — accepted.
- Referenced study configs replicated into several scopes can diverge when those scopes live on different connections that no single device holds — accepted (each scope stays internally consistent).
- Tombstones never expire: remote size grows with deletions (≈40 bytes each compressed) — accepted for guaranteed non-resurrection.
- Two non-empty collections for the same target created on different devices before first sync both remain (no content-level dedupe) — accepted, no data loss.
- A device that wrote journals to A and never syncs again after a rebind leaves those records only on A — accepted edge.
- OAuth app stays in Testing (≤100 test users, unverified screen) until the owner's separate production step. `subtitleApiKeys` synced plaintext in the learner's own app folder — owner decision.
