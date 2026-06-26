# Project Knowledge

## Tech Stack
- **Runtime**: Chrome Extension MV3 (manifest v3)
- **UI**: React 19, Zustand 5, TypeScript 6
- **Build**: Vite 8 + @crxjs/vite-plugin
- **Transmuxing**: mux.js 6 (TS → fMP4)
- **Testing**: Jest 30 (unit + integration), Playwright (E2E)
- **Linting**: ESLint 9 + Prettier 3
- **Platform**: Windows (PowerShell) — no bash heredoc, use temp file + `git commit -F`

## Commands
```
Build:            npm run build
Typecheck:        npm run typecheck
Test (all):       npm test                  # unit + integration (~29s)
Test unit only:   npm run test:unit         # ~3s, day-to-day (alias: test:fast)
Test integration: npm run test:integration  # real m3u8 download + transmux
Test watch:       npm run test:watch        # unit only
Coverage:         npm run test:coverage
Lint:             npm run lint
Lint fix:         npm run lint:fix
E2E:              npm run test:e2e
```

Note: `npm test -- --testPathPattern=` is deprecated in jest 30; use `--testPathPatterns=`.

## Jest Projects (unit + integration split)
- **unit**: `tests/unit/**`, `tests/components/**`, `tests/utils/**`, `src/**` — `*.test.ts(x)`. ~3s, no network.
- **integration**: `tests/integration/**` — `*.integration.test.ts`. Uses `globalSetup` to download m3u8 + TS segments ONCE, cache to `.cache/` (gitignored).
- Run single: `npm run test:unit` / `npm run test:integration`, or `npx jest --selectProjects unit`.

## Code Conventions
- Functional components with hooks (no class components)
- Named exports (no default exports)
- Colocate tests: `Button.tsx` → `Button.test.tsx`
- Pure functions for logic (testable, no side effects)
- TypeScript strict mode — no `any` without justification
- Chrome API calls cite official docs: https://developer.chrome.com/docs/extensions/reference/
- Ponytail ladder (`.windsurf/rules/ponytail.md`): YAGNI → reuse codebase → stdlib → native → installed dep → one-liner → minimal
- **Always pass `tabId` in message payloads** — Chrome MV3 `sendMessage` cannot target specific tabs, broadcasts fan out to every listener. Popup filters by `tabId` in payload.
- **`getActiveContentTab()` for active tab resolution** — use `src/popup/utils/getActiveContentTab.ts`, not inline `chrome.tabs.query`. Handles Edge app-windows by filtering `chrome-extension://` URLs.
- **Auto-download guard uses id-level dedup** — `autoDownloadedTabs: Map<tabId, { url, enqueuedIds: Set<string> }>`, not URL-level guard (URL guard too coarse, blocks subtitle catch-up).

## Boundaries
- Never commit `.env` files or secrets
- Never add dependencies without checking bundle size
- Never modify `manifest.json` without testing in real Chrome

## Level 2 Reference Docs (load per session, NOT always-on)
- [docs/0-wiki.md](docs/0-wiki.md) — Mục lục tổng quan (cây thư mục + cách dùng)
- [docs/1-share-language.md](docs/1-share-language.md) — Glossary human ↔ system language
- [docs/2-architechture-system.md](docs/2-architechture-system.md) — Architecture chi tiết (src/ + tests/ + dependency + function index + data flows + ADR)
- [docs/knowledge/principles.md](docs/knowledge/principles.md) — Principle index (abstract: broadcasts, dedup, gather candidates, hybrid detection, dead field, codec config)
- [docs/knowledge/auto-download-subtitle-catchup.md](docs/knowledge/auto-download-subtitle-catchup.md) — Auto-download subtitle catch-up (incremental media detection)
- [docs/knowledge/tab-scoping-popup-leak.md](docs/knowledge/tab-scoping-popup-leak.md) — Tab-Scoping (popup media leak fix)
- [docs/knowledge/edge-app-window-leak.md](docs/knowledge/edge-app-window-leak.md) — Edge app-window leak (popup renders empty on Edge)
- [docs/knowledge/subtitle-language-detection.md](docs/knowledge/subtitle-language-detection.md) — Subtitle Language Detection (hybrid script + frequency)
- [docs/knowledge/subtitle-filename-matches-video.md](docs/knowledge/subtitle-filename-matches-video.md) — Subtitle filename matches video filename + language suffix
- [docs/knowledge/parallel-fmp4-merge.md](docs/knowledge/parallel-fmp4-merge.md) — Parallel fMP4 Merge (ftyp+moov stripping + tfdt offset)
- [docs/knowledge/architecture-auto-select.md](docs/knowledge/architecture-auto-select.md) — Auto-Select & Auto-Download feature architecture
- [docs/reference/chrome-devtools-mcp.md](docs/reference/chrome-devtools-mcp.md) — chrome-devtools MCP config
- [docs/reference/e2e-debugging.md](docs/reference/e2e-debugging.md) — E2E Debugging with Chrome DevTools MCP
- [docs/spec-subtitle-overlay.md](docs/spec-subtitle-overlay.md) — Subtitle overlay feature spec

