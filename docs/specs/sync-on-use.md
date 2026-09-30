# Spec: Sync on use — push on write, bell probe on user action

> Intent: `docs/intent/sync-on-use.md` · ui_surface: no · Mode: interactive

## Objective

Make cross-browser word-status sync feel near-realtime while cutting Drive load. The system must: push local IDB changes within ~1.5s of commit through a push-only pass (N1, N4); detect remote changes with one cheap bell probe triggered only by qualifying user actions, throttled, zero cost when idle (N2, N3); pull only the scopes this device holds (N3); refresh every open Cell surface when synced data is applied (N5); and keep the existing full cycle as a slower correctness backstop (N6), identically on Chrome, Brave and Firefox (N7).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner (via Cell surfaces: universal panel, dictionary popup, tokenize, Reader, SRS pages) | word-status messages to background; IDB writes through repositories | terms, statuses, langCode | refreshed lists/colors after apply |
| Browser runtime (Chrome SW / Firefox event page) | alarms, `online`, startup, tab navigation events | alarm name, tabId, changeInfo | — |
| Google Drive API | — | HTTP responses (file metadata, `version`, bytes) | HTTP requests |
| Peer devices (other browsers on the same account) | journal files + bell bumps on Drive | — | journals, bell version |

System = capture notifier, scheduler (debounce/throttle), SyncEngine run modes, provider signal + fresh write, tab fan-out.

## Requirements

### Functional

REQ-1: Outbox-dirty notification on capture commit
- Actor: any context writing IDB through `captureChange`/`captureAll` (background handlers, SRS/Reader/local-player extension pages)
- Goal: the scheduler learns that the outbox grew, without polling
- Preconditions: capture enabled (`isCaptureEnabled()`)
- Basic flow:
  1. actor commits an IDB transaction in which ≥1 `captureChange` added an outbox row
  2. system registers exactly one `complete` listener per transaction (dedupe by transaction identity) when the first outbox row is added
  3. on `complete`, system calls the registered notifier once
- Alt flow: notifier registered by background wiring = direct call into the scheduler (`runtime.sendMessage` does not self-deliver); default notifier in non-background contexts = fire-and-forget `runtime.sendMessage({ type: SYNC_OUTBOX_DIRTY, payload: {} })`, errors swallowed
- Exception: transaction aborts/errors → no notification; capture disabled → no listener
- Rules: `capture.ts` exports `setOutboxDirtyNotifier(fn: () => void): void`; `SYNC_OUTBOX_DIRTY` registered in `MESSAGE_TYPES` + registry (`EmptyPayloadSchema`, direction `any`, owner `background/handlers/sync`)
- Postcondition: one notification per committed capturing transaction
- NFR refs: NFR-1, NFR-5

REQ-2: Push scheduling
- Actor: capture notifier (REQ-1), synced chrome.storage KV change (`scheduleOnExternalChange`)
- Goal: local changes leave the device quickly, bursts coalesce
- Preconditions: ≥1 connection
- Basic flow:
  1. actor signals outbox-dirty or synced-KV change
  2. system debounces: fire 300ms after the last signal, and never later than 1500ms after the first signal of a burst — `debouncedFire` gains a hard deadline timer armed at `firstAt + maxWaitMs` (today `maxWait` is only evaluated when a new signal arrives, `handlers/sync.ts:228-261`); whichever timer fires first runs `fn` once and clears both
  3. system calls `runtime.runPush()` if connected
- Alt flow: `SYNC_OUTBOX_DIRTY` message from a page routes into the same debounced function
- Exception: push failure → logged; engine backoff state applies (REQ-5). Accepted risk (same as today): pending keys of a failed push wait for the next signal, qualifying push, or the 15-min full cycle — nothing re-fires at `retryAt`
- Rules: settings-KV changes switch from full cycle to `runPush()`; language-target change keeps `refreshSources()` → full cycle (unchanged)
- Postcondition: pending keys pushed or retained for the next pass
- NFR refs: NFR-1, NFR-2

