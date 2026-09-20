# ADR: Subtitle Cleanup Rules — Module Layering and Runtime Sync

**Date:** 2026-09-21
**Status:** Accepted

## Context

The subtitle-cleanup-rules feature needs pure rule logic (`BUILTIN_CLEANUP_RULES`, `applyCleanupRules`, `resolveCleanupRules`, sanitize/validate/fingerprint helpers) reachable from two features: `features/subtitle` (intake seams, panel derivation) and `features/studyModes` (settings UI, migration, rule CRUD ops).

The repo's dependency baseline already allows `subtitle → studyModes` edges (`contentScriptController` → `studyModeController`, `reactSubtitleController` → `subtitleStudyModeController`), but a new `studyModes → subtitle` edge would close a feature cycle and fail `check-feature-cycles`.

Additionally, study-mode replay needs a `cueLeadInMs` lead-in that lands the seek in the *prior* cue — so the intended cue's SRT `index` must travel with the seek (`cueSeq`) through playback actions, `SEEK_TO`, and `SHORTCUT_ACTION` payloads, and foreign cue entries must be suppressed while the seek is in transit.

## Decision

1. **Pure cleanup logic lives in `entities/studyMode/cleanupRules.ts`** — next to the `SubtitleCleanupRule`/`CleanupRulesSetting` types it operates on. Both features import entities (leaf layer); no feature-level edge is created.

2. **Seek-intent marker lives in `shared/lib/cueSeekIntent.ts`** — a tiny stateful module (`mark`/`take`/`clear`) usable by subtitle UI, content-script message handlers, and study-mode controllers without creating feature edges.

3. **Runtime registry stays in `features/subtitle/logic/subtitleCleanupRuntime.ts`** — it owns `cleanTargetCues`/`recleanRegistered` and the WeakMap/WeakRef cue-array cache because it needs `useCuesStore` (subtitle-owned). Instead of callers pushing rules (`studyModeController.setCleanupRules`), the runtime **self-subscribes to `useStudyModeStore`** on first `cleanTargetCues` call — this preserves the sanctioned `subtitle → studyModes` direction and removes the need for every intake context to wire sync manually.

4. **Intent consumed in `SubtitleStudyModeController`** — `onSeeking` pulls a fresh intent marker into `pendingCueSeq`; `enterCue` is suppressed until the intended cue's SRT `index` is observed or the intent ages out (250 ms), preventing soft-locks when a lead-in seek lands in an earlier cue.

## Consequences

- `studyModes` never imports `features/subtitle` — the cycle check stays green and the baseline edge direction is unchanged.
- `entities/studyMode/index.ts` re-exports the cleanup module; deep-import baseline shrank by one stale pair (`SubtitlePanels` no longer deep-imports `studyModeStore`).
- `cleanupRules`/`cueLeadInMs` are optional fields on `StudyModeAdvancedSettings` — migration seeds them, so in-flight test fixtures owned by other pipeline items keep compiling.
- i18n for the rules UI lives in `features/studyModes/lib/cleanupRuleMessages.ts` (en/vi) — interim debt until `shared/i18n/messages/*.json` are unblocked by the `subtitle-bulk-status` item.
