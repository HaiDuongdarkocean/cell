# Sign-off Review — durable-job-registry

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/durable-job-registry.md` — long-running Settings jobs must survive panel close, sender death, and SW restart; owner-approved direction (generic registry, not sync-coupled)
- Spec: `docs/specs/durable-job-registry.md` — spec review APPROVE_WITH_CHANGES, all findings applied
- Design: `docs/intent/durable-job-registry-design-brief.md` + component mapping — owner selected Concept A (inline rows inside the owning Settings card)
- Verify: `docs/reviews/durable-job-registry-verify.md` — fresh-context review VERDICT: PASS; five weak spots found and fixed before commit (local retry mints fresh jobId, localized `interrupted-*` codes, serialized boot restore→orphan-sweep ordering, `public/options.js` migrated to `JOB_EVENT`, spec deviations on keep-alive interval + dismiss-unknown)

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:unit` — 622/622 suites, 7470/7470 tests
- `npm run build` — pass
- Feature-cycle / deep-import checkers — clean (jobs barrel added)
- Browser (real Chrome clone, `tmp/durable-jobs/verify.mjs`) — 11/11 × 2 on the final build: `JOB_LIST`, import→done + persisted `TihokaJob:*` + card + inline row, row survives reopen, dismiss, delete cascade job, signature dedupe
- Post-ship adversarial re-review — second fresh-context pass returned FAIL; all majors fixed (boot readiness gate `whenJobsReady`, localized error announcements, `useJobs` stale-snapshot merge, per-resource orphan matching, `indexedDB.databases()` language coverage) and re-verified — see `durable-job-registry-verify.md` §Round 2

## Business acceptance

- Closing the Universal Panel no longer kills or hides dictionary/frequency imports, resource deletes, TTS voice downloads, or local-audio index builds — work continues in the background and every reopened surface rebuilds the same truth via `JOB_LIST`/`JOB_EVENT`.
- Completion effects (`downloadedLanguages`, `lastIndexedAt`, `installationFinished`) are written by the background owner — a dead caller can no longer leave "worked but unstamped" state.
- SW restart leaves honest state: persisted running jobs reconcile to `done`/`interrupted` via durable output, orphaned `installationFinished=false` resources roll back, owed effect stamps are retried.
- Upload-phase failures surface as `interrupted` with retry/re-import guidance instead of phantom spinners.

## Accepted residual risks

Recorded in `durable-job-registry-verify.md` §Residual notes — session-tier rows are lost on full browser close (honest bound; durable flags cover recovery), and `isVoicePackDownloaded()` is language-agnostic until packs pluralize.
