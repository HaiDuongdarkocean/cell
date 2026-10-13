# Spec: Pipeline Redesign — Intent-first Agentic SDLC

> Intent: `docs/intent/pipeline-redesign.md` · Mode: Autonomous (confirmed frame) · Status: v1.4 — BA methodology round 2 folded (go/no-go + FURPS+ + stories/process/logic + system-analysis method chain)

## Objective

Redesign pipeline agentic SDLC của Tihoka (`.agents/skills/`, 48 skills) từ đầu: dời trọng tâm chất lượng từ downstream gate-stacking lên upstream — **BA theo IIBA** (needs đúng + đủ, scope khoanh vùng) → **system requirements** có traceability → **UI/UX design + validate trước build** → **deliver lean**. Thêm enforcement layer dựa trên machine-readable pipeline state + hooks, thay cho "agent tự nhớ route".

User: Anh yêu (PO vận hành pipeline qua agent). Đau điểm gốc (evidence trong intent doc): câu hỏi BA generic thiếu khung IIBA; intent sai → output sai; UI quyết lúc build → rework tay (FAB); nhiều gate chậm downstream; enforcement mềm.

**Sửa từ doubt-review:** FAB failure không phải intent thiếu — spec đã pin đúng primitives, defect là build-time drift + wrong-token-choice. DESIGN stage chống FAB bằng 3 lớp: component-mapping artifact + deterministic brief-lint + human/vision mockup verify — và `design-system-guardian` **giữ nguyên** post-build (nó chỉ grep được code).

## The redesigned pipeline

Pipeline là **graph có backward edge hợp lệ**, không phải line:

```
   ANALYZE ──→ SPECIFY ──→ DESIGN(ui) ──→ DELIVER ──→ SHIPPED
      │           ▲           │            │
      ▼           └───────────┴────────────┘
   dropped        backward edge → ANALYZE (loops+=1, cap 3)
   (no-go,        shipped + dropped = terminal; wrong-need
   terminal)      sau ship → backlog row mới, không transition
```

Non-feature work (bugfix, audit, research, debt, meta) **không đi qua pipeline** — router giữ 2 lớp: task-type routing + pipeline-stage routing cho feature work. Exception: **UI-touching bugfix** — `debugging-and-error-recovery` rewire: fix đụng `*.tsx`/CSS → component-check nhanh (map element → `src/shared/ui`/tokens) trước commit, không cần full DESIGN stage.

**Stage-chain driver:** backlog items → `idea-pick-off` điều khiển end-to-end. Feature không qua backlog (interactive) → mỗi stage skill kết thúc bằng route tới stage kế. `active` trong state file là **single-slug invariant** — `all` mode xử lý tuần tự, parallel lanes không đổi `active`.

### Stage contracts

| Stage | Input | Output artifacts | Gate (executor → artifact) |
|---|---|---|---|
| **ANALYZE** (`pipeline-analyze`) | backlog row / user statement | `docs/intent/<slug>.md`: `## Business Case` (BACCM inference), stakeholder map (team capability + customer + supplier + regulator), needs list (id + statement + evidence `file:line` hoặc `[assumption]` + confidence%, FURPS+ classified), scope boundary (in/out + non-goals), **AS-IS workflow narrative (kể chuyện: actors + trình tự + milestones, 3 loại tương tác) + `## Journey` — ≥1 journey trọn vẹn begin→middle→end + edge cases, cả as-is lẫn to-be**, business-level user stories (story≠task), risk register (pháp lý/tiềm ẩn/khả năng phản ứng), **`## Decision` go|no-go|defer**, draft need-level ACs, **`ui_surface: yes|no` field** | **Interactive:** hypothesis presentation → user confirm/sửa → approval record. **`all`:** `subagent_explore` fresh-context audit (needs cite evidence thật, scope bounded, **journey hoàn chỉnh không gãy**) → report. Cả hai emit `docs/reviews/<slug>-analyze.md`. **No-go → `analyze → dropped`** |
| **SPECIFY** (`pipeline-specify`) | confirmed intent doc | `docs/specs/<slug>.md` — invariants: path + `## Success Criteria` + traceability table need→requirement→AC (**canonical AC source cho DELIVER**); system-analysis sections: actor↔system boundary, **input→process→output**, yêu cầu chức năng (FR) + phi chức năng (NFR) | `spec-reviewer` subagent (3 lens, fresh-context) → `docs/reviews/<slug>-spec.md`. **Auto-fix loop ≤3:** APPROVE→pass; APPROVE WITH CHANGES→fix+re-review; REJECT→rewrite, sau 3 rounds escalate |
| **DESIGN** (`pipeline-design`) | spec + `ui_surface: yes` | `docs/intent/<slug>-design-brief.md` + `docs/intent/<slug>-component-mapping.md` + mockup `src/entrypoints/mockup-<slug>/` | **Interactive:** user approve trên mockup render thật (serve qua `npm run dev` + entry URL convention) → approval record `docs/reviews/<slug>-design.md`. **`all`:** brief + mapping + ASCII sketch + single-variant mockup → `check-design-brief.mjs` → playwright screenshot → `vision-reader` subagent judge DS-faithfulness → verdict ghi `docs/reviews/<slug>-design.md` |
| **DELIVER** (`pipeline-deliver`) | spec (+ design artifacts) | `tasks/plan-<slug>.md` + `tasks/todo-<slug>.md`, shipped feature, verify evidence | Deterministic gates: typecheck + lint + test:unit + build + browser verify; `code-review` gate executor = **fresh-context `subagent_explore` review lane** (generation≠review — pipeline.md verify lanes đã làm việc này); pre-commit-gate; business sign-off |