REQ-3: Remote-check triggers from qualifying actions
- Actor: learner via background word-status handlers
- Goal: probe the bell when the user actually uses a word-status feature
- Preconditions: none (no connection → no-op, see REQ-4)
- Basic flow:
  1. actor sends one of: `WORD_STATUS_SET`, `WORD_STATUS_CYCLE`, `WORD_STATUS_DELETE`, `WORD_STATUS_TRASH`, `WORD_STATUS_RESTORE`, `WORD_STATUS_TRASH_DELETE`, `WORD_STATUS_LIST`, `WORD_STATUS_TRASH_LIST`, `WORD_STATUS_GET`, `LOOKUP_REQUEST` (dictionary lookup — `handlers/lookup.ts`; the popup shows word status from the lookup result, not via a `WORD_STATUS_*` message), or the **first** `WORD_STATUSES_GET` for a `payload.tabId` since that tab's last navigation
  2. system answers the request from local data exactly as today (never awaits sync)
  3. system calls `requestRemoteCheck()` fire-and-forget after a successful handler result
- Alt flow: `WORD_STATUSES_GET` with `payload.tabId <= 0` (non-tab senders; `messageBus` overwrites `tabId` from `sender.tab.id` for tab senders, `messageBus.ts:150-160`) → not qualifying
- Exception: none surface to the actor; a handler that returns `success: false` does not request a check
- Rules: first-per-navigation tracking = in-memory `Set<tabId>`; entry cleared on `tabs.onUpdated` with `changeInfo.url` or `changeInfo.status === 'loading'`, and on `tabs.onRemoved`; set loss on SW/event-page restart only causes one extra (throttled) probe. Semantic: opening/navigating a page probes at most once, whatever caused that page's first batch lookup (initial tokenize or first scroll); every later batch lookup in the same navigation (cue rendering, preloading, further scrolling) never qualifies
- Postcondition: at most one throttled check request per action
- NFR refs: NFR-2, NFR-3

REQ-4: Check throttle
- Actor: REQ-3
- Goal: bound probe rate during active use
- Basic flow:
  1. system holds `lastCheckAt: number | undefined` in module memory; when `undefined`, it is seeded once from `chrome.storage.session` key `syncLastCheckAt` (single-flight promise shared by concurrent callers)
  2. after the seed, the decision is synchronous within one JS turn: `now - lastCheckAt < 3000` → drop
  3. otherwise system checks `runtime.hasConnections()`; not connected → drop **without** stamping
  4. connected → **re-evaluate** `now - lastCheckAt < 3000` synchronously after the await (another caller may have stamped meanwhile) → drop if inside the window; else set `lastCheckAt = now` in memory first, then persist to `chrome.storage.session` (fire-and-forget), then call `runtime.checkRemote()`
- Exception: storage read failure → seed `0` (not throttled); persist failure ignored
- Rules: concurrent callers resolving the same seed promise see the in-memory stamp of the first winner, so at most one `checkRemote()` starts per 3s window; throttle survives SW/event-page restarts within the browser session via the session key
- NFR refs: NFR-2

REQ-5: Engine run modes + coalescing
- Actor: scheduler (REQ-2/4), alarm, startup/connect/online, `SYNC_NOW`
- Goal: three passes sharing one lock and one in-flight queue
- Basic flow:
  1. `SyncEngine.runCycle()` (full, unchanged semantics), `runPush()`, `checkRemote()` all return `Promise<CycleResult>`
  2. while a pass is in flight, new requests queue by kind (deduped); when it finishes, a queued `full` runs alone and resolves every queued waiter; otherwise queued `push` runs, then queued `check`
  3. every pass acquires the cycle lock; lock not acquired → `emptyCycleResult()`
- Rules: fast passes skip connections in backoff and record failures in the same `BackoffTracker`; a `checkRemote()` whose bells are all unchanged must not call `setStatus`; any pass that performed a write or a pull updates status like the full cycle
- Exception: if a queued pass throws (lock acquisition, kv read, unexpected error), every waiter queued for it rejects with that error and the queue continues with the next kind
- Postcondition: no two passes run concurrently in one runtime
- NFR refs: NFR-4

REQ-6: Push fast path
- Actor: `runPush()`
- Goal: push pending keys with the minimum Drive requests
- Basic flow:
  1. system collects pending keys and frozen batches; none → return without any provider call
  2. system routes keys per scope exactly like the full cycle (frozen scopes skipped, `local` targets resolved+acked locally, waiting scopes reported)
  3. per connection with work: `runConnectionPush` with `chainCache` (REQ-7)
  4. system rings the bell for every connection that wrote a journal or snapshot (REQ-9)
