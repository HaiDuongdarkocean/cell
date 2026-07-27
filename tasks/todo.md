# Dictionary Tab — Copy Floating Popup Visual: Task Checklist

> Ordered by dependency. Each task is S/M-sized and touches ≤5 files.

## Phase 1: State & Prop Foundation

### Task 1 — `useDictionaryPanel` selection, Quick Add, and prefill fallback
- [ ] Add `definitionSelection: Map<string, boolean>` state.
- [ ] Add `toggleDefinition(id, selected)`.
- [ ] Derive `selectedDefinitions` from `definitionSelection` (reuse `getSelectedDefinitions` from `popupContent.ts` if safe).
- [ ] Initialize/reset `definitionSelection` from `def.defaultSelected` on `applyResult` and `setActiveCandidate`.
- [ ] Update `buildPrefill` to use `selectedDefinitions`, falling back to all definitions if none selected.
- [ ] Add `onQuickAdd` option and expose `quickAdd` callback.

**Acceptance criteria:**
- [ ] Selection initializes and resets per-candidate from `defaultSelected`.
- [ ] `sendToCard` and `quickAdd` use selected definitions with fallback to all.
- [ ] `quickAdd` is a no-op when `onQuickAdd` is absent.

**Verification:**
- [ ] `npm run test:unit -- useDictionaryPanel` passes.
- [ ] `npm run typecheck` passes.

**Files:** `useDictionaryPanel.ts`, `useDictionaryPanel.test.ts`, `popupContent.ts` (import only).

---

### Task 2 — Wire `onQuickAdd` through `DictionaryTab` and `DictionaryPanelView`
- [ ] Add `onQuickAdd?: (prefill) => void` to `DictionaryTabProps`.
- [ ] Add `onQuickAdd` to `DictionaryPanelViewProps` and `UseDictionaryPanelOptions`.
- [ ] Forward from `DictionaryTab` → `DictionaryPanelView` → `useDictionaryPanel`.

**Acceptance criteria:**
- [ ] `DictionaryTab` accepts and forwards `onQuickAdd`.
- [ ] `DictionaryPanelView` passes it to `useDictionaryPanel`.
- [ ] Missing `onQuickAdd` does not crash; Quick Add icon will be hidden in Task 4.

**Verification:**
- [ ] `npm run test:unit -- DictionaryTab` passes.
- [ ] `npm run typecheck` passes.

**Files:** `DictionaryTab.tsx`, `DictionaryPanelView.tsx`, `useDictionaryPanel.ts`, `DictionaryTab.test.tsx`.

---

### Task 3 — Load `.btn`/`.icon-btn` global styles
- [ ] `import 'src/shared/styles/components.css'` in `DictionaryPanelView.tsx`.
- [ ] Verify no other React surface imports `components.css`.

**Acceptance criteria:**
- [ ] Global `.btn`/`.icon-btn` classes are available in `DictionaryPanelView`.
- [ ] `components.css` is not imported elsewhere in React code.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.

**Files:** `DictionaryPanelView.tsx`, `components.css` (verification only).

---

### Checkpoint 1: Foundation
- [ ] `npm run test:unit` passes for `useDictionaryPanel` and `DictionaryTab`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.

## Phase 2: Core Popup Layout

### Task 4 — Header markup & CSS (2-row, actions, status, frequency)
- [ ] Remove `.footer` JSX and CSS.
- [ ] Build `.cell-header` Row 1: word, reading/IPA, audio buttons, actions (Send to Card `pencil`, Quick Add `zap`).
- [ ] Build `.cell-header` Row 2: `.cell-header__status` `<button>` and `.cell-header__frequency` split pill.
- [ ] Add all `.cell-header*` CSS classes and responsive `@container` rules.

**Acceptance criteria:**
- [ ] No `.footer` element; actions are in `.cell-header__actions`.
- [ ] Status pill cycles status and has `title` with next status.
- [ ] Frequency pill has source/rank split and five band modifiers.
- [ ] IPA wrapped in `/.../` when applicable.

**Verification:**
- [ ] Render test: `.cell-header__actions` has two icon buttons (`pencil`, `zap`).
- [ ] DevTools compare at 320px and 640px.

**Files:** `DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`.

