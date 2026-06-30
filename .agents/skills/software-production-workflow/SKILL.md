---
name: software-production-workflow
description: 8-phase software production process (0-7). Use when starting any feature/bugfix/refactor to identify which phase you are in and which skills to invoke. Encodes the full lifecycle from discovery to maintenance with file ops, verify steps, and skill activation per phase.
---

# Software Production Workflow

> **Nguyên lý**: Tham chiếu spec, không tin memory. Verify bằng `ls`, không tin docs.
> **Điểm khởi đầu**: AGENTS.md → skill này → `docs/0-wiki.md` → chain tham chiếu.
> **Nguồn**: `docs/reference/software-production-process-research.md` (synthesis 30 nguồn: Google, Microsoft, Amazon, Scrum, DevOps).
> 8 giai đoạn (0-7). Mỗi giai đoạn: skill kích hoạt → input/output tài liệu → file ops → verify.

- dự án là spec-driven nên cần phải cập nhật docs thường xuyên, hãy đọc agents.md, ponytail.md và baseline.md. cần phải làm theo quy trình bằng cách xác định mình đang giai đoạn nào. đọc và theo công việc được liệt kê (invoke skill). tối quan trọng - không được skip đọc, viết, update, xem docs và commmits

## File Naming Convention
Mọi file docs feature phải theo format: `<prefix>-<name>.md` với prefix ∈ {`idea`, `intent`, `spec`, `plan`, `task`}. ADR giữ format riêng `NNN-<name>.md`.

| Prefix | Folder | Giai đoạn | Câu hỏi trả lời |
|---|---|---|---|
| `idea-` | `docs/intent/` | G0 (idea-refine) | Raw idea, chưa interview |
| `intent-` | `docs/intent/` | G0 (interview-me) | Confirmed intent (đã interview) + feasibility go/no-go nhẹ |
| `spec-` | `docs/specs/` | G1 (PRD/SRS) | What to build? F/NF/A criteria |
| `plan-` | `docs/plan/` | G2 (implementation plan) | Làm NHƯ THẾ NÀO (high-level)? Approach, scope, risk mitigation, milestones — cite spec |
| `task-` | `docs/task/` | G4 đầu (task breakdown) | How to build, step by step? |
| `NNN-` | `docs/adr/` | G3 (architecture) | Architecture decision + alternatives |

> **Thứ tự bắt buộc**: `intent` → `spec` → `plan` → `adr` → `task`. **Output của spec là input của plan** — plan phải cite spec (mỗi mục approach/risk/scope ánh xạ đến requirement trong spec). KHÔNG viết plan trước spec (plan không có gốc = opinion cảm tính).

**Ví dụ** cho feature "bilingual-subtitle-auto-load":
- `docs/intent/intent-bilingual-subtitle-auto-load.md` (G0)
- `docs/specs/spec-bilingual-subtitle-auto-load.md` (G1)
- `docs/plan/plan-bilingual-subtitle-auto-load.md` (G2 — cite spec)
- `docs/adr/007-bilingual-subtitle-auto-load.md` (G3)
- `docs/task/task-bilingual-subtitle-auto-load.md` (G4)

**Lý do prefix**: file bị copy/reference/move vẫn identify được giai đoạn + feature. Folder organize, prefix identify.

## Phase Boundary Commits (mỗi phase 1 commit)

> **Nguyên lý**: History sạch = revert từng phase được, review từng phase được, bisect chính xác. Docs phase (G0-G3) tách commit khỏi code phase (G4-G5) — không trộn docs + code trong 1 commit.

| Phase | Commit khi nào | Scope commit | Format |
|---|---|---|---|
| G0 Discovery | Sau khi xong file ops G0 (intent + 0-wiki update) | Chỉ docs: `docs/intent/` + `docs/0-wiki.md` | `docs: G0 intent <feature>` |
| G1 Spec | Sau khi xong file ops G1 (spec + 0-wiki update) | Chỉ docs: `docs/specs/` + `docs/0-wiki.md` | `docs: G1 spec <feature>` |
| G2 Plan | Sau khi xong file ops G2 (plan + 0-wiki update) | Chỉ docs: `docs/plan/` + `docs/0-wiki.md` | `docs: G2 plan <feature>` |
| G3 ADR | Sau khi xong file ops G3 (ADR + 2-arch update + 0-wiki update) | Chỉ docs: `docs/adr/` + `docs/2-architechture-system.md` + `docs/0-wiki.md` | `docs: G3 ADR-NNN <feature>` |
| G4 Implementation | Theo task list (atomic commit mỗi task hoặc nhóm task liên quan) | Code + test + `docs/2-architechture-system.md` + `docs/task/` | `feat: <task>` / `test: <task>` |
| G5 Testing | Sau mỗi verify checkpoint pass | Test report + fix nếu có | `test: G5 verify <feature>` |
| G6 Release | 1 commit release (version bump + changelog) | `manifest.json` + `docs/0-wiki.md` + release notes | `chore: release v<x.y.z>` |

