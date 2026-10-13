# Design Brief — pos-dictionary-variants

## Design Read

Một từ đa-nghĩa là một "cuốn từ điển mini" — POS selector là thẻ phân mục (thumb-index) giúp lật đúng trang, accent toggle là bản ghi phát âm dán trên đầu trang; phần thân giữ nguyên layout hiện tại, chỉ nội dung thay theo variant.

## Inspiration anchor

- **Feeling:** từ điển giấy nhiều mục — lật tab mục từ, trang mới hiện ra nguyên vẹn, không cần học UI mới.
- **Non-digital reference:** dải khắc chỉ mục ở gáy từ điển Oxford/Macmillan bản in — mỗi thẻ là một loại từ, chọn thẻ nào thấy trang đó.
- **Visual ref:** `docs/mockups/pos-dictionary-variants-pos-menu.png` (GoldenDict-style `adjective | verb | noun` bar của Macmillan `.dict-top`) — layout được mượn, **không** mượn nền sáng; mọi màu/surface lấy từ Tihoka theme color tokens của theme hiện tại.

## Primary job

**Xem đúng bộ thông tin của đúng usage (POS) đang tra** — IPA/accent/audio, frequency, status, nghĩa, ảnh — trong một cú chạm, không cuộn, không đoán.

## Context quote

> "ở tiếng anh sẽ có nhiều loại từ cho một target word như present thì có tạm adj, noun, verb -> khác phát âm ipa, frequency khác, phát âm audio, ý nghĩa -> hình ảnh khác."
> "UI là ở đầu trước /IPA/ -> AmE /ˈprezənt/ khi người ta nhấn vào AmE thì sẽ toggle thành BrE /ˈprez(ə)nt/"

→ Quyết định: POS selector luôn nằm **trên cùng popup** (trước headword content), accent label **đứng trước IPA** trong cùng reading row — hai trục độc lập (POS = trang nào, accent = giọng nào trên trang đó).

## Function audit

| Function | Requirement | Status |
|---|---|---|
| Điều hướng POS variant | REQ-6 | **new** — chưa có UI nào |
| Accent toggle AmE/BrE trước IPA | REQ-7 | **new** |
| Variant-scoped swap (IPA/audio/freq/status/senses/inflections/ảnh) | REQ-6 | **new** — hiện render phẳng 1 variant |
| Status pill per-variant | REQ-8 | **change** — pill tồn tại, scope mới |
| Frequency chip per-variant + genre breakdown | REQ-9 | **change** — chip tồn tại, nguồn join mới |
| `other` variant bucket (pos rỗng, cuối list) | SC-14 | **new** |
| Hide selector khi 1 variant | REQ-6 | **new** (fallback quan trọng) |
| Term headword + actions (send/quick-add) | — | reuse CandidateView |
| Toolbar audio/image/translate/links | — | reuse DictionaryToolbar |
| Checkable senses | — | reuse |

## Journey map

Tra từ trong phụ đề → popup mở → (nếu ≥2 POS) thấy selector + variant đầu tiên đã chọn sẵn → muốn nghĩa khác → chạm POS → toàn bộ vùng dưới swap (IPA+accent, status, freq, senses, inflections, ảnh re-query `${term} ${pos}`) → chạm `AmE` để nghe/đọc giọng Anh → tick senses → send to card (prefill theo variant đang chọn).

## Dials

- **Baseline:** DESIGN_VARIANCE 3 · MOTION_INTENSITY 2 · VISUAL_DENSITY 7 — popup đã dense, chỉ thêm 1 hàng điều hướng; motion chỉ là fade ngắn khi swap, tôn trọng `prefers-reduced-motion`.

## Concepts

### Concept A — Chapter links (✅ đã chọn — hướng của Anh)

