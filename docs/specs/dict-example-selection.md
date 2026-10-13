# Spec: Per-example selection inside dictionary definitions

> Intent: `docs/intent/dict-example-selection.md` · ui_surface: yes · Mode: interactive

## Objective

Every example line inside `DefinitionEntry.examples[]` becomes an individually checkable row using the same `·`→checkbox reveal contract as definitions (`DictionaryCheckable.module.css`). Example selection cascades up to the parent definition; definition checks select examples per a persisted `dictionaryPopup` setting (default: none). Selected examples serialize into `PopupCardCreatorPrefill.definitions[].selectedExamples` and render inline under their def via `formatDefinitions`, flowing to Card Creator dialog, integrated Universal Panel clone, and Quick Add.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | tap/click/keyboard on example row gutter, def row, settings pill, Send to Card, Quick Add | example/def check state, setting choice | checkbox visuals, `aria-checked`, card fields |
| Settings UI | onChange | `DictionaryPopupSettings` partial | persisted settings |

System-internal processing never includes human behavior. Selection invariants live in pure logic (`definitionSelection.ts` family); React only renders and forwards intents.

## Requirements

### Functional

REQ-1: Select an individual example line
- Actor: Learner
- Goal: include a specific example sentence on the card
- Preconditions: candidate has ≥1 def with `examples.length > 0`
- Basic flow:
  1. actor clicks/taps the example row's gutter/check zone, or presses Space/Enter on the focused row
  2. system sets `exampleSelection[defId] += index` AND `definitionSelection[defId] = true` (cascade up)
  3. system renders the example row's `TihokaDefCheckBox` checked and the parent def checked
- Alt flow: unchecking a selected example removes only that index; parent def state unchanged
- Exception: click lands on example text (`TihokaDefExampleText`) → no toggle — the click passes through to the section's `data-allow-lookup` nested-lookup path and text selection, mirroring the def row's `TihokaDefText` guard; text-selection drag anywhere on the row → no toggle (`getSelection()` guard)
- Rules:
  - Each example row is its own `role="checkbox"` host — markup restructures so example rows are SIBLINGS of the def's `TihokaDefItem` (inside a neutral wrapper), never nested `checkbox` inside `checkbox`
  - Example rows use a new `TihokaDefExampleItem` host class defined in `DictionaryCheckable.module.css` with the same reveal compounds as `TihokaDefItem` (`·` idle dot via `TihokaDefCheck::before`, hover/focus-visible/press reveal, checked fill)
  - Example-row `onClick`/`onKeyDown` call `e.stopPropagation()` so no event reaches the def host; keyboard toggling an example can never toggle or reset the parent def
  - Toggle zone mirrors the def row: check slot + row padding/background; the example text itself is excluded so nested lookup keeps working
- Postcondition: `selectedExampleIds` includes `defId:index`; def checked
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-2: Definition-check selects examples per setting
- Actor: Learner
- Goal: control whether checking a def pulls its examples
- Preconditions: `dictionaryPopup.includeAllExamplesOnDefSelect` loaded (default `false`)
- Basic flow:
  1. actor checks a definition
  2. system reads the setting; if `true` → `exampleSelection[defId] = all indices`; if `false`/unset → no example changes
  3. system renders def checked; example boxes reflect the setting-driven state
- Alt flow: setting `true`, actor then unchecks specific examples — remaining examples stay checked, def stays checked
- Exception: settings load pending → behave as `false` (def-only), matching persisted default
- Rules: cascade only materializes example indices on def-check; it never un-checks examples the actor picked afterward while def stays checked
- Postcondition: `exampleSelection[defId]` = ∅ or {0..n-1} per setting
- NFR refs: NFR-2

REQ-3: Definition-uncheck resets example selection
- Actor: Learner
- Goal: return a def to a clean slate
- Preconditions: def checked, some examples selected
- Basic flow:
  1. actor unchecks the definition
  2. system sets `definitionSelection[defId] = false` and removes `exampleSelection[defId]` entirely
  3. system renders def unchecked, all its example boxes unchecked
