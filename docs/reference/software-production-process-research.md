# Quy trình sản xuất phần mềm — Research từ 30 nguồn uy tín

> Tổng hợp quy trình phát triển phần mềm của các doanh nghiệp lớn (Google, Microsoft, Amazon, FAANG) + persona ở từng giai đoạn.
> Nguồn: official docs (Google, Microsoft, AWS, Scrum Guide, IBM, Atlassian) + engineering books + industry guides.
> Mục đích: làm đầu vào cho workflow spec-driven + subagent orchestration.

---

## 1. Tổng quan quy trình (synthesis 7 giai đoạn)

Tổng hợp từ: SDLC chuẩn (IBM, Atlassian, Netguru, ContextQA) + Microsoft SDL (5 phase + training/response) + Google (Design → Dev → Qualification → Rollout) + Amazon (You Build It You Run It) + Scrum (sprint loop) + DevOps (CI/CD).

```
0. Discovery        →  1. Planning      →  2. Requirements  →  3. Design/Architecture
   (ideation)          (feasibility)       (SRS)              (HLD + ADR + threat model)
        │                   │                   │                    │
        ▼                   ▼                   ▼                    ▼
4. Implementation  →  5. Testing       →  6. Deployment    →  7. Maintenance
   (code + review)     (verify + SAST)      (CI/CD + canary)     (SRE + on-call)
```

> Lưu ý: Agile/Scrum lặp giai đoạn 2-5 mỗi sprint; DevOps làm 4-7 liên tục; Microsoft SDL thêm Training (trước) + Response (sau) bao quanh toàn bộ.

---

## 2. Chi tiết 8 giai đoạn + Persona

### Giai đoạn 0 — Discovery / Ideation
**Mục đích:** Xác định vấn đề cần giải, cơ hội thị trường, vision.
**Hoạt động:** User research, market analysis, problem framing, opportunity solution tree.
**Output:** Vision statement, opportunity backlog, problem statement.
**Persona chính:**
- **Product Manager** — định nghĩa vision, customer need, business outcome
- **UX Researcher** — phỏng vấn user, journey map
- **Sponsor / CEO** — cấp vốn, go/no-go

**Nguồn:** Itamar Gilad (FAANG process), Voltage Control (PM↔UX), Product School.

---

### Giai đoạn 1 — Planning & Feasibility
**Mục đích:** Đánh giá khả thi (kỹ thuật + tài chính), lập kế hoạch, phân bổ nguồn lực.
**Hoạt động:** Feasibility study, scope, RACI, resource planning, risk register.
**Output:** Project charter, project plan, RACI matrix, budget.
**Persona chính:**
- **Product Manager / Project Manager** — project plan, scope
- **Engineering Manager / Scrum Master** — sprint cadence, team capacity
- **Sponsor** — budget approval
- **Solution Architect** — technical feasibility

**Nguồn:** Netguru SDLC, ContextQA, Atlassian SDLC, IBM SDLC.

---

### Giai đoạn 2 — Requirements
**Mục đích:** Biến nhu cầu thành yêu cầu cụ thể, có thể test được.
**Hoạt động:** Stakeholder interviews, FRD → SRS (IEEE 830), functional + non-functional + constraints, backlog grooming.
**Output:** SRS/FRD document, product backlog, acceptance criteria.
**Persona chính:**
- **Business Analyst** — bridge business ↔ engineering, viết SRS
- **Product Owner** — backlog ordering, acceptance criteria
- **Tech Lead** — review technical feasibility của requirements
- **Security Engineer** — security/privacy requirements (Microsoft SDL Phase 1)

**Nguồn:** Microsoft SDL Requirements, Netguru, SumatoSoft, Scrum Guide (Product Owner).

---

### Giai đoạn 3 — Design / Architecture
**Mục đích:** Thiết kế kiến trúc hệ thống + UI/UX + threat model trước khi code.
**Hoạt động:** HLD (High-Level Design), LLD (Low-Level Design), ADR (Architecture Decision Records), design doc (Google), threat modeling (Microsoft SDL), wireframes, design system.
**Output:** Design document (HLD+LLD), ADR log, design doc, threat model, wireframes, design system.
**Persona chính:**
- **Solution Architect** — HLD, ADR, architecture governance (lead)
- **Tech Lead** — LLD, technical design review
- **UX Designer** — wireframes, design system, usability
- **Security Engineer** — threat model (Microsoft SDL Phase 2 Design)
- **Product Owner** — sign-off design vs requirements

