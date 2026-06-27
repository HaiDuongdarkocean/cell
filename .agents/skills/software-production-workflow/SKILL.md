---
name: software-production-workflow
description: 8-phase software production process (0-7). Use when starting any feature/bugfix/refactor to identify which phase you are in and which skills to invoke. Encodes the full lifecycle from discovery to maintenance with file ops, verify steps, and skill activation per phase.
---

# Software Production Workflow

> **Nguyên lý**: Tham chiếu spec, không tin memory. Verify bằng `ls`, không tin docs.
> **Điểm khởi đầu**: AGENTS.md → skill này → `docs/0-wiki.md` → chain tham chiếu.
> **Nguồn**: `docs/software-production-process-research.md` (synthesis 30 nguồn: Google, Microsoft, Amazon, Scrum, DevOps).
> 8 giai đoạn (0-7). Mỗi giai đoạn: skill kích hoạt → input/output tài liệu → file ops → verify.

## Giai đoạn 0 — Discovery / Ideation
**Mục đích**: Xác định vấn đề cần giải, vision, cơ hội.
**Skill kích hoạt**: `idea-refine` (stress-test assumptions) → `interview-me` (clarify intent)
**Ponytail**: rung 1 (YAGNI) — "Does this need to be built at all?" Question complex requests: "Do you actually need X, or does Y cover it?"
**Input**: User request (raw, underspecified)
**Output**: `docs/intent/<feature>.md` (vision, problem statement, opportunity)
**File ops**:
- XEM: `docs/0-wiki.md` (biết docs hiện có)
- THÊM: `docs/intent/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

## Giai đoạn 1 — Planning & Feasibility
**Mục đích**: Đánh giá khả thi, lập kế hoạch, phân bổ nguồn lực.
**Skill kích hoạt**: `planning-and-task-breakdown` (break work into tasks) → `cto-persona` (tech strategy, build-vs-buy)
**Ponytail**: rung 2 (reuse codebase) — "Does it already exist? Reuse the helper, util, or pattern that's already here."
**Input**: `docs/intent/<feature>.md`
**Output**: `docs/plan/<feature>.md` (task breakdown, scope, risks)
**File ops**:
- XEM: `docs/intent/<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/plan/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

