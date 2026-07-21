# ADR-050: MutationObserver Fast Path via requestAnimationFrame for Instant Tokenize

## Context

Sau ADR-049, tokenize đã mượt hơn trên Facebook, nhưng khi scroll xuống vẫn có khoảng trễ
~300-800ms trước khi text mới xuất hiện dưới dạng token. Nguyên nhân là `MutationObserver`
re-scan vẫn dùng trailing debounce 300ms với max-delay cap 1500ms. Trên Facebook, mutations
đến liên tục do lazy-load + re-render; dù đã có max-delay cap, user vẫn thấy text "nguyên vẹn"
một lúc rồi mới bị tách từ.

Ngoài ra:
- Các block mới được `observe` qua `IntersectionObserver`, nhưng IO callback không đồng bộ,
  làm trễ thêm 1-2 frame trước khi `onEnter` schedule bind.
- `blocks: TokenBlock[]` array trong controller tích lũy tất cả block từ scan + mutation;
  khi `TokenizeCache` evict LRU, block vẫn còn trong `blocks`, gây grow vô hạn trên session
  dài và làm `applyStatusForTerm`/`unbindAll` lặp qua nhiều entry đã detached.
- Text node thay đổi nội dung (`characterData`) không được re-tokenize; một số SPA cập nhật
  text in-place thay vì thay thế node.

## Evidence (Edge DevTools MCP, Facebook feed, build mới)

Trước fast path:
- Scroll 1200px: token count giữ nguyên ~58 trong ~1.8s, sau đó mới tăng.
- `performance.now()` samples qua `requestAnimationFrame`: count thay đổi rất ít trong
  500ms đầu, chỉ tăng mạnh sau khi max-delay cap 1500ms fire.

Sau fast path:
- Scroll 1200px: token count cập nhật trong vòng 1-3 frame (~50-300ms).
- rAF samples: t=115ms count từ 298 → 324, t=319ms ổn định 357 tokens.
- Vùng viewport ở scrollY=9718: 137/148 text parents tokenized (~93%).
- Console không có lỗi từ tokenize renderer/scheduler.

## Decision

Thực hiện 4 thay đổi trong `features/tokenize`:

1. **MutationObserver `requestAnimationFrame` fast path** (`webTokenizeController.ts`)
   - Mỗi khi `MutationObserver` nhận `addedNodes`, lập tức `requestAnimationFrame` để
     xử lý batch ngay frame kế tiếp, không chờ trailing debounce 300ms.
   - Giữ `setTimeout` fallback với `MAX_MUTATION_SCAN_DELAY_MS` để xử lý residual batch
     khi mutations dừng hoặc khi tab background throttling khiến rAF không chạy.

2. **Eager sync bind for in-viewport blocks** (`webTokenizeController.ts`)
   - Sau `observeBlock`, gọi `tryBindVisible(block)`: nếu `getBoundingClientRect()` cho thấy
     element đang trong viewport margin 300px, thêm vào `visibleElements` và bind đồng bộ
     ngay lập tức.
   - Tách `prepareAndBind` cũ thành `bindVisibleBlock` (bind nếu chưa bound) và
     `rebindVisibleBlock` (force rebind cho layer toggle / status update) để tránh double
     unbind/bind khi eager path và `onEnter` callback cùng chạy.

3. **Prune `blocks` array on cache eviction + clean `domMap`** (`webTokenizeController.ts`,
   `tokenizeCache.ts`)
   - `TokenizeCache.onEvict` vừa `unbindTokenBlock` vừa xóa block khỏi `blocks` array.
   - `TokenizeCache` gỡ block bị evict/`delete` khỏi `domMap` WeakMap, tránh `getByElement`
     trả về block đã evicted.

4. **Handle `characterData` mutations** (`webTokenizeController.ts`)
   - Observer options thêm `characterData: true`.
   - Khi một text node đã được cache thay đổi nội dung, reset `block.tokens` và `isBound`,
     sau đó `bindVisibleBlock` nếu parent còn visible.

## Why (chỉ WHY)

- **rAF fast path**: trailing debounce 300ms là tối ưu cho batch processing, nhưng trên SPA
  nặng nó là độ trễ nhìn thấy được. `requestAnimationFrame` chạy trước paint, cho phép text
  được tách từ ngay khi DOM xuất hiện, đáp ứng yêu cầu "parse <1s như ngay lập tức".
- **Eager bind**: `IntersectionObserver` là async theo spec; nếu element đã visible khi tạo
  block, ta không cần chờ callback. Điều này cắt 1-2 frame (16-33ms) và loại bỏ rủi ro IO
  không fire khi intersection state không đổi.
- **Prune blocks + domMap**: `blocks` array là nguồn memory growth tiềm tàng khi user lướt
  dài. Eviction phải là end-to-end: cache, domMap, và controller state đều dọn.
- **characterData**: một số framework (React, Vue, Svelte) có thể update `textContent` in-place
  cho các node leaf. Nếu bỏ qua, text đã tokenize sẽ trở nên stale hoặc biến mất.

## Trade-offs

- `getBoundingClientRect()` trong `tryBindVisible` là synchronous layout read. Gọi cho mỗi
  block mới trong initial scan hoặc mutation batch có thể gây forced reflow nếu DOM đang
  thay đổi. Rủi ro thấp vì chỉ chạy khi tạo block mới, không phải mỗi frame.
- rAF fast path process toàn bộ `pendingAddedNodes` trong một frame. Nếu Facebook thêm một
  subtree rất lớn (hàng nghìn nodes) trong một mutation, frame có thể bị block. Upgrade path:
  cắt `processAddedNodes` thành chunks theo `performance.now()` budget.
- `characterData: true` kết hợp `subtree: true` có thể nhận nhiều events trên các input/textarea
  hoặc contenteditable. Tuy nhiên `handleCharacterDataMutation` chỉ re-tokenize nếu text node
  thuộc block đã cache, nên sẽ không xử lý input fields.
