# Tokenize on Media — Simplified Native

## Problem Statement

> HMW let English learners identify and mark vocabulary status directly on English web pages and video subtitles, with minimal friction, while keeping the control surface discoverable and responsive across desktop, tablet, and mobile — even on 1GB RAM devices?

## Recommended Direction

- **Simplified Native**: Float badge chỉ là trigger + toggle surface.
- **Badge mini panel** chứa 3 toggle: **Tokenize page**, **Status**, **Frequency** — và một nút mở **Popup Dictionary**.
- **Đổi status từ** (unknown/tracking/known/ignore) và **tra cứu/IPA** đi qua **Popup Dictionary đã có sẵn** — không tạo word popup mới.
- **Manual activation lần đầu**, sau đó **tự động tokenize lại theo domain/URL đã bật**.
- **Giữ Options/Popup settings làm fallback**, không xóa, không link từ badge.
- **Viewport-Driven Lazy Tokenization (VDLT) — Hybrid** cho cả text page lẫn subtitle video — tối ưu 1GB RAM, không block UI.

## Key Assumptions to Validate

- [ ] Popup Dictionary hiện tại hỗ trợ nhận message/endpoint để content script mở với từ được chọn và đổi status từ đó.
- [ ] User chấp nhận luồng mobile: tap token → mở Popup Dictionary (2 taps) để vừa tra vừa đổi status.
- [ ] Float badge + mini panel nhỏ gọn không bị coi là intrusive trên mobile/tablet.
- [ ] Tự động tokenize lại theo domain/URL đã bật không gây surprise hay privacy concern.
- [ ] known/ignore mặc định ẩn highlight là đủ "sạch" để đọc; hover hiện status underline là đủ useful.
- [ ] VDLT Hybrid đủ nhanh trên cấu hình 1GB RAM để scroll/seek không bị lag hoặc plain text lộ rõ.
- [ ] Subtitle overlay/panel hiện tại cho phép inject token spans vào cue text mà không làm vỡ layout hoặc timing.

## MVP Scope

- Float badge FAB ở góc phải dưới, draggable.
- Nhấn FAB mở mini panel gồm:
  - Toggle **Tokenize page**
  - Toggle **Status**
  - Toggle **Frequency**
  - Nút mở **Popup Dictionary**
- Token display trên host page và subtitle overlay:
  - Container `inline-block`, `vertical-align: baseline`, `line-height: inherit`.
  - Status underline 2px, `position: absolute; top: 100%`, không đẩy dòng.
  - Frequency = background color + text color của toàn bộ container.
  - Không viền outline khi hover/active.
- Status behavior:
  - `unknown` / `tracking`: hiển thị đầy đủ frequency bg + status underline.
  - `known` / `ignore`: ẩn mặc định frequency bg + status underline; hover hiện lại status underline.
  - `ignore`: thêm `opacity: 0.5` + `line-through`.
  - Dữ liệu phân tích vẫn tạo cho tất cả từ — CSS chỉ ẩn hiển thị.
- Desktop: hover token + phím tắt `1/2/3/4` đổi status; `Ctrl/Cmd+click` để multi-select + batch.
- Mobile: tap token → mở Popup Dictionary với từ đó.
- Shadow DOM host CSS isolation; embed design-system tokens và icons từ catalog.
- **VDLT Hybrid implementation:**
  - **Text page**: `IntersectionObserver` sentinel + `rootMargin` overscan buffer; chia page thành block; `prepare`/`bind`/`unbind` lifecycle; tokenize chunk khi idle; cache LRU có giới hạn.
  - **Subtitle video**: viewport là cửa sổ thời gian (active cue + N cue trước/sau); `prepare`/`bind`/`unbind` theo `currentTime`/seek; cache LRU.
  - **1GB RAM**: giới hạn cache, cleanup block/cue xa viewport, dùng `WeakMap`/DOM refs, batch DOM writes, tránh giữ toàn bộ token data trong memory.

## Not Doing (and Why)

- **Eager tokenize toàn bộ page** — chỉ tokenize viewport + đệm để tiết kiệm RAM và CPU.
- **Auto-tokenize mọi trang lạ** — chỉ tự động lại cho domain/URL đã được user bật, giảm rủi ro performance/privacy/surprise.
- **PDF/image tokenization** — ngoài constraint ban đầu; cần parser riêng.
- **Audio/video frames** (nhận diện lời nói, OCR frame) — ngoài scope, chỉ làm subtitle text.
- **Word popup riêng** — Popup Dictionary đã có sẵn, tránh duplicate surface.
- **Hiển thị IPA trên token** — giảm visual noise và tránh overlap multi-line; IPA là dữ liệu nội bộ, tra IPA qua Popup Dictionary.
- **Xóa Options/Popup settings** — giữ fallback để giảm rủi ro migration trong giai đoạn này.
- **Badge manager với 7 nhóm IA phức tạp** — ngoài scope giai đoạn này; chỉ cần 3 toggle + link đến Popup Dictionary.
- **Phân tích theo status rồi tự động gợi ý từ cần học bằng AI** — tăng complexity và resource; làm sau khi manual flow ổn định.

## Open Questions

- Popup Dictionary cần message type/endpoint gì để content script gửi `openWithWord(word)` hoặc `setStatus(word, status)`?
- Badge nên nhớ trạng thái "đã tokenize" theo domain, URL, hay origin + path pattern?
- Có nên thêm shortcut toàn cục để toggle tokenize nhanh (ví dụ `Alt+Shift+C`) không, hay chỉ click FAB?
- Kích thước đệm (buffer) bao nhiêu màn hình là đủ để scroll cảm thấy mượt trên 1GB RAM?
- Giới hạn cache LRU cụ thể là bao nhiêu block/cue hoặc MB?
- Subtitle token nên re-use span từ `WordHighlight`/`subtitleBlockCss` hay cần token container riêng?
- Khi nào mở rộng badge thành manager đầy đủ hoặc chuyển settings vào badge — gating criteria là gì?
