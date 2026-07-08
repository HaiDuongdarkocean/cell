---
name: software-production-workflow
description: LOOP model — 5-phase recursive loop (DISCOVER → IDEATE → BUILD → VERIFY → SHIP) for AI 1-person extension project. Iterate until stopping condition true. Agent viết code ≠ agent verify (sub-agent independent check). Use when starting any feature/bugfix/refactor to identify which phase you are in and which skills to invoke.
---

# Software Production Workflow — LOOP model

> **Loop engineering** (Addy Osmani): "Loop engineering is replacing yourself as the person who prompts the agent. You design the system that does it instead." Agent iterate đến stopping condition true. Agent forgets between sessions, repo doesn't — state on disk.
>
> Reference spec, don't trust memory. Verify with `ls`. 5 phases: DISCOVER → IDEATE → BUILD → VERIFY → SHIP. Loop back if stopping condition not met.

## Phase Flow

```
Don't know what user wants? ──────────→ DISCOVER (interview-me + idea-refine)
Have intent? ─────────────────────────→ IDEATE (spec-driven-development — MANDATORY full spec)
  └── ANY UI surface? ─────────────────→ + information-architecture-designer (IA proposal trong spec, anh approval gate)
  └── Architecture decision? ─────────→ + ADR (cite trong spec) + api-and-interface-design if module boundaries
  └── Non-trivial? ───────────────────→ + doubt-driven-development (adversarial review)
  └── Anh approve spec? ──────────────→ BUILD
Need code? ───────────────────────────→ BUILD (read spec 1 file + TDD inline + ponytail PRE-FILTER)
  └── Browser-facing? ────────────────→ extension-browser-debugging (stop-the-line)
Need verify? ─────────────────────────→ VERIFY (vs spec success criteria + quality gates + browser + sub-agent)
  └── Fail? ──────────────────────────→ loop back BUILD (fix → VERIFY again)
Stopping condition true? ─────────────→ SHIP (atomic commit + update state + remember)
Production issue / bug? ──────────────→ DISCOVER (debugging-and-error-recovery) → loop
```

## Stopping condition (loop exit — ALL must be true)

```
  ✓ npm run test:unit pass
  ✓ npx tsc --noEmit clean
  ✓ npm run lint clean
  ✓ Browser verify pass (if browser-facing — MCP edge-devtools/chrome-devtools)
  ✓ Anh approve (if approval gate needed — UI structure, architecture decision)
```

> `/goal` pattern: agent keeps working until verifiable stopping condition holds. VERIFY checks condition every iteration. Fail → loop back BUILD. Pass → SHIP.

## Always-On Behaviors

1. **Surface Assumptions** — state assumptions before implementing. Don't silently fill ambiguous requirements.
2. **Manage Confusion** — STOP on inconsistency. Name it, present tradeoff, wait. Bad: silently guessing. Good: "I see X in spec but Y in code. Which wins?"
3. **Push Back** — point out issues directly, quantify downsides, propose alternatives. Accept human's override with full info.
4. **Enforce Simplicity** — "Can this be fewer lines? Would a staff engineer say 'why didn't you just...'?" Boring over clever.
5. **Scope Discipline** — touch only what's asked. No unsolicited renovation, no orthogonal cleanup, no unrequested features.
6. **Verify, Don't Assume** — task not complete until stopping condition passes. "Seems right" is never sufficient.

**Failure modes** (mirror): wrong assumptions, plowing ahead when lost, hiding inconsistencies, sycophantic "Of course!", overcomplicating, modifying orthogonal code, removing things you don't understand, building without decision, skipping verification, skipping docs/commits.

## File Placement

Format `<prefix>-<name>.md`. ADR: `NNN-<name>.md`. **NEVER store loose files in `docs/` root.**

| Prefix | Folder | Phase | Question | When |
|---|---|---|---|---|
| `idea-` / `intent-` | `docs/intent/` | DISCOVER | Raw idea / confirmed intent | Feature lớn only — inline OK cho small |
| `spec-` | `docs/specs/` | IDEATE | What to build? 8 section self-contained | **MANDATORY** — mọi feature (bug fix nhỏ skip) |
| `NNN-` | `docs/adr/` | IDEATE | Architecture decision + alternatives | Arch lớn only |
| — | `docs/knowledge/` | SHIP | Reusable principles + case studies (2-layer) | Bug fix / reusable insight |

> **Spec mặc định** (không escape hatch): mọi feature viết full spec `docs/specs/spec-<feature>.md` trước BUILD. Spec self-contained 8 section (duplicate AGENTS.md OK — trade-off: em đọc 1 file, không load AGENTS.md vào context, tránh quên khi context phình).

## Phase Commits

