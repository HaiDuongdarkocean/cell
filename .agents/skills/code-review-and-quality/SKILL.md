---
name: code-review-and-quality
description: Multi-axis code review before merge. Use when reviewing any change - yours, an agent's, or a human's.
---

# Code Review and Quality

## Overview

Multi-dimensional review with quality gates — every change is reviewed before merge, no exceptions. Five axes: **correctness, readability, architecture, security, performance.**

**Approval standard:** approve when the change definitely improves overall code health, even if imperfect. Don't block because it isn't how you'd have written it.

## When to Use

Before any merge; after completing a feature or bug fix (review fix + regression test); when evaluating code from another agent/model; when refactoring.

## Review process

```text
1. Context → 2. Tests first → 3. Five-axis walkthrough → 4. Categorize findings → 5. Verify the verification
```

1. **Context** — what is this change trying to accomplish? Which spec/task? Expected behavior change?
2. **Tests first** — they reveal intent: do tests exist, test behavior not implementation, cover edge cases, have descriptive names, would catch a regression?
3. **Five-axis walkthrough** per file: correctness (does it do what tests say? edge cases? error paths? races?) · readability (understandable without the author? names? could it be shorter? abstractions earning complexity? dead code? conditionals bolted onto unrelated flows?) · architecture (fits existing patterns? boundaries? duplication? does the refactor *reduce* complexity or relocate it? feature logic leaking into shared modules? type boundaries explicit?) · security (input validated? secrets out? parameterized queries? output encoded? external data untrusted? → `security-and-hardening`) · performance (N+1? unbounded loops/fetches? unnecessary re-renders? → `performance-optimization`).
4. **Categorize findings** — label every comment:
   - *(no prefix)* = required before merge · **Critical:** = blocks merge (security, data loss, broken functionality)
   - **Nit:** = ignorable · **Optional:/Consider:** = suggestion · **FYI** = context only
5. **Verify the verification** — what tests ran, did build pass, manual testing done, screenshots for UI, before/after?

**Lead with leverage:** correctness and security first, then structural regressions — a few high-conviction comments beat a long nit list. One structural problem + ten nits = the structural problem *is* the review.

## Structural remedies

Flag a structural problem → propose the move, not just the problem: typed model/dispatcher for conditional chains; collapse duplicate branches; separate orchestration from business logic; move feature logic to its owning module; reuse the canonical helper; make the type boundary explicit; delete pass-through wrappers; extract helpers or split the file. Prefer the remedy that removes moving pieces over one that spreads complexity.

## Change sizing

```text
~100 lines changed → good. ~300 → acceptable if single logical change. ~1000 → split it.
```

- **Watch total file size too** — ~1000 total lines is a signal to decompose *before* adding more.
- **"One change"** = one self-contained modification + related tests + system stays functional. Refactor and feature work are two changes — submit separately.
- **Splitting:** stack (sequential deps) · by file group (cross-cutting) · horizontal (shared stubs first) · vertical (thin full-stack slices). Deletions and automated refactors may be large.

## Hard policies

- **Descriptions stand alone in history:** imperative first line ("Delete the FizzBuzz RPC"), body carries context + reasoning + links. No "Fix bug"/"Phase 1"/"Moving code from A to B".
- **No rubber-stamping:** no LGTM without evidence; quantify problems ("~50ms per item"); push back on flawed approaches; accept override gracefully — comment on code, not people.
- **"I'll clean it up later" is not accepted** — cleanup before merge or file a self-assigned bug.
- **Dead code:** list orphaned code explicitly, ask before deleting.
- **Multi-model review** catches blind spots: Model A writes → Model B reviews → A addresses → human decides. For Cell pipelines, use a fresh-context `subagent_explore` as Model B (see `autonomous-pipeline` Phase 3).
- **Dependencies are liabilities:** existing stack first; check bundle size, maintenance, `npm audit`, license. Upgrades: one per change, read the changelog not just the version, green suite before+after, review the lockfile diff, never hand-edit it. Security verdicts → `security-and-hardening`.
- **Disagreement hierarchy:** technical facts > style guides > engineering principles > codebase consistency (if it doesn't degrade health).

→ Full axis checklists, dead-code template, review-speed norms, detailed disagreement/honesty guidance, full review checklist: `references/review-detail.md`

## Red flags

- Merged without review; review that only checks tests; LGTM without evidence
- Security-sensitive change without security review; large PR "too big to review" → split
- No regression test with a bug fix; unlabeled findings; accepting "fix later"
- Refactor that relocates complexity instead of removing branches; bespoke helper duplicating a canonical one; feature logic in shared modules
- Bulk "bump deps" without changelog review; hand-edited or unreviewed lockfile diff

## Verification

- [ ] All Critical + Required findings resolved or explicitly deferred with justification
- [ ] Tests pass; build succeeds; verification story documented
- [ ] Dependency upgrades: changelog read, one-per-change, lockfile diff reviewed

## Router boomerang

Task đổi hoặc không rõ skill nào phù hợp? Invoke /using-agent-skills để re-route. Router protocol trong AGENTS.md (always-on).