- Alt flow: none of disconnect detection, route-marker reads, pull, remote sweep, obligations, pending disconnects run in this pass
- Exception: `ProviderError` → backoff + `failed[]` exactly like full; `CycleLockLostError` → `lockLost`
- Postcondition: journals written, keys acked, bell bumped
- NFR refs: NFR-2, NFR-4

REQ-7: Per-lifetime chain cache + fresh journal writes
- Actor: `runConnectionPush`
- Goal: stop re-listing the own chain on every push
- Basic flow:
  1. `ensureChainHealthy` returns `{ journalCount: number }` (journals present after the check/heal)
  2. `ConnectionPushDeps.chainCache?: Map<string, { journalCount: number }>` keyed `${connectionId}|${scope}`; the engine owns one map per engine instance (process lifetime)
  3. `commitBatch`: if `chainCache` has the key → skip `ensureChainHealthy`; else run it and store the result
  4. journal write passes `{ fresh: true }` to `provider.write`
  5. after each committed journal, `journalCount += 1`
  6. `compactScopeIfNeeded`: when `chainCache` has the key and `journalCount <= threshold` → return without listing; otherwise existing behavior; after a compaction set `journalCount = 0`
- Alt flow: full cycle passes **no** `chainCache` → heal check + compaction listing every cycle as today (REQ-8 of `sync-drive-folders` preserved); `finalFlush` keeps `healCheck: false`
- Exception: heal/compaction errors propagate as today; on **any** error thrown inside `commitBatch` after the heal step, delete the cache key (next push re-verifies and recounts)
- Rules: fresh write is valid because a new seq under the own deviceId cannot exist remotely except (a) after a counter reset, which the heal check (first push of every lifetime) detects — a failed heal leaves the same twin outcome as today's overwrite; (b) a same-lifetime retry of a frozen batch whose journal already landed before a later step threw (`pushCycle.ts:250-260`) — the retry creates a content-identical Drive duplicate; harmless: list dedupe is newest-wins, `remove` deletes all copies, compaction reaps it. Because the cache key is dropped on any commit error, `journalCount` cannot drift across a failed commit
- NFR refs: NFR-2, NFR-4

REQ-8: Provider port additions
- Actor: engine
- Basic flow:
  1. `write(connection, path, body, opts?: { fresh?: boolean })` — `fresh` skips every existence lookup (`findCopies`, `findInFolder`) and creates directly in the resolved (or created) folder chain; without `opts` behavior is unchanged
  2. `readonly signal?: ChangeSignal` where `interface ChangeSignal { peek(connection): Promise<string | null>; ring(connection): Promise<string> }` — `peek` returns an opaque version token of the account's bell or `null` when no bell exists; `ring` bumps it (creating it if absent) and returns the new token
- Rules: providers without `signal` → `checkRemote()` is a no-op for that connection (full cycle only)
- NFR refs: NFR-4

REQ-8b: Provider instance lifetime
- Actor: `syncRuntime`
- Goal: provider-internal caches (`verifiedRoots`, `folderIds`, bell file id) survive across passes so steady-state request counts hold in production
- Basic flow:
  1. `providerFor(providerId)` in `syncRuntime.ts` memoizes one instance per `providerId` for the process (SW / event-page) lifetime; the same instance is used by the engine and by `serviceDepsBase`
  2. unknown provider id → `SyncServiceError('unknown-provider')` as today (not memoized)
- Rules: provider caches are already keyed by `accountKey` internally, so one instance per `providerId` serves every connection; a process restart starts cold (first pass pays root verify + folder resolution once)
- NFR refs: NFR-2

