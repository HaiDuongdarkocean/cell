# Orchestration Patterns

Rules for the main-session orchestrator when spawning subagents. Applies to `autonomous-pipeline`, `doubt-driven-development`, `audit-technical-debt`, and any skill that dispatches `run_subagent`.

## Hard rules

1. **Subagents never spawn subagents.** Only the main-session orchestrator calls `run_subagent`. A skill running inside a subagent context must surface to the orchestrator instead of nesting.
2. **Disjoint file ownership.** No two concurrent build lanes may write the same file. If two tasks need the same file, merge them or mark one `parallel: false`.
3. **Generation ≠ review.** A lane never verifies its own output. Verification is a fresh-context subagent or a deterministic command that receives ARTIFACT + CONTRACT — not the author's reasoning.
4. **Read-only verifiers.** Verify lanes use `subagent_explore` (read-only). They report BLOCKERS or PASS; fixing is the build lane's job.
5. **Bounded lanes.** Cap concurrent lanes (default 3). Queue by priority; dispatch a held task when its dependency's verifier passes.
6. **Escalate, don't loop.** After 2 failed fix cycles on the same blocker, stop and surface the evidence to the human.
7. **Worktree isolation for parallel lanes.** Disjoint files prevent *logical* collisions; worktrees prevent *physical* ones — two lanes running `npm run build`, `git add`, or jest in the same directory collide regardless of which files they own. Each parallel lane of scope M+ gets its own worktree and branch; merges happen explicitly, in dependency order, with gates re-run after each merge.
8. **Re-dispatch must be idempotent.** A lane may be re-run after crash, timeout, or verify failure. Re-running a lane whose work already passed verify must be a no-op — the lane checks its own task-id/branch state before doing work, and never duplicates artifacts, branches, or commits. If a lane cannot be made idempotent, mark it `parallel: false` — non-idempotent work in a re-runnable system corrupts state silently.
9. **Crash recovery via lane state, not memory.** The orchestrator does not rely on a dead lane's report to know where it stopped. Before dispatch, record per-lane state in the plan (`status: dispatched | verified | failed`), and a crashed lane is resumed by inspecting its branch diff against the contract — never by asking "what were you doing?" If the branch state is ambiguous, restart the lane from scratch; a clean re-run beats a guessed resume.
10. **Fan-in tolerates missing lanes.** A failed lane returns null, not a blocked graph. Integrate proceeds with verified lanes; only tasks that truly depend on the failed lane's output are held. One dead lane must never stall its independent siblings — that is chain behavior smuggled back into a graph.

Domain rules live in their owning skills, not here: the edge test (dependency = data crosses) is in `planning-and-task-breakdown`, diverse-lens review is in `doubt-driven-development`, and loop-until-dry dedupe is in `audit-technical-debt`. This file holds only spawn/lifecycle etiquette that every subagent-dispatching skill shares.

## Worktree rules

- **Provision only when needed:** ≥ 2 `parallel: true` tasks at the same dependency level, scope ≥ M. XS/S lanes and all `parallel: false` work runs in the main session.
- **Location:** outside the repo (`../Tihoka-worktrees/<feature>/lane-<N>`) so lint/test/git tooling never scans it.
- **Dependencies:** junction `node_modules` — never `npm install` per lane. Tasks touching `package.json`, lockfiles, or `manifest.json` are `parallel: false` by definition (shared state cannot be mocked).
- **Merge order:** dependency order, one lane at a time, full gates after each merge. Conflicts are resolved by the dependent task's lane — it holds the contract context.
- **Cleanup is unconditional:** `git worktree remove` in a finally path. A leftover worktree corrupts the next run.
- **Honest limit:** worktrees do not eliminate conflicts — they convert silent runtime overwrites into explicit merge-time conflicts. That is strictly better: conflicts surface, resolve, and never lose code silently.

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
| Spec review | `spec-reviewer` |
| Read a screenshot/image | `vision-reader` |
