# Implementation Plan: Universal Orbital Panel

## Overview

Build a universal side/bottom panel opened by the orbital badge. The panel has two tabs — Dictionary (left vertical tab, default) and Settings (right vertical tab) — and persists the last active tab per session. The Dictionary tab shows an integrated dictionary lookup on the left and the Card Creator on the right. The Settings tab reuses the existing `SettingsDialog` content. The panel must work on desktop (right-side anchored, max-width 1280px), on small screens <= 768px (full-screen bottom sheet with bottom tab bar), and inside fullscreen video players.

## Architecture Decisions

- **React mount**: Follow the same `mountSettingsDialog`/`mountCardCreatorDialog` pattern — a fixed host on `document.body` (or `fullscreenElement`), `createRoot`, theme token injection, fullscreen re-parenting.
- **Panel shell**: `UniversalPanel.tsx` owns backdrop, tab bar, tab state, focus management, and responsive layout. `mountUniversalPanel.ts` only creates/destroys the host and root.
- **Settings tab**: Extract a reusable `SettingsDialogContent` component from `SettingsDialog.tsx`; `SettingsTab` renders it inside the panel.
- **Dictionary tab left pane**: Build a new React dictionary panel (`DictionaryPanelView.tsx` + `useDictionaryPanel.ts`) using `lookupOrchestrator` directly. This avoids the risky vanilla popup wrapper while still reusing lookup logic and matching popup visual style.
- **Dictionary tab right pane**: Render `CardCreatorDialogContent` directly with `useCardCreatorState`, not `mountCardCreatorDialog`.
- **External popup integration**: Add `stayOpen?: boolean` to card-creator action callbacks; the popup passes `stayOpen: true` when sending to the universal panel and calls the universal panel controller to open/focus the panel.
- **Tab persistence**: `chrome.storage.session` under `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`; default tab is `dictionary`.

## Phase 0 — Foundation & Contracts

These tasks have no runtime dependency on each other and can run in parallel.

### Task 0.1: Add `book-open` icon to `ICON_CATALOG`
**Subagent:** `subagent_general` (icon/catalog task)
**Files:**
- `src/shared/icons/svg/book-open.svg` (new)
- `src/shared/icons/index.ts`
**Acceptance:**
- [ ] `book-open.svg` exists, 24×24, stroke 2, currentColor, matches Lucide style.
- [ ] `ICON_CATALOG.bookOpen` is exported with tags `['dictionary','book','lexicon']`.
- [ ] `npm run build` still passes (icon import resolves).

### Task 0.2: Add `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`
**Subagent:** `subagent_general` (config task)
**Files:**
- `src/shared/config/config.ts`
**Acceptance:**
- [ ] `UNIVERSAL_PANEL_TAB: 'universalPanelTab'` added to `STORAGE_KEYS`.
- [ ] No schema migration needed (session-only, non-critical).

### Task 0.3: Create `features/universalPanel/` skeleton and types
**Subagent:** `subagent_general` (scaffold task)
**Files:**
- `src/features/universalPanel/index.ts`
- `src/features/universalPanel/types.ts`
- `src/features/universalPanel/UniversalPanelController.ts` (stub)
**Acceptance:**
- [ ] `UniversalPanelTab`, `UniversalPanelController`, and shared prefill interfaces are exported.
- [ ] Directory created; barrel file compiles.

### Task 0.4: Extract `SettingsDialogContent` from `SettingsDialog`
**Subagent:** `subagent_general` (settings refactor)
**Files:**
- `src/features/settings/ui/SettingsDialog.tsx`
- `src/features/settings/ui/SettingsDialogContent.tsx` (new)
- `src/features/settings/ui/SettingsDialog.module.css` (maybe adjust if needed)
**Acceptance:**
- [ ] `SettingsDialogContent` contains all settings sections and sidebar logic, accepts `settings`, `onChange`, `tokenizeState`, `onToggleTokenize`, `onOpenDictionary`.
- [ ] `SettingsDialog` still wraps it with overlay + popover + close button and all existing tests pass.
- [ ] No behavior change for popup/sidepanel/options usage.

### Task 0.5: Refactor orbital badge click-outside and panel toggle
**Subagent:** `subagent_general` (orbital badge task)
**Depends on:** 0.3 (types)
**Files:**
- `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`
- `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.test.ts` (if exists)
**Acceptance:**
- [ ] `onDocPointerDown` ignores a configurable list of host elements (settings dialog host + universal panel host), not hardcoded `cell-settings-dialog-host`.
- [ ] Collapsed badge single-press toggles the panel open/closed.
- [ ] Expanded badge single-press does not affect the panel.
- [ ] `onBadgeClick` for collapsed + panel open closes the panel.
- [ ] Existing drag/expand/hover/tap behavior unchanged.

