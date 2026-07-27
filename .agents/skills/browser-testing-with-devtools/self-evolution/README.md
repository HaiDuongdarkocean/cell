# Self-Evolution for `browser-testing-with-devtools`

> **Note:** This is a human-readable explanation for the `browser-testing-with-devtools` skill, not an agent skill file. It has no YAML frontmatter and is not parsed by the agent loader. The skill only reads `SKILL.md` and files explicitly referenced in `self-evolution/workflow.md`.

For the full scientific explanation of self-evolution, see `write-skill/self-evolution/README.md`.

This file explains how self-evolution applies specifically to browser testing.

## Why this skill self-evolves

Browser testing produces clear, measurable signals:
- Console errors and warnings.
- Network request status, payload, and response.
- Screenshots before and after changes.
- Performance traces with LCP, CLS, INP, and long tasks.
- Accessibility tree structure and labels.

Each of these signals can be compared against an expected state. When the skill misses a signal, makes a wrong diagnosis, or triggers on the wrong task, that becomes a learning event.

## What the skill learns from

`self-evolution/RUNBOOK.md` records every browser-testing task. A typical entry looks like:

```text
2026-08-10T19:00 | task=debug layout bug | outcome=partial | note=Screenshot was taken but computed styles were not checked, root cause missed
```

Patterns like the one above trigger self-correction.

## Common mutation prompts

The skill uses `self-evolution/mutation_prompts.md` to generate candidate fixes. Examples:
- Add a console check before DOM interpretation.
- Require a before/after screenshot for any visual claim.
- Add a network payload verification step.
- Add a performance baseline/measure loop.
- Tighten the `When NOT to use` boundary to avoid backend-only tasks.
- Add an accessibility tree check for interactive changes.

## Test cases

`self-evolution/test_cases.md` contains held-out tasks such as:
- "The button is not visible on the page." — should use screenshot, DOM, and computed styles.
- "This page has a console error." — should capture console before fixing.
- "Fix this API endpoint in Node.js." — should **not** trigger.
- "The page loads slowly." — should record and compare performance traces.

## How to read results

- `RUNBOOK.md` shows what the skill has learned.
- `archive/` contains older `SKILL.md` versions.
- If the skill degrades, restore the latest archived version.

## Application checklist

- [ ] `self-evolution/` folder exists with README, workflow, RUNBOOK, mutation_prompts, test_cases, and archive.
- [ ] Test cases cover UI, console, network, performance, accessibility, and false activation.
- [ ] Mutation prompts are specific to browser-testing failure modes.
- [ ] Regression test is run after every self-correction.
