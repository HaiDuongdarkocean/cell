# Fullscreen overlay approach — panel inside fullscreen element

> **Principle**: [Fullscreen target shared container](../principles.md#fullscreen-target-shared-container)

## Problem

When the subtitle panel is open beside the video, clicking the player's fullscreen button fullscreens the video element (or its player wrapper). The subtitle panel is outside the fullscreen element, so it disappears (elements outside fullscreen are not rendered).

## Failed approaches (4 layers of root cause)

1. **Intercept click/pointerdown on playerContainer** — custom player's handler often fires on `document` capture, before `playerContainer` capture. Can't intercept reliably.
2. **Override `requestFullscreen` on the video/player element** — Chrome content scripts run in an **isolated world**. DOM properties set from the content script are invisible to the page's JavaScript. The player calls the original `requestFullscreen`, not our override.
3. **Inject `<script>` tag with override** — many pages have **CSP** `script-src 'self' ...` that blocks inline scripts. The injected script doesn't execute.
4. **Reactive redirect (exitFullscreen → f0.requestFullscreen)** — `requestFullscreen()` requires a **user gesture**. By the time `fullscreenchange` fires and we call `exitFullscreen().then(f0.requestFullscreen)`, the user gesture is consumed. Browser rejects with `API can only be initiated by a user gesture`.

## Working approach: overlay panel inside fullscreen element (generic)

Since we cannot redirect the fullscreen target, we let `document.fullscreenElement` be whatever the player chose, and **move the panel INTO it** as a fixed-position overlay:

- On `fullscreenchange` with `fullscreenElement !== f0` and panel visible:
  - Save panel's original parent and `cssText`
  - `appendChild(panel)` into `document.fullscreenElement` (elements outside fullscreen are not rendered)
  - Style panel as `position: fixed; right: 0; top: 0; width: 30vw; height: 100vh; z-index: 2147483647`
- On exit fullscreen (`fullscreenElement === null`):
  - Restore panel to original parent
  - Restore original `cssText`
  - Call `exitFullscreenDocked` to restore normal 70/30 layout
- When the user toggles the panel while in fullscreen, `showPanelDocked` / `hidePanelDocked` detect the fullscreen state and apply the overlay instead of the normal flex layout.

Files changed:

- `src/content/subtitleDocking.ts` — `setupFullscreenHandlers`, `showPanelDocked`, `hidePanelDocked`
- `src/content/content-script.ts` — wired `setupFullscreenHandlers` and `savedPanelStyles`

## Key insight

When you can't control the fullscreen target (CSP + isolated world + user gesture constraints), move your UI **into** the fullscreen element instead. This is generic: it relies on `document.fullscreenElement`, not on the player's specific class name.

## Verification

Edge DevTools on `themoviebox.org` with panel open, clicking native fullscreen button:

- Fullscreen element: `art-video-player` (or whatever the player fullscreened)
- Panel parent: same as `document.fullscreenElement` (moved into fullscreen)
- Panel: `position: fixed; right: 0; width: 30vw; height: 100vh; z-index: 2147483647`
- Panel rect: `w=407px, h=675px, x=950.75` (right side, not covering video)
- Video rect: `w=1358px, h=675px, x=0` (full width behind panel)

On exit fullscreen:
- Panel restored to F0, display:flex, w=244px (normal docked 70/30)
- Video restored to w=570px

With panel closed + fullscreen:
- Panel NOT moved into fullscreen element, stays in F0 with display:none

With panel toggled inside fullscreen:
- Panel overlay applied (30vw right) when opened
- Panel hidden when closed, but stays inside fullscreen element
