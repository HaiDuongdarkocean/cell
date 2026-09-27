# Spec Review — user-data-sync (final gate)

## Prior findings status

All 9 loop-2 blockers are resolved in the final specification:

1. Directory capture uses KV state diff and exempts `syncState` from the device-local `sync*` rule.
2. `nextSeq` and `nextSnapshotN` are persistent and never reset.
3. `cycleId` fences remote writes and acknowledgements.
4. Disconnect always writes `meta/disconnect.json`, and every connected device reads it each cycle.
5. Rebind freezes routing and drains held keys.
6. Every language-derived scope uses Target normalization.
7. Profile existence, deletion and recreation have explicit record semantics.
8. State-diff capture replaces the echo registry.
9. JSON-pointer-style flattening and element identity are defined.

All prior should-fix findings are implemented or explicitly accepted as documented risks. The requested acceptance coverage exists in SC-25 and SC-28–SC-33.

## Blocking

1. **Pending batch after compaction:** a pending journal could use a sequence already hidden by a newer snapshot. Require no compaction while a pending batch exists for the same connection and scope.
2. **Reader routing:** Reader scope depended on whether a profile currently existed, allowing the same book to split across global and profile scopes. Always use `profile:<target>` and let profile-less targets route through the system connection.
3. **Routing-change propagation:** persist routing-drain obligations for binding puts/tombstones and system-connection changes; publish durable route markers on vacated connections so devices without global access stop writing there.
4. **KV capture durability:** `pending()` must be read-only; stamp KV metadata only after the frozen batch is durable.
5. **KV apply race:** detect local value drift before applying a remote KV record, mint its HLC, run the merge policy and log the conflict.
6. **Missing-blob retry:** persist full deferred records before advancing a cursor and retry them when the blob repair completes.

## Should-fix

1. Persist full opaque records for unknown keys and child puts suppressed by a parent tombstone.
2. Apply blob verification to snapshots as well as journals.
3. Persist `disconnect-pending` intent across restarts.
4. Emit a referenced study config when creating a collection/deck in a scope that lacks it.
5. Cascade a book tombstone to its progress keys.
6. Add `onversionchange` close handling to all upgraded SRS, dictionary and Reader databases.

## Nit

- Directory record keys are an explicit exception to the generic KV prefix.
- A missing `connection:<id>` put compares as negative infinity for disconnect marker gating.
- A put after a tombstone starts a new lifetime and resets `firstHlc`.
- Concurrent profile ordering, empty default-collection dedupe and KV capture-time ordering should remain deterministic.
- `auto_download_whitelist` uses normalized `url` as element identity.
- Warning state needs a recovery edge.
- Acceptance coverage should include blob repair, routing-drain restart safety, KV apply races and pending-batch compaction.

## Role notes

- BA: intent-to-requirement traceability is complete and the account/profile topology matches the approved business decisions.
- PO: connect, bind, rebind, restore, disconnect, offline and recovery states are represented with visible actions.
- TL: the provider port remains clean; the remaining findings are direct specification corrections rather than architecture redesign.

## Applied fixes

1. Compaction is forbidden while the same connection/scope has a pending batch; SC-37 covers the failure mode.
2. Reader books and progress always use `profile:<target>`; profile-less targets route through `systemConnection`.
3. Added durable `meta/routes/<scope>.json` markers, persisted drain obligations, pre-push marker reads and restart-safe tail draining for all routing changes; SC-35 covers a device connected only to the old account.
4. Made KV `pending()` read-only and moved metadata stamping after frozen-batch persistence.
5. Added pre-apply KV drift detection, HLC merge and conflict logging; SC-36 covers the race.
6. Added persisted `deferredRecords`, repair-marker draining and SC-34.
7. Added full `opaqueRecords` retention for unknown and parent-suppressed records.
8. Extended upload-and-verify ordering to every record-bearing snapshot and journal.
9. Persisted `disconnect-pending` and added its data row.
10. Required collection/deck writes to include a missing referenced study config.
11. Added book-to-progress tombstone cascade.
12. Required `onversionchange` close handling for SRS, dictionary and Reader DB upgrades.
13. Pinned whitelist identity to normalized `url`, reset `firstHlc` after recreation, and added the warning recovery edge.

VERDICT: APPROVE_WITH_CHANGES
