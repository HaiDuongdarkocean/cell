# ADR-008: Side Panel API thay thế Inject-DOM Panel

## Status
Proposed

## Context
Subtitle panel hiện tại inject trực tiếp vào DOM trang web, gây 3 vấn đề cốt lõi (xem `docs/intent/intent-side-panel-subtitle.md`):

1. **F0 algorithm phức tạp, dễ sai** — tìm ancestor phù hợp để dock panel side-by-side. Thuật toán "farthest exact width match" chọn nhầm ancestor trên YouTube, không hoạt động trên iframe cross-origin, không universal.
2. **Fullscreen handler phức tạp** — panel bị fullscreen element che, cần move panel vào fullscreen element, restore khi exit. Logic fragile.
3. **Layout phá trang web** — side-by-side flex layout thay đổi kích thước playerContainer, phá CSS/JS site.

**Current state (AS-IS):**
- `subtitleDocking.ts`: `setupDocking`, `showPanelDocked`, `hidePanelDocked`, `enterFullscreenDocked`, `exitFullscreenDocked`, `setupFullscreenHandlers`, `applyFullscreenOverlay`, `applyFullscreenSideBySide`, `movePanelToOuterWrapper` — ~500 dòng logic phức tạp.
- `subtitlePanel.ts`: `createPanel`, `renderCueList`, `renderCueListLazy`, `createToggleButton`, `highlightCue`, `scrollToCue`, `seekToCue` — panel DOM inject vào page.
- `content-script.ts`: wire docking + fullscreen + panel + overlay + import + drag-drop + auto-load — ~390 dòng.
- Overlay UI (subtitle text, import, drag-drop) neo vào `videoWrapper` (tạo bởi `setupDocking`).

**Constraints:**
- Chrome MV3, React 19, Zustand 5, TypeScript 6, Vite 8 + @crxjs/vite-plugin.
- Chrome 114+ / Edge 114+ (Side Panel API). `sidePanel.open({tabId})` cần Chrome 116+.
- Ponytail: reuse codebase tối đa, không dependency mới, bỏ code phức tạp không cần.
- Browser-facing code: phải verify bằng MCP/Playwright.
- Iframe cross-origin: cần `all_frames: true`.

**Forces (trade-off):**
- **Panel tách biệt DOM trang** vs **panel docked cạnh video**: tách biệt = không phá layout, không bị fullscreen che, nhưng panel không "gắn" cạnh video (nằm cạnh tab).
- **Message passing** vs **direct DOM access**: message passing có latency ~5-20ms, nhưng đủ cho subtitle (cue > 1s). Direct DOM = zero latency nhưng phụ thuộc trang.
- **Side Panel** vs **Document PiP**: Side Panel không che video, không always-on-top. Document PiP always-on-top nhưng che video.
- **Bỏ docking code** vs **giữ làm fallback**: bỏ = đơn giản, ít bug. Giữ = backup khi Side Panel không hỗ trợ (Firefox/Safari).

## Decision

### D1: Side Panel API thay thế inject-DOM panel
- Panel subtitle hiển thị trong Chrome Side Panel (`chrome.sidePanel` API), không inject vào DOM trang.
- Side Panel là extension page (origin `chrome-extension://`), React app riêng, DOM riêng.
- Sync video qua message passing: content script → background SW → side panel (port-based).
- **Bỏ hoàn toàn** `subtitleDocking.ts` (F0, docking, fullscreen handler, side-by-side layout).
- **Bỏ** `createPanel`, `renderCueList`, `renderCueListLazy`, `highlightCue`, `scrollToCue` trong `subtitlePanel.ts` (chuyển logic sang React).
- **Giữ** `createToggleButton`, `seekToCue`, `switchPanelPosition` (toggle vẫn trong overlay, seek vẫn dùng `video.currentTime`).

**Rationale**: Side Panel giải quyết tất cả 3 vấn đề cốt lõi: không cần F0, không cần fullscreen handler, không phá layout. Chrome 114+ rộng rãi. Message passing latency đủ cho subtitle. Bỏ ~500 dòng docking code → giảm ~60% độ phức tạp.

**Trade-off chấp nhận**: Panel nằm cạnh tab, không "dock" cạnh video. Nhưng: không che video, không bị fullscreen che, user có thể resize, persistent across navigation.

### D2: Overlay UI vẫn neo vào `video.parentElement` — không cần F0
- Overlay (subtitle text), import button, drag-drop hint, toggle button neo vào `video.parentElement`.
- **Không cần** `setupDocking`, `videoWrapper`, F0 algorithm.
- `video.parentElement` là positioning context đủ cho overlay absolute-positioned.

