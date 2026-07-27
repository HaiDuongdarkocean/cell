# Self-Evolution Workflow

Use this when `write-skill` is asked to update itself, or when any skill is being designed to self-correct from observed usage.

All paths in this file are relative to the skill directory.

## Principle

A skill is code-as-markdown. It can read its own file, generate candidate edits, test them, and replace itself when a candidate is measurably better. The loop is autonomous: no human approval is required for routine self-corrections, but every step has an automatic guard.

## Required files

Create a `self-evolution/` folder inside the skill directory:

- `self-evolution/README.md` — human-readable explanation of the self-evolution feature; not loaded by the agent.
- `self-evolution/RUNBOOK.md` — episodic log of every use.
- `self-evolution/mutation_prompts.md` — reusable mutation operators.
- `self-evolution/test_cases.md` — held-out tasks for evaluation.
- `self-evolution/archive/` — directory of previous `SKILL.md` versions.

## Self-correction loop

```text
1. After every run, append an entry to self-evolution/RUNBOOK.md.

2. Check whether to enter self-correction mode:
   - One critical failure in the last run, OR
   - Three repeated failures/partials in the last 10 runs, OR
   - 10 new episodes since the last self-correction, OR
   - A section has not been used in the last 10 runs, OR
   - User explicitly asks for self-improvement.

3. If any condition is true:
   a. Read self-evolution/RUNBOOK.md (last 30 episodes), self-evolution/mutation_prompts.md, self-evolution/test_cases.md, and the current SKILL.md.
   b. Diagnose the most valuable fix.
   c. Generate up to 3 candidates by applying different mutation prompts.
   d. Score each candidate against self-evolution/test_cases.md and the recent failing episodes.
   e. If best_score > current_score + 0.05 (or it fixes a critical failure):
      - Copy current SKILL.md to self-evolution/archive/SKILL.<timestamp>.md.
      - Overwrite SKILL.md with the best candidate.
      - Run regression test (self-evolution/test_cases.md).
      - If regression occurs, restore from self-evolution/archive/.
   f. If no candidate is better, append "self-correction skipped" to self-evolution/RUNBOOK.md.

4. Cooldown: do not self-correct again for at least 5 episodes or 24 hours, whichever comes first.
```

## Scoring

```text
score = pass_rate × 0.50
      + failure_fix_rate × 0.30
      - (line_count / 500) × 0.10
      - (meta_text_count × 0.05)
```

- `pass_rate`: fraction of `self-evolution/test_cases.md` that pass.
- `failure_fix_rate`: fraction of RUNBOOK failures the candidate fixes.
- `line_count`: total lines of the candidate; penalize if >500.
- `meta_text_count`: number of vague meta-sentences ("This section will...", "It is important to note...").

## Mutation prompts

When applying a mutation, use the prompt literally. The agent generates the edit based on the prompt.

- **Tighten description**: Add one concrete use case and one explicit boundary to the YAML description.
- **Add guard**: For a step lacking a pass/fail condition, add a guard and a loop-back.
- **Add example**: Insert one Good/Bad example pair into the weakest section.
- **Remove dead text**: Delete a section that has not been triggered in the last 10 uses and has no test coverage.
- **Split skill**: If the candidate exceeds 500 lines, move the least-used section into a sub-file and reference it.
- **Refine trigger**: Add one item to "When NOT to use" if RUNBOOK shows false activations.
- **Clarify vocabulary**: Replace one abstract term with a concrete image or action.

## Safeguards

- **Core sections required**: Any candidate must keep `name`, `description`, `When to Use`, at least one workflow step, a `Verification` checklist, and a `Router boomerang`.
- **Archive before overwrite**: Always copy the current `SKILL.md` to `self-evolution/archive/` before replacement.
- **Line budget**: Reject candidates >500 lines; prefer splitting to a sub-file.
- **Scope**: Only modify files inside the skill directory.
- **Regression**: Run `self-evolution/test_cases.md` immediately after overwriting. If `pass_rate` drops, restore the archived version.
- **Stop conditions**:
  - Three consecutive self-corrections produce no score improvement.
  - A candidate would delete the `SKILL.md` file entirely.
  - A candidate removes all workflow steps.

## Verification for self-evolving skills

- [ ] `self-evolution/README.md`, `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, and `self-evolution/archive/` exist.
- [ ] Self-correction trigger is based on observed behavior, not speculation.
- [ ] Scoring function includes pass rate, failure fix rate, and size penalty.
- [ ] Archive + rollback path is tested before the first autonomous update.
- [ ] Cooldown and stop conditions are documented.