---

## Software Production Workflow

> **Nguyên lý**: Tham chiếu spec, không tin memory. Verify bằng `ls`, không tin docs.
> **Điểm khởi đầu**: AGENTS.md (file này) → `.windsurf/rules/` → `docs/0-wiki.md` → chain tham chiếu.
> **Nguồn**: `docs/software-production-process-research.md` (synthesis 30 nguồn: Google, Microsoft, Amazon, Scrum, DevOps).
> 8 giai đoạn (0-7). Mỗi giai đoạn: skill kích hoạt → input/output tài liệu → file ops → verify.

### Giai đoạn 0 — Discovery / Ideation
**Mục đích**: Xác định vấn đề cần giải, vision, cơ hội.
**Skill kích hoạt**: `idea-refine` (stress-test assumptions) → `interview-me` (clarify intent)
**Input**: User request (raw, underspecified)
**Output**: `docs/intent/<feature>.md` (vision, problem statement, opportunity)
**File ops**:
- XEM: `docs/0-wiki.md` (biết docs hiện có)
- THÊM: `docs/intent/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

### Giai đoạn 1 — Planning & Feasibility
**Mục đích**: Đánh giá khả thi, lập kế hoạch, phân bổ nguồn lực.
**Skill kích hoạt**: `planning-and-task-breakdown` (break work into tasks) → `cto-persona` (tech strategy, build-vs-buy)
**Input**: `docs/intent/<feature>.md`
**Output**: `docs/plan/<feature>.md` (task breakdown, scope, risks)
**File ops**:
- XEM: `docs/intent/<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/plan/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

### Giai đoạn 2 — Requirements / Spec
**Mục đích**: Biến nhu cầu thành yêu cầu cụ thể, có thể test được.
**Skill kích hoạt**: `spec-driven-development` (write PRD before code) → `interview-me` (resolve open questions) → `security-and-hardening` (security/privacy requirements)
**Input**: `docs/intent/<feature>.md`, `docs/plan/<feature>.md`
**Output**: `docs/specs/<feature>.md` (SRS/PRD: functional + non-functional + acceptance criteria)
**File ops**:
- XEM: `docs/intent/`, `docs/plan/`, `docs/knowledge/` (grep keywords liên quan)
- THÊM: `docs/specs/<feature>.md`
- UPDATE: `docs/0-wiki.md` (mục lục)

### Giai đoạn 3 — Design / Architecture
**Mục đích**: Thiết kế kiến trúc + UI/UX + threat model trước khi code.
**Skill kích hoạt**: `system-architecture-design` → `cto-persona` (governance) → `api-and-interface-design` (module boundaries) → `security-and-hardening` (threat model) → `frontend-ui-engineering` (UI design)
**Input**: `docs/specs/<feature>.md`
**Output**: `docs/adr/<decision>.md` (mỗi quyết định 1 file), updated `docs/2-architechture-system.md`
**File ops**:
- XEM: `docs/specs/<feature>.md`, `docs/2-architechture-system.md`
- THÊM: `docs/adr/<decision>.md`
- UPDATE: `docs/2-architechture-system.md` (Cây thư mục + Bảng phụ thuộc + Function Index)
- UPDATE: `docs/0-wiki.md` (mục lục)

### Giai đoạn 4 — Implementation / Coding
**Mục đích**: Viết code theo design, TDD, code review, atomic commits.
**Skill kích hoạt**: `test-driven-development` (RED→GREEN→REFACTOR) → `source-driven-development` (cite official docs) → `incremental-implementation` (>1 file) → `frontend-ui-engineering` (UI) → `ponytail.md` (lazy ladder) → `git-workflow-and-versioning` (atomic commits)
**Input**: `docs/specs/<feature>.md`, `docs/plan/<feature>.md`, `docs/2-architechture-system.md`
**Output**: `src/` code + `tests/` + updated `docs/2-architechture-system.md`

**Pre-Task (XÁC ĐỊNH)**:
1. **PHẢI đọc** spec → xác định chính xác nhiệm vụ (không tin memory)
2. **PHẢI grep** `docs/knowledge/` cho keywords → tránh tái phạm pattern
3. **PHẢI đọc** Function Index → biết function liên quan đã tồn tại chưa
4. **PHẢI check** Bảng phụ thuộc → biết sửa file X ảnh hưởng file Y nào