**Rationale**: Overlay chỉ cần 1 positioning context — `video.parentElement` luôn tồn tại, luôn chứa video. Không cần tìm ancestor xa hơn. F0 chỉ cần cho panel side-by-side (đã bỏ).

### D3: Iframe support qua `all_frames: true` + `match_origin_as_fallback: true`
- Manifest `content_scripts` thêm `"all_frames": true`, `"match_origin_as_fallback": true`.
- Content script chạy trong mọi frame, kể cả cross-origin iframe (hhpanda, coreflix).
- Mỗi frame chạy độc lập, tìm `<video>` trong frame, tạo overlay + toggle.
- Background dùng `sender.tab.id` để relay message đúng tab.

**Rationale**: `all_frames` là cách đúng để extension hoạt động trên video trong iframe. Không cần logic đặc biệt. Chrome hỗ trợ native.

### D4: Message contract — port-based relay qua background SW
- Content script → background: `OPEN_SIDE_PANEL`, `SUBTITLE_CUES_LOADED`, `VIDEO_TIME_UPDATE`, `VIDEO_PLAY_STATE`.
- Background → side panel: relay `SUBTITLE_CUES_LOADED`, `VIDEO_TIME_UPDATE`, `VIDEO_PLAY_STATE`.
- Side panel → background → content script: `SEEK_TO`.
- Port-based: content script + side panel mỗi bên giữ 1 port đến background. Background relay giữa 2 port.
- SW restart → port disconnect → content script reconnect + re-send cues.

**Rationale**: Port-based messaging hiệu quả hơn `sendMessage` cho streaming data (timeupdate liên tục). Background là relay trung gian — không lưu state, chỉ forward. SW ephemeral → reconnect pattern.

### D5: Fallback overlay-only khi Side Panel không hỗ trợ
- Firefox/Safari không hỗ trợ `chrome.sidePanel` → toggle button click → toast "Side Panel không hỗ trợ".
- Overlay (subtitle text) vẫn hoạt động (không phụ thuộc Side Panel).
- Không giữ docking code làm fallback — quá phức tạp, ROI thấp.

**Rationale**: Chrome + Edge chiếm thị phần chính. Firefox/Safari là edge case. Overlay-only vẫn cho phép xem subtitle text, chỉ thiếu cue list. Giữ docking code fallback = maintain 2 hệ thống, không xứng đáng.

## Alternatives Considered

### A1: Document Picture-in-Picture API (Chrome 116+)
- **Pros**: always-on-top, cùng origin (sync trực tiếp), custom HTML.
- **Cons**: **che video** (always-on-top overlap viewport) — violates yêu cầu cốt lõi.
- **Rejected**: Che video là dealbreaker.

### A2: Giữ inject-DOM panel + fix F0 algorithm
- **Pros**: sync trực tiếp (zero latency), panel docked cạnh video.
- **Cons**: F0 algorithm vẫn phức tạp, fullscreen handler vẫn fragile, vẫn phá layout trên 1 số site.
- **Rejected**: Không giải quyết root cause, chỉ patch symptoms.

### A3: chrome.windows.create popup
- **Pros**: cửa sổ riêng, không phụ thuộc DOM trang.
- **Cons**: không always-on-top (deprecated panel type), user phải quản lý cửa sổ, không sync trực tiếp.
- **Rejected**: UX kém hơn Side Panel, không persistent across navigation.

### A4: Shadow DOM trong page
- **Pros**: cô lập CSS, vẫn trong page.
- **Cons**: vẫn bị fullscreen che, vẫn phụ thuộc DOM trang, vẫn cần F0.
- **Rejected**: Không giải quyết vấn đề cốt lõi.

## Consequences

### Positive
- Bỏ ~500 dòng `subtitleDocking.ts` + docking logic trong `content-script.ts`.
- Hoạt động universal trên mọi trang web (kể cả iframe, fullscreen, YouTube, lordflix).
- Không phá layout trang.
- Panel persistent across navigation.
- Mở rộng tương lai: dictionary, translate, copy/export, playback control.
- Full extension API access trong panel (storage, tabs, fetch không CORS, clipboard).

### Negative
- Sync latency ~5-20ms (message passing) — chấp nhận được cho subtitle.
- Panel không "dock" cạnh video — nằm cạnh tab (tradeoff).
- Firefox/Safari không hỗ trợ → fallback overlay-only.
- Phải viết React app mới cho side panel (nhưng reuse logic từ `subtitlePanel.ts`).

### Neutral
- Build size tăng (sidepanel.html + React bundle) — nhưng là page riêng, không affect content script.
- Manifest thêm permission `sidePanel` — user thấy permission prompt.

## References
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Create a side panel](https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel)
- [Edge Sidebar API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/sidebar)
- [Content scripts all_frames](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) (rejected alternative)
