# ADR-043: Popup Dictionary UX Improvements

## Context

The popup dictionary (spec §9) is the primary learner-facing surface for unknown-word lookup. During a learner-perspective review we identified friction points: no explicit close affordance, term pronunciation required opening the Audio tab, audio playback had no visible state, the image strip hid most results, external links looked like plain text, Quick Add gave no feedback, and the popup could not be repositioned or focus-managed.

## Decision

Ship a focused set of UI/UX changes in the existing Shadow DOM + vanilla DOM popup without adding dependencies:

1. **Header controls**: add an inline term-audio button and an explicit close button to the header; status badge title shows the next status cycle.
2. **Audio play/pause state**: `renderAudioPanel` accepts a `currentlyPlayingId` and renders a pause icon + `cell-audio__item--playing` while a Forvo URL is active.
3. **Image grid**: replace the horizontal filmstrip with a responsive CSS grid (`auto-fill`, `minmax(96px, 1fr)`) and `aspect-ratio: 4/3` cards.
4. **Links chips**: render external dictionary links as compact chips with a `link` icon and `aria-label` marking new-tab behavior.
5. **Quick Add feedback**: await the `QuickAddResponse` and show a transient toast through `PopupShell.showToast`.
6. **Popup shell ergonomics**: add `role=dialog`, `aria-modal`, focus trap on `Tab`, focus restore on hide/destroy, and pointer-drag header with viewport clamping.

## Consequences

- Learners can close the popup without reaching for Esc, hear the term before deciding on a tab, and see which audio is playing.
- More image results are visible at once; external links are more glanceable.
- Quick Add success/failure is communicated without leaving the popup.
- The popup is accessible via keyboard and screen readers and can be dragged when it obscures content.
- All changes stay inside `src/features/dictionaryPopup/ui/` and reuse existing tokens (`--color-primary-subtle`, `--color-surface-hover`, `ICON_CATALOG`).
