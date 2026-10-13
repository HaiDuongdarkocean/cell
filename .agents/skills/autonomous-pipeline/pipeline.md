# Autonomous Pipeline — Orchestrated Run

> Run this file when `autonomous-pipeline` is triggered. Do not ask the user. Use the defaults below for every decision point. Execute every phase from top to bottom. Stop only at: (a) a hard guard failure that needs human input, (b) the final business sign-off.

## No-question defaults

- **Spec missing or unreviewed:** stop → route back to `pipeline-specify` (or `pipeline-analyze` if no intent). This engine requires a reviewed spec in `docs/specs/` plus `docs/reviews/<slug>-spec.md` verdict `APPROVE*`.
- **Plan missing or stale:** run `planning-and-task-breakdown` against the spec before dispatching.
- **Tasks missing `priority`/`parallel`/`blocked_strategy` fields:** infer them — priority from spec Success Criteria order (first criterion = P0); `parallel: true` when the task's "Files likely touched" are disjoint from same-level tasks; `blocked_strategy` defaults to `mock-contract` for interface-shaped dependencies, `wait` for shared-state dependencies.
- **Lane cap:** maximum 3 concurrent build subagents.
- **Canonical fan-out:** a spec with explicit acceptance criteria defaults to logic / UI-on-mock / contract-level-tests lanes (pattern owned by `planning-and-task-breakdown`). The test lane's tests, written blind to the implementation, become the fresh-context verify signal at integrate time.
- **Profiles:** `subagent_general` for build lanes, `subagent_explore` (read-only) for verify lanes.
- **Verify failure:** dispatch the fix to the owning lane. After 2 failed fix cycles on the same blocker, stop and escalate to the human with evidence.
- **Diverse-lens verify:** `P0` tasks and lanes touching security/state/migrations get 2–3 verifier lenses; pass on majority (pattern owned by `doubt-driven-development`). Single-lens verify for the rest.
- **Worktree threshold:** provision a worktree per parallel lane of scope M or larger. XS/S parallel lanes run sequentially in the main session — they are already disjoint on files and the setup cost exceeds the benefit.
- **Worktree location:** `../Tihoka-worktrees/<feature-slug>/lane-<task-N>` — outside the repo so eslint/jest/`git status` never scan it.
- **Lane dependencies:** junction `node_modules` into the worktree (Windows: `mklink /J`). Lanes must not run `npm install` — any task touching `package.json`, lockfiles, or `manifest.json` is `parallel: false` by rule (shared state cannot be mocked).
- **Pipeline state:** lanes never run `pipeline-state.mjs` — the CLI refuses writes outside the main worktree. Stage transitions happen in the main session only, after merge.
- **Ownership:** the orchestrator's `Tihoka_AGENT_ID` owns the item (claimed at `init`/`activate`); lane shells inherit the env, so hook-recorded gates still count as the same owner. Write `.Tihoka-owner` (`{"agent","slug"}`) at each provisioned worktree root — agents outside this orchestration must not write into it at all. An item owned by another `Tihoka_AGENT_ID` refuses all mutations; redirect goes through `request-handoff`, never a direct `transition`.

## Phase 1 — Load

**Purpose:** Gather the contract every lane will be judged against.

1. Read `docs/specs/[feature].md` — extract Success Criteria verbatim.
2. Read `tasks/plan-<slug>.md` + `tasks/todo-<slug>.md` for this feature.
3. Grep `.agents/skills/learning-and-apply/index.json` by the feature's domain keywords; open every matching `experience/` and `process/` atom (APPLY).
4. Build the dispatch table:

   `| Task | Priority | Parallel | Depends on | Blocked strategy | Files | Status |`

   `Status` tracks `dispatched | verified | failed` per lane — the orchestrator's recovery record when a lane crashes (rule 9, `references/orchestration-patterns.md`).

**Guard:** every task has acceptance criteria AND a files list.
**Loop back:** missing either → `planning-and-task-breakdown` to complete the plan first.

## Phase 2 — Dispatch

**Purpose:** Execute tasks in dependency order, priority order within a level, parallel where safe.

### Step 0 — Provision (only when ≥ 2 `parallel: true` tasks share a dependency level)

For each parallel lane of scope M or larger:

```
git worktree add ../Tihoka-worktrees/<feature-slug>/lane-<task-N> -b lane/<feature>/<task-N>
# junction node_modules — no npm install per lane
```

Skip provisioning for XS/S lanes (sequential in main session) and for all `parallel: false` tasks.

### Dispatch loop

