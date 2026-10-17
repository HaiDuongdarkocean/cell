---
name: architecture-eval
description: Evidence-based architecture evaluation — L0-L4 coverage report plus at least one shipped improvement per run. Use for "is the architecture good?" audits over the whole source. Not for per-change review (code-review-and-quality) or design-time audits.
---

# Architecture Evaluation

## Overview

Manual-invoke skill that answers **"kiến trúc đã tốt chưa?"** with evidence, not opinion — and ships at least one verified improvement per run. Evaluates the ACTUAL system (code), not just declared rules (docs), across the five evidence layers L0–L4.

**Contract:** ship something verified, or state precisely why nothing could ship. Run 1 has no previous report — it is the **baseline** that pins the inventory, probes, and utility tree every later run diffs against.

## When to Use

Anh invokes manually. Good cadence: after ~10 new ADRs, after a big feature lands, before a major version, or when "the system feels messy" — convert the feeling into a map.

## Inputs (read all four; skip none)

| Source | What | How |
|---|---|---|
| **DRIVERS** | Why "good" means anything here | `AGENTS.md` Mandate + Persona (5–80 tuổi, RAM ≥1GB, <3s), plus Anh's invoke-time concern — ask if unstated. Every risk theme cites the driver it threatens. |
| **DECLARED** | What the system claims to be | `AGENTS.md`, `docs/adr/` (status + alternatives), `docs/utility-tree.md`, `eslint.config.ts` boundary blocks, `.devin/hooks.v1.json`, package `check:*` scripts |
| **ACTUAL** | What the code really does | `public/manifest.json`, `package.json` deps, walk `src/` — features × entrypoints × entities × shared; real import graph via `scripts/check-feature-cycles.mjs` (`npm run check:cycles`) |
| **EVIDENCE** | What already happened | `git log` since last eval report, `learning-and-apply` lessons, `docs/audits/`, previous arch-eval report + its pinned inventory |

**DRIFT** — the highest-value finding: declared ≠ actual (a boundary rule the import graph violates, an ADR the code no longer honors).

## Procedure — 4 passes

### PASS 1 · RECON — map the real system

- **QA elicitation:** ask Anh to rank the top 3–5 quality attributes H/M/L. If unattended, agent-seed the ranks and label them `unvalidated` — downstream findings inherit the label.
- **Deterministic inventory (always, reproducible):** run `npm run check:cycles` for the feature graph (`N features, M cross-feature edges`) + file walk for sizes/roles. On baseline run, pin the decided-constraint inventory in the report — this is the coverage denominator, reused every run.
- **Deep-read tier (bounded):** files changed since last eval + cycle-checker-flagged features + ~3 rotated untouched features; fan out `subagent_explore` per cluster, synthesize.
- **System map axes:** context topology (SW / content-per-frame / main-world iife / OOPIF / pages / offscreen) + external endpoints (Drive, AnkiConnect, Google OAuth) as contract elements — not just the feature graph.
- Output: system map + feature list + QA ranks.

### PASS 2 · JUDGE — score L0–L4 on ACTUAL

- **L0 decision hygiene** — ADR count/format/Alternatives coverage/dangling refs/duplicates.
- **L1 fitness functions** — decided machine-checkable constraints vs guards that run automatically (lint/build/tests/hooks). Report N/M against the pinned inventory, never a bare %.
- **L2 scenarios** — 6 parts: source, stimulus, environment, artifact, response, response measure (part 6; environment is the most-dropped — flag scenarios missing fields). A scenario counts as covered only if analyzed against ≥1 decision/approach; one that retires no risk scores 0.
- **L3 change-cost probes** — run the probe set pinned at baseline ("add a provider", "add a message type"); classify seam vs leaked knowledge. Row format: `probe | touchpoints | prev | Δ`.
- **L4 production evidence** — check measurable-locally SLIs first (bundle size, cold-start, storage size) before declaring dark; `uninstrumented` becomes a PASS-3 ship candidate (e.g., add 3 `performance.mark` in content+SW — see `observability-and-instrumentation`).
- **Per-feature health row** — boundary clean? cycles? contract? smell — defined signals: file >500 lines, `KNOWN_CYCLES` membership, logic file with 0 tests. "Could be better" must cite evidence, never vibes.
- **Reversibility ledger** — top decisions by undo-cost (manifest key/permissions, storage schema, message-contract versions). Newly-irreversible since last eval = a finding.
- Per sensitive decision: catalog the architectural approach behind it; verified-sound decisions get recorded as non-risks with their evidence.

