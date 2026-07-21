# ADR-048: Tokenize Activation & Re-scan Starvation Fix trên Heavy SPA

## Context

Trên `https://www.facebook.com/` (và các SPA nặng tương tự: Twitter, Instagram),
tokenize "có lúc được, có lúc không" — đôi khi 0 token suốt 9s+ sau load, đôi khi
token xuất hiện rồi biến mất sau re-render của framework.

## Evidence (Edge DevTools MCP, Fast 3G + 6x CPU throttle — mô phỏng thiết bị mục tiêu)

```
Trước fix:
t=1..9s : 0 token (togglePressed=true, readyState=complete)
t=10    : 15 token (activation cuối cùng fire sau ~10s)
t=17    : 177 -> 39 (Facebook re-render wipe spans)
t=20..49: stuck 62 (mutation re-scan không fire)
t=50..52: 39 -> 270 (mutation burst pause -> re-scan fire)

Sau fix:
t=1     : 44 token (activation fire trong <1s sau load)
t=2..5  : ramp 72 -> 98 -> 220 -> 325
t=6..25 : stable 325 (20s, không decline)
```

## Root Cause

Ba lỗi cộng gộp:

1. **Activation gate starvation** — `activateAfterStability` chờ 500ms KHÔNG có
   mutation nào trước khi `setActive(true)`. SPA nặng mutate liên tục → timer reset
   mãi → không bao giờ fire (hoặc fire sau 10s+ trên thiết bị chậm).

2. **Mutation re-scan starvation** — `MutationObserver` re-scan dùng pure trailing
   debounce 300ms. Mutation liên tục mỗi <300ms → timer reset mãi → re-scan không
   bao giờ fire → content mới/replaced không được tokenize.

3. **ViewportTracker miss trên re-observe** — khi SPA re-render text nhưng reuse
   parent element, re-scan tạo block mới cho element đã intersecting.
   `IntersectionObserver` không fire callback mới vì intersection state không đổi
   → `onEnter` không fire cho handler mới → block mới không được schedule bind.

## Decision

Thêm **hard cap (max-delay)** cho cả hai trailing debounce + fire `onEnter` đồng bộ
cho handler mới trên element đã intersecting:

- `MAX_ACTIVATION_DELAY_MS = 3000` — activate sau khi `load` + max 3s bất kể mutation.
- `MAX_MUTATION_SCAN_DELAY_MS = 1500` — re-scan sau max 1.5s kể từ mutation đầu tiên
  của window hiện tại, bất kể mutation tiếp tục.
- `ViewportTracker.observe`: nếu element đã `state=true` (intersecting), gọi
  `handlers.onEnter?.()` đồng bộ cho handler set mới.

## Why (chỉ WHY — theo quy ước ADR UI/NNN)

- **Cap, không bỏ gate**: gate 500ms vẫn có giá trị skip hydration burst ban đầu
  (ADR-012). Cap chỉ là sàn bảo vệ khi SPA không bao giờ "yên".
- **3000ms / 1500ms**: đủ dài để bỏ qua burst hydration ngắn, đủ ngắn để user trên
  thiết bị 1GB RAM thấy token trong vài giây (yêu cầu `<3s` response trong AGENTS.md).
- **Đồng bộ onEnter**: rẻ (1 call), đúng ngữ cảnh (element đã visible), tránh phụ
  thuộc async IO callback không bao giờ đến.

## Consequences

- Tokenize activate reliably trong <3s trên mọi SPA, bất kể mutation rate.
- Re-scan recovery sau framework re-render trong <1.5s thay vì vô hạn.
- Stale block (isBound=true nhưng span bị wipe) vẫn tích lũy — ceiling: LRU cache
  (CACHE_CAPACITY=500) evict tự động. Upgrade path: detect stale block và cleanup
  trong re-scan (out of scope fix này).
- Không thay đổi API public; 2 guard test mới chống regression.
