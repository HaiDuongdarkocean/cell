# Orchestration Patterns

Rules for the main-session orchestrator when spawning subagents. Applies to `autonomous-pipeline`, `doubt-driven-development`, `audit-technical-debt`, and any skill that dispatches `run_subagent`.

## Hard rules

1. **Subagents never spawn subagents.** Only the main-session orchestrator calls `run_subagent`. A skill running inside a subagent context must surface to the orchestrator instead of nesting.
2. **Disjoint file ownership.** No two concurrent build lanes may write the same file. If two tasks need the same file, merge them or mark one `parallel: false`.
3. **Generation ≠ review.** A lane never verifies its own output. Verification is a fresh-context subagent or a deterministic command that receives ARTIFACT + CONTRACT — not the author's reasoning.
4. **Read-only verifiers.** Verify lanes use `subagent_explore` (read-only). They report BLOCKERS or PASS; fixing is the build lane's job.
5. **Bounded lanes.** Cap concurrent lanes (default 3). Queue by priority; dispatch a held task when its dependency's verifier passes.
6. **Escalate, don't loop.** After 2 failed fix cycles on the same blocker, stop and surface the evidence to the human.

## Prompt contract for every spawned lane

- Task text + acceptance criteria (the contract it is judged against)
- ALLOWED FILES / FORBIDDEN FILES (ownership boundary)
- Relevant learning atoms (bad → good patterns from `learning-and-apply`)
- Required local check before reporting done (`npm run typecheck` minimum)
- Report format: files changed, criteria status, integration notes

## Profile selection (Devin CLI)

| Need | Profile |
|---|---|
| Implement code, run commands | `subagent_general` |
| Read-only audit / verify / explore | `subagent_explore` |
| Spec review | `spec-reviewer` / `spec-reviewer-glm` |
| Read a screenshot/image | `vision-reader` |
