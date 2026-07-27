# Hướng dẫn dùng `write-skill`

> **Note:** This is a human-readable usage guide, not an agent skill file. It has no YAML frontmatter and is not parsed by the agent loader. The skill only reads `SKILL.md` and files explicitly referenced in `self-evolution/workflow.md`.

`write-skill` là một agent skill dùng để viết, chỉnh sửa, và làm cho các skill khác có khả năng tự sửa chính mình. Tài liệu này dành cho người dùng (human hoặc agent) muốn hiểu cách skill hoạt động và cách dùng nó hiệu quả.

---

## 1. Nguyên lý (Principles)

### 1.1. Skill là workflow ra quyết định, không phải ghi chú

- Một skill không phải là cheat sheet, danh sách mẹo, hay tài liệu tham khảo.
- Nó phải là một chuỗi bước có điều kiện pass/fail (guard), có loop-back, và có thể kiểm chứng.

### 1.2. Frontmatter quyết định trigger, body quyết định hành vi

- `name` và `description` trong phần YAML đầu file quyết định skill có được gọi hay không.
- Phần thân `SKILL.md` quyết định skill làm gì sau khi được gọi.
- Description phải rõ ràng: nêu khả năng, trigger, use case, và ranh giới. Không tóm tắt workflow.

### 1.3. Skill nhỏ, có quan điểm, và có thể bị bác bỏ

- Một skill chỉ làm một việc.
- Nó phải có quan điểm rõ ràng (opinionated) về cách giải quyết vấn đề.
- Nó phải có anti-pattern/rationalization để agent nhận diện khi đang đi sai hướng.

### 1.4. Self-evolution là tùy chọn, nhưng được hỗ trợ

- Không phải skill nào cũng cần tự sửa.
- Nếu skill chạy thường xuyên và có đầu ra đo lường được, nên bật self-evolution.
- `write-skill` sẽ hỏi: *"Skill này có nên tự evolve từ chính usage của nó không?"* Nếu có, nó tạo thư mục `self-evolution/`.

---

## 2. Cơ chế (Mechanism)

### 2.1. Cách kích hoạt

`write-skill` được kích hoạt khi agent nhận ra một trong các tình huống:

- "Viết skill để ..."
- "Tạo một workflow skill ..."
- "Cập nhật skill ..."
- "Tại sao skill X không trigger?"
- "Làm cho skill X tự sửa chính mình"
- "Update write-skill" (target chính là `write-skill`)

### 2.2. Các bước trong workflow

`write-skill` chạy theo 8 bước chính + 1 bước self-evolution:

1. **Decide** — xác định xem có xứng đáng thành skill không.
2. **Name and frame** — đặt tên và viết description kích hoạt.
3. **Draft the workflow** — viết các bước với purpose, actions, guard, loop-back.
4. **Stress-test** — kiểm tra edge cases, ambiguity, conflict.
5. **Cut** — cắt bỏ phần thừa, đảm bảo ≤500 dòng.
6. **Verify** — chạy qua checklist.
7. **Register** — lưu vào thư mục skill, cập nhật index/router.
8. **Iterate** — cải thiện dựa trên hành vi thực tế.
9. **Self-Evolution** — hỏi user, ghi RUNBOOK, sinh biến thể, chấm điểm, cập nhật nếu tốt hơn.

### 2.3. Cấu trúc một bước workflow

Mỗi bước phải có 4 phần:

- **Purpose**: bước này để làm gì.
- **Actions**: danh sách hành động cụ thể.
- **Guard**: điều kiện pass/fail.
- **Loop back**: nếu guard fail, quay lại đâu.

Ví dụ:

```markdown
### Step 3: Draft the workflow

**Purpose:** Turn the decision process into executable steps.

**Actions:**

- List every decision the agent must make.
- Add a guard to each decision.
- Add a loop-back for each failing guard.

**Guard:** Every step has a pass/fail condition and a specific loop-back.

**Loop back:** If any step lacks a guard, return to Step 2 and refine the framing.
```

### 2.4. Cơ chế self-evolution

Khi một skill có self-evolution, mọi file improve nằm trong thư mục `self-evolution/`:

1. **`self-evolution/RUNBOOK.md`** ghi lại mỗi lần skill được dùng và kết quả.
2. Khi đủ điều kiện (lỗi lặp lại, đủ 10 episode, hoặc user yêu cầu), skill đọc **`self-evolution/workflow.md`**.
3. Skill chẩn đoán vấn đề từ `self-evolution/RUNBOOK.md`.
4. Skill chọn các mutation prompt từ `self-evolution/mutation_prompts.md` để sinh 1–3 biến thể.
5. Mỗi biến thể được chấm điểm qua `self-evolution/test_cases.md` và các episode thất bại gần đây.
6. Biến thể tốt nhất được so sánh với phiên bản hiện tại.
7. Nếu tốt hơn đủ margin, bản hiện tại được copy vào `self-evolution/archive/`, rồi bị ghi đè.
8. Chạy regression test; nếu kết quả tệ hơn, restore từ `self-evolution/archive/`.
9. Cooldown: không tự sửa trong ít nhất 5 episode hoặc 24 giờ.

