# 1-Share Language — Glossary

> Bridge giữa human language và system language. Khi anh nói X, hệ thống hiểu Y.

## Project Terms

| Anh nói | System term | Ý nghĩa thực sự |
|---|---|---|
| "tài liệu sống" | Living documentation | Docs tự update theo code changes, không stale |
| "đúc rút kinh nghiệm" | Khái niệm hóa nguyên lý | Abstract principle from concrete bug case, apply cho nhiều trường hợp |
| "ngữ cảnh" | Context (Level 1-5) | Rules files → specs → source files → error output → conversation |
| "pain point" | Root problem | Vấn đề gốc gây hậu quả, không phải triệu chứng |
| "living docs" | Living documentation system | Hệ thống docs tự update, glossary, ADR, knowledge base |
| "function index" | Function registry | Grep-friendly table: function, file, input/output, used by |
| "dependency map" | Dependency matrix | Sửa file A ảnh hưởng file B (import/call) |
| "ADR" | Architecture Decision Record | Tại sao chọn kiến trúc này, không chọn kiến trúc khác |

## Action Verbs

| Anh nói | System action | Ý nghĩa thực sự |
|---|---|---|
| "refine lại" | Restructure + de-duplicate | Tổ chức lại cấu trúc, bỏ trùng lặp |
| "khái niệm hóa" | Abstract to principle | Rút nguyên lý từ case cụ thể |
| "invoke skill" | Load skill content vào context | Đọc SKILL.md và apply workflow |
| "de-duplicate" | Remove duplication | Xóa trùng lặp code/docs theo ponytail rule |
| "compact context" | Remove stale context | Xóa context cũ khi context window đầy |

## Chrome Extension Terms

| Anh nói | System term | Ý nghĩa thực sự |
|---|---|---|
| "AD toggle" | autoDownloadEnabled | Header toggle bật auto-download cho whitelist URL |
| "AS toggle" | autoSelectEnabled | Settings toggle auto-select best media on popup open |
| "tab-scoping" | Tab-level message filtering | Payload carries tabId, popup filters by tabId |
| "app-window leak" | Edge app-window interference | Edge built-in app-windows (dictionary sidebar) masquerade as active tab |
| "whitelist" | URL-based auto-download trigger | Whitelist first pathname segment (origin + first path segment) |

## Architecture Terms

| Anh nói | System term | Ý nghĩa thực sự |
|---|---|---|
| "content script" | src/content/ | Chạy trong trang web, scan DOM, gửi PAGE_SCAN_RESULT |
| "service worker" | src/background/ | MV3 orchestrator, message handlers, network interception |
| "offscreen" | src/offscreen/ | Offscreen document, OPFS access, Web Workers |
| "transmuxing" | TS → fMP4 conversion | mux.js converts HLS TS segments to fMP4 for download |
| "parallel transmux" | N groups parallel transmux | Split TS file, parallel transmux, merge with tfdt offset fix |

## Test Terms

| Anh nói | System term | Ý nghĩa thực sự |
|---|---|---|
| "unit test" | tests/unit/** | Fast (~3s), no network, jest project "unit" |
| "integration test" | tests/integration/** | Slow (network), uses globalSetup, caches m3u8/TS segments |
| "E2E test" | Playwright | Full browser automation, real Chrome/Edge, tests/ui/ |