**Nguồn:** Google Design Docs (Ryan Madden, Gerrit), AWS ADR, Google Cloud ADR, Microsoft SDL Design, Pragmatic Engineer RFC, Pencil&Paper (PM↔UX).

---

### Giai đoạn 4 — Implementation / Coding
**Mục đích:** Viết code theo design, có code review + unit test + static analysis.
**Hoạt động:** Coding theo LLD, unit test, code review (Google: mọi change phải review), static analysis, secure coding (Microsoft SDL Phase 3).
**Output:** Reviewed & merged source code, unit test results, code review log.
**Persona chính:**
- **Developer** — viết code + unit test (lead)
- **Tech Lead** — code review, mentor, architecture guard
- **SDET** — test automation framework
- **Security Engineer** — secure coding guidelines, SAST trong CI
- **Scrum Master** — unblock, daily sync

**Nguồn:** Google SWE Book (Code Review ch.9), Microsoft SDL Implementation, Google Cloud (dev phase), SumatoSoft.

---

### Giai đoạn 5 — Testing / Verification
**Mục đích:** Verify code đáp ứng requirements + an toàn + ổn định.
**Hoạt động:** Integration test, E2E test, UAT, security push (SAST/DAST), performance test, test completion criteria.
**Output:** Test reports, defect reports, SAST/DAST results, UAT sign-off.
**Persona chính:**
- **QA Engineer** — test plan, manual + automated (lead)
- **SDET** — automation framework, CI test layer
- **Developer** — bug resolution
- **Security Engineer** — security push, pen test (Microsoft SDL Phase 4 Verification)
- **Product Owner / Business Analyst** — acceptance review, UAT

**Nguồn:** Microsoft SDL Verification, ContextQA (shift-left testing), Marutitech SDET, AltexSoft SDET, Splunk DevOps roles.

---

### Giai đoạn 6 — Deployment / Release
**Mục đích:** Release build đã verify ra production an toàn, có rollback.
**Hoạt động:** CI/CD pipeline (build→test→scan→package→staging→smoke→prod), canary/blue-green, release candidate promotion, release notes.
**Output:** Release artifact, release notes, deployment runbook, rollback plan.
**Persona chính:**
- **DevOps / Release Engineer** — CI/CD pipeline, deployment (lead)
- **SRE** — canary, rollout strategy, rollback (Google SRE)
- **QA Engineer** — production verification, smoke test
- **Developer** — standby hotfix
- **Product Manager** — release communication

**Nguồn:** Google SRE Book (Release Engineering), Google Cloud (rollout phase), ProdOpsHub CI/CD, Splunk, DocOps release-engineer role, Microsoft SDL Phase 5 Release.

---

### Giai đoạn 7 — Maintenance / Operations
**Mục đích:** Giữ hệ thống ổn định, fix bug, monitor, evolve.
**Hoạt động:** Monitoring (SLO/error budget), on-call, incident response, patch, regression, feature iterate.
**Output:** SLO dashboard, incident postmortem, patch log, changelog.
**Persona chính:**
- **SRE** — reliability, on-call, error budget (lead)
- **Developer** — fix bug, iterate (Amazon: You Build It You Run It)
- **DevOps** — infra, monitoring tooling
- **Security Engineer** — vulnerability response (Microsoft SDL Post: Response)
- **Tech Writer** — update docs, API docs
- **Product Manager** — roadmap iterate dựa trên metrics

**Nguồn:** Amazon You Build It You Run It (Werner Vogels 2006), Google SRE Book, Microsoft SDL Response, Splunk.

---

## 3. Bảng Persona cốt lõi (lean 12 — map từ 30 nguồn)

