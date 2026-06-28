# Intent — Side Panel Subtitle

> **Giai đoạn**: G0 — Discovery/Ideation
> **Trạng thái**: Confirmed (đã brainstorm + interview)
> **Ngày**: 2026-06-28

## Problem Statement

Subtitle panel hiện tại inject trực tiếp vào DOM trang web, gây ra 3 vấn đề cốt lõi:

1. **F0 algorithm phức tạp, dễ sai** — tìm ancestor phù hợp để dock panel side-by-side với video. Thuật toán "farthest exact width match" chọn nhầm ancestor trên YouTube (chọn container chứa cả comments), không hoạt động trên iframe cross-origin (hhpanda, coreflix), và không universal cho mọi site.

2. **Fullscreen handler phức tạp** — panel bị fullscreen element che, cần move panel vào fullscreen element, restore khi exit. Logic fragile, dễ break.

3. **Layout phá trang web** — side-by-side flex layout thay đổi kích thước playerContainer, có thể phá CSS/JS của site (YouTube, lordflix, v.v.).

## Vision

Thay thế panel inject-DOM bằng **Chrome Side Panel API** (Chrome 114+, Edge 114+):
- Panel nằm trong UI browser, cạnh tab — **không che video**, **không bị fullscreen che**
- Panel có DOM riêng (extension origin) — **không phụ thuộc DOM trang web**
- Sync video qua message passing (content script ↔ background ↔ side panel)
- Overlay UI (subtitle text, import, drag-drop, toggle) vẫn neo vào `video.parentElement` — **không cần F0**

## Opportunity

- **Bỏ hoàn toàn** F0 algorithm, fullscreen handler, side-by-side layout, docking logic (~60% độ phức tạp hiện tại)
- **Hoạt động universal** trên mọi trang web kể cả iframe cross-origin (`all_frames: true`)
- **Mở rộng tương lai**: Side Panel là workspace đầy đủ (dictionary lookup, translate, copy/export, playback control, bookmark, note-taking)
- **Persistent**: panel stays open across tab navigation

## Constraints

- Chrome 114+ / Edge 114+ (Side Panel API)
- Sync qua message passing (~5-20ms latency) — đủ cho subtitle (cue hiển thị > 1s)
- User gesture yêu cầu để mở Side Panel programmatically (Chrome 116+: `sidePanel.open({tabId})`)
- Panel không "dock" cạnh video nữa — nằm cạnh tab (tradeoff: không che video, không bị fullscreen che)

## Out of scope (G0)

- Dictionary lookup (Yomitan-style) — future phase
- Translate (Google/DeepL/AI) — future phase
- Copy/export subtitle — future phase
- Playback control từ panel — future phase
- Bookmark/note-taking — future phase

## References

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Edge Sidebar API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar)
- [Content scripts all_frames](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- DOM inspection: themoviebox, hhpanda, coreflix, YouTube, lordflix (8 trang)
