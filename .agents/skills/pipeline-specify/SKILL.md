---
name: pipeline-specify
description: SPECIFY stage of the agentic SDLC — system analysis that converts a confirmed intent doc into a reviewable spec (actor/system boundary, use-case-like requirements, flows/states, function/feature map, traceability). Absorbs spec-driven-development + spec-review-stakeholder.
---

# Pipeline SPECIFY

> `docs/intent/<slug>.md` → system analysis → `docs/specs/<slug>.md` → `spec-reviewer` gate → `transition → design|deliver`.

## Overview

ANALYZE established *what need exists and for whom*. SPECIFY converts that into *what the system must do* — with a hard boundary: **actors trigger, input, and receive output; the system performs internal processing.** Human behavior never appears inside a system flow.

The method chain is fixed — do not skip links:

```
stories + process + logic (from intent)
→ use-case-like requirements      (actor, goal, flows, rules)
→ flows / states                  (activity, sequence, state — text form)
→ function vs feature structure   (function = what system does; feature = tool supporting it)
→ data                            (what the system stores/moves)
```

## When to Use

- Active item at `stage=specify` with confirmed intent doc
- `transition analyze→specify` just succeeded

## When NOT to Use

- No intent doc → `pipeline-analyze`
- Intent doc `## Decision` ≠ `go` → resolve upstream
- Mid-flight item with artifacts but no state → `pipeline-state.mjs seed <slug>`

## Stage Contract

```
in:   docs/intent/<slug>.md   (Decision=go)
out:  docs/specs/<slug>.md    (schema → references/spec-template.md)
      docs/reviews/<slug>-spec.md  (spec-reviewer report, ends `VERDICT: <token>`)
exit: uiSurface=yes → transition --to design
      uiSurface=no  → transition --to deliver
      uiSurface=unknown → transition refuses — `set uiSurface=` first
```

## State Steps

```bash
node scripts/pipeline-state.mjs get <slug>                    # confirm stage=specify
node scripts/pipeline-state.mjs set <slug> artifacts.spec=docs/specs/<slug>.md
node scripts/pipeline-state.mjs set <slug> uiSurface=<yes|no> # if ANALYZE left it unknown
node scripts/pipeline-state.mjs transition <slug> --to <design|deliver>
```

## The method chain in detail

### 1. Stories + process + logic → requirements

Every business story and journey step in the intent doc maps to ≥1 requirement. Nothing enters the spec that doesn't trace back to a need — and no need ships without a requirement.

### 2. Use-case-like requirements

Each requirement is a reduced use-case spec (markdown, no UML tool needed):

```
REQ-<n>: <name>
- Actor:        <external entity that triggers/inputs/receives>
- Goal:         <what the actor achieves>
- Preconditions:<what must be true before>
- Basic flow:   1. actor ... 2. system ... 3. system ... (input → process → output)
- Alt flow:     <optional variations — main vs additional, separated>
- Exception:    <what can fail + how the system responds>
- Rules:        <business rules constraining the flow>
- Postcondition:<what is true after>
- NFR refs:     <which non-functional requirements apply>
```

**Boundary rules:**
- Actor = external only: triggers, supplies input, receives output, views results.
- System = internal processing. "User decides X" inside a system flow is a defect — model it as actor input or a branch in the flow.
- Every flow step reads as input → process → output, not just verb lists.

### 3. Flows / states

Complex behavior gets text-based diagrams after the requirement: activity flow (branch/merge), sequence (who calls whom in what order), state transitions (`state --event→ state`). Same rules as ANALYZE: narrative readable in 15s, notation flexible, only the product-relevant parts.

### 4. Function vs feature

| | Function | Feature |
|---|---|---|
| What | What the system **does** (capability) | Tool/mechanism **supporting** a function |
| Example | "detect resume point" | "PlayContinue button", "auto-resume on open" |
| Cardinality | 1 function | ↔ n features |

**UI may only be designed against features whose functions are understood.** This mapping is what DESIGN consumes — a function with no feature is unbuildable; a feature with no function is scope creep.

### 5. Data

What the system stores, moves, transforms: entities, key fields, where they live (storage keys, stores), retention. Enough for DELIVER to build — not a schema dump.

### Overview↔detail — review both directions

"Trong tổng quan có chi tiết": after writing, read the spec overview→detail (does the structure hold?) and detail→overview (does any detail contradict the whole?). Fix what breaks either direction.

## Spec template invariants

`references/spec-template.md` — mandatory sections:

- `## Success Criteria` — **canonical AC source for DELIVER**; specific, testable, traced to needs
- Actor↔system boundary statement
- Requirements (use-case-like, FR + NFR)
- Flows/states where behavior is complex
- Function↔feature mapping table
- **Traceability table**: need → requirement → AC, journey-step → requirement
- Boundaries (always / ask-first / never), Definition of Done

## Review gate — `spec-reviewer` subagent

Reviewer rubric: `references/review-lenses.md` (BA/PO/TL lenses + merge + report format).

1. Spawn `spec-reviewer` (fresh context — never self-review; one agent, one pass applying all three lenses) against `docs/specs/<slug>.md`.
2. Write its report to `docs/reviews/<slug>-spec.md`, ending `VERDICT: APPROVE|APPROVE_WITH_CHANGES|REJECT`.
3. **Exactly one review pass** — no fix→re-review loop:
   - APPROVE → transition.
   - APPROVE_WITH_CHANGES → apply the listed fixes to the spec, then append an `## Applied fixes` section to the review artifact naming what was changed (refreshes its mtime past the spec's) → transition.
   - REJECT → `transition --to analyze` (backward edge; the rewrite gets reviewed on the next SPECIFY pass, not re-reviewed now).
4. The artifact must be **newer than the spec** — transition refuses stale reviews. Editing the spec after review without updating the artifact = stale.

## Backward edge

Wrong-need discovery → `transition --to analyze` (loops += 1, cap 3 → `flagged:loop-cap` + resolve). Fix the intent doc first, then re-run SPECIFY.

## Anti-patterns

| Don't | Why |
|---|---|
| Human behavior inside system flows | Actor is trigger/input/receive only — violates the boundary |
| Requirements with no need trace | Scope enters silently; traceability table exists to catch it |
| Feature named before its function | UI designed on mechanism, not capability — the FAB failure mode |
| Skip alt/exception flows | The happy path is the easy half; edge behavior is where specs fail |
| Self-review as the gate | Generation ≠ review — fresh-context subagent only |
| `VERDICT:` missing or buried mid-file | Parser reads the last matching line — put it last |

## Verification

- [ ] Every intent need traces to ≥1 REQ; every REQ traces to a need and an AC
- [ ] Every REQ has actor/goal/precondition/basic+alt+exception flows/rules/postcondition/NFR refs
- [ ] No actor-side behavior inside a system step
- [ ] Function↔feature table complete — no orphan on either side
- [ ] `## Success Criteria` present, testable, need-traced
- [ ] Every one-way-door decision in the spec has an ADR at status Proposed in `docs/adr/` (see `documentation-and-adrs`)
- [ ] `docs/reviews/<slug>-spec.md` verdict APPROVE* and mtime ≥ spec mtime
- [ ] `transition` exits 0 toward `design` (uiSurface=yes) or `deliver` (uiSurface=no)

## Router boomerang

Task đổi → `/using-agent-skills`. Intent wrong → `transition --to analyze`. UI question → `pipeline-design`. Plan/build → `pipeline-deliver`.
