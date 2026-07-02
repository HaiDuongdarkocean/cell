# 1-Share Language — Glossary

> Bridge giữa human language và system language. Khi anh nói X, hệ thống hiểu Y.
>
> **Cơ chế 2 chiều**:
> - **Anh → System** (table dưới): anh dùng từ tự nhiên → em tra → map sang system term.
> - **System → Anh** (section "Reverse lookup" cuối): em output system term → tra alias anh dùng → kèm mapping `(anh gọi: Y)` lần đầu xuất hiện trong conversation.
> - Table chỉ ghi chiều Anh → System; chiều ngược lại là đảo của cột 1, ghi riêng cho các term có nhiều alias hoặc không đảo trực tiếp được.

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
| "nav cluster" | Subtitle navigation control cluster | Floating 6-nút xếp dọc (⋯/⏪/◀/🔁/▶/⏩) inject vào video player, drag-to-move + collapse half-circle |
| "thu gọn" | Collapse mode | Nav cluster collapse thành 1 icon half-circle dính mép video gần nhất, tap = expand lại |
| "dính mép" | Edge-stuck | Half-circle icon stuck sát mép video (trái/phải) khi collapse mode |
| "hold to loop" | Hold-to-loop repeat | Giữ nút repeat ≥500ms = loop câu hiện tại, release = stop (Pointer Events, touch+mouse cùng handler) |
| "drag handle ⋯" | Nav cluster drag handle | Icon ⋯ trên cùng cluster: press+drag=move, double-click=reset default, drag-to-edge=collapse |
| "cột phụ" | Secondary seek column | Cột ⏪⏩ nhô bên phải cột chính (⋯/◀/🔁/▶), ít dùng nhưng không thiếu, offset xuống 1 row |

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

## Reverse lookup (System → Anh)

> Tra khi em output system term lần đầu trong conversation → kèm `(anh gọi: Y)`.
> Chỉ liệt kê term có nhiều alias hoặc không đảo trực tiếp từ table trên.

| System term | Anh có thể gọi |
|---|---|
| `autoDownloadEnabled` | "AD toggle", "auto-download toggle" |
| `autoSelectEnabled` | "AS toggle", "auto-select toggle" |
| `tabId` (in payload) | "tab-scoping", "tab filter" |
| `src/content/` | "content script", "script chạy trong trang" |
| `src/background/` | "service worker", "background" |
| `src/offscreen/` | "offscreen", "offscreen document" |
| `mux.js` (TS → fMP4) | "transmuxing", "convert TS" |
| `docs/2-architechture-system.md` | "architecture map", "file structure doc" |
| `docs/knowledge/principles.md` | "principle index", "nguyên lý đúc rút" |
| `docs/adr/NNN-*.md` | "ADR", "architecture decision" |
| Subtitle navigation control cluster | "nav cluster", "control cluster", "cluster 6 nút" |
| Collapse mode (half-circle edge-stuck) | "thu gọn", "dính mép", "collapse" |

## Update protocol

**Khi nào update file này:**
1. **Anh dùng từ mới chưa có entry** (runtime, mọi phase) → em hỏi "anh đang nói đến X phải không?" → confirm → thêm entry vào table tương ứng + reverse lookup nếu có nhiều alias. Đây là trigger chính, xảy ra nhiều nhất ở G0 interview.
2. **Em sinh system term mới** (G4 implementation: tên file mới, tên toggle, tên message type, tên store key) → thêm entry "anh có thể gọi là Z → system term W" + reverse lookup. Nếu không thêm, anh không có cách gọi term đó.
3. **System term bị rename/refactor** (G4/G7) → update entry (đổi cột System term) hoặc xóa entry nếu term bị xóa. Trigger này đi cùng commit refactor, không tách riêng.

**Cách update:**
- Đọc file này → tìm entry cần sửa → edit
- Không cần rewrite toàn bộ, chỉ edit phần liên quan
- Giữ format nhất quán (table, section)
- Entry mới: xác nhận **không trùng alias** với entry đã có (grep cột "Anh nói" trước khi thêm) — tránh 2 system term cùng đáp 1 alias

**Commit rule:**
- Glossary update đi **cùng commit phase** nơi term sinh/đổi (không tách commit riêng) — glossary là cross-cutting reference, không phải feature artifact.
- Nếu chỉ update glossary mà không có file khác trong phase đó → mới tách commit `docs: glossary <term>`.
