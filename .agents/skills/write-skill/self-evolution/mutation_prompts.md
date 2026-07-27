# Mutation Prompts for write-skill

Apply one prompt at a time to generate a candidate variation of `SKILL.md`.

1. **Tighten description**: Add one concrete use case and one explicit boundary to the YAML description.
2. **Add guard**: For a step lacking a pass/fail condition, add a guard and a loop-back.
3. **Add example**: Insert one Good/Bad example pair into the weakest section.
4. **Remove dead text**: Delete a section that has not been used in the last 10 uses and has no test coverage.
5. **Split skill**: If the candidate exceeds 500 lines, move the least-used section into a sub-file and reference it.
6. **Refine trigger**: Add one item to "When NOT to use" if `RUNBOOK.md` shows false activations.
7. **Clarify vocabulary**: Replace one abstract term with a concrete image or action.
8. **Add self-evolution scaffolding**: When writing a new skill that should self-correct, create `RUNBOOK.md`, `mutation_prompts.md`, `test_cases.md`, and `archive/README.md` for that skill.
