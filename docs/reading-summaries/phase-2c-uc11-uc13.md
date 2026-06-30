# Phase 2c — Tóm tắt UC11, UC12, UC13

> Đã đọc đầy đủ 22 file use-case (UC11.1–UC11.7, UC12.1–UC12.9, UC13.1–UC13.6).
> Ngày đọc: 2026-05-06 · Nguồn: `docs/.project-wiki/specs/design/UC/`

---

## UC11 — Quản lý Deck (7 file)

- **Actor:** Free User, Premium User (Guest không có quyền). Free User giới hạn tối đa 10 deck; Premium không giới hạn (Phase 2).
- **UC11.1 Tạo deck:** Tên deck (bắt buộc) + mô tả (tùy chọn) + FSRS settings riêng (new cards/day mặc định 20, review limit/day mặc định 200, FSRS params mặc định global). Có thể override global settings. Tạo deck < 200ms, hoạt động offline.
- **UC11.2 Tạo sub-deck:** Sub-deck lồng trong deck parent, hiển thị tên kiểu Anki "Parent::Sub", tối đa 3 cấp lồng nhau. Ôn deck parent = ôn tất cả sub-decks. Sub-deck có daily limits riêng hoặc kế thừa từ parent.
- **UC11.3 Sửa deck:** Sửa được tên, mô tả, new cards/day, review limit/day, FSRS parameters (w0–w17). Thay đổi FSRS params chỉ ảnh hưởng card mới, card đang học giữ schedule hiện tại.
- **UC11.4 Xóa deck:** Xóa cascade — xóa tất cả card trong deck, tất cả sub-decks, media files liên quan. Cảnh báo số card/sub-deck sẽ bị xóa, không thể hoàn tác. Không cho xóa deck cuối cùng (phải giữ ít nhất 1 deck). Xóa cascade < 5s cho 500 card, xóa media chạy background.
- **UC11.5 Gộp deck:** Chọn nhiều deck (checkbox) → chọn deck đích hoặc tạo deck mới → chuyển tất cả card sang deck đích (chỉ đổi deck_id). Giữ nguyên FSRS history. Xử lý trùng lặp: cùng target word thì giữ cả 2 (không merge card). Gộp 500 card < 2s.
- **UC11.6 Tách deck:** Tách theo tags (mỗi tag → 1 deck mới) hoặc tách thủ công (chọn card, đặt tên deck mới). Card không tag → giữ trong deck gốc hoặc deck "Uncategorized". Giữ nguyên FSRS history. Tách 500 card < 2s.
- **UC11.7 Reset tiến độ deck:** Đưa tất cả card về trạng thái New, xóa toàn bộ FSRS history (stability, difficulty, due date). Không xóa nội dung card (word, sentence, audio, image). Cảnh báo không thể hoàn tác. Reset 500 card < 1s.
- **Data entities:** Deck (id, name, description, parent_id, fsrs_params, new_limit, review_limit), Card (deck_id, fsrs state), Media files. FSRS history (stability, difficulty, due_date) được giữ khi merge/split, bị xóa khi reset.

---

## UC12 — SRS Review / Ocean Memory (9 file)