- **IA mental model:** mỗi POS là một "trang" riêng của cùng entry; bar links là mục lục trang.
- **Visual archetype:** text links `adjective | verb | noun` ngăn bởi `|`, đặt **trên headword** — y nguyên `.dict-top` Macmillan/GoldenDict.
- **Non-digital reference:** mục lục thẻ gáy từ điển giấy.
- **Material / surface:** không thêm surface riêng — links nằm trực tiếp trên `core.dark.surface` của popup, ngăn cách bằng `--color-border-subtle` dưới bar nếu cần.
- **Typography treatment:** link `core.dark.primary`, size `--font-size-sm`, weight `static.font.weights.medium`; selected = `--color-text-primary` + `static.font.weights.semibold`, bỏ underline (đọc như "đang ở trang này").
- **Motion signature:** swap region remount → fade+rise 160ms `--ease-out`; link hover = color shift `--duration-fast`.
- **UX flow:** nhìn bar → chạm link → content swap tức thì; accent label `ame`/`bre` chữ thường, `--color-muted-foreground` (Anh chốt: không dùng primary cho accent label) trước IPA là text button, hover `--color-text-primary` + underline → cycle accent; 1 accent → label tĩnh.
- **UI structure:** `nav > button + " | "`; reading row = `[ame] /ipa/ [🔊] ●●●`.
- **3 dials:** DESIGN_VARIANCE: 3, MOTION_INTENSITY: 2, VISUAL_DENSITY: 8
- **Why it fits:** đúng nguyên văn direction của Anh + mental model người dùng GoldenDict; rẻ nhất về vertical space (1 hàng).
- **Risk:** link nhỏ → cần `min-height: 44px` qua padding block; selected-state chỉ bằng weight/color có thể mờ → kiểm contrast light theme.
- **Audit findings:** | mockup nền sáng | reject | Anh đã chối: dùng theme surface | 

### Concept B — Variant tabs

- **IA mental model:** POS là tab của một "thẻ entry" — tab nào nội dung nấy.
- **Visual archetype:** segmented pill row dưới headword — `[adjective] [verb] [noun]`, selected fill `core.dark.primary` + `--color-text-on-primary`.
- **Non-digital reference:** tab hồ sơ bệnh án / index card.
- **Material / surface:** pill outline `core.dark.border` trên `core.dark.surface`; selected = solid fill (bản chất `--radius-pill`).
- **Typography treatment:** tab label `--font-size-sm` `static.font.weights.semibold` khi on.
- **Motion signature:** fill color transition `--duration-fast`; swap giống A.
- **UX flow:** tab rõ affordance → chạm đổi trang; accent là mini-segment `AmE|BrE` 2 ô trong reading row (tap trực tiếp ô, không cycle).
- **UI structure:** `div[role=tablist] > button[role=tab]`; accent = segmented group 2 button.
- **3 dials:** DESIGN_VARIANCE: 5, MOTION_INTENSITY: 2, VISUAL_DENSITY: 6
- **Why it fits:** touch target lớn nhất (≥44px thật), selected state rõ ràng nhất — tốt cho persona 5–80 tuổi.
- **Risk:** tốn ~48px vertical + chiếm 1 hàng mới; nhiều POS (4–5) phải wrap xấu.
- **Audit findings:** | bar trong scroll vs pin | solve | pin trên headword như A hay dưới headword đều ngoài scroll region |

### Concept C — Meta chip + menu

