# Spec: Durable background job registry for Settings-triggered long-running operations

> Intent: `docs/intent/durable-job-registry.md` · ui_surface: yes · Mode: interactive

## Objective

Long-running operations triggered from Settings (resource import/delete, TTS voice-pack download, local-audio DSL index build) must exist as durable background-owned job records so that closing the Universal Panel/Settings, losing the message sender, or a service-worker restart can never silently kill, hide, or lose the result of work the user started. The system persists job lifecycle to `chrome.storage.session`, broadcasts state to every open surface, lets any surface rebuild truth on mount, marks dead work `interrupted` honestly with rollback/cleanup, and records completion effects (`downloadedLanguages`, `lastIndexedAt`, `installationFinished`) in the job owner — never in a mortal caller. Already-durable pipelines (media `downloadQueue`, sync obligations) are left untouched.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Settings/panel user | starts import, delete, voice download, index build; dismisses/retries a job | file pick/drop, resource id, language code, dsl handle id | job rows (status, progress, error), retry/dismiss actions, resource/settings state |
| Extension surface (any context) | mounts panels | `JOB_LIST` request, `JOB_DISMISS`/`JOB_ACTION` | `JOB_EVENT` broadcasts, `JOB_LIST` response |
| Chrome runtime | SW start/idle | boot event, storage.session contents | — |
| Offscreen document | voice download execution | `TTS_DOWNLOAD_VOICE` | progress/result to background |

System-internal processing never includes human behavior. "User re-imports a file" is modeled as a new job input, not a system step.

## Requirements

### Functional

REQ-1: Durable job registration
- Actor: extension surface (resource client, TTS client, local-audio flow)
- Goal: make a long-running operation a first-class persisted record independent of the requester
- Preconditions: none — any context may trigger; the caller mints the `jobId` for chunked imports (`providedJobId`, existing `resourceClient` contract) so it can correlate upload-phase progress before the job exists in the registry
- Basic flow:
  1. actor triggers an operation (import chunks start / `TTS_DOWNLOAD_VOICE` / `RESOURCE_DELETE` / `LOCAL_AUDIO_BUILD_INDEX`)
  2. system creates `Job {id, kind, label, status, progress, params, retryable, createdAt, updatedAt}` — for chunked import on the first chunk with `status:'uploading'`; for the other kinds immediately with `status:'queued'`
  3. system persists the record to `chrome.storage.session` before starting execution; registration itself takes the concurrency/dedup decisions (Rules)
  4. system returns `{jobId}` and starts execution detached — the caller is never awaited again
