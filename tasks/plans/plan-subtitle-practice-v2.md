# Implementation Plan: Subtitle Practice Panel v2

## Overview

Redesign the active-practice subtitle panel (`SubtitlePracticeSession`) to use a compact top action bar with a pill/circle speed control and all study-mode buttons (presets + user custom), show colored word feedback without token notes/stats, turn visited cues into history rows that display the typed sentence with per-word colors and translation, and replace the shortcut legend with a Vietnamese "PHÍM TẮT" key-chip footer.

## Architecture decisions

1. **Action bar lives inside `SubtitlePanel`**, not `SubtitlePracticeSession`, so mode switching is available even when no practice mode is active.
2. **Mode changes use the existing `useStudyModeStore.setActiveModeId(id)` flow** (or `STUDY_MODES` storage + `APPLY_STUDY_MODE` in content script). `practiceModeFromStudyModeId(id)` continues to derive the practice UI.
3. **Speed popover uses `src/shared/ui/Popover` portal** so it escapes the panel's `overflow: hidden`.
4. **Attempts are runtime-only** in `Map<cueKey, { draft, result }>` and `Set<cueKey>` visited keys, keyed by `${mode}:${cue.index}:${cue.start}:${cue.targetText}`. No persistence.
5. **Native translation visibility follows `settings.subtitleOverlayNativeStyle.visible`** instead of a hardcoded in-panel toggle; this is the same per-layer native-visibility setting used by the overlay subtitle manager.
6. **Mode bar uses `tablist` semantics** to avoid conflict between arrow-key navigation and horizontal scrolling.

## Task list

### Phase 1: Top action bar and speed pill

- [ ] **Task 1: StudyModeActionBar shell and mode wiring**
  - **Description:** Add `src/features/studyModes/ui/StudyModeActionBar.tsx` that lists all `PRESETS` + `customModes` as icon buttons with active highlight. Wire `SubtitlePanel` to `useStudyModeStore` (sidepanel) and thread `customModes`/`activeModeId` in content script so it replaces `PracticeOptions`.
  - **Acceptance criteria:**
    - [ ] Action bar renders 7 presets + custom modes.
    - [ ] Selecting a mode calls the existing active-mode change path (`setActiveModeId` or `APPLY_STUDY_MODE`).
    - [ ] Practice UI (`dictation`/`cloze`) appears/disappears based on the active mode.
    - [ ] `PracticeOptions` is no longer rendered.
  - **Verify:** `npm run typecheck && npm run test:unit`.
  - **Dependencies:** None.
  - **Priority:** P0.
  - **Parallel:** true.
  - **Files likely touched:** `src/features/studyModes/ui/StudyModeActionBar.tsx`, `src/features/subtitle/ui/SubtitlePanel.tsx`, `src/features/subtitle/ui/SubtitlePanels.tsx`, `src/features/subtitle/ui/reactSubtitleController.ts`.

- [ ] **Task 2: SpeedPill component**
  - **Description:** Implement `src/features/studyModes/ui/SpeedPill.tsx` with wide pill `[− | 0.75x | +]` and narrow circle variants. The center opens a horizontal speed list in a `Popover` portal; `−`/`+` step through `[0.5, 0.75, 1, 1.25, 1.5]`.
  - **Acceptance criteria:**
    - [ ] Speed changes via step buttons and popover.
    - [ ] Circle variant renders below a container width threshold.
    - [ ] Popover is not clipped by the panel.
  - **Verify:** `npm run test:unit -- SpeedPill && npm run build`.
  - **Dependencies:** None.
  - **Priority:** P0.
  - **Parallel:** true.
  - **Files likely touched:** `src/features/studyModes/ui/SpeedPill.tsx`, `src/features/studyModes/ui/SpeedPill.test.tsx`.

- [ ] **Task 3: Action bar scroll and overflow arrows**
  - **Description:** Add CSS and small left/right arrow buttons for the horizontal action bar: touch swipe on narrow, floating scroll buttons on desktop overflow. Minimum 40px touch target.
  - **Acceptance criteria:**
    - [ ] Bar is swipeable on narrow containers.
    - [ ] Overflow arrow buttons appear and scroll the bar on desktop.
    - [ ] The panel itself has zero horizontal overflow.
  - **Verify:** Design-system showcase or Playwright geometry check at 320–1024px.
  - **Dependencies:** Task 1, Task 2.
  - **Priority:** P0.
  - **Parallel:** false.
  - **Files likely touched:** `src/features/studyModes/ui/StudyModeActionBar.module.css`, `src/features/studyModes/ui/StudyModeActionBar.tsx`.

### Phase 2: Cue feedback and history

- [ ] **Task 4: Active cue word feedback without notes/stats**
  - **Description:** Update `PracticeCueContent.tsx` to show correct words in the success color, incorrect/missing in destructive + underline, extra muted + strikethrough. Remove visible `(missing)` notes and the `x/y correct — z%` stats line. Keep a visually hidden `aria-live` summary.
  - **Acceptance criteria:**
    - [ ] Active Dictation and Cloze cues show colored and underlined words.
    - [ ] No `(missing)` text visible.
    - [ ] No `x/y correct — z%` visible.
    - [ ] `role=status` / `aria-live=polite` sr-only text remains.
  - **Verify:** `npm run test:unit -- PracticeCueContent`.
  - **Dependencies:** None.
  - **Priority:** P1.
  - **Parallel:** true.
  - **Files likely touched:** `src/features/studyModes/ui/PracticeCueContent.tsx`, `src/features/studyModes/ui/SubtitlePractice.module.css`.

