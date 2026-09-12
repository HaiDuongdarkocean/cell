# Implementation Plan: Card Creator Mobile Bottom Sheet

> Derived from `docs/specs/spec-card-creator-bottom-sheet-mobile.md`

## Overview

Replace the stacked mobile `DictionaryTab` with a bottom-sheet-based `CardCreatorPanel`, make the integrated `Dictionary` a clone of the popup `Dictionary`, and implement diff/merge + draft persistence.

## Architecture Decisions

1. **Bottom sheet is owned by `CardCreatorPanel`**, not by `DictionaryTab`, so the same `CardCreatorPanel` can still be used as a right pane on desktop.
2. **Diff/merge lives in `useCardCreatorState` / `CardDraft`**, not in the `Dictionary`, because the `CardCreator` is the consumer and must define how it merges repeated prefill into the current draft.
3. **Selection state is passed from popup → panel through `DictionaryPanelPrefill`**, possibly augmented with a new `selectedMedia`/`selectedDefinitions` field, so the integrated `Dictionary` can initialize with the same selection.
4. **Draft persistence uses the existing `DraftAutosaver`**; panel close simply does not clear it, and panel open restores the last draft if present.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `BottomSheet` drag/snap behavior is hard to make smooth | Med | Use a thin wrapper over the existing `BottomSheet` with CSS transforms and pointer/touch events; manual showcase test on real mobile viewport. |
| Diff/merge logic conflicts with `mediaUpdateMode` (overwrite/append/skip) | Med | Define merge as a function of `mediaUpdateMode`: `overwrite` fully replaces, `append` merges with selection diff, `skip` only fills empty fields. |
| State clone from popup to integrated is large and brittle | Med | Reuse `useCandidate` selection state and add controlled initialization props. |
| Draft autosave may restore stale or partial data | Low | Restore only if `term` matches and clear after successful submit. |

## Checkpoints

- **Checkpoint 1 (after Tasks 1-3)**: Mobile layout works, sheet opens/closes.
- **Checkpoint 2 (after Tasks 4-5)**: Selection clone and diff/merge work.
- **Checkpoint 3 (after Tasks 6-7)**: Submit closes panel, draft persists.
- **Checkpoint 4 (after Task 8)**: All tests/build/lint pass, showcase verified.

---

## Task List

### Phase 1: Foundation — UI shell

- [ ] **Task 1: Refactor `DictionaryTab` mobile layout to a single-pane + sheet area**
  - Update `DictionaryTab.module.css` so that at `<= 839px` the tab is a `flex-column` with `leftPane` taking `flex: 1` and a reserved area at the bottom for the sheet.
  - Update `DictionaryTab.tsx` to stop passing `rightPane` inline; render `<CardCreatorPanel />` in a container that the sheet can anchor to.
  - Acceptance: Show the `Universal Panel Page` at `viewport=390`; `Dictionary` is full screen and the `CardCreator` region collapses to a 56px bar.
  - Verify: `npm run typecheck` + `npm run lint` + showcase screenshot.
  - Files: `DictionaryTab.tsx`, `DictionaryTab.module.css`
  - Dependencies: None
  - Parallel: false

- [ ] **Task 2: Convert `CardCreatorPanel` to a bottom sheet on mobile**
  - Add a `Sheet` shell inside `CardCreatorPanel.tsx` that wraps `CardCreatorDialogContent`.
  - Add a pill drag handle, `data-cell-id="card-creator-sheet-pill"`.
  - Implement collapse (`56px`), half (`50%`), full (`100%`) snap states and tap-to-toggle.
  - Acceptance: Sheet can be tapped/ dragged; collapsed state only shows a pill header with term + icon; expanded state shows the full form.
  - Verify: Manual showcase at `viewport=390`.
  - Files: `CardCreatorPanel.tsx`, `CardCreatorPanel.module.css`
  - Dependencies: Task 1
  - Parallel: false

- [x] **Task 3: Extend or reuse `BottomSheet` with drag handle + snap points** — implemented as new `src/shared/ui/MobileSheet.tsx` + `MobileSheet.module.css` (existing `BottomSheet` is a modal dialog; `MobileSheet` is a container-anchored snap sheet with pill handle, `data-cell-id="card-creator-sheet-pill"`, snap points 56px/50%/100%, controlled `snap` prop + `onSnapChange`).
  - If `BottomSheet` is reusable, add optional `snapPoints`, `pill`, and `onSnapChange` props.
  - If not, create a small `MobileSheet` wrapper in `src/shared/ui/`.
  - Acceptance: Shared component supports the three snap points and a drag handle.
  - Verify: `npm run test:unit` on the shared component + typecheck.
  - Files: `src/shared/ui/BottomSheet.tsx`, `src/shared/ui/BottomSheet.module.css` (or `src/shared/ui/MobileSheet.tsx`)
  - Dependencies: None
  - Parallel: true (can run alongside Task 1 if no code overlap)

### Phase 2: Core behavior — clone + merge