- Alt flow: actor re-checks the def → REQ-2 applies fresh (setting default)
- Exception: none — reset is unconditional
- Rules: unchecking every example of a still-checked def leaves def checked with `exampleSelection[defId] = ∅` (0 examples ship — explicit removal is not "untouched")
- Postcondition: no stale example ids for the def
- NFR refs: NFR-2

REQ-4: Serialize selection into prefill + snapshot
- Actor: Learner (via Send to Card / Quick Add)
- Goal: checked examples reach the card and the integrated clone
- Preconditions: selection state in `useCandidate`
- Basic flow:
  1. actor invokes Send to Card / Quick Add
  2. system builds `PopupCardCreatorPrefill` where each `definitions[]` entry gains `selectedExamples?: readonly string[]` = that def's selected example texts in index order; `selectedExampleIds` = composite `defId:index` list
  3. system emits the prefill to dialog / panel / SRS paths
- Alt flow: no defs explicitly checked → existing fallback (all defs, each with its own selected examples — still only explicit ones)
- Exception: def checked with `exampleSelection[defId] = ∅` → entry ships `selectedExamples: []` and contributes no `defId:*` ids (explicit zero is distinguishable from absent)
- Rules:
  - The prefill field is named `selectedExamples`, NOT `examples` — `DefinitionEntry.examples` means "all dictionary examples" and `formatDefinitions` is also called with raw `DefinitionEntry[]` (`dictionaryGenerate.ts:147`); a shared name would leak every dictionary example into generated cards
  - `formatDefinitions` renders `• pos text` then `· {example}` lines for `d.selectedExamples`, defs separated by `\n\n`; entries without `selectedExamples` produce byte-identical output to today (protects `dictionaryGenerate`, `CardCreatorPanel`, subtitle-queue paths)
  - `cardCreatorBridge.sendToCard` prefers structured `selection.definitions` over re-parsed `context.prefill.definitions` string so `selectedExamples` survive the popup→panel hop; the string-parse fallback maps `· ` lines onto the previous entry's `selectedExamples` (round-trip fidelity) so stray `·` lines can never become bogus `• · ex` definitions
  - SRS `buildSrsFieldsFromPrefill`: `fields['examples']` = `[...def texts (unchanged), ...selected example sentences]` — all checked defs remain present, examples append after them; `fields['def']` unchanged
  - Snapshot init: `initExampleSelection` applies `selectedExampleIds` verbatim — never re-derived from `includeAllExamplesOnDefSelect`; orphan ids (unknown defId / index out of range) are dropped; `[]` means explicit zero, absent means "no snapshot"
- Postcondition: card `definitions` field contains checked examples inline; `DictionaryPanelPrefill` carries `selectedExampleIds`
- NFR refs: NFR-4

REQ-5: Persisted setting in Settings → Dictionary Popup
- Actor: Learner
- Goal: flip "include all examples when selecting a definition"
- Preconditions: Settings → Dictionary Popup open
- Basic flow:
  1. actor picks a pill in the new Examples step (step 4): "manual" | "all"
  2. system coerces the string pill value to boolean and writes `dictionaryPopup.includeAllExamplesOnDefSelect` via existing `update()` + onChange path
  3. system renders chosen pill active; `useCandidate` reads the value at mount
- Alt flow: `useCandidate` loads the setting lazily per mount (same pattern as `ttsVoices` load); profile-resolved like its `dictionaryPopup` siblings — the value follows the active language profile's resolved settings
- Exception: absent key in stored settings → default `false`
- Rules: i18n keys en + vi; `PillGroup` is string-valued so the step stores `'manual'|'all'` and `update()` maps `all → true`
- Postcondition: setting persisted in chrome.storage under `settings.dictionaryPopup`
- NFR refs: NFR-5

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Keyboard + AT parity with def rows: `role="checkbox"`, `aria-checked`, Space/Enter, `:focus-visible` outline; no nested checkboxes | U | sibling `TihokaDefExampleItem` hosts |
| NFR-2 | Example rows never bubble clicks/keys into parent def toggle; text-selection does not toggle | U | `stopPropagation` + `getSelection()` guard |
| NFR-3 | Toggle affordance = check slot + row padding (same as def); example text preserves nested lookup + selection | U | `TihokaDefExampleText` exclusion |
| NFR-4 | Selection output order = `result.definitions` order then example index order — derived by iterating the result, never `Map`/`Set` insertion order | R | deterministic |
| NFR-5 | New strings i18n'd in `en.json` + `vi.json`; setting tolerant of absent key | U | `t()` only, `?? false` |

