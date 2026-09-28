# Intent: Durable background job registry — Settings-triggered long-running operations survive panel close, SW restart, and record their own results

> Slug: `durable-job-registry` · Mode: interactive · Source: user statement (this thread: "tiến trình nạp từ điển hay quá trình nào đó trong quá trình làm mà tôi đóng universal panel thì sẽ bị ngắt kết nối và khi mở ra sẽ không còn thấy nó nữa" + "cùng với các tính năng tải nạp, download hay xóa khác" + "audit tất cả các tính năng có liên quan ở trong settings")
> ui_surface: yes          ← job rows with status/retry are user-visible state in Resources + Audio panels
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | When a user triggers a long-running operation from Settings (dictionary/frequency import, resource delete, TTS voice-pack download, local audio DSL index build) and closes the Universal Panel mid-run, the operation either dies silently, keeps running invisibly, or completes but never records its result — reopening the panel shows nothing. | User statement (this thread); `pendingImports` in-memory map + 10-min TTL in `src/entrypoints/background/handlers/resources.ts`; progress pushed to dead `tabId` via `sendTabMessage`; `resourceClient.ts` upload loop owned by the panel context; TTS `downloadedLanguages` written in the panel's `onSave` after `TTS_DOWNLOAD_VOICE` resolves (`src/features/tts/ui/TtsLanguagePanel.tsx`); `lastIndexedAt` stamped post-response in `src/features/pronunciation/ui/LocalPronunciationSettingsPanel.tsx:121-128` | high |
| Change | Job state owned by the requester/panel (in-memory maps, sender-scoped progress channels, caller-side result writes) → a background-owned durable job registry: every long-running Settings operation registers as a first-class job record, progress/lifecycle broadcast to any open UI, completion results written by the job owner (background), and interrupted state honestly reported on reopen. | Audit of all 12 Settings cards (this thread): media `downloadQueue` already proves the pattern — `chrome.storage.session` persistence + `performSessionRestore` + `GET_DOWNLOAD_PROGRESS` pull in `src/entrypoints/background/handlers/download.ts`, `src/entrypoints/background/helpers.ts` | high |
| Solution | Direction: one generic `JobRegistry` in the background (job record `{id, kind, label, status, progress, error, resumable, timestamps}` persisted to `chrome.storage.session`, `JOB_LIST`/`JOB_EVENT`/`JOB_DISMISS`/`JOB_ACTION` message surface, boot-sweep marking stale running jobs `interrupted`, SW keep-alive while jobs run, orphan cleanup via existing `rollbackImport`) — not a refactor of the already-durable media `downloadQueue`. | `importFile` already has full rollback (`src/features/dictionary/logic/importOrchestrator.ts`); keep-alive pattern exists (OffscreenManager, ADR-106); sync obligations/checkpoints demonstrate "persist before mutate" in this codebase | high |
| Value | Closing the panel stops being a data-integrity hazard: no more silent-dead imports, no invisible long deletes, no voice packs downloaded but unregistered, no phantom "not indexed" state. Reopening Settings shows exactly what is running/interrupted/done — the same guarantee media downloads already give. | User statement: "tôi muốn một cơ chế có thể giải quyết vấn đề này" + scope extension to "tải nạp, download hay xóa khác" | high |
| Stakeholder | Anh (owner, primary user) importing multi-dictionary sets and voice packs; downstream: every learner on MV3 where the SW can be killed mid-job. | User is active tester on real Chrome; persona RAM ≥1GB (`AGENTS.md`) | high |
| Context | Chrome MV3: service worker dies when idle (IDB writes do not reset the idle timer); message channels outlive neither sender nor receiver; Firefox port runs offscreen work in-process. Job state must live where neither panel nor requester lifecycle can kill it — `chrome.storage.session` survives SW restarts and self-cleans on browser close. | ADR-106 offscreen keep-alive precedent; `downloadQueue` session-persistence precedent; audit findings this thread | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainer + agents | One job abstraction covering import/delete/voice/index, not N bespoke progress channels | `downloadQueue` gives the persistence+restore template; `rollbackImport` gives cleanup; message registry/schema patterns established |
| Customer | Learner importing dictionaries, downloading voice packs, indexing audio packages | Close the panel without fear; reopen and see truth; retry or discard interrupted work | Panel reopen must rebuild state from `JOB_LIST`, not from sender-scoped events |
| Supplier/Dependency | Chrome storage.session, runtime messaging, offscreen documents | Job events must reach every open surface; offscreen TTS work needs a registry-visible lifetime | Broadcast events + pull-on-mount covers fan-out; offscreen document lifetime managed via existing OffscreenManager |
| Organization | Future contributors | New long-running operations register into the registry instead of inventing channels | `kind` enum + JOB_ACTION descriptor is the extension seam |
| Regulator | Chrome Web Store policy | none — no new permissions (storage.session already used) | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | A long-running Settings operation must not silently die when its initiating surface closes — it either completes, or the system records that it was interrupted | F, R | `pendingImports` orphans when chunk sender vanishes (`resources.ts`); user statement | high |
| N2 | Reopening the panel must show the operation's current truth — running progress, done result, failed error, or interrupted — without having been open to receive events | F, U | No `JOB_LIST`-equivalent exists today for resource ops; `GET_DOWNLOAD_PROGRESS` is the model | high |
| N3 | A job's completion result must be recorded by the job owner (background), not by the caller that happened to start it — closing the caller must not lose `downloadedLanguages`/`lastIndexedAt`-style writes | F, R | TTS `onSave` after response (`TtsLanguagePanel.tsx`); DSL `lastIndexedAt` stamp (`LocalPronunciationSettingsPanel.tsx:121-128`) | high |
| N4 | The background must stay alive for the duration of an active job — MV3 idle-kill must not leave half-written IndexedDB state | R | SW idle-kill precedent; keep-alive already used for offscreen path (ADR-106) | high |
| N5 | Interrupted jobs must leave honest, recoverable state — partial resources rolled back or listed for cleanup, not `installationFinished=false` rows drifting forever | F, +data | `installationFinished` flag + `rollbackImport` exist (`importOrchestrator.ts`) | high |
| N6 | The registry must be generic — new job kinds (voice download, index build, future model downloads) plug in via `kind`, not new plumbing | +infra | User scope: "cùng với các tính năng tải nạp, download hay xóa khác" | high |
| N7 | Already-durable pipelines (media `downloadQueue`, sync obligations/checkpoints) must not be rewritten — registry serves processes that lack a durable home | — `[constraint]` | `downloadQueue` session persistence + restore (`helpers.ts`); sync obligation model | high |
| N8 | Done/failed/interrupted jobs stay listed until the user dismisses them — a completed job is a notification, not a memory | U | `[assumption]` consistent with download-queue UX precedent | medium |