- [ ] **Task 4: Pass full popup selection state into `DictionaryPanelPrefill`**
  - Modify `DictionaryPanelPrefill` to include the selected-state snapshot: `selectedImageIds`, `selectedAudioIds`, `selectedDefinitionIds`, `translationSelected`.
  - Modify `webTextDictionaryController.sendToCard` to build and send this snapshot.
  - Modify `mountUniversalPanel` and `DictionaryTab` to forward the snapshot to the integrated `Dictionary`.
  - Acceptance: A `sendToCard` from popup results in the integrated `Dictionary` showing the same candidate with the same media/definition checkboxes selected.
  - Verify: Unit test for `webTextDictionaryController.sendToCard` + manual showcase.
  - Files: `src/features/universalPanel/types.ts`, `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`, `src/features/dictionaryPopup/types.ts`, `src/features/dictionaryPopup/ui/buildCandidatePrefill.ts`
  - Dependencies: None
  - Parallel: true (with Tasks 1-3)

- [ ] **Task 5: Initialize `Dictionary` integrated from the snapshot and enable reselection**
  - Add props to `DictionaryPanelView` and `CandidateView` (or use `initial*` props) to set initial selected states.
  - Ensure `useCandidate` / `useDictionaryToolbar` can initialize selection from the snapshot.
  - Acceptance: The integrated `Dictionary` does not reset selection on every render; the user can change selection and tap `sendToCard` again.
  - Verify: Unit tests for `CandidateView` + showcase.
  - Files: `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`, `src/features/dictionaryPopup/ui/CandidateView.tsx`, `src/features/dictionaryPopup/ui/useCandidate.ts`, `src/features/dictionaryPopup/ui/useDictionaryToolbar.ts`
  - Dependencies: Task 4
  - Parallel: false

- [ ] **Task 6: Implement diff/merge in `CardCreator` for repeated `sendToCard`**
  - Add a `mergePrefillIntoDraft` function in `cardDraft.ts` or inside `useCardCreatorState`.
  - For each collection field (`imageUrls`, `wordAudioUrls`, `sentenceAudioUrls`, `definitions`, `sentence`, `translation`), compute add/keep/remove based on the new prefill and the existing draft.
  - Respect `mediaUpdateMode` (`overwrite`, `append`, `skip`) when applying.
  - Acceptance: The example in the spec (image selection `[1,2]` → `[2,3,4]`) produces `imageUrls = [2,3,4]`.
  - Verify: Unit tests in `cardDraft.test.ts` or `useCardCreatorState.test.ts`.
  - Files: `src/features/cardCreator/state/cardDraft.ts`, `src/features/cardCreator/ui/useCardCreatorState.ts`, `src/features/cardCreator/ui/useCardCreatorState.test.ts`
  - Dependencies: None
  - Parallel: true (with Tasks 1-3, 4-5 if no direct file overlap, but needs Task 5 for E2E)

### Phase 3: Lifecycle — open/close/persist

- [ ] **Task 7: Panel closes after Add/Update; draft persists on Close/ESC**
  - Modify `CardCreatorDialogContent` to call an `onAfterSubmit` callback after successful `Add`/`Update`.
  - In `CardCreatorPanel`, wire `onAfterSubmit` to `UniversalPanelController.close()`.
  - Ensure `close` does not clear `DraftAutosaver` data, only clears `pendingCardCreatorContext`.
  - On `open`, if a saved draft exists and its `term` matches the new prefill, restore the draft; otherwise start from the prefill.
  - Acceptance: Tapping `Add`/`Update` closes the panel; closing with `×`/ESC keeps the draft; reopening restores it.
  - Verify: Manual showcase + unit tests.
  - Files: `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`, `src/features/cardCreator/ui/CardCreatorDialogContent.tsx` (actions), `src/features/cardCreator/ui/CardCreatorPanel.tsx`, `src/features/universalPanel/UniversalPanelController.ts`, `src/features/universalPanel/mountUniversalPanel.ts`, `src/features/cardCreator/state/cardDraft.ts`
  - Dependencies: Task 2, Task 6
  - Parallel: false

### Phase 4: Verification

- [ ] **Task 8: Integration test, build, and showcase verification**
  - Add/update integration tests for:
    - Popup `sendToCard` opens panel with clone state.
    - Reselection in integrated `Dictionary` updates draft.
    - Draft restore after close/open.
    - Submit closes panel.
  - Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`.
  - Manual showcase at `viewport=390` with light/dark themes.
  - Acceptance: All gates in the spec DoD pass.
  - Verify: CI-equivalent commands + manual screenshots.
  - Files: test files
  - Dependencies: Tasks 1-7
  - Parallel: false

---

## Parallelization Summary

| Group | Tasks | Notes |
|-------|-------|-------|
| Independent foundation | 1, 3, 4, 6 | UI layout, sheet shared component, popup state clone, diff/merge logic can proceed in parallel because they touch different files. |
| Sequential on UI | 2 depends on 1 | Sheet shell integration needs layout. |
| Sequential on state | 5 depends on 4; 7 depends on 2, 6 | Dictionary selection clone needs snapshot; lifecycle needs both sheet and merge. |
| Final verification | 8 | Runs after all others. |
