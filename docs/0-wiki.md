# 0-Wiki — Project Overview

> **Đọc file này đầu tiên** sau mỗi context reset để biết dự án có gì.

## Cây thư mục tổng quan

```
docs/           # Tài liệu dự án
├── 0-wiki.md                          # File này — mục lục tổng quan
├── 1-share-language.md                # Glossary human ↔ system language
├── 2-architechture-system.md          # Architecture chi tiết (src/ + tests/ + dependency + function index + data flows)
├── adr/                               # Architecture Decision Records (mỗi quyết định 1 file)
│   ├── 001-zustand-not-redux.md
│   ├── 002-muxjs-not-ffmpeg-wasm.md
│   ├── 003-content-script-background-network-interception.md
│   ├── 004-layered-clean-architecture.md
│   ├── 005-subtitle-floating-panel.md # Subtitle panel: inline DOM, bilingual delimiter, CS shortcuts
│   ├── 006-architecture-proposal.md   # Architecture proposal
│   ├── 007-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load architecture
│   ├── 008-side-panel-subtitle.md     # Side Panel API thay thế inject-DOM panel
│   ├── 009-side-panel-video-controls.md # Side Panel video controls (hotkeys + media clear)
│   ├── 010-in-page-episode-switch-detection.md # In-page episode switch (video element replacement)
│   ├── 012-spa-two-phase-render-wipe.md # SPA two-phase render wipe (isVideoReady gate)
│   └── 013-subtitle-appearance-manager.md # 2 overlay layer độc lập + per-layer style + drag handle
│   └── 014-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches (V2 ADR-007 D3) + bug A fix (loadBilingualCues merge)
├── intent/                            # Output interview-me — "what user wants"
│   ├── intent-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load (target + native)
│   ├── intent-side-panel-subtitle.md  # Side Panel subtitle (thay thế inject-DOM panel)
│   ├── intent-side-panel-video-controls.md # Side Panel video controls (spacebar + hotkeys)
│   └── intent-subtitle-appearance-manager.md # Subtitle appearance manager (2 overlay độc lập + drag + realtime persist)
│   └── intent-subtitle-selector-multi-match.md # Subtitle selector khi ≥2 matches (V2 ADR-007 D3, giải quyết bug A)
│   └── idea-subtitle-manager-panel.md     # Subtitle Manager Panel (V2 ADR-014 — unified panel + import flow + active name + toast)
│   └── intent-subtitle-drag-integrated.md # Subtitle drag integrated (xóa icon riêng, drag trực tiếp overlay background)
├── specs/                             # PRD chi tiết — "what to build"
│   ├── spec-subtitle-overlay.md       # Subtitle overlay PRD
│   ├── spec-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load PRD
│   ├── spec-side-panel-subtitle.md    # Side Panel subtitle PRD (thay thế inject-DOM panel)
│   ├── spec-side-panel-video-controls.md # Side Panel video controls PRD (spacebar + hotkeys + media clear)
│   ├── spec-subtitle-appearance-manager.md # Subtitle appearance manager PRD (2 overlay độc lập + drag + realtime persist)
│   └── spec-subtitle-selector-multi-match.md # Subtitle selector khi ≥2 matches PRD (V2 ADR-007 D3 + bug A fix)
│   └── spec-subtitle-manager-panel.md    # Subtitle Manager Panel PRD (V2 ADR-014 — unified panel + import flow + active name + toast)
│   └── spec-subtitle-drag-integrated.md  # Subtitle drag integrated PRD (xóa icon riêng, drag trực tiếp overlay background)
│   ├── feature-inventory.md           # Feature inventory
│   └── blueprint-cell-learning-platform.md # Blueprint for learning platform
├── plan/                              # Feasibility & scope (G1) — "should we build it"
│   ├── chrome-extension-video-downloader.md
│   ├── parallel-hls-conversion-scaling.md
│   ├── subtitle-sidebar-shortcuts.md  # Subtitle floating panel + shortcuts
│   ├── plan-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load — feasibility (G1)
│   ├── plan-side-panel-subtitle.md    # Side Panel subtitle — feasibility + task breakdown
│   ├── plan-side-panel-video-controls.md # Side Panel video controls — feasibility (G1)
│   └── plan-subtitle-appearance-manager.md # Subtitle appearance manager — implementation plan (G2)
│   └── plan-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches — implementation plan (G2, V2 ADR-007 D3)
├── task/                              # Task list (G4 đầu) — "how to build, step by step"
│   ├── task-bilingual-subtitle-auto-load.md # Bilingual subtitle auto-load — task list (G4)
│   ├── task-side-panel-video-controls.md # Side Panel video controls — task list (G4)
│   ├── task-subtitle-appearance-manager.md # Subtitle appearance manager — task list (G4)
│   └── task-subtitle-selector-multi-match.md # Subtitle selector ≥2 matches — task list (G4, V2 ADR-007 D3)
│   ├── task9-browser-verify-report.md # Task 9 browser MCP verify report (Tasks 2,6,7,8)
│   └── 2026-06-29-subtitle-appearance-manager-mcp.md # ADR-013 browser MCP verify report (A1-A16)
├── knowledge/                         # Nguyên lý khái niệm hóa + chi tiết kỹ thuật bug fix — "lessons learned"
│   ├── principles.md                              # Principle index (abstract, layer 1)
│   ├── architecture-auto-select.md              # Auto-Select & Auto-Download architecture
│   ├── aspect-ratio-cross-size-preservation.md    # Preserve cross-axis size when aspect-ratio conflicts
│   ├── auto-download-subtitle-catchup.md          # Auto-download subtitle catch-up
│   ├── edge-app-window-leak.md                    # Edge app-window leak
│   ├── flex-min-width-auto-overflow.md            # Flex min-width: auto overflow
│   ├── fullscreen-target-shared-container.md      # Fullscreen target shared container
│   ├── inline-style-leak-toggle-cycle.md          # Inline style leak across toggle cycles
│   ├── measure-after-clearing-transition-styles.md # Measure after clearing transition styles
│   ├── out-of-flow-wrapper-collapse.md            # Out-of-flow wrapper collapse
│   ├── panel-body-mode-max-height.md              # Panel body mode max-height
│   ├── parallel-fmp4-merge.md                     # Parallel fMP4 merge (tfdt offset)
│   ├── state-dom-init-mismatch.md                 # State-DOM init mismatch
│   ├── subtitle-filename-matches-video.md         # Subtitle filename matches video
│   ├── subtitle-language-detection.md             # Subtitle language detection (hybrid)
│   ├── tab-scoping-popup-leak.md                  # Tab-Scoping (popup media leak)
│   ├── media-accumulation-navigation.md           # Media accumulation across navigation (clear on onTabUpdated)
│   ├── spa-two-phase-render-wipe.md               # SPA two-phase render wipe (Angular foreign element wipe)
│   ├── half-open-interval-cue-matching.md         # Half-open [start,end) for cue boundary matching
│   └── instant-scroll-long-lists.md               # Instant scroll for long lists (motion sickness)
├── test-reports/                      # MCP browser test reports — "does it work in real browser"
│   ├── 2026-06-26-subtitle-sidebar-shortcuts-mcp.md
│   ├── 2026-06-27-subtitle-panel-docking-mcp.md
│   ├── 2026-06-27-subtitle-panel-fullscreen-mcp.md
│   └── screenshot-after-fix.png
├── reviews/                           # Spec review reports (spec-reviewer skill output)
│   └── review-subtitle-drag-integrated.md # Spec review: subtitle drag integrated (APPROVED post-update)
├── reference/                         # Hướng dẫn dùng tools + research synthesis — "how to use / background"
│   ├── chrome-devtools-mcp.md
│   ├── e2e-debugging.md
│   ├── architecture-research-synthesis.md # Architecture research synthesis
│   ├── software-production-process-research.md # Software production process research
│   └── software-org-roles.md          # Software organization roles
└── reading-summaries/                 # Reading summaries

src/            # Source code (chi tiết trong 2-architechture-system.md)
tests/          # Test files (chi tiết trong 2-architechture-system.md)
.agents/        # Agent skills
.windsurf/      # Windsurf rules
│   ├── rules/
│   │   ├── baseline.md              # Windsurf-specific baseline rules
│   │   └── ponytail.md              # Lazy senior dev ladder
```

## Cách dùng tổng quan

| Khi nào | Đọc gì | Để biết |
|---|---|---|
| Đầu session | 0-wiki.md | Dự án có gì, docs nào tồn tại |
| Trước khi sửa code | 2-architechture-system.md | Cấu trúc src/, dependency map, function index |
| Khi hiểu sai intent | 1-share-language.md | Glossary human ↔ system language (2 chiều + Update protocol) |
| Đầu feature | docs/intent/<feature>.md | Output interview-me — what user wants |
| Trước khi plan | docs/specs/<feature>.md | PRD chi tiết — what to build |
| Mỗi task | docs/plan/<feature>.md | Task list — how to build |
| Trước khi viết function mới | grep docs/knowledge/ | Nguyên lý đã học, tránh tái phạm |
| Khi gặp tool mới | docs/reference/<tool>.md | Hướng dẫn dùng tool |
| Khi thay đổi kiến trúc | docs/adr/<decision>.md | Tại sao chọn kiến trúc này |
| Sau khi implement | docs/test-reports/<feature>-mcp.md | MCP browser test — bugs phát hiện trong real Chrome |

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
- Sinh/rename/xóa system term (tên file, toggle, message type, store key) → update 1-share-language.md (xem Update protocol cuối file đó)
