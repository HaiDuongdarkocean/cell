# Analyze Review — `dict-example-selection`

> Reviewed: `docs/intent/dict-example-selection.md` · Mode: interactive · User approval: granted

## Gate checklist

- [x] `## Journey` has AS-IS + TO-BE with ≥3 steps each; TO-BE ends at the promised value (examples on the card).
- [x] No need is secretly a solution — N1–N8 state outcomes; solution direction kept in BACCM `Solution` cell.
- [x] `ui_surface: yes` consistent with journey (user-visible checkbox interaction).
- [x] Decision `go` supported by risk register; backwards-compatible default (zero examples today = zero by default tomorrow).
- [x] Confidence honest — N8 marked medium (`[assumption]`, symmetric with `selectedDefinitionIds`).

## Interaction model lock (from user answers)

- `·` idle marker → checkbox reveal on hover/press/focus per example line (def contract).
- Example-check cascades up to parent def; unchecking all examples keeps def checked with 0 shipped.
- Def-check defaults to **def only**; Settings → Dictionary Popup toggle enables "include all examples".
- Def-uncheck resets that def's example selections.
- Examples serialize into card `definitions` field, inline under parent def.

## Scope boundary check

- In: `definition.examples[]` bullets only.
- Out: `SenseLine role:'example'` lines inside `definition.lines[]` — flagged as non-goal, potential follow-up.
- Snapshot: additive optional field; absent = no example selections.

## Open items for SPECIFY

- Example-selection state shape (`Map<defId, Set<index>>` vs composite-id map) — decided at spec time.
- Serialization format of example lines inside `definitions` (marker `·`, indent, order).
- Setting key name + i18n strings (en/vi).
- Snapshot field name (`selectedExampleIds` composite `defId:index`).

VERDICT: APPROVE
