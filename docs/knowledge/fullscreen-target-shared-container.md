# Fullscreen target must be the shared container when sibling UI must stay visible

> **Principle**: [Fullscreen target shared container](../principles.md#fullscreen-target-shared-container)

## Problem

When the subtitle panel is open beside the video, clicking the art-player fullscreen button full-screened the video element itself (`art-video-player`). The subtitle panel was left floating on top of the video, covering part of the picture. The expected behavior was a 70/30 split: video on the left, panel on the right.

## Root causes

The player's native fullscreen API targets the media element, which is a descendant of the layout box. The panel is a sibling of the media branch inside the layout box (F0). Fullscreening only the media branch leaves the panel outside the fullscreen element, so it renders as an overlay.

## Fix

- Intercept the art-player fullscreen button (`.art-control-fullscreen`) in capture phase, but only when the panel is open.
- Instead of letting the player fullscreen its own element, call `f0.requestFullscreen()` so the entire layout box becomes the fullscreen element.
- Apply `enterFullscreenDocked` to lay out `playerContainer` at 70% and `panel` at 30% horizontally.
- Add/remove the `art-fullscreen` class on `playerContainer` so the player's controls still think they are in fullscreen.
- On exit, restore normal docked or hidden layout via `exitFullscreenDocked`.

Files changed:

- `src/content/subtitleDocking.ts` — added `enterFullscreenDocked`, `exitFullscreenDocked`, `setupFullscreenHandlers`
- `src/content/content-script.ts` — wired `setupFullscreenHandlers`

## Key insight

If multiple UI pieces must remain visible together in fullscreen, the fullscreen element must be their common ancestor, not the media element. Intercepting the player's native fullscreen button is acceptable when the extension owns the sibling layout.

## Verification

Edge DevTools on `themoviebox.org` with panel open:

- Fullscreen element: `F0` (layout box), not `art-video-player`.
- Video width: `950.75px` (~70% of viewport).
- Panel width: `407.47px` (~30% of viewport).
- Panel offset: `x = 950.75px`, touching the video edge, not overlaying it.