**ANALYZE = business analysis + functional-req analysis + logic analysis (thế giới thật trước, thế giới số chưa đụng):**

**Bước 1 — 4 việc đầu BA (trước khi phân tích sâu — "dục tốc bất đạt"):**
1. **Business case** — BACCM inference (Need=problem+opportunity, Change, Solution, Value, Stakeholder, Context); phân biệt dịch nghĩa/định nghĩa: "muốn X" thường là VALUE không phải NEED.
2. **Stakeholders** — team/năng lực (có đủ nguồn lực+thời gian làm không), customer, supplier/dependencies, tổ chức/regulator (giấy phép, quy định, chính sách). Absent stakeholder: persona 5–80.
3. **Root-cause + risk** — pain→need; rủi ro (con người/hoạt động/nội-ngoại vi), yếu tố tiềm ẩn (hiếm nhưng hậu quả lớn), pháp lý/quy định; khả năng phản ứng/giải quyết của team.
4. **Go/no-go decision** — `## Decision` trong intent doc: `go` | `no-go` | `defer`, kèm lý do. **No-go → `analyze → dropped`** (kill sớm, không mất nguồn lực — item terminal, `active` cleared, backlog → `dropped`).

**Bước 2 — functional requirements (business-level, chưa phải system):**
- Phân loại info theo **FURPS+** (Functional/Usability/Reliability/Performance/Supportability) — FR và NFR tách rõ ngay từ thu thập.
- **User stories:** "tôi muốn X để Y — xong khi Z" (as-a/I-want/so-that + done-when). Ở **góc độ business/nghiệp vụ** — CẤM "tôi muốn chức năng A, nút B, màn hình C" (đó là system, chưa tới). **Story ≠ task:** "chuyển tiền"=story, "chọn ngân hàng"=task con. Nguồn: brain-dump mọi mong muốn → cluster/group → stories; mỗi persona (chân dung) có journey riêng → nhu cầu riêng.
- **Business process — kể chuyện trước, vẽ sau:** narrative trước (nhân vật + trình tự + milestones + đầu/đuôi), diagram optional (notation tùy ý, quy tắc 15s đọc hiểu); chỉ mô tả process **liên quan product**, không mô tả cả thế giới. AS-IS workflow 3 loại tương tác (người↔người/người↔thiết bị/hệ thống↔hệ thống).
- **COMPLETE JOURNEY bắt buộc — cấm "gạch đầu dòng":** `## Journey` ≥1 journey trọn vẹn begin→middle→end + edge cases **cả as-is lẫn to-be**; story map ưu tiên theo journey hoàn chỉnh, không theo feature list.

**Bước 3 — logic analysis (khâu cuối BA, đệm trước system):**
- Review A→Z toàn bộ stories + business processes trên mọi hành trình user; tìm bất hợp lý/gãy/không phù hợp; góc nhìn đa chiều: pháp luật, tiện lợi, cảm giác thích thú/thoải mái, riêng tư, "quá khắt khe/tham vọng". Không có gì là "tốt nhất" — chỉ "hợp lý nhất" cho context.
- **Elicitation = hypothesis presentation:** (1) phân tích BACCM từ info có (domain scoping ≥1 grep) → (2) stakeholders + need từng người → (3) draft solution direction → (4) trình bày hypothesis cho user → (5) câu hỏi CHỈ cho gap phân tích — cấm template/generic questions. User confirm/sửa = gate.
- **`all` mode — self-interrogation:** cùng quy trình, agent tự hypothesis + tự trả lời; claim cite `file:line`/backlog row hoặc `[assumption]`.
- Kỹ thuật hỗ trợ (migrate interview-me/idea-refine): divergent trước converge, want-vs-should probe, document analysis (kể cả nguồn public), observation, research.
- **Confidence mapping:** `high ≥80% | medium 50–79% | low <50%`; `low` → `awaiting: flagged:<reason>`, không stall loop.
- **`ui_surface` write:** intent doc + `set uiSurface` + backlog `UI` Tihoka (3 chỗ).
- **Backward edge:** `loops += 1`; `loops == 3` → `flagged:loop-cap` + escalate.

**SPECIFY = system analysis (thế giới thật → thế giới số). Method chain:** user stories + business process + logic (từ ANALYZE) → use-case-like requirements → flows/states → function/feature structure → data. Overview trước, detail sau; review cả 2 chiều (top-down + bottom-up — "trong tổng quan có chi tiết, trong chi tiết có tổng quan").

