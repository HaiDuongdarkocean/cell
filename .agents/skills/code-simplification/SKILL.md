---
name: code-simplification
description: Reduce unnecessary complexity while preserving behavior. Use after implementation when code is harder to read than needed.
---

# Code Simplification

## Overview

Reduce complexity while preserving exact behavior. The goal is not fewer lines — it's code easier to read, understand, modify, and debug. The test: "Would a new team member understand this faster than the original?"

## When to Use

- After a feature works and tests pass but the implementation feels heavy
- During review when readability/complexity is flagged
- Deeply nested logic, long functions, unclear names; scattered duplication
- Code written under time pressure

**When NOT:** already clean; you don't understand what it does yet; performance-critical and "simpler" is measurably slower; the module is about to be rewritten entirely.

## Five principles

1. **Preserve behavior exactly** — same outputs, error behavior, side effects, ordering, edge cases; all tests pass unmodified. Not sure? Don't make the change.
2. **Follow project conventions** — match neighboring code's imports, function style, naming, error handling, type depth (AGENTS.md is the convention source). Simplification that breaks consistency is churn.
3. **Clarity over cleverness** — explicit beats compact when compact requires a mental pause.
4. **Maintain balance** — over-simplification traps: inlining a helper that named a concept; merging two simple functions into one complex one; removing abstractions that exist for extensibility/testability; optimizing for line count.
5. **Scope to what changed** — no drive-by refactors of unrelated code; unscoped simplification creates noisy diffs and regression risk.

## Process

1. **Chesterton's Fence first** — understand why the code exists before touching it: responsibility, callers/callees, edge cases, tests that define behavior, git blame for original context. Can't answer → read more, don't simplify.
2. **Scan for concrete signals** (table below).
3. **One simplification at a time → run tests → pass: continue; fail: revert.** Refactor PRs ship separately from feature/fix PRs.
4. **Step back:** genuinely easier to understand? New inconsistent patterns? Clean reviewable diff? If "simplified" is harder to review, revert.

**Rule of 500:** a refactor touching >500 lines → automate it (codemods, AST transforms), don't hand-edit.

## Simplification signals

| Pattern | Simplification |
|---|---|
| Deep nesting (3+ levels) | Guard clauses or extracted helpers |
| Long functions (50+ lines) | Split into focused named functions |
| Nested ternaries | if/else, switch, or lookup object |
| Boolean flag params `doThing(true,false)` | Options object or separate functions |
| Same `if` check repeated | Well-named predicate |
| Generic names (`data`, `result`, `temp`) | Describe content: `userProfile`, `validationErrors` |
| Cryptic abbreviations (`usr`, `cfg`) | Full words (universal ones OK: `id`, `url`) |
| Misleading names (`get` that mutates) | Rename to actual behavior |
| Comment narrating the "what" | Delete — code is clear; keep comments that carry "why" |
| Duplicated logic (5+ lines) | Shared function |
| Dead code, unreachable branches | Remove after confirming dead |
| Value-less wrapper / factory-for-factory / strategy-of-one | Inline / direct approach |
| Redundant type assertion | Remove |

→ Before/after examples (TS/React), prop-drilling note: `references/examples.md`

## Preparatory refactoring & large files (500+ lines)

Adding behavior to a big file? Clean the seam first:

1. Find where the new feature connects; extract surrounding logic into a small named, testable function/hook.
2. Write a characterization test for the extracted behavior (`test-driven-development`).
3. Add the feature on the cleaned seam.

**Splitting a >500-line file:** identify a domain boundary (state/rendering/API/IO) → extract into its own module → update imports/re-exports → delete the old inline code only after the new module is wired and tested. Each split leaves the system buildable and behavior-identical; can't extract without changing callers → Branch by Abstraction (`incremental-implementation`).

Anti-pattern: "it's already big, +20 lines won't hurt" — every added line makes the next change harder.

## Rationalizations / red flags

- "It's working, don't touch it" → hard-to-read code is hard to fix later · "fewer lines = simpler" → comprehension speed is the metric
- "types make it self-documenting" → types say what, names say why · "abstraction might be useful later" → remove speculative abstractions
- "the original author had a reason" → check git blame; often it's just residue of pressure
- Red flags: tests modified to pass; "simplified" is longer/harder; renames to personal taste; error handling removed "for cleanliness"; simplifying code you don't understand; batched unreviewable commits; adding behavior to a 500+ line file without a seam

## Verification

- [ ] All tests pass unmodified; build clean; lint passes
- [ ] Each simplification is an incremental reviewable change; no unrelated diff noise
- [ ] Follows project conventions; no error handling weakened; no dead code left

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
