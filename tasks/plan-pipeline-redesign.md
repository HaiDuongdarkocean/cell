# Implementation Plan: Pipeline Redesign — Intent-first Agentic SDLC

## Overview

Restructure `.agents/skills/` (48 skills) thành 4-stage pipeline có enforcement: `pipeline-analyze` (BA/IIBA) → `pipeline-specify` (traceability) → `pipeline-design` (UI gate) → `pipeline-deliver` (lean ship). Nền tảng: `tasks/pipeline-state.json` + `scripts/pipeline-state.mjs` (SSOT, transition-refuse) + `scripts/check-design-brief.mjs` (deterministic lint) + 6 hooks (`.devin/hooks.v1.json`). 6 stub skills giữ entry-point; router 2-layer; canon docs redraw.

Spec: `docs/specs/pipeline-redesign.md` v1.1 · Intent: `docs/intent/pipeline-redesign.md`

## Architecture Decisions

1. **State file là nền của enforcement** — hooks đọc `pipeline-state.json`, stage ghi qua `pipeline-state.mjs`. Không có nó, mọi hook mù. → Foundation trước, hooks sau.
2. **Enforcement thật nằm ở transition-refuse + deterministic lint**, không ở hook blocking (chưa verify được platform support → spike trước, degrade warn).
3. **Stub > alias mất**: 6 entry-point cũ thành SKILL.md mỏng trỏ stage mới — 63 file reference không đứt, `/command` vẫn resolve.
4. **`autonomous-pipeline` giữ làm engine**, `pipeline-deliver` là stage contract gọi nó — tránh viết lại orchestration đã có.
5. **Stage skills ≤500 dòng**: phần dài (plugins interview-me, BA techniques, mockup workflow) → `references/`.
6. Sequential in-session build (meta refactor, không cần lane worktrees — tasks hầu hết disjoint file nhưng đều là skill/doc writes, overhead worktree không đáng).

## Task List

### Phase 0: Spike — hook blocking semantics

- [x] **Task 0: Verify hook semantics trên Devin CLI** — resolved từ official docs (docs.devin.ai/cli/extensibility/hooks), không cần live spike
  - **Blocking verdict: SUPPORTED** — exit code `2` = block; hoặc stdout `{"decision":"block","reason":"..."}` (PermissionRequest: `{"decision":"approve"}`). Stop event dùng cùng `decision/reason` format + field `stop_hook_active` để tránh loop.
  - **Exec payload: đầy đủ** — PostToolUse stdin có `tool_response: {success: boolean, output: string, error: string|null}` → gates-tracker detect exit 0 được, không cần fallback.
  - stdin shape: `{hook_event_name, tool_name, tool_input, tool_response?, session_id, prompt_id}`; env `DEVIN_PROJECT_DIR` = project root (hooks tìm state file qua đây).
  - Context injection: `{"hookSpecificOutput":{"hookEventName":<event>,"additionalContext":"..."}}` cho UserPromptSubmit/SessionStart/PostToolUse.
  - `updatedInput` trong PreToolUse hookSpecificOutput rewrite tool args — không cần dùng.
  - **Design giữ nguyên warn-only**: stage-guard/stop-gate emit `additionalContext` warnings (fail-open), enforcement thật ở `pipeline-state.mjs transition`. Blocking khả dụng nếu sau này muốn harden.
  - timeout field: seconds (spec dùng ≤5s).

### Checkpoint 0
- [x] Blocking verdict trong spec — supported nhưng hooks giữ warn-only theo spec (enforcement ở transition-refuse).

### Phase 1: Foundation (state + lint + gitignore)

