# Clipboard Page — Intent

> Output của skill `interview-me`.
> Downstream: `spec-driven-development` → `planning-and-task-breakdown` → implement.

## Problem

Người dùng dùng native app (game, app ngoài browser) và cần tra từ + xem tokenize trên text copy — nhưng Cell hiện chỉ hoạt động trong browser, không có bridge từ system clipboard.

## User

5-80 tuổi, học ngoại ngữ, dùng native app + browser, persona nhiều nhất 10-25 tuổi.

## Current workflow

1. Chơi game / dùng native app
2. Copy text
3. Chuyển sang browser
4. Paste vào tool nào đó
5. Tra từ thủ công
6. Không có tokenize

## Pain point

- Không có bridge native → Cell
- Text copy không kết nối được tokenize + dictionary có sẵn
- Đọc text dài không tách đoạn → rối mắt

## Evidence

User explicitly stated use case (game + native app ngoài browser). Cell đã có tokenize + dictionary nhưng không có entry point từ system clipboard.

## Desired outcome

Clipboard page full page — đọc system clipboard, hiển thị multi-item history, click từ → dictionary popup, toggle tokenize, toggle tách đoạn, font size/family, dark/light.

## Constraint

- MV3 extension
- System clipboard access (`navigator.clipboard.readText` — cần document focused + user gesture)
- Cross-browser Chrome/Edge/Brave
- Desktop + tablet + Android
- RAM ≥1GB
- Reuse tokenize + dictionaryPopup + CopyButton

## Scope

**MVP:**
- Clipboard = tab trong universal panel (không phải standalone page)
- Read system clipboard (manual open + toggle auto-update)
- Multi-item history với CRUD (add/rename/delete) + tự đặt tên
- Toggle tách câu → mỗi cue sentence có copy button riêng
- Pagination height-based cho nội dung clipboard — content overflow container thì mới phân trang, tránh lag khi nhiều text
- Sidebar toggle ẩn/hiện — hiển thị tên + thời gian (updatedAt)
- Settings ẩn trong nút settings (gear icon) — auto-update, tách câu, font size, font family
- Component chuyên dụng cho text display (readability, font, tách câu)
- Inline editing — user edit text trực tiếp trong detail panel, updatedAt update khi edit
- Responsive mobile-first 320→desktop
- Dark/light: dùng token, không có toggle (theme system lo)

**Out of scope:**
- Toggle tokenize (universal panel đã có)
- Dark/light toggle (theme system lo)
- 2-way bridge (Cell → native)
- Clipboard write back to system
- Sync across devices

## Domain dependencies

- `src/features/tokenize/` — universal panel đã có, không build lại
- `src/features/dictionaryPopup/` — universal panel đã có
- `src/shared/ui/CopyButton.tsx` — reuse cho copy item + copy từng cue sentence
- `src/shared/ui/Toggle.tsx` — reuse cho settings toggles
- `src/shared/ui/SliderRow.tsx` — reuse cho font size
- `src/shared/ui/Select.tsx` — reuse cho font family
- `src/shared/ui/IconButton.tsx` — reuse cho sidebar toggle + settings gear
- `src/shared/ui/Card.tsx` — reuse cho history items
- New: clipboard tab component + system clipboard reader + history store + text display component

## Prototype feedback log

### Round 1 — 2025-08-25

**Feedback v1→v2 (11 items):**
1. Dark/light: bỏ toggle — Cell đã có theme system, dùng token đúng tự hỗ trợ
2. Tokenize: bỏ khỏi clipboard page — universal panel đã có
3. Clipboard history = tab trong universal panel, không phải standalone page
4. CRUD history + tự đặt tên cho mỗi entry
5. Settings ẩn trong nút settings (gear icon) — không để màn hình bị ô nhiễm
6. Sidebar clipboard history có nút toggle ẩn/hiện
7. Component chuyên dụng cho quản lý text hiển thị (riêng biệt, reusable)
8. Toggle tách đoạn ON → mỗi cue sentence có copy button icon riêng; OFF → 1 copy button cho cả item
9. Pagination cho nội dung clipboard (không phải sidebar) — tránh tốn tài nguyên, lag
10. Sidebar hiển thị: tên + thời gian (updatedAt — update khi edit mới nhất)
11. Responsive mobile-first 320→desktop

**Frame updates:**
- Scope: bỏ tokenize, bỏ dark/light toggle, thêm CRUD, thêm pagination nội dung, thêm component chuyên dụng, đổi từ standalone page → universal panel tab
- Constraint: thêm "reuse universal panel cho tokenize + dictionary"
- Domain dependencies: bỏ TokenizedParagraph, thêm universal panel

