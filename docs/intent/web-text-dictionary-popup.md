# Intent: Web-text dictionary popup (decouple from video)

> Confirmed via `/interview-me` on 2026-07-20. Source of truth for downstream spec/plan/code.

## Outcome
Dictionary popup hoạt động trên **bất kỳ trang web nào có text** (không chỉ trang có video) — hover/click vào 1 từ → trích xuất đúng sentence + target word tại vị trí con trỏ → popup dictionary hiện.

## User
Anh yêu (học tiếng qua web content: blog, Apple HIG docs, National Geographic articles, subtitle overlay).

## Why now
`WebTriggerController` (commit `865e391`, `231b688`, `cee1f30` — 2026-07-19) là **dead code trên trang không có video**. `wireDictionaryPopup` chỉ được gọi bên trong `contentScriptController` (subtitle overlay controller), controller này chỉ init khi `findAndInitOverlay` tìm thấy `<video>` ready (`isVideoReady`). Apple HIG / National Geographic không có video → controller không init → `WebTriggerController` không attach → không có popup, bất kể trigger mode nào (click / hover / hover-ctrl / hover-shift / hover-alt).

## Success criteria
1. Hover/click 1 từ trên 2 trang test → popup hiện đúng target word + sentence chứa từ đó:
   - https://developer.apple.com/design/human-interface-guidelines/design-principles
   - https://www.nationalgeographic.com/animals
2. **Popup hiện dưới 1s** kể từ trigger đến khi render winner entry (end-to-end budget: trigger → message round-trip → IDB query → render winner).

## Constraints
- Target 1GB RAM, cross-browser (Chrome/Edge/Brave) — responsive mobile/tablet/desktop.
- DOM phức tạp: Shadow DOM, nested block elements, `user-select:none` regions.
- Cursor offset chính xác (UTF-16 offset trong textContent của block element gần nhất).
- Ngắt câu đúng theo dấu câu (EN + ZH — CJK single-char word boundary đã có trong `extractWordAtOffset`).
- 1s budget bao gồm message round-trip + IDB query + render winner (không chỉ query).

## Out of scope
- **PDF**: Chrome built-in PDF viewer là `chrome-extension://` page, content script `<all_urls>` không inject được — cần cơ chế riêng (PDF.js injection hoặc viewer override), effort tách biệt, làm sau.
- **EPUB / external reader apps**.
- **Native app text** (outside browser).

## Root cause (verified)
`src/entrypoints/content/content-script.ts`:
- `findAndInitOverlay()` chỉ gọi `initContentScriptController(video)` khi `document.querySelector('video')` trả về element thỏa `isVideoReady`.
- `initContentScriptController` (trong `contentScriptController.ts`) gọi `wireDictionaryPopup(dpSettings, ...)` chỉ khi `dpSettings?.enabled` — nhưng hàm này nằm **bên trong** controller init, sau khi video ready.
- → Trang không video: `wireDictionaryPopup` không bao giờ chạy → `WebTriggerController` không attach.

## Fix direction (không thuộc intent, chỉ ghi chú cho spec)
Decouple `WebTriggerController` init khỏi video presence:
- Init `WebTriggerController` ở top-level content-script khi `dpSettings.enabled`, độc lập với `findAndInitOverlay`.
- `extractSentenceContext` + `extractWordAtOffset` đã có sẵn trong `webTriggerController.ts` — cần verify/chỉnh sửa trên DOM phức tạp của 2 trang test (Shadow DOM, nested block, `user-select:none`).
- Đo end-to-end latency trên 2 trang test để xác định có cần cache/parallel/prefetch hay không cho budget 1s.

## Test pages
- https://developer.apple.com/design/human-interface-guidelines/design-principles
- https://www.nationalgeographic.com/animals
