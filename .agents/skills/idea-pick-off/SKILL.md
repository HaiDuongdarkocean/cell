---
name: idea-pick-off
description: Pops the top unblocked item from docs/ideas/product-backlog.md and drives it through the stage pipeline (analyze → specify → design → deliver → shipped). `all` mode loops until the backlog is drained. Use when asked to start the next backlog feature, "làm item #N", "làm hết backlog", or continue the roadmap. Not for adding new ideas (→ idea-grab) or fixing bugs (→ debugging-and-error-recovery).
---

# Idea Pick-Off — Backlog Top → Shipped

## Overview

`idea-pick-off` is the **driver** of the agentic SDLC. It reads `docs/ideas/product-backlog.md` as a single ordered queue, claims the top unblocked item, and routes it through the stage skills — it orchestrates, never reimplements stage work.

```
read backlog → pick top unblocked icebox → state init
  → pipeline-analyze   (decision: no-go → dropped · go → analyzed)
  → pipeline-specify   (spec reviewed → specced)
  → pipeline-design    (only when uiSurface=yes → designed)
  → pipeline-deliver   (plan → build → gates → verify → shipped)
```

One item per run by default. `/idea-pick-off all` drains the queue — see **Loop mode**. Queue order is the contract — never reorder mid-build.

**SSOT split:** `tasks/pipeline-state.json` is the machine-readable stage truth (transitions enforced by `scripts/pipeline-state.mjs`); the backlog `Status` column is the human mirror. State wins on conflict.

## When to Use

- "Làm item tiếp theo", "pick next idea", "làm #N", "continue roadmap"
- "làm hết backlog", "idea-pick-off all" → Loop mode
- After `idea-grab` inserts items and user wants the top one built

## When NOT to Use

- Adding ideas → `idea-grab`
- Bug/regression → `debugging-and-error-recovery`
- Debt/refactor → `audit-technical-debt`
- Raw idea not in backlog → `pipeline-analyze` directly

## Pre-conditions

- `docs/ideas/product-backlog.md` exists with the Item schema.
- Working tree clean or unrelated — never claim on top of a dirty tree.
- `tasks/pipeline-state.json` exists; `active` is `null` or points to the item being resumed.

## Steps

### Step 1 — Read the queue

- Parse the backlog table → rows with `Status=icebox`.
- Top item = lowest `#` whose every `Deps` is `shipped` or `—`.
- Also check `pipeline-state.json` for `awaiting`/non-terminal items — resume beats new picks.

**Guard:** no icebox → report "backlog empty — run /idea-grab" and stop. Top blocked by unshipped deps → try next; all blocked → report and stop.

### Step 2 — Claim + init state

- User named `#N`/slug → use that; verify deps, ask before proceeding if blocked.
- `node scripts/pipeline-state.mjs init <slug> --mode interactive` (`--mode all` inside loop mode).
- Backlog row → `Status: in-progress` is premature — keep `icebox` until analyze confirms `go`. Mark claim in state only.

**Guard:** item already in state with non-terminal stage → resume from `stage`, don't restart.

**Guard — active held elsewhere:** `init` fails `item '<other>' already active` when another agent/session is driving a different item → never touch that item's files or state; `init <slug> --mode <m> --force` takes the `active` pointer instead (the held item's entry stays intact — `transition`/`set`/`gates` are slug-scoped and `active` is only the loop's claim marker). `activate <slug>` re-points to an existing non-terminal item; `seed --force` does the same for artifact-first items.

**Guard — item ownership:** every item has `owner` (set at `init`/`activate`/first mutation via `CELL_AGENT_ID` env or `--owner <id>`). Mutations (`set`/`gates`/`resolve`/`transition`/`activate`) on an item owned by another agent fail hard — that is the signal to STOP touching it entirely (its files, worktree, docs). If the user redirects you to an owned item, use `request-handoff <slug> --note` instead of mutating; the owner or a human decides (`handoff --to`/`release --force --note`). Always pass the same `CELL_AGENT_ID` for the whole session — subagent shells inherit it, so lanes under your session still count as you.

### Step 3 — ANALYZE (invoke `pipeline-analyze`)

- Seed with row: `Pain`/`Nhóm`/`Infra`/`Source` + slug.
- Outcome `go` → `transition --to specify`; backlog `Status: analyzed`, `Spec:` cell += intent link.
- Outcome `no-go`/`defer` → `transition --to dropped`; backlog `Status: dropped` + reason (the CLI updates the row itself when it can match it); pick next item in `all` mode, stop in single mode.

**Guard:** `awaiting` non-null → surface to user, resolve via `resolve <slug> --note`, never proceed past it.

### Step 4 — SPECIFY (invoke `pipeline-specify`)

- Intent → `docs/specs/<slug>.md` → spec-reviewer gate — **one pass only** (APPROVE → go; APPROVE_WITH_CHANGES → apply fixes + append `## Applied fixes` to the review artifact → go; REJECT → backward edge).
- `uiSurface=yes` → `transition --to design`; `uiSurface=no` → `transition --to deliver`.
- Backlog `Status: specced`, `Spec:` = spec link, `UI` column filled.

