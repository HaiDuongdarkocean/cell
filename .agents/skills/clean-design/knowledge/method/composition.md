# Method — Composition rules (page-layout × component)

> Rules cho tầng "components → layouts → pages": phối hợp nhiều component trong cùng surface.
> Mỗi rule = assert đo được. Fail rule = defect, không phải "cảm giác".

## R-STRUCTURE — phân cấp phải nằm trong DOM

> **Proximity chỉ gợi ý nhóm; container mới khai báo nhóm.** Gestalt common region (Palmer 1992; NN/g): phần tử trong cùng boundary được nhận thức là 1 nhóm — mạnh hơn cả proximity và similarity. Khoảng cách 8px giữa 2 items KHÔNG đủ để chúng "thuộc một nhóm" — DOM wrapper (= common region) mới là tuyên bố. Đây là gốc của lỗi "gap đúng mà hierarchy sai": đặt item-gap trên parent sai level.

- **Cây cố định — không nhảy bậc:** `page → section → group → item`. Children của một level chỉ được là node level kế tiếp. `section.body > row` (bare item) = nhảy bậc = defect — kể cả row đơn lẻ, vẫn bọc vào group không label (1-item group) để cây đồng nhất và audit được bằng máy: *"mọi item phải có ancestor `.content`/group"*.
- **Siblings = cùng semantic relationship.** 2 elements ngang hàng trong 1 container tuyên bố "chúng ta cùng vai trò". Items có quan hệ item↔item (gap 8) phải nằm chung `.content`; để lẫn items với blocks trong `.body` = tuyên bố sai quan hệ.
- **Mỗi container sở hữu đúng gap của level nó.** Group = `heading + .content(items)` — KHÔNG flat `[heading, item, item]` rồi vá gap bằng margin hack.
- Tín hiệu cấu trúc sai: phải thêm `margin-block-end`/`first-child` selector để tạo gap khác biệt giữa siblings → DOM thiếu 1 wrapper level. Sửa bằng wrapper, không bằng margin.
- Canonical: `SettingsGroup` = `.group(gap space-3) > .header(h4) + .content(gap space-2) > rows` — heading→items(12) và item↔item(8) tự nhiên khác nhau vì nằm 2 container khác nhau. `SettingsSection .body` = gap `space-6` (24) — chỉ chứa groups/panels (blocks), không chứa bare items. `SettingsPanel` (shared) = sub-surface trong body — `flex column gap space-3` (12), đừng định nghĩa `.panel` local.
- **⚠️ Xóa rule spacing shared = breaking change ngầm:** khi đổi/xóa gap/margin trong `SettingsGroup`/`SettingsSection` (và bất kỳ shared layout), grep `.panel`/container của mọi consumer — panel nào "không khai báo gap vì trông cậy margin shared" sẽ sập về 0. (Case thật: xóa `.group+.group` margin làm AudioPanel/ThemePanel dính nhau — fix bằng `SettingsPanel` gap, và comment CSS kiểu "rely on shared margin" là smell của hợp đồng ẩn.)
- **Audit bằng DOM, không chỉ geometry:** kiểm `parent` của mọi row — nếu `.body`/panel là parent trực tiếp (không có ancestor `role="group"`) → nhảy bậc, fail dù gap đo ra "đúng". Probe: walk ancestors của mọi `[class*=row]` đến `role="group"` — không tới được = bare.
- **Nested panel = ladder hạ 1 bậc:** panel bên trong section body là sub-surface — block↔block trong panel = `space-3` (12, không phải 24); items vẫn 8; coupled pair (tab strip↔tabpanel, label-row↔slider) ≤ 8 — bọc pair vào 1 container (`gap: space-1/space-2`), không để 2 nửa của pair làm siblings bình đẳng. Ví dụ: cặp `SettingsRow(label+value) + Slider` = 1 item → wrap `.pair { gap: space-1 }`.

## R-UNIFORM — cùng register thì cùng geometry

- **Row trong 1 group chia sẻ 1 height.** Row height phải *khai báo* trong spec, không suy ra từ content.
- Content phá uniformity → di chuyển, không nhét vào row:
  - description trong row → `hint` (ⓘ popover) hoặc group `description` — row giữ nguyên height.
  - control cao khác → đổi control hoặc tách sang group khác.
- **Control trong cùng rail (cột phải/trái) chia sẻ 1 height** — lấy từ height ladder (`size-element-lg` = 40 cho settings rail). Segmented `raised` mặc định ~32 → spec phải nâng lên rail height bằng `min-height`.
- **Rail measure có sàn chung:** `min-width` một giá trị cho mọi control trong rail — strip hẹp không được nhỏ hơn strip rộng "nhìn vào". Hug-content chỉ khi rail có đúng 1 loại control.
- **Sibling gap theo role ladder — không flat:** khoảng cách giữa items cùng group = `space-2` (8) edge-to-edge; heading→items = `space-3` (12); group↔group = `space-6` (24); heading↔subheading = `space-1` (4). Dùng **1 số cho mọi cặp khác vai trò** = hierarchy dẹt = defect. **Visible whitespace giữa 2 controls = padding×2 + gap** — spec ghi *visible distance* đo được, không chỉ token gap. Canon đầy đủ: `foundations/spacing.md` "Gap ladder theo vai trò".

