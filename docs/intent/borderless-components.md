# Intent — Borderless Component System

> Elicitation autonomous mode — user yêu cầu "làm tới khi chạm goal, không cần hỏi".
> Mọi field được tự xác nhận từ evidence trong codebase + phát biểu gốc của user.
> Ngày: 2026-09-08.

## Raw user statement

> "chỉnh sửa ở mức component. các component sẽ không có viền, tinh thần là sẽ không có viền. ngoại trừ đặc biệt như drag, outline button thì sẽ có. còn đâu thì sẽ cần dùng tới button để phối hợp với nhau, nhất là ở trong setting card không nên dùng viền mà phải đổi tất cả — phối màu như background thế nào? màu card ra sao? item trình bày như thế nào?"

## 8-field frame (self-confirmed)

| # | Field | Nội dung |
|---|---|---|
| 1 | **Problem** | Component mặc định mang hairline outline (`border: 1px solid --color-border`) ở khắp nơi — card, dialog, popover, panel, input, select, button solid. Viền được dùng như "kẻ ranh mặc định" thay vì "tín hiệu" → visual noise, cảm giác chật/khung, mâu thuẫn tinh thần quiet confidence + L-CANVAS ("khi có thể phân tầng bằng khoảng trống thì dùng khoảng trống"). |
| 2 | **User** | Owner/designer của Cell (quyết định direction) + end users là người học 5–80 tuổi trên thiết bị low-spec, UI nằm trên host bất kỳ. |
| 3 | **Current workflow** | Hierarchy phụ thuộc stroke: Card có `--card-border`, Dialog/Popover/Panel có border token, Input base + Select default `outline` đều kẻ hairline. Surface ladder tồn tại nhưng bị border "đè" vai trò. |
| 4 | **Pain point** | 949 border declarations trong `src/`; mọi container đều có khung → mắt phải xử lý thêm một lớp viền quanh mọi thứ (fluency tax, T1); accent/semantic mất tương đối sức nặng (T2); màu lớp (background/card/item) chưa được định nghĩa để tự gánh hierarchy → user phải hỏi "phối màu thế nào". |
| 5 | **Evidence** | tokens.json `component.{card,dialog,popover,panel}.border` đều có giá trị; `Select` default variant = `outline`; `Button` base gán `--button-solid-border` cho mọi solid variant; settings `cardHeader` + `SettingsRow.divider` + `childField` dùng hairline. External: M3 mặc định "tonal difference to indicate separation" (borderless là chuẩn, outline chỉ cho variant explicit); iOS inset-grouped list phân tầng bằng canvas/cell fill, không outline; WCAG 1.4.11 yêu cầu control có boundary nhận diện được — **fill tương phản cũng là boundary hợp lệ**, không bắt buộc stroke. |
| 6 | **Desired outcome** | (a) Mặc định mọi component borderless — phân tầng bằng tonal ladder + spacing + shadow-chỉ-cho-floating. (b) Viền chỉ tồn tại như **tín hiệu**: outline variant (explicit opt-in), state (focus/error/success/selected), drag affordance, separator cấu trúc khi thật sự cần. (c) Công thức màu 3 lớp rõ ràng: canvas → card → item, đẳng cấu light/dark theo L-HOST. (d) Settings card trở thành mẫu reference cho hệ mới. |
| 7 | **Constraint** | WCAG 2.2 AA: interactive control phải nhận diện được (tonal step đủ rõ hoặc state ring); `forced-colors`/`prefers-contrast: more` phải trả viền lại; `tokens.json` là SSOT, `tokens.css` generated; không re-layout (bỏ border không được đổi box-size); không tái giới thiệu glass/liquid; preset chỉ đổi accent, canvas trung tính. |
| 8 | **Scope** | MVP: derived token `color-field*` mới + flip component border tokens + shared/ui primitives (Card, Button, Input, Select, Textarea, SearchableSelect, MultiSelect, Chip, SearchField, Tabs, Accordion, Badge, Kbd, Tree, Slider, Dialog-family qua token) + settings card recipe + docs (RATIONALE/STANDARD/MIGRATION). Out-of-scope phase này: sweep hairline trong feature-level CSS (liệt kê checklist trong spec). Method: spec → review → implement trực tiếp. |

## Methods used

`observation` (audit codebase), `ideation` (M3/iOS/WCAG cross-check), **không** interview — user cấm hỏi.

## Doubt-driven stress-test (tự chạy)

| Giả định | Rủi ro nếu sai | Đối sách |
|---|---|---|
| Control không viền vẫn nhận diện được | Input/select "invisible" trên card → user không biết chỗ bấm | `color-field` = tonal step text@7%; hover/active tăng step; focus ring giữ nguyên; `prefers-contrast: more` trả border |
| Xóa border không đổi layout | Border 1px chiếm box → bỏ sẽ lệch 1-2px | Giữ `border` shorthand với `transparent`/`none` cùng width, hoặc `border-color: transparent` — không reflow |
| Dark/light đẳng cấu | Field tone lệch giữa hai mode | `color-mix(text, transparent)` — text tự lật theo mode |
| Phá preset | Field trộn text → trung tính, không phụ thuộc accent | Công thức không chứa `primary` |
| User muốn "không viền" = xóa cả separator | Mất scannability list dài | Separator giữ vai trò "đường kẻ phân cách" (border-subtle hairline), documented là ngoại lệ — có thể siết thêm sau nếu user muốn tuyệt đối |
