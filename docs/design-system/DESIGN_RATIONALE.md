# Cell DESIGN RATIONALE — Cơ sở cảm hứng & lý thuyết quyết định

> **Vai trò của tài liệu này:** trả lời câu hỏi **"VÌ SAO"** đằng sau mọi token, component và quyết định UI của Cell.
> Một token hay component chỉ được phép tồn tại khi có thể trỏ vào một dòng trong tài liệu này.
>
> **Tháp tài liệu design system:**
>
> | Tầng | Tài liệu | Trả lời câu hỏi |
> |---|---|---|
> | 1 — WHY (tài liệu này) | `docs/design-system/DESIGN_RATIONALE.md` | Vì sao token/component này tồn tại? Vì sao dùng cái này mà không dùng cái kia? |
> | 2 — WHAT/HOW | `src/shared/styles/STANDARD.md` | Token gồm những gì, đặt tên thế nào, dùng khi nào ở mức kỹ thuật |
> | 3 — CHECKLIST | `docs/design-system/DESIGN.md` | Agent/dev phải làm gì trước khi coi một UI task là xong |
> | 4 — VALUES | `src/shared/styles/tokens.json` → `tokens.css` | Giá trị con số cụ thể (SSOT) |
>
> Nếu tài liệu này và tài liệu khác xung đột: **tài liệu này thắng ở tầng nguyên lý**, `tokens.json` thắng ở tầng giá trị.
>
> Ngày thành lập: 2026-09-08. Supersede Liquid Glass concept (đã xóa `liquid-glass-concept.md` / `liquid-glass-critique.md`).

---

## PHẦN I — NGUỒN GỐC CẢM HỨNG: THIÊN NHIÊN & QUIET CONFIDENCE

### 1.1 Câu chuyện gốc

Cell được sinh ra từ câu chuyện của tác giả (Dương — Hải Dương, Thái Dương): tình yêu thiên nhiên — những tán lá đung đưa theo gió, dòng nước yên bình nhưng mọi thứ đều cần nước để tồn tại, nước phản ánh bản tâm và thế giới; những viên sỏi nằm im nhưng chứng tỏ giá trị của sự nằm im; bầu trời xanh nhẹ nhàng. (Nguồn: `docs/design-system/ROADMAP.md` §2.1.)

**Hệ quả thẩm mỹ trực tiếp:** palette của Cell lấy từ thiên nhiên:

| Hình tượng | Vai trò trong hệ | Cơ sở lý thuyết (Phần II) |
|---|---|---|
| Bầu trời xanh | Primary accent (`--color-primary`) | Hue lạnh → tin cậy/bình yên, hợp ngữ cảnh học tập (T5) |
| Tán lá xanh | Success (`--color-success`, leaf) | Liên tưởng sinh trưởng/hoàn thành (T3) |
| Sỏi xám | Neutral canvas & secondary text | "Nằm im mà quan trọng" = nền trung tính không cạnh tranh chú ý (T1) |
| Đất nâu / vàng nắng | Warning (`--color-warning`, earth/sun) | Liên tưởng cảnh báo tự nhiên (T3) |
| Nước trong suốt | Triết lý: trong suốt về ý định, UI không che nội dung | **KHÔNG phải** vật liệu glass/blur — đã loại |

> ⚠️ **Nước ≠ Glass.** Liquid Glass từng biến "nước trong suốt" thành vật liệu blur/translucency. Quyết định 2026-09-08 loại bỏ vật liệu đó (blur tốn GPU, kém stable trong MV3 Shadow DOM, và gây nhiễu fluency). "Trong suốt" chỉ còn là **triết lý ý định**: UI không che giấu giá của nó, giới hạn của nó, hay hành động của nó.

### 1.2 Quiet confidence — bản sắc vận hành

Cell hướng đến **quiet confidence**: điềm đạm, tập trung, dễ học, thanh lịch, có hứng thú. Sáu nguyên tắc gốc (giữ nguyên từ `STANDARD.md`, nay kèm cơ sở lý thuyết):

