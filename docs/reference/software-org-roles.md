# Doanh nghiệp phát triển phần mềm — Vị trí, Input/Output, Tài liệu

> Tài liệu tìm hiểu cấu trúc tổ chức của một doanh nghiệp phát triển phần mềm.
> Viết theo 5W1H, tập trung vào **WHY** (tại sao vị trí tồn tại, tại sao ảnh hưởng dự án) và **HOW** (cách tác động, cách phối hợp, cách tạo ra tài liệu).
>
> Áp dụng được cho cả startup nhỏ (5 người) lẫn enterprise lớn (500+ người) — mỗi vị trí có thể do 1 người hoặc 1 team đảm nhiệm.

---

## 5W1H — Tổng quan

| H | Câu hỏi | Trả lời ngắn |
|---|---|---|
| **Who** | Ai tham gia dự án? | 12 vị trí cốt lõi (từ CEO → Developer → QA → DevOps) |
| **What** | Mỗi vị trí làm gì? | Input → Output → Tài liệu tạo ra |
| **When** | Khi nào vị trí đó xuất hiện trong vòng đời dự án? | Phase Discovery → Design → Build → Ship → Maintain |
| **Where** | Vị trí đó nằm ở đâu trong tổ chức? | 3 nhóm: Leadership / Product / Engineering |
| **Why** | Tại sao vị trí đó tồn tại? Tại sao ảnh hưởng dự án? | **FOCUS — xem chi tiết mỗi vị trí** |
| **How** | Cách vị trí đó tác động? Cách phối hợp? Cách tạo tài liệu? | **FOCUS — xem chi tiết mỗi vị trí** |

---

## WHY — Tại sao cần phân vai trong dự án phần mềm?

### Vấn đề gốc rễ

Phát triển phần mềm là một hoạt động **phức tạp** (complex, không phải complicated):
- **Phức tạp về kỹ thuật**: nhiều công nghệ, nhiều module, nhiều dependency
- **Phức tạp về con người**: nhiều người với kỹ năng khác nhau phải phối hợp
- **Phức tạp về kinh doanh**: yêu cầu thay đổi, thị trường thay đổi, deadline ép
- **Phức tạp về thời gian**: dự án kéo dài tháng → năm, người ra vào

Nếu **1 người làm tất cả** (founder-developer):
- ✅ Đỡ chi phí ban đầu
- ❌ Bottleneck — mọi quyết định đi qua 1 người
- ❌ Blind spot — không ai review, không ai challenge
- ❌ Bus factor = 1 — 1 người nghỉ là dự án chết
- ❌ Không scale — không thêm người được vì không có cấu trúc

### Giải pháp: Phân vai theo nguyên tắc Separation of Concerns

Giống như code tách module — tổ chức tách vai:
- **Mỗi vị trí có 1 trách nhiệm chính** (single responsibility)
- **Input của vị trí này = Output của vị trí kia** (chuỗi giá trị)
- **Tài liệu là "interface" giữa các vị trí** (contract, không cần họp liên tục)

> **WHY cốt lõi**: Phân vai để **scale** — thêm người mà không tăng chaos. Tài liệu là **chất keo** giữ các vị trí lại với nhau khi team lớn lên.

---

## HOW — Cách các vị trí phối hợp (chuỗi giá trị)

```
Market/User Need
       │
       ▼
┌──────────┐    vision/OKRs    ┌──────────┐    tech strategy    ┌──────────────┐
│   CEO    │ ───────────────→  │   CTO    │ ─────────────────→  │   Architect  │
│ (Why)    │                   │ (How-T)  │                     │ (What-T)     │
└──────────┘                   └──────────┘                     └──────────────┘
       │                              │                                  │
       │ budget                       │ radar/standards                  │ architecture doc
       ▼                              ▼                                  ▼
┌──────────┐    PRD/roadmap    ┌──────────────┐    tech spec    ┌──────────────┐
│   CPO    │ ───────────────→  │  Tech Lead   │ ─────────────→  │  Developer   │
│ (What-P) │                   │ (How-Build)  │                 │ (Build)      │
└──────────┘                   └──────────────┘                 └──────────────┘
       │                              │                                  │
       │ user research                │ sprint plan                      │ code + tests
       ▼                              ▼                                  ▼
┌──────────┐    wireframes     ┌──────────────┐    test plan    ┌──────────────┐
│ Designer │ ───────────────→  │     QA       │ ←─────────────  │   DevOps     │
│ (UX)     │                   │ (Quality)    │                 │ (Ship/Run)   │
└──────────┘                   └──────────────┘                 └──────────────┘
       │                              │                                  │
       │ design system                │ bug reports                      │ CI/CD + monitoring
       ▼                              ▼                                  ▼
┌──────────────┐              ┌──────────────┐                 ┌──────────────┐
│ Tech Writer  │ ←─────────── │   PM/BA      │ ────────────→   │   Security   │
│ (Docs)       │  specs/code  │ (Coordinate) │ requirements    │ (Harden)     │
└──────────────┘              └──────────────┘                 └──────────────┘
       │                              │                                  │
       ▼                              ▼                                  ▼
   API docs                sprint status report              security audit
   user guide              burndown chart                    threat model
```

