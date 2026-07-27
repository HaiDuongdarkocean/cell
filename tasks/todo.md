# Dictionary Tab Visual Fidelity — Implementation Checklist

## Slice 1: Search
- [ ] Add `::-webkit-search-cancel-button { display: none; }` to `SearchField.module.css`.
- [ ] Remove `Button` import and explicit Search button from `DictionaryPanelView.tsx`.
- [ ] Add 350 ms debounced search on `searchTerm` change; Enter clears timer and searches immediately.
- [ ] Update placeholder from "Type a word and press Enter" to something neutral if changed.

## Slice 2: Layout order
- [ ] Move `cellToolbar` JSX to directly after `<header>` and before tab panels.
- [ ] Render tab panels (`AudioPanel`, `ImagePanel`, `TranslatePanel`, `LinksPanel`) between toolbar and `cellDef`.
- [ ] Move `cellCandidates` JSX to after `cellDef`.

## Slice 3: Definition rows
- [ ] Change `DefinitionItem` outer element from `<label>` to `<div>`.
- [ ] Wrap checkbox/input/dot/box/tick in a `<label className={styles.cellDefCheck}>`.
- [ ] Use `<div className={styles.cellDefText}>` for the text wrap.
- [ ] Combine `pos` and `text` into a single child `<span>`.
- [ ] Keep examples as `<div className={styles.cellDefExamples}>` with `•` prefix.

## Slice 4: Candidate strip
- [ ] Set `.cellCandidates` background to transparent.
- [ ] Override `.cellChip` background/border to transparent.
- [ ] Active `.cellChip` (`.btn--primary`) uses `color: var(--color-primary)` + `text-decoration: underline` (2 px).
- [ ] Add `padding-bottom` to `.cellCandidates` equal to one chip height for final-item visibility.

## Slice 5: Verify
- [ ] `npm run typecheck` passes.
- [ ] `npm run test:unit` passes (update tests if layout changed).
- [ ] `npm run build` passes.
- [ ] Chrome DevTools visual comparison against floating popup.
- [ ] Subagent review confirms remaining discrepancies.
