# Media Accumulation Across Navigation (specific, codebase-coupled)

> **Principle**: [Clear per-navigation state in shared lifecycle handler](principles.md#clear-per-navigation-state-in-shared-lifecycle-handler)

## Problem

Khi user chuyển episode trong cùng tab (SPA navigation hoặc full reload same tab), media từ episode cũ accumulate vào episode mới:
- Episode 1: 11 media detected (1 video + 10 subtitles)
- Navigate episode 2: 22 media (11 cũ + 11 mới) — **sai**, chỉ nên 11

Symptom: Side panel + popup hiển thị media của cả 2 episode, gây confusion.

## Root causes

`onTabUpdated` handler (`src/background/index.ts:517-529`) khi `changeInfo.status === 'loading'`:
- ✅ Reset `autoDownloadedTabs` guard (đúng)
- ❌ **Không clear media** — comment cũ "Media is NOT cleared here - it persists across navigation until the tab is closed"

`onTabRemoved` handler đã có `clearTab` + `clearSessionMedia` + `lastCuesByTab.delete` + `updateBadgeForTab` — nhưng `onTabUpdated` không reuse.

## Fix

Thêm 4 dòng vào `onTabUpdated` loading event (reuse methods đã có trong `onTabRemoved`):

```typescript
this.networkInterceptor.clearTab(tabId);
this.clearSessionMedia(tabId);
this.lastCuesByTab.delete(tabId);
this.updateBadgeForTab(tabId);
```

Update comment: "Media is NOT cleared here" → "Clear media from previous page (e.g. previous episode) so each page load starts fresh".

## Key insight

Lifecycle handler (`onTabUpdated` loading) là shared function cho mọi navigation. Clear state ở đây = root cause fix, không patch symptom. Reuse methods đã có trong `onTabRemoved` — không code mới, chỉ thêm 4 dòng.

Pattern: **navigation lifecycle = fresh state**. Mỗi page load (episode mới) phải start clean. Persist across navigation chỉ đúng khi user requirement là "switch tab và back không mất media" — nhưng khi requirement là "mỗi episode chỉ có media của nó" → clear on navigation.

## Verification

- Unit test: 2 tests "does NOT clear toolbar badge (media persists)" → "clears toolbar badge + media on navigation"; assert `getMedia(123).videos.length === 0` — 78/78 pass
- Browser MCP: tab navigate (same tab, URL change) → media cũ clear → 11 media mới (không 22); tab khác vẫn giữ media riêng ✓
