# Implementation Plan: Dictionary Tab — Copy Floating Popup Visual Exactly

## Overview

Make the integrated `DictionaryTab` left pane (`DictionaryPanelView`) visually identical to the floating dictionary popup, while keeping it mounted inside `UniversalPanel` and preserving the functional search row. The work is a visual/structural copy in two primary files — `DictionaryPanelView.tsx` and `DictionaryPanelView.module.css` — plus additive state wiring in `useDictionaryPanel.ts`, prop forwarding in `DictionaryTab.tsx`, and focused unit-test updates.

## Architecture Decisions

- **Quick Add wiring**: `DictionaryTab` receives a new optional `onQuickAdd` prop and forwards it to `DictionaryPanelView` / `useDictionaryPanel` (mirrors `onSendToCard`). If `onQuickAdd` is absent, the header `Quick Add` (`zap`) icon is hidden.
- **Definition selection**: per-candidate. `definitionSelection` is initialized from each candidate's `defaultSelected` and is reset to the new candidate's defaults whenever `setActiveCandidate` switches candidates.
- **Shared button/icon classes**: raw `.btn` / `.icon-btn` classes from `src/shared/styles/components.css` are made available by importing `components.css` globally in `DictionaryPanelView.tsx`. These global classes are not used in other React surfaces.
- **Search row placement**: stays as a separate block above the popup-clone content; it is not merged into the popup header.
- **Tab panel data**: Audio/Image/Translate/Links panels render empty/skeleton states that match the popup visually; live fetching via `FETCH_COMMUNITY_AUDIO`, `FETCH_IMAGES`, `TRANSLATE`, `TTS_FETCH_AUDIO` is out of scope for this copy pass.
- **Checkbox affordance**: keep the exact popup touch/hover behavior — unchecked definitions show a dot; hover swaps the dot for an empty checkbox border; checked shows a primary-filled checkbox with a white tick.
- **Prefill fallback**: `sendToCard` and `quickAdd` build the prefill from `selectedDefinitions`; if no definition is selected, fall back to all definitions (matching `popupDictionaryController.ts` `buildPopupPrefill` lines 560–565).
- **Source-of-truth reuse**: reuse the pure helpers `initDefinitionSelection` / `getSelectedDefinitions` from `popupContent.ts` lines 336–351 instead of duplicating them, if importing them into a React hook is safe.
- **Container queries**: copy the popup's `@container` tiers (compact <380px, narrow 380–479px, default ≥480px, wide ≥768px) from `popupDictionary.css` into `DictionaryPanelView.module.css`, with `container-type: inline-size` on `.dictionaryPanel` and no global horizontal padding.
- **Boundaries**: do not modify the floating popup implementation (`popupShell.ts`, `popupContent.ts`, `popupDictionary.css`, `popupToolbar.ts`, `popupDictionaryController.ts`), the `UniversalPanel` layout, or `DictionaryTab.module.css`.

## Task List

### Phase 1: State & Prop Foundation

#### Task 1: Add definition selection, Quick Add, and prefill fallback to `useDictionaryPanel`

**Description:** Extend the hook with a `Map<string, boolean>` definition selection, `toggleDefinition`, a `selectedDefinitions` derived array, and a `quickAdd` action. Initialize/reset selection on every `applyResult` and `setActiveCandidate` from `def.defaultSelected`. Update `buildPrefill` to prefer selected definitions and fall back to all if none are selected.

**Acceptance criteria:**
- [ ] `definitionSelection` initializes from the current result's `definitions.map(def => [def.id, def.defaultSelected])`.
- [ ] Switching candidates via `setActiveCandidate` re-initializes `definitionSelection` from the new candidate's defaults.
- [ ] `toggleDefinition` updates the map and `selectedDefinitions` re-derives correctly.
- [ ] `sendToCard` builds a prefill using `selectedDefinitions`, falling back to `result.definitions` when `selectedDefinitions` is empty.
- [ ] `quickAdd` builds the same prefill and calls `options.onQuickAdd` if provided; if absent, it is a no-op.

