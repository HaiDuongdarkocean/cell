# Self-Correction Workflow

## Trigger

Run when one of these is true:

- `RUNBOOK.md` has ≥5 entries.
- A test case in `test_cases.md` fails.
- The user explicitly asks for self-correction.

## Steps

1. Read `RUNBOOK.md`, `test_cases.md`, `mutation_prompts.md`.
2. Identify the most common failure pattern.
3. Pick the top 1–2 mutation prompts that address it.
4. Generate a candidate `SKILL.md`/`AUDIT.md` change.
5. Score the candidate against `test_cases.md`.
6. If score is ≥ current + 0.05 or fixes a critical failure:
   - Archive current version to `archive/`
   - Apply the change
   - Re-run the failed test case
7. If regression occurs, restore from `archive/`.

## Archive

Before any overwrite, copy current `SKILL.md` and `AUDIT.md` to `archive/YYYY-MM-DD/`.
