# Media Accumulation Across Navigation (specific, codebase-coupled)

> **Principle**: [Clear per-navigation state in shared lifecycle handler](principles.md#clear-per-navigation-state-in-shared-lifecycle-handler)

## Problem

Khi user chuyển episode trong cùng tab (SPA navigation hoặc full reload same tab), media từ episode cũ accumulate vào episode mới:
- Episode 1: 11 media detected (1 video + 10 subtitles)
- Navigate episode 2: 22 media (11 cũ + 11 mới) — **sai**, chỉ nên 11

Symptom: Side panel + popup hiển thị media của cả 2 episode, gây confusion.

## Root causes

### Case 1: Full reload / pushState (ADR-009 D3)

`onTabUpdated` handler (`src/background/index.ts:517-529`) khi `changeInfo.status === 'loading'`:
- ✅ Reset `autoDownloadedTabs` guard (đúng)
- ❌ **Không clear media** — comment cũ "Media is NOT cleared here - it persists across navigation until the tab is closed"

`onTabRemoved` handler đã có `clearTab` + `clearSessionMedia` + `lastCuesByTab.delete` + `updateBadgeForTab` — nhưng `onTabUpdated` không reuse.

### Case 2: In-page episode switch, KHÔNG navigation event (ADR-010)

themoviebox.org và các SPA tương tự switch episode bằng cách **REPLACE toàn bộ
`<video>` element** in-page — KHÔNG đổi URL, KHÔNG pushState, KHÔNG reload
(verified Edge MCP: navLog rỗng, page context persist). Do đó
`chrome.tabs.onUpdated` không bao giờ fire → nhánh `loading` trong `onTabUpdated`
không chạy → media accumulate.

Quality switch KHÔNG replace element (chỉ đổi `src`, `sameElement: true`) →
phải phân biệt episode switch vs quality switch.

## Fix

### Case 1: `onTabUpdated` loading (ADR-009 D3)

Thêm 4 dòng vào `onTabUpdated` loading event (reuse methods đã có trong `onTabRemoved`):

```typescript
this.networkInterceptor.clearTab(tabId);
this.clearSessionMedia(tabId);
this.lastCuesByTab.delete(tabId);
this.updateBadgeForTab(tabId);
```

### Case 2: `VIDEO_EPISODE_CHANGED` message (ADR-010)

Content-script (`src/content/content-script.ts`) module-level watcher:
- MutationObserver persist observe `document.body` cho `<video>` element mới.
- Track `hasSeenFirstVideo`. Khi `<video>` mới xuất hiện AND đã seen trước đó
  → replacement = episode switch → gửi `VIDEO_EPISODE_CHANGED`.
- First mount → baseline, không gửi.
- Quality switch giữ cùng element → không trigger → subtitle preserved.

Background (`handleVideoEpisodeChanged`): reuse clear methods (giống `onTabUpdated`
loading + `autoDownloadedTabs.delete`). Downloads KHÔNG clear.

**Tại sao replacement-based, không duration-diff**: replacement fire TRƯỚC khi
media mới detect → clear chạy trước → không race wipe subtitle mới.
Duration-diff (trên `loadedmetadata`) fire SAU khi subtitle detect → wipe mất.

## Key insight

Lifecycle handler (`onTabUpdated` loading) là shared function cho mọi navigation.
Clear state ở đây = root cause fix cho Case 1. Nhưng Case 2 (in-page episode
switch không navigation event) cần signal từ content-script — `<video>` element
replacement là signal đáng tin cậy nhất, fire trước media mới detect (no race).

Pattern: **navigation lifecycle = fresh state** + **in-page content change =
content-script signal**. Mỗi episode phải start clean.

## Verification

### Case 1 (ADR-009)
- Unit test: "clears toolbar badge + media on navigation"; assert
  `getMedia(123).videos.length === 0` — pass.
- Browser MCP: tab navigate (same tab, URL change) → media cũ clear → 11 media
  mới (không 22); tab khác vẫn giữ media riêng ✓

### Case 2 (ADR-010)
- Unit test: 3 tests cho `VIDEO_EPISODE_CHANGED` (clear media, không clear tab
  khác, reject missing tabId) — 81/81 integration pass.
- Browser MCP (themoviebox.org Rings of Power S2):
  - Episode switch #1: 1 video → 1 video (clear + new, không 2/4) ✓
  - Quality switch 1080p↔480p: media preserved (no clear, `sameElement: true`) ✓
  - Episode switch #2: → 1 video (không accumulate qua nhiều switch) ✓

