---
name: design-driven-development
description: Designs a screen end-to-end (UX structure + UI contract) in one pass, producing a single UI-UX-Contract.md the implementer follows without re-deriving. Two modes: Mode A = full screen (re)design; Mode B = incremental placement of one new function on an existing page. Two approval gates: Gate 1 = ASCII wireframe (structure), Gate 2 = full UI-UX-Contract (tokens, states, a11y, acceptance tests). Reuses upstream from interview-me/idea-refine; feeds a downstream implement loop or human coder. Use when designing or redesigning a screen, reorganizing a page, grouping settings, deciding where a new button/function goes, or building a UI-UX contract before implementation. Do NOT use for implementation itself (use a TDD/implement skill), or for pure visual tweak with no structural change.
---

# Design-Driven Development — UX + UI in one pass

One skill, two gates, one output file. Gate 1 locks the **structure** (UX: grouping, zones, order, wireframe). Gate 2 locks the **surface** (UI: tokens, states, a11y, acceptance tests). Output is a single `UI-UX-Contract.md` the implementer obeys without changing placement/vibe/IA.

```
interview-me / idea-refine / spec
        │
        ▼
  ┌─────────────────────────────────────────┐
  │ Mode detect: A (full screen) | B (add 1)│
  └──────────────────┬──────────────────────┘
                     ▼
  Gate 1 — WIREFRAME (UX structure)
    inventory → IA model → grouping → zones → order → whitespace → ASCII wireframe
    [APPROVAL GATE 1 — user picks variant]
                     │
                     ▼
  Gate 2 — UI-UX-CONTRACT (full surface)
    dials → aesthetic → tokens → states → a11y → anti-slop → ATs → mockup
    [APPROVAL GATE 2 — user approves contract]
                     │
                     ▼
  UI-UX-Contract.md  ──→  implement loop / human coder  ──→  ui-checker
```

## When to Use

**Mode A — Full screen (re)design**: function list/spec needs a layout; existing screen feels cluttered/mis-grouped/hard to scan; settings/options/dashboard reorganization; user says structure is wrong but visuals may stay.

**Mode B — Incremental addition**: new function needs a home on an existing page; "add a button for X on Y page"; upstream `interview-me`/`idea-refine` produced a new function concept.

**Triggers**: "design this UI", "redesign this screen", "reorganize this page", "build UI from functions", "make a UI-UX contract", "where should this button go", "group these settings", "design the IA + UI".

**When NOT to use**: pure visual tweak (color/font only) with no structural change → use a visual-design skill; implementation itself → use a TDD/implement skill; function list undefined and no upstream ran → run `interview-me` or `idea-refine` first.

## Pipeline — upstream and downstream

```
UPSTREAM (provides input)              THIS SKILL              DOWNSTREAM (consumes output)
─────────────────────────             ───────────              ──────────────────────────
interview-me  ─┐                                  ┌─→ implement loop (TDD + code-review skills)
               ├─→ design-driven-                 │   or human coder
idea-refine   ─┘   development                    │
                      (UX + UI)        ┌──────────┼─→ ui-checker
Spec / PRD ─────────────────────────────┘          │   (automated ATs via MCP + subagent)
                                                  └─→ G4 Plan / G6 Implementation
```

**Reuse rule**: if an upstream skill already elicited frequency/mental model/intent, do NOT re-ask. Re-asking wastes the user's time and signals you ignored upstream output.

## Input

5 inputs. **4 of 5 are in the codebase or upstream — fetch yourself before asking the user.** Asking what you can read is a failure mode.

| # | Input | Source | Fetch method |
|---|---|---|---|
| 1 | **Function list** (Mode A) OR **existing page structure** (Mode B) | Codebase | Audit source files (tsx/css), grep handlers, read UI components. Mode B: draw current wireframe + list groups/zones/order. |
| 2 | **New function spec** (Mode B only) | Upstream OR spec/PRD OR user | If `idea-refine` ran → reuse concept. Else read spec, or ask "what does this button do?" |
| 3 | **Constraints** | `manifest.json` + `AGENTS.md` + `docs/adr/` + architecture doc | Read platform (popup vs full tab, MV3), width/height limits, dark/light runtime, what must stay unchanged. |
| 4 | **Design system file** (tokens, fonts, existing components) | Codebase | Read existing CSS variables, theme files, shared UI components. Reuse tokens; do not invent new ones unless contract justifies. |
| 5 | **User context** (frequency + mental model) | Upstream OR ask user | If `interview-me` ran → reuse intent. Else ask ONE focused question on cache miss only. |