REQ-9: Google Drive bell
- Actor: engine via `signal`
- Basic flow:
  1. bell logical path `cell-sync/v1/meta/bell.json` (export `BELL_PATH` from `remotePaths.ts`) → folder `meta`, leaf `bell.json`
  2. bell file id cached in kv `local` key `bellFileId:<accountKey>`
  3. `peek`: no cached id → resolve the `meta` folder with the existing resolve-only path (`resolveChain` — never creates folders or files; may reap duplicate empty folders exactly as today) + one `findInFolder(meta, 'bell.json')`; none → `null`; else `GET files/{id}?fields=version,trashed` → `version`; 404 or `trashed` → clear cache, return `null`
  4. `ring`: no id → resolve as in peek; still none → create the file with the provider's internal folder resolve-or-create + multipart create (the port-level `write` returns a `RemoteEntry` without an id) and cache the created file's `id`; then `PATCH upload/drive/v3/files/{id}?uploadType=media&fields=version` with body `{"at":<ms>}` → return `version`; 404 → clear cache, recreate once
- Rules: GC sweeps (REQ-4/5/7 of `sync-drive-folders`) never touch `meta/bell.json`; the disconnect sweep (REQ-6) deletes it — the next `peek` returns `null`
- Test substrate: `fakeDrive` gains a per-file `version` counter — set on create, incremented on every media or metadata update, returned by `fields=version` on `files.get`/update responses and included in `fileJson`
- NFR refs: NFR-2, NFR-6

REQ-10: Bell bookkeeping in the engine
- Basic flow:
  1. seen token per connection in kv `session` key `syncBellSeen:<connectionId>`
  2. push side (fast and full passes): before ringing, `before = peek`; `after = ring`; if `before === (seen ?? null)` → `seen = after` and `syncBellPending:<connectionId>` cleared
  3. check side: `v = peek`; `v === seen` → skip connection; else fast pull (REQ-11); `seen = v` only after the pull actually consumed files or the pending cap is reached (REQ-11 alt flow)
- Alt flow: `seen` absent (new session) → any non-null `v` pulls
- Exception: peek/ring errors → backoff + `failed[]`; `seen` unchanged
- Rules: accepted race — a peer bump landing between our `before` probe and our `ring` is absorbed; bounded by the next bump or the 15-min full cycle. Pending counter per connection lives in kv `session` key `syncBellPending:<connectionId>` = `{v, n}`
- NFR refs: NFR-2

REQ-11: Pull fast path
- Actor: `checkRemote()` on a changed bell
- Goal: apply peer journals for local scopes only
- Basic flow:
  1. scopes = `['global', ...profileTargets().map(scopeForTarget)]` (new engine dep `localScopes: () => Promise<Scope[]>`), filtered to those whose `routeForScope` targets this connection and not frozen
  2. system calls new `runScopesPull(deps, scopes)` in `pullCycle.ts`: `readCursors` → `pullScope` per scope with `onRouteMarker` undefined
  3. remote blob index is lazy: `listRemoteBlobPaths` runs at most once per pass, only when a record or opaque row needs a blob check (internal `remoteBlobs` becomes `() => Promise<Set<string>>` memoized; `runConnectionPull` wraps its eager set)
  4. applied data flows to `onApplied` exactly like the full cycle
- Alt flow: listing yields no new file for any peer (`filesRead === 0` everywhere) while `scopes.length > 0` → inside the same pass and still holding the cycle lock (heartbeat keeps it; TTL 120s ≫ 2s), `await sleep(2000)` (injectable) then run `runScopesPull` once more; no second retry, no bell probe. If the retry still reads 0 files, `seen` is **not** stamped: the bell stays pending (`syncBellPending` `{v, n}` incremented) and every subsequent `checkRemote` re-pulls until files appear. Once `n` reaches `MAX_BELL_EMPTY_PULLS` (16) the engine stamps `seen = v` anyway — convergence guard for bumps that can never yield files locally (journal GC'd, bump for a scope this device doesn't route); the 15-min full cycle remains the ultimate floor
- Exception: `ProviderError` (first pull or retry) → backoff; `seen` unchanged; process terminated mid-sleep → pass lost, `seen` unchanged, next check re-pulls
- Rules: passes queued behind the retry wait ≤2s (accepted); a pending bell does not mark the connection failed and emits no status change
- Rules: no `isConnectionDisconnected`, no `answerBlobsNeeded`, no `drainDeferred`, no route-marker reads in this path
- NFR refs: NFR-2, NFR-3

REQ-12: Applied-data fan-out to tabs
- Actor: engine `onApplied`
- Basic flow:
  1. system keeps `runtime.sendMessage` broadcast (extension pages)
  2. system also sends `{ type: SYNC_DATA_APPLIED, payload }` to every tab via `queryTabs({})` + `sendMessageToAllFramesInTab`, `Promise.allSettled`, errors swallowed