- **Actor vs system boundary:** actor chỉ **trigger/input** (ra lệnh, nhập liệu, nhận output/hiển thị) — system xử lý bên trong. Cấm mô tả hành vi con người bên trong system flow (actor "insert card" = trigger, không phải system activity).
- **Input → process → output:** mỗi requirement phải trả lời — input lấy ở đâu, xử lý ra sao, output là gì.
- **Requirement format (use-case-spec rút gọn, markdown thuần — "công cụ chết người sống", không cần UML tool):** id, actor, mục tiêu, precondition, basic flow, alternative flow, exception flow, business rules, postcondition, NFR-refs. Luồng chính (bắt buộc để đạt mục tiêu) phân biệt luồng phụ (cộng thêm — bắt buộc hay optional). Flow phức tạp: mô tả state transitions + tương tác thành phần (sequence dạng text/numbered steps) khi cần.
- **Function vs feature:** function = system làm gì (mục tiêu/hoạt động hoàn thành); feature = công cụ hỗ trợ function (1 function ↔ nhiều feature). Spec có function→feature mapping — UI/design chỉ đụng feature sau khi function rõ.
- **FR + NFR:** yêu cầu chức năng (làm gì) VÀ phi chức năng (performance <3s, responsive, a11y, persist, i18n — persona 5–80; security/privacy + khả năng hạ tầng/nguồn lực theo risk analysis) — cả hai là requirement, không phải ghi chú.
- **Journey → requirements:** mỗi step trong to-be journey map được ≥1 requirement; requirement không trace được về journey/need = scope creep suspect (traceability table bắt).
- Priority order dựa trên journey hoàn chỉnh, không phải list rời.
- **Nguyên tắc tài liệu:** đúng + đủ trước, "chuẩn" sau — không áp đặt notation/formality lên chất lượng nội dung. Doc mapping: URD↔intent doc, SRS↔spec, test cases↔`## Success Criteria` (happy path + edge cases).

**DESIGN details:**
- **UI đồng bộ với system:** design brief mô tả user thao tác màn hình nào, theo thứ tự nào — map từng thao tác về step của to-be journey + system requirement nó phục vụ. UI đẹp mà không đồng bộ system = UX sai, gate fail.
- Component-mapping = artifact chống-FAB chính: mỗi element → reuse/extend/redesign/create vs `src/shared/ui`; mọi style tên token; mọi icon tên `ICON_CATALOG` id.
- Brief-lint `scripts/check-design-brief.mjs <slug>`: canonical paths `src/shared/styles/tokens.json`, `src/shared/ui/`, `src/shared/icons/index.ts`; parse cả brief + mapping; exit 1 + list missing khi thiếu. **Chạy cả 2 mode** (không chỉ `all`) — deterministic check không phân biệt mode.
- `design-system-guardian` giữ post-build audit — bổ sung, không thay thế.

**DELIVER details:**
- `idea-pick-off` = **queue driver**; `pipeline-deliver` = stage contract; `autonomous-pipeline` = **engine** cho M+ parallel lanes; XS/S in-session.
- **Ship condition:** interactive → business sign-off (blocking, `shipping-and-launch`). `all` mode → `deliver→shipped` khi deterministic gates green ∧ verify lanes PASS ∧ `awaiting==null`; business sign-off **deferred async** — loop report liệt kê commits, human veto/revert sau (giữ semantics pick-off hiện tại).
- Cắt: intent-level review trùng lặp downstream. Giữ: doubt-driven (opt-in + diverse-lens), code-level verify, deterministic gates.

## Pipeline state file — `tasks/pipeline-state.json`

Hooks đọc nó; stage ghi **chỉ qua** `scripts/pipeline-state.mjs`. **Chỉ main worktree write** (guard: `.git` là file ở worktree, là dir ở main — refuse write khi `.git` không phải dir; lanes không bao giờ write). Write atomic: tmp file + rename.

```json
{
  "active": "<slug|null>",
  "items": {
    "<slug>": {
      "stage": "analyze|specify|design|deliver|shipped|dropped",
      "mode": "interactive|all",
      "uiSurface": "yes|no|unknown",
      "artifacts": { "intent": "...", "spec": "...", "designBrief": "...",
                     "componentMapping": "...", "mockup": "...", "plan": "...",
                     "reviews": ["..."] },
      "gates": { "typecheck": {"v":"pass|fail","at":"<ISO>"}, "lint": {...},
                 "testUnit": {...}, "build": {...}, "browser": {...},
                 "briefLint": {"v":"pass|fail","at":"<ISO>"} },
      "confidence": "high|medium|low",
      "awaiting": null | "user-approval:intent" | "user-approval:design"
                  | "flagged:<reason>" | "blocked:<reason>",
      "resolutions": [ {"flag": "...", "note": "...", "at": "<ISO>"} ],
      "loops": 0,
      "updated": "<ISO>"
    }
  }
}
```

**Command surface** (`pipeline-state.mjs`):

