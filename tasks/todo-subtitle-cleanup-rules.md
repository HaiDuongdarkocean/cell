# Todo: subtitle-cleanup-rules

Ordered checklist. `depends` = slice numbers from `tasks/plan-subtitle-cleanup-rules.md`.

## Slice 1 — Pure cleanup core (P0)

- [ ] `src/features/subtitle/logic/subtitleCleanup.ts`: `SubtitleCleanupRule`, `CleanupRulesSetting`, `BUILTIN_CLEANUP_RULES` (10 ordered rules per spec REQ-5), `DEFAULT_CLEANUP_RULES_SETTING`, `resolveCleanupRules`, `cleanupRulesFingerprint`, `validateCleanupPattern` (gmu compile), `applyCleanupRules` (per-rule try/catch, repeatUntilStable ≤3, normalization post-pass).
- [ ] `src/features/subtitle/logic/subtitleCleanup.test.ts`: rule order, brackets nesting ≤3 passes + orphan openers, speaker-label/dash/chevron/music/html/controls, post-pass punctuation residue, `-(CHUCKLES)` + `-OWNER:` motivating case, invalid regex skipped.

## Slice 2 — Types + migration (P0, depends 1)

- [ ] `entities/studyMode/types.ts`: `SubtitleCleanupRule`, `CleanupRulesSetting`, `StudyModeAdvancedSettings.cleanupRules` + `cueLeadInMs`.
- [ ] `entities/media/types.ts`: `SrtCue.rawText?`, `BilingualCue.rawTargetText?`.
- [ ] `migrateStudyModeState.ts`: sanitize `cleanupRules` (builtinEnabled map + custom shape/caps/dedupe, malformed→default), `cueLeadInMs` int clamp 0–2000; seed `builtinEnabled.brackets` from legacy `removeBracketed`; version stays 1.
- [ ] Extend `migrateStudyModeState.test.ts`: defaults on absent, malformed blob → defaults, custom sanitize (caps 50/500/80, bad pattern rejected or kept-but-disabled per spec — check spec: sanitize drops malformed rule entries), legacy `removeBracketed` → `brackets` enabled state, `cueLeadInMs` clamp.

## Slice 3 — Runtime (P0, depends 1,2)

- [ ] `subtitle/logic/subtitleCleanupRuntime.ts`: WeakRef<SrtCue> registry; `cleanTargetCues` (new objects, `rawText` preserved, idempotent, registers); `recleanRegistered` (in-place `.text` rewrite via mutable view); lazy `chrome.storage.onChanged` STUDY_MODES listener + initial load; fingerprint diff; `getResolvedRules`; `onCleanupRulesChanged`.
- [ ] `videoTokenMap.ts`: module-level WeakRef instance registry + `invalidateVideoTokenMaps()` (calls `map.clear()` on live instances).
- [ ] `cuesStore.ts`: `recleanTargetText(rules)` — maps `targetCues` to fresh objects re-derived from `rawText`, preserves active indices; subscribe to `onCleanupRulesChanged`.
- [ ] Unit test runtime: register→rule change→in-place update; store reclean preserves `targetActiveIndex`.

## Slice 4 — Intake seams + merge + schema (P0, depends 3)

- [ ] `subtitleAutoLoad.ts`: `cleanTargetCues` on target before `loadBilingualCues`/`onPanelRender`/`onStartTranslatePrefill`.
- [ ] `contentScriptFileImport.ts`: clean `targetCues` (:91) + fallback `parsed[0].cues` (:98).
- [ ] `contentScriptSelection.ts`: target branches :45, :88, :145, :290; OCR re-activation :207 (`cleanTargetCues(slot.cues)`); translated re-push :217.
- [ ] `contentScriptLifecycle.ts`: OCR bridge — local `targetCues = cleanTargetCues(d.targetCues)` for all consumers in block; `ocrTargetSlot.cues` stays raw.
- [ ] `contentScriptMessages.ts`: `loadBilingualCues`/`loadCues` adapters (:245-246) wrap target with `cleanTargetCues` (defense-in-depth).
- [ ] `useSubtitleEngine.ts` (local-player): clean `targetCues` in `loadCues` before engine calls.
- [ ] `subtitleMerge.ts`: emit `rawTargetText: target.rawText ?? target.text` on both branches.
- [ ] `PlayerView.tsx`: `buildBilingualCues` propagates `rawTargetText`.
- [ ] `entities/message/schema.ts`: `bilingualCueSchema.rawTargetText?`; `SeekToPayloadSchema.cueSeq?`; `ShortcutActionPayloadSchema.seekTime?`.
- [ ] `entities/message/types.ts`: `BilingualCue` broadcast type parity — `SeekToPayload.cueSeq?`, `ShortcutActionPayload.seekTime?` (check for a broadcast cue type too).

