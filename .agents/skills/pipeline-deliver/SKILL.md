---
name: pipeline-deliver
description: DELIVER stage of the agentic SDLC — plan → build → deterministic gates → verify → ship. Stage contract only; orchestration lives in autonomous-pipeline (engine). Use when active item reaches stage=deliver.
---

# Pipeline DELIVER

> spec (+ design artifacts) → `tasks/plan-<slug>.md` → build → gates → verify → `transition → shipped`.

## Overview

DELIVER turns reviewed requirements into shipped product. It owns the *stage contract*: what must exist, what must pass, and how the state machine moves. It does **not** own orchestration mechanics — parallel lanes, worktrees, dispatch order, verify loops are the engine's job (`autonomous-pipeline` + `pipeline.md`).

Boundary:

- **Driver**: `idea-pick-off` decides *which* item runs and loops the backlog.
- **Stage**: this skill decides *what done means* and when `shipped` is earned.
- **Engine**: `autonomous-pipeline` decides *how* the work executes (lanes, worktrees, verify).
- **Lanes**: subagents never write `tasks/pipeline-state.json` — state writes happen in the main worktree only; lane worktrees are refused by the CLI guard.

## When to Use

- Active item at `stage=deliver`
- `transition design→deliver` or `specify→deliver` just succeeded

## When NOT to Use

- XS/S single-file change outside any pipeline item → implement directly
- Verify-only or review-only ask → `code-review-and-quality` / `doubt-driven-development`

## Stage Contract

```
in:   docs/specs/<slug>.md (+ design-brief + component-mapping when uiSurface=yes)
out:  tasks/plan-<slug>.md + tasks/todo-<slug>.md
      shipped feature + verify evidence
      docs/reviews/<slug>-verify.md     (fresh-context review, VERDICT: PASS)
      docs/reviews/<slug>-signoff.md    (interactive only, VERDICT: SIGN_OFF)
exit: transition --to shipped   (auto-clears active)
```

## State Steps

```bash
node scripts/pipeline-state.mjs get <slug>                 # confirm stage=deliver
node scripts/pipeline-state.mjs set <slug> artifacts.plan=tasks/plan-<slug>.md
# gates are written by hook-gates-tracker (PostToolUse exec) or `gates --set` —
# never hand-edit gates.*; ship validation re-checks at call time anyway
node scripts/pipeline-state.mjs transition <slug> --to shipped
```

All mutations require ownership: `owner` is claimed at `init`/`activate`/first mutation via `Tihoka_AGENT_ID` env (set once per session; subagent shells inherit it) or `--owner <id>` per command. `owned by '<other>'` failure = another agent's item — do NOT touch its state, files, or worktree; if the user redirects you, `request-handoff <slug> --note` and wait for the owner/human to `handoff --to` or `release --force --note`.

## Sequence

1. **Plan** — `planning-and-task-breakdown` → `tasks/plan-<slug>.md` + `todo-<slug>.md` (priority/parallel/blocked_strategy fields; AC per task traced to `## Success Criteria`).
2. **Build** — engine choice by scope:
   - M+ with parallel lanes → `autonomous-pipeline` (`pipeline.md` top to bottom: provision worktrees, dispatch, verify lanes).
   - XS/S → in-session `incremental-implementation` + `test-driven-development`.
   - Mockup cleanup: if `src/entrypoints/mockup-<slug>/` exists, delete it before ship — it is a design-time artifact.
3. **Deterministic gates** — required before ship, all must be `pass` and fresh (newer than latest `src/` change):
   `npm run typecheck` · `npm run lint` · `npm run test:unit` · `npm run build` · +browser verify when `uiSurface=yes` (`testing-extension-browser`).
4. **Verify** — fresh-context `subagent_explore` code review against spec Success Criteria → `docs/reviews/<slug>-verify.md` ending `VERDICT: PASS|FAIL` (generation ≠ review).
5. **Ship** —
   - interactive: business sign-off record → `docs/reviews/<slug>-signoff.md` `VERDICT: SIGN_OFF`; `shipping-and-launch` for rollout concerns.
   - `all` mode: sign-off deferred async — `transition` itself re-runs the four npm gates at call time (no cache trust); loop report lists commits for human veto later.
   - Backlog row → `shipped` + commit hash; `docs/0-wiki.md` changelog line.

## Ship validation (enforced by `pipeline-state.mjs transition`)

- `awaiting` must be `null` — resolve first.
- `docs/reviews/<slug>-verify.md` verdict `PASS`.
- interactive: `SIGN_OFF` + required gates `pass` and fresh vs newest `src/` mtime.
- `all`: transition re-runs `npm run typecheck && npm run lint && npm run test:unit && npm run build` — any nonzero refuses.

## Anti-patterns

| Don't | Why |
|---|---|
| Ship on `gates.*` cache alone | Cache is observability only — transition re-validates at call time |
| Lanes writing pipeline-state.json | Main-worktree-only guard refuses; state is orchestrator state |
| Self-written verify artifact | Fresh-context subagent or it doesn't count as review |
| Ship `mockup-<slug>/` into product | Design-time artifact — delete at ship step |
| Partial ship marked `shipped` | Deferred sub-features → new backlog row, keep row in-progress |

## Verification

- [ ] Plan + todo exist with per-task AC traced to `## Success Criteria`
- [ ] All required gates `pass` fresh (or npm re-run green in `all` mode)
- [ ] Verify artifact verdict `PASS`, written by fresh-context lane
- [ ] Mockup dir deleted if it existed
- [ ] `transition --to shipped` exits 0 and `active` cleared; backlog row → `shipped` + commit hash; wiki changelog line

## Router boomerang

Task đổi → `/using-agent-skills`. Wrong need mid-build → `transition --to analyze`. Verify red → fix in owning lane or `debugging-and-error-recovery`. Next item → `idea-pick-off`.
