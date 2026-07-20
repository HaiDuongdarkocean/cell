# Interview UI/UX — Phân tích từ trên media

## Ngày phỏng vấn
2026-07-20 — Hoàn thành wireframe & prototype (verified Edge DevTools).

## Restate ý định đã xác nhận

- **Outcome:** Khi đọc trang web tiếng Anh, người dùng nhìn thấy từ vựng được đánh dấu status (unknown/tracking/known/ignore), độ phổ biến (frequency), và IPA reading ngay trong ngữ cảnh, giúp nhận diện nhanh từ đáng học và xây dựng danh sách từ vựng cá nhân.
- **User:** Người học tiếng Anh ở mọi cấp độ, tự chọn nội dung web phù hợp trình độ; mobile first, desktop có shortcut nâng cao.
- **Why now:** Tính năng cốt lõi của extension, chuyển từ "tra từ điển thủ công" sang "hiển thị từ vựng trong ngữ cảnh đọc".
- **Success:** Người dùng đọc nội dung thật với ít ma sát hơn, dễ dàng nhận diện và thu thập từ vựng đáng học; giảm thời gian tra cứu là phụ.
- **Constraint:** Ban đầu chỉ hỗ trợ **trang web văn bản**; phụ đề video, PDF, hình ảnh chưa làm.
- **Strict goal [high risk — badge refactor]:**
  - Float badge trở thành **trung tâm cấu hình duy nhất** của hệ thống.
  - Toàn bộ cài đặt từ **trang Options** và **Settings trong popup** sẽ được **di chuyển vào badge**; hai nơi này sẽ **bị xóa**.
- **Out of scope (lúc này):** Tự động tokenize khi vào trang, video/PDF/image, chọn IPA list ưu tiên chỉ cần khung cơ bản.

## Kích hoạt

Vào trang → nhấn float badge → enable "phân tích từ" → hệ thống nhớ trang đó cho lần sau.

## Float badge (system manager)

- Nút nổi, kéo thả được.
- Nhấn mở ra danh sách quản lý / panel cấu hình.
- Mobile/Tablet: danh sách kéo dài toàn màn hình.
- Desktop: dialog thông minh, reposition gần icon; icon di chuyển lên góc phải trên cùng của danh sách, nhấn để thu gọn.

## Tương tác

- Mobile: nhấn từ → chọn từ (select); đổi trạng thái qua badge manager Current Page hoặc Popup Dictionary đã có sẵn của hệ thống. Không thiết kế popup riêng.
- Desktop: hover từ + phím tắt 1/2/3/4 (unknown/tracking/known/ignore); chọn nhiều từ (Ctrl/Cmd+click) + phím tắt để batch đổi trạng thái.

## Hiển thị

- Status: pill gạch chân (height 2px), **float tuyệt đối phía dưới word** (`position: absolute; top: 100%`) — không đẩy dòng tiếp theo xuống, không làm dòng nhảy khi token xuất hiện.
- Frequency: màu nền + chữ.
- **IPA: KHÔNG hiển thị trên token.** Bỏ layer IPA khỏi token để đơn giản hóa và tập trung vào thuật toán tokenize. IPA vẫn là dữ liệu nội bộ (phục vụ thuật toán) nhưng không render lên trang. Khi cần tra IPA, user dùng Popup Dictionary.
- Container token: `inline-block`, `vertical-align: baseline`, `line-height: inherit` → word align hoàn hảo với text thường, không lệch top/height.
- Hai toggle độc lập (Status, Frequency), mặc định bật cả 2 trong giai đoạn develop.
- **Không có viền outline** khi hover hoặc active/select — token chỉ thay đổi qua status underline + frequency bg.
- Tooltip khi hover vẫn hiện `word / status / freq [1·2·3·4]` cho mọi token.
- **Phân tích theo status:**
  - `unknown` / `tracking`: hiển thị đầy đủ frequency bg + status underline (cần phân tích để học).
  - `known` / `ignore`: từ đã học → **ẩn mặc định** frequency bg, status underline; chữ thường, không nền.
  - `known` / `ignore` khi **hover**: hiện lại status underline (màu xanh cho known, đỏ cho ignore) để user nhận biết trạng thái; frequency vẫn ẩn.
  - `ignore`: thêm `opacity: 0.5` + line-through.
  - **Dữ liệu phân tích vẫn tạo cho tất cả từ** (frequency, status) — CSS chỉ ẩn hiển thị mặc định cho known/ignore, hover là thấy status.

## Quyết định wireframe