**Verification:**
- [ ] `npm run test:unit -- useDictionaryPanel` passes after adding tests for selection init, toggle, fallback, and `quickAdd`.
- [ ] `npm run typecheck` passes.

**Dependencies:** None.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/useDictionaryPanel.ts`
- `src/features/dictionaryPopup/ui/useDictionaryPanel.test.ts`
- `src/features/dictionaryPopup/ui/popupContent.ts` (pure helper import only)

**Estimated scope:** M.

#### Task 2: Wire `onQuickAdd` prop through `DictionaryTab` and `DictionaryPanelView`

**Description:** Add optional `onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void` to `DictionaryTabProps`, `DictionaryPanelViewProps`, and `UseDictionaryPanelOptions`. Forward it from `DictionaryTab` → `DictionaryPanelView` → `useDictionaryPanel`.

**Acceptance criteria:**
- [ ] `DictionaryTab` accepts and forwards `onQuickAdd` to `DictionaryPanelView`.
- [ ] `DictionaryPanelView` passes `onQuickAdd` into `useDictionaryPanel`.
- [ ] When `onQuickAdd` is absent, `useDictionaryPanel.quickAdd` is a safe no-op and the view hides the Quick Add icon.

**Verification:**
- [ ] `npm run test:unit -- DictionaryTab` passes (update/retain existing tests; no crash when `onQuickAdd` omitted).
- [ ] `npm run typecheck` passes.

**Dependencies:** Task 1.

**Files likely touched:**
- `src/features/universalPanel/tabs/DictionaryTab.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/useDictionaryPanel.ts` (prop option already changed in Task 1)
- `src/features/universalPanel/tabs/DictionaryTab.test.tsx`

**Estimated scope:** S/M.

#### Task 3: Load `.btn`/`.icon-btn` global styles in `DictionaryPanelView.tsx`

**Description:** Import `src/shared/styles/components.css` in `DictionaryPanelView.tsx` so the popup's raw `.btn` / `.icon-btn` classes and variants are available. Confirm no other React surface imports this file.

**Acceptance criteria:**
- [ ] `components.css` is imported once at the top of `DictionaryPanelView.tsx`.
- [ ] Classes `.btn`, `.btn--primary`, `.btn--outline`, `.btn--ghost`, `.icon-btn`, `.icon-btn--xs`, `.icon-btn--sm`, `.icon-btn--outlined`, `.icon-btn--filled` can be applied and computed in the panel.
- [ ] No other `*.tsx` file in `src/` imports `components.css`.

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] Build succeeds.

**Dependencies:** None.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/shared/styles/components.css` (no edit; verification only)

**Estimated scope:** XS.

### Checkpoint 1: Foundation

- [ ] `npm run test:unit` passes for `useDictionaryPanel` and `DictionaryTab`.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.

### Phase 2: Core Popup Layout

#### Task 4: Header markup and CSS (2-row, actions, status, frequency)

**Description:** Replace the current `header`/`footer` blocks with the popup's 2-row header. Row 1: `.cell-header__word`, `.cell-header__reading`/`.cell-header__ipa`, `.cell-header__audio-group` (word/sentence audio), `.cell-header__actions` (`pencil` Send to Card, `zap` Quick Add). Row 2: `.cell-header__second` containing `.cell-header__status` as a real `<button>` and `.cell-header__frequency` split pill. Delete the `.footer` JSX and CSS.

**Acceptance criteria:**
- [ ] No `.footer` element is rendered; `Send to Card` and `Quick Add` live in `.cell-header__actions` in Row 1.
- [ ] Row 1 matches `.cell-header__row` / `.cell-header__main` / `.cell-header__word-row` / `.cell-header__reading` structure.
- [ ] Row 2 matches `.cell-header__second` with `.cell-header__status` and `.cell-header__frequency`.
- [ ] Status pill shows four modifiers (`--unknown`, `--tracking`, `--known`, `--ignore`) and `title` shows `Click to cycle: {current} → {next}`.
- [ ] Frequency pill is split into `.cell-header__frequency-source` and `.cell-header__frequency-rank` with five band modifiers.
- [ ] IPA is wrapped with `/.../` when `readingKind === 'ipa'` and not already slashed.