- **Actor:** Guest, Free User, Premium User (một số chức năng chỉ Free/Premium). Guest có thể ôn tập và xem stats nhưng không đặt mục tiêu/daily limits.
- **UC12.1 Bắt đầu review session:** Màn hình Home Ocean Memory hiển thị stats (cards due hôm nay, streak, retention rate 30 ngày, daily goal progress). Breakdown theo deck: số new/learning/review cards due. Nút "Ôn tập ngay" ôn tất cả card due, hoặc chọn deck cụ thể. New Tab override (UC16.11) tự động mở Ocean Memory. Tải stats < 200ms, offline.
- **UC12.2 Filtered review:** Lọc theo deck, tags, POS, trạng thái (New/Learning/Review/Mature), ngày thêm. Preview số card thỏa điều kiện trước khi bắt đầu. Chỉ ôn card thỏa điều kiện, không ảnh hưởng schedule card không được chọn. Preview < 100ms.
- **UC12.3 Đánh giá card:** Hiển thị mặt trước (target word + audio) → lật mặt sau (Space) → đánh giá Again (1) hoặc Good (2). **FSRS algorithm:** Again → stability giảm, due = hôm nay (học lại); Good → stability tăng, due = hôm nay + interval. Tính stability, difficulty, due_date mới sau mỗi đánh giá. Lật card < 100ms, FSRS tính toán < 50ms, lưu kết quả ngay lập tức.
- **UC12.4 Undo đánh giá:** Hoàn tác đánh giá vừa rồi, quay lại card trước, khôi phục FSRS state. Giới hạn chỉ undo 1 lần (không undo nhiều lần liên tiếp). Undo < 100ms.
- **UC12.5 Sửa card trong session:** Mở Card Editor inline trong session (không rời session), sửa bất kỳ field nào. Sửa nội dung không reset FSRS schedule. Mở editor < 200ms.
- **UC12.6 Tổng kết sau session:** Thống kê: tổng card đã ôn, số Good/Again, tỷ lệ đúng %, thời gian ôn, từ khó nhất (Again nhiều nhất). Cập nhật streak nếu lần ôn đầu hôm nay. Danh sách từ vừa chuyển sang "Đã học" (UC08.6). Hiển thị < 200ms sau khi hết card.
- **UC12.7 Xem card đã ôn hôm nay:** Danh sách tất cả card đã đánh giá hôm nay — mỗi card: từ, đánh giá (Good/Again), interval mới, thời gian đánh giá. Xem lại chỉ tham khảo, không thay đổi schedule. Tải < 200ms.
- **UC12.8 Mục tiêu học hàng ngày:** 2 loại mục tiêu — cards/ngày hoặc phút/ngày. Progress bar trên Home, notification khi đạt mục tiêu. Streak tăng khi đạt mục tiêu, reset về 0 nếu bỏ 1 ngày. Streak tính theo múi giờ local. Progress cập nhật real-time.
- **UC12.9 Daily limits per deck:** New cards/ngày và reviews/ngày tối đa cho từng deck. Giá trị 0 = không giới hạn (dùng global). Per-deck limit override global. Khi đạt daily limit của deck: không hiển thị thêm card từ deck đó. Reset daily count lúc 00:00 theo múi giờ local. Kiểm tra < 50ms.
- **Data entities:** Card (stability, difficulty, due_date, state: New/Learning/Review/Mature), ReviewLog (card_id, rating, timestamp, interval), DailyGoal (type, target), Streak (count, last_date), DeckDailyCount (deck_id, date, new_count, review_count).

---

## UC13 — Anki Integration (6 file)

