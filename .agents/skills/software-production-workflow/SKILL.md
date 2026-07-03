---
name: software-production-workflow
description: 8-phase software production process (0-7). Use when starting any feature/bugfix/refactor to identify which phase you are in and which skills to invoke. Encodes the full lifecycle from discovery to maintenance with file ops, verify steps, and skill activation per phase.
---

# Software Production Workflow

> **Principle**: Reference spec, don't trust memory. Verify with `ls`, don't trust docs.
> **Entry point**: AGENTS.md → this skill → `docs/0-wiki.md` → reference chain.
> **Source**: `docs/reference/software-production-process-research.md` (synthesis of 30 sources: Google, Microsoft, Amazon, Scrum, DevOps).
> 8 phases (0-7). Each phase: skill activation → input/output docs → file ops → verify.

- Project is spec-driven, so docs must be updated frequently. Reference agents.md, ponytail.md, and baseline.md. Follow the process by identifying your current phase. Read and follow the listed work (invoke skill). Critically important — never skip reading, writing, updating, reviewing docs and commits.

## Phase Flow (Decision Tree)

```
Task arrives
    │
    ├── Don't know what user wants? ────────→ G0 (interview-me + idea-refine)
    │   └── Feasibility go/no-go LIGHTWEIGHT → YES (skip) → STOP
    │                                   → NO → G0.5 (if UI feature) / G1 (if no UI)
    ├── Have intent, UI feature? ──────────→ G0.5 (design-driven-development — mockup before spec)
    │   └── design-system.md stale? ───────→ design-system-audit (refresh living doc first)
    ├── Have intent, need requirements? ───→ G1 (spec-driven-development — cite mockup if G0.5 ran)
    ├── Have spec, need approach? ─────────→ G2 (planning-and-task-breakdown high-level)
    ├── Have plan, need architecture? ──────→ G3 (system-architecture-design + ADR)
    │   ├── UI work? ───────────────────────→ ADR records UI decision (WHAT + WHY), implementation detail (DOM/state/mockup) lives in G4 task list
    │   └── Module boundaries? ─────────────→ api-and-interface-design
    ├── Have ADR, need code? ──────────────→ G4 (TDD + incremental-implementation)
    │   ├── Context degrading? ────────────→ context-engineering
    │   ├── Browser-facing code? ──────────→ extension-browser-debugging (stop-the-line)
    │   └── Code too complex after impl? ──→ code-simplification
    ├── Code done, need verify? ───────────→ G5 (test-driven-development + code-review-and-quality)
    │   ├── Security concerns? ────────────→ security-and-hardening
    │   ├── Performance concerns? ─────────→ performance-optimization
    │   └── Browser-facing? ───────────────→ extension-browser-debugging
    ├── Verified, need release? ───────────→ G6 (shipping-and-launch)
    └── Production issue / bug? ───────────→ G7 (debugging-and-error-recovery)
```

## Core Operating Behaviors (Always-On)

These behaviors apply across all phases, all skills. Non-negotiable. Ponytail ladder (G4) is the concrete implementation of behaviors #4-#5.

### 1. Surface Assumptions

Before implementing anything non-trivial, state assumptions explicitly:

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about architecture]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

Don't silently fill in ambiguous requirements. Surface uncertainty early — it's cheaper than rework.

### 2. Manage Confusion Actively

When you encounter inconsistencies, conflicting requirements, or unclear specifications:

1. **STOP.** Don't proceed with a guess.
2. Name the specific confusion.
3. Present the tradeoff or ask the clarifying question.
4. Wait for resolution before continuing.

**Bad**: Silently picking one interpretation and hoping it's right.
**Good**: "I see X in spec but Y in existing code. Which takes precedence?"

### 3. Push Back When Warranted

You are not a yes-machine. When an approach has clear problems:

- Point out the issue directly
- Explain the concrete downside (quantify when possible — "this adds ~200ms latency" not "this might be slower")
- Propose an alternative
- Accept the human's decision if they override with full information

