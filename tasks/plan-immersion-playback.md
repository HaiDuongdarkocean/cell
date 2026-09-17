# Plan — immersion-playback

Spec: `docs/specs/immersion-playback.md` · Backlog #1

| # | Task | Files | Verify |
|---|---|---|---|
| 1 | Entities + migration: `pauseOnUnknown`, `unknownScope`, `popupOnAutoPause`, `popupCloseOnResume`; version 1→2; ShortcutAction `'next-unknown-cue'` + default key `'n'` | `entities/studyMode/{types,constants}.ts`, `migrateStudyModeState.ts`, `entities/settings/types.ts`, `shared/config/config.ts` | unit: migrate v1 → defaults |
| 2 | Unknown map builder: `resolveUnknownCueMap(cues, langCode, scope) → Map<idx, term>` (reuse resolveCueListTokenMetadata) + `findNextUnknownCue` | `features/studyModes/lib/unknownCueMap.ts` (+test) | unit: scope FREQ_LIST vs ALL |
| 3 | Controller: inject `UnknownCueProbe`, apply khi step.pause='none' → START/END pause; emit `{type:'autoPause', term, cueIndex}` | `studyModePlaybackController.ts` (+test) | unit: A1–A5, A8 |
| 4 | Seam: `SubtitleStudyModeController` pass probe; track autoPause action | `subtitleStudyModeController.ts` | unit |
| 5 | Wiring: composition root resolve map khi enabled; `autoPause` → `onOpenDictionary`; closeOnResume → đóng khi `play`; wordStatus change → update map | content-script composition (`subtitle` feature) | typecheck |
| 6 | Shortcut: dispatch `next-unknown-cue` → seek `findNextUnknownCue` | `contentScriptKeyboard.ts`, `contentScriptMessages.ts`, settings shortcut group | unit: handleShortcutKey |
| 7 | UI: PracticeOptions advanced section (4 options, conditional visibility) + i18n en/vi | `PracticeOptions.tsx`, messages | unit/render |
| 8 | Gates + docs: typecheck, lint, unit, build; update `docs/2-architechture-system.md`; backlog → shipped; wiki changelog | — | all green |

Deps: 2 → 3 → 5; 1 trước mọi thứ. 6 ∥ 7.
