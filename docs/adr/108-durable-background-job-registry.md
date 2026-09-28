# ADR: Durable background-owned job registry for long-running settings work

**Date:** 2026-10-05
**Status:** Accepted

## Context

Settings-triggered long-running work (dictionary/frequency import, cascade
delete, TTS voice-pack download, local-audio DSL indexing) used to be owned
by whichever surface started it — usually the Universal Panel's
ResourcesPanel or a Settings card. Three failure modes resulted:

1. **Silent kill** — upload chunks flowed from the panel; closing the panel
   stopped the stream and the job died as an orphan (`pendingImports` TTL).
2. **Invisible work** — parses/deletes/downloads continued in the background
   but progress was pushed only to the originator's tab, so reopening the
   panel showed nothing, and an idle-killed service worker left
   `installationFinished=false` resources and missing completion stamps.
3. **Lost results** — completion side effects (`installationFinished`,
   `downloadedLanguages`, `lastIndexedAt`) were written by the caller after
   the response returned, so a dead caller meant the durable state said the
   opposite of what the data showed.

## Decision

1. **JobRegistry (`features/jobs/logic/jobRegistry.ts`), singleton in
   background (`handlers/jobs.ts`).** A `Job` record
   (`{id, kind, label, status, progress, params, retryable, resourceId?,
   pendingEffect?, error?, result?, createdAt, updatedAt}`) is persisted per
   job to `chrome.storage.session` under `cellJob:<id>` through a serialized
   per-job `writeChain`; progress writes are throttled (500ms) while status
   and significant metadata flush immediately. Kinds:
   `resource-import | resource-delete | voice-download | local-audio-index`.

2. **Background owns execution AND completion.** Executors registered per
   kind run inside the service worker: `start` performs the work and stamps
   the durable effect itself (resource row + `installationFinished`,
   `settings.tts.downloadedLanguages`/`localTtsLanguage`,
   `localFile.lastIndexedAt`); the caller only receives `{jobId}` and
   observes via `JOB_LIST`/`JOB_EVENT` broadcast to every context.

3. **Boot-time reconciliation + readiness gate.** `whenJobsReady()` is a
   shared promise every job-touching handler awaits — `initJobRegistry()`
   at boot *and* any early message both funnel through it, so
   restore+reconcile always complete before `JOB_LIST`, chunk uploads,
   deletes, or offscreen progress are processed. Without it a
   `RESOURCE_IMPORT_CHUNK` landing during boot could resurrect a persisted
   interrupted job. On restore, persisted active jobs run each executor's
   `reconcile` which inspects durable output — resource exists +
   `installationFinished` → done (else rollback → interrupted); deleted
   resource absent → done (else interrupted); voice pack present → apply
   effect + done; DSL index non-empty → re-stamp + done. Anything that
   cannot be proven complete is marked `interrupted-restart` rather than
   left hanging. `sweepOrphanedWork` additionally rolls back
   `installationFinished=false` resources and re-stamps built-but-unstamped
   DSL indexes without relying on session records (session storage can be
   wiped by browser close); it scans every `orca-dict-*` DB via
   `indexedDB.databases()` and skips only rows owned by an active import
   (matched by `resourceId` or file `signature`).

4. **Upload is a job phase, not a separate channel.** Import chunks register
   an `uploading` job on first chunk; the final chunk assembles the `File`,
   stashes it in `importPayloads`, transitions to `queued`, and the executor
   picks it up. Chunks for unknown or terminal jobs are rejected; a 30s
   per-upload stall timer marks stalled uploads `interrupted` — file bytes
   cannot be recovered, so the UI tells the user to re-select the file
   rather than offering a meaningless retry.

5. **Dedup + caps + retry.** `register` throws `JobDuplicateError` on an
   active job with the same kind+identity signature (import:
   signature+langCode; delete: resourceId; voice/index: language/handleId);
   callers convert that into "attach to existing job". Per-kind
   `maxRunning` caps queue excess work; `retry` mints a fresh job id only
   for `retryable` kinds (imports are not retryable — bytes are gone).

6. **Keep-alive.** `onActiveCountChange` pins a
   `chrome.runtime.getPlatformInfo()` heartbeat interval while any job is
   active, keeping the MV3 service worker / Firefox event page alive for
   the job's duration (same pattern as OffscreenManager's keep-alive).

7. **UI: inline rows (design Concept A).** `JobRow` renders any registry
   job inside its owning Settings card — ResourcesPanel sections
   (split by `params.resourceType`), `TtsLanguagePanel`,
   `LocalPronunciationSettingsPanel`. Local pre-handoff rows
   (`ImportProgress`: queued/uploading/duplicate prompts) keep their own
   lifecycle and suppress their registry twin by id until handoff.
   Terminal rows persist until `JOB_DISMISS`; `JOB_ACTION retry` re-queues
   retryable kinds. `useJobs`/`useJobTerminalWatcher` are the observer
   hooks; `jobClient` wraps the message API (`listJobs`, `dismissJob`,
   `retryJob`, `subscribeJobEvents`, `waitForJobTerminal`).

## Consequences

- Closing the Universal Panel mid-import/delete/download/index no longer
  kills or hides the job; reopening reconstructs it from registry state on
  any surface.
- Completion side effects can no longer be lost with the caller — a
  "downloaded but unregistered voice pack" or "indexed but unstamped DSL"
  state is impossible; boot reconcile + orphan sweep converge leftovers.
- Legacy `RESOURCE_IMPORT_PROGRESS` push channel is removed; the only
  remaining progress push is `TTS_DOWNLOAD_PROGRESS`, now an
  offscreen→background feed into the registry (with `jobId`), not a UI
  channel.
- Jobs live in `chrome.storage.session`: they survive SW restarts but not
  a browser restart — by design, since upload payloads and offscreen work
  cannot resume across a full browser shutdown; the orphan sweep covers
  the durable leftovers that matter.
