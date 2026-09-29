# Verify — sync-on-use
Date: 2026-10-06, Reviewer: fresh-context subagent (code/test trace) + orchestrator (gates, post-review fixes)
Scope: adversarial code+test trace of the sync-on-use implementation (push-on-write, bell probe, scoped pull, tab fan-out, 15-min backstop) against `docs/specs/sync-on-use.md` SC-1..SC-19.

## Success criteria trace

- SC-1 PASS — `capture.ts:201-204` attaches one `complete` listener per `store.transaction` via `WeakSet<IDBTransaction>`; notify-once/abort-zero/disabled-zero asserted at `capture.test.ts`; default notifier `sendMessage(SYNC_OUTBOX_DIRTY)`+swallow at `capture.ts:11-15`; direct wiring `handlers/sync.ts:316-318` asserted end-to-end `tests/unit/entrypoints/background/handlers/sync.test.ts`.
- SC-1b PASS — module-level `providerCache` memoizes per providerId, `syncRuntime.ts:122-133`; same instance reused for engine + serviceDeps; `syncRuntime.test.ts`.
- SC-1c PASS — lock failure returns `emptyCycleResult()` (`acquired:false`) before any provider touch, `SyncEngine.ts:281-283`; waiter rejection + `startNextPass()` in `finally` `:219-229`; shared code path exercised by the full-pass lock test.
- SC-2 PASS — `debouncedFire` keeps trailing + hard-deadline timers and clears both in `run`/`cancel`, `handlers/sync.ts`; ≥300ms-after-last, ≥every-1500ms stream, fires-at-exactly-1500 asserted `sync.test.ts`.
- SC-3 PASS — `runPushPass` early-returns when no pending keys and no pending batches, `SyncEngine.ts:399-410`; zero list/read/write asserted `fastPasses.test.ts`.
- SC-4 PASS — second warm `runPush` issues exactly 3 Drive calls (bell `files.get?version`, journal multipart POST, bell media PATCH) and zero `files.list`, `fastPasses.test.ts`.
- SC-5 PASS — threshold exceeded → snapshot written, journals removed, cache reset `{journalCount:0}`, `chainCache.test.ts`; convergence rests on unchanged compaction/fold path (`pushCycle.ts`, covered by `pushCycle.test.ts`).
- SC-6 PASS — `runAll` passes no `chainCache`, heal+compaction list every push; asserted across 2 uncached pushes `chainCache.test.ts`.
- SC-7 PASS — unchanged bell → exactly 1 Drive request + zero status emissions, `fastPasses.test.ts`; `v === seen → continue` at `SyncEngine.ts:570`, no-`setStatus` early return.
- SC-8 PASS — peer journal applied, request log contains no `blobs`/`routes`/`disconnect` URLs, `seen` stamped, `fastPasses.test.ts`; `runScopesPull` has no disconnect/marker/blobs-needed/deferred work (`pullCycle.ts`).
- SC-9 PASS — `outcomes.every(filesRead===0)` with non-empty scopes → `sleep(2000)` inside the same lock → one re-pull, no second retry, `SyncEngine.ts:601-608`; asserted `fastPasses.test.ts`. Post-review fix: empty-scope pulls no longer sleep/retry.
- SC-10 PASS — own push advances `seen` via `bellBump` (`before===seen` guard `SyncEngine.ts:293-301`); next `checkRemote` = 1 request, pulls nothing.
- SC-11 PASS — single-flight `seedPromise`, throttle re-checked after `hasConnections()`, stamp-then-run, no stamp when disconnected, `syncTriggers.ts:68-94`; 10-cold/3-warm concurrent dedupe, 3s window, restart seed asserted `syncTriggers.test.ts`.
- SC-12 PASS — `requestRemoteCheck()` after success on all 10 word-status handlers + `LOOKUP_REQUEST` (`lookup.ts:38`); never awaited; failures don't trigger; `WORD_STATUSES_GET` gated by `isFirstStatusesGetForTab` (resets on url/loading/tab removal); asserted in handler + trigger tests.
- SC-13 PASS — `broadcastApplied` = runtime broadcast + `queryTabs({})` + `sendMessageToAllFramesInTab` + `allSettled`, `syncRuntime.ts`; asserted `syncRuntime.test.ts`; content relay emits `emitWordStatusesReload(lang)` for applied `profile:*` wordStatus scopes (`wordStatusCrossTab.ts`), relay mounted in `content-script.ts`.
- SC-14 PASS — `periodInMinutes: 15` (`handlers/sync.ts`), synced-KV change → `runPush` not `runCycle`, target change → `refreshSources`+full; asserted `sync.test.ts`.
- SC-15 PASS — kind-queue with full absorbing queued push/check, `SyncEngine.ts:183-213`; dedupe + ordering asserted `fastPasses.test.ts`.
- SC-16 PASS — `{fresh:true}` skips `allCopiesOf`/`findCopies` (`googleDriveStorageProvider.ts`); warm fresh write = 1 multipart, 0 `GET /files?`; non-fresh sequence preserved `freshWrite.test.ts`.
- SC-17 PASS — peek creates nothing/returns null, ring creates+bumps, trashed/404 clears `bellFileId:*`+recreates once; InMemory same contract; `changeSignal.test.ts` vs impl.
- SC-18 PASS — executed by orchestrator on host after post-review fixes: `npm run typecheck` green, `npm run lint` green, `npm run test:unit` green (639 suites / 7620 tests), `npm run build` green, `npm run build:firefox` green (`dist-firefox`, gecko.id `tihoka@the0cean.dev`, min 128.0).
- SC-19 DEFERRED — real-device Brave↔Chrome / Chrome↔Firefox sign-off is the interactive sign-off step (`docs/reviews/sync-on-use-signoff.md`), pending Anh's verification on real devices.

