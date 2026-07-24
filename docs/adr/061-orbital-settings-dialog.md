# ADR-061: Orbital badge integrates SettingsDialog (React mount)

**Date:** 2026-07-24
**Status:** Accepted
**Related:** ADR-022 (theme tokens in content-script), ADR-026 (Card Creator React mount)

## Context

The orbital dictionary badge (`createOrbitalBadge`) had a vanilla DOM settings
panel with 3 tokenize toggles (enabled, showStatus, showFrequency) + an "Open
Dictionary" button. To change any other setting (subtitle style, nav cluster,
dictionary popup, card creator, download, keyboard shortcuts), the user had to
open the popup/sidepanel — leaving the video context.

## Decision

Replace the vanilla panel with a React mount of the existing `SettingsDialog`
component — the same component used in popup/sidepanel/options. The orbital
badge's single click toggles the dialog open/close inline (center-screen,
same visual position as the old panel).

### Mount strategy

`mountSettingsDialog.ts` (new) follows the `mountCardCreatorDialog` pattern
(ADR-022/026): a `position: fixed` host on `document.body` with
`z-index: 2147483645`, a React root via `createRoot`, fullscreen re-parenting,
and theme token injection. The host is NOT inside the orbital badge's Shadow
DOM — CSS module styles from `SettingsDialog.module.css` are injected into
`document.head` by Vite and only apply in the light DOM.

### Tokenize section

`SettingsDialog` gains optional props (`tokenizeState`, `onToggleTokenize`,
`onOpenDictionary`). When provided (orbital badge only), a Tokenize section
appears at the top of the sidebar with the 3 toggles + Open Dictionary button.
Popup/sidepanel/options don't pass these props → no Tokenize section there
(tokenize is a content-script-only feature).

### Interface change

`OrbitalBadgeOptions.panel` changed from:
```
{ initialState, onToggleEnabled, onToggleStatus, onToggleFrequency, onOpenDictionary }
```
to:
```
{ getState, onToggle(key), onOpenDictionary, subscribe(cb) }
```

`OrbitalBadge.setPanelState` removed — `mountSettingsDialog` subscribes to
tokenize state directly via `options.tokenize.subscribe`.

## Consequences

- All settings (Media, Block, Target, Native, Cluster, Shortcuts, Download,
  Card Creator, Dictionary Popup, Tokenize) are editable inline on video.
- SettingsDialog is reused — one UI, one maintenance path.
- React + ReactDOM load in content-script (~40KB gzip) — already loaded by
  `mountCardCreatorDialog`, no incremental bundle cost.
- Theme tokens resolve via `injectThemeTokens` + `syncElementTheme` (ADR-022).
- Fullscreen support via `fullscreenchange` listener (ADR-026 pattern).
- Old vanilla panel CSS removed from `orbitalBadgeCss.ts` (~60 lines deleted).