| # | Nguyên tắc | Vì sao (cơ sở) |
|---|---|---|
| Q1 | **Neutral-first, single accent as punctuation** | Processing fluency cần figure-ground rõ (T1); accent hiếm mới nổi (T2) |
| Q2 | **Surface lift tạo hierarchy** | Độ sáng/phân tầng quan trọng hơn màu sắc cho cảm giác order (T6) |
| Q3 | **Content-first** | Cell sống trên video/phụ đề của người khác — chú ý thuộc về nội dung, không phải chrome của mình (fluency: giảm nhiễu cạnh tranh) |
| Q4 | **Clarity through restraint** | Ít variant hơn = ít quyết định phải xử lý hơn = fluent hơn; đồng thời giảm alarm fatigue ở cấp status (T7) |
| Q5 | **Accessible by default (WCAG 2.2 AA)** | Cell phục vụ người học 5–80 tuổi, thiết bị low-spec, nền host bất kỳ |
| Q6 | **Responsive, không re-layout** | Layout đổi khi resize = thay đổi schema = mất fluency đã học được |

### 1.3 Ngữ cảnh người dùng — điều khác biệt so với app thường

1. **Người học 5–80 tuổi** → non-negotiable: target touch ≥40/44px, text dễ đọc, không ẩn ý nghĩa trong màu (thêm icon/text — T8).
2. **UI nằm trên host bất kỳ** (YouTube, Netflix, các trang stream) → Cell không kiểm soát nền → mọi surface Cell phải **tự đủ contrast** và có viền/bóng giám định, không vay mượn nền host.
3. **Thiết bị low-spec (RAM ≥1GB)** → cấm hiệu ứng tốn GPU làm xấu trải nghiệm đọc. Đây là lý do thực tế cuối cùng để loại glass/blur.
4. **Ngữ cảnh học ngôn ngữ qua việc xem** → phụ đề và từ vựng là figure; mọi thứ khác là ground. Quy tắc này ra đời trước và sẽ ra đời sau mọi đợt redesign.

---

## PHẦN II — THÁP LÝ THUYẾT (có bằng chứng, xếp theo mức độ tin cậy)

Mỗi viên gạch: phát biểu → nguồn → hệ quả thiết kế trực tiếp. Chỉ dùng nguồn peer-reviewed hoặc chuẩn chính thức; folklore bị ghi nhãn rõ.

### T1 — Processing Fluency: vẻ đẹp = chi phí xử lý thấp — `authority: HIGH`

> Reber, Schwarz & Winkielman (2004), *"Processing Fluency and Aesthetic Pleasure: Is Beauty in the Perceiver's Processing Experience?"*, Personality and Social Psychology Review. (~9.000 citations.)

**Phát biểu:** Não người chấm "đẹp" không phải theo thuộc tính của đối tượng mà theo **trải nghiệm xử lý** nó: càng dễ xử lý thị giác → phản ứng thẩm mỹ càng tích cực. Các biến tăng fluency: figure-ground contrast cao, symmetry, figural goodness, prototypicality (giống cái đã quen), ít nhiễu.

**Hệ quả cho Cell:**
- Nền trung tính tối đa hóa figure-ground → **luật canvas trung tính (L-CANVAS, Phần III)**.
- Mỗi surface "có màu" không cần thiết là một khoản thuế xử lý → restraint trong Q1/Q4 không phải khẩu vị, là giải phẫu.
- Prototype quen thuộc (dark mode giống YouTube) = fluency miễn phí vì user đã thích ứng.

### T2 — Phân biệt Preference / Harmony / Figural Contrast — `authority: HIGH`

> Schloss & Palmer (2011), *"Aesthetic response to color combinations: preference, harmony, and similarity"*, Atten Percept Psychophys (Berkeley Color Project).

**Phát biểu:** Ba phán đoán thường bị trộn:
1. **Harmony** (cặp màu có "hợp" không): tăng theo *độ giống hue*.
2. **Pair preference** (có thích cả cặp không): phụ thuộc mạnh vào **lightness contrast** hơn là hue.
3. **Figural preference** (màu của hình nổi trên nền): tăng theo **hue/giá trị contrast giữa figure và ground**.

**Hệ quả cho Cell:**
- Nền và accent *giống hue* thì "hài hòa" nhưng accent **không thể nổi** → đây chính xác là bệnh của dark mode cũ (canvas nhuộm accent = accent mất figural contrast). Audit 2026-09-08 xác nhận.
- Hierarchy dựa vào **lightness ladder** (bậc sáng), không dựa vào hue → luật L-LADDER.
- Accent muốn "pop" phải là **màu duy nhất của hue đó trên màn hình** → luật khan hiếm L-SCARCITY.

### T3 — Ecological Valence: ý nghĩa màu là liên tưởng đã học — `authority: HIGH`

> Palmer & Schloss (2010), *"An ecological valence theory of human color preference"*, PNAS.

