# Mutation prompts

Use these to generate candidate improvements to `SKILL.md`.

## Prompt 1 — Fix missing step
Given the issues in `RUNBOOK.md`, which step of the audit workflow is most often skipped or misapplied? Add a stronger guard or loop-back for that step. Remove a weaker section to keep the skill under 300 lines.

## Prompt 2 — Improve scoring
Given the test cases, is the scoring rubric producing the right ranking? Consider adding, removing, or reweighting a criterion. Defend the change with one concrete example from a recent run.

## Prompt 3 — Sharpen output
The output template is not being used correctly. Propose a simpler or more explicit template. Include a filled example.

## Prompt 4 — Reduce false triggers
The skill description is causing activations on wrong tasks. Rewrite the description to be more specific, without summarizing the workflow.
