# Spec: Universal Orbital Panel

## Objective

Turn the orbital badge single-press entry point into a universal side panel with two tabs: **Dictionary** and **Settings**. The panel lets users look up words and create cards without leaving the video context, and also adjust settings in the same place.

## User Stories

- As a language learner watching a video, I want to look up a word and create a flashcard without opening a separate popup page.
- As a user on a small laptop, I want the panel to fill the screen at 1280px but not stretch endlessly on an ultrawide monitor.
- As a tablet user, I want a bottom tab bar so I can switch between dictionary and settings with my thumb.

## Commands

```bash
# Build / typecheck / test
npm run build
npm run typecheck
npm run test:unit

# Dev server (regenerates tokens.css via predev hook)
npm run dev
```

## Project Structure

### New files

```
src/features/universalPanel/
├── mountUniversalPanel.ts          # React mount + fullscreen re-parenting
├── UniversalPanel.tsx              # Panel shell: backdrop, tab bar, tab state
├── UniversalPanel.module.css       # Panel layout + tab bar styles
├── UniversalPanelController.ts     # Controller exposed to orbital badge
├── UniversalPanel.test.ts          # jsdom tests for tab state + open/close
├── tabs/
│   ├── DictionaryTab.tsx           # Dictionary left + Card Creator right
│   ├── DictionaryTab.module.css    # Two-pane layout
│   ├── SettingsTab.tsx             # Reuses SettingsDialog content
│   └── SettingsTab.module.css      # Settings tab wrapper styles
└── index.ts                        # Barrel exports

src/features/dictionaryPopup/ui/
├── DictionaryPanelView.tsx         # React wrapper/container for dictionary lookup
└── useDictionaryPanel.ts           # Hook: lookup state, send-to-card, search

src/shared/icons/index.ts
  # Add `book-open` icon to ICON_CATALOG for the Dictionary tab

src/shared/config/config.ts
  # Add STORAGE_KEYS.UNIVERSAL_PANEL_TAB for tab persistence
```

### Modified files

```
src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts
  # Replace single-press SettingsDialog open/close with universal panel controller.
  # Refactor click-outside check to accept configurable host element(s) so both
  # the settings dialog host and the universal panel host are ignored.

src/features/settings/ui/mountSettingsDialog.ts
  # Keep for popup/sidepanel/options.

src/features/cardCreator/ui/CardCreatorDialog.tsx
  # Extract CardCreatorDialogContent (if not already) for direct render in the
  # Dictionary tab right pane; mountCardCreatorDialog remains for standalone use.

src/features/dictionaryPopup/controller/webTextDictionaryController.ts
  # Allow rendering into a supplied container instead of the floating popup shell.
  # Accept an optional `stayOpen` flag for Send-to-Card so the popup stays open
  # when the action targets the universal panel.

src/features/settings/ui/TokenizeSettingsPanel.tsx
  # Optional `onOpenDictionary` callback may be repurposed to switch to the
  # Dictionary tab when the panel is open.

docs/0-wiki.md                      # Add ADR/spec links
docs/2-architechture-system.md       # Update tree + dependency index
```

## Code Style

- **Named exports** for all new modules.
- **No explicit `any`** — ESLint enforces this.
- **CSS modules** with BEM class names; use design tokens (`var(--space-*)`, `var(--color-*)`, `var(--radius-*)`, `var(--duration-*)`).
- **React function components + hooks**; no class components.
- **Mount pattern** identical to `mountSettingsDialog`/`mountCardCreatorDialog`: fixed host, `createRoot`, theme token injection, fullscreen reparenting.
- **CSS variables** inherited from `tokens.css`; do not hardcode pixel values (ADR-064).
- **Icons** from `ICON_CATALOG`; add `book-open` to catalog if not present.

## Interfaces

### Dictionary panel wrapper (Phase 1)

