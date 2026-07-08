# Loop Engineering Map — Cell

> **Bản đồ loop model** áp dụng vào Cell extension. Source: [Addy Osmani](https://addyosmani.com/blog/loop-engineering/) + [Louis Bouchard](https://www.louisbouchard.ai/loop-engineering/) + [The AI Corner](https://www.the-ai-corner.com/p/loop-engineering-coding-agents-2026).
> **Mục đích**: visual map → anh + em tối ưu từng primitive.
> **Cập nhật**: mỗi khi primitive status thay đổi.

---

## Loop overview — recursive goal

```
                        ┌─────────────────────────────────────────┐
                        │                                         │
                        │   LOOP (recursive goal)                 │
                        │   "iterate until stopping condition"    │
                        │                                         │
                        ▼                                         │
                   ┌─────────┐                                    │
        trigger ──▶│ DISCOVER│                                    │
                   │  (1)    │                                    │
                   └────┬────┘                                    │
                        │                                         │
                        ▼                                         │
                   ┌─────────┐                                    │
                   │ IDEATE  │                                    │
                   │  (2)    │                                    │
                   └────┬────┘                                    │
                        │                                         │
                        ▼                                         │
                   ┌─────────┐         ┌─────────┐                │
                   │  BUILD  │◀────────│ VERIFY  │  fail → loop   │
                   │  (3)    │         │  (4)    │  back          │
                   └────┬────┘         └────┬────┘                │
                        │                   │                     │
                        │                   │ pass                │
                        │                   ▼                     │
                        │              ┌─────────┐                │
                        │              │  SHIP   │                │
                        │              │  (5)    │                │
                        │              └────┬────┘                │
                        │                   │                     │
                        │                   ▼                     │
                        │              stopping condition         │
                        │              ALL true? ─── yes ──▶ EXIT │
                        │                   │                     │
                        │                   no                    │
                        └───────────────────┘                     │
                                                                  │
                                                                  │
        stopping condition:                                       │
        ✓ npm run test:unit pass                                  │
        ✓ npx tsc --noEmit clean                                  │
        ✓ npm run lint clean                                      │
        ✓ browser verify pass (if browser-facing)                 │
        ✓ anh approve (if approval gate)                          │
                                                                  │
        hard brakes:                                              │
        • max 3 iterations → escalate anh                         │
        • no-progress detection → stop                            │
        • token/dollar budget → cap (TODO: explicit)              │
        • verification stronger than "done" → tests + sub-agent   │
```

## 5 giai đoạn — mục đích / input / output

### 1. DISCOVER
- **Mục đích**: Hiểu yêu cầu + codebase, tránh tái phạm lỗi cũ — clarify what/why.
- **Input**: Task từ anh (trigger) + `docs/2-architechture-system.md` (Bảng phụ thuộc + Function Index) + grep `docs/knowledge/` (past mistakes) + AGENTS.md (conventions).
- **Output**: Intent (inline hoặc `docs/intent/`) → cho IDEATE.

### 2. IDEATE
- **Mục đích**: Viết full spec (PRD self-contained) + quyết định structure + architecture trước khi code — decide before build + write test basis.
- **Input**: Intent từ DISCOVER + `docs/design-system/README.md` (UI features) + `src/` components (reuse) + `docs/adr/` (past decisions).
- **Output**: `docs/specs/spec-<feature>.md` (8 section self-contained: Objective + Tech Stack + Commands + Project Structure + Code Style + Testing Strategy + Boundaries + Success Criteria) + ADR (if arch lớn, cite trong spec) → cho BUILD + VERIFY + anh approval gate. **Spec = test basis cho VERIFY (loop exit condition).**

### 3. BUILD
- **Mục đích**: Viết code per spec, TDD inline (tests derive từ spec acceptance criteria), ponytail PRE-FILTER — implement minimum code that works. Read spec (1 file) — không load AGENTS.md.
- **Input**: Spec (`docs/specs/spec-<feature>.md`) + ADR (if arch lớn) + arch map + `docs/knowledge/` (grep keywords) + DS tokens.
- **Output**: `src/` code + `tests/` + updated arch map → cho VERIFY.

### 4. VERIFY
- **Mục đích**: Kiểm tra code đạt spec + safe + stable — agent viết code ≠ agent verify (maker-checker, check vs spec success criteria).
- **Input**: `src/` + `tests/` từ BUILD + spec (`docs/specs/spec-<feature>.md` — acceptance criteria + success criteria = test basis) + quality gates (npm test, tsc, lint) + MCP browser.
- **Output**: Pass/fail → pass cho SHIP, fail loop back BUILD (fix → VERIFY again, max 3).

### 5. SHIP
- **Mục đích**: Atomic commit + update state on disk + extract principle — agent forgets, repo doesn't.
- **Input**: Verified `src/` + `tests/` từ VERIFY (pass) + `git diff --name-only` (what changed).
- **Output**: Git commit + updated state (arch map 3 chỗ, wiki, glossary, `docs/knowledge/` if principle, `docs/adr/` if arch change) → cho session sau (memory) + anh.

---

## 5 primitives + 1 memory — Cell map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOOP ENGINEERING PRIMITIVES                     │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  AUTOMATIONS │  │  WORKTREES   │  │   SKILLS     │                   │
│  │  (heartbeat) │  │  (isolate)   │  │  (codify)    │                   │
│  │              │  │              │  │              │                   │
│  │  STATUS: 30% │  │  STATUS: 10% │  │  STATUS: 70% │                   │
│  │  ▓░░░░░░░░░  │  │  ▓░░░░░░░░░  │  │  ▓▓▓▓▓▓▓░░░  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   PLUGINS    │  │  SUB-AGENTS  │  │   MEMORY     │                   │
│  │  (connect)   │  │  (verify)    │  │  (state)     │                   │
│  │              │  │              │  │              │                   │
│  │  STATUS: 90% │  │  STATUS: 50% │  │  STATUS: 95% │                   │
│  │  ▓▓▓▓▓▓▓▓▓░  │  │  ▓▓▓▓▓░░░░░  │  │  ▓▓▓▓▓▓▓▓▓░  │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                         │
│  OVERALL: ~65-70%                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Primitive 1 — AUTOMATIONS (heartbeat) — 30%

```
TRIGGER → loop wakes up → discovery + triage
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| Manual trigger (task đến) | Session-based — anh gửi task = 1 iteration | ✅ done | — |
| Cron schedule | Chưa setup | ❌ missing | GitHub Actions cron daily triage |
| PR trigger | Chưa | ❌ missing | PR open → loop review |
| CI fail trigger | Chưa | ❌ missing | CI fail → loop fix |
| `/goal` run-until-done | Stopping condition explicit trong doc | 🟡 doc only | Chưa test chạy thật |
| Triage inbox | Chưa | ❌ missing | File hoặc MCP Linear |

**Tối ưu**: setup GitHub Actions cron daily triage (future, khi có CI/CD)

---

## Primitive 2 — WORKTREES (isolate) — 10%

```
PARALLEL agents → git worktree → không đụng file
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| `git worktree add` | Chưa dùng | ❌ missing | Test trên 1 parallel feature |
| Sub-agent isolation | `run_subagent` có `isolation` concept | 🟡 doc only | Chưa test |
| Parallel features | Cell = 1-person, ít parallel | 🟡 low need | Khi có 2 feature song song |

**Tối ưu**: khi có 2 feature song song → `git worktree add ../cell-feature-a` + `../cell-feature-b`

---

## Primitive 3 — SKILLS (codify) — 70%

```
STOP re-explaining project every session → SKILL.md
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| Skills folder | `.agents/skills/` — 40 folders | ✅ exists | Quá nhiều |
| Curate 40 → 17 (6 core + 11 trigger) | AGENTS.md matrix core/trigger/cut | ✅ doc done | 23 folder chưa xóa. `spec-driven-development` move từ cut → core (IDEATE mặc định) |
| SKILL.md format | Tất cả skills có SKILL.md | ✅ done | — |
| Dense, one-skill-one-task | Đa số OK | 🟡 some too big | Audit density |
| Skill index | Chưa build | ❌ missing | Build index (Louis Bouchard khuyên) |
| Implicit invocation | Skill description routing | 🟡 works | Tighten descriptions |

**Tối ưu**:
1. Xóa 23 skill folders cut khỏi pipeline (cleanup)
2. Build skill index (`docs/skills-index.md` hoặc `.agents/skills/INDEX.md`)
3. Audit SKILL.md density — dense, không fill context

---

## Primitive 4 — PLUGINS/CONNECTORS (connect) — 90%

```
AGENT → MCP server → external tools
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| edge-devtools MCP | ✅ available | ✅ done | — |
| chrome-devtools MCP | ✅ available | ✅ done | — |
| git MCP | ✅ available | ✅ done | — |
| playwright MCP | ✅ available | ✅ done | — |
| GitHub MCP | Chưa | 🟡 optional | Khi cần PR/issue automation |
| Linear MCP | Chưa | 🟡 optional | Khi cần triage board |

**Tối ưu**: đã đủ cho Cell. Add GitHub MCP khi setup automations.

---

## Primitive 5 — SUB-AGENTS (maker-checker) — 50%

```
MAKER (agent viết code) ≠ CHECKER (agent verify)
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| `run_subagent` tool | ✅ available | ✅ done | — |
| Sub-agent profiles | subagent_explore, subagent_general, cavecrew | ✅ done | — |
| VERIFY phase doc | AGENTS.md + SKILL.md document maker-checker | ✅ doc done | — |
| Independent check execution | Chưa chạy test thật | ❌ missing | Test trên 1 feature |
| Max 3 rounds → escalate | Documented | 🟡 doc only | Chưa test |

**Tối ưu**: chạy `run_subagent` verify thật trên options redesign (test lý thuyết → thực hành)

---

## Primitive +1 — MEMORY (state) — 95%

```
AGENT forgets between sessions → REPO doesn't → state on disk
```

| Component | Cell hiện tại | Status | Gap |
|---|---|---|---|
| AGENTS.md (cross-session) | ✅ full | ✅ done | — |
| docs/2-architechture-system.md (arch map) | ✅ full | ✅ done | — |
| docs/knowledge/ (principles) | ✅ exists | ✅ done | — |
| docs/adr/ (decisions) | ✅ exists | ✅ done | — |
| docs/0-wiki.md (mục lục) | ✅ exists | ✅ done | — |
| docs/1-share-language.md (glossary) | ✅ exists | ✅ done | — |
| Progress file (what's done/next) | Chưa explicit | 🟡 todo_write thay | Optional: persistent progress file |

**Tối ưu**: đã đủ. Optional: persistent progress file cho long-running loops.

---

## Trigger + Verifiable goal (cần trước mọi thứ)

### Trigger — 60%

| Loại | Cell | Status |
|---|---|---|
| Manual (anh gửi task) | ✅ | done |
| Schedule (cron) | ❌ | missing |
| Event (PR/CI/Slack) | ❌ | missing |

### Verifiable goal — 95%

| Loại | Cell | Status |
|---|---|---|
| Deterministic (tests/lint/tsc) | ✅ | done |
| Browser verify | ✅ | done |
| Anh approve | ✅ | done |
| Reviewer model (softer) | 🟡 sub-agent | doc done, chưa test |

---

## Hard brakes — 60%

| Brake | Cell | Status |
|---|---|---|
| Max iterations (3) | ✅ | done |
| Verification stronger than "done" | ✅ tests + sub-agent | done |
| No-progress detection | ❌ | missing |
| Token/dollar budget | ❌ | missing |

**Tối ưu**: add no-progress detection + token budget explicit trong AGENTS.md

---

## Stay the engineer — 85%

| Trách nhiệm anh | Cell | Status |
|---|---|---|
| Read what it shipped | ✅ review output | done |
| Own the quality | ✅ approval gates | done |
| Write/control skills | ✅ anh approve skill changes | done |
| Define stop conditions | ✅ stopping condition do anh viết | done |
| Define precise goal | ✅ task do anh đưa | done |

---

## Tối ưu roadmap (theo impact)

| # | Primitive | Việc | Impact | Effort | Status |
|---|---|---|---|---|---|
| 1 | Skills | Xóa 23 skill folders cut | cao (giảm cognitive load) | thấp | pending |
| 2 | Sub-agents | Chạy `run_subagent` verify thật trên options redesign | cao (test lý thuyết) | trung | pending |
| 3 | Skills | Build skill index | cao (Louis Bouchard khuyên) | trung | pending |
| 4 | Hard brakes | Add no-progress detection + token budget | trung | thấp | pending |
| 5 | Automations | Setup GitHub Actions cron daily triage | trung | cao | future |
| 6 | Worktrees | Test `git worktree` khi có parallel feature | thấp | thấp | future |
| 7 | Memory | Persistent progress file cho long-running loops | thấp | thấp | optional |

---

## Scorecard

```
PRIMITIVE          STATUS    SCORE
─────────────────────────────────────
Automations        ▓░░░░░░░░░  30%
Worktrees          ▓░░░░░░░░░  10%
Skills             ▓▓▓▓▓▓▓░░░  70%
Plugins            ▓▓▓▓▓▓▓▓▓░  90%
Sub-agents         ▓▓▓▓▓░░░░░  50%
Memory             ▓▓▓▓▓▓▓▓▓░  95%
─────────────────────────────────────
Trigger            ▓▓▓▓▓▓░░░░  60%
Verifiable goal    ▓▓▓▓▓▓▓▓▓░  95%
Hard brakes        ▓▓▓▓▓▓░░░░  60%
Stay engineer      ▓▓▓▓▓▓▓▓░░  85%
─────────────────────────────────────
OVERALL (theory)   ▓▓▓▓▓▓▓░░░  ~65-70%
OVERALL (exec)     ▓▓▓░░░░░░░  ~30-40%
```

> **Lý thuyết 65-70%, thực hành 30-40%** — gap = chưa chạy loop thật trên feature nào.
