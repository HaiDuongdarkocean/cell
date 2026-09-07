---
name: education-ui-principles
description: Gate every UI task in Cell through education-domain principles (learners aged 5–80, language learning, low-spec devices) before writing interface code, then through the repo's engineering rules before calling it done. Use when designing, generating, or reviewing UI pages, components, panels, or study flows. Not for non-UI logic, mechanical token audits (use design-system-guardian), or vague design briefs (use idea-to-interface).
---

# Education UI Principles — cổng nguyên tắc trước khi tạo giao diện

> **UI ở đây phục vụ người học, không phục vụ chính nó.**
> Một giao diện đẹp nhưng làm người học mất tập trung là giao diện sai.

Skill này là **pre-flight gate**: chạy trước khi viết UI code, và tự check lại trước khi tuyên bố xong. Nó không thay `design-system-guardian` (audit cơ học) hay `frontend-ui-engineering` (cách build) — nó trả lời câu hỏi trước đó: *"Giao diện này có đúng chuẩn một sản phẩm giáo dục không?"*

## When to Use

- Tạo/redesign bất kỳ UI nào: page, panel, component, study flow, reader, subtitle UI.
- Trước khi viết `.tsx`/`.module.css` cho giao diện mới.
- Khi cần quyết định design mà chưa có token/component trả lời sẵn.
- Khi review UI với câu hỏi "có phù hợp người học không?".

## When NOT to Use

- Logic thuần, parser, messaging, background — không có UI.
- Audit cơ học sau khi code xong → `design-system-guardian`.
- Biến ý tưởng mơ hồ thành brief → `idea-to-interface`.
- Audit UI có sẵn để redesign → `audit-ui-ux-then-redesign`.

## Step 0 — Nạp context bắt buộc

**Không thiết kế khi chưa đọc SSOT.**

| Đọc | Lấy gì |
|---|---|
| `AGENTS.md` §personas + §cấu hình | User 5→80t, lõi 10–25, học ngoại ngữ; máy ≥1GB RAM, response <3s |
| `docs/design-system/DESIGN.md` §1 Golden Rules | 5 luật cứng: no M3, no hardcode, reuse shared/ui, showcase-first, audit |
| `src/shared/styles/STANDARD.md` §0 | "Quiet confidence" — bản sắc foundation |
| `src/shared/ui/` + `src/shared/icons/index.ts` | Component/icon hiện có để reuse |

**Guard:** Trả lời được "màn này phục vụ người học ở độ tuổi nào, trên thiết bị nào?". Không trả lời được → hỏi user, không đoán.

## Step 1 — Gate A: nguyên tắc domain giáo dục

**Mỗi nguyên tắc là một câu hỏi pass/fail. Fail một câu → sửa design trước khi code.**

| # | Nguyên tắc | Câu hỏi kiểm tra |
|---|---|---|
| A1 | **Nội dung học là trung tâm** | Nhìn màn hình: thấy bài học trước hay thấy chrome/nút/trang trí trước? |
| A2 | **Cognitive load tối thiểu** | Màn/section này có quá 1 primary action? Có element nào chỉ để trang trí? |
| A3 | **Chunking + progressive disclosure** | Thông tin dài đã chia khối nhỏ chưa? Chi tiết phụ có ẩn sau expand/hover không? |
| A4 | **Đọc được bởi trẻ 5 và người 80** | Body ≥16px, UI text ≥14px, không text đọc <12px? Icon quan trọng có kèm text label? Contrast ≥4.5:1? Target ≥44px? |
| A5 | **Forgiving** | Hành động phá hủy có undo/confirm? Input chấp nhận nhiều dạng? Thông báo lỗi có chỉ cách sửa? |
| A6 | **Feedback tức thì, mang tính dạy** | Mọi action có feedback cảm nhận được ngay? Trạng thái thành công có khuyến khích? Lỗi giải thích thay vì đổ lỗi? |
| A7 | **Khuyến khích, không overstimulate** | Animation có mục đích? Tôn trọng `prefers-reduced-motion`? Không nhấp nháy/âm thanh bất ngờ? |
| A8 | **Consistency = learnability** | Cùng một việc có cùng một pattern? Có invent pattern mới khi `shared/ui` đã có không? |
| A9 | **UI copy đơn giản hơn bài học** | Đây là app học ngoại ngữ — chữ trong UI dễ hơn nội dung đang học? Jargon có được giải thích? |
| A10 | **Progress luôn hiển thị** | Người học biết mình đang ở đâu, đã làm tới đâu, còn gì tiếp theo? |

**Guard:** 10/10 câu trả lời "đạt" hoặc "không áp dụng" có lý do. Bất kỳ câu "chưa rõ" → prototype trong `src/entrypoints/design-system-showcase/` rồi hỏi user.

**Loop back:** Fail A1/A2/A8 → gần như chắc chắn design quá phức tạp; cắt element, không thêm.

## Step 2 — Gate B: nguyên lý kỹ thuật phần mềm

**Không viết lại luật — trỏ tới SSOT và kiểm tra.**