| # | Persona | Vai trò chính | Giai đoạn active | Output chính |
|---|---|---|---|---|
| 1 | Product Manager / Owner | Vision, backlog, prioritization | 0,1,2,5,7 | Vision, backlog, acceptance criteria |
| 2 | Business Analyst | Requirements bridge | 2,5 | SRS/FRD, acceptance review |
| 3 | UX Designer / Researcher | User experience | 0,3 | Wireframes, design system, journey map |
| 4 | Solution Architect | Architecture | 1,3 | HLD, ADR, threat model input |
| 5 | Tech Lead | Technical execution | 2,3,4 | LLD, code review, tech sign-off |
| 6 | Developer | Build | 4,5,7 | Code, unit tests, bugfix |
| 7 | QA Engineer / SDET | Quality | 4,5,6 | Test plan, automation, test reports |
| 8 | DevOps / Release Engineer | Ship | 6,7 | CI/CD pipeline, release artifact |
| 9 | SRE | Reliability | 6,7 | SLO, on-call, rollback strategy |
| 10 | Security Engineer / DevSecOps | Harden | 2,3,4,5,7 | Threat model, SAST/DAST, response |
| 11 | Scrum Master / Eng Manager | Process | 1-7 (facilitate) | Sprint cadence, unblock |
| 12 | Tech Writer | Docs | 3,4,7 | API docs, user guide, runbook |

> Microsoft SDL thêm 2 activity bao quanh: **Security Training** (trước phase 1) + **Response** (sau phase 7) — không phải persona riêng mà là trách nhiệm của Security Engineer + toàn team.

---

## 4. So sánh mô hình áp dụng

| Mô hình | Đặc trưng | Giai đoạn lặp | Nguồn |
|---|---|---|---|
| **Waterfall** | Tuần tự, sign-off mỗi phase | Không lặp | IBM, Atlassian SDLC |
| **Agile/Scrum** | Sprint 2-4 tuần, lặp 2-5 | Lặp 2→5 mỗi sprint | Scrum Guide, Atlassian |
| **DevOps** | CI/CD liên tục, shared responsibility | Lặp 4→7 liên tục | Splunk, ProdOpsHub, AWS DevOps |
| **Microsoft SDL** | Security tích hợp mỗi phase | Tuần tự + training/response | Microsoft Learn |
| **Google** | Design doc → CB → CD → launch & iterate | Lặp 4→6 (launch and iterate) | Google SWE Book, Google Cloud |
| **Amazon** | Two-pizza team, You Build It You Run It | Full lifecycle 1 team | AWS, Werner Vogels |

---

## 5. 30 Nguồn tham khảo

### Quy trình chính thức (enterprise)
1. Software Engineering at Google — https://abseil.io/resources/swe-book/html/ch01.html
2. Google CI/CD (TAP, Continuous Build) — https://abseil.io/resources/swe-book/html/ch23.html
3. Google Launch & Iterate — https://abseil.io/resources/swe-book/html/ch24.html
4. Google Cloud Change Management (Design→Dev→Qualification→Rollout) — https://cloud.google.com/docs/cloud-approach-to-change
5. Microsoft SDL v5.2 (5 phases + training + response) — https://learn.microsoft.com/en-us/previous-versions/windows/desktop/cc307748(v=msdn.10)
6. Microsoft SDL (Service Assurance) — https://learn.microsoft.com/en-us/compliance/assurance/assurance-microsoft-security-development-lifecycle
7. Microsoft SDL Practices (10 key practices) — https://www.microsoft.com/en-us/securityengineering/sdl/practices
8. The Security Development Lifecycle (TechNet) — https://learn.microsoft.com/en-us/archive/technet-wiki/7100.the-security-development-lifecycle

### SDLC tổng quát
9. IBM — What is SDLC — https://www.ibm.com/think/topics/sdlc
10. Atlassian — SDLC Guide — https://www.atlassian.com/agile/software-development/sdlc
11. Netguru — Stages of software development (RACI per stage) — https://www.netguru.com/blog/stages-of-software-development
12. ContextQA — 7 Phases of SDLC — https://contextqa.com/blog/the-7-phases-of-software-development-life-cycle/
13. SumatoSoft — SDLC + ADLC (agentic) — https://sumatosoft.com/software-development-lifecycle

