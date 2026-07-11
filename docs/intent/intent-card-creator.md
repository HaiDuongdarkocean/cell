# Intent — Card Creator

> Confirmed intent for the Card Creator feature. Mockup approved at `docs/mockups/anki-card-mockup.html`.

## Outcome

Tạo và cập nhật flashcard từ nội dung video (subtitle, audio, screenshot, translation) trực tiếp trong Cell, gửi tới Anki desktop/AnkiConnectAndroid qua AnkiConnect.

## User

Người học ngôn ngữ qua video trên Chromium (desktop / tablet / mobile Kiwi). Dùng Yomitan cho text fields, Cell cho rich media.

## Why now

Yomitan chỉ thêm text. Rich media (sentence audio, screenshot, translation) hiện phải làm thủ công → chậm, dễ bỏ sót. Cell đã có subtitle + video player → tận dụng luôn để rút ngắn workflow từ 5-7 bước xuống 1 phím.

## Success

- Nhấn `q` (desktop) / nút quick (mobile): cập nhật thẻ mới nhất trong deck hiện tại (10 phút gần đây) với rich media. Không thấy → mở dialog báo "no recent card".
- Nhấn `e` (desktop) / nút edit (mobile): mở Card Creator dialog để tạo/sửa thẻ.
- UI y hệt mockup đã chốt.
- Chạy được trên desktop + Kiwi mobile (RAM 4GB).

## Constraint

- AnkiConnect HTTP `localhost:8765` mặc định, configurable IP/port.
- Mobile: Anki desktop qua LAN hoặc AnkiconnectAndroid.
- Không xử lý word audio / target word / definitions — đó là trách nhiệm Yomitan/user.
- Sentence translation: subtitle track > Google Translate (unofficial, fallback empty) > empty.
- Media update modes: overwrite / append / skip.
- Performance: autosave draft, tránh heavy media processing in-tab để không crash tab trên mobile RAM thấp.

## Out of scope

- SRS engine riêng (sau này mới mở rộng — tên "Card Creator" giữ chung chung cho điều này).
- Word audio, target word, definitions (Yomitan lo).
- Sync/lưu trữ cloud.

## Mockup

Approved: `docs/mockups/anki-card-mockup.html`. UI phải implement y hệt mockup.

## Key decisions (từ interview)

- UI layout: Option A — bottom sheet mobile + modal desktop.
- Media fields: list dọc, mỗi dòng thumbnail + tên + nút xóa, có nút `+ Add` cuối list.
- Tag: cuối section Fields.
- Update mode: trong Footer cạnh Cancel/Add/Update.
- Footer buttons: Cancel / Add / Update.
- Tên: **Card Creator** (chung chung cho SRS mở rộng sau).
- Field mapping: **inline trên mỗi field** (dropdown chọn Anki field), luôn hiển thị, auto-map khi đổi note type, user chỉnh thủ công. Bỏ field mapping trong Settings.
- Settings: chỉ còn Connection (bỏ Defaults, bỏ Field mapping). Connection có status bar redesigned (online/offline/testing + version + URL + Test again).
- Select inline: đồng bộ style với select ở Card destination (compact variant, chevron SVG chuẩn hệ thống).
- Mobile Update mode: label trên, select dưới.
- Placeholder tiếng Anh chuyên nghiệp (sản phẩm thương mại).

Next: spec via spec-driven-development.
