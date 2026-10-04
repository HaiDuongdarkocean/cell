# Spec: Breadcrumb trail cho nested dictionary lookup ở sheet mode

> Intent: `docs/intent/dict-sheet-breadcrumb.md` · ui_surface: yes · Mode: all

## Objective

Ở sheet mode (`innerWidth < POPUP_SHEET_BREAKPOINT_PX` = 599px), mỗi lookup từ nội dung sheet phải push một popup level mới (stack thật, như desktop) thay vì ghi đè level 0, và top sheet hiển thị breadcrumb strip ở đỉnh liệt kê term từng level — tap crumb i quay về level i bằng `closeFromLevel` hiện có. Giải quyết pain "lv2 thay thế lv1, không quay về được" trong intent.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User (mobile/narrow viewport) | Tap token trên page; select/tap từ trong `data-allow-lookup` của sheet; tap crumb; tap/-drag handle; Escape; wheel/swipe trên strip | lookup term (qua selection/tap), crumb index | Sheet mở/đóng, breadcrumb strip, highlight trên token nguồn |
| WebTriggerController | Selection/pointer trong page hoặc trong shadow host của một level | LookupRequest + anchorRect + highlightTarget | — (nội bộ: vẫn là actor đối với lifecycle vì đứng ngoài boundary popup) |

System = `popupLifecycle` + `mountPopupDictionary` + `PopupDictionary`/`Sheet`/`Breadcrumb` UI. Human behavior không xuất hiện trong system flow.

## Requirements

### Functional

REQ-1: Nested lookup push level mới ở sheet mode
- Actor: WebTriggerController (từ user tap trong sheet content)
- Goal: lookup từ nội dung level N tạo level N+1
- Preconditions: sheet mode, ≥1 level đang mở
- Basic flow:
  1. actor dispatch handleLookup với highlightTarget nằm trong shadow host level N
  2. system resolve `sourceIdx = N` qua `levelIndexForTarget`, `targetIdx = N + 1`
  3. system prune các level > targetIdx, push level mới, mount sheet mới phủ lên trên, sync trail cho mọi mount
  4. system output: top sheet hiển thị kết quả lv N+1 + breadcrumb N+1 mục
- Alt flow: lookup lúc level đang loading → level mới mount loading shell, result đổ về qua `setResult` như hiện hữu
- Exception: request bị cancel khi level bị prune → `sendLookupCancel` trong `destroyLevel` (đã có)
- Rules: `targetIdx = sourceIdx + 1` cho mọi mode — bỏ nhánh `isSheetMode() ? 0 :`; page lookup (sourceIdx = -1) → targetIdx 0 → reset chuỗi
- Postcondition: stack sâu N+1; token nguồn giữ `POPUP_OPEN_CLASS` theo level
- NFR refs: NFR-1, NFR-4

REQ-2: Breadcrumb strip trên top sheet
- Actor: User (view), system render
- Goal: thấy chuỗi term lv1 → lvN
- Preconditions: top sheet đã render
- Basic flow:
  1. system sync trail (mảng `lookupTerm` — term user tap/lookup — của từng level) xuống mount sau mỗi push/prune
  2. top sheet render strip cố định giữa drag handle và vùng content scroll: các crumb ngăn bằng separator `>`, crumb cuối là current (non-interactive, `aria-current`)
  3. depth < 2 → strip không render (ẩn hoàn toàn)
- Alt flow: crumb của level đang loading vẫn hiển thị (label = request term đã biết lúc push); label dài → truncate ellipsis với `max-width` token, không để 1 crumb chiếm hết strip
- Exception: term rỗng → không xảy ra (lookup luôn có term)
- Rules: strip trong `nav` aria-label breadcrumb; nền khác `--color-surface-popover` nhưng tối giản (token surface secondary); strip không nằm trong `.content` (tránh vùng drag-dismiss của `useSheet` và scroll cùng nội dung); separator `>` cần prop `separator` additive trên `Breadcrumb` atom (atom đang hardcode `/` trong CSS) — không tự viết breadcrumb thứ hai
- Postcondition: top sheet luôn mirror stack hiện tại
- NFR refs: NFR-2, NFR-3

REQ-3: Điều hướng ngược qua crumb
- Actor: User
- Goal: quay về level i bất kỳ
- Preconditions: depth ≥ 2, strip đang hiển thị
- Basic flow:
  1. actor tap crumb i (i < top)
  2. system gọi `closeFromLevel(i + 1)` — destroy mọi level sâu hơn theo semantics cũ (cancel request, clear highlight, unmount, focus level lộ ra, resume video chỉ khi stack rỗng)
  3. system sync trail → strip còn i+1 mục
  4. system output: level i là top sheet
- Alt flow: tap crumb current (top) → no-op (non-interactive)
- Exception: level i đã bị destroy giữa lúc tap (race không thể — tap là sync trong cùng mount)
- Rules: không re-fetch — level i mount vẫn giữ result; video resume chỉ khi stack rỗng
- Postcondition: stack length = i+1
- NFR refs: NFR-1

