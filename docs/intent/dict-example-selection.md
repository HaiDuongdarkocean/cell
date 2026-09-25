# Intent: Per-example selection inside dictionary definitions

> Slug: `dict-example-selection` · Mode: interactive · Source: user statement
> ui_surface: yes
> confidence: high

## Business Case

BACCM inference — every cell cites evidence (`file:line`) or `[assumption]` + confidence.

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Users building Anki cards from a dictionary entry cannot control which example sentences land on the card — examples are display-only and never reach the card, so cards lack usage examples or force manual copy-paste | `CandidateView.tsx:549-555` renders `definition.examples` as plain `• {ex}` divs; `buildCandidatePrefill.ts:44` maps defs to `{pos, text}` only | high |
| Change | Examples become first-class selectable items (same `·`→checkbox reveal as defs) whose checked state flows into the card's `definitions` field under their parent def | user statement + `DictionaryCheckable.module.css` reveal-state contract | high |
| Solution | Extend the existing def-selection model with a per-def example selection, cascade rules (example→def up, def→examples down per setting), and a persisted setting in Settings → Dictionary Popup | `definitionSelection.ts`, `useCandidate.ts`, `DictionaryPopupSettingsPanel.tsx` | high |
| Value | Card sentences match what the learner actually wants to drill — one click instead of hand-editing the card or skipping examples entirely | user statement ("tối ưu UX") | medium |
| Stakeholder | Language learners building cards on desktop + mobile (persona 5–80, RAM ≥1GB) | AGENTS.md persona | high |
| Context | Shared `CandidateView` renders both popup variant and integrated Universal Panel — one implementation covers both surfaces; selection snapshot must clone into the integrated pane like `selectedDefinitionIds` does | `popupTypes.ts:334-343` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainers | Small diff inside existing selection + prefill pipeline; must stay inside `dictionaryPopup`/`cardCreator` DAG | checkbox CSS contract already exists (`DictionaryCheckable.module.css`) |
| Customer | Anki learners | Pick which example sentences accompany a definition on the card | touch targets ≥ existing def rows |
| Supplier/Dependency | chrome.storage settings schema | New persisted boolean under `dictionaryPopup` | none — additive field |
| Organization | Future contributors | Selection semantics documented in one place (definitionSelection logic) | none — follow existing SSOT pattern |
| Regulator | Chrome Web Store policy | none — no new permissions/data | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Each example line under a definition can be individually checked/unchecked with the same `·`→checkbox reveal pattern as definitions | F / U | user statement + screenshot | high |
| N2 | Checking an example also checks its parent definition (cascade up) | F | user statement | high |
| N3 | Checking a definition selects examples per a persisted setting: default = def only (no examples); option ON = all examples of that def | F | user statement + Q3 clarification: "default sẽ là chỉ checkbox def thì không lấy example nào. chỉ khi cố tình nhấn check example thì mới bổ sung vào." | high |
| N4 | Unchecking a definition resets its example selections; re-checking restores the setting's default | F | user answer (Q4: "Reset luôn") | high |
| N5 | Checking some examples then unchecking all leaves the def checked with zero examples shipped | F | user statement + Q3 answer | high |
| N6 | Selected examples are written into the card `definitions` field inline under their parent def | F | user answer (Q1: "definitions") | high |
| N7 | The include-all-examples option lives in Settings → Dictionary Popup and persists | F / S | user answer (Q2) + `DictionaryPopupSettingsPanel.tsx` | high |
| N8 | Example selection state clones into the integrated panel via the selection snapshot (popup → Universal Panel send-to-card) | F | `[assumption]` — symmetric with `selectedDefinitionIds` | medium |

## Scope

- **In:** per-example checkbox UI inside `DefinitionItem`; example-selection state + cascade rules in `useCandidate`/`definitionSelection`; prefill serialization of selected examples under their def; new `dictionaryPopup` setting + settings-panel toggle; snapshot field for example selections.
- **Out:** changes to Anki field mapping (`definitions` already exists); new card fields; example sources outside `definition.examples` (SenseLine `role:'example'` inside `lines` stays display-only this round — see Non-goals).
- **Non-goals:** examples embedded inside `definition.lines` (`SenseLine role:'example'`) are a separate render path — this item covers `definition.examples[]` only; drag-select/multi-select; per-def "select all examples" mini-button.

