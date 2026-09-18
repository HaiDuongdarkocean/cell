---
name: using-agent-skills
description: Meta-router that picks the right skill for a task. Use at session start or whenever the task changes.
---

# Using Agent Skills

## Overview

Agent Skills is a collection of engineering workflow skills organized by development phase. Each skill encodes a specific process that senior engineers follow. This meta-skill helps you discover and apply the right skill for your current task.

## Router Protocol (Cell-specific)

Skill này là **router** — entry point duy nhất để chọn skill:

- **Khi task đổi** (nhận task mới, chuyển pha SDLC, gặp vấn đề mới): invoke lại `/using-agent-skills` để re-route.
- **Khi không rõ skill nào**: invoke `/using-agent-skills` — không đoán.

## Skill Discovery

Routing is **two-layer**: first the task type, then (for feature work) the pipeline stage.

> **Knowledge hook (automatic):** Before routing to any Build/Verify/Review skill, if a `learning-and-apply` skill exists in `.agents/skills/`, grep its `index.json` by the task's domain keywords (css, async, messaging, state, data, detection, ux, build, testing, rendering). Open every matching `experience/<id>.json` or `knowledge/<topic>.json` and check `cases[].bad` against the code you are about to write. If your code matches a bad pattern, apply `cases[].good` before proceeding. This is not optional — known patterns must be checked before new code is written, not after a bug surfaces.

### Layer 1 — Task type

```
Task arrives
    │
    ├── Feature / backlog item / vague idea? ──→ LAYER 2 (pipeline stage) below
    │     └── From the backlog queue? ─────────→ idea-pick-off (driver, owns the loop)
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    │   └── Root cause found + fix verified? → learning-and-apply (ACCUMULATE)
    ├── Audit or assess technical debt? ─→ audit-technical-debt
    │   └── Need to plan remediation? ──→ planning-and-task-breakdown
    ├── Audit UI/UX before redesign? ──→ audit-ui-ux-then-redesign
    ├── Reviewing code? ───────────────→ code-review-and-quality
    │   ├── Too complex? ─────────────→ code-simplification
    │   ├── Security concerns? ───────→ security-and-hardening
    │   └── Performance concerns? ────→ performance-optimization
    ├── Reviewing UI text? ────────────→ audit-text-in-ui
    ├── Reviewing motion? ────────────→ review-animations / improve-animations / find-animation-opportunities
    ├── Writing/running tests? ────────→ test-driven-development
    │   └── Browser-based? ───────────→ testing-with-playwright
    │       ├── Interactive/stealth session? → testing-extension-browser
    │       └── Model can't see images? → vision-reader
    ├── Research / new ideas for backlog? → idea-grab / inquiry-creativity / subtitle-player-research
    ├── Committing/branching? ─────────→ git-workflow-and-versioning
    ├── CI/CD pipeline work? ──────────→ ci-cd-and-automation
    ├── Deprecating/migrating? ────────→ deprecation-and-migration
    ├── Writing docs/ADRs? ───────────→ documentation-and-adrs
    ├── Writing a skill? ─────────────→ write-skill
    ├── Adding logs/metrics/alerts? ───→ observability-and-instrumentation
    └── Deploying/launching? ─────────→ shipping-and-launch
```

### Layer 2 — Pipeline stage (feature work)

Check `tasks/pipeline-state.json` (`node scripts/pipeline-state.mjs get <slug>`) — the `stage` field is the truth; route to the stage skill, not to the absorbed legacy names:

```
item stage          → skill               → produces
──────────────────────────────────────────────────────────────
(new / analyze)     → pipeline-analyze    → docs/intent/<slug>.md + ## Decision
                      (interactive: interview rounds; all: self-interrogation)
specify             → pipeline-specify    → docs/specs/<slug>.md + spec review
design (uiSurface=yes) → pipeline-design  → concepts + mockup + brief + mapping
deliver             → pipeline-deliver    → plan → build → gates → verify → ship
shipped / dropped   → terminal — pick next item via idea-pick-off
```

