# Intent — `pipeline-redesign`

> Source: user directive · Cost: XL · Status: confirmed frame (interactive elicitation, 2 rounds) · Branch: `refactor/pipeline-redesign`

## Pain (raw)

"chuyển sang worktree khác để redesign lại pipeline"

Round 2 (verbatim): "thiếu enforcement, các câu hỏi đặt ra chưa có đủ cơ sở, chưa sắc bén cần phải áp dụng thêm IIBA workframe, chậm nhiều gate review cái cần tập trung là lấy intent đúng, đủ, khoanh vùng scope, output chưa đúng đặc biệt là chưa quyết định đúng về UI. sẽ có phân tích nghiệp vụ, chuyển đổi nghiệp vụ -> system -> UI/UX thì ở phần BA và UI/UX đang không đủ BA quá yếu về kiến thức đặt câu hỏi tìm ra needs của hệ thống, còn UI/UX thường phải sửa tay và yêu cầu sửa lại nhiều ví dụ FAB tôi muốn khi nhấn vào là một danh sách có góc bo nhỏ, thì danh sách này có góc bo quá là tròn và màu sắc không đồng bộ với ngôn ngữ thiết kế của hệ thống."

## Elicitation rounds

| Round | Question | Answer |
|---|---|---|
| 1 | Pipeline nào? | Agentic SDLC pipeline (`.agents/skills/` chain) |
| 1 | Pain chính? | (custom — xem Pain raw trên) |
| 1 | Hướng redesign? | Rethink từ đầu |
| 2 | Blast radius? | Full rethink — gộp/đổi tên/xóa/viết mới skills tự do, router + runbook vẽ lại |
| 2 | `all` mode? | Giữ — BA tự phân tích, tự đặt câu hỏi (self-interrogation), tự suy luận hệ thống → needs/problem → giải pháp; mọi thứ automatic |
| 2 | Hooks? | Làm luôn trong đợt này (§10.3 items 7–10) |
| 2 | UI gate? | Normal mode → mockup bắt buộc user duyệt; `all` mode → interface analysis → design brief + ASCII mockup, agent tự chọn phương án hợp design system |
| 3 | BA methodology (Anh yêu đưa source: Chị Hai Lúa BA series) | 4 giai đoạn: **business analysis → logic analysis → system analysis → UI/UX**; BA hiểu thế giới thực (người↔người, người↔thiết bị, hệ thống↔hệ thống), đảm bảo value + journey hoàn chỉnh; input→process→output; FR+NFR; **nguy hiểm nhất = làm gạch đầu dòng mà journey không trọn vẹn → plan chắp vá, sai yêu cầu** |
| 4 | BA methodology round 2 (Anh yêu đưa trọn series — 12 clips: first-steps → FURPS+ → stories → process → logic → NFR → system analysis → usecase/activity/state/sequence → function-vs-feature → synthesis) | BA = 3 bước: **(1) 4 việc đầu** — business case (BACCM) → stakeholders (team capability + customer + supplier + regulator) → root-cause + risk (pháp lý/tiềm ẩn/khả năng phản ứng) → **go/no-go decision**; (2) functional req business-level (FURPS+, stories story≠task, business process kể-chuyện-trước-vẽ-sau); (3) logic analysis review A→Z. System analysis = stories+process+logic → usecase → flows/states → function/feature → data. Nguyên tắc: **"dục tốc bất đạt" — kill sớm không mất nguồn lực; "đúng + đủ trước, chuẩn sau"; "công cụ chết người sống"; "không có gì tốt nhất, chỉ hợp lý nhất"** |

## BA methodology (source material — distilled)

Source: Chị Hai Lúa "Trở thành BA" series — Anh yêu đưa 2 đợt: round-3 (3 clips: lifecycle+4 giai đoạn; BACCM; elicitation) → spec v1.3; round-4 (12 clips: first-steps, FURPS+, user-stories, business-process, logic-analysis, NFR, system-analysis, usecase/activity/state/sequence, function-vs-feature, synthesis) → spec v1.4.

