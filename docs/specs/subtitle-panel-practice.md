# Spec: Subtitle Panel Practice — Dictation and Cloze v2

> Status: implementation-ready (v2)
> Extends: `docs/specs/media-study-modes.md`
> Intent: `docs/intent/subtitle-practice-panel-v2.md`

## Objective

Turn the shared subtitle panel into an active-practice surface with a compact, single-row action bar and a readable feedback history. The panel keeps the fixed-header, scrolling-transcript, fixed-footer layout: a horizontal top action bar replaces the two-row options header, the active cue displays live answer feedback without noisy annotations, visited cues become history rows that show the user's own typed sentence with per-word colors, and one persistent answer field with cue controls remains at the bottom.

## Product decision

Use the reference's console model rather than expanding the active cue into a form. The transcript remains the visual result surface; the footer is the only input surface. This preserves reading rhythm, avoids row-height jumps, and keeps controls reachable on a narrow/tall panel.

## Layout contract v2

### Top action bar

- One horizontal, scrollable div rendered inside `SubtitlePanel` at the very top of the panel, always visible regardless of the active study mode.
- Left side: speed pill / circle.
- Right side: all study-mode buttons (7 presets + user-created custom modes), rendered as circular icon buttons from `ICON_CATALOG` via the study-mode `icon` field.
- Active mode is highlighted (selected state). Tapping a mode button calls `useStudyModeStore.setActiveModeId(id)` (or the content-script equivalent), which persists through `STUDY_MODES` storage and broadcasts `APPLY_STUDY_MODE`.
- On narrow panels the bar is swipeable left/right (touch drag, `overscroll-behavior-x: contain`).
- On desktop, when items overflow, two floating arrow buttons appear at the left/right edges of the bar; clicking them scrolls the bar one viewport/one item in the corresponding direction.
- Horizontal overflow of the panel itself is a release blocker; only the action bar's inner track may scroll.

### Speed pill

- Wide: a pill segmented into three equal visual parts `[ − | 0.75x | + ]`.
  - `−` steps to the previous speed in the allowed set (`0.5`, `0.75`, `1`, `1.25`, `1.5`).
  - `+` steps to the next speed.
  - The center number is displayed as transparent text (same color as the label) and is tappable; tapping it opens a horizontal list of speed options in a `Popover` portal from `src/shared/ui` so the popover does not affect the action bar layout or get clipped by the panel's `overflow: hidden`.
- Narrow (container width < threshold): collapses to a circular button the same size as the study-mode icon buttons. It displays only the current speed number. Tapping it opens the same horizontal speed list popover.
- The speed value also controls the active video playback rate and is reset/synchronized by the applied Study Mode step.

### Scrolling transcript

- The list is the only scroll container between the action bar and the footer.
- Cues are shown in ascending cue order.
- The active cue is a compact selected card with an accent edge; it stays centered vertically (existing `CueList` auto-scroll behavior).
- **Active cue feedback (Dictation and Cloze):**
  - Show the expected text and typed text merged into one line of words.
  - Correct tokens use the success color (`xanh`).
  - Incorrect / missing tokens use the destructive color (`đỏ`) and are underlined.
  - Extra tokens are muted and struck through.
  - Do **not** show `(missing)` token notes.
  - Do **not** show a visible score / stats line such as `x/y correct — z%`.
  - Keep a screen-reader-only `role=status` / `aria-live=polite` summary for non-visual feedback.
- **History rows (visited cues):**
  - A cue becomes *visited* once it has been the active cue and the user leaves it (advances to another cue via `Enter`, `>`, `<`, or mode change). The component keeps a runtime `visitedCueKeys: Set<string>` keyed by `cueKey`.
  - Show the last typed attempt for that cue with the same per-word colors as the active cue.
  - The attempt is captured at the moment the cue is left: the current `draft` / `clozeDraft` and the evaluated `PracticeResult` for that cue are stored in `attempts: Map<cueKey, { draft, result }>`.
  - If a cue was visited but no text was entered, keep the masked/blank state.
  - Render the translation (`nativeText`) below every history row when `settings.subtitleOverlayNativeStyle.visible` is `true` (the same per-layer native-visibility toggle used by the overlay subtitle manager).
  - History rows are never editable and do not show the answer input.
