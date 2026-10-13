# Verify: durable-job-registry

> Fresh-context review (subagent_explore) against `docs/specs/durable-job-registry.md` + fix pass on findings. Reviewer verdict: **VERDICT: PASS** — no spec-blocking defects.

## Round 2 — post-ship adversarial re-review

A second fresh-context pass returned **FAIL** with actionable findings. All
majors fixed and re-verified; residuals documented below.

| Finding | Disposition |
|---|---|
| Boot-order race: handlers live before restore — early `JOB_LIST` empty, early chunk could resurrect an interrupted job | **Fixed** — `whenJobsReady()` shared readiness promise; every job-touching handler (`JOB_*`, `RESOURCE_IMPORT_CHUNK`, `RESOURCE_DELETE`, `TTS_DOWNLOAD_*`, `LOCAL_AUDIO_BUILD_INDEX`) awaits it; `initJobRegistry()` funnels through the same promise (`handlers/jobs.ts`, `index.ts`) |
| Raw `interrupted-*` codes in panel announcements | **Fixed** — shared `jobErrorText()` maps codes → `jobs.error.*` i18n keys; used by `JobRow`, `ResourcesPanel` announce/alerts, `LocalPronunciationSettingsPanel` status |
| `useJobs` stale snapshot: `JOB_LIST` response could overwrite a newer `JOB_EVENT` | **Fixed** — list response merges by `updatedAt` instead of replacing; covered by `useJobs.test.tsx` (event-during-fetch keeps newer state) |
| Local import rows suppressed registry twin indefinitely | **Fixed** — suppression now keyed to running local rows only (`isRunningJob`), so terminal/handoff states release the registry row |
| Orphan sweep skipped whole languages with active imports | **Fixed** — per-resource matching via `resourceId` or file `signature`; busy languages no longer shield stale rows |
| Orphan sweep only scanned languages in active profiles | **Fixed** — enumerates all `orca-dict-<hash>-*` DBs via `indexedDB.databases()` |
| `localAudio` did not re-stamp `lastIndexedAt` on rebuild | **Fixed** — `applyIndexEffect` no longer early-returns on existing stamp |
| Delete job params missing `resourceType` → wrong section | **Fixed** — `RESOURCE_DELETE` payload carries `resourceType`; handler prefers repo record, falls back to payload |
| `register` with same id could reset a tracked job | **Fixed** — same-id register returns the existing job |
| Restored `uploading` marked `interrupted-upload-stall` | **Fixed** — restored actives always `interrupted-restart`; `upload-stall` is reserved for the live 30s stall timer |
| Persist/unpersist failures swallowed | **Fixed** — `console.warn` inside `writeChain` (chain stays intact) |
| Lazy per-chunk TTL scan raced legitimate uploads | **Fixed** — removed; the per-pending 30s stall timer is the stall mechanism |
| Executor hang keeps job + keep-alive pin forever | **Accepted** — kinds have legitimately unbounded durations (multi-hundred-MB imports); a fixed timeout would kill real work. Mitigation: per-upload stall timer + keep-alive is opt-in while actives exist |
| `JobSchema.progress.total` optional vs entity required | **Accepted** — persisted-record compat; `persistedToJob` maps `total ?? 0` |
| `waitForJobTerminal` unused in production | **Accepted** — part of the `features/jobs` client API surface |
| Rollback failure only logged | **Accepted** — job lands `interrupted`; the `installationFinished=false` row is re-swept at next boot (`sweepOrphanedWork`) |

Round-2 gates: `typecheck` PASS · `lint` PASS · `test:unit` PASS — 622 suites / 7470 tests · `build` PASS (14.6s) · real-Chrome verify PASS — `tmp/durable-jobs/verify.mjs` **11/11 × 2** on the fixed build.

## Deterministic gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS — 7470/7470 tests, 622 suites |
| `npm run build` | PASS |
| Real-Chrome verify | PASS — `tmp/durable-jobs/verify.mjs` 11/11 |

Browser evidence (clone profile, `--load-extension`): `JOB_LIST` answers; dropzone import → `resource-import` job done + `TihokaJob:*` record persisted in `chrome.storage.session` + resource card rendered + registry `JobRow` inline; done row survives panel reopen; `JOB_DISMISS` removes it; delete → `resource-delete` done + card removed; same-signature re-import spawns no second active job.

## Per-REQ review (fresh-context subagent)

| REQ | Verdict | Evidence |
|---|---|---|
| REQ-1 durable registration | met | `JobRegistry.register` persists `TihokaJob:<id>` to `chrome.storage.session` before start; `{jobId}` returned immediately; executors detached |
| REQ-2 progress/lifecycle | met | throttled persist (500ms) + immediate terminal/`resourceId` writes; `JOB_EVENT` broadcast per mutation |
| REQ-3 list on mount | met | `JOB_LIST` returns non-dismissed jobs; verified live |
| REQ-4 owner-side effects | met | `downloadedLanguages`/`localTtsLanguage`/`lastIndexedAt`/`installationFinished` written by background executors; no caller writes remain |
| REQ-5 boot sweep | met (after fix) | persisted actives → per-kind `reconcile`; `failed`+`pendingEffect` retried; otherwise `interrupted-restart` |
| REQ-6 orphan sweep | met | `installationFinished=false` → `rollbackImport`, skip langs with active imports; DSL re-stamp; per-entry failure isolation |
| REQ-7 dismiss | met (after fix) | terminal-only, `removedId` broadcast, unknown id → no-op success |
| REQ-8 retry | met | fresh job id minted from stored params; `resource-import` non-retryable → re-import hint |
| REQ-9 keep-alive | met | ref-counted `getPlatformInfo` pin while actives exist (aligned to 20s precedent) |
| REQ-10 upload-stall | met | per-upload 30s stall timer → `interrupted-upload-stall`; terminal/unknown jobId chunks rejected (the racy lazy TTL scan was removed in round 2) |
| REQ-11 four-kind migration | met | all four executors registered; `RESOURCE_IMPORT_PROGRESS` retired for migrated flows; `TTS_DOWNLOAD_PROGRESS` remains only as offscreen→bg feed |
| REQ-12 untouched durable pipelines | met | `downloadQueue`/sync handlers unchanged |

## Findings fixed during verify

1. `handleRetryLocal` re-used the old `jobId` — chunks would be rejected once that registry job turned terminal → local retry mints a fresh `jobId` (`ResourcesPanel.tsx`).
2. Raw `interrupted-*` reason codes rendered unlocalized in `JobRow` — added `jobs.error.*` en/vi keys + code→key mapping.
3. Boot ordering race: `sweepOrphanedWork` could run before `initJobRegistry` finished restore → serialized: restore+sweep first, orphan sweep second (`background/index.ts`).
4. `public/options.js` (manifest `options_page` QA surface) still listened on legacy `TTS_DOWNLOAD_PROGRESS` and expected a synchronous download response → migrated to `JOB_EVENT`/`{jobId}` contract.
5. Spec alignment: keep-alive interval 25s → 20s (OffscreenManager precedent); `JOB_DISMISS` unknown id → no-op success instead of error; stale `RESOURCE_IMPORT_PROGRESS` description in arch doc corrected.

## Residual notes (accepted)

- `chrome.storage.session` tier means terminal rows vanish on full browser close — honest bound per REQ-3/NFR-4; durable-output flags cover recovery.
- `isVoicePackDownloaded()` is language-agnostic today (single-pack) — flagged in spec REQ-11 rules for when languages pluralize.

VERDICT: PASS