> **HOW cốt lõi**: Mỗi vị trí **nhận input** từ vị trí trước, **tạo output** cho vị trí sau. Tài liệu là **handoff artifact** — không cần họp để truyền thông tin, đọc tài liệu là đủ.

---

## 12 vị trí cốt lõi — Chi tiết WHY + HOW

### Nhóm 1: Leadership (định hướng)

---

### 1. CEO / Founder

**Input:**
- Thị trường (xu hướng, đối thủ, cơ hội)
- Phản hồi khách hàng
- Tình hình tài chính (revenue, burn rate, runway)
- Board/investor expectations

**Output:**
- Vision statement (1-3 năm)
- OKRs (Objectives & Key Results) hàng quý
- Budget (dev team, infra, tooling)
- Hiring plan (ai cần tuyển, khi nào)
- Go/No-Go decisions (kill project, pivot, scale)

**Tài liệu tạo ra:**
- `docs/vision.md` — tầm nhìn 3 năm
- `docs/okrs/2024-Q1.md` — OKRs quý
- `docs/budget.md` — phân bổ ngân sách
- Board deck (slide trình bày)

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Tại sao công ty tồn tại?"** — nếu không có CEO, team sẽ build đúng техничесally nhưng sai hướng kinh doanh (build cái không ai cần)
- **Chịu trách nhiệm cuối cùng** — mọi quyết định kỹ thuật đều phục vụ business outcome, CEO là người định nghĩa "outcome" là gì
- **Cấp vốn và tài nguyên** — không có budget thì không có team, không có infra

**WHY ảnh hưởng dự án:**
- **Hướng dự án**: CEO quyết định "build extension cho Chrome" hay "build web app" — quyết định này ảnh hưởng toàn bộ tech stack
- **Prioritization**: CEO quyết định "Phase 1 ra mắt Premium trước" — ảnh hưởng roadmap, feature priority
- **Resource allocation**: CEO quyết định "thêm 2 developer cho dict feature" — ảnh hưởng timeline

**HOW tác động:**
- **Truyền vision qua OKRs** — không micromanage từng feature, mà đặt mục tiêu (VD: "1000 paying users trong Q1"), để team tự quyết định how
- **Review hàng quý** — xem roadmap, xem metrics, quyết định pivot hay tiếp tục
- **Budget gate** — feature lớn cần budget approval từ CEO

**HOW phối hợp:**
- CEO ↔ CTO: weekly 1:1 — tech strategy alignment
- CEO ↔ CPO: weekly — product roadmap review
- CEO ↔ Board: quarterly — performance report

---

### 2. CTO (Chief Technology Officer)

**Input:**
- Vision + OKRs từ CEO
- Budget từ CEO
- Market tech trends (AI, WASM, new frameworks)
- Team capability assessment

**Output:**
- Technology strategy (12/24/36 tháng)
- Technology Radar (adopt/trial/assess/hold)
- Technology Standards (mandatory/banned patterns)
- ADRs (Architecture Decision Records) — org-level
- Tech roadmap (khi nào dùng gì)
- Hiring plan (kỹ năng cần tuyển)
- Build vs Buy vs OSS decisions

**Tài liệu tạo ra:**
- `docs/tech-strategy.md` — chiến lược công nghệ 3 năm
- `docs/tech-radar.md` — radar adopt/trial/assess/hold
- `docs/tech-standards.md` — standards bắt buộc
- `docs/adr/ADR-001-tech-stack.md` — ADR org-level
- `docs/tech-roadmap.md` — roadmap 12/24/36 tháng

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Công nghệ nào phục vụ business?"** — nếu không có CTO, team sẽ chọn tech theo "thích/trào lưu" thay vì theo business need
- **Bridge business ↔ technology** — CEO nói "offline-first", CTO dịch thành "IndexedDB + SQLite WASM + OPFS"
- **Governance** — đặt guardrails để team tự quyết định trong phạm vi an toàn (radar + standards + ADRs)