### Amazon / Two-Pizza / You Build It You Run It
14. AWS — Two-Pizza Teams eBook — https://d1.awsstatic.com/executive-insights/en_US/two_pizza_teams_eBook.pdf
15. AWS Blog — Two-Pizza Teams accountability & empowerment — https://aws.amazon.com/blogs/enterprise-strategy/two-pizza-teams-are-just-the-start-accountability-and-empowerment-are-key-to-high-performing-agile-organizations-part-1/
16. AWS DevOps Whitepaper — Two-Pizza Teams — https://docs.aws.amazon.com/whitepapers/latest/introduction-devops-aws/two-pizza-teams.html
17. You Build It You Run It (Werner Vogels, Amazon 2006) — https://handwiki.org/wiki/Software:You_Build_It_You_Run_It

### Scrum / Agile
18. Scrum Guide (official) — https://scrumguides.org/scrum-guide.html
19. Atlassian — Agile Scrum Roles — https://www.atlassian.com/agile/scrum/roles
20. Scrum Alliance — Scrum Roles Demystified — https://resources.scrumalliance.org/Article/scrum-roles-demystified
21. Coursera — 3 Scrum Roles — https://www.coursera.org/articles/scrum-roles-and-responsibilities

### DevOps / SRE / Release
22. Google SRE Book — Release Engineering — https://sre.google/sre-book/release-engineering/
23. Splunk — DevOps Roles & Responsibilities — https://www.splunk.com/en_us/blog/learn/devops-roles-responsibilities.html
24. ProdOpsHub — CI/CD Roadmap 2026 (7 stages) — https://prodopshub.com/ci-cd-roadmap-for-devops/
25. DocOps — DevOps/Release Engineer role — https://github.com/DocOps/lab/blob/agent-docs/roles/devops-release-engineer.md

### Design Docs / ADR / RFC
26. Google Cloud — Architecture Decision Records — https://docs.cloud.google.com/architecture/architecture-decision-records
27. AWS — ADR Prescriptive Guidance — https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/architectural-decision-records/architectural-decision-records.pdf
28. Ryan Madden — Design Docs at Google — https://ryanmadden.net/things-i-learned-at-google-design-docs/
29. Pragmatic Engineer — RFCs, Design Docs, ADRs — https://newsletter.pragmaticengineer.com/p/rfcs-and-design-docs

### Persona chuyên sâu
30. Marutitech — SDET vs QA — https://marutitech.com/differences-between-sdet-and-qa/
31. AltexSoft — SDET Role — https://www.altexsoft.com/blog/software-development-engineer-in-test-sdet-role/
32. Pencil&Paper — PM ↔ UX Designer collaboration — https://www.pencilandpaper.io/articles/product-manager-and-ux-designer-collaboration-guide
33. Itamar Gilad — How To Learn From FAANG — https://itamargilad.com/faang-process/

> Tổng: 33 nguồn (vượt 30 để đảm bảo đa dạng góc nhìn: official docs + engineering books + industry guides).

---

## 6. Insight cho workflow agent-driven (bước tiếp theo)

Từ research này, workflow spec-driven + subagent của mình sẽ map:
- **Giai đoạn 0-2** (Discovery→Requirements) → skill `interview-me` + `spec-driven-development` Phase SPECIFY → persona Product Manager, Business Analyst, Architect
- **Giai đoạn 3** (Design) → skill `system-architecture-design` + `spec-driven-development` Phase PLAN → persona Architect, Tech Lead, UX, Security
- **Giai đoạn 3→4** (Tasks) → skill `planning-and-task-breakdown` → persona Tech Lead
- **Giai đoạn 4-5** (Implement+Test) → skill `incremental-implementation` + `test-driven-development` + `code-review-and-quality` → persona Developer, QA, Reviewer (subagent song song)
- **Giai đoạn 6-7** (Deploy+Maintain) → skill `shipping-and-launch` + `observability-and-instrumentation` → persona DevOps, SRE

> Bước tiếp: Anh yêu xác nhận → em thiết kế workflow 2 chế độ (human-in-loop + auto-loop) với subagent orchestration dựa trên mapping này.
