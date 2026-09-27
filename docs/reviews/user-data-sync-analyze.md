# Analyze review — user-data-sync

> Mode: interactive · Artifact: `docs/intent/user-data-sync.md` · Reviewer: owner (Anh)

## Decisions captured from owner (2026-09-27)

- Backend: Google Drive `appDataFolder` (scope `drive.appdata`)
- Dictionaries: sync full content
- Pattern: multi-device active (real merge, not just backup)
- Browsers: Chrome + Firefox via the same Drive backend
- Binding: each profile → 1 Google account; one account for all profiles or one per profile
- Global config: single system account, user-selectable
- Rebind profile: allowed, data migrated to the new Drive, old Drive untouched
- Profile identity = target language (one profile per target; native only for translation) — duplicate-target profiles merged by migration
- `subtitleApiKeys`: sync normally (Drive appDataFolder = trust boundary)
- OAuth app: Testing mode for this item; In production + brand verification deferred to a later release step

## Agent defaults accepted without objection

- First connect with existing local data → merge, never overwrite (N17)
- Deletions propagate via tombstones (N16)
- Per-profile "don't sync" option (N18)

## Checklist

- [x] Need ≠ solution ≠ value
- [x] All five stakeholder groups addressed (owner must create the Google Cloud project + OAuth client)
- [x] Journey AS-IS + TO-BE complete, TO-BE ends at the value
- [x] ui_surface=yes consistent with connect/binding/status steps
- [x] Decision go supported by risk register

## Post-approval amendments (owner, 2026-09-27, during SPECIFY)

- N19: storage provider is a pluggable adapter; clean architecture so OneDrive/Dropbox can be added later without touching the engine. This item ships only the Google Drive adapter.

## Loop 1 amendments (after spec review REJECT, owner answers 2026-09-27)

- N3 amended: `activeProfileId` is device-local (owner: "Riêng từng máy").
- N20: Reader data (`cell-reader` books + progress) is synced (owner: "Sync luôn").
- N21: disconnect is SSOT — disconnecting an account on one device stops it on every device.
- N22: after switching a profile to local-only or another account, ask whether to delete the old remote copy (default keep).
- N23: minimal conflict log restored from the intent risk register.
- Out-of-scope list made explicit: `orca-local-player` library/history (+ immersion stats derived from it), `cell-local-audio-index`, UI layout prefs.

Owner approval: "trước hết là cứ test đi đã rồi về sau sẽ làm in product sau" — proceed, production publishing deferred.

VERDICT: APPROVE