**Checkpoint 0**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.
- [ ] Verifier subagent (`subagent_explore`) confirms foundation files exist and contracts compile.

## Phase 1 — Universal Panel Shell

### Task 1.1: Implement `mountUniversalPanel.ts`
**Subagent:** `subagent_general`
**Depends on:** 0.3
**Files:**
- `src/features/universalPanel/mountUniversalPanel.ts`
**Acceptance:**
- [ ] Creates a `position: fixed` host appended to `document.body` (or `fullscreenElement`), `z-index: 2147483646`.
- [ ] Injects theme tokens, syncs `data-theme`.
- [ ] Listens to `fullscreenchange` and re-parents host + theme style.
- [ ] Returns controller with `open(tab?)`, `close()`, `switchTab(tab)`, `isOpen()`, `unmount()`.

### Task 1.2: Implement `UniversalPanel.tsx` + `UniversalPanel.module.css`
**Subagent:** `subagent_general`
**Depends on:** 1.1 (use types), 0.1 (icon)
**Files:**
- `src/features/universalPanel/UniversalPanel.tsx`
- `src/features/universalPanel/UniversalPanel.module.css`
**Acceptance:**
- [ ] Renders backdrop (click to close) and panel shell.
- [ ] Left vertical tab bar with Dictionary (`bookOpen`) and Settings (`settings`) icons.
- [ ] Active tab state; default `dictionary`; calls `onTabChange`.
- [ ] Panel `width: 100%`, `max-width: 1280px`, full viewport height, right edge.
- [ ] Mobile `<= 768px`: full-screen layout with bottom tab bar.
- [ ] X button closes panel.
- [ ] Uses design tokens; no hardcoded px.

### Task 1.3: Implement `UniversalPanelController.ts` + tests
**Subagent:** `subagent_general`
**Depends on:** 1.2, 0.2
**Files:**
- `src/features/universalPanel/UniversalPanelController.ts`
- `src/features/universalPanel/UniversalPanel.test.ts`
**Acceptance:**
- [ ] Persists last active tab to `chrome.storage.session` with `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`.
- [ ] Restores tab on `open()`.
- [ ] Unit tests cover open/close, tab switch, persistence, backdrop close.
- [ ] Focus returns to a ref after close.

### Task 1.4: Wire orbital badge to `mountUniversalPanel`
**Subagent:** `subagent_general`
**Depends on:** 1.1, 1.3, 0.5
**Files:**
- `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`
- `src/entrypoints/content/content-script.ts` (where badge is initialized)
**Acceptance:**
- [ ] Badge creates/destroys `universalPanelMount` instead of `settingsMount`.
- [ ] `options.panel` callbacks bridge tokenize state into the universal panel (which passes them to `SettingsDialogContent`).
- [ ] `onOpenDictionary` from Tokenize panel switches to Dictionary tab (controller exposes `switchTab`).
- [ ] Single-press on collapsed badge opens/closes universal panel.