---

### Task 5 — Candidate chips strip
- [ ] Replace wrapping `Button` flex with `.cell-candidates__chips-scroll`.
- [ ] `.cell-chip` uses `.btn` + `.btn--primary`/`.btn--outline`.
- [ ] Render candidates after the active entry.

**Acceptance criteria:**
- [ ] Chips are in a horizontal scroll strip with hidden scrollbar.
- [ ] Active chip has `aria-current="true"` and `.btn--primary`.
- [ ] Clicking a chip switches candidate and resets definition selection.

**Verification:**
- [ ] `npm run test:unit -- DictionaryTab` passes.
- [ ] DevTools shows horizontal scroll and no wrap.

**Files:** `DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`.

---

### Task 6 — Definitions with dot/checkbox behavior
- [ ] Replace `DefinitionItem` with `.cell-def__item` markup.
- [ ] Add `.cell-def__check` label: hidden checkbox + dot + box + tick.
- [ ] Combine `pos` + `text` in one `<span>`; examples with `• ` prefix.
- [ ] Wire `definitionSelection` and `toggleDefinition`.

**Acceptance criteria:**
- [ ] Unchecked shows dot; hover shows empty checkbox; checked shows filled primary checkbox with white tick.
- [ ] No separate POS badge; `pos` is inline with text.
- [ ] Hidden checkbox remains focusable.

**Verification:**
- [ ] Unit test `toggleDefinition` updates UI state.
- [ ] DevTools hover/focus states match `popupDictionary.css`.

**Files:** `DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`.

---

### Task 7 — Toolbar icon+label tabs
- [ ] Replace `Tabs` from `@/shared/ui` with `.cell-toolbar` of four `<button>` toggles.
- [ ] Use `audioWave`, `image`, `languages`, `link` icons + `.cell-toolbar__label cell-label`.
- [ ] Active tab uses `.btn--primary`; inactive `.btn--ghost`; active click closes.
- [ ] Add `.cell-toolbar__badge` markup (counts from future media selection).

**Acceptance criteria:**
- [ ] Four `.cell-toolbar__tab` buttons with correct icons/labels.
- [ ] Labels hide <480px, show ≥480px; buttons become circular below 480px.
- [ ] `aria-pressed`, `aria-label`, `title` set; active tab toggles off.

**Verification:**
- [ ] Resize container in DevTools; labels hide/show, circle/pill transition.
- [ ] Keyboard/click toggles tab correctly.

**Files:** `DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`.

---

### Checkpoint 2: Core Layout
- [ ] Header, candidates, definitions, and toolbar render with popup BEM classes.
- [ ] `npm run test:unit` passes for `useDictionaryPanel` and `DictionaryTab`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.

## Phase 3: Tab Panels & Responsive

### Task 8 — Tab content panels (empty/skeleton states)
- [ ] Restyle `AudioPanel` with `.cell-audio` empty/skeleton.
- [ ] Restyle `ImagePanel` with `.cell-image` skeleton strip + empty link.
- [ ] Restyle `TranslatePanel` with `.cell-translate` blocks + empty button.
- [ ] Restyle `LinksPanel` with `.cell-links` chips + empty button.
- [ ] Do not add live data fetching.

**Acceptance criteria:**
- [ ] Audio panel empty state matches popup (icon, title, "Use system TTS").
- [ ] Image panel skeleton/empty match popup (8 placeholders or Google Images link).
- [ ] Translate panel skeleton/empty match popup (`Translate to {targetLang}`).
- [ ] Links panel chips/empty match popup (`Open settings`).

**Verification:**
- [ ] Visual compare each panel with floating popup at 320px and 640px.
- [ ] `npm run test:unit` passes.

**Files:** `DictionaryPanelView.tsx`, `DictionaryPanelView.module.css`.

---

### Task 9 — Search row, container queries, and reduced motion
- [ ] Wrap search row in `.searchRow` above popup-clone content.
- [ ] Remove global horizontal padding from `.dictionaryPanel`; add `container-type: inline-size`.
- [ ] Copy `@container` tiers (compact <380, narrow 380–479, default ≥480, wide ≥768) from `popupDictionary.css`.
- [ ] Copy `<480px` touch-target overrides for `.btn`/`.icon-btn`.
- [ ] Add `user-select: text` and `prefers-reduced-motion` block.