**Verification:**
- [ ] Render test asserts `.cell-header__actions` contains two icon buttons (`pencil` and `zap`).
- [ ] Manual DevTools: header layout matches floating popup at 320px and 640px effective widths.

**Dependencies:** Tasks 2 and 3.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

**Estimated scope:** M.

#### Task 5: Candidate chips strip

**Description:** Replace the wrapping `Button` flex with a horizontal scroll strip: `.cell-candidates` > `.cell-candidates__chips` > `.cell-candidates__chips-scroll` > `.cell-chip`. Each chip is a `.btn` + `.btn--primary` (active) or `.btn--outline` (inactive). Render candidates after the active entry.

**Acceptance criteria:**
- [ ] Candidate chips render inside `.cell-candidates__chips-scroll` with `overflow-x: auto` and hidden webkit scrollbar.
- [ ] Active chip has `aria-current="true"` and uses `.btn--primary`; inactive chips use `.btn--outline`.
- [ ] Clicking a chip calls `setActiveCandidate` and resets `definitionSelection`.

**Verification:**
- [ ] `npm run test:unit -- DictionaryTab` passes for candidate switching.
- [ ] DevTools shows horizontal scroll and no wrap.

**Dependencies:** Tasks 1 and 4.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

**Estimated scope:** S.

#### Task 6: Definitions with dot/checkbox behavior

**Description:** Replace the current `DefinitionItem` with the popup clone: `.cell-def` list, `.cell-def__item`, `.cell-def__check` `<label>` wrapping a hidden checkbox, dot, empty box, and tick. Combine `pos` and `text` into a single `<span>`. Render examples as `<div>` with a `• ` prefix under `.cell-def__examples`. Wire `definitionSelection` and `toggleDefinition`.

**Acceptance criteria:**
- [ ] Each definition has `.cell-def__check` containing a visually hidden `input[type="checkbox"]` plus `.cell-def__check-dot`, `.cell-def__check-box`, `.cell-def__check-tick`.
- [ ] Unchecked: dot visible, box hidden. Hovered unchecked: dot hidden, empty box visible. Checked: filled primary box with white tick visible.
- [ ] `pos` and `text` are rendered in one `<span class="cell-def__text">`, not a separate POS badge.
- [ ] Examples render under `.cell-def__examples` with `• ` prefix.
- [ ] Hidden checkbox remains focusable; `focus-visible` outlines `.cell-def__check-box`.

**Verification:**
- [ ] Unit tests assert `toggleDefinition` updates UI state.
- [ ] DevTools computed styles and hover states match `popupDictionary.css` lines 422–547.

**Dependencies:** Tasks 1 and 3.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

**Estimated scope:** M.

#### Task 7: Toolbar icon+label tabs

**Description:** Replace `Tabs` from `@/shared/ui` with a custom `.cell-toolbar` of four `<button>` toggles (`audioWave`, `image`, `languages`, `link`). Each has an icon, `.cell-toolbar__label cell-label`, and optional `.cell-toolbar__badge`. Active tab uses `.btn--primary`; inactive uses `.btn--ghost`. Clicking the active tab closes it. Labels hide below 480px and show at/above 480px.

**Acceptance criteria:**
- [ ] Toolbar renders four `.cell-toolbar__tab` buttons with correct icons and labels.
- [ ] Active tab has `aria-pressed="true"`, `title`, and `aria-label`.
- [ ] `.cell-label` is hidden by default and shown at container width ≥480px; below 480px `.btn:has(.cell-label)` becomes a circle.
- [ ] Clicking active tab sets `activeTab` to `null`; clicking inactive tab opens it.

**Verification:**
- [ ] Resize container in DevTools: labels hide/show and buttons switch between circle and pill.
- [ ] Keyboard/click interaction toggles panels correctly.

**Dependencies:** Tasks 3 and 4.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

**Estimated scope:** M.

### Checkpoint 2: Core Layout

