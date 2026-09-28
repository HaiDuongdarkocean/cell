# Spec review — durable-job-registry

> Reviewer: `spec-reviewer` subagent (BA/PO/TL lenses, fresh context) · Artifact: `docs/specs/durable-job-registry.md` · Against: `docs/intent/durable-job-registry.md`

Three lenses converged independently — no conflicts to arbitrate; TL's code fact-check verified every audit claim in the spec as accurate: `pendingImports` is in-memory with lazy 10-min TTL (`resources.ts:56-64`), progress targets a dead `tabId`, `downloadedLanguages`/`lastIndexedAt` are caller-side writes (`TtsLanguagePanel.tsx:74-78`, `LocalPronunciationSettingsPanel.tsx:121-127`), `rollbackImport` exists (`importOrchestrator.ts:136`), and the boot-sweep mirrors the proven `loadSessionDownloads` interrupted-marking precedent (`helpers.ts:484-490`). The offscreen document does outlive the SW and per-chunk `RESOURCE_IMPORT_CHUNK` messages make the 30 s stall genuinely detectable.

## Majors raised (all spec-text fixable, zero re-architecture)

1. REQ-4 ↔ REQ-5 contradiction — completion-effect retry path unreachable (reconcile only scanned active jobs).
2. Orphan sweep keyed to job records had two holes: session wipe on browser close loses records; throttled persist could lose `resourceId` before SW death — AC-5 unachievable as written.
3. Late-chunk race — a live sender's next chunk after restart could resurrect an `interrupted` upload job.
4. Concurrency/memory bounds (`MAX_CONCURRENT_IMPORTS=2`, `MAX_INFLIGHT_BYTES=256MB`) silently regressed by detached execution.
5. No same-target dedup — concurrent `voice-download{en}` could race OPFS `createWritable`.
6. No Alternatives section.
7. Systemic REQ-field gaps (preconditions/alt/exception/NFR refs).
8. Failure-path AC gaps (`failed` row, `resource-delete` e2e, storage-fail degrade, invalid-retry-params, legacy-channel removal).
9. REQ-11 thinnest at largest scope — no per-kind cutover, "where possible" escape hatch.

Plus 16 minor items (actor-boundary wording, `rollbackImport` signature, `resumable`→`retryable`, per-job session keys, `loadSettings()` freshness, TTS progress correlation by language, terminal-row bound honesty, traceability orphans, Non-goals section, wording tightening).

## Applied fixes

Applied in one pass to `docs/specs/durable-job-registry.md` (2026-09-28):

- REQ-5 now also reconciles `failed` jobs carrying `pendingEffect:true` — retries the completion effect once on boot.
- REQ-6 re-keyed: orphan sweep scans **resource rows** by `installationFinished=false` (durable flag = ground truth); job `resourceId` path kept as fast path; REQ-1 mandates immediate (non-throttled) persist on `resourceId` assignment; `rollbackImport(langCode, resourceId)` signature cited + `RollbackError` handling specified.
- REQ-10 added terminal-job chunk rule: chunks for terminal/unknown `jobId` are rejected → sender aborts, no resurrection.
- REQ-11 restored bounds explicitly: `MAX_CONCURRENT_IMPORTS`/`MAX_INFLIGHT_BYTES` stay in the panel scheduler + registry enforces the active-import cap; per-kind cutover flow + sequencing written out; "where possible" removed; legacy progress channels must be deleted in the same change.
- REQ-1 added dedup rule (`JOB_DUPLICATE` on same kind+identity key) and caller-minted `jobId` explanation.
- New `## Alternatives considered` (extend downloadQueue / storage.local / IDB records / resumable uploads — all rejected with reasons) + explicit `## Non-goals`.
- All 12 REQs backfilled (preconditions/alt/exception/NFR refs).
- `resumable` → `retryable` everywhere; old-terminal-job disposition on retry stated; REQ-7 "non-terminal" wording.
- Data section: per-job session keys (`cellJob:<id>`) + serialized per-job write queue; PendingImport TTL clarified (pre-completion buffering only, lazy reap replaced by stall timer).
- REQ-4 requires fresh `loadSettings()` before each completion write; 0-entry index stamps `lastIndexedAt`.
- Function↔feature map names per-kind surfaces; panel-local `ImportJob` statuses (`duplicate`/`skipped`/`file`/`signature`) stay panel-owned + registry-Job→ImportJob adapter named.
- TTS progress correlates by `params.language` (payload has no jobId); `isVoicePackDownloaded()` signature note recorded.
- Cancel-for-running declared non-goal; cleanup action deferred.
- Traceability: REQ-11 mapped to N3/N6; stories S1–S5 mapped.
- New ACs: AC-12 failed-row path, AC-13 resource-delete e2e + idempotent retry, AC-14 storage-fail degrade, AC-15 legacy-channel removal, AC-16 dedup race.
- Wording tightened: "never phantom" → "present and truthful", "cheap" → "bounded", NFR-5 honest about new Chrome-side code, Firefox partial-OPFS accepted risk recorded.

VERDICT: APPROVE_WITH_CHANGES
