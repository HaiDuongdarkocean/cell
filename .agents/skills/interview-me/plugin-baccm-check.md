# Plugin: BACCM Check

> Load after Step 5 (8-field restate) before Step 6 (confirm). Verify every BACCM concept has a field. Don't confirm with gaps.

## When to Load

- After 8-field frame is filled (Step 5)
- Before user confirms (Step 6)
- Always — BACCM applies to every elicitation, not optional

## The 6 Concepts

**BACCM = Business Analysis Core Concept Model.** 6 concepts, all equal and necessary. Each defined by the other 5. Missing any concept means the frame has a blind spot.

| Concept | Question | Frame fields that trace |
|---|---|---|
| **Change** | What is transforming? | Problem → Scope (transformation from current to future) |
| **Need** | What problem/opportunity is addressed? | Problem + Pain point |
| **Solution** | What specific way satisfies the need? | Scope |
| **Stakeholder** | Who has relationship to change/need/solution? | User (+ survey plugin if multi-stakeholder) |
| **Value** | What is the worth to stakeholder in context? | Desired outcome (rephrased as worth, not just measurable) |
| **Context** | What circumstances influence the change? | Constraint + `docs/context/project-context.md` |

## Check Process

**For each concept, verify a field traces to it. If not, ask one question to fill the gap.**

### Change

**What is transforming?** The frame must show transformation from current state to future state.

- Current state → Current workflow field
- Future state → Scope field
- Transformation = the delta between them

**Guard:** Frame states both current and future. If only future (Scope) without current (workflow), Change is undefined.

**Gap fix:** "Anh đang làm [current workflow]. Sau khi build xong, anh sẽ làm gì khác?" → fill the delta.

### Need

**What problem/opportunity is addressed?** Need ≠ solution. Need is the problem; Scope is the solution.

- Problem field = need statement
- Pain point = manifestation of need (root cause found via `plugin-root-cause.md`)

**Guard:** Problem is a need, not a solution. If Problem field says "I want OCR", that's a solution — re-elicit root need.

**Gap fix:** Run `plugin-root-cause.md` if not already run.

### Solution

**What specific way satisfies the need?** Scope field must name the specific approach, not just "MVP".

- Scope = MVP + out-of-scope + chosen method (from Step 1 dependency mapping)

**Guard:** Scope names a specific method, not just "build feature X". If only "build OCR", missing method — return to Step 1.

**Gap fix:** "Em suggest 3 phương án trong Step 1. Anh chọn phương án nào?" → fill chosen method.

### Stakeholder

**Who has relationship to change/need/solution?** User field is 1 persona. BACCM Stakeholder = group/individual with relationship (interest, impact, influence).

- User field = primary persona
- Other stakeholders? → `plugin-survey.md` if multi-stakeholder

**Guard:** At least 1 primary stakeholder named. If user referenced "team", "khách hàng", "người X" → survey plugin should have run.

**Gap fix:** "Ai khác ngoài anh quan tâm đến feature này?" → if new stakeholder, load `plugin-survey.md`.

### Value

**What is the worth to stakeholder in context?** Desired outcome is measurable, but Value is worth — why it matters.

- Desired outcome = measurable (e.g., "3 steps instead of 5")
- Value = worth in context (e.g., "save 10 min/drama → watch 2 more/week")

**Guard:** Desired outcome answers "what changes?" AND "why does that matter to the stakeholder?". If only measurable without worth, Value is incomplete.

**Gap fix:** "Anh đạt [outcome]. Điều đó đáng giá với anh thế nào?" → rephrase Desired outcome to include worth.

### Context

**What circumstances influence the change?** Constraint field + `docs/context/project-context.md`.

- Constraint = binding limits (RAM, browser, device)
- Context = broader circumstances (project stage, team capacity, market timing)

**Guard:** Constraint field filled from project-context.md + Step 1 domain conflicts. If Constraint only has generic limits (RAM ≥1GB) without domain-specific conflicts, Context is shallow.

**Gap fix:** "Ngoài RAM/browser, còn yếu tố nào ảnh hưởng feature này? (team capacity, timeline, market)" → fill Context-specific constraints.

## Output

**8-field frame validated against all 6 BACCM concepts.** Any gap filled before Step 6 confirm.

If gaps filled → update frame → proceed to Step 6.
If gaps remain → ask user → fill → re-check.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Skip BACCM check, go straight to confirm | Blind spot — 1+ concept undefined |
| Accept "I want X" as Need | That's Solution, not Need — run root cause |
| Desired outcome without worth | Measurable but not valuable — rephrase |
| User field = 1 persona, ignore other stakeholders | BACCM Stakeholder = group with relationships |
| Constraint = only generic RAM/browser | Context = broader circumstances influencing change |
| Run BACCM check before 8-field filled | Nothing to check — load after Step 5 |

## Verification

- [ ] All 6 concepts have at least 1 field tracing to them
- [ ] Change: current state + future state both present
- [ ] Need: Problem is need, not solution (Pain point is manifestation of need)
- [ ] Solution: Scope names specific method, not just "build X"
- [ ] Stakeholder: primary + others identified (survey plugin if multi)
- [ ] Value: Desired outcome includes worth, not just measurable
- [ ] Context: Constraint has domain-specific conflicts, not just generic
- [ ] Any gap filled before Step 6 confirm
