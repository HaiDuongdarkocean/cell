# Intent: Notetype pills + manage surface on the Anki import mapping step

> Slug: `anki-notetype-pills` · Mode: interactive · Source: user statement (Anh yêu, direct request)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | On the Fields/mapping step the user cannot see which Anki notetypes exist, which one is being mapped, or control which ones import — notetype selection is buried inside a collapsed "Advanced options" disclosure and the mapped notetype is only implied by whichever preview sample is showing (`nt = ntById.get(sample.modelId)`) | `ImportWizard.tsx:489` (nt derived from sample), `ImportWizard.tsx:593-623` (checkbox list inside `advOpen`) | high |
| Change | Notetype selection moves from a hidden checkbox list to a first-class pill bar above the field rows; notetype enable/disable moves into a dedicated manage surface (popup on desktop, sheet on mobile) opened from a ghost icon button | user statement | high |
| Solution | Direction: make notetype identity visible and directly selectable at the top of the mapping column; give management its own focused surface; keep preview + field selects scoped to the selected notetype | user statement + component inventory (`Chip as="button"`, `useIsMobile`, `Dialog`/`MobileSheet` exist) | high |
| Value | Fewer mis-mapped or unwanted notetypes imported; mapping step is understandable at a glance; no discovery cost for a core control | inferred from Anki multi-notetype decks being common; the fixture itself ships 2+ notetypes | medium-high |
| Stakeholder | Language learners importing Anki decks (existing userbase) | feature context | high |
| Context | Mapping step already owns `ntIds` (enabled set) + `cardCountByNt`; selection model is sample-driven, not explicit | `ImportWizard.tsx:49,75,135` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainers | Reuse `Chip`, `Dialog`/`MobileSheet`, `useIsMobile`; no new deps | Existing components cover all parts |
| Customer | Anki migrants with multi-notetype decks | See + choose + enable/disable notetypes without hunting | Persona: 5–80, desktop + mobile widths |
| Supplier/Dependency | none — data already normalized (`NormalizedAnkiData.notetypes`) | — | — |
| Organization | future contributors | Pill bar must not fork card-selection logic — keep one `sampleIdx`/`selectedNt` source of truth | — |
| Regulator | none — local-only import | — | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | See every importable notetype with its card count before/alongside mapping | U | user statement; `cardCountByNt` exists | high |
| N2 | Choose which notetype is being mapped + previewed explicitly | F/U | user statement | high |
| N3 | Enable/disable notetypes from a focused manage surface; disabled notetypes vanish from the pill bar and are excluded from import | F | user statement; `ntIds` already drives `selection.notetypeIds` for import (`ImportWizard.tsx:168`) | high |
| N4 | When the selected notetype is disabled, selection and keyboard focus land on the next notetype — never dead-end | U/R | user statement ("chọn focus vào notetype sau") | high |
| N5 | Manage surface adapts to viewport — popup on desktop, sheet on mobile | U | user statement; `useIsMobile` + `MobileSheet`/`BottomSheet` exist | medium-high |

## Scope

- **In:** notetype pill bar (name + card count, Chip-style) above the field rows; explicit selected-notetype state driving field selects + preview; ghost icon button opening a manage popup (desktop) / sheet (mobile) containing the enable/disable list; focus + selection fallback when the selected notetype is disabled; removal of the notetype checkbox list from the "Advanced options" disclosure (the disclosure is replaced by the manage surface).
- **Out:** editing notetype structure, per-note exclusion, cloze notetype import (already excluded upstream, `!x.isCloze`), changing the scope/deck step.
- **Non-goals:** redesigning the mapping selects, preview card internals, or the step rail.

## Workflow