- [x] **Task 1: `scripts/pipeline-state.mjs` + state file + `.gitignore`** — 40 tests pass
  - CLI: `init|get|set|transition|gates|resolve|seed`. `init <slug> --mode` = entry duy nhất (tạo `stage:analyze` + set `active`; refuse khi active đã có). `resolve <slug> --note` = clear `awaiting` duy nhất + `resolutions[]` audit + reset loops khi `flagged:loop-cap`. `set` chỉ `uiSurface|confidence|mode|artifacts.*` + `awaiting=<non-null>` — CẤM stage/gates/awaiting=null/loops.
  - **Transition validate evidence at call time** (spec §Transition table): artifact tồn tại + `VERDICT: <token>` last-line parse + mtime staleness; `analyze→specify` += journey structural check (`## Journey` non-empty + as-is+to-be markers + ≥3 step lines mỗi phần) + `## Decision`==`go` parse (defer→refuse); `analyze→dropped` khi `## Decision`==`no-go` + reason → stage `dropped` + auto-clear active + backlog row → `dropped`; `dropped|shipped→*` terminal; `design→deliver` tự `spawnSync check-design-brief.mjs`; `deliver→shipped` (all mode) spawnSync re-run `npm run typecheck&&lint&&test:unit&&build` — không tin `gates.*` cache; auto-clear `active` on ship/drop; `loops>=3` refuse backward; `uiSurface==unknown` refuse kèm set-hint.
  - `seed <slug>` = cutover mid-flight (scan artifacts → suy stage theo inference table); thiếu evidence → `awaiting: flagged:seeded`, không bypass gate.
  - `tasks/pipeline-state.json` init `{"active":null,"items":{}}` (schema có `resolutions`); `.gitignore` += `!tasks/pipeline-state.json` **sau** dòng `tasks/*.json` + `tasks/.pipeline-state-*.tmp`. Write atomic tmp+rename; main-worktree guard (`.git` dir vs file).
  - Tests `tests/unit/scripts/pipeline-state.test.mjs`: init/set-active/refuse-double-active, mọi transition allow/refuse (lint-invoke + gate-rerun mock), journey structural check (missing as-is/to-be/empty section), VERDICT last-line parse (APPROVE vs APPROVE_WITH_CHANGES), resolve audit + loops reset, shipped terminal, seed flagged, corrupt JSON, missing item, worktree guard, `set` restrictions, atomic write.
  - Acceptance: tests pass; `transition` refuse đúng contract kèm stderr naming missing evidence.
  - Files: `scripts/pipeline-state.mjs`, `tests/unit/scripts/pipeline-state.test.mjs`, `tasks/pipeline-state.json`, `.gitignore`.
  - Scope: M-L · P0 · parallel: true (disjoint với Task 2)

- [x] **Task 2: `scripts/check-design-brief.mjs`** — 8 tests pass + design→deliver happy-path wired
  - Parse `docs/intent/<slug>-design-brief.md` + `<slug>-component-mapping.md`; extract token names (`--*` và token paths), component names (PascalCase + filename), icon ids; verify tồn tại trong `tokens.json` keys / `src/shared/ui/` files / `ICON_CATALOG` exports (`src/shared/icons/index.ts`). Exit 1 + list missing khi thiếu.
  - Tests `tests/unit/scripts/check-design-brief.test.mjs`: happy path, missing token/component/icon, file-only-brief mode.
  - Acceptance: exit 1 trên fixture thiếu; exit 0 trên fixture đủ.
  - Files: `scripts/check-design-brief.mjs`, `tests/unit/scripts/check-design-brief.test.mjs`, fixtures dưới `tests/data-test/`.
  - Scope: M · P0 · parallel: true

### Checkpoint 1
- [x] `npm run test:unit -- pipeline-state check-design-brief` green — 50/50.

### Phase 2: Hooks