Docs (DISCOVER/IDEATE) separate from code (BUILD/SHIP). Format: `docs: <phase> <type> <feature>` (DISCOVER/IDEATE), `feat: <task>` / `fix: <bug>` (BUILD/SHIP).

**Rules**: (1) NEVER merge multiple phase docs into 1 commit. (2) NEVER mix docs phase with code phase. (3) BUILD atomic commit per task — "can this commit be reverted while build still passes?". (4) Verify before commit: `git diff --name-only` + `ls` confirm.

## Phase 1 — DISCOVER

**Purpose**: Understand yêu cầu + codebase. Clarify what/why, avoid past mistakes.
**Skills**: `interview-me` (ambiguous) → `idea-refine` (raw idea). **Ponytail**: rung 1 (YAGNI — does this need to exist?).
**Input→Output**: User request → intent (inline hoặc `docs/intent/intent-<feature>.md` if feature lớn).
**File ops**: READ `docs/0-wiki.md` + glossary (cache miss → ask confirm → add entry) + `docs/2-architechture-system.md` (Bảng phụ thuộc + Function Index) + grep `docs/knowledge/` (avoid past mistakes). ADD intent (if feature lớn). UPDATE wiki + glossary if new terms.

> DISCOVER answers "What does anh want? Is it clearly not worth doing?" If YES → stop. If NO → IDEATE.

## Phase 2 — IDEATE

**Purpose**: Write full spec (PRD) + decide structure + architecture before code. Spec = test basis cho VERIFY (loop exit). Self-contained — em đọc 1 file, không load AGENTS.md.
**Skills**: `spec-driven-development` (full spec 8 section, MANDATORY) → `information-architecture-designer` (UI — IA proposal trong spec, anh approval gate) → `api-and-interface-design` (module boundaries → contracts trong spec) → `doubt-driven-development` (non-trivial decision, adversarial review). **Ponytail**: rung 2 (reuse codebase, read `docs/design-system/README.md` first).
**Input→Output**: intent + `docs/design-system/README.md` (7 layer folders) + existing `src/` components + `docs/adr/` → `docs/specs/spec-<feature>.md` (8 section: Objective + Tech Stack + Commands + Project Structure + Code Style + Testing Strategy + Boundaries + Success Criteria) + `docs/adr/NNN-<decision>.md` (if arch lớn).
**File ops**: READ intent + design-system + `src/` components + `docs/adr/`. ADD spec (MANDATORY) + ADR (if arch lớn). UPDATE intent (if drift) + wiki.

**Spec 8 section** (self-contained — duplicate AGENTS.md OK):
1. **Objective** — What/why + user stories + acceptance criteria (derive test case)
2. **Tech Stack** — Framework, language, deps (reference AGENTS.md nhưng viết lại cho self-contained)
3. **Commands** — Build/test/lint/dev (reference AGENTS.md)
4. **Project Structure** — Directory layout (reference docs/2-architechture-system.md)
5. **Code Style** — Example snippet + conventions (reference AGENTS.md)
6. **Testing Strategy** — Framework, test locations, coverage, test levels (QA input)
7. **Boundaries** — Always/Ask first/Never (guard rails)
8. **Success Criteria** — Specific, testable conditions (LOOP EXIT CONDITION — verify dựa vào đây)

> IDEATE = "decide before code + write test basis". Spec = PRD self-contained, anh approve trước BUILD. UI feature → IA proposal trong spec. Arch lớn → ADR cite trong spec. Module boundaries → contracts trong spec. Success criteria = loop exit condition. VERIFY check code vs spec success criteria.

## Phase 3 — BUILD

**Purpose**: Write code per spec, TDD inline, atomic commits. Read spec (1 file) — không load AGENTS.md.
**Skills**: `test-driven-development` (logic — tests derive từ spec acceptance criteria) → `source-driven-development` (framework unfamiliar) → `incremental-implementation` (>1 file) → `extension-browser-debugging` (browser-facing, stop-the-line) → `git-workflow-and-versioning`. **Ponytail**: rung 1-7 PRE-FILTER before TDD.
**Input→Output**: spec (`docs/specs/spec-<feature>.md`) + ADR (if arch lớn) → `src/` code + `tests/` + updated arch map.
**File ops**: READ spec (1 file — self-contained) + `docs/knowledge/` (grep keywords) + glossary. ADD `src/` + `tests/`. UPDATE arch map (3 places: tree + dependency table + function index) + glossary (if new/renamed terms). VERIFY: `ls src/` → compare with tree → confirm nothing missing.

