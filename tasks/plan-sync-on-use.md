# Plan: sync-on-use

Spec: `docs/specs/sync-on-use.md` (v2.1, review `docs/reviews/sync-on-use-spec.md` APPROVE_WITH_CHANGES) · mode: interactive · uiSurface: no
Build order: provider substrate first (fakeDrive/InMemory make every engine test measurable), then engine passes, then runtime/scheduling/triggers, then docs.

| # | Slice | Delivers | AC | Depends |
|---|---|---|---|---|
| S1 | Provider layer — `StorageProvider.write(…, opts?: { fresh?: boolean })`, `ChangeSignal { peek, ring }` on the port; Google impl (fresh create path, bell peek/ring with `bellFileId:<accountKey>` cache, 404/trashed recovery); `BELL_PATH` in `remotePaths.ts`; fakeDrive per-file `version` (create/update/get `fields=version`); `InMemoryStorageProvider.signal` | REQ-8, REQ-9 | SC-16, SC-17 | — |
| S2 | Push fast path — `ensureChainHealthy` returns `{ journalCount }`; `ConnectionPushDeps.chainCache`; commitBatch skip-heal + `fresh: true` journal write + count++ + drop key on any post-heal error; compaction short-circuit + reset | REQ-6, REQ-7 | SC-3, SC-4, SC-5, SC-6 | S1 |
| S3 | Engine run modes — `runPush()`, `checkRemote()`, kind queue + coalescing + waiter rejection; bell bookkeeping (`syncBellSeen:<connId>`, pre-ring peek rule); `localScopes` dep; `runScopesPull` + lazy remote-blob index + in-pass 2s retry (injectable sleep) | REQ-5, REQ-10, REQ-11 | SC-1c, SC-7, SC-8, SC-9, SC-10, SC-15 | S1, S2 |
| S4 | Runtime + scheduling — memoized `providerFor`; `SyncRuntime.runPush/checkRemote` wrappers (updatedAt-diff broadcast, no double broadcast); capture `setOutboxDirtyNotifier` + tx-complete notify + `SYNC_OUTBOX_DIRTY` message/registry/handler; `debouncedFire` hard deadline; push scheduling (outbox + synced-KV → runPush); alarm 15 min; throttle module (`syncLastCheckAt`, single-flight seed, re-check after await, no stamp when disconnected); qualifying triggers in word-status + lookup handlers with first-per-navigation tab set; tabs fan-out of `SYNC_DATA_APPLIED` | REQ-1–4, REQ-8b, REQ-12–14 | SC-1, SC-1b, SC-2, SC-11, SC-12, SC-13, SC-14 | S3 |
| S5 | Docs — `docs/2-architechture-system.md` sync section, `docs/0-wiki.md` changelog, `docs/adr/111-sync-on-use-bell-probe.md` | DoD | — | S4 |
| S6 | Gates + verify — typecheck · lint · test:unit · build · build:firefox; fresh-context verify → `docs/reviews/sync-on-use-verify.md`; real-device sign-off SC-19 | DoD | SC-18, SC-19 | S5 |

Per-slice loop: failing test → implement → narrow suite green → next. Full gates once at S6.
