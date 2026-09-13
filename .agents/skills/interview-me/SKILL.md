---
name: interview-me
description: Draw requirements out of the user via interview or prototype validation. Use when the user can't articulate what they want.
---

# Interview Me

## Overview

**What people ask for and what they actually want are different things.** "A dashboard" is conventional, not necessarily their problem. "Make it faster" has no number. The cheapest moment to find the gap is before any plan, spec, or code exists.

**Two modes:**

- **Interview mode** — user CAN answer abstract questions. One question at a time with your best guess attached, until 95% confidence.
- **Elicitation mode** — user CANNOT answer abstractly. Context + domain scoping + clarification loop + prototype with real Cell components.

Auto-select: start interview, switch to elicitation when the user can't answer or the idea touches existing Cell domain.

## When to Use / NOT to Use

**Use:** missing who/why/success/constraint; conventional request ("build me X"); unsurfaced assumptions; user can't articulate; idea touches Cell domain; prototype validation needed; "interview me"/"grill me"/"stress-test my thinking".

**NOT:** unambiguous self-contained asks; pure information requests; intent already clear → `idea-refine`; spec exists → `spec-review-stakeholder`; ≥95% confidence already.

**Loading constraint:** needs a live, responsive user — don't invoke in CI/scheduled/autonomous loops; flag as blocker instead.

## The interview pipeline

```text
0. Load context → 1. Domain scoping → 2. Hypothesize → 3. One question at a time
→ 4. Want-vs-should-want probe → 5. 8-field restate → 5.5 BACCM → 6. Explicit yes
→ (elicitation mode) 7–14. Prototype loop
```

| Step | Done when |
|---|---|
| 0. Context | `docs/context/project-context.md` + AGENTS.md read; stable fields (User, Constraint) pre-filled. Missing → ask once, save file |
| 1. Domain scoping | ≥1 grep ran in `src/`/`docs/specs/`/`docs/adr/` BEFORE any question; constraints/conflicts → Constraint field; method choice → Scope. Questions are codebase-aware, never generic |
| 2. Hypothesis | `HYPOTHESIS: ...` + `CONFIDENCE: ~N%` stated before asking; <70% lists what's unresolved |
| 3. Questions | One question + one attached guess per turn. Vague answer → rephrase specific → "Em hiểu [X]. Đúng chưa?" loop |
| 4. Want vs should | Probed when answers sound like best-practice talk / convention deferral / "I should probably…" |
| 5. Restate | 8-field frame written back (Problem, User, Current workflow, Pain, Evidence, Outcome, Constraint, Scope+out-of-scope). **Out-of-scope is non-negotiable** |
| 5.5. BACCM | All 6 concepts (Change, Need, Solution, Stakeholder, Value, Context) trace to frame fields |
| 6. Confirm | Explicit yes — "whatever you think"/"sounds good"/silence are NOT yes |
| 7–14. Prototype | (elicitation only) `idea-to-interface` concepts → real-component prototype → user drives → every feedback logged to `docs/intent/[topic].md` → frame/doc/component synced → loop or exit |

**95% stop:** done when you can predict the user's reaction to the next 3 questions AND all 8 fields meet their "enough" criteria.

## Plugins (load only when triggered)

| Plugin | Trigger | File |
|---|---|---|
| Root Cause Analysis | User states pain/solution vaguely | `plugin-root-cause.md` |
| Research Elicitation | Domain scoping found specs/atoms/competitors | `plugin-research.md` |
| Survey Questionnaire | User references absent stakeholders | `plugin-survey.md` |
| BACCM Check | After 8-field restate, before confirm | `plugin-baccm-check.md` |

→ Full step detail, clarification-loop examples, "enough" criteria per field, want-vs-should probes: `references/interview-detail.md`
→ Prototype phase (steps 7–14), feedback log format, component-sync table: `references/prototype-phase.md`

## Red flags

- 3+ questions in one message; questions without attached guesses
- Accepting "whatever you think" as terminal; vague answer without rephrase→confirm
- Generic questions when the codebase has relevant specs
- Prototype with fake HTML (real Cell components only)
- Component sync without `npm run build`; intent doc saved before confirm; plugin loaded untriggered
- Confirmed feedback not logged to the intent doc immediately

## Output

Confirmed 8-field frame + explicit yes = the deliverable (+ prototype validation in elicitation mode). Save to `docs/intent/[topic].md` only after confirm.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
