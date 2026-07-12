# ADR-031: Netflix UI z-index fix — mount Cell UI to `.watch-video`

**Date:** 2026-07-13
**Status:** Accepted
**Supersedes:** —
**Related:** ADR-030 (Netflix M7375 seek fix)

## Context

On Netflix non-fullscreen, all Cell UI elements (subtitle-block cluster buttons,
subtitle-toolbar, panel-toggle, subtitle-manager-panel) were unclickable despite
being visible in the DOM with `pointer-events: auto` and high z-index.

Fullscreen worked because `.watch-video` enters the browser top layer, carrying
Cell UI with it above Netflix's overlays.

## Root cause

Netflix renders the player inside two sibling wrappers
(`active`/`inactive`, class `default-ltr-iqcdef-cache-fntwn3`) under
`.watch-video--player-view`. On hover, Netflix activates the `active` wrapper
which covers the `inactive` one. Cell UI was appended into a container nested
inside the `inactive` branch, so the `active` wrapper blocked real mouse clicks
even though `elementFromPoint` (MCP) sometimes reported the button as the
top-most element (hit-testing edge case between sibling stacking contexts).

z-index alone did not fix it: both wrappers have `z-index: auto` and are
positioned, so they participate in the same stacking context as Cell UI.
Setting `z-index: 2147483647` on Cell UI did not lift it above the `active`
wrapper because Cell UI was nested inside the `inactive` wrapper's subtree.

## Decision

Move all top-level Cell UI elements to `.watch-video` (the common parent of
the `active`/`inactive` wrappers, `position: fixed`) and set
`z-index: 2147483647`. This places Cell UI in the same stacking context as
the wrappers but above them, so real mouse clicks reach Cell UI.

A single helper `mountToWatchVideo(el, container)` in `netflixPlayback.ts`
encapsulates the move + z-index + `data-theme` propagation. It is called after
each top-level Cell UI element is created and appended to its original
container:

- `subtitle-block` — `subtitleBlockController.ts`
- `subtitle-toolbar` + `subtitle-manager-panel` — `subtitleManagerPanel.ts`
- `panel-toggle` — `subtitlePanel.ts`
- `subtitle-drag-hint` — `subtitleUI.ts`

### Theme token propagation

Theme tokens (`--color-surface`, `--color-background`, etc.) are scoped to
`[data-theme]` boundaries (`themeTokens.ts`). The original video container
carries `data-theme="dark"`, but `.watch-video` does not. Without copying the
attribute, CSS variables resolve to empty after re-parenting and backgrounds
disappear. The helper copies `data-theme` from the source container to the
moved element so CSS variables still resolve.

`subtitle-block` already uses `syncElementTheme` (MutationObserver keeping
`data-theme` in sync), so the helper's copy is redundant there but harmless.

### Non-Netflix: no-op

`mountToWatchVideo` checks `isNetflixPage()` (ADR-030) and returns early on
other sites. YouTube and other hosts keep the original behavior — UI stays in
the video container, no re-parenting, no z-index change.

## Consequences

- Cell UI is above Netflix's `active`/`inactive` overlays in both non-fullscreen
  and fullscreen modes.
- Host site controls remain fully interactive — Cell UI elements are sized to
  their own bounding box, not a full-screen overlay, so they do not block
  clicks on Netflix controls elsewhere on the page.
- Subtitle manager panel (when open) overlaps the cluster buttons by design
  (panel is positioned at top-left, cluster at center-bottom); closing the
  panel restores cluster clickability.
- CSS variables resolve correctly because `data-theme` is copied to each moved
  element.
- Non-Netflix sites are unaffected (helper no-ops).

## Verification

Tested on Netflix `watch/81947712` (Netflix original, Korean drama) with
real MCP clicks + `elementFromPoint` after `mousemove` dispatches to trigger
Netflix's hover overlays:

- All 12 cluster/toolbar buttons: `isSelf: true` (clickable)
- Subtitle manager panel: opens, close button + section headers + items +
  offset buttons all clickable
- `subtitle-manager-close` real click → panel closes
- `cluster-rewind` real click → `lastSeekMs` updated (seek works, no M7375)
- `offset-step--2000` real click → offset value updates to `−2s`
- Backgrounds render correctly (`--color-surface`, `--color-background` resolve)
- Both non-fullscreen and fullscreen verified
- YouTube regression check: helper no-ops, no behavior change
