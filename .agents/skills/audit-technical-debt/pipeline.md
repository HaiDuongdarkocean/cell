# Audit Technical Debt — Autonomous Pipeline

> Run this file when `audit-technical-debt` is triggered. Do not ask the user. Use the defaults below for every decision point. Execute every phase from top to bottom. Only stop when the final report is written, verified, and a next step is recommended.

## No-question defaults

- **Scope missing:** Use the top 3 most-changed directories/files in the last 90 days from `git log --stat --since='90 days ago'`.
- **Top 3 by churn:** Aggregate `git log --stat` by directory and pick the 3 with the most insertions+deletions.
- **Human signal missing:** Infer from commit messages, PR descriptions, and code comments containing `refactor`, `debt`, `cleanup`, `fixme`, `todo`, `hack`, `workaround`, `temporary`, `legacy`. Flag as `confidence: low`.
- **Test/coverage tooling missing:** Skip and record `tooling gap: coverage` in the inventory.
- **Subagent mode:** Default to `spot-check` — one cross-check and one final validation.

## Phase 1 — Prepare

**Purpose:** Load context and set a concrete scope.

1. Read `AGENTS.md` and `DESIGN.md` in the repo root if they exist.
2. Run `git log --stat --since='90 days ago' --pretty=format:'%H %s' | head -100` and `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | xargs wc -l | sort -nr | head -20`.
3. Determine scope:
   - If the user named a scope, use it.
   - Else, pick the top 3 by churn from step 2.
4. Write the scope line: `Audit <scope> to find debt blocking <default: velocity of the next 3 features>`.

**Guard:** Scope is one or more concrete paths or module names.

**Loop back:** If still no scope, default to the repo root and note `scope: entire repo (default)`.

## Phase 2 — Discover

**Purpose:** Collect automatic, human, and subagent signals.

### Automatic signals

1. `grep -RinE '\b(TODO|FIXME|HACK|XXX|technical debt)\b' <scope>` — record file, line, and context.
2. Run lint/typecheck/build if a config exists (`npm run lint`, `npx tsc --noEmit`, `npm run build`, or equivalents). Record failures and warnings.
3. Run dependency freshness: `npm outdated --json`, `cargo outdated -d 1`, or `pip list --outdated`. Record outdated packages.
4. Flag files over the project threshold (default 500 lines) from Phase 1 step 2.
5. Search tests for flakiness: `it.skip`, `describe.skip`, `setTimeout`, `waitFor`, `Math.random` in test files.

### Human signal (inferred)

1. `git log --grep='refactor\|debt\|cleanup' -i --oneline -20` in scope.
2. Search recent commit messages and PR descriptions for `workaround`, `temporary`, `legacy`, `should be removed`, `remove later`.
3. Extract the lines around each `TODO`/`FIXME`/`HACK` comment for context.

### Subagent cross-check

- Spawn `subagent_explore`:
  - **title:** `Re-audit for missed debt`
  - **task:** `Scope: <SCOPE>. Identify technical debt a surface scan likely missed: tight coupling, hidden dependencies, outdated patterns, missing error handling, dead code, config drift, inconsistent conventions. Return a markdown table: | Location | Description |. Do not fix anything; only report.`
- Merge the subagent's findings into the candidate list.

**Guard:** At least one signal exists (automatic, human, or subagent).

**Loop back:** If none, widen the scope to the repo root and re-run Phase 2.

## Phase 3 — Analyze

**Purpose:** Classify, score, rank, and translate to business language.

1. For each signal, assign one primary type:
   - **Code quality** — duplication, complex functions, poor naming, inconsistent patterns.
   - **Architectural** — wrong boundaries, tight coupling, data-model mismatch.
   - **Infrastructure / dependency** — outdated libs, stale toolchain, manual config.
   - **Testing** — missing tests, flaky tests, slow tests, low coverage.
   - **Documentation** — missing or stale docs, onboarding by tribal knowledge.
   - **Process** — unclear ownership, manual steps, missing gates.
2. Score each item 1–5 on four criteria and compute the weighted score:

| Criterion | Weight | 5 means | 1 means |
|---|---|---|---|
| Velocity impact | 30% | Nearly impossible to change without touching the debt | Minor friction |
| Risk | 35% | Active vulnerability, outage risk, or frequent bugs | Theoretical, no observed failure |
| Reach | 20% | Every team/feature/user touches this | Isolated subsystem |
| Inverse remediation cost | 15% | Fixable in < 1 sprint | Multi-quarter rewrite |

`weighted score = 0.30×velocity + 0.35×risk + 0.20×reach + 0.15×(6 − cost)`

3. Sort descending. Build an inventory with at least the top 5. Columns:

| Location | Type | Description | Velocity | Risk | Reach | Cost | Score |
|---|---|---|---|---|---|---|---|

