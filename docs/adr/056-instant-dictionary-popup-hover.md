# ADR-056: Instant Dictionary Popup Hover + Repeat-Hit Cache

## Context

Người dùng phản hồi dictionary popup:
1. Hover có độ trễ rõ rệt (150ms debounce cũ).
2. Popup vẫn trigger khi chuột ở ngoài vùng text chính xác.
3. Tra lại từ vừa tra hoặc từ liền kề vẫn phải chờ network round-trip.

## Decision

Thay đổi 3 thành phần liên quan:

### 1. Hover debounce chỉ fire khi dừng chuột

- `SubtitleTriggerController`: `HOVER_DEBOUNCE_MS = 80` — cursor phải ở trên token ít nhất 80ms mới tra; di nhanh qua token thì `mouseleave` cancel.
- `WebTriggerController`:
  - `WEB_HOVER_DEBOUNCE_MS = 80` — cursor phải đứng yên trong 80ms.
  - Thêm **stop guard**: so sánh vị trí `clientX/Y` của event lúc timer được hẹn với vị trí mới nhất; nếu khoảng cách > `WEB_HOVER_STABILITY_PX` (6px) thì coi như chuột vẫn đang di chuyển → reset timer. Chỉ khi cursor đứng yên (trong bán kính 6px) suốt 80ms mới thực sự lookup.
  - Tách logic đắt tiền (`caretRangeFromPoint`, tìm sentence/word, kiểm tra geometry) ra khỏi `onMouseMove`, chỉ chạy trong timer callback.

### 2. Chỉ trigger khi pointer thực sự nằm trên text

- Áp dụng `isPointOverRange` (đã có từ fix trước) cho cả `onMouseUp` và hover path của `WebTriggerController`.
- `SubtitleTriggerController` cũng kiểm tra `isPointOverSpan`/`isPointOverRange` trong `onHoverEnter` và `onClick`.

### 3. Lookup cache + prefetch từ liền kề

- `WebTextDictionaryController` giữ một bounded in-memory LRU cache:
  - Key: `${langCode}:${term.toLowerCase()}`.
  - Capacity: `min(250, max(50, navigator.deviceMemory * 25))` — nhẹ trên máy 1GB RAM, đủ trên máy mạnh.
- Khi `handleLookup` cache hit, popup render ngay lập tức không gọi background.
- Cache được cập nhật khi user đổi status qua `onStatusChange` callback.
- Sau mỗi lookup thành công, prefetch ngầm từ liền kề (previous + next word) trong `contextSentence`, giúp hover sang từ kế tiếp hiện ngay.

## Why

- **80ms stop debounce + 6px stability guard**: đảm bảo chỉ tra khi user thực sự dừng chuột; di nhanh qua text không gây popup flicker. 80ms vẫn đủ nhanh để không cảm thấy khựng khi dừng.
- **Geometry guard**: popup chỉ hiện khi chuột đúng trên text, không trigger do padding/shadow/line-height.
- **Cache ở controller**: lookup kết quả ít thay đổi, repeat-hover (đọc lại, rê chuột qua lại) chiếm tỷ lệ cao. Cache tại `WebTextDictionaryController` (per-tab) đơn giản, không cần persist, tự xóa khi `destroy()`.
- **Prefetch adjacent**: từ vựng trong câu thường được tra liên tiếp. Prefetch best-effort (không await, không block, catch lỗi) giảm độ trễ khi user di chuyển sang từ tiếp theo.

## Consequences

- Hover chỉ fire khi cursor dừng; di nhanh qua text không còn spam lookup.
- Popup hiện nhanh hơn đáng kể khi dừng; repeat-hover gần như instant nhờ cache.
- Giảm số request thực tế lên worker khi user rê chuột qua lại cùng vùng text.
- Tăng nhẹ memory (capped) và background request (prefetch), nhưng prefetch chỉ 1-2 từ/lần lookup.
- Cache key dùng `term.toLowerCase()` nên "Hello" và "hello" chia sẻ entry; phù hợp với hầu hết ngôn ngữ, có thể không lý tưởng cho proper noun case-sensitive nếu backend khác nhau.
- `destroy()` xóa cache; các tab khác nhau có cache riêng.