```typescript
export interface DictionaryPanelPrefill {
  readonly term?: string;
  readonly definitions?: string;
  readonly sentence?: string;
  readonly sentenceTranslation?: string;
  readonly wordAudioUrls?: readonly string[];
  readonly sentenceAudioUrls?: readonly string[];
  readonly imageUrls?: readonly string[];
}

export interface DictionaryPanelViewProps {
  readonly containerRef: React.RefObject<HTMLElement | null>;
  readonly onSendToCard: (prefill: DictionaryPanelPrefill) => void;
  readonly initialTerm?: string;
}

export interface UseDictionaryPanelReturn {
  readonly search: (term: string) => void;
  readonly currentResult: LookupResult | null;
  readonly isLoading: boolean;
  readonly sendToCard: () => void;
}
```

### Universal panel controller

```typescript
export type UniversalPanelTab = 'dictionary' | 'settings';

export interface UniversalPanelController {
  readonly open: (tab?: UniversalPanelTab) => void;
  readonly close: () => void;
  readonly switchTab: (tab: UniversalPanelTab) => void;
  readonly isOpen: () => boolean;
  readonly unmount: () => void;
}
```

## Testing Strategy

- **Unit tests (jsdom)**:
  - `UniversalPanelController`: open/close/toggle, last active tab persistence, backdrop click closes.
  - `UniversalPanel`: tab switching renders correct tab, default tab is Dictionary, persisted tab restored.
  - `DictionaryTab`: search input accepts term, "send to card" populates card creator placeholder.
- **Integration tests**:
  - Orbital badge single click in collapsed state opens universal panel at Dictionary tab.
  - Popup dictionary "send to card" updates universal panel and keeps popup open.
  - Settings tab renders existing settings panels without errors.
- **Manual tests**:
  - Desktop 1280px: panel is full width, tabs on left, two-pane dictionary visible.
  - Desktop 1920px+: panel caps at 1280px, video still partially visible on left.
  - Mobile emulation (<= 768px): full-screen panel, bottom tab bar, card creator as bottom sheet.
  - Fullscreen YouTube/Netflix: panel host re-parents into fullscreen element.

## Boundaries

- **Always do**:
  - Reuse `SettingsDialog` panels for Settings tab.
  - Render `CardCreatorDialogContent` directly in the right pane (do not call `mountCardCreatorDialog`).
  - Use design tokens for all new CSS.
  - Add `book-open` to `ICON_CATALOG` before using a dictionary icon.
  - Update `docs/2-architechture-system.md` when new files land.
- **Ask first**:
  - Bumping settings schema version.
  - Changing `manifest.json`.
  - Adding new npm dependencies.
- **Never do**:
  - Rewrite the popup dictionary core from scratch in one PR; wrap first, refactor later.
  - Default exports for new modules.
  - Commit hardcoded credentials or secrets.

## Success Criteria

- [ ] Single press on collapsed orbital badge opens universal panel at Dictionary tab by default.
- [ ] Panel remembers last active tab (Dictionary or Settings) across opens within the same session via `chrome.storage.session` and `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`.
- [ ] Vertical tab bar on the left has Dictionary icon (top, `book-open` from `ICON_CATALOG`) and Settings icon (bottom).
- [ ] Settings tab reuses existing settings UI; settings content is constrained to its natural max-width (<= 1200px) and not stretched by the 1280px panel.
- [ ] Dictionary tab shows integrated dictionary on the left and card creator placeholder on the right.
- [ ] Search inside integrated dictionary performs lookup and renders results.
- [ ] Pressing "Send to Card" from the external popup dictionary populates the integrated card creator and updates the integrated dictionary; popup stays open (via `stayOpen: true` flag on the card-creator action).
- [ ] "Send to Card" button in the integrated dictionary sits in the footer toolbar, consistent with the popup dictionary footer.
- [ ] Panel width is `100%` with `max-width: 1280px`; at 1280px viewport it is full width, on larger screens it caps.
- [ ] Panel height is full viewport.
- [ ] Panel host has `z-index: 2147483646` (same as Card Creator, below orbital badge at `2147483647`).
- [ ] Backdrop click and X button close the panel.
- [ ] Mobile viewport `<= 768px` uses full-screen/bottom-sheet layout with bottom tab bar; card creator appears below or as a bottom sheet.
- [ ] Panel host re-parents into `fullscreenElement` on fullscreen change so it stays visible in YouTube/Netflix fullscreen.
- [ ] When panel opens, focus moves to the search input (Dictionary tab) or first settings control (Settings tab); when it closes, focus returns to the orbital badge.
- [ ] Clicking the orbital badge when the universal panel is open does not immediately close the panel due to old `cell-settings-dialog-host` click-outside logic.
- [ ] `npm run typecheck`, `npm run test:unit`, `npm run build` all pass.

