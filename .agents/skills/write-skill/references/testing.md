# Write-Skill — testing & verification

## Triggering tests

- [ ] Activates on a direct request: "Write a skill for X."
- [ ] Activates on a natural request: "How should I turn this debugging workflow into a skill?"
- [ ] Stays dormant for out-of-scope requests: "Fix this typo" or "Write a README."
- [ ] Does not activate for similar but distinct skills.

## Functional tests

- [ ] The workflow runs against a real task and produces a better decision.
- [ ] The same task run twice gives consistent outputs.
- [ ] Examples in the skill match actual behavior.
- [ ] Usable by someone who did not write it.
- [ ] Self-evolution (if enabled) archives the current version and rolls back on regression.

## Edge cases

- [ ] Handles missing context gracefully.
- [ ] Handles ambiguous scope by asking, not guessing.
- [ ] Does not mutate unrelated files.

## Final verification checklist

- [ ] Frontmatter has `name` + `description`; `name` matches the directory name.
- [ ] Description is one sentence, third person, includes a boundary, does not summarize the workflow.
- [ ] "When to Use" and "When NOT to use" present.
- [ ] Workflow steps have purpose, actions, guard, loop-back; guards are pass/fail not advice.
- [ ] At least one concrete template or checklist.
- [ ] A rationalizations or anti-patterns table.
- [ ] No code implementation details — process only.
- [ ] Style follows the guide (punchlines, one-line bullets, no meta-text); reads aloud cleanly.
- [ ] ≤500 lines (ideally ≤300) or split into sub-files; no empty `scripts/`/`references/`.
- [ ] Router boomerang present.
- [ ] Ran on ≥1 real task and improved the outcome.
- [ ] If self-evolution is enabled, `self-evolution/` has README, workflow, RUNBOOK, mutation_prompts, test_cases, archive; trigger is based on observed behavior, scoring, and cooldown.