- **4 giai đoạn BA** map 1:1 lên stages: business analysis + logic analysis → ANALYZE; system analysis → SPECIFY; UI/UX → DESIGN; develop→test→deploy→feedback → DELIVER.
- **Business analysis (thế giới thật):** mô tả AS-IS quy trình — người↔người, người↔thiết bị, hệ thống↔hệ thống — trước khi đụng thế giới số. Đảm bảo value trọn vẹn + journey hoàn chỉnh.
- **Logic analysis:** các tương tác kết nối có hợp lý không; nhìn đa chiều (pháp luật, trang thiết bị, môi trường, chính sách); kinh nghiệm thực tế phù hợp user.
- **System analysis:** chuyển thế giới thật → số. Phân biệt **actor vs system** (actor chỉ ra lệnh — bấm nút; chạy gì bên trong là system). Quy luật **input → process → output**. FR + NFR.
- **UI/UX:** user thao tác màn hình thế nào; UI phải đồng bộ với system — đẹp mà không đồng bộ = UX sai.
- **Anti-pattern "gạch đầu dòng" (nguy hiểm nhất):** liệt kê bullet mà không hoàn chỉnh 1 journey → plan chắp vá, sai hướng, sai yêu cầu. ⇒ COMPLETE JOURNEY (as-is + to-be) là artifact bắt buộc, checklist chỉ là metadata.
- **BACCM = inference engine:** 6 nhánh (Need=problem+opportunity, Change, Solution, Value, Stakeholder, Context) — classify info có sẵn rồi suy luận nhánh thiếu. Phân biệt dịch nghĩa vs định nghĩa: "muốn quản lý dự án chặt chẽ đúng tiến độ" là VALUE không phải NEED.
- **Elicitation đúng = hypothesis presentation:** phân tích BACCM trước → stakeholder + need từng người (onion) → draft solution → trình bày cho user confirm/sửa → câu hỏi CHỈ hỏi phần cần làm rõ (sinh từ gap phân tích). Cấm "lên list câu hỏi" template — đó là câu hỏi không cơ sở.
- **Kỹ thuật thu thập:** interview, document analysis (kể cả nguồn public khi thiếu tài liệu nội bộ), survey, observation/shadowing, UI/UX analysis.
- **Success factors:** xác định cốt lõi sản phẩm trước; thứ tự ưu tiên dựa trên journey hoàn chỉnh; phân biệt business vs system.
- Triết lý vận hành (video 1): "có việc thì làm → làm xong" — methodology phục vụ outcome, không phải mục tiêu.

**Round-4 additions (spec v1.4):**

- **4 việc đầu BA — "dục tốc bất đạt":** (1) business case = BACCM inference; (2) stakeholders = team/năng lực làm được không + customer + supplier/dependency + tổ chức/regulator (giấy phép, quy định — không xác định = "không có gì để like"); (3) root-cause + risk — pháp lý, rủi ro (con người/hoạt động/nội-ngoại vi), yếu tố tiềm ẩn (hiếm nhưng hậu quả lớn), khả năng phản ứng của team; (4) **go/no-go decision** — kill sớm, dành nguồn lực cho việc khác. ⇒ `analyze → dropped` transition.
- **FURPS+ phân loại info:** Functional / Usability / Reliability / Performance / Supportability — FR vs NFR tách ngay từ thu thập; NFR dễ quên nhưng quyết định hệ thống đứng được không (hạ tầng, năng lực đáp ứng, tài chính).
- **User stories (business-level):** "tôi muốn X để Y — xong khi Z"; **story ≠ task** ("chuyển tiền"=story, "chọn ngân hàng/nhập số tiền/OTP"=task con); nguồn = persona chân dung × journey của từng nhóm; kỹ thuật = brain-dump → cluster/group → stories; story map ưu tiên theo journey hoàn chỉnh (không phải feature list — đó là anti-pattern "làm chức năng dễ trước, journey vụn").
- **Business process — kể chuyện trước, vẽ sau:** narrative đầu-đuôi (nhân vật + trình tự + milestones) trước, diagram sau — notation tùy ý (BPMN chỉ là "chiếc xe", business process là "con đường"), quy tắc 15s đọc hiểu; chỉ mô tả process liên quan product (mô tả tùm lum = việc của QA).
- **Logic analysis = khâu cuối BA:** review A→Z toàn bộ stories + process trên mọi hành trình; tìm bất hợp lý; lens = pháp luật, tiện lợi, thích thú/thoải mái, riêng tư, "quá khắt khe/tham vọng"; "không có gì tốt nhất — chỉ hợp lý nhất cho context".
- **System analysis method chain:** stories+process+logic → use-case-like reqs (actor chỉ trigger/input — hệ thống chỉ IPO) → flows (activity/sequence text) → states → **function vs feature** (function = system làm gì; feature = công cụ hỗ trợ; 1↔nhiều) → data structure. "Trong tổng quan có chi tiết, trong chi tiết có tổng quan" — overview → detail → review cả 2 chiều.
- **Nguyên tắc xuyên suốt:** "đúng + đủ trước, chuẩn sau" (không học BPMN trước khi vẽ được business process); "công cụ chết, người sống" (markdown flow/state tables, không cần UML tool); UI/UX không có rule cố định — user quyết định, đánh giá bằng nhóm đa dạng không phải quan điểm 1 người; doc system URD/SRS/testcases ↔ intent doc/spec/Success Criteria.

## Journey

**As-is** (pipeline cũ, evidence: 6 pick-off runs + FAB rework + audit §10):

