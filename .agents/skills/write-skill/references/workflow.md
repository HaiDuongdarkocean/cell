# Write-Skill — step detail & self-evolution

Reference for `write-skill`. The SKILL.md loop table is the contract; this file holds only what it omits.

## Loop-backs worth keeping

- Decide: code technique → `learning-and-apply` atom; one-time fix → stop.
- Draft: cannot trace a real task through the steps → gather one first; you are writing fiction otherwise.
- Verify: the skill didn't change the outcome → delete it or demote it to a note.
- Iterate: triggers too often → narrow description; misses triggers → add specific triggers; outputs vary → tighten guards.

## Structure rules

- Menu approach for multi-process skills: `SKILL.md` is the index; sibling files hold sub-workflows; the agent reads only what the task needs.
- Move reference material >100 lines, tool scripts, or long checklists into supporting files. Keep references one level deep; no empty `scripts/`/`references/`.
- Prefer scripts over inline code — a script's output costs context, its source doesn't.
- Runnable helpers in `scripts/` follow repo conventions (`set -e`, status to stderr, JSON to stdout, cleanup trap).
- Regen the index after changes: `node scripts/update-skill-index.mjs`.

## Self-evolution (optional)

Ask first: should this skill self-evolve from usage? Skip for rarely-run or judgment-heavy skills. If yes:

- After every run, append one line to the target skill's `self-evolution/RUNBOOK.md`.
- Read `self-evolution/workflow.md` trigger conditions; if met (or the user explicitly asks), run the self-correction loop.
- Enabling creates: `self-evolution/{README.md,workflow.md,RUNBOOK.md,mutation_prompts.md,test_cases.md,archive/README.md}`.
- Mutations come only from `mutation_prompts.md`; score against `test_cases.md` + recent RUNBOOK entries. Replace `SKILL.md` only if the best candidate scores ≥0.05 higher or fixes a critical failure.
- Archive the current version before overwriting; run regression tests immediately after.

Guard: self-correction is bounded by archive + regression tests + cooldown; a regressing candidate restores the archived version.