**Phát biểu:** Con người thích/ngầm hiểu một màu theo những **vật thể họ từng gặp mang màu đó**. Ý nghĩa status trong UI vì thế không do "quy luật vũ trụ" mà do liên tưởng văn hóa–trải nghiệm được chia sẻ rộng:

| Màu | Liên tưởng phổ cập | Binding trong Cell |
|---|---|---|
| Đỏ | Máu, lửa, biển báo cấm, lỗi | `error` / `destructive` — chỉ gắn với nguy hiểm/rủi ro thật (L-STATUS) |
| Xanh lá | Thực vật, đèn xanh, "được phép" | `success` — hoàn thành, an toàn, tích cực |
| Vàng/hổ phách | Ánh nắng chói, biển cảnh báo | `warning` — cần chú ý, còn cứu được |
| Xanh dương | Bầu trời, nước | `primary`/`info` — bình yên, tin cậy (hợp ngữ cảnh học tập — T5) |

**Hệ quả:** đảo màu status (xanh lá cho destructive, đỏ cho success) sẽ **xung đột với liên tưởng sẵn có của user** và gây sai sót vận hành. Cấm. Tuy nhiên phải kèm icon/text (T8) vì liên tưởng màu khác nhau giữa văn hóa và người mù màu.

### T4 — Display polarity & dark mode — `authority: HIGH`

> Wang et al. (2021), IEEE Access (eye-tracking, mỏi thị giác theo mode × luminance contrast); "Dark mode vogue" (2022), Applied Ergonomics; CHI 2023 (halation, reading speed light vs dark).

**Phát biểu:**
1. Ban đêm/môi trường tối: dark mode **giảm mỏi mắt**; luminance contrast text–nền càng cao càng ít mỏi và càng được ưa thích.
2. Light text trên dark chịu **halation** (chữ bị lan sáng) → khó đọc đoạn dài hơn light mode; dark mode là lựa chọn cảm giác/thẩm mỹ, không phải lựa chọn đọc nhanh.
3. Preference bị chi phối bởi **thói quen** — người dùng thích cái họ đã thích ứng.

**Hệ quả cho Cell:**
- Dark mode Cell tồn tại vì môi trường xem video vào ban đêm — nó là tính năng chăm sóc mắt, không phải sân khấu branding → **canvas dark phải trung tính, contrast cao, tối giản**.
- Cell sống trên YouTube: user đã thích ứng fluently với palette dark của YouTube → **mirror host prototype** (L-HOST): `#0F0F0F / #212121 / #272727 / #303030 / #F1F1F1 / #AAAAAA`.
- Text dark mode không được gầy (hairline) — halation nuốt nét mỏng; dùng weight ≥400 cho body, 500 cho control.

### T5 — Context-color congruence — `authority: MEDIUM`

> Colour psychology in UI/UX (2026), *The Design Journal*: hue lạnh (xanh/xanh lá) tạo trust/calm/comfort trong ngữ cảnh healthcare/finance/education; hue nóng (đỏ/cam) lệch ngữ cảnh gây tension/alarm.

**Hệ quả cho Cell:**
- Cell là công cụ học → accent họ lạnh (dawn/forest/ocean) là đúng ngữ cảnh; preset warmth là ngoại lệ **có kiểm soát**: chỉ ấm ở accent, canvas vẫn trung tính để không biến cả màn hình thành "cảnh báo".
- Cũng là lý do không đặt warning/error làm màu chủ đạo dù một số app "nổi bật".

### T6 — Gestalt primitives — `authority: HIGH (established từ 1912+)`

Proximity (khoảng cách), Similarity (giống nhau hình – màu), Common Region (khung bao), Figure/Ground, Continuity.

**Hệ quả cho Cell:**
- Grouping bằng **proximity + common region trước** (spacing, card), màu chỉ là công cụ thứ ba → spacing và container phải làm tốt trước khi ai đó "gắn màu cho tách nhóm".
- Similarity bằng màu chỉ dành cho *cùng một loại thông tin* (ví dụ tất cả token tần suất dùng bộ `token-freq-*`); lạm dụng similarity-màu = tạo tín hiệu giả.

### T7 — Signal economics / alarm fatigue — `authority: MEDIUM-HIGH`

> Khái niệm alarm fatigue đã được chứng minh trong y tế và hệ thống cảnh báo; tổng quát hóa vào UI: **mỗi lần tiêu tốn một tín hiệu cảnh báo cho việc không đáng, giá trị warning của cả hệ thống giảm.**

