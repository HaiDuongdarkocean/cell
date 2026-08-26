---
name: elicitation
description: Orchestrate the full elicitation pipeline — transform a vague idea or pain into a confirmed 8-field frame by routing through idea-refine, interview, observation, and doubt-driven validation before handing off to spec-driven development.
---

# Elicitation

## Overview

Elicitation is the bridge between a vague idea and a buildable spec. It is not one technique — it is an **orchestrated pipeline** of specialized skills that surface what the user actually wants, validate assumptions, and produce a confirmed 8-field frame.

## When to Use

- User has an idea but no spec: "I want a clipboard page"
- User describes a pain: "I'm tired of re-copying things"
- Request is conventional, not specific: "make it faster", "build me X"
- Need to validate assumptions before writing `docs/specs/*.md`
- Handoff from `idea-refine` to `spec-driven-development`

## When NOT to Use

- Spec already exists → `/spec-review-stakeholder`
- Ask is unambiguous and self-contained → implement directly
- User explicitly asks for speed over verification

## Orchestrated Skills

```
raw idea / pain
    │
    ▼
┌─────────────────────┐
│ 1. idea-refine      │ Diverge: expand, cluster, stress-test
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. observation      │ Contextual inquiry: ask user how they work without a tool
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. interview-me     │ Converge: one-question-at-a-time + prototype validation
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. doubt-driven-development │ Stress-test assumptions
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5. output           │ Confirmed 8-field frame + handoff
└─────────────────────┘
```

## Input

| # | Input | Description |
|---|---|---|
| 1 | **Raw user statement** | What the user said: "I want...", "I hate...", "Can we...?" |
| 2 | **Current workflow story** | How the user does the job today **without the tool** |
| 3 | **Pain markers** | Slow, repetitive, error-prone, forgettable steps |
| 4 | **Domain context** | `docs/context/project-context.md`, `docs/2-architechture-system.md` |
| 5 | **Existing specs/ADRs** | `docs/specs/`, `docs/adr/` — avoid duplicates and conflicts |

## Output

| # | Output | Description |
|---|---|---|
| 1 | **Confirmed 8-field frame** | Problem / User / Current workflow / Pain / Evidence / Desired outcome / Constraint / Scope |
| 2 | **Elicitation method used** | `interview` / `prototype` / `ideation` / `observation` / combination |
| 3 | **Route decision** | `/spec-driven-development` or `/interview-me` (if more validation needed) |
| 4 | **Log file** | `docs/intent/[topic].md` with all rounds of confirmed feedback |

## Step 1: Idea Refine (Diverge)

**Purpose:** Expand the idea before narrowing.

**When to skip:** If the user already gave a concrete pain or workflow.

**Actions:**
- Invoke `/idea-refine` on the raw statement
- Get: problem statement, 2-3 directions, key assumptions, MVP scope, Not Doing list

## Step 2: Observation (Contextual Inquiry)

**Purpose:** Ground the idea in the user's real workflow.

**Actions:**
Ask the user to walk through how they do the job **without the tool**.

**Standard questions:**
- "Anh làm việc này từ đầu đến cuối như thế nào khi chưa có tool?"
- "Bước nào mất nhiều thời gian nhất?"
- "Có lần nào anh bực mình vì quên hoặc mất dữ liệu không?"
- "Nếu không có máy tính, anh làm thế nào?"

**Log:** Write the workflow story to `docs/intent/[topic].md`.

## Step 3: Interview-Me (Converge)

**Purpose:** Confirm the 8-field frame one field at a time.

**Actions:**
- Invoke `/interview-me`
- Fill 8-field frame:
  1. Problem
  2. User
  3. Current workflow
  4. Pain point
  5. Evidence
  6. Desired outcome
  7. Constraint
  8. Scope (MVP + out-of-scope + chosen method)
- If user cannot answer abstract questions, switch to prototype elicitation (Step 7-13 of `interview-me`)

## Step 4: Doubt-Driven Development (Stress-Test)

**Purpose:** Challenge assumptions before spec.

**Actions:**
- Invoke `/doubt-driven-development`
- Question: "What if the core assumption is wrong?"
- Validate: evidence, hardest part, what could kill the idea

## Step 5: Output and Handoff

**Criteria to hand off to `/spec-driven-development`:**
- All 8 fields meet "enough" criteria
- Explicit user "yes"
- Agent can predict user's reaction to the next 3 questions
- Assumptions logged with validation strategy

**If not ready:**
- Return to Step 3 (`interview-me`) for more validation
- Or return to Step 1 (`idea-refine`) if direction is unclear

**Deliverable:**
```markdown
## Elicitation Result — [topic]

- Problem: [concrete pain statement]
- User: [persona]
- Current workflow: [steps]
- Pain point: [specific, quantified]
- Evidence: [data/observation]
- Desired outcome: [measurable]
- Constraint: [limits + conflicts]
- Scope: [MVP + out-of-scope + method]

**Methods used:** [interview / observation / prototype / ideation]
**Next skill:** spec-driven-development
**Log:** docs/intent/[topic].md
```

## Verification Checklist

- [ ] `docs/context/project-context.md` loaded
- [ ] Domain scoping ran — no duplicate specs
- [ ] `idea-refine` completed if direction was unclear
- [ ] Observation workflow story documented
- [ ] 8-field frame confirmed with explicit yes
- [ ] `doubt-driven-development` stress-test ran
- [ ] `docs/intent/[topic].md` updated with all feedback rounds
- [ ] Route to `/spec-driven-development` documented

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Start with spec before elicitation | Run `/elicitation` first |
| Accept vague answers | Rephrase → confirm loop |
| Skip observation | Always ask for real workflow |
| Skip doubt-driven | Always stress-test core assumption |
| Save intent doc before user confirms | Confirm first, save after |

## Router boomerang

If the idea is already well-formed → `/spec-driven-development`.
If the idea needs only ideation → `/idea-refine`.
If the user can answer abstract questions → `/interview-me`.
If assumptions need stress-test → `/doubt-driven-development`.
