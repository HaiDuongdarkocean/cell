# Intent: Popup Tab Scoping

**Status:** Confirmed (2026-06-24)
**Source:** `interview-me` session

## Problem
Popup mở cho tab A nhưng danh sách media lại chứa media của tab B (tab nền đang chạy). Vi phạm nguyên tắc "extension gắn theo tab" — danh sách phải phản ánh đúng tab đang active.

## Root Cause (verified in code)
1. `handleGetDetectedMedia` (`src/background/index.ts:691-694`) — khi tab active không có media, **fallback trả về ALL media mọi tab** → tab A trống thì leak media của tab B.
2. `DETECTED_MEDIA_UPDATE` broadcast (`src/background/index.ts:179-203`) — khi **bất kỳ tab nào** detect media mới, broadcast gửi thẳng tới popup đang mở mà **không check tab đó có phải active tab không** → popup của tab A bị ghi đè bằng media của tab B theo thời gian thực.
3. Popup (`src/popup/hooks/useDetectedMedia.ts:30`) gửi `GET_DETECTED_MEDIA` mà **không kèm `tabId`**, nên background phải tự đoán active tab.

## Desired Behavior
- Danh sách media trong popup luôn scope theo tab đang active.
- Tab nền vẫn capture (để khi user chuyển sang sẽ thấy), nhưng **không rò rỉ** vào popup của tab khác — cả lúc mở popup lẫn live update.

## User
Anh yêu (và end-user nói chung) — tránh tải nhầm media của tab không mong muốn.

## Why Now
Bug từ gốc (kiến trúc chưa bao giờ scope đúng), Anh yêu vừa bắt gặp và muốn fix.

## Success Criteria
- Mở popup ở tab A → chỉ thấy media của tab A.
- Tab B detect media nền → popup của tab A không đổi.
- Chuyển sang tab B → thấy media của tab B.

## Out of Scope
- Không xóa media của tab nền (vẫn giữ để user chuyển tab xem được).
- Không thêm UI "group theo tab" — chỉ ẩn hoàn toàn tab không active.
