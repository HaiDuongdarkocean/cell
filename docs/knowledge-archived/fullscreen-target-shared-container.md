# Fullscreen side-by-side layout — panel inside fullscreen element

> **Principle**: [Fullscreen target shared container](../principles.md#fullscreen-target-shared-container)

## Problem

When the subtitle panel is open beside the video, clicking the player's fullscreen button fullscreens the video element (or its player wrapper). The subtitle panel is outside the fullscreen element, so it disappears (elements outside fullscreen are not rendered).

## Failed approaches (4 layers of root cause)

1. **Intercept click/pointerdown on playerContainer** — custom player's handler often fires on `document` capture, before `playerContainer` capture. Can't intercept reliably.
2. **Override `requestFullscreen` on the video/player element** — Chrome content scripts run in an **isolated world**. DOM properties set from the content script are invisible to the page's JavaScript. The player calls the original `requestFullscreen`, not our override.
3. **Inject `<script>` tag with override** — many pages have **CSP** `script-src 'self' ...` that blocks inline scripts. The injected script doesn't execute.
4. **Reactive redirect (exitFullscreen → f0.requestFullscreen)** — `requestFullscreen()` requires a **user gesture**. By the time `fullscreenchange` fires and we call `exitFullscreen().then(f0.requestFullscreen)`, the user gesture is consumed. Browser rejects with `API can only be initiated by a user gesture`.

## Working approach: side-by-side flex layout inside the fullscreen element

Since we cannot redirect the fullscreen target, we let `document.fullscreenElement` be whatever the player chose, and **move the panel INTO it** as a flex sibling of the video:

- On `fullscreenchange` with `fullscreenElement !== f0` and panel visible:
  - If `fullscreenElement` is a container (not `<video>`) and contains a `<video>` child:
    - Save panel's original parent and `cssText`, plus fullscreen element / video / player UI styles
    - `appendChild(panel)` into `document.fullscreenElement`
    - Insert a draggable resize handle between video and panel
    - Style fullscreen element as `display: flex`
      - Desktop: `flex-direction: row` → video 70%, panel 30%
      - Mobile portrait: `flex-direction: column` → video 60%, panel 40%
    - Constrain player UI layers (e.g. art-player controls) to the video area
  - If `fullscreenElement` is `<video>` (cannot host rendered siblings):
    - Fall back to fixed overlay: `position: fixed; right: 0; top: 0; width: 30vw; height: 100vh; z-index: 2147483647`
- On exit fullscreen (`fullscreenElement === null`):
  - Restore panel to original parent and `cssText`
  - Restore fullscreen element / video / player UI styles
  - Remove resize handle
  - Call `exitFullscreenDocked` to restore normal 70/30 layout
- When the user toggles the panel while in fullscreen:
  - Open: apply side-by-side flex layout (or overlay fallback)
  - Close: restore natural fullscreen layout (video fills 100%) and hide panel

Files changed:

- `src/content/subtitleDocking.ts` — `applyFullscreenSideBySide`, `restoreFullscreenSideBySide`, resize handle drag handlers, `setupFullscreenHandlers`, `showPanelDocked`, `hidePanelDocked`
- `src/content/content-script.ts` — wired `setupFullscreenHandlers` and `savedPanelStyles`

## Key insight

When you can't control the fullscreen target (CSP + isolated world + user gesture constraints), move your UI **into** the fullscreen element instead. If the fullscreen element is a container, you can share the space with a flex layout instead of overlaying the video.

## Verification

Edge DevTools on `themoviebox.org` with panel open, clicking native fullscreen button:

- Fullscreen element: `art-video-player` (container div)
- Panel parent: same as `document.fullscreenElement` (moved into fullscreen)
- Desktop layout:
  - Video: `flex: 0 0 calc(70% - 4px)`, `width: 946.75px`
  - Resize handle: `8px`
  - Panel: `flex: 0 0 calc(30% - 4px)`, `width: 403.47px`
  - Player controls: constrained to video area, `width: 946.75px`
- Mobile portrait layout:
  - Video: `flex: 0 0 calc(60% - 4px)`, `height: 502.4px`
  - Resize handle: `8px`
  - Panel: `flex: 0 0 calc(40% - 4px)`, `height: 333.6px`
  - Player controls: constrained to video area, `height: 502.4px`

Drag behavior:

- Dragging the resize handle updates the video/panel ratio in real time
- Ratio persists across hide/show cycles within the same page session

On exit fullscreen:

- Panel restored to F0, `display:flex`, `width: 244px` (normal docked 70/30)
- Video restored to `width: 570px`
- Resize handle removed

With panel closed + fullscreen:

- Panel NOT moved into fullscreen element, stays hidden
- Fullscreen element and video return to their natural full-screen styles

With panel toggled inside fullscreen:

- Side-by-side flex layout applied when opened
- Natural fullscreen layout restored when closed