**Prototype updates:**
- Bỏ dark mode toggle, dùng token `var(--md-sys-color-*)`
- Bỏ tokenize + TokenizedParagraph import
- Thêm name field cho items (CRUD + tự đặt tên)
- Thêm settings popover (gear IconButton) — auto-update, tách câu, font size, font family
- Thêm sidebar toggle (menu IconButton)
- Thêm cueRow pattern — mỗi sentence có CopyButton khi tách câu ON
- Chuyển pagination từ sidebar → detail panel (nội dung clipboard)
- Sidebar hiển thị name + updatedAt
- CSS mobile-first: 320px baseline, 768px sidebar 280px, 1280px sidebar 320px

### Round 2 — 2025-08-25 (hot fix)

**Feedback:**
1. URL pattern trong `redesign-in-showcase` SKILL.md: bỏ `http://` khỏi documentation pattern, nhưng `start chrome` command vẫn cần `http://` để Chrome navigate (không search)
2. Pagination ở detail panel (nội dung clipboard), không phải sidebar history

**Skill updates:**
- `redesign-in-showcase` SKILL.md: URL pattern docs bỏ `http://`, `start chrome` command giữ `http://`
- `interview-me` SKILL.md: Step 9 thêm "Log" — mỗi feedback round phải ghi vào `docs/intent/[topic].md` ngay sau confirm
- `interview-me` SKILL.md: Step 11 đổi thành "Update Frame + Intent Doc"
- `interview-me` SKILL.md: Thêm red flag "Feedback confirmed but not logged" + "Intent doc not updated after frame changes"
- `interview-me` SKILL.md: Verification checklist thêm 2 dòng log verification

### Round 3 — 2025-08-25

**Feedback:**
1. User có thể edit và ghi trực tiếp chữ trong nội dung clipboard (inline editing trong detail panel)
2. URL command `start chrome` bị quote nesting sai — `http://"http//...` — fix dùng single quote outer, double quote inner

**Frame updates:**
- Scope: thêm "inline editing — user edit text trực tiếp trong detail panel"
- Pain point: thêm "không thể chỉnh sửa text sau khi copy"

**Prototype updates:**
- Detail content → `contentEditable` hoặc `textarea` cho inline editing
- updatedAt update khi user edit

**Skill updates:**
- `redesign-in-showcase` SKILL.md: `start chrome` command dùng single quote outer để tránh nesting

### Round 4 — 2025-08-25

**Feedback:**
1. Cần CRUD clipboard history: thêm mới, sửa tên, xóa item
2. Bỏ `historySource` (source field) — clipboard chỉ đọc từ system clipboard, không có "source" concept

**Frame updates:**
- Scope: thêm "CRUD — add/rename/delete clipboard items"
- Domain dependencies: bỏ source field khỏi data model

**Prototype updates:**
- Thêm add button (tạo item mới)
- Thêm rename action (sửa tên item)
- Thêm delete action (xóa item)
- Bỏ source field khỏi mock data + sidebar display

### Round 5 — 2025-08-25

**Feedback:**
1. Pagination dựa trên chiều dài nội dung content — nếu content dài hết container rồi mà nội dung vẫn còn thì phân trang. KHÔNG phải count-based (PAGE_SIZE=3 sentences)
2. Hot fix skill: phải sửa logic + UI đồng thời, prototype phải đẹp như product thật với mock data đầy đủ thực tế, không phải bản nháp

**Frame updates:**
- Scope: đổi "pagination count-based" → "pagination height-based — content overflow container thì mới phân trang"
- Constraint: thêm "prototype phải product-quality, mock data thực tế đầy đủ"

**Prototype updates:**
- Bỏ PAGE_SIZE=3 count-based
- Pagination height-based: đo content height vs container height, split sentences thành pages theo container
- Mock data thực tế hơn — dài hơn, nhiều sentence hơn để test overflow

**Skill updates:**
- `redesign-in-showcase` SKILL.md: thêm rule "fix logic + UI đồng thời"
- `redesign-in-showcase` SKILL.md: thêm rule "prototype product-quality + mock data thực tế"

### Round 6 — 2025-08-25

**Feedback:**
1. Chưa thấy case có độ phủ text thật nhiều trong content clipboard để xem pagination hoạt động

**Prototype updates:**
- Thêm item 6: "Novel chapter — The Last Lighthouse" — ~30 sentences, cực dài để trigger overflow
- Thêm item 7: "Research paper abstract — Coral bleaching" — ~15 sentences, dài vừa
- Mock data giờ có đủ range: short (serendipity, chat), medium (game dialog, ML article), long (novel, research paper)