- [x] **Task 3: 6 hook scripts + `hooks.v1.json`** — 15 smoke tests pass; stop-gate block=one-shot qua stop_hook_active
  - `hook-session-prime.mjs` (SessionStart: state → stage-aware pointer), `hook-stage-guard.mjs` (PreToolUse `^(write|edit|notebook_edit)$`: no-op khi active==null; spec-warn khi spec mới hơn review artifact; src-warn khi stage<pre-deliver, trừ `mockup-*`, message kèm "non-feature work thì ignore"; **warn khi edit trực tiếp `tasks/pipeline-state.json` kể cả active==null**), `hook-gates-tracker.mjs` (PostToolUse exec: **chỉ khi active stage==deliver** — detect `npm run typecheck|lint|test:unit|build` **hoặc `npx tsc --noEmit|eslint|vitest run|vite build`** exit 0 → `gates --set`; payload shape theo Task 0b, fallback pre-commit-gate ghi), `hook-context-restore.mjs` (PostCompaction: state + AGENTS pointer), `hook-stop-gate.mjs` (Stop: theo verdict Task 0 — block/warn khi deliver ∧ dirty ∧ required gate thiếu/`at` cũ hơn src-mtime mới nhất ∧ !awaiting), `hook-session-report.mjs` (SessionEnd: append `tasks/reports/`).
  - Mọi hook: fail-open, timeout ≤5s, stdout `hookSpecificOutput` contract hoặc rỗng.
  - Acceptance: `hooks.v1.json` valid; mỗi hook smoke-test stdin→stdout (no-op → exit 0 rỗng; trigger case → đúng output).
  - Verify: manual smoke script `tests/unit/scripts/hook-smoke.test.mjs` hoặc echo payload.
  - Files: `scripts/hook-*.mjs` ×6, `.devin/hooks.v1.json`, `tests/unit/scripts/hook-smoke.test.mjs`.
  - Scope: L · P0 · parallel: false (chạm cùng hooks.v1.json) · depends: Task 0 verdict, Task 1

### Phase 3: Stage skills (sequential — lớn, cần consistency)

- [x] **Task 4: `pipeline-analyze`** (v1.4 — full BA methodology fold)
  - SKILL.md: overview + mode interactive/all + stage contract + state-write steps + backward edge + confidence mapping + **BA 3 bước**: (1) **4 việc đầu** — business case (BACCM inference) → stakeholders (team capability + customer + supplier + regulator) → root-cause + risk (pháp lý/tiềm ẩn/khả năng phản ứng) → **go/no-go/defer `## Decision`** (no-go → `transition dropped`); (2) **functional req business-level** — FURPS+ classify, user stories (as-a/I-want/so-that + done-when, **story≠task**, brain-dump→cluster, persona×journey), business process **kể-chuyện-trước-vẽ-sau** (actors+milestones+trình tự, 15s rule, chỉ process liên quan product), **COMPLETE JOURNEY as-is+to-be bắt buộc**; (3) **logic analysis** — review A→Z stories+process, lens pháp luật/tiện lợi/UX/riêng tư/tham vọng. + **hypothesis presentation flow** + Output (`docs/intent/<slug>.md` schema: `## Business Case`/`## Stakeholders`/needs-FURPS+/scope/`## Workflow` narrative/`## Journey`/`## Stories`/`## Decision`/draft-ACs/risks/`ui_surface`).
  - `references/`: migrate interview-me plugins (root-cause, research, survey, baccm-check — **rewrite baccm-check thành inference workflow**) + interview-detail (questioning techniques → giữ cho clarification questions) + idea-refine divergent step + self-interrogation rules (cite-or-assumption) + intent template (đủ sections trên) + BACCM method note + BA-principles note ("dục tốc bất đạt", "đúng+đủ trước chuẩn sau", "công cụ chết người sống", "không có gì tốt nhất chỉ hợp lý nhất").
  - Acceptance: skill self-contained; intent template đủ sections bắt buộc; hypothesis-presentation flow explicit; `## Decision` + dropped path documented; index regen clean.
  - Files: `.agents/skills/pipeline-analyze/{SKILL.md,references/*}` + đọc/migrate từ elicitation+interview-me+idea-refine.
  - Scope: L · P0 · parallel: false