REQ-4: Scroll ngang cho strip
- Actor: User
- Goal: đi tới crumb đầu/cuối khi chuỗi tràn chiều ngang
- Preconditions: strip render, nội dung overflow-x
- Basic flow:
  1. actor vuốt ngang (touch pan) hoặc lăn wheel trên strip
  2. system scroll ngang strip; wheel deltaY map sang scrollLeft
  3. crumb mới nhất auto scroll into view khi push level
- Alt flow: chuỗi ngắn không overflow → không scroll, không dead zone
- Exception: scroll thất bại → crumb vẫn reachable (strip là layout thường, không có state destructive); `scrollIntoView` lỗi → bỏ qua, không chặn render
- Rules: `touch-action: pan-x` trên strip; scrollbar ẩn (theo pattern `hide` trong Scrollable.module.css); wheel vertical→horizontal khi deltaX = 0; crumb bị clip một phần ở mép scroll phải fade (mask-image gradient theo hướng scroll, bật per-edge khi có content bị che) — không được cắt cứng giữa từ
- Postcondition: mọi crumb reachable
- NFR refs: NFR-3

REQ-5: Đóng từng level theo affordance cũ
- Actor: User
- Goal: đóng top level (back một bước) hoặc đóng hết
- Preconditions: ≥1 level mở
- Basic flow:
  1. actor tap/click handle, drag-dismiss content, hoặc Escape
  2. system `closeFromLevel(indexOf(top))` → chỉ top level destroy → level dưới lộ ra
  3. stack rỗng → resume video + resetVideoPlaying (đã có)
- Alt flow: Escape → escape layer của chính top sheet (pushEscapeLayer, capture-phase, LIFO — `escapeLayerStack.ts:43-49`) consume phím rồi gọi `onClose` → `closeFromLevel(top)`; `onStackKeydown` (bubble-phase document listener) không chạy khi sheet nào mở — nó chỉ phủ path non-sheet (desktop popup, focus ngoài surface); pointerdown vào phần lộ của ancestor sheet → `closeFromLevel(idx+1)` (đã có)
- Exception: destroy giữa lúc drag → session bị cancel cùng unmount
- Rules: không thay đổi `dismissOnOutsideClick=false` ở sheet mode — tap page vùng trống không đóng sheet (giữ behavior cũ)
- Postcondition: stack giảm đúng 1 hoặc về 0
- NFR refs: NFR-1, NFR-4

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Reuse `closeFromLevel`/`popupStack`/`destroyLevel` — không viết close-path riêng cho sheet | S | zero duplicate close logic |
| NFR-2 | Strip dùng token `--color-*`/`--space-*`/`--radius-*`/`--duration-*` từ tokens; i18n qua `t()`; không hardcode màu/px | S | check-design-brief pass |
| NFR-3 | Strip scroll mượt trên touch; wheel→horizontal không chặn scroll dọc của content | P | 60fps, không preventDefault wheel trừ khi consume |
| NFR-4 | Chỉ top sheet `aria-modal="true"`; non-top sheet `inert` (ra khỏi tab order + a11y tree — `aria-modal` thôi không đủ vì virtual cursor vẫn tới được content bị che); crumb là button thật ≥44px hit target; current crumb `aria-current` | U (a11y) | WCAG AA |
| NFR-5 | Level mới inherit `popupSheetHeightVh` như hiện hữu (`initialSheetHeight`) | U | same height ⇒ top sheet phủ kín parent |

## Flows / States

```
sheet stack state:  stack [] --page-lookup→ [0] --in-sheet-lookup→ [0..N]
[0..N] --tap crumb i→ [0..i]           (closeFromLevel(i+1))
[0..N] --Escape / handle close→ [0..N-1]
[0..N] --page-lookup→ [0]              (sourceIdx=-1 → targetIdx=0 → prune 1..N, reuse level 0)
[0]    --close→ []                     (resumeVideo + resetVideoPlaying)
```

Trail sync: `popupStack` mutation (push / pop / reset) → `syncTrail()` → mỗi `level.mount.setOptions({ trail, isTopLevel })` → top sheet render strip; non-top `isTopLevel=false` (aria-modal off + strip không cần thiết vì bị che — nhưng render cùng trail để lộ ra đúng ngay khi được reveal).

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Duy trì stack lookup đa-level ở sheet mode | bỏ force `targetIdx=0`; `createPopupLevel`+`mountPopupLevel` reuse; `lookupTerm` trên `PopupLevel` |
| Hiển thị vị trí trong chuỗi lookup | trail prop → `Dictionary` sheet branch → strip component (DESIGN: `Breadcrumb` atom + feature wrapper `LookupTrail`) |
| Điều hướng ngược theo level | `onTrailNavigate(index)` → `closeFromLevel(i+1)` |
| Scroll ngang chuỗi dài | `overflow-x:auto` + `touch-action:pan-x` + `onWheel` deltaY→scrollLeft + `scrollIntoView` crumb mới |
| Phân biệt modal level | `isTopLevel` prop → top sheet `aria-modal="true"`, non-top `inert` + không modal |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `PopupLevel.lookupTerm` (mới) | `string \| null` — term của request tạo level | `controllerTypes.ts` | lifetime của level (reset khi level reuse) |
| trail prop | `string[]` term theo thứ tự stack | `MountPopupDictionaryOptions` / `CurrentOptions` | per render, không persist |
| `isTopLevel` | `boolean` | same | per render |