4. Translate the top 3 into business language with a time, money, or delivery estimate. Examples:
   - `Adding feature X will take Y extra days because...`
   - `Upgrading dependency A is currently B hours; in 6 months it will likely be C weeks.`
   - `Changing this area has an X% chance of production regression.`
   - If hard numbers are impossible, use an ordinal: `blocks next 3 sprints`, `doubles change time`, `delays release by 1 week`.

### Subagent adversarial review

- Spawn `subagent_explore`:
  - **title:** `Challenge debt scoring`
  - **task:** `Review the top 5 debt items, their classification, scoring, and business translation. Be adversarial. Point out any that are over-scored, under-scored, miscategorized, or missing from the list. Return a concise list of flags with reasoning. Do not edit files.`
- Adjust the inventory for accepted flags. Reject unsupported flags and record the reason.

**Guard:** Every item has a primary type and four scores. The top 3 have a one-line business impact. The inventory contains at least 5 items.

**Loop back:** If fewer than 3 items, widen the scope and re-run Phase 2.

## Phase 4 — Decide

**Purpose:** Produce a remediation roadmap.

1. Bucket the items:
   - **Quick wins:** score ≥ 3.5 and cost ≤ 2. Pick the top 3.
   - **Pay-down plan:** score ≥ 4.0 and cost ≥ 3. Schedule across sprints.
   - **Watch list:** score 2.5–3.9, stable, rarely touched.
   - **Stop-loss:** deliberate debt taken to meet a deadline; mark for payback before the next major change.
2. For each action, default `owner = TBD` and `cadence = next sprint` unless an `OWNERS` or `CODEOWNERS` file suggests otherwise.
3. Write the full audit report to `docs/audits/YYYYMMDD_<scope-sanitized>.md`. If `docs/audits/` does not exist, write to the repo root as `audit-<scope>-<YYYYMMDD>.md`.

**Guard:** The roadmap has at least 3 concrete actions, each with a cadence. At least 1 quick win exists or a spike is scheduled as the first action.

**Loop back:** If no quick win exists, add a spike `Reduce uncertainty for <highest-cost item>` before the pay-down plan.

## Phase 5 — Verify & Handoff

**Purpose:** Validate and close the task.

1. Run the internal verification checklist:
   - [ ] Scope is concrete.
   - [ ] Automatic, human-inferred, and subagent signals were collected.
   - [ ] Every item is classified into one of the six types.
   - [ ] Every item has a weighted score.
   - [ ] Top 3 items have a business-language impact.
   - [ ] Roadmap has at least 3 concrete actions.
   - [ ] Report is written to disk.
2. Run the **subagent final validation**:
   - Spawn `subagent_explore`:
     - **title:** `Validate audit report`
     - **task:** `Read the audit report at <REPORT_PATH> and the scope. Check for consistency between evidence and conclusions, missing scoring math, hallucinated facts, unjustified business claims, and action items without cadence. Return only critical blockers or the word PASS.`
   - If blockers are found, fix the report and re-run this step.
3. Append one line to `self-evolution/RUNBOOK.md` in this skill directory:
   `YYYY-MM-DD: autonomous audit of <scope>; N items; top score <X>; <REPORT_PATH>`
4. Return the final summary to the user: scope, item count, high-score count, top 5 inventory, top 3 business impact, and the roadmap.
5. **Router boomerang:** Recommend the next skill based on the roadmap:
   - Quick wins → `planning-and-task-breakdown` or `incremental-implementation`
   - Pay-down → `planning-and-task-breakdown`
   - Task changed → `using-agent-skills`

**Guard:** The subagent final validation passes or all blockers are resolved.

**Loop back:** If validation fails, fix and re-run this phase.

## Subagent prompt templates

### Cross-check

```
You are a read-only code auditor. Scope: <SCOPE>. Find technical debt that a surface scan is likely to miss: tight coupling, hidden dependencies, outdated patterns, missing error handling, dead code, config drift, inconsistent conventions. Return a markdown table: | Location | Description |. Do not fix anything; only report.
```

### Adversarial review

```
You are an adversarial reviewer. Review this debt inventory and challenge the classification, scoring, and business translation. Return only flags: over-scored, under-scored, miscategorized, missing, or business claims not supported by evidence. Be concise. Do not edit files.
```

### Final validation

```
You are a final validator. Read the audit report at <REPORT_PATH>. Check consistency, scoring accuracy, evidence for business claims, and action cadence. Return only critical blockers or the word PASS.
```

## Tools by phase

| Phase | Primary tools |
|---|---|
| 1 — Prepare | `read`, `exec` |
| 2 — Discover | `grep`, `exec`, `run_subagent` |
| 3 — Analyze | `write`, `run_subagent` |
| 4 — Decide | `write` |
| 5 — Verify & Handoff | `run_subagent`, `write`, `edit` |
