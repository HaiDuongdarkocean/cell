# Plan — dict-example-selection

> Spec: `docs/specs/dict-example-selection.md` · Design: concept A (mirror rows, shared `•` idle dot) · Mode: interactive

## Slice 1 — pure logic + types (no UI)

- `logic/definitionSelection.ts`: `ExampleSelection = Map<defId, Set<number>>`, `initExampleSelection(result, ids?)` (verbatim `defId:index`, drop orphans), `getSelectedExamples(def, sel)`, `toSelectedExampleIds(defs, sel)` — deterministic def-order + index-order.
- `entities/dictionary/popupTypes.ts`: `PopupSelectionSnapshot.selectedExampleIds?`, `PopupCardCreatorPrefill.definitions[].selectedExamples?`.
- `entities/settings/types.ts` + `config.ts`: `dictionaryPopup.includeAllExamplesOnDefSelect?: boolean` default `false`.
- `logic/formatDefinitions.ts`: emit `· ` lines per `selectedExamples`; `parseDefinitionsText` (round-trip: `· ` → previous entry's examples; orphan `·` → plain def text).
- Tests: `definitionSelection.test.ts` (new), extend `formatDefinitions.test.ts`. AC: 8, 9, 14.

## Slice 2 — selection state in `useCandidate`

- `exampleSelection` state + `toggleExample(defId, i, on)` (cascade-up on check).
- `toggleDefinition` extended: uncheck → delete `exSel[id]`; check + `includeAll` → all indices.
- `includeAllExamples` loaded in the existing `loadSettings` effect; snapshot re-init key gains `selectedExampleIds`.
- `buildCandidatePrefill`: `selectedExamples` per def + `selectedExampleIds`. AC: 3–8.

## Slice 3 — UI rows + CSS

- `CandidateView.tsx` `DefinitionItem`: examples as sibling `TihokaDefExampleItem` rows (role=checkbox, aria-checked, tabIndex, Space/Enter, stopPropagation-on-consume, `TihokaDefExampleText` guard, `getSelection` guard); def `onClick` drops dead `.TihokaDefExamples` guard.
- `DictionaryCheckable.module.css`: `TihokaDefExampleItem` host + compounds (idle dot hide, hover/focus reveal, active, checked fill + draw) co-located per file warning.
- `CandidateView.module.css`: `TihokaDefExampleText` (flex/min-width/wrap), `TihokaDefExamples` padding-left → `space-4` (dot column ~under old `•` position).
- `DictionaryPanelView.tsx` skeleton: mirror new DOM (examples sibling of `TihokaDefItem`).
- Tests: `CandidateView.test.tsx` — check/uncheck/cascade/reset/keyboard/aria. AC: 1–7, 14.

## Slice 4 — sinks

- `cardCreatorBridge.sendToCard`: prefer structured `selection.definitions`; string fallback via `parseDefinitionsText`; pass `selectedExampleIds` into `DictionaryPanelPrefill`.
- `addToOceanSrs.buildSrsFieldsFromPrefill`: `fields['examples']` = def texts + selected example sentences. AC: 10, 13.

## Slice 5 — settings UI + i18n

- `DictionaryPopupSettingsPanel.tsx`: step 4 "Examples" pills `manual|all` → boolean coercion.
- `en.json` + `vi.json`: `settings.dictionaryPopup.examples`, `.examples.manual`, `.examples.all`. AC: 11, 12.

## Gates + verify

- `typecheck`, `lint`, `test:unit`, `build`, browser verify (showcase): cascade, reset, include-all on/off, keyboard, clone round-trip.
- Fresh-context verify → `docs/reviews/dict-example-selection-verify.md`; sign-off → `-signoff.md`; delete mockup dir; update arch doc + wiki changelog.