**Hệ quả cho Cell:**
- Cấm dùng `warning`/`error`/destructive để decorate hoặc "thu hút chú ý".
- Hành động chỉnh-sửa thường không được mượn sự chú ý của đỏ. Đỏ phản ánh hệ quả vận hành thật: không thể hoàn tác, mất dữ liệu, nguy hiểm. (Xem L-SEVERITY, Phần IV — đây là lý do nút thùng rác phải đỏ.)

### T8 — Chuẩn bắt buộc: WCAG 2.2 AA — `authority: NORMATIVE`

- Contrast: normal text 4.5:1; large text 3:1; non-text/focus 3:1.
- Màu không bao giờ là kênh thông tin duy nhất (icon + label).
- Focus visible, reduced motion, touch target 40/44px, zoom 200% không vỡ layout.

### T9 — Folklore bị bác (ghi rõ để không ai nhập thành LUẬT)

| Câu | Trạng thái |
|---|---|
| "Quy tắc 60-30-10 là khoa học" | Folklore trang trí nội thất. Tinh thần (accent hiếm) được T2 ủng hộ; con số 60/30/10 **không** có bằng chứng. Không viết con số này vào token policy. |
| "Màu X = cảm xúc Y (blue = trust...)" | Quá giản lược. Đúng chỉ khi kèm ngữ cảnh (T5) và liên tưởng đã học (T3). |
| "Dark mode luôn tốt hơn cho mắt" | Sai. Tốt cho môi trường tối; kém cho môi trường sáng và cho đọc dài (T4). |

---

## PHẦN III — LUẬT TOKEN: VÌ SAO NÓ TỒN TẠI VÀ KHI NÀO ĐƯỢC DÙNG

Mỗi nhóm token trình bày theo khung: **Tồn tại vì → Dùng khi → Không dùng khi → Căn cứ**. Tên token chuẩn nằm ở `STANDARD.md` §3; giá trị ở `tokens.json`.

### L-CANVAS — Canvas layer: `background`, `surface`, `border` và ladder

**Tồn tại vì:** figure-ground là biến số số 1 của fluency (T1) và hierarchy (T2). Canvas tồn tại để *vô hình* — nó là "sỏi xám nằm im" của bản sắc.

**Luật:**
1. Canvas **trung tính** (achromatic hoặc tint ≤ ngưỡng nhận thức). Light: near-white. Dark: charcoal trung tính — KHÔNG nhuộm hue accent.
2. Hierarchy đi bằng **lightness ladder** (bậc sáng), không bằng trộn accent vào surface:
   `background → surface → surface-hover → surface-elevated(popover)`.
3. Hai surface kề nhau không bao giờ cùng giá trị (hierarchy = phân biệt — T6 Common Region).
4. `border` chỉ bằng hairline; khi có thể phân tầng bằng khoảng trống thì dùng khoảng trống (T6 proximity trước màu).

**Dùng khi:** mọi khung nền của trang, panel, card, popover.

**Không dùng khi:** muốn "cho vui", "cho có màu", "bắt eye" — đó không phải công việc của canvas, là công việc của accent (và accent làm rất ít).

**Vi phạm đã audit (đang chờ sửa):** dark mode hiện nhuộm accent vào canvas ở cả preset core (`dawn` dark background `#0F202E` = `color-primary-100`) lẫn derived (`color-mix(primary 3–6%)` vào background-elevated/muted, surface-elevated/hover/pressed). Hướng sửa: canvas dark dùng chung palette trung tính kiểu YouTube (L-HOST).

**Căn cứ:** T1 + T2 + T4. 

### L-BORDER — Viền là tín hiệu, không phải ranh giới mặc định — `thêm 2026-09-08`

**Tồn tại vì:** hairline outline quanh mọi component là một lớp dữ liệu thị giác thừa — não phải xử lý ranh giới của từng khung (fluency tax, T1), và nó đánh cắp vai trò phân tầng của lightness ladder (L-CANVAS mục 4). M3 mặc định dùng **tonal difference** để tách surface; iOS inset-grouped list dùng canvas/cell fill, không outline. WCAG 1.4.11 yêu cầu control có boundary *nhận diện được* — **fill tương phản là boundary hợp lệ**, không bắt buộc stroke.