1. **Mobile/Tablet expanded badge:** Full-screen panel chiếm toàn màn hình, có icon ở góc phải trên cùng để thu gọn. (Không dùng bottom sheet.)
2. **Nội dung mô phỏng (sample text):** Sử dụng đoạn text anh yêu cung cấp về “Skills, so you stop explaining your project every single time” để làm bài viết mẫu trong wireframe.
3. **Nội dung badge manager:** (1) Hiển thị toggle, (2) Danh sách từ vựng, (3) Cài đặt hệ thống — theo thứ tự này trong wireframe đầu tiên, chờ feedback.
4. **Tokenized word container:** Một container duy nhất (`inline-block` `span`) chứa word ở trong normal flow; IPA và status underline **float tuyệt đối** (position absolute) phía trên/dưới container — không đẩy dòng, không làm token nhảy so với text thường. Frequency = background color của toàn bộ container + màu chữ của word. Status underline height 2px. Không có viền outline khi hover/active.
5. **Word popup / tra cứu:** Không thiết kế popup mới. Khi nhấn/hover từ, mở Popup Dictionary đã có sẵn của hệ thống để tra cứu và đổi trạng thái. Prototype không tạo word-popup mock riêng — mobile tap token chỉ select như desktop, tra cứu đi qua dictionary.
6. **Phân tích theo status (known/ignore):** Chỉ `unknown` và `tracking` mới cần phân tích hiển thị (IPA, frequency bg, status underline). `known` và `ignore` là từ đã học nên ẩn mặc định — nhưng hover vẫn hiện status underline để user nhận biết trạng thái. Dữ liệu phân tích vẫn tạo cho tất cả từ, CSS chỉ ẩn hiển thị.
7. **Không viền outline:** Token không có outline khi hover hoặc active/select — chỉ thay đổi qua status underline + frequency bg. Tránh visual noise trên trang đọc.

## Quyết định IA — Badge Manager (đã duyệt)

Dựa trên nghiên cứu settings/options hiện có + tài liệu UX/IA bên ngoài:
- Android Design — Settings patterns: đặt preference thường dùng gần feature, dùng ngôn ngữ rõ ràng, tránh replicate device settings.
- NN/g — *Hamburger Menus and Hidden Navigation Hurt UX Metrics* (Pernice & Budiu): hidden navigation giảm discoverability; nên dùng visible/combo navigation, đặc biệt trên desktop.
- NN/g — *Mobile Subnavigation* (Budiu): tránh sequential menu với back button nhầm lẫn; submenus nên <6 mục; mobile dùng category landing pages hoặc section menus.
- setting.page — *Settings Information Architecture* & *Mobile Settings Page Design Patterns*: phân loại theo scope (me / my team / system), frequency, risk, complexity; dùng top-level rows cho high-frequency/low-risk, subpages cho medium, detail screen cho low-frequency/high-risk.
- Jesse James Garrett — *The Elements of User Experience*: 5 planes, structure plane phải phản ánh conceptual model; skeleton là bố cục, structure là cách các phần kết nối.
- Abby Covert — *How to Make Sense of Any Mess*: IA là cách sắp xếp các phần để tạo ra whole understandable; 7 bước identify → state intent → face reality → choose direction → measure distance → play with structure → prepare to adjust.
- Don Norman — *The Design of Everyday Things*: discoverability, understanding, conceptual model, natural mapping, feedback; đưa controls gần chức năng và làm chúng visible.

### Nguyên lý áp dụng
1. **Scope-first**: user nghĩ theo "trang này / tôi / ứng dụng / hệ thống", không theo database.
2. **Frequency + risk + complexity**: high-frequency/low-risk ở top-level; medium vào grouped subpage; low-frequency/high-risk vào detail screen với xác nhận.
3. **Visible navigation**: desktop dùng sidebar; mobile dùng top-level category list (như iOS Settings) rồi drill-down, không dùng hamburger-only.
4. **State labels**: mỗi row hiển thị trạng thái hiện tại bên dưới title.
5. **Correct control pattern**: toggle cho binary, navigation row cho dependencies/complex, picker/select cho list, slider cho numeric, shortcut input cho keyboard.

### Điểm đã xác nhận với user
- 7 nhóm OK.
- Extension on/off nằm trong **System**.
- Auto-download per site nằm trong **Media**.
- IPA/Status/Frequency display toggles ở **Current Page**; Appearance là tab riêng cho theme/colors. _(Cập nhật: bỏ IPA toggle — chỉ còn Status + Frequency.)_
- Keyboard shortcuts ở **System**.
- **Tài nguyên** là tab riêng gồm: Danh sách từ vựng, Dictionary, Frequency, Reading (IPA).

## Quyết định prototype

### Skeleton (Phase 1)
- Shadow DOM isolate host CSS (aggressive host CSS mock: magenta button, Comic Sans h1, dotted border div).
- Embed `tokens.css` remapped `:root` → `:host` cho Shadow DOM.
- Embed system SVG icons (lucide) từ `src/shared/icons/index.ts`.
- Mock host page với sample text "Skills, so you stop explaining your project every single time".
- FAB (float badge) với counter "3".

