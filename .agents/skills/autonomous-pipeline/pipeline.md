# Autonomous Pipeline — Orchestrated Run

> Run this file when `autonomous-pipeline` is triggered. Do not ask the user. Use the defaults below for every decision point. Execute every phase from top to bottom. Stop only at: (a) a hard guard failure that needs human input, (b) the final business sign-off.

## No-question defaults

- **Spec missing:** stop → route to `elicitation` first. This skill requires a confirmed spec in `docs/specs/`.
- **Plan missing or stale:** run `planning-and-task-breakdown` against the spec before dispatching.
- **Tasks missing `priority`/`parallel`/`blocked_strategy` fields:** infer them — priority from spec Success Criteria order (first criterion = P0); `parallel: true` when the task's "Files likely touched" are disjoint from same-level tasks; `blocked_strategy` defaults to `mock-contract` for interface-shaped dependencies, `wait` for shared-state dependencies.
- **Lane cap:** maximum 3 concurrent build subagents.
- **Profiles:** `subagent_general` for build lanes, `subagent_explore` (read-only) for verify lanes.
- **Verify failure:** dispatch the fix to the owning lane. After 2 failed fix cycles on the same blocker, stop and escalate to the human with evidence.

## Phase 1 — Load

**Purpose:** Gather the contract every lane will be judged against.

1. Read `docs/specs/[feature].md` — extract Success Criteria verbatim.
2. Read `tasks/plan.md` + `tasks/todo.md` for this feature.
3. Grep `.agents/skills/learning-and-apply/index.json` by the feature's domain keywords; open every matching `experience/` and `process/` atom (APPLY).
4. Build the dispatch table:

   `| Task | Priority | Parallel | Depends on | Blocked strategy | Files |`

**Guard:** every task has acceptance criteria AND a files list.
**Loop back:** missing either → `planning-and-task-breakdown` to complete the plan first.

## Phase 2 — Dispatch

**Purpose:** Execute tasks in dependency order, priority order within a level, parallel where safe.

1. Topological-sort tasks into dependency levels.
2. Within the current level, sort by Priority (P0 → P3); equal priority → smallest scope first.
3. For each task:
   - `parallel: true` + disjoint files → spawn one `subagent_general` lane (respect the lane cap; queue the rest by priority).
   - `parallel: false` or overlapping files → implement in the main session, priority order.
   - Blocked by an unfinished dependency:
     - `mock-contract` → dispatch with the agreed interface/mock; mark the integration point for the dependency's lane to close.
     - `wait` → hold; dispatch when the dependency's verifier passes, then resume by priority.
4. Every build-lane prompt carries: task text, acceptance criteria, ALLOWED FILES, FORBIDDEN FILES (everything else, especially files owned by other lanes), the relevant APPLY atoms, and the required local check (`npm run typecheck` minimum).

**Guard:** no two active lanes may write the same file. Overlap → merge the tasks or mark one `parallel: false`.
**Loop back:** a lane reports it cannot meet acceptance criteria → re-plan that task before re-dispatching.

## Phase 3 — Verify

**Purpose:** Judge each lane's output — deterministic checks plus fresh-context review. Generation ≠ review: a lane never verifies its own work.

After each lane reports done:

1. Deterministic, in the main session: `npm run typecheck && npm run test:unit && npm run build`.
2. Fresh-context: spawn a `subagent_explore` verifier — it reads the spec's acceptance criteria plus the changed files and returns BLOCKERS or PASS. Read-only on purpose: it judges, it does not fix.
3. Browser-facing change → `testing-with-playwright` e2e spec.

**Guard:** verifier returns PASS (or all blockers fixed within 2 cycles) before the task counts as done.
**Loop back:** blockers → owning lane fixes; 2 failed cycles → escalate to the human with the verifier output.

## Phase 4 — Ship

1. `code-review-and-quality` → `code-simplification` on the merged diff.
2. `git-workflow-and-versioning` — atomic commits, clean history.
3. `shipping-and-launch` checklist → `npm run ship:dist` when the human says ship.
4. **Post-Launch Business Review** — the one blocking gate: human confirms the right thing was built vs spec Success Criteria.
5. `learning-and-apply` ACCUMULATE — code lessons → `experience/` atoms; pipeline lessons (drift, skipped gates, bad routing) → `process/` atoms.

## Subagent prompt templates

### Build lane

```
You own Task <N> of <feature>. Implement ONLY the files listed below; other lanes own other files.

TASK: <description>
ACCEPTANCE: <criteria verbatim from the task>
ALLOWED FILES: <list>
FORBIDDEN: everything else — especially <overlapping files owned by other lanes>
MOCK: <if blocked_strategy=mock-contract: implement against this interface: <contract>>
KNOWN PATTERNS: <relevant learning atoms: bad → good>
Before reporting done: run `npm run typecheck`.
Report: files changed, acceptance criteria status, integration notes.
```

### Verify lane

```
You are a fresh-context verifier. Read the acceptance criteria in `docs/specs/<feature>.md` and inspect the changed files listed. Judge whether the implementation satisfies each criterion. Look for: missing criteria, contract violations, broken conventions, unhandled edge cases. Return only BLOCKERS or the word PASS. Do not edit files.

CHANGED FILES: <list>
```

## Guards & loop-backs summary

| Guard | On fail |
|---|---|
| Every task has criteria + files list | Back to `planning-and-task-breakdown` |
| No file owned by two lanes | Re-partition before dispatch |
| Verifier PASS or blockers fixed in ≤ 2 cycles | Escalate to human with evidence |
| Business sign-off | Hold ship until human confirms |

## Tools by phase

| Phase | Primary tools |
|---|---|
| 1 — Load | `read`, `grep` |
| 2 — Dispatch | `run_subagent`, `edit`, `write` |
| 3 — Verify | `exec`, `run_subagent` |
| 4 — Ship | `exec`, `run_subagent`, `write` |