**Luật:**
1. Component mặc định **không viền**. Phân tầng bằng ladder `background → surface → field → hover → pressed`, spacing (T6 proximity), và shadow **chỉ cho floating** (popover/menu/dialog/drawer).
2. `border` chỉ được tồn tại khi nó **mang thông tin**:
   - **Variant explicit**: `outline` (button/input/chip/badge…).
   - **State**: `focus` (ring/border-focus), `error`, `success`, `selected` (ring), `checked` (fill).
   - **Affordance vật lý**: drag handle, resize grip, drop-zone, kbd key-cap, slider-thumb cutout, avatar edge mask.
   - **Separator cấu trúc**: đường kẻ phân cách giữa vùng/row — `--color-border-subtle` hairline. Separator ≠ khung bao: nó không bao quanh component.
   - **Accessibility mode**: `prefers-contrast: more` / `forced-colors` phải trả boundary cho control.
3. Bỏ viền không được reflow: giữ `border-width` + `transparent`, hoặc dùng `box-shadow`/`outline` cho ring state.
4. Control trong card dùng `--color-field` (text-mix, trung tính, tự đảo theo mode) — nấc "resting inset" thấp nhất sau surface.

**Dùng khi:** mọi component mới; khi review UI thấy `border` không thuộc 5 loại ngoại lệ trên → đổi sang tonal.

**Không dùng khi:** muốn "đóng khung" cho đẹp — đó là dấu hiệu ladder/spacing chưa đủ, sửa lớp màu chứ không thêm nét vẽ.

**Căn cứ:** T1 + T2 + T6 + T8. Spec: `docs/specs/spec-borderless-components.md`.

### L-SCARCITY — Accent layer: `primary` family

**Tồn tại vì:** điểm dấu hiệu (punctuation) của thương hiệu và hướng dẫn hành động. Accent chỉ hoạt động khi nó là **figural anomaly** trên canvas (T2).

**Luật:**
1. Một màn hình có **tối đa một hành động sơ cấp** (primary fill). Mọi thứ khác phải là secondary/outline/ghost/link.
2. `primary-subtle` chỉ cho selected/active state và nền rất nhỏ; không cho vùng lớn.
3. Accent không bao giờ là canvas. (Vòng lặp với L-CANVAS.)
4. Accent trên nền Cell phải tự đạt WCAG; không dựa vào nền host.
5. Preset (dawn/forest/ocean/warmth) chỉ được quyền đổi **accent family + text hue**. Canvas không đổi.

**Dùng khi:** primary action duy nhất của màn hình; link; focus ring; selected state; brand mark.

**Không dùng khi:** decoration; "tô đậm" nội dung; nền panel; hover. (Hover có `surface-hover` — hierarchy chứ không phải nhấn.)

**Căn cứ:** T1 + T2 + T5.

### L-STATUS — Status layer: `success`, `warning`, `error`, `destructive`, `info`

**Tồn tại vì:** liên tưởng đã học của con người (T3) cho phép truyền "đỗ / cẩn thận / nguy hiểm" mà không cần chữ dài — miễn là mỗi màu giữ đúng một nghĩa (T7).

**Luật binding (không đàm phán):**

| Token | Nghĩa vĩnh viễn | Ví dụ đúng | Ví dụ sai |
|---|---|---|---|
| `error` | Đã hỏng / thất bại chức năng | Validation lỗi, mạng rớt, parse fail | "Quan trọng", "hot", giảm giá |
| `destructive` (= `error`) | Hành động **không thể hoàn tác** hoặc mất dữ liệu | Xóa vĩnh viễn, thùng rác, reset profile | Đăng xuất (hoàn tác được bằng đăng nhập), ẩn một item |
| `warning` | Rủi ro có thể cứu / giới hạn sắp tới | Sắp hết hạn, token sẽ mất hiệu lực | Lỗi đã xảy ra (đó là error) |
| `success` | Hoàn thành / trạng thái tốt | Đã lưu, đã đồng bộ | "Nút nhìn vui mắt" |
| `info` (= `primary`) | Thông tin trung lập cần chú ý | Tip, thông báo chức năng | Bất cứ thứ gì có ngữ nghĩa cảnh báo |

1. Màu chỉ kèm với icon + text (T8).
2. Không tạo màu status thứ năm (ví dụ "info-lạnh-hơn"). Hệ chỉ có đủ bốn vai. (Q4 restraint.)
3. Chỉ `-subtle` (nền) / `-muted` (nền trung) / `on-*` (nội dung trên nền status) được phép; không phát minh thêm tỏng.

**Căn cứ:** T3 + T7 + T8.

### L-TINTS — Tint layer: `color-tint-*` (9 nhóm, mỗi nhóm background/border/icon/text)

**Tồn tại vì:** mã hóa **danh mục** (category) — loại từ, phân loại, tag. Tints dùng similarity-Gestalt (T6) để nói "các thứ này cùng nhóm".

