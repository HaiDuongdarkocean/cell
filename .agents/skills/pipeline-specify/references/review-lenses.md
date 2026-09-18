# Spec review lenses — BA / PO / TL

> Load when running the SPECIFY gate (the `spec-reviewer` agent reads this). Three adversarial lenses review `docs/specs/<slug>.md` independently, then merge into one report ending `VERDICT:`.

## Lens 1 — BA (Business Analyst)

Tâm thế: đại diện user & business process. Hỏi:

1. Vấn đề business thực sự là gì? Spec có mở đầu bằng problem hay solution?
2. Nếu không làm gì, hậu quả là gì?
3. User thực sự là ai? Có persona? Ai bị ảnh hưởng tiêu cực?
4. Scope được giới hạn bởi business objective chưa? Non-goals đủ mạnh không?
5. Yêu cầu có rõ ràng, không mơ hồ không? Cụm từ như "nhanh", "đẹp", "tùy nhu cầu", "v.v.", "user-friendly" cần loại bỏ.
6. Có mâu thuẫn giữa các section hoặc giữa text và diagram không?
7. Assumption và dependency có được nêu rõ, có owner và timeline không?
8. Intent traceability: mọi requirement có map về journey step/need trong `docs/intent/<slug>.md` không? Requirement nào không trace được = scope creep hoặc intent thiếu.

Red flags BA: mở bằng feature, thiếu user, non-goals yếu, ngôn ngữ mơ hồ, conflict, dependency không owner, requirement không traceable.

## Lens 2 — PO (Product Owner)

Tâm thế: đại diện user value & backlog. Hỏi:

1. User value có rõ và đo lường được không? Requirement có actor + goal không?
2. Acceptance criteria có testable không? QA có thể viết test từ `## Success Criteria` không?
3. AC có dạng Given/When/Then hoặc checklist rõ ràng không?
4. Mỗi AC có bao gồm happy path và ít nhất một failure path không?
5. NFR targets là số, không phải tính từ (vd "≤1s" không phải "nhanh")?
6. Use-case flows đủ 3 luồng không — basic / alternate / exception? Exception flow có postcondition không?
7. Edge cases (input sai, thiếu data, retry, cancel, lỗi mạng) đã được đề cập?
8. Function vs feature đã tách? Feature nào cũng phải serve một function — feature mồ côi = gold-plating.

Red flags PO: requirement như feature list, AC mơ hồ, không failure path, exception flow thiếu, function/feature lẫn nhau.

## Lens 3 — TL (Tech Lead)

Tâm thế: đại diện engineering feasibility. Hỏi:

1. Actor↔system boundary rõ chưa? System flow có lẫn human behavior không (cấm)?
2. Data: entities, ownership, lifecycle đã mô tả? Input→process→output đầy đủ?
3. Có ít nhất 2 alternatives được xem xét và loại bỏ với lý do?
4. Design decision được justify bằng trade-off? Reuse pattern/component hiện có không?
5. Failure modes: duplicate request, retry, partial failure, network error, boundary input, race condition — flow nào cover?
6. State transitions đủ? State nào không có path vào/ra = dead state.
7. Schema/data migration forward-compatible không?
8. Security, compliance, performance, tech debt được đề cập?

Red flags TL: human behavior trong system flow, không alternatives, thiếu error handling, dead states, schema change không migration, performance tính từ, dependency không owner.

## Merge & Verdict

1. Gộp findings trùng nhau.
2. Phân rank: Blocker (không sửa không implement được), Major (nên sửa, có fallback), Minor (gợi ý).
3. Nếu BA/PO/TL mâu thuẫn, nêu conflict và recommend.
4. Verdict: `APPROVE` / `APPROVE_WITH_CHANGES` / `REJECT`.
5. Liệt kê action items cần fix (không giới hạn số lượng, nhưng rank và gộp để tránh cost risk ẩn).

## Output Format

Report lives at `docs/reviews/<slug>-spec.md`. The `VERDICT:` line must be the **last** matching line in the file — `pipeline-state.mjs` parses the final occurrence, and the file's mtime must be newer than the spec.

```markdown
# Spec Review — <slug>

<findings>

Blockers:
1. [section] [BA/PO/TL]: finding. Fix: <cách sửa>

Major:
1. [section] [BA/PO/TL]: finding. Fix: <cách sửa>

Minor:
1. [section] [BA/PO/TL]: finding. Fix: <cách sửa>

Nhận xét theo role:
- BA: <1 câu>
- PO: <1 câu>
- TL: <1 câu>

Action items:
1. <fix> — owner — section

Risks chấp nhận:
- <risk> — revisit khi <evidence>

VERDICT: APPROVE | APPROVE_WITH_CHANGES | REJECT
```

Rules:

- Ngắn gọn, tập trung findings, không yapping.
- Không sửa spec, không hỏi user trong lúc review.
- Cite section/line nếu được.