**Acceptance criteria:**
- [ ] `.dictionaryPanel` has `container-type: inline-size` and no global horizontal padding.
- [ ] Search row has independent padding and does not break container queries.
- [ ] Breakpoints match popup at 320/375/414/480/640/768px+.
- [ ] Touch targets ≥44px for `.btn`/`.icon-btn--sm`/`--xs` below 480px (header audio exempt).

**Verification:**
- [ ] DevTools container resize shows label/padding/touch-target changes.
- [ ] `npm run build` and `npm run typecheck` pass.

**Files:** `DictionaryPanelView.module.css`, `DictionaryPanelView.tsx` (search-row wrapper only).

---

### Checkpoint 3: Panels & Responsive
- [ ] All four tab panels match popup empty/skeleton states.
- [ ] Container queries produce identical layouts across breakpoints.
- [ ] `npm run typecheck` and `npm run build` pass.

## Phase 4: Tests & Final Verification

### Task 10 — Update unit and render tests
- [ ] Update `useDictionaryPanel.test.ts` for selection, fallback, and `quickAdd`.
- [ ] Update `DictionaryTab.test.tsx` for footer removal, header status cycle, `onQuickAdd`.
- [ ] Add/extend `DictionaryPanelView.test.tsx` for header actions, checkboxes, candidate strip, toolbar.

**Acceptance criteria:**
- [ ] `useDictionaryPanel` tests cover selection init, toggle, fallback, `quickAdd`.
- [ ] `DictionaryTab` tests pass with new `onQuickAdd` and no footer.
- [ ] `DictionaryPanelView` tests cover no footer, header actions, definitions, candidates, toolbar.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run typecheck` passes.

**Files:** `useDictionaryPanel.test.ts`, `DictionaryTab.test.tsx`, `DictionaryPanelView.test.tsx`.

---

### Task 11 — Final build, typecheck, and manual visual comparison
- [ ] Run `npm run typecheck`, `npm run test:unit`, `npm run build`.
- [ ] Load extension and compare integrated panel vs floating popup at 320/375/414/480/640/768px+.
- [ ] Capture DevTools/MCP screenshots.

**Acceptance criteria:**
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` all pass.
- [ ] No visual drift vs floating popup at all tested widths.

**Verification:**
- [ ] Build artifacts generated.
- [ ] MCP/DevTools screenshots confirm visual match.

**Files:** Optional `docs/test-reports/dictionary-tab-copy-popup-visual-mcp.md`.

---

### Checkpoint Final: Complete
- [ ] All spec acceptance criteria met.
- [ ] `npm run typecheck`, `npm run test:unit`, and `npm run build` pass.
- [ ] Manual visual comparison confirms match at 320/375/414/480/640/768px+.
- [ ] `tasks/plan.md`, `tasks/todo.md`, and `docs/0-wiki.md` are updated.

---

## Phase 5: Cluster Send-to-Card → Integrated Card Creator + Queue + UI Polish

### Task 1 — Extend `DictionaryPanelPrefill` type
- [ ] Add `video`, `cue`, `initialMedia`, `queue`, `initialAction` to `DictionaryPanelPrefill`.
- [ ] Update `UniversalPanelController.sendToCard` signature.

**Acceptance criteria:**
- [ ] `DictionaryPanelPrefill` is a strict superset of `PopupCardCreatorPrefill`.
- [ ] `npm run typecheck` passes.

**Files:** `src/features/universalPanel/types.ts`.

---

### Task 2 — Add `sendToCard` to `webTextDictionaryController`
- [ ] Implement `sendToCard(context, action?)` that routes to `panelController` if present.
- [ ] Fall back to standalone `openCardCreator` when panel is absent.
- [ ] Expose `sendToCard` on `WebTextDictionaryController` interface.

**Acceptance criteria:**
- [ ] Popup `sendToCard` still keeps popup open.
- [ ] Cluster `edit-card` can be routed to panel.
- [ ] `npm run test:unit -- webTextDictionaryController` passes.

**Files:** `webTextDictionaryController.ts`, `webTextDictionaryController.test.ts`.

