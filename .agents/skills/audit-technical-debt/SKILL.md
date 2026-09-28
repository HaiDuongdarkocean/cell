---
name: audit-technical-debt
description: Audit technical debt, score and rank it, produce a prioritized remediation roadmap. Use when assessing or reducing debt.
---

# Audit Technical Debt

> **Debt is invisible until you name it, score it, and rank it.**

Turns a vague "the code is messy" feeling into a verifiable inventory, a weighted score, and a ranked plan — without asking the user. Runs end-to-end and validates itself with a subagent.

## When to Use

- Audit, assess, or prioritize technical debt; plan a roadmap/refactor needing a debt map
- A module feels risky and needs structured review; incident/velocity drop points to hidden debt

**When NOT to use:** fixing one bug or feature; a quick "is this function clean?" review.

## Autonomous Execution

**When this skill triggers, `read` `pipeline.md` in this directory and execute it top to bottom. Do not ask the user — defaults and subagent prompts in `pipeline.md` cover every decision point. Do not stop until the report is written, the final subagent validation passes, and a next-step recommendation exists.**

## Output Template

```markdown
## Technical Debt Audit — <scope>

### Summary
- Items found: N | High score (≥4.0): K | Quick wins: Q | Big bets: B

### Inventory (top 5)
| Location | Type | Description | Velocity | Risk | Reach | Cost | Score |

### Business impact (top 3)

### Recommended roadmap
1. Quick win: ...  2. Pay-down: ...  3. Watch: ...
```

## Anti-Patterns

| Don't | Why |
|---|---|
| Treat all TODO comments as debt | Some are reminders, not risk. Classify first. |
| Score only code quality | Architectural and dependency debt often hurt more. |
| Skip the business translation | Debt only gets fixed when product sees the cost. |
| Recommend a full rewrite | Pay down gradually near areas of high change. |
| Ask the user during execution | Defaults in `pipeline.md` cover every decision point. |

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
