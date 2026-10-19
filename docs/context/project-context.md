# Project Context — Tihoka

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Tihoka. Luật thiết kế hiện hành: `.agents/skills/clean-design/knowledge/why/philosophy.md`; checklist: `.agents/skills/clean-design/knowledge/ops/audit.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Context không thay đổi giữa các feature. Skill `elicitation` load file này đầu tiên.
> Update khi user nói khác. Không tự sửa mà chưa confirm.
> Tham chiếu: `AGENTS.md` (conventions), `docs/1-share-language.md` (glossary), `docs/2-architechture-system.md` (architecture).

## design system story
tôi là Dương, dương của hải dương cũng là dương của thái dương, tôi yêu thiên
  nhiên, bản mệnh là mộc, tôi thích những hàng cây với những tán lá đung đưa theo gió, tôi yêu nước vì nó yên bình, nhẹ nhàng, lả
  lướt, mọi thứ đều cần nước để tồn tại, nước phản ánh bản tâm, phản ánh thế giới, Tihoka được sinh ra cũng từ nước lớn lên và phát
  triển, những cú cá tung tắng ở dưới nước làm mặt hồ gợn sóng, những viên sỏi nằm ở dưới đáy hồ cũng làm tôi cảm thấy chúng có một
  vị trí đặc biệt mà chỉ cần nằm im cũng chứng tỏ sự quan trọng quả nó, tôi yêu bầu trời với màu xanh dương nhẹ nhàng. đó chính là
  tôi người muốn có một cuộc sống gần gũi với thiên nhiên tôi muốn liquic glass sẽ là design system style, màu chủ đạo là màu xanh
  dương của bầu trời, tiếp đó là màu xanh lá của cây, trong suốt của nước, màu xám của các viên sỏi, màu nâu của đất, màu vàng của
  ánh mặt trời. tôi muốn chúng là một phần của hệ thống này.

## Persona

- Người dùng từ 5 tuổi → 80 tuổi
- Mọi ngành nghề → yêu thích học ngoại ngữ
- Persona nhiều nhất: 10-25 tuổi

## Platform

- Chrome, Edge, Brave (cross-browser)
- Desktop, tablet, Android
- MV3 extension

## Constraints

- RAM ≥1GB available
- Response <3s
- Responsive UI (desktop + tablet + Android)
- Algorithm complexity: O(1) → O(log n) lý tưởng, O(n) tối đa, cấm O(n log n) → O(n²)