## Findings (all minor, status after post-review pass)

1. FIXED — `SyncEngine.ts` push passes only rang the bell inside the zero-error branch; a push that wrote scope A while scope B errored never rang. Now `bellBump` runs whenever `wrote`; ring failures on an already-failed connection are absorbed (connection already in backoff).
2. FIXED — `syncTriggers.ts` `hasConnections()` rejection is now swallowed to `false` (no unhandled rejection).
3. FIXED — `docs/2-architechture-system.md` handler count corrected to 10 (`SYNC_DISCONNECT_LOCAL` was omitted).
4. FIXED — `docs/specs/user-data-sync.md` REQ-8/REQ-10 actor lines updated from "debounce 30 s / alarm every 5 min" to the shipped 300ms/1500ms debounce + 15-min backstop with ADR-111 pointer.
5. FIXED — `runCheckPass` skips connections when `deps.localScopes` is absent, so a fast pass without scope knowledge cannot stamp `seen` permanently.
6. ACCEPTED — `syncTriggers.ts` mixes the captured `current` snapshot (hasConnections/checkRemote) with live module `deps` (now/sessionGet/sessionSet); harmless since triggers are configured once per background lifetime.
7. (observation) `bellBump` reads `seen` after `ring` — correct under pass serialization since only the lock-holding pass writes `syncBellSeen:*`; the `before === seen` guard absorbs a peer bump racing between peek and ring (spec accepted risk; converges at next bump or 15-min cycle).
8. (observation) `WORD_STATUS_GET` currently has no production sender — trigger is wired per spec and inert until a client calls it.

## Request-budget check

| Scenario | Spec budget | Observed |
|---|---|---|
| Empty push | 0 provider calls | 0 — early return before any provider touch (`SyncEngine.ts:399-410`) |
| Warm single-scope push | bell `files.get` + journal multipart + bell media PATCH; 0 `files.list` | exactly 3 Drive API calls (`fastPasses.test.ts`) |
| Unchanged check | 1 bell `files.get` | exactly 1 |
| Changed check | 1 bell `files.get` + 1 `provider.list` per local scope + 1 download per new journal | 1 peek + `list(scopeDevicesPrefix(scope))` per routed local scope; Drive `list` ≈4 calls/scope per foldered provider; 1 `alt=media` GET per journal |
| Idle | 0 fast-path requests | 0 — only the 15-min alarm; no polling, no keepalive port |

## Verdict

VERDICT: PASS (SC-19 real-device sign-off deferred to `docs/reviews/sync-on-use-signoff.md`)
