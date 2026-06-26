# 0-Wiki — Project Overview

> **Đọc file này đầu tiên** sau mỗi context reset để biết dự án có gì.

## Cây thư mục tổng quan

```
docs/           # Tài liệu dự án
├── 0-wiki.md              # File này — mục lục tổng quan
├── 1-share-language.md    # Glossary human ↔ system language
├── 2-architechture-system.md  # Architecture chi tiết (src/ + tests/ + dependency + function index + data flows)
├── adr/                    # Architecture Decision Records (mỗi quyết định 1 file)
├── intent/                 # Output interview-me — "what user wants"
├── specs/                  # PRD chi tiết — "what to build"
├── plan/                   # Task breakdown — "how to build"
├── knowledge/              # Nguyên lý khái niệm hóa + chi tiết kỹ thuật bug fix — "lessons learned"
│   ├── principles.md                   # Principle index (abstract, layer 1)
│   ├── auto-download-subtitle-catchup.md # Auto-download subtitle catch-up
│   ├── tab-scoping-popup-leak.md        # Tab-Scoping (popup media leak)
│   ├── edge-app-window-leak.md          # Edge app-window leak
│   ├── subtitle-language-detection.md   # Subtitle language detection (hybrid)
│   ├── subtitle-filename-matches-video.md # Subtitle filename matches video
│   ├── parallel-fmp4-merge.md           # Parallel fMP4 merge (tfdt offset)
│   └── architecture-auto-select.md      # Auto-Select & Auto-Download architecture
└── reference/              # Hướng dẫn dùng tools — "how to use"

src/            # Source code (chi tiết trong 2-architechture-system.md)
tests/          # Test files (chi tiết trong 2-architechture-system.md)
.agents/        # Agent skills
.windsurf/      # Windsurf rules
```

## Cách dùng tổng quan

| Khi nào | Đọc gì | Để biết |
|---|---|---|
| Đầu session | 0-wiki.md | Dự án có gì, docs nào tồn tại |
| Trước khi sửa code | 2-architechture-system.md | Cấu trúc src/, dependency map, function index |
| Khi hiểu sai intent | 1-share-language.md | Glossary human ↔ system language |
| Đầu feature | docs/intent/<feature>.md | Output interview-me — what user wants |
| Trước khi plan | docs/specs/<feature>.md | PRD chi tiết — what to build |
| Mỗi task | docs/plan/<feature>.md | Task list — how to build |
| Trước khi viết function mới | grep docs/knowledge/ | Nguyên lý đã học, tránh tái phạm |
| Khi gặp tool mới | docs/reference/<tool>.md | Hướng dẫn dùng tool |
| Khi thay đổi kiến trúc | docs/adr/<decision>.md | Tại sao chọn kiến trúc này |

## File quan trọng (always-load)

| File | Bản chất | Khi nào load |
|---|---|---|
| AGENTS.md | Cross-tool rules + skill hierarchy | Mỗi session (Windsurf + Devin) |
| .windsurf/rules/baseline.md | Windsurf-specific rules | Mỗi session (Windsurf) |
| .windsurf/rules/ponytail.md | Lazy senior dev ladder | Mỗi session (Windsurf) |
| 0-wiki.md | Mục lục tổng quan | Đầu session |
| 1-share-language.md | Glossary human ↔ system | Đầu session |
| 2-architechture-system.md | Architecture chi tiết | Trước khi sửa code |

## Update protocol

- Thêm/xóa file docs/ → update 0-wiki.md (mục lục)
- Thêm/xóa/sửa file src/ → update 2-architechture-system.md (cây thư mục + dependency + function index)
- Thay đổi kiến trúc → thêm ADR vào docs/adr/
- Đúc rút nguyên lý → thêm vào docs/knowledge/<principle>.md
- Fix bug → ghi bug log + convention vào docs/knowledge/<principle>.md
