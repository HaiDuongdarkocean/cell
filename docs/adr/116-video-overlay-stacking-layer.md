# ADR-116: Video Overlay Stacking Layer — subtitle above host overlays, below Cell surfaces

## Status

Accepted

## Date

2026-10-05

## Context

On `m.youtube.com`, Cell's subtitle overlay rendered **underneath** YouTube's native
control overlay (`#player-control-overlay` inside `#player-control-container`) — the
subtitle panel and its buttons were unpainted under the scrim and unreachable.

The cause is structural, not a z-index value problem. Cell mounts
`#cell-subtitle-root` into the container returned by `findVideoContainer`
(ADR-008 D2) — the nearest sized ancestor of `<video>` — which on m.youtube sits
inside `#player`. `#player-control-container` is a **sibling** of `#player`; no
z-index inside the `#player` subtree can ever paint above it. The same cap exists
inside desktop YouTube's player: `.html5-video-player` internals reach z-index
~1000 (ad overlays 850, `.ytp-volume-popover-showing` 1000) while the subtitle
host sat at `layer:2 → z-index:200`.

The required order (per user spec) is:

```
host page overlays < Cell subtitle overlay < other Cell overlays
```

Cell's other surfaces already satisfy "above the subtitle" structurally:
dictionary popup / universal panel / dialogs mount on `document.body` (outside
the video container's stacking context), manager portal and `.blockLayer` use
`z-index:2147483647` in-container, OCR region selector uses 99998/99999.

ADR-031 established the same policy for the Netflix drag hint (`mountToWatchVideo`
→ `.watch-video` + `--z-overlay-video`): above host wrappers, below settings
dialog/dictionary popup/Card Creator.

## Decision

1. **Mount container**: `findVideoOverlayContainer(video)` (in
   `shared/lib/dom/findPlayerContainer.ts`) is the SSOT for Cell video-level UI
   mounts (subtitle host via `contentScriptController`, OCR overlay + region
   selector). On m.youtube it lifts the mount from the `#player` subtree to the
   shared ancestor `#player-container-id` — guarded by `#player-control-container`
   presence plus a same-size (±10%/dim) check so `inset:0` keeps tracking the
   video box. All other sites fall back to `findVideoContainer` unchanged.

2. **Host z-index**: `#cell-subtitle-root` is set to `var(--z-overlay-video)`
   (10000) in `mountSubtitle` — the token slot that means "Cell video overlay:
   above host video UI, below Cell dialogs". This beats every known host
   player-internal layer (max ~1000) and remains below `--z-overlay-settings/top/orbital`
   surfaces and the max-int portals.

3. **In-container sibling order**: surfaces that must sit above the subtitle host
   keep a higher in-context z: `.subtitle-drag-hint` → `calc(var(--z-overlay-video) + 1)`,
   OCR hitbox overlay → 10001, region selector → 99998/99999 (unchanged),
   `.blockLayer` / `#cell-manager-portal` → 2147483647 (unchanged).

## Alternatives Considered

### Raise z-index only, keep the old mount container
- Pros: one-line change.
- Cons: does not work — a child cannot escape its parent stacking context; the
  `#player` subtree is capped below `#player-control-container` regardless of
  internal z.
- Rejected because: it is the exact failure being fixed.

### Generic "farthest same-size positioned ancestor" mount
- Pros: fixes this class on every host, no per-site selector.
- Cons: on desktop YouTube the walk overshoots to `#player` (outside
  `#movie_player`, the `playerShell` moved by Player Mode / Split View) — the
  overlay would be orphaned when the player shell moves into the PM stage.
  `findFarthestSameSizeContainer` keeps a `#movie_player` short-circuit for
  exactly this reason.
- Rejected because: regressing Player Mode/Split View to fix a mobile-only
  symptom is a worse trade than a documented per-host adapter.

### Detect "covering sibling" dynamically and lift to its LCA
- Pros: correct on any host without selectors.
- Cons: ~60+ lines of heuristic DOM/stacking analysis, false positives
  (cookie banners, transient scrims), hard to unit test.
- Deferred: this is the documented upgrade path in `findVideoOverlayContainer`
  (`ponytail:` ceiling) if a third host with the same structure appears.

## Consequences

- m.youtube: subtitle overlay, toasts, drag hint and nav cluster mount into
  `#player-container-id` and paint above the native control overlay; tap-through
  on empty band space (ADR-025 pointer-events work) continues to reach the player.
- Desktop YouTube: subtitle host now paints above ad overlays/endcards
  (z 850–1000) that previously covered it — a latent bug fixed as a side effect.
- Other sites: unchanged (fallback path identical to before).
- OCR overlay flips from above-subtitle-200 to above-subtitle-10000 ordering;
  drag hint bumped to `calc(--z-overlay-video + 1)` to preserve its "reads on
  top" contract.
- Player Mode / Split View untouched: `findPlayerContainer` (playerShell) is not
  used for the overlay mount, and the lifted m.youtube shell is an ancestor of
  the shell, so host reparenting and fullscreen still function.