- Rules: content relay (`wordStatusCrossTab.ts`) unchanged — it already emits per-language reloads
- Rules: token surfaces repaint on `onWordStatusesReload`: `webTokenizeController` re-fetches statuses for all cached terms and rebinds only blocks whose tokens changed (guarding local in-flight overrides by status version); `subtitleTokenizeController` re-fetches statuses for `videoTokenMap.terms()` and applies them via `applyStatus` so cue lines and cue-list surfaces repaint; absent terms resolve to `unknown` so remote deletes propagate
- NFR refs: NFR-5

REQ-13: Safety-net scheduling
- Basic flow: `SYNC_TICK_PERIOD_MINUTES = 15`; startup, connect/disconnect/binding handlers, `online`, language-target change keep the full cycle; `SYNC_NOW` stays full
- Postcondition: markers, blobs, GC, self-heal, obligations still converge

REQ-14: Runtime wrappers
- `SyncRuntime` gains `runPush()` and `checkRemote()` wrapping the engine with the same post-processing as `runCycle()` (persist clock wall, `setActiveProfileAfterRestore` when data applied); the fast wrappers broadcast `SYNC_STATUS_CHANGED` only when `engine.current.updatedAt` differs from its value captured before the call (`runCycle()` keeps broadcasting unconditionally). Note: `engine.subscribe → onStatusChanged` (`syncRuntime.ts:186` → `handlers/sync.ts:52-62`) already broadcasts on every `setStatus`; the fast wrappers must not add a second unconditional broadcast — an unchanged check emits nothing because it never calls `setStatus`

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Local change leaves the device quickly | P | push starts ≤1.5s after commit |
| NFR-2 | Drive request budget — counted as Drive API calls only (`/drive/v3/*`, `/upload/drive/v3/*`; OAuth/userinfo excluded; tests seed a long-lived token) on a warm provider instance (REQ-8b) | +financial/P | no qualifying action → 0 probe requests (scheduled 15-min backstop exempt); unchanged check: 1; steady-state single-scope push: exactly 3 (bell get, journal create, bell update) and 0 `files.list`; changed check: 1 bell get + per local scope one provider `list(scopeDevicesPrefix)` (≈4 Drive API calls: flat query + scope/device folder descent) + 1 download per new journal |
| NFR-3 | UI never waits on sync | U | handlers respond before any check resolves |
| NFR-4 | Correctness backstop | R | full sync suite green; full cycle behavior unchanged except period |
| NFR-5 | Cross-browser parity | S | no keep-alive, no ports, capability-detected APIs only; Chrome + Firefox builds |
| NFR-6 | No new dependencies, no manifest change | +resource | zero package.json/manifest delta |

## Flows / States

```
write ─commit─▶ notifier ─debounce 300/1500─▶ runPush
  runPush: pending? no→return | yes→ per conn: [cache? skip heal] → create journal(fresh) → count++ → compact if >50 → peek(before) → ring → seen=after if before==seen

action ─▶ handler replies from IDB ─▶ requestRemoteCheck ─throttle 3s─▶ checkRemote
  checkRemote: per conn: peek → ==seen? done(0 status change)
                              → else runScopesPull(local scopes) → applied? → onApplied → runtime+tabs fan-out → seen=v
                                                                  → nothing new? retry once @2s → still empty? pending++ (<16)
                                                                  → pending exhausted? seen=v (converge)

alarm 15m / startup / online / connect ─▶ runCycle (full, unchanged)
queue: inflight X; queued {full|push|check}; full absorbs the rest
```

## Function ↔ Feature Map

