# Spec review — sync-on-use

## Pass 1 (spec v1) — REJECT

Blocker: per-pass provider instances (`syncRuntime.ts:114-117`) void every request budget. Majors: non-atomic throttle, unspecified 2s retry model, "idle: 0" overclaim. Minors: fresh-write retry twin, journalCount drift, REQ-3 wording/unreachable alt, fakeDrive `version`, peek dup-folder reaping, stamping while disconnected, request-count scope, REQ-14 mechanism, non-goals, waiter rejection. → loop 1 back to analyze; intent + spec rewritten.

## Pass 2 (spec v2) — reviewer `spec-reviewer`, fresh context

Pass-1 items verified resolved (REQ-8b, REQ-4, REQ-11, NFR-2, REQ-7, REQ-3, REQ-9 substrate, REQ-5, REQ-14, Boundaries). Verified: GC sweeps never touch `meta/`; disconnect sweep deletes the bell; `resolveChain` never creates; `finalFlush` keeps `healCheck:false`; apply path never re-enters `captureChange` (no echo loop).

Blockers: none.

Major:
1. REQ-4 TOCTOU across the `hasConnections()` await → re-check window after the await; SC-11 warm-seed case.
2. `debouncedFire` evaluates maxWait only on signal arrival → burst tail fires ~1.8s; needs hard deadline timer.
3. `LOOKUP_REQUEST` missing from qualifying set (popup lookups never send `WORD_STATUS_*`).

Minor: REQ-9.4 `write` returns no id; NFR-2 unit mixing; REQ-14 duplicate broadcast via `engine.subscribe`; failed-push retry not re-fired (accepted risk); SC must pin background direct notifier wiring.

## Applied fixes (v2 → v2.1)

- REQ-4 step 4: re-evaluate the 3s window synchronously after `hasConnections()` resolves; SC-11 adds warm-seed concurrent case.
- REQ-2: `debouncedFire` gains a hard deadline timer at `firstAt + maxWaitMs`; SC-2 adds the burst-tail case (fires at 1500ms).
- REQ-3 + SC-12: `LOOKUP_REQUEST` added to qualifying messages.
- REQ-9.4: bell creation uses provider-internal resolve-or-create + multipart create and caches the created `id`.
- NFR-2: changed-check budget expressed in Drive API calls (≈4 per scope list + 1 per journal download).
- REQ-14: note the existing `engine.subscribe` broadcast; fast wrappers must not double-broadcast.
- REQ-2 exception: accepted risk line for failed-push retry cadence.
- SC-1: asserts `wireSyncScheduling` registers the direct notifier (no `sendMessage` for background captures).

VERDICT: APPROVE_WITH_CHANGES