- **Non-visited, non-active cues:** remain compact and masked until visited/current, without removing timestamp identity or list geometry.
- Active cue does **not** show the translation; translation is intentionally placed only on history rows.

### Sticky practice footer

- Two parts:
  1. **Shortcut legend "PHÍM TẮT"**: a row of `key chip + Vietnamese label` pairs.
     - `Ctrl/⌘+R` — Phát lại
     - `Enter` — Câu tiếp
     - `Shift+Enter` — Câu trước
     - `Shift+Space` — Tạm dừng
  2. **Control row**: `<` previous, `↻` replay, one answer input, `>` next.
- Input fills the available space between the navigation buttons (`<`, `↻`, `>` fixed; input `flex: 1 minmax(0,1fr)`).
- Input limit: 2,000 UTF-16 code units for Dictation; 600 for the combined Cloze answer (at most six missing words).
- Dictation input contains the full attempted sentence.
- Cloze input contains all missing words in source order, separated by whitespace; its placeholder states the number of missing words.
- `Enter` advances to the next cue. `Shift+Enter`: previous cue. `Shift+Space`: play/pause. `Ctrl/⌘+R` while the answer field is focused: replay cue without browser reload.
- Cue transition or mode transition clears runtime draft, feedback, and current-blank state **for the new active cue**; attempts for already-visited cues are retained in the runtime attempts map until the session unmounts.

## Evaluation contract

- Normalize with Unicode NFKC, curly apostrophe to straight apostrophe, Unicode dash to hyphen, locale lowercase, punctuation/repeated whitespace ignored; diacritics remain significant.
- Dictation feedback is positional and O(n). Score is correct expected positions divided by expected token count.
- Cloze hides 30% of lexical target tokens, minimum 1, maximum 6, deterministic from cue identity + text, O(n), and stable across rerenders.
- Punctuation-only cues show an unavailable result while navigation remains usable.
- Drafts and results are runtime-only and never persisted.

## State and architecture v2

- `src/features/studyModes/lib/subtitlePractice.ts`: pure normalization, tokenization, deterministic cloze generation, evaluation — unchanged.
- `src/features/studyModes/lib/practiceModeState.ts`: mode changes are made through the existing `useStudyModeStore.setActiveModeId(id)` (sidepanel) and the existing `STUDY_MODES` / `APPLY_STUDY_MODE` broadcast (content script). `practiceModeFromStudyModeId(id)` continues to derive the practice UI (`off`, `dictation`, `cloze`) from the active mode. No second state machine or storage key.
- `src/features/studyModes/ui/SubtitlePractice.tsx`:
  - Owns a runtime `attempts: Map<cueKey, { draft, result }>` and `visitedCueKeys: Set<string>` for visited cues (`Map`/`Set` access O(1)).
  - `cueKey` is `${mode}:${cue.index}:${cue.start}:${cue.targetText}` (the existing stable reset key). Use `cue.start` + `cue.index` as the primary key and include `mode` so Dictation and Cloze attempts for the same cue do not collide.
  - Renders the shortcut footer and passes `renderCueContent` to `CueList` so history rows and active cue render correctly.
- New component `src/features/studyModes/ui/StudyModeActionBar.tsx`:
  - Receives `activeModeId`, `customModes`, `playbackSpeed`, `onSpeedChange`.
  - Renders `SpeedPill` + all mode icon buttons.
  - Calls `useStudyModeStore.setActiveModeId(id)` (or the equivalent storage + `APPLY_STUDY_MODE` broadcast in content-script contexts) on mode change.
- New component `src/features/studyModes/ui/SpeedPill.tsx`: pill and circle variants, popover speed list, uses `src/shared/ui/Popover`.
- `CueList` stays the list SSOT and receives a presentational active-cue replacement plus history-row renderer; it must not own input/session state.
- `SubtitlePanel` owns the three-region layout, replaces the old `PracticeOptions` block with `StudyModeActionBar`, and renders the practice session around `CueList`.
- `SubtitlePanels`/`mountSubtitle`/`ReactSubtitleController` continue to thread mode, explicit cue actions, speed, and play/pause.
- Chrome side panel uses the same `SubtitlePanel` rather than a second practice layout and retains tab-scoped messaging.

## Trust and accessibility