| Function | Features |
|---|---|
| Know that local data changed | capture `complete` notifier; `SYNC_OUTBOX_DIRTY` message; KV external-change hook |
| Push local changes cheaply | `runPush`; chain cache; fresh journal write; memoized provider instance |
| Know that remote data changed | bell file; `signal.peek/ring`; seen-token bookkeeping |
| Probe only when the user acts | qualifying-message hook in word-status handlers; first-per-navigation tab set; 3s session throttle |
| Pull remote changes cheaply | `checkRemote`; `runScopesPull`; lazy blob index; single lag retry |
| Refresh open surfaces | tabs fan-out of `SYNC_DATA_APPLIED` |
| Keep correctness | 15-min full cycle; run-mode coalescing; backoff sharing |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| Bell file | content `{"at":ms}`, Drive `version` | Drive `Tihoka Sync/meta/bell.json` | until disconnect sweep |
| Bell file id | `bellFileId:<accountKey>` → id | kv `local` | cleared on 404/trashed |
| Seen bell token | `syncBellSeen:<connectionId>` → version | kv `session` | browser session |
| Pending bell | `syncBellPending:<connectionId>` → `{v, n}` | kv `session` | until files consumed or cap 16 |
| Last check time | `syncLastCheckAt` → ms | `chrome.storage.session` | browser session |
| Chain cache | `${connId}|${scope}` → `{journalCount}` | engine memory | process lifetime |
| Probed tabs | `Set<tabId>` | background memory | cleared on navigation/removal |

## Traceability

| Need | REQ | AC |
|---|---|---|
| N1 | REQ-1, REQ-2 | SC-1, SC-2, SC-14 |
| N2 | REQ-3, REQ-4, REQ-10 | SC-7, SC-10, SC-11, SC-12 |
| N3 | REQ-9, REQ-11 | SC-7, SC-8, SC-9, SC-17 |
| N4 | REQ-6, REQ-7, REQ-8, REQ-8b | SC-1b, SC-3, SC-4, SC-5, SC-16 |
| N5 | REQ-12 | SC-13 |
| N6 | REQ-5, REQ-7 alt, REQ-13, REQ-14 | SC-1c, SC-6, SC-15, SC-18 |
| N7 | NFR-5 | SC-18, SC-19 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1 push within ~1.5s + bell bump | REQ-1, REQ-2, REQ-6, REQ-7, REQ-9, REQ-10 |
| 2 action answers locally + probe | REQ-3, REQ-4 |
| 3 scoped pull | REQ-11 |
| 4 fan-out refresh | REQ-12, REQ-14 |
| 5 idle = 0 requests; safety net | REQ-4, REQ-13 |

## Boundaries

- Always: capability-detect (`typeof chrome.x`), never UA-sniff; reuse `debouncedFire`, `queryTabs`/`sendMessageToAllFramesInTab`, `BackoffTracker`, `acquireCycleLock`; run `npm run typecheck && npm run lint && npm run test:unit && npm run build`
- Ask first: manifest or permission change; new dependency; wire-format change
- Never: await sync inside a word-status handler response; keep the SW/event page alive artificially; skip the full cycle's heal check; log tokens
- Non-goals (from intent): no push channel/server or Drive `changes` feed; no wire-format change; no UI change; no guaranteed p95 ≤3s

## Success Criteria