Inside DELIVER the supporting skills apply unchanged: `planning-and-task-breakdown`, `incremental-implementation`, `test-driven-development`, `context-engineering`, `source-driven-development`, `learning-and-apply`, `design-system-guardian`, `doubt-driven-development`, `pre-commit-gate`, `code-review-and-quality`, `git-workflow-and-versioning`, `documentation-and-adrs`, `shipping-and-launch`. The build engine for M+ parallel work is `autonomous-pipeline` — invoked **from** `pipeline-deliver`, never directly for backlog items.

**Legacy names still resolve as stubs:** `elicitation`/`interview-me`/`idea-refine` → `pipeline-analyze`; `spec-driven-development`/`spec-review-stakeholder` → `pipeline-specify`; `idea-to-interface` → `pipeline-design`.

## Core Operating Behaviors

These behaviors apply at all times, across all skills. They are non-negotiable.

### 1. Surface Assumptions

Before implementing anything non-trivial, explicitly state your assumptions:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. The most common failure mode is making wrong assumptions and running with them unchecked. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Do not proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution before continuing.

**Bad:** Silently picking one interpretation and hoping it's right.
**Good:** "I see X in the spec but Y in the existing code. Which takes precedence?"

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Sycophancy is a failure mode. "Of course!" followed by implementing a bad idea helps no one. Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity

Your natural tendency is to overcomplicate. Actively resist it.

Before finishing any implementation, ask:
- Can this be done in fewer lines?
- Are these abstractions earning their complexity?
- Would a staff engineer look at this and say "why didn't you just..."?

If you build 1000 lines and 100 would suffice, you have failed. Prefer the boring, obvious solution. Cleverness is expensive.

### 5. Maintain Scope Discipline

Touch only what you're asked to touch.

Do NOT:
- Remove comments you don't understand
- "Clean up" code orthogonal to the task
- Refactor adjacent systems as a side effect
- Delete code that seems unused without explicit approval
- Add features not in the spec because they "seem useful"

Your job is surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume

Every skill includes a verification step. A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data).

Per-skill verification is the local check. The project-wide bar that applies to *every* change, regardless of which skill is active, is the Definition of Done: tests pass, no regressions, behavior verified at runtime, docs updated. See `docs/knowledge-base/agentic-sdlc.md` § Deterministic gates. It complements each task's acceptance criteria rather than replacing them.

## Failure Modes to Avoid

These are the subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking
2. Not managing your own confusion — plowing ahead when lost
3. Not surfacing inconsistencies you notice
4. Not presenting tradeoffs on non-obvious decisions
5. Being sycophantic ("Of course!") to approaches with clear problems
6. Overcomplicating code and APIs
7. Modifying code or comments orthogonal to the task
8. Removing things you don't fully understand
9. Building without a spec because "it's obvious"
10. Skipping verification because "it looks right"

## Skill Rules

1. **Check for an applicable skill before starting work.** Skills encode processes that prevent common mistakes.

2. **Skills are workflows, not suggestions.** Follow the steps in order. Don't skip verification steps.

3. **Multiple skills can apply.** A backlog feature runs the stage chain `pipeline-analyze` → `pipeline-specify` → (`pipeline-design`) → `pipeline-deliver`, with supporting skills nested inside DELIVER.

4. **When in doubt, start with ANALYZE.** If the task is non-trivial and there's no confirmed intent, begin with `pipeline-analyze` — jumping to code from a raw ask is the classic failure this pipeline exists to prevent.

## Lifecycle Sequence

For paying down technical debt, the typical skill sequence is:

```
1.  audit-technical-debt         → Score and rank debt items
2.  planning-and-task-breakdown  → Turn inventory into island/slice tasks
3.  test-driven-development      → Write characterization/contract tests
4.  incremental-implementation   → Strangler Fig / Branch by Abstraction slices
5.  pre-commit-gate              → Lint, typecheck, test, build, debt smell
6.  code-simplification          → Clean up after each slice
7.  git-workflow-and-versioning  → Atomic debt payback commits
8.  documentation-and-adrs       → Debt Payback ADR / update audit RUNBOOK
```

For a complete feature, the stage sequence is:

