# Design Brief — Unified Resource Import

> Spec: `docs/specs/unified-resource-import.md` · Mockup: `src/entrypoints/mockup-unified-resource-import/` · Stage: design (interactive)

## Design Read

Một dòng: **bỏ câu hỏi "loại nào?" khỏi user — một ô thả duy nhất, Tihoka tự nhận diện, danh sách phẳng một thứ tự ưu tiên.**

Đây là consolidation refactor của một surface đã tồn tại (ResourcesPanel hai section), không phải feature mới — dải variance hẹp là có chủ đích: user đã học panel này, điều thay đổi là mất đi một quyết định chứ không phải học lại layout.

## Function audit

| Function | Class | Why |
|---|---|---|
| Một dropzone nhận mọi format | must-have | REQ-1 — lõi của feature |
| Detected-kind badge trên job row | must-have | REQ-1/2 — feedback "hệ thống nhận biết", tin cậy |
| Picker chọn phần nạp cho file nhiều loại | must-have | REQ-2 override — chọn phần nào của file được nạp |
| Một danh sách một trục priority | must-have | REQ-6 — merge semantics một trục |
| Chips nội dung trên card (gồm 'tần suất') | must-have | REQ-3/6 — đã có sẵn, chỉ thêm chip mới |
| Edit mode bulk select/enable/delete | must-have | hiện có — giữ nguyên |
| Drag/keyboard reorder | must-have | REQ-6 — giữ nguyên |
| Duplicate/skipped/error/retry rows | must-have | hiện có — giữ nguyên |
| FrequencyBandsEditor | must-have | global setting — cần chỗ mới trong layout gộp |
| Filter theo loại nội dung | nice-to-have | không trong spec — giúp user vẫn nghĩ theo loại |
| Group headers theo capability | nice-to-have→risk | tension với single-axis (xem Concept C) |

Một primary job: **"thả file vào, xong"** — mọi thứ khác phụ.

## Journey map

| # | Step | User action | System response | UI location |
|---|---|---|---|---|
| 1 | Vào Resources | mở panel | một dropzone duy nhất | section head |
| 2 | Thả file | kéo/chọn 1+ file | job row hiện ngay + badge loại detect được | list top |
| 3 | *(uncertainty)* file nhiều loại | nhìn chips, có thể tắt phần không muốn | chips đánh dấu phần sẽ nạp | job row |
| 4 | Chờ | không làm gì / đóng panel | upload chunked → SW import ngầm | job row fill |
| 5 | Xong | thấy card mới đúng vị trí | resource card + đủ chips | list |
| 6 | Quản | reorder/toggle/edit | priority một trục | cards |
| — | Edge: detect fail | — | error row + lý do rõ | job row |
| — | Edge: duplicate | chọn replace/skip | parked prompt | job row |
| — | Edge: first-time | — | một empty state thay vì hai | list |

Moment of uncertainty duy nhất là bước 3 — và nó là *opt-in* (mặc định nạp cả hai, đúng ý intent).

## Dials

Baseline: `DESIGN_VARIANCE` 3 · `MOTION_INTENSITY` 3 · `VISUAL_DENSITY` 6 (panel settings — mật độ cao vừa, motion tối thiểu theo DS hiện tại).

## Inspiration anchor

Cảm giác: **thả đồ vào một giỏ — hệ thống tự phân loại**, như hòm thư tự sắp vào ngăn. Non-digital: khay phân loại thư ở bưu cục — người gửi chỉ cần bỏ vào một khe, cơ quan lo phần còn lại. Khớp design story (nước — mọi thứ chảy về đúng chỗ, user không phải đẩy).

## Concept cards

### Concept A — Một dãy sách (conservative)

- **IA mental model:** một giá sách duy nhất — mọi resource nằm chung một hàng, chips trên card nói "cuốn này chứa gì".
- **Visual archetype:** giữ nguyên ngôn ngữ panel hiện tại — cùng card, cùng job-row water-fill; delta = mất một section header + dropzone.
- **Non-digital reference:** kệ sách bỏ vách ngăn giữa.
- **Material / surface:** solid surface hiện có; badge = pill `primary-subtle` nhỏ cạnh filename.
- **Typography treatment:** giữ nguyên hierarchy; badge font-size-xs.
- **Motion signature:** như hiện tại — fill animation, không thêm.
- **UX flow:** drop → job row inline trong list (đúng chỗ card sẽ đáp xuống) + badge; multi-component → chips bật/tắt ngay trên job row; xong → card.
- **UI structure:** SectionHead "Tài nguyên" + edit bar + dropzone + list (jobs inline giữa cards theo slot) + bands footer.
- **3 dials:** DESIGN_VARIANCE: 2, MOTION_INTENSITY: 3, VISUAL_DENSITY: 6
- **Why it fits:** ít nhất để đạt REQ-1/2/6; job rows vẫn "nằm tại slot resource sẽ vào" (pattern đã có); zero learning cost; risk thấp nhất.
- **Risk:** user kỳ vọng "hai loại" có thể bối rối khi tần suất nằm cùng từ điển — giảm nhẹ nhờ chips; không có filter.
- **Audit findings:** —

