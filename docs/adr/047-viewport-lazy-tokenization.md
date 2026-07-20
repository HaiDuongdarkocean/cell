# ADR-047: Viewport-Driven Lazy Tokenization (VDLT) — Hybrid Algorithm

## Context

Feature "Tokenize on Media" cần tokenize từ vựng trên:
- Trang web tiếng Anh (text page).
- Subtitle của video (subtitle overlay/panel).

Ràng buộc:
- Extension phải chạy tốt trên thiết bị **1GB RAM**.
- Không được block UI khi tokenize nội dung dài hoặc scroll/seek nhanh.
- Phải mang lại trải nghiệm "như thể toàn bộ page đã được tokenize" mà không thực sự xử lý toàn bộ page.

Tokenize toàn bộ DOM một lúc sẽ:
- Tốn CPU, làm giật main thread.
- Tốn RAM khi giữ token data + DOM spans cho toàn bộ page.
- Làm chậm khởi động page, đặc biệt trên 1GB RAM.

## Research & Influences

Chúng em đánh giá 3 nguồn chính:

1. **LazyDOM** (Peintner et al., WEBIST 2011) — *Transparent Partial DOM Loading and Unloading for Memory Restricted Environments*.
   - Chia DOM thành fragment, load/unload on-demand để giảm memory footprint.
   - Ảnh hưởng: chiến lược **unload token data khi block/cue xa viewport**, dùng LRU để giải phóng RAM.

2. **Fast Rendering News Feed on Android** (Meta Engineering, 2015).
   - Facebook dùng viewport recycling, `prepare` / `bind` / `unbind` lifecycle, và idle scheduling để giữ 60fps trên Android ListView.
   - Ảnh hưởng: **lifecycle rõ ràng** — chuẩn bị tokenize khi idle, bind DOM khi vào viewport, unbind/cleanup khi ra khỏi viewport.

3. **Virtual Lists & Windowing with IntersectionObserver** (ObserverViewport).
   - Dùng `IntersectionObserver` sentinel + `rootMargin` (overscan buffer) để chỉ mount row trong viewport + buffer, unmount row xa.
   - Ảnh hưởng: **viewport detection** trên web, chỉ 2 sentinel được observe bất kể list dài bao nhiêu.

Quyết định: kết hợp 3 nguồn thành một thuật toán hybrid duy nhất.

## Decision

Sử dụng **Viewport-Driven Lazy Tokenization (VDLT) — Hybrid**:

- **Viewport detection** bằng `IntersectionObserver` sentinel + `rootMargin` (ObserverViewport).
- **Tokenization lifecycle** `prepare` / `bind` / `unbind` (Meta News Feed).
- **Memory management** bằng partial load/unload + LRU eviction (LazyDOM).
- **Subtitle adaptation** bằng **time-window viewport** thay vì scroll viewport.

### Lifecycle: prepare → bind → unbind

Mỗi tokenization block (text) hoặc cue window (subtitle) đi qua 3 phase:

1. **prepare**: chuẩn bị token metadata khi block/cue gần vào vùng xử lý nhưng chưa cần render ngay. Có thể chạy khi idle (`requestIdleCallback` / `Scheduler.postTask`).
2. **bind**: gắn token spans vào DOM khi block/cue nằm trong viewport + buffer. Đảm bảo thời gian bind < 16.7ms để không skip frame.
3. **unbind**: tháo token spans, cleanup event listeners/data khi block/cue ra khỏi buffer xa.

### 1. Text Page

- Chia page thành các **tokenization block** (paragraph, section, hoặc text node container có kích thước hợp lý).
- Đặt **top sentinel** và **bottom sentinel** tại rìa của mounted range.
- Dùng một `IntersectionObserver` duy nhất với `rootMargin` mở rộng (overscan buffer) theo dõi 2 sentinel.
- Khi sentinel vượt boundary:
  1. Tính lại mounted range dựa trên row-height / block-position cache.
  2. `prepare` các block mới trong vùng đệm khi idle.
  3. `bind` các block vào viewport, `unbind` các block ra khỏi vùng đệm xa.
- Xử lý chunk bằng `requestIdleCallback` / `Scheduler.postTask` / `setTimeout(0)` với yield sau mỗi chunk nhỏ (ví dụ 50-100 từ hoặc 5-10ms).