**Luật:**
1. Tint chỉ mang nghĩa *category*, **không** mang nghĩa *status*. (Đỏ trong `tint-red` chỉ là tên phân loại; không có nghĩa nguy hiểm. Ý nghĩa nguy hiểm thuộc về `error`/`destructive`.)
2. Tints không tham gia hierarchy nền — luôn ở quy mô nhỏ (chip, tag, icon).
3. Không dùng tint làm surface của panel/card lớn.

**Căn cứ:** T6 + T7 (tránh đục nghĩa status).

### L-TEXT — Text ladder: `text`, `text-secondary`, `text-tertiary`, `text-inverse`, `text-accent`

**Tồn tại vì:** attention hierarchy bằng contrast với nền. Ba bậc đủ cho mọi công việc: phát biểu → chú thích → phụ đề.

**Luật:**
1. `text` cho nội dung người dùng phải đọc. `text-secondary` cho metadata. `text-tertiary` cho placeholder/disabled (và không đạt AA cho text thường — yên tâm, đó là công dụng).
2. `text-accent` chỉ cho link/inline accent trên nền trung tính.
3. Dark mode giữ ladder y hệt — ladder là ý nghĩa, không phải giá trị.

**Căn cứ:** T1 + T8.

### L-DOMAIN — Token miền: `token-freq-*`, `token-status-*`, `data-categorical-*`, `syntax-*`

**Tồn tại vì:** Cell là công cụ học ngôn ngữ; tần suất từ, trạng thái học, loại dữ liệu và mã nguồn là những hệ mã riêng có chính nghĩa trong domain.

**Luật:**
1. Các token miền **không dùng lẫn** vào chrome/UI chung (ví dụ không dùng `token-freq-advanced-bg` cho badge UI vì nó "đẹp").
2. Encoding miền giữ ổn định theo thời gian — user có thể đã học thuộc (bạc hà màu = fluency đã trả giá).
3. Thay đổi encoding miền = breaking change (theo DESIGN.md §10.3) + bắt buộc migration note.

**Căn cứ:** T1 (fluency đã học) + T6.

### L-HOST — Theme mode & host prototype

**Tồn tại vì:** Cell sống **trong** video người khác, ban đêm, trên thiết bị low-spec. Dark mode là chế độ chăm sóc thị giác (T4), không phải phiên bản sáng ngược lại.

**Luật:**
1. Light và dark **đẳng cấu cấu trúc**: cùng luật canvas trung tính + accent khan hiếm. Chỉ đổi bước sáng và giá trị.
2. Canvas dark = palette trung tính theo prototype host (`#0F0F0F / #212121 / #272727 / #303030 / #F1F1F1 / #AAAAAA`) vì user đã thích ứng với YouTube dark (prototype = fluency miễn phí, T1/T4).
3. Contrast ban đêm phải cao (T4) — không chấp nhận "xám trên xám vì sang".
4. Text dark không gầy hơn light: body ≥400, control ≥500 (halation).

**Căn cứ:** T4 + T1.

---

## PHẦN IV — LUẬT COMPONENT: DÙNG CÁI NÀY MÀ KHÔNG DÙNG CÁI KIA

### 4.1 Framework gốc — Consequence Triad

Mọi quyết định "component nào" bắt đầu bằng 3 câu hỏi:

1. **Irreversibility** — Hoàn tác được không? (0 = tự do / 1 = hoàn tác 1 click / 2 = chỉ qua confirm hoặc luồng phục hồi / 3 = vĩnh viễn)
2. **Risk** — Sai thì mất gì? (0 = không gì / 1 = cài đặt / 2 = dữ liệu cá nhân, tiến độ học / 3 = không thể phục hồi)
3. **Necessity of attention** — User buộc phải biết/chặn lại không? (0 = không / 1 = nên biết / 2 = phải biết)

**Luật:** *visual intensity ∝ consequence.* Không bao giờ cho hành động consequence-thấp mượn cường độ của consequence-cao — đó là lạm dụng công văn (T7) và phá scarcity (T2).

| Consequence tổng (max các trục) | Bắt buộc UI tối thiểu |
|---|---|
| 0 | ghost/secondary, không feedback, hoặc feedback tĩnh (icon đổi) |
| 1 | secondary/outline + toast xác nhận |
| 2 | dialog xác nhận + nút có màu tương ứng hậu quả (destructive nếu xóa dữ liệu) |
| 3 | dialog destructive + đòi xác nhận có chủ đích (checkbox/typed) kèm lý do |