## Slice 5 — Surfaces (P0, depends 4)

- [ ] `SubtitleBlock.tsx`: `hasTargetCue`/`hasNativeCue` gate on non-empty effective text; legacy `removeBracketedText` applies to native line only.
- [ ] `SubtitlePanel.tsx`: display-cue re-derivation `targetText = applyCleanupRules(rawTargetText ?? targetText, rules)` memoized on cues + `useStudyModeStore` cleanupRules fingerprint; `visibleCues`/`practiceCues` filter on derived text.
- [ ] Unit test: merge preserves rawTargetText; panel derivation drops cleaned-empty rows.

## Slice 6 — Lead-in + cue intent (P0, depends 2,4,5)

- [ ] `subtitle/logic/cueSeekIntent.ts`: `markCueSeekIntent(cueSeq)`, `peekCueSeekIntent`, `clearCueSeekIntent`.
- [ ] `studyModePlaybackController.ts`: `PlaybackAction seek` gains `cueSeq`; `cueStartMs()` sites + skip + JUMP emit `start - cueLeadInMs` clamped ≥0 with `cueSeq`.
- [ ] `subtitleStudyModeController.ts`: `pendingCueSeq` — internal seeks via `trackInternalSeek(action.cueSeq)`; external via `peekCueSeekIntent` merge per tick; observed-match clear; foreign-cue `enterCue` suppression (update `lastTargetIndex`, skip enter); lifecycle resets (`applyStudyMode`/`setCues`/`clearCues`/`destroy`); `onSeeking` — marked seek ≤250ms keeps intent (still aborts chain), otherwise clears.
- [ ] `SubtitlePanel.tsx`: `emitPracticeSeek` — resolve target from `practiceCues`, `markCueSeekIntent(target.index)`, `onReplayCue({...target, start: max(0, start-leadIn)})` or `onSeek` fallback; prev/next route through replay seam; last-cue-next and first-cue-prev edges delegate to injected handlers.
- [ ] `App.tsx`: `seekAndResume(timeMs, cueSeq?)`; `handleReplayCue` passes `cue.index`.
- [ ] `sidePanelRelay.ts`: SEEK_TO forwards `cueSeq`; SHORTCUT_ACTION forwards full parsed payload (seekTime fix).
- [ ] `contentScriptMessages.ts`: SEEK_TO handler calls `markCueSeekIntent(payload.cueSeq)` when present.
- [ ] Unit tests: lead-in arithmetic + clamp at each emit; pending-intent suppress/clear/match; relay forwarding.

## Slice 7 — Practice (P1, independent)

- [ ] `SubtitlePractice.tsx`: Ctrl-tap state machine (keydown→pending, other-keydown→cancel, keyup-pending→`onReplay`, `e.repeat` ignored, Meta excluded, blur/Escape cancel, Ctrl+C/V safe); keep Ctrl/Cmd+R; legend → `Ctrl`.
- [ ] `SubtitlePractice.module.css`: remove `60ch` cap in `@container (min-width: 768px)`.
- [ ] Unit test: chord cancels; Ctrl+R still fires; Ctrl+V does not replay.

## Slice 8 — Advanced UI (P0, depends 1,2)

- [ ] `studyModes/ui/SubtitleCleanupRules.tsx` + `.module.css`: ordered builtins→customs rows (Toggle md, name/desc/pattern-ellipsis + title, built-in tag), Add rule dialog (name/desc/pattern, live validation incl. dup/empty/caps/regex-compile, Save disabled while invalid), delete confirm Dialog, custom cap 50; wired to `useStudyModeStore.setAdvanced` read-modify-write.
- [ ] `StudyModesTab.tsx`: replace `removeBracketed` Checkbox with `<SubtitleCleanupRules>` + `SliderRow` lead-in (0–2000 step 50, `${v} ms`); keep legacy checkbox? No — spec replaces it; `removeBracketed` still persisted via derived field (see migration).

## Slice 9 — Gates + ship (P0, depends all)

- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build`
- [ ] Real-Chrome verify (`testing-extension-browser`): toggle rule → overlay/tokenize/panel/practice update; `(CHUCKLES)`+`OWNER:` gone from dictation; lead-in replay onset; Ctrl tap.
- [ ] `docs/reviews/subtitle-cleanup-rules-verify.md` — fresh-context review, ends `VERDICT: PASS`.
- [ ] Delete `src/entrypoints/mockup-subtitle-cleanup-rules/` + `tmp/subtitle-cleanup-rules-design/`.
- [ ] Docs: `docs/2-architechture-system.md` deferred (dirty-owned); note in verify artifact. ADR for clean-at-intake architecture + cue-intent module.
- [ ] Record learnings; `pipeline-state transition → shipped`.