- [ ] Header, candidates, definitions, and toolbar all render using popup BEM classes and behavior.
- [ ] `npm run test:unit` passes for updated `useDictionaryPanel` and `DictionaryTab` tests.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` succeeds.

### Phase 3: Tab Panels & Responsive

#### Task 8: Tab content panels — empty/skeleton states

**Description:** Restyle the `AudioPanel`, `ImagePanel`, `TranslatePanel`, and `LinksPanel` helpers to match the popup's empty and skeleton states: `.cell-audio`, `.cell-image`, `.cell-translate`, `.cell-links`. Keep existing wiring for translate/result and external links; do not add live audio/image fetching.

**Acceptance criteria:**
- [ ] Audio panel shows `.cell-audio` empty state with icon, title "No audio available", and "Use system TTS" button; skeleton markup matches popup.
- [ ] Image panel shows `.cell-image__skeleton` strip with 8 placeholders or `.cell-image__empty` "No images · Search Google →".
- [ ] Translate panel shows `.cell-translate__skeleton-block` or empty "No translation" with `Translate to {targetLang}` button; selected block uses `.cell-translate__block--selected`.
- [ ] Links panel shows `.cell-links__item` chips or empty "No external links" with "Open settings" button.

**Verification:**
- [ ] Visual compare each open panel with the floating popup at 320px and 640px.
- [ ] `npm run test:unit` passes for `DictionaryTab` translate/links tests.

**Dependencies:** Task 7.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`

**Estimated scope:** M.

#### Task 9: Search row, container queries, and reduced motion

**Description:** Wrap the search row in `.searchRow` as a separate block above the popup-clone content. Remove global padding from `.dictionaryPanel`, add `container-type: inline-size`, and copy the popup's `@container` tiers and `<480px` button/icon touch-target overrides from `popupDictionary.css` into the CSS module. Add `user-select: text` and the reduced-motion block.

**Acceptance criteria:**
- [ ] `.dictionaryPanel` has `container-type: inline-size` and no horizontal padding that would break container-query widths.
- [ ] `.searchRow` has its own padding and sits above `.cell-active-entry`/`.cell-materials` content.
- [ ] `@container` breakpoints are present: compact (<380px base), narrow (380–479px), default (≥480px), wide (≥768px).
- [ ] At container width <480px, `.btn`, `.icon-btn--sm`, `.icon-btn--xs` meet 44px touch targets; header audio buttons remain exempt at `0.4 * touch-target`.
- [ ] `prefers-reduced-motion` disables panel transitions/animations.
- [ ] Text is selectable (`user-select: text`).

**Verification:**
- [ ] DevTools container resize shows label hide/show, padding expansion, and touch-target growth.
- [ ] `npm run build` and `npm run typecheck` pass.