| Command | Ghi chú |
|---|---|
| `init <slug> --mode <interactive|all>` | **entry point duy nhất** — tạo item `stage:analyze`, set `active` (refuse nếu `active` đã có — single-slug invariant); caller: `idea-pick-off` (queue) hoặc `pipeline-analyze` skill start (non-backlog) |
| `get <slug>` | đọc item |
| `set <slug> <field>=<v>` | **chỉ** cho `uiSurface|confidence|mode|artifacts.*` và `awaiting=<non-null>` (đặt flag) — CẤM `stage` (dùng transition), `gates.*` (ghi bởi tracker/checks), `awaiting=null` (dùng `resolve`), `loops` |
| `transition <slug> --to <stage>` | validate evidence tại call time (bảng dưới); exit 1 + stderr naming missing evidence khi refuse |
| `gates <slug> --set <gate>=<v>` | writer: gates-tracker hook + pre-commit-gate skill; observability cache — không phải enforcement path |
| `resolve <slug> --note "<lý do>"` | **cách duy nhất clear `awaiting`** — ghi `resolutions[] += {flag, note, at}` audit trail; nếu flag là `flagged:loop-cap` → reset `loops=0`; nếu resolution là rejection (vd user từ chối design) → agent transition backward ngay sau resolve |
| `seed <slug>` | cutover cho item mid-flight: scan artifacts → suy ra stage (bảng dưới); evidence rules **áp dụng như init** — artifact legacy thiếu (vd intent không có `## Journey`, review theo naming cũ `*-adversarial-*`) → item tạo với `awaiting: flagged:seeded` để human `resolve`, không bypass gate |

**Lifecycle:** `init` (create+activate) → `set`/`transition` (move) → `deliver→shipped` | `analyze→dropped` — cả hai **auto-clear `active=null`** → `resolve` (unblock khi flagged). Không có path nào tạo item ngoài `init`/`seed`.

**Transition table — evidence validated AT CALL TIME (không tin flag):**

| From → To | Transition tự kiểm |
|---|---|
| `analyze → specify` | `docs/reviews/<slug>-analyze.md` tồn tại ∧ verdict line parse được ∧ mtime ≥ intent doc mtime ∧ **journey structural check**: intent doc có `## Journey` section non-empty, chứa cả `as-is` và `to-be` markers, mỗi phần ≥3 step lines (`-`/numbered) — cả hai journey đều bắt buộc ∧ `## Decision` == `go` (defer → refuse, giữ ở analyze) |
| `analyze → dropped` | intent doc `## Decision` == `no-go` kèm reason → set `stage: dropped` + **auto-clear `active=null`** + backlog row status → `dropped` (kèm link reason) — kill sớm trước khi tốn nguồn lực |
| `dropped → *` | **terminal** — refuse mọi transition; re-open = backlog row mới (init mới) |
| `specify → design` | `docs/reviews/<slug>-spec.md` verdict ∈ {APPROVE, APPROVE_WITH_CHANGES} ∧ mtime ≥ spec mtime ∧ `uiSurface == yes` |
| `specify → deliver` | spec review pass như trên ∧ `uiSurface == no` |
| `design → deliver` | `componentMapping` tồn tại ∧ **transition tự invoke `check-design-brief.mjs`** (spawnSync, exit≠0 → refuse) ∧ design review artifact verdict PASS/APPROVE ∧ mtime ≥ mapping mtime |
| `design|specify|deliver → analyze` | `loops < 3` → `loops += 1` |
| `deliver → shipped` | `awaiting == null` ∧ verify artifact verdict PASS ∧ (interactive: sign-off record verdict SIGN_OFF ∧ required gates `pass` fresh; **`all`: transition tự spawnSync re-run `npm run typecheck && npm run lint && npm run test:unit && npm run build`** — exit≠0 → refuse, không tin `gates.*` cache) → **auto-clear `active=null`** |
| `shipped → *` | **terminal** — refuse mọi transition; wrong-need sau ship → backlog row mới |
| `* → (stay)` | `awaiting` set → transition refuse (human gate chưa xong — resolve trước) |

- **Verdict-line convention (M3):** mọi gate artifact kết thúc bằng dòng `VERDICT: <token>` — token ∈ `APPROVE | APPROVE_WITH_CHANGES | REJECT | PASS | FAIL | SIGN_OFF`. Parser lấy **dòng cuối** match `^VERDICT:\s*(\S+)` — tránh substring `APPROVE` nuốt `APPROVE_WITH_CHANGES`.
- `uiSurface == unknown` → `specify→design|deliver` refuse kèm message: `set uiSurface=<yes|no>` (cross-check field `ui_surface` trong intent doc trước).
- **"src mtime mới nhất"** = max mtime của files trong `git status --porcelain src/` (modified+untracked); tree sạch → dùng `git log -1 --format=%cI`.
- **Escalate** = `awaiting: flagged:loop-cap` + hiện trong session report + pick-off pause chờ human `resolve` (không auto-skip item).
- Review artifact **stale-invalidation**: artifact gate cũ hơn artifact nó gate (mtime) → coi như chưa review → refuse.
- Backlog `Status` enum: `icebox | analyzed | specced | designed | planned | in-progress | shipped | dropped` (giữ `dropped`). Mapping legacy: `specced`→specify done; `planned`→plan written; `in-progress`→inspect artifacts. Pick-off resume table cập nhật.
- `.gitignore`: thêm `!tasks/pipeline-state.json` **sau** dòng `tasks/*.json` (L173 — negation phải đứng sau pattern).