- Alt flow: an import job transitions `uploading → running` when the final chunk arrives; non-import kinds go `queued → running` as soon as the executor starts
- Exception: session persistence write fails → job continues in memory and still emits events (degrade to today's behavior, never block the operation); the failure is logged on the job
- Rules:
  - `kind ∈ {'resource-import','resource-delete','voice-download','local-audio-index'}` — open for extension via registration only
  - Dedup: if an active (`queued|uploading|running`) job already exists with the same `kind` + identity key (`voice-download:language`, `resource-delete:resourceId`, `local-audio-index:dslFileHandleId`; `resource-import:signature` when computable, else caller-minted id) the new request is rejected with `JOB_DUPLICATE` — the existing job is the SSOT
  - `params` stores only ids/keys — never file bytes
  - `retryable` is declared per kind: `voice-download`, `local-audio-index`, `resource-delete` → `true`; `resource-import` → `false`
  - `resourceId` assignment (import `onResourceCreated`) persists immediately, not on the throttle — it keys the orphan sweep fast path
- Postcondition: a `JOB_LIST` call in any context returns the job
- NFR refs: NFR-1, NFR-3

REQ-2: Job progress + lifecycle reporting
- Actor: extension surface
- Goal: observe job state without having started it
- Preconditions: a job exists in the registry
- Basic flow:
  1. system updates job `{status, progress.done, progress.total}` during execution
  2. system persists updates throttled (≤1 persisted write per 500 ms per job; terminal states and `resourceId` assignment persist immediately); `chrome.storage.session` writes are serialized per job (write queue) — no read-modify-write races
  3. system broadcasts `JOB_EVENT {job}` to all contexts
- Alt flow: no listeners → events dropped, record still persisted
- Exception: persistence failure → in-memory record updated, event still broadcast, degrade logged
- Rules: `status` transitions `queued|uploading → running → done|failed|interrupted`; `interrupted` means the executor died — never set by normal completion; `error` carries a stable reason code (`interrupted-restart`, `interrupted-upload-stall`, or the thrown message) mapped to localized row text
- Postcondition: every open surface renders the same job truth
- NFR refs: NFR-1

REQ-3: Job list on mount
- Actor: extension surface
- Goal: rebuild job UI after panel reopen
- Preconditions: none
- Basic flow:
  1. actor sends `JOB_LIST` (optionally filtered by `kind`)
  2. system returns all non-dismissed jobs newest-first
- Alt flow: empty registry → empty list (no rows)
- Exception: storage.session unreadable → returns the in-memory set (may be empty after restart — honest absence, not a fabricated list)
- Rules: terminal jobs persist in the list until dismissed or the session ends (browser close wipes the session tier — honest bound, not a promise beyond it)
- Postcondition: UI state equals registry truth, no event-history required
- NFR refs: NFR-2

REQ-4: Owner-side completion effects
- Actor: none (system terminal step)
- Goal: a job's result is recorded even if every UI is closed
- Preconditions: job in `running`
- Basic flow:
  1. job reaches success
  2. system applies the kind's completion effect in the background, reading fresh state immediately before writing:
     - `resource-import` → resource row finalized `installationFinished=true` + resource-change notification
     - `resource-delete` → cascade removal (already applied during execution)
     - `voice-download` → fresh `loadSettings()`, append language to `settings.tts.downloadedLanguages`, set `localTtsLanguage` when it equals the job's requested language, write back — concurrent user edits are not clobbered
     - `local-audio-index` → fresh `loadSettings()`, stamp `lastIndexedAt` on `settings.pronunciation.localFile`; a 0-entry index stamps `lastIndexedAt` too (the build ran — "not indexed" would be a lie)
  3. system marks the job `done` with a result summary
- Alt flow: completion effect fails → job `failed` with `pendingEffect:true`; REQ-5's sweep retries the effect on next boot
- Exception: none beyond the alt flow — effect application must not lose the work result itself
- Rules: panels NEVER write these effects in caller code — the caller-side writes in `TtsLanguagePanel` and `LocalPronunciationSettingsPanel` are removed
- Postcondition: reopened settings reflect finished work with no caller alive
- NFR refs: NFR-4

REQ-5: Boot sweep — honest interruption + deferred effects
- Actor: Chrome runtime
- Goal: after SW restart, dead jobs stop pretending to run and owed completion effects are retried
- Preconditions: persisted jobs exist (or none)
- Basic flow:
  1. SW starts (message restore / keep-alive wake / user event)
  2. system loads persisted jobs; every job in `queued|uploading|running` plus every `failed` job with `pendingEffect:true` is evaluated by its kind's `reconcile(job)` — a bounded, read-only check except the job record and the declared completion effect:
     - completion already durable (voice pack present on disk — `isVoicePackDownloaded()`, index rows exist for `dslFileHandleId`, resource `installationFinished=true`) → apply any missing completion effect, mark `done`
     - `failed` + `pendingEffect` → retry the completion effect once; success → `done`, failure → stays `failed`
     - otherwise → mark `interrupted` with reason `interrupted-restart`
- Alt flow: no persisted jobs → sweep is a no-op
- Exception: reconcile throws → that job → `interrupted` with the reconcile error as reason; sweep continues over the rest
- Rules: default reconcile = `interrupted`; reconcile never re-runs work — it only inspects durable state and applies owed effects
- Postcondition: `JOB_LIST` contains no zombie `running` rows; owed effects are applied or the job stays honestly `failed`
- NFR refs: NFR-4

REQ-6: Orphan sweep — partial-output cleanup
- Actor: Chrome runtime
- Goal: interrupted imports leave no drifting partial resources, even when the job record is gone (browser close wipes session storage)
- Preconditions: boot sweep has run
- Basic flow:
  1. system scans resource rows for `installationFinished=false` (per-language repository query — the flag is the durable marker, not the job record)
  2. for each orphan, system runs `rollbackImport(langCode, resourceId)` — dict entries + frequency entries + phrase index + resource row; a `RollbackError` is logged and the row listed for UI-visible cleanup rather than silently skipped
  3. fast path: an `interrupted` `resource-import` job carrying `resourceId` feeds the same rollback directly
- Alt flow: DSL index rows exist for a `localFile` config whose `lastIndexedAt` is `null` → re-stamp `lastIndexedAt` (no rebuild — REQ-4 semantics apply)
- Exception: rollback throws → error logged on the affected entry; sweep continues; the resource remains listed as an interrupted cleanup target
- Rules: sweep keys on durable flags (`installationFinished`), not on job records — session records are best-effort, IDB flags are ground truth
- Postcondition: no `installationFinished=false` resource survives a sweep; owed stamps applied
- NFR refs: NFR-4

REQ-7: Dismiss
- Actor: extension surface
- Goal: clear terminal job rows
- Preconditions: job in `done|failed|interrupted`
- Basic flow:
  1. actor sends `JOB_DISMISS {jobId}` on a terminal job
  2. system removes the record and broadcasts the removal event
- Alt flow: — none
- Exception: job non-terminal → reject (`non-terminal` jobs are not dismissible); unknown id → no-op success
- Rules: none
- Postcondition: row gone on every surface
- NFR refs: NFR-6

REQ-8: Job action — retry
- Actor: extension surface
- Goal: re-run a failed/interrupted job when the stored params suffice
- Preconditions: job terminal and `retryable:true`
- Basic flow:
  1. actor sends `JOB_ACTION {jobId, action:'retry'}`
  2. system re-launches the operation under a NEW job id from stored `params`; the old terminal job is preserved unchanged until dismissed
- Alt flow: `resource-import` (`retryable:false`) → retry rejected; UI shows dismiss + re-import hint; cancel of `running` jobs is a declared non-goal (see Non-goals)
- Exception: stored params no longer valid (file handle gone, permission revoked) → the new job fails fast with the reason; a new input creates a new job
- Rules: retry validates params before starting; dedup (REQ-1) still applies — a retry colliding with an active same-identity job is rejected
- Postcondition: retried work runs detached exactly like a fresh operation
- NFR refs: NFR-6

REQ-9: Keep-alive pin
- Actor: none
- Goal: the SW stays alive for the duration of active jobs
- Preconditions: none
- Basic flow:
  1. system holds a keep-alive pin (periodic `chrome.runtime.getPlatformInfo`, 20 s interval — OffscreenManager precedent; the Chrome-side implementation is new code) while ≥1 job is `queued|uploading|running`
  2. system releases the pin when the last job reaches a terminal state
- Alt flow: pin start fails (API error) → job still runs; failure logged — jobs never depend on the pin to be correct, only to finish faster
- Exception: none propagated — keep-alive failure must not kill the job
- Rules: pin is SW-level, independent of the Firefox offscreen pin already in `OffscreenManager`; never pins for terminal jobs
- Postcondition: MV3 idle-kill cannot strand a mid-parse import
- NFR refs: NFR-5

REQ-10: Upload-stall interruption + terminal-job chunk rule
- Actor: none
- Goal: a dead sender stops holding a phantom uploading job, and late chunks cannot resurrect an interrupted job
- Preconditions: job in `uploading`
- Basic flow:
  1. an `uploading` job receives no `RESOURCE_IMPORT_CHUNK` for 30 s (timer reset per received chunk)
  2. system drops the pending chunk buffer and marks the job `interrupted` with reason `interrupted-upload-stall`
- Alt flow: a `RESOURCE_IMPORT_CHUNK` arriving for a terminal (`interrupted|failed|done`) or unknown `jobId` is rejected with an error response — the sender's loop aborts; chunks never resurrect a dead job (`unknown` = the 10-min buffer TTL for pre-completion buffering still applies, but a persisted `interrupted` job wins over the buffer map)
- Exception: none propagated to other jobs
- Rules: only the upload phase stalls this way; `running` has no inactivity timeout — long parses are legal; the legacy lazy-TTL reap on next chunk (`resources.ts:241-243`) is replaced by the stall timer
- Postcondition: reopening shows "interrupted — re-import the file" instead of a stuck spinner
- NFR refs: NFR-4

REQ-11: Migrate the four pipelines onto the registry — per-kind cutover
- Actor: extension surface
- Goal: the audited gaps close for `resource-import`, `resource-delete`, `voice-download`, `local-audio-index`
- Preconditions: REQ-1–REQ-10 infrastructure exists
- Basic flow — each kind lands as an independently verifiable slice, in this order:
  1. `resource-import`: chunk handler creates the `uploading` job on first chunk; final chunk → `running`, `importFile` executes detached with `{jobId}` returned to the sender; progress/done/failed flow through the registry; panels render rows from `JOB_LIST`+`JOB_EVENT` via a registry-Job→`ImportJob` adapter (panel-local `duplicate`/`skipped` statuses, `file`/`signature`/`duplicate.resolve` stay panel-owned — they are input decisions, not job state); concurrency/memory bounds are preserved — `MAX_CONCURRENT_IMPORTS=2` and `MAX_INFLIGHT_BYTES=256MB` stay in the panel scheduler, and the registry rejects a `queued → running` start that would exceed the active-import cap
  2. `resource-delete`: handler registers the job and executes `deleteResourceCascade` detached with `{jobId}` return
  3. `voice-download`: background registers the job then forwards to offscreen; offscreen `TTS_DOWNLOAD_PROGRESS` (payload has no `jobId`) correlates by `params.language`; completion effect per REQ-4
  4. `local-audio-index`: `LOCAL_AUDIO_BUILD_INDEX` registers the job, runs detached, stamps `lastIndexedAt` itself per REQ-4
- Alt flow: a slice can ship without the others — jobs of unmigrated kinds simply don't exist in the registry yet
- Exception: executor launch failure (missing handle, permission revoked — `localAudio.ts:99-105` precedent) → job `queued → failed` immediately with the launch error
- Rules: the legacy `RESOURCE_IMPORT_PROGRESS` and `TTS_DOWNLOAD_PROGRESS` channels are removed for migrated kinds in the same change — no dual-source drift (intent risk); `isVoicePackDownloaded()` currently takes no language arg — note the signature extension when languages pluralize
- Postcondition: audit gaps A/B/C closed for these four kinds
- NFR refs: NFR-4, NFR-6, NFR-7

REQ-12: Existing durable pipelines untouched
- Actor: none
- Goal: no regression in media `downloadQueue` (session restore, pause/resume/retry) or sync obligations
- Preconditions: none
- Basic flow: none — constraint, not a flow
- Alt flow: none
- Exception: none
- Rules: no structural changes to `handlers/download.ts`, `helpers.ts` session restore, or sync runtime; their tests keep passing unmodified
- Postcondition: media downloads and sync behave exactly as today
- NFR refs: NFR-7

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Job-record writes must not amplify storage churn | P | ≤1 persisted update per 500 ms per job + immediate terminal/`resourceId` writes; serialized per-job write queue |
| NFR-2 | Reopen rebuild is instant | U | `JOB_LIST` round-trip < 3 s (persona bar), typically <50 ms |
| NFR-3 | Job payload size bounded | +resource | params store ids/keys only — never file bytes |
| NFR-4 | Recovery honest | R | after SW kill, no job reports `running` that is not running; partial IDB output rolled back |
| NFR-5 | Keep-alive bounded | +resource | pin held only during active jobs; 20 s interval (interval precedent exists; Chrome-side mechanism is new code) |
| NFR-6 | UI parity | U | job rows reuse the existing `ImportJob` row design + shared `ui/` components; per-kind surfaces: ResourcesPanel (import/delete), TtsLanguagePanel (voice), LocalPronunciationSettingsPanel (index); i18n en/vi; aria-live status changes |
| NFR-7 | Cross-browser | +infra | works on Chrome offscreen path and Firefox in-process dispatch (ADR-106) — registry lives in the shared background layer; Firefox event-page suspend may leave partial OPFS voice-pack files — retry overwrites them (accepted) |

## Flows / States

### Job lifecycle

```
          caller mints jobId, first chunk          final chunk
            ┌──────────► uploading ─────────────────┐
            │ (stall 30s → interrupted)             ▼
 queued ────┴──────────────────────────────► running ───┬─► done
   │ ▲            executor-launch fail → failed        ├─► failed (pendingEffect? retried next boot)
   │ └────────── retry: NEW job id (retryable kinds)   └─► interrupted (executor died)
   └─── `queued` is transient — executors start immediately unless the
        active-import cap holds the start (registry enforces)

chunk for terminal/unknown jobId → rejected, sender aborts
non-terminal ─JOB_DISMISS→ rejected · terminal ─JOB_DISMISS→ removed
```

### Reopen rebuild sequence

```
panel mount → JOB_LIST → render rows (running rows subscribe live)
            → JOB_EVENT(job) per update → row patches in place
            → terminal row + [retry if retryable] + [dismiss]
```

### Boot sweep

```
SW start → load jobs → for each queued|uploading|running job, and failed+pendingEffect:
             reconcile() ─ durable-complete? ─► apply owed effect → done
                          └ otherwise ────────► interrupted
           → orphan sweep (scan installationFinished=false rows → rollbackImport)
           → DSL re-stamp (index rows exist, lastIndexedAt=null)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Persist job lifecycle independently of callers | `JobRegistry` background module; per-job `chrome.storage.session` records + serialized write queue; `JOB_*` message surface |
| Surface job truth to any open UI | `JOB_LIST` pull; `JOB_EVENT` broadcast; registry-Job→`ImportJob` adapter; job rows in ResourcesPanel (import/delete), TtsLanguagePanel (voice), LocalPronunciationSettingsPanel (index); interrupted/failed rows with retry/dismiss; i18n en/vi |
| Keep the executor alive during work | SW keep-alive pin tied to active-job count |
| Recover honest state after executor death | Boot sweep + per-kind `reconcile` hooks; flag-keyed orphan sweep via `rollbackImport`; `lastIndexedAt` re-stamp |
| Detach work from the requester | `{jobId}` immediate return; detached import/delete/index execution; TTS owner-side completion writes |
| Track the upload phase | `uploading` status + per-chunk stall timer + terminal-job chunk rejection |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `Job` | `id`, `kind`, `label`, `status`, `progress:{done,total}`, `params` (ids only), `retryable`, `error` (reason code), `resourceId?`, `pendingEffect?`, `createdAt`, `updatedAt` | `chrome.storage.session` — one key per job (`cellJob:<id>`) + in-memory mirror | until `JOB_DISMISS` or session end (browser close) |
| `PendingImport` (upload buffer) | `jobId`, `chunks[]`, `received`, `createdAt` | SW memory only | buffer TTL 10 min for pre-completion; stall-interrupt 30 s while tracked |
| Job params per kind | import: `{langCode, resourceType, fileName, signature?, duplicateDecision}`; delete: `{langCode, resourceId}`; voice: `{language}`; index: `{dslFileHandleId}` | inside `Job.params` | with job |

## Alternatives considered

- **Extend `downloadQueue` into the universal job store** — rejected: its item shape (`DownloadItem` per tab, pause/resume byte semantics, `chrome.downloads` binding) models network downloads, not arbitrary work; forcing imports/deletes into it couples unrelated lifecycles. The registry is the generic store; the queue stays its own backend.
- **`chrome.storage.local` instead of `session`** — rejected: terminal job records would leak forever across browser restarts; jobs are ephemeral by nature. Session tier matches the guarantee we can actually make (SW-lifetime + honest interruption on restart).
- **Job records in IndexedDB** — rejected: heavier read/write for a hot progress path; session storage already carries `downloadQueue` state and survives exactly the lifetime jobs need. Flag-keyed orphan sweep uses IDB flags where durability truly matters.
- **Resumable upload via persisted file handles** — rejected for this item: `FileSystemFileHandle` permission flow + cursor bookkeeping per strategy is a large cost for re-drop convenience; honest `interrupted` + re-import covers the need.

## Non-goals

- Cancel of `running` jobs (no executor supports abort mid-run — declared non-goal, revisit if asked)
- `JOB_ACTION` cleanup action beyond retry/dismiss (deferred — orphan sweep covers automatic cleanup)
- Unified "task center" UI aggregating media downloads + sync + registry jobs
- Mirroring `downloadQueue` items into the registry
- Resumable chunk uploads (File objects cannot cross contexts)
- OCR/model downloads, local-player scoring (out of scope — future kinds)

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 (no silent death) | REQ-1, REQ-9, REQ-10 | AC-1, AC-2, AC-5 |
| N2 (reopen truth) | REQ-2, REQ-3 | AC-3, AC-4 |
| N3 (owner-side results) | REQ-4, REQ-11 | AC-6, AC-7 |
| N4 (executor survives) | REQ-9 | AC-5 |
| N5 (honest interrupted + cleanup) | REQ-5, REQ-6, REQ-10 | AC-1, AC-2, AC-5, AC-8 |
| N6 (generic registry) | REQ-1, REQ-8, REQ-11 | AC-9 |
| N7 (don't rewrite durable pipelines) | REQ-12 | AC-10 |
| N8 (persist terminal rows) | REQ-3, REQ-7 | AC-4 |

| Story / Journey | REQ |
|---|---|
| S1 import survives close / honest interruption | REQ-1, REQ-5, REQ-6, REQ-9 |
| S2 reopen shows truth | REQ-2, REQ-3 |
| S3 interrupted → clear next step | REQ-7, REQ-8, REQ-10 |
| S4 voice-pack completion registers | REQ-4, REQ-11 |
| S5 reuse without new plumbing | REQ-1, REQ-8 |
| AS-IS 1–3 (upload orphan, invisible parse, SW-kill corruption) | REQ-1, REQ-2, REQ-5, REQ-6, REQ-9, REQ-10 |
| AS-IS 4 (reopen shows nothing) | REQ-3 |
| AS-IS 5–6 (lost downloadedLanguages/lastIndexedAt) | REQ-4, REQ-5, REQ-6, REQ-11 |
| TO-BE 1–5 | REQ-1–REQ-12 |

## Boundaries

- Always: persist the job record before starting the work (obligation-first, sync precedent); throttle progress writes but persist `resourceId`/terminal states immediately; completion effects only in the background owner via fresh `loadSettings()`; i18n en/vi for every new string; gates `npm run typecheck && npm run test:unit && npm run build` + real-Chrome verify before commit
- Ask first: new dependency; `manifest.json` change; changing `downloadQueue`/sync internals
- Never: file bytes inside `Job.params`; retry for `retryable:false` kinds; rewriting media `downloadQueue` or sync pipelines; comments in code

## Success Criteria

- [ ] AC-1: Import a dictionary, close the Universal Panel during parse, reopen Settings → Resources: the job row shows live `running` progress or `done` — it is present and truthful in every case.
- [ ] AC-2: Close the panel mid-chunk-upload → within the 30 s stall window the job becomes `interrupted`; on reopen it shows an interrupted row with dismiss + re-import hint; a late chunk for that jobId is rejected (no resurrection).
- [ ] AC-3: `JOB_LIST` issued by a freshly opened surface returns all non-dismissed jobs; two open surfaces show identical job state via `JOB_EVENT`.
- [ ] AC-4: `done`/`failed`/`interrupted` rows persist across panel reopen until `JOB_DISMISS` or browser close; dismissing removes the row on every surface; `non-terminal` dismiss is rejected.
- [ ] AC-5: Kill the SW mid-parse: on next SW start the job is `interrupted` (or `done` when completion was durable); no `installationFinished=false` resource remains — the flag-keyed orphan sweep ran `rollbackImport`, even with the job record absent.
- [ ] AC-6: Start a TTS voice-pack download, close Settings before it finishes: `settings.tts.downloadedLanguages` still gains the language on completion; reopen shows `done`.
- [ ] AC-7: `LOCAL_AUDIO_BUILD_INDEX` completes with the panel closed → `lastIndexedAt` is stamped by the background; a pre-existing index with `lastIndexedAt=null` self-heals (re-stamp, no rebuild).
- [ ] AC-8: `interrupted`/`failed` `retryable` kinds (`voice-download`, `local-audio-index`, `resource-delete`) offer retry that re-launches under a new job id; `resource-import` offers dismiss only; retry with invalid params (revoked handle) fails fast with a reason.
- [ ] AC-9: A new job kind can be added by registering `kind` + `reconcile` + executor — no new message types for list/event/dismiss.
- [ ] AC-10: Media download pause/resume/retry and sync tests pass unmodified.
- [ ] AC-11: All new strings present in en + vi; job status changes are screen-reader perceivable (aria-live or equivalent).
- [ ] AC-12: A `failed` job row renders its error and stays until dismissed — e.g., an import whose parse throws surfaces `failed` with the message, not a vanished row.
- [ ] AC-13: `resource-delete` end-to-end: start a delete, close the panel, reopen → `done`; SW-kill mid-delete → `interrupted` + retry completes the cascade idempotently.
- [ ] AC-14: With `chrome.storage.session` writes failing, an import still completes and emits `JOB_EVENT` — degraded persistence, not a blocked job.
- [ ] AC-15: After migration, no `RESOURCE_IMPORT_PROGRESS` or `TTS_DOWNLOAD_PROGRESS` handlers remain for the migrated kinds — UI rows come solely from the registry (dual-source drift eliminated).
- [ ] AC-16: Launching a second `voice-download` for the same language while one is active is rejected/coalesced (`JOB_DUPLICATE`) — no OPFS write race.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (shared `ui/` components, tokens only)
- [ ] Real-Chrome verify: import → close panel → reopen shows truth; SW-kill → interrupted + rollback; TTS download → close → `downloadedLanguages` recorded
- [ ] Canon docs updated: `docs/2-architechture-system.md` (job registry), `docs/0-wiki.md` changelog, ADR for the registry decision

## Open Questions / Accepted Risks

- Stall threshold 30 s — owner: DELIVER; verify on real-Chrome with large files, tune if slow FileReader trips it.
- `deleteResourceCascade` idempotency on partial delete — owner: DELIVER; verify in unit tests (AC-13).
- `chrome.storage.session` write failure degrades to in-memory jobs — accepted, logged (AC-14).
- Unbounded terminal rows in session storage — accepted; revisit if quota noise appears.
- `isVoicePackDownloaded()` takes no language arg today — signature extension noted for when languages pluralize.
