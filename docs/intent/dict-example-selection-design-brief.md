# Design Brief — dict-example-selection

> Spec: `docs/specs/dict-example-selection.md` · Mockup: `src/entrypoints/mockup-dict-example-selection/`
> Live: `npm run dev` → `http://localhost:5173/src/entrypoints/mockup-dict-example-selection/index.html`

## Design Read

Per-example selection that inherits the definitions' `·`→checkbox reveal contract — the question is only *where* the affordance lives and *how much chrome* it costs.

## Function Audit

| Function | REQ | Element(s) it needs |
|---|---|---|
| Track per-example check state with cascades | REQ-1/2/3 | example row host, def row host, `aria-checked` bindings |
| Present selectable example rows | REQ-1 | idle `·` marker or persistent box, checked visual, focus outline |
| Gate def→examples auto-selection | REQ-5 | settings pill step (out of mockup scope — Settings panel is established UI) |
| Deliver selection to card | REQ-4 | non-visual (prefill/snapshot) |

## Journey Map

| TO-BE step | Concept coverage |
|---|---|
| Example line shows `·`, reveals checkbox | A (identical), B (always visible), C (morphs to ✓) |
| Tap example → example + def checked | all three via shared `useDefExampleSelection` |
| Uncheck examples → def stays checked | all three |
| Uncheck def → examples reset | all three |
| Setting toggles all-examples behavior | `include all examples on def check` toggle in each concept |

## Dials

- DESIGN_VARIANCE baseline: medium — must stay inside the checkable-row family
- MOTION_INTENSITY baseline: low — match existing reveal (`static.motion.duration-fast` fade/scale)
- VISUAL_DENSITY baseline: current popup density, mobile-first

## Inspiration Anchor

Nested todo lists (Todoist subtasks) — checking a subtask implies the parent goal; the parent doesn't collapse when subtasks differ. Feeling: "lightweight picking", not form-filling.

## Primary Job

Let the learner pick exactly the example sentences that drill best — with zero extra chrome weight on the already-dense dictionary card.

## Context Quote

User statement: "example cũng cần cơ chế dấu chấm · và người dùng có thể click chọn hiển thị checkbox như def" — prescribes the `·` + checkbox mechanism; concepts differ on chrome weight and toggle affordance, not on the mechanism itself.

## Concepts

### Concept A — Mirror rows

- **IA mental model:** every line (def or example) is a first-class selectable item; examples are just shallower siblings
- **Visual archetype:** identical `·` idle dot → reveal checkbox on hover/focus/press, per-row
- **Non-digital reference:** sub-bullets in a checklist
- **Material / surface:** transparent rows, `derived.light.color-surface-hover` on hover, `core.light.primary` fill when checked
- **Typography treatment:** example text in `core.light.textSecondary`
- **Motion signature:** box fade+scale-in on reveal (`static.motion.duration-fast` `static.motion.ease-out`)
- **UX flow:** gutter/row tap toggles; example text stays lookup-able + selectable (mirrors def text guard)
- **UI structure:** sibling `cellDefExampleItem` rows under the def's `cellDefItem` — no nested checkboxes
- **3 dials:** DESIGN_VARIANCE: low · MOTION_INTENSITY: low · VISUAL_DENSITY: unchanged
- **Why it fits:** user's prescription verbatim; zero new visual language to learn
- **Risk:** reveal-on-hover means touch users only see the box after first tap/press — same trade-off defs already made
- **Audit findings:** | nested checkbox invalid | solve — sibling rows | ARIA validity | | toggle-vs-lookup | solve — text excluded | nested lookup preserved |

### Concept B — Pinned boxes

- **IA mental model:** examples are sub-items of the def; affordance is always honest (never hides)
- **Visual archetype:** always-visible small outlined checkbox, indented sub-list, checked row gets `derived.light.color-primary-subtle` tint
- **Non-digital reference:** email-app sub-labels / file tree checkboxes
- **Material / surface:** persistent outlined box `static.borderWidth.thick` `core.light.textSecondary`, primary fill + row tint when checked
- **Typography treatment:** same secondary example text
- **Motion signature:** tint + fill swap only; no reveal motion
- **UX flow:** whole row toggles except text selection; box always there for touch users — no discovery needed
- **UI structure:** `role="group"` example list with sibling rows
- **3 dials:** DESIGN_VARIANCE: medium · MOTION_INTENSITY: minimal · VISUAL_DENSITY: +chrome per line
- **Why it fits:** best discoverability on touch (nothing hidden behind hover)
- **Risk:** visual noise — N always-on boxes on already-dense cards; diverges from def reveal contract
- **Audit findings:** | hover-hidden affordance fails touch | solve — box pinned | always honest |

### Concept C — Inline mark

- **IA mental model:** the bullet IS the control — tap `·` to mark, becomes ✓
- **Visual archetype:** zero extra chrome; `·` morphs into check icon; selected line tints `derived.light.color-primary-subtle` + text promotes to `core.light.text`
- **Non-digital reference:** ticking items on a paper list
- **Material / surface:** tinted row, no box
- **Typography treatment:** selected examples darken to full text color
- **Motion signature:** mark swap + tint fade
- **UX flow:** whole line toggles (mark or text) — lightest possible; trades away nested lookup on example text
- **UI structure:** inline `role="checkbox"` spans
- **3 dials:** DESIGN_VARIANCE: high · MOTION_INTENSITY: low · VISUAL_DENSITY: lightest
- **Why it fits:** least UI on mobile; state read via tint + mark
- **Risk:** breaks nested-lookup on example text (line toggles instead); no empty-box affordance for "this is selectable" — discovery relies on the `·`→✓ hint
- **Audit findings:** | lookup conflict | reject — accepts whole-line toggle | |

## Responsive Table

| Width | Behavior |
|---|---|
| 320–420 (mobile) | single column rows; hit targets ≥ def row (44px-equivalent via row padding) |
| 640+ (desktop) | identical layout — rows are fluid; hover reveal benefits pointer users |
| 1280+ | no change — popup max width caps the surface |

## States for Chosen Direction

| State | Visual |
|---|---|
| Idle | `·` dot (A) / empty box (B) / `·` (C) |
| Hover/focus/press | faded box reveal `component.checkbox.disabled-opacity` (A) / none needed (B,C) |
| Checked | primary fill + white check |
| Focus-visible | `core.light.primary` outline |
| Parent cascade | def box checks when example checked |
| Def unchecked | all example checks reset |

## Anti-patterns Avoided

- No invented checkbox visual — reuses `cellDefCheck`/`cellDefCheckBox` contract
- No nested `role="checkbox"` (sibling structure)
- No scope creep: `SenseLine role:'example'` lines untouched
- No new tokens — all values from tokens.json