**Implementation (LÀM)**:
1. TDD: RED (viết test fail) → GREEN (minimal impl) → REFACTOR (5-axis review)
2. Ponytail lazy ladder: reuse > rewrite > new code
3. Invoke skill liên quan: `/test-driven-development`, `/source-driven-development`

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
3. **Nếu test pass + debug pass** → **PHẢI check** `docs/knowledge/`: grep keyword → pattern mới → invoke `/conceptualization` skill
4. **Nếu thay đổi kiến trúc** → **PHẢI thêm** ADR vào `docs/adr/<decision>.md`
5. **PHẢI invoke** `git-workflow-and-versioning` skill
6. **Atomic commit test**: "Có thể revert commit này mà build vẫn pass?" → YES = commit riêng; NO = gộp
7. **Size check**: `git diff --staged --stat` — nếu > 300 lines → split
8. **Separate concerns**: code commit ≠ docs commit (2 commit riêng); feature ≠ refactor (2 commit)
9. **TDD cycle**: RED → GREEN → COMMIT → REFACTOR → COMMIT
10. **Pre-Commit Hygiene**: `git diff --staged` (check secrets) → `npm test` → `npm run lint` → `npx tsc --noEmit`
11. **Format**: `<type>: <description>` — types: feat, fix, refactor, test, docs, chore. Body explains why, not what.

### Giai đoạn 5 — Testing / Verification
**Mục đích**: Verify code đáp ứng requirements + an toàn + ổn định.
**Skill kích hoạt**: `test-driven-development` (test pyramid) → `code-review-and-quality` (5-axis review) → `browser-testing-with-devtools` (browser code) → `security-and-hardening` (SAST/DAST) → `performance-optimization` (perf test) → `doubt-driven-development` (adversarial review)
**Input**: `src/` code + `tests/` + `docs/specs/<feature>.md` (acceptance criteria)
**Output**: Test reports, code review log
**File ops**:
- XEM: `docs/specs/<feature>.md` (acceptance criteria), `tests/`
- THÊM: `tests/integration/`, `tests/e2e/` (nếu cần)
- UPDATE: `tests/unit/` (fix failing tests)

### Giai đoạn 6 — Deployment / Release
**Mục đích**: Release build đã verify ra production an toàn, có rollback.
**Skill kích hoạt**: `shipping-and-launch` (pre-launch checklist, staged rollout, rollback) → `ci-cd-and-automation` (CI/CD pipeline) → `observability-and-instrumentation` (monitoring setup)
**Input**: `src/` code (verified), `docs/specs/<feature>.md`
**Output**: Release artifact, release notes, deployment runbook
**File ops**:
- XEM: `docs/specs/<feature>.md` (success criteria)
- UPDATE: `docs/0-wiki.md` (changelog, version)

### Giai đoạn 7 — Maintenance / Operations
**Mục đích**: Giữ hệ thống ổn định, fix bug, monitor, evolve.
**Skill kích hoạt**: `debugging-and-error-recovery` (root-cause debug) → `observability-and-instrumentation` (monitor, diagnose) → `conceptualization` (khái niệm hóa bug → nguyên lý) → `deprecation-and-migration` (remove old systems) → `code-simplification` (refactor clarity)
**Input**: Bug report / incident / monitoring alert
**Output**: `docs/knowledge/<principle>.md` (nguyên lý từ bug), postmortem
**File ops**:
- XEM: `docs/knowledge/` (grep keywords liên quan → apply nguyên lý)
- THÊM: `docs/knowledge/<principle>.md` (nguyên lý mới)
- UPDATE: `docs/knowledge/<principle>.md` (cases mới cho nguyên lý đã có)
- UPDATE: `docs/2-architechture-system.md` (nếu fix ảnh hưởng architecture)

### Cross-cutting Skills (áp dụng mọi giai đoạn)
| Skill | Khi nào |
|---|---|
| `doubt-driven-development` | Mọi quyết định non-trivial — adversarial review trước khi stand |
| `context-engineering` | Session start, context degradation, task switch (activate at 80% capacity) |
| `using-agent-skills` | Discover skills khi không biết dùng skill nào |
| `documentation-and-adrs` | Architecture decisions (GĐ 3), API changes (GĐ 4), ship features (GĐ 6) |
| `git-workflow-and-versioning` | Mọi code change (GĐ 4-7) |

### Skill Synergies
- **TDD + Minimalism + Review**: `test-driven-development` + `ponytail.md` + `code-review-and-quality`
- **Chrome Extension Safety**: `baseline.md` + `source-driven-development` + `browser-testing-with-devtools`
- **Architecture + Incremental**: `system-architecture-design` + `incremental-implementation` + `planning-and-task-breakdown`
- **Correctness + Doubt**: `doubt-driven-development` + `test-driven-development` + `browser-testing-with-devtools`
- **Performance + Measurement**: `performance-optimization` + `observability-and-instrumentation`
- **Security + Validation**: `security-and-hardening` + `doubt-driven-development`

### File Placement Convention
knowledge → `docs/knowledge/`, specs → `docs/specs/`, intent → `docs/intent/`, plan → `docs/plan/`, reference → `docs/reference/`, adr → `docs/adr/`. KHÔNG lưu loose file ở docs/ root

### Communication
- always call me "Anh yêu", xưng là "em"
