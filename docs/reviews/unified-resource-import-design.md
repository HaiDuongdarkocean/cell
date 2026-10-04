# Design Review — unified-resource-import

## Approval record

- Gate: `user-approval:design` (interactive)
- Presented: rendered mockup `src/entrypoints/mockup-unified-resource-import/` (variants Real/A/B/C × Mobile/Desktop × Light/Dark) + design brief
- **User picked: Concept A — Một dãy sách**
- User rationale (verbatim): *"chọn a bởi vì không có phân chia đâu là dictionary đâu là frequency cả bản chất gọi chung nó là tài nguyên trong tài nguyên có những thông tin để tra cứu, tần suất là một trong số đó, dictionary cũng vậy. hơn nữa phải thiết kế kỹ phần tải lên và nạp cái nào đã xong rồi thì trực tiếp đưa vào danh sách cái nào xong thì thay update trạng thái chứ không chờ phiên gì cả."*

## Decisions recorded

1. **Concept A** — flat unified list, ngôn ngữ UI hiện tại; không filter chips, không group labels, không rank badges. B/C rejected vì chúng tái-khái-niệm-hóa "hai loại" mà feature này cố xóa.
2. **User requirement bổ sung** (vào spec context cho DELIVER): intake/upload live từng job — file xong thì resource card vào list ngay, trạng thái update trực tiếp, không chờ phiên/reload. Hành vi hiện có (JobRegistry events + importing-card-fill-in-slot + refresh-on-terminal) đã đáp ứng phần lớn; DELIVER phải giữ và kiểm chứng, không regressed.
3. `check-design-brief.mjs unified-resource-import` → PASS (7 tokens, 18 components).
4. Component mapping `docs/intent/unified-resource-import-component-mapping.md` — 0 elements cần `create`, 0 `redesign`; extend trên `ImportProgress`/`ResourceCard`; panel collapse hai section → một.
5. Badge kind icon ids: `bookOpen` (definitions-side), `gauge` (frequency). Mọi icon trong mapping tồn tại trong ICON_CATALOG.

## Carry-overs vào DELIVER

- Job row phải hiển thị detected components (badge) trước upload; multi-component file hiện `Chip` picker (selected = sẽ nạp).
- Resource card: bỏ `isDict` gate trên component chips; thêm `'frequency'` vào `COMPONENT_LABEL`.
- Một `SECTION_COPY` `resources.unified.*` + `sectionId='resources'`; delete-all copy noun "tài nguyên".
- `FrequencyBandsEditor` ở footer của section gộp.
- Follow-up đã ghi (không scope): ResourceCard componentChip → shared `Chip` migration.

VERDICT: APPROVE