### 2. Subtitle Video

- "Viewport" được định nghĩa theo **cửa sổ thời gian** thay vì vùng màn hình.
- Với mỗi thời điểm `currentTime`:
  - Active cue + N cue trước/sau là vùng cần tokenize.
  - Các cue cũ hơn hoặc xa hơn trong tương lai có thể giữ cache hoặc cleanup.
- Khi seek nhanh, cue trong cửa sổ mới được ưu tiên `prepare`/`bind`; cue cũ xa khỏi cửa sổ được `unbind`.

### 3. Cache & Memory Management

- Cache key: text content hash hoặc node/cue reference.
- Cache value: tokenization result (span structure hoặc token metadata).
- Giới hạn cache:
  - Tối đa `MAX_CACHED_VIEWPORTS` (ví dụ 3-5 viewport tương đương) cho text page.
  - Tối đa `MAX_CACHED_CUES` (ví dụ 20-50 cue) cho subtitle.
- Khi đầy, **LRU eviction**: xóa block/cue xa viewport nhất.
- Dùng `WeakMap`/`WeakRef` cho DOM → data mapping để GC có thể thu dọn khi DOM bị thay thế (SPA navigation, dynamic content).
- Tránh giữ toàn bộ token data trong một object khổng lồ; phân tán theo block/cue.

### 4. Cleanup Strategies

- **Soft cleanup**: tháo DOM spans, giữ lại cache data. Dùng khi block ra khỏi đệm nhưng vẫn có thể quay lại.
- **Hard cleanup**: xóa cả DOM spans lẫn cache data. Dùng khi cache đầy hoặc block quá xa.
- Cleanup phải restore original text nodes/structure để không làm hỏng layout hoặc selection.

### 5. Fast Scroll / Seek Fallback

- Khi user scroll/seek nhanh vượt quá vùng đã tokenize:
  - Text vẫn hiển thị dạng plain text, không nhảy dòng.
  - Tokenize xuất hiện dần khi dừng scroll hoặc có idle time.
- Đệm đủ lớn (1-2 viewport) để scroll thường không lộ plain text.

## Consequences

### Pros

- **Tiết kiệm RAM**: chỉ giữ token data cho viewport + đệm thay vì toàn bộ page (LazyDOM + LRU).
- **Không block UI**: prepare chạy idle, bind chia nhỏ theo frame; lifecycle rõ ràng (Meta News Feed).
- **Viewport detection hiệu quả**: chỉ 2 sentinel observe bất kể page dài (ObserverViewport).
- **Mở rộng được**: cùng một pattern áp dụng cho cả text page và subtitle.
- **Tốt cho 1GB RAM**: giảm memory pressure và GC jank.

### Cons

- **Code phức tạp hơn**: cần quản lý viewport, queue, cache, observer, lifecycle, cleanup.
- **Có thể thấy plain text khi scroll/seek rất nhanh**: cần đệm đủ lớn và tối ưu để giảm hiện tượng này.
- **Cần xử lý dynamic content**: SPA navigation, infinite scroll, lazy-loaded content cần cập nhật observer và cache.
- **Subtitle timing phụ thuộc vào video events**: cần đồng bộ với `currentTime`, seek, pause/play.
- **Sentinel / range computation cần cache block height**: block text có chiều cao biến đổi theo font/window size, cần cập nhật khi resize.

## Open Questions

- Kích thước đệm (buffer) bao nhiêu màn hình là tối ưu cho trải nghiệm mượt trên 1GB RAM?
- Giới hạn cache LRU cụ thể là bao nhiêu block/cue hoặc MB?
- Nên dùng `requestIdleCallback` hay `Scheduler.postTask` hay custom `setTimeout(0)` với `performance.now()` để yield?
- Subtitle token nên re-use span từ `WordHighlight`/`subtitleBlockCss` hay cần token container riêng?
- Có nên off-load tokenization sang Web Worker để tránh block main thread hoàn toàn? (Cần cân nhắc chi phí serialize DOM và message passing.)
- Làm sao duy trì `prepare` / `bind` / `unbind` lifecycle mà không làm phức tạp hóa `WebTriggerController` và `SubtitleTriggerController` hiện tại?