### Round 7 — 2025-08-25

**Feedback:**
1. Pagination phải hoạt động trên cả 2 chế độ (tách câu ON + OFF), không chỉ khi tách câu ON
2. Edit phải có nút edit riêng — click vào text không edit trực tiếp, phải click nút edit mới vào edit mode (tránh conflict với dictionary popup click để tra cứu)
3. Pagination cần hiển thị nổi, rõ ràng
4. Khi kéo tới cuối không được che mất text — pagination không che content, tiết kiệm không gian hiển thị

**Frame updates:**
- Scope: đổi "pagination chỉ khi tách câu" → "pagination cả 2 chế độ"
- Scope: đổi "inline editing contentEditable" → "edit mode qua nút edit button, không click text trực tiếp"
- Constraint: thêm "click text = dictionary lookup, click edit button = edit mode — không conflict"

**Prototype updates:**
- Pagination height-based hoạt động cả khi tách câu ON + OFF
- Thêm edit button (pencil icon) trong detail header — click mới vào edit mode
- Text mặc định read-only, chỉ edit khi click edit button
- Pagination UI nổi hơn — background, border, fixed bottom không che content

### Round 8 — 2025-08-25

**Feedback:**
1. Sidebar cần nút search
2. Pinned history — chia sidebar thành 2 khu vực: Pinned + Recents
3. Nút toggle thu phóng sidebar (collapse/expand)
4. Layout: sidebar chiều dài giới hạn, content dài hết phần còn lại màn hình
5. Sidebar header: tên "Clipboard" + nút search + nút toggle thu phóng
6. Sidebar body: "New clipboard" button → Pinned section → Recents section
7. Mỗi clipboard item: tên + thời gian cách nhau bởi dấu chấm ngang giữa (·)
8. Mỗi item có nút 3 chấm (kebab) → menu: rename, pin, delete

**Frame updates:**
- Scope: thêm "search clipboard history", "pinned vs recents sections", "collapse sidebar", "kebab menu per item"
- Data model: thêm `pinned: boolean` field

**Prototype updates:**
- Sidebar header: "Clipboard" + search IconButton + collapse IconButton
- Sidebar body: "New clipboard" Button → Pinned section (label + items) → Recents section (label + items)
- Item card: name · time (middle dot separator) + kebab menu (3-dot) → rename/pin/delete
- Collapse sidebar: toggle width 0 (icon-only) vs full
- Layout: sidebar fixed width, content flex-1 fill remaining

### Round 9 — 2025-08-25

**Feedback:**
1. Pagination ở chế độ thường (không phân đoạn) vẫn phải hoạt động
2. Pagination control nâng cao: << < 1,2,3 ... 98,99,100 > >>
   - << first page, < prev, > next, >> last page
   - Page numbers với ellipsis (...) giữa các nhóm
3. Click "..." → popup danh sách trang để chọn (mobile-friendly)
4. Desktop: input trực tiếp số trang + Enter/search → jump tới trang đó

**Frame updates:**
- Scope: đổi "pagination chỉ khi tách câu" → "pagination cả 2 chế độ (thường + tách câu)"
- Scope: thêm "pagination control: first/prev/numbers/next/last + ellipsis popup + direct page input"

**Prototype updates:**
- Pagination hoạt động cả khi splitSentences ON + OFF
- Pagination control: << < 1 2 3 ... 98 99 100 > >>
- Ellipsis (...) click → popup page list
- Desktop: input số trang + Enter → jump

### Round 10 — 2025-08-25

**Feedback:**
1. Item card đang thừa — có 2 name (historyName + historyInfo đều hiển thị name)
2. Chỉ cần 1 dòng duy nhất: name (đậm) · time (nhạt) · kebab button (nhạt)
3. Name quá dài → ellipsis (...) nhưng vẫn hiển thị time ở cuối

**Prototype updates:**
- Bỏ historyName + historyMeta tách riêng → gộp thành 1 dòng flex
- Name: font-weight 500, flex-shrink 0 tối thiểu, text-overflow ellipsis
- Time: opacity 0.6, flex-shrink 0
- Kebab: opacity 0.6, hover opacity 1
- Layout: name (đậm, co lại + ...) | time (nhạt, cố định) | kebab (nhạt)

### Round 11 — 2025-08-25

**Feedback:**
1. Bỏ detailTopBar — không cần top bar riêng
2. Settings button chuyển vào detailActions
3. Thứ tự detailActions (trái→phải): copy all | edit | settings (settings ngoài cùng phải)
4. Mobile (màn hình nhỏ) → thu gọn detailActions thành nút 3 chấm, click → popup chứa settings/edit/copy all

