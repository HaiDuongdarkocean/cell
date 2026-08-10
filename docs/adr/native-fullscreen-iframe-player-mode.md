# ADR: Native Fullscreen for Child-Iframe Player Mode

## Context

Cell content scripts run in all frames (`all_frames: true`). On cross-origin iframe players (AnimeKai/megaplay, moviepire/vidnest, anikage.cc, etc.) the video element lives inside the child iframe, while the top AnimeKai page only embeds the `<iframe>`. We want the Player Mode UI to fill the full viewport and remain interactive without breaking the video.

## Problem

Earlier T045/ADR-078 Player Mode worked well for same-origin players (YouTube, themoviebox) because the host `<video>`/player container can be reparented into the Cell shadow DOM video stage. For cross-origin iframes this is impossible:

- `position: fixed` is bounded by the iframe's browsing context; the child-frame overlay can only cover the iframe rectangle, not the top viewport.
- Reparenting the `<video>` out of the cross-origin iframe document is forbidden by the same-origin policy.
- Previous bridge approach (`iframePlayerModeBridge.ts`) attempted to `position: fixed` the `<iframe>` element from the top frame and postMessage back/forth. This was fragile: `findIframeBySource` broke after redirects/HLS, the top-frame `z-index` stacked below the AnimeKai header, and fullscreen was never reached → black screen.

## Decision

Use the native Fullscreen API inside the child iframe, and project the host player into the Player Mode `videoStage` within the same child document.

- When the user toggles Player Mode in a child frame, call `document.documentElement.requestFullscreen()`.
- The browser puts the child document in fullscreen top-layer, so the Cell overlay (already `position: fixed; inset: 0` on `#cell-subtitle-root`) now fills the real viewport.
- Sync `playerMode` state with the `fullscreenchange` event: `setPlayerMode(document.fullscreenElement === document.documentElement)`.
- Skip body-reparenting of the shadow host in child frames; `attachFullscreenReparenting` (configured by `mountReactShadow`) already moves `#cell-subtitle-root` into `document.fullscreenElement` on fullscreen change.
- In `PlayerModeOverlay`, find the player container with `findPlayerContainer()` and reparent it into the shadow host's light DOM as the `cell-video` slot. Because this is the same child document, the move does not trigger a cross-origin violation and the video keeps playing.
- Use the same `PlayerModeOverlay.module.css` for child and top frames: the `videoStage` has a dark letterbox background and the slotted player is sized to the stage by the responsive geometry effect. The slotted player gets `pointer-events: auto` so native controls remain clickable.

## Consequences

### Pros

- Robust: no top-frame bridge, no fragile `findIframeBySource` / `postMessage` protocol, no race conditions.
- True fullscreen: the video and overlay are in the browser's fullscreen top-layer, above the AnimeKai header and the rest of the top page.
- No DOM reload: the video never leaves its player `<video>` element; no reparenting means no re-initialization or black screen.
- No HLS stream issue: native fullscreen doesn't depend on the iframe `src` matching.
- Works on any child-iframe player that grants `allow="fullscreen"` (which AnimeKai and most embedders already do).

### Cons

- Requires `allow="fullscreen"` on the `<iframe>`. If a site omits it, `requestFullscreen()` rejects and Player Mode can't activate for that player.
- Native fullscreen is a browser top-layer; OS-level exit (Esc) also exits Cell Player Mode, which is expected and consistent.
- The host player is reparented within the child document into the `videoStage` slot. While this is the same-origin document, any provider scripts that assume the player stays in its original parent could be affected; the mount effect preserves `originalParent`/`originalNextSibling` and the cleanup restores them on exit.

## Alternatives Considered

1. **Top-frame bridge with iframe reparenting** (status quo before this ADR): rejected because of `findIframeBySource` unreliability, header stacking, black screen, and HLS redirect issues.
2. **CSS-only theater mode in child frame (maximize iframe inside page)**: rejected because it cannot escape the top page layout and the header remains visible.
3. **Capture video to canvas and draw on overlay**: rejected as too heavy, would lose player controls and native subtitle rendering, and requires significant new code.
4. **Transparent click-through overlay with video behind**: rejected because the player is not physically in the `videoStage`, making responsive sizing and pointer-event routing fragile (the video could be covered by other panels and native controls became unreliable).

## Implementation Notes

- `SubtitlePanels.tsx`:
  - `handleTogglePlayerMode` now branches on `isChildFrame()`.
  - Child: `requestFullscreen()` / `exitFullscreen()`.
  - Top frame: exit existing host fullscreen then toggle `playerMode` (unchanged).
  - Added `fullscreenchange` listener to sync `playerMode` in child frames.
  - `playerMode` host style effect skips `document.body` reparenting when `isChildFrame()`.

- `PlayerModeOverlay.tsx` / `.module.css`:
  - Mount effect no longer returns early for child frames; it reparents the player container into the shadow host slot `cell-video`.
  - Top frame: if the host page is already in native fullscreen, the mount effect returns early.
  - Child frame: the shadow host is already inside `document.fullscreenElement`, so the mount effect does not move it to `document.body`.
  - Removed the `.childFrame` transparent/click-through override; the overlay and `videoStage` use the same dark letterbox background and slotted `pointer-events: auto` as the top frame.

- `iframePlayerModeBridge.ts` deleted.
- `iframeContext.ts` created with `isChildFrame`.
- `content-script.ts` no longer installs the top-frame bridge.

## Verification

- `npm run typecheck` ✅
- `npm run build` ✅
- `npx vite build --mode development` ✅
- `npx jest --selectProjects unit --testPathPatterns "...PlayerModeOverlay..."` ✅
- Browser test on AnimeKai: Player Mode activated, video projected into the left `videoStage`, right cue list and bottom dock visible, exit button restored the in-page view. Subagent vision verification passed.

## AC (Acceptance Criteria)

1. On AnimeKai child iframe, pressing Player Mode calls `document.documentElement.requestFullscreen()`.
2. The video and Cell overlay fill the entire screen; the top page header is not visible.
3. The host player is reparented into the Cell `videoStage` slot without crossing the same-origin boundary, so the video stays playing and is not reloaded.
4. Cell Player Mode controls (dock, cue list, resize handle, subtitle area) are visible and interactive.
5. The video fits the `videoStage` and is responsive to viewport changes; the slotted player keeps `pointer-events: auto` so native controls are clickable.
6. Exiting fullscreen (Player Mode exit button or Esc) restores the normal in-page overlay and the video continues.
7. Top-frame Player Mode (YouTube/themoviebox) still reparents the host player into the video stage unchanged.