```
Assert: ∀ rows in group → same offsetHeight (±0)
Assert: ∀ controls in rail → same height; width ≥ rail floor
Assert: visible gaps theo role ladder — item↔item = 8 · heading→items = 12 · group↔group = 24 · heading↔sub = 4 (đo edge-to-edge)
```

Case gốc: Download settings — row có description = 57px vs row thường 48px; segmented 32px cạnh select 40px; strip [1|2|3|5|10] ~130px cạnh strip ~190px → đọc như 3 control khác loài.

## Đo thay vì nhìn — measurement recipe

Audit composition bằng `getBoundingClientRect`/`computedStyle` trên build thật, không bằng mắt:

```js
// rowGaps giữa các row liền kề — phải chỉ có {within, between}
// ctrl heights/widths trong rail — 1 height, width ≥ floor
// group label computed font — size/weight/color so với row title
// control backgrounds — cùng lightness bucket
```

## R-HEADING-EARN — heading phải trả tiền cho chỗ đứng

Group/section label chỉ tồn tại khi **cả 2** điều kiện:

1. Group có **≥2 items** (1 item → fold label vào row title hoặc section title).
2. Label **thêm nghĩa** mà row titles chưa có (không paraphrase lại row title, không trùng section title).

Label không vượt 2 điều kiện → bỏ label, giữ `SettingsGroup` không label (vẫn còn group gap) hoặc gộp items về group trên.

## R-TYPO-PAIR — 2 text khác vai phải khác ≥2 kênh, heading phải emphatic

Cặp (heading, item) / (title, description) / (label, value) phải phân biệt trên **≥2 trong 3 kênh**: size · weight · color. Cùng size + cùng color = vai trò mơ hồ = defect.

- **Group heading thắng items ≥2 kênh UP:** `md/semibold/primary` (heading-4) trên row `sm/medium/primary` — khác size + weight. Section title `heading-3` (lg/semibold) > group > row. Ladder 18→16→14.
- **Cấm đảo vai trò:** heading nhỏ hơn/nhạt hơn items (vd `xs/secondary` trên `sm` rows) = caption giả heading = defect — user không phân biệt được đâu là đầu nhóm.
- Description/hint: `xs secondary` — subordinate ĐÚNG vai trò (metadata, không dẫn nhóm).
- Semantic: heading render `<Heading>` level+1 so với section, không phải Text label.

## R-COLOR-FAMILY — cùng rail phải cùng fill recipe

- Controls trong cùng rail/panel dùng **1 surface recipe**: input-role controls trên card = `--color-field` family. Trộn `field-solid` (14% mix) với `surface-hover` (~3% tint) trên cùng cột = 2 tone khác loài = defect dù cả hai đều "token đúng".
- Check bằng đo: `computedStyle background` của mọi control trong rail phải cùng lightness bucket (±~5% luminance).
- Selected state dùng canon repo (`primary-subtle` + `accent-strong`, xem variants `accent`/`filled`) hoặc surface-thumb + shadow (HIG `raised`) — **chọn 1 recipe cho cả rail**, không trộn.

## R-GROUP-SEPARATION — boundary giữa groups phải cùng grammar

- Nếu groups có label, mọi boundary phải qua labeled-group pattern; **orphan unlabeled group kẹt giữa labeled groups** tạo boundary grammar lệch (gap giữa "labeled boundary" và "plain boundary" khác nhau) = hierarchy vỡ. Fix: fold items vào group kề khi semantically đứng được, hoặc nâng lên section riêng. Unlabeled group hợp lệ khi: đứng cuối/độc lập (không kẹt giữa labeled), hoặc là pure container cho items cùng chủ đề.
- Đo `rowGaps[]` giữa mọi cặp row liền kề — phải chỉ có 2 giá trị: within-group và between-group. Giá trị thứ 3 = defect.

## R-TIER-READABLE — tier phải nhìn thấy được

Ladder đọc được ≠ chỉ đúng thứ tự — **bước nhảy phải đủ lớn để mắt tách được**:

- Hai tier cạnh nhau trên cùng surface: **ratio ≥ 1.5×** (8→12 ✓, 12→16 ✗ yếu, 8→16 ✓✓).
- Spec ghi **dãy gap đo thật + ratio**, không chỉ liệt kê token:

```
label→row 8 · row→row 16 · group→group 24 · card inset 16
ratios: 8→16 (2.0✓) 16→24 (1.5✓) — hierarchy đọc được
```

- Sàn nhận biết: perceivable difference ≈ 25–33% nhưng ở khoảng <24px cần hơn — dùng ladder bỏ bậc (8/16/24) thay vì bậc liền (8/12/16).

## R-SPEC-ASSERT — spec phải tự verify được

Spec sheet (B4) ngoài slot table phải có block asserts đo được:

```
[ ] ∀ row trong group X = Npx (đo offsetHeight)
[ ] rail controls: height = N, width trong [min, max]
[ ] gap series + ratios ≥1.5×
[ ] group label vs row title: khác ≥2 kênh typo
[ ] không group 1-item có label
```

Verify bằng measure (devtools/probe), không bằng mắt. Assert fail → quay về bước sở hữu rule.
