# ADR-010: In-page Episode Switch Detection (Video Element Replacement)

## Status
Accepted (đã implement + verify bằng Edge DevTools MCP)

## Context

ADR-009 D3 fix media accumulation trên `onTabUpdated` loading — đúng cho full
reload / pushState. Nhưng verify thực tế trên themoviebox.org cho thấy episode
switch KHÔNG trigger bất kỳ tab-level navigation event nào:

- **URL không đổi** (`detailEp` query param giữ nguyên trong URL dù video đổi)
- **Không pushState/replaceState** (navLog rỗng sau click episode)
- **Không reload document** (page context persist, `window.__navLog` còn sống)

Cơ chế thực: themoviebox **REPLACE toàn bộ `<video>` element** khi đổi episode
(verified: `data-dev-marker` set trên element cũ biến mất sau switch). Quality
switch KHÔNG replace — giữ cùng element, chỉ đổi `src` (verified:
`sameElement: true`, marker còn).

Hệ quả: `chrome.tabs.onUpdated` không fire → nhánh `loading` trong
`src/background/index.ts` không chạy → `clearTab`/`clearSessionMedia` không chạy
→ media episode cũ accumulate vào episode mới (11 → 22+, thậm chí 4 videos + 40
subtitles do duplicate `?sign=` query param).

**Constraints:**
- Không có native event "episode changed" — `tabs.onUpdated` không fire
- webRequest heuristic (clear trên video URL mới) bị regression: quality switch
  cũng đổi video URL nhưng KHÔNG re-fetch subtitle → clear sẽ mất subtitle list
  (verified: 1080p↔480p đổi src, 0 subtitle request)
- Duration-diff heuristic (clear trên `loadedmetadata` duration diff) bị race:
  clear fire SAU khi subtitle mới đã detect → wipe mất subtitle mới
- `<video>` element replacement là signal đáng tin cậy: episode switch replace
  element, quality switch giữ element (verified)

**Forces (trade-off):**
- **Element-replacement heuristic** vs **duration-diff**: replacement fire
  TRƯỚC khi media mới detect (no race), không cần threshold tuning. Duration-diff
  fire sau loadedmetadata (race wipe subtitle mới).
- **Generic** vs **themoviebox-specific**: element-replacement generic cho mọi
  SPA replace video trên episode switch. Episode-click watcher themoviebox-specific
  (brittle DOM). User yêu cầu generic cho site khác.
- **Clear subtitle** vs **preserve**: episode switch phải clear subtitle cũ
  (accumulate) NHƯNG subtitle mới phải re-detect sau clear. Replacement-based
  clear fire trước media mới detect → subtitle mới detect vào list sạch. ✓

## Decision

### D1: Detect episode switch qua `<video>` element replacement
- Content-script (`src/content/content-script.ts`): MutationObserver persist
  observe `document.body` cho `<video>` element mới được add.
- Track `hasSeenFirstVideo` (boolean, module scope).
- Khi `<video>` mới xuất hiện:
  - Nếu `hasSeenFirstVideo === true` → replacement = episode switch → gửi
    `VIDEO_EPISODE_CHANGED` message.
  - Nếu `hasSeenFirstVideo === false` → first mount → baseline, không gửi.
- Quality switch giữ cùng element → không trigger → subtitle list preserved. ✓

### D2: Background clear trên `VIDEO_EPISODE_CHANGED`
- Background (`src/background/index.ts` `handleVideoEpisodeChanged`): reuse
  methods đã có (dùng trong `onTabRemoved`/`onTabUpdated` loading):
  - `networkInterceptor.clearTab(tabId)`
  - `clearSessionMedia(tabId)`
  - `lastCuesByTab.delete(tabId)`
  - `autoDownloadedTabs.delete(tabId)` (reset guard để episode mới auto-download)
  - `updateBadgeForTab(tabId)`
- Downloads KHÔNG clear (in-progress download episode cũ không abort).
- MessageBus inject `sender.tab.id` vào `payload.tabId` khi content-script gửi
  không tabId.

### D3: Watcher module-level, độc lập `initSubtitleOverlay`
- `initSubtitleOverlay` gắn listener trên 1 video element cụ thể — khi element
  bị replace, listener cũ không fire trên element mới.
- Episode watcher là module-level function riêng, không phụ thuộc overlay lifecycle.
- MutationObserver KHÔNG disconnect (persist theo dõi mọi video element mới).

## Ponytail ceiling
- **Sites replace `<video>` trên quality switch**: sẽ spuriously clear. Verified
  themoviebox KHÔNG (quality giữ element). Upgrade: kết hợp video-URL path
  heuristic.
- **Pages nhiều `<video>` element** (ad-supported): clear trên element thứ 2.
  Upgrade: explicit episode-click watcher theo UI selector.

## Verification (Edge DevTools MCP, themoviebox.org Rings of Power S2)
- Episode switch #1: 1 video → 1 video (clear + new detect, không 2/4). ✓
- Quality switch 1080p↔480p: 1 video + 1 sub → 1 video + 1 sub (no clear,
  `sameElement: true`). ✓
- Episode switch #2: → 1 video (clear + new, không accumulate qua nhiều switch). ✓
- Unit tests: 81/81 integration pass (3 test mới cho VIDEO_EPISODE_CHANGED). ✓
- `npx tsc --noEmit`: pass. ✓

## Files changed
- `src/types/message.ts`: `VIDEO_EPISODE_CHANGED` MessageType + `VideoEpisodeChangedPayload`
- `src/constants/messages.ts`: `VIDEO_EPISODE_CHANGED` constant
- `src/content/content-script.ts`: module-level `initEpisodeChangeWatcher` + `reportEpisodeChangedIfReplacement`
- `src/background/index.ts`: `handleVideoEpisodeChanged` handler + registration
- `tests/unit/background/integration.test.ts`: 3 regression tests
