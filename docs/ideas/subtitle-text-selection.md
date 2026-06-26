# Subtitle Text Selection

## Problem Statement
How might we let users select subtitle text on the overlay to look up words, without breaking video controls?

## Recommended Direction
CSS `pointer-events` split: overlay container keeps `pointer-events: none` (pass-through to video controls), inner `<span>` gets `pointer-events: auto` + `user-select: text` + `cursor: text`. Only the text is interactive; background padding passes clicks through to video controls beneath. This is CSS-only, no extra UI, no state management.

## Key Assumptions to Validate
- [x] `pointer-events: none` on parent + `auto` on child works in Chrome (CSS spec)
- [ ] Users want to select while video plays (language learners watching with subtitles)
- [ ] Standard browser selection is sufficient (no custom selection UI needed)

## MVP Scope
- Wrap overlay text in `<span>` with `pointer-events: auto`, `user-select: text`, `cursor: text`
- Container stays `pointer-events: none`
- `updateOverlayText` sets span.textContent, `hideOverlay` clears span.textContent
- Toast and drag hint keep `user-select: none`

## Not Doing (and Why)
- Toggle mode — adds UI complexity, not needed for v1
- Auto-pause on selection — user can pause manually; noted for future
- Custom context menu — browser default (Copy, Search) is sufficient
- Touch/mobile selection — desktop Chrome only for now

## Open Questions
- Should we pause video automatically when user starts selecting? (v1: no)
- Should we add a "copy" button near selected text? (v1: no, browser handles)
