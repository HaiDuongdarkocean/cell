# Implementation Plan: Dictionary Tab Visual Fidelity

## Overview

Finish the approved `spec-dictionary-tab-copy-popup-visual.md` for the integrated `DictionaryPanelView` inside `UniversalPanel`. The spec interview is complete; this phase concentrates on the remaining search/definition/candidate/toolbar layout gaps reported by the user.

## Architecture decisions

- Keep `useDictionaryPanel.ts` as-is — it already exposes `definitionSelection`, `toggleDefinition`, `selectedDefinitions`, `quickAdd`, and `sendToCard`.
- Keep the global `.btn`/`.icon-btn` style injection already in `DictionaryPanelView.tsx`.
- Change the search row to a single `SearchField` with a single clear X, 350 ms trailing debounce, and instant Enter lookup; remove the explicit Search button.
- Port the popup's `renderDefinitions` DOM exactly: `<div class="cell-def__item">` > `<label class="cell-def__check">` + hidden checkbox + `<div class="cell-def__text">` wrapping combined `pos text` + examples.
- Reorder the active entry to `header → toolbar → tab panels → definitions → candidates`.
- Candidate chips get a transparent background in every state; active chip uses primary text + 2 px underline, no filled background.

## Slices

1. **Search**: hide native WebKit cancel button in `SearchField.module.css`; remove Search button and add debounce in `DictionaryPanelView.tsx`.
2. **Definition DOM**: rewrite `DefinitionItem` to popup's block structure.
3. **Layout order**: move `cellToolbar` and tab panels above `cellDef`; move `cellCandidates` below `cellDef`.
4. **Candidate styling**: override `.cellChip` and `.cellCandidates` for transparent background + active underline, and reserve bottom scroll padding.
5. **Verification**: `npm run typecheck`, `npm run test:unit`, `npm run build`, Chrome DevTools comparison, subagent review.

## Files touched

- `src/features/dictionaryPopup/ui/DictionaryPanelView.tsx`
- `src/features/dictionaryPopup/ui/DictionaryPanelView.module.css`
- `src/shared/ui/SearchField.module.css`

## Risks

- Reordering JSX may break existing `DictionaryTab` render tests; tests must be updated or verified after layout changes.
- Container `overflow-y: auto` + `.cellDef { overflow-y: auto }` already creates a nested scroller; leave untouched unless verification shows a problem, to avoid scope creep.