## Mockups

### Desktop (>= 1280px viewport)

```
+------------------------------------------------------------+
|                     Video                                  |
|                                                            |
|   +---------------------------------------------------+   |
|   | [D]| Search...                                     |   |
|   |    | [word]                                        |   |
|   | [S]| [definitions]                                 |   |
|   |    | [audio][image][links]    [Send to Card]      |   |
|   |    |                                   +---------+  |   |
|   |    |                                   | Card    |  |   |
|   |    |                                   | Creator |  |   |
|   |    |                                   | (empty) |  |   |
|   |    |                                   +---------+  |   |
|   +---------------------------------------------------+   |
+------------------------------------------------------------+

[D] = Dictionary tab icon (top)
[S] = Settings tab icon (bottom)
```

### Desktop (> 1280px viewport)

```
+-------------------------------------------------------------+
| Video (left)  |  +--------------------------------------+   |
|               |  | [D]| Search...                       |   |
|               |  |    | ...                             |   |
|               |  | [S]| ...                             |   |
|               |  +--------------------------------------+   |
|               |  max-width: 1280px                       |
+-------------------------------------------------------------+
```

### Mobile (<= 768px)

```
+--------------------------------+
| Search...          [X]         |
| [word]                         |
| [definitions]                  |
| [audio][image] [Send to Card]  |
|                                |
| +-----------------------------+|
| | Card Creator (placeholder)  ||
| +-----------------------------+|
|                                |
| [Dictionary icon] [Settings icon]  <- bottom tab bar
+--------------------------------+
```

## Decisions Closed

1. **Dictionary icon:** Add `book-open` to `ICON_CATALOG`; use it for the Dictionary tab.
2. **Mobile breakpoint:** `<= 768px` uses bottom-sheet/full-screen layout; `> 768px` uses the right-side panel.
3. **"Send to Card" button location:** Footer toolbar, consistent with popup dictionary footer.
4. **Search history:** Phase 1 shows only a placeholder in the empty search input; no history list.
5. **Tab persistence:** Stored in `chrome.storage.session` under `STORAGE_KEYS.UNIVERSAL_PANEL_TAB`.
6. **Card creator in right pane:** Render `CardCreatorDialogContent` directly using the same `useCardCreatorState` hook; do not use `mountCardCreatorDialog`.
7. **Popup stays open on send:** The card-creator action accepts `stayOpen?: boolean`; universal panel sends set it to `true`, existing flows default to `false`.
8. **Integrated/external dictionary state:** Phase 1 keeps independent states. A shared lookup cache is reused via `lookupOrchestrator` (same as today); explicit synchronization of tab selection/candidate state is out of scope for Phase 1.

## Open Questions

1. Should the integrated dictionary be a Phase 1 wrapper around the existing vanilla controller, or a full React rewrite from the start?
   - **Decision:** Phase 1 wrapper to deliver faster and keep risk low; Phase 2 React rewrite if needed.
2. Should Settings tab content be centered or left-aligned inside the 1280px panel?
   - **Decision:** Left-aligned with padding, but constrained to the natural `SettingsDialog` max-width so it does not stretch awkwardly.