### Input-fetch order (mandatory)

```
need input
├── 0. Upstream skill ran? → reuse its output (intent → user context, concept → function spec)
├── 1. Codebase audit (function list / existing page, constraints, design system) ← do this yourself
├── 2. Docs audit (ADR, AGENTS.md, architecture doc) ← do this yourself
├── 3. Cache miss on frequency/mental model/grouping? → ask the user ONE focused question
└── 4. Approval gates → ask the user to confirm (mandatory, not optional)
```

**Rules**: do NOT ask for the function list (audit code); do NOT ask for constraints (read docs); do NOT re-ask what upstream elicited; do NOT dump multiple questions — one focused question only when a cache miss blocks progress; DO ask at both approval gates.

## Output

**One file**: `UI-UX-Contract.md` (see `templates/ui-contract-template.md`). Contains both UX (structure) and UI (surface) in one document. The implementer reads this single file and obeys it without changing placement/vibe/IA.

For Mode B, the contract includes a placement decision table + side-effect check (re-grouping? Hick ≤7? Miller ≤7? whitespace?) in addition to the full UI sections.

## Process

### Step 0 — Mode detection (do this first)

```
request says...
├── "design/redesign this screen" / "reorganize this page" / "arrange these functions"
│   → Mode A (full screen) — run Gate 1 (Steps 1-7) then Gate 2 (Steps 8-14)
├── "add a button for X on Y page" / "where should this new function go?"
│   → Mode B (incremental) — run Gate 1B (Steps B1-B4) then Gate 2 (Steps 8-14, scoped to affected area)
└── upstream skill (interview-me / idea-refine) produced a new function concept
    → Mode B (incremental) — run Gate 1B then Gate 2
```

### Gate 1 — WIREFRAME (UX structure)

Read `checklists/design-checklist.md` → "Layout Audit" section. Run every item before the gate.

| # | Step | Output | Key rule |
|---|---|---|---|
| 1 | Inventory functions (Mode A) OR audit existing page (Mode B) | table: # / function / frequency / destructive? | Tag frequent/occasional/rare/destructive. Mode B: draw current wireframe + list groups/zones/order. |
| 2 | Choose IA model | one model: scope-first (settings) / domain (dashboard) / task-flow (tool) | Default settings → scope-first (me/team/system). Pick ONE, cite why. |
| 3 | Group by model | groups with labels + why | 2-4=tabs, 5-12=sidebar, >12=sidebar+search. User vocabulary, not codebase names. No "Other"/"Misc" dump group. ≤5-7 per group (Miller). |
| 4 | Order within group | priority list per group | Frequency first, task-flow second, destructive last + separated. |
| 5 | Assign zones | zone per function: primary/secondary/tertiary | Primary=above-fold frequent; secondary=below-fold occasional; tertiary=collapsed rare/destructive. |
| 6 | Whitespace map | where large gaps / small gaps / borders | Proximity > border. Large gap separates groups, small gap unites within. Border only where proximity ambiguous. |
| 7 | ASCII wireframe(s) + responsive transform | 1-2 desktop variants; mobile/tablet if structure differs | Boxes/brackets/pipes only — no color/font/radius. Content parity across breakpoints (same groups, nav type changes). **[APPROVAL GATE 1]** — user picks variant or requests refine. No approval → no Gate 2. |

**Mode B Gate 1** (Steps B1-B4): audit existing page → spec new function → decide placement (group/zone/order/destructive handling, cite principle) → draw before/after wireframe with `← NEW` marker + side-effect check (re-grouping? Hick ≤7? Miller ≤7? whitespace? one-primary?). Then Gate 1 approval.

### Gate 2 — UI-UX-CONTRACT (full surface)

Read `checklists/design-checklist.md` → "Audit (redesign only)" + "Acceptance test definitions". Read `checklists/anti-slop-checklist.md` for the ban list.

