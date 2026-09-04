# ADR-096: Universal Panel L-Shape Sidebar Redesign

## Status

Accepted — implemented and verified through type check, lint, build, and unit tests.

## Context

`UniversalPanel` is the slide-in side panel that hosts Dictionary, Study, and Settings tabs. The previous tab bar was a fixed-width vertical rail with icon-only buttons, a separate profile button, and an action group. It did not provide labels for tabs/tools, did not collapse for power users, and did not adapt well to small viewports.

The redesign brief (`docs/intent/universal-panel-redesign-brief.md`) and the A2 mockup (`src/entrypoints/design-system-showcase/mockups/universal-panel-redesign-a2.html`) established the L-shape direction:

- A left sidebar that expands to ~180 px (labels + icons) and collapses to ~64 px (icons only).
- The active language profile becomes the sidebar header.
- Tabs and quick tools are grouped in clearly separated sections.
- On mobile the sidebar is replaced by a bottom nav with a tools sheet.
- The inner `UniversalPanelHeader` is elevated (separate surface from content), tokenize pill stretches to use available width, and no hairline border separates the header from content.

## Decision

### 1. Create a generic `CollapsibleSidebar` in `src/shared/ui`

Instead of a one-off `UniversalPanelSidebar`, we built `CollapsibleSidebar` as a reusable shared component.

- Supports `header`, `sections`, `footer`, `collapsed` state, and `onCollapsedChange`.
- Uses `ICON_CATALOG`-typed icon names and design tokens (`--sidebar-width`, `--sidebar-width-collapsed`, `--sidebar-item-height`, etc.).
- Fully accessible: `nav`, `aria-label`, `role="tablist"`, `aria-selected`, `tabIndex`, and `aria-expanded` on the collapse toggle.
- Exported from `src/shared/ui/index.ts` so other features can reuse it.

### 2. Desktop L-shape shell via `CollapsibleSidebar`

`UniversalPanel.tsx` now composes the panel with `CollapsibleSidebar`:

- Sidebar header: the active language profile (flag + name, collapses to flag-only).
- Tabs section: Dictionary / Study / Settings.
- Tools section: Open Reader / Open SRS / Open local player.
- Built-in collapse toggle at the bottom of the sidebar.
- Inner header (`UniversalPanelHeader`) and content sit on the right; header is `surface-elevated` without a border.
- Tokenize pill in `TokenizeControls` now uses `flex: 1` on both halves so it stretches to fill header width.

### 3. Mobile bottom nav + tools sheet

For viewports ≤ 839 px the desktop sidebar is hidden and `UniversalPanelBottomNav` is shown.

- Four fixed tabs: Dictionary, Study, Settings, Tools.
- `Tools` opens a `BottomSheet` (already in `src/shared/ui`) listing Reader, SRS, and local player.
- Sheet has a title, drag handle, close affordance, and `Escape` / outside-click dismissal via `BottomSheet`.

### 4. Tokens-only styling

All new or modified CSS uses `tokens.css` values:

- `--sidebar-width`, `--sidebar-width-collapsed`, `--sidebar-item-height`
- `--universal-panel-header-height`, `--universal-panel-tokenize-height`, `--universal-panel-profile-flag-size`
- `--color-surface-elevated` for the sidebar and header, `--color-surface` for the body.

## Consequences

- `UniversalPanel.tsx` is now thinner: tab/tool data is centralized in `TABS` and `TOOLS` arrays.
- `CollapsibleSidebar` can be reused for future side-rail UIs without duplication.
- `UniversalPanelBottomNav` is feature-specific because the tab order and tool actions are product decisions.
- Mobile and desktop share the same `UniversalPanel` component and state; only the visible navigation shell changes.
- The E2E showcase page (`UniversalPanelPage.showcase.tsx`) continues to use `UniversalPanel` directly, so any visual regression is visible in the design-system showcase.

## Verification

- `npx tsc --noEmit` passes.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run test:unit -- src/features/universalPanel/UniversalPanel.test.tsx` and `src/shared/ui/CollapsibleSidebar.test.tsx` pass.
- Pre-existing `npm run test:unit` failures (ESM `allModuleCss.ts` in shadow-root mounts) are unrelated to this change and predate it.