## Flows / States

Example-selection state machine per def:

```
(def unchecked, examples ∅)
  --check example i→        (def checked, examples {i})
  --check def [opt OFF]→    (def checked, examples ∅)
  --check def [opt ON]→     (def checked, examples {0..n-1})
(def checked, examples S)
  --check example j∉S→      (def checked, examples S∪{j})
  --uncheck example i∈S→    (def checked, examples S\{i})   — incl. S\{i}=∅, def stays checked
  --uncheck def→            (def unchecked, examples ∅)      — reset, REQ-3
```

Send-to-card sequence (popup → integrated panel):

```
actor → CandidateView.sendToCard → useCandidate.buildPrefill
  → prefill{definitions[].selectedExamples, selectedExampleIds}
  → cardCreatorBridge.sendToCard (structured definitions win)
  → DictionaryPanelPrefill{definitions, selectedExampleIds}
  → integrated CandidateView → useCandidate.init*Selection → identical checked state
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Track per-example check state with def cascades | `ExampleSelection` map + `initExampleSelection`/`toSelectedExampleIds` in `definitionSelection.ts` family; `useCandidate` state + `toggleExample` |
| Present selectable example rows | Sibling `TihokaDefExampleItem` rows with `TihokaDefCheck`/`TihokaDefCheckBox` slots + `·` idle dot; `TihokaDefExampleText` lookup-safe zone |
| Gate def→examples auto-selection | `dictionaryPopup.includeAllExamplesOnDefSelect` + Settings pill step (string→bool coercion) |
| Deliver selected examples to card surfaces | `PopupCardCreatorPrefill.definitions[].selectedExamples`, `selectedExampleIds` snapshot, `formatDefinitions` `·` lines, `buildSrsFieldsFromPrefill` appended examples |
| Clone popup selection into integrated panel | `PopupSelectionSnapshot.selectedExampleIds` + `useCandidate` re-init key |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `ExampleSelection` | `Map<defId, Set<index>>` | `useCandidate` state | per candidate mount; re-init on term/snapshot change |
| `selectedExampleIds` | `readonly string[]` (`def-N:i`) | `PopupSelectionSnapshot` / `PopupCardCreatorPrefill` / `DictionaryPanelPrefill` | message lifetime |
| `definitions[].selectedExamples` | `readonly string[]` — selected only | `PopupCardCreatorPrefill.definitions` entry | message lifetime |
| `includeAllExamplesOnDefSelect` | `boolean`, default `false` | `chrome.storage` → `settings.dictionaryPopup` (profile-resolved) | persisted |

Def ids are `def-${idx}` (lookupOrchestrator:614,685) — `:` never appears, composite id `defId:index` splits safely on the last `:`.

Alternatives considered: flat `Map<compositeId,bool>` (rejected — per-def grouping makes cascade/reset O(1) instead of scanning keys); `examples` as prefill field name (rejected — collides with `DefinitionEntry.examples` = all dict examples, would leak into `dictionaryGenerate` cards); separate `moreExample` side-channel (rejected — user chose inline `definitions`).

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 example checkable with `·` reveal | REQ-1 | AC-1, AC-2, AC-14 |
| N2 example→def cascade | REQ-1 | AC-3 |
| N3 def-check per setting (default none) | REQ-2, REQ-5 | AC-4, AC-5 |
| N4 def-uncheck resets examples | REQ-3 | AC-6 |
| N5 uncheck-all keeps def, ships 0 | REQ-3 | AC-7 |
| N6 examples inline in `definitions` | REQ-4 | AC-8, AC-9, AC-13 |
| N7 setting persists in Dictionary Popup settings | REQ-5 | AC-11, AC-12 |
| N8 clone preserves example checks | REQ-4 | AC-10 |

| Journey step | REQ |
|---|---|
| TO-BE-1 `·` marker + checkbox reveal | REQ-1 |
| TO-BE-2 example→def cascade, def-check per setting | REQ-1, REQ-2 |
| TO-BE-3 fine-tune/uncheck-all/uncheck-def reset | REQ-3 |
| TO-BE-4 send → inline examples + identical clone | REQ-4 |

## Boundaries

- Always: `npm run typecheck && npm run lint && npm run test:unit && npm run build` before commit; UI strings via `t()`; tokens only for CSS; selection logic pure in `logic/` modules; compound-selector classes stay in `DictionaryCheckable.module.css`.
- Ask first: changing `PopupSelectionSnapshot` consumers outside `dictionaryPopup`/`universalPanel`; new Anki field ids.
- Never: mutating `useDictionaryLookup`'s unused def-selection mirror; editing `dist/`; renaming `DefinitionEntry.examples`.

## Success Criteria

- [ ] AC-1: Each example line under a def renders as its own checkable sibling row: `role="checkbox"`, `aria-checked`, `tabIndex=0`, idle `·` dot in the `TihokaDefCheck` slot, box reveals on row hover/focus-visible/press; text renders without `•` prefix; no `role="checkbox"` ancestor.
- [ ] AC-2: Space/Enter on a focused example row toggles only that example (parent def affected solely via cascade-up on check); `:focus-visible` shows outline + revealed box.
- [ ] AC-3: Checking an example checks it AND its parent def; unchecking it leaves the def checked.
- [ ] AC-4: With the setting OFF (default), checking a def selects zero examples.
- [ ] AC-5: With the setting ON, checking a def selects all examples of that def.
- [ ] AC-6: Unchecking a def clears `exampleSelection[defId]`; re-checking returns to the setting default.
- [ ] AC-7: Checking examples then unchecking all leaves the def checked; `buildPrefill` ships that def with `selectedExamples: []`.
- [ ] AC-8: `buildPrefill` emits `definitions[].selectedExamples` = selected example texts in index order; `selectedExampleIds` = `defId:index` strings; a checked def with zero examples emits `selectedExampleIds` without that def's ids.
- [ ] AC-9: `formatDefinitions` renders `• pos text` + `· example` lines per def, `\n\n` between defs; entries without `selectedExamples` produce byte-identical output to today (covers `dictionaryGenerate` and subtitle-queue callers).
- [ ] AC-10: Popup → Send to Card → integrated Dictionary candidate shows identical def+example checked state; the card `definitions` field contains the example lines.
- [ ] AC-11: New "Examples" step appears in Settings → Dictionary Popup; choice persists across reload; absent stored key behaves as OFF.
- [ ] AC-12: en + vi strings exist for the new step label and both pill options.
- [ ] AC-13: Quick Add (SRS) `fields['examples']` = all checked def texts followed by selected example sentences; no selected defs are dropped; unchanged when no examples selected.
- [ ] AC-14: Example-text clicks reach nested lookup/text selection without toggling; gutter clicks toggle; `· ` lines in a parsed definitions string never become `• · ex` entries.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check if touching TSX/CSS
- [ ] Real-Chromium verification on showcase: example check/uncheck, cascade, reset, setting both ways, keyboard, send-to-card clone
- [ ] Canon docs updated (arch / wiki / ADR where decisions were made)

## Open Questions / Accepted Risks

- ~~`SenseLine role:'example'` lines inside `definition.lines[]` stay non-selectable~~ — **amended post-ship**: real dictionaries emit examples exclusively as sense-level example lines, so `lookupOrchestrator` now hoists `role:'example'` lines out of `lines`/`text` into `examples` (`readonly SenseLine[]`, translation/pattern/citation preserved). `text` no longer embeds example lines, so unselected examples never leak into card fields.
- `useDictionaryLookup.definitionSelection`/`toggleDefinition`/`selectedDefinitions` are dead state (no consumer) — left untouched; cleanup is a separate hygiene item.
- Indeterminate def state when only some examples checked: not shown (def stays plain checked) — matches requested semantics.
- Settings-load race: a def check before `loadSettings()` resolves behaves as OFF (persisted default) — accepted; revisit if users report surprise.
- Hovering an example row no longer reveals the parent def's checkbox (examples are siblings now, outside `TihokaDefItem:hover`) — intentional per-row reveal, matches reviewer guidance.
