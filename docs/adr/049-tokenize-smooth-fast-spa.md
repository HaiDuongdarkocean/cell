# ADR-049: Tokenize mượt hơn, toàn diện hơn và nhanh hơn trên heavy SPA

## Context

Tokenize trên web text (đặc biệt Facebook) gặp ba vấn đề cùng lúc:

1. **Token xuất hiện chậm / giật cục** — block phải chờ `getWordStatuses` + `getFrequencyEntries`
   từ background xong mới bind DOM. Mỗi block gửi 2 message riêng lẻ, gây N+1 round-trip.
2. **Bỏ sót content mới / re-render** — `MutationObserver` re-scan đi bộ toàn bộ `document.body`
   sau mỗi debounce. Trên Facebook với hàng nghìn node, scan này tốn CPU và dễ bỏ qua các
   node bị thay thế nhanh. Mỗi lần callback cũng bị mất mutations giữa các reset.
3. **Token biến mất sau SPA re-render** — Facebook thay thế text node/parent mà không xóa span
   token đúng cách; `block.isBound` vẫn `true` nhưng source node đã detached, dẫn đến
   `replaceChild` throw hoặc bind no-op. Một lỗi trong một task cũng có thể treo cả
   `TokenizeScheduler`.

## Evidence (Edge DevTools MCP, Facebook feed)

Trước cải tiện:

- Toggle tokenize → 0 token trong 4-5s, sau đó mới tăng từ từ.
- Scroll nhanh: content mới ở giữa màn hình không được tokenize ngay; đôi khi token
  xuất hiện rồi biến mất khi Facebook re-render.
- `TokenizeScheduler` không có error isolation: một `replaceChild` throw có thể dừng hàng đợi.

Sau cải tiện (build mới, reload extension, same session):

- Toggle tokenize → ~180 token trong <1s, metadata cập nhật mượt sau đó.
- Scroll 1200px → tokens tăng từ 58 → 113 (~470ms) → 141 (~900ms).
- Tỷ lệ text parents trong viewport được tokenize: ~85-90%.
- Console không còn lỗi từ tokenize renderer.

## Decision

Thực hiện năm thay đổi kiến trúc trong `features/tokenize`:

1. **Early bind + batched metadata** (`webTokenizeController.ts`, `textTokenizer.ts`)
   - `prepareTokenBlock` chỉ tokenize đồng bộ, lưu `block.tokens`.
   - `prepareAndBind` bind DOM ngay lập tức sau tokenization.
   - `scheduleMetadataResolve` gom tất cả terms của các block visible trong cùng một
     microtask, gửi **một** cặp `WORD_STATUSES_GET` + `FREQUENCY_GET`, sau đó rebind
     visible blocks. User thấy token sớm; status/frequency cập nhật mượt mà không bị flash.

2. **Incremental MutationObserver re-scan** (`tokenizeBlock.ts`, `webTokenizeController.ts`)
   - Thêm `findTextBlocksInNodes(nodes)` chỉ duyệt `MutationRecord.addedNodes` thay vì
     toàn bộ body; skip `!isConnected` và node bên trong `.js-cell-token`.
   - Controller tích lũy `addedNodes` qua nhiều callback nhanh, flush toàn bộ batch khi
     debounce fire, tránh mất mutations giữa các reset.

3. **Defensive renderer** (`tokenSpanRenderer.ts`, `types.ts`)
   - `bindTokenBlock` kiểm tra `parent.contains(sourceNode)` trước `replaceChild`;
   nếu source node bị SPA xóa thì bỏ qua thay vì throw.
   - `unbindTokenBlock` nếu source node detached thì tạo text node mới từ
     `block.originalText` và cập nhật `block.sourceNodes`.
   - `TokenBlock.sourceNodes` chuyển từ `readonly` sang mutable để renderer có thể
     cập nhật node mới sau re-render.

4. **Scheduler error isolation** (`tokenizeScheduler.ts`)
   - `runLoop` bọc mỗi task trong `try/catch`; một task fail không treo toàn bộ queue.

5. **Larger viewport buffer + cache touch** (`webTokenizeController.ts`, `tokenizeCache.ts`)
   - `VIEWPORT_ROOT_MARGIN` từ `150px` lên `300px` để giữ token lâu hơn khi scroll.
   - `TokenizeCache.touch(block)` gọi khi bind để visible/bound blocks không bị evict sớm.

## Why (chỉ WHY)

- **Early bind**: người dùng thấy text được tách từ ngay lập tức; metadata là layer visual
  bổ sung, không phải gate cho việc hiển thị. Phù hợp yêu cầu `<3s` response.
- **Batch metadata**: giảm từ O(blocks) message xuống 1 message per microtask, loại bỏ
  bottleneck chính trên Facebook nhiều paragraph.
- **Incremental scan**: tránh đi bộ toàn body (có thể 1000+ text nodes) sau mỗi re-render;
  chỉ xử lý node thực sự thay đổi, phù hợp thiết bị 1GB RAM.
- **Defensive renderer**: SPA (React/Vue/Angular) thường xuyên thay thế DOM; renderer
  phải chấp nhận text node bị detached và tự phục hồi thay vì crash hoặc no-op.
- **Scheduler resilience**: lỗi một block không được phép dừng toàn bộ pipeline; đây là
  invariant của hệ thống lazy tokenization.

## Trade-offs

- `sourceNodes` mutable: mất một chút immutability, nhưng DOM node vốn là mutable runtime
  object, nên đây là mô hình trung thực hơn.
- `findTextBlocksInNodes` vẫn cần fallback/duyệt subtree khi added node là `DocumentFragment`
  hoặc element cha lớn; chi phí vẫn thấp hơn đi bộ toàn `body`.
- Batch metadata delay 0ms (`setTimeout(0)`) có thể trì hoãn status/frequency một tick;
  đây là trade-off chấp nhận được vì token đã hiển thị trước.