**Dependencies:** Tasks 4–8.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx` (search-row wrapper only)

**Estimated scope:** M.

### Checkpoint 3: Panels & Responsive

- [ ] All four tab panels match the popup's empty/skeleton states visually.
- [ ] Container queries produce identical layouts at 320/375/414/480/640/768px+.
- [ ] `npm run typecheck` and `npm run build` pass.

### Phase 4: Tests & Final Verification

#### Task 10: Update unit and render tests

**Description:** Update `useDictionaryPanel.test.ts` for selection, `sendToCard` fallback, and `quickAdd`. Update `DictionaryTab.test.tsx` for footer removal, status-cycle header, and `onQuickAdd` prop. Add/extend `DictionaryPanelView` render tests for no footer, header actions, definition checkboxes, candidate scroll, and toolbar labels.

**Acceptance criteria:**
- [ ] `useDictionaryPanel.test.ts` covers `definitionSelection` initialization, `toggleDefinition`, `selectedDefinitions`, `sendToCard` fallback, and `quickAdd` callback.
- [ ] `DictionaryTab.test.tsx` no longer expects a `.footer`; status cycle uses header status button; `onQuickAdd` is forwarded.
- [ ] `DictionaryPanelView.test.tsx` (new or extended) asserts no `.footer`, `.cell-header__actions` with two icon buttons, `.cell-def__check` labels, `.cell-candidates__chips-scroll`, and `.cell-toolbar` tabs.

**Verification:**
- [ ] `npm run test:unit` passes.
- [ ] `npm run typecheck` passes.

**Dependencies:** Tasks 1–9.

**Files likely touched:**
- `src/features/dictionaryPopup/ui/useDictionaryPanel.test.ts`
- `src/features/universalPanel/tabs/DictionaryTab.test.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.test.tsx` (new or updated)

**Estimated scope:** M.

#### Task 11: Final build, typecheck, and manual visual comparison

**Description:** Run `npm run typecheck`, `npm run test:unit`, `npm run build`. Load the extension on a test page, open the integrated UniversalPanel, and compare side-by-side with the floating popup at effective widths 320, 375, 414, 480, 640, and 768+. Capture DevTools/MCP screenshots.

**Acceptance criteria:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Manual DevTools comparison shows no visual drift from the floating popup across tested widths.

**Verification:**
- [ ] Build artifacts generated successfully.
- [ ] MCP/DevTools screenshots confirm header, checkboxes, toolbar, candidates, and panels are identical to the popup.

**Dependencies:** Task 10.

**Files likely touched:**
- `docs/test-reports/dictionary-tab-copy-popup-visual-mcp.md` (optional report; no `src/` changes)

**Estimated scope:** S.

### Checkpoint Final: Complete

- [ ] All acceptance criteria from the spec are met.
- [ ] `npm run typecheck`, `npm run test:unit`, and `npm run build` all pass.
- [ ] Manual visual comparison at 320/375/414/480/640/768px+ shows the integrated panel identical to the floating popup.
- [ ] Plan and todo files are updated and `docs/0-wiki.md` reflects them.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Importing `components.css` globally in a React surface could leak styles if other surfaces later import it. | Medium | Document that `components.css` is only for `DictionaryPanelView` in this visual copy; audit imports before final. |
| Large CSS copy from `popupDictionary.css` may accidentally include popup-only floating/shell rules. | Medium | Copy block-by-block and compare selectors; exclude `.cell-popup`, resize, sheet-handle, drag, and fixed-position rules. |
| `getSelectedDefinitions` import from `popupContent.ts` may carry unexpected DOM dependencies. | Low | Verify the helpers are pure; if not, inline the same logic in `useDictionaryPanel.ts`. |
| Definition selection reset on candidate switch may feel lossy to users. | Low | Match popup behavior; document per-candidate reset in the plan and tests. |
| Container query widths depend on `.dictionaryPanel` not receiving padding from parent. | Medium | Remove `.dictionaryPanel` padding and use per-section padding; verify in `DictionaryTab.module.css` layout. |
| Header audio buttons are intentionally below 44px; accessibility audit may flag them. | Low | Keep popup's intentional `0.4 * touch-target` sizing and rely on adjacent larger targets; document exemption. |

---

# Follow-up Plan: Cluster Send-to-Card → Integrated Card Creator + Queue + UI Polish

## Overview

Route the subtitle cluster's **Send to Card** (`edit-card`) and **Update current card** actions to the integrated Card Creator in the Dictionary tab, instead of the standalone dialog. Enable the I+N **queue** review flow in the integrated panel and polish the panel UI. Current state: `CardCreatorDialogContent` and `useCardCreatorState` already support queue internally, but `DictionaryTab` / `CardCreatorPanel` only receive a `PopupCardCreatorPrefill` (text + media URLs), not `video` / `cue` / `initialMedia` / `queue` / `initialAction`. Therefore the queue is not functional in the integrated panel and cluster actions still open the standalone dialog.

## Architecture Decisions

- Extend `DictionaryPanelPrefill` (in `universalPanel/types.ts`) to a superset of `PopupCardCreatorPrefill` plus optional `video`, `cue`, `initialMedia`, `queue`, and `initialAction`. This becomes the universal `sendToCard` payload from both popup and cluster.
- `webTextDictionaryController` exposes a new `sendToCard(context: CardCreatorOpenContext, action?)` method. When `deps.panelController` exists, it forwards the context to the panel; otherwise it falls back to the standalone `openCardCreator`.
- `contentScriptController.handleCardCreatorAction` for `edit-card` / `update-current` captures screenshot + sentence audio, builds the queue, and calls `sharedWebTextCtrl.sendToCard` instead of `openCardCreator`.
- `mountUniversalPanel` stores the extended context as `pendingCardCreatorContext` and passes it to `DictionaryTab`.
- `DictionaryTab` forwards the context to `CardCreatorPanel`.
- `CardCreatorPanel` constructs a full `OpenContext` for `useCardCreatorState`, including `initialAction`.
- Add a `layout` prop to `CardCreatorDialogContent` (`'dialog' | 'panel'`). Panel layout overrides dialog-only `max-height`, makes the card-creator body the scroll container, and adds a compact panel header with the queue toggle.
- UI polish is scoped based on human feedback (see Open Questions).

## Task List

### Phase 1: Extend sendToCard payload and routing

#### Task 1: Extend `DictionaryPanelPrefill` type

**Description:** Update `src/features/universalPanel/types.ts` so `DictionaryPanelPrefill` extends `PopupCardCreatorPrefill` with optional `video?: HTMLVideoElement`, `cue?: BilingualCue`, `initialMedia?: readonly MediaFile[]`, `queue?: readonly CardCreatorQueueItem[]`, `initialAction?: 'quick-add' | 'quick-update' | 'edit-card'`. Update `UniversalPanelController.sendToCard` signature accordingly.

**Acceptance criteria:**
- [ ] `DictionaryPanelPrefill` is a strict superset of `PopupCardCreatorPrefill`.
- [ ] Existing popup `sendToCard` calls still type-check without changes.
- [ ] `UniversalPanelController.sendToCard` accepts the extended payload.

**Verification:**
- [ ] `npm run typecheck` passes.

**Dependencies:** None.

**Files likely touched:**
- `src/features/universalPanel/types.ts`

**Estimated scope:** S.

---

#### Task 2: Add `sendToCard` to `webTextDictionaryController`

**Description:** Add `sendToCard(context: CardCreatorOpenContext, action?)` to `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`. If `deps.panelController` is present, convert the context to a `DictionaryPanelPrefill` and call `panelController.sendToCard`; otherwise call existing `openCardCreator(context, action)`. Expose `sendToCard` on the returned `WebTextDictionaryController` interface.

**Acceptance criteria:**
- [ ] `sendToCard` routes to the integrated panel when `panelController` exists.
- [ ] Falls back to standalone dialog when no panel controller is available.
- [ ] `CardCreatorQueueItem`, `MediaFile`, `BilingualCue` are converted safely (no data loss).

**Verification:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit -- webTextDictionaryController` passes (add/update tests).

