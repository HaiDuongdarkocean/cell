# write-skill RUNBOOK

This file is an append-only log of how `write-skill` is used and what it learns.
Each entry should be one line and follow this format:

```text
<timestamp> | task=<brief> | outcome=success|partial|fail | note=<one-line observation>
```

## Template

```text
YYYY-MM-DDTHH:MM | task=<name-of-skill-request> | outcome=success | note=<what worked>
```

## Log

2026-08-10T19:15 | task=restructure self-evolution files | outcome=success | note=Moved all improve files into self-evolution/ folder: README.md, workflow.md, RUNBOOK.md, mutation_prompts.md, test_cases.md, archive/; updated SKILL.md and README.md references; added self-evolution question to workflow

2026-08-10T19:00 | task=enable self-evolution for browser-testing-with-devtools | outcome=success | note=Created self_evolution.md, mutation_prompts.md, test_cases.md, archive/README.md; added Self-Evolution section to SKILL.md; description now mentions self-corrects from usage

2026-08-10T18:45 | task=update browser-testing-with-devtools | outcome=success | note=Tightened description to one sentence; added bold punchline; added Guard/Loop-back to workflows; added Testing & Validation and Router boomerang; line count 362

2026-08-10T18:30 | task=self-correct write-skill | outcome=success | note=Added README.md to Skill Anatomy; clarified RUNBOOK target and added explicit trigger check in Self-Evolution; archived old version; line count 475
2026-08-10T18:15 | task=write usage guide | outcome=success | note=Created README.md with principles, mechanism, and process

2026-08-10T17:45 | task=add self-evolution support | outcome=success | note=Added self_evolution.md, RUNBOOK.md, mutation_prompts.md, test_cases.md, archive/