**WHY ảnh hưởng dự án:**
- **Tech stack**: CTO quyết định "React + Zustand + Dexie" — ảnh hưởng mọi dòng code
- **Architecture style**: CTO quyết định "Clean Architecture + Ports & Adapters" — ảnh hưởng cấu trúc thư mục, cách test
- **Build vs Buy**: CTO quyết định "tự build SRS engine" vs "dùng AnkiConnect" — ảnh hưởng timeline, maintenance burden
- **Risk management**: CTO đánh giá "SQLite WASM có nặng không?" — ảnh hưởng UX decision

**HOW tác động:**
- **Technology Radar** — team xem radar biết "React 19 = Adopt" (dùng được), "WXT = Trial" (thử nghiệm cẩn thận), "Plasmo = Hold" (không dùng)
- **Standards** — "tất cả storage access qua port interface" → developer không viết `chrome.storage.get()` trực tiếp trong use case
- **ADRs** — "ADR-002: Dexie + SQLite WASM split" → architect và developer biết tại sao chia 2 storage, không tranh luận lại
- **Fitness functions** — "bundle < 200KB gzipped" → CI/CD tự động fail nếu vượt, không cần CTO review từng PR

**HOW phối hợp:**
- CTO ↔ CEO: weekly 1:1 — strategy alignment
- CTO ↔ Architect: weekly — architecture review
- CTO ↔ CPO: bi-weekly — tech constraint vs product feature trade-off
- CTO ↔ Tech Leads: monthly — team capability, hiring

> 📌 **Liên hệ Cell**: Architecture proposal em vừa viết chính là output của CTO persona — 10 ADRs, tech radar (CRXJS=Adopt, WXT=Trial), standards (port interface, no chrome.storage in use cases), fitness functions (6 automated tests).

---

### 3. CPO / Product Manager

**Input:**
- Vision + OKRs từ CEO
- User research (interview, survey, analytics)
- Market analysis (competitor features, pricing)
- Feedback từ support/sales
- Tech constraints từ CTO