### PASS 3 · SHIP — deliver improvements in the same run

- Rank gaps by `(confidence gained) / (fix cost)`. Goal: if >20% of the pinned decided-constraint inventory is unguarded and a guard is cheap, ship it.
- Ship top 1–3 cheapest-highest-leverage:
  - write an L2 scenario that already exists as an ADR assumption,
  - add a fitness function for a decided-but-unguarded constraint,
  - add a local instrument for an `uninstrumented` measure,
  - supersede a stale ADR, close a leaked touchpoint.
- **Generation ≠ review** (`orchestration-patterns.md` #3–4): every shipped change gets a fresh-context `subagent_explore` verify; "after" numbers are re-derived by re-running the deterministic check post-commit — never asserted by the author.
- Commit each via `git-workflow-and-versioning` — atomic, own files only.
- If nothing can ship: state why in the report (needs Anh's decision / needs an ADR first). Silence is not an allowed outcome.

### PASS 4 · SCORE — write the report

- `docs/audits/<YYYYMMDD>_arch-eval.md` (audit-dir convention) — template below.
- Delta = inventory-count delta on the pinned inventory, not re-estimated vibes; each improvement gets its commit hash.
- Update `docs/utility-tree.md` (QA → refinement → scenario IDs) — the persistent baseline every run diffs against. Lives outside `docs/adr/` deliberately: it is not a decision record.

## Output template

```markdown
# Architecture Evaluation — <date> (baseline | eval N)
Verdict: <FIT | FIT-WITH-GAPS | DRIFTING>
Drivers: <Anh's concern> · <AGENTS.md anchors>
QA ranks: <attr H/M/L …> (<validated | unvalidated>)

## Coverage N/M (before → after)
| layer | N/M | % | Δ | denominator source |

## Feature health
| feature | context | boundary | contract | smell | verdict |

## Reversibility ledger
| decision | undo-cost | newly-irreversible? |

## Utility-tree delta
added / retired scenarios · newly-covered branches

## Findings (each cites its decision — ADR #/code locus — + affected QA)
risks · non-risks (with evidence) · sensitivity points · tradeoff points ·
risk themes (each cites its driver)

## Shipped this run
- <commit> <what> — verified by <fresh-context verify | rerun cmd> (N/M after)

## Unguarded / undecided (explicit, no hiding)
- storage ownership: needs ADR before guard (119 call sites)

## Forecast — notification to Anh
Health now: <posture + per-layer %, confidence H/M/L per layer>
  e.g. "structure SOUND (L0/L1 >70% guarded, high confidence),
  behavior UNPROVEN (L2/L4 <25%, low evidence — not failure)"
Headroom if this eval ships: +N% coverage achievable
  via <named cheap fixes> — expected next-report numbers.
Remaining headroom after run: +M% reachable only via
  <decisions/ADRs needed> · rest needs L4 instrumentation.
```

The forecast is the only place a % band is allowed — always tagged
with confidence and cited reasons, never a single score. If a layer's
number would be a guess, write `low confidence` + what would raise it.

## Hard rules

- Score measures **evidence coverage** — "not instrumented" ≠ "failed", and never pretend otherwise.
- No scalar "architecture score" as the verdict — the map IS the answer. The Forecast section may give % bands, always with a confidence tag and cited reasons.
- Every finding cites its decision (ADR #/code locus) + affected QA(s); uncited findings are vibes and get dropped.
- Never ship a change without its gate (typecheck/lint/test:related/build per `pre-commit-gate`) AND a fresh-context verify.
- If a finding is bigger than a run can fix → it becomes an ADR candidate or backlog item, not a half-shipped change.
- Feature fixes inside another agent's dirty files: report, don't touch (ownership).

## Verification

- [ ] All four input sources read (DRIVERS/DECLARED/ACTUAL/EVIDENCE)
- [ ] QA ranks elicited from Anh, or labeled `unvalidated`
- [ ] Inventory + probes pinned (baseline) or diffed against pinned set
- [ ] Report written at `docs/audits/<YYYYMMDD>_arch-eval.md` with N/M + delta
- [ ] `docs/utility-tree.md` updated
- [ ] ≥1 improvement committed + fresh-context verified, or explicit "nothing cheap left — why"
