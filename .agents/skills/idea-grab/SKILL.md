---
name: idea-grab
description: Market + internal-gap research cycle that proposes new features and inserts user-picked ones into docs/ideas/product-backlog.md. Use when asked to find/grab feature ideas, run a market scan, or refresh the backlog. Not for picking or building an existing backlog item (→ idea-pick-off).
---

# Idea Grab — Research → Present → Insert

## Overview

`idea-grab` is the **intake half** of the product pipeline. It scans what competitors ship and what the system still lacks, scores candidates against the backlog contract, presents them to the human, and inserts *only the chosen ones* into `docs/ideas/product-backlog.md` — sorted into the single ordered queue.

```
internal scan → market scan (/inquiry-creativity) → score+dedup
  → present → HUMAN PICKS → insert + commit
```

The human picks. The skill never self-approves candidates into the backlog.

## When to Use

- User asks to research the market / find feature ideas / "grab ideas"
- Backlog needs refreshing after a wave ships
- A competitor release or community thread might contain stealable features

## When NOT to Use

- Item already in backlog → `idea-pick-off` to build it
- User described a concrete pain they want built → `pipeline-analyze` directly
- Bug or debt fix → `audit-technical-debt` / `debugging-and-error-recovery`

## Source policy

Every candidate answered from **both**:
1. **Codebase** — `docs/ideas/product-backlog.md` (SSOT of what exists/planned), `docs/0-wiki.md` changelog (what shipped), `docs/audits/` (what's weak), `src/features/` dirs (what infra is leverageable).
2. **Internet** — via `/inquiry-creativity`: competitor changelogs, Chrome Web Store listings, GitHub issues/roadmaps of similar OSS, r/languagelearning threads. SIFT-rank sources; cite URL per candidate.

## Steps

### Step 1 — Internal scan (always first)

**Purpose:** know what the system already has/plans before looking outside.

**Actions:**
- Read `docs/ideas/product-backlog.md` fully — collect every existing `Slug` + `Nhóm`.
- Skim last ~10 `docs/0-wiki.md` changelog lines — what shipped recently.
- Grep `src/features/` dir names — the capability inventory.

**Guard:** if backlog file missing/corrupt → stop, tell user, don't recreate silently.

### Step 2 — Market scan (invoke `/inquiry-creativity`)

**Purpose:** diverge — gather candidate features the market has and we lack.

**Actions:**
- Invoke `/inquiry-creativity` with topic = "features <competitor/domain> ships that Tihoka lacks".
- Cover: direct competitors (asbplayer, Migaku, Language Reactor, Lingopie, Yomitan, Kimi…) + adjacent (readers, SRS apps).
- Also surface **internal gaps** — features half-built in `src/` that market products complete (e.g. data exists, UI missing).

**Guard:** every candidate must cite ≥1 source URL or codebase path. Memory-only claims are rejected.

### Step 3 — Score & dedup

**Purpose:** converge — rank candidates by fit, kill duplicates.

**Actions:** per candidate fill the backlog schema fields:
- `Slug` (new kebab-case, not colliding with existing)
- `Pain` — 1-sentence user pain, not a feature description
- `Cost` S/M/L/XL — estimate from infra leverage: full infra → S/M; new subsystem → L+
- `Value` ★1–5
- `Infra` — what it reuses (grep to confirm it exists)
- `Deps` — backlog item `#`s that must ship first, else `—`
- `Source` — competitor name(s)

**Dedup rules:**
- Same capability as an existing backlog row → merge as note, don't add
- Conflicts with AGENTS.md rules (new deps without justification, layer violations, non-local-first) → reject with reason
- Unclear pain (feature for feature's sake) → reject

**Guard:** 0 candidates surviving → report "nothing new worth grabbing" and stop — don't pad.

### Step 4 — Present → human picks

**Purpose:** the human selects; the skill never self-approves.

**Actions:**
- Present a table: candidate, pain, cost, value, infra, source, pros/cons.
- Use `ask_user_question` (multi-select) or free text — whichever fits count.
- User may edit/rename/re-prioritize at this point — capture it.

**Guard:** user picks nothing → log why, stop, backlog unchanged.

### Step 5 — Insert + commit

**Actions:**
- Insert each picked candidate as a new row at the position matching its cost/value ordering (queue stays cheap→expensive, value tiebreak).
- `Status: icebox`, `Spec: —`. Renumber `#`s.
- If the insert changes wave grouping materially, note it in the wave table.
- Update `docs/0-wiki.md` changelog line. Commit: `docs(backlog): grab <n> candidates — <names>`.

**Guard:** never touch `Status`/`Spec` of existing rows; never reorder during an in-flight build.

## Output

```markdown
## Idea Grab — <date>
- Scanned: <n sources> · Candidates: <n> → survived dedup: <m>
- Picked by user: <list>
- Inserted at rows: <#..#>
- Rejected: <name — reason>
```

## Anti-patterns

| Don't | Why |
|---|---|
| Skip Step 1 and scan the market first | Proposes duplicates of shipped/planned work |
| Insert without user pick | Backlog is human-prioritized, not agent-prioritized |
| Add candidate without Pain | Empty pain = unbuildable spec seed downstream |
| Reorder shipped/icebox rows while an item is in-progress | Mid-build reorder breaks the pick contract |
| Write specs here | Grab produces backlog rows, not specs — specs are `idea-pick-off`/`pipeline-analyze` |

## Verification

- [ ] Backlog read fully before scanning
- [ ] Every presented candidate has source + pain + cost + value + infra
- [ ] Duplicates rejected, not duplicated
- [ ] Only user-picked items inserted
- [ ] Queue still sorted cost-asc, value tiebreak; `#` renumbered
- [ ] `docs/0-wiki.md` changelog updated; committed

## Router boomerang

Picked an item to build now? → `/idea-pick-off`. Pain known already? → `/pipeline-analyze`. Direction unclear? → `/pipeline-analyze`.
