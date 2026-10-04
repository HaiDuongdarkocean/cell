# Intent: Breadcrumb trail cho nested dictionary lookup ở sheet mode (mobile)

> Slug: `dict-sheet-breadcrumb` · Mode: all · Source: user statement (2026-10-04, kèm screenshot `brave_TlIT5gjz4S.png`)
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Khi tra từ lồng nhau trên mobile sheet, user mất vị trí trong chuỗi lookup và không quay lại được kết quả trước — phải đóng sheet rồi tra lại từ đầu | User statement: "lv2 popup thay thế nội dung của lv 1 và không thể quay về được"; `popupLifecycle.ts:387` force `targetIdx = 0` ở sheet mode | high |
| Change | Sheet-mode lookup chain từ "luôn ghi đè level 0" → "stack thật nhiều level + breadcrumb điều hướng ngược" | `popupLifecycle.ts:386-389`; `closeFromLevel` `popupLifecycle.ts:158-169` | high |
| Solution | Bỏ nhánh sheet-mode force level 0 để tái dùng popupStack + thêm thanh breadcrumb ngang ở đỉnh sheet | User chỉ định "close theo logic cũ"; desktop stack đã chạy đúng (`webTextDictionaryController.test.ts:1729+`) | high |
| Value | Chuỗi tra từ (dạy-học kiểu drill-down) không bị đứt; giảm tra-lại thủ công | Persona 5–80 tuổi trên mọi thiết bị (AGENTS.md) | high |
| Stakeholder | Người học ngôn ngữ trên mobile/tablet viewport hẹp | Sheet mode kích hoạt khi `innerWidth < POPUP_SHEET_BREAKPOINT_PX` (`popupLifecycle.ts:141-143`) | high |
| Context | Chrome MV3 content script; popup mount qua `mountReactShadow`; sheet = shared `Sheet` atom không có scrim | `mountPopupDictionary.ts`; `src/shared/ui/Sheet.tsx` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Cell maintainers | Reuse stack machinery thay vì viết history riêng; diff nhỏ, testable | `closeFromLevel`, escape stack, stack tests đã tồn tại |
| Customer | Người học tra từ trên mobile | Thấy chuỗi lookup, quay lại level bất kỳ, vuốt ngang/scroll | Touch ≥44px, shadow-DOM boundary rules |
| Supplier/Dependency | `Sheet` atom, `Breadcrumb` atom, popupStack controller | Sheet cần slot header cố định; Breadcrumb cần labels clickable | `Sheet.tsx`, `Breadcrumb.tsx` trong `src/shared/ui/` |
| Organization | none — feature nội bộ extension | | |
| Regulator | none — không đụng store policy/API mới | | |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Quay lại một level lookup trước đó trong sheet mà không mất context | F | User statement + `closeFromLevel` reuse | high |
| N2 | Thấy chuỗi ancestor terms (lv1 > lv2 > … > lvN) ở đỉnh sheet | F/U | User statement: "breadcrumb ở trên đầu tiên … above > used" | high |
| N3 | Chuỗi dài scroll ngang được: vuốt ngang + wheel (cả lăn dọc đổi sang ngang) | U | User statement | high |
| N4 | Breadcrumb ẩn ở lv1, hiện từ lv2, xuất hiện/ẩn mượt, nền khác nền sheet nhưng tối giản | U | User statement | high |
| N5 | Quay về level i đóng mọi level sâu hơn theo semantics cũ (dọn highlight, resume video khi stack rỗng, focus về level lộ ra) và xoá crumb tương ứng | R/F | `closeFromLevel` `popupLifecycle.ts:158-169` | high |
| N6 | Lookup từ page text khi sheet đang mở reset chuỗi về lv1 | F | Suy ra từ `targetIdx` routing hiện tại + user model "lv1 = page lookup" [assumption] | medium |

## Scope

- **In:** sheet mode (`innerWidth < POPUP_SHEET_BREAKPOINT_PX`); popupStack đa-level; breadcrumb strip fixed ở đỉnh sheet; horizontal scroll + wheel mapping; close semantics reuse `closeFromLevel`; i18n aria labels.
- **Out:** desktop popup UI (đã có stack + ancestor-pointerdown close); backlog/history persist qua session; cap độ sâu.
- **Non-goals:** redesign sheet, đổi `DictionaryPanelView` nội dung, exit animation cho sheet bị destroy (unmount tức thì theo logic cũ).

## Workflow

User mở sheet bằng tap vào token trên page → sheet lv1. Tap vào từ trong nội dung sheet → trigger controller bắn lookup với highlightTarget nằm trong shadow host của level hiện tại → `levelIndexForTarget` trả sourceIdx ≥ 0 → push level mới (mount sheet mới phủ lên) → lifecycle đẩy trail (term mỗi level) xuống các mount → breadcrumb trên top sheet cập nhật. Tap crumb i → `closeFromLevel(i+1)` destroy các level sâu hơn → level i lộ ra, crumb sau i biến mất. Tap từ mới trên page → level 0 reused, sâu hơn bị prune — chuỗi reset.

