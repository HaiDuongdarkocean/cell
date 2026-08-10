# ADR: Native Fullscreen for Child-Iframe Player Mode

## Context

Cell content scripts run in all frames (`all_frames: true`). On cross-origin iframe players (AnimeKai/megaplay, moviepire/vidnest, anikage.cc, etc.) the video element lives inside the child iframe, while the top AnimeKai page only embeds the `<iframe>`. We want the Player Mode UI to fill the full viewport and remain interactive without breaking the video.

## Problem

Earlier T045/ADR-078 Player Mode worked well for same-origin players (YouTube, themoviebox) because the host `<video>`/player container can be reparented into the Cell shadow DOM video stage. For cross-origin iframes this is impossible:

- `position: fixed` is bounded by the iframe's browsing context; the child-frame overlay can only cover the iframe rectangle, not the top viewport.
- Reparenting the `<video>` out of the cross-origin iframe document is forbidden by the same-origin policy.
- Previous bridge approach (`iframePlayerModeBridge.ts`) attempted to `position: fixed` the `<iframe>` element from the top frame and postMessage back/forth. This was fragile: `findIframeBySource` broke after redirects/HLS, the top-frame `z-index` stacked below the AnimeKai header, and fullscreen was never reached → black screen.

## Decision

Use the native Fullscreen API inside the child iframe.

- When the user toggles Player Mode in a child frame, call `document.documentElement.requestFullscreen()`.
- The browser puts the child document in fullscreen top-layer, so the Cell overlay (already `position: fixed; inset: 0` on `#cell-subtitle-root`) now fills the real viewport.
- Sync `playerMode` state with the `fullscreenchange` event: `setPlayerMode(document.fullscreenElement === document.documentElement)`.
- Skip body-reparenting of the shadow host in child frames; `attachFullscreenReparenting` (configured by `mountReactShadow`) already moves `#cell-subtitle-root` into `document.fullscreenElement` on fullscreen change.
- Make `PlayerModeOverlay` transparent and click-through in child frames by adding a `.childFrame` CSS class:
  - `background: transparent` and `pointer-events: none` on the overlay root.
  - `.split` and `.videoStage` also transparent / `pointer-events: none`.
  - Dock, content panel, resize handle, and subtitle area keep `pointer-events: auto` so controls remain usable.

This removes `iframePlayerModeBridge.ts` entirely. `isChildFrame` is moved to a new `iframeContext.ts` file.

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
- The video is not physically moved into the Cell video stage, so the `videoStage` slot is empty. The layout still uses the video stage height to size the transparent area, but the video is visible behind the transparent overlay; `contentOther`/`dock` cover their normal regions.

## Alternatives Considered

1. **Top-frame bridge with iframe reparenting** (status quo before this ADR): rejected because of `findIframeBySource` unreliability, header stacking, black screen, and HLS redirect issues.
2. **CSS-only theater mode in child frame (maximize iframe inside page)**: rejected because it cannot escape the top page layout and the header remains visible.
3. **Capture video to canvas and draw on overlay**: rejected as too heavy, would lose player controls and native subtitle rendering, and requires significant new code.

## Implementation Notes

- `SubtitlePanels.tsx`:
  - `handleTogglePlayerMode` now branches on `isChildFrame()`.
  - Child: `requestFullscreen()` / `exitFullscreen()`.
  - Top frame: exit existing host fullscreen then toggle `playerMode` (unchanged).
  - Added `fullscreenchange` listener to sync `playerMode` in child frames.
  - `playerMode` host style effect skips `document.body` reparenting when `isChildFrame()`.

- `PlayerModeOverlay.tsx` / `.module.css`:
  - Adds `isChildFrame()` class to the overlay.
  - `.childFrame` makes the overlay root transparent and pointer-events passthrough.
  - Children with interactive controls keep `pointer-events: auto`.

- `iframePlayerModeBridge.ts` deleted.
- `iframeContext.ts` created with `isChildFrame`.
- `content-script.ts` no longer installs the top-frame bridge.

## Verification

- `npm run typecheck` ✅
- `npm run build` ✅
- `npx vite build --mode development` ✅
- `npx jest --selectProjects unit --testPathPatterns "...PlayerModeOverlay..."` ✅
- Browser test on AnimeKai: native fullscreen of the `#player-iframe` element produced a full-viewport, playing video with no header visible, confirming the browser-level fullscreen approach is sound.

## AC (Acceptance Criteria)

1. On AnimeKai child iframe, pressing Player Mode calls `document.documentElement.requestFullscreen()`.
2. The video and Cell overlay fill the entire screen; the top page header is not visible.
3. The video is not reparented and does not reload; it stays playing.
4. Cell Player Mode controls (dock, cue list, resize handle, subtitle area) are visible and interactive.
5. Clicks on the video area pass through to the native player controls (play/pause, etc.).
6. Exiting fullscreen (Player Mode button or Esc) restores the normal in-page overlay and the video continues.
7. Top-frame Player Mode (YouTube/themoviebox) still reparents the host player into the video stage unchanged.
