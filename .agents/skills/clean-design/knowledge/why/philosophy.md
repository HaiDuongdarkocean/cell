# Philosophy — WHY đằng sau mọi quyết định

> File này thay thế `docs/design-system/DESIGN_RATIONALE.md` (đã xóa). Một token hay component chỉ được tồn tại khi trỏ được vào một dòng ở đây.
> Xung đột tài liệu: **file này thắng ở tầng nguyên lý**, `tokens.json` thắng ở tầng giá trị.

## Quiet confidence — bản sắc

Tihoka hướng đến **quiet confidence**: điềm đạm, tập trung, dễ học, thanh lịch, có hứng thú.

| # | Nguyên tắc | Vì sao |
|---|---|---|
| Q1 | **Neutral-first, single accent as punctuation** | Figure-ground rõ = fluency (T1); accent hiếm mới nổi (T2) |
| Q2 | **Surface lift tạo hierarchy** | Lightness ladder > màu sắc cho cảm giác order (T6) |
| Q3 | **Content-first** | Tihoka sống trên video/phụ đề người khác — chú ý thuộc nội dung, không phải chrome |
| Q4 | **Clarity through restraint** | Ít variant = ít quyết định = fluent hơn; giảm alarm fatigue (T7) |
| Q5 | **Accessible by default (WCAG 2.2 AA)** | Persona 5–80 tuổi, thiết bị low-spec, host bất kỳ |
| Q6 | **Responsive, không re-layout** | Layout đổi khi resize = schema mới = mất fluency đã học |

**Câu chuyện gốc (palette từ thiên nhiên):** bầu trời xanh → primary; tán lá → success; sỏi xám → neutral canvas; đất/nắng → warning; **nước trong suốt = triết lý ý định, KHÔNG phải vật liệu** — Liquid Glass đã loại 2026-09-08 (blur tốn GPU, kém stable trong MV3 Shadow DOM, nhiễu fluency). Cấm `--color-glass-*`, `--color-liquid-*`, `backdrop-filter`.

## Ngữ cảnh người dùng (khác app thường)

1. **5–80 tuổi** → target ≥40/44px, text dễ đọc, không giấu nghĩa trong màu (T8).
2. **UI trên host bất kỳ** (YouTube, Netflix) → mọi surface tự đủ contrast + viền/bóng giám định, không vay nền host.
3. **RAM ≥1GB, low-spec** → cấm hiệu ứng tốn GPU.
4. **Phụ đề + từ vựng là figure** — mọi thứ khác là ground. Luật này tồn tại trước và sau mọi redesign.

## Định lý bất biến (spacing)

> Spacing = quan hệ. Proximity là cơ chế hierarchy đầu tiên — phân tầng bằng khoảng trắng trước, viền/màu/trang trí sau.
> Ladder: `atom-internal < component-internal < same-group < between-groups < section < page frame`.
> (T6 Gestalt + L-CANVAS + L-BORDER.) Chi tiết áp dụng: `foundations/spacing.md`.

## Tháp lý thuyết — T-laws

Mỗi viên gạch: phát biểu → nguồn → hệ quả. Chỉ nguồn peer-reviewed/chuẩn chính thức; folklore ghi nhãn.

### T1 — Processing Fluency: đẹp = chi phí xử lý thấp — HIGH
Reber, Schwarz & Winkielman (2004). Não chấm đẹp theo **trải nghiệm xử lý**: figure-ground cao, symmetry, prototypicality, ít nhiễu → thẩm mỹ tích cực. Hệ quả: canvas trung tính tối đa hóa figure-ground (L-CANVAS); mỗi surface "có màu" không cần thiết là thuế xử lý; prototype quen thuộc = fluency miễn phí.

### T2 — Preference / Harmony / Figural Contrast — HIGH
Schloss & Palmer (2011). Harmony tăng theo độ giống hue; pair preference phụ thuộc **lightness contrast**; figural preference phụ thuộc **contrast figure↔ground**. Hệ quả: nền và accent giống hue → accent không nổi (bệnh dark mode cũ); hierarchy theo lightness ladder; accent pop = màu duy nhất của hue đó (L-SCARCITY).

### T3 — Ecological Valence: nghĩa màu = liên tưởng đã học — HIGH
Palmer & Schloss (2010). Đỏ=máu/cấm/lỗi → `error|destructive`; xanh lá=cây/được phép → `success`; vàng=cảnh báo → `warning`; xanh dương=bầu trời/nước → `primary|info`. Đảo binding = xung đột liên tưởng sẵn có = sai sót vận hành → **cấm**. Luôn kèm icon/text (văn hóa khác nhau + mù màu).

