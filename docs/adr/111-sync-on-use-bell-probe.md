# ADR-111: Sync-on-use — event-driven push plus a Drive bell probe on user action

## Status

Accepted — shipped with pipeline item `sync-on-use` (spec `docs/specs/sync-on-use.md`).

## Context

The 5-minute alarm cycle made word-status changes cross-device only after a long
poll, while a tighter poll would burn Drive quota on empty listings. Two needs
pull in opposite directions:

- Local writes should reach Drive almost immediately (the writing device knows
  exactly when it is dirty).
- Remote writes should be discoverable cheaply — Drive has no push channel, and
  polling the journal listing every few seconds is expensive.

## Decision

1. **Three pass kinds on one cycle lock** (`SyncEngine`): `runCycle()` keeps the
   full semantics unchanged; `runPush()` drains the outbox and writes journals
   only — no pulls, route markers, disconnect detection, remote sweeps, or
   obligations; `checkRemote()` detects and pulls peer changes. Callers queue by
   kind (deduped; a queued full absorbs queued push/check).
2. **`meta/bell.json` ChangeSignal**: providers expose `signal.peek()`/`ring()`.
   On Drive, peek is a single `files.get?fields=version` — the file version is
   the change token, so the probe costs one metadata request regardless of
   remote size. A pass that actually wrote a journal/snapshot rings the bell
   (media PATCH of `{at}`) and the seen token `syncBellSeen:<connectionId>` in
   session KV only advances when the observed version matches the pre-write
   read. GC only sweeps journals/snapshots/blobs so `meta/` is out of scope;
   the disconnect footprint sweep removes the bell with everything else under
   the sync root.
3. **Push triggers**: the IDB outbox transaction-complete notifier
   (`setOutboxDirtyNotifier`), the `SYNC_OUTBOX_DIRTY` message fallback, and
   synced-KV `storage.onChanged` all feed one debounce — 300ms trailing with a
   1500ms hard deadline, then `runPush()` if a connection exists. Empty pushes
   exit before any provider call.
4. **Check triggers**: only qualifying user actions (successful word-status
   mutations/lists/gets and lookups; `WORD_STATUSES_GET` first-per-tab-
   navigation) call `requestRemoteCheck()`, throttled to one check per 3s. The
   in-memory timestamp seeds once from `chrome.storage.session
   syncLastCheckAt` (single-flight), is re-checked after the `hasConnections`
   await, and persists fire-and-forget. Handlers never await the check.
5. **Fast pulls pull only local scopes** (`runScopesPull`): `localScopes()` =
   `global` + scopes for the device's current profile targets, filtered by the
   route table. If every peer chain reads zero files the pass waits 2s and
   retries exactly once inside the same lock, absorbing Drive listing lag.
6. **Warm-path request budget**: journal writes use `write({fresh:true})`
   (resolve-or-create + direct multipart create, no copy lookup), and a
   per-engine `chainCache` memoizes `ensureChainHealthy` journal counts so warm
   pushes skip chain-health and compaction listings.
7. **Fan-out**: `SYNC_DATA_APPLIED` keeps the runtime broadcast and additionally
   reaches every frame of every tab (`queryTabs({})` +
   `sendMessageToAllFramesInTab`, `allSettled` + swallowed errors) so open Cell
   surfaces update without a reload.
8. **15-minute alarm backstop**: the periodic full cycle remains as the
   correctness floor — passes are idempotent, so the faster paths are pure
   latency wins.

## Alternatives rejected

- **Shorter alarm / timer-driven polling**: the only way to near-realtime pull
  is polling, which scales request count with idle time — the opposite of the
  quota goal.
- **A push server (FCM/WebSocket)**: new infrastructure, credentials, and a
  background keep-alive problem in MV3; the user is already on a Cell surface
  when a check is useful, so activity-triggered probes cover the same cases.
- **Drive Changes feed**: requires a start-page-token handshake per account,
  extra quota, and still needs a poll loop — strictly more complexity than a
  self-written version token for no latency win on an extension.

## Consequences

- Cross-device word-status changes land within ~seconds of the next user action
  on the receiving device instead of the alarm period; local pushes publish
  within ~1.5s.
- Drive requests drop to ~1 per qualifying action burst (unchanged bell) plus
  the fast pulls; warm pushes cost one bell `files.get` + one journal create +
  one bell PATCH per pushed batch.
- Residual risks (accepted in spec Open Questions): a peer that never triggers
  a qualifying action only syncs on the 15-min backstop; the bell is best-effort
  (a missed ring or stale seen token converges at the next full cycle); the
  2s lag retry bounds, but does not eliminate, Drive listing latency; and on
  Firefox `chrome.storage.session` survives event-page restarts in memory but
  is cleared on browser restart — the in-memory guard still prevents bursts.
