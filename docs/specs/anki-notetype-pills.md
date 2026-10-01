# Spec: Notetype pills + manage surface on the Anki import mapping step

> Intent: `docs/intent/anki-notetype-pills.md` · ui_surface: yes · Mode: interactive

## Objective

On the Anki import mapping step, surface notetype identity and control as a first-class element: a borderless bar directly above the field rows containing selectable notetype pills (name + importable card count) on the left and a ghost icon button opening the manage surface on the right. Selecting a pill retargets the field mapping selects and the live card preview to that notetype. The manage surface — a popover anchored to the icon on desktop, a bottom sheet on mobile — lists every non-cloze notetype with an enable/disable control; disabling removes the pill, excludes the notetype from import, and moves selection to the next enabled notetype.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Importer (language learner) | opens mapping step, presses a pill, presses the manage icon, toggles a notetype in the manage surface | notetype choice, enable/disable decision | pill bar state, field selects for the chosen notetype, live preview card, manage surface |
| System | — | `NormalizedAnkiData.notetypes`, `importableNoteIds`, `cardCountByNt`, `ntIds`, `mappings`, `sampleIdx` | pills, manage surface, updated mapping/preview, updated import selection |

## Requirements

### Functional

REQ-1: Notetype pill bar
- Actor: Importer
- Goal: see and choose the notetype being mapped
- Preconditions: mapping step reached
- Basic flow:
  1. actor opens the Fields/mapping step
  2. system renders a borderless bar above the field rows: one pill per *enabled* notetype that has ≥1 importable card, labeled `name — N cards`; the notetype currently mapped is marked selected
  3. system renders a ghost icon button at the bar's right edge
- Alt flow: if zero notetypes qualify, the bar still renders with the manage icon and the column shows the existing `noneSelected` empty state
- Exception: none — pure render
- Rules: pills derive from `ntIds ∩ {cardCountByNt ≥ 1}`; order = `data.notetypes` order
- Postcondition: visible pill set = enabled notetypes with cards
- NFR refs: NFR-1, NFR-2

REQ-2: Select notetype via pill
- Actor: Importer
- Goal: map fields + preview for a chosen notetype
- Preconditions: ≥2 pills or current selection differs
- Basic flow:
  1. actor presses a pill
  2. system sets the selected notetype, resets the sample index to that notetype's first importable sample, unflips the preview
  3. system re-renders role selects with that notetype's field names and stored mapping, and the preview card from that notetype's notes
- Alt flow: pressing the already-selected pill is a no-op
- Exception: pill for a notetype with no importable notes does not exist (REQ-1 rule)
- Rules: raw selection is stored state (`selectedNtId`); the *effective* selected notetype is derived — stored id if still `enabled ∩ cards≥1`, else the next enabled notetype with cards in `data.notetypes` order (wrapping); sample list = the effective notetype's first ≤4 importable notes (existing per-nt cap carries over); dots/arrows cycle only those samples
- Postcondition: `nt` used by selects + preview = effective selected notetype
- NFR refs: NFR-1, NFR-2

REQ-3: Manage surface
- Actor: Importer
- Goal: enable/disable notetypes for import
- Preconditions: any
- Basic flow:
  1. actor presses the ghost manage icon
  2. system opens a popover anchored to the icon when `useIsMobile(BREAKPOINTS.expanded)` is false (viewport ≥840px), else a bottom sheet; the surface lists `data.notetypes.filter(!isCloze)` — every non-cloze notetype including 0-card ones — with name, card count, and enable/disable toggle (existing `Checkbox variant="row"` row)
  3. actor toggles a notetype; system updates `ntIds`, which flows to pills, sample set, and the existing `selection.notetypeIds` import contract
- Alt flow: surface stays open across multiple toggles (it is a manage surface, not a one-shot menu)
- Exception: toggles are never destructive — re-enabling restores the pill and its stored mapping
- Rules: popover dismissal = outside pointerdown, Escape (restores focus to the manage icon), scroll — `useDismissOnScroll` + `pushEscapeLayer` + composedPath outside-click per SpeedPill; sheet dismissal = existing BottomSheet behavior (Esc, outside click, header close). Popover focus model: the popover portals outside the modal Dialog's focus trap, so keyboard containment is explicit — Tab/Shift+Tab cycle the toggle rows (wrap at ends); no Tab path escapes the popover into the modal background while it is open
- Postcondition: `ntIds` reflects toggles; pill set re-derives per REQ-1
- NFR refs: NFR-1, NFR-3