User reaches the Fields step (after scope). The left column now opens with a borderless row: pills for each enabled notetype with its card count on the left, a ghost icon button on the right. Selecting a pill retargets the field selects and the live preview card to that notetype's notes. Pressing the icon opens the manage surface: a popup over the dialog on desktop, a bottom sheet on narrow/mobile viewports. Inside, each notetype has an enabled/disabled control. Disabling removes its pill at once; if it was the selected one, the next enabled notetype becomes selected and keyboard focus moves to its pill (or the icon button if none remain). Import then runs with `ntIds` unchanged in mechanism — the pills/manage surface are the new controls over the same set.

## Journey

### AS-IS
1. User reaches Fields step; sees role selects and a card preview, but nothing names the notetype being mapped — it silently follows whichever preview sample is on screen.
2. To see notetypes the user must discover and expand "Advanced options", revealing a checkbox list far from the fields it affects.
3. To map a different notetype, the user clicks preview dots until a sample of that notetype happens to appear.
4. Disabling a notetype in Advanced collapses away from view; the preview/mapping may still sit on its sample with no feedback.

### TO-BE
1. User reaches Fields step and sees pills for all enabled notetypes with card counts directly above the field rows; the active notetype is visibly selected.
2. User presses a pill — field selects and the preview card switch to that notetype immediately.
3. User opens the manage surface via the ghost icon (popup on desktop, sheet on mobile) and disables a notetype.
4. The disabled notetype's pill disappears; if it was selected, the next notetype becomes selected and focus moves to it — the mapping view never lands on a disabled notetype.
5. User starts the import; only enabled notetypes are written, same as today's `ntIds` contract.

## Stories

- S1: As an Anki migrant, I want to see all my notetypes and card counts where I map fields, so that I know what I'm importing — done when every enabled notetype renders as a pill with its count and the active one is clearly marked.
- S2: As an Anki migrant, I want to pick which notetype I'm mapping, so that each notetype gets correct field assignments — done when pressing a pill retargets the field selects and preview to that notetype's fields and notes.
- S3: As an Anki migrant, I want to disable notetypes I don't need, so that I import only what I want — done when the manage surface toggles membership of the import set and the pill/preview react immediately.
- S4: As an Anki migrant, I want the UI to recover gracefully when I remove the notetype I'm looking at, so that I'm never staring at a dead selection — done when the next notetype is auto-selected and focus follows.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| All notetypes disabled → empty mapping column needs a sane empty state | human/UX | medium | Show existing `noneSelected` copy + keep manage icon reachable to re-enable |
| Notetype with 0 importable notes → pill exists but no sample for preview | internal | low | Pill shows count 0; preview falls back to `noneSelected` for that nt or is skipped — decide in design |
| Focus loss when the focused pill unmounts | a11y | medium | Explicit `focus()` move to next pill on removal — verified in E2E |
| Sheet-vs-popup inconsistency across widths | UX | low | Single breakpoint (`BREAKPOINTS.expanded`/`medium`) via `useIsMobile`, same pattern as CardCreator |
| Mapping state for disabled nts lingers | internal | low | Harmless — `mappings` keyed by ntId already tolerates absence; keep for re-enable |

## Decision

go — core control currently hidden behind a disclosure; user-provided design maps cleanly onto existing components and state.

## Draft Acceptance Criteria

- [ ] Pill bar above field rows lists every enabled notetype with name + card count; active notetype visually selected (Chip selected state).
- [ ] Pressing a pill switches the mapped notetype: field selects show its field names/mapping and the preview shows its notes.
- [ ] Ghost icon button opens a manage surface — popup on desktop, sheet at mobile width — listing all notetypes with enable/disable controls.
- [ ] Disabling a notetype removes its pill immediately and excludes it from import (`ntIds`).
- [ ] Disabling the selected notetype auto-selects the next enabled notetype and moves keyboard focus to its pill.
- [ ] When zero notetypes are enabled, the column shows a non-dead-end empty state and the manage surface stays reachable.
- [ ] Focus ring on pills and manage items matches the 2px `--color-border-focus` convention; all controls keyboard-operable.