### 4.2 Bảng quyết định Button variant (từ `src/shared/ui/Button.tsx`)

| Variant | Tồn tại vì | Dùng khi | Không dùng khi |
|---|---|---|---|
| `primary` | Điểm dấu điều hướng cho hành động có lợi ích cao nhất của màn hình | **Duy nhất một cái mỗi view**. Hành động chính: "Lưu", "Bắt đầu học" | Nút thứ hai trở lên trong view (lạm dụng scarcity) |
| `primarySubtle` | Selected/active tone capital nhưng vẫn giữ scarcity | Selected state trong setting row, filter | Nút hành động lớn bình thường |
| `secondary` | Hành động phụ thường gặp | "Hủy" bên cạnh primary; action trong list | Không phải hành động nào "dễ dùng hơn primary" |
| `outline` | Action tương đối nặng nhưng không destructive | Re-fetch, đổi tên (không mất dữ liệu) | Destructive (đó là đỏ) |
| `ghost` | Action trong không gian dày / chrome | Icon action, toolbar, inline | Hành động chính (sẽ bị nuốt) |
| `link` | Điều hướng, không phải action | "Xem tất cả", link nội bộ | Action đổi state |
| `destructive` | Đỏ = liên tưởng nguy hiểm đã học (T3) — chỉ đáng giá khi nó *là thật* | Xóa vĩnh viễn, thùng rác, reset không phục hồi được | Đăng xuất; ẩn; hủy draft còn đâu nữa |
| `success` | Xác nhận đúng hành động mang ý nghĩa kết thúc tích cực | "Đánh dấu đã biết" (từ vựng known) | Xếp nào cũng như OK |
| `glass` | **DEPRECATED — cấm dùng. (Material layer đã loại 2026-09-08.)** | — | — |

> **Ví dụ chuẩn — thùng rác/xóa:** hành động "xóa vĩnh viễn" có Irreversibility=3 + Risk=2–3 → variant `destructive` + Dialog xác nhận; không phải button thường. Hành động "xóa có thùng rác + restore" Irreversibility=1 → `secondary`/`outline` + toast có nút Undo. Sai ghép đôi ở đây không phải lỗi mỹ thuật — là lỗi kỳ vọng nguy hiểm.

### 4.3 Feedback: Toast vs Alert vs Dialog

| Tình huống | Dùng | Vì sao |
|---|---|---|
| Xác nhận ngắn, không cần user nhớ ("Đã lưu") | **Toast** | Attention necessity = 0; toast biến mất — đúng nghĩa "không cần nhớ" |
| Trạng thái dài trong luồng, user sẽ đọc lại (thiếu phụ đề kèm, profile chưa hoàn thiện) | **Alert** (`default/success/warning/error`) | Persistence cần cho việc phải xử lý sau; tone theo status binding L-STATUS |
| Quyết định hệ quả ≥2, hoặc cần input trước khi hành động | **Dialog** | Chặn luồng = chi phí; chỉ hợp lý khi consequence đòi chi phí đó (4.1) |
| Trạng thái quy trình dài | **Progress** | Không dựng Alert cho việc đang chạy |
| Trạng thái tải nội dung | **Skeleton** | Skeleton duy trì schema layout (T1 fluency) thay vì spinner giữa trang khi nội dung sắp tới |
| List rỗng | **EmptyState** | Không để màn hình trắng — trạng thái rỗng cũng phải tự giải thích |

**Không dùng khi:** Dialog cho thông báo nhỏ (chi phí chặn > giá trị); Toast cho điều phải nhớ; Alert cho transient.

### 4.4 Status display: Badge vs Chip vs StatusDot vs token-freq

| Component | Nghĩa vụ | Dùng khi |
|---|---|---|
| `Badge` (`default/secondary/outline/destructive/success/warning/muted`) | Nhãn trạng thái tĩnh | Trạng thái item trong list |
| `Chip` | Chọn/lọc | Toggle filter, selection nhóm |
| `StatusDot` | Hiện diện cực gọn | Online/đã đồng bộ trên avatar/row có label sẵn |
| `token-freq-*` tokens | Encoding tần suất từ (domain) | Trong từ vựng/phụ đề, không trong chrome UI |

### 4.5 Container & layout hierarchy

- `background → surface → Card → elevated/popover` — không bao giờ Card và parent cùng màu (T6 Common Region).
- `Sheet`/`BottomSheet` cho nhập liệu/cài đặt nhanh từ viewport hẹp; `Dialog` cho quyết định consequence-cao ở giữa. Không dùng Sheet cho destructive confirm (vị trí dưới làm luồng confirmation lỏng).
- `Tooltip` cho diễn giải icon-only; không nhét hướng dẫn dài vào tooltip.

