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
```

### Modified files

```
src/features/dictionaryPopup/badgePointer/createOrbitalBadge.ts
  # Replace single-press SettingsDialog open/close with universal panel controller
src/features/settings/ui/mountSettingsDialog.ts
  # Keep for popup/sidepanel/options; universal panel may reuse SettingsDialog props
src/features/cardCreator/ui/mountCardCreatorDialog.ts
  # May expose a panel-mount variant or be invoked inside DictionaryTab
src/features/dictionaryPopup/controller/webTextDictionaryController.ts
  # Allow rendering into a supplied container instead of the floating popup shell
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
- **Icons** from `ICON_CATALOG`; no inline SVG unless added to catalog.

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
  - Mobile emulation: full-screen panel, bottom tab bar, card creator as bottom sheet.
  - Fullscreen YouTube/Netflix: panel host re-parents into fullscreen element.

## Boundaries

- **Always do**:
  - Reuse `SettingsDialog` panels for Settings tab.
  - Reuse existing Card Creator mount/flow for the right pane of Dictionary tab.
  - Use design tokens for all new CSS.
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
- [ ] Panel remembers last active tab (Dictionary or Settings) across opens within the same session.
- [ ] Vertical tab bar on the left has Dictionary icon (top) and Settings icon (bottom).
- [ ] Settings tab reuses existing settings UI.
- [ ] Dictionary tab shows integrated dictionary on the left and card creator placeholder on the right.
- [ ] Search inside integrated dictionary performs lookup and renders results.
- [ ] Pressing "Send to Card" from the external popup dictionary populates the integrated card creator and updates the integrated dictionary; popup stays open.
- [ ] Panel width is `100%` with `max-width: 1280px`; at 1280px viewport it is full width, on larger screens it caps.
- [ ] Panel height is full viewport.
- [ ] Backdrop click and X button close the panel.
- [ ] Mobile: panel is full-screen with a bottom tab bar; card creator appears below or as a bottom sheet.
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
|   |    | [audio][image][links]                         |   |
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

### Mobile

```
+--------------------------------+
| Search...          [X]         |
| [word]                         |
| [definitions]                  |
| [audio][image]                 |
|                                |
| +-----------------------------+|
| | Card Creator (placeholder)  ||
| +-----------------------------+|
|                                |
| [Dictionary icon] [Settings icon]  <- bottom tab bar
+--------------------------------+
```

## Open Questions

1. Should the integrated dictionary be a Phase 1 wrapper around the existing vanilla controller, or a full React rewrite from the start?
   - **Recommended:** Phase 1 wrapper to deliver faster and keep risk low; Phase 2 React rewrite if needed.
2. Where does the "Send to Card" button live in the integrated dictionary view — toolbar above definitions, footer below definitions, or both?
   - **Recommended:** footer toolbar, consistent with the popup dictionary footer.
3. Should search history be shown when the integrated dictionary search input is empty?
   - **Recommended:** show last looked-up word or a short placeholder; full history can be a later enhancement.
