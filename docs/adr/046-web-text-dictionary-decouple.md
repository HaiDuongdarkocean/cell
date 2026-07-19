# ADR-046: Decouple web-text dictionary popup from video presence

## Status

Accepted

## Context

`WebTriggerController` (commit `865e391`, `231b688`, `cee1f30`) cung cấp hover/click lookup trên mọi text node trong trang. Tuy nhiên, nó chỉ được khởi tạo bên trong `contentScriptController` (subtitle overlay controller), mà controller này chỉ chạy khi `findAndInitOverlay` tìm thấy `<video>` ready. Kết quả: trên các trang không có video (blog, docs, articles như Apple HIG, National Geographic), `WebTriggerController` là dead code — user không thể tra cứu.

Ngoài ra, user yêu cầu highlight target word trong trang khi lookup trigger, để biết hệ thống đang tra từ nào.

## Decision

1. Tách web-text dictionary popup thành một top-level controller (`WebTextDictionaryController`) khởi tạo ở `content-script.ts`, độc lập với `initContentScriptController(video)`.
2. `WebTextDictionaryController` quản lý:
   - `WebTriggerController` (document-level mouse move/up).
   - `WordHighlight` (temporary marker trên target word/token).
   - `popupDictionaryController` state + `popupShell`.
   - `handleLookup` / `cancelLookup` callbacks.
3. Subtitle path (`contentScriptController`) sử dụng chung `WebTextDictionaryController` API thay vì tự quản lý popup state. `SubtitleTriggerController` chỉ cần gọi `handleLookup` và `showHighlight(span)`.
4. `WebTriggerController` document-level skip `.js-cell-token` để tránh double-trigger với subtitle token trigger.
5. Word highlight:
   - Primary: DOM wrap bằng `<mark class="js-cell-word-highlight">`.
   - Fallback: overlay `<div class="js-cell-word-highlight-overlay">` nếu range không continuous hoặc nằm trong Shadow DOM closed.
   - Subtitle token: chỉ thêm class `.js-cell-word-highlight`.
6. Settings change: dùng `onStorageChanged` để detach/reattach controller khi `dp.enabled` hoặc `triggerMode` thay đổi. Không dùng `WebTriggerController.setTriggerMode` hiện tại vì nó bị broken (readonly deps, listeners cũ vẫn dùng mode cũ).

## Alternatives considered

### A. Keep `WebTriggerController` inside `contentScriptController`, remove video gate
- **Why rejected:** `contentScriptController` vẫn cần `<video>` để mount subtitle overlay. Bỏ gate sẽ làm controller chạy trên mọi trang, gây lỗi vì nó cố gắng mount UI liên quan đến video/subtitle. Tách hoàn toàn web-text lookup ra mới sạch.

### B. Separate content-script entrypoint chỉ cho dictionary
- **Why rejected:** CRXJS config thêm 1 entrypoint phức tạp hơn; `content-script.ts` đã inject trên `<all_urls>`. Khởi tạo top-level trong cùng file đơn giản và đủ.

### C. Top-level init `WebTriggerController` trong `content-script.ts` (chosen)
- **Why chosen:** Minimal change, reuse existing `WebTriggerController` / `popupShell` / `lookupOrchestrator`, dễ settings lifecycle. Chỉ cần tách popup state và card creator callbacks ra khỏi `contentScriptController` closure.

### D. Không làm highlight
- **Why rejected:** User requirement rõ ràng: "làm nổi background của chữ lên như người dùng select". Highlight cần thiết cho UX.

### E. CSS Custom Highlight API
- **Why rejected:** Chưa supported trên Firefox và một số Chromium cũ. Extension cần cross-browser (Chrome/Edge/Brave). Chỉ dùng nếu target audience là Chromium-only trong tương lai.

## Consequences

- **Positive:**
  - Dictionary popup hoạt động trên mọi trang web có text.
  - Chỉ 1 `WebTriggerController` instance, 1 `SubtitleTriggerController` instance — rõ ràng hơn 2 WebTrigger song song.
  - `WordHighlight` reusable cho cả web text và subtitle token.
- **Negative / Risks:**
  - DOM wrap có thể phá layout trang SPA nếu React/Vue diff text node. Mitigate: overlay fallback + clear on SPA navigation.
  - Highlight tính toán range/rect thêm latency. Mitigate: đo và optimize; overlay fallback nhanh hơn wrap phức tạp.
  - `WebTextDictionaryController` cần tách `handlePopupCardCreatorAction` / `handlePopupQuickAdd` khỏi `contentScriptController` closure. Card creator dialog mount container sẽ là `document.body` cho web text.
  - Settings lifecycle phức tạp hơn: cần `onStorageChanged` listener.

## Failure modes

| Scenario | Behavior |
|---|---|
| Hover over whitespace/punctuation | `extractWordAtOffset` returns null → no highlight, no popup. |
| Word split by inline tags (`<em>ap</em>ple`) | DOM wrap fails → fallback overlay; popup still opens. |
| Range in closed Shadow DOM | DOM wrap inaccessible → overlay fallback. |
| Settings disabled while popup open | Controller detach, popup dismiss, highlight clear. |
| New lookup before previous result | Cancel previous `LOOKUP_REQUEST`, clear old highlight, render new. |
| IDB empty / no result | Popup shows empty state, highlight remains until dismiss. |
| `caretRangeFromPoint` returns null on `user-select:none` | Skip hover; click selection still works. |
| SPA navigation | `beforeunload` / observer clears highlight to avoid stale DOM. |

## Lifecycle

```
Trigger (hover/click/select)
  → WebTriggerController builds Range + LookupRequest
  → WebTextDictionaryController.showHighlight(Range|Element)
  → sendMessage(LOOKUP_REQUEST)
  ← LOOKUP_RESULT
  → showPopup(winner, anchorRect)
  → appendCandidate(rest)

Dismiss / Cancel / New trigger / Settings disabled / SPA nav
  → clearHighlight()
  → popup dismiss
  → cancel in-flight request
```

## Monitoring

- `performance.now()` logs: trigger → popup render latency.
- Error logging: highlight wrap failures, `LOOKUP_REQUEST` errors, invalid ranges.
- Manual test checklist: Apple HIG, National Geographic, YouTube subtitle.

## References

- Spec: `docs/specs/web-text-dictionary-popup.md`
- Intent: `docs/intent/web-text-dictionary-popup.md`
- Existing code: `src/features/dictionaryPopup/trigger/webTriggerController.ts`, `src/features/subtitle/ui/contentScriptController.ts`, `src/features/dictionaryPopup/ui/popupShell.ts`
