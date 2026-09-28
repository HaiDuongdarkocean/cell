# Spec Review: sync-drive-folders

Spec: `docs/specs/sync-drive-folders.md` (v4+applied-fixes) · Intent: `docs/intent/sync-drive-folders.md`
Method: 4 rounds of fresh-context stakeholder review (BA/PO/TL), all findings verified against code ground truth.

## Round 1 (v1) — REJECT (3/3)

Blockers: REQ-8 `coversSeq=0` wedge (adoption is `max(coversSeq, cursor.seq)`); REQ-7 referenced-set incomplete (post-cursor decodes only); REQ-6 disconnect sweep had no reachable executor; ancestor `list` prefixes ('', `cell-sync/`, `cell-sync/v1`) unhandled. Majors: coversSeq lives in snapshot body; heal must run pre-commit; dual-read newest-wins; move must rename to leaf; trashed-root handling.

## Round 2 (v2) — REJECT

- **B1**: marker-age grace unreachable — fresh marker detected within minutes → teardown → no token survives to +30d.
- **M1**: executor pinned to shadowed branch (`SyncEngine` checks marker first every cycle).
- **M2**: frozen-batch replay (`pushCycle.ts:148-164`) bypasses `freezeBatch` — heal check missed it.
- **M3**: prefix classes enumerative — `scopes/<scope>/`, `cell-sync/v1/`, in-tree-unmapped unclassified.
- **M4**: snapshot-less chains skipped → blob refs missed.
- **M5**: move PATCH bumps mtime → resurrects stale twins under newest-wins.
- **M6**: provider-internal vs port boundary unspecified.

## Round 3 (v3) — REJECT

- **B1**: provider-internal + fenced + "inside daily sweep" = unimplementable conjunction (provider holds no `deps.fence`; port has no folder ops).
- **B2**: heal predicate "no snapshot AND no journal seq==nextSeqFor-1" misses tip-only wreckage.
- **M3**: `disconnectLocallyNow` + marker-obligation drain uncovered; obligation-oblivion (reconnect-before-drain writes fresh marker on live account → peer sweeps live data).
- **M4**: disconnect sweep honoring `blobs-needed`/grace leaks forever on dead accounts.
- **M5**: sweep enumeration base unspecified (must be merged namespace).

## Round 4 (v4) — APPROVE_WITH_CHANGES

Majors (all applied):
1. REQ-3 twin-deletes unfenced → **compare-and-delete** (re-`files.get`, verify id+mtime before delete). Responsibility split re-grounded: `fence()` is device-local (`cycleLock.ts`) and cannot guard cross-device races anyway.
2. Empty-folder reap TOCTOU → re-verify empty immediately before `files.delete`; window → Accepted Risks + AC-14.
3. REQ-4/7 foreign-chain decode must not apply `decodeCompactionFile`'s own-deviceId check (`pushCycle.ts:370-385`) — stated in REQ-4 rules.
4. Counter-reset hole (IDB wiped, kv `deviceId` survives → `nextSeqFor=1` under remote tip) → new damage rule "remote contains seq ≥ nextSeqFor" + `coversSeq = max(remoteTipSeq, nextSeqFor-1)`; inert-journal residue documented.

Minors applied: seam-(b) `tokenFor` re-auth wording; `markPending` attribution → seam (a); seam-(c) nested try/catch; `healCheck?: false` flag on `ConnectionPushDeps` for `finalFlush`; dormant-scope wedge risk; REQ-1 read tie→foldered; deterministic dup-folder resolution + descend-all matching folders; leaf grammar validation; `listOpaque` acknowledged; seam-(b) sweep-before-`kv.del` ordering; decode-failure = damaged; intent "grace TTL" wording corrected.

## Applied fixes summary

All round-4 majors + minors folded into the spec. No further mechanism gaps known.

VERDICT: APPROVE
