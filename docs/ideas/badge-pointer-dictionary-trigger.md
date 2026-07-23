# Orbital Dictionary Pointer

## Problem Statement

How might we give mobile/tablet users (and fullscreen video viewers) a precise, one-handed way to trigger dictionary lookup without relying on small text selection or tap-to-token?

## Recommended Direction

A floating **orbital badge** that lives at the right edge of the viewport as a crescent. Dragging it out with a finger or mouse animates it into a full circle — the "sun". A smaller **pointer** orbits it like a "moon".

When the drag starts, the pointer first orients toward the center of the screen (toward the text/video to be looked up). It then animates/snap to the nearest preset position:

- `top` — pointer above the badge
- `left` — pointer to the left of the badge
- `right` — pointer to the right of the badge
- `center` — pointer retracted into the center of the badge

Pointer direction is controlled only while the badge is expanded (full circle):

- **Double tap** on the badge toggles `top` ↔ `center`
- **Triple tap** on the badge toggles `left` ↔ `right`

When the pointer touches text, the tip uses `document.elementFromPoint` to resolve the text node and offset, then reuses the existing lookup pipeline (`WebTriggerController` / `WebTextDictionaryController`). The dictionary popup renders as usual and highlights the target word.

The badge works across all contexts: normal web pages, subtitle overlay, and fullscreen video (it is appended to `document.fullscreenElement` when present).

## Decisions from Refinement

- **Default badge edge**: right side of the viewport.
- **Center preset**: the pointer retracts into the center of the badge.
- **Pointer position is persisted** to `chrome.storage.local` so the user's last preset is restored on the next session.
- **Double/triple tap is active only when the badge is expanded** (full circle). When the badge is collapsed as a crescent at the edge, these gestures are ignored.

## Key Assumptions to Validate

- [ ] Double vs triple tap latency window (`~300 ms`) does not feel sluggish.
- [ ] Pointer with `pointer-events: none` plus `document.elementFromPoint` reliably returns the text node under the pointer tip, not the badge itself.
- [ ] When the `center` preset is active, lookup at the badge center can resolve page text without the badge blocking hit testing.
- [ ] Appending the badge host into `document.fullscreenElement` survives video SPA switches on YouTube/Netflix/iqiyi.
- [ ] Finger drag does not obscure the pointer tip; the tip should offset slightly outside the touch area.

## MVP Scope

- Crescent → circle animation on drag.
- 4 pointer presets: `top`, `left`, `right`, `center`.
- Double/triple tap gesture handler active only on the expanded badge.
- Pointer-tip lookup via `elementFromPoint` reusing existing `extractSentenceContext` / `extractWordAtOffset` helpers.
- Works in normal web pages, subtitle overlay, and fullscreen.
- New setting `badgePointerTrigger` in `DictionaryPopupSettings` (toggle on/off alongside `triggerMode`).
- Shadow DOM badge, themed with design tokens.

## Not Doing (and Why)

- **Not replacing `triggerMode`** — this is an optional parallel trigger (`badgePointerTrigger`), preserving existing click/hover behavior.
- **Not making the pointer independently draggable** — only the badge is dragged; the pointer snaps to preset orbital positions.
- **Not supporting free-form pointer rotation or arbitrary angles** — only 4 presets to keep gestures predictable.
- **Not auto-looking up while dragging** — lookup fires on release/pause to avoid spamming the worker.
- **Not showing the badge inside the extension popup/options** — it is a content-script floating control only.

## Open Questions

1. Should the double/triple tap gesture use the same `300 ms` window for both, or should triple tap use a longer window?
2. For the `center` preset, should the pointer be visually invisible or shown as a small dot/dot-ring inside the badge?
3. Should the badge remember its last dragged position, or always reset to the right edge on new tabs?
4. Should there be a separate toggle per domain (e.g., off by default on desktop, on for mobile)?