**Checkpoint 1**
- [ ] Panel opens from orbital badge.
- [ ] Tab switching works and persists.
- [ ] Backdrop/X close work.
- [ ] Mobile layout renders correctly in DevTools.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` pass.
- [ ] Verifier subagent checks shell against spec success criteria.

## Phase 2 — Settings Tab

### Task 2.1: Implement `SettingsTab.tsx` + `SettingsTab.module.css`
**Subagent:** `subagent_general`
**Depends on:** 0.4, 1.4
**Files:**
- `src/features/universalPanel/tabs/SettingsTab.tsx`
- `src/features/universalPanel/tabs/SettingsTab.module.css`
**Acceptance:**
- [ ] Renders `SettingsDialogContent` with `settings` loaded from `loadSettings`.
- [ ] `onChange` saves settings.
- [ ] Settings content is constrained to natural max-width (`<= 1200px`) and not stretched by the 1280px panel.
- [ ] `onOpenDictionary` prop switches tab to `dictionary`.
- [ ] Uses design tokens; BEM classes.

### Task 2.2: Update `SettingsDialog` to pass `onOpenDictionary` behavior through `SettingsDialogContent`
**Subagent:** `subagent_general`
**Depends on:** 0.4
**Files:**
- `src/features/settings/ui/SettingsDialog.tsx`
- `src/features/settings/ui/SettingsDialogContent.tsx`
**Acceptance:**
- [ ] `SettingsDialogContent` accepts `onOpenDictionary` and forwards to `TokenizeSettingsPanel`.
- [ ] When used inside `SettingsDialog` (popup/sidepanel), `onOpenDictionary` still triggers external popup dictionary lookup.
- [ ] When used inside `SettingsTab`, `onOpenDictionary` switches to Dictionary tab.

**Checkpoint 2**
- [ ] Settings tab renders all existing sections.
- [ ] Clicking "Open Dictionary" in Tokenize section switches to Dictionary tab.
- [ ] Saving a setting works and persists.
- [ ] `npm run test:unit` and `npm run build` pass.
- [ ] Verifier subagent confirms Settings tab SA.

## Phase 3 — Dictionary Left Pane

### Task 3.1: Implement `useDictionaryPanel.ts`
**Subagent:** `subagent_general`
**Files:**
- `src/features/dictionaryPopup/ui/useDictionaryPanel.ts`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx` (depends on this)
**Acceptance:**
- [ ] Hook accepts `langCode`, `sourceLang`, `targetLang`, `initialTerm?`, `onSendToCard(prefill)`.
- [ ] Exposes `search(term)`, `currentResult`, `isLoading`, `error`, `activeTab`, `setActiveTab`, `sendToCard()`.
- [ ] Calls `lookupOrchestrator` with `fallback: true` for typed search.
- [ ] Loads language plugin/phrase index when needed (reuse existing orchestrator).
- [ ] Supports cancellation via `AbortSignal`.

### Task 3.2: Implement `DictionaryPanelView.tsx` + `DictionaryPanelView.module.css`
**Subagent:** `subagent_general`
**Depends on:** 3.1, 0.1
**Files:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
**Acceptance:**
- [ ] Header: term, reading/IPA, audio play button, frequency/status badges.
- [ ] Definitions list (reusing sense-splitting logic or `DefinitionEntry` display).
- [ ] Tab bar: Audio, Image, Translate, Links (same as popup dictionary tabs).
- [ ] Footer: status cycle button + "Send to Card" button.
- [ ] Visual style consistent with popup dictionary and design tokens.
- [ ] Renders loading/error/empty states.

### Task 3.3: Implement `DictionaryTab.tsx` + `DictionaryTab.module.css`
**Subagent:** `subagent_general`
**Depends on:** 3.2
**Files:**
- `src/features/universalPanel/tabs/DictionaryTab.tsx`
- `src/features/universalPanel/tabs/DictionaryTab.module.css`
**Acceptance:**
- [ ] Two-pane layout: left `DictionaryPanelView`, right `CardCreatorPanel` (placeholder in this phase).
- [ ] Left pane width ~50% desktop, stacks vertically on mobile.
- [ ] Receives `onSendToCard` callback and forwards to right pane.
- [ ] Receives `initialTerm?` and passes to `DictionaryPanelView`.

### Task 3.4: Focus search input on Dictionary tab open
**Subagent:** `subagent_general`
**Depends on:** 3.2
**Files:**
- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
**Acceptance:**
- [ ] When panel opens at Dictionary tab, focus moves to the search input after enter animation.
- [ ] If search input already has a term, focus is at end of text.

**Checkpoint 3**
- [ ] Typing a word in search performs lookup.
- [ ] Lookup result renders with definitions and tabs.
- [ ] Footer buttons visible and clickable.
- [ ] `npm run test:unit` and `npm run build` pass.
- [ ] Verifier subagent confirms dictionary left-pane SA.

## Phase 4 — Card Creator Right Pane

### Task 4.1: Implement `CardCreatorPanel.tsx`
**Subagent:** `subagent_general`
**Files:**
- `src/features/universalPanel/tabs/CardCreatorPanel.tsx`
**Acceptance:**
- [ ] Calls `useCardCreatorState(settings.cardCreator, openContext, 'edit-card')`.
- [ ] Renders `CardCreatorDialogContent state={state} variant='desktop' onCancel={...}`.
- [ ] Builds `OpenContext` from optional video/cue and source/target langs.
- [ ] Captures screenshot + sentence audio when `openContext` changes (same logic as `handlePopupCardCreatorAction`).
- [ ] Empty/placeholder state when no prefill and not opened.

