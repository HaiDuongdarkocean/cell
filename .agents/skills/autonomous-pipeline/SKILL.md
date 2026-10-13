---
name: autonomous-pipeline
description: "Run a confirmed spec end-to-end: plan, parallel subagent build lanes, fresh-context verify, ship. Use for multi-task features."
---

# Autonomous Pipeline

## Overview

Chains the Tihoka skill pipeline into one orchestrated run: spec → plan → parallel subagent build → subagent verify → ship. This is the orchestrator that turns a confirmed spec into delivered work without the human approving each phase.

## When to Use

- Invoked **from `pipeline-deliver`** (DELIVER stage) — the stage contract decides when the engine runs; this skill is never the entry point for backlog items
- A reviewed spec exists in `docs/specs/` and the feature is multi-task
- Work decomposes into independent slices that can be built in parallel

**When NOT to use:**

- Single-file or XS/S changes — implement directly inside DELIVER
- No spec yet → `pipeline-analyze` / `pipeline-specify` first
- Destructive/irreversible operations — those always need explicit human confirmation

## How It Works

Run `pipeline.md` top to bottom. It encodes no-question defaults, per-phase guards, loop-back conditions, and the subagent prompt templates.

## Human gates

| Gate | Type | Position |
|---|---|---|
| Intent `## Decision: go` | Blocking | Before this skill (ANALYZE, in `pipeline-analyze`) |
| Spec review verdict | Blocking | Before this skill (SPECIFY gate, `docs/reviews/<slug>-spec.md`) |
| Plan | Async veto | Presented, not waited on — veto anytime before commit |
| Build / verify | None | Subagents execute and verify |
| Business sign-off | Blocking (interactive) / async (`all`) | `pipeline-deliver` ship step |

## Orchestration rules

Hard rules for spawning lanes (disjoint file ownership, no nested spawning, generation ≠ review): `references/orchestration-patterns.md`.

Parallel lanes of scope M+ run in isolated **git worktrees** (`../Tihoka-worktrees/<feature>/lane-<N>`) so concurrent builds, tests, and git operations never collide — collisions surface as explicit merge conflicts at integration, never as silent overwrites.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