## Enforcement layer — hooks (6)

`.devin/hooks.v1.json` + `scripts/hook-*.mjs`. Contract đã verify: stdin JSON payload → stdout `{hookSpecificOutput:{hookEventName, additionalContext}}`; timeout ≤5s; fail-open.

| Event | Hook | Behavior |
|---|---|---|
| `SessionStart` | `hook-session-prime.mjs` | state → inject active item + stage + `awaiting` + stage-aware pointer (deliver→`tasks/plan-<slug>.md`; analyze→intent; specify→spec; design→design-brief). Không inject content đã pin. |
| `PreToolUse` `^(write|edit|notebook_edit)$` | `hook-stage-guard.mjs` | **No-op khi `active==null`.** Warn khi edit `docs/specs/<active>.md` mà spec-review artifact cũ hơn spec (stale). Warn khi edit `src/` (trừ `src/entrypoints/mockup-*`) mà `active` stage ∈ {analyze,specify,design} — message kèm "non-feature work thì ignore". **Warn khi edit trực tiếp `tasks/pipeline-state.json`** — "state chỉ ghi qua `pipeline-state.mjs`" (kể cả `active==null` — guard bypass duy nhất). |
| `PostToolUse` `exec` | `hook-gates-tracker.mjs` | **Chỉ khi `active` item stage==`deliver`**: detect `npm run typecheck|lint|test:unit|build` **hoặc `npx tsc --noEmit|eslint|vitest run|vite build`** với `tool_response.success==true` trong payload → `gates --set` (pre-commit-gate chạy npx — cả hai pattern đều primary, không phải fallback). Scope giới hạn tránh poison state khi non-feature work chạy song song. Payload `tool_response.{success,output,error}` = spike-verified. |
| `PostCompaction` | `hook-context-restore.mjs` | Re-inject pipeline-state + pointer AGENTS.md mandate (pointer, không content). |
| `Stop` | `hook-stop-gate.mjs` | Emit `{"decision":"block","reason":"gates stale/missing — rerun hoặc resolve trước khi stop"}` **chỉ khi**: tree dirty ∧ `active` stage==`deliver` ∧ có required gate thiếu `pass` hoặc `at` cũ hơn src-mtime mới nhất ∧ `awaiting==null` ∧ `stop_hook_active==false` (lần stop thứ 2 đi qua — one-shot warn, không loop). Block-ở-đây = ngăn agent dừng sớm + inject reason, không phải block tool call. |
| `SessionEnd` | `hook-session-report.mjs` | Append metrics `tasks/reports/`. |

`UserPromptSubmit`/`PostToolUse`(write|edit) hooks hiện có giữ nguyên.

**Framing trung thực:** enforcement thật = `transition` validate-at-call-time (artifact + verdict + lint invoke) + deterministic gates. Hooks = deterministic reminding + guardrail fail-open.

## Consolidation — disposition table (48 skills)

**Stage skills mới (4):**

| Skill | Disposition |
|---|---|
| `pipeline-analyze` | **NEW** — absorbs elicitation + interview-me (+4 plugins → `references/`) + idea-refine divergent step. ≤500 dòng (target ≤300), dài → `references/` |
| `pipeline-specify` | **NEW** — absorbs spec-driven-development + spec-review-stakeholder (stage gate + emit artifact + fix-loop ≤3) |
| `pipeline-design` | **NEW** — absorbs idea-to-interface core + all-mode variant + brief-lint wiring |
| `pipeline-deliver` | **NEW** — stage contract; gọi `autonomous-pipeline` engine cho M+ parallel |

**Stubs (6):** `elicitation` `interview-me` `idea-refine` → `pipeline-analyze`; `spec-driven-development` `spec-review-stakeholder` → `pipeline-specify`; `idea-to-interface` → `pipeline-design`. Frontmatter giữ name+description để trigger resolve. **Precedence:** router resolve stage skills trước; stub chỉ bắt legacy trigger phrase (vd `/elicitation`, "write a spec") rồi forward — stub không phải alternate implementation.

**Giữ/rewire (42):**

- Queue: `idea-pick-off` (rewire stages + resume table + status enum), `idea-grab` (giữ).
- DELIVER internals: `autonomous-pipeline` (engine — "invoked from pipeline-deliver"; `pipeline.md` Phase 1 → `tasks/plan-<slug>.md` + `todo-<slug>.md`), `planning-and-task-breakdown`, `incremental-implementation`, `context-engineering`, `source-driven-development`, `test-driven-development`, `pre-commit-gate` (+= brief-lint step khi design-brief trong change set; += check-skills step — §10.1 item 12; += `gates --set` record cuối skill).
- Verify/review: `doubt-driven-development`, `code-review-and-quality`, `code-simplification`, `security-and-hardening`, `performance-optimization`, `testing-with-playwright`, `testing-extension-browser`, `vision-reader`, `design-system-guardian` (post-build — giữ).
- Ship/docs: `git-workflow-and-versioning`, `documentation-and-adrs`, `shipping-and-launch`, `observability-and-instrumentation`, `deprecation-and-migration`.
- Task-type: `debugging-and-error-recovery` (+= UI component-check), `audit-technical-debt`, `audit-text-in-ui`, `audit-ui-ux-then-redesign`, `continuous-ux-audit-cycle`, `improve-animations`, `review-animations`, `find-animation-opportunities`, `animation-vocabulary`, `design-svg`, `subtitle-player-research`, `ci-cd-and-automation`, `inquiry-creativity`, `reprompt`, `caveman`.
- Meta: `write-skill`, `find-skills`, `learning-and-apply` (phase-name trigger update), `using-agent-skills` (**rewrite** 2-layer).

