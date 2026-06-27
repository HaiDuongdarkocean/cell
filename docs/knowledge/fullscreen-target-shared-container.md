# Fullscreen overlay approach — panel inside fullscreen element

> **Principle**: [Fullscreen target shared container](../principles.md#fullscreen-target-shared-container)

## Problem

When the subtitle panel is open beside the video, clicking the art-player fullscreen button fullscreens the `art-video-player` element. The subtitle panel is outside the fullscreen element, so it disappears (elements outside fullscreen are not rendered).

## Failed approaches (3 layers of root cause)

1. **Intercept click/pointerdown on playerContainer** — art-player's handler fires on `document` capture, before `playerContainer` capture. Can't intercept.
2. **Override `requestFullscreen` on art-video-player element** — Chrome content scripts run in an **isolated world**. DOM properties set from the content script are invisible to the page's JavaScript. The art-player calls the original `requestFullscreen`, not our override.
3. **Inject `<script>` tag with override** — Page has **CSP** `script-src 'self' ...` that blocks inline scripts. The injected script doesn't execute.
4. **Reactive redirect (exitFullscreen → f0.requestFullscreen)** — `requestFullscreen()` requires a **user gesture**. By the time `fullscreenchange` fires and we call `exitFullscreen().then(f0.requestFullscreen)`, the user gesture is consumed. Browser rejects with `API can only be initiated by a user gesture`.

## Working approach: overlay panel inside fullscreen element

Since we cannot redirect the fullscreen target, we let `art-video-player` be fullscreen and **move the panel INTO it** as a fixed-position overlay:

- On `fullscreenchange` with `fullscreenElement !== f0` and panel visible:
  - Save panel's original parent and `cssText`
  - `appendChild(panel)` into the fullscreen element (elements outside fullscreen are not rendered)
  - Style panel as `position: fixed; right: 0; top: 0; width: 30vw; height: 100vh; z-index: 2147483647`
- On exit fullscreen (`fullscreenElement === null`):
  - Restore panel to original parent
  - Restore original `cssText`
  - Call `exitFullscreenDocked` to restore normal 70/30 layout

Files changed:

- `src/content/subtitleDocking.ts` — `setupFullscreenHandlers` uses overlay approach
- `src/content/content-script.ts` — wired `setupFullscreenHandlers`

## Key insight

When you can't control the fullscreen target (CSP + isolated world + user gesture constraints), move your UI **into** the fullscreen element instead. Elements outside `document.fullscreenElement` are not rendered, so the panel must become a child of the fullscreen element to be visible.

## Verification

Edge DevTools on `themoviebox.org` with panel open, clicking native fullscreen button:

- Fullscreen element: `art-video-player` (not F0)
- Panel parent: `art-video-player` (moved into fullscreen)
- Panel: `position: fixed; right: 0; width: 30vw; height: 100vh; z-index: 2147483647`
- Panel rect: `w=407px, h=675px, x=950.75` (right side, not covering video)
- Video rect: `w=1358px, h=675px, x=0` (full width behind panel)

On exit fullscreen:
- Panel restored to F0, display:flex, w=244px (normal docked 70/30)
- Video restored to w=570px

With panel closed + fullscreen:
- Panel NOT moved into fullscreen element, stays in F0 with display:none