- [x] **Task 5: `pipeline-specify`** (v1.4 — system analysis method chain)
  - SKILL.md: intent→spec; **method chain**: stories+process+logic → use-case-like requirements → flows/states → function/feature → data; **actor↔system boundary** (actor=trigger/input only, cấm human behavior trong system flow); **input→process→output**; requirement format = use-case-spec rút gọn markdown (id/actor/mục tiêu/precondition/basic+alt+exception flows/business rules/postcondition/NFR-refs, luồng chính vs phụ); **function vs feature mapping** (function=system làm gì, feature=công cụ hỗ trợ, 1↔nhiều — UI chỉ đụng feature sau function rõ); FR+NFR; journey-step → requirement mapping; "trong tổng quan có chi tiết" overview→detail→review 2 chiều; spec template += traceability table (need→requirement→AC, journey-step→requirement) + `## Success Criteria` invariant note + actor/system + IPO + function-feature sections; stage gate = `spec-reviewer` subagent → emit `docs/reviews/<slug>-spec.md`; auto-fix loop ≤3 (verdict semantics giữ nguyên); state transition steps.
  - Acceptance: gate emit artifact mandatory; template giữ Success Criteria + FR/NFR + IPO sections.
  - Files: `.agents/skills/pipeline-specify/{SKILL.md,references/*}` + migrate spec-driven-development + spec-review-stakeholder.
  - Scope: M · P1

- [x] **Task 6: `pipeline-design`** (v1.3 — UI-sync fold)
  - SKILL.md: ui_surface check; **UI-đồng-bộ-system rule** (thao tác → journey step → requirement); interactive pipeline (idea-to-interface steps 0–8 giữ nguyên: function audit → journey → 3 concepts → mockup → brief → user pick → component-mapping → approval record) + `all` mode (interface analysis → brief + mapping + ASCII + single-variant mockup → brief-lint → playwright screenshot → vision-reader → `docs/reviews/<slug>-design.md`).
  - `references/`: concept-workflow + mockup-and-brief migrate từ idea-to-interface + all-mode variant.
  - Acceptance: brief-lint step explicit; approval record interactive; vision-reader prompt template.
  - Files: `.agents/skills/pipeline-design/{SKILL.md,references/*}`.
  - Scope: L · P1

- [x] **Task 7: `pipeline-deliver`**
  - SKILL.md: stage contract (plan → engine → gates → ship), boundary pick-off vs engine (pick-off = driver; `autonomous-pipeline` = engine M+; XS/S in-session), gates list (typecheck+lint+test:unit+build+browser), state transitions, business sign-off.
  - Acceptance: không duplicate orchestration logic — chỉ contract + pointer tới engine skill.
  - Files: `.agents/skills/pipeline-deliver/SKILL.md`.
  - Scope: S · P1

### Checkpoint 3
- [x] `node scripts/update-skill-index.mjs` clean — 4 stage skills indexed.

### Phase 4: Stubs + rewire

- [x] **Task 8: 6 stub skills**
  - `elicitation`, `interview-me`, `idea-refine` → `pipeline-analyze`; `spec-driven-development`, `spec-review-stakeholder` → `pipeline-specify`; `idea-to-interface` → `pipeline-design`. Mỗi stub: frontmatter giữ name + description (để trigger/search vẫn match) + body "→ pipeline-X" + legacy note.
  - Acceptance: `/elicitation` resolve; index regen clean.
  - Files: 6 `SKILL.md`.
  - Scope: S · P1 · parallel: true

- [x] **Task 9: `idea-pick-off` rewire + backlog schema**
  - Steps 3–5 trỏ `pipeline-analyze/specify/deliver`; status enum += `analyzed`/`designed` + `UI` flag; resume table mới; `all`-mode rules trỏ self-interrogation + state file; loop-mode state transitions.
  - `docs/ideas/product-backlog.md`: schema header + "Cơ chế pick-off" §2.
  - Acceptance: resume table cover `analyzed|designed`; zero dangling stage refs.
  - Files: `.agents/skills/idea-pick-off/SKILL.md`, `docs/ideas/product-backlog.md`.
  - Scope: M · P1

- [x] **Task 10: `using-agent-skills` rewrite**
  - 2-layer routing: task-type (bug/audit/research/debt/meta — giữ table hiện có) + pipeline-stage (feature work → analyze→specify→design→deliver); knowledge hook trigger đổi phase names; lifecycle sequence vẽ lại theo stage.
  - Acceptance: router trỏ đúng stage skills + stubs; cheat sheet mới.
  - Files: `.agents/skills/using-agent-skills/SKILL.md`.
  - Scope: M · P1 · parallel: true (disjoint với 9)