**Non-skill updates bắt buộc:**
- `AGENTS.md`: questioning rule → "trừ pipeline-analyze interactive + pipeline-design approval"; pipeline section; mockup path → `src/entrypoints/mockup-*`; thêm `tasks/` canon line (state file + plan-<slug>).
- `docs/ideas/product-backlog.md`: schema += `analyzed`/`designed`/`UI` flag; §2 rewire.
- `.agents/agents/spec-reviewer{,-swe,-glm}/AGENT.md`: repoint → `pipeline-specify` gate. **Fix bug có sẵn:** `spec-reviewer-swe/AGENT.md` frontmatter `name: spec-reviewer-glm` (duplicate) → `name: spec-reviewer-swe`; `spec-reviewer-glm/AGENT.md` `model: swe` → `model: glm` (bug thứ 2 cùng pass).
- `.gitignore`: `!tasks/pipeline-state.json` sau L173 + `tasks/.pipeline-state-*.tmp` (atomic-write tmp files).
- `docs/knowledge-base/agentic-sdlc.md`: §10.1 items 7–10+12 done w/ evidence; §10.3 wiring mới; §11 runbook mới; §11.4 += pipeline-state + `.agents/agents/`.
- `docs/0-wiki.md`: changelog.
- `scripts/update-skill-index.mjs`: giữ flat-dir scan.
- Scripts mới: `pipeline-state.mjs`, `check-design-brief.mjs`, 6 `hook-*.mjs`.

## Interface contracts (invariants)

1. `docs/specs/<slug>.md` path + `## Success Criteria` section — DELIVER extract verbatim.
2. Success Criteria = canonical AC source; draft ACs ở ANALYZE chỉ là input.
3. Review artifacts `docs/reviews/<slug>-{analyze,spec,design,verify,signoff}.md` — approval record hoặc fresh-context report; mỗi artifact kết thúc bằng `VERDICT: <token>` line; naming mới áp dụng từ đây, legacy files giữ.
4. `tasks/pipeline-state.json` — SSOT stage position; write qua helper; main-worktree only; atomic tmp+rename.
5. Mockup `src/entrypoints/mockup-<slug>/` (serve qua `npm run dev` → URL `http://localhost:5173/src/entrypoints/mockup-<slug>/index.html`); design artifacts `docs/intent/<slug>-{design-brief,component-mapping}.md`; plan `tasks/plan-<slug>.md` + `tasks/todo-<slug>.md`. **Retention:** mockup là design-time artifact — ship step xóa `mockup-<slug>/` (không ship vào product).
6. Artifact × mode matrix:

| Gate | Interactive | `all` mode |
|---|---|---|
| ANALYZE | approval record (who/when/frame hash) | `subagent_explore` audit report |
| SPECIFY | `spec-reviewer` report + fix-loop log | same |
| DESIGN | approval record (concept/mix) | lint output + `vision-reader` verdict |
| DELIVER | gates + sign-off record | gates green + verify PASS; sign-off deferred async |

## Commands

```
node scripts/update-skill-index.mjs
node scripts/check-design-brief.mjs <slug>
node scripts/pipeline-state.mjs get|set|transition|gates|seed ...
npm run typecheck && npm run lint && npm run test:unit && npm run build
```

## Project Structure

```
.agents/skills/pipeline-{analyze,specify,design,deliver}/        # stage skills + references/
.agents/skills/{elicitation,interview-me,idea-refine,
               spec-driven-development,spec-review-stakeholder,
               idea-to-interface}/                              # stubs
.agents/agents/spec-reviewer*/AGENT.md                          # repoint + name fix
.devin/hooks.v1.json                                            # += hook entries
scripts/hook-{session-prime,stage-guard,gates-tracker,
            context-restore,stop-gate,session-report}.mjs
scripts/{pipeline-state,check-design-brief}.mjs
tasks/pipeline-state.json                                       # tracked
docs/reviews/<slug>-{analyze,spec,design}.md
docs/intent/<slug>-{design-brief,component-mapping}.md
tests/unit/scripts/{pipeline-state,check-design-brief,hook-smoke}.test.*
```

## Code Style

- Node ESM `.mjs`, không dependency mới.
- Hook scripts: fail-open (`process.exit(0)` mọi lỗi); timeout ≤5s; stdout `hookSpecificOutput` contract hoặc rỗng.
- Skill files: frontmatter quote description khi chứa `: `; SKILL.md ≤500/target 300; `references/` cho phần dài.

