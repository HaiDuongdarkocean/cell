# Todo: User data sync

Plan: `tasks/plan-user-data-sync.md` · Spec: `docs/specs/user-data-sync.md` · Worktree: `../Tihoka-worktrees/user-data-sync` (`feature/user-data-sync`)

- [ ] T1 Domain core — types + HLC + scope (feature worktree, direct)
- [ ] T2 Flattening + settings registry + opaque records — lane-2
- [ ] T3 Merge policies per data class — lane-3
- [ ] T4 Ports + in-memory provider + adapter contract suite — lane-4
- [ ] T5 IDB migrations + outbox helper + IDB LocalSources — sequential
- [ ] T6 KV LocalSources + syncMetaKV — lane-6
- [ ] T7 cell-sync IDB DB — lane-7
- [ ] T8 SyncEngine push + cycle lock — sequential
- [ ] T9 SyncEngine pull + conflict log — sequential
- [ ] T10 Reconciliation + profile identity migration + REQ-1 — sequential
- [ ] T11 Rebind + disconnect + waiting-connection — sequential
- [ ] T12 Google Drive adapter — lane-12 (after T4)
- [ ] T13 Background composition + manifest — sequential
- [ ] T14 Sync Settings UI + i18n — lane-14 (mock-contract on T13 messages)
- [ ] T15 Convergence property suite — after Phase 3 merges

Dispatch state: — (updated by orchestrator)
