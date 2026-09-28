# Verify: durable-job-registry

> Fresh-context review (subagent_explore) against `docs/specs/durable-job-registry.md` + fix pass on findings. Reviewer verdict: **VERDICT: PASS** — no spec-blocking defects.

## Deterministic gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS — 7465/7465 tests, 621 suites |
| `npm run build` | PASS |
| Real-Chrome verify | PASS — `tmp/durable-jobs/verify.mjs` 11/11 |

Browser evidence (clone profile, `--load-extension`): `JOB_LIST` answers; dropzone import → `resource-import` job done + `cellJob:*` record persisted in `chrome.storage.session` + resource card rendered + registry `JobRow` inline; done row survives panel reopen; `JOB_DISMISS` removes it; delete → `resource-delete` done + card removed; same-signature re-import spawns no second active job.

## Per-REQ review (fresh-context subagent)

| REQ | Verdict | Evidence |
|---|---|---|
| REQ-1 durable registration | met | `JobRegistry.register` persists `cellJob:<id>` to `chrome.storage.session` before start; `{jobId}` returned immediately; executors detached |
| REQ-2 progress/lifecycle | met | throttled persist (500ms) + immediate terminal/`resourceId` writes; `JOB_EVENT` broadcast per mutation |
| REQ-3 list on mount | met | `JOB_LIST` returns non-dismissed jobs; verified live |
| REQ-4 owner-side effects | met | `downloadedLanguages`/`localTtsLanguage`/`lastIndexedAt`/`installationFinished` written by background executors; no caller writes remain |
| REQ-5 boot sweep | met (after fix) | persisted actives → per-kind `reconcile`; `failed`+`pendingEffect` retried; otherwise `interrupted-restart` |
| REQ-6 orphan sweep | met | `installationFinished=false` → `rollbackImport`, skip langs with active imports; DSL re-stamp; per-entry failure isolation |
| REQ-7 dismiss | met (after fix) | terminal-only, `removedId` broadcast, unknown id → no-op success |
| REQ-8 retry | met | fresh job id minted from stored params; `resource-import` non-retryable → re-import hint |
| REQ-9 keep-alive | met | ref-counted `getPlatformInfo` pin while actives exist (aligned to 20s precedent) |
| REQ-10 upload-stall | met | 30s stall → `interrupted-upload-stall`; 10min TTL → `interrupted-upload-ttl`; terminal/unknown jobId chunks rejected |
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