1. Anh yêu ghi backlog row (idea → `icebox`).
2. `idea-pick-off` pop item → `elicitation` hỏi câu hỏi generic (template, không phân tích trước) → intent doc 8-field phẳng, thiếu journey.
3. `spec-driven-development` viết spec → `spec-review-stakeholder` (khi được gọi — adoption 8%) → plan.
4. `autonomous-pipeline` lanes build — UI agent tự quyết lúc code (FAB: bo góc sai, màu lệch DS).
5. Verify + `design-system-guardian` audit SAU build → phát hiện lỗi UI → sửa tay nhiều vòng.
6. Ship — rework cost đã trả; need/scope sai chỉ lộ khi output dùng thử.

**To-be** (pipeline mới):

1. Anh yêu ghi backlog row → `idea-pick-off` `init <slug>` → ANALYZE.
2. Agent phân tích BACCM + codebase trước → hypothesis presentation → Anh yêu confirm/sửa (không trả lời template questions) → intent doc có journey hoàn chỉnh.
3. SPECIFY: system analysis (actor/system, IPO, FR+NFR) → spec có traceability → `spec-reviewer` fresh-context.
4. DESIGN (ui_surface=yes): brief + component-mapping + mockup → Anh yêu duyệt trên mockup thật (interactive) hoặc lint+vision (all) → UI đúng trước khi code.
5. DELIVER: plan → lanes → deterministic gates → ship; wrong-need → backward edge về ANALYZE (loops cap 3).
6. Ship: mockup cleanup, sign-off (interactive) hoặc deferred async (all) → backlog `shipped`.

Edge cases: confidence thấp → `flagged:` không stall; user reject design → resolve + về analyze; spec-review REJECT → fix-loop ≤3 rồi escalate.

## 8-field frame

1. **Who**: Anh yêu — PO duy nhất vận hành pipeline qua agent; end-user Cell (5–80 tuổi) là stakeholder của output cuối.
2. **Problem**: Pipeline đầu tư sai chỗ — downstream chồng gate review chậm, trong khi hai đầu quyết định chất lượng thì mỏng: (a) BA/needs analysis yếu — câu hỏi generic, không khung IIBA → intent sai/thiếu, scope không khoanh vùng; (b) không có UI/UX design stage — agent tự quyết UI lúc build → output sai phải sửa tay; (c) enforcement mềm — agent tự nhớ route.
3. **Current workflow**: `idea-pick-off` → `elicitation` (8-field generic / `all` mode infer) → spec → `spec-review-stakeholder` (BA/PO/TL checklist) → `planning-and-task-breakdown` → `autonomous-pipeline` lanes → verify → ship. UI quyết ở build; `design-system-guardian` audit sau; `idea-to-interface` orphaned (chỉ là fallback trong interview-me elicitation mode).
4. **Trigger**: sau 6 lượt pick-off, pattern rework lặp lại — spec-review chỉ bắt defect ở verify stage (immersion-clock schema float), UI phải sửa tay (FAB), audit §10 kết luận "gap là enforcement không phải skill".
5. **Desired outcome**: pipeline rethink — trọng tâm chuyển lên upstream: BA theo IIBA (needs đúng + đủ, scope khoanh vùng, traceability need→requirement) → nghiệp vụ chuyển đổi thành system requirements → UI/UX design + validate trước build theo design system → deliver lean; enforcement bằng hooks.
6. **Success metric**: ít rework UI tay sau build (FAB-class defect → 0 do design gate); spec ít bị sửa sau khi build bắt đầu; câu hỏi BA truy tới need/scope chứ không generic; gate ít hơn nhưng đặt đúng chỗ; stage transition có hook ép, không nhờ agent nhớ.
7. **Constraints**: skills chỉ sống ở `.agents/skills/`; hooks fail-open; không dependency mới; canon docs phải cập nhật (`0-wiki`, `agentic-sdlc` runbook §11); commit sạch không attribution; entry-point quen thuộc (`/idea-pick-off`, `/elicitation`…) vẫn phải resolve được — rewire, không bỏ dây đứt.
8. **Out of scope**: `src/` code; backlog items đang chạy (worktree main giữ `pre-watch-primer` in-progress); `.github/workflows` CI file; thay đổi Devin platform primitives.

## Assumptions (accepted risks)

- 48-skill ecosystem được phép consolidate — merge elicitation+interview-me+idea-refine thành BA stage; `idea-to-interface` nâng thành UI stage. Full rethink đã được chốt.
- `all` mode giữ zero-questions contract: BA tự hỏi-tự trả lời từ codebase/backlog evidence, ghi confidence; item confidence thấp → flag, không stall loop.
- Enforcement hooks (SessionStart/PreToolUse/PostCompaction/Stop) fail-open — đủ cho guardrail transition, không đảm bảo correctness.
- Pipeline redesign chạy trên worktree riêng để không đổi luật giữa chừng cho `pre-watch-primer` đang in-progress ở main worktree.