REQ-4: Selection/focus recovery on disable
- Actor: Importer
- Goal: never strand the mapping view on a disabled notetype
- Preconditions: selected notetype disabled via REQ-3
- Basic flow:
  1. actor disables the currently selected notetype in the manage surface
  2. system removes its pill, selects the next enabled notetype with cards (first in `data.notetypes` order after the removed id; wraps to the start), resets sample index, unflips preview
  3. system keeps the actor's DOM focus on the toggle inside the manage surface — the row remains, now showing disabled state
- Alt flow: disabling a non-selected notetype leaves selection untouched — pill disappears only
- Exception: last enabled notetype disabled → column shows empty state; manage icon remains reachable; focus stays on the toggle
- Rules: effective selected notetype always ∈ `ntIds ∩ {cards ≥ 1}` — the invariant is derived (REQ-2), never stored invalid. **Deliberate deviation from intent N4**: the intent said "focus moves to the next notetype's pill"; the manage surface stays open (popover/sheet) and its sheet is focus-trapped, so DOM focus cannot cross to a pill without breaking containment — the requirement is satisfied by moving *selection* to the next notetype while DOM focus stays on the toggle. Recorded with user-approved direction.
- Postcondition: no dead selection, no focus loss
- NFR refs: NFR-2, NFR-3

REQ-6: Block empty-notetype import
- Actor: Importer
- Goal: never run an import that silently imports zero notetypes
- Preconditions: every notetype disabled, or no enabled notetype has importable cards
- Basic flow:
  1. actor views the mapping step with `ntIds ∩ {cards ≥ 1}` empty
  2. system renders the empty state and disables the Start import footer action
- Alt flow: none
- Exception: re-enabling any notetype re-enables Start import immediately
- Rules: `canContinue` for the mapping step requires ≥1 enabled notetype with ≥1 importable card, in addition to existing mapping completeness
- Postcondition: Start import cannot fire with an empty notetype set
- NFR refs: NFR-1

REQ-5: Remove "Advanced options" disclosure
- Actor: —
- Goal: single location for notetype control
- Basic flow: system no longer renders the `advRow` disclosure or its checkbox list; the ghost manage icon is the only entry point
- Rules: `advOpen` state and `ankiImport.advanced.*` strings removed if unused elsewhere
- Postcondition: one control surface, no duplicate paths

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | All controls keyboard-operable; pills use `Chip as="button"` (`aria-pressed` via selected), manage icon has `aria-label` + `aria-expanded`/`aria-haspopup` | U | WCAG operable |
| NFR-2 | Focus visibility follows the 2px `--color-border-focus` convention; no focus loss on removal | U | — |
| NFR-3 | Popover/sheet surfaces trap or restore focus per their existing component contracts | U | — |
| NFR-4 | Layout holds at 480px width (bar wraps or scrolls horizontally without overflow) | U | narrow viewport |
| NFR-5 | Tokens only — no hardcoded colors/spacing/radius | S | design-system-guardian |

## Flows / States