- Cue identity is explicit (`index`, `start`, `end`); no user action resolves its target from `video.currentTime`.
- Runtime broadcasts are filtered by active `tabId`.
- Subtitle/user content renders only as React text nodes; never `innerHTML`.
- Study-mode buttons in the action bar form a single labelled `tablist` (`role="tablist"`) where each mode is a `tab` (`role="tab"`) with `aria-selected` and `aria-label` from the mode title. Left/right arrow keys either scroll the bar or move focus (not both); roving `tabindex` is managed by the `tablist`.
- Speed pill `−`/`+` buttons and center popover trigger are `aria-label`ed; the popover list uses `role="listbox"` with `aria-activedescendant` or a roving `tabindex`.
- Input has a mode-specific accessible label. Feedback uses `role=status` and `aria-live=polite` (visually hidden summary).
- Correctness uses text/state attributes plus color; never color alone.
- Controls are at least 44px mobile and 40px desktop; speed circle and mode icon buttons share the same touch-target size.
- Any clipping, overlap, unintended horizontal scroll, off-container bounding box, unreadably small control, or oversized control is a release blocker.
- Reflow must pass at container widths 280, 320, 360, 390, 480, 768, and 1024px; low-height states 360, 480, and 568px; effective browser zoom/text scaling 80%, 100%, 125%, 150%, and 200%.
- Action bar, scrolling list, active cue, footer input, and navigation controls must remain inside the panel bounds. Action bar and footer must never cover the active cue; the input must remain visible while focused in a low-height/mobile-keyboard simulation.
- Long unbroken words, CJK text, emoji, 2,000-character dictation input, six cloze answers, translated lines, and localized labels must wrap or truncate deliberately without changing panel width.
- No supported state may require horizontal scrolling. Only the action bar's inner track may scroll horizontally; the panel itself and cue list must not.

## Test matrix

### Unit/component

- Normalization: case, punctuation, whitespace, curly apostrophe, dash, Unicode diacritics.
- Dictation: exact, normalized exact, wrong/missing/extra, empty, long, live feedback.
- Cloze: deterministic, one-word, punctuation-only, repeated, Unicode, max-six, stable reconstruction, and ordered multi-answer parsing from one footer input.
- Layout behavior: horizontal action bar, speed pill step + popover, all mode buttons render, active mode highlight, custom modes appear (up to 20 custom modes remain swipeable/arrow-scrollable without breaking touch targets), input stays in footer, active cue never contains input, mode/cue reset, progressive cue disclosure, translation under history rows, speed callback, keyboard shortcuts, explicit previous/replay/next cue.
- Geometry behavior: every supported width/height/scale asserts panel descendant bounds, zero horizontal overflow, no action bar/list/footer overlap, minimum touch targets, focused input visibility, and long-content containment. Action bar scroll/swipe on narrow widths; arrow overflow buttons on desktop.

### Playwright

- Happy Dictation: enable, replay, type normalization-equivalent answer, observe live word-colored feedback in active card, Enter advances.
- Happy Cloze: enable, fill footer input for each deterministic blank, observe source-position feedback, final Enter advances.
- Worst: 320×700, longest fixture cue, cycle modes at least 10 times, repeated wrong input, navigation/replay; exactly one footer/input, no stale state, dead controls, uncaught errors, or horizontal overflow. Action bar swipe and speed popover visible.
- Edge: mode persists across reload, changing cue clears draft/feedback, punctuation/apostrophe normalization succeeds, translation under history rows follows global setting, speed callback changes video playback rate, custom mode button applies the mode.

## Commands

```bash
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e:stage2 -- subtitle-panel-practice
```

## Definition of Done

- The v2 layout is present in Player Mode, Split View, and Chrome side panel.
- All unit and Playwright happy/worst/edge tests pass without skipped/conditional tests.
- Typecheck, full unit suite, build, design-system audit, and real Chrome verification pass.
- No dependency or manifest change.
- Architecture and wiki docs are updated.

## Elicitation revision log

- **2026-09-14 — v2**: Confirmed via user restatement (`docs/intent/subtitle-practice-panel-v2.md`). Replaced two-row sticky options header (`Practice` + `Speed`) with a single top action bar containing a pill/circle speed control and all study-mode icon buttons (presets + user custom). Removed visible score line and `(missing)` token notes; replaced with blue/red + underline per-word coloring. Added history rows showing the typed sentence with per-word colors and translation below. Added Vietnamese "PHÍM TẮT" footer. Kept bottom control bar `< ↻ input >` unchanged.