Không persist gì qua session; không storage key mới.

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 quay lại level trước | REQ-1, REQ-3, REQ-5 | AC-2, AC-3, AC-6 |
| N2 thấy chuỗi ancestor | REQ-2 | AC-1, AC-4 |
| N3 scroll ngang | REQ-4 | AC-5 |
| N4 ẩn lv1 / hiện mượt / nền tối giản | REQ-2 | AC-1, AC-7 |
| N5 close semantics cũ | REQ-3, REQ-5 | AC-3, AC-6 |
| N6 page lookup reset | REQ-1 | AC-2 |
| Intent risk: aria-modal stacking (a11y) | REQ-2 rules, NFR-4 | AC-9 |
| Intent N3/N4 edge: label dài | REQ-2 alt, REQ-4 | AC-10 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1. sheet lv1, breadcrumb ẩn | REQ-2 |
| 2. nested lookup → lv2 + breadcrumb | REQ-1, REQ-2 |
| 3. drill lvN + scroll ngang | REQ-1, REQ-4 |
| 4. tap crumb i → về level i | REQ-3 |
| 5. page lookup → reset | REQ-1 |

## Boundaries

- Always: reuse `closeFromLevel`; token/i18n cho mọi style + text; `setOptions` path cho trail sync (không thêm mount API mới nếu `setOptions` đủ — extend Pick keys); unit test cho sheet-mode stack trong `webTextDictionaryController.test.ts`.
- Ask first: đổi semantics `Sheet`/`Breadcrumb` atom ảnh hưởng consumer khác (SubtitleManager, card creator) — chỉ additive props.
- Never: depth cap mới; persist trail; thay desktop popup behavior; hardcode màu ngoài token.

## Success Criteria

- [ ] AC-1: Sheet mode, nested lookup tạo level mới; breadcrumb strip chỉ render khi depth ≥2, đứng yên ở đỉnh sheet (không cuốn theo content scroll), nền khác `--color-surface-popover` bằng token, i18n aria-label.
- [ ] AC-2: Page lookup khi stack sâu >1 → prune về level 0, strip ẩn.
- [ ] AC-3: Tap crumb i → levels > i destroy (highlight cleared, mount unmounted), level i lộ ra có sẵn result cũ, strip còn i+1 mục; focus về level i.
- [ ] AC-4: Crumb label = term user đã lookup; crumb cuối current + `aria-current`, non-interactive; crumb thường là `<button>` hit ≥44px.
- [ ] AC-5: Strip `overflow-x` auto; swipe ngang scroll; wheel deltaY → scrollLeft; crumb mới auto vào view.
- [ ] AC-6: Escape / handle click / content drag-dismiss chỉ đóng top level; stack rỗng → `resumeVideo` + `resetVideoPlaying` đúng 1 lần.
- [ ] AC-7: Strip enter cùng sheet slide-up; khi depth về 1 strip không còn render (ẩn hoàn toàn).
- [ ] AC-8: Desktop popup (`innerWidth ≥ 600`) không đổi behavior; các nested-stack test hiện hữu vẫn pass.
- [ ] AC-9: Chỉ top sheet giữ `aria-modal="true"`; non-top sheet `inert` (không focusable/không trong a11y tree).
- [ ] AC-10: Crumb label dài truncate bằng ellipsis (`max-width` token), không chiếm trọn strip; strip vẫn scroll được.

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] Sheet-mode stack + trail sync có unit test (jsdom ép `innerWidth`)
- [ ] Real-Chrome verify: chain above → used → crumb back; screenshot trước/sau
- [ ] `docs/2-architechture-system.md` cập nhật phần popup stack

## Open Questions / Accepted Risks

- Parent sheet cao hơn child sau resize → vùng lộ tap vào prune child (invisible affordance) — accept, khớp desktop.
- Deep chain giữ N DOM — accept, không cap (khớp test hiện hữu).
- Destroy không exit animation — accept.
- Viewport cross `POPUP_SHEET_BREAKPOINT_PX` giữa chừng (resize/orientation): `usePopupPosition` re-tính `isSheet` theo resize nên level hiện hữu morph thành anchored popup, nhưng mount-time flag (`dismissOnOutsideClick`) và `isSheetMode()` của lifecycle vẫn theo width lúc lookup — stack vẫn đúng về logic, chỉ flag dismiss hơi lệch. Accept: edge hiếm, behavior vẫn an toàn (page lookup reset chain).
