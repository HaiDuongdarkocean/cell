# Plan: subtitle-cleanup-rules

Spec: `docs/specs/subtitle-cleanup-rules.md` · Design: `docs/intent/subtitle-cleanup-rules-design-brief.md` + `…-component-mapping.md` · Stage: deliver · Mode: all · ui_surface: yes

## Architecture recap

Raw target cues are cleaned **upstream of the cue engine** at every intake seam (all in clean files). Cleaned `SrtCue` objects carry `{ text: cleaned, rawText: original }` and fan out as shared refs to engine, `latestTargetCues`, tokenize, playback, panel merge, broadcast, practice — dirty-owned consumers get cleaned text for free. Rule changes re-derive via a per-context WeakRef registry that mutates `cue.text` in place from `rawText`; React stores re-render through `useCuesStore.recleanTargetText`; tokenize's prepared-cue cache is invalidated via a clean-module registry (`invalidateVideoTokenMaps`). The side panel re-derives from `rawTargetText` + its own `useStudyModeStore` subscription.

Lead-in is subtracted **once at each emission site**; transports stay dumb. Intended-cue identity (`cueSeq` = SRT `index`) rides on seek actions/payloads and suppresses foreign `enterCue` while pending.

## Worktree constraints

Dirty (do not touch): `CueList.tsx`, `contentScriptController.ts`, `reactSubtitleController.ts(+test)`, `subtitleCueEngine.ts`, `subtitleTokenizeController.ts(+test)`, `en.json`/`vi.json`, `config.ts`, `docs/2-architechture-system.md`, dictionary/**, `CueList.test.tsx`, `useMenuPlacement.ts`, `entities/settings/types.ts`, `entities/dictionary/*`.

## Slices (ordered, dependency-chained)

| # | Slice | Files | Depends | Verifies |
|---|-------|-------|---------|----------|
| 1 | Pure core: catalog, resolve, apply, validate, fingerprint | `entities/studyMode/cleanupRules.ts` (new) | — | unit test |
| 2 | Types + migration | `entities/studyMode/types.ts`, `entities/media/types.ts`, `studyModes/lib/migrateStudyModeState.ts` | 1 | migrate test |
| 3 | Runtime: registry + reclean + storage listener; store + tokenize invalidation | `subtitle/logic/subtitleCleanupRuntime.ts` (new), `tokenize/logic/videoTokenMap.ts`, `subtitle/cuesStore.ts` | 1,2 | unit test |
| 4 | Intake seams + merge + broadcast schema | `subtitleAutoLoad.ts`, `contentScriptFileImport.ts`, `contentScriptSelection.ts`, `contentScriptLifecycle.ts`, `contentScriptMessages.ts`, `useSubtitleEngine.ts`, `subtitleMerge.ts`, `PlayerView.tsx`, `entities/message/schema.ts`, `entities/message/types.ts` | 3 | typecheck |
| 5 | Surfaces: empty gates + panel re-derivation | `SubtitleBlock.tsx`, `SubtitlePanel.tsx` | 4 | unit/RTL where feasible |
| 6 | Lead-in + cue intent | `shared/lib/cueSeekIntent.ts` (new), `studyModePlaybackController.ts`, `subtitleStudyModeController.ts`, `SubtitlePanel.tsx`, `App.tsx`, `sidePanelRelay.ts`, `contentScriptMessages.ts`, `entities/message/*` | 2,4,5 | unit tests |
| 7 | Practice Ctrl-tap + full-width input | `SubtitlePractice.tsx`, `SubtitlePractice.module.css` | — | unit test |
| 8 | Advanced UI: rules manager + lead-in slider | `studyModes/ui/SubtitleCleanupRules.tsx` (new), `SubtitleCleanupRules.module.css` (new), `StudyModesTab.tsx` | 1,2 | browser verify |
| 9 | Gates + docs + ship | verify artifact, delete mockup, pipeline transition | all | npm gates + real Chrome |

## Parallelization

In-session slices (overlapping dirty-file blast radius makes subagent lanes unsafe). Slices 7 and 8 are independent of 3–6 and of each other; 5 needs 4; 6 needs 2+4.

## Acceptance map (spec SC → slice)

- SC-1/2/3 (rules manage/persist/apply): slices 1,2,3,8
- SC-4/5 (uniform cleaned text, all surfaces): slices 3,4,5
- SC-6 (empty cues hidden, no soft-lock): slices 4,5
- SC-7 (built-in coverage + legacy seed): slices 1,2
- SC-8 (Ctrl tap replay): slice 7
- SC-9 (full-width input): slice 7
- SC-10/11 (lead-in emission): slice 6
- SC-12/13/14 (wrong-cue suppression): slice 6
- SC-15 (no deps/manifest/version bump, mockup removed): slices 8,9

## Risks

- Tokenize stale prepared-cue cache after reclean → `invalidateVideoTokenMaps()` (module-level WeakRef registry in clean `videoTokenMap.ts`; `bindLine` re-prepares lazily).
- `rawTargetText` stripped by zod → `bilingualCueSchema` gains optional field (required).
- Relay rebuild drops `cueSeq`/`seekTime` → forward parsed payload (fixes pre-existing seekTime drop).
- i18n files dirty → new UI strings are plain literals, matching `StudyModesTab` convention (no `t()` in that file).