## Scope

- **In:**
  - `JobRegistry` module in the background: job record schema, `chrome.storage.session` persistence, throttled progress writes, boot-sweep (`running`/`uploading` → `interrupted`), retention until dismissed.
  - Message surface: `JOB_LIST` (pull on mount), `JOB_EVENT` (broadcast to all contexts), `JOB_DISMISS`, `JOB_ACTION` (retry/cleanup where supported) — typed through entities/message + registry + schema validation.
  - `kind` set at ship: `resource-import`, `resource-delete`, `voice-download`, `local-audio-index`.
  - Resource handlers detached from sender: chunk-accumulation completion registers the job and returns `{jobId}` immediately; import/delete runs independently of the sender; upload stall detection (`uploading` without chunks → `interrupted`).
  - SW keep-alive pin while any job is running (ADR-106 pattern).
  - Orphan sweep on SW boot: `installationFinished=false` resources → `rollbackImport`; DSL index present but `lastIndexedAt=null` → re-stamp, not rebuild.
  - Completion writes moved to the job owner: TTS `downloadedLanguages`, DSL `lastIndexedAt` recorded in background on job success.
  - UI: ResourcesPanel/Audio panels rebuild job rows from `JOB_LIST` on mount, subscribe to `JOB_EVENT`, render interrupted/done/failed with retry/dismiss actions; i18n en/vi.
  - Unit tests + real-Chrome verification.
- **Out:** refactoring media `downloadQueue` into the registry (it is already durable — mirror/adapter into a unified task center only if later requested); resumable upload of file chunks (File objects cannot cross contexts — interrupted uploads restart from the beginning); OCR/model downloads (lazy first-use in the OCR pipeline, not Settings-triggered — registry accepts them as future kinds); local-player library scoring (page-lifetime derived computation by design); any UI "task center" aggregating all job sources.
- **Non-goals:** not a general job scheduler/queue with priorities; not cross-device job sync; not making panel-closed uploads magically continue (impossible — honest `interrupted` state instead).

## Workflow

The user opens Settings → Resources and drops a dictionary file. The panel streams chunks to the background, which accumulates them and — on the final chunk — registers a `resource-import` job, persists it, and returns `{jobId}` immediately. Parsing, insertion, and index building run under a SW keep-alive pin; progress lands in the registry and broadcasts to every open surface. The user closes the panel mid-parse: the job keeps running. Reopening Settings → Resources pulls `JOB_LIST` and renders the same row live. If the SW was killed mid-parse, boot-sweep marks the job `interrupted`, orphan-sweep rolls back `installationFinished=false`, and the row offers retry. A TTS voice-pack download kicked from Audio settings runs in offscreen; on completion the background writes `downloadedLanguages` itself — closing the panel no longer loses the result.