**Dependencies:** Task 1.

**Files likely touched:**
- `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
- `src/features/dictionaryPopup/controller/webTextDictionaryController.test.ts`

**Estimated scope:** M.

---

#### Task 3: Route cluster `edit-card` / `update-current` to panel

**Description:** In `src/features/subtitle/ui/contentScriptController.ts`, change `handleCardCreatorAction` so that for `edit-card` / `update-current` it calls `sharedWebTextCtrl.sendToCard({ video, cue, sourceLang, targetLang, initialMedia, queue: queueArg }, initialAction)` instead of `sharedWebTextCtrl.openCardCreator(...)`. `quick-update` remains a direct quick-add batch and does not open the panel.

**Acceptance criteria:**
- [ ] Cluster `edit-card` opens the integrated panel when universal panel is mounted.
- [ ] `update-current` also opens the integrated panel (with `initialAction='quick-update'`).
- [ ] I+N queue payload is preserved and forwarded.
- [ ] `quick-update` still performs batch quick-add.

**Verification:**
- [ ] `npm run test:unit -- contentScriptController` passes.
- [ ] `npm run typecheck` passes.

**Dependencies:** Task 2.

**Files likely touched:**
- `src/features/subtitle/ui/contentScriptController.ts`

**Estimated scope:** S.

### Phase 2: CardCreatorPanel consumes the full context

#### Task 4: Propagate extended context through the panel mount

**Description:** Update `src/features/universalPanel/mountUniversalPanel.ts` to store the extended `DictionaryPanelPrefill` as `pendingCardCreatorContext` (rename from `pendingPrefill`) and pass it to `DictionaryTab` under a new `cardCreatorContext` prop. Keep `pendingSearchTerm` derived from `context.term` for the left dictionary search.

**Acceptance criteria:**
- [ ] `mountUniversalPanel` accepts and stores the extended payload.
- [ ] `renderDictionaryPanel` forwards `cardCreatorContext` to `DictionaryTab`.
- [ ] Existing popup `sendToCard` still works.

**Verification:**
- [ ] `npm run test:unit -- mountUniversalPanel` passes.
- [ ] `npm run typecheck` passes.

**Dependencies:** Task 1.

**Files likely touched:**
- `src/features/universalPanel/mountUniversalPanel.ts`
- `src/features/universalPanel/mountUniversalPanel.test.tsx`

**Estimated scope:** S.

---

#### Task 5: Build full `OpenContext` in `CardCreatorPanel`

**Description:** Update `src/features/universalPanel/tabs/CardCreatorPanel.tsx` to accept `cardCreatorContext?: DictionaryPanelPrefill | null`. `buildOpenContext` must map `term`, `definitions`, `contextSentence`, `translation`, `wordAudioUrls`, `sentenceAudioUrls`, `imageUrls` into `OpenContext.prefill`, and also pass `video`, `cue`, `initialMedia`, `queue`, `initialAction` through. Pass `initialAction` as the third argument to `useCardCreatorState`.

**Acceptance criteria:**
- [ ] `CardCreatorPanel` builds an `OpenContext` that includes all optional media/queue fields.
- [ ] `initialAction='quick-update'` focuses the Update button.
- [ ] Missing optional fields do not break existing popup-only flow.

**Verification:**
- [ ] `npm run test:unit -- CardCreatorPanel` passes.
- [ ] `npm run typecheck` passes.

**Dependencies:** Task 4.

**Files likely touched:**
- `src/features/universalPanel/tabs/CardCreatorPanel.tsx`
- `src/features/universalPanel/tabs/CardCreatorPanel.test.tsx`

**Estimated scope:** M.

### Phase 3: Queue support in the integrated panel UI

#### Task 6: Add `layout="panel"` variant to `CardCreatorDialogContent`

**Description:** Add `layout?: 'dialog' | 'panel'` to `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`. Default remains `dialog`. Panel layout uses new classes (e.g. `cc-dialog__body--panel`, `cc-dialog__with-queue--panel`) that override `max-height` and make the body scroll inside the panel. Keep `className` prop behavior unchanged.

**Acceptance criteria:**
- [ ] `layout='panel'` renders without dialog `max-height` and fills the panel height.
- [ ] `layout='dialog'` is unchanged.
- [ ] Queue sidebar renders as a sibling and does not create nested scrollers.

**Verification:**
- [ ] `npm run test:unit -- CardCreatorDialogContent` passes.
- [ ] `npm run build` succeeds.

**Dependencies:** Task 5.

**Files likely touched:**
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`
- `src/features/universalPanel/tabs/CardCreatorPanel.module.css`

