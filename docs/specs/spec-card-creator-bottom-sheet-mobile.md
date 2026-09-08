# Spec: Card Creator Mobile Bottom Sheet in Dictionary Tab

> Status: Draft / pending implementation  
> Scope: `src/features/universalPanel/tabs/DictionaryTab`, `src/features/cardCreator`, `src/features/dictionaryPopup`, `src/shared/ui/BottomSheet`  
> Related specs: `universal-panel-redesign.md`  

## Objective

Redesign the **mobile layout of the `Dictionary` tab** inside the Universal Panel so that:

1. `Dictionary` (lookup) owns the full screen.
2. `CardCreatorPanel` lives in a **draggable bottom sheet** with snap points (`56px`, `50%`, `100%`).
3. The integrated `Dictionary` is a full clone/mirror of the popup `Dictionary` state, including selected media, definitions, audio, and translations.
4. Resending from the integrated `Dictionary` performs a **diff/merge** against the Card Creator draft instead of appending.
5. The draft survives closing and reopening the Universal Panel (autosave).
6. `Add` / `Update` adds/updates the card **and closes the panel**. `Close` / `ESC` closes without losing the draft.

### User stories

1. **Mobile lookup → create card**: User taps a word in subtitles → popup `Dictionary` opens → taps **sendToCard** → Universal Panel opens on `Dictionary` tab, showing the same candidate and selected media → `CardCreator` bottom sheet peeks at the bottom → user drags it up, edits, taps **Add** → panel closes, toast shows.
2. **Integrated lookup → create card**: User opens Universal Panel → `Dictionary` tab → searches a word → taps **sendToCard** → bottom sheet opens with prefilled data → user edits → **Add** → panel closes.
3. **Reselect and resend**: User selects 2/8 images → sendToCard → later opens the same candidate in `Dictionary`, deselects image 1, keeps image 2, adds images 3 and 4 → taps **sendToCard** → `CardCreator` image collection becomes `[2, 3, 4]`.
4. **Draft persistence**: User closes panel before tapping Add → reopens it later → the same word and selected media are still in `Dictionary`; the bottom sheet still holds the unsaved draft.

### Non-goals / Out of scope

- SRS Ocean destination is **not implemented** in this spec; only the existing AnkiConnect path is in scope. The UI will be designed to allow an `SRS Ocean` toggle later without structural changes.
- No changes to desktop (`> 839px`) two-pane layout, except where it shares CSS/JS with mobile.
- No new dependencies.
- No changes to the standalone popup `CardCreatorDialog` shell unless required for shared state.

---

## Assumptions

1. The existing `BottomSheet` component (`src/shared/ui/BottomSheet`) can be extended with snap points and a drag handle, or a new `Sheet` wrapper is created for this use case.
2. The `useCandidate` hook in `src/features/dictionaryPopup/ui/useCandidate.ts` is the source of truth for selected definitions, images, audio, and translations in both popup and integrated `Dictionary`.
3. The `DraftAutosaver` in `src/features/cardCreator/state/cardDraft.ts` already persists the card draft to `chrome.storage.local` and can restore it.
4. The `UniversalPanelController` API (`open`, `close`, `sendToCard`) remains stable; only how `DictionaryTab` renders and consumes `prefill` changes.

---

## Tech Stack

- React 18 + TypeScript
- CSS Modules
- Existing shared UI: `BottomSheet`, `Button`, `Icon`, `CardCreatorDialogContent`, `Dictionary`, `CardCreatorPanel`
- State: `useCardCreatorState`, `cardDraft`, `useCardCreatorStore`

---

## Commands

```text
Dev server:  npm run dev
Build:       npm run build
Type check:  npm run typecheck
Lint:        npm run lint
Unit tests:  npm run test:unit -- --testPathPatterns "cardCreator|CardCreator|universalPanel|dictionaryPopup"
Showcase:    http://localhost:5180/showcase/Universal%20Panel%20Page?viewport=390
```

---

## Project Structure

