# Plan: Subtitle Panel Dictation and Cloze

## Chosen concept

Reference-console layout: sticky options, compact scrolling cues, active-cue live feedback, sticky shortcut/input/navigation footer. The previous expanded inline-form concept is rejected because it conflicts with the supplied visual source of truth and causes transcript row-height jumps.

## Reuse from interrupted first pass

- Keep and verify pure O(n) normalization/evaluation/cloze logic.
- Keep Study Mode persistence mapping and explicit-cue controller wiring after removing added comments.
- Replace the active-row form, chip/radio mode control, inline cloze inputs, and Check/Reveal action model.
- Rewrite Playwright assertions around live feedback and fixed footer.

## Slices

### Slice 1 — Pure exercise contract

- Correct/test normalization regex and deterministic cloze generator.
- RED then GREEN targeted unit tests.

### Slice 2 — Reference layout

- Rebuild `SubtitlePractice` as options + active-cue presentation + sticky footer/session.
- Keep all input outside cue rows.
- Replace mutually-exclusive switches with `Off | Dictation | Cloze` segmented selection; retain Auto-translate switch and Speed select.
- Implement progressive disclosure by container width: 280–359 input/navigation stack and no shortcut legend; 360–479 compact one-row footer and no legend; 480–767 compact legend with limited cue context; 768+ bounded reading width and full context.
- Verify widths 280/320/360/390/480/768/1024, heights 360/480/568, and effective 80–200% scaling with bounding-box assertions.

### Slice 3 — Shared panel and playback wiring

- `SubtitlePanel` owns header/list/footer composition.
- `CueList` receives only presentational active cue content/masking.
- Reuse the same panel in Player Mode, Split View, and Chrome side panel.
- Thread explicit previous/replay/next, play/pause, and speed actions without inferring cue from current video time.

### Slice 4 — Stress suite

- Rewrite component tests for live feedback/fixed footer.
- Rewrite Playwright happy Dictation, happy Cloze, worst narrow/rapid/wrong, and edge persistence/reset/translation/speed.

### Slice 5 — Product gate

- Typecheck, full unit, build, design audit, targeted Playwright, real Chrome visual verification.
- Compare final screenshot to the supplied reference; fix blocker/major deviations.
- Update architecture/wiki only after verification.