**Estimated scope:** M.

---

#### Task 7: Render panel header + queue toggle

**Description:** In panel layout, render a compact header inside `CardCreatorDialogContent` (or in `CardCreatorPanel`) showing "Card Creator" and the queue toggle when `queueItems.length >= 2`. The queue toggle calls `state.toggleQueueSidebar`.

**Acceptance criteria:**
- [ ] Panel header is visible when integrated panel is open.
- [ ] Queue toggle appears when N ≥ 2.
- [ ] Toggle opens/closes the queue sidebar.

**Verification:**
- [ ] Manual DevTools check on a subtitle page with I+N unknown words.
- [ ] `npm run test:unit -- CardCreatorPanel` passes.

**Dependencies:** Task 6.

**Files likely touched:**
- `src/features/cardCreator/ui/CardCreatorDialogContent.tsx`
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`
- `src/features/universalPanel/tabs/CardCreatorPanel.module.css`

**Estimated scope:** S/M.

---

#### Task 8: Polish panel scroll layout and queue sidebar positioning

**Description:** Ensure `.cardCreatorPanel` / `.scrollArea` work with the new panel layout: remove/avoid nested vertical scrollers, make the queue sidebar a sticky/fixed right column or sibling with its own overflow, ensure touch targets and padding follow `tokens.json` and `ui-ux-knowledge.md`.

**Acceptance criteria:**
- [ ] Only one vertical scroller per pane (body scrolls, queue scrolls independently, outer panel does not scroll).
- [ ] No content is clipped at 320px / 768px / 1280px widths.
- [ ] Padding/spacing uses `--space-*` tokens only.

**Verification:**
- [ ] `npm run build` + DevTools MCP at 320/768/1280px.
- [ ] `npm run test:unit` passes.

**Dependencies:** Task 6, Task 7.

**Files likely touched:**
- `src/features/universalPanel/tabs/CardCreatorPanel.module.css`
- `src/features/cardCreator/ui/QueueSidebar.module.css`
- `src/features/cardCreator/ui/CardCreatorDialog.module.css`

**Estimated scope:** M.

### Phase 4: UI improvements (scope pending human input)

#### Task 9: Implement specific UI polish

**Description:** Apply the UI improvements requested by "improve giao diện nha" once scope is clarified. Likely candidates: dictionary tab left-pane header/toolbar, card creator right-pane header, queue sidebar styling, empty/error states, focus management on open, responsive breakpoints.

**Acceptance criteria:**
- [ ] Agreed polish items are implemented.
- [ ] Visual changes are verified with DevTools MCP.
- [ ] Tokens, `src/shared/ui` components, and `ui-ux-knowledge.md` conventions are followed.

**Verification:**
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` pass.
- [ ] DevTools MCP screenshots confirm desired visual improvements.

