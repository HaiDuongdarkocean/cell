# Spec: Subtitle Panel Practice — Dictation and Cloze

> Status: implementation-ready
> Extends: `docs/specs/media-study-modes.md`
> Visual interaction reference: `C:\Users\The0cean\Documents\ShareX\Screenshots\2026-09\chrome_taKarvPrmI.png`

## Objective

Turn the shared subtitle panel into an active-practice surface. The panel follows a fixed-header, scrolling-transcript, fixed-footer layout: options remain available at the top, the active cue displays live answer feedback in the transcript, and one persistent answer field with cue controls remains at the bottom.

## Product decision

Use the reference's console model rather than expanding the active cue into a form. The transcript remains the visual result surface; the footer is the only input surface. This preserves reading rhythm, avoids row-height jumps, and keeps controls reachable on a narrow/tall panel.

## Layout contract

### Sticky options header

- First row: `Practice` and one exclusive segmented control: `Off | Dictation | Cloze`.
- Do not represent exclusive modes as independent switches, and do not add Shadowing in this scope.
- Second row: Auto-translate toggle and Speed select (`0.5x`, `0.75x`, `1x`, `1.25x`, `1.5x`).
- Auto-translate controls native cue visibility inside this panel only.
- Speed controls the active video playback rate and is reset/synchronized by the applied Study Mode step.

### Scrolling transcript

- The list is the only scroll container between header and footer.
- The active cue is a compact selected card with an accent edge; it never expands to contain inputs or actions.
- Dictation before typing: target text is replaced with dotted blank guides and native text follows the Translation toggle.
- Dictation while typing: render positional token feedback live in the active cue. Correct tokens are success, incorrect/missing tokens are destructive, extra tokens are muted/struck. Text labels and an `aria-live` summary accompany color.
- Cloze: preserve original punctuation and visible words. Deterministic hidden words render as dotted blanks; the current blank is visually emphasized. Typed blank content renders at its source position with live correct/incorrect state.
- Non-active cues remain compact. In practice mode their target text is visually masked until visited/current, without removing timestamp identity or list geometry.

### Sticky practice footer

- Optional compact shortcut legend above the controls: Replay, Next cue, Previous cue, Play/Pause.
- Control row: Previous cue button, Replay button, one answer input, Next cue button.
- Input limit: 2,000 UTF-16 code units for Dictation; 600 for the combined Cloze answer (at most six missing words).
- Dictation input contains the full attempted sentence.
- Cloze input contains all missing words in source order, separated by whitespace; its placeholder states the number of missing words.
- Enter advances to the next cue. Shift+Enter: previous cue. Shift+Space: play/pause. Ctrl/Meta+R while the answer field is focused: replay cue without browser reload.
- Cue transition or mode transition clears runtime draft, feedback, and current-blank state.

## Evaluation contract

- Normalize with Unicode NFKC, curly apostrophe to straight apostrophe, Unicode dash to hyphen, locale lowercase, punctuation/repeated whitespace ignored; diacritics remain significant.
- Dictation feedback is positional and O(n). Score is correct expected positions divided by expected token count.
- Cloze hides 30% of lexical target tokens, minimum 1, maximum 6, deterministic from cue identity + text, O(n), and stable across rerenders.
- Punctuation-only cues show an unavailable result while navigation remains usable.
- Drafts and results are runtime-only and never persisted.

## State and architecture

- `src/features/studyModes/lib/subtitlePractice.ts`: pure normalization, tokenization, deterministic cloze generation, evaluation.
- `src/features/studyModes/lib/practiceModeState.ts`: map/persist/apply through existing `STUDY_MODES` and `APPLY_STUDY_MODE`; no second state machine or storage key.
- `src/features/studyModes/ui/SubtitlePractice.tsx`: `PracticeOptions`, active-cue feedback renderer, fixed practice footer/session.
- `CueList` stays the list SSOT and receives a presentational active-cue replacement plus masking flags; it must not own input/session state.
- `SubtitlePanel` owns the three-region layout and renders the practice session around `CueList`.
- `SubtitlePanels`/`mountSubtitle`/`ReactSubtitleController` thread mode, explicit cue actions, speed, and play/pause.
- Chrome side panel uses the same `SubtitlePanel` rather than a second practice layout and retains tab-scoped messaging.

## Trust and accessibility

- Cue identity is explicit (`index`, `start`, `end`); no user action resolves its target from `video.currentTime`.
- Runtime broadcasts are filtered by active `tabId`.
- Subtitle/user content renders only as React text nodes; never `innerHTML`.
- Practice mode uses one labelled radiogroup/segmented control with a single selected option; Auto-translate alone uses switch semantics.
- Input has a mode-specific accessible label. Feedback uses `role=status` and `aria-live=polite`.
- Correctness uses text/state attributes plus color. Controls are at least 44px mobile and 40px desktop.
- Any clipping, overlap, unintended horizontal scroll, off-container bounding box, unreadably small control, or oversized control is a release blocker.
- Reflow must pass at container widths 280, 320, 360, 390, 480, 768, and 1024px; low-height states 360, 480, and 568px; effective browser zoom/text scaling 80%, 100%, 125%, 150%, and 200%.
- Header, scrolling list, active cue, footer input, and navigation controls must remain inside the panel bounds. Header/footer must never cover the active cue; the input must remain visible while focused in a low-height/mobile-keyboard simulation.
- Long unbroken words, CJK text, emoji, 2,000-character dictation input, six cloze answers, translated lines, and localized labels must wrap or truncate deliberately without changing panel width.
- No supported state may require horizontal scrolling. Controls may wrap into the specified compact layout, but may not shrink below their readable/touch target contract.

## Test matrix

### Unit/component

- Normalization: case, punctuation, whitespace, curly apostrophe, dash, Unicode diacritics.
- Dictation: exact, normalized exact, wrong/missing/extra, empty, long, live feedback.
- Cloze: deterministic, one-word, punctuation-only, repeated, Unicode, max-six, stable reconstruction, and ordered multi-answer parsing from one footer input.
- Layout behavior: segmented mode selection, input stays in footer, active cue never contains input, mode/cue reset, progressive cue disclosure, Auto-translate, speed callback, keyboard shortcuts, explicit previous/replay/next cue.
- Geometry behavior: every supported width/height/scale asserts panel descendant bounds, zero horizontal overflow, no header/list/footer overlap, minimum touch targets, focused input visibility, and long-content containment.

### Playwright

- Happy Dictation: enable, replay, type normalization-equivalent answer, observe live 100% feedback in active card, Enter advances.
- Happy Cloze: enable, fill footer input for each deterministic blank, observe source-position feedback, final Enter advances.
- Worst: 320×700, longest fixture cue, cycle modes at least 10 times, repeated wrong input, navigation/replay; exactly one footer/input, no stale state, dead controls, uncaught errors, or horizontal overflow.
- Edge: mode persists across reload, changing cue clears draft/feedback, punctuation/apostrophe normalization succeeds, Translation toggle changes native visibility, speed callback changes video playback rate.

## Commands

```bash
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:stage2 -- subtitle-panel-practice
```

## Definition of Done

- The reference layout is present in Player Mode, Split View, and Chrome side panel.
- All unit and Playwright happy/worst/edge tests pass without skipped/conditional tests.
- Typecheck, full unit suite, build, design-system audit, and real Chrome verification pass.
- No dependency or manifest change.
- Architecture and wiki docs are updated.