```
notetype pill bar
  nt enabled + cards>0 --pill renders--> visible pill
  pill press --> selectedNtId = id, sampleIdx = 0, flipped = false
  manage icon --> popover (≥840px) | bottom sheet (<840px)
  toggle off nt in surface --> ntIds.delete(id)
      if id == selectedNtId --> selectedNtId = next enabled nt (or null)
  all disabled --> empty state (noneSelected) + manage icon still reachable
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Expose which notetypes will import | Notetype pill bar (name + count), selected state |
| Let user choose the mapped notetype | Pill selection → `selectedNtId`; scoped sample dots/preview |
| Let user include/exclude notetypes | Manage surface: Popover (desktop) / BottomSheet (mobile) with checkbox rows over `ntIds` |
| Keep selection valid | Derived selection fallback to next enabled nt; empty state |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `ntIds` | `ReadonlySet<string>` of enabled notetype ids | `ImportWizard` state | session (dialog lifetime) |
| `selectedNtId` | `string | null` | `MappingStep` state | session |
| `mappings` | `Record<ntId, FieldMapping>` | wizard state + `mappingPresets` persistence (unchanged) | persisted |
| `cardCountByNt` | `Map<ntId, number>` | derived in wizard (unchanged) | derived |
| `sampleIdx` | index within selected nt's samples | `MappingStep` state | session |

## Alternatives considered

- **Centered Dialog instead of anchored Popover (desktop manage surface)** — rejected by user decision (`docs/reviews/anki-notetype-pills-analyze.md`): heavier than needed for a toggle list.
- **Keep "Advanced options" disclosure alongside pills** — rejected by user decision: single control surface, no duplicate paths.
- **Global sample dots across all enabled notetypes** — rejected by user decision: per-notetype scope keeps one-nt-per-view mental model.
- **Focus moves to next pill on disable** — modified (see REQ-4 deviation note): selection moves, DOM focus stays in the open manage surface.

## Traceability

| Need (intent ID) | REQ | AC |
|---|---|---|
| N1 | REQ-1 | AC-1 |
| N2 | REQ-2 | AC-2, AC-3 |
| N3 | REQ-3, REQ-5 | AC-4, AC-5 |
| N4 | REQ-4, REQ-6 | AC-6, AC-7, AC-11 |
| N5 | REQ-3 | AC-4, AC-9 |
| — (a11y hygiene, NFR-1/2) | REQ-1..4 | AC-8 |
| — (regression, DoD) | all | AC-10 |

| Journey step | REQ |
|---|---|
| TO-BE 1 (see pills + active) | REQ-1 |
| TO-BE 2 (press pill retargets) | REQ-2 |
| TO-BE 3 (manage surface toggles) | REQ-3 |
| TO-BE 4 (pill removal + selection/focus recovery) | REQ-4 |
| TO-BE 5 (import honors set) | REQ-3 (ntIds contract unchanged), REQ-6 |

## Boundaries

- Always: tokens only, shared components (`Chip`, `IconButton`, `Popover`, `BottomSheet`, `Checkbox variant="row"`), focus ring convention, gates (`typecheck`, `test:unit`, `build`) + real-Chrome verify with screenshots before commit
- Ask first: new dependency, `manifest.json` change
- Never: hardcoded colors/spacing, comments in code, touching other agents' in-flight files (`Select.module.css`, `pipeline-sessions.md`)

## Success Criteria

- AC-1: Mapping step renders a borderless bar above the field rows: pills for each enabled notetype with ≥1 importable card (`name — N cards`), active pill visually selected; ghost icon button at the bar's right edge. "Advanced options" disclosure no longer exists.
- AC-2: Pressing a pill retargets role selects + preview to that notetype (`sampleIdx` reset, card unflipped); dots/arrows cycle only that notetype's samples.
- AC-3: Selection state is explicit (`selectedNtId` or equivalent), not derived from the sample index.
- AC-4: Manage icon opens a popover anchored to it at ≥840px and a bottom sheet below; surface lists all non-cloze notetypes with enable/disable toggles and card counts; stays open across toggles.
- AC-5: Disabling a notetype removes its pill in the same frame and excludes it from `ntIds` (import selection).
- AC-6: Disabling the selected notetype auto-selects the next enabled notetype (list order, wrapping); manage-surface focus stays on the toggled row.
- AC-7: With zero enabled notetypes, the column shows the empty state and the manage icon remains reachable.
- AC-8: Pill keyboard operability: Tab reaches pills + manage icon; Enter/Space activates; focus ring = 2px `--color-border-focus`.
- AC-9: At 480px viewport the bar does not overflow the dialog; pills wrap or scroll horizontally.
- AC-10: No layout/color regressions elsewhere in the wizard (verified against `tmp/anki-import/audit-*` baseline).
- AC-11: With zero enabled notetypes (or zero with importable cards), Start import is disabled; re-enabling any notetype re-enables it.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run test:unit && npm run build` green
- [ ] Design-system check on changed files (tokens, shared components, no hardcoded values)
- [ ] Real-Chrome verification with screenshots: pill select, popover open, disable-selected focus move, empty state, narrow viewport, sheet
- [ ] `docs/2-architechture-system.md` updated for the wizard UI change

## Open Questions / Accepted Risks

- Manage surface title/label strings — reuse `ankiImport.advanced.title` copy or new `manage` keys (decide in design).
- Pill label format `name — N cards` uses existing `ankiImport.mapping.cardCount` string.