1. Topological-sort tasks into dependency levels.
2. Within the current level, sort by Priority (P0 → P3); equal priority → smallest scope first.
3. For each task:
   - `parallel: true` + disjoint files + scope ≥ M → spawn one `subagent_general` lane in its provisioned worktree (respect the lane cap; queue the rest by priority).
   - `parallel: true` + scope XS/S → run in main session, sequential by priority.
   - `parallel: false` or overlapping files → implement in the main session, priority order.
   - Blocked by an unfinished dependency:
     - `mock-contract` → dispatch with the agreed interface/mock; mark the integration point for the dependency's lane to close.
     - `wait` → hold; dispatch when the dependency's verifier passes, then resume by priority.
4. Every build-lane prompt carries: task text, acceptance criteria, WORKDIR (the lane's worktree path), BRANCH (`lane/<feature>/<task-N>`), ALLOWED FILES, FORBIDDEN FILES (everything else, especially files owned by other lanes), the relevant APPLY atoms, and the required local check (`npm run typecheck` minimum).

**Guard:** no two active lanes may write the same file. Overlap → merge the tasks or mark one `parallel: false`. Disjoint files keep merges clean; worktrees keep runtime isolated — both rules apply together, neither replaces the other.
**Loop back:** a lane reports it cannot meet acceptance criteria → re-plan that task before re-dispatching.

## Phase 3 — Verify

**Purpose:** Judge each lane's output — deterministic checks plus fresh-context review. Generation ≠ review: a lane never verifies its own work.

After each lane reports done:

1. Deterministic, **inside the lane's worktree**: `npm run typecheck && npm run test:unit && npm run build`. A lane's failure never corrupts another lane's working state.
2. Fresh-context: spawn a `subagent_explore` verifier in the main session — it reviews `git diff main...lane/<feature>/<task-N>` against the spec's acceptance criteria and returns BLOCKERS or PASS. Read-only on purpose: it judges, it does not fix.
3. Browser-facing change → `testing-with-playwright` e2e spec.

**Guard:** verifier returns PASS (or all blockers fixed within 2 cycles) before the task counts as done.
**Loop back:** blockers → owning lane fixes; 2 failed cycles → escalate to the human with the verifier output.

## Phase 3.5 — Integrate

**Purpose:** Merge lane branches back in dependency order. Worktrees move collisions from silent runtime overwrites to explicit merge conflicts — resolve them deliberately.

1. Merge lane branches into the main worktree, dependency order (foundation lanes first), one at a time.
2. After **each** merge: `npm run typecheck && npm run test:unit && npm run build` — a lane is only integrated when gates pass on the merged tree.
3. Merge conflict → the owning lane of the dependent task resolves it (it holds the contract context); 2 failed resolutions → escalate to the human.
4. `mock-contract` lanes: after the dependency lane merges, run the plan's explicit integration task — swap mock → real implementation, re-run gates.
5. No lane may modify `package.json`, lockfiles, or `manifest.json` — such tasks were `parallel: false` and already merged from the main session.

**Guard:** all lane branches merged AND gates pass on the merged tree.
**Loop back:** unresolved conflict after 2 attempts → escalate with both diffs.

## Phase 4 — Ship

1. `code-review-and-quality` → `code-simplification` on the merged diff.
2. `git-workflow-and-versioning` — atomic commits, clean history.
3. `shipping-and-launch` checklist → `npm run ship:dist` when the human says ship.
4. **Post-Launch Business Review** — the one blocking gate: human confirms the right thing was built vs spec Success Criteria.
5. `learning-and-apply` ACCUMULATE — code lessons → `experience/` atoms; pipeline lessons (drift, skipped gates, bad routing, merge conflicts that recurred) → `process/` atoms.
6. Cleanup — always, including on failure: `git worktree remove` for every provisioned lane. Keep lane branches until ship completes (rollback path), then delete. A leftover worktree corrupts the next run.

## Subagent prompt templates

### Build lane

```
You own Task <N> of <feature>. Implement ONLY the files listed below; other lanes own other files.

WORKDIR: <absolute path to the lane's worktree> — run every command there
BRANCH: lane/<feature>/<task-N> — commit your work here, never to main
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
| Each merge passes gates on merged tree | Dependent-task lane resolves; 2 fails → escalate |
| All worktrees removed after run | `git worktree remove` in finally, no exceptions |
| Business sign-off | Hold ship until human confirms |

## Tools by phase

| Phase | Primary tools |
|---|---|
| 1 — Load | `read`, `grep` |
| 2 — Dispatch | `exec` (worktree provision), `run_subagent`, `edit`, `write` |
| 3 — Verify | `exec`, `run_subagent` |
| 3.5 — Integrate | `exec`, `run_subagent` |
| 4 — Ship | `exec`, `run_subagent`, `write` |