```
ANALYZE   pipeline-analyze           → intent doc (needs/journey/scope/decision) or early drop
SPECIFY   pipeline-specify           → spec + spec-reviewer verdict
DESIGN    pipeline-design            → (uiSurface=yes) concepts → mockup → brief → mapping → approval/vision
DELIVER   pipeline-deliver           → owns the rest:
            planning-and-task-breakdown → verifiable chunks
            context-engineering / source-driven-development → right context, doc-verified
            learning-and-apply (APPLY) → grep index.json, check bad patterns before coding
            incremental-implementation + test-driven-development → slices
            autonomous-pipeline (engine, M+ lanes) → parallel build + fresh-context verify
            observability-and-instrumentation → instrument as you build
            doubt-driven-development → cross-examine non-trivial decisions in-flight
            design-system-guardian → UI audit vs DESIGN.md
            pre-commit-gate → deterministic local checks
            code-review-and-quality + code-simplification → review
            git-workflow-and-versioning → clean history
            documentation-and-adrs → document the why
            shipping-and-launch → deploy + business sign-off
```

Not every task needs every skill. A bug fix might only need: `debugging-and-error-recovery` → `test-driven-development` → `learning-and-apply (ACCUMULATE)` → `code-review-and-quality`.

## Quick Reference

| Phase | Skill | One-Line Summary |
|-------|-------|-----------------|
| Pipeline | idea-pick-off | Driver: pop backlog top → route qua stages → loop `all` mode |
| ANALYZE | pipeline-analyze | BA (BACCM, stakeholders, root-cause, go/no-go, FURPS+, stories, journey, logic) → intent doc |
| SPECIFY | pipeline-specify | Intent → use-case requirements → flows/states → function/feature → spec + review gate |
| DESIGN | pipeline-design | (uiSurface=yes) 3 concepts → mockup → brief → mapping → approval/vision verdict |
| DELIVER | pipeline-deliver | Stage contract: plan → build → gates → verify → ship (engine = autonomous-pipeline) |
| Legacy | elicitation / interview-me / idea-refine | Stubs → `pipeline-analyze` |
| Legacy | spec-driven-development / spec-review-stakeholder | Stubs → `pipeline-specify` |
| Legacy | idea-to-interface | Stub → `pipeline-design` |
| Plan | audit-technical-debt | Score and prioritize technical debt with a remediation roadmap |
| Plan | planning-and-task-breakdown | Decompose into small, verifiable tasks (priority + parallel + blocked_strategy fields) |
| Plan→Ship | autonomous-pipeline | Engine invoked from `pipeline-deliver`: parallel subagent lanes → fresh-context verify → ship |
| Build | learning-and-apply (APPLY) | Grep knowledge index.json, check bad patterns before coding |
| Build | incremental-implementation | Thin vertical slices, test each before expanding |
| Build | source-driven-development | Verify against official docs before implementing |
| Build | doubt-driven-development | Adversarial fresh-context review of every non-trivial decision |
| Build | context-engineering | Right context at the right time |
| Verify | design-system-guardian | Audit UI against DESIGN.md (token, component, layout) |
| Verify | test-driven-development | Failing test first, then make it pass |
| Verify | pre-commit-gate | Deterministic local checks (lint, typecheck, test, build, debt smell) before commit |
| Verify | testing-with-playwright | Playwright E2E — fixtures + actors + stage2 specs, Cell + uBOLite loaded in Chromium |
| Verify | testing-extension-browser | Interactive real-Chrome Playwright session (packed .crx + clone profile) cho ad-hoc verify |
| Verify | vision-reader | Delegate image reading to a vision subagent when the coding model is blind |
| Verify | debugging-and-error-recovery | Reproduce → localize → fix → guard |
| Verify | learning-and-apply (ACCUMULATE) | Extract reusable principle to atom JSON after test pass + root cause understood |
| Review | code-review-and-quality | Five-axis review with quality gates |
| Review | code-simplification | Preserve behavior while reducing unnecessary complexity |
| Review | security-and-hardening | OWASP prevention, input validation, least privilege |
| Review | performance-optimization | Measure first, optimize only what matters |
| Ship | git-workflow-and-versioning | Atomic commits, clean history |
| Ship | ci-cd-and-automation | Automated quality gates on every change |
| Ship | deprecation-and-migration | Remove old systems and migrate users safely |
| Ship | documentation-and-adrs | Document the why, not just the what |
| Ship | observability-and-instrumentation | Structured logs, RED metrics, traces, symptom-based alerts |
| Ship | shipping-and-launch | Pre-launch checklist, monitoring, rollback plan |