**Prototype updates:**
- Xóa detailTopBar hoàn toàn
- detailActions: [Copy all] [Edit] [Settings] — settings ngoài cùng phải
- Responsive: màn hình nhỏ → chỉ hiện kebab 3 chấm, click → dropdown menu

### Round 12 — 2025-08-25

**Feedback:**
1. Mobile: cần nút toggle sidebar ở phía trái cùng, nằm trong detailHeader
2. Toggle + detail name cùng một khối (detailHeader)

**Prototype updates:**
- Thêm mobile sidebar toggle button trong detailHeader (chỉ hiện <600px)
- Toggle + name cùng dòng trong detailHeader

### Round 13 — 2025-08-25

**Feedback:**
1. Mobile: hiển thị đầu tiên phải là nội dung (content), không phải sidebar — hiện tại sidebar hiện trước

**Prototype updates:**
- Mobile: content panel hiện trước, sidebar ẩn mặc định (toggle mới hiện)
- Desktop: sidebar hiện trước (như hiện tại)

### Round 14 — 2025-08-25

**Feedback:**
1. Mobile: khi click vào clipboard history item → đóng sidebar lại

**Prototype updates:**
- renderItemCard onClick: thêm `setMobileSidebarOpen(false)`

### Round 15 — 2025-08-25

**Feedback:**
1. IconButton (mobile toggle) + detail name phải nằm cùng một khối
2. Pagination chế độ thường (không phân đoạn) vẫn không hoạt động — chỉ hoạt động khi split ON

**Root cause pagination:**
- Chế độ thường: `currentText.split(/(?<=\n)/)` chỉ ra 1 unit vì text không có newline → 1 page
- Fix: chia text thành word chunks, group words vào pages theo container height

**Prototype updates:**
- Wrap toggle + name trong 1 div `.detailNameGroup`
- Pagination chế độ thường: chia theo word chunks, group vào pages theo height
- detailNameGroup: `justify-content: flex-start`, `gap: 8px`
- detailName: `white-space: nowrap` + `text-overflow: ellipsis` — clip ngay, không tách 2 dòng

**Confirmed:** 2025-08-25 — user confirmed Round 15

### Round 16 — 2025-08-25 (spec phase)

**Feedback:**
1. Clipboard Page là standalone page (không phải tab trong universal panel)
2. Phải có orbital — OrbitalBadge floating draggable, click → mở universal panel → button Clipboard → clipboard page
3. Prototype phải chỉnh lại tất cả dùng component từ design system (`src/shared/ui/*`)
4. Dark/light mode — dùng token SSOT (`var(--color-*)`), KHÔNG `var(--md-sys-color-*)`

**Frame updates:**
- Scope: đổi "tab trong universal panel" → "standalone extension page (như Reader)"
- Scope: thêm "orbital entry point — OrbitalBadge → universal panel → clipboard button"
- Constraint: đổi "dùng var(--md-sys-color-*)" → "dùng var(--color-*) từ tokens.json SSOT"
- Constraint: thêm "tất cả UI dùng src/shared/ui/* — KHÔNG tự tạo"

**Spec output:**
- `docs/specs/clipboard-page.md` — spec đầy đủ (12 sections)

### Round 17 — 2025-08-25 (skill feedback)

**Feedback:**
1. Prototype phải dùng color token của hệ thống (`var(--color-*)`), KHÔNG dùng M3 (`var(--md-sys-color-*)`)
2. Prototype phải dùng 100% component từ design system (`src/shared/ui/*`) — nếu thiếu component thì viết thêm vào hệ thống trước, rồi dùng
3. Prototype hoàn thành = giao diện chính thức, không phải throwaway

**Skill updates:**
- `redesign-in-showcase` SKILL.md: thêm rule "Token SSOT — dùng color của hệ thống, KHÔNG dùng M3"
- `redesign-in-showcase` SKILL.md: thêm rule "100% component từ design system — nếu thiếu → thêm vào src/shared/ui/ trước"
- `redesign-in-showcase` SKILL.md: thêm rule "Prototype = giao diện chính thức — code production-quality"
- `redesign-in-showcase` SKILL.md: thêm anti-patterns: M3 token, inline component, throwaway prototype
- `redesign-in-showcase` SKILL.md: update verification checklist: token SSOT, component SSOT, dark/light

## Confirmed

2025-08-25 — user confirmed all fields via interview + clarification loop.
2025-08-25 — prototype v2 feedback round 1 logged (11 items).
2025-08-25 — hot fix round 2 logged (2 items).
