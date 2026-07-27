# Self-Evolution Workflow for debugging-and-error-recovery

Use this when `debugging-and-error-recovery` is asked to improve itself, or after a debugging task reveals a gap in the skill.

All paths in this file are relative to the skill directory.

## Principle

The skill learns from real debugging outcomes. It records whether the debug loop was followed, whether the fix addressed the root cause, and whether the regression test actually catches the bug. When patterns of skipped steps or missed diagnoses accumulate, the skill generates candidate edits, scores them against held-out cases, and replaces itself only when a candidate is measurably better.

## Required files

Create a `self-evolution/` folder inside the skill directory:

- `self-evolution/README.md` — human-readable explanation of the self-evolution feature; not loaded by the agent.
- `self-evolution/RUNBOOK.md` — episodic log of every debugging task.
- `self-evolution/mutation_prompts.md` — reusable mutation operators.
- `self-evolution/test_cases.md` — held-out tasks for evaluation.
- `self-evolution/archive/` — directory of previous `SKILL.md` versions.

## Self-correction loop

```text
1. After every run, append one line to self-evolution/RUNBOOK.md.

2. Check whether to enter self-correction mode:
   - The fix touched more code than the symptom description (contract or localization was weak).
   - No falsification experiment was run before Step 5.
   - The evidence board had more guesses than facts when the fix was written.
   - A regression test is missing after the fix.
   - A new root-cause pattern appeared three times in the last ten runs.
   - A section (e.g., Browser Extension Traps) was not used in the last ten runs.
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
      - (skipped_step_count × 0.05)
      - (opinion_count × 0.05)
```

- `pass_rate`: fraction of `self-evolution/test_cases.md` that pass.
- `failure_fix_rate`: fraction of RUNBOOK failures the candidate fixes.
- `line_count / 500`: penalize if >500 lines.
- `skipped_step_count`: how often the candidate would skip Contract, Preserve, Reproduce, Localize, Falsify, Verify, or Guard.
- `opinion_count`: how many unverified opinions the candidate adds.

## Skill-specific maintenance rules

`debugging-and-error-recovery` has a hard line budget of 500 lines and grows by replacing, not appending:

1. **Line budget is absolute.** Before adding anything, remove old content if the total would exceed 500.
2. **Replace, do not append.** New methodology replaces outdated methodology; new diagnostic patterns replace weaker ones.
3. **Only add verified patterns.** A pattern must have solved a real bug.
4. **Prefer tables over prose.** If a new insight cannot be a table row or checklist item, it is not ready.
5. **Prune annually.** Remove sections unused for six months.
6. **Code fixes go to `learning-and-apply`.** This skill stores only methodology and diagnostic patterns.
7. **Update `self-evolution/RUNBOOK.md`** for every verified replacement.

### Decision flow for adding knowledge

```
Does it help diagnose a class of bugs?
├── No → Reject.
└── Yes → Has it solved a real bug?
    ├── No → Reject.
    └── Yes → Can it replace an older/weaker entry?
        ├── Yes → Replace.
        └── No → Will the file exceed 500 lines?
            ├── Yes → Remove the weakest existing entry, then add.
            └── No → Add.
```

## Safeguards

- **Core sections required**: Any candidate must keep `name`, `description`, `Overview`, `When to Use`, `When NOT to use`, at least one debug step, `Testing & Validation`, `Verification Checklist`, and `Router boomerang`.
- **Archive before overwrite**: Always copy the current `SKILL.md` to `self-evolution/archive/` before replacement.
- **Line budget**: Reject candidates >500 lines; prefer splitting to a sub-file.
- **Scope**: Only modify files inside the skill directory.
- **Regression**: Run `self-evolution/test_cases.md` immediately after overwriting. If `pass_rate` drops, restore the archived version.
- **Stop conditions**:
  - Three consecutive self-corrections produce no score improvement.
  - A candidate would delete `SKILL.md` entirely.
  - A candidate removes all debug steps.

## Verification for self-evolving skills

- [ ] `self-evolution/README.md`, `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, and `self-evolution/archive/` exist.
- [ ] Self-correction trigger is based on observed debugging behavior, not speculation.
- [ ] Scoring function includes pass rate, failure fix rate, skipped-step penalty, and opinion penalty.
- [ ] Archive + rollback path is tested before the first autonomous update.
- [ ] Cooldown and stop conditions are documented.