**Quy tắc**:
1. **KHÔNG gộp nhiều phase docs vào 1 commit** — mỗi phase G0-G3 = 1 commit riêng. Lý do: revert G2 plan không mất G1 spec; bisect bug đến phase chính xác.
2. **KHÔNG trộn docs phase (G0-G3) với code phase (G4-G5)** trong 1 commit. Docs commit = `docs:` type, code commit = `feat:`/`fix:`/`test:`/`refactor:` type.
3. **G4 atomic commit theo task** — không phải 1 commit cho toàn bộ G4. Mỗi task (hoặc nhóm task liên quan chặt) = 1 commit. Test "có thể revert commit này mà build vẫn pass?" (đã có rule G4 Pre-Commit #8).
4. **Commit message body cite phase + feature** — vd: `docs: G3 ADR-013 subtitle-appearance-manager` (body: "Phase G3 of subtitle-appearance-manager. Adds ADR-013 + updates architecture map.").
5. **Nếu 1 phase có nhiều file docs** (vd G3: ADR + 2-arch update + 0-wiki update) → vẫn 1 commit cho toàn bộ phase đó (cùng chủ đề).
6. **Verify trước khi commit phase**: `git diff --name-only` → confirm chỉ file của phase đó; `ls` confirm file tồn tại (không tin memory).

**Lý do không skip commit giữa các phase docs**: Nếu G0-G3 gộp 1 commit → revert "plan sai" mất luôn spec đúng. Bisect "khi nào quyết định này được đưa vào" không tìm được commit chính xác. Mỗi phase = 1 quyết định riêng, commit riêng = audit trail rõ.

## Giai đoạn 0 — Discovery / Ideation
**Mục đích**: Xác định vấn đề cần giải, vision, cơ hội. **Cuối G0: feasibility go/no-go NHẸ** (chặn sớm feature rõ ràng không đáng làm, không sinh file plan).
**Skill kích hoạt**: `idea-refine` (stress-test assumptions) → `interview-me` (clarify intent) → `cto-persona` (go/no-go nhanh: build-vs-buy, risk thô)
**Ponytail**: rung 1 (YAGNI) — "Does this need to be built at all?" Question complex requests: "Do you actually need X, or does Y cover it?"
**Input**: User request (raw, underspecified)
**Output**: `docs/intent/intent-<feature>.md` (vision, problem statement, opportunity, **+ feasibility go/no-go section** ở cuối file: 1-2 đoạn build-vs-buy + risk thô + recommendation). Nếu idea-refine chạy trước interview-me → `docs/intent/idea-<feature>.md` (raw idea, chưa interview).
**File ops**:
- XEM: `docs/0-wiki.md` (biết docs hiện có), `docs/1-share-language.md` (glossary — cache miss khi anh dùng từ mới → hỏi confirm → thêm entry, xem Update protocol cuối file đó)
- THÊM: `docs/intent/intent-<feature>.md` (hoặc `idea-<feature>.md` nếu chưa interview) — **phải có section "Feasibility go/no-go"** ở cuối
- UPDATE: `docs/0-wiki.md` (mục lục), `docs/1-share-language.md` (nếu sinh term mới trong intent)

> **Feasibility go/no-go nhẹ (cuối G0)**: chỉ trả lời "Có rõ ràng không đáng làm không?" — nếu YES → dừng, không vào G1. Nếu NO (cần đánh giá sâu hơn) → vào G1 viết spec. Đánh giá feasibility CHUYÊN SÂU (build-vs-buy có cơ sở, risk mitigation cụ thể) chuyển xuống G2 plan, nơi có spec làm gốc.

## Giai đoạn 1 — Requirements / Spec
**Mục đích**: Biến nhu cầu thành yêu cầu cụ thể, có thể test được (PRD/SRS "what to build"). **Spec là GỐC cho plan** — mọi quyết định downstream (plan, ADR, task) phải cite spec.
**Skill kích hoạt**: `spec-driven-development` (write PRD before code) → `interview-me` (resolve open questions) → `security-and-hardening` (security/privacy requirements)
**Ponytail**: rung 3-5 (stdlib → native → installed dep) — "Does stdlib/native/installed dep solve it before specifying custom implementation?"
**Input**: `docs/intent/intent-<feature>.md` (kể cả section feasibility go/no-go)
**Output**: `docs/specs/spec-<feature>.md` (SRS/PRD: functional + non-functional + acceptance criteria + error cases + data flow + out-of-scope)
**File ops**:
- XEM: `docs/intent/`, `docs/knowledge/` (grep keywords liên quan), `docs/2-architechture-system.md` (biết hệ thống hiện có để spec thực tế), `docs/1-share-language.md` (glossary — spec phải dùng system term chính xác; cache miss → hỏi confirm → thêm entry)
- THÊM: `docs/specs/spec-<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục), `docs/1-share-language.md` (nếu spec introduce system term mới)

> **Lý do spec trước plan**: spec phơi bày complexity ẩn, edge cases, non-functional requirements — những thứ cần thiết để đánh giá feasibility/build-vs-buy CHÍN. Plan không có spec = opinion cảm tính. Spec ít đổi hơn plan, làm móng ổn định.

## Giai đoạn 2 — Implementation Plan
**Mục đích**: Dựa trên spec, lập kế hoạch triển khai high-level: approach, scope, risk mitigation, milestones, build-vs-buy CHUYÊN SÂU. **Output của spec = input của plan** — mỗi mục trong plan phải ánh xạ đến requirement trong spec.
**Skill kích hoạt**: `cto-persona` (build-vs-buy có cơ sở, tech strategy) → `doubt-driven-development` (stress-test approach) → `planning-and-task-breakdown` (chỉ phần high-level: phase chia, dependency, KHÔNG task list chi tiết — task list chi tiết ở G4)
**Ponytail**: rung 1-2 (YAGNI + reuse codebase) — "Does this need to be built at all? Does it already exist?"
**Input**: `docs/specs/spec-<feature>.md` (**BẮT BUỘC** — plan phải cite spec)
**Output**: `docs/plan/plan-<feature>.md` (implementation plan: approach per requirement, scope, risk mitigation [cite spec edge cases], milestones, build-vs-buy recommendation [cite spec complexity], KHÔNG task list chi tiết)
**File ops**:
- XEM: `docs/specs/spec-<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/plan/plan-<feature>.md` (mỗi section cite spec: "Req §3.2 → approach X")
- UPDATE: `docs/0-wiki.md` (mục lục)

> **CẢNH BÁO NHẦM LẪN PHỔ BIẾN**: Đừng dùng `planning-and-task-breakdown` để sinh task list chi tiết ở G2. Skill đó có 2 chế độ: (a) high-level phase chia cho G2 plan, (b) task list chi tiết cho G4. G2 chỉ dùng chế độ (a). Task list chi tiết chạy ở **G4 đầu** (sau Spec G1 + Plan G2 + ADR G3). G2 trả lời: "Làm NHƯ THẾ NÀO high-level? Approach? Risk mitigation? Milestones?"

## Giai đoạn 3 — Design / Architecture
**Mục đích**: Thiết kế kiến trúc + UI/UX + threat model trước khi code.
**Skill kích hoạt**: `system-architecture-design` → `cto-persona` (governance) → `api-and-interface-design` (module boundaries) → `security-and-hardening` (threat model) → `frontend-ui-engineering` (UI design) → `conceptualization` (trigger 3: architecture decision → principle)
**Input**: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md` (approach/risk đã có, ADR formalize quyết định)
**Output**: `docs/adr/NNN-<decision>.md` (mỗi quyết định 1 file, NNN = số thứ tự), updated `docs/2-architechture-system.md`
**File ops**:
- XEM: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/adr/NNN-<decision>.md`
- UPDATE: `docs/2-architechture-system.md` (Cây thư mục + Bảng phụ thuộc + Function Index)
- UPDATE: `docs/0-wiki.md` (mục lục)
- LEARNING: nếu architecture decision có insight reusable → invoke `/conceptualization` (trigger 3)

## Giai đoạn 4 — Implementation / Coding
**Mục đích**: Viết code theo design, TDD, code review, atomic commits.
**Skill kích hoạt**: `planning-and-task-breakdown` (break Spec+Plan+ADR thành task list chi tiết — chạy ĐẦU G4, chế độ task list) → `test-driven-development` (RED→GREEN→REFACTOR) → `source-driven-development` (cite official docs) → `incremental-implementation` (>1 file) → `frontend-ui-engineering` (UI) → `git-workflow-and-versioning` (atomic commits) → `conceptualization` (trigger 2: feature insight, trigger 4: refactor discovery, trigger 5: cross-cutting pattern)
**Ponytail** (always-on, AGENTS.md): PRE-FILTER before TDD + implementation rules + self-check
**Input**: `docs/specs/spec-<feature>.md`, `docs/plan/plan-<feature>.md`, `docs/adr/NNN-<decision>.md`, `docs/2-architechture-system.md`
**Output**: `docs/task/task-<feature>.md` (task list chi tiết — output của `planning-and-task-breakdown` chạy đầu G4) + `src/` code + `tests/` + updated `docs/2-architechture-system.md`

**Đầu G4 — Task breakdown (BẮT BUỘC trước khi code)**:
1. Invoke `planning-and-task-breakdown` (chế độ task list chi tiết) với input: Spec (G1) + Plan (G2) + ADR (G3)
2. Output: task list chi tiết (mỗi task: acceptance criteria, verification, dependencies, files likely touched)
3. Lưu task list vào `docs/task/task-<feature>.md` (folder riêng, không trộn với `docs/plan/` implementation plan) HOẶC dùng `todo_write` inline
4. **KHÔNG code trước khi có task list** — task list đảm bảo thứ tự dependency đúng, không quên task

**Pre-Task (XÁC ĐỊNH — cho mỗi task trong task list)**:
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
- XEM: `docs/2-architechture-system.md` (Cây thư mục + Bảng phụ thuộc + Function Index), `docs/knowledge/` (grep keywords), `docs/1-share-language.md` (glossary — biết system term hiện có để dùng lại, không sinh alias trùng)
- THÊM: `src/<file>.ts`, `tests/unit/<file>.test.ts`
- UPDATE: `docs/2-architechture-system.md` — **3 chỗ** (theo thứ tự):
  a. **Cây thư mục** (ĐẦU file) — DỄ QUÊN NHẤT
  b. **Bảng phụ thuộc** (GIỮA file)
  c. **Function Index** (CUỐI file)
- UPDATE: `docs/1-share-language.md` — **khi sinh system term mới** (tên file mới, tên toggle mới, tên message type mới, tên store key mới) → thêm entry "anh có thể gọi là Z → system term W"; **khi rename/refactor system term** → update entry (trigger 3, xem Update protocol cuối glossary)
- Sửa function → chỉ update Function Index nếu input/output thay đổi; skip nếu implementation thay đổi
- VERIFY: `ls src/` từng thư mục → compare với Cây thư mục → **PHẢI confirm không thiếu** (không tin memory, tin `ls`)

**Pre-Commit (VERIFY + COMMIT)**:
1. **PHẢI chạy** `git diff --name-only` → biết file nào thay đổi
2. **Nếu docs/ thay đổi** → **PHẢI update** `docs/0-wiki.md` mục lục
3. **Nếu insight reusable** → **PHẢI check** `docs/knowledge/principles.md`: grep keyword → pattern mới → invoke `/conceptualization` skill → update 2 layers (principle index + case study file). 5 triggers: bug fix verified, feature insight, architecture decision, refactor discovery, cross-cutting pattern
4. **Nếu thay đổi kiến trúc** → **PHẢI thêm** ADR vào `docs/adr/NNN-<decision>.md`
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
**Skill kích hoạt**: `test-driven-development` (test pyramid) → `code-review-and-quality` (5-axis review) → `extension-browser-debugging` (browser/extension code) → `security-and-hardening` (SAST/DAST) → `performance-optimization` (perf test) → `doubt-driven-development` (adversarial review)
**Input**: `src/` code + `tests/` + `docs/specs/spec-<feature>.md` (acceptance criteria)
**Output**: Test reports, code review log
**File ops**:
- XEM: `docs/specs/spec-<feature>.md` (acceptance criteria), `tests/`
- THÊM: `tests/integration/`, `tests/e2e/` (nếu cần)
- UPDATE: `tests/unit/` (fix failing tests)

## Giai đoạn 6 — Deployment / Release
**Mục đích**: Release build đã verify ra production an toàn, có rollback.
**Skill kích hoạt**: `shipping-and-launch` (pre-launch checklist, staged rollout, rollback) → `ci-cd-and-automation` (CI/CD pipeline) → `observability-and-instrumentation` (monitoring setup)
**Input**: `src/` code (verified), `docs/specs/spec-<feature>.md`
**Output**: Release artifact, release notes, deployment runbook
**File ops**:
- XEM: `docs/specs/spec-<feature>.md` (success criteria)
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
- UPDATE: `docs/1-share-language.md` (nếu refactor/rename/xóa system term → update hoặc xóa entry stale, xem Update protocol cuối glossary)

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
- **Chrome Extension Safety**: AGENTS.md baseline + `source-driven-development` + `extension-browser-debugging`
- **Architecture + Incremental**: `system-architecture-design` + `incremental-implementation` + `planning-and-task-breakdown`
- **Correctness + Doubt**: `doubt-driven-development` + `test-driven-development` + `extension-browser-debugging`
- **Performance + Measurement**: `performance-optimization` + `observability-and-instrumentation`
- **Security + Validation**: `security-and-hardening` + `doubt-driven-development`
- **Learning + Conceptualization**: `debugging-and-error-recovery` (root cause) → `conceptualization` (5 triggers → 2-layer principle) → `code-review-and-quality` (axis 6: lessons)
