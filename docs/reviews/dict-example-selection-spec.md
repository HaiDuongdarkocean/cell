# Spec Review — dict-example-selection

> Reviewed: `docs/specs/dict-example-selection.md` vs `docs/intent/dict-example-selection.md`
> Reviewer: `spec-reviewer` subagent (fresh context, BA/PO/TL lenses) — one pass

Spec matches the intent well overall: needs N1–N8 are covered, scope/non-goals are explicit, cascade semantics match the locked answers, and the proposed seams (`useCandidate`, `definitionSelection`, `PopupSelectionSnapshot`, `formatDefinitions`, settings panel) are the right ones. Several implementation traps were flagged and fixed before DELIVER.

## Blockers

1. **[REQ-4 / Data / AC-8–9] [TL] — `definitions[].examples` collides with `DefinitionEntry.examples` and would leak all examples through `dictionaryGenerate`.**
   `formatDefinitions(winner.definitions)` is also called at `src/features/cardCreator/service/dictionaryGenerate.ts:147` with raw `DefinitionEntry[]`, where `examples` means *all dictionary examples*, not selected examples. Extending `formatDefinitions` to render `.examples` would emit every example in generated cards.
   **Fix required:** selected-only field name, enumerated `formatDefinitions` consumers, regression AC for generated definitions.

## Major

1. **[REQ-1 / NFR-1 / AC-2] [TL] — Example-row Space/Enter will bubble into the parent def row.**
   Parent `onKeyDown` at `CandidateView.tsx:499-504` toggles the def without a target guard.
   **Fix required:** `e.stopPropagation()` on example-row handlers + AC.

2. **[REQ-1 / NFR-3 / AC-14] [BA/TL] — "full-row tap toggles" conflicts with nested dictionary lookup.**
   The definitions section has `data-allow-lookup`; def rows exclude `.TihokaDefText` from toggling.
   **Fix required:** explicit toggle zone (gutter/row, not text).

3. **[REQ-1 / NFR-1 / CSS contract] [TL/a11y] — Nested `role="checkbox"` plus `.TihokaDefItem` descendant selectors create broken interaction boundaries.**
   **Fix required:** sibling-row structure or scoped example-row host; per-row reveal semantics.

4. **[REQ-4 / AC-13] [PO/TL] — Ocean SRS mapping can drop selected definitions.**
   `fields['examples']` currently carries all def texts; swapping to example sentences would drop defs 2..n.
   **Fix required:** SRS mapping that preserves all checked defs and appends examples.

## Minor

1. **[REQ-4 / Data] [TL]** Snapshot init precedence under-specified: verbatim apply, no re-derivation from setting, orphan-id drop, explicit `[]` vs absent.
2. **[NFR-4 / Data] [TL]** Deterministic order must come from iterating `result.definitions` + indices, not `Map`/`Set` insertion order.
3. **[Flows/States] [BA]** Missing `(def checked, S) --check example j→ S∪{j}` transition.
4. **[Traceability] [BA]** AC-13/AC-14 unmapped; AC-12 belongs under N7.
5. **[REQ-4] [TL]** Bound `sendToCard`'s string-parse fallback so `· ` lines cannot become bogus `• · ex` entries (`cardCreatorBridge.ts:129-141`).
6. **[REQ-5] [TL]** `PillGroup` is string-valued → boolean coercion note; clarify "global" = profile-resolved `dictionaryPopup` slice.
7. **[Spec completeness] [TL]** Add alternatives-considered note.

## Role notes

- **BA:** Strong need coverage and scope discipline; remaining gaps are traceability rows and the toggle-vs-lookup UX contract.
- **PO:** ACs are mostly testable; needs explicit cases for keyboard bubbling, nested lookup, SRS multi-def output, and `dictionaryGenerate` regression.
- **TL:** Architecture and additive schema sound; spec must pin event boundaries, DOM/CSS structure, selected-only data shape, snapshot precedence, and consumer blast radius.

## Accepted risks (carried to spec)

- Settings-load race: def check before `loadSettings()` resolves behaves as OFF.
- `SenseLine role:'example'` remains out of scope.
- Index-keyed `defId:index` ids acceptable — lookup output order is stable per result.

## Applied fixes

All eight action items were applied to `docs/specs/dict-example-selection.md` (single fix pass, no re-review):

1. **Field renamed** `definitions[].examples` → `definitions[].selectedExamples`; REQ-4 rules now state the collision rationale explicitly and AC-9 requires byte-identical output for entries without `selectedExamples` (covers `dictionaryGenerate`, `CardCreatorPanel`, subtitle-queue paths).
2. **Keyboard isolation**: REQ-1 rules + NFR-2 + AC-2 now require `e.stopPropagation()` on example-row `onClick`/`onKeyDown`; parent def can only change via cascade-up.
3. **Toggle zone defined**: `TihokaDefExampleText` exclusion mirrors `TihokaDefText`; example text clicks reach nested lookup/selection (AC-14, NFR-3).
4. **Sibling structure**: example rows are siblings of `TihokaDefItem` inside a neutral wrapper via new `TihokaDefExampleItem` host class in `DictionaryCheckable.module.css` — no nested `role="checkbox"`; per-row reveal; AC-1 asserts "no `role="checkbox"` ancestor".
5. **SRS mapping**: `fields['examples']` = `[...def texts, ...selected example sentences]` — defs never dropped (AC-13).
6. **Snapshot semantics**: REQ-4 rules pin verbatim `selectedExampleIds` init (never re-derived from setting), orphan-id drop, `[]` = explicit zero vs absent = no snapshot; NFR-4 pins iteration order from `result.definitions`.
7. **Traceability + state machine**: added `--check example j→ S∪{j}`; AC-13→N6, AC-14→N1, AC-12→N7.
8. **REQ-5 notes**: string pill `'manual'|'all'` → boolean coercion; profile-resolved scope; alternatives-considered paragraph added under Data.

VERDICT: APPROVE_WITH_CHANGES
