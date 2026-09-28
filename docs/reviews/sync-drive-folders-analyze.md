# Analyze Review — sync-drive-folders

`subagent_explore` fresh-context audit of `docs/intent/sync-drive-folders.md` against code ground truth.

## Round 1 verdict: APPROVE_WITH_CHANGES

Majors found (all verified against code):

- **M1** migration strategy contradicted itself — Workflow prescribed big-bang move, Decision preferred lazy-touch. Resolved: **one-time big-bang move** (`files.update` parents-swap, KV-flagged like `cleanupLegacySpace`) **+ permanent dual-read** merging flat+foldered namespaces.
- **M2** "lazy per-file migration on write/touch" is incoherent — journals/snapshots/blobs are write-once (`journalPath`/`snapshotPath`/`blobPath`), nothing touches them; dead chains are only removed by GC. Fixed in Workflow.
- **M3** returning-device self-heal does NOT exist today — own chain invisible to pull (`pullCycle.ts:202`), gap → peers wait forever (`pullCycle.ts:297-315`); only reconnect republishes. Promoted to required need **N9**: push-side own-chain-empty detection → `publishScopeSnapshot`.
- **M4** `in parents` matches direct children only — internal-node `list(prefix)` (`scopes/`, `devices/`) needs bounded recursive descent; documented in Workflow + N3 risk row.
- **M5** disconnect marker misattributed — it's per-**connection** (`meta/disconnect.json` single file; deviceId = writer only). Rule corrected: marker present + grace TTL ⇒ account-level GC.

Minors applied: `:` sanitization covers file names too (`routes/profile:en.json`); `list()` dedupe must key on **logical path** not `file.name`; FakeDrive needs metadata-PATCH/move + multi-parent model; `blobs-needed` markers are keep-signals in blob GC; sweep obligation (`obligations.ts:153-190`, `VACATED_SWEEP_MS=24h`) cited as existing remote-GC precedent; superseded-straggler sweep must run outside the >50-journal path (snapshot-4 anomaly proves stalls).

## Applied fixes

N5 rewritten (filenames too), N6–N9 rewritten/added with corrected evidence, Scope re-bounded (dual-read + move migration + self-heal + FakeDrive work), Workflow rewritten, TO-BE 2/3 corrected, S5 tightened, risk table fixed (M4/M5/m7), Decision resolved to move-migration + dual-read + required self-heal, ACs expanded to 10 with GC safety + self-heal + FakeDrive rows.

VERDICT: APPROVE

## Round 2 — intent touch-ups after spec-review REJECT (v1 spec)

Spec v1 was REJECTED on mechanism grounds; two corrections propagated back into the intent (consistent with the review, no new needs):

- N7: disconnect sweep must run inside the detection branch before connection teardown/token revocation (`pullCycle.ts:114-123`, `SyncEngine.ts:255-273`) — the marker makes the account collectable but there is no executor after teardown.
- N9: republished snapshot must use `coversSeq` = last committed seq — a coversSeq below peers' cursors still wedges them (`pullCycle.ts:282` adoption is `max(coversSeq, cursor.seq)`).

Intent re-approved as corrected.

## Round 3 — intent touch-up after spec-review REJECT (v2 spec)

Spec v2 was REJECTED on mechanism grounds; one correction propagated back into the intent:

- N7: marker-age grace on the disconnect sweep is **unreachable** — the marker is authoritative (written only after `finalFlush` drained in-flight pushes), every online device detects it fresh within minutes, and `completeDisconnectLocally` revokes the token + deletes the directory entry so no device can re-check at +30d. The sweep must execute unconditionally at detection, pinned inside `SyncEngine.ts:255-259` before `completeDisconnectLocally` (the `pullCycle.ts:114` branch is shadowed — `SyncEngine` checks first every cycle).

Intent re-approved as corrected.