**Dependencies:** Tasks 1–8 (depending on scope).

**Files likely touched:**
- TBD based on scope.

**Estimated scope:** TBD.

### Checkpoint Final: Complete

- [ ] All routing, queue, and UI tasks are implemented.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` pass.
- [ ] DevTools MCP verifies cluster `edit-card` / `update-current` open the integrated panel with correct media/queue.
- [ ] `docs/2-architechture-system.md` is updated for touched files.
- [ ] `tasks/plan.md` and `tasks/todo.md` are updated.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extending `DictionaryPanelPrefill` may cause conflicts with the visual-copy plan's `DictionaryTab` props. | Medium | Add a new `cardCreatorContext` prop without removing existing `prefill` for one migration step, or coordinate with the visual-copy plan. |
| `CardCreatorDialogContent` `layout` prop leaks dialog/panel concerns into a shared component. | Medium | Keep the prop strictly layout class selection; do not change data flow. Consider extracting a `CardCreatorPanelContent` wrapper if the divergence grows. |
| Queue sidebar inside a scroll area creates nested scrollers on small screens. | High | Task 8 explicitly tests 320px/768px/1280px and ensures one scroller per pane. |
| `initialAction` focus management may not work in panel without a dialog shell. | Low | Verify focus manually; if needed, add `useEffect` focus in `CardCreatorPanel`. |
| Popup `sendToCard` regression. | High | Maintain existing `sendToCard(prefill)` path in `webTextDictionaryController` and `mountUniversalPanel`. |

## Open Questions

- **"Improve giao diện nha"**: Which UI areas should be polished? Left dictionary pane, right card-creator pane, queue sidebar, universal panel shell, or all of them?
- **Routing scope**: Should `update-current` also route to the integrated panel, or only the `edit-card` / Send to Card button?
- **I+N queue and left pane**: When a queue arrives, should the left dictionary search stay empty, jump to the first queue term, or highlight the current subtitle word?
- **Visual-copy plan overlap**: The existing plan is also touching `DictionaryTab.tsx` / `DictionaryPanelView.tsx`. Should queue/routing land before or after the visual-copy tasks?

---

## Open Questions (visual-copy plan)

- **Parent wiring for `onQuickAdd`**: The visual copy only exposes `onQuickAdd` through `DictionaryTab`. Which parent (`mountUniversalPanel.ts`, a settings handler, etc.) will supply the callback and trigger the actual Anki quick-add action is a follow-up wiring decision, not part of this visual pass.
