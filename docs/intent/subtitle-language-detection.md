# Intent: Subtitle Language Detection (Pilot: English)

## Confirmed Intent

- **Outcome:** Popup hiển thị tag "English" trên subtitle card khi subtitle được nhận diện là tiếng Anh
- **User:** Người dùng extension — muốn thấy ngôn ngữ subtitle chính xác thay vì "unknown" hoặc đoán sai từ URL
- **Why now:** Hiện tại subtitle URL không có language code rõ ràng → popup hiển thị sai hoặc "unknown"
- **Success:** Subtitle tiếng Anh hiển thị tag "English", subtitle không phải tiếng Anh hiển thị tag gốc (không đổi)
- **Constraint:** Pilot chỉ tiếng Anh. Thuật toán: top 10 từ phổ biến positions 5-15 từ Wikipedia, match ≥ 8/10 từ xuất hiện trong nội dung subtitle → tiếng Anh. Fetch subtitle khi popup mở, không phải khi detect
- **Out of scope:** Auto-select subtitle theo language setting, nhận diện ngôn ngữ khác ngoài tiếng Anh, flag icon, nhận diện ngay khi network intercept

## Algorithm

1. Wikipedia top words (English), positions 5-15 (10 words, skip positions 1-4)
2. Fetch subtitle content when popup opens
3. Check presence: count how many of the 10 words appear in subtitle text
4. If ≥ 8/10 (80%) → tag as "English"
5. Display tag on SubtitleCard

## Status

- Pilot: English only
- Future: extend to Chinese, Vietnamese, etc.
- Future: auto-select based on detected language