### Task 4.2: Wire `DictionaryTab` to `CardCreatorPanel` with prefill
**Subagent:** `subagent_general`
**Depends on:** 4.1, 3.3
**Files:**
- `src/features/universalPanel/tabs/DictionaryTab.tsx`
- `src/features/universalPanel/tabs/CardCreatorPanel.tsx`
**Acceptance:**
- [ ] `DictionaryTab` manages `prefill` state.
- [ ] Clicking "Send to Card" in left pane sets prefill and opens/focuses right pane.
- [ ] Prefill includes term, definitions, sentence, translation, audio/image URLs.
- [ ] Card creator receives prefill via `openContext.prefill`.

**Checkpoint 4**
- [ ] Send to Card populates card creator with term and definitions.
- [ ] Screenshot/audio captured from current video frame/cue.
- [ ] Add/Update card buttons work.
- [ ] `npm run test:unit` and `npm run build` pass.
- [ ] Verifier subagent confirms card-creator SA.

## Phase 5 — External Popup Integration

### Task 5.1: Add `stayOpen` flag to popup card-creator action
**Subagent:** `subagent_general`
**Files:**
- `src/features/dictionaryPopup/ui/popupDictionaryController.ts`
- `src/features/dictionaryPopup/types.ts` (if `OnCardCreatorAction` signature lives there)
**Acceptance:**
- [ ] `triggerCardCreatorAction` accepts `stayOpen?: boolean`.
- [ ] `onSendToCreator`/`onQuickAdd` in popup content default to `stayOpen: false` (preserve current dismiss behavior).
- [ ] Popup content no longer unconditionally calls `onDismiss(state)` when `stayOpen` is true.

