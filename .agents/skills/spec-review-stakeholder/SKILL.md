---
name: spec-review-stakeholder
description: Review spec qua 3 góc nhìn BA/PO/TL, trả về báo cáo trực tiếp dạng plain text. Dùng khi cần sanity-check spec trước khi implement.
---

Review spec theo 3 góc nhìn stakeholder, trả kết quả trực tiếp trong cuộc hội thoại.

Quy trình:
1. Đọc spec.
2. Chạy 3 lens BA/PO/TL.
3. Gộp, loại trùng, phân rank: Blocker / Major / Minor.
4. Đưa verdict: APPROVE / APPROVE WITH CHANGES / REJECT.
5. Viết báo cáo ngắn, không tạo file riêng, không handoff doc.

## Lens 1 — BA (Business Analyst)

Tâm thế: đại diện user & business process. Hỏi:

1. Vấn đề business thực sự là gì? Spec có mở đầu bằng problem hay solution?
2. Nếu không làm gì, hậu quả là gì?
3. User thực sự là ai? Có persona? Ai bị ảnh hưởng tiêu cực?
4. Scope được giới hạn bởi business objective chưa? Non-goals đủ mạnh không?
5. Yêu cầu có rõ ràng, không mơ hồ không? Cụ từ như "nhanh", "đẹp", "tùy nhu cầu", "v.v.", "user-friendly" cần loại bỏ.
6. Có mâu thuẫn giữa các section hoặc giữa text và diagram không?
7. Assumption và dependency có được nêu rõ, có owner và timeline không?

Red flags BA: mở bằng feature, thiếu user, non-goals yếu, ngôn ngữ mơ hồ, conflict, dependency không owner.

## Lens 2 — PO (Product Owner)

Tâm thế: đại diện user value & backlog. Hỏi:

1. User value có rõ và đo lường được không? Có user story dạng "As ..., I want ..., so that ..."?
2. Acceptance criteria có testable không? QA có thể viết test từ AC không?
3. AC có dạng Given/When/Then hoặc checklist rõ ràng không?
4. Mỗi AC có bao gồm happy path và ít nhất một failure path không?
5. Performance target là số, không phải tính từ (vd "≤1s" không phải "nhanh")?
6. Có MVP/first slice rõ ràng không? Must-have vs nice-to-have đã tách?
7. Edge cases (input sai, thiếu data, retry, cancel, lỗi mạng) đã được đề cập?
8. Definition of Done có bao gồm test, docs, monitoring, rollout không?

Red flags PO: user story thiếu hoặc như feature list, AC mơ hồ, không có failure path, không MVP, không DoD.

## Lens 3 — TL (Tech Lead)

Tâm thế: đại diện engineering feasibility. Hỏi:

1. Architecture, data model, API contract, component boundaries đã được mô tả?
2. Có ít nhất 2 alternatives được xem xét và loại bỏ với lý do?
3. Design decision được justify bằng trade-off?
4. Giải pháp có reuse pattern/component hiện có không? Dependency mới đã được justify?
5. Failure modes: duplicate request, retry, partial failure, network error, boundary input, race condition?
6. Rollout plan, rollback plan, monitoring, alerting, observability có không?
7. Schema/data migration forward-compatible không?
8. Security, compliance, performance, tech debt được đề cập?

Red flags TL: không architecture, không alternatives, thiếu error handling, không rollback, schema change không migration, performance tính từ, dependency cross-team không owner.

## Merge & Verdict

1. Gộp findings trùng nhau.
2. Phân rank: Blocker (không sửa không implement được), Major (nên sửa, có fallback), Minor (gợi ý).
3. Nếu BA/PO/TL mâu thuẫn, nêu conflict và recommend.
4. Verdict: APPROVE / APPROVE WITH CHANGES / REJECT.
5. Liệt kê action items cần fix (không giới hạn số lượng, nhưng rank và gộp để tránh cost risk ẩn).

## Output Format

```
Verdict: <APPROVE / APPROVE WITH CHANGES / REJECT>

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
2. ...

Risks chấp nhận:
- <risk> — revisit khi <evidence>
```

Rules:
- Báo cáo trực tiếp trong cuộc hội thoại. Không tạo file, không handoff doc.
- Ngắn gọn, tập trung findings, không yapping.
- Không sửa spec, không hỏi user trong lúc review.
- Cite section/line nếu được.
