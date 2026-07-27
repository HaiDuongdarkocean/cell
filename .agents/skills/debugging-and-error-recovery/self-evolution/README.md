# Self-Evolution for `debugging-and-error-recovery`

> **Note:** This is a human-readable explanation for the `debugging-and-error-recovery` skill, not an agent skill file. It has no YAML frontmatter and is not parsed by the agent loader. The skill only reads `SKILL.md` and files explicitly referenced in `self-evolution/workflow.md`.

For the full scientific explanation of self-evolution, see `write-skill/self-evolution/README.md`.

This file explains how self-evolution applies specifically to a debugging skill.

## Why this skill self-evolves

Debugging produces clear, measurable signals:

- A root cause is identified or not.
- A falsification experiment is run or skipped.
- The fix is smaller than, equal to, or larger than the symptom description.
- A regression test fails without the fix and passes with it.
- The evidence board contains more facts than guesses before the fix.
- The same failure pattern appears in multiple runs.

Each signal can be compared against the ideal behavior encoded in the debug loop. When the skill skips a step, stops at a symptom, or adds an opinion, that becomes a learning event.

## What the skill learns from

`self-evolution/RUNBOOK.md` records every debugging task. A typical entry looks like:

```text
2026-08-10T20:00 | task=popup status bug | outcome=success | note=Contract written, evidence board had 4 facts vs 1 guess, falsification experiment run, regression test passes
```

Patterns like the following trigger self-correction:

- Fix is larger than the symptom → contract or localization was weak.
- No falsification experiment run → hypothesis was not tested.
- Evidence board has more guesses than facts → preserve step was skipped.
- Regression test missing → guard step was skipped.
- Same root-cause pattern appears three times → add it to Common Root-Cause Patterns table.

## Common mutation prompts

The skill uses `self-evolution/mutation_prompts.md` to generate candidate fixes. Examples:

- Add a row to Common Root-Cause Patterns with a verified signature.
- Add a row to Evidence by Bug Category.
- Tighten the contract guard to reject vague Given/When/Then.
- Add a falsification experiment to Step 4.
- Add an anti-pattern for a newly observed mistake.
- Replace an outdated diagnostic pattern with a stronger one.
- Split the skill if it exceeds 500 lines.

## Test cases

`self-evolution/test_cases.md` contains held-out tasks such as:

- "My test is failing." — should run Contract → Preserve → Reproduce.
- "The popup is blank." — should capture DOM, computed style, bounding rect, and console.
- "Add a new settings panel." — should **not** trigger.
- "It works on my machine." — should ask for environment and reproduction steps.

## How to read results

- `RUNBOOK.md` shows which debug steps were skipped and which patterns were learned.
- `archive/` contains older `SKILL.md` versions.
- If the skill degrades, restore the latest archived version.

## Application checklist

- [ ] `self-evolution/` folder exists with README, workflow, RUNBOOK, mutation_prompts, test_cases, and archive.
- [ ] Test cases cover test failures, UI bugs, extension bugs, flaky bugs, and false activation.
- [ ] Mutation prompts are specific to debugging failure modes (skipped falsification, missing evidence, etc.).
- [ ] Regression test is run after every self-correction.