- [ ] SC-1: A committed IDB transaction containing ≥1 `captureChange` calls the notifier exactly once; an aborted transaction and a capture-disabled write call it zero times; with no notifier registered, the default sends `SYNC_OUTBOX_DIRTY` via `runtime.sendMessage` and a rejected send is swallowed (`capture.test.ts`); `wireSyncScheduling` registers the direct-call notifier via `setOutboxDirtyNotifier` (test asserts a background-context capture reaches the debounced push without any `sendMessage`)
- [ ] SC-1b: `providerFor('google-drive')` returns the same instance across calls within one runtime; `SyncEngine` passes use it
- [ ] SC-1c: A fast pass that cannot acquire the cycle lock returns `emptyCycleResult()` with zero provider calls; a throwing queued pass rejects its waiters and the next queued kind still runs
- [ ] SC-2: 5 outbox-dirty signals within 200ms → exactly 1 `runPush` ≥300ms after the last; a signal stream every 100ms for 3s → `runPush` at least every 1500ms; a burst whose last signal lands at t=1400ms after the first fires at exactly t=1500ms (deadline timer), not 1700ms (fake timers)
- [ ] SC-3: `runPush()` with no pending keys and no frozen batches makes zero provider calls
- [ ] SC-4: Against `GoogleDriveStorageProvider` on `fakeDrive`, the second single-scope `runPush()` in one engine lifetime issues exactly: 1 bell `files.get`, 1 journal multipart create, 1 bell media update, and zero `files.list` requests (request log)
- [ ] SC-5: With `journalCompactionThreshold: 3`, the 4th fast push compacts (snapshot written, journals ≤ coversSeq removed) and a peer pulling afterwards converges to the same records
- [ ] SC-6: Two consecutive full cycles each list the own chain for the heal check (cache not used by full)
- [ ] SC-7: `checkRemote()` with an unchanged bell issues exactly 1 Drive request and emits no status change
- [ ] SC-8: `checkRemote()` after a peer push applies the peer's records; its request log contains no request under `blobs/`, `meta/routes`, `meta/blobs-needed` and no disconnect-marker read (records without blob refs); `seen` updated
- [ ] SC-9: When the changed-bell listing yields no new file, exactly one retry pull runs after the injected 2000ms sleep inside the same pass (lock held), no second retry follows, and `seen` stays unset while `syncBellPending` increments — the next `checkRemote` re-pulls; `seen` is stamped once files arrive or after 16 empty pulls
- [ ] SC-10: After this device's own push, its next `checkRemote()` (no peer activity) issues exactly 1 request and pulls nothing
- [ ] SC-11: 10 concurrent `requestRemoteCheck()` calls (same tick, cold seed) → 1 `checkRemote`; another call after 3s → a second; throttle honored across a simulated restart via `chrome.storage.session`; a call while not connected does not stamp, so the first call after connecting runs; with a warm seed, 3 concurrent calls whose `hasConnections()` resolve in the same tick → 1 `checkRemote`
- [ ] SC-12: Each qualifying message in REQ-3 (incl. `LOOKUP_REQUEST`) triggers `requestRemoteCheck` and its response resolves without awaiting it; `WORD_STATUSES_GET` triggers only on the first call per tab until `tabs.onUpdated` (url/loading) or `tabs.onRemoved` for that tab
- [ ] SC-13: `onApplied` sends `SYNC_DATA_APPLIED` via runtime broadcast and to every tab/all frames; the content relay emits `emitWordStatusesReload(lang)` for applied `profile:<lang>` wordStatus scopes; web/subtitle token surfaces re-fetch statuses and repaint on that event (no reload/navigation needed)
- [ ] SC-14: Alarm created with `periodInMinutes: 15`; a synced-KV storage change triggers `runPush` (not `runCycle`); a language-target change still triggers `refreshSources` + full cycle
- [ ] SC-15: A `runCycle()` requested while `runPush()` is in flight runs after it and resolves; queued `runPush`/`checkRemote` waiters behind a queued full resolve with the full result
- [ ] SC-16: `write(path, body, { fresh: true })` issues no name-lookup queries; `write` without opts is byte-for-byte the old request sequence (existing provider tests green)
- [ ] SC-17: `peek` on an account without a bell returns `null` and creates nothing; `ring` creates then bumps; a trashed/404 bell clears `bellFileId:*` and is recreated by the next `ring`; `InMemoryStorageProvider.signal` passes the same contract
- [ ] SC-18: Full existing sync suite + new tests green; typecheck, lint, test:unit, build, build:firefox green
- [ ] SC-19 (sign-off, real devices): Brave↔Chrome and Chrome↔Firefox — change a status on A, perform a qualifying action on B → B shows the new state; 5 tries per pair, median ≤3s by observation

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green; `npm run build:firefox` green
- [ ] `docs/2-architechture-system.md` sync section updated; `docs/0-wiki.md` changelog line; ADR-111 recorded
- [ ] Real-device sign-off (SC-19)

## Open Questions / Accepted Risks

- Drive propagation latency (bell `files.get` vs `files.list` index lag) unmeasured — mitigated by the in-pass 2s retry plus pending re-pulls on every later qualifying action; the 15-min full cycle is the floor. First-ever check on a device additionally pays index lag to discover `meta/bell.json` itself (no cached `bellFileId` yet); measured at SC-19.
- Bell race (REQ-10 rules) accepted; bound = next bump or 15-min full cycle.
- Push fast path skips marker observation; bounded by the 15-min full cycle.
- SRS/Reader have no dedicated probe trigger (intent scope).
- Silent token renewal on Brave/Firefox unverified; UI never blocks; surfaced as `needs-reauth` if it fails.
