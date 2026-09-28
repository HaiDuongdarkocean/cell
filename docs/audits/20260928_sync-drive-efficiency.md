# Sync Efficiency Audit — SyncEngine + Google Drive storage

Date: 2026-09-28
Scope: `src/features/sync/**`, `src/features/{dictionary,srs,reader}/sync/**`, `src/features/dictionary/{services,repositories}`, `src/entrypoints/background/{syncRuntime,handlers/sync}.ts`

## 1. Evidence sync actually works

Test run 2026-09-28: `jest --selectProjects unit --testPathPatterns "features.sync|features.dictionary.sync|features.srs.sync|features.reader.sync"` → **35 suites, 458 tests, all pass**.

Key proof points (colocated test files):

| Claim | Evidence |
|---|---|
| wordStatus round-trips | `dictLocalSource.test.ts` — "round-trips a captured status through pending/resolve/ack", "applies a newer remote status and drops the row on unknown", "keeps local state for an older remote status" |
| dictResource + blob install on second device | `dictLocalSource.test.ts` — "imports blob content for a remote resource put when the blob is available", "keeps the resource incomplete when the blob is absent and retries on a later apply", "does not duplicate rows" |
| Multi-device convergence | `SyncEngine.test.ts` — "converges: three devices folding the same record set in different orders agree", "pulls from multiple remote devices independently", "recovers when the cursor predates compaction" |
| Drive write paths | `googleDriveStorageProvider.test.ts` — multipart <5MB, resumable >5MB, snapshot publish on first connect |
| Blob integrity protocol | pushCycle/pullCycle tests — "uploads blobs/<hash> and list-verifies it before the journal write", "refuses to publish a journal when a referenced blob is unavailable", "defers records whose blobs are missing and writes blobs-needed markers", "answers blobs-needed markers left by other devices" |
| Device-local fields never leak | `settingsRegistry.test.ts` — SC-20 suite: TTS voices, api-key status, active selections never emit records |

Caveat on evidence strength: all coverage is unit/integration with `FakeDrive` (in-memory Drive). There is **no e2e spec exercising real Google Drive** — real-network behavior (token refresh under load, Drive `contains` quirks, quota errors) is covered by mocked fetch in `googleDriveStorageProvider.test.ts` only.

## 2. Current granularity (already minimal-unit)

| Data | Change unit | Notes |
|---|---|---|
| wordStatus | `word:<term>` — `{term,status,updatedAt}` | Per-word. `captureChange` inside the same IDB tx as the status write (atomic). Cannot go smaller. |
| dictResource | `resource:<token>` + `resource:<token>/<field>` for `name|enabled|priority|disabledComponents` | `updateResource` diffs prev vs next per field via `stableJson`; toggling `enabled` emits only the changed field records. Dict content itself is a content-addressed blob (`blobs/<sha256>`), dedup'd globally, uploaded once. |
| Settings/profileConfig | per-leaf path records (`kv:settings/...`, `profile/...`) | Field-level via flatten registry. |
| SRS | per entity row (`cards:<id>` etc.) | Per card/note/review-event. |
| readerProgress | `progress:<book>/position` + `progress:<book>/readTime/<device>` | Per-book position + per-device readTime (max-merge). |

Wire efficiency: changes batch into one gzipped `journal-<seq>.json.gz` per scope per cycle; pull is cursor-incremental (only new files); >50 journals compact to a snapshot; tombstones preserved.

## 3. Findings — optimization gaps

Scored 1–5 (velocity 30%, risk 35%, reach 20%, inverse cost 15%).

