# Implementation Plan: Web-text dictionary popup + word highlight

## Overview

Decouple `WebTriggerController` khỏi video presence bằng cách tạo `WebTextDictionaryController` ở top-level `content-script.ts`. Khi user hover/click từ trên bất kỳ trang web có text (Apple HIG, National Geographic, v.v.), hệ thống highlight target word và hiện popup dictionary. Subtitle path (YouTube video) vẫn hoạt động bình thường thông qua cùng `WebTextDictionaryController` API.

## Architecture Decisions

1. **Top-level controller:** `WebTextDictionaryController` init ở `content-script.ts`, không chờ `<video>`. Subtitle path truyền controller này vào `initContentScriptController(video, webTextCtrl)`.
2. **Word highlight:** DOM wrap `<mark class="js-cell-word-highlight">` là primary; overlay `<div class="js-cell-word-highlight-overlay">` là fallback khi range split bởi inline tags hoặc Shadow DOM closed. Subtitle token chỉ thêm class.
3. **Settings lifecycle:** `onStorageChanged` từ `@/shared/lib/chrome-apis` kích hoạt `updateSettings` + re-`attach` trigger mới. Không dùng `WebTriggerController.setTriggerMode` vì broken.
4. **One WebTriggerController instance:** Chỉ một instance cho web text; subtitle dùng `SubtitleTriggerController` riêng. `WebTriggerController` skip `.js-cell-token` để tránh double-trigger.
5. **Reuse popup/card-creator logic:** Tách `handleLookup`, `cancelLookup`, `handlePopupCardCreatorAction`, `handlePopupQuickAdd` từ `contentScriptController` closure vào `WebTextDictionaryController`.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| DOM wrap phá layout SPA (React/Vue re-render) | High | Overlay fallback; clear highlight on SPA nav; unit test restore DOM |
| `contentScriptController` refactor break subtitle path | High | Giữ test subtitle trigger hiện có; manual test YouTube sau mỗi checkpoint |
| Highlight làm vượt 1s budget | Medium | Đo latency; overlay fallback nhanh hơn wrap phức tạp; P1 optimize nếu cần |
| `Range`/`caretRangeFromPoint` khác nhau trên cross-browser | Medium | Test Chrome/Edge/Brave; jsdom mock trong unit test |
| Settings change while video active không reflect | Low | Ghi chú trong spec; re-trigger `findAndInitOverlay` khi `dp.enabled` bật lên |

## Open Questions

- Apple HIG / National Geographic có dùng open Shadow DOM không? → resolve trong manual test phase.
- `user-select: none` có block `caretRangeFromPoint` không? → resolve trong manual test phase.
- Warm latency có dưới 1s trên 1GB RAM không? → resolve trong performance measurement phase.