## Giai đoạn 2 — Requirements / Spec
**Mục đích**: Biến nhu cầu thành yêu cầu cụ thể, có thể test được.
**Skill kích hoạt**: `spec-driven-development` (write PRD before code) → `interview-me` (resolve open questions) → `security-and-hardening` (security/privacy requirements)
**Ponytail**: rung 3-5 (stdlib → native → installed dep) — "Does stdlib/native/installed dep solve it before specifying custom implementation?"
**Input**: `docs/intent/<feature>.md`, `docs/plan/<feature>.md`
**Output**: `docs/specs/<feature>.md` (SRS/PRD: functional + non-functional + acceptance criteria)
**File ops**:
- XEM: `docs/intent/`, `docs/plan/`, `docs/knowledge/` (grep keywords liên quan)
- THÊM: `docs/specs/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

## Giai đoạn 3 — Design / Architecture
**Mục đích**: Thiết kế kiến trúc + UI/UX + threat model trước khi code.
**Skill kích hoạt**: `system-architecture-design` → `cto-persona` (governance) → `api-and-interface-design` (module boundaries) → `security-and-hardening` (threat model) → `frontend-ui-engineering` (UI design) → `conceptualization` (trigger 3: architecture decision → principle)
**Input**: `docs/specs/<feature>.md`
**Output**: `docs/adr/<decision>.md` (mỗi quyết định 1 file), updated `docs/2-architechture-system.md`
**File ops**:
- XEM: `docs/specs/<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/adr/<decision>.md`
- UPDATE: `docs/2-architechture-system.md` (Cây thư mục + Bảng phụ thuộc + Function Index)
- UPDATE: `docs/0-wiki.md` (mục lục)
- LEARNING: nếu architecture decision có insight reusable → invoke `/conceptualization` (trigger 3)

## Giai đoạn 4 — Implementation / Coding
**Mục đích**: Viết code theo design, TDD, code review, atomic commits.
**Skill kích hoạt**: `test-driven-development` (RED→GREEN→REFACTOR) → `source-driven-development` (cite official docs) → `incremental-implementation` (>1 file) → `frontend-ui-engineering` (UI) → `git-workflow-and-versioning` (atomic commits) → `conceptualization` (trigger 2: feature insight, trigger 4: refactor discovery, trigger 5: cross-cutting pattern)
**Ponytail** (always-on, AGENTS.md): PRE-FILTER before TDD + implementation rules + self-check
**Input**: `docs/specs/<feature>.md`, `docs/plan/<feature>.md`, `docs/2-architechture-system.md`
**Output**: `src/` code + `tests/` + updated `docs/2-architechture-system.md`

**Pre-Task (XÁC ĐỊNH)**:
1. **PHẢI đọc** spec → xác định chính xác nhiệm vụ (không tin memory)
2. **PHẢI grep** `docs/knowledge/` cho keywords → tránh tái phạm pattern
3. **PHẢI đọc** Function Index → biết function liên quan đã tồn tại chưa
4. **PHẢI check** Bảng phụ thuộc → biết sửa file X ảnh hưởng file Y nào

**Ponytail ladder (PRE-FILTER — chạy TRƯỚC TDD)**:
1. YAGNI — "Does this need to be built at all?" → no: skip
2. Reuse codebase — "Does it already exist?" → yes: reuse, skip TDD cho phần đó
3. Stdlib — "Does standard library do it?" → yes: use, skip custom code
4. Native platform — "Does native feature cover it?" → yes: use
5. Installed dependency — "Does installed dep solve it?" → yes: use
6. One line — "Can this be one line?" → yes: one line
7. Only then: write minimum code that works → **TDD áp dụng từ đây**

**Implementation (LÀM)**:
1. TDD: RED (viết test fail) → GREEN (minimal impl) → REFACTOR (5-axis review)
2. Ponytail rules (implementation constraints):
   - No abstractions not explicitly requested (spec/ADR = explicitly requested)
   - No new dependency if avoidable
   - Deletion over addition. Boring over clever. Fewest files possible
   - Shortest working diff wins, but only once you understand the problem
   - Mark intentional simplifications with `ponytail:` comment (name ceiling + upgrade path)
3. Invoke skill liên quan: `/test-driven-development`, `/source-driven-development`

**Ponytail self-check (sau khi code pass ladder rung 7)**:
- Non-trivial logic → **PHẢI** leave ONE runnable check (assert-based demo or one small test file)
- Trivial one-liners → no test needed
- **Baseline TDD override**: project baseline.md says "when in doubt, write the test" — baseline wins over ponytail "trivial no test"

**File ops**:
- XEM: `docs/2-architechture-system.md` (Cây thư mục + Bảng phụ thuộc + Function Index), `docs/knowledge/` (grep keywords)
- THÊM: `src/<file>.ts`, `tests/unit/<file>.test.ts`
- UPDATE: `docs/2-architechture-system.md` — **3 chỗ** (theo thứ tự):
  a. **Cây thư mục** (ĐẦU file) — DỄ QUÊN NHẤT
  b. **Bảng phụ thuộc** (GIỮA file)
  c. **Function Index** (CUỐI file)
- Sửa function → chỉ update Function Index nếu input/output thay đổi; skip nếu implementation thay đổi
- VERIFY: `ls src/` từng thư mục → compare với Cây thư mục → **PHẢI confirm không thiếu** (không tin memory, tin `ls`)

**Pre-Commit (VERIFY + COMMIT)**:
1. **PHẢI chạy** `git diff --name-only` → biết file nào thay đổi
2. **Nếu docs/ thay đổi** → **PHẢI update** `docs/0-wiki.md` mục lục
3. **Nếu insight reusable** → **PHẢI check** `docs/knowledge/principles.md`: grep keyword → pattern mới → invoke `/conceptualization` skill → update 2 layers (principle index + case study file). 5 triggers: bug fix verified, feature insight, architecture decision, refactor discovery, cross-cutting pattern
4. **Nếu thay đổi kiến trúc** → **PHẢI thêm** ADR vào `docs/adr/<decision>.md`
5. **PHẢI invoke** `git-workflow-and-versioning` skill
6. **Atomic commit test**: "Có thể revert commit này mà build vẫn pass?" → YES = commit riêng; NO = gộp
7. **Size check**: `git diff --staged --stat` — nếu > 300 lines → split
8. **Separate concerns**: code commit ≠ docs commit (2 commit riêng); feature ≠ refactor (2 commit)
9. **TDD cycle**: RED → GREEN → COMMIT → REFACTOR → COMMIT
10. **Pre-Commit Hygiene**: `git diff --staged` (check secrets) → `npm test` → `npm run lint` → `npx tsc --noEmit`
11. **Browser verification (stop-the-line)**: Nếu thay đổi động đến content-script, popup, UI, hoặc bất kỳ code chạy trong browser → **PHẢI chạy MCP/Playwright test (thực tế trên browser) và pass trước khi commit**. Không được commit dựa trên unit test + tsc alone khi bug là visual/runtime.
12. **Format**: `<type>: <description>` — types: feat, fix, refactor, test, docs, chore. Body explains why, not what.

## Giai đoạn 5 — Testing / Verification
**Mục đích**: Verify code đáp ứng requirements + an toàn + ổn định.
**Skill kích hoạt**: `test-driven-development` (test pyramid) → `code-review-and-quality` (5-axis review) → `browser-testing-with-devtools` (browser code) → `security-and-hardening` (SAST/DAST) → `performance-optimization` (perf test) → `doubt-driven-development` (adversarial review)
**Input**: `src/` code + `tests/` + `docs/specs/<feature>.md` (acceptance criteria)
**Output**: Test reports, code review log
**File ops**:
- XEM: `docs/specs/<feature>.md` (acceptance criteria), `tests/`
- THÊM: `tests/integration/`, `tests/e2e/` (nếu cần)
- UPDATE: `tests/unit/` (fix failing tests)

## Giai đoạn 6 — Deployment / Release
**Mục đích**: Release build đã verify ra production an toàn, có rollback.
**Skill kích hoạt**: `shipping-and-launch` (pre-launch checklist, staged rollout, rollback) → `ci-cd-and-automation` (CI/CD pipeline) → `observability-and-instrumentation` (monitoring setup)
**Input**: `src/` code (verified), `docs/specs/<feature>.md`
**Output**: Release artifact, release notes, deployment runbook
**File ops**:
- XEM: `docs/specs/<feature>.md` (success criteria)
- UPDATE: `docs/0-wiki.md` (changelog, version)

## Giai đoạn 7 — Maintenance / Operations
**Mục đích**: Giữ hệ thống ổn định, fix bug, monitor, evolve.
**Skill kích hoạt**: `debugging-and-error-recovery` (root-cause debug) → `observability-and-instrumentation` (monitor, diagnose) → `conceptualization` (trigger 1: bug fix verified → principle, 2-layer) → `deprecation-and-migration` (remove old systems) → `code-simplification` (refactor clarity)
**Ponytail**: bug fix = root cause, not symptom — grep every caller of the function you touch, fix the shared function once. One guard there is a smaller diff than one per caller. Patching only the path the ticket names leaves a sibling caller still broken.
**Input**: Bug report / incident / monitoring alert
**Output**: `docs/knowledge/principles.md` (layer 1: principle entry) + `docs/knowledge/<case-name>.md` (layer 2: case study), postmortem
**File ops**:
- XEM: `docs/knowledge/principles.md` (grep keywords → apply nguyên lý)
- THÊM: `docs/knowledge/<case-name>.md` (layer 2: case study mới)
- UPDATE: `docs/knowledge/principles.md` (layer 1: thêm principle entry hoặc cases link)
- UPDATE: `docs/2-architechture-system.md` (nếu fix ảnh hưởng architecture)

-> Tự biết bản thân mình đang ở giai đoạn nào và áp dụng các quy trình có trong giai đoạn đó.

## Cross-cutting Skills (áp dụng mọi giai đoạn)
| Skill | Khi nào |
|---|---|
| `doubt-driven-development` | Mọi quyết định non-trivial — adversarial review trước khi stand |
| `context-engineering` | Session start, context degradation, task switch (activate at 80% capacity) |
| `using-agent-skills` | Discover skills khi không biết dùng skill nào |
| `documentation-and-adrs` | Architecture decisions (GĐ 3), API changes (GĐ 4), ship features (GĐ 6) |
| `git-workflow-and-versioning` | Mọi code change (GĐ 4-7) |

## Skill Synergies
- **Ponytail PRE-FILTER + TDD**: AGENTS.md ponytail (ladder rung 1-7, before code) → `test-driven-development` (RED→GREEN→REFACTOR, only for code that needs to exist) → `code-review-and-quality` (5-axis review)
- **Chrome Extension Safety**: AGENTS.md baseline + `source-driven-development` + `browser-testing-with-devtools`
- **Architecture + Incremental**: `system-architecture-design` + `incremental-implementation` + `planning-and-task-breakdown`
- **Correctness + Doubt**: `doubt-driven-development` + `test-driven-development` + `browser-testing-with-devtools`
- **Performance + Measurement**: `performance-optimization` + `observability-and-instrumentation`
- **Security + Validation**: `security-and-hardening` + `doubt-driven-development`
- **Learning + Conceptualization**: `debugging-and-error-recovery` (root cause) → `conceptualization` (5 triggers → 2-layer principle) → `code-review-and-quality` (axis 6: lessons)