### Task 5.2: Add external-popup → universal panel bridge
**Subagent:** `subagent_general`
**Depends on:** 1.4, 5.1
**Files:**
- `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
- `src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts`
- `src/entrypoints/content/content-script.ts`
**Acceptance:**
- [ ] `WebTextDictionaryController` receives a callback `onOpenUniversalPanel(prefill, action)`.
- [ ] External popup "Send to Card" calls this callback with `stayOpen: true`.
- [ ] Universal panel opens (if closed) to Dictionary tab and prefill is sent to `CardCreatorPanel`.
- [ ] External popup remains open.

### Task 5.3: Handle Quick Add from external popup to universal panel
**Subagent:** `subagent_general`
**Depends on:** 5.2
**Files:**
- `src/features/dictionaryPopup/controller/webTextDictionaryController.ts`
**Acceptance:**
- [ ] "Quick Add" from external popup also sends prefill to universal panel, action `'quick-add'`.
- [ ] Card creator panel pre-selects Add mode.

**Checkpoint 5**
- [ ] Popup Send to Card updates universal panel and popup stays open.
- [ ] Popup Quick Add updates universal panel and popup stays open.
- [ ] `npm run test:unit` and `npm run build` pass.
- [ ] Verifier subagent confirms popup integration SA.

## Phase 6 — Mobile & Responsive Refinement

### Task 6.1: Implement mobile bottom-sheet layout for `UniversalPanel`
**Subagent:** `subagent_general`
**Depends on:** 1.2
**Files:**
- `src/features/universalPanel/UniversalPanel.module.css`
- `src/features/universalPanel/UniversalPanel.tsx`
**Acceptance:**
- [ ] At `<= 768px` the panel becomes full-screen.
- [ ] Tab bar moves to bottom with two icon buttons.
- [ ] Panel animates in/out like a bottom sheet.

### Task 6.2: Implement card creator secondary bottom sheet on mobile
**Subagent:** `subagent_general`
**Depends on:** 6.1, 4.2
**Files:**
- `src/features/universalPanel/tabs/DictionaryTab.module.css`
- `src/features/universalPanel/tabs/DictionaryTab.tsx`
**Acceptance:**
- [ ] On mobile, right pane (Card Creator) appears below dictionary or as a secondary bottom sheet after "Send to Card".
- [ ] User can dismiss/expand card creator sheet.
- [ ] Two-pane desktop layout unaffected.

### Task 6.3: Responsive verification at breakpoints
**Subagent:** `subagent_general` + `browser-testing-with-devtools` skill
**Depends on:** 6.2
**Acceptance:**
- [ ] 1280px viewport: panel full width, left/right panes visible.
- [ ] 1920px+ viewport: panel caps at 1280px, video still partially visible.
- [ ] 768px and below: full-screen/bottom-sheet, bottom tab bar, stacked dictionary/card creator.
- [ ] 480px and below: same as 768px with comfortable touch targets.

**Checkpoint 6**
- [ ] Manual DevTools verification at 1920, 1280, 768, 390 widths.
- [ ] `npm run build` passes.
- [ ] Verifier subagent confirms responsive SA.

## Phase 7 — Final Verification, Refinement, Documentation

### Task 7.1: Run full verification suite
**Subagent:** `subagent_general` (orchestrator-assisted)
**Files:** all touched
**Acceptance:**
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes.
- [ ] `npm run build` passes.

### Task 7.2: Manual browser verification
**Subagent:** `subagent_general` with `browser-testing-with-devtools` skill
**Acceptance:**
- [ ] On YouTube test video: open panel, switch tabs, search dictionary, send to card.
- [ ] In fullscreen: panel re-parents and remains visible.
- [ ] Popup dictionary Send to Card keeps popup open and updates panel.

### Task 7.3: Adversarial spec acceptance review
**Subagent:** `subagent_explore` (read-only verifier)
**Acceptance:**
- [ ] Compares implementation against `docs/specs/universal-orbital-panel.md` success criteria.
- [ ] Reports any missing SA, edge cases, or regressions.

### Task 7.4: Fix gaps and rerun verification until all SA pass
**Subagent:** `subagent_general` (fix loop)
**Acceptance:**
- [ ] Every spec success criterion is marked passing.
- [ ] After fixes, `npm run typecheck`, `npm run test:unit`, `npm run build` pass again.

### Task 7.5: Update `docs/2-architechture-system.md`
**Subagent:** `subagent_general`
**Files:**
- `docs/2-architechture-system.md`
**Acceptance:**
- [ ] New `features/universalPanel/` tree, new files, and dependencies added to the architecture doc.
- [ ] Modified files (`createOrbitalBadge.ts`, `SettingsDialog.tsx`, `popupDictionaryController.ts`, `webTextDictionaryController.ts`) are updated in the dependency/function index.

**Checkpoint 7 (Final)**
- [ ] All spec success criteria pass.
- [ ] Build, typecheck, unit tests green.
- [ ] Manual browser verification recorded.
- [ ] Architecture docs updated.
- [ ] Verifier subagent signs off.

## Parallelization & Subagent Allocation

- **Phase 0**: 5 subagents in parallel (0.1, 0.2, 0.3, 0.4, 0.5). 0.5 may start after 0.3 if imports are needed.
- **Phase 1**: 3 subagents in parallel (1.1, 1.2, 1.3), then 1.4 sequential.
- **Phase 2**: 1–2 subagents sequential (2.1 then 2.2).
- **Phase 3**: 3 subagents in parallel (3.1, 3.2, 3.4), then 3.3 sequential integration.
- **Phase 4**: 2 subagents sequential (4.1 then 4.2).
- **Phase 5**: 2–3 subagents sequential (5.1 → 5.2 → 5.3).
- **Phase 6**: 2 subagents sequential (6.1 → 6.2), then 6.3 verification.
- **Phase 7**: 4 subagents sequential/loop (7.1 → 7.2 → 7.3 → 7.4 loop → 7.5).

Each phase includes a **do → verify → refine** loop: implementer subagent does the work, verifier subagent (`subagent_explore`) reviews against the spec, and implementer fixes until the checkpoint passes.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extracting `SettingsDialogContent` breaks existing dialog | High | Keep `SettingsDialog` wrapper untouched; only move body into a new component. Run full tests after. |
| `lookupOrchestrator` needs language context that is hard to get in panel | Medium | Use settings `subtitleOverlayTargetLanguage` as fallback; pass video/cue context from subtitle controller. |
| Popup `stayOpen` flag touches all popup flows | Medium | Default `stayOpen` to `false`; only universal panel path sets `true`. Unit-test existing popup paths. |
| Card Creator embedded in panel has layout issues (queue sidebar, Dialog shell) | High | Use `CardCreatorDialogContent` directly, not `mountCardCreatorDialog`; test queue behavior inside a pane. |
| Mobile bottom-sheet conflicts with existing `BottomSheet` component | Low | Build custom mobile layout in `UniversalPanel.module.css`; reuse tokens but not component. |
| Fullscreen re-parenting missed | High | Explicit success criterion + manual test on YouTube/Netflix fullscreen. |
| Z-index conflicts with popup dictionary | Medium | Panel host `z-index: 2147483646` (below popup `2147483647`); popup should still render above. |

## Open Questions

1. Should the integrated dictionary search default to `fallback: true` or use phrase matching? (Decision: `fallback: true` for typed search to match exact user input.)
2. When the user opens Settings tab and changes a setting, should the panel auto-close? (Decision: no, panel stays open; user can continue watching.)
3. Should the panel auto-pause video when open? (Decision: no, user may want to read while video plays; backdrop is semi-transparent.)
