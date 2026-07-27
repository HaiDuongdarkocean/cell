# Self-Evolution Workflow for browser-testing-with-devtools

Use this when `browser-testing-with-devtools` is asked to improve itself, or after a browser-testing task reveals a gap in the skill.

All paths in this file are relative to the skill directory.

## Principle

The skill learns from real browser sessions. Every time it runs, it records what was tested, what the outcome was, and whether a better decision would have changed the fix. When patterns of failure or missed opportunity accumulate, the skill generates candidate edits, scores them against held-out cases, and replaces itself only when a candidate is measurably better.

## Required files

Create a `self-evolution/` folder inside the skill directory:

- `self-evolution/README.md` — human-readable explanation of the self-evolution feature; not loaded by the agent.
- `self-evolution/RUNBOOK.md` — episodic log of every browser-testing task.
- `self-evolution/mutation_prompts.md` — reusable mutation operators.
- `self-evolution/test_cases.md` — held-out tasks for evaluation.
- `self-evolution/archive/` — directory of previous `SKILL.md` versions.

## Self-correction loop

```text
1. After every run, append one line to self-evolution/RUNBOOK.md.

2. Check whether to enter self-correction mode:
   - A browser bug was missed because the skill skipped a step (console, network, screenshot, performance, a11y).
   - The skill triggered on a backend-only or non-browser request.
   - A screenshot or trace was taken but not compared or interpreted.
   - Three similar tasks in the last 10 runs ended with "would have caught it if...".
   - 10 new episodes since the last self-correction.
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
score = pass_rate × 0.45
      + failure_fix_rate × 0.35
      - (line_count / 500) × 0.10
      - (false_activation_count × 0.05)
      - (missed_step_count × 0.05)
```

- `pass_rate`: fraction of `self-evolution/test_cases.md` that pass.
- `failure_fix_rate`: fraction of RUNBOOK failures the candidate fixes.
- `line_count / 500`: penalize if >500 lines.
- `false_activation_count`: how often the candidate would trigger on non-browser tasks.
- `missed_step_count`: how often the candidate skips a required DevTools step (console, network, screenshot, performance, a11y).

## Safeguards

- **Core sections required**: Any candidate must keep `name`, `description`, `When to Use`, `When NOT to use`, at least one workflow, `Testing & Validation`, `Verification`, and `Router boomerang`.
- **Archive before overwrite**: Always copy the current `SKILL.md` to `self-evolution/archive/` before replacement.
- **Line budget**: Reject candidates >500 lines; prefer splitting to a sub-file.
- **Scope**: Only modify files inside the skill directory.
- **Regression**: Run `self-evolution/test_cases.md` immediately after overwriting. If `pass_rate` drops, restore the archived version.
- **Stop conditions**:
  - Three consecutive self-corrections produce no score improvement.
  - A candidate would delete `SKILL.md` entirely.
  - A candidate removes all workflow steps.

## Verification for self-evolving skills

- [ ] `self-evolution/README.md`, `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, and `self-evolution/archive/` exist.
- [ ] Self-correction trigger is based on observed browser behavior, not speculation.
- [ ] Scoring function includes pass rate, failure fix rate, false activation, and missed-step penalties.
- [ ] Archive + rollback path is tested before the first autonomous update.
- [ ] Cooldown and stop conditions are documented.
