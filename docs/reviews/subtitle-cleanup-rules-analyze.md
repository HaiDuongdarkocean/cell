# Analyze review: subtitle-cleanup-rules

> Mode: all → fresh-context audit by `subagent_explore` (this file records its findings + resolutions).

## Audit summary

All `file:line` citations verified against the codebase — every one is real. Scope boundaries, stakeholder table, and the dirty-file route-around confirmed viable (in fact under-specified: `SubtitlePanels` already calls `loadStudyModeState()` + subscribes `useStudyModeStore`, and `SubtitlePanel` already uses `getStorage`/`setStorage` in content-script context — no new plumbing needed for the settings side).

## Findings applied to the intent doc

1. **Mechanism error (fixed):** `(MUSIC)`-only cue does not produce a 0-blank exercise — `SOURCE_TOKEN_REGEX` strips parens → `["MUSIC"]` → a 1-blank exercise on an unspoken answer. N3/AS-IS-3 corrected; the need is understated, not wrong.
2. **Missed surface — overlay tokenize (fixed):** `subtitleTokenizeController` rebuilds the overlay line DOM from raw `cue.text` (`bindLine` :151, staleness check :237-246). Per-surface cleaning would leave raw text re-inserted on the most interactive surface. Resolved by adopting **cue-ingestion boundary cleaning** as the design (N8 + Scope): `cuesStore.setCues` stores cleaned `text` + `rawText`; every downstream consumer — including dirty files — reads cleaned text through the fields it already reads.
3. **Missed risk — pause soft-lock (fixed):** `enterCue` skips only raw-empty cues (`studyModePlaybackController.ts:162`) → a cleaned-empty cue would reach `pausedEnd`/`waiting` with practice input + nav all disabled. Boundary cleaning resolves it (the check sees cleaned text); added to N8, Journey TO-BE-3, Risks.
4. **Migration trap (fixed):** `migrateStudyModeState.ts:91-93` — `version < CURRENT_VERSION` resets to INITIAL (wipes `activeModeId` + `customModes`). Scope now pins "unchanged schema version"; `removeBracketed` stays on the type as a derived field for the dirty call site `reactSubtitleController.ts:583`.
5. **Side-panel second store (added to risks):** broadcast stays raw; each context re-derives at its own intake via the same SSOT helper — SPECIFY must nail down where the side-panel intake is.
6. **N8 split (applied):** Ctrl replay → N9; width cap → N10.
7. **Noted for SPECIFY (not doc changes):** `mediaScoreSource` tokenizes raw cues (boundary cleaning fixes free); Anki `initialDraft`/`cardCreatorBridge` read raw `cue.targetText` — Out stands but becomes an explicit spec decision (boundary cleaning makes cards inherit cleaned text — defensible: users learn spoken text); `pauseOnUnknown` probe offsets become cleaned-relative (consistent); pre-existing bug `PlayerModeOverlay.tsx:552` renders `SubtitleBlock` without `removeBracketed` — boundary cleaning fixes it for free.

## Verdict

All findings incorporated into the intent doc; decision stays **go**.

VERDICT: APPROVE