---

### Task 3 — Route cluster `edit-card` / `update-current` to panel
- [ ] Replace `sharedWebTextCtrl.openCardCreator` with `sharedWebTextCtrl.sendToCard` in `handleCardCreatorAction`.
- [ ] Pass full `OpenContext` including `initialMedia` and `queue`.
- [ ] Keep `quick-update` as batch quick-add.

**Acceptance criteria:**
- [ ] Cluster `edit-card` opens integrated panel.
- [ ] `update-current` opens integrated panel with `initialAction='quick-update'`.
- [ ] `npm run test:unit -- contentScriptController` passes.

**Files:** `contentScriptController.ts`.

---

### Task 4 — Propagate extended context through `mountUniversalPanel`
- [ ] Rename `pendingPrefill` → `pendingCardCreatorContext`.
- [ ] Forward `cardCreatorContext` to `DictionaryTab`.
- [ ] Derive `pendingSearchTerm` from `context.term`.

**Acceptance criteria:**
- [ ] Popup `sendToCard` still works.
- [ ] `npm run test:unit -- mountUniversalPanel` passes.

**Files:** `mountUniversalPanel.ts`, `mountUniversalPanel.test.tsx`.

---

### Task 5 — `CardCreatorPanel` builds full `OpenContext`
- [ ] Accept `cardCreatorContext` prop.
- [ ] Map popup prefill fields into `OpenContext.prefill`.
- [ ] Pass `video`, `cue`, `initialMedia`, `queue`, `initialAction` into `useCardCreatorState`.

**Acceptance criteria:**
- [ ] `initialAction` focuses Update button.
- [ ] Queue reaches `useCardCreatorState`.
- [ ] `npm run test:unit -- CardCreatorPanel` passes.

**Files:** `CardCreatorPanel.tsx`, `CardCreatorPanel.test.tsx`.

---

### Task 6 — Add `layout="panel"` to `CardCreatorDialogContent`
- [ ] Add `layout?: 'dialog' | 'panel'` prop.
- [ ] Add panel-specific CSS classes (no dialog `max-height`, body scrolls).
- [ ] Keep existing dialog layout unchanged.

**Acceptance criteria:**
- [ ] Panel layout fills right pane without nested scrollers.
- [ ] `npm run test:unit -- CardCreatorDialogContent` passes.

**Files:** `CardCreatorDialogContent.tsx`, `CardCreatorDialog.module.css`, `CardCreatorPanel.module.css`.

---

### Task 7 — Panel header + queue toggle
- [ ] Render compact "Card Creator" panel header when `layout='panel'`.
- [ ] Show queue toggle when `queueItems.length >= 2`.
- [ ] Toggle opens/closes `QueueSidebar`.

**Acceptance criteria:**
- [ ] Header visible; toggle works.
- [ ] No visual regression in dialog layout.

**Files:** `CardCreatorDialogContent.tsx`, `CardCreatorDialog.module.css`.

---

### Task 8 — Polish panel scroll layout + queue sidebar
- [ ] Ensure one scroller per pane (body + sidebar, not outer panel).
- [ ] Verify 320px / 768px / 1280px.
- [ ] Use `--space-*` tokens only.

**Acceptance criteria:**
- [ ] No nested vertical scrollers.
- [ ] No clipped content.
- [ ] `npm run build` + DevTools MCP pass.

**Files:** `CardCreatorPanel.module.css`, `QueueSidebar.module.css`, `CardCreatorDialog.module.css`.

---

### Task 9 — UI improvements (scope TBD)
- [ ] Clarify with user which areas to polish.
- [ ] Implement agreed polish.
- [ ] Verify with DevTools MCP and unit tests.

**Acceptance criteria:**
- [ ] Polished UI approved by user.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` pass.

**Files:** TBD.

---

### Checkpoint Final: Routing + Queue + UI
- [ ] Cluster `edit-card` and `update-current` open integrated panel.
- [ ] I+N queue renders and works in integrated panel.
- [ ] UI improvements verified.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` pass.
- [ ] `docs/2-architechture-system.md` updated for touched files.
- [ ] `tasks/plan.md`, `tasks/todo.md`, `docs/0-wiki.md` updated.
