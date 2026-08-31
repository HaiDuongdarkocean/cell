# Self-correction workflow

## Trigger conditions

Run the loop when any of these happen:

1. A test case in `test_cases.md` scores below the pass threshold.
2. The user reports the audit missed important debt or produced un-actionable output.
3. A new run adds an entry to `RUNBOOK.md` with a gap.
4. The skill has not been updated for 90 days and `RUNBOOK.md` has 3+ entries.

## Steps

1. Read `RUNBOOK.md` and `test_cases.md`.
2. Use `mutation_prompts.md` to generate 2-4 candidate mutations to `SKILL.md`.
3. Score each candidate against the test cases.
4. If the best candidate is ≥ 0.05 better than the current skill and fixes no critical failures, archive the current `SKILL.md` to `archive/` and replace it.
5. Run a regression test immediately. If it fails, restore the archived version.
6. Append the result to `RUNBOOK.md`.

## Cooldown

- Minimum 7 days between mutations unless a critical failure is found.
- Maximum 3 mutations per month.