### Concept B — Hộp thư nhận diện (hybrid)

- **IA mental model:** hòm thư đầu vào — file rơi vào "Đang nhận" có badge lớn rõ ràng, hệ thống khoe việc nó nhận diện được; xong thì trôi vào kho.
- **Visual archetype:** intake strip nổi bật (field surface, viền primary-subtle) tách khỏi list; list + filter chips.
- **Non-digital reference:** khay "thư mới đến" trên bàn — sáng, tạm thời, xong thì cất.
- **Material / surface:** intake = field bg + border primary; job badges lớn (không subtle).
- **Typography treatment:** intake header "Đang nhận · n" primary medium; badges đậm hơn A.
- **Motion signature:** giống A + intake strip xuất hiện/biến mất (fade-height); khi job done, strip co lại.
- **UX flow:** drop → job vào intake strip (không inline giữa cards); multi → chips trong strip; done → card hiện trong list + strip co; filter chips cho phép xem riêng Từ điển/Tần suất.
- **UI structure:** SectionHead + edit bar + dropzone + intake strip (chỉ hiện khi có jobs) + filter row + list + bands footer.
- **3 dials:** DESIGN_VARIANCE: 5, MOTION_INTENSITY: 4, VISUAL_DENSITY: 5
- **Why it fits:** nhấn mạnh đúng selling point của feature ("tự nhận diện"); filter giữ mental model cũ cho user chuyển tiếp; jobs tách khỏi list → list sạch hơn khi import nhiều file.
- **Risk:** jobs không còn "đứng ở slot card sẽ vào" (mất quan hệ không gian đẹp của pattern hiện tại); thêm một container mới (intake) = surface mới trong DS; filter là scope ngoài spec.
- **Audit findings:** —

### Concept C — Hai nhãn, một thứ tự (experimental)

- **IA mental model:** một thứ tự ưu tiên nhưng hai nhãn đọc — như mục lục sách group theo chủ đề với số trang chạy liền mạch.
- **Visual archetype:** list giữ nguyên + group labels ("Nội dung từ điển" / "Tần suất") + rank badge #n toàn cục trên mỗi card.
- **Non-digital reference:** mục lục có đánh số trang liên tục qua các chương.
- **Material / surface:** như A + uppercase group label + rank pill.
- **Typography treatment:** group label xs semibold uppercase muted; rank tabular-nums.
- **Motion signature:** như A.
- **UX flow:** giống A cho import; list: resource hai-loại đứng ở nhóm dominant (Từ điển) với đủ chips — nhóm Tần suất khuyết số (#3 rồi #5) cho thấy nó đang nằm giữa.
- **UI structure:** SectionHead + edit bar + dropzone + jobs + group label + list + group label + list + bands footer.
- **3 dials:** DESIGN_VARIANCE: 7, MOTION_INTENSITY: 3, VISUAL_DENSITY: 6
- **Why it fits:** giữ mental model "hai loại" quen thuộc trong khi vẫn expose single-axis qua rank — trả lời trung thực câu hỏi "freq của tôi nằm đâu so với dict?".
- **Risk:** khuyết rank gây nghi vấn lỗi hiển thị; resource hai-loại không xuất hiện ở nhóm Tần suất → user tìm không thấy; group+single-axis là hai ý niệm đấu nhau — phức tạp nhất để hiểu và để test.
- **Audit findings:** —

## Responsive

| Width | Behavior |
|---|---|
| 320px | một cột; intake strip (B) full-width; filter chips wrap; badge wrap dưới filename nếu chật |
| 420px (mockup default) | như settings panel thật — touch ≥44px |
| 640px+ | giống 420, max-width list không giãn quá |
| 1280px+ | panel nằm trong settings shell — không đổi |

## States (chosen direction — pending pick)

Tất cả variants đều render đủ: empty, loading (skeleton giữ nguyên), queued/uploading/error job, duplicate prompt (giữ nguyên), disabled card, dark mode, `prefers-reduced-motion` (fill vẫn instant, không transition).

## Anti-patterns avoided

- Không glass/blur — solid surfaces.
- Không dropzone thứ hai ẩn trong overflow menu (giữ "một nơi duy nhất" là nghĩa đen).
- Không tab Dict/Freq (tab = vẫn hai nơi).
- Không shared layout file giữa concepts trong mockup (mỗi concept tự render).

## Open question cho Anh (gate)

Filter chips (Concept B) nằm ngoài spec REQ tối thiểu — chọn B nghĩa là nhận thêm scope nhỏ đó (đã lường: một useState + filter list).
