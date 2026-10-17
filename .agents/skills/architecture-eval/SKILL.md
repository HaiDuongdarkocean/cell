---
name: architecture-eval
description: Evidence-based architecture evaluation — L0-L4 coverage report plus at least one shipped improvement per run. Use for "is the architecture good?" audits over the whole source. Not for per-change review (code-review-and-quality) or design-time audits.
---

# Architecture Evaluation

## Overview

Manual-invoke skill that answers **"kiến trúc đã tốt chưa?"** with evidence, not opinion — and ships at least one real improvement per run. Evaluates the ACTUAL system (code), not just declared rules (docs), across the five evidence layers L0–L4.

**Goal per run:** coverage delta >20% where cheap gaps exist. Contract: ship something or state precisely why nothing could ship.

## When to Use

Anh invokes manually. Good cadence: after ~10 new ADRs, after a big feature lands, before a major version, or when "the system feels messy" — convert the feeling into a map.

## Inputs (read all three; skip none)

| Source | What | How |
|---|---|---|
| **DECLARED** | What the system claims to be | `AGENTS.md`, `docs/adr/` (status + alternatives), `eslint.config.ts` boundary blocks, `hooks.v1.json`, package `check:*` scripts |
| **ACTUAL** | What the code really does | Walk `src/` — features × entrypoints × entities × shared; real import graph (reuse `scripts/check-feature-cycles.mjs` engine); read each feature's handlers/registry/what-it-does |
| **EVIDENCE** | What already happened | `git log` since last eval report, `learning-and-apply` lessons, `docs/audits/` |

**DRIFT** — the highest-value finding: declared ≠ actual (a boundary rule the import graph violates, an ADR the code no longer honors).

## Procedure — 4 passes

### PASS 1 · RECON — map the real system

- Inventory `src/`: every feature, entrypoint, entity — size + role.
- Build the feature-level dependency graph (reuse the cycle-checker engine).
- Read what each feature does (index, handlers, message use) — fan out `subagent_explore` per feature-cluster for the full-source sweep; synthesize.
- Output: system map + feature list.

### PASS 2 · JUDGE — score L0–L4 on ACTUAL

- **L0 decision hygiene** — ADR count/format/Alternatives coverage/dangling refs/duplicates.
- **L1 fitness functions** — decided machine-checkable constraints vs guards that run automatically (lint/build/tests/hooks).
- **L2 scenarios** — quality-attribute scenarios with all 6 parts + a measure; count written vs. important; candidates hide inside ADRs.
- **L3 change-cost probes** — pick 1–2 stereotypical changes ("add a provider", "add a message type"), count touchpoints vs. the ideal seam; classify seam vs leaked knowledge.
- **L4 production evidence** — which response measures are actually measured; mark `uninstrumented` honestly.
- Per-feature health row: boundary clean? cycles? contract? smell? — "could this be better?" must cite evidence, never vibes.

### PASS 3 · SHIP — deliver improvements in the same run

- Rank gaps by `(confidence gained) / (fix cost)`. Ship top 1–3 cheapest-highest-leverage:
  - write an L2 scenario that already exists as an ADR assumption,
  - add a fitness function for a decided-but-unguarded constraint,
  - supersede a stale ADR, close a leaked touchpoint.
- Commit each via `git-workflow-and-versioning` — atomic, own files only.
- If nothing can ship: state why in the report (needs Anh's decision / needs an ADR first). Silence is not an allowed outcome.

### PASS 4 · SCORE — write the report

- `docs/audits/arch-eval-<YYYYMMDD>.md` — template below.
- Delta line vs previous report; each improvement gets its commit hash.

## Output template

```markdown
# Architecture Evaluation — <date>
Verdict: <FIT | FIT-WITH-GAPS | DRIFTING>

## Coverage (before → after)
L0 ██%   L1 ██%   L2 ██%   L3 ██%   L4 ██%

## Feature health
| feature | boundary | contract | smell | verdict |

## Findings (ATAM vocabulary)
risks · non-risks · sensitivity points · tradeoff points · risk themes

## Shipped this run
- <commit> <what it improved> (+N coverage)

## Unguarded / undecided (explicit, no hiding)
- storage ownership: needs ADR before guard (119 call sites)
```

## Hard rules

- Score measures **evidence coverage** — "not instrumented" ≠ "failed", and never pretend otherwise.
- No scalar "architecture score" — the map IS the answer.
- Never ship a change without its gate (typecheck/lint/test:related/build per `pre-commit-gate`).
- If a finding is bigger than a run can fix → it becomes an ADR candidate or backlog item, not a half-shipped change.
- Feature fixes inside another agent's dirty files: report, don't touch (ownership).

## Verification

- [ ] All three input sources read (DECLARED/ACTUAL/EVIDENCE)
- [ ] Report written at `docs/audits/arch-eval-<date>.md`
- [ ] ≥1 improvement committed, or explicit "nothing cheap left — why"
- [ ] Delta computed vs previous report
