# Universal Orbital Panel — Task Checklist

## Phase 0 — Foundation & Contracts

- [x] Task 0.1: Add `book-open` icon to `ICON_CATALOG`
- [x] Task 0.2: Add `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`
- [x] Task 0.3: Create `features/universalPanel/` skeleton and types
- [x] Task 0.4: Extract `SettingsDialogContent` from `SettingsDialog`
- [x] Task 0.5: Refactor orbital badge click-outside and panel toggle
- [x] Checkpoint 0: typecheck + test:unit + build pass; verifier signs off

## Phase 1 — Universal Panel Shell

- [x] Task 1.1: Implement `mountUniversalPanel.ts`
- [x] Task 1.2: Implement `UniversalPanel.tsx` + `UniversalPanel.module.css`
- [x] Task 1.3: Implement `UniversalPanelController.ts` + tests
- [x] Task 1.4: Wire orbital badge to `mountUniversalPanel`
- [x] Checkpoint 1: panel opens/closes, tab switching, focus, mobile layout, tests pass

## Phase 2 — Settings Tab

- [x] Task 2.1: Implement `SettingsTab.tsx` + `SettingsTab.module.css`
- [x] Task 2.2: Update `SettingsDialog`/`SettingsDialogContent` `onOpenDictionary` behavior
- [x] Checkpoint 2: Settings tab renders, Open Dictionary switches tab

## Phase 3 — Dictionary Left Pane

- [ ] Task 3.1: Implement `useDictionaryPanel.ts`
- [ ] Task 3.2: Implement `DictionaryPanelView.tsx` + `DictionaryPanelView.module.css`
- [ ] Task 3.3: Implement `DictionaryTab.tsx` + `DictionaryTab.module.css`
- [ ] Task 3.4: Focus search input on Dictionary tab open
- [ ] Checkpoint 3: search lookup renders, definitions/tabs/footer visible

## Phase 4 — Card Creator Right Pane

- [ ] Task 4.1: Implement `CardCreatorPanel.tsx`
- [ ] Task 4.2: Wire `DictionaryTab` to `CardCreatorPanel` with prefill
- [ ] Checkpoint 4: Send to Card populates card creator, media captured

## Phase 5 — External Popup Integration

- [ ] Task 5.1: Add `stayOpen` flag to popup card-creator action
- [ ] Task 5.2: Add external-popup → universal panel bridge
- [ ] Task 5.3: Handle Quick Add from external popup to universal panel
- [ ] Checkpoint 5: popup Send to Card updates panel and popup stays open

## Phase 6 — Mobile & Responsive Refinement

- [ ] Task 6.1: Implement mobile bottom-sheet layout
- [ ] Task 6.2: Implement card creator secondary bottom sheet on mobile
- [ ] Task 6.3: Responsive verification at breakpoints
- [ ] Checkpoint 6: mobile layout verified in DevTools

## Phase 7 — Final Verification, Refinement, Documentation

- [x] Task 7.1: Run full verification suite (typecheck, test:unit, build)
- [ ] Task 7.2: Manual browser verification with DevTools
- [ ] Task 7.3: Adversarial spec acceptance review
- [ ] Task 7.4: Fix gaps and rerun verification until all SA pass
- [x] Task 7.5: Update `docs/2-architechture-system.md`
- [ ] Checkpoint 7: all SA pass, docs updated, build green