### Badge manager shell + navigation (Phase 2)
- 7 nhóm IA: Current Page / Subtitles / Tài nguyên / Tra từ & Thẻ / Media / Giao diện / Hệ thống.
- Desktop: sidebar 220px + main panel; Mobile: full-screen slide-in + drill-down Back.
- Theme toggle cycle dark → light → system; icon luôn reflect resolved mode.
- Focus trap (Tab cycle) + ESC close + restore focus.

### Nội dung 7 panel (Phase 3)
- Current Page: 3 toggle (IPA/Status/Frequency) + danh sách từ vựng (filter + 6 token) + phân tích.
- Subtitles: auto-load, subtitle block, target/native style, nav cluster.
- Tài nguyên: vocab list + dictionary + frequency + IPA reading.
- Tra từ & Thẻ: dictionary popup, TTS voices, card creator.
- Media: auto-select, download, per-site auto-download.
- Giao diện: theme mode, colors, preview, import/export/reset.
- Hệ thống: TS→MP4, segment concurrency, keyboard shortcuts, extension enabled, reset.

### Tokenization trên host page (Phase 4)
- Token container `inline-block`, `vertical-align: baseline`, `line-height: inherit` → word align hoàn hảo với text thường.
- **Không hiển thị IPA trên token** — bỏ layer IPA để đơn giản hóa, tập trung vào thuật toán tokenize.
- Status underline: `position: absolute; top: 100%`, height 2px (float dưới word, không đẩy dòng tiếp theo).
- Word: `display: inline` trong normal flow.
- Frequency = background + text color của container (high/medium/low/unknown).
- Status underline màu: unknown `#94a3b8`, tracking `#d97706`, known `#059669`, ignore `#ef4444`.
- **Không viền outline** khi hover/active/select — chỉ thay đổi qua status underline + frequency bg.
- Hover tooltip: `word / status / freq [1·2·3·4]`.
- Toggle Status/Frequency thực sự ẩn/hiện layer trên token.
- **Phân tích theo status:**
  - `unknown`/`tracking`: hiện đầy đủ freq bg + status underline.
  - `known`/`ignore`: ẩn mặc định freq bg + status underline; hover hiện lại status underline.
  - `ignore`: opacity 0.5 + line-through.
  - Dữ liệu phân tích vẫn tạo cho tất cả từ — CSS chỉ ẩn hiển thị.
- **Văn bản dài test multi-line:** đoạn "On Padaro Beach near Santa Barbara, California..." (3 dòng, 18 token) để kiểm tra đánh dấu trên nhiều dòng — verify không overlap status underline dòng N với word dòng N+1.

### Tương tác (Phase 5)
- Desktop: click select, Ctrl/Cmd+click multi-select, phím 1/2/3/4 đổi status (batch nếu đang select, hover nếu không).
- Mobile: tap token → select (không có popup riêng; tra cứu đi qua dictionary).
- Đồng bộ status giữa host page token và badge manager Current Page list.
- Click status badge trong Current Page → cycle status.

### FAB draggable + desktop anchored dialog (Phase 6)
- FAB kéo thả được (Pointer Events, clamp trong viewport, phân biệt click vs drag > 3px).
- Desktop mở manager: dialog reposition gần FAB (không center), FAB di chuyển lên góc phải trên cùng dialog, đổi icon thành chevronDown, nhấn để đóng.
- Nút close (X) trong header ẩn khi FAB attached.
- Đóng: FAB trở về vị trí trước khi mở.
- Mobile: manager full-screen slide-in, FAB ẩn khi mở.

### Đã bỏ
- **Word popup mock**: bỏ vì không cần thiết — người dùng dùng trực tiếp Popup Dictionary đã có sẵn để tra cứu.
- **Hiển thị IPA trên token**: bỏ layer IPA render trên token. Lý do: (a) đơn giản hóa, tập trung vào thuật toán tokenize; (b) tránh overlap khi token xuống dòng (IPA float phía trên đè lên status underline dòng trước); (c) user tra IPA qua Popup Dictionary khi cần. IPA vẫn là dữ liệu nội bộ phục vụ thuật toán.

### Verify (Edge DevTools / Chrome DevTools MCP)
- Host CSS isolation ✓
- FAB hiển thị + counter ✓
- Badge manager mở/đóng, chuyển 7 nhóm ✓
- Theme toggle dark/light/system ✓
- Token inline-block + status float absolute (không nhảy dòng) ✓
- Status underline height 2px ✓
- Không viền outline khi hover/active ✓
- Token 2 lớp (word + status) + frequency bg ✓
- Toggle Status/Frequency ảnh hưởng token ✓
- Desktop click select + phím 1/2/3/4 + batch multi-select ✓
- Mobile tap select ✓
- known/ignore ẩn phân tích, hover hiện status underline ✓
- FAB kéo thả ✓
- Desktop anchored dialog + FAB collapse button ✓
- Mobile full-screen + FAB ẩn ✓
- Văn bản dài multi-line (24 token, 3 dòng) — không overlap status underline ✓
- Không có IPA span trên token (ipaSpans = 0) ✓
- Không có console error/warn ✓
