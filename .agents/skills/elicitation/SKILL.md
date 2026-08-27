---
name: elicitation
description: Orchestrate the full elicitation-to-final-spec pipeline — transform a vague idea or pain into a reviewed, finalized spec by routing through idea-refine, interview, observation, doubt-driven validation, spec-driven development, and stakeholder review with an auto-fix loop.
---

# Elicitation

## Overview

Elicitation is the bridge between a vague idea and a buildable spec. It is not one technique — it is an **orchestrated pipeline** of specialized skills that surface what the user actually wants, validate assumptions, write a first spec, review it, fix it, and deliver a final spec for human approval.

The human only needs to say **"yes"** at the confirmed 8-field frame. After that, the agent runs the spec/review/fix loop autonomously and presents the final spec.

## When to Use

- User has an idea but no spec: "I want a clipboard page"
- User describes a pain: "I'm tired of re-copying things"
- Request is conventional, not specific: "make it faster", "build me X"
- Need to validate assumptions and produce `docs/specs/*.md`
- Handoff from `idea-refine` to a finalized spec

## When NOT to Use

- Spec already exists and is stable → implement directly or `/spec-review-stakeholder`
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
│ 5. output           │ Confirmed 8-field frame + user "yes"
└─────────────────────┘
    │
    ▼ (auto)
┌─────────────────────┐
│ 6. spec-driven-dev  │ Write `docs/specs/[topic].md` (Autonomous Mode)
└─────────────────────┘
    │
    ▼ (auto)
┌─────────────────────┐
│ 7. spec-review      │ BA / PO / TL review
└─────────────────────┘
    │
    ▼ (auto, if needed)
┌─────────────────────┐
│ 8. auto-fix loop    │ Edit spec based on findings, re-review (max 3 rounds)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 9. final output     │ Final spec + review summary for human approval
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
| 3 | **Intent log** | `docs/intent/[topic].md` with all rounds of confirmed feedback |
| 4 | **Final spec** | `docs/specs/[topic].md` after auto-review and fixes |
| 5 | **Review summary** | BA/PO/TL verdict + residual risks + accepted trade-offs |

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

**Criteria to proceed to auto-spec:**
- All 8 fields meet "enough" criteria
- Explicit user "yes"
- Agent can predict user reaction to the next 3 questions
- Assumptions logged with validation strategy

**If not ready:**
- Return to Step 3 (`interview-me`) for more validation
- Or return to Step 1 (`idea-refine`) if direction is unclear

**Deliverable to Step 6:**
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
**Log:** docs/intent/[topic].md
```

## Step 6: Auto-Spec (spec-driven-development Autonomous Mode)

**Purpose:** Turn the confirmed intent into a first draft spec without asking the user anything.

**Actions:**
- Invoke `/spec-driven-development` in **Autonomous Mode** using `docs/intent/[topic].md` as the primary input
- Pass the confirmed 8-field frame as the SSOT requirements; do not ask clarifying questions
- Load domain context: `docs/2-architechture-system.md`, `docs/specs/`, `docs/adr/`
- Write `docs/specs/[topic].md` covering: Objective, Tech Stack, Commands, Project Structure, Code Style, Testing Strategy, Boundaries, Success Criteria, Open Questions
- Any Open Questions must be resolved from the 8-field frame or documented as accepted risk; do not surface new questions to the user during this step

**Scope guard:**
- Do not introduce scope beyond the confirmed 8-field frame.
- If a technical detail is genuinely missing, make a reasonable assumption, document it in the spec, and flag it as an accepted risk.

## Step 7: Auto-Review (spec-review-stakeholder)

**Purpose:** Sanity-check the spec from BA, PO, and TL lenses.

**Actions:**
- Invoke `/spec-review-stakeholder` on `docs/specs/[topic].md`
- Capture verdict: `APPROVE` / `APPROVE WITH CHANGES` / `REJECT`
- Capture ranked findings: Blocker / Major / Minor
- Capture action items with fix guidance

## Step 8: Auto-Fix Loop

**Purpose:** Apply review findings to the spec until it converges.

**Actions:**
1. If verdict is `APPROVE` and only Minor findings remain, go to Step 9.
2. If verdict is `APPROVE WITH CHANGES`:
   - Edit `docs/specs/[topic].md` directly to address every Blocker and Major finding.
   - Keep accepted risks documented in the spec.
   - Re-run `/spec-review-stakeholder` on the updated spec.
3. If verdict is `REJECT`:
   - If this is the first or second round, attempt a full rewrite of `docs/specs/[topic].md` based on the review report, then re-run `/spec-review-stakeholder`.
   - If after 3 rounds the verdict is still `REJECT` or has unresolved Blockers, stop and present the latest spec + review report to the human for a decision.
4. Repeat up to **3 rounds total**. If after 3 rounds the spec still has unresolved Blockers or unresolved Major findings, stop and present to the human.

**Guardrails:**
- Do not invent new scope not in the confirmed 8-field frame.
- If a finding requires a human decision (e.g., new trade-off, budget, external dependency), pause and ask.
- Preserve `docs/specs/[topic].md` version history by appending an "Elicitation revision log" section, not by creating side files.

## Step 9: Final Output

**Purpose:** Present the finalized spec to the human for approval.

**Actions:**
- Present `docs/specs/[topic].md`
- Present the final review summary (verdict, residual risks, accepted trade-offs)
- Ask the human one final approval question:
  ```
  Bản spec [topic] đã sẵn sàng. Anh yêu APPROVE để chuyển sang implement,
  hay muốn chỉnh sửa thêm?
  ```

**Deliverable:**
```markdown
## Elicitation Final — [topic]

- **Intent:** docs/intent/[topic].md
- **Final spec:** docs/specs/[topic].md
- **Review verdict:** APPROVE / APPROVE WITH CHANGES / REJECT (after max 3 rounds)
- **Residual risks:** [if any]
- **Next step:** `/plan` or `/build` (or `/interview-me` if human wants to re-validate)
```

## Verification Checklist

- [ ] `docs/context/project-context.md` loaded
- [ ] Domain scoping ran — no duplicate specs
- [ ] `idea-refine` completed if direction was unclear
- [ ] Observation workflow story documented
- [ ] 8-field frame confirmed with explicit yes
- [ ] `doubt-driven-development` stress-test ran
- [ ] `docs/intent/[topic].md` updated with all feedback rounds
- [ ] `docs/specs/[topic].md` drafted by `/spec-driven-development` Autonomous Mode
- [ ] `/spec-review-stakeholder` ran at least once
- [ ] Auto-fix loop completed (≤ 3 rounds)
- [ ] Final spec presented to human for approval

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Start with spec before elicitation | Run `/elicitation` first |
| Accept vague answers | Rephrase → confirm loop |
| Skip observation | Always ask for real workflow |
| Skip doubt-driven | Always stress-test core assumption |
| Save intent doc before user confirms | Confirm first, save after |
| Stop after first draft spec | Run auto-review + auto-fix |
| Add scope during auto-fix | Stick to confirmed 8-field frame; ask if new trade-off appears |
| Ask user during auto-spec | Use the confirmed 8-field frame as SSOT |

## Router boomerang

If the idea is already well-formed and a spec exists → implement or `/spec-review-stakeholder`.
If the idea needs only ideation → `/idea-refine`.
If the user can answer abstract questions → `/interview-me`.
If assumptions need stress-test → `/doubt-driven-development`.
If the spec is written and needs review → `/spec-review-stakeholder`.
If the task is to implement an approved spec → `/plan` or `/build`.
