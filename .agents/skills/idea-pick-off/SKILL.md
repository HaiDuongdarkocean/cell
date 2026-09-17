---
name: idea-pick-off
description: Pops the top unblocked item from docs/ideas/product-backlog.md and runs it through the spec→plan→build→ship pipeline. `all` mode loops the pipeline across every unblocked item until the backlog is drained. Use when asked to start the next backlog feature, "làm item #N", "làm hết backlog", or continue the roadmap. Not for adding new ideas (→ idea-grab) or fixing bugs (→ debugging-and-error-recovery).
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

One item per run by default. `/idea-pick-off all` runs the whole queue — see **Loop mode** below. The queue order is the contract — never reorder mid-build.

## When to Use

- "Làm item tiếp theo", "pick next idea", "làm #N", "continue roadmap"
- "làm hết backlog", "idea-pick-off all", "run the whole queue" → Loop mode
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

## Loop mode (`/idea-pick-off all`)

Runs Steps 1–6 per item, then immediately re-enters Step 1 for the next item, until the queue is drained or a stop condition hits.

```
loop:
  pick top unblocked icebox → spec → plan → build → ship → commit
  → tree clean? → next item
until: no icebox left · every remaining item blocked · stop condition
```

**Rules specific to `all` — HARD RULES, no exceptions:**

- **ZERO QUESTIONS, start to finish.** In `all` mode the agent MUST NOT ask the user anything — no interview rounds, no frame confirmation, no "should I proceed" checks. The 8-field frame is inferred from `Pain`/`Infra`/`Source` + codebase evidence, assumptions documented in the intent doc, and spec-review-stakeholder is the only gate. If a decision is genuinely needed, pick the conservative option, record it as an accepted risk in the spec, and move on. Asking the user mid-loop is a contract violation — the loop is autonomous by definition.
- **Autonomous elicitation.** This is the only case where elicitation skips the user entirely: no observation round, no interview, no explicit "yes". The confirmed frame = inferred frame + spec-review pass.
- **No mid-loop questions.** Not even for a repeating hard stop condition — stop the loop and report instead of asking. A single blocked item never pauses the loop.
- **Blocked item → skip, not stall.** Item blocked by unshipped deps or spec rejected 3 rounds → mark `Status: in-progress` + one-line blocking note in the Spec cell, move to the next unblocked item, list it in the final report.
- **Gate red that survives a real fix attempt** → stop the whole loop and report — the tree must never accumulate unverified work.
- **Item isolation.** Each item still gets its own commits grouped by subsystem; tree must be clean before claiming the next item. If the session convention is worktree-per-item, create/merge/remove one per item.
- **Never reorder.** Loop consumes the queue top-down; skipped items keep their position and stay `in-progress` with a note.
- **Stop conditions** (any → stop, report): backlog drained · every remaining item blocked · a gate that can't be fixed · 3 consecutive items skipped · user interrupt.

**Loop report (end of run):**

```markdown
## Pick-off all — <date>
- Shipped: <slug ×N with commit hashes>
- Skipped/blocked: <slug — reason>
- Stopped because: <drained | all blocked | gate red | interrupt>
- Next top item: <slug or "backlog empty — /idea-grab">
```

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
| Pick multiple items at once | Queue is single-sequence; `all` mode is sequential items, not parallel — parallelism is inside the plan, not the backlog |
| Interview the user mid-loop in `all` mode | The loop is autonomous — infer the frame, let spec-review gate it; asking blocks the pipeline |
| Fake-skip a failing item as `dropped`/`shipped` to keep the loop moving | Skipped = `in-progress` + blocking note; only the user vetoes |
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
- [ ] `all` mode: loop report produced, skipped items carry blocking notes, tree clean at exit

## Router boomerang

Need new ideas? → `/idea-grab`. Spec exists but unclear? → `/spec-review-stakeholder`. Build broke? → `/debugging-and-error-recovery`.