## Journey

### AS-IS

1. User starts a dictionary import; chunk upload is owned by the panel — closing it orphans the upload (10-min TTL) with no visible failure.
2. Import parsing reports progress to the original `tabId`; panel closed → progress gone, job invisible.
3. SW can idle-die mid-parse → resource row stuck `installationFinished=false` with entries already written — silent corruption.
4. Reopening Settings shows nothing about what ran, failed, or finished.
5. TTS voice download completes in offscreen, but `downloadedLanguages` is written by the panel's post-response code — close the panel and the pack exists while settings say it does not.
6. DSL index build finishes in background, but `lastIndexedAt` is stamped by the caller — reopened settings show "not indexed" and the user rebuilds.

### TO-BE

1. Every long-running Settings operation registers a durable job; the initiating UI is an observer, not the owner.
2. Panel closed mid-run → job continues under keep-alive; SW restart → job marked `interrupted`, partial data rolled back, row offers retry/dismiss.
3. Reopening Settings → `JOB_LIST` rebuilds the rows — running progress live via `JOB_EVENT`, done/failed/interrupted persisted until dismissed.
4. Completion results (`downloadedLanguages`, `lastIndexedAt`, `installationFinished=true`) are written by the job owner — caller death cannot lose them.
5. Media downloads and sync keep their existing durable pipelines — the registry serves only processes without one, via `kind` extension.

## Stories

- S1: As a learner importing dictionaries, I want closing the panel to never corrupt or vanish my import — done when an import either finishes or is marked interrupted with rollback, and reopening shows its truth.
- S2: As a learner, I want to see what ran while the panel was closed — done when reopening Settings lists running/done/failed/interrupted jobs without having been open.
- S3: As a learner, I want an interrupted job to offer a clear next step — done when interrupted rows offer retry (from the beginning) or dismiss, never a ghost "running" state.
- S4: As a learner downloading a voice pack, I want the completion to register even if I closed Settings — done when `downloadedLanguages` updates regardless of caller lifetime.
- S5: As a maintainer, I want future long-running operations to reuse the registry — done when adding a job kind requires no new messaging/persistence plumbing.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Keep-alive pin masks legitimate SW shutdown and burns battery | operational | Chrome flags extension; wasted cycles | Good — pin only while jobs active, release on last job terminal; existing OffscreenManager pattern |
| Boot-sweep marks a job interrupted that was actually completing | internal | false "interrupted" UX | Good — sweep only runs at SW start (by construction the prior SW's work is dead); finalize writes are transactional |
| Chunk-upload stall threshold (30s) false-positives on slow file reads | internal | healthy upload marked interrupted | Medium — timer resets per received chunk; threshold tuneable |
| Registry write amplification (progress updates every tick to storage.session) | performance | storage churn, quota noise | Good — throttle to ~500ms + terminal-state writes, same as downloadQueue |
| Dual job sources during migration (old progress channel + registry) drift | internal | inconsistent UI rows | Good — cut over per-kind; registry is the only row source once migrated |
| `chrome.storage.session` unavailable/behavior differs in some contexts | external | persistence silently absent | Medium — in-memory fallback keeps event flow; degrade to today's behavior, not worse |

## Decision

go — three distinct defect classes (silent death, invisible run, lost result-write) are evidenced in code; the durable-queue pattern already exists and passes in production for media downloads; the user has confirmed scope (imports, deletes, voice downloads, index builds) and direction.

## Draft Acceptance Criteria

- [ ] Starting a dictionary/frequency import and closing the panel mid-parse: reopening Settings shows the job's live progress or its terminal state; no orphaned `installationFinished=false` remains after SW restart (rollback ran).
- [ ] Closing the panel mid-chunk-upload marks the job `interrupted` within the stall window — visible on reopen with retry/dismiss, not a stuck "uploading" row.
- [ ] `JOB_LIST` on mount returns all non-dismissed jobs; `JOB_EVENT` reaches multiple open surfaces identically.
- [ ] TTS voice-pack completion writes `downloadedLanguages` even when the initiating panel was closed before the response.
- [ ] DSL index completion stamps `lastIndexedAt` from the background; a built index without a stamp self-heals (re-stamp, no rebuild).
- [ ] Media `downloadQueue` and sync pipelines untouched (no regression in their tests).
- [ ] `npm run typecheck && npm run test:unit && npm run build` green; real-Chrome verify: import → close panel → reopen shows running/done truth.