---

## 3. Quy trình sử dụng (Process)

### 3.1. Khi bạn muốn viết một skill mới

**Prompt mẫu:**

```text
Viết một skill để [mô tả workflow].
```

Ví dụ:

```text
Viết một skill để review code trước khi merge.
```

`write-skill` sẽ:

- Kiểm tra xem workflow có xứng đáng thành skill không.
- Đặt tên và viết description.
- Viết các bước, guard, loop-back.
- Thêm ví dụ, anti-pattern, verification checklist.
- Lưu vào `.agents/skills/<name>/SKILL.md`.

### 3.2. Khi bạn muốn cập nhật một skill hiện có

**Prompt mẫu:**

```text
Cập nhật skill <tên> vì nó đang trigger sai / thiếu guard / quá dài.
```

`write-skill` sẽ:

- Đọc skill hiện tại.
- Phân tích vấn đề.
- Chỉ sửa phần liên quan (surgical change).
- Giữ nguyên style và cấu trúc hiện tại.
- Chạy verification checklist.

### 3.3. Khi bạn muốn làm cho skill tự sửa chính mình

**Prompt mẫu:**

```text
Viết skill X và làm cho nó có khả năng self-correct.
```

hoặc:

```text
Biến write-skill thành self-correcting.
```

`write-skill` sẽ:

- Tạo thư mục `self-evolution/`.
- Tạo `self-evolution/README.md` — bài báo khoa học giải thích cơ chế.
- Tạo `self-evolution/workflow.md`.
- Tạo `self-evolution/RUNBOOK.md`.
- Tạo `self-evolution/mutation_prompts.md`.
- Tạo `self-evolution/test_cases.md`.
- Tạo `self-evolution/archive/README.md`.
- Nhúng trigger self-evolution vào workflow.

### 3.4. Khi bạn muốn `write-skill` tự cải thiện chính nó

**Prompt mẫu:**

```text
write-skill, hãy tự cập nhật chính mình dựa trên những gì vừa học được.
```

`write-skill` sẽ:

- Đọc `self-evolution/RUNBOOK.md`, `self-evolution/mutation_prompts.md`, `self-evolution/test_cases.md`, `self-evolution/workflow.md`.
- Sinh biến thể.
- Chấm điểm.
- Archive bản cũ vào `self-evolution/archive/`, ghi đè nếu tốt hơn, rollback nếu regression.

---

## 4. Quality Gates — tiêu chí một skill tốt

| Gate | Ý nghĩa |
|---|---|
| Scoped | Làm một việc, không gom nhiều thứ. |
| Triggerable | Description rõ ràng, có capability, trigger, boundary. |
| Punchy | Mỗi section mở đầu bằng punchline in đậm, bullet 1 dòng. |
| Readable | Active voice, câu ngắn, danh từ cụ thể. |
| Actionable | Mỗi section nói agent phải làm gì, không chỉ nghĩ gì. |
| Guarded | Mỗi bước chính có pass/fail. |
| Looped | Failing guard có loop-back rõ ràng. |
| Falsifiable | Có anti-pattern / rationalization. |
| Portable | Không hardcode project-specific path. |
| Verifiable | Có checklist cuối. |
| Evolving | Nếu claim self-correct, phải có `self-evolution/` với README, workflow, RUNBOOK, mutation, test, archive, rollback. |

---

## 5. Các lỗi thường gặp khi dùng `write-skill`

| Lỗi | Cách tránh |
|---|---|
| Viết skill cho một việc làm một lần | Kiểm tra Step 1: đã làm ít nhất 5 lần và sẽ làm thêm 10 lần nữa? |
| Description tóm tắt workflow | Description chỉ nêu what/when/boundary, không nêu how. |
| Thiếu guard | Mỗi step phải có một câu hỏi yes/no hoặc pass/fail. |
| Skill quá dài | >500 dòng thì tách phần ít dùng sang sub-file. |
| Viết code vào skill | Code technique thuộc về `learning-and-apply`, không phải skill. |
| Self-evolution thiếu an toàn | Luôn đảm bảo `self-evolution/archive/`, `test_cases`, rollback trước khi bật. |

---

## 6. Kiểm tra sau khi dùng

Trước khi coi một skill là xong, hãy đảm bảo:

- [ ] Skill kích hoạt đúng với ít nhất 3 prompt mẫu.
- [ ] Skill không kích hoạt với 3 prompt ngoài phạm vi.
- [ ] Mỗi workflow step có guard và loop-back.
- [ ] Verification checklist pass.
- [ ] Nếu self-evolution được bật, đã có `self-evolution/` với README, workflow, RUNBOOK, mutation, test, archive và đã thử rollback.