| # | Step | Output | Key rule |
|---|---|---|---|
| 8 | Read brief, infer intent | one line: "Reading this as `<page kind>` for `<audience>`, `<vibe>` language, leaning `<aesthetic>`." | Ambiguous audience/vibe → ask ONE question. No guessing. |
| 9 | Set 3 dials | `VARIANCE/MOTION/DENSITY` 1-10, one-line reason each | Baseline `8/6/4`. Settings `4/3/5`, dashboards `5/3/7`, landing `8/7/4`. |
| 10 | Audit existing (redesign only) | 8-axis findings in `audit:` | Run design-checklist audit section (typography/color/layout/interactivity/content/component/iconography/code). |
| 11 | Functions → placement matrix | one row per function | Fields: id, name, element, tab, zone, priority, affordance, steps_to_complete (flag if >3), flow_ok. |
| 12 | Optimize task flows | step sequence per task | Max 3 steps entry→done. >7 choices → group/nest (Hick+Miller). Jakob's Law: no novel patterns. |
| 13 | Information architecture | nav type + grouping + labels | Reuse Gate 1 grouping. 2-4=tabs, 5-12=sidebar, >12=command menu. User vocabulary. |
| 14 | Visual hierarchy | where eye goes 1st/2nd/3rd | F-pattern (text), Z-pattern (simple), layer-cake (headings). Gestalt proximity + similarity. |
| 15 | Pick ONE aesthetic | selected + rejected (1-line reason each) | minimalist-ui / high-end-visual-design / industrial-brutalist-ui. Commit whole screen. No mixing. |
| 16 | Reference design system | path to design system file(s) + note any deviations | DO NOT re-define tokens. Read `docs/design-system/tokens/*` (color, typography, spacing, shape-elevation-motion) + `docs/design-system/components/*` + `docs/design-system/guidelines/*`. Contract references these by path. Only note deviations if a feature truly needs a token not in the system — ask user first. |
| 17 | State coverage | per-component state table | loading=skeleton, empty=composed, error=inline, hover/active/focus/disabled. Focus 2px ring 3:1 (WCAG 2.4.13). |
| 18 | Anti-slop rules | copy active bans into `anti_slop:` | Read anti-slop-checklist.md. Implementer must not violate. |
| 19 | Acceptance tests | AT1-AT7 in contract | Defined in design-checklist.md. Reviewer runs them post-implement. |
| 20 | Mockup | `mockups/<screen>.html` | Desktop + mobile side by side. Apply tokens + font. |
| 21 | User approval | **[APPROVAL GATE 2]** | No approval → no handoff. Mockup may change intent → update intent before handoff. |

## Verification

Before handing off, confirm:
- [ ] Gate 1 passed (wireframe approved) — `layout_audit:` section in contract marked APPROVED.
- [ ] Gate 2 passed (contract approved) — `mockup.status: approved`.
- [ ] One file produced: `UI-UX-Contract.md` with all 15 YAML sections filled.
- [ ] Mode B: placement decision table + side-effect check present.
- [ ] No em-dash, no Inter default, no AI-purple gradient in contract or mockup.
- [ ] Acceptance tests AT1-AT7 defined (reviewer will run them post-implement).

## Boundaries

**Always do**: reuse upstream output; fetch from codebase before asking; one focused question on cache miss; both approval gates mandatory.
**Ask first**: changing public APIs the contract depends on; introducing a new design token not in the existing system; deviating from `AGENTS.md` boundaries.
**Never do**: skip Gate 1 (wireframe) — structure must lock before surface; implement code (this skill produces contract only, implement is downstream); put em-dash/Inter/AI-purple in output; change placement/vibe/IA during implement without returning to Gate 1.

## Anti-patterns

- **Skipping Gate 1 to save time** → surface designed on wrong structure → rework. Gate 1 is cheap (ASCII), Gate 2 is expensive (mockup). Lock structure first.
- **Re-asking what upstream elicited** → wastes user time, signals you ignored interview-me output.
- **Implementing during Gate 2** → this skill produces contract only. Code is downstream.
- **Inventing tokens when design system has them** → fragmentation. Reuse existing CSS variables.
- **2 equal-weight variants at Gate 1 with no recommendation** → user picks blind. Recommend one, offer the other as alternative with one-line trade-off.