| # | Location | Type | Finding | Score |
|---|---|---|---|---|
| F1 | `handlers/sync.ts:267` + `externalChanges.ts` | Architectural | **IDB changes don't nudge the scheduler.** Debounced 2s trigger only watches `chrome.storage` keys; wordStatus/dictResource/SRS/reader writes wait for the 5-min alarm. Vocabulary sync latency ≤5min vs 2s for settings. | 3.9 |
| F2 | `resourceIdentity.ts:8-17` | Architectural | **Portable dict blob is uncompressed NDJSON.** Journals/snapshots are gzipped but the largest payload (dictionary content, often tens of MB) uploads raw. ~60–80% size reduction available via fflate (already a dep). | 3.7 |
| F3 | `pushCycle.ts:243-276` | Code quality | **`uploadAndVerifyBlobs` lists `blobs/` twice per batch** (before + after upload) — and runs again inside `compactScopeIfNeeded`. Every dictResource base record carries `contentHash` → even an `enabled` toggle pays 2 full blob listings. Verify newly-uploaded sizes from `write()` responses; memoize the listing per cycle. | 3.6 |
| F4 | `SyncEngine.ts:572-593` + `pullCycle.ts:195` | Code quality | **Redundant scope listings.** `listPullScopes` lists all of `scopes/` (already contains every device file), then `pullScope` re-lists `scopeDevicesPrefix(scope)` per scope → N+1 calls where 1 suffices. Group the first listing by scope+device. | 3.4 |
| F5 | `googleDriveStorageProvider.ts:265-285` | Architectural | **Flat namespace + `name contains` queries.** Every `list(prefix)` scans the whole sync-root file namespace server-side; result sets grow with blob/journal count. Acceptable now; consider `name in (...)` or-clauses for targeted existence checks (blob hashes). | 2.9 |
| F6 | `pushCycle.ts:37-38` | Process | `DEFAULT_JOURNAL_COMPACTION_THRESHOLD = 50` means up to 50 tiny journal files before folding. Fine for correctness; raising/lowering is a Drive-quota vs read-amplification trade-off — leave as is. | 2.4 |

## 4. What's already optimal (do NOT touch)

- Per-record HLC + firstHlc merge with per-dataClass policies (LWW, card-component merge, readTime max) — correct + minimal.
- Two-phase push (`freezeBatch` → journal write → `stampCommitted` → ack) — crash-safe; pending batch retries without duplicates.
- Cursor pull `{snapshotN, seq}` — never re-reads consumed files; gap detection waits for snapshot instead of skipping.
- Content-addressed blobs shared across scopes/connections; `blobs-needed` marker protocol lets peers supply missing blobs; deferred records drain automatically.
- Resumable uploads >5MB with resume-state keyed by content hash.
- Capture-only-when-connected (`runtime.enabled`) with first-connect snapshot minting — no outbox growth when sync is off.
- `stableJson` field-diff capture for dictResource — emits only changed fields.

## 5. Recommended actions

1. **Quick win — wake-on-write for IDB sources (F1).** Emit a cheap nudge after `captureChange` (e.g. bump a counter key in `chrome.storage.local` on the synced-keys list, or `runtime.sendMessage(SYNC_HINT)`), debounced through the existing `debouncedFire`. Vocabulary/dict latency 5min → ~2s.
2. **Quick win — memoize blob listing per cycle (F3).** Pass the `present` map + newly-written sizes through `commitBatch`/`compactScopeIfNeeded`; drop the second `list(BLOBS_PREFIX)`.
3. **Pay-down — gzip portable dict blobs (F2).** Serialize → gzip → hash compressed bytes; migrate by keeping legacy-hash lookup on read (`by_contentHash` OR sha256 of decompressed). Largest bandwidth/quota win.
4. **Pay-down — reuse pull listing (F4).** Group `listPullScopes` entries by scope/device instead of re-listing per scope; saves one paged list per bound profile per cycle.
5. **Watch — e2e Drive coverage.** No real-Drive e2e exists; consider a manual verification checklist in `testing-extension-browser` before shipping sync UX changes.

## 6. Business impact

- F1: vocabulary sync feels "instant" instead of up-to-5-min — the feature the user actually notices.
- F2: for a user importing a 30–50MB dictionary, one-time upload + every additional device's download shrinks ~60–80%; less Drive quota + fewer resumable-upload retries on weak networks.
- F3+F4: ~3–6 fewer Drive `files.list` calls per cycle → less quota burn and faster cycles as blob/journal counts grow.