### T4 — Display polarity & dark mode — HIGH
Wang et al. (2021); Applied Ergonomics (2022); CHI 2023. Ban đêm: dark giảm mỏi mắt, contrast cao càng tốt; light-text-on-dark chịu halation → khó đọc dài; preference theo thói quen. Hệ quả: dark mode = tính năng chăm sóc mắt, canvas trung tính contrast cao; mirror host prototype (L-HOST); text dark ≥400 body, ≥500 control (halation nuốt nét mỏng).

### T5 — Context-color congruence — MEDIUM
Hue lạnh (xanh) → trust/calm trong education/healthcare; hue nóng lệch ngữ cảnh → tension/alarm. Hệ quả: accent họ lạnh đúng ngữ cảnh học tập; preset warmth là ngoại lệ có kiểm soát (chỉ accent ấm, canvas vẫn trung tính); không đặt warning/error làm màu chủ đạo.

### T6 — Gestalt primitives — HIGH
Proximity, Similarity, Common Region, Figure/Ground, Continuity. Hệ quả: grouping bằng **proximity + common region trước**, màu là công cụ thứ ba; similarity-màu chỉ cho cùng loại thông tin (vd `token-freq-*`); lạm dụng = tín hiệu giả.

### T7 — Signal economics / alarm fatigue — MEDIUM-HIGH
Mỗi cảnh báo tiêu cho việc không đáng → giá trị warning của cả hệ thống giảm. Hệ quả: cấm warning/error/destructive để decorate/thu hút chú ý; đỏ phản ánh hệ quả vận hành thật (Consequence Triad → `method/behavior.md`).

### T8 — WCAG 2.2 AA — NORMATIVE
Contrast 4.5:1 text / 3:1 large & non-text; màu không phải kênh duy nhất (icon+text); focus visible; reduced motion; target 40/44px; zoom 200% không vỡ.

### T9 — Folklore bị bác (không ai được nhập thành luật)
- "60-30-10 là khoa học" — folklore nội thất; tinh thần accent-hiếm đúng (T2), con số không.
- "Màu X = cảm xúc Y" — quá giản lược, chỉ đúng kèm ngữ cảnh (T5) + liên tưởng (T3).
- "Dark mode luôn tốt cho mắt" — chỉ môi trường tối; kém cho đọc dài và môi trường sáng (T4).

## L-laws — luật token

Khung mỗi luật: Tồn tại vì → Dùng khi → Không dùng khi → Căn cứ.

### L-CANVAS — `background / surface / border` và ladder
**Vì:** figure-ground là biến số 1 của fluency (T1) và hierarchy (T2). Canvas tồn tại để vô hình.
1. Canvas trung tính (achromatic hoặc tint ≤ ngưỡng nhận thức); dark = charcoal trung tính, KHÔNG nhuộm hue accent.
2. Hierarchy = lightness ladder `background → surface → surface-hover → surface-elevated`, không trộn accent vào surface.
3. Hai surface kề nhau không bao giờ cùng giá trị.
4. Border chỉ hairline; phân tầng được bằng khoảng trống thì dùng khoảng trống.
**Căn cứ:** T1+T2+T4.

### L-BORDER — viền là tín hiệu, không ranh giới mặc định
**Vì:** hairline quanh mọi component là dữ liệu thị giác thừa (fluency tax) + đánh cắp vai trò ladder. Fill tương phản là boundary hợp lệ (WCAG 1.4.11 không bắt buộc stroke).
1. Component mặc định **không viền** — phân tầng bằng ladder + spacing + shadow-chỉ-cho-floating.
2. Border chỉ khi **mang thông tin**: variant `outline` · state (focus/error/success/selected/checked) · affordance vật lý (drag/kbd/thumb/drop-zone) · separator cấu trúc (`--color-divider`, KHÔNG `border-subtle` — nó biến mất trên elevated surface) · `prefers-contrast: more`/`forced-colors`.
3. Bỏ viền không được reflow: giữ border-width + transparent, hoặc box-shadow/outline cho ring.
4. Control trong card dùng `--color-field` (resting inset thấp nhất).
**Căn cứ:** T1+T2+T6+T8.