| # | Nguyên lý | Kiểm tra bằng |
|---|---|---|
| B1 | **SSOT** | Giá trị → `tokens.json`; component → `src/shared/ui/`; icon → `ICON_CATALOG`; copy → file i18n. Không nguồn thứ hai. |
| B2 | **Cấm hardcode** | Mọi màu/spacing/radius/font qua `var(--*)`. Số mới → thêm vào `tokens.json`, không viết thẳng. |
| B3 | **Reuse-before-create** | Đã search `shared/ui` + icons chưa? Component mới cần proof-of-gap theo `DESIGN.md` §10.2. |
| B4 | **Logic thuần, tách side-effect** | Function render tách khỏi fetch/state; testable được bằng unit test. |
| B5 | **Performance budget** | Response <3s trên máy 1GB RAM; complexity ưu tiên accuracy > perf > maintenance > scale; không O(n²) trong render path. |
| B6 | **Responsive, không re-layout** | Mobile-first 320 → 768 → 1280; breakpoint theo `STANDARD.md` §9. |
| B7 | **WCAG 2.2 AA là sàn** | Contrast, focus visible, target size, reduced-motion — không phải tùy chọn. |
| B8 | **Verify trước khi xong** | Chạy audit của `design-system-guardian` + `npm run typecheck` + `npm run build` + verify trên Chrome thật (MCP). |
| B9 | **Incremental + reversible** | Showcase-first, thin slice, commit qua gate; UI decision khó đảo → ADR `docs/adr/NNN-*.md`. |
| B10 | **Convention MV3 + repo** | Named export, function component + hooks, cấm `any`, không CDN font, cite Chrome API docs. |

**Guard:** B1–B3, B7, B8 là **blocking** — fail thì không được gọi là xong. B4–B6, B9–B10 fail → ghi chú rõ lý do chấp nhận.

## Step 3 — Tổng hợp verdict

```markdown
## Education UI Gate — [tên màn/component]

### Gate A (domain giáo dục)
- A1 … A10: PASS / FAIL kèm 1 dòng bằng chứng

### Gate B (kỹ thuật)
- B1 … B10: PASS / FAIL / ACCEPTED-RISK kèm lý do

### Verdict
READY TO BUILD / NEEDS REDESIGN / NEEDS USER DECISION
```

**Guard:** Verdict `READY TO BUILD` chỉ khi tất cả blocking item pass.

## Anti-patterns

| Không được | Tại sao | Làm thay |
|---|---|---|
| Thêm animation/gamification "cho vui" | Overstimulation tăng extraneous load, hại học tập | Motion chỉ khi có mục đích feedback/hướng dẫn (A7) |
| Copy UI dùng thuật ngữ kỹ thuật | Người học đang bận học nội dung, không học tool | Plain language, giải thích jargon lần đầu (A9) |
| Icon-only cho hành động chính | Trẻ nhỏ + người lớn tuổi cần label rõ | Icon + text label (A4) |
| Thông báo lỗi chỉ nói "thất bại" | Vi phạm forgiving + feedback dạy học | Nói nguyên nhân + cách sửa + đường thoát (A5/A6) |
| Viết lại rule của DESIGN.md vào đây | Hai nguồn sự thật sẽ diverge | Trỏ đường dẫn, không sao chép (B1) |
| Đoán persona khi không rõ | Design cho người không tồn tại | Hỏi user 1 câu binary (Step 0 guard) |

## Common rationalizations

| User/agent nói | Trả lời |
|---|---|
| "Màn này cho người dùng thường, không cần chuẩn giáo dục" | Persona repo là 5→80t học ngoại ngữ — không có "người dùng thường". |
| "Thêm chút hiệu ứng cho đẹp" | Đẹp = calm + learnable (quiet confidence). Hiệu ứng không mục đích = fail A7. |
| "Người dùng biết icon này rồi" | Người 5 tuổi và 80 tuổi không biết. Icon kèm label (A4). |
| "Component nhỏ, khỏi qua gate" | Gate A tốn 2 phút; component nhỏ cũng render cho người học. |
| "Fix sau khi merge" | Blocking item fail = chưa xong, không có "fix sau". |

## Verification checklist

- [ ] Step 0: đã đọc 4 nguồn SSOT, trả lời được câu hỏi persona.
- [ ] Gate A: 10 câu có verdict + bằng chứng 1 dòng.
- [ ] Gate B: blocking item (B1–B3, B7, B8) đều PASS.
- [ ] Verdict tổng hợp được xuất theo template Step 3.
- [ ] Nếu `READY TO BUILD` → bàn giao cho `frontend-ui-engineering` / `incremental-implementation`.
- [ ] Sau khi code → chạy `design-system-guardian` trước khi merge.

## Router boomerang

- Cần brief thiết kế từ ý tưởng mơ hồ → `idea-to-interface`.
- Đã qua gate, cần build → `frontend-ui-engineering` + `incremental-implementation`.
- Code xong, cần audit cơ học → `design-system-guardian`.
- Audit UI cũ trước redesign → `audit-ui-ux-then-redesign`.
- Không rõ dùng skill nào → `using-agent-skills`.
