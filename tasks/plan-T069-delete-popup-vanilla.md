# Implementation Plan: T069 — Delete old popup vanilla files after parity

## Overview
Remove the legacy vanilla JS popup path (`popupShell`, `popupContent`, `popupToolbar`, `popupDictionary.css`, `popupDictionaryController`) and make `webTextDictionaryController` call the React `mountPopupDictionary` path exclusively. This completes the popup dictionary React migration.

## Architecture decisions
1. **Extract shared types first.** `PopupCardCreatorPrefill`, `PopupCardCreatorAction`, and `OnCardCreatorActionResult` are needed by both the legacy controller and the new React UI. Move them to `src/features/dictionaryPopup/types.ts` so we can delete `popupDictionaryController.ts` without breaking imports.
2. **Move geometry helpers out of `popupShell.ts`.** `clampPopupSize`, `getMountParent`, and `POPUP_*` constants are used by `mountPopupDictionary` and tests. They belong in `usePopupPosition.ts` (or a new `popupGeometry.ts`) so `popupShell.ts` can be deleted.
3. **Add controller callbacks to the React popup.** `PopupDictionary` → `DictionaryPanelView` → `useDictionaryPanel` → `CandidateView`/`useCandidate` will accept `onStatusChange(term, langCode, status)` and `onCandidateChange(term)` so `webTextDictionaryController` can keep token status pins and phrase highlights in sync.
4. **Refactor `webTextDictionaryController.ts` to use `mountPopupDictionary`.** The controller currently builds a `PopupDictionaryState` and calls `showPopup`, `appendCandidate`, etc. It will instead call `mountPopupDictionary({ initialTerm, ... })` and provide `onSendToCard`, `onQuickAdd`, `onStatusChange`, `onCandidateChange`, `onClose` callbacks.
5. **Delete legacy UI files and the feature flag.** Once the controller migration is green, remove `popupShell.ts`, `popupToolbar.ts`, `popupContent.ts`, `popupDictionary.css`, `popupDictionaryController.ts`, and their tests; remove `USE_LEGACY_POPUP_DICTIONARY` from `featureFlags.ts` and `mountPopupDictionary.ts`.

## Task list

### Phase 1: Decouple types and geometry
- [ ] T069.1: Move `PopupCardCreatorPrefill`, `PopupCardCreatorAction`, `OnCardCreatorActionResult` to `src/features/dictionaryPopup/types.ts` and update all imports.
- [ ] T069.2: Move `clampPopupSize`, `getMountParent`, `POPUP_DEFAULT_HEIGHT_PX`, `POPUP_MARGIN_PX`, `POPUP_MIN_HEIGHT_PX` from `popupShell.ts` into a non-legacy module (`usePopupPosition.ts` or new helper) and update `mountPopupDictionary`.

### Checkpoint: Phase 1
- [ ] `npm run typecheck` passes
- [ ] `npm run test:unit -- PopupDictionary mountPopupDictionary` passes

### Phase 2: Wire controller callbacks into React popup
- [ ] T069.3: Add `onStatusChange` prop through `PopupDictionary` → `DictionaryPanelView` → `useDictionaryPanel` → `CandidateView`/`useCandidate`.
- [ ] T069.4: Add `onCandidateChange` prop through the same path and call it on chip click / active candidate change.

### Checkpoint: Phase 2
- [ ] `npm run test:unit -- PopupDictionary CandidateView useDictionaryPanel useCandidate` passes

### Phase 3: Migrate `webTextDictionaryController`
- [ ] T069.5: Replace `popupDictionaryController` state calls in `webTextDictionaryController.ts` with `mountPopupDictionary` and the new callbacks.
- [ ] T069.6: Remove `PopupDictionaryState`/`popupDictState` references in `webTextDictionaryController.ts`.

### Checkpoint: Phase 3
- [ ] `npm run test:unit -- webTextDictionaryController` passes
- [ ] `npm run build` passes

### Phase 4: Delete legacy files and flag
- [ ] T069.7: Delete `popupShell.ts`, `popupToolbar.ts`, `popupContent.ts`, `popupDictionary.css`, `popupDictionaryController.ts`, and their tests.
- [ ] T069.8: Remove `USE_LEGACY_POPUP_DICTIONARY` from `featureFlags.ts` and the legacy branch in `mountPopupDictionary.ts`.

### Checkpoint: Phase 4
- [ ] `npm run test:unit` passes
- [ ] `npm run build` and `npx vite build --mode development` pass

### Phase 5: Docs and cleanup
- [ ] T069.9: Update `docs/2-architechture-system.md` tree and function index.
- [ ] T069.10: Update `tasks/todo-content-script-react-shadow-root.md` to mark T069 complete and remove subtasks.

## Risks and mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| `webTextDictionaryController.ts` has deep coupling with legacy popup state | High | Migrate one interaction at a time; keep `onStatusChange`/`onCandidateChange` callbacks to preserve highlight/status behavior. |
| Tests for `popupDictionaryController` may not map 1:1 to React popup | Medium | Delete only after `webTextDictionaryController` tests pass and build is green. |
| Geometry helpers (`clampPopupSize`) currently live in `popupShell.ts` | Low | Extract them in T069.2 before deleting `popupShell.ts`. |
| `PopupCardCreatorPrefill` type imported from `popupDictionaryController` by many files | Low | Move type to `features/dictionaryPopup/types.ts` in T069.1. |
