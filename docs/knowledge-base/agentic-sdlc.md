# Agentic SDLC — Tài liệu chuẩn

> Tổng hợp từ nguồn chính thức của Microsoft, AWS, Red Hat, Sonar, Deloitte, arxiv.
> Mỗi claim đều có cite URL. Không đoán.
> Đọc kèm: `docs/knowledge-base/sdlc-flow.md` (SDLC truyền thống 7 pha).

---

## Mục lục

1. [Định nghĩa](#1-định-nghĩa)
2. [Nguồn gốc — vì sao xuất hiện](#2-nguồn-gốc--vì-sao-xuất-hiện)
3. [5 nguyên lý cốt lõi](#3-5-nguyên-lý-cốt-lõi)
4. [Pipeline — 4 ông lớn, 4 cách cắt pha](#4-pipeline--4-ông-lớn-4-cách-cắt-pha)
5. [Vai trò con người — shift, không biến mất](#5-vai-trò-con-người--shift-không-biến-mất)
6. [Guardrail — trust nhưng constrain](#6-guardrail--trust-nhưng-constrain)
7. [Metric & tác động](#7-metric--tác-động)
8. [Sơ đồ tổng hợp](#8-sơ-đồ-tổng-hợp)
9. [So sánh Agentic SDLC vs SDLC truyền thống](#9-so-sánh-agentic-sdlc-vs-sdlc-truyền-thống)
10. [Takeaway cho Tihoka](#10-takeaway-cho-Tihoka)
11. [Tihoka Agentic SDLC Runbook](#11-Tihoka-agentic-sdlc-runbook)
12. [Nguồn tài liệu](#12-nguồn-tài-liệu)

---

## 1. Định nghĩa

**Agentic SDLC** = vòng đời phát triển phần mềm mà **AI agent là executor tự chủ** ở ≥1 pha, dưới **con người oversight** (không phải autocomplete, không phải fully autonomous).

| Thuật ngữ | Ai đặt tên | Đặc điểm |
|---|---|---|
| **Agentic SDLC** | Red Hat, Sonar, academic | Tên chung nhất |
| **AI-DLC** (AI-Driven Development Lifecycle) | AWS | AI ở trung tâm, 3 pha Inception/Construction/Operations |
| **Agentic DevOps** | Microsoft | Agent xuyên suốt developer lifecycle, không chỉ code |

> AWS: "To truly harness AI's power, we need to reimagine our entire approach to the software development lifecycle."
> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

### Phân biệt 3 cấp độ AI trong SDLC

| Cấp độ | Mô hình | Con người | Ví dụ |
|---|---|---|---|
| **AI-assisted** | Autocomplete, chat suggestion | Viết từng dòng, AI gợi ý | GitHub Copilot autocomplete |
| **Agentic** | Agent nhận task → plan → execute → iterate → submit | Review ở critical gate | Agent coding tools (e.g., Copilot coding agent) |
| **Fully autonomous** | Agent tự quyết + tự làm | Không cần | Chưa tồn tại ở production |

> Sonar: "This is different from AI-assisted development, where a software developer uses autocomplete or chat-based suggestions as a productivity aid."
> Nguồn: https://www.sonarsource.com/resources/library/what-is-agentic-sdlc/

---

## 2. Nguồn gốc — vì sao xuất hiện

### 2.1. Bão hòa code completion (2022-2024)

- HumanEval/MBPP (single-function synthesis) saturated >90% pass@1 by 2024.
- SWE-bench (real GitHub issues, 2,294 tasks, 12 repos) — ban đầu không system nào giải >2%.
- **Breakthrough**: không phải model lớn hơn, mà **scaffolding quanh model** thay đổi. SWE-agent (Princeton, NeurIPS 2024) — custom agent-computer interface (ACI) nâng resolution 2% → 12.5% với cùng model.
- **Insight**: interface design cho agent quan trọng ngang model capability.

> arxiv: "The performance ceiling broke not because models became larger, but because the scaffolding around them changed."
> Nguồn: https://arxiv.org/html/2604.26275

### 2.2. Hạn chế của AI-assisted và AI-autonomous

| Approach | Vấn đề |
|---|---|
| AI-assisted | Constrain capability, reinforce outdated inefficiency |
| AI-autonomous (no human) | Suboptimal quality — AI thiếu business context |
| **Agentic (human-on-the-loop)** | Giải cả 2 — AI execute, human gate |

> AWS: "Both these approaches have produced suboptimal results in terms of velocity and software quality that AI-DLC aims to address."
> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

### 2.3. SDLC truyền thống thiết kế cho human, không cho agent

- PO/dev/architect dành phần lớn thời gian cho non-core: planning, meetings, rituals.
- Retrofitting AI as assistant = giữ inefficiency cũ + thêm AI lên trên.
- Cần **reimagine** toàn bộ SDLC với AI ở trung tâm.

> AWS: "Our existing software development methods are designed for human-driven, long running processes."
> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

---

## 3. 5 nguyên lý cốt lõi

### 3.1. AI-assisted ≠ Agentic

| | AI-assisted | Agentic |
|---|---|---|
| **Mô hình** | Autocomplete, chat suggestion | Agent nhận task → plan → execute → iterate → submit |
| **Con người** | Viết từng dòng, AI gợi ý | Con người review, agent viết |
| **Độ tự chủ** | 0 (con người drive) | Cao (agent drive, human gate) |
| **Output** | 1 dòng / 1 block | Multi-file, cross-repo, với test |

> AWS: "Simply retrofitting AI as an assistant not only constrains its capabilities but also reinforces outdated inefficiencies."
> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

### 3.2. "On the loop" thay vì "In the loop"

| | In the loop (truyền thống) | On the loop (agentic) |
|---|---|---|
| **Con người** | Gate **mỗi** bước | Gate **chỉ** ở điểm quan trọng |
| **Agent** | Không có | Chạy tự chủ giữa các gate |
| **Scale** | Bottleneck | Scale được |
| **Vai trò** | Operator | Pilot — steer ở critical gate |

> Red Hat: "The system runs autonomously, and humans act as pilots. We steer the process at critical gates rather than manually approving every minor action."
> Nguồn: https://www.redhat.com/en/blog/building-future-core-concepts-red-hats-agentic-software-development-life-cycle

### 3.3. Spec-driven — code sinh từ spec, không phải từ chat mơ hồ

Pipeline chuẩn (Microsoft `agentic-sdlc-starter`):

```
PRD + User Stories
      ↓
  01 Assessor   → Finds gaps, ambiguities, conflicts
      ↓
  01b Resolver  → Answers questions from source docs
      ↓
  02 Specifier  → Generates machine-readable specs
      ↓
  03 Generator  → Produces code from specs only
      ↓
  04 Validator  → Reviews code against specs + guardrails
```

| Bước | Làm gì | Output |
|---|---|---|
| 01 Assessor | Analyze input, find gaps | `assessment-report.md` |
| 01b Resolver | Resolve questions from source docs | `assessment-decisions.md` |
| 02 Specifier | Generate machine-readable specs | `specs/*.md` |
| 03 Generator | Produce code from specs only | `src/` |
| 04 Validator | Review code vs specs + guardrails | `review-checklist.md` |

> Microsoft: "Each step is a specialized agent prompt that reads structured inputs and produces structured outputs."
> Nguồn: https://github.com/microsoft/agentic-sdlc-starter/

### 3.4. Verification debt — cái bẫy lớn nhất

Agent sinh code nhanh → PR voluminous → **con người không review kịp** → chất lượng tụt.

| Vấn đề | Giải pháp |
|---|---|
| PR quá nhiều, review thủ công không theo kịp | Automated deterministic verification |
| Code analysis warnings tăng | Guardrail trong pipeline |
| Architectural violations | Validator agent review vs spec |
| Security risks | Security scan trong eval gate |

> Sonar: "AI agents significantly increase development velocity but can trigger 'verification debt' and an increase in code analysis warnings."
> Sonar AC/DC framework: Guide → Generate → Verify → Solve.
> Nguồn: https://www.sonarsource.com/resources/library/what-is-agentic-sdlc/

### 3.5. Adversarial review — không để agent tự review mình

| Nguyên tắc | Lý do |
|---|---|
| Generation và review tách biệt | Tránh anchoring bias |
| Evaluation gate mỗi change | Bắt regression sớm |
| Constrain trước, trust sau | Guardrail deterministic, model không override được |

> Red Hat: "Nothing should review its own work. By strictly separating generation from review, we reduce anchoring bias and maintain a significantly higher standard of quality."
> Nguồn: https://www.redhat.com/en/blog/building-future-core-concepts-red-hats-agentic-software-development-life-cycle

---

## 4. Pipeline — 4 ông lớn, 4 cách cắt pha

### 4.1. AWS — AI-DLC (3 pha)

| Pha | Agent làm | Con người làm |
|---|---|---|
| **Inception** | Transform business intent → requirements, stories, units | "Mob Elaboration" — validate câu hỏi và proposal của AI |
| **Construction** | Propose architecture, domain model, code, tests | "Mob Construction" — clarify technical decisions real-time |
| **Operations** | Manage IaC, deployments | Oversight |

**Đặc điểm riêng**:
- AI tạo plan → hỏi clarification → implement chỉ sau human validation. Pattern lặp cho mỗi SDLC activity.
- Thuật ngữ mới: sprint → "bolt" (giờ/ngày thay vì tuần), epic → "Unit of Work".
- Persistent context: AI lưu plans, requirements, design artifacts vào repo.

> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

### 4.2. Red Hat — 4 pha + Org Pulse

| Pha | Agent làm | Con người làm |
|---|---|---|
| **Plan** | Analyze RFE → technical strategy → Epics | Verify feature spec accuracy |
| **Build** | Generate code drafts, auto-fix, assist review | Engineering review |
| **Verify** | Auto test plan generation, continuous eval gates | Definition of "ready for release" |
| **Ship** | Build onboarding, docs, integration testing, release | Final PR review |

**Đặc điểm riêng**:
- **Org Pulse** (dashboard trên OpenShift AI) — metric tracking từ Jira + GitHub + GitLab. Source of truth cho AI Engineering org.
- "On the loop" philosophy — human steer ở critical gate, không gate mỗi bước.
- Engineer role **elevate**, không diminish: focus customer problems, shaping solutions, domain judgment.

> Nguồn: https://www.redhat.com/en/blog/building-future-core-concepts-red-hats-agentic-software-development-life-cycle

### 4.3. Microsoft — Agentic DevOps (xuyên suốt)

| Pha | Tool |
|---|---|
| Idea → code | GitHub Copilot agent mode (scaffold, iterate, resolve, host) |
| Coding | GitHub Copilot coding agent (delegate feature/bug task) |
| Review | Automated PR review |
| Operations | Azure SRE agent |
| Modernization | Copilot app modernization (.NET/Java) |

**Đặc điểm riêng**:
- "Agent factory" — agents collaborate across entire SDLC.
- Customer Zero series — Microsoft tự dùng trước khi đưa cho customer.
- Innersource culture — teams share agents và knowledge.

> Microsoft: "An agent factory is what comes next, where agents collaborate across the entire software development lifecycle, systems learn and improve each cycle."
> Nguồn: https://developer.microsoft.com/blog/learn-from-microsoft-transform-software-development-through-an-agentic-platform/

### 4.4. Sonar — AC/DC (4 bước)

| Bước | Làm gì |
|---|---|
| **Guide** | Agent đọc spec, guardrail → hiểu context |
| **Generate** | Sinh code |
| **Verify** | Deterministic check (lint, test, security, architecture) |
| **Solve** | Auto-remediate khi verify fail |

**Đặc điểm riêng**:
- Focus vào **code quality** — verification debt là core concern.
- Deterministic verification thay manual review.
- Architectural violations + security risks trong pipeline.

> Nguồn: https://www.sonarsource.com/resources/library/what-is-agentic-sdlc/

---

## 5. Vai trò con người — shift, không biến mất

### 5.1. Before vs After

| Trước (traditional) | Sau (agentic) |
|---|---|
| Viết code từng dòng | Architecture, design, planning, review |
| Manual review mỗi PR | Review ở critical gate |
| Implementation, boilerplate | Understanding customer problems |
| — | Shaping solutions, domain judgment |
| — | Validate business intent |

> Red Hat: "This shift doesn't diminish the engineer's role—it elevates it."
> AWS: "AI systematically creates detailed work plans, actively seeks clarification and guidance, and defers critical decisions to humans."

### 5.2. 3 việc con người KHÔNG thể delegate

| Việc | Vì sao | Căn cứ |
|---|---|---|
| **Business intent definition** | Chỉ con người có contextual understanding + business knowledge | AWS blog |
| **Critical decision** | ROI, priority, scope — agent không có business context | AWS blog |
| **Final sign-off** | Trust nhưng verify — adversarial review cần human final call | Red Hat blog |

---

## 6. Guardrail — trust nhưng constrain

### 6.1. 3 nguyên lý reliability (Red Hat)

| Nguyên tắc | Ý nghĩa |
|---|---|
| **Constrain, then trust** | Deterministic guardrail — model không override được. Focus creativity nơi có value |
| **Adversarial review** | Generation ≠ review. Tách biệt để tránh anchoring bias |
| **Evaluations gate every change** | Eval harness grounded in real-world datasets. Gate trước ship + trước skill update |

> Red Hat: "We don't simply let agents run unchecked, we build reliability into the foundation."
> Nguồn: https://www.redhat.com/en/blog/building-future-core-concepts-red-hats-agentic-software-development-life-cycle

### 6.2. Verification layer (Sonar)

| Layer | Check gì |
|---|---|
| Lint/format | Code style |
| Unit test | Logic correctness |
| Integration test | Module boundary |
| Security scan | Vulnerability |
| Architecture check | Violation vs spec |
| PR review (automated) | Holistic quality |

> Sonar: "Maintaining code quality requires moving from manual reviews to automated, deterministic verification."
> Nguồn: https://www.sonarsource.com/resources/library/what-is-agentic-sdlc/

---

## 7. Metric & tác động

### 7.1. Con số (Deloitte)

| Metric | Giá trị |
|---|---|
| NPD cycle compression | lên đến **50%** |
| Software dev task acceleration | **30-40%** |
| Timeline chuyển đổi | "extremely fast-paced" so với Agile/cloud |

> Deloitte: "Generative AI coupled with agentic AI represents the next such shift, except this one is extremely fast-paced."
> Nguồn: https://www.deloitte.com/content/dam/assets-zone3/us/en/docs/services/consulting/2026/agentic-ai-impact-on-software-engineering.pdf

### 7.2. Benefit (AWS AI-DLC)

| Benefit | Mô tả |
|---|---|
| **Velocity** | Task tuần → giờ/ngày. AI generate + refine artifacts |
| **Innovation** | AI heavy-lifting → con người focus creative solution |
| **Quality** | Continuous clarification + org-specific standards (coding, design, security) |
| **Market responsiveness** | Rapid cycle → adapt feedback nhanh |
| **Developer experience** | Shift từ routine coding → critical problem-solving. Giảm cognitive load |

> Nguồn: https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/

---

## 8. Sơ đồ tổng hợp

```
┌──────────────────────────────────────────────────────────────┐
│  CON NGƯỜI (business gate — không delegate)                  │
│                                                               │
│  Idea → BA elicitation → spec auto-review pass → UAT sign-off│
│         (intent)        (critical decision)     (final call)  │
└─────────────┬────────────────────────────────────┬───────────┘
              │                                    │
              ▼                                    ▲
┌──────────────────────────────────────────────────────────────┐
│  AGENTIC PIPELINE (agent executor, on the loop)              │
│                                                               │
│  Plan      ─ Agent analyze RFE → strategy → epics            │
│  Specify   ─ Agent generate machine-readable spec            │
│  Generate  ─ Agent produce code from spec                    │
│  Verify    ─ Agent + deterministic gate (test/lint/security) │
│  Solve     ─ Agent auto-remediate on verify fail             │
│  Ship      ─ Agent deploy + docs                             │
│  Operate   ─ Agent monitor + SRE                             │
│                                                               │
│  Persistent context: plans, requirements, design → repo      │
└──────────────────────────────────────────────────────────────┘
              │                                    │
              ▼                                    │
┌──────────────────────────────────────────────────────────────┐
│  GUARDRAIL (deterministic, model không override)             │
│                                                               │
│  Adversarial review (gen ≠ review)                           │
│  Eval gate mỗi change (real-world dataset)                   │
│  Org Pulse / dashboard — metric tracking (Jira+GitHub+GitLab)│
│  Verification layer: lint + unit + integration + security    │
│                      + architecture + automated PR review    │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. So sánh Agentic SDLC vs SDLC truyền thống

| Pha | SDLC truyền thống | Agentic SDLC |
|---|---|---|
| **Requirements** | BA phỏng vấn + document | Agent transform intent → requirements, human validate ("Mob Elaboration") |
| **Analysis** | System Analyst quy đổi | Agent propose architecture, human clarify real-time |
| **Design** | Architect + UX Designer | Agent propose, human review |
| **Coding** | Developer viết từng dòng | Agent generate multi-file, human review PR |
| **Testing** | QA manual + automated | Agent generate test plan + eval gate, human define "ready for release" |
| **Deployment** | DevOps manual | Agent manage IaC + deploy, human oversight |
| **Maintenance** | Team fix bug | Agent SRE + auto-remediate, human steer |
| **Review** | Manual review mỗi PR | Automated deterministic + adversarial, human final call |
| **Cycle** | Sprint (tuần) | Bolt (giờ/ngày) |
| **Human role** | Operator (in the loop) | Pilot (on the loop) |
| **Context** | Trong đầu dev + meeting notes | Persistent trong repo |

---

## 10. Takeaway cho Tihoka

> Audit 2026-09-17 — đo bằng **artifact thật trong repo**, không đo bằng skill tồn tại trên giấy.

| Nguyên lý agentic SDLC | Tihoka hiện có | Bằng chứng trong repo | Trạng thái |
|---|---|---|---|
| **Spec-driven** | `spec-driven-development` + `elicitation` auto-spec (Autonomous Mode) | 37 specs trong `docs/specs/` — nhưng `immersion-playback` commit intent+spec+plan+code trong **1 commit** (b3770b8f) → spec-as-record, chưa chứng minh spec-as-gate | ⚠️ Artifact đầy đủ, ordering chưa chặt |
| **On the loop** | AGENTS.md gate: typecheck + test:unit + build + browser verify trước commit | `pre-commit-gate` skill; mandate trong AGENTS.md | ✅ Đã có |
| **Adversarial review** | `doubt-driven-development` + `spec-review-stakeholder` + `pre-commit-gate` Step 1.6 warn | Chỉ **3/37 spec** (~8%) có artifact trong `docs/reviews/` — dir không đổi từ 2026-09-12, adoption vẫn 0 sau 5 ngày warn | ⚠️ Soft gate — warn không đủ, cân nhắc hook block |
| **Verification debt** | Deterministic gate local + CI | `design-system-ci.yml`: typecheck + DS unit + full unit (non-blocking) + lint (non-blocking) + icons + 2 builds + inventory + health report + e2e xvfb | ✅ Đã có (technical) |
| **Guardrail** | AGENTS.md + Ponytail plugin rule + `design-system-guardian` + check scripts + 2 hooks | `check-icons` + `check-design-system-css` trong CI; `.devin/hooks.v1.json`: PostToolUse regen skill index + UserPromptSubmit ponytail mode-tracker | ✅ Đã có |
| **Persistent context trong repo** | `docs/` + `tasks/` + `.devin/briefs/` + learning atoms | 27 ADR, 34 intent docs, 2 briefs, plans/todos/reports trong `tasks/`, 115 experience + 1 process atoms | ✅ Đã có |
| **Elicitation đa kỹ thuật** | `elicitation` 9-step: observation + interview + prototype (`idea-to-interface`) | 34 files `docs/intent/` gồm design-brief + component-mapping | ✅ Đã có (từ 2026-08-29) |
| **Skill catalog integrity** | `scripts/update-skill-index.mjs` + PostToolUse hook | 48 skills `.agents/skills/` = 48 trong `index.json` — đồng bộ disk↔index. **Nhưng audit 2026-09-17 phát hiện layer thứ 3:** 2 skills (`autonomous-pipeline`, `audit-ui-ux-then-redesign`) có `: ` trong description không quote → YAML loader của CLI drop thầm lặng, không invoke được dù index vẫn liệt kê. Index generator parse bằng regex ≠ parser thật của loader → check 2 parser độc lập là check giả | ⚠️ Đã fix frontmatter + thêm validator vào regen script (2026-09-17) |
| **Eval gate mỗi change** | CI `e2e` job (full Playwright) + full `test:unit`/`lint` non-blocking | Full suite vẫn non-blocking — nợ test OCR/dictionary chưa sạch | ⚠️ Soft gate |
| **Post-ship business review** | `shipping-and-launch` § Post-Launch Business Review | Human confirm "đúng thứ cần build" vs spec Success Criteria | ✅ Đã có (2026-09-13) — chưa có track record |
| **Pipeline retrospective** | `learning-and-apply` type `process` + `process/` store | 1 atom: `process-generated-catalog-drift` — 4 ngày không có atom mới | ⚠️ Có cơ chế, chưa thành thói quen |
| **Stakeholder sign-off** | `elicitation` step 9 = async veto + `shipping-and-launch` post-launch review | Blocking gate chỉ còn 2: intent frame + business outcome | ✅ Đã có (2026-09-13) |
| **Parallel orchestration** | `autonomous-pipeline` — `subagent_general` lanes + `subagent_explore` verify + git worktree isolation (`../Tihoka-worktrees/`) | Custom subagent profile: `vision-reader` (`.devin/agents/`); built-in `subagent_explore`/`subagent_general`/`spec-reviewer`. **Skill này đã chết 4 ngày** (2026-09-13 → 17): frontmatter YAML invalid → loader drop → router trỏ tới skill không invoke được; fix bằng quote description | ⚠️ Đã hồi sinh 2026-09-17 — vẫn chưa có track record chạy thật |

Tihoka implement **~90%** nguyên lý agentic SDLC. Khoảng trống còn lại không nằm ở "thiếu skill" mà ở **thiếu enforcement**: pipeline chạy nhờ agent tự nhớ route (soft), chưa có hook nào ép transition (hard). Xem §10.3.

Audit 2026-09-17 bổ sung 1 lớp gap nữa — **silent failure ở ranh giới catalog↔loader**: mọi check integrity đều so index với disk, nhưng không check nào mô phỏng cái loader thật parse thế nào. `autonomous-pipeline` — mắt xích orchestration duy nhất — đã chết 4 ngày mà không ai biết, đúng pattern của atom `process-generated-catalog-drift` nhưng ở layer sâu hơn: không phải index stale, mà là **parser giả validate cho parser thật**.

### 10.1. Roadmap cải tiến (theo ROI) — trạng thái sau 2026-09-13

| # | Cải tiến | Vì sao | Trạng thái |
|---|---|---|---|
| 1 | `pre-commit-gate` thêm scope check: `docs/specs/*` đổi mà không có artifact mới trong `docs/reviews/` → warn | Review adoption 9% = adversarial principle chỉ trên giấy; đây là lỗ hổng lớn nhất | ✅ Done — Step 1.6 (warn) |
| 2 | CI thêm job full `npm run lint` + `npm run test:unit` | "Evaluations gate every change" (Red Hat) — gate trước đây chỉ local, dễ skip | ✅ Done — non-blocking; **TODO: siết blocking khi suite green** |
| 3 | `learning-and-apply` thêm `type: "process"` cho pipeline lessons | Retro chỉ capture code-level; process drift không được học lại | ✅ Done — `process/` store + atom đầu tiên + validator |
| 4 | `shipping-and-launch` thêm post-ship step: human confirm business outcome | Đóng gap "did we build the right thing" | ✅ Done — § Post-Launch Business Review |
| 5 | `.devin/hooks.v1.json` → hook auto-regen `index.json` khi SKILL.md đổi | Enforcement bằng hook > convention — index stale 3 tuần là bằng chứng | ✅ Done — PostToolUse hook + `scripts/hook-skill-index.mjs` |
| 6 | `UserPromptSubmit` → ponytail mode-tracker (`scripts/hook-ponytail.mjs`) | Ponytail plugin (rules+skills) cần mode state — hook duy nhất biến `/ponytail` command thành context injection | ✅ Done (2026-09-17) — plugin `devin plugins install --local`, wrapper resolve plugin cache động |
| 7 | `SessionStart` hook → inject active `tasks/plan.md` + todo + debt count | Mỗi session agent phải tự nhớ đọc state — session priming biến nó thành automatic | ✅ Done (pipeline-redesign) — `hook-session-prime.mjs`: inject `pipeline-state.json` active item + stage pointer |
| 8 | `PreToolUse` hook → warn khi `edit` vào `docs/specs/*` mà không có review artifact mới | Step 1.6 warn adoption vẫn 8% sau 4 ngày — siết lên event-level (vẫn warn, không block, để giữ fail-open semantics) | ✅ Done (pipeline-redesign) — `hook-stage-guard.mjs`: warn khi edit `src/` trước stage hợp lệ, edit spec stale, edit state file tay |
| 9 | `PostCompaction` hook → re-inject AGENTS.md mandate + active plan | Context compaction làm mất mandate — "drift back to over-building" là chế độ hỏng đã biết của ponytail | ✅ Done (pipeline-redesign) — `hook-context-restore.mjs`: re-inject pipeline state sau compaction |
| 10 | `Stop` hook → block khi working tree dirty mà gates chưa chạy | "On the loop" chỉ đúng nếu điểm dừng được kiểm — hiện agent tự quyết khi nào stop | ✅ Done (pipeline-redesign) — `hook-stop-gate.mjs`: one-shot block (`stop_hook_active` guard) khi deliver item còn dirty + gates stale |
| 11 | `update-skill-index.mjs` validate frontmatter theo rule loader thật (unquoted `: `, thiếu `name`, thiếu frontmatter) → exit 1 | 2 skill chết thầm lặng 4 ngày chứng minh disk↔index sync không đủ — check phải bắt lỗi mà consumer thật sẽ gặp | ✅ Done (2026-09-17) — regen script tự fail-open qua hook nhưng exit 1 khi chạy tay/CI |
| 12 | `check-skills` trong CI hoặc pre-commit-gate: chạy `node scripts/update-skill-index.mjs` + `git diff --exit-code .agents/skills/index.json` | Biến "index + frontmatter hợp lệ" thành deterministic gate thay vì chỉ nhờ hook local | ✅ Done (pipeline-redesign) — `pre-commit-gate` Step 1.8 |

### 10.2. Rot đã fix trong audit 2026-09-13

- `index.json` stale (46 listed vs 38 disk, 8 phantom skill) → regen; PostToolUse hook chống tái phạm. Sau đó consolidate: 7 skill ở `.devin/skills` move hết về `.agents/skills` — single source of truth, index + hook chỉ quét `.agents/skills`.
- Router `using-agent-skills` trỏ `frontend-ui-engineering`, `api-and-interface-design`, `browser-testing-with-devtools` — không skill nào tồn tại → sửa về skill thật.
- `using-agent-skills` cite `references/definition-of-done.md` không tồn tại → trỏ về §11.3 runbook; `shipping-and-launch` See Also cite 4 file `references/` phantom → trỏ skill/doc thật.
- `testing-with-playwright` thiếu frontmatter → không index/trigger được → thêm frontmatter, giờ là canonical route cho browser-verify (`testing-extension-browser` chỉ còn cho interactive/stealth session).
- Doc này: section 12 đứng trước section 11, TOC thiếu runbook → renumber.

### 10.2b. Rot fix trong audit 2026-09-17

- `autonomous-pipeline` + `audit-ui-ux-then-redesign`: `description` chứa `: ` không quote → invalid YAML → CLI loader drop cả 2 khỏi danh sách invocable. `index.json` vẫn list đủ 48 vì generator parse bằng regex lỏng hơn loader thật. Fix: quote description + validator trong `update-skill-index.mjs` (exit 1 khi frontmatter không load được). Verify live: skill xuất hiện lại trong available_skills ngay trong session fix.
- `tasks/` hygiene: `plan-immersion-playback.md`, `plan-pre-tokenize-subtitle.md`, `todo-pre-tokenize-subtitle.md` nằm ở root `tasks/` thay vì `plans/`/`todos/` — convention "plan.md/todo.md active + thư mục archive" đang bị bypass bởi per-feature file. Cần quyết: hoặc siết rule, hoặc đổi convention thành "mọi plan theo feature, `plan.md` chỉ là pointer".
- Spec ordering: `b3770b8f` chứa cả intent + spec + plan + implementation của immersion-playback trong 1 commit → artifacts được tạo đủ nhưng không phải gate tuần tự. Spec-driven row trong §10 được đổi thành ⚠️ theo bằng chứng này.

### 10.2c. Pipeline redesign (branch `refactor/pipeline-redesign`)

- Gap gốc: pipeline chạy nhờ agent tự nhớ route (soft), thiếu enforcement; BA yếu về đặt câu hỏi (thiếu IIBA/BACCM); nhiều gate review rải rác; UI/UX không được quyết định trước implement (FAB: danh sách bo góc quá tròn, màu lệch design system).
- Fix: state machine `tasks/pipeline-state.json` + `scripts/pipeline-state.mjs` — transitions validate evidence **lúc gọi** (review fresh, journey structure, verdict `APPROVE*`, gates re-run thật ở `all` mode), không tin flag. Terminal `shipped`/`dropped`; `analyze → dropped` kill sớm qua `## Decision: no-go`.
- 4 stage skills: `pipeline-analyze` (BA: BACCM → stakeholders → root-cause → go/no-go → FURPS+ → stories → journey → logic), `pipeline-specify` (use-case requirements → flows/states → function/feature → traceability), `pipeline-design` (concepts → mockup → brief → component mapping, `check-design-brief.mjs` deterministic), `pipeline-deliver` (plan → engine `autonomous-pipeline` → gates → verify → ship). Driver: `idea-pick-off`.
- 6 skills cũ absorbed thành stubs — `/elicitation` vẫn resolve.
- 10 hooks trên 7 events (§10.3) — fail-open warn; enforcement thật nằm ở transition-refuse, đúng nguyên tắc "hook guardrail không phải correctness".

### 10.3. Primitives — rules / skills / hooks / subagents / plugins

> Pipeline không phải "dùng skill nào" mà là "primitive nào giữ phase nào". 5 primitives của Devin CLI có vai trò khác nhau căn bản — nhầm vai trò = pipeline mềm.

| Primitive | Bản chất | Vai trò trong pipeline | Tihoka đang dùng |
|---|---|---|---|
| **Rule** | Text luôn trong context, mọi turn | Luật bất biến: conventions, boundaries, mandate | `AGENTS.md` (project) + Ponytail plugin `AGENTS.md` |
| **Skill** | Playbook nạp on-demand khi task match | Tri thức chuyên sâu theo phase — không phải luật | 52 skills `.agents/skills/` + 6 `/ponytail:*` |
| **Hook** | Code chạy thật ở lifecycle event, fail-open | **Enforcement** — thứ duy nhất agent không skip được | 10 hooks trên 7 events (xem bảng event dưới) |
| **Subagent** | Agent con, context tách, quyền hẹp hơn | Fresh-eyes verify + parallel lanes | `vision-reader` (`.devin/agents/`) + `spec-reviewer{,-swe,-glm}` (`.agents/agents/`) + built-in `subagent_general`/`subagent_explore` |
| **Plugin** | Package gồm cả 4 thứ trên | Phân phối workflow qua git | `ponytail` v4.10.0 (`devin plugins install --local`) |

#### Bản đồ wiring hiện tại — cái gì nối cái gì

```
                    ┌─────────────────────────────────────┐
                    │ RULES (always-on, không tắt được)   │
                    │  AGENTS.md ── mandate + conventions │
                    │  ponytail AGENTS.md ── lazy ladder  │
                    └──────────────┬──────────────────────┘
                                   │
        SessionStart ──► hook-session-prime ──► inject pipeline
                    │                            state + stage
                    │                            (owner-session only —
                    │                             others get info line)
                    └──► hook-ponytail-activate ──► ponytail ruleset
                                                    theo level (plugin)
User prompt ──► UserPromptSubmit ──► hook-ponytail (mode tracker)
                    │
                    ▼
              Router (using-agent-skills) ──► stage check:
              `tasks/pipeline-state.json` stage quyết định
              pipeline-analyze → specify → design → deliver
                    │
                    ▼
        PreToolUse ──► hook-stage-guard ──► warn: src/ edit
                    trước stage, spec stale, state edit tay
                    (state-file guard universal; item warnings
                     owner-session only)
                    │
        write/edit ──► PostToolUse ──► hook-skill-index (regen)
        exec       ──► PostToolUse ──► hook-gates-tracker
                    │                  (ghi gates.*, bound session only)
                    │                └► hook-owner-bind
                    │                  (--owner <id> khớp owner.id
                    │                   → owner.sessionId = session_id)
                    │
                    ▼
        pipeline-state.mjs transition ──► ENFORCEMENT THẬT:
        validate evidence lúc gọi (review fresh, verdict,
        journey, gates re-run) — refuse = không đủ điều kiện
                    │
                    ▼
        PostCompaction ──► hook-context-restore (re-inject, bound only)
        Stop ──► hook-stop-gate (one-shot block, bound session only:
             dirty + gates stale)
        SessionEnd ──► hook-session-report (tasks/reports/)
                    │
                    ▼
              commit → CI (design-system-ci.yml)
```

#### Hook event surface — 8 events, dùng 7 (10 hooks: 3× PostToolUse)

| Event | Trạng thái | Đang làm |
|---|---|---|
| `SessionStart` | ✅ ×2 | `hook-session-prime` — inject pipeline state; resume-pointer chỉ cho bound owner session, session khác thấy info line · `hook-ponytail-activate` — chạy `ponytail-activate.js` của plugin (Devin không auto-load `hooks/claude-codex-hooks.json` của plugin): inject ruleset theo level + codebase map + ghi flag `~/.claude/ponytail-modes/<sha256(project)>` |
| `UserPromptSubmit` | ✅ | `hook-ponytail` — ponytail mode-tracker |
| `PreToolUse` | ✅ | `hook-stage-guard` — state-file-edit guard universal; item-scoped warnings (`src/` trước stage, spec stale) chỉ bound owner session |
| `PostToolUse` | ✅ ×3 | `hook-skill-index` (regen index khi SKILL.md đổi) + `hook-gates-tracker` (ghi `gates.*` chỉ từ bound session) + `hook-owner-bind` (exec `--owner <id>` khớp `owner.id` → `owner.sessionId = payload.session_id`) |
| `PermissionRequest` | ⬜ trống | — |
| `Stop` | ✅ | `hook-stop-gate` — one-shot block khi deliver dirty + gates stale, chỉ bound owner session |
| `PostCompaction` | ✅ | `hook-context-restore` — re-inject pipeline state, chỉ bound owner session |
| `SessionEnd` | ✅ | `hook-session-report` — append report `tasks/reports/` |

> Pattern sau redesign: hooks (fail-open warn) lo observability + nhắc việc; **correctness enforcement nằm ở `pipeline-state.mjs transition`** — code path duy nhất validate evidence lúc gọi và refuse khi thiếu. Hook block chỉ dùng one-shot ở `Stop` để inject reason, không làm gate thật.
>
> Session binding (2026-10-10): `owner.sessionId` gắn pipeline item với đúng session — trước đó mọi hook đều broadcast cho mọi session, kéo session không liên quan vào việc của owner (stop-gate block session lạ, gates-tracker ghi gates của session khác lên item). Bind chỉ xảy ra khi lệnh có `--owner <id>` tường minh khớp `owner.id` — mutate qua `human` override không chứng minh identity nên không bind. Handoff/release tạo owner object mới → sessionId tự reset; owner mới re-bind ở lệnh `--owner` đầu tiên. Item unowned/unbound → không session nào bị ép gates (đúng yêu cầu "không kéo session lạ"), owner vẫn bị ép ngay sau khi bind.

#### Vì sao phân biệt 3 loại "instruction"

| Nếu viết sai chỗ | Hậu quả thật đã thấy ở Tihoka |
|---|---|
| Convention để trong skill (on-demand) | Agent không invoke skill → không biết rule tồn tại. Index stale 3 tuần (2026-09-13 audit) vì "phải regen" nằm trong skill text |
| Playbook dài để trong rule (always-on) | Context rot — AGENTS.md từng ép đọc 3 docs mọi task (~1,768 dòng forced), audit 2026-09-13 phải diet xuống conditional loading |
| Enforcement để trong rule/skill | Không ai ép — "phải review spec trước implement" viết trong AGENTS.md nhưng adoption 8% vì agent có thể skip |

**Quy tắc đặt đúng chỗ**: bất biến + ngắn → rule; dài + conditional → skill; "phải xảy ra" → hook; cần fresh eyes → subagent; muốn share → plugin.

---

## 11. Tihoka Agentic SDLC Runbook

> Ánh xạ lý thuyết sang commands, skills, và output files cụ thể trong repo. Đây là SSOT vận hành; khi skill hoặc command thay đổi, cập nhật section này.

### 11.1. Stage — Skill — Output

| Stage | Khi nào | Skill / Command | Output / SSOT |
|---|---|---|---|
| **Pick** | Item tiếp theo từ backlog | `idea-pick-off` + `pipeline-state.mjs init <slug>` | state `active=<slug>`, stage `analyze` |
| **Analyze** | Pain/idea → intent | `pipeline-analyze` | `docs/intent/<slug>.md` (`## Decision`: go/no-go) |
| **Analyze review** | Trước specify | self-review / `spec-reviewer` (analyze lens) | `docs/reviews/<slug>-analyze.md` `VERDICT:` |
| **Specify** | Intent `go` | `pipeline-specify` | `docs/specs/<slug>.md` + `docs/reviews/<slug>-spec.md` `VERDICT:` |
| **Design** | `uiSurface=yes` | `pipeline-design` | `docs/intent/<slug>-design-brief.md` + `-component-mapping.md` + mockup `src/entrypoints/mockup-<slug>/` + `docs/reviews/<slug>-design.md` |
| **Deliver** | Spec/design xong | `pipeline-deliver` (engine `autonomous-pipeline` cho M+ lanes) | `tasks/plan-<slug>.md` + `src/` + `docs/reviews/<slug>-verify.md` |
| **Ship** | Verify PASS + gates green | `pipeline-state.mjs transition <slug> --to shipped` (+ `shipping-and-launch`) | `shipped`, backlog + wiki, `active` cleared |
| **Drop** | `## Decision: no-go` hoặc veto | `transition --to dropped` | `dropped` + lý do trong backlog |
| **Local verify** | Code sửa xong | `pre-commit-gate` (+= brief-lint Step 1.7, skills-index Step 1.8) | build + test pass |
| **Browser verify** | Cần real page | `testing-with-playwright` (e2e) / `testing-extension-browser` (interactive) | spec pass / DOM evidence |
| **Code review** | Pre-merge | `code-review-and-quality` | PR comments / approval |
| **Commit** | Ready | `git-workflow-and-versioning` | clean commit |
| **Accumulate** | Sau bug/feature insight | `learning-and-apply` (ACCUMULATE) | `.agents/skills/learning-and-apply/experience/[id].json` |
| **Skill change** | Thêm/sửa/xóa skill | `write-skill` + `node scripts/update-skill-index.mjs` | `SKILL.md` + `index.json` regen |
| **Enforcement** | Convention "phải xảy ra" | `scripts/pipeline-state.mjs` (transitions) + `.devin/hooks.v1.json` + `scripts/hook-*.mjs` | Evidence-validated stage moves + event guardrail |
| **Fresh-eyes verify** | Cần review tách context | `run_subagent` (`subagent_explore`/`spec-reviewer`/`vision-reader`) | Verify report độc lập |
| **Share workflow** | Reuse system cho repo khác | Plugin packaging (§10.3) | `owner/repo` installable |

### 11.2. Skill routing cheat sheet

| Tình huống | Skill | Ghi chú |
|---|---|---|
| Không biết dùng skill nào | `using-agent-skills` | Meta-router 2 lớp: task-type → pipeline-stage, re-run khi task đổi |
| Feature/backlog item | `idea-pick-off` → `pipeline-*` theo `tasks/pipeline-state.json` stage | Stage file là truth, không đoán phase |
| Ý tưởng mơ hồ / cần hỏi user | `pipeline-analyze` (interactive) | Stubs `/elicitation` `/interview-me` trỏ về đây |
| Spec từ intent | `pipeline-specify` | Stubs `/spec-driven-development` `/spec-review-stakeholder` trỏ về đây |
| UI trước implement | `pipeline-design` | Stub `/idea-to-interface` trỏ về đây |
| Sửa CSS/TS | `learning-and-apply` (APPLY) | Grep `index.json` theo tags trước code |
| Bug | `debugging-and-error-recovery` -> `test-driven-development` | Reproduce trước fix; tsx/css → UI component-check |
| UI task | `design-system-guardian` | Build theo `DESIGN.md`, audit token/component sau |
| Performance | `performance-optimization` | Measure first |

### 11.3. Deterministic gates

Mỗi change phải pass trước khi commit:

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. `npx vite build --mode development` (nếu cần seed data)
5. Browser verify: `testing-with-playwright` e2e — `testing-extension-browser` cho interactive session (nếu change ảnh hưởng UI/page)

### 11.4. SSOT catalog

| Artifact | Path | Update khi |
|---|---|---|
| Skill catalog | `.agents/skills/index.json` | Chạy `node scripts/update-skill-index.mjs` (skills chỉ sống ở `.agents/skills/`) |
| Pipeline state | `tasks/pipeline-state.json` | Chỉ qua `node scripts/pipeline-state.mjs` — stage truth, atomic writes, main-worktree only |
| Kiến trúc | `docs/2-architechture-system.md` | Thêm/xóa/sửa `src/` |
| Wiki | `docs/0-wiki.md` | Thêm/xóa `docs/` |
| Glossary | `docs/1-share-language.md` | Thêm/sửa term |
| Specs | `docs/specs/[feature].md` | Feature mới hoặc scope đổi |
| Intent + design artifacts | `docs/intent/<slug>{,-design-brief,-component-mapping}.md` | ANALYZE/DESIGN outputs |
| Review artifacts | `docs/reviews/<slug>-{analyze,spec,design,verify,signoff}.md` | Mỗi gate; `VERDICT:` là dòng cuối |
| Hook wiring | `.devin/hooks.v1.json` + `scripts/hook-*.mjs` | Thêm/sửa lifecycle enforcement |
| Subagent profiles | `.devin/agents/*.md` (vision-reader) + `.agents/agents/*/AGENT.md` (spec-reviewer*) | Thêm/sửa custom profile |
| Plugin manifest | `devin plugins list` (user scope, lockfile ở `%APPDATA%/devin/cli/plugins/`) | Cài/gỡ plugin |

---

## 12. Nguồn tài liệu

| # | Tổ chức | Tài liệu | URL |
|---|---|---|---|
| 1 | Microsoft | Agentic SDLC Starter (repo — reference architecture) | https://github.com/microsoft/agentic-sdlc-starter/ |
| 2 | Microsoft | Agentic DevOps — Reimagining every phase of the developer lifecycle | https://developer.microsoft.com/blog/reimagining-every-phase-of-the-developer-lifecycle |
| 3 | Microsoft | Transform software development through an agentic platform | https://developer.microsoft.com/blog/learn-from-microsoft-transform-software-development-through-an-agentic-platform/ |
| 4 | Microsoft | An AI led SDLC: End-to-End Agentic SDLC with Azure and GitHub | https://techcommunity.microsoft.com/blog/appsonazureblog/an-ai-led-sdlc-building-an-end-to-end-agentic-software-development-lifecycle-wit/4491896 |
| 5 | AWS | AI-Driven Development Life Cycle (AI-DLC) | https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/ |
| 6 | Red Hat | Core concepts of Red Hat's agentic SDLC | https://www.redhat.com/en/blog/building-future-core-concepts-red-hats-agentic-software-development-life-cycle |
| 7 | Sonar | What is Agentic SDLC | https://www.sonarsource.com/resources/library/what-is-agentic-sdlc/ |
| 8 | Deloitte | Agentic AI in software engineering — from SDLC to AO-DLC | https://www.deloitte.com/content/dam/assets-zone3/us/en/docs/services/consulting/2026/agentic-ai-impact-on-software-engineering.pdf |
| 9 | arxiv | Agentic AI in the SDLC: Architecture, Empirical Evidence, and the Reshaping of Software Engineering | https://arxiv.org/html/2604.26275 |
| 10 | Daniel Meppiel | The Agentic SDLC Handbook (PROSE framework) | https://danielmeppiel.github.io/agentic-sdlc-handbook/ |
