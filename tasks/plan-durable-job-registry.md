# Plan — durable-job-registry

> Spec: `docs/specs/durable-job-registry.md` · Design: Concept A (inline rows, owner-picked) · Build: in-session sequential slices (registry core is shared dependency — parallel lanes would serialize anyway)

## Slices

| # | Task | AC traced | Files |
|---|---|---|---|
| S1 | JobRegistry core: Job types, registry (memory mirror + `TihokaJob:<id>` session persist + serialized write queue + 500ms throttle), dedup `JOB_DUPLICATE`, `retryable` per kind, scheduler cap (`resource-import` max 2 running), `reconcile` hooks, JOB_EVENT broadcast | REQ-1,2,3,7,8 · AC-3,4,9,14,16 | `src/entities/job/types.ts`, `src/features/jobs/logic/jobRegistry.ts` |
| S2 | Message plumbing: `JOB_LIST`/`JOB_EVENT`/`JOB_DISMISS`/`JOB_ACTION` types + zod + registry entries + `handlers/jobs.ts` | REQ-2,3,7,8 · AC-3,4 | `src/shared/config/messages.ts`, `src/entities/message/{types,registry,jobSchemas}.ts`, `src/entrypoints/background/handlers/jobs.ts` |
| S3 | Keep-alive pin (20s `getPlatformInfo` while active jobs) + boot sweep (queued/uploading/running → reconcile → done|interrupted; failed+pendingEffect retry) wired at SW start | REQ-5,9 · AC-5 | `src/features/jobs/logic/keepAlive.ts`, wire in `handlers/jobs.ts`/index |
| S4 | `resource-import` migration: job on first chunk (uploading), detached `importFile` on final chunk → `{jobId}` response, 30s stall → interrupted, terminal/unknown-jobId chunk rejected, `resourceId` immediate persist, cap 2 | REQ-1,10,11 · AC-1,2,5,16 | `handlers/resources.ts` |
| S5 | `resource-delete` migration: register + detached cascade + `{jobId}` | REQ-11 · AC-13 | `handlers/resources.ts` |
| S6 | `voice-download` migration: register + detached offscreen forward, progress correlate by `params.language`, completion effect → fresh `loadSettings()` → `downloadedLanguages`+`localTtsLanguage`, reconcile via `isVoicePackDownloaded` | REQ-4,11 · AC-6 | `handlers/ttsDownload.ts`, settings write |
| S7 | `local-audio-index` migration: register + detached build, completion effect stamps `lastIndexedAt` (0-entry counts), reconcile via index rows | REQ-4,11 · AC-7 | `handlers/localAudio.ts` |
| S8 | Orphan sweep at boot: scan `installationFinished=false` rows → `rollbackImport`; DSL index exists + `lastIndexedAt=null` → re-stamp | REQ-6 · AC-5,7 | `handlers/jobs.ts` boot path |
| S9 | `jobClient` + UI: `listJobs/dismissJob/retryJob/subscribeJobs`; ResourcesPanel registry-Job→ImportJob adapter (mount hydrate + event patch; panel-local duplicate/upload stays); ImportJob + `interrupted` status + retry/dismiss; TtsLanguagePanel registry-driven (remove caller onSave); LocalPronunciationSettingsPanel index job row (remove caller stamp) | REQ-2,3,7,8,11 · AC-1,3,4,8,12 | `src/features/jobs/services/jobClient.ts`, `ResourcesPanel.tsx`, `importJobTypes.ts`, `TtsLanguagePanel.tsx`, `LocalPronunciationSettingsPanel.tsx` |
| S10 | Remove legacy `RESOURCE_IMPORT_PROGRESS`/`TTS_DOWNLOAD_PROGRESS` for migrated kinds; i18n en/vi for all new strings | REQ-11 · AC-11,15 | handlers, i18n files |
| S11 | Docs: `docs/2-architechture-system.md`, ADR-108, `docs/0-wiki.md`; delete `src/entrypoints/mockup-durable-job-registry/` | DoD | docs |

## Gates

`npm run typecheck && npm run lint && npm run test:unit && npm run build` → real-Chrome verify (import → close panel → reopen truth; SW-kill → interrupted + rollback; TTS → close → downloadedLanguages) → fresh-context verify → sign-off → ship.