## Workflow

A learner hovers a word → dictionary popup opens → they tick a definition. Under the new behavior, ticking the def checks just the def (default). Below the def, each example line shows the same `·` marker that reveals a checkbox on hover/press. Tapping an example's row checks that example and auto-checks its parent def. In Settings → Dictionary Popup a toggle "include all examples when selecting a definition" flips the default so def-check auto-selects every example of that def. When the user sends to card or quick-adds, the card's `definitions` field contains each checked def followed by its checked example lines. Sending from the popup into the Universal Panel dictionary tab carries the exact same def+example checked state via the selection snapshot.

## Journey

### AS-IS

1. Learner opens the dictionary popup on a word; definitions render with checkboxes, examples render as static `•` bullet lines under each def.
2. They tick a def — only `{pos, text}` reaches `buildPrefill`; `formatDefinitions` emits `• pos text` lines; `cardCreatorBridge` puts them in the card `definitions` field.
3. No example sentence ever reaches the card — the only path is closing the card dialog and typing/copying the example by hand.

### TO-BE

1. Learner opens the dictionary popup; each example line shows the `·` marker and reveals a checkbox on hover/press/focus, identical to def rows.
2. They tick an example → the example and its parent def become checked; or they tick the def alone (default: def only; with the setting ON: def + all its examples).
3. They fine-tune: uncheck unwanted examples; unchecking all examples leaves the def checked with none; unchecking the def resets its example selections.
4. Send to Card / Quick Add → `definitions` field contains each checked def line with its checked example lines underneath; opening the integrated Dictionary tab shows the identical checked state.

## Stories

Business-level only — "I want X so that Y, done when Z." Story ≠ task.

- S1: As a card builder, I want to pick individual example sentences so that my card shows only the usage I care about — done when a checked example ships into the card's definitions under its def.
- S2: As a card builder, I want checking a def to optionally pull all its examples so that dense dictionary entries don't need N extra taps — done when the setting ON makes def-check select every example of that def.
- S3: As a card builder, I want my example picks preserved when the card opens in the panel so that I don't re-select — done when the integrated pane shows the same checked examples as the popup.

## Risks

| Risk | Type (human/operational/internal/external/legal/hidden) | Impact | Team's ability to respond |
|---|---|---|---|
| Mobile tap target on small example rows too small | human | mis-taps, frustration | reuse def row hit-area pattern; verify on real device |
| `definition.examples` has no stable ids — index-keyed selection can drift if defs reorder | internal | wrong examples ship | key by `defId:index` (order is stable per lookup result); snapshot carries composite ids |
| Snapshot schema change breaks popup→panel clone on older builds | internal | selections lost on send | additive optional field; absent = no example selections |
| Confusion between `examples[]` bullets and `SenseLine role:'example'` lines inside `lines[]` | hidden | user expects ALL example-looking lines selectable | scope states non-goal explicitly; follow-up item can extend |
| Setting default flips silently for users expecting old "everything ships" behavior | operational | surprise thin cards | default keeps def-only = closest to current (examples never shipped anyway) |

## Decision

go — user-confirmed interaction model with explicit answers on all ambiguous branches; bounded diff inside one feature folder; backwards-compatible (current behavior ships zero examples, new default also ships zero unless picked).

## Draft Acceptance Criteria

Need-level ACs (system ACs are derived in SPECIFY → `## Success Criteria`).

- [ ] Every example line under a def shows `·` idle marker and reveals a checkbox on hover/press/focus, matching the def checkbox visual contract.
- [ ] Checking an example checks it and its parent def; unchecking an example affects only that example.
- [ ] Checking a def selects zero examples by default; with the setting ON it selects all examples of that def.
- [ ] Unchecking a def resets its example selections.
- [ ] A def stays checked when all its examples are unchecked, and ships with no example lines.
- [ ] Card `definitions` field contains each checked def with its checked examples inline beneath it.
- [ ] Setting persists in Settings → Dictionary Popup and applies to both popup and integrated variants.
- [ ] Popup→panel send carries def + example checked state identically.