- **Actor:** Free User, Premium User; System (auto-sync). Guest không có quyền.
- **UC13.1 Cài AnkiConnect:** Kiểm tra AnkiConnect tại `localhost:8765` tự động khi vào Settings → Anki. Nếu chưa cài: hướng dẫn thủ công (Tools → Add-ons → Get Add-ons, code **2055492159**, restart Anki). Thử cài addon tự động nếu Anki đang mở. Kiểm tra kết nối < 2s (timeout).
- **UC13.2 Export Orca → Anki:** Chọn deck Orca nguồn → chọn deck Anki đích (fetch danh sách từ AnkiConnect) hoặc tạo mới → map fields (Orca field → Anki field, tự động map tên trùng, thủ công cho tên khác) → export qua AnkiConnect API `addNotes`. Gửi media files (audio, image) kèm. Báo cáo số thành công/thất bại. Export 100 card < 10s.
- **UC13.3 Import Anki → Orca:** Chọn Anki deck → map fields (tự động + thủ công) → **convert SRS progress SM-2 (Anki) → FSRS (Orca)** dựa trên interval, ease factor, repetitions (ước tính stability từ interval). Import nội dung + SRS progress, hiển thị progress bar. Import 100 card < 10s.
- **UC13.4 Sync 2 chiều:** Trigger tự động — kiểm tra AnkiConnect mỗi 5 phút, nếu Anki đang mở thì sync. Per-record merge: so sánh timestamp (`modified_at`), record mới hơn thắng, không xóa chỉ update. Conflict resolution: cùng timestamp → Orca thắng (local-first), log conflict (UC13.6). Sync nội dung card + FSRS state + media. Sync chạy background, không block UI. **Không sync khi đang trong review session** (tránh data race). Sync 100 record < 5s.
- **UC13.5 Chọn deck sync:** Selective sync — chọn từng cặp deck Orca ↔ Anki, bật/tắt sync từng cặp. Hướng sync: 2 chiều (mặc định), chỉ Orca→Anki, hoặc chỉ Anki→Orca. Cấu hình lưu trong SQLite, hoạt động offline (cấu hình, không sync).
- **UC13.6 Xem sync log:** Mỗi entry: thời gian sync, hướng sync, số record cập nhật (Orca→Anki / Anki→Orca), số conflict, lỗi nếu có. Giữ 30 entry gần nhất. Log lưu trong SQLite. Tải log < 200ms.
- **Data entities:** AnkiConnect API (localhost:8765, `addNotes`), SyncConfig (deck_pair, direction, enabled), SyncLog (timestamp, direction, records_updated, conflicts, errors), Card (FSRS state ↔ SM-2 convert).

---

## Architecture Insights

- **Deck management là local-first, offline hoàn toàn:** Tất cả thao tác deck (tạo/sửa/xóa/merge/split/reset) chạy trên SQLite local, < 200ms–5s, không cần server. FSRS history (stability, difficulty, due_date) được bảo toàn khi merge/split (chỉ đổi deck_id), chỉ bị xóa khi reset — thiết kế này đảm bảo người dùng tái cấu trúc deck mà không mất tiến độ học.

- **FSRS là thuật toán SRS cốt lõi của Orca:** Card có 3 trạng thái New/Learning/Review/Mature. Đánh giá chỉ 2 nút Again/Good (đơn giản hóa so với Anki 4 nút). FSRS params w0–w17 có thể override per-deck, nhưng thay đổi params chỉ ảnh hưởng card mới (card đang học giữ schedule). Tính toán FSRS < 50ms, lưu ngay lập tức để không mất data khi đóng popup. Undo 1 bước với khôi phục FSRS state chính xác.

- **Daily limits 3 cấp: global → per-deck → 0 (không giới hạn):** Per-deck limit override global, giá trị 0 fallback về global. Reset daily count lúc 00:00 múi giờ local. Kiểm tra limit < 50ms trong session. Kết hợp với daily goal (cards/phút) + streak để tạo động lực học đều.

- **Anki integration qua AnkiConnect API (localhost:8765):** Extension giao tiếp với Anki desktop qua HTTP localhost, không cần server trung gian. Export dùng `addNotes`, import cần convert SM-2 → FSRS (ước tính stability từ interval/ease). Sync 2 chiều per-record merge theo `modified_at`, Orca thắng khi conflict (local-first). Sync tự động mỗi 5 phút khi phát hiện AnkiConnect, chạy background, **dừng khi đang review** để tránh data race. Sync config + log lưu SQLite.

- **Ocean Memory là giao diện SRS chính:** New Tab override (UC16.11) tự động mở Ocean Memory. Session flow: Home (stats + breakdown per deck) → filtered review (tùy chọn) → đánh giá card (Space lật, 1/2 đánh giá) → undo/sửa inline → tổng kết (stats + streak + từ khó + từ đã học). Toàn bộ offline, < 200ms cho mỗi thao tác UI.
