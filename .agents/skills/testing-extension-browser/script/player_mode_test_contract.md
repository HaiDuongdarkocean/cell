# Player Mode Automated Test Flow — AC & Scenario Catalog

> Generated for self-driven browser E2E loop: discover → plan (AC) → do → verify (subagent) → refine.
> Stop condition: all AC pass OR 2 refine iterations reached.

## Test matrix

| Scenario | Site | Player type | Origin |
|---|---|---|---|
| S1 | animekai.be/watch/.../ep-1 | Child iframe (megaplay) | Cross-origin |
| S2 | kisskh.co/Drama/Perfect-Crown/Episode-1 | Top frame | Same-origin |
| S3 | moviepire.ru/watch/125988?s=1&e=2&me=10 | Child iframe (vidnest) | Cross-origin |
| S4 | themoviebox.xyz/movies/oh-boy-was-i-wrong... | Top frame | Same-origin |

## Shared AC (per scenario)

1. **Video is detected and playing**
   - Given: page loaded
   - Then: `document.querySelector('video')` exists and `paused === false` after start
2. **Cell overlay mounted with subtitle shadow root**
   - Given: video playing
   - Then: `document.querySelector('#cell-subtitle-root')?.shadowRoot` exists
3. **Player Mode button accessible**
   - Given: overlay mounted
   - Then: shadow DOM contains `[data-cell-id="player-mode-btn"]` or equivalent
4. **Player Mode enters successfully**
   - When: Player Mode button clicked
   - Then: either `document.fullscreenElement` set (child frame) OR overlay is fixed full-viewport (top frame)
5. **Host player projected/reparented into `videoStage` slot**
   - Then: `videoStage` contains the slotted player; video visible and not covered by cue list/dock
6. **Player Mode layout visible and responsive**
   - Then: bottom dock, right cue list, subtitle area visible; no overlap with video stage
7. **Exit Player Mode restores in-page view**
   - When: click exit/Player Mode button again
   - Then: fullscreen exited (child) OR overlay removed (top); video back to original in-page position; header/sidebars visible
8. **Video continues playing after exit**
   - Then: `currentTime` progressed and `paused === false`

## Failure catalog (known gaps to verify)

- Child-frame `Esc` key exit: does not work if key event targets top frame (automation limitation, not user behavior).
- Provider native fullscreen pre-empts Player Mode in top frame if user clicks provider fullscreen first.
- `themoviebox` top frame may not stream in some regions.
