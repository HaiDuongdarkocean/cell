# ADR-065: Universal Orbital Panel — Dictionary + Settings Tabs

**Date:** 2026-07-25
**Status:** Accepted
**Related:** ADR-061 (orbital SettingsDialog mount), ADR-026 (Card Creator React mount), ADR-055 (orbital dictionary pointer), ADR-045 (popup dictionary UX)

## Context

The orbital badge currently opens a Settings dialog (ADR-061) on single click. Users still need to leave the video context to access dictionary lookup or card creation flows, or rely on the hover popup dictionary. The goal is to make the orbital single-press entry point a universal, persistent panel with two tabs: Dictionary and Settings.

## Decision

Replace the standalone SettingsDialog mount with a **Universal Panel** that contains two vertical tabs on the left:

1. **Dictionary** (top icon)
2. **Settings** (bottom icon)

Single press on the orbital badge (when collapsed at the screen edge) opens/closes the panel. The panel default tab is **Dictionary**, but the last active tab is persisted for a seamless feel. The panel can also be closed via an X button or by clicking the backdrop.

### Panel container

- `position: fixed`, full viewport height, anchored to the right edge.
- `width: 100%` with `max-width: 1280px`.
- At viewports `<= 1280px` the panel is nearly full-width; above 1280px it caps at 1280px.
- Semi-transparent backdrop overlay; click outside closes the panel.
- Host is appended to `document.body` (or `fullscreenElement` when in fullscreen), same mounting pattern as `mountCardCreatorDialog` and `mountSettingsDialog`.

### Tab bar

- Vertical tab bar on the **left** edge of the panel.
- Two icon-only tabs: Dictionary (top) and Settings (bottom).
- Active tab is persisted to `chrome.storage.session` or local state and restored on next open.

### Dictionary tab

- Left side: integrated dictionary view.
- Right side: card creator (empty/placeholder until a word is sent).
- The dictionary view reuses the UI/UX of the existing popup dictionary (definitions, audio, image, links, status, toolbar).
- Two entry points:
  1. Search directly inside the integrated dictionary.
  2. From the external popup dictionary, press **Send to Card** to populate the card creator and update the integrated dictionary with the selected word.
- The external popup dictionary stays open after sending.

### Settings tab

- Reuses the existing `SettingsDialog` content/panels as a React mount inside the universal panel container.
- No duplication of settings UI or logic.

### Mount strategy

- The universal panel is a **React mount** (`mountUniversalPanel.ts`) following the same pattern as `mountSettingsDialog` and `mountCardCreatorDialog`.
- `Dictionary` and `Settings` content are React components.
- The dictionary view can be implemented in two phases:
  1. Phase 1: wrap the existing popup dictionary rendering into a React container that provides a host `div` and delegates to `WebTextDictionaryController`/`popupDictionaryController`.
  2. Phase 2 (optional): extract the dictionary view into a fully React component using the same `lookupOrchestrator`.

### Mobile

- On small viewports the panel becomes a full-screen/bottom-sheet dialog with a bottom tab bar.
- In the Dictionary tab, the card creator appears below the dictionary or as a secondary bottom sheet after **Send to Card** to avoid crowding.

## Consequences

- One entry point (orbital) gives access to both lookup and settings without leaving the video.
- Settings and card creator are reused, avoiding duplicated UI maintenance.
- The dictionary view can start as a wrapper around the existing vanilla controller and migrate to React later.
- React bundle in content script is already loaded for card creator/settings, so no new runtime dependency cost.
- Theme tokens are inherited via `injectThemeTokens` + `syncElementTheme` (ADR-022).

## Open Questions

1. Should the panel tab state persist across page reloads or only per session? (Recommended: per session via `chrome.storage.session` to avoid cross-site state leakage.)
2. Should the card creator on the right be pre-filled with the current subtitle cue context when opened from the dictionary tab? (Recommended: yes, capture media/screenshot when the panel opens, same as ADR-026.)
3. How is the integrated dictionary search input focused on open? (Recommended: focus search input after panel enter animation completes.)
