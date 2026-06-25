# Intent: Auto-select & Auto-download

> Confirmed via `/interview-me` on 2026-06-24.
> Source: conversation with Anh yêu.

## Outcome
Người học mở popup → media/subtitle đã được tự chọn theo preference (chỉ cần bấm Download).
Hoặc vào trang đã whitelist → tự tải xuống không cần mở popup.

## User
Người học ngoại ngữ (mỗi trang = 1 bài giảng / 1 tập phim).

## Why now
Giảm thao tác thừa để tập trung học, không phải bấm nhiều nút.

## Success
- Mở popup thấy đã chọn sẵn đúng preference.
- Vào trang whitelist thấy file tự về.

## Constraint
Mỗi trang chỉ 1 định dạng (mp4 HOẶC m3u8) với nhiều biến thể quality.
Không có trường hợp 2 video cùng format + cùng quality.

## 2 toggle độc lập

### 1. "Auto select" toggle (trong Settings Dialog)
- ON: media + subtitle hiện ra để chọn (thiết lập preference cho trang).
- Sau khi thiết lập xong, mỗi lần mở popup → hệ thống TỰ chọn theo preference,
  user chỉ cần bấm Download.
- Không liên quan whitelist, áp dụng cho mọi trang khi mở popup.
- OFF: popup hoạt động như cũ (user tự chọn thủ công).

### 2. "Auto download" toggle (trong popup Header, thay nút "Download all" cũ)
- ON: lưu URL hiện tại (origin + first pathname segment, bỏ query/hash và phần path sau segment đầu) vào whitelist. Ví dụ `https://kisskh.co/Drama/Show/Episode-1` → whitelist `https://kisskh.co/Drama`, nên mọi tập thuộc `/Drama` đều tự tải.
- Ghé lại trang trong whitelist → detect media → chọn 1 video khớp preference → tự tải ngay.
- Nút SÁNG khi đang ở trang đã trong whitelist.
- Trang whitelist không có media → im lặng, nút vẫn sáng.
- OFF: gỡ URL khỏi whitelist, không tự tải.

## Preference (trong Settings, ăn theo "auto select")
- "select subtitle" (ĐỔI TÊN từ "subtitle language"): multi-select CÓ SEARCH.
  Tải TẤT CẢ track khớp cùng 1 video.
- "select video" (MỚI): dropdown preferred format mp4/m3u8.
- "default quality" (CÓ SẴN): mặc định 'highest'.

## Logic pick video (chọn 1 duy nhất)
1. FORMAT: preferred = m3u8 mà chỉ có mp4 → fallback mp4 (và ngược lại).
2. QUALITY: lấy quality gần "default quality" nhất.
3. SUBTITLE: tải tất cả track khớp "select subtitle";
   không có track khớp → bỏ qua subtitle, vẫn tải video.

## Out of scope
- Retry detect khi trang whitelist không có media.
- Whitelist theo domain (chỉ origin + first pathname segment).
- Tải nhiều video cùng trang.
- Auto download trên trang không trong whitelist.
