# ADR: Sync storage — visible "Tihoka Sync" Drive folder + local disconnect escape hatch

**Date:** 2026-10-01
**Status:** Accepted

## Context

Two field findings on the merged `user-data-sync` build drove this change:

1. **Invisible storage confused the owner.** Sync used `appDataFolder` (hidden Drive space, `drive.appdata` scope). It worked, but nothing was visible in the Drive UI, so the owner could not tell whether sync was actually writing data — a real trust/observability problem for a feature whose job is data safety.
2. **Unreachable replicated accounts could never finish disconnecting.** Connection records replicate through `syncDirectory` (REQ-1): a device may receive a connection record for an account it has never authenticated (`needs-reauth`). Normal disconnect must write `meta/disconnect.json` on *that account's* Drive, which needs a valid token — unobtainable when the account is not signed in on this device. The pending record retried forever (now backoff-gated) and the row stayed in the UI indefinitely.

## Decision

1. **Visible root folder, `drive.file` scope.** `GoogleDriveStorageProvider` resolves (or creates) a `Tihoka Sync` folder at Drive root and uses its id as the `parents` for every sync file — replacing flat `appDataFolder` paths. The folder id is cached in `kv('local')` per account, verified once per service-worker session via `files.get`, and invalidated on `not-found`. Any write hitting a 404 re-resolves the root once and retries, so deleting the folder self-heals into a fresh folder on the next write.

2. **Dual scopes during migration.** `DRIVE_SCOPES` requests both `drive.file` (new, visible-folder access) and `drive.appdata` (legacy, needed to *see and delete* the old hidden files — `drive.file` alone cannot enumerate `appDataFolder`). On first `rootFolderId` resolution per account per install, `cleanupLegacySpace` deletes every file in `appDataFolder` — with `drive.appdata` scope the app can only ever see files it created itself, so no unrelated user data is reachable — then sets a `legacyCleaned` flag. `drive.appdata` can be dropped from the consent config once all installs have migrated.

3. **`disconnectLocallyNow` — force-local disconnect.** A new path alongside `runConnectionDisconnect`: persist a marker obligation (`syncDisconnectMarkerPending:<id>` capturing the `Connection` record) **before** mutating state, then run the normal local completion (directory write, checkpoints, global-scope propagation, pending-record clear). No provider call is made, so it completes instantly for unreachable accounts. `completePendingDisconnects` drains both pending records *and* marker obligations each cycle, writing `disconnect.json` to the account's Drive with the same backoff schedule — other devices still learn the disconnect eventually; local learning data and the remote copy are untouched.

4. **`SYNC_DISCONNECT_LOCAL` message + SyncPanel affordance.** The message is wired through types/registry/schema → `handlers/sync.ts` → `SyncRuntime.disconnectLocal` → `disconnectAccountLocally` → `disconnectLocallyNow` → `disconnectConnectionLocally` in the UI client. SyncPanel shows "Remove locally" / "Ngắt cục bộ" on rows that are `disconnect-pending` **or** `needs-reauth` (a normal disconnect on those would only pend anyway), behind a destructive-variant confirmation that states: removed from this device now, cloud may still be unreachable, Cell keeps notifying the cloud copy in background, local data is kept, remote data is not deleted.

## Consequences

- Sync data is inspectable in Drive UI at `My Drive/Tihoka Sync/`; users can verify sync is writing. The `drive.file` scope limits app access to files it created — the rest of the user's Drive remains invisible to Cell.
- Re-consent is required once per install (new scope set); OAuth consent screen must list `drive.file`.
- Folder deletion by the user degrades to "recreate + republish" rather than a hard failure; other devices converge on the new folder through the same journal mechanics.
- Legacy `appDataFolder` data is deleted per owner decision; devices on old builds would simply see an empty hidden space (they were going to migrate anyway since hidden data was per-app).
- Pending-disconnect rows now have two exits: finish remotely when reachable, or remove locally with the remote notification continuing as a background obligation — no more permanently stuck rows.