### L-SCARCITY — `primary` family
**Vì:** accent chỉ hoạt động khi là figural anomaly (T2).
1. Tối đa **1 primary action mỗi view** — còn lại secondary/outline/ghost/link.
2. `primary-subtle` chỉ cho selected/active + nền rất nhỏ.
3. Accent không bao giờ là canvas.
4. Accent tự đạt WCAG trên nền Tihoka, không dựa nền host.
5. Preset (dawn/forest/ocean/warmth) chỉ đổi accent family + text hue — canvas không đổi.
**Căn cứ:** T1+T2+T5.

### L-STATUS — `success / warning / error / destructive / info`
**Vì:** liên tưởng đã học (T3) truyền nghĩa không cần chữ — miễn mỗi màu giữ đúng một nghĩa (T7).

| Token | Nghĩa vĩnh viễn | Đúng | Sai |
|---|---|---|---|
| `error` | Đã hỏng / fail | Validation lỗi, mạng rớt | "Quan trọng", "hot" |
| `destructive`(=error) | **Không hoàn tác** / mất dữ liệu | Xóa vĩnh viễn, reset | Đăng xuất, ẩn item |
| `warning` | Rủi ro cứu được | Sắp hết hạn | Lỗi đã xảy ra (=error) |
| `success` | Hoàn thành / tốt | Đã lưu, đồng bộ | "Nút nhìn vui" |
| `info`(=primary) | Thông tin trung lập | Tip, notice | Bất kỳ ngữ nghĩa cảnh báo |

Kèm icon+text (T8); không tạo màu status thứ 5; chỉ `-subtle`/`-muted`/`on-*` được phép.
**Căn cứ:** T3+T7+T8.

### L-TINTS — `color-tint-*` (9 nhóm: background/border/icon/text)
**Vì:** mã hóa **danh mục** (loại từ, tag, phân loại) bằng similarity-Gestalt (T6).
1. Tint = category, **không** = status (đỏ trong tint-red chỉ là tên phân loại).
2. Chỉ quy mô nhỏ (chip/tag/icon) — không làm surface panel/card.
**Căn cứ:** T6+T7.

### L-TEXT — `text / text-secondary / text-tertiary / text-inverse / text-accent`
**Vì:** attention hierarchy = contrast với nền; 3 bậc đủ: phát biểu → chú thích → phụ đề.
1. `text` = phải đọc; `text-secondary` = metadata; `text-tertiary` = placeholder/disabled (không đạt AA — cố ý).
2. `text-accent` chỉ link/inline accent trên nền trung tính.
3. Dark giữ ladder y hệt — ladder là nghĩa, không phải giá trị.
**Căn cứ:** T1+T8.

### L-DOMAIN — `token-freq-*`, `token-status-*`, `data-categorical-*`, `syntax-*`
**Vì:** hệ mã riêng của domain học ngôn ngữ.
1. Không dùng lẫn vào chrome/UI chung (không `token-freq-*` cho badge "vì đẹp").
2. Encoding ổn định theo thời gian — user đã học thuộc.
3. Đổi encoding = breaking change → `ops/lifecycle.md` + migration note.
**Căn cứ:** T1+T6.

### L-HOST — theme mode & host prototype
**Vì:** sống trong video người khác, ban đêm, low-spec (T4).
1. Light/dark đẳng cấu: cùng canvas trung tính + accent khan hiếm — chỉ đổi bước sáng.
2. Canvas dark = palette trung tính prototype host (`#0F0F0F/#212121/#272727/#303030/#F1F1F1/#AAAAAA`) — user đã thích ứng YouTube dark.
3. Contrast ban đêm cao — không "xám trên xám vì sang".
4. Text dark không gầy: body ≥400, control ≥500 (halation).
**Căn cứ:** T4+T1.

## Evidence map

| Luật | Nguồn | Authority |
|---|---|---|
| L-CANVAS | T1 Reber 2004; T2 Schloss & Palmer 2011; T4 Wang 2021 | HIGH |
| L-SCARCITY | T2; T1 | HIGH |
| L-STATUS | T3; T7; T8 | HIGH/MED-HIGH/NORMATIVE |
| L-TINTS | T6; T7 | HIGH/MED-HIGH |
| L-HOST | T4; T1 | HIGH |
| Consequence Triad | T7 + practice — cho phép refine bằng user test | MEDIUM |

## Gate trước khi merge — trả lời 3 câu

1. Token/component này ở **layer nào** (canvas/accent/status/tint/domain)?
2. Variant này theo **consequence** nào (`method/behavior.md`)?
3. Có vi phạm L-CANVAS / L-SCARCITY / L-STATUS không?

Không trả lời được = chưa có cơ sở → đọc lại file này.
