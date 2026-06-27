# Subtitle Panel Outside Video (Toggle-Only Layout)

## Problem Statement

How might we keep the subtitle panel visible without covering the video, both inline and fullscreen, while keeping the default video layout untouched until the user explicitly asks for the panel?

## Recommended Direction

Implement **Direction C — Toggle-Only Layout**:

1. **Default state**: Panel hidden (`display: none`), toggle button visible at the top-right corner of the video.
2. **Toggle action**: Clicking the toggle button (or pressing `t`):
   - Slides the panel out from the right side of the video.
   - Shrinks the video container to make room for the panel (inline).
   - In fullscreen mode, the panel becomes a sibling of the fullscreen element and is positioned beside the video.
3. **Closing**: Clicking the close button in the panel header, clicking the toggle again, or pressing `t` again hides the panel and restores the video container size.

This direction balances the two competing needs: video stays unobstructed by default, but the panel is easy to open and read when the user needs it.

### Why this direction
- **User value**: Painkiller when panel is needed; invisible when not.
- **Feasibility**: Reuses existing code (`createPanel`, `createToggleButton`, toggle logic, keyboard shortcuts in `content-script.ts`). Only adds layout wrapper logic.
- **Risk**: Lower than Direction A because we only touch the video container when the panel is explicitly opened.
- **Differentiation**: Unlike simple overlay-only extensions, this gives users a readable, non-overlapping subtitle list on demand.

## Key Assumptions to Validate

- [ ] **Assumption 1**: Most users prefer the panel hidden by default and only open it when needed.  
  *How to test*: Track toggle usage in browser test; ask users during manual test session.
- [ ] **Assumption 2**: Video container parents are stable enough to wrap and shrink without breaking SPA re-renders.  
  *How to test*: Run MCP browser test on themoviebox.org and YouTube after implementation.
- [ ] **Assumption 3**: The panel width of 280px fits in the typical viewport when the video is shrunk.  
  *How to test*: Test on 1366x768 and 1920x1080 viewports; check if video becomes too small to watch.

## MVP Scope

**In scope**:
- Modify `content-script.ts` to wrap the video in a flex container when the panel is opened.
- Adjust `subtitlePanel.ts` so the panel is positioned beside the video, not absolutely on top of it, when in "docked" mode.
- Add CSS to shrink the video wrapper to ~70% width when panel is open, panel takes ~30% width.
- Handle fullscreen: move panel into the fullscreen element beside the video.
- Preserve keyboard shortcuts (`t` toggles, `w` toggles overlay, `a`/`d`/`s` cue navigation).
- Update HTML test page (`tests/browser/test-subtitle-overlay.html`) to verify inline layout.
- Add MCP browser test on themoviebox.org to verify SPA + fullscreen behavior.

**Out of scope (Not Doing)**:
- Draggable floating panel (Direction B) — more complex, can be added later if users want non-docked placement.
- Always-shrunk layout (Direction A) — too invasive; only shrink when user explicitly toggles panel.
- Resizable panel width — fixed 280px for MVP to avoid layout complexity.
- Left-side panel — right-side is the default for this MVP; left-side is a follow-up if requested.
- Persistent docked state across sessions — panel resets to hidden on each page load to keep behavior predictable.

## Mobile Behavior (≤768px)

When the viewport is too narrow for side-by-side layout, switch to **vertical stack** instead of horizontal shrink:

1. **Default state**: Panel hidden, video keeps its normal size and position.
2. **Toggle open**: Insert a vertical flex wrapper around the video:
   - Video takes the top portion (~60% of available height, min 200px).
   - Panel takes the bottom portion (~40% of available height, max 300px, scrollable cue list).
   - Both are full width of the container.
3. **Toggle close**: Remove the vertical wrapper and restore the original video layout.
4. **Fullscreen**: Use the same bottom-sheet behavior inside the fullscreen element (video top, panel bottom).
5. **Keyboard shortcuts** still work; the panel is just docked vertically instead of horizontally.

### Why vertical stack
- Preserves the core principle: panel does not cover the video.
- Fits narrow viewports without horizontal scrolling or unreadably small video.
- Uses the same flex-wrapper technique as the desktop layout, just with `flex-direction: column` instead of `row`.
- Minimal new code: one media query and a flex direction switch.

## Open Questions

- Should the panel remember its last position (docked vs. hidden) per site or globally?
- If the video is already in a flex/grid container, should we reuse its parent or inject a new wrapper? Reusing risks breaking existing CSS; injecting a new wrapper is safer but may cause visual glitches during SPA re-renders.
- Should the mobile breakpoint be 768px, or should we use the video width (e.g., when video width < 560px) to decide vertical vs. horizontal?

## Implementation Notes

- The existing `findAndInitOverlay` bug (SPA timing) must be fixed first, otherwise the panel never initializes on sites like themoviebox.org. The fix is a `MutationObserver` watching for `<video>` element creation.
- Use `position: fixed` for the toggle button relative to the video rect so it stays visible even if the video container is re-rendered.
- When panel is opened, set `video.parentElement.style.display = 'flex'` and shrink the video element to `flex: 1 1 70%`, panel `flex: 1 1 30%`. Store original display/style values to restore on close.
- Fullscreen: listen for `fullscreenchange`, find the fullscreen element, and append the panel as a sibling if the panel is open.
