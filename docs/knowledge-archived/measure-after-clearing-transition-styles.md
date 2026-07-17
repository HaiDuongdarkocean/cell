# Clear previous-mode styles before measuring natural size for the next mode

> **Principle**: [Measure after clearing transition styles](../principles.md#measure-after-clearing-transition-styles)

## Problem

After exiting fullscreen, the layout collapsed: the video and subtitle panel shrank to a tiny strip (~48px height) and the rest of the page was empty. The panel appeared at the top-left, detached from the video.

## Root causes

`exitFullscreenDocked` called `showPanelDocked` immediately. `showPanelDocked` captures `f0.getBoundingClientRect().height` to lock the natural height. But at that moment, `f0` still carried the fullscreen inline styles (`display: flex`, `height: 100%`) and `playerContainer` still had `height: 100%`. The browser was mid-transition: with `f0` height unset and `playerContainer` height `100%`, the circular height dependency collapsed to a small value. `showPanelDocked` locked that wrong value, so the layout stayed broken.

## Fix

In `exitFullscreenDocked`:

1. Remove the `art-fullscreen` class from `playerContainer`.
2. Clear all fullscreen inline styles from `f0` and `playerContainer` (display, flex, height, aspect-ratio, box-sizing, min-width, min-height).
3. Force a reflow with `void f0.offsetHeight`.
4. Only then call `showPanelDocked`, which now measures the true natural height.

Files changed:

- `src/content/subtitleDocking.ts` — updated `exitFullscreenDocked`

## Key insight

When switching between modes that set conflicting inline styles, never measure the "natural" size while the previous mode's styles are still applied. Clear them first, force reflow, then measure. Otherwise you lock a transition/collapsed value and the next mode inherits the wrong geometry.

## Verification

Edge DevTools on `themoviebox.org` after exiting fullscreen:

- `f0.style.height` restored to natural size (`507.51px`), not the collapsed fullscreen value.
- Video width: `570.73px`, panel width: `244.60px`, normal 70/30 docked layout restored.
- Video height: `507.51px`, matching panel height, no collapsed strip.
