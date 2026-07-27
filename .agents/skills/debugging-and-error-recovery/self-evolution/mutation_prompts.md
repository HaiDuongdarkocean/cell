# Mutation Prompts for debugging-and-error-recovery

Apply one prompt at a time to generate a candidate variation of `SKILL.md`.

1. **Add a diagnostic pattern row**: Insert one verified symptom/root-cause/falsify row into `Common Root-Cause Patterns` or `Browser Extension Traps`.
2. **Add an evidence category**: Add a bug type and its first-gather list to `Evidence by Bug Category`.
3. **Tighten the contract guard**: Strengthen the `Step 0: Contract` guard to reject vague Given/When/Then statements.
4. **Add a falsification experiment**: Add one concrete experiment to `Step 4: Falsify` that can disprove a common hypothesis.
5. **Add an anti-pattern**: Add one forbidden behavior observed in recent RUNBOOK failures to `Anti-Patterns`.
6. **Replace a weak pattern**: Delete an outdated diagnostic pattern and replace it with a stronger one from recent RUNBOOK data.
7. **Tighten the boundary**: Add or sharpen a `When NOT to use` item to prevent activation on feature requests.
8. **Split the skill**: If the candidate exceeds 500 lines, move the least-used section into a sub-file and reference it.