Honest technical disagreement is more valuable than false agreement.

### 4. Enforce Simplicity (principle — ponytail G4 is the implementation)

Resist overcomplication. Before finishing: "Can this be fewer lines? Are abstractions earning their complexity? Would a staff engineer say 'why didn't you just...'?". Prefer the boring, obvious solution.

### 5. Maintain Scope Discipline (principle — ponytail G4 is the implementation)

Touch only what you're asked to touch. Don't remove comments you don't understand, don't "clean up" orthogonal code, don't refactor adjacent systems, don't delete code that seems unused without approval, don't add features not in the spec. Surgical precision, not unsolicited renovation.

### 6. Verify, Don't Assume (principle — Pre-Commit G4 is the implementation)

A task is not complete until verification passes. "Seems right" is never sufficient — there must be evidence (passing tests, build output, runtime data, `ls` confirm).

## Failure Modes to Avoid

Mirror of Core Behaviors — same concept from the negative angle. Subtle errors that look like productivity but create problems:

1. Making wrong assumptions without checking (violates Behavior #1)
2. Plowing ahead when lost, not managing confusion (violates #2)
3. Not surfacing inconsistencies you notice (violates #2)
4. Being sycophantic ("Of course!") to approaches with clear problems (violates #3)
5. Overcomplicating code and APIs (violates #4)
6. Modifying code/comments orthogonal to the task (violates #5)
7. Removing things you don't fully understand (violates #5)
8. Building without a spec because "it's obvious" (violates #5)
9. Skipping verification because "it looks right" (violates #6)
10. Skipping docs update / commits (violates project rule: spec-driven)

## File Placement Convention

All feature docs must follow the format `<prefix>-<name>.md` with prefix ∈ {`idea`, `intent`, `spec`, `plan`, `task`}. ADR keeps its own format `NNN-<name>.md`. **NEVER store loose files in `docs/` root** — every doc has a designated folder.

| Type | Prefix | Folder | Phase | Question answered |
|---|---|---|---|---|
| idea | `idea-` | `docs/intent/` | G0 (idea-refine) | Raw idea, not yet interviewed |
| intent | `intent-` | `docs/intent/` | G0 (interview-me) | Confirmed intent (interviewed) + lightweight feasibility go/no-go |
| spec | `spec-` | `docs/specs/` | G1 (PRD/SRS) | What to build? F/NF/A criteria |
| plan | `plan-` | `docs/plan/` | G2 (implementation plan) | HOW (high-level)? Approach, scope, risk mitigation, milestones — cite spec |
| task | `task-` | `docs/task/` | G4 start (task breakdown) | How to build, step by step? |
| ADR | `NNN-` | `docs/adr/` | G3 (architecture) | Architecture decision + alternatives |
| knowledge | — | `docs/knowledge/` | G4 (Pre-Commit) + G7 | Reusable principles + case studies (2-layer) |
| reference | — | `docs/reference/` | any | Reference material (research, synthesis, external docs) |
| reviews | — | `docs/reviews/` | any | Architecture/code review reports |

> **Mandatory order**: `intent` → `spec` → `plan` → `adr` → `task`. **Output of spec is input of plan** — plan must cite spec (each approach/risk/scope item maps to a requirement in spec). NEVER write plan before spec (plan without root = arbitrary opinion).

**Example** for feature "bilingual-subtitle-auto-load":
- `docs/intent/intent-bilingual-subtitle-auto-load.md` (G0)
- `docs/specs/spec-bilingual-subtitle-auto-load.md` (G1)
- `docs/plan/plan-bilingual-subtitle-auto-load.md` (G2 — cite spec)
- `docs/adr/007-bilingual-subtitle-auto-load.md` (G3)
- `docs/task/task-bilingual-subtitle-auto-load.md` (G4)

**Why prefix**: file can be copied/referenced/moved and still be identified by phase + feature. Folder organizes, prefix identifies.

## Phase Boundary Commits (1 commit per phase)

> **Principle**: Clean history = each phase revertable, each phase reviewable, bisect accurate. Docs phases (G0-G3) separate commits from code phases (G4-G5) — don't mix docs + code in 1 commit.

| Phase | When to commit | Commit scope | Format |
|---|---|---|---|
| G0 Discovery | After completing G0 file ops (intent + 0-wiki update) | Docs only: `docs/intent/` + `docs/0-wiki.md` | `docs: G0 intent <feature>` |
| G0.5 Mockup | After completing G0.5 file ops (mockup + optional contract + 0-wiki update + intent update if drift) | Docs only: `docs/mockups/` + `docs/intent/` (if drift) + `docs/0-wiki.md` | `docs: G0.5 mockup <feature>` |
| G1 Spec | After completing G1 file ops (spec + 0-wiki update) | Docs only: `docs/specs/` + `docs/0-wiki.md` | `docs: G1 spec <feature>` |
| G2 Plan | After completing G2 file ops (plan + 0-wiki update) | Docs only: `docs/plan/` + `docs/0-wiki.md` | `docs: G2 plan <feature>` |
| G3 ADR | After completing G3 file ops (ADR + 2-arch update + 0-wiki update) | Docs only: `docs/adr/` + `docs/2-architechture-system.md` + `docs/0-wiki.md` | `docs: G3 ADR-NNN <feature>` |
| G4 Implementation | Per task list (atomic commit per task or group of related tasks) | Code + test + `docs/2-architechture-system.md` + `docs/task/` | `feat: <task>` / `test: <task>` |
| G5 Testing | After each verify checkpoint passes | Test report + fix if any | `test: G5 verify <feature>` |
| G6 Release | 1 release commit (version bump + changelog) | `manifest.json` + `docs/0-wiki.md` + release notes | `chore: release v<x.y.z>` |

**Rules**:
1. **NEVER merge multiple phase docs into 1 commit** — each phase G0-G3 = 1 separate commit. Reason: revert G2 plan without losing G1 spec; bisect bug to the exact phase.
2. **NEVER mix docs phase (G0-G3) with code phase (G4-G5)** in 1 commit. Docs commit = `docs:` type, code commit = `feat:`/`fix:`/`test:`/`refactor:` type.
3. **G4 atomic commit per task** — not 1 commit for the entire G4. Each task (or tightly related group of tasks) = 1 commit. Test: "can this commit be reverted while build still passes?".
4. **Commit message body cites phase + feature** — eg: `docs: G3 ADR-013 subtitle-appearance-manager` (body: "Phase G3 of subtitle-appearance-manager. Adds ADR-013 + updates architecture map.").
5. **If 1 phase has multiple doc files** (eg G3: ADR + 2-arch update + 0-wiki update) → still 1 commit for the entire phase (same topic).
6. **Verify before committing phase**: `git diff --name-only` → confirm only files of that phase; `ls` confirm files exist (don't trust memory).

**Why not skip commits between docs phases**: If G0-G3 merged into 1 commit → reverting "wrong plan" loses the correct spec too. Bisect "when was this decision introduced" can't find the exact commit. Each phase = a separate decision, separate commit = clear audit trail.

## Phase 0 — Discovery / Ideation
**Purpose**: Define the problem to solve, vision, opportunity. **End of G0: LIGHTWEIGHT feasibility go/no-go** (block early on features clearly not worth building, don't generate plan file).
**Skill activation**: `idea-refine` (stress-test assumptions) → `interview-me` (clarify intent) → `cto-persona` (quick go/no-go: build-vs-buy, rough risk)
**Ponytail**: rung 1 (YAGNI) — "Does this need to be built at all?" Question complex requests: "Do you actually need X, or does Y cover it?"
**Input**: User request (raw, underspecified)
**Output**: `docs/intent/intent-<feature>.md` (vision, problem statement, opportunity, **+ feasibility go/no-go section** at end of file: 1-2 paragraphs build-vs-buy + rough risk + recommendation). If idea-refine runs before interview-me → `docs/intent/idea-<feature>.md` (raw idea, not yet interviewed).
**File ops**:
- READ: `docs/0-wiki.md` (know existing docs), `docs/1-share-language.md` (glossary — cache miss when user uses new term → ask confirm → add entry, see Update protocol at end of that file)
- ADD: `docs/intent/intent-<feature>.md` (or `idea-<feature>.md` if not yet interviewed) — **must have "Feasibility go/no-go" section** at end
- UPDATE: `docs/0-wiki.md` (table of contents), `docs/1-share-language.md` (if intent introduces new terms)

> **Lightweight feasibility go/no-go (end of G0)**: only answers "Is it clearly not worth doing?" — if YES → stop, don't enter G1. If NO (needs deeper evaluation) → enter G1 to write spec. IN-DEPTH feasibility assessment (evidence-based build-vs-buy, concrete risk mitigation) moves to G2 plan, where spec is the foundation.

## Phase 0.5 — Design-Driven Mockup (UI features only)
**Purpose**: Generate visual mockup (HTML/SVG) from intent + `design-system.md` BEFORE writing spec, so UI is confirmed with anh before committing to detailed requirements. Mockup may change intent requirements (intent drift) → update intent before G1.
**Skill activation**: `design-driven-development` (generate mockup + get approval + handoff)
**Ponytail**: rung 2 (reuse codebase) — "Read `docs/design-system/design-system.md` first, reuse tokens/components/patterns, don't invent."
**Input**: `docs/intent/intent-<feature>.md` + `docs/design-system/design-system.md` + anh's answers to 8 input-gathering questions
**Output**: `docs/mockups/mockup-<feature>.html` (always) + `docs/mockups/icon-svg/<icon>.svg` (if custom icon) + `docs/mockups/design-contract-<feature>.md` (optional — only if UI complex: multi-state 4+ AND multi-token 5+ AND new interaction pattern)
**File ops**:
- READ: `docs/intent/intent-<feature>.md`, `docs/design-system/design-system.md`, `src/entrypoints/popup/styles/theme.css` + `src/shared/lib/themeTokens.ts` (verify token values), `docs/adr/` (approved patterns), `src/` existing components (mimic)
- ADD: `docs/mockups/mockup-<feature>.html` (+ optional SVG icon + optional contract file)
- UPDATE (if intent drift): `docs/intent/intent-<feature>.md` (mockup changed requirements → update intent before G1), `docs/0-wiki.md` (mockup entry)
**Skip condition**: Feature has NO UI surface (pure background logic, no-UI) → skip G0.5, go straight to G1.
**Stale design-system.md**: If `design-system.md` "Last updated" > 1 month ago + recent refactors → invoke `design-system-audit` first to refresh living doc before generating mockup.

> **Why mockup before spec**: Spec describes UI in text → ambiguous → G4 code drifts from anh's vision → rework. Mockup = visual confirmation → spec cites mockup → G4 code follows mockup → G5 verifies real render vs mockup. Catches UI breakage early (G0.5) instead of late (G4/G6).

## Phase 1 — Requirements / Spec
**Purpose**: Turn needs into specific, testable requirements (PRD/SRS "what to build"). **Spec is the ROOT for plan** — all downstream decisions (plan, ADR, task) must cite spec.
**Skill activation**: `spec-driven-development` (write PRD before code) → `interview-me` (resolve open questions) → `security-and-hardening` (security/privacy requirements)
**Ponytail**: rung 3-5 (stdlib → native → installed dep) — "Does stdlib/native/installed dep solve it before specifying custom implementation?"
**Input**: `docs/intent/intent-<feature>.md` (including feasibility go/no-go section)
**Output**: `docs/specs/spec-<feature>.md` (SRS/PRD: functional + non-functional + acceptance criteria + error cases + data flow + out-of-scope)
**File ops**:
- READ: `docs/intent/`, `docs/knowledge/` (grep related keywords), `docs/2-architechture-system.md` (know existing system to spec realistically), `docs/1-share-language.md` (glossary — spec must use accurate system terms; cache miss → ask confirm → add entry)
- ADD: `docs/specs/spec-<feature>.md`
- UPDATE: `docs/0-wiki.md` (table of contents), `docs/1-share-language.md` (if spec introduces new system terms)

> **Why spec before plan**: spec exposes hidden complexity, edge cases, non-functional requirements — the things needed to evaluate feasibility/build-vs-buy MATURELY. Plan without spec = arbitrary opinion. Spec changes less than plan, making it a stable foundation.

## Phase 2 — Implementation Plan
**Purpose**: Based on spec, create high-level implementation plan: approach, scope, risk mitigation, milestones, IN-DEPTH build-vs-buy. **Output of spec = input of plan** — each item in plan must map to a requirement in spec.
**Skill activation**: `cto-persona` (evidence-based build-vs-buy, tech strategy) → `doubt-driven-development` (stress-test approach) → `planning-and-task-breakdown` (high-level only: phase split, dependencies, NOT detailed task list — detailed task list is in G4)
**Ponytail**: rung 1-2 (YAGNI + reuse codebase) — "Does this need to be built at all? Does it already exist?"
**Input**: `docs/specs/spec-<feature>.md` (**REQUIRED** — plan must cite spec)
**Output**: `docs/plan/plan-<feature>.md` (implementation plan: approach per requirement, scope, risk mitigation [cite spec edge cases], milestones, build-vs-buy recommendation [cite spec complexity], NOT detailed task list)
**File ops**:
- READ: `docs/specs/spec-<feature>.md`, `docs/2-architechture-system.md`
- ADD: `docs/plan/plan-<feature>.md` (each section cites spec: "Req §3.2 → approach X")
- UPDATE: `docs/0-wiki.md` (table of contents)

> **COMMON MISCONCEPTION WARNING**: Don't use `planning-and-task-breakdown` to generate a detailed task list in G2. That skill has 2 modes: (a) high-level phase split for G2 plan, (b) detailed task list for G4. G2 only uses mode (a). Detailed task list runs at **G4 start** (after Spec G1 + Plan G2 + ADR G3). G2 answers: "HOW high-level? Approach? Risk mitigation? Milestones?"

## Phase 3 — Design / Architecture
**Purpose**: Design architecture + threat model before code. UI/UX decisions live inside the ADR (no separate design-system files).
**Skill activation**: `system-architecture-design` → `cto-persona` (governance) → `api-and-interface-design` (module boundaries) → `security-and-hardening` (threat model) → `conceptualization` (trigger 3: architecture decision → principle)
**Input**: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md` (approach/risk already there, ADR formalizes decision)
**Output**: `docs/adr/NNN-<decision>.md` (1 file per decision, NNN = sequence number), updated `docs/2-architechture-system.md`. ADR records WHY of UI decisions (token reuse vs new, accessibility target, component boundaries). Implementation detail (DOM tree, state machine, responsive, mockup) lives in G4 task list, NOT in ADR.
**File ops**:
- READ: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md`, `docs/2-architechture-system.md`
- ADD: `docs/adr/NNN-<decision>.md`
- UPDATE: `docs/2-architechture-system.md` (Directory tree + Dependency table + Function Index)
- UPDATE: `docs/0-wiki.md` (table of contents)
- LEARNING: if architecture decision has reusable insight → invoke `/conceptualization` (trigger 3)

> **G3 ADR giữ bản chất** (WHY + decision, không phải HOW): ADR ghi quyết định khó đảo ngược — token reuse vs new, accessibility target (WCAG 2.1 AA), component boundaries. Implementation detail (DOM tree, state machine, responsive, mockup, a11y checklist) thuộc G4 task list. Legacy `docs/design-system/` + `docs/reviews/design-system-*` files kept as reference, not updated further.

## Phase 4 — Implementation / Coding
**Purpose**: Write code per design, TDD, code review, atomic commits.
**Skill activation**: `planning-and-task-breakdown` (G4 START, task list mode) → `test-driven-development` → `source-driven-development` → `incremental-implementation` → `git-workflow-and-versioning`. Cross-cutting: see Skill Activation Matrix (`context-engineering`, `observability-and-instrumentation`, `code-simplification`, `conceptualization`).
**Ponytail** (always-on, AGENTS.md): PRE-FILTER before TDD + implementation rules + self-check
**Input**: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md`, `docs/adr/NNN-<decision>.md`, `docs/2-architechture-system.md`
**Output**: `docs/task/task-<feature>.md` (detailed task list — output of `planning-and-task-breakdown` run at G4 start) + `src/` code + `tests/` + updated `docs/2-architechture-system.md`

**G4 Start — Task breakdown (MANDATORY before code)**:
1. Invoke `planning-and-task-breakdown` (detailed task list mode) with input: Spec (G1) + Plan (G2) + ADR (G3)
2. Output: detailed task list (each task: acceptance criteria, verification, dependencies, files likely touched)
3. Save task list to `docs/task/task-<feature>.md` (separate folder, don't mix with `docs/plan/` implementation plan) OR use `todo_write` inline
4. **NO CODE before task list exists** — task list ensures correct dependency order, no forgotten tasks

**Bad**: Jump into code because "task is obvious", forget 2/10 tasks, discover late.
**Good**: Task list 10 minutes upfront, clear dependencies, no forgotten tasks.

**Pre-Task (MANDATORY — for each task in task list)**:
1. **MUST read** spec → determine exact task (don't trust memory)
2. **MUST grep** `docs/knowledge/` for keywords → avoid repeating past mistakes
3. **MUST read** Function Index → know if related function already exists
4. **MUST check** Dependency table → know which files are affected when fixing file X
5. **If context degradation/task switch** → invoke `context-engineering` (see Skill Activation Matrix)

**Ponytail ladder (PRE-FILTER — runs BEFORE TDD)**:
1. YAGNI — "Does this need to be built at all?" → no: skip
2. Reuse codebase — "Does it already exist?" → yes: reuse, skip TDD for that part
3. Stdlib — "Does standard library do it?" → yes: use, skip custom code
4. Native platform — "Does native feature cover it?" → yes: use
5. Installed dependency — "Does installed dep solve it?" → yes: use
6. One line — "Can this be one line?" → yes: one line
7. Only then: write minimum code that works → **TDD applies from here**

**Bad**: Writing a 200-line class for something stdlib already has (Date.parse, fetch, Array.flat).
**Good**: `const x = arr.flat();` + 1 test guard, move on.

**Implementation (DO)**:
1. TDD: RED (write failing test) → GREEN (minimal impl) → REFACTOR (5-axis review)
2. Ponytail rules (implementation constraints — concrete form of Core Behavior #4-#5):
   - No abstractions not explicitly requested (spec/ADR = explicitly requested)
   - No new dependency if avoidable
   - Deletion over addition. Boring over clever. Fewest files possible
   - Shortest working diff wins, but only once you understand the problem
   - Mark intentional simplifications with `ponytail:` comment (name ceiling + upgrade path)
3. Invoke related skills: `/test-driven-development`, `/source-driven-development`
4. **Observability**: Invoke `observability-and-instrumentation` in parallel (instrument as you build — see Skill Activation Matrix)

**Ponytail self-check (after code passes ladder rung 7)**:
- Non-trivial logic → **MUST** leave ONE runnable check (assert-based demo or one small test file)
- Trivial one-liners → no test needed
- **Baseline TDD override**: project baseline.md says "when in doubt, write the test" — baseline wins over ponytail "trivial no test"

**Post-Implementation**: If code is too complex → invoke `code-simplification` (see Skill Activation Matrix)

**File ops**:
- READ: `docs/2-architechture-system.md` (Directory tree + Dependency table + Function Index), `docs/knowledge/` (grep keywords), `docs/1-share-language.md` (glossary — know existing system terms to reuse, don't create duplicate aliases)
- ADD: `src/<file>.ts`, `tests/unit/<file>.test.ts`
- UPDATE: `docs/2-architechture-system.md` — **3 places** (in order):
  a. **Directory tree** (TOP of file) — EASIEST TO FORGET
  b. **Dependency table** (MIDDLE of file)
  c. **Function Index** (BOTTOM of file)
- UPDATE: `docs/1-share-language.md` — **when introducing new system terms** (new file name, new toggle name, new message type name, new store key name) → add entry "user may call it Z → system term W"; **when renaming/refactoring system terms** → update entry (trigger 3, see Update protocol at end of glossary)
- Fixing a function → only update Function Index if input/output changes; skip if implementation changes
- VERIFY: `ls src/` each directory → compare with Directory tree → **MUST confirm nothing missing** (don't trust memory, trust `ls`)

**Pre-Commit (VERIFY + COMMIT)** — common commit rules see Phase Boundary Commits section. These are G4-specific rules:
1. **MUST run** `git diff --name-only` → know which files changed
2. **If docs/ changed** → **MUST update** `docs/0-wiki.md` table of contents
3. **If reusable insight** → **MUST check** `docs/knowledge/principles.md`: grep keyword → new pattern → invoke `/conceptualization` skill → update 2 layers (principle index + case study file). 5 triggers: bug fix verified, feature insight, architecture decision, refactor discovery, cross-cutting pattern
4. **If architecture changed** → **MUST add** ADR to `docs/adr/NNN-<decision>.md`
5. **MUST invoke** `git-workflow-and-versioning` skill
6. **Size check**: `git diff --staged --stat` — if > 300 lines → split
7. **TDD cycle**: RED → GREEN → COMMIT → REFACTOR → COMMIT
8. **Pre-Commit Hygiene**: `git diff --staged` (check secrets) → `npm test` → `npm run lint` → `npx tsc --noEmit`
9. **Browser verification (stop-the-line)**: If changes touch content-script, popup, UI, or any code running in browser → **MUST run MCP/Playwright test (real browser) and pass before commit**. Never commit based on unit test + tsc alone when bug is visual/runtime. (See Skill Activation Matrix: `extension-browser-debugging`)

**Bad**: "Unit test pass, tsc pass → commit". Popup renders wrong layout on real Chrome.
**Good**: MCP install unpacked extension → inspect popup → measure DOM → capture console → verify acceptance criteria pass → commit.

## Phase 5 — Testing / Verification
**Purpose**: Verify code meets requirements + safe + stable.
**Skill activation**: `test-driven-development` (test pyramid) → `code-review-and-quality` (5-axis review) → `doubt-driven-development` (adversarial review). Conditional sub-skills + browser verification: see Skill Activation Matrix (G5 Code Review branching).
**Input**: `src/` code + `tests/` + `docs/specs/spec-<feature>.md` (acceptance criteria)
**Output**: Test reports, code review log
**File ops**:
- READ: `docs/specs/spec-<feature>.md` (acceptance criteria), `tests/`
- ADD: `tests/integration/`, `tests/e2e/` (if needed)
- UPDATE: `tests/unit/` (fix failing tests)

## Phase 6 — Deployment / Release
**Purpose**: Release verified build to production safely, with rollback.
**Skill activation**: `shipping-and-launch` (pre-launch checklist, staged rollout, rollback) → `ci-cd-and-automation` (CI/CD pipeline)
**Input**: `src/` code (verified), `docs/specs/spec-<feature>.md`
**Output**: Release artifact, release notes, deployment runbook
**File ops**:
- READ: `docs/specs/spec-<feature>.md` (success criteria)
- UPDATE: `docs/0-wiki.md` (changelog, version)

> **Note**: `observability-and-instrumentation` already ran in parallel with G4 implementation — don't re-run in G6. G6 only verifies monitoring was instrumented correctly in G4.

## Phase 7 — Maintenance / Operations
**Purpose**: Keep the system stable, fix bugs, monitor, evolve.

**Skill activation**: 

`debugging-and-error-recovery` (root-cause debug) 

→ `observability-and-instrumentation` (monitor, diagnose) 

→ `conceptualization` (trigger 1: bug fix verified → principle, 2-layer) 

→ `deprecation-and-migration` (remove old systems) 

→ `code-simplification` (refactor clarity)

**Ponytail**: bug fix = root cause, not symptom — grep every caller of the function you touch, fix the shared function once. One guard there is a smaller diff than one per caller. Patching only the path the ticket names leaves a sibling caller still broken.

**Input**: Bug report / incident / monitoring alert

**Output**: `docs/knowledge/principles.md` (layer 1: principle entry) + `docs/knowledge/<case-name>.md` (layer 2: case study), postmortem.
**File ops**:
- READ: `docs/knowledge/principles.md` (grep keywords → apply principle)
- ADD: `docs/knowledge/<case-name>.md` (layer 2: new case study)
- UPDATE: `docs/knowledge/principles.md` (layer 1: add principle entry or cases link)
- UPDATE: `docs/2-architechture-system.md` (if fix affects architecture)
- UPDATE: `docs/1-share-language.md` (if refactor/rename/delete system term → update or remove stale entry, see Update protocol at end of glossary)

-> Identify which phase you are in and apply the processes within that phase.

## Skill Activation Matrix (Source of Truth — replaces Cross-cutting + Synergies)

Each skill appears exactly once here. Phases sections reference this matrix for cross-cutting skills.

| Skill | Phases | When to invoke | Combo notes |
|---|---|---|---|
| `doubt-driven-development` | G2, G5 + any non-trivial decision | Adversarial review before standing | + TDD + browser-debug = correctness |
| `context-engineering` | G4 Pre-Task + session start/task switch | Context degradation, 80% capacity | → planning-and-task-breakdown |
| `using-agent-skills` | Any phase when unsure which skill to use | Discover skills | Meta-skill |
| `documentation-and-adrs` | G3 (ADR), G4 (API changes), G6 (ship) | Architecture decisions, API changes | — |
| `git-workflow-and-versioning` | G4-G7 (any code change) | Atomic commits, branching | — |
| `observability-and-instrumentation` | G4 (parallel with implementation) | Instrument as you build, NOT after | → G6 verify monitoring |
| `code-simplification` | G4 post-impl, G5 review (conditional) | Code too complex/hard to read | Preserve behavior |
| `security-and-hardening` | G1 (requirements), G3 (threat model), G5 (conditional) | Security concerns, SAST/DAST | + doubt-driven |
| `performance-optimization` | G5 (conditional) | Perf concerns, Core Web Vitals | + observability |
| `extension-browser-debugging` | G4 Pre-Commit, G5 (browser-facing) | Content-script, popup, UI, DOM injection | Stop-the-line verification |
| `conceptualization` | G3 (trigger 3), G4 (trigger 2,4,5), G7 (trigger 1) | 5 triggers → 2-layer principle | — |

**G5 Code Review branching** (conditional sub-skills of `code-review-and-quality`):
- Base: `code-review-and-quality` (5-axis: correctness, security, performance, maintainability, testing)
- Code too complex → `code-simplification`
- Security concerns → `security-and-hardening`
- Performance concerns → `performance-optimization`
- Browser-facing → `extension-browser-debugging` (MUST, stop-the-line)

**Ponytail + TDD combo** (G4): AGENTS.md ponytail (ladder rung 1-7, before code) → `test-driven-development` (RED→GREEN→REFACTOR) → `code-review-and-quality` (5-axis) → `code-simplification` (if complex)