## Testing Strategy

- `tests/unit/scripts/`: Jest `pipeline-state` (mọi transition allow/refuse — kể cả lint-invoke mock, corrupt JSON, worktree guard, `set` restrictions, atomic write) + `check-design-brief` (missing token/component/icon, happy path, cả 2 file parse) + `hook-smoke` (payload→stdout contract mỗi hook).
- Redesign verify: `update-skill-index.mjs` clean; grep sweep dangling refs; dogfood 1 backlog item post-merge.

## Boundaries

- **Always:** stage transition → `pipeline-state.mjs transition` (validate-at-call-time); gate → emit `docs/reviews/` artifact; UI-touching feature → DESIGN trước build; `all`-mode inferred answer cite hoặc `[assumption]`; `src/` code chỉ sau `stage == deliver` (trừ `mockup-*`); state write atomic qua helper.
- **Ask first:** xóa skill ngoài disposition table; đổi spec-schema invariants; thêm hook event.
- **Never:** skills ngoài `.agents/skills/`; nested skills dir; hook block khi `awaiting` set; gate artifact là self-audit của generation (phải là fresh-context report hoặc human-approval record); xóa stub; `set` vào `stage`/`gates.*`; state write từ lane worktree.

## Success Criteria

1. Intent doc item qua pipeline mới: needs có evidence cite + stakeholder map + scope boundary — `subagent_explore` audit verify được.
2. `ui_surface: yes`: `transition --to deliver` refuse khi lint fail/missing mapping (test: fixture lint-fail → exit 1); lint pass từ adoption → mọi ui item có mapping — FAB-class rework mục tiêu 0.
3. `all` mode hết backlog không hỏi user; inferred need cite/`[assumption]`; `<50%` → `awaiting: flagged` + tiếp item khác.
4. `hook-session-prime` inject đúng stage (manual test: set state → payload → stdout đúng).
5. `hook-stop-gate` pass khi `awaiting`; block/warn khi deliver ∧ dirty ∧ gate stale.
6. Zero dangling ref (grep sweep); `update-skill-index.mjs` exit 0.
7. Mỗi gate emit artifact `docs/reviews/<slug>-{analyze,spec,design}.md`.
8. `agentic-sdlc.md` §11 runbook phản ánh 4-stage + state + 6 hooks; §10.1 items 7–10+12 done.

## Traceability

| Need | Requirement | SC |
|---|---|---|
| Intent đúng+đủ, scope khoanh vùng | ANALYZE IIBA + evidence-citation | SC1, SC3 |
| UI đúng trước build | DESIGN + mapping + lint + mockup verify | SC2 |
| Ít gate chậm downstream | Gate gộp ở stage boundary + emit artifact | SC7 |
| Enforcement không nhờ agent nhớ | state + transition-validate + 6 hooks | SC4, SC5 |
| Giữ `all` autonomous | self-interrogation + confidence + flag | SC3 |
| Không đứt ecosystem | stubs + disposition 48/48 | SC6 |

## Definition of Done

- [ ] Disposition 48/48 applied
- [ ] 6 hooks wired + smoke-tested; spike verdict (PreToolUse+Stop blocking + exec-payload shape) trong revision log
- [ ] `pipeline-state.mjs` + `check-design-brief.mjs` tests pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] AGENTS.md + backlog + `.gitignore` + agentic-sdlc + 0-wiki + `.agents/agents/*` updated
- [ ] `update-skill-index.mjs` exit 0; zero dangling ref
- [ ] Cutover: `seed` cho items mid-flight khi merge về main (item nào ở legacy status — vd `pre-watch-primer` — seed theo artifact scan; thiếu evidence → `flagged:seeded`)
- [ ] Dogfood ≥1 backlog item post-merge
- [ ] Commit atomic, sạch không attribution

## Phasing / rollout

Ship order (plan `tasks/plan-pipeline-redesign.md`): spike → foundation (state+lint+gitignore) → hooks → stage skills (analyze→specify→design→deliver) → stubs → rewire → canon docs → verify → atomic commits. Mid-flight items: `seed` command khi merge về main.

## Open Questions (accepted risks)

- PreToolUse/Stop blocking + exec-payload — RESOLVED (spike v1.4.1): blocking supported, payload đầy đủ; hooks giữ warn/fail-open theo design, enforcement ở transition-validate.
- `pipeline-state.json` tracked có thể conflict khi 2 session đổi stage — chấp nhận; fallback gitignored + rebuild-from-artifacts.
- `all`-mode ANALYZE infer scope — garbage-in possible; mitigate confidence+flag.
- Interactive blocking gates = 3 — user chọn, chấp nhận.
- FAB defect = hardcoded hay wrong-choice chưa xác minh — cover cả hai.
- `vision-reader` DS-faithfulness là soft signal — proxy tốt nhất không-người; human veto sau qua review report.
- Gates-tracker exec-payload — RESOLVED (spike): `tool_response.success` xác nhận; vẫn observability-only, không phải enforcement path.

## Elicitation revision log

