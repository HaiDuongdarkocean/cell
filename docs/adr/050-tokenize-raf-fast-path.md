# ADR-050: MutationObserver Fast Path for Instant Tokenize

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
- Trên máy 500MB RAM, cache 500 blocks + viewport margin 300px giữ quá nhiều DOM references.
- `TokenizeScheduler` viewport-priority tasks dùng `setTimeout(..., 0)` nhưng `timeRemaining()`
  trả về hằng số 16ms, nên toàn bộ queue viewport có thể chạy trong một frame dài.

## Evidence (Edge DevTools MCP, Facebook feed, build mới)

Trước fast path:
- Scroll 1200px: token count giữ nguyên ~58 trong ~1.8s, sau đó mới tăng.
- `performance.now()` samples qua `requestAnimationFrame`: count thay đổi rất ít trong
  500ms đầu, chỉ tăng mạnh sau khi max-delay cap 1500ms fire.

Sau fast path:
- Scroll 1200px: token count cập nhật trong ~100-200ms (queueMicrotask + eager bind).
- Coverage viewport trên Facebook: >90% text parents visible được tokenized.
- Console không có lỗi từ tokenize renderer/scheduler.

## Decision

Thực hiện các thay đổi trong `features/tokenize`:

1. **MutationObserver `queueMicrotask` fast path** (`webTokenizeController.ts`)
   - Mỗi khi `MutationObserver` nhận `addedNodes`, schedule `queueMicrotask` để flush batch
     ngay trong cùng event loop, trước khi browser paint, cắt ~16ms so với `requestAnimationFrame`.
   - Giữ `setTimeout` fallback với `MAX_MUTATION_SCAN_DELAY_MS` cho tab background/throttling.
   - `pendingAddedNodes` được cắt thành từng nhóm `PENDING_MUTATION_LIMIT` (1000 nodes) để tránh
     một microtask duy nhất đi qua subtree DOM quá lớn trên máy 500MB RAM.

2. **Eager sync bind cho mutation batch nhỏ; initial scan dùng IntersectionObserver**
   (`webTokenizeController.ts`)
   - `observeBlock(block, eager)` chỉ gọi `tryBindVisible` khi batch có <=50 nodes. Các batch lớn
     (hydration, re-render subtree) dùng `IntersectionObserver`, tránh hàng trăm lần
     `getBoundingClientRect` synchronous layout read.
   - `scanAndObserveBlocks` (initial full-page scan) không dùng eager bind để tránh forced
     reflow khi DOM đang load.

3. **Dynamic cache capacity theo `navigator.deviceMemory`** (`webTokenizeController.ts`)
   - <=0.5 GiB: 100 blocks; <2 GiB: 150 blocks; >=2 GiB: 250 blocks.
   - `VIEWPORT_ROOT_MARGIN` giảm từ 300px xuống 200px để giảm số block resident trên máy yếu.

4. **Prune `blocks` array on cache eviction + clean `domMap`** (`webTokenizeController.ts`,
   `tokenizeCache.ts`)
   - `TokenizeCache.onEvict` vừa `unbindTokenBlock` vừa xóa block khỏi `blocks` array.
   - `TokenizeCache` gỡ block bị evict/`delete` khỏi `domMap` WeakMap.

5. **Xử lý `characterData` và `removedNodes` mutations** (`webTokenizeController.ts`)
   - `characterData: true` để re-tokenize text node thay đổi nội dung in-place.
   - `removedNodes` để `unobserve` element bị xóa, xóa khỏi `visibleElements`, và xóa block
     khỏi cache/controller, giảm memory leak khi SPA re-render.

6. **Evict stale block khi `bindTokenBlock` thất bại** (`webTokenizeController.ts`)
   - Nếu source node hoặc parent bị detach giữa scan/observe và bind, xóa block khỏi `blocks`
     và cache để mutation tiếp theo tạo block mới, tránh để text untokenized.

7. **TokenizeScheduler viewport budget thực** (`tokenizeScheduler.ts`)
   - Viewport-priority tasks dùng `setTimeout(..., 0)` nhưng đo thời gian thực tế qua
     `performance.now()`; nếu queue dài, yield sau ~16ms để không block main thread trên
     máy yếu.

## Why (chỉ WHY)

- **queueMicrotask fast path**: `requestAnimationFrame` đợi 16ms frame kế tiếp, đủ để user
  thấy text nguyên vẹn. `queueMicrotask` flush ngay sau synchronous mutations, trước paint,
  giảm độ trễ xuống gần bằng thời gian tokenize + DOM insert.
- **Eager bind có chọn lọc**: `getBoundingClientRect` cho từng block trong batch lớn là
  forced-reflow nguy hiểm; nhưng với batch nhỏ (lazy-load 1 post) thì sync bind rất nhanh và
  cắt IO async frame.
- **Cache capacity động**: máy 500MB RAM không thể giữ 500 blocks; `navigator.deviceMemory`
  cho hint sơ bộ để giảm resident blocks mà không cần detect memory phức tạp.
- **Prune blocks + domMap**: `blocks` array là nguồn memory growth tiềm tàng khi user lướt
  dài. Eviction phải là end-to-end: cache, domMap, và controller state đều dọn.
- **removedNodes cleanup**: SPA re-render xóa và thay thế subtree liên tục; để element bị
  xóa vẫn được observe và cache giữ reference là memory leak rõ ràng.
- **Stale bind eviction**: giữa `observe` và `bind` có thể có re-render; nếu source node đã
  bị detach, block cũ trở nên stale. Xóa nó để `processAddedNodes` tạo block mới cho text
  node mới, tránh text bị bỏ sót.
- **Viewport budget thực**: `timeRemaining()` hằng số khiến viewport queue chạy hết trong một
  frame, gây jank trên máy yếu. Đo `performance.now()` và yield giữa các chunk.

## Trade-offs

- `queueMicrotask` chạy trước paint; nếu batch rất lớn vẫn có thể block. Đã giảm bằng
  `PENDING_MUTATION_LIMIT` chunking.
- `navigator.deviceMemory` không chính xác và không có trên mọi trình duyệt; fallback 250 blocks.
- `removedNodes` cleanup chỉ xử lý element trực tiếp bị xóa, không traverse descendants để
  tránh cost lớn. Các block con bị xóa cùng subtree vẫn tồn tại đến khi LRU eviction.
- `bindTokenBlock` thất bại do detached source node sẽ xóa block; nếu text node chỉ tạm thời
  detach và sắp re-attach, block phải được tạo lại từ `addedNodes` mutation.