---

## PHẦN V — QUY TRÌNH ÁP DỤNG (cho dev & agent)

### 5.1 Flowchart 5 câu hỏi trước khi chọn màu/component

1. Cái tôi đang build mang **ý nghĩa** gì? (hành động / trạng thái / danh mục / nội dung miền)
2. Nếu là hành động: **consequence triad** cho điểm mấy? (Phần 4.1)
3. Nếu là trạng thái: thuộc hệ **status bốn vai** hay **category tints**? (L-STATUS vs L-TINTS — không được nhầm)
4. Nó có đòi **scarce**? (một primary mỗi màn?) Nếu đã có một primary — tôi phải xuống hạng.
5. Component tôi định dùng đã **tồn tại trong `src/shared/ui/`** chưa? Nếu chưa: dựng ở đó + showcase + test (DESIGN.md §10.2), không ad-hoc.

### 5.2 Gate trước khi merge (3 câu văn)

Trong description mọi UI change, trả lời:
1. Token/component này ở **layer nào** (canvas / accent / status / tint / domain)?
2. Vì sao variant này — theo **consequence** nào?
3. Có vi phạm L-CANVAS / L-SCARCITY / L-STATUS không?

→ Nếu không trả lời được, coi như chưa có cơ sở; quay về Phần III/IV.

---

## PHẦN VI — TRẠNG THÁI DEVIATION (cập nhật 2026-09-08 — ĐÃ HOÀN TẤT)

| # | Vi phạm | Luật | Trạng thái |
|---|---|---|---|
| 1 | Dark canvas nhuộm hue accent: preset `dawn` dark `background #0F202E` = `color-primary-100`, lặp ở forest/ocean/warmth | L-CANVAS | **ĐÃ SỬA** — Đổi canvas dark 4 preset + base về palette charcoal trung tính (`#0F0F0F` / `#212121` / `#303030`) |
| 2 | Derived dark trộn `primary 3–6%` vào background/surface/border | L-CANVAS | **ĐÃ SỬA** — Bỏ toàn bộ `color-mix(primary)` khỏi canvas derived |
| 3 | `primary-subtle` dark alpha 0.15–0.18 vs light 0.10 | L-SCARCITY | **ĐÃ SỬA** — Hạ về 0.12 trên tokens.json, preset derived, runtime `tokens.ts` |
| 4 | Glass/liquid tokens (`--color-glass-*`, `--color-liquid-blob-*`...) (229 keys) | Cấm material glass | **ĐÃ XÓA** — Đã xóa sạch 229 keys khỏi `tokens.json` + tái sinh `tokens.css` |
| 5 | Component props `material='liquid'`, `variant='glass'`, `ButtonGlassFilter.ts` | Cấm material glass | **ĐÃ LOẠI BỎ** — Xóa file filter, migrate toàn bộ Button/Card/Input/Surface sang solid, 0 references trong production code |

---

## PHẦN VII — EVIDENCE MAP (luật → nguồn → độ tin cậy)

| Luật | Nguồn chính | Authority |
|---|---|---|
| L-CANVAS | T1 Reber 2004; T2 Schloss & Palmer 2011; T4 Wang 2021 | HIGH |
| L-SCARCITY | T2; T1 | HIGH |
| L-STATUS | T3 Palmer & Schloss 2010; T7 alarm fatigue; T8 WCAG | HIGH / MED-HIGH / NORMATIVE |
| L-TINTS | T6 Gestalt; T7 | HIGH / MED-HIGH |
| L-HOST | T4 (Wang 2021; Applied Ergonomics 2022; CHI 2023); T1 prototype | HIGH |
| Consequence Triad | T7 + design practice; không có nghiên cứu trực tiếp bám sát — confidence **MEDIUM**, cho phép refine bằng user test | MEDIUM |
| Deviation #1–3 sửa sai | Audit codebase 2026-09-08 (SSOT) — codebase thắng ở quyết định chuyên biệt | HIGH (internal) |

---

## PHẦN VIII — CHANGELOG

| Ngày | Thay đổi |
|---|---|
| 2026-09-08 | Thành lập tài liệu. Loại Liquid Glass khỏi hệ thống (xóa `liquid-glass-concept.md`, `liquid-glass-critique.md`, specs/intents liên quan). Ghi nhận audit dark mode và bắt đầu roadmap sửa L-CANVAS. |