**BUILD Start**: `todo_write` (task breakdown — từ spec tasks). **NO CODE before todo exists.**
**Pre-Task (per task)**: (1) Read spec → exact task + acceptance criteria. (2) Grep `docs/knowledge/` → avoid past mistakes. (3) Read Function Index → know existing functions. (4) Check Dependency table → know affected files. (5) Context degradation → `context-engineering`.
**Ponytail ladder (PRE-FILTER before TDD)**: 1.YAGNI → 2.Reuse codebase → 3.Stdlib → 4.Native → 5.Installed dep → 6.One line → 7.Only then: minimum code that works (TDD applies from here). No unrequested abstractions, no new deps if avoidable, deletion over addition, boring over clever, fewest files, shortest working diff. Mark intentional simplifications with `ponytail:` comment. Non-trivial logic → 1 runnable check. **Baseline TDD override**: when in doubt, write the test.
**UI features (spec có IA proposal)**: Read spec IA proposal from disk (don't trust memory). Build per placement. Implement all states (loading skeleton, empty composed, error inline, hover/active/focus/disabled). Apply a11y (WCAG 2.2: contrast 4.5:1, focus 2px 3:1, target 44px, ARIA tablist). Apply DS tokens (`docs/design-system/README.md` — no freeform hex, no random radius). Do NOT change placement/IA without returning to IDEATE (update spec first).
**Pre-Commit**: (1) `git diff --name-only`. (2) If docs changed → update wiki. (3) If reusable insight → `conceptualization`. (4) If arch changed → add ADR. (5) `git-workflow-and-versioning`. (6) Size > 300 lines → split. (7) TDD: RED→GREEN→COMMIT→REFACTOR→COMMIT. (8) Hygiene: `git diff --staged` (secrets) → `npm test` → `npm run lint` → `npx tsc --noEmit`. (9) **Browser verification (stop-the-line)**: content-script/popup/UI/DOM → MUST run MCP/Playwright real browser test before commit. Never commit on unit+tsc alone for visual/runtime bugs.

## Phase 4 — VERIFY

**Purpose**: Verify code meets spec + safe + stable. **Agent viết code ≠ agent verify** — sub-agent independent check vs spec success criteria.
**Skills**: `code-review-and-quality` (5-axis: correctness, security, performance, maintainability, testing) → `extension-browser-debugging` (browser-facing, MUST stop-the-line) → sub-agent verify (`run_subagent` cavecrew-reviewer / subagent_general — independent check vs spec success criteria). **Conditional**: `performance-optimization` (perf concern), `security-and-hardening` (security concern), `code-simplification` (too complex).
**Input→Output**: `src/` + `tests/` + spec (`docs/specs/spec-<feature>.md` — acceptance criteria + success criteria = test basis) → pass/fail.
**File ops**: READ spec (acceptance criteria + success criteria) + tests. ADD `tests/integration/`, `tests/e2e/` (if needed). UPDATE `tests/unit/` (fix failing).

**VERIFY branching**: Base `code-review-and-quality` (5-axis). Too complex → `code-simplification`. Security → `security-and-hardening`. Performance → `performance-optimization`. Browser-facing → `extension-browser-debugging` (MUST, stop-the-line). Independent check → `run_subagent` (cavecrew-reviewer / subagent_general — agent viết code ≠ agent chấm điểm, check vs spec success criteria).

**Sub-agent verify prompt** (maker-checker split — truyền cho sub-agent):
- **Criteria**: paste spec success criteria (KHÔNG tự nghĩ)
- **Evidence required**: raw output từ tools (ls, npm test, tsc, lint, MCP browser, grep) — KHÔNG tin transcript maker
- **Output format**: binary PASS/FAIL per criterion + VERDICT SHIP/LOOP_BACK + fail list. 1 FAIL = LOOP_BACK. Max 3 rounds → escalate anh.

**Stopping condition check**: ALL pass (tests + lint + tsc + browser + spec success criteria) → SHIP. ANY fail → loop back BUILD (fix → VERIFY again). Max 3 loop iterations → escalate anh.

## Phase 5 — SHIP

**Purpose**: Atomic commit + update state + remember. Agent forgets between sessions, repo doesn't.
**Skills**: `git-workflow-and-versioning` (mặc định) → `conceptualization` (bug fix → principle) → `documentation-and-adrs` (API/arch change → ADR).
**Input→Output**: verified `src/` + `tests/` → git commit + updated state (arch map, wiki, glossary, knowledge).
**File ops**: READ `git diff --name-only`. UPDATE `docs/2-architechture-system.md` (3 places if arch changed) + `docs/0-wiki.md` (if docs changed) + `docs/1-share-language.md` (if terms changed) + `docs/knowledge/` (if reusable insight). ADD `docs/knowledge/<principle>.md` (layer 1: principle) + `docs/knowledge/<case-name>.md` (layer 2: case study) if bug fix → conceptualization.

> SHIP = "commit + remember". Atomic commit (code ≠ docs = 2 commit). Update state on disk (agent forgets, repo doesn't). Extract principle if bug fix (prevent future mistakes).

## Loop back (VERIFY fail → BUILD fix)

When VERIFY fails:
1. Identify root cause (not symptom — grep every caller, fix shared function once).
2. Loop back BUILD — fix → VERIFY again.
3. Max 3 loop iterations → escalate anh (don't infinite loop).
4. If bug → `debugging-and-error-recovery` (9-step root-cause protocol).
5. After fix → `conceptualization` (trigger 1: bug fix → principle, 2-layer).

## Spec là mặc định (không escape hatch)

Mọi feature viết full spec `docs/specs/spec-<feature>.md` ở IDEATE trước BUILD. Spec self-contained 8 section — em đọc 1 file, không load AGENTS.md vào context (tránh quên khi context phình). Duplicate AGENTS.md OK (trade-off: focus context > DRY).

**Spec trigger**: mọi feature (không phân biệt size). Bug fix nhỏ (1-line typo, format) → skip spec, đi thẳng BUILD.

**Risk amplifiers** (feature lớn + rủi ro cao — vd: thay storage engine, rewrite architecture): ngoài spec mặc định, thêm:
- Invoke `doubt-driven-development` (adversarial review trước BUILD).
- Invoke `system-architecture-design` (arch lớn → ADR).
- ADR cite trong spec.

**Risk amplifier trigger**: feature touch >5 files OR change data model OR change public API OR anh flag "high-risk".

## Loop engineering primitives — Cell mapping

| Primitive | Job in loop | Cell implementation |
|---|---|---|
| **Automations** | Discovery + triage on schedule (heartbeat) | Session-based loop (task đến = 1 iteration). Future: GitHub Actions cron cho daily triage. Stopping condition = `/goal` pattern. |
| **Worktrees** | Isolate parallel agents | `git worktree add` cho parallel features. Sub-agent `isolation: worktree` khi cần. |
| **Skills** | Codify project knowledge (stop re-explaining) | Curate 40 → 17 core/trigger. Cut persona + mockup round-trip. |
| **Plugins/connectors** | Connect tools (MCP) | MCP servers: edge-devtools, chrome-devtools, git, playwright. |
| **Sub-agents** | Ideate and verify (different agent checks) | VERIFY phase: `run_subagent` (cavecrew-reviewer / subagent_general) — independent code review. IDEATE: sub-agent propose approach. |
| **State (memory)** | Track what's done (agent forgets, repo doesn't) | AGENTS.md (cross-session), docs/2-architechture-system.md (arch map), docs/knowledge/ (principles), docs/adr/ (decisions), docs/0-wiki.md (mục lục), docs/1-share-language.md (glossary). |

## Skill Activation Matrix

Each skill appears once. Phases reference this matrix for cross-cutting skills.

| Skill | Phase | When to invoke |
|---|---|---|
| `interview-me` | DISCOVER | Ambiguous requirements — one-question-at-a-time until 95% confidence |
| `idea-refine` | DISCOVER | Raw idea chưa rõ — stress-test assumptions before commit |
| `spec-driven-development` | IDEATE | **MANDATORY** — mọi feature viết full spec `docs/specs/spec-<feature>.md` (8 section self-contained) trước BUILD |
| `information-architecture-designer` | IDEATE | ANY UI surface — IA proposal (grouping/zones/order/wireframe) trong spec |
| `api-and-interface-design` | IDEATE | Module boundaries mới — props, payloads, type contracts |
| `doubt-driven-development` | IDEATE + any non-trivial decision | Adversarial review before standing |
| `test-driven-development` | BUILD | Logic implementation — red → green → refactor |
| `source-driven-development` | BUILD | Framework unfamiliar — ground in official docs |
| `incremental-implementation` | BUILD | >1 file — deliver changes incrementally |
| `extension-browser-debugging` | BUILD + VERIFY | Browser-facing (content-script, popup, UI, DOM) — stop-the-line |
| `code-review-and-quality` | VERIFY | Pre-merge — 5-axis review |
| `performance-optimization` | VERIFY (conditional) | Perf concern, Core Web Vitals |
| `security-and-hardening` | VERIFY (conditional) | Security concern, SAST/DAST |
| `code-simplification` | VERIFY (conditional) | Code too complex/hard to read |
| `git-workflow-and-versioning` | SHIP | Atomic commits, branching — every code change |
| `conceptualization` | SHIP | Bug fix → principle (2-layer: principle + case study) |
| `documentation-and-adrs` | SHIP | API/arch change → ADR |
| `debugging-and-error-recovery` | Loop back | Bug — 9-step root-cause protocol |
| `context-engineering` | Any phase | Context degradation, 80% capacity |

> Identify which phase you are in and apply the processes within that phase. Loop back if stopping condition not met.
