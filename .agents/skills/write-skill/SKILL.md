---
name: write-skill
description: Create or update agent skills with correct frontmatter and structure. Use when adding or changing a skill.
---

# Write Skill

## Overview

A skill is a **decision workflow** encoded as markdown — guard conditions, loops, verification. Not a note, cheat sheet, or list of tips. Writing a skill turns an implicit habit into an explicit process another agent can run. Good skills are small, opinionated, falsifiable.

Only `name` and `description` control triggering; the body runs only after the skill is triggered.

## When to Use

- Capturing a recurring decision process that keeps solving real problems
- A skill triggers too often, too rarely, or on the wrong tasks
- Pruning, splitting, or refactoring an existing skill

**When NOT to use:** one-off commands or snippets; generic checklists without guards; tutorials; workflows never tested on a real task; implementation code (→ `learning-and-apply` atoms instead).

## What a Skill Stores

| Type | In a skill? | Better home |
|---|---|---|
| Methodology, diagnostic patterns, workflow gates, trigger rules | Yes | — |
| Code technique | No | `learning-and-apply` |
| Reference data / facts | No | `docs/specs/` |
| Unverified opinion | No | nowhere |

## Triggering model

- The agent reads `description` **semantically**, not by keyword. Vague → missed activation; generic → false activation.
- The description is injected into every session — keep it short, name what it does + when + a boundary.
- Multiple skills may activate for different aspects of one task.

## The Write-Skill Loop

```
Decide → Draft → Stress-test → Cut → Verify → Register → Iterate
```

| Step | Core rule | Guard |
|---|---|---|
| 1. Decide | Skill solves a *class* of problems, tested on a real task, used ≥5× expected | All yes; else → `learning-and-apply` or stop |
| 2. Name & frame | `name` = dir name, kebab-case, grep-able. `description`: one sentence — capability + triggers + boundary; never summarizes the workflow (agent would follow the summary instead of reading) | Boundary explainable in one sentence |
| 3. Draft | Each step: Purpose → Actions → Guard → Loop-back. One decision per step. Tables over paragraphs | A real past task traces through every step |
| 4. Stress-test | Every section answers: is this a decision or a suggestion? Would it trigger on the wrong request? | Every claim falsifiable |
| 5. Cut | Target ≤300 lines, ceiling 500. Delete before adding. Refs/scripts/templates >50 lines → supporting files (menu approach) | Shorter than first draft, or decomposed |
| 6. Verify on a real task | Run it live; fix the skill, not the task | Produced a better decision than without it |
| 7. Register | Update router/`AGENTS.md` if routing changes; regen `.agents/skills/index.json`; end with Router boomerang | Discoverable via skill search/index |
| 8. Iterate | Adjust description/guards from observed behavior, not speculation | Quarterly review or on observed failure |

→ Step-by-step detail, self-evolution setup: `references/workflow.md`

## Frontmatter template

```yaml
---
name: <kebab-name>
description: <Capability>. Use when <trigger>. Not for <boundary>.
---
```

Weak: `This skill helps with documents.` — Strong: `Extract text and tables from PDFs and convert them to CSV. Use when parsing, analyzing, or batch-processing PDF documents. Not for simple PDF viewing.`

## Quality gates

| Gate | Check |
|---|---|
| Scoped | Does one thing; not a grab bag |
| Triggerable | Description names capability, triggers, boundary |
| Guarded | Every major step has a pass/fail condition |
| Looped | Failing a guard sends somewhere specific |
| Falsifiable | Anti-patterns and rationalizations named |
| Verifiable | Ends with a checklist |

→ Writing style rules, prose craft, rationalizations, red flags: `references/style-guide.md`
→ Triggering tests, functional tests, edge cases, full verification checklist: `references/testing.md`

## Decision flow for adding content

```
Does it help an agent make a decision?
├── No → Reject.
└── Yes → Tested on a real task?
    ├── No → Reject.
    └── Yes → Replaces a weaker entry? → Replace.
            → Over 500 lines? → Split into sub-file.
            → Else → Add.
```

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
