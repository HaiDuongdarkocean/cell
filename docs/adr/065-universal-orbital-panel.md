# ADR-065: Universal Orbital Panel — Dictionary + Settings Tabs

**Date:** 2026-07-25
**Status:** Accepted
**Related:** ADR-061 (orbital SettingsDialog mount), ADR-026 (Card Creator React mount), ADR-055 (orbital dictionary pointer), ADR-045 (popup dictionary UX)

## Context

The orbital badge currently opens a Settings dialog (ADR-061) on single click. Users still need to leave the video context to access dictionary lookup or card creation flows, or rely on the hover popup dictionary. The goal is to make the orbital single-press entry point a universal, persistent panel with two tabs: Dictionary and Settings.

## Decision

Replace the standalone SettingsDialog mount with a **Universal Panel** that contains two vertical tabs on the left:

1. **Dictionary** (top icon — `book-open` from `ICON_CATALOG`)
2. **Settings** (bottom icon)

Single press on the orbital badge (when collapsed at the screen edge) opens/closes the panel. The panel default tab is **Dictionary**, but the last active tab is persisted for a seamless feel. The panel can also be closed via an X button or by clicking the backdrop.

### Panel container

- `position: fixed`, full viewport height, anchored to the right edge.
- `width: 100%` with `max-width: 1280px`.
- At viewports `<= 1280px` the panel is nearly full-width; above 1280px it caps at 1280px.
- Semi-transparent backdrop overlay; click outside closes the panel.
- Host is appended to `document.body` (or `fullscreenElement` when in fullscreen), same mounting pattern as `mountCardCreatorDialog` and `mountSettingsDialog`.
- Host `z-index: 2147483646` (same as Card Creator, below the orbital badge at `2147483647`).

### Tab bar

- Vertical tab bar on the **left** edge of the panel.
- Two icon-only tabs: Dictionary (top) and Settings (bottom).
- Active tab is persisted per session to `chrome.storage.session` under `STORAGE_KEYS.UNIVERSAL_PANEL_TAB` and restored on next open.

### Dictionary tab

- Left side: integrated dictionary view.
- Right side: card creator (empty/placeholder until a word is sent).
- The dictionary view reuses the UI/UX of the existing popup dictionary (definitions, audio, image, links, status, toolbar).
- Two entry points:
  1. Search directly inside the integrated dictionary.
  2. From the external popup dictionary, press **Send to Card** to populate the card creator and update the integrated dictionary with the selected word.
- The external popup dictionary stays open after sending. This requires a `stayOpen?: boolean` flag on the card-creator action; universal panel sends `true`, existing flows default to `false` for backward compatibility.
- The **Send to Card** button in the integrated view lives in the footer toolbar, consistent with the popup dictionary footer.

### Settings tab

- Reuses the existing `SettingsDialog` content/panels as a React mount inside the universal panel container.
- No duplication of settings UI or logic.
- Settings content is constrained to its natural max-width (`<= 1200px`) so it does not stretch awkwardly inside the 1280px panel.

### Mount strategy

- The universal panel is a **React mount** (`mountUniversalPanel.ts`) following the same pattern as `mountSettingsDialog` and `mountCardCreatorDialog`.
- `Dictionary` and `Settings` content are React components.
- The dictionary view can be implemented in two phases:
  1. Phase 1: wrap the existing popup dictionary rendering into a React container that provides a host `div` and delegates to `WebTextDictionaryController`/`popupDictionaryController`.
  2. Phase 2 (optional): extract the dictionary view into a fully React component using the same `lookupOrchestrator`.

### Card creator in the right pane

- The right pane renders `CardCreatorDialogContent` directly using the same `useCardCreatorState` hook as the standalone dialog.
- It does **not** call `mountCardCreatorDialog`, because that function creates a full-viewport overlay with its own host and `Dialog`/`BottomSheet` shell.

### Mobile

- On viewports `<= 768px` the panel becomes a full-screen/bottom-sheet dialog with a bottom tab bar.
- In the Dictionary tab, the card creator appears below the dictionary or as a secondary bottom sheet after **Send to Card** to avoid crowding.

### Focus management

- When the panel opens, focus moves to the search input (Dictionary tab) or the first focusable settings control (Settings tab).
- When the panel closes, focus returns to the orbital badge.

### Orbital badge integration

- The badge's single-click handler calls `open()`/`close()` on the universal panel controller.
- The badge's click-outside logic must be refactored to ignore the universal panel host (and the settings dialog host), instead of hardcoding only `cell-settings-dialog-host`.

## Consequences

- One entry point (orbital) gives access to both lookup and settings without leaving the video.
- Settings and card creator are reused, avoiding duplicated UI maintenance.
- The dictionary view can start as a wrapper around the existing vanilla controller and migrate to React later.
- React bundle in content script is already loaded for card creator/settings, so no new runtime dependency cost.
- Theme tokens are inherited via `injectThemeTokens` + `syncElementTheme` (ADR-022).

## Open Questions (closed)

1. **Should the panel tab state persist across page reloads or only per session?**  
   Closed: per session via `chrome.storage.session` (`STORAGE_KEYS.UNIVERSAL_PANEL_TAB`).
2. **Should the card creator on the right be pre-filled with the current subtitle cue context?**  
   Closed: yes, capture media/screenshot when the panel opens, same as ADR-026.
3. **How is the integrated dictionary search input focused on open?**  
   Closed: focus search input after panel enter animation completes.
4. **Where does the "Send to Card" button live in the integrated dictionary?**  
   Closed: footer toolbar, consistent with the popup dictionary footer.
5. **Should search history be shown when the search input is empty?**  
   Closed: Phase 1 shows only a placeholder; no history list.
