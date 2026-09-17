---
name: idea-pick-off
description: Pops the top unblocked item from docs/ideas/product-backlog.md and runs it through the spec→plan→build→ship pipeline. Use when asked to start the next backlog feature, "làm item #N", or continue the roadmap. Not for adding new ideas (→ idea-grab) or fixing bugs (→ debugging-and-error-recovery).
---

# Idea Pick-Off — Backlog Top → Shipped

## Overview

`idea-pick-off` is the **execution half** of the product pipeline. It reads `docs/ideas/product-backlog.md` as a single ordered queue, claims the top unblocked item, and drives it through the existing skill chain — it orchestrates, never reimplements.

```
read backlog → pick top unblocked icebox → claim
  → /elicitation → spec (specced)
  → /planning-and-task-breakdown → tasks (planned)
  → build + gates (in-progress)
  → ship + links (shipped)
```

One item per run. The queue order is the contract — never reorder mid-build.

## When to Use

- "Làm item tiếp theo", "pick next idea", "làm #N", "continue roadmap"
- After `idea-grab` inserts items and user wants the top one built
- After a wave lands and the next item should start

## When NOT to Use

- Adding ideas → `idea-grab`
- Bug/regression → `debugging-and-error-recovery`
- Debt/refactor → `audit-technical-debt`
- Backlog item is a question, not a feature → `interview-me`/`elicitation` directly

## Pre-conditions

- `docs/ideas/product-backlog.md` exists with the Item schema (Slug/Pain/Cost/Value/Infra/Deps/Source/Status/Spec).
- Working tree clean or unrelated-to-backlog — never claim on top of a dirty tree.

## Steps

### Step 1 — Read the queue

**Actions:**
- Parse the backlog table. Build the list of rows with `status=icebox`.
- Top item = lowest `#` whose every `Deps` ID is `shipped` or `—`.

**Guard:**
- No icebox items → report "backlog empty — run /idea-grab" and stop.
- Top item blocked by unshipped deps → try next item; if ALL icebox items blocked → report blocked list and stop.

### Step 2 — Claim

**Actions:**
- If user named a specific item (`#N` or slug), use that — still verify deps; if blocked, ask before proceeding.
- Set the chosen row `Status: in-progress`, commit that alone? — No: edit in place, commit together with spec artifacts later (Step 5). For now, remember the claim.

**Guard:** item already `in-progress`/`specced`/`planned` → resume from its stage, don't restart.

### Step 3 — Spec (invoke `/elicitation`)

**Actions:**
- Seed elicitation with the row: `Pain` = raw statement seed, `Nhóm`/`Slug`/`Infra`/`Source` as context. The 8-field frame fills from these + one observation/interview round with the user.
- After confirmed frame → auto-spec writes `docs/specs/<slug>.md`, auto-review + fix ≤3 rounds.
- On success: set `Status: specced`, `Spec: docs/specs/<slug>.md`.

**Guard:** spec rejected 3 rounds → stop, present spec + review to user, status stays `in-progress` with note.

### Step 4 — Plan (invoke `/planning-and-task-breakdown`)

**Actions:** spec → `tasks/plan-<slug>.md` (or repo convention). Set `Status: planned`.

### Step 5 — Build

**Actions:**
- Execute the plan. Follow AGENTS.md: named exports, no comments, FSD boundaries, reuse > rewrite.
- Required gates before commit: `npm run typecheck` + `npm run lint` + `npm run test:unit` + `npm run build`. If runtime wiring changed → real-Chrome smoke via `testing-extension-browser`.
- `src/` changed → update `docs/2-architechture-system.md`.

**Guard:** any gate red → fix root cause or stop and report — never commit a red gate. Never silently drop a task from the plan; blocked → message user + keep `in-progress`.

### Step 6 — Ship

**Actions:**
- Commit(s) grouped by subsystem, no attribution trailers.
- Backlog row: `Status: shipped`, `Spec` stays linked — append commit hash in the Spec cell or a short note.
- `docs/0-wiki.md` changelog line (follow existing table format).
- Report: item shipped, next top item named.

**Guard:** partial ship (some sub-features deferred) → keep the row `in-progress`, move deferred sub-features into a new icebox row or note under the item — don't fake `shipped`.

## Resume rules

| Found status | Resume at |
|---|---|
| `icebox` | Step 3 (spec) |
| `specced` | Step 4 (plan) |
| `planned` | Step 5 (build) |
| `in-progress` | Inspect tasks/commits → resume mid-build, don't redo spec |

## Anti-patterns

| Don't | Why |
|---|---|
| Skip spec and build straight from the Pain line | Pain is a seed, not requirements — elicitation exists for this |
| Pick multiple items at once | Queue is single-sequence; parallelism is inside the plan, not the backlog |
| Reorder rows mid-build | Breaks the pick contract; reorder only at wave boundaries |
| Mark shipped without all gates green | Fake completion; the next audit finds it |
| Rename a slug after spec exists | Breaks intent/spec file links |
| Silently drop a blocked item | Keep it in-progress, tell the user what's blocking |

## Verification

- [ ] Picked item = lowest unblocked `icebox` (or user-named, deps verified)
- [ ] Status transitions logged in the backlog at each stage
- [ ] Spec exists at `docs/specs/<slug>.md` and passed review
- [ ] All gates green before commit
- [ ] `shipped` only when everything in scope landed; partial → deferred sub-features tracked
- [ ] Wiki changelog + commit done

## Router boomerang

Need new ideas? → `/idea-grab`. Spec exists but unclear? → `/spec-review-stakeholder`. Build broke? → `/debugging-and-error-recovery`.
