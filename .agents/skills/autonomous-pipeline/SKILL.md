---
name: autonomous-pipeline
description: End-to-end autonomous run from a confirmed spec to shipped code — plan with priority + parallel lanes, dispatch build tasks to subagents, verify with fresh-context subagents, ship. Use when a spec exists in docs/specs/ and the work should run without per-phase human gates; humans hold async veto until commit and business sign-off at the end. Use for multi-task features where parallel execution is safe.
---

# Autonomous Pipeline

## Overview

Chains the Cell skill pipeline into one orchestrated run: spec → plan → parallel subagent build → subagent verify → ship. This is the orchestrator that turns a confirmed spec into delivered work without the human approving each phase.

## When to Use

- A confirmed spec exists in `docs/specs/` (from `elicitation` or `spec-driven-development`) and the feature is multi-task
- The user confirmed intent and wants end-to-end execution ("just do it")
- Work decomposes into independent slices that can be built in parallel

**When NOT to use:**

- Single-file or XS/S changes — implement directly
- No spec yet → `elicitation` first
- Destructive/irreversible operations — those always need explicit human confirmation

## How It Works

Run `pipeline.md` top to bottom. It encodes no-question defaults, per-phase guards, loop-back conditions, and the subagent prompt templates.

## Human gates

| Gate | Type | Position |
|---|---|---|
| Intent frame ("yes") | Blocking | Before this skill (in `elicitation`) |
| Spec / plan | Async veto | Presented, not waited on — veto anytime before commit |
| Build / verify | None | Subagents execute and verify |
| Business sign-off | Blocking | `shipping-and-launch` post-launch review |

## Orchestration rules

Hard rules for spawning lanes (disjoint file ownership, no nested spawning, generation ≠ review): `references/orchestration-patterns.md`.

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
