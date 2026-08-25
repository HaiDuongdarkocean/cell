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
10. [Takeaway cho Cell](#10-takeaway-cho-cell)
11. [Nguồn tài liệu](#11-nguồn-tài-liệu)

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
| **Agentic** | Agent nhận task → plan → execute → iterate → submit | Review ở critical gate | Devin, Copilot coding agent |
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
│  Idea → BA elicitation → feature spec approval → UAT sign-off│
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

## 10. Takeaway cho Cell

| Nguyên lý agentic SDLC | Cell hiện có | Gap |
|---|---|---|
| **Spec-driven** | `docs/specs/*.md` trước code | Đã có |
| **On the loop** | AGENTS.md gate: build pass + verify pass mới commit | Đã có |
| **Adversarial review** | `doubt-driven-development` + `spec-review-stakeholder` | Đã có (pre-implementation) |
| **Verification debt** | `npm run build` + `test:unit` + chrome-devtools verify mỗi change | Đã có (technical) |
| **Guardrail** | Ponytail rules + AGENTS.md convention (no `any`, named export, SSOT) | Đã có |
| **Eval gate mỗi change** | `debugging` yêu cầu regression test sau fix, nhưng không có eval suite mỗi change | **Gap** — không có dedicated regression-eval-gate |
| **BA-style elicitation** | `interview-me` (AI-led) + `idea-refine` (AI-side) | **Gap** — không có observation/prototype elicitation |
| **Post-ship business review** | `spec-review-stakeholder` pre-implementation only | **Gap** — không có "did we build the RIGHT thing" post-ship |
| **Post-ship retrospective** | `learning-and-apply` capture technical knowledge | **Gap** — không capture pipeline/process improvement |
| **Stakeholder sign-off** | `testing-extension-browser` UAT-like (technical) | **Gap** — không có business stakeholder approve |

Cell đã implement ngầm ~60% nguyên lý agentic SDLC qua skill system + AGENTS.md. 4 gap còn lại: elicitation đa kỹ thuật, eval gate, post-ship business review, pipeline retrospective.

---

## 12. Cell Agentic SDLC Runbook

> Ánh xạ lý thuyết sang commands, skills, và output files cụ thể trong repo. Đây là SSOT vận hành; khi skill hoặc command thay đổi, cập nhật section này.

### 12.1. Phase — Skill — Output

| Phase | Khi nào | Skill / Command | Output / SSOT |
|---|---|---|---|
| **Define** | Idea mơ hồ, chưa rõ yêu cầu | `interview-me` / `idea-refine` | `docs/intent/[topic].md` |
| **Specify** | Feature xác định | `spec-driven-development` | `docs/specs/[feature].md` |
| **Adversarial review** | Trước implement | `spec-review-stakeholder` | `docs/reviews/[feature]-adversarial.md` |
| **Plan** | Spec approved | `planning-and-task-breakdown` | `tasks/plan.md` + `tasks/todo.md` |
| **Build** | Implement từng task | `incremental-implementation` + `learning-and-apply` (APPLY) | `src/` + `tests/` |
| **Local verify** | Code sửa xong | `pre-commit-gate` | build + test pass, không file mới |
| **Browser verify** | Cần real page | `testing-extension-browser` | DOM evidence trong session |
| **Code review** | Pre-merge | `code-review-and-quality` | PR comments / approval |
| **Commit** | Ready | `git-workflow-and-versioning` | clean commit |
| **Ship** | Release | `shipping-and-launch` | release notes + tag |
| **Accumulate** | Sau bug/feature insight | `learning-and-apply` (ACCUMULATE) | `.agents/skills/learning-and-apply/experience/[id].json` |

### 12.2. Skill routing cheat sheet

| Tình huống | Skill | Ghi chú |
|---|---|---|
| Không biết dùng skill nào | `using-agent-skills` | Meta-router, re-run khi task đổi |
| Sửa CSS/TS | `learning-and-apply` (APPLY) | Grep `index.json` theo tags trước code |
| Bug | `debugging-and-error-recovery` -> `test-driven-development` | Reproduce trước fix |
| UI task | `frontend-ui-engineering` + `design-system-guardian` | Audit token/component sau |
| Performance | `performance-optimization` | Measure first |

### 12.3. Deterministic gates

Mỗi change phải pass trước khi commit:

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run build`
4. `npx vite build --mode development` (nếu cần seed data)
5. Browser verify theo `testing-extension-browser` contract (nếu change ảnh hưởng UI/page)

### 12.4. SSOT catalog

| Artifact | Path | Update khi |
|---|---|---|
| Skill catalog | `.agents/skills/index.json` | Chạy `node scripts/update-skill-index.mjs` |
| Kiến trúc | `docs/2-architechture-system.md` | Thêm/xóa/sửa `src/` |
| Wiki | `docs/0-wiki.md` | Thêm/xóa `docs/` |
| Glossary | `docs/1-share-language.md` | Thêm/sửa term |
| Specs | `docs/specs/[feature].md` | Feature mới hoặc scope đổi |

---

## 11. Nguồn tài liệu

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
