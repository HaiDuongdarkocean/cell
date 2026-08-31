---
name: audit-technical-debt
description: Autonomously audit technical debt in a codebase, score and rank it, and produce a prioritized remediation roadmap with subagent verification. Use when the user asks to assess, prioritize, audit, or reduce technical debt. Not for one-off bug fixes, new features, or simple code review.
---

# Audit Technical Debt

> **Debt is invisible until you name it, score it, and rank it.**

This skill turns a vague "the code is messy" feeling into a verifiable inventory, a weighted score, and a ranked plan — without asking the user. It runs end-to-end and validates itself with a subagent.

## When to Use

- The user asks to audit, assess, or prioritize technical debt.
- A roadmap or refactor is being planned and needs a debt map.
- A specific module is considered risky and needs a structured review.
- Post-mortem, incident, or velocity drop points to hidden debt.

## When NOT to Use

- The task is to fix one bug or add one feature.
- The user wants a quick "is this function clean?" review.
- The request is about team process or project management without code.

## Core Principle

> **Audit = signal + classification + scoring + communication + verification.**

If any of those five is missing, the result is either a tooling report nobody reads, a gut feeling nobody trusts, or a plan that breaks on contact.

## Autonomous Execution

**When this skill triggers, use the `read` tool to open `pipeline.md` in this same directory. Execute every step in `pipeline.md` from top to bottom. Do not ask the user. Use the defaults and subagent prompts in `pipeline.md` for every decision point. Do not stop until the final report is written, the subagent final validation passes, and a next-step recommendation is produced.**

The detailed 8-step manual workflow previously in this file has been replaced by the `pipeline.md` runbook.

## Output Template

```markdown
## Technical Debt Audit — <scope>

### Summary
- Items found: N
- High score (≥4.0): K
- Quick wins: Q
- Big bets: B

### Inventory (top 5)
| Location | Type | Description | Velocity | Risk | Reach | Cost | Score |
|---|---|---|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... | ... | ... |

### Business impact (top 3)
1. ...
2. ...
3. ...

### Recommended roadmap
1. Quick win: ...
2. Pay-down: ...
3. Watch: ...
```

## Anti-Patterns

| Don't | Why |
|---|---|
| Treat all TODO comments as debt | Some are reminders, not risk. Classify first. |
| Score only code quality | Architectural and dependency debt often hurt more. |
| Skip the business translation | Debt only gets fixed when product sees the cost. |
| Recommend a full rewrite | Pay down gradually near areas of high change. |
| Ignore the team's fear | Tools miss the debt engineers are avoiding. |
| Ask the user during execution | Defaults in `pipeline.md` cover every decision point. |

## Common Rationalizations

| User says | Respond |
|---|---|
| "Just clean up the code" | Clean up what, where, and how does it help velocity? |
| "This module is a mess" | Which category? Code, architecture, or dependency? |
| "Fix all the TODOs" | Which TODOs affect the next 3 features? |
| "We don't have time for debt" | Which debt is already slowing this sprint? |

## Verification

- [ ] Scope is concrete or the default was applied.
- [ ] Automatic, human-inferred, and subagent signals were collected.
- [ ] Every item is classified into one of the six types.
- [ ] Every item has a weighted score.
- [ ] Top items have a business-language impact.
- [ ] Roadmap has at least one quick win or a scheduled spike.
- [ ] Report written to `docs/audits/` or repo root.
- [ ] Subagent final validation passed or all blockers were resolved.
- [ ] Output uses the template or explains why not.

## Router boomerang

Task changed or not sure which skill to use? Invoke `/using-agent-skills` to re-route. Router protocol is in `AGENTS.md` (always-on).