- **IA mental model:** POS là một *thuộc tính có thể đổi* của headword, không phải navigation.
- **Visual archetype:** chip nhỏ `adjective ⌄` cạnh headword → mở `Menu` liệt kê variants kèm status dot + rank → chọn.
- **Non-digital reference:** nhãn loại từ dán trên thẻ flashcard.
- **Material / surface:** chip outline `core.dark.primary` + `--color-primary-subtle`; menu = Menu surface chuẩn `--radius-md`.
- **Typography treatment:** chip `static.font.sizes.2xs` `static.font.weights.semibold`; menu item body `--font-size-sm`.
- **Motion signature:** menu mount chuẩn của Popover; accent toggle giống A (text button trước IPA).
- **UX flow:** tap chip → menu xổ → chọn variant (nhìn được luôn status từng POS qua dot màu) → swap.
- **UI structure:** `button[aria-haspopup=menu]` + `Menu`; item = status dot + label + `#rank`.
- **3 dials:** DESIGN_VARIANCE: 6, MOTION_INTENSITY: 2, VISUAL_DENSITY: 9
- **Why it fits:** compact nhất — không thêm hàng nào; bonus: liệt kê được status+rank của *tất cả* variants trong một cái nhìn.
- **Risk:** ẩn số variants sau 1 tap — discoverability thấp hơn; người mới không biết từ có nhiều POS.
- **Audit findings:** | selector phải hiện sẵn số POS | reject | trade-off có chủ đích của archetype compact |

## Responsive table

| Breakpoint | Behavior |
|---|---|
| 320 | Links/tabs wrap tối đa 2 hàng, `44px` targets giữ nguyên; accent label không wrap khỏi IPA nhờ `flex-wrap` row |
| 768 | Popup giữ `max-width: 420px` — không giãn; bar giữ 1 hàng cho ≤5 POS |
| 1280+ | Giống 768; hover states hiện (mobile-first đã cover focus/touch) |
| 1920 | Không đổi — popup là overlay fixed-size |

## States (áp cho direction được chọn)

- **default:** variant[0] selected, accent[0] (hoặc accent đã persist), status/freq/senses theo variant
- **hover:** link/tab → `--color-primary-hover` hoặc border accent
- **focus:** `--color-border-focus` outline `static.spacing.0-5` + `--radius-sm`
- **pressed/active:** fill giảm `filter: brightness(0.95)`
- **selected:** A = text-primary + semibold, không underline; B = primary fill; C = `selected` + check trong menu
- **disabled:** n/a (không có variant nào bị khóa); 1-accent → label tĩnh
- **loading:** swap tức thì — không có async lookup lần 2; image strip skeleton tái dùng `Skeleton`
- **empty:** senses rỗng → `EmptyState`-style notice hiện có; 1 variant → ẩn selector
- **error:** image fetch lỗi → giữ error state hiện có của ImagePanel
- **`other` bucket:** label `other` luôn cuối list; `well` demo trong mockup
- **1 variant:** selector ẩn hoàn toàn (`serendipity` demo)

## Anti-patterns avoided

- Không nền sáng riêng / không material mới — surface từ tokens.
- Không align/merge senses xuyên provider — variant gom senses cùng POS.
- Không ẩn senses không-POS — bucket `other`.
- Không dropdown Select cho POS trên A/B — Select là form control, đây là navigation.
- Không hardcode màu trạng thái — dùng `--chip-status-unknown-bg` / `--chip-status-known-bg` family.

## Why the archetypes differ

- **A** trả lời "đang ở trang nào?" — navigation là text (nhẹ, gần gốc từ điển).
- **B** trả lời "đang ở tab nào?" — navigation là control (fill rõ, target lớn).
- **C** trả lời "từ này có những gì?" — navigation là attribute disclosure (compact, giàu meta).

Ba câu trả lời khác nhau về *vai trò của POS trong IA*, không chỉ khác vẻ ngoài.

## Mockup

`src/entrypoints/mockup-pos-dictionary-variants/` — dev URL (showcase server, `npm run design-system:dev`): `http://localhost:5180/src/entrypoints/mockup-pos-dictionary-variants/index.html`

- **Real** = `PopupDictionary` production mount (mock lookup + sendMessage) — baseline hôm nay.
- **A/B/C** = wireframe replica đúng layout `CandidateView` (term → reading → status+freq → toolbar → media → senses checkable), dữ liệu `present` (3 POS) · `well` (3 POS + `other`) · `serendipity` (1 POS → selector ẩn).
- Switcher: concept / entry / viewport (Mobile 380px · Desktop 640px) / theme (Dark · Light).