- [x] **Task 11: `autonomous-pipeline` + `pre-commit-gate` + `debugging` + `learning-and-apply` + agents rewire**
  - `autonomous-pipeline`: "invoked from pipeline-deliver"; `pipeline.md` Phase 1 → `tasks/plan-<slug>.md`.
  - `pre-commit-gate`: += step brief-lint (khi `docs/intent/*-design-brief.md` trong change set) + step check-skills (`update-skill-index` + `git diff --exit-code index.json` — §10.1 item 12) + cuối skill ghi `gates --set` (fallback khi exec-payload không có exit code).
  - `debugging-and-error-recovery`: += UI component-check step khi fix đụng tsx/css.
  - `learning-and-apply` description + knowledge-hook language theo stage names.
  - `.agents/agents/spec-reviewer{,-swe,-glm}/AGENT.md`: repoint → `pipeline-specify` gate; **fix bug có sẵn** `spec-reviewer-swe` frontmatter `name: spec-reviewer-glm` → `spec-reviewer-swe`.
  - Acceptance: mỗi file rewire đúng, không dangling.
  - Files: 7-8 files.
  - Scope: M · P1 · parallel: true (disjoint với 9-10)

### Phase 5: Canon docs

- [x] **Task 12: `AGENTS.md`**
  - Questioning rule → "trừ pipeline-analyze interactive + pipeline-design approval"; Workflow section pipeline mới; mockup path → `src/entrypoints/mockup-*`; stage vocabulary.
  - Files: `AGENTS.md`. Scope: S · P0 (rules load-bearing)

- [x] **Task 13: `agentic-sdlc.md` redraw**
  - §10.1: items 7–10 + 12 → done w/ evidence; §10.3: wiring map mới (state file + 6 hooks + 4 stages); §11 runbook: phase—skill—output table mới; §11.4 SSOT catalog += pipeline-state + `.agents/agents/` location.
  - Files: `docs/knowledge-base/agentic-sdlc.md`. Scope: M · P2

- [x] **Task 14: `docs/0-wiki.md` changelog**
  - Entry pipeline redesign theo format hiện có (kỹ thuật + rationale + artifacts).
  - Files: `docs/0-wiki.md`. Scope: S · P2

### Phase 6: Verify + commit

- [x] **Task 15: Full verify**
  - `node scripts/update-skill-index.mjs` exit 0; grep sweep dangling (`/elicitation|/interview-me|/idea-refine|/spec-driven-development|/spec-review-stakeholder|/idea-to-interface` trong skills+docs+agents → phải trỏ stub hoặc stage); `npm run typecheck && npm run lint && npm run test:unit && npm run build`; hook smoke; `git status` sạch rác.
  - Acceptance: mọi check green; disposition 48/48 accounted.
  - Scope: M · P0

- [x] **Task 16: Atomic commits**
  - Group: (1) scripts+state+gitignore, (2) hooks+wiring, (3) stage skills, (4) stubs, (5) rewire, (6) docs. Không attribution.
  - Acceptance: `git log` sạch, mỗi commit 1 logical change.
  - Scope: S · P0

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hook blocking không được Devin hỗ trợ | Med | Spike Task 0 trước; design chịu warn-only (real enforcement ở transition-refuse) |
| Stage skills quá dài → mega-skill | Med | ≤500 ceiling + `references/`; write-skill review sau mỗi skill |
| Grep sweep sót dangling ref ở file ít ai đọc | Med | sweep cả `docs/` + `.agents/` + `tasks/` không chỉ skills |
| `pipeline-state.json` merge conflict 2 session | Low | chấp nhận (accepted risk trong spec); atomic write qua helper |
| Backlog schema đổi → pick-off resume lệch | Med | mapping legacy enumerate trong Task 9 + test resume bằng fixture |
| In-flight item `pre-watch-primer` (main worktree) | Low | worktree riêng chính là lý do; merge về sau khi nó ship hoặc cherry-pick docs |

## Open Questions

- Blocking verdict (Task 0) → spec revision log + hooks table finalize.
- `pipeline-state.json` tracked — revisit nếu merge conflict phiền (chuyển gitignored + rebuild-from-artifacts).