- [ ] **Task 5: Native visibility from settings**
  - **Description:** Read `settings.subtitleOverlayNativeStyle.visible` in `SubtitlePanel` and pass it as `translationEnabled` to `SubtitlePracticeSession`. Remove the hardcoded `translationEnabled={true}`.
  - **Acceptance criteria:**
    - [ ] `CueList` `showNative` and `SubtitlePracticeSession` `translationEnabled` follow the global native-visibility setting.
    - [ ] No in-panel translation toggle exists.
  - **Verify:** `npm run typecheck`.
  - **Dependencies:** None.
  - **Priority:** P1.
  - **Parallel:** true.
  - **Files likely touched:** `src/features/subtitle/ui/SubtitlePanel.tsx`, possibly a settings reading hook.

- [ ] **Task 6: History rows and attempts map**
  - **Description:** In `SubtitlePractice.tsx`, maintain `attempts: Map<cueKey, { draft, result }>` and `visitedCueKeys: Set<cueKey>`. Capture an attempt when the user leaves a cue. Render visited cues as history rows with the typed sentence in per-word colors and `nativeText` (if enabled) below; active cue does not show translation.
  - **Acceptance criteria:**
    - [ ] Visited cues display the last typed attempt with correct colors.
    - [ ] Unvisited cues remain masked.
    - [ ] Active cue has no translation.
    - [ ] Cue transitions do not lose history for already-visited cues.
  - **Verify:** `npm run test:unit -- SubtitlePractice`.
  - **Dependencies:** Task 4 (feedback colors), Task 5 (translation flag).
  - **Priority:** P1.
  - **Parallel:** false.
  - **Files likely touched:** `src/features/studyModes/ui/SubtitlePractice.tsx`, `src/features/studyModes/ui/PracticeCueContent.tsx`.

### Phase 3: Footer and polish

- [ ] **Task 7: Vietnamese shortcut footer "PHÍM TẮT"**
  - **Description:** Replace the existing English shortcut legend with key chips + Vietnamese labels: `Ctrl/⌘+R` Phát lại, `Enter` Câu tiếp, `Shift+Enter` Câu trước, `Shift+Space` Tạm dừng.
  - **Acceptance criteria:**
    - [ ] Shortcut legend uses Vietnamese labels.
    - [ ] Key chips are visually distinct and readable.
    - [ ] Collapses/hides on very narrow screens without breaking the input row.
  - **Verify:** Visual check in design-system showcase.
  - **Dependencies:** None.
  - **Priority:** P2.
  - **Parallel:** true.
  - **Files likely touched:** `src/features/studyModes/ui/SubtitlePractice.tsx`, `src/features/studyModes/ui/SubtitlePractice.module.css`.

- [ ] **Task 8: Tests, design-system audit, and real Chrome verification**
  - **Description:** Update `SubtitlePractice.test.tsx`, add/update `e2e/stage2/subtitle-panel-practice.spec.ts` for action bar, speed pill, history, no visible stats. Run `npm run typecheck && npm run test:unit && npm run build`. Manually verify packed `.crx` in Chrome at 320/390/768px widths.
  - **Acceptance criteria:**
    - [ ] All unit tests pass.
    - [ ] Playwright subtitle-panel-practice stage2 spec passes.
    - [ ] No horizontal overflow in any reflow breakpoint.
    - [ ] Real Chrome check passes.
  - **Verify:** `npm run typecheck && npm run test:unit && npm run build && npm run test:e2e:stage2 -- subtitle-panel-practice`.
  - **Dependencies:** Tasks 1–7.
  - **Priority:** P0.
  - **Parallel:** false.
  - **Files likely touched:** `src/features/studyModes/ui/SubtitlePractice.test.tsx`, `src/features/studyModes/ui/SpeedPill.test.tsx`, `src/features/studyModes/ui/PracticeCueContent.test.tsx`, `e2e/stage2/subtitle-panel-practice.spec.ts`.

- [ ] **Task 9: Architecture and wiki docs update**
  - **Description:** Update `docs/2-architechture-system.md` with the new `StudyModeActionBar` and `SpeedPill` components; update `docs/0-wiki.md` if the feature index needs it.
  - **Acceptance criteria:**
    - [ ] Architecture doc lists the new UI components.
    - [ ] No stale references to `PracticeOptions` as the primary mode selector.
  - **Verify:** Doc review.
  - **Dependencies:** Tasks 1–3.
  - **Priority:** P2.
  - **Parallel:** true.
  - **Files likely touched:** `docs/2-architechture-system.md`, `docs/0-wiki.md`.

## Checkpoints

- **After Phase 1:** `npm run typecheck && npm run test:unit` passes; action bar + speed pill render in the design-system showcase.
- **After Phase 2:** active and history cues render correctly; tests for `PracticeCueContent` and `SubtitlePractice` pass.
- **After Phase 3:** full build, all tests, and Playwright pass; real Chrome verified.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mode buttons need to work in both sidepanel and in-page content script | High | Reuse the existing `APPLY_STUDY_MODE` storage broadcast and `practiceModeFromStudyModeId` path; no new messaging. |
| `subtitleOverlayNativeStyle.visible` may not be accessible in the panel context | Medium | Fall back to `CueList.showNative` wiring / `settings` store; if unavailable, document accepted risk to read from the same source the overlay uses. |
| Horizontal action bar with many custom modes breaks touch targets | Low | Cap acceptance at 20 custom modes; circle buttons and scroll/swipe keep width bounded. |
| `tablist` + swipe scroll interaction may conflict | Low | Implement roving `tabindex` and only use arrow keys for focus when the bar is not being swiped. |

## Open questions

- Should the speed value in the action bar be synchronized from the active `StudyStep` or from the video `playbackRate`? Accepted: it reflects the active study-mode `speed`, falling back to the current `playbackSpeed` prop if the study step does not specify a speed.