Design constraints noted for SPECIFY/DESIGN (from analyze audit):

- `Breadcrumb` atom render `<li>{label}</li>` — crumb click cần truyền `<button>` làm label; separator mặc định `/` (`Breadcrumb.module.css`) trong khi user ví dụ `>`; `.list` chưa có `overflow-x` — phần scroll ngang thuộc DESIGN.
- `Sheet` atom chưa có slot cố định giữa handle và `.content` — strip đặt trong `.content` sẽ nằm trong vùng drag-dismiss (`useSheet.ts:282-297`) và cuốn theo scroll; quyết định placement (prop `header` trên Sheet vs sticky trong content vs trong `DictionaryPanelView`) thuộc DESIGN.
- Crumb data: term của ancestor nằm trên `level.term`/`request.term` của level khác — lifecycle phải sync trail xuống mount (API kiểu `setTrail`) sau mỗi push/prune.

## Journey

### AS-IS
1. User tap từ trên page → sheet mở với nghĩa lv1.
2. User tap từ trong nghĩa → sheet ghi đè nội dung bằng kết quả lv2 (`targetIdx` bị force về 0).
3. User muốn xem lại lv1 → không có cách nào; phải đóng sheet rồi tra lại từ gốc.
4. Chuỗi dài (lv3, lv4…) mất toàn bộ lịch sử — mỗi tap ghi đè tiếp.

### TO-BE
1. User tap từ trên page → sheet lv1 mở, breadcrumb ẩn (chỉ 1 level).
2. User tap từ trong sheet → lv2 sheet trượt lên phủ lv1; breadcrumb hiện "lv1 > lv2".
3. User tiếp tục drill tới lvN; breadcrumb cuộn ngang được bằng vuốt hoặc wheel.
4. User tap crumb lv i → các level sâu hơn đóng theo logic cũ, level i lộ ra, breadcrumb còn i mục.
5. User tap từ mới trên page → chuỗi reset về lv1, breadcrumb ẩn.

## Stories

- S1: As a mobile learner, I want to see the chain of looked-up words so that I know where I am in the drill-down — done when a breadcrumb listing ancestor terms appears at the top of the sheet at depth ≥2 and is hidden at depth 1.
- S2: As a mobile learner, I want to jump back to any earlier lookup so that I keep context without re-looking-up — done when tapping crumb i reveals level i and closes every deeper level with the existing close semantics.
- S3: As a mobile learner, I want long chains to stay reachable so that deep drill-downs remain navigable — done when the breadcrumb scrolls horizontally via swipe and mouse wheel.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| N sheet mount chồng nhau: Escape/focus/pointer routing lỗi | internal | Medium | Escape stack LIFO + `closeFromLevel` + stack tests đã cover; thêm test sheet-mode |
| Chuỗi sâu giữ N DOM dictionary nặng trên máy RAM 1GB | operational | Low–medium | Không cap (khớp desktop "no depth cap" test); sheet DOM chủ yếu text |
| Drag-dismiss/swipe trên top sheet xung đột vuốt ngang breadcrumb | human/UX | Low | Crumb strip nằm ngoài content scroll region; `touch-action: pan-x` |
| Sheet destroy không có exit animation → "pop" giật | UX | Low | Chấp nhận — unmount tức thì là logic cũ; sheet enter đã có slide-up |
| N level đều render `aria-modal="true"` — nhiều modal đồng thời là ARIA invalid | a11y | Low | Chỉ top sheet nên modal; quyết ở SPECIFY/DESIGN |
| Parent sheet cao hơn child sau resize → phần lộ của parent tap vào sẽ prune child (`onStackPointerDown` → `closeFromLevel(idx+1)`) — affordance vô hình | UX | Low | Khớp semantics desktop; ghi chú để DESIGN cân nhắc |

## Decision

go — pain rõ, solution direction user chỉ định khớp machinery có sẵn, chi phí nhỏ (bỏ 1 nhánh force + trail plumbing + 1 strip UI).

## Draft Acceptance Criteria

- [ ] Ở sheet mode, lookup từ nội dung sheet push level mới (không ghi đè lv1); lookup từ page reset về lv1.
- [ ] Breadcrumb strip hiển thị ở đỉnh top sheet khi depth ≥2, liệt kê term mỗi level theo thứ tự, ẩn hoàn toàn ở depth 1.
- [ ] Tap crumb i (i < top) → mọi level > i đóng theo `closeFromLevel`, level i lộ ra, breadcrumb truncate về i mục.
- [ ] Strip scroll ngang bằng touch swipe; wheel dọc trên strip scroll ngang.
- [ ] Escape/drag-dismiss trên top sheet chỉ đóng top level (lộ parent), stack rỗng mới resume video.
- [ ] Desktop popup behavior không đổi (stack + không breadcrumb mới).
