# Intent — Living Documentation System

## Outcome
Hệ thống living docs template reusable cho mọi project, có cấu trúc folder rõ ràng, living docs tự update theo code change, glossary bridge human ↔ system language, ADR tách riêng, template triển khai qua skill + rules hybrid.

## User
Anh (dev) + agent (em) + future team members (human + agent).

## Why now
Em đang gặp 7 pain points:
1. Quên cấu trúc dự án qua thời gian
2. Không biết function nào ở đâu
3. Không biết sửa function A ảnh hưởng function nào
4. Không biết đầu vào/đầu ra function
5. Có folder knowledge nhưng lưu file sai chỗ
6. Viết function đã tồn tại
7. Sửa function xong tài liệu không khớp

Cần system giải quyết ngay.

## Success
- Agent biết function nào ở đâu (Function Index trong 2-architechture-system.md)
- Agent biết sửa A ảnh hưởng B (Dependency Map trong 2-architechture-system.md)
- Agent không viết trùng function (grep docs/knowledge/ trước khi viết)
- Docs không stale (update theo feature-level + exception: function có ≥3 dependents)
- Người mới đọc 0-wiki → hiểu dự án trong 5 phút
- Agent hiểu glossary → không round-trip hỏi lại

## Constraint
Token cost không quá cao (update docs tốn ~10% token, nhưng tiết kiệm ~50% token cho task sau → net positive).

## Out of scope
- Auto-generate docs from code (phức tạp, cần AST parser)
- CI check docs stale (phức tạp, cần infrastructure)
- Real-time sync (update docs ngay lập tức, không cần feature-level là đủ)

## Key Decisions (via interview-me)
- **Scope**: Mọi project, không chỉ project này (template reusable)
- **Update timing**: Feature-level (sau khi feature hoàn thành) + exception (function có ≥3 dependents → update ngay)
- **Read trigger**: Rule trong AGENTS.md (trước khi sửa/viết, sau khi sửa/fix)
- **Folder structure**: intent/ (what user wants), specs/ (what to build), plan/ (how to build), knowledge/ (principles), reference/ (tools), adr/ (decisions)
- **ADR**: Tách riêng docs/adr/ (mỗi quyết định 1 file) — không gộp vào 2-architechture-system.md
- **Template triển khai**: Hybrid (skill mới + rules template) — skill tạo cấu trúc, rules template đi kèm
- **Glossary**: Always-on (1-share-language.md) — tránh hiểu sai intent từ câu đầu tiên
- **0-wiki vs 2-architechture**: 0-wiki = mục lục tổng quan (toàn bộ dự án), 2-architechture = architecture chi tiết (src/ + tests/ + ADR)
- **Knowledge**: Theo nguyên lý khái niệm hóa (abstract principle), không theo loại (bugfix/convention)