- v1 (2026-09-18): draft từ confirmed frame + doubt-review reconcile (30+ findings).
- v1.1 (2026-09-18): fix round-1 (5 blockers + majors: disposition 48, gate executor, hook conditions, gitignore, lint-wire, state schema, artifact×mode, UI-bugfix, fix-loop, driver, backward edge, main-worktree-write + minors).
- v1.2 (2026-09-18): fix round-2 — **B1 gate-flag lifecycle**: transition validate-at-call-time (invoke lint trực tiếp, parse verdict, staleness mtime) thay vì tin flag; `gates` = observability cache; `set` cấm stage/gates. Majors: DELIVER code-review executor = `subagent_explore` lane; `spec-reviewer-swe` name fix; `uiSurface` vào schema + 3-chỗ sync; all-mode ship = gates green + sign-off async; tracker scope deliver-stage + payload spike + atomic write + `seed` cutover; stale-invalidation; backlog `dropped` giữ; todo-<slug> defined; brief-lint canonical paths; hook matcher `^(write|edit|notebook_edit)$`; gitignore negation placement.
- v1.3 (2026-09-18): fold BA methodology (source: Chị Hai Lúa BA series, user-provided) — ANALYZE = business analysis (AS-IS workflow 3 loại tương tác, value) + logic analysis (đa chiều); **COMPLETE JOURNEY (as-is + to-be) là artifact bắt buộc, cấm "gạch đầu dòng"**; BACCM = inference engine (Need=problem+opportunity, phân biệt dịch nghĩa vs định nghĩa); elicitation = hypothesis presentation → câu hỏi chỉ cho gap của phân tích (cấm template question list); SPECIFY = system analysis (actor↔system boundary, input→process→output, FR+NFR, journey→requirements trace); DESIGN += UI đồng bộ system (thao tác → journey step); `analyze→specify` += `## Journey` parse check.
- v1.3.1 (2026-09-18): fix round-3 (final) — **B1 lifecycle**: `init <slug> --mode` entry point + auto-clear `active` on ship + lifecycle doc. **M1:** `deliver→shipped` (all) spawnSync re-run 4 npm gates — không tin `gates.*` cache. **M2:** journey structural check (as-is+to-be markers, ≥3 steps mỗi phần). **M3:** `VERDICT: <token>` line convention mọi gate artifact (last-line parse). **M4:** `seed` áp evidence rules — thiếu → `flagged:seeded`. **M5:** `resolve <slug> --note` clear awaiting có audit (`resolutions[]`), reset loops khi `flagged:loop-cap`; escalate = pick-off pause. **M6:** shipped = terminal. **M7:** unknown refuse-message + intent-doc cross-check. **M8:** `set` cấm `awaiting=null`/`loops`. Minors: (42) count fix, `spec-reviewer-glm` model fix, stage-guard += pipeline-state.json direct-edit warn, tracker += npx patterns, mockup URL pin + retention cleanup, "src mtime mới nhất" = porcelain src mtimes, `.pipeline-state-*.tmp` gitignore, stub precedence, journey as-is+to-be clarification, `resolutions` field.
- v1.4 (2026-09-18): fold BA methodology round 2 (full Chị Hai Lúa series — 12 clips: first-steps, FURPS+, user-stories, business-process, logic-analysis, NFR, system-analysis, usecase/activity/state/sequence, function-vs-feature, synthesis). **Structural adds:** (1) ANALYZE restructure 3 bước — 4 việc đầu BA (business case BACCM → stakeholders incl. team capability + regulator → root-cause+risk → **go/no-go/defer `## Decision`**) → functional req (FURPS+ classify, business-level stories **story≠task**, business process **kể chuyện trước vẽ sau**, 15s rule, chỉ process liên quan product) → logic analysis (A→Z review, multi-lens: pháp luật/tiện lợi/UX/riêng tư/tham vọng). (2) **`analyze → dropped` transition** — no-go kill sớm, terminal + auto-clear active + backlog → `dropped`; `analyze→specify` += `## Decision` == `go` check; stage enum += `dropped`. (3) SPECIFY method chain — stories+process+logic → use-case-like requirements (id/actor/precondition/basic+alt+exception flows/rules/postcondition/NFR-refs, **actor=trigger/input only**) → flows/states → **function vs feature** mapping → data; "đúng+đủ trước, chuẩn sau"; doc mapping URD↔intent/SRS↔spec/testcases↔Success Criteria. (4) Nguyên tắc tools-flexible (markdown flows, không UML tool), "trong tổng quan có chi tiết", story-map priority theo journey.
- v1.4.1 (2026-09-18): hook-semantics spike verdict (docs.devin.ai/cli/extensibility/hooks) — **blocking supported** (exit 2 / `{"decision":"block","reason"}`; Stop cùng format + `stop_hook_active`); PostToolUse `tool_response:{success,output,error}` → gates-tracker detect exit 0 được, fallback pre-commit-gate **không cần**; stdin `{hook_event_name,tool_name,tool_input,tool_response?,session_id,prompt_id}` + env `DEVIN_PROJECT_DIR`. Design giữ warn-only (additionalContext) — enforcement ở transition-refuse; blocking là option harden sau này.