**Output:**
- Product Requirements Document (PRD)
- Product roadmap (12 tháng)
- Backlog (user stories, epics)
- Priority matrix (must/should/could/won't)
- Success metrics (KPIs per feature)
- Release plan (feature → version → date)

**Tài liệu tạo ra:**
- `docs/prd/feature-name.md` — PRD chi tiết
- `docs/roadmap.md` — product roadmap
- `docs/backlog.md` (hoặc Jira/Linear) — backlog
- `docs/user-personas.md` — persona definitions
- `docs/user-research/2024-Q1-interviews.md` — research notes

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Build cái gì cho ai?"** — nếu không có CPO, team sẽ build feature kỹ thuật hay nhưng không ai dùng
- **Bridge user ↔ engineering** — user nói "tôi muốn tra từ nhanh", CPO dịch thành "lookup < 150ms, offline-first, popup Shadow DOM"
- **Prioritization** — nguồn lực giới hạn, CPO quyết định feature nào trước (impact × effort)

**WHY ảnh hưởng dự án:**
- **Scope**: CPO quyết định "Phase 1 chỉ có dict + vocab, không có SRS" — ảnh hưởng timeline, team allocation
- **Success criteria**: CPO định nghĩa "dict lookup success = user save word sau khi tra" — ảnh hưởng cách đo success, ảnh hưởng design
- **Trade-off**: CPO quyết định "offline-first quan trọng hơn multi-language" — ảnh hưởng architecture priority

**HOW tác động:**
- **PRD** — developer đọc PRD biết "build gì, cho ai, success criteria gì" — không cần họp
- **Backlog priority** — sprint planning, team biết làm gì trước
- **User stories** — "As a Premium user, I want to lookup phrasal verbs so that I understand idioms in context" → developer hiểu context
- **Acceptance criteria** — "Given offline mode, When user clicks word, Then popup shows in < 150ms" → QA biết test gì

**HOW phối hợp:**
- CPO ↔ CEO: weekly — roadmap alignment với OKRs
- CPO ↔ CTO: bi-weekly — tech constraint vs feature trade-off
- CPO ↔ Designer: daily — wireframe, mockup
- CPO ↔ Tech Lead: sprint planning — scope vs capacity
- CPO ↔ Users: monthly — interview, survey

---

### Nhóm 2: Design & Architecture (thiết kế)

---

### 4. Chief Architect / Software Architect

**Input:**
- PRD từ CPO
- Tech strategy + standards từ CTO
- Constraints (budget, timeline, team capability)
- Existing codebase (nếu có)
- Non-functional requirements (performance, security, scalability)

**Output:**
- Architecture document (C4 model: Context → Container → Component → Code)
- ADRs (system-level)
- Sequence diagrams (luồng message)
- Data model (ER diagram, schema)
- API contracts (OpenAPI spec)
- Architecture decision matrix

**Tài liệu tạo ra:**
- `docs/architecture/system-architecture.md` — C4 model
- `docs/adr/ADR-005-storage-strategy.md` — ADR system-level
- `docs/diagrams/sequence-lookup-word.png` — sequence diagram
- `docs/data-model.md` — ER diagram
- `docs/api-contracts.md` — message protocol spec

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Hệ thống cấu trúc thế nào?"** — nếu không có architect, mỗi developer tự thiết kế module → "big ball of mud"
- **Đảm bảo consistency** — tất cả module theo cùng pattern (layered, ports & adapters), dễ maintain, dễ onboard người mới
- **Trade-off analysis** — architect đánh giá "Dexie vs SQLite WASM" dựa trên requirements, không dựa trên "thích"

**WHY ảnh hưởng dự án:**
- **Structure**: Architect quyết định `domain/application/infrastructure/presentation` — ảnh hưởng mọi file mới
- **Integration pattern**: Architect quyết định "SW orchestrator + offscreen compute" — ảnh hưởng cách module giao tiếp
- **Data flow**: Architect quyết định "popup → SW → offscreen → SQLite" — ảnh hưởng performance, latency
- **Testability**: Architect quyết định "ports & adapters" → use case test không cần browser

**HOW tác động:**
- **Architecture doc** — developer đọc biết "file mới vào folder nào, dependency rule gì"
- **ADRs** — "ADR-002: Dexie + SQLite WASM" → developer biết dùng Dexie cho user data, SQLite cho dict, không tranh luận
- **Diagrams** — team mới onboard đọc diagram hiểu hệ thống trong 1 giờ thay vì 1 tuần
- **Code review** — architect review PR có vi phạm architecture không (dependency rule, layer violation)

**HOW phối hợp:**
- Architect ↔ CTO: weekly — architecture alignment với strategy
- Architect ↔ Tech Lead: weekly — tech spec → implementation plan
- Architect ↔ Developer: code review, design review
- Architect ↔ QA: test strategy (unit/integration/e2e pyramid)

---

### 5. UI/UX Designer

**Input:**
- PRD từ CPO
- User research (persona, journey map)
- Brand guidelines
- Tech constraints (Shadow DOM, MV3 limits)
- Existing design system

**Output:**
- Wireframes (low-fidelity)
- Mockups (high-fidelity)
- Interactive prototype
- Design system (components, tokens, guidelines)
- User flow diagrams
- Accessibility spec (WCAG 2.1 AA)

**Tài liệu tạo ra:**
- `docs/design/wireframes/feature-name.fig` — wireframe
- `docs/design/mockups/feature-name.fig` — mockup
- `docs/design-system/` — design system (components, tokens)
- `docs/design/user-flow-lookup-word.png` — user flow
- `docs/design/accessibility-checklist.md` — a11y spec

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Người dùng tương tác thế nào?"** — nếu không có designer, developer tự design UI → thường xấu, khó dùng, không consistent
- **Bridge user need ↔ UI implementation** — user cần "tra từ nhanh", designer design "popup xuất hiện tại vị trí click, không che nội dung"
- **Consistency** — design system đảm bảo mọi screen cùng look & feel, giảm cognitive load cho user

**WHY ảnh hưởng dự án:**
- **UI structure**: Designer quyết định "popup có 3 tab: Downloads / Wordbook / SRS" — ảnh hưởng component tree
- **Interaction pattern**: Designer quyết định "click word → popup, hover → preview" — ảnh hưởng event handling
- **Accessibility**: Designer quyết định "keyboard navigation, screen reader support" — ảnh hưởng ARIA, semantic HTML
- **Performance**: Designer quyết định "animation 60fps, no jank" — ảnh hưởng CSS, rendering strategy

**HOW tác động:**
- **Mockup** — developer xem mockup biết "UI trông thế nào, layout gì" — implement chính xác
- **Design system** — developer dùng component có sẵn (Button, Card, Modal) — consistent, nhanh
- **User flow** — QA test theo user flow, đảm bảo flow chính hoạt động
- **Prototype** — stakeholder review prototype trước khi dev — giảm rework

**HOW phối hợp:**
- Designer ↔ CPO: daily — wireframe, mockup review
- Designer ↔ Developer: handoff session — spec, assets, interaction
- Designer ↔ QA: accessibility test plan

---

### Nhóm 3: Engineering (xây dựng)

---

### 6. Engineering Manager / Tech Lead

**Input:**
- Architecture doc từ Architect
- PRD + backlog từ CPO
- Mockup + design system từ Designer
- Team capacity (ai available, skill level)
- Tech standards từ CTO

**Output:**
- Tech spec (implementation plan)
- Sprint plan (task breakdown, estimate, assignment)
- Code review guidelines
- Technical risk register
- Team velocity metrics
- Onboarding doc cho team mới

**Tài liệu tạo ra:**
- `docs/tech-specs/feature-name.md` — tech spec
- `docs/sprint-plan-2024-W12.md` — sprint plan
- `docs/code-review-guidelines.md` — review checklist
- `docs/onboarding.md` — onboard người mới

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Build thế nào, bao lâu, ai làm gì?"** — nếu không có tech lead, developer tự plan → thiếu coordination, overlap, miss dependency
- **Bridge architecture ↔ implementation** — architect design "Clean Architecture", tech lead dịch thành "task 1: tạo domain/, task 2: tạo ports, task 3: tạo adapter..."
- **Quality gate** — tech lead review code, đảm bảo standard, mentor junior

**WHY ảnh hưởng dự án:**
- **Task breakdown**: Tech lead chia feature thành 20 task, estimate 3 ngày/task — ảnh hưởng timeline
- **Assignment**: Tech lead quyết định "developer A làm dict (giỏi SQLite), developer B làm UI (giỏi React)" — ảnh hưởng quality, speed
- **Risk identification**: Tech lead thấy "SQLite WASM chưa ai làm, rủi ro cao" → plan PoC trước — ảnh hưởng risk mitigation
- **Code quality**: Tech lead review PR, reject nếu vi phạm standard — ảnh hưởng maintainability

**HOW tác động:**
- **Tech spec** — developer đọc spec biết "implement gì, file nào, dependency gì, test gì" — không cần hỏi liên tục
- **Sprint plan** — team biết tuần này làm gì, ai làm gì
- **Code review** — PR phải pass review mới merge, đảm bảo quality
- **1:1 mentoring** — junior developer được guide, giảm bug, tăng tốc onboard

**HOW phối hợp:**
- Tech Lead ↔ Architect: weekly — spec review
- Tech Lead ↔ CPO: sprint planning — scope vs capacity
- Tech Lead ↔ Developer: daily standup, code review
- Tech Lead ↔ QA: test plan review

---

### 7. Senior Developer / Developer

**Input:**
- Tech spec từ Tech Lead
- Architecture doc từ Architect
- Mockup + design system từ Designer
- Code review feedback
- Bug reports từ QA

**Output:**
- Source code (production)
- Unit tests
- Integration tests
- Pull Request (with description)
- Inline documentation (JSDoc, TSDoc)
- Technical debt notes (nếu phát hiện)

**Tài liệu tạo ra:**
- `src/feature-name/*.ts` — source code
- `tests/unit/feature-name.test.ts` — unit tests
- `PR-123-description.md` — PR description
- Code comments (JSDoc, inline)

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Code thế nào cho đúng, cho sạch, cho test được?"** — đây là vị trí **thực thi** mọi quyết định phía trên
- **Translate design → running software** — architecture doc là ý tưởng, code là thực tế
- **Feedback loop** — developer phát hiện "architecture này khó implement" → feedback lên architect → adjust

**WHY ảnh hưởng dự án:**
- **Code quality**: Developer viết code clean, test đầy đủ → dễ maintain, ít bug
- **Implementation choice**: Developer chọn "dùng Map thay vì Object" → ảnh hưởng performance
- **Bug introduction**: Developer viết bug → ảnh hưởng user experience, QA phải catch
- **Technical debt**: Developer viết quick-and-dirty (intentional) → ghi ADR, schedule paydown

**HOW tác động:**
- **Code + tests** — output chính, chạy trong production
- **PR description** — reviewer hiểu context, "why this change", "what changed", "how to test"
- **Code comments** — developer sau hiểu "tại sao code thế này" (không phải "code làm gì" — code tự nói)
- **Feedback** — developer nói "port interface này quá phức tạp cho case đơn giản" → architect đơn giản hóa

**HOW phối hợp:**
- Developer ↔ Tech Lead: daily standup, code review
- Developer ↔ Developer: pair programming, PR review
- Developer ↔ QA: bug triage, test collaboration
- Developer ↔ Designer: clarify spec, edge case

---

### 8. QA Engineer / Test Engineer

**Input:**
- PRD + acceptance criteria từ CPO
- Tech spec từ Tech Lead
- Source code + PR từ Developer
- Architecture doc (test strategy)
- User flow từ Designer

**Output:**
- Test plan (what to test, how, when)
- Test cases (manual + automated)
- Bug reports (repro steps, severity, expected vs actual)
- Test automation suite
- Quality metrics (coverage, pass rate, defect density)
- Regression test suite

**Tài liệu tạo ra:**
- `docs/test-plan/feature-name.md` — test plan
- `tests/e2e/feature-name.spec.ts` — automated tests
- `docs/bug-reports/BUG-001.md` — bug report
- `docs/test-metrics.md` — quality dashboard

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Software có đúng không? Có an toàn để ship không?"** — nếu không có QA, bug lọt ra production → user mất niềm tin, revenue giảm
- **Independent verification** — developer test code mình viết có bias (viết test cho case mình nghĩ đến, miss case mình không nghĩ đến)
- **Risk gate** — QA quyết định "feature này pass → ship" hoặc "feature này fail → hold"

**WHY ảnh hưởng dự án:**
- **Quality bar**: QA định nghĩa "80% unit coverage, 15% integration, 5% e2e" — ảnh hưởng developer workflow
- **Release gate**: QA sign-off mới release — ảnh hưởng release cadence
- **Bug prevention**: QA tìm bug sớm (shift-left testing) → fix rẻ hơn 10x so với bug lọt production
- **User perspective**: QA test như user thật, bắt UX issue mà developer không thấy

**HOW tác động:**
- **Test plan** — developer biết "phải test gì" trước khi viết code (TDD)
- **Bug report** — developer nhận bug, fix, QA verify
- **Automation** — CI/CD chạy test mỗi PR, fail thì block merge
- **Quality metrics** — stakeholder xem "coverage 85%, pass rate 98%" → confidence ship

**HOW phối hợp:**
- QA ↔ Developer: bug triage, test collaboration
- QA ↔ Tech Lead: test strategy, automation priority
- QA ↔ CPO: acceptance criteria clarification
- QA ↔ DevOps: CI/CD test integration

---

### 9. DevOps Engineer / SRE

**Input:**
- Architecture doc từ Architect
- Tech standards từ CTO
- CI/CD requirements từ Tech Lead
- Monitoring requirements
- Security requirements

**Output:**
- CI/CD pipeline (build, test, deploy)
- Infrastructure-as-Code (Terraform, Pulumi)
- Monitoring + alerting (dashboards, runbooks)
- Deployment strategy (blue-green, canary, rolling)
- Incident response plan
- Cost optimization report

**Tài liệu tạo ra:**
- `.github/workflows/ci.yml` — CI pipeline
- `infra/terraform/` — IaC
- `docs/runbooks/incident-001.md` — runbook
- `docs/deployment-strategy.md` — deploy strategy
- `docs/monitoring-dashboard.md` — dashboard config

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Làm sao ship nhanh, an toàn, và chạy ổn định?"** — nếu không có DevOps, deploy manual → chậm, lỗi, không rollback được
- **Automate toil** — build, test, deploy, monitor → tự động hóa, team tập trung build feature
- **Reliability** — SRE (Site Reliability Engineering) đảm bảo uptime, giảm incident, fast recovery

**WHY ảnh hưởng dự án:**
- **Release velocity**: DevOps setup CI/CD → deploy 10 lần/ngày thay vì 1 lần/tuần
- **Rollback safety**: DevOps setup blue-green → rollback trong 30 giây nếu bug
- **Monitoring**: DevOps setup dashboard → phát hiện lỗi trước khi user report
- **Cost**: DevOps optimize infra → giảm 30% cloud bill

**HOW tác động:**
- **CI/CD pipeline** — mỗi PR tự động build + test + lint, fail thì block merge
- **IaC** — infra version-controlled, reproducible, không "trên máy tôi chạy được"
- **Runbook** — khi incident, team theo runbook, không hoảng loạn
- **Monitoring** — dashboard real-time, alert khi error rate > 1%

**HOW phối hợp:**
- DevOps ↔ CTO: infra budget, strategy
- DevOps ↔ Tech Lead: CI/CD requirements
- DevOps ↔ Developer: build pipeline, debug CI
- DevOps ↔ QA: test automation integration

---

### Nhóm 4: Support & Coordination (phụ trợ)

---

### 10. Project Manager / Scrum Master

**Input:**
- Roadmap từ CPO
- Sprint plan từ Tech Lead
- Team status (daily standup)
- Blockers, risks
- Stakeholder expectations

**Output:**
- Sprint backlog
- Burndown chart
- Status report (weekly)
- Risk register
- Retrospective action items
- Stakeholder communication

**Tài liệu tạo ra:**
- `docs/sprint-backlog-2024-W12.md` — sprint backlog
- `docs/status-report-2024-W12.md` — weekly status
- `docs/risk-register.md` — risk tracking
- `docs/retro-2024-W12.md` — retrospective notes

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Dự án đi đúng tiến độ không? Có rủi ro gì?"** — nếu không có PM, team lạc lối trong task, không thấy big picture
- **Remove blockers** — PM chase dependency, unblock team, để team tập trung code
- **Stakeholder communication** — PM dịch technical status sang business language cho CEO/investor

**WHY ảnh hưởng dự án:**
- **Timeline tracking**: PM thấy "sprint 3 behind 2 days" → adjust scope hoặc add resource
- **Risk escalation**: PM thấy "SQLite WASM rủi ro cao" → escalate lên CTO → PoC trước
- **Dependency management**: PM chase "design cần trước Monday để dev bắt đầu Tuesday"

**HOW tác động:**
- **Sprint backlog** — team biết tuần này làm gì
- **Status report** — stakeholder biết tiến độ, không hỏi liên tục
- **Retrospective** — team cải tiến process mỗi sprint
- **Risk register** — rủi ro được track, có mitigation plan

**HOW phối hợp:**
- PM ↔ CPO: scope, priority
- PM ↔ Tech Lead: capacity, sprint plan
- PM ↔ Stakeholder: status report
- PM ↔ Team: daily standup, blocker removal

---

### 11. Business Analyst (BA)

**Input:**
- Business needs từ CEO/CPO
- User interviews
- Existing process documentation
- Market research
- Regulatory requirements

**Output:**
- Business Requirements Document (BRD)
- User stories (with acceptance criteria)
- Process flow diagrams
- Gap analysis (current vs future state)
- Data requirements

**Tài liệu tạo ra:**
- `docs/brd/feature-name.md` — BRD
- `docs/user-stories/US-001.md` — user story
- `docs/process-flow.png` — process diagram
- `docs/gap-analysis.md` — gap analysis

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Business cần gì chính xác?"** — nếu không có BA, requirement mơ hồ, developer build sai
- **Bridge business ↔ technical** — business nói "tôi muốn quản lý từ vựng", BA dịch thành "CRUD word, 5-status flow, FSRS review, import/export"
- **Elicit hidden requirements** — BA đào sâu, hỏi "còn edge case nào không?", "compliance yêu cầu gì?"

**WHY ảnh hưởng dự án:**
- **Requirement clarity**: BA viết user story rõ → developer hiểu chính xác, ít rework
- **Scope definition**: BA định nghĩa "trong scope / ngoài scope" → tránh scope creep
- **Acceptance criteria**: BA viết "Given... When... Then..." → QA test chính xác

**HOW tác động:**
- **BRD** — stakeholder sign-off, team biết "build gì"
- **User stories** — developer + QA cùng đọc, hiểu yêu cầu
- **Process flow** — team hiểu luồng business, không chỉ luồng technical

**HOW phối hợp:**
- BA ↔ CPO: requirement elicitation
- BA ↔ Developer: clarify requirement
- BA ↔ QA: acceptance criteria

---

### 12. Technical Writer

**Input:**
- Source code từ Developer
- Tech spec từ Tech Lead
- Architecture doc từ Architect
- PRD từ CPO
- Release notes

**Output:**
- API documentation
- User guide
- Developer guide (onboarding)
- Release notes
- Tutorials / how-to guides
- Architecture documentation (diagrams + explanation)

**Tài liệu tạo ra:**
- `docs/api-reference.md` — API docs
- `docs/user-guide/` — user guide
- `docs/developer-guide/` — dev onboarding
- `docs/release-notes/v1.2.0.md` — release notes
- `docs/tutorials/` — how-to guides

**WHY vị trí này tồn tại:**
- **Trả lời câu hỏi "Người khác hiểu hệ thống thế nào?"** — nếu không có tech writer, developer tự viết doc → thường thiếu, lỗi thời, khó hiểu
- **Bridge system ↔ user/developer mới** — user đọc guide biết dùng, dev mới đọc onboarding biết contribute
- **Keep docs alive** — tech writer update doc khi code thay đổi, tránh doc lỗi thời

**WHY ảnh hưởng dự án:**
- **Onboarding speed**: dev mới đọc onboarding guide → productive trong 2 ngày thay vì 2 tuần
- **User adoption**: user đọc guide → dùng đúng, ít support ticket
- **Knowledge preservation**: khi developer nghỉ, kiến thức vẫn còn trong doc

**HOW tác động:**
- **API docs** — developer tích hợp API đọc doc, không cần hỏi
- **User guide** — user tự solve problem, giảm support burden
- **Release notes** — user biết "có gì mới", upgrade
- **Tutorials** — user mới onboard nhanh

**HOW phối hợp:**
- Tech Writer ↔ Developer: code → doc
- Tech Writer ↔ Architect: architecture → diagram + explanation
- Tech Writer ↔ CPO: feature → user guide

---

## Tóm tắt — Bảng tổng hợp

| # | Vị trí | Input chính | Output chính | Tài liệu chính | WHY cốt lõi |
|---|---|---|---|---|---|
| 1 | CEO | Market, board | Vision, OKRs, budget | vision.md, OKRs | Định hướng business |
| 2 | CTO | Vision, budget | Tech strategy, radar, ADRs | tech-strategy.md, ADRs | Bridge business ↔ tech |
| 3 | CPO | Vision, users | PRD, roadmap, backlog | PRD, backlog | Build cái gì cho ai |
| 4 | Architect | PRD, standards | Architecture doc, ADRs | architecture.md, diagrams | Hệ thống cấu trúc thế nào |
| 5 | Designer | PRD, research | Mockup, design system | mockups, design-system | User tương tác thế nào |
| 6 | Tech Lead | Architecture, PRD | Tech spec, sprint plan | tech-spec.md, sprint-plan | Build thế nào, bao lâu |
| 7 | Developer | Tech spec, mockup | Code, tests, PRs | source code, tests | Thực thi mọi quyết định |
| 8 | QA | PRD, code | Test plan, bug reports | test-plan, bug-reports | Software có đúng không |
| 9 | DevOps | Architecture, standards | CI/CD, infra, monitoring | ci.yml, runbooks | Ship nhanh, an toàn |
| 10 | PM | Roadmap, status | Sprint backlog, status report | sprint-backlog, status | Đi đúng tiến độ không |
| 11 | BA | Business needs | BRD, user stories | BRD, user-stories | Business cần gì chính xác |
| 12 | Tech Writer | Code, specs | API docs, user guide | api-reference, user-guide | Người khác hiểu thế nào |

---

## Tài liệu theo vòng đời dự án (When)

| Phase | Vị trí chính | Tài liệu tạo ra |
|---|---|---|
| **Discovery** (0-2 tuần) | CEO, CPO, BA | Vision, BRD, user research, user personas |
| **Design** (2-6 tuần) | CTO, Architect, Designer | Tech strategy, architecture doc, ADRs, mockups, design system |
| **Planning** (1-2 tuần) | CPO, Tech Lead, PM | PRD, tech spec, sprint plan, test plan |
| **Build** (4-12 tuần) | Developer, QA, DevOps | Code, tests, CI/CD, bug reports |
| **Ship** (1-2 tuần) | DevOps, QA, Tech Writer | Release notes, deployment, monitoring dashboard |
| **Maintain** (ongoing) | Developer, QA, DevOps, Tech Writer | Bug fixes, hotfixes, doc updates, retro notes |

---

## Áp dụng cho Cell Extension (ví dụ thực tế)

| Vị trí | Ai đóng | Output cho Cell |
|---|---|---|
| CEO | Anh yêu | Vision: "Immersion learning platform offline-first" |
| CTO | CTO persona skill | 10 ADRs, tech radar, architecture proposal |
| CPO | (chưa có) | PRD: "Phase 1: dict + vocab + flashcard + Anki" |
| Architect | (CTO persona cover) | Architecture doc (C4 model), message protocol |
| Designer | (chưa có) | Mockup: popup 3-tab, word popup Shadow DOM |
| Tech Lead | (Anh yêu + em) | Tech spec: Phase 0 Foundation task breakdown |
| Developer | em (Devin) | Code, tests, PRs |
| QA | em (automated) | Jest unit + integration, Playwright e2e |
| DevOps | (chưa có) | GitHub Actions CI, Chrome Web Store deploy |
| PM | (Anh yêu) | Sprint plan, status tracking |
| BA | (chưa có) | User stories từ 130 UC wiki |
| Tech Writer | em | AGENTS.md, architecture docs, this doc |

> **Insight**: Startup nhỏ (5 người) → 1 người đóng nhiều vai. Cell hiện tại: Anh yêu = CEO + CPO + PM, em = Developer + QA + Tech Writer. Khi scale, tách dần vai ra.

---

## Tham khảo

- *Fundamentals of Software Architecture* — Neal Ford & Mark Richards (architect role, fitness functions)
- *Software Architecture and Decision-Making* (O'Reilly) — CTO decision framework
- Team Topologies — Matthew Skelton & Manuel Pais (team topology patterns)
- The Product Book — Product School (CPO/PM role)
- SRE Book — Google (DevOps/SRE role)
- InfoQ — A Simple Framework for Architectural Decisions (ADR governance)
