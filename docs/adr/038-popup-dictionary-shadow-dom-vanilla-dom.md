# ADR-038: Popup Dictionary Shadow DOM + Vanilla DOM

> **Status**: Accepted
> **Date**: 2026-01-28
> **Supersedes**: —
> **Related**: ADR-037 (English phrase match), spec-popup-dictionary.md

## Context

The Popup Dictionary renders a floating card on top of the video page when the user hovers/clicks a word in the subtitle overlay. The card shows definitions, audio, images, translation, and external links, plus a Quick Add button to send the word to Anki.

The content script runs in the page's isolated world, but the page's CSS can still affect any DOM we inject. If we render the popup as regular DOM elements, the host page's styles (font, color, reset, etc.) would leak into our popup and break the design.

## Decision

Render the popup inside a **Shadow DOM** root, using **vanilla DOM** (not React).

### Why Shadow DOM

- **CSS isolation**: The host page's stylesheets cannot penetrate the Shadow DOM boundary. Our popup styles are fully self-contained.
- **No CSS leakage**: Our popup styles don't leak into the page either.
- **Standard browser API**: `element.attachShadow({ mode: 'open' })` — no library needed.

### Why vanilla DOM (not React)

- The content script already uses vanilla DOM for the subtitle overlay (`subtitleUI.ts`). Consistency.
- React in content scripts requires a separate root + reconciliation, adding bundle size + complexity for a single popup card.
- The popup is a small, static structure (header + definitions + footer + tabs). No complex state management needed — the controller manages state as a plain object.
- Shadow DOM + React requires `createRoot(shadowRoot)` which has edge cases with event bubbling.

### Architecture

```
Host div (light DOM, position:fixed, pointer-events:none)
  └── Shadow Root (open mode)
       └── Container div (the visible popup)
            ├── Header (term + reading + frequency + status)
            ├── Toolbar (4 tab icons)
            ├── Active panel (lazy: audio/image/translate/links)
            ├── Definitions (always visible, checkboxes)
            └── Footer (status cycle + Quick Add)
```

## Consequences

- **Positive**: Full CSS isolation, no style leakage, small bundle, consistent with subtitle overlay.
- **Negative**: No React devtools for the popup. Manual DOM manipulation is more verbose for complex UIs.
- **Mitigation**: The popup structure is simple enough that vanilla DOM is manageable. The controller pattern (`popupDictionaryController.ts`) keeps state management clean.

## Implementation

- `popupShell.ts`: `PopupShell` class — manages host + Shadow DOM + container + resize + dismiss.
- `popupContent.ts`: `renderHeader`, `renderDefinitions`, `renderFooter` — vanilla DOM render functions.
- `popupToolbar.ts`: `renderToolbar`, `renderAudioPanel`, `renderImagePanel`, `renderTranslatePanel`, `renderLinksPanel`.
- `popupDictionaryController.ts`: orchestrator — state management + wiring.

All rendering uses `textContent` (no `innerHTML`) — XSS-safe. External links use `rel="noopener noreferrer"`. Term injection into URLs uses `encodeURIComponent`.
