# ADR-057: Smooth transitions for dictionary popup

## Status
Accepted

## Context
The dictionary popup appears, moves, and swaps content instantly today. When the user hovers/looks up nearby words, the popup jumps from one anchor to another and content replaces abruptly, which feels unpolished.

## Decision
Add CSS-driven, GPU-friendly transitions to the popup shell and content:

1. **Shell show/hide** — use `opacity` + `transform: scale(0.96) translateY(8px)` with `visibility` so the popup is not interactive while hidden but still contributes to layout. Toggle with `.cell-popup--visible`.
2. **Position moves** — transition `left` and `top` when the visible class is present. The initial position is set *before* `show()` is called so the popup does not animate from the previous anchor on first open.
3. **Size changes** — transition `width` and `height` so resize/drag and `rePosition` feel smooth.
4. **Content swaps** — fade the inner `.cell-popup__content` opacity out and back in when a new lookup result is rendered.

## Consequences
- `PopupShell.show()` and `hide()` now add/remove a CSS class instead of setting `display` directly.
- `popupDictionaryController.showPopup()` calls `setPosition()` before `show()`.
- Tests updated to assert on the visible class and to `show()` before dispatching keyboard/mouse dismiss events.
- `visibility: hidden` (not `display: none`) keeps `offsetHeight`/`offsetWidth` measurable while the popup is visually hidden.