```text
src/features/universalPanel/tabs/
  ├── DictionaryTab.tsx                # MODIFY: layout, sheet integration, clone sync
  ├── DictionaryTab.module.css         # MODIFY: mobile bottom sheet layout
  ├── CardCreatorPanel.tsx             # MODIFY: wrap body in sheet, handle close on submit
  ├── CardCreatorPanel.module.css      # MODIFY: sheet-specific styles
  └── CardCreatorPanel.test.tsx        # MODIFY/NEW

src/features/cardCreator/
  ├── ui/useCardCreatorState.ts        # MODIFY: diff/merge prefill, restore draft, close panel after submit
  ├── state/cardDraft.ts               # MODIFY/REVIEW: DraftAutosaver persistence
  ├── ui/CardCreatorDialogContent.tsx  # REVIEW: trigger panel close from Add/Update
  └── ui/CardCreatorDialogContent.module.css  # REVIEW

src/features/dictionaryPopup/
  ├── ui/DictionaryPanelView.tsx       # MODIFY: accept selected-state props
  ├── ui/Dictionary.tsx                # MODIFY/REVIEW: forward clone state
  ├── ui/CandidateView.tsx             # MODIFY: accept external selected state
  ├── ui/useCandidate.ts               # REVIEW: ensure selection state can be controlled
  ├── ui/buildCandidatePrefill.ts      # REVIEW: ensure selected items are exported
  └── controller/webTextDictionaryController.ts  # MODIFY: pass selected state to panel, not just prefill

src/shared/ui/
  ├── BottomSheet.tsx                  # MODIFY/NEW: snap points, drag handle, pill toggle
  └── BottomSheet.module.css           # MODIFY/NEW
```

---

## Code Style

- CSS Modules only; no inline styles.
- Use existing tokens (`--space-*`, `--radius-*`, `--color-*`, `--duration-*`).
- Prefer existing shared UI components (`Button`, `Icon`, `BottomSheet`) over custom markup.
- Keep `data-cell-id` attributes for testability.
- Mobile-first media queries; touch targets `>= 44px`.

Example class naming:

```css
.dictionaryTab {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dictionaryTab__dictionary {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.dictionaryTab__sheet {
  position: relative;
  flex: 0 0 auto;
}
```

---

## Testing Strategy

- **Unit tests**: Update `CardCreatorPanel.test.tsx`, `FieldRow.test.tsx`, `useCardCreatorState.test.ts`, `DictionaryTab.test.tsx`.
- **Integration tests**: Verify `sendToCard` from popup controller opens panel and sets prefill; verify diff/merge of image/audio/definition collections.
- **Manual verification**: Use the `Universal Panel Page` showcase at `viewport=390`:
  - Dictionary is full screen.
  - Bottom sheet peeks at 56px.
  - Drag/tap pill opens/closes sheet.
  - `Add`/`Update` closes the panel.
  - Reopen restores draft and selections.
- **Build/typecheck/lint**: Required before commit.

---

## Boundaries

- **Always do**: update existing spec if scope changes; run `typecheck`, `lint`, `build`; preserve `data-cell-id`; keep mobile and desktop layouts behind the same `839px` breakpoint.
- **Ask first**: adding new dependencies; changing `UniversalPanelController` API; adding new `chrome` permissions; altering AnkiConnect payload.
- **Never do**: commit secrets; hardcode hex colors outside `tokens.css`; remove failing tests; change `manifest.json` without justification.

---

## Success Criteria

1. At mobile (`<= 839px`), the `Dictionary` tab shows `Dictionary` full height and `CardCreatorPanel` as a bottom sheet with a pill drag handle.
2. The sheet supports three snap points: `56px`, `50%`, `100%` of container height.
3. Tapping the pill toggles the sheet between collapsed and the last open snap point.
4. Dragging the pill resizes the sheet; releasing it snaps to the nearest point.
5. `sendToCard` from popup `Dictionary` opens the Universal Panel `Dictionary` tab and the integrated `Dictionary` mirrors the popup candidate and selected media.
6. `sendToCard` from the integrated `Dictionary` resends the same or updated selection to `CardCreator`.
7. When `sendToCard` is called a second time with different media/field selections, `CardCreator` updates its input collections by diff/merge (add new, keep kept, remove deselected).
8. The `CardCreator` draft is autosaved and restored after the panel is closed and reopened, even if `Add`/`Update` was not pressed.
9. Pressing `Add` or `Update` submits the card and closes the Universal Panel.
10. Pressing `Close` or `ESC` closes the panel without losing the saved draft.

---

## Definition of Done

- [ ] All acceptance criteria above pass.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test:unit -- --testPathPatterns "cardCreator|CardCreator|universalPanel|dictionaryPopup"` passes.
- [ ] `npm run build` passes.
- [ ] Manual showcase verification at `viewport=390` succeeds.
- [ ] No hardcoded values outside tokens.
- [ ] ADR or spec note added for the diff/merge decision if it introduces non-trivial logic.
- [ ] `tasks/todo-card-creator-bottom-sheet.md` and `tasks/plan-card-creator-bottom-sheet.md` updated/closed.

---

## Open Questions

1. Should the bottom sheet also replace the **desktop** `rightPane`, or only mobile?
2. What should the **56px peek header** display when the sheet is collapsed? (e.g., "Create card — {term}" + pencil icon)
3. Should the `quick-add` initial action still auto-submit and close the panel, or should it also open the sheet?
4. How should SRS Ocean be represented in the UI once supported? (toggle, separate button, destination select)
