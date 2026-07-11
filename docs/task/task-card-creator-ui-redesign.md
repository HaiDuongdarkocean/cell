# Task list — Card Creator UI redesign

> Derived from `docs/plan/plan-card-creator-ui-redesign.md` and `docs/specs/spec-card-creator-ui-redesign.md`.

## M1 — Preview block

- [ ] T1.1 Create `PreviewBlock.tsx` + `PreviewBlock.module.css`
  - Acceptance: `PreviewBlock` accepts `targetWord` and `sentence` props and renders both lines centered.
  - Verify: `npm run test:unit` passes `PreviewBlock.test.tsx`.
  - Files: `src/features/cardCreator/ui/PreviewBlock.tsx`, `.module.css`

- [ ] T1.2 Implement `highlightOccurrences` helper
  - Acceptance: All non-overlapping occurrences of `targetWord` in `sentence` are wrapped in `<strong>`; case-sensitive.
  - Verify: Unit test in `PreviewBlock.test.tsx`.
  - Files: `src/features/cardCreator/ui/PreviewBlock.tsx`

- [ ] T1.3 Wire `PreviewBlock` into `CardCreatorDialogContent`
  - Acceptance: Preview block renders between Card destination and Fields sections, with live values from `draft.fields.targetWord` and `draft.fields.sentence`.
  - Verify: Browser check and `CardCreatorDialogContent.test.tsx` update.
  - Files: `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`

## M2 — Field mapping selector redesign

- [ ] T2.1 Update `FieldRow` to render label-style selector
  - Acceptance: Selector has no background, no border, only small chevron, fit-to-content width, focus changes text color.
  - Verify: `FieldRow.test.tsx` + visual QA.
  - Files: `src/features/cardCreator/ui/FieldRow.tsx`, `FieldRow.module.css`

- [ ] T2.2 Add `FieldRow` tests for selector callbacks
  - Acceptance: Changing the select fires `onMapChange` with the selected Anki field.
  - Verify: `npm run test:unit`.
  - Files: `src/features/cardCreator/ui/FieldRow.test.tsx`

## M3 — Section/card layout cleanup

- [ ] T3.1 Update `CardCreatorDialog.module.css` to remove bordered section boxes
  - Acceptance: Sections use title + gap only, no card border/background.
  - Verify: Visual QA against mockup.
  - Files: `src/features/cardCreator/ui/CardCreatorDialog.module.css`

- [ ] T3.2 Update alert style to left-bordered notice
  - Acceptance: Alert has warning/error left border and subtle background, no full border.
  - Verify: `CardCreatorDialogContent.test.tsx` + visual QA.
  - Files: `src/features/cardCreator/ui/CardCreatorDialog.module.css`, `CardCreatorDialogContent.tsx`

## M4 — Image media gallery

- [ ] T4.1 Refactor `MediaList` to render image gallery when `kind='image'`
  - Acceptance: Horizontal scrollable gallery, thumbnail 120px height, actual image preview, remove button top-right, add button at end.
  - Verify: `MediaList.test.tsx` + visual QA.
  - Files: `src/features/cardCreator/ui/MediaList.tsx`, `MediaList.module.css`

- [ ] T4.2 Add image preview click behavior in gallery
  - Acceptance: Clicking image thumbnail opens full-size preview overlay (reuse existing overlay).
  - Verify: Browser QA.
  - Files: `src/features/cardCreator/ui/MediaList.tsx`

## M5 — Audio media list redesign

- [ ] T5.1 Update audio row style in `MediaList`
  - Acceptance: Vertical list, waveform icon, filename, remove button, `+ Add ...` text button.
  - Verify: `MediaList.test.tsx` + visual QA.
  - Files: `src/features/cardCreator/ui/MediaList.tsx`, `MediaList.module.css`

- [ ] T5.2 Add audio play behavior
  - Acceptance: Clicking waveform icon plays the audio file.
  - Verify: `MediaList.test.tsx` with mocked audio element.
  - Files: `src/features/cardCreator/ui/MediaList.tsx`

## M6 — Drag-and-drop file add

- [ ] T6.1 Add `onFilesDrop` callback to `MediaList`
  - Acceptance: Dropping valid files onto media zone appends them to the list; wrong type is ignored.
  - Verify: Unit test with `fireEvent.drop`.
  - Files: `src/features/cardCreator/ui/MediaList.tsx`, `CardCreatorDialogContent.tsx`

- [ ] T6.2 Implement `addDroppedFiles` state update in `CardCreatorDialogContent`
  - Acceptance: `draft.fields.images`/`sentenceAudios`/`wordAudios` updated with dropped files.
  - Verify: `CardCreatorDialogContent.test.tsx` or `useCardCreatorState.test.ts`.
  - Files: `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`, `useCardCreatorState.ts` (if needed)

## M7 — Drag-to-reorder

- [ ] T7.1 Implement desktop drag-to-reorder using HTML5 DnD
  - Acceptance: Dragging an image/audio item to another position updates the order.
  - Verify: Unit test with `fireEvent.dragStart`/`drop`.
  - Files: `src/features/cardCreator/ui/SortableMediaList.tsx` or `MediaList.tsx`

- [ ] T7.2 Implement mobile long-press drag-to-reorder
  - Acceptance: Long-pressing an item for ~400ms starts drag; releasing on another position reorders.
  - Verify: Browser QA on mobile viewport or touch event unit test.
  - Files: `src/features/cardCreator/ui/SortableMediaList.tsx` or `MediaList.tsx`

- [ ] T7.3 Add `onReorder` state update in `CardCreatorDialogContent`
  - Acceptance: `draft.fields[kind]` array is reordered in-place.
  - Verify: Unit test.
  - Files: `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`

## M8 — Mobile bottom sheet integration

- [ ] T8.1 Verify `CardCreatorDialogContent` with `variant='mobile'`
  - Acceptance: Layout stacks pair rows, footer stacks vertically, preview block centered, media lists usable.
  - Verify: `CardCreatorBottomSheet.test.tsx` + browser QA.
  - Files: `src/features/cardCreator/ui/CardCreatorBottomSheet.tsx`, `CardCreatorDialogContent.tsx`

- [ ] T8.2 Update `BottomSheet` CSS if overflow issues appear
  - Acceptance: Bottom sheet body scrolls, selects dropdowns visible.
  - Verify: Browser QA.
  - Files: `src/shared/ui/BottomSheet.module.css` (if needed)

## M9 — Final verification and cleanup

- [ ] T9.1 Run full verification
  - Acceptance: `npm run test:unit`, `npm run lint`, `npm run typecheck` all pass.
  - Verify: Run commands.
  - Files: none (or fix failures).

- [ ] T9.2 Browser MCP verify desktop + mobile
  - Acceptance: UI matches mockup; D&D and reorder work; preview block visible.
  - Verify: Browser MCP test.
  - Files: test report in `docs/test-reports/`.

- [ ] T9.3 Update architecture docs
  - Acceptance: `docs/2-architechture-system.md` updated with new files if any; `docs/0-wiki.md` already updated.
  - Verify: `git diff` review.
  - Files: `docs/2-architechture-system.md`.

## Notes

- Use `git status` and `git diff` after each task to keep commits atomic.
- Each task should touch ≤5 files. If a task grows, split it.
- Do not start code before `todo_write` is created for BUILD phase.
