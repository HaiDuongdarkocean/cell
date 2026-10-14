# Audit Technical Debt — Autonomous Pipeline

> Run when `audit-technical-debt` triggers. Do not ask the user — use the defaults for every decision point. Execute every phase top to bottom. Stop only when the report is written, validated, and a next step is recommended.

## No-question defaults

- **Scope missing:** top 3 most-changed dirs/files in the last 90 days via `git log --stat --since='90 days ago'` (aggregate insertions+deletions).
- **Human signal missing:** infer from commit messages, PR descriptions, comments matching `refactor|debt|cleanup|fixme|todo|hack|workaround|temporary|legacy`. Flag `confidence: low`.
- **Coverage tooling missing:** skip; record `tooling gap: coverage`.
- **Subagent mode:** `spot-check` — one cross-check + one final validation.

## Phase 1 — Prepare

1. Read `AGENTS.md` + `.agents/skills/clean-design/knowledge/` (design canon) if UI-related.
2. Run the churn + file-size commands: `git log --stat --since='90 days ago' --pretty=format:'%H %s' | head -100` and `find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | xargs wc -l | sort -nr | head -20`.
3. Scope = user's named scope, else top 3 by churn.
4. Write the scope line: `Audit <scope> to find debt blocking <default: velocity of the next 3 features>`.

**Guard:** concrete paths/module names. **Loop back:** default to repo root, note `scope: entire repo (default)`.

## Phase 2 — Discover

Automatic signals:

1. `grep -RinE '\b(TODO|FIXME|HACK|XXX|technical debt)\b' <scope>` — file, line, context.
2. Lint/typecheck/build if configs exist; record failures and warnings.
3. Dependency freshness: `npm outdated --json`, `cargo outdated -d 1`, or `pip list --outdated`.
4. Files over the project threshold (default 500 lines) from Phase 1.
5. Test flakiness: `it.skip`, `describe.skip`, `setTimeout`, `waitFor`, `Math.random` in test files.

Human signal (inferred): `git log --grep='refactor\|debt\|cleanup' -i --oneline -20`; commit/PR text for `workaround|temporary|legacy|should be removed|remove later`; context lines around each TODO.

Subagent cross-check — spawn `subagent_explore` (spawn rules: `.agents/skills/autonomous-pipeline/references/orchestration-patterns.md`):

- **title:** `Re-audit for missed debt`
- **task:** `Scope: <SCOPE>. Identify technical debt a surface scan likely missed: tight coupling, hidden dependencies, outdated patterns, missing error handling, dead code, config drift, inconsistent conventions. Return a markdown table: | Location | Description |. Do not fix anything; only report.`

**Guard:** ≥1 signal exists. **Loop back:** none → widen scope to repo root, re-run.

**Loop-until-dry rule:** dedupe every new finding against a `seen` set containing ALL findings (verified AND rejected) — deduping against confirmed-only re-discovers dead ends forever. Stop after K consecutive rounds with nothing new.

## Phase 3 — Analyze

1. Assign one primary type per signal: **Code quality** (duplication, naming, inconsistency) · **Architectural** (boundaries, coupling, data-model mismatch) · **Infrastructure/dependency** (outdated libs, stale toolchain) · **Testing** (missing/flaky/slow) · **Documentation** (missing/stale) · **Process** (ownership, manual steps, missing gates).
2. Score 1–5 on four criteria; weighted score:

| Criterion | Weight | 5 means | 1 means |
|---|---|---|---|
| Velocity impact | 30% | Nearly impossible to change without touching it | Minor friction |
| Risk | 35% | Active vulnerability, outage risk, frequent bugs | Theoretical |
| Reach | 20% | Every team/feature touches it | Isolated |
| Inverse cost | 15% | Fixable in <1 sprint | Multi-quarter rewrite |

`score = 0.30×velocity + 0.35×risk + 0.20×reach + 0.15×(6 − cost)`

3. Sort desc; inventory ≥ top 5 with columns `Location | Type | Description | Velocity | Risk | Reach | Cost | Score`.
4. Translate top 3 into business language with a time/money/delivery estimate (`blocks next 3 sprints`, `doubles change time` if no hard numbers).

Adversarial review — spawn `subagent_explore`:

- **title:** `Challenge debt scoring`
- **task:** `Review the top 5 debt items, their classification, scoring, and business translation. Be adversarial. Flag over-scored, under-scored, miscategorized, or missing items with reasoning. Do not edit files.`

Adjust inventory for accepted flags; record why rejected flags were rejected.

**Guard:** every item has a type + 4 scores; top 3 have a business impact; inventory ≥5. **Loop back:** <3 items → widen scope, re-run Phase 2.

## Phase 4 — Decide

Bucket items:

- **Quick wins:** score ≥3.5 and cost ≤2 — pick top 3.
- **Pay-down:** score ≥4.0 and cost ≥3 — schedule across sprints.
- **Watch:** 2.5–3.9, stable, rarely touched.
- **Stop-loss:** deliberate deadline debt — mark for payback before next major change.

Default `owner = TBD`, `cadence = next sprint` unless OWNERS/CODEOWNERS suggests otherwise. Write the report to `docs/audits/YYYYMMDD_<scope>.md` (fallback: repo-root `audit-<scope>-<YYYYMMDD>.md`).

**Guard:** ≥3 concrete actions with cadence; ≥1 quick win or a scheduled spike. **Loop back:** no quick win → add spike `Reduce uncertainty for <highest-cost item>`.

## Phase 5 — Verify & Handoff

1. Checklist: scope concrete · all three signal types collected · every item typed + scored · top 3 have business impact · ≥3 roadmap actions · report on disk.
2. Final validation — spawn `subagent_explore`:
   - **title:** `Validate audit report`
   - **task:** `Read the audit report at <REPORT_PATH> and the scope. Check for consistency between evidence and conclusions, missing scoring math, hallucinated facts, unjustified business claims, and action items without cadence. Return only critical blockers or the word PASS.`
   - Blockers → fix report, re-run this step.
3. Append to `self-evolution/RUNBOOK.md`: `YYYY-MM-DD: autonomous audit of <scope>; N items; top score <X>; <REPORT_PATH>`
4. Return: scope, item count, high-score count, top 5 inventory, top 3 business impact, roadmap.
5. **Router boomerang:** quick wins → `planning-and-task-breakdown`/`incremental-implementation`; pay-down → `planning-and-task-breakdown`; task changed → `using-agent-skills`.

**Guard:** final validation passes or all blockers resolved.
