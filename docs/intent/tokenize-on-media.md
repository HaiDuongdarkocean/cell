# Intent — Tokenize on Media (Simplified Native)

## Confirmed Intent

- **Outcome:** Khi đọc trang web tiếng Anh hoặc xem video có subtitle, từ vựng được tokenize và highlight theo status/frequency ngay trong ngữ cảnh. User bật/tắt tokenize + layer Status/Frequency qua float badge; đổi status từ (unknown/tracking/known/ignore) và tra cứu/IPA qua Popup Dictionary đã có.
- **User:** Người học tiếng Anh ở mọi cấp độ, tự chọn nội dung web phù hợp trình độ.
- **Why now:** Chuyển từ "tra từ điển thủ công" sang "nhìn thấy từ vựng trong ngữ cảnh đọc" với ma sát tối thiểu, kể cả trên subtitle video.
- **Success:** User đọc/xem nội dung thật với ít ma sát hơn, dễ nhận diện và thu thập từ vựng đáng học; badge đơn giản, không che nội dung, không tạo popup mới; UI không bị lag dù ở cấu hình 1GB RAM.
- **Constraint:**
  - Ban đầu chỉ **trang web văn bản** và **subtitle video**; PDF/image/video frames chưa làm.
  - **Tối ưu cho 1GB RAM**: không tokenize toàn bộ page một lúc.
  - Dùng **Viewport-Driven Lazy Tokenization (VDLT) — Hybrid** — kết hợp `IntersectionObserver` sentinel + `prepare/bind/unbind` lifecycle + LRU memory cap.
  - Manual bật lần đầu qua badge, sau đó hệ thống **tự động tokenize lại theo domain/URL đã bật**.
  - Options/Popup settings vẫn còn, không xóa, không link từ badge.
- **Out of scope:** Badge manager 7 nhóm IA phức tạp; word popup riêng; hiển thị IPA trên token; auto-tokenize mọi trang lạ; xóa Options/Popup settings; tokenize audio/video frames.

## Key Interaction Flows

1. **Bật tokenize:** User nhấn float badge → mở mini panel → toggle **Tokenize page**. Hệ thống tokenize trang, highlight từ theo status/frequency. Lần sau vào cùng domain/URL, tokenize tự động bật lại.
2. **Tắt/hiện layer:** Trong mini panel, toggle **Status** và **Frequency** độc lập.
3. **Đổi status từ:**
   - Desktop: hover token + phím tắt `1/2/3/4` (unknown/tracking/known/ignore); `Ctrl/Cmd+click` multi-select + phím tắt để batch.
   - Mobile: tap token → mở Popup Dictionary đã có sẵn của hệ thống → xem định nghĩa và đổi status trong đó.
4. **Tra cứu/IPA:** Mở Popup Dictionary từ mini panel hoặc từ tap token.
5. **Badge behavior:** Float badge ở góc phải dưới, draggable. Không cần indicator trạng thái ngoài mini panel.
6. **Subtitle video:** Khi video có subtitle, subtitle overlay/panel tokenize các cue trong cửa sổ thời gian hiện tại + N cue trước/sau. Các cue ngoài cửa sổ không tokenize (hoặc giữ cache LRU).

## Algorithm — Viewport-Driven Lazy Tokenization (VDLT) — Hybrid

Thuật toán lai từ 3 nguồn:
- **ObserverViewport** (`IntersectionObserver` sentinel + `rootMargin` overscan buffer) cho viewport detection.
- **Meta News Feed on Android** (`prepare` / `bind` / `unbind` lifecycle + idle scheduling) cho UI smoothness.
- **LazyDOM** (partial DOM loading/unloading + LRU eviction) cho memory management.

### Lifecycle: prepare → bind → unbind

Mỗi tokenization block (text) hoặc cue window (subtitle):
1. **prepare**: chuẩn bị token metadata khi block/cue gần vào vùng xử lý — chạy khi idle.
2. **bind**: gắn token spans vào DOM khi block/cue nằm trong viewport + buffer. Mỗi lần bind < 16.7ms.
3. **unbind**: tháo spans, cleanup data khi block/cue ra khỏi buffer xa.

### Text Page

- Chia page thành các **tokenization block** (paragraph, section).
- Đặt **top/bottom sentinel** tại rìa mounted range; một `IntersectionObserver` + `rootMargin` theo dõi 2 sentinel.
- Khi sentinel vượt boundary: tính lại range, `prepare` block trong đệm, `bind` block vào viewport, `unbind` block xa.
- Xử lý chunk bằng `requestIdleCallback` / `Scheduler.postTask` / `setTimeout(0)` với yield sau mỗi chunk nhỏ.

### Subtitle Video

- Viewport là **cửa sổ thời gian**: active cue + N cue trước/sau.
- Khi `currentTime` thay đổi hoặc seek: ưu tiên `prepare`/`bind` cue trong cửa sổ mới, `unbind` cue cũ xa.

### Memory Management

- Cache tokenization theo block/cue, giới hạn `MAX_CACHED_VIEWPORTS` / `MAX_CACHED_CUES`.
- LRU eviction khi đầy; xóa block/cue xa viewport nhất.
- Dùng `WeakMap`/`WeakRef` cho DOM → data mapping để GC thu dọn.

### Fast Scroll / Seek Fallback

- Scroll/seek nhanh quá vùng đã tokenize → text vẫn plain, không nhảy dòng; tokenize xuất hiện dần khi dừng/có idle time.
- Đệm 1-2 viewport để scroll thường không lộ plain text.

## Assumptions to Validate

- [ ] Popup Dictionary hiện tại hỗ trợ nhận message/endpoint để content script mở với từ được chọn và đổi status từ đó.
- [ ] User chấp nhận luồng mobile: tap token → Popup Dictionary (2 taps) để đổi status.
- [ ] Float badge + mini panel nhỏ gọn không bị coi là intrusive trên mobile/tablet.
- [ ] Tự động tokenize lại theo domain/URL không gây surprise hay privacy concern.
- [ ] known/ignore mặc định ẩn highlight là đủ "sạch" để đọc; hover hiện status underline là đủ useful.
- [ ] VDLT Hybrid đủ nhanh trên cấu hình 1GB RAM để scroll/seek không bị lag hoặc plain text lộ rõ.
- [ ] Subtitle overlay/panel hiện tại cho phép inject token spans vào cue text mà không làm vỡ layout hoặc timing.