**Guard:** spec REJECT → `transition --to analyze` (loop count, cap 3), or stop with `awaiting` note in `all` mode → skip item.

### Step 5 — DESIGN (invoke `pipeline-design`, uiSurface=yes only)

- Concepts → mockup → brief → approval (interactive) or vision-reader verdict (`all`).
- `transition --to deliver`; backlog `Status: designed`.

### Step 6 — DELIVER (invoke `pipeline-deliver`)

- Plan → build (engine: `autonomous-pipeline` for M+ lanes, in-session for XS/S) → gates → fresh-context verify → ship.
- `transition --to shipped`; backlog `Status: shipped` + commit hash; `docs/0-wiki.md` changelog.

**Guard:** any gate red that survives a real fix → stop and report — never commit red. Never silently drop a plan task; blocked → `awaiting` + message user.

## Loop mode (`/idea-pick-off all`)

Steps 1–6 per item, then re-enter Step 1 until drained or a stop condition hits. Every item in the loop runs `--mode all`: `pipeline-state.mjs init <slug> --mode all`.

**HARD RULES for `all` — no exceptions:**

- **ZERO QUESTIONS, start to finish.** No interviews, no frame confirmation, no "should I proceed". Decisions → conservative option recorded as accepted risk in the intent doc. Asking mid-loop is a contract violation.
- **Self-interrogation is the gate.** ANALYZE infers via cite-or-assumption rules; SPECIFY's spec-reviewer is the only human-proxy gate; DESIGN uses brief-lint + vision-reader; DELIVER's transition re-runs npm gates itself.
- **Blocked item → skip, not stall.** Deps unshipped, loop cap hit, or `awaiting` set → mark `Status: in-progress` + one-line blocking note, move to next unblocked item.
- **In-flight item → hands off, keep moving.** An item whose `active` pointer is held by another agent/session (or user says it's being worked) is skipped entirely — no file edits, no state writes, no "help". `init --force` the next item and continue; the skipped item ships on its own and clears its entry itself.
- **Gate red surviving a real fix** → stop the whole loop — the tree never accumulates unverified work.
- **Item isolation.** Per-item commits grouped by subsystem; tree clean before next claim. Worktree-per-item when session convention says so.
- **Never reorder.** Skipped items keep position, stay `in-progress` + note.
- **Stop conditions** (any → stop + report): drained · all remaining blocked · unfixable gate red · 3 consecutive skips · user interrupt.

**Loop report:**

```markdown
## Pick-off all — <date>
- Shipped: <slug ×N with commit hashes>
- Dropped: <slug — no-go reason>
- Skipped/blocked: <slug — reason>
- Stopped because: <drained | all blocked | gate red | interrupt>
- Next top item: <slug or "backlog empty — /idea-grab">
```

## Resume rules

Read `tasks/pipeline-state.json` first; backlog status is the fallback mirror.

| Found stage/status | Resume at |
|---|---|
| `icebox` / no state | `init` → pipeline-analyze |
| `analyze` / `analyzed` | pipeline-analyze (finish or continue to specify) |
| `specify` / `specced` | pipeline-specify (fix rounds or transition out) |
| `design` / `designed` | pipeline-design |
| `deliver` / `in-progress` | pipeline-deliver — inspect plan/todos/commits, resume mid-build |
| `awaiting` non-null | Resolve the flag first (`resolve <slug> --note`) |
| `shipped` / `dropped` | Terminal — pick next item |

## Anti-patterns

| Don't | Why |
|---|---|
| Build straight from the Pain line | Pain is a seed — analyze/specify exist for this |
| Skip DESIGN on a `uiSurface=yes` item | The FAB lesson: UI decided before implementation or it gets redone by hand |
| Ask the user mid-loop in `all` mode | Loop is autonomous — infer, record risk, let gates catch it |
| Fake-skip a failing item as `shipped` | Skipped = `in-progress` + blocking note; only `no-go` analysis or user veto drops |
| Edit `tasks/pipeline-state.json` by hand | Mutations only via `pipeline-state.mjs` — enforcement lives there |
| Reorder rows mid-build | Breaks the pick contract; reorder only at wave boundaries |
| Rename a slug after intent exists | Breaks intent/spec/design file links |
| Silently drop a blocked item | `awaiting` + in-progress note — tell the user what's blocking |

## Verification

- [ ] Picked item = lowest unblocked `icebox` (or user-named, deps verified)
- [ ] `pipeline-state.json` stage and backlog `Status` agree at every transition
- [ ] `no-go` items land `dropped` with reason — never silently skipped
- [ ] `uiSurface=yes` items passed DESIGN before `deliver`
- [ ] `shipped` only on transition success + gates green; partial → deferred tracked
- [ ] Wiki changelog + commits done; `all` mode: loop report + skipped notes + clean tree

## Router boomerang

Need new ideas? → `/idea-grab`. Wrong need mid-flight? → `transition --to analyze`. Build broke? → `/debugging-and-error-recovery`.